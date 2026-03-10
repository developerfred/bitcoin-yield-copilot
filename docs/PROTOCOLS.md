# Protocols Module

This document describes the protocols module (`src/protocols/`) which integrates with various DeFi protocols.

## Supported Protocols

The project integrates with multiple DeFi protocols on Stacks:

| Protocol | Type | Description |
|----------|------|-------------|
| ALEX | DEX | Decentralized exchange with liquidity pools |
| Zest | Yield | Bitcoin yield vaults |
| Hermetica | Yield | Yield vault with Bitcoin exposure |
| Bitflow | DEX | DEX with liquidity provision |

## ALEX Protocol (`alex.ts`)

The ALEX protocol integration provides access to the ALEX decentralized exchange on Stacks.

### Network Configuration

```typescript
type Network = 'mainnet' | 'testnet';

// Testnet
ALEX_TESTNET = {
  API_URL: 'https://api.testnet.alexlab.co',
  NODE_URL: 'https://stacks-node-api.testnet.alexlab.co',
  // Contract addresses...
}

// Mainnet
ALEX_MAINNET = {
  API_URL: 'https://api.alexlab.co',
  NODE_URL: 'https://stacks-node-api.mainnet.alexlab.co',
  // Contract addresses...
}
```

### Functions

#### `getPoolList(network)`

Returns all available liquidity pools sorted by TVL.

```typescript
async function getPoolList(network: Network): Promise<PoolInfo[]>
```

**Returns:** Array of PoolInfo objects

#### `getPoolByTokens(tokenX, tokenY, network)`

Returns pool information for a specific token pair.

```typescript
async function getPoolByTokens(
  tokenX: string,
  tokenY: string,
  network: Network
): Promise<PoolInfo | null>
```

#### `getUserBalances(walletAddress, network)`

Returns token balances for a wallet.

```typescript
async function getUserBalances(
  walletAddress: string,
  network: Network
): Promise<TokenBalance[]>
```

#### `getUserPositions(walletAddress, network)`

Returns user's liquidity positions.

```typescript
async function getUserPositions(
  walletAddress: string,
  network: Network
): Promise<PoolPosition[]>
```

#### `getSwapQuote(fromToken, toToken, amount, network)`

Returns a swap quote.

```typescript
async function getSwapQuote(
  fromToken: string,
  toToken: string,
  humanFromAmount: number,
  network: Network
): Promise<SwapQuote | null>
```

### Types

#### PoolInfo

```typescript
interface PoolInfo {
  id: string;
  name: string;           // e.g., "sBTC/STX"
  tokenX: string;
  tokenY: string;
  apy: number;            // Percentage
  tvl: number;           // USD
  volume24h: number;     // USD
  fee: number;            // Fraction (0.003 = 0.3%)
}
```

#### TokenBalance

```typescript
interface TokenBalance {
  symbol: string;
  contractId: string;
  balance: number;        // Human-readable
  rawBalance: number;     // Raw on-chain
  decimals: number;
  valueUsd: number;
}
```

#### PoolPosition

```typescript
interface PoolPosition {
  poolId: string;
  tokenX: string;
  tokenY: string;
  liquidity: number;
  tokenXAmount: number;
  tokenYAmount: number;
  sharePercent: number;
}
```

#### SwapQuote

```typescript
interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  priceImpact: number;
  route: string[];
  slippage: number;
}
```

### Helper Functions

#### `toHumanAmount(rawAmount, decimals)`

Converts raw on-chain amount to human-readable format.

#### `toRawAmount(humanAmount, decimals)`

Converts human-readable amount to raw on-chain format.

## Supported Tokens

| Symbol | Decimals | Description |
|--------|----------|-------------|
| STX | 6 | Stacks token |
| WSTX | 6 | Wrapped STX |
| sBTC | 8 | Wrapped Bitcoin |
| ALEX | 8 | ALEX token |
| USDA | 6 | Stablecoin |

## Protocol Integration via MCP

The protocol integrations are primarily accessed through the aibtc-mcp-server which provides:

### Zest Protocol
- Deposit to Zest vaults
- Withdraw from Zest vaults
- Get vault APY
- Get user vault balance

### Hermetica Protocol
- Deposit to Hermetica vaults
- Withdraw from vaults
- Get yield rates

### Bitflow Protocol
- Create liquidity positions
- Add/remove liquidity
- Swap tokens
- Get pool info
