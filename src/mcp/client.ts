import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config.js';
import pino from 'pino';
import { spawn, exec } from 'child_process';
import path from 'path';

const logger = pino({ name: 'mcp:client' });

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

    let serverProcess: any;

    if (config.mcp.useDocker) {
      // Use Docker container for MCP server
      logger.info('Checking MCP Docker container...');
      
      // Check if container is running
      const containerName = config.mcp.dockerContainer;
      
      await new Promise<void>((resolve) => {
        const checkContainer = exec(`docker ps --filter name=${containerName} --format '{{.Names}}'`);
        checkContainer.stdout?.on('data', (data) => {
          if (data.toString().includes(containerName)) {
            logger.info('MCP Docker container is running');
          }
        });
        checkContainer.on('close', () => resolve());
      });

      // Use docker exec to run the MCP server
      serverProcess = spawn('docker', [
        'exec', '-i',
        containerName,
        'node', 'dist/index.js'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NETWORK: config.mcp.network,
        },
      });

      logger.info('Using Docker MCP server');
    } else {
      // Use local binary
      const serverPath = config.mcp.serverPath;
      const resolvedPath = path.resolve(process.cwd(), serverPath);
      
      serverProcess = spawn(resolvedPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NETWORK: config.mcp.network,
        },
      });
      
      logger.info('Using local MCP server');
    }

    this.transport = new StdioClientTransport({
      stdin: serverProcess.stdin!,
      stdout: serverProcess.stdout!,
      stderr: serverProcess.stderr!,
    } as any);

    this.client = new Client(
      {
        name: 'bitcoin-yield-copilot',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        } as any,
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
      { limit: 100 } as any
    );

    this.tools = ((response as any).tools || []).map((t: any) => ({
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
        {} as any,
        { timeout: 30000 }
      );

      const content = (result as any)?.content;
      const parsed = Array.isArray(content)
        ? content[0]?.text
        : result;

      return { tool: toolName, result: parsed };
    } catch (error: any) {
      logger.error({ toolName, error: error.message }, 'MCP tool call failed');
      return { tool: toolName, result: null, error: error.message };
    }
  }

  // Convenience methods for common operations
  async getStacksBalance(address: string): Promise<{ stx: string; sbtc: string }> {
    const result = await this.callTool('get_stx_balance', { address });
    return result.result as { stx: string; sbtc: string };
  }

  async getProtocolAPYs(): Promise<{ protocol: string; apy: number; token: string }[]> {
    const apys: { protocol: string; apy: number; token: string }[] = [];
    
    try {
      // Get Zest Protocol yields
      try {
        const zestResult = await this.callTool('zest_list_assets', {});
        if (zestResult.result && !zestResult.error) {
          const assets = zestResult.result as any;
          if (Array.isArray(assets)) {
            for (const asset of assets) {
              if (asset.apy) {
                apys.push({
                  protocol: 'zest',
                  apy: asset.apy || 0,
                  token: asset.symbol || 'sBTC',
                });
              }
            }
          }
        }
      } catch (e) {
        logger.debug({ error: e }, 'Failed to get Zest yields');
      }

      // Get ALEX DEX pools
      try {
        const alexResult = await this.callTool('alex_list_pools', {});
        if (alexResult.result && !alexResult.error) {
          const pools = alexResult.result as any;
          if (Array.isArray(pools)) {
            for (const pool of pools.slice(0, 5)) {
              if (pool.apy_24h) {
                apys.push({
                  protocol: 'alex',
                  apy: pool.apy_24h || 0,
                  token: `${pool.token_x?.symbol}/${pool.token_y?.symbol}`,
                });
              }
            }
          }
        }
      } catch (e) {
        logger.debug({ error: e }, 'Failed to get ALEX yields');
      }

      // Get Bitflow pools
      try {
        const bitflowResult = await this.callTool('bitflow_get_ticker', {});
        if (bitflowResult.result && !bitflowResult.error) {
          const tickers = bitflowResult.result as any;
          if (Array.isArray(tickers)) {
            for (const ticker of tickers.slice(0, 3)) {
              if (ticker.apy) {
                apys.push({
                  protocol: 'bitflow',
                  apy: ticker.apy || 0,
                  token: ticker.pair || 'STX',
                });
              }
            }
          }
        }
      } catch (e) {
        logger.debug({ error: e }, 'Failed to get Bitflow yields');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to fetch yields');
    }

    logger.info({ apys }, 'Fetched yields');
    return apys;
  }

  async getZestYieldInfo(): Promise<any> {
    return this.callTool('zest_get_yield_info', {});
  }

  async getHermeticaVaults(): Promise<any> {
    return this.callTool('hermetica_get_vaults', {});
  }

  async getALEXPools(): Promise<any> {
    return this.callTool('alex_list_pools', {});
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