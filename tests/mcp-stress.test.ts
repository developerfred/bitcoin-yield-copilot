import { describe, it, expect } from 'vitest';
import { mcpClient } from '../src/mcp/client.js';

describe('MCP Stress Tests', () => {
  describe('Instantiation', () => {
    it('should have mcpClient defined', () => {
      expect(mcpClient).toBeDefined();
    });

    it('should have getProtocolAPYs method', () => {
      expect(typeof mcpClient.getProtocolAPYs).toBe('function');
    });

    it('should have callTool method', () => {
      expect(typeof mcpClient.callTool).toBe('function');
    });
  });

  describe('Methods', () => {
    it('should have getStacksBalance method', () => {
      expect(typeof mcpClient.getStacksBalance).toBe('function');
    });

    it('should have executeDeposit method', () => {
      expect(typeof mcpClient.executeDeposit).toBe('function');
    });

    it('should have executeWithdraw method', () => {
      expect(typeof mcpClient.executeWithdraw).toBe('function');
    });

    it('should have broadcastTransaction method', () => {
      expect(typeof mcpClient.broadcastTransaction).toBe('function');
    });
  });
});
