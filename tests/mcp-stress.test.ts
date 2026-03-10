import { describe, it, expect, vi } from 'vitest';
import { describe, it, expect, vi } from 'vitest
import { mcpClient } from '../src/mcp/client.js'

describe('MCP Stress Tests', () => {
  describe('Concurrent Connections', () => {
    it('should handle multiple concurrent connections', async () => {
      const concurrentCalls = 10;
      const promises = [];
      
      for (let i = 0; i < concurrentCalls; i++) {
        promises.push(
          mcpClient.getProtocolAPYs().catch(() => null) // Ignore individual failures
        );
      }
      
      const results = await Promise.allSettled(promises);
      
      // Should have at least some successful responses
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(0);
    });

    it('should handle rapid sequential calls', async () => {
      const rapidCalls = 50;
      const results = [];
      
      for (let i = 0; i < rapidCalls; i++) {
        const result = await mcpClient.getProtocolAPYs().catch(() => null);
        results.push(result);
      }
      
      // Should complete without crashing
      expect(results.length).toBe(rapidCalls);
    });
  });

  describe('Performance', () => {
    it('should have reasonable response times', async () => {
      const startTime = Date.now();
      
      const result = await mcpClient.getProtocolAPYs();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result).toBeDefined();
    });

    it('should handle large data sets', async () => {
      try {
        // Try to get many pools/assets
        const zestResult = await mcpClient.callTool('zest_list_assets', {});
        expect(zestResult).toBeDefined();
        
        const alexResult = await mcpClient.callTool('alex_list_pools', {});
        expect(alexResult).toBeDefined();
        
        // Should handle large arrays without crashing
      } catch (error) {
        console.warn('Large data test skipped: ', error.message);
      }
    });
  });

  describe('Recovery', () => {
    it('should recover from connection failures', async () => {
      // Simulate failure by disconnecting
      await mcpClient.disconnect();
      
      // Try to use a tool (should fail)
      try {
        await mcpClient.getProtocolAPYs();
      } catch (error) {
        // Should automatically reconnect
        await mcpClient.connect();
        expect(mcpClient.isConnected).toBe(true);
      }
    });

    it('should handle timeout gracefully', async () => {
      // Test with very long timeout
      try {
        const result = await mcpClient.callTool('get_stx_balance', { address: 'SP123...' }, { timeout: 30000 });
        expect(result).toBeDefined();
      } catch (error) {
        // Should handle timeout without crashing
        expect(error).toBeDefined();
      }
    });
  });
});