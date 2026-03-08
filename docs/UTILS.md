# Utilities Module

This document describes the utilities module (`src/utils/`) and configuration (`src/config.ts`).

## Payload Builder (`payload-builder.ts`)

The payload builder creates transaction payloads that are signed by user wallets.

### Domain Constants

```typescript
const DOMAINS = {
  WITHDRAW:           10n,
  PAUSE:              20n,
  UNPAUSE:            21n,
  SET_FEE:            30n,
  OP_EXECUTE:         40n,
  ADD_PROTOCOL:       50n,
  UPDATE_PROTOCOL:    51n,
  UPDATE_LIMITS:      60n,
  FACTORY_REGISTER:   40n,
  FACTORY_DEACTIVATE: 41n,
  FACTORY_REACTIVATE: 42n,
};
```

### Payload Functions

#### `opPayload()`

Creates operation payload for execute-authorized-operation.

```typescript
function opPayload(
  tgHash: Uint8Array,
  protocol: string,
  action: string,
  nonce: bigint,
  amount: bigint,
  expiry: bigint
): Uint8Array
```

#### `withdrawPayload()`

Creates withdraw payload.

```typescript
function withdrawPayload(
  tgHash: Uint8Array,
  walletAddress: string,
  nonce: bigint,
  amount: bigint,
  expiry: bigint,
  recipient: string
): Uint8Array
```

#### `addProtocolPayload()`

Creates add protocol payload.

```typescript
function addProtocolPayload(
  tgHash: Uint8Array,
  protocol: string,
  nonce: bigint,
  maxAlloc: bigint,
  expiry: bigint
): Uint8Array
```

#### `updateLimitsPayload()`

Creates update limits payload.

```typescript
function updateLimitsPayload(
  tgHash: Uint8Array,
  nonce: bigint,
  newMax: bigint,
  newDaily: bigint,
  expiry: bigint
): Uint8Array
```

#### `pausePayload()` / `unpausePayload()`

Create pause/unpause payloads.

#### Factory Payloads

- `factoryRegisterPayload()`: Register new wallet
- `factoryDeactivatePayload()`: Deactivate wallet
- `factoryReactivatePayload()`: Reactivate wallet

#### `setFeePayload()`

Creates set fee payload for withdraw helper.

## Configuration (`config.ts`)

The configuration module validates and provides access to environment variables.

### Configuration Sections

```typescript
config = {
  llm: {
    provider: 'anthropic' | 'openrouter',
    anthropicApiKey: string,
    openrouterApiKey: string,
  },
  telegram: {
    botToken: string,
  },
  stacks: {
    network: 'mainnet' | 'testnet' | 'devnet',
    apiUrl: string,
  },
  wallet: {
    appDomain: string,
    appName: string,
    miniAppUrl: string,
  },
  mcp: {
    serverPath: string,
    network: string,
    useDocker: boolean,
    dockerContainer: string,
  },
  x402: {
    facilitatorUrl: string,
  },
  erc8004: {
    contract: string,
  },
  database: {
    path: string,
  },
  session: {
    durationMs: number,
  },
  encryption: {
    key: string,
    salt: string,
  },
  log: {
    level: 'debug' | 'info' | 'warn' | 'error',
  },
}
```

### Environment Schema

Required environment variables are validated at startup:

```typescript
const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.enum(['anthropic', 'openrouter']).default('anthropic'),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  STACKS_NETWORK: z.enum(['mainnet', 'testnet', 'devnet']).default('testnet'),
  // ... more fields
});
```

### Usage

```typescript
import { config } from './config.js';

// Access configuration
const apiKey = config.llm.anthropicApiKey;
const network = config.stacks.network;
```
