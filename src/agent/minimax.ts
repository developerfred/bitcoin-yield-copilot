import { config } from '../config.js';
import pino from 'pino';

const logger = pino({ name: 'agent:minimax' });

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

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

interface MinimaxMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MinimaxChoice {
  finish_reason: string;
  index: number;
  message: {
    role: string;
    content: string;
  };
}

interface MinimaxResponse {
  id: string;
  choices: MinimaxChoice[];
  created: number;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MinimaxAgent {
  private apiKey: string;
  private groupId: string;
  private model = 'abab6.5s-chat';
  private maxTokens = 4096;
  private baseUrl = 'https://api.minimax.chat/v1';

  constructor() {
    this.apiKey = config.llm.minimaxApiKey ?? '';
    this.groupId = config.llm.minimaxGroupId ?? '';
    
    if (!this.apiKey) {
      throw new Error('MINIMAX_API_KEY is required');
    }
    if (!this.groupId) {
      throw new Error('MINIMAX_GROUP_ID is required');
    }
  }

  async sendMessage(
    messages: IncomingMessage[],
    tools: Tool[] = [],
    systemPrompt?: string
  ): Promise<{ response: string; toolCalls: ToolUseBlock[] }> {
    const messagesForApi: MinimaxMessage[] = messages.map((m) => {
      if (m.role === 'tool_result') {
        return { role: 'user', content: m.content };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });

    if (systemPrompt) {
      messagesForApi.unshift({ role: 'user', content: systemPrompt });
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/text/chatcompletion_v2?GroupId=${this.groupId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: messagesForApi,
            max_tokens: this.maxTokens,
            temperature: 0.7,
            tools: tools.length > 0 ? this.convertTools(tools) : undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error({ status: response.status, error }, 'Minimax API error');
        throw new Error(`Minimax API error: ${response.status}`);
      }

      const data: MinimaxResponse = await response.json();
      const choice = data.choices[0];

      if (!choice) {
        throw new Error('No response from Minimax');
      }

      const toolCalls = this.parseToolCalls(choice.message.content);

      return {
        response: this.stripToolCalls(choice.message.content),
        toolCalls,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to send message to Minimax');
      throw error;
    }
  }

  private convertTools(tools: Tool[]): Record<string, unknown>[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }));
  }

  private parseToolCalls(content: string): ToolUseBlock[] {
    const toolCalls: ToolUseBlock[] = [];
    const toolCallRegex = /<tool_call>\s*<tool_name>(\w+)<\/tool_name>\s*<tool_input>([\s\S]*?)<\/tool_input>\s*<\/tool_call>/g;
    
    let match;
    let idCounter = 0;
    
    while ((match = toolCallRegex.exec(content)) !== null) {
      const name = match[1];
      try {
        const input = JSON.parse(match[2]);
        toolCalls.push({
          type: 'tool_use',
          id: `minimax-tool-${idCounter++}`,
          name,
          input,
        });
      } catch {
        logger.warn({ raw: match[2] }, 'Failed to parse tool input');
      }
    }
    
    return toolCalls;
  }

  private stripToolCalls(content: string): string {
    return content.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
  }
}
