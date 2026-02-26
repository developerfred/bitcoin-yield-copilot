import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config.js';
import { createLogger } from 'pino';
import { spawn } from 'child_process';
import path from 'path';

const logger = createLogger({ name: 'mcp:client' });

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallResult {
  tool: string;
  result: unknown;
  error?: string;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;
  private tools: MCPTool[] = [];

  async connect(): Promise<void> {
    if (this.isConnected) return;

    logger.info('Connecting to MCP server...');

    const serverPath = config.mcp.serverPath;
    
    // Resolve the actual path
    const resolvedPath = path.resolve(process.cwd(), serverPath);

    const serverProcess = spawn(resolvedPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        STACKS_NETWORK: config.stacks.network,
      },
    });

    this.transport = new StdioClientTransport({
      stdin: serverProcess.stdin!,
      stdout: serverProcess.stdout!,
      stderr: serverProcess.stderr!,
    });

    this.client = new Client(
      {
        name: 'bitcoin-yield-copilot',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;

    // Load available tools
    await this.loadTools();

    logger.info({ toolCount: this.tools.length }, 'Connected to MCP server');
  }

  private async loadTools(): Promise<void> {
    if (!this.client) return;

    const response = await this.client.request(
      { method: 'tools/list' },
      { limit: 100 }
    );

    this.tools = (response.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema || t.input_schema,
    }));

    logger.debug({ tools: this.tools.map((t) => t.name) }, 'Loaded MCP tools');
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      logger.debug({ toolName, args }, 'Calling MCP tool');

      const result = await this.client!.request(
        { method: 'tools/call', params: { name: toolName, arguments: args } },
        { timeout: 30000 }
      );

      return { tool: toolName, result };
    } catch (error: any) {
      logger.error({ toolName, error: error.message }, 'MCP tool call failed');
      return { tool: toolName, result: null, error: error.message };
    }
  }

  // Convenience methods for common operations
  async getStacksBalance(address: string): Promise<{ stx: string; sbtc: string }> {
    const result = await this.callTool('get_balance', { address });
    return result.result as { stx: string; sbtc: string };
  }

  async getProtocolAPYs(): Promise<{ protocol: string; apy: number; token: string }[]> {
    const apys: { protocol: string; apy: number; token: string }[] = [];
    
    // Try to get APYs from different protocols
    const protocols = ['zest', 'alex', 'hermetica', 'bitflow'];
    
    for (const protocol of protocols) {
      try {
        const result = await this.callTool(`${protocol}_apy`, {});
        if (result.result && !result.error) {
          apys.push({
            protocol,
            apy: result.result as number,
            token: 'sBTC',
          });
        }
      } catch {
        // Protocol not available
      }
    }

    return apys;
  }

  async getZestYieldInfo(): Promise<any> {
    return this.callTool('zest_get_yield_info', {});
  }

  async getHermeticaVaults(): Promise<any> {
    return this.callTool('hermetica_get_vaults', {});
  }

  async getALEXPools(): Promise<any> {
    return this.callTool('alex_get_pools', {});
  }

  async getBitflowPools(): Promise<any> {
    return this.callTool('bitflow_get_pools', {});
  }

  async executeDeposit(
    protocol: string,
    token: string,
    amount: string,
    senderAddress: string
  ): Promise<{ txId: string; contractCall: any }> {
    const result = await this.callTool(`${protocol}_deposit`, {
      token,
      amount,
      sender: senderAddress,
    });

    return result.result as { txId: string; contractCall: any };
  }

  async executeWithdraw(
    protocol: string,
    token: string,
    amount: string,
    senderAddress: string
  ): Promise<{ txId: string; contractCall: any }> {
    const result = await this.callTool(`${protocol}_withdraw`, {
      token,
      amount,
      sender: senderAddress,
    });

    return result.result as { txId: string; contractCall: any };
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    const result = await this.callTool('broadcast_transaction', { tx_hex: txHex });
    return result.result as string;
  }

  async getTransactionStatus(txId: string): Promise<{ status: string; confirmations: number }> {
    const result = await this.callTool('get_transaction_status', { tx_id: txId });
    return result.result as { status: string; confirmations: number };
  }

  getAvailableTools(): MCPTool[] {
    return this.tools;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from MCP server');
    }
  }
}

export const mcpClient = new MCPClient();
