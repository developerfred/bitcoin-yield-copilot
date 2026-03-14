import { ClaudeAgent, type Tool, type IncomingMessage, type ToolUseBlock } from './claude.js';
import { MinimaxAgent } from './minimax.js';
import { config } from '../config.js';
import pino from 'pino';

const logger = pino({ name: 'agent:factory' });

export type { Tool, IncomingMessage, ToolUseBlock };

export interface AgentInterface {
  sendMessage(
    messages: IncomingMessage[],
    tools?: Tool[],
    systemPrompt?: string
  ): Promise<{ response: string; toolCalls: ToolUseBlock[] }>;
}

export function createAgent(): AgentInterface {
  const provider = config.llm.provider;
  
  switch (provider) {
    case 'minimax':
      logger.info('Creating Minimax agent');
      return new MinimaxAgent();
    
    case 'openrouter':
      logger.warn('OpenRouter not yet implemented, falling back to Anthropic');
      return new ClaudeAgent();
    
    case 'anthropic':
    default:
      logger.info('Creating Anthropic Claude agent');
      return new ClaudeAgent();
  }
}
