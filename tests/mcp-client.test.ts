import { describe, it, expect, vi } from 'vitest';
import { describe, it, expect, vi } from 'vitest';
import { MCPClient } from '../src/mcp/client.js';
import { config } from '../src/config.js';

describe('MCPClient', () => {
  let mcpClient: MCPClient;
  let mockTransport: any;
  let mockClient: any;

  beforeEach(() => {
    mockTransport = {
      stdin: { write: vi.fn() },
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() }
    };
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      request: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
      Client: vi.fn().mockImplementation(() => mockClient)
    }));
    vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
      StdioClientTransport: vi.fn().mockImplementation(() => mockTransport)
    }));
    
    mcpClient = new MCPClient();
  });

  describe('connect', () => {
    it('should connect to local MCP server', async () => {
      const spawnMock = vi.spyOn(require('child_process'), 'spawn');
      spawnMock.mockReturnValue({ stdin: {}, stdout: {}, stderr: {} } as any);
      
      await mcpClient.connect();
      
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mcpClient.isConnected).toBe(true);
    });

    it('should connect to Docker MCP server when configured', async () => {
      config.mcp.useDocker = true;
      const spawnMock = vi.spyOn(require('child_process'), 'spawn');
      spawnMock.mockReturnValue({ stdin: {}, stdout: {}, stderr: {} } as any);
      
      await mcpClient.connect();
      
      expect(spawnMock).toHaveBeenCalledWith('docker', expect.anything());
    });

    it('should load tools after connection', async () => {
      mockClient.request.mockResolvedValueOnce({
        tools: [
          { name: 'test_tool', description: 'Test tool', inputSchema: {} }
        ]
      });
      
      await mcpClient.connect();
      
      expect(mcpClient.getAvailableTools()).toHaveLength(1);
    });
  });

  describe('callTool', () => {
    it('should call MCP tool successfully', async () => {
      mockClient.request.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'success' }]
      });
      
      const result = await mcpClient.callTool('test_tool', { param: 'value' });
      
      expect(result.result).toBe('success');
      expect(result.tool).toBe('test_tool');
    });

    it('should handle tool call failure', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await mcpClient.callTool('test_tool', { param: 'value' });
      
      expect(result.error).toBe('Network error');
      expect(result.result).toBeNull();
    });
  });

  describe('getProtocolAPYs', () => {
    it('should fetch APYs from multiple protocols', async () => {
      mockClient.request.mockImplementation((request) => {
        if (request.method === 'tools/call' && request.params.name === 'zest_list_assets') {
          return Promise.resolve({
            content: [{ type: 'text', text: JSON.stringify([{ apy: 8.2, symbol: 'sBTC' }]) }]
          });
        }
        if (request.method === 'tools/call' && request.params.name === 'alex_list_pools') {
          return Promise.resolve({
            content: [{ type: 'text', text: JSON.stringify([{ apy_24h: 11.4, token_x: { symbol: 'sBTC' }, token_y: { symbol: 'STX' } }]) }]
          });
        }
        return Promise.resolve({ content: [] });
      });
      
      const apys = await mcpClient.getProtocolAPYs();
      
      expect(apys).toHaveLength(2);
      expect(apys).toContainEqual({
        protocol: 'zest',
        apy: 8.2,
        token: 'sBTC'
      });
    });

    it('should handle partial failures gracefully', async () => {
      mockClient.request.mockImplementation((request) => {
        if (request.method === 'tools/call' && request.params.name === 'zest_list_assets') {
          return Promise.reject(new Error('Zest API error'));
        }
        if (request.method === 'tools/call' && request.params.name === 'alex_list_pools') {
          return Promise.resolve({
            content: [{ type: 'text', text: JSON.stringify([{ apy_24h: 11.4 }]) }]
          });
        }
        return Promise.resolve({ content: [] });
      });
      
      const apys = await mcpClient.getProtocolAPYs();
      
      expect(apys).toHaveLength(1);
      expect(apys[0].protocol).toBe('alex');
    });
  });

  describe('executeDeposit/Withdraw', () => {
    it('should execute deposit transaction', async () => {
      mockClient.request.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ txId: 'tx123', contractCall: {} }) }]
      });
      
      const result = await mcpClient.executeDeposit('zest', 'sBTC', '0.1', 'SP123...');
      
      expect(result.txId).toBe('tx123');
    });

    it('should execute withdraw transaction', async () => {
      mockClient.request.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ txId: 'tx456', contractCall: {} }) }]
      });
      
      const result = await mcpClient.executeWithdraw('zest', 'sBTC', '0.05', 'SP123...');
      
      expect(result.txId).toBe('tx456');
    });
  });

  describe('broadcastTransaction', () => {
    it('should broadcast transaction successfully', async () => {
      mockClient.request.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'tx_hash_123' }]
      });
      
      const txHash = await mcpClient.broadcastTransaction('tx_hex_data');
      
      expect(txHash).toBe('tx_hash_123');
    });
  });
});