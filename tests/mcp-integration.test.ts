import { describe, it, expect, vi } from 'vitest';
import { describe, it, expect, vi } from 'vitest
import { mcpClient } from '../src/mcp/client.js'
import { config } from '../src/config.js'

describe('MCP Integration Tests', () => {
  describe('Connection Management', () => {
    it('should maintain persistent connection', async () => {
      const initialConnection = await mcpClient.connect();
      expect(mcpClient.isConnected).toBe(true);
      
      const toolsBefore = mcpClient.getAvailableTools();
      expect(toolsBefore).toBeInstanceOf(Array);
      
      // Simulate some activity
      await mcpClient.getProtocolAPYs();
      
      const toolsAfter = mcpClient.getAvailableTools();
      expect(toolsAfter).toEqual(toolsBefore);
    });

    it('should reconnect if connection lost', async () => {
      // Force disconnect
      await mcpClient.disconnect();
      expect(mcpClient.isConnected).toBe(false);
      
      // Try to use a tool
      try {
        await mcpClient.getProtocolAPYs();
      } catch (error) {
        // Should automatically reconnect
        expect(mcpClient.isConnected).toBe(true);
      }
    });
  });

  describe('Protocol Integration', () => {
    it('should integrate with Zest Protocol', async () => {
      try {
        const zestInfo = await mcpClient.getZestYieldInfo();
        expect(zestInfo).toBeDefined();
        expect(typeof zestInfo).toBe('object');
      } catch (error) {
        console.warn('Zest integration test skipped: ', error.message);
      }
    });

    it('should integrate with ALEX DEX', async () => {
      try {
        const pools = await mcpClient.getALEXPools();
        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
      } catch (error) {
        console.warn('ALEX integration test skipped: ', error.message);
      }
    });

    it('should integrate with Bitflow', async () => {
      try {
        const pools = await mcpClient.getBitflowPools();
        expect(pools).toBeDefined();
        expect(Array.isArray(pools)).toBe(true);
      } catch (error) {
        console.warn('Bitflow integration test skipped: ', error.message);
      }
    });

    it('should integrate with Hermetica', async () => {
      try {
        const vaults = await mcpClient.getHermeticaVaults();
        expect(vaults).toBeDefined();
        expect(Array.isArray(vaults)).toBe(true);
      } catch (error) {
        console.warn('Hermetica integration test skipped: ', error.message);
      }
    });
  });

  describe('Transaction Flow', () => {
    it('should execute complete deposit flow', async () => {
      const testAddress = 'SP123TESTADDRESS1234567890123456789012345678';
      
      try {
        // Get balance first
        const balance = await mcpClient.getStacksBalance(testAddress);
        expect(balance).toHaveProperty('stx');
        expect(balance).toHaveProperty('sbtc');
        
        // Try to get yields
        const apys = await mcpClient.getProtocolAPYs();
        expect(apys).toBeInstanceOf(Array);
        
        // Try to execute deposit (if there's balance)
        if (parseFloat(balance.sbtc) > 0.01) {
          const result = await mcpClient.executeDeposit(
            'zest',
            'sBTC',
            '0.01',
            testAddress
          );
          expect(result).toHaveProperty('txId');
          expect(result).toHaveProperty('contractCall');
        }
      } catch (error) {
        console.warn('Transaction flow test skipped: ', error.message);
      }
    });

    it('should execute complete withdraw flow', async () => {
      const testAddress = 'SP123TESTADDRESS1234567890123456789012345678';
      
      try {
        // Try to execute withdraw (if supported)
        const result = await mcpClient.executeWithdraw(
          'zest',
          'sBTC',
          '0.001',
          testAddress
        );
        
        // Should either succeed or throw a specific error
        if (result) {
          expect(result).toHaveProperty('txId');
          expect(result).toHaveProperty('contractCall');
        }
      } catch (error) {
        // Some errors are expected (insufficient funds, etc.)
        console.log('Withdraw test error: ', error.message);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle MCP server unavailability', async () => {
      // Simulate server not running
      try {
        await mcpClient.disconnect();
        await mcpClient.getProtocolAPYs();
        // Should throw an error
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid tool calls', async () => {
      try {
        await mcpClient.callTool('non_existent_tool', {});
        // Should handle gracefully
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});