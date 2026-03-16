import { describe, it, expect } from 'vitest';
import { MCPClient } from '../src/mcp/client.js';

describe('MCPClient', () => {
  describe('instantiation', () => {
    it('should create instance', () => {
      const client = new MCPClient();
      expect(client).toBeDefined();
    });

    it('should have getAvailableTools method', () => {
      const client = new MCPClient();
      expect(typeof client.getAvailableTools).toBe('function');
    });

    it('should have callTool method', () => {
      const client = new MCPClient();
      expect(typeof client.callTool).toBe('function');
    });

    it('should have getProtocolAPYs method', () => {
      const client = new MCPClient();
      expect(typeof client.getProtocolAPYs).toBe('function');
    });

    it('should have executeDeposit method', () => {
      const client = new MCPClient();
      expect(typeof client.executeDeposit).toBe('function');
    });

    it('should have executeWithdraw method', () => {
      const client = new MCPClient();
      expect(typeof client.executeWithdraw).toBe('function');
    });

    it('should have broadcastTransaction method', () => {
      const client = new MCPClient();
      expect(typeof client.broadcastTransaction).toBe('function');
    });

    it('should have getStacksBalance method', () => {
      const client = new MCPClient();
      expect(typeof client.getStacksBalance).toBe('function');
    });

    it('should have getTransactionStatus method', () => {
      const client = new MCPClient();
      expect(typeof client.getTransactionStatus).toBe('function');
    });
  });
});
