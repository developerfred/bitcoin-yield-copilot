import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { createLogger } from 'pino';

const logger = createLogger({ name: 'agent:claude' });

export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | ToolUseBlock;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export class ClaudeAgent {
  private client: Anthropic;
  private model = 'claude-sonnet-4-20250514';
  private maxTokens = 4096;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  async sendMessage(
    messages: Message[],
    tools: Tool[] = [],
    systemPrompt?: string
  ): Promise<{ response: string; toolCalls: ToolUseBlock[] }> {
    const system = systemPrompt ?? this.getDefaultSystemPrompt();

    const toolDefs = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      messages: messages as any,
    });

    const toolCalls: ToolUseBlock[] = [];
    let responseText = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        responseText += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    logger.debug({ toolCalls: toolCalls.length, responseLength: responseText.length }, 'Claude response');

    return { response: responseText, toolCalls };
  }

  private getDefaultSystemPrompt(): string {
    return `You are Bitcoin Yield Copilot, an autonomous AI agent that helps users manage their Bitcoin yield in the Stacks ecosystem.

Your capabilities:
- Query real-time APYs from DeFi protocols (Zest, ALEX, Hermetica, Bitflow)
- Execute deposits and withdrawals to/from yield protocols
- Monitor portfolio positions and PnL
- Provide personalized recommendations based on user risk profile

User interaction style:
- Be helpful, concise, and friendly
- Always explain your reasoning
- Ask for confirmation before executing transactions
- Provide transaction receipts with explorer links

Safety rules:
- Never execute transactions without explicit user confirmation
- Always show the estimated gas cost before executing
- Warn users about potential risks
- Never share private keys or sensitive information`;
  }

  async getYieldRecommendations(
    userRiskProfile: 'conservative' | 'moderate' | 'aggressive',
    availableTokens: string[]
  ): Promise<string> {
    const riskGuidance = {
      conservative: 'Focus on stable, established protocols with lower APY but proven track record.',
      moderate: 'Balance between established protocols and higher-yield opportunities.',
      aggressive: 'Consider higher-yield protocols, even with higher risk. Include LP positions.',
    };

    const messages: Message[] = [
      {
        role: 'user',
        content: `Based on a ${userRiskProfile} risk profile and available tokens [${availableTokens.join(', ')}], what yield opportunities would you recommend? ${riskGuidance[userRiskProfile]}`,
      },
    ];

    const { response } = await this.sendMessage(messages);
    return response;
  }
}

export const claudeAgent = new ClaudeAgent();
