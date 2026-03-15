import { callContract, ContractCallResult, Network } from '../utils/contract-call.ts';
import { config } from '../config.ts';

export interface sBTCPool {
  protocol: string;
  name: string;
  apy: number;
  tvl: bigint;
  token: string;
  poolAddress: string;
}

export interface sBTCDepositParams {
  amount: bigint;
  poolProtocol: string;
  userWallet: string;
}

export interface sBTCWithdrawParams {
  amount: bigint;
  poolProtocol: string;
  userWallet: string;
}

export interface sBTCPosition {
  user: string;
  poolProtocol: string;
  balance: bigint;
  accumulatedYield: bigint;
}

const SBTC_POOLS: Record<string, sBTCPool> = {
  zest: {
    protocol: 'zest',
    name: 'Zest sBTC Vault',
    apy: 8.5,
    tvl: 50000000n,
    token: 'sBTC',
    poolAddress: 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.zest-sbtc-vault',
  },
  hermetica: {
    protocol: 'hermetica',
    name: 'Hermetica sBTC Vault',
    apy: 6.1,
    tvl: 25000000n,
    token: 'sBTC',
    poolAddress: 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.hermetica-sbtc-vault',
  },
  alex_lp: {
    protocol: 'alex',
    name: 'ALEX sBTC/STX LP',
    apy: 11.4,
    tvl: 15000000n,
    token: 'sBTC',
    poolAddress: 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.alex-sbtc-stx-pool',
  },
};

const DEFAULT_ADAPTER = 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.sbtc-adapter';

export class sBTCProtocol {
  private readonly adapterAddress: string;
  private readonly network: Network;

  constructor(adapterAddress?: string) {
    const defaultAdapter = 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.sbtc-adapter';
    const molbotAddr = config.molbot?.registryAddress;
    this.adapterAddress = adapterAddress || (molbotAddr ? molbotAddr.split('.')[0] + '.sbtc-adapter' : defaultAdapter);
    this.network = (config.stacks?.network || 'testnet') as Network;
  }

  async getPools(): Promise<sBTCPool[]> {
    return Object.values(SBTC_POOLS);
  }

  async getPool(protocol: string): Promise<sBTCPool | null> {
    const pool = Object.values(SBTC_POOLS).find(p => p.protocol === protocol);
    return pool || null;
  }

  async getPoolByAddress(address: string): Promise<sBTCPool | null> {
    return Object.values(SBTC_POOLS).find(p => p.poolAddress === address) || null;
  }

  async deposit(params: sBTCDepositParams): Promise<ContractCallResult> {
    const pool = await this.getPool(params.poolProtocol);
    if (!pool) {
      return { ok: false, error: 'Unknown pool protocol' };
    }

    return callContract(this.network, this.adapterAddress, 'execute', [
      { type: 'uint', value: params.amount.toString() },
      { type: 'string', value: 'deposit' },
      { type: 'principal', value: pool.poolAddress },
    ]);
  }

  async withdraw(params: sBTCWithdrawParams): Promise<ContractCallResult> {
    const pool = await this.getPool(params.poolProtocol);
    if (!pool) {
      return { ok: false, error: 'Unknown pool protocol' };
    }

    return callContract(this.network, this.adapterAddress, 'execute', [
      { type: 'uint', value: params.amount.toString() },
      { type: 'string', value: 'withdraw' },
      { type: 'principal', value: pool.poolAddress },
    ]);
  }

  async getBalance(wallet: string): Promise<bigint> {
    const result = await callContract(this.network, this.adapterAddress, 'get-balance', [
      { type: 'principal', value: wallet },
    ]);

    if (!result.ok) {
      return 0n;
    }

    return BigInt(result.value as string || '0');
  }

  async getPendingRewards(wallet: string): Promise<bigint> {
    const result = await callContract(this.network, this.adapterAddress, 'get-pending-rewards', [
      { type: 'principal', value: wallet },
    ]);

    if (!result.ok) {
      return 0n;
    }

    return BigInt(result.value as string || '0');
  }

  async getUserPosition(wallet: string, protocol: string): Promise<sBTCPosition | null> {
    const pool = await this.getPool(protocol);
    if (!pool) {
      return null;
    }

    const balance = await this.getBalance(wallet);
    const rewards = await this.getPendingRewards(wallet);

    return {
      user: wallet,
      poolProtocol: protocol,
      balance,
      accumulatedYield: rewards,
    };
  }

  calculateEstimatedYield(amount: bigint, apy: number, days: number): bigint {
    if (days <= 0 || amount <= 0n) return 0n;
    const dailyRate = apy / 365 / 100;
    const dailyYield = (amount * BigInt(Math.floor(dailyRate * 1000000))) / 1000000n;
    return dailyYield * BigInt(days);
  }

  findBestPool(amount: bigint): sBTCPool {
    return Object.values(SBTC_POOLS).sort((a, b) => b.apy - a.apy)[0];
  }
}

export const sbtcProtocol = new sBTCProtocol();
