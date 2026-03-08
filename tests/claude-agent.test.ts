import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAgent } from '../src/agent/claude.js';
import { config } from '../src/config.js';

describe('ClaudeAgent', () => {
  let claudeAgent: ClaudeAgent;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      messages: {
        create: vi.fn()
      }
    };
    
    vi.mock('@anthropic-ai/sdk', () => ({
      Anthropic: vi.fn().mockImplementation(() => mockClient),
      MessageParam: vi.fn(),
      ToolUseBlock: vi.fn()
    }));
    
    claudeAgent = new ClaudeAgent();
  });

  describe('sendMessage', () => {
    it('should send message to Claude successfully', async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Hello! How can I help you?' },
          { type: 'tool_use', id: 'tool_1', name: 'get_yields', input: {} }
        ]
      });
      
      const messages = [
        { role: 'user', content: 'What are the current yields?' }
      ];
      
      const result = await claudeAgent.sendMessage(messages);
      
      expect(result.response).toBe('Hello! How can I help you?');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('get_yields');
    });

    it('should handle tool results in conversation', async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Here are the yields:' },
          { type: 'tool_use', id: 'tool_1', name: 'get_yields', input: {} }
        ]
      });
      
      const messages = [
        { role: 'user', content: 'What are the current yields?' },
        { role: 'tool_result', tool_use_id: 'tool_1', content: JSON.stringify([{ apy: 8.2 }]) }
      ];
      
      const result = await claudeAgent.sendMessage(messages);
      
      expect(result.response).toContain('Here are the yields');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.messages.create.mockRejectedValueOnce(new Error('API rate limit'));
      
      const messages = [
        { role: 'user', content: 'What are the current yields?' }
      ];
      
      await expect(claudeAgent.sendMessage(messages)).rejects.toThrow('API rate limit');
    });
  });

  describe('getDefaultSystemPrompt', () => {
    it('should return appropriate system prompt', () => {
      const prompt = claudeAgent.getDefaultSystemPrompt();
      
      expect(prompt).toContain('Bitcoin Yield Copilot');
      expect(prompt).toContain('Check yield opportunities');
      expect(prompt).toContain('Prepare deposit and withdraw transactions');
    });
  });

  describe('tool handling', () => {
    it('should convert tools to correct format', async () => {
      const tools = [
        {
          name: 'get_yields',
          description: 'Get current yield opportunities',
          input_schema: { type: 'object', properties: {} }
        }
      ];
      
      const messages = [
        { role: 'user', content: 'What are the current yields?' }
      ];
      
      await claudeAgent.sendMessage(messages, tools);
      
      const toolDefs = mockClient.messages.create.mock.calls[0][0].tools;
      expect(toolDefs).toHaveLength(1);
      expect(toolDefs[0].name).toBe('get_yields');
    });
  });
});