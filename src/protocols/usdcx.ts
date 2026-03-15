import { callContract, ContractCallResult, Network } from '../utils/contract-call.ts';
import { config } from '../config.ts';

export interface USDCxPool {
  protocol: string;
  name: string;
  apy: number;
  tvl: bigint;
  token0: string;
  token1: string;
  poolAddress: string;
}

export interface USDCxDepositParams {
  amount: bigint;
  poolProtocol: string;
  userWallet: string;
}

export interface USDCxWithdrawParams {
  amount: bigint;
  poolProtocol: string;
  userWallet: string;
}

export interface USDCxPosition {
  user: string;
  poolProtocol: string;
  balance: bigint;
  accumulatedYield: bigint;
}

const USDCX_POOLS: Record<string, USDCxPool> = {
  alex_usdcx_stx: {
    protocol: 'alex',
    name: 'ALEX USDCx/STX',
    apy: 5.5,
    tvl: 15000000n,
    token0: 'USDCx',
    token1: 'STX',
    poolAddress: 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.mixtape-usdcx-stx-pool',
  },
  bitflow_usdcx_sbtc: {
    protocol: 'bitflow',
    name: 'Bitflow USDCx/sBTC',
    apy: 4.2,
    tvl: 8000000n,
    token0: 'USDCx',
    token1: 'sBTC',
    poolAddress: 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.bitflow-usdcx-sbtc-pool',
  },
  hermetica_usdcx: {
    protocol: 'hermetica',
    name: 'Hermetica USDCx Vault',
    apy: 6.1,
    tvl: 5000000n,
    token0: 'USDCx',
    token1: 'USDCx',
    poolAddress: 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.hermetica-usdcx-vault',
  },
};

const DEFAULT_ADAPTER = 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.usdcx-adapter';

export class USDCxProtocol {
  private readonly adapterAddress: string;
  private readonly network: Network;

  constructor(adapterAddress?: string) {
    const defaultAdapter = 'SP3K8BC0PPEVCV7N6PENTQMCZNCWEXMEVXRGBBWGC.usdcx-adapter';
    const molbotAddr = config.molbot?.registryAddress;
    this.adapterAddress = adapterAddress || (molbotAddr ? molbotAddr.split('.')[0] + '.usdcx-adapter' : defaultAdapter);
    this.network = (config.stacks?.network || 'testnet') as Network;
  }

  async getPools(): Promise<USDCxPool[]> {
    return Object.values(USDCX_POOLS);
  }

  async getPool(protocol: string): Promise<USDCxPool | null> {
    const pool = Object.values(USDCX_POOLS).find(p => p.protocol === protocol);
    return pool || null;
  }

  async getPoolByAddress(address: string): Promise<USDCxPool | null> {
    return Object.values(USDCX_POOLS).find(p => p.poolAddress === address) || null;
  }

  async deposit(params: USDCxDepositParams): Promise<ContractCallResult> {
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

  async withdraw(params: USDCxWithdrawParams): Promise<ContractCallResult> {
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

  async getUserPosition(wallet: string, protocol: string): Promise<USDCxPosition | null> {
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

  findBestPool(amount: bigint): USDCxPool {
    return Object.values(USDCX_POOLS).sort((a, b) => b.apy - a.apy)[0];
  }
}

export const usdcxProtocol = new USDCxProtocol();
