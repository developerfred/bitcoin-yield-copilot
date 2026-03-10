import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolUseBlock as SDKToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { config } from '../config.js';
import pino from 'pino';

const logger = pino({ name: 'agent:claude' });

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Messages the caller sends IN to sendMessage()
export type IncomingMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'tool_result'; tool_use_id: string; content: string };

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export class ClaudeAgent {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';
  private maxTokens = 4096;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.llm.anthropicApiKey,
    });
  }

  async sendMessage(
    messages: IncomingMessage[],
    tools: Tool[] = [],
    systemPrompt?: string
  ): Promise<{ response: string; toolCalls: ToolUseBlock[] }> {
    const system = systemPrompt ?? this.getDefaultSystemPrompt();

    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));

    // Convert our IncomingMessage[] → Anthropic SDK MessageParam[]
    const sdkMessages: MessageParam[] = messages.map((m) => {
      if (m.role === 'tool_result') {
        // Tool results go as role "user" with a tool_result content block
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.tool_use_id,
              content: m.content, // must be string here
            },
          ],
        };
      }

      // Normal user or assistant message
      return {
        role: m.role,
        content: m.content,
      };
    });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: sdkMessages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      });

      const textBlock = response.content.find((c) => c.type === 'text');
      const toolUseBlocks = response.content.filter(
        (c): c is SDKToolUseBlock => c.type === 'tool_use'
      );

      return {
        response: textBlock?.type === 'text' ? textBlock.text : '',
        toolCalls: toolUseBlocks.map((t) => ({
          type: 'tool_use',
          id: t.id,
          name: t.name,
          input: t.input as Record<string, unknown>,
        })),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to send message to Claude');
      throw error;
    }
  }

  private getDefaultSystemPrompt(): string {
    return `You are a helpful Bitcoin Yield Copilot assistant. You help users manage their Bitcoin yield in the Stacks ecosystem.

Your capabilities:
- Check yield opportunities across DeFi protocols
- View portfolio positions
- Prepare deposit and withdraw transactions
- Check wallet balances

Always:
- Be concise and clear
- Ask for confirmation before executing transactions
- Explain risks when relevant
- Use the user's preferred language`;
  }
}