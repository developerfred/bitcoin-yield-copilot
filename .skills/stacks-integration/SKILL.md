# stacks-integration

> VibeStamp Stacks Blockchain Integration - Wallet & SDK

## Project Context

VibeStamp uses Stacks (Bitcoin L2) for on-chain timestamp registration. This skill covers wallet integration and blockchain SDK usage.

## Core Dependencies

```json
{
  "@stacks/connect": "^7.x",
  "@stacks/transactions": "^6.x",
  "@stacks/network": "^6.x"
}
```

## Leather Wallet Connection

### Connect Wallet

```typescript
import { openContractCall, openSignatureRequest } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

const NETWORK = process.env.NEXT_PUBLIC_NETWORK === 'mainnet'
  ? new StacksMainnet()
  : new StacksTestnet();

// In a React component
import { useConnect } from '@stacks/connect-react';

const { doOpenAuth } = useConnect();

// Connect wallet
const authOptions = {
  appDetails: {
    name: 'VibeStamp',
    icon: 'https://vibestamp.xyz/icon.png',
  },
  redirectTo: '/',
  onFinish: () => {
    // Wallet connected
  },
};
doOpenAuth(authOptions);
```

### Sign Transaction

```typescript
await openContractCall({
  network: NETWORK,
  contractAddress: CONTRACT_ADDRESS,
  contractName: 'vibestamp-registry',
  functionName: 'register-stamp',
  functionArgs: [
    hexToClarity(hash),
    stringAsciiCV(projectName),
    stringAsciiCV(projectUrl),
    stringAsciiCV(description),
  ],
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
  onFinish: (result) => {
    console.log('Transaction ID:', result.txId);
    // Transaction successful
  },
  onCancel: () => {
    // User cancelled
  },
});
```

## Transaction Types

### 1. Contract Call (Write)

Requires wallet signature, costs gas (STX):

```typescript
import {
  makeContractCall,
  bufferCV,
  stringAsciiCV,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';

const tx = await makeContractCall({
  network: NETWORK,
  contractAddress: CONTRACT_ADDRESS,
  contractName: 'vibestamp-registry',
  functionName: 'register-stamp',
  functionArgs: [hexToClarity(hash), stringAsciiCV(name), ...],
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
  senderKey: privateKey,
});
```

### 2. Read-Only Call (Free)

No wallet needed, no gas:

```typescript
import { callReadOnlyFunction, cvToValue } from '@stacks/transactions';

const result = await callReadOnlyFunction({
  network: NETWORK,
  contractAddress: CONTRACT_ADDRESS,
  contractName: 'vibestamp-registry',
  functionName: 'verify-stamp',
  functionArgs: [hexToClarity(hash)],
  senderAddress: CONTRACT_ADDRESS, // Any valid address works
});

const data = cvToValue(result);
// { verified: true, owner, block-height, project-name, ... }
```

## Network Configuration

```typescript
// Testnet
const testnet = new StacksTestnet();

// Mainnet
const mainnet = new StacksMainnet();

// With custom node
const custom = new StacksMainnet({ url: 'https://stacks-node-api.mainnet.stacks.co' });
```

## Hex <-> Buffer Conversions

```typescript
// Hex string to Clarity buffer
function hexToBufferCV(hex: string) {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bufferCV(bytes);
}

// Buffer to hex string
function bufferToHex(buffer: Uint8Array) {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

## User Session

```typescript
import { useAuth } from '@stacks/connect-react';

const { isSignedIn, userData } = useAuth();

// userData: { profile: {...}, username: 'username.id', appPrivateKey, ... }
```

## Transaction States

1. **Pending** - User signed, waiting for Bitcoin confirmation
2. **Success** - Transaction confirmed on Bitcoin
3. **Failed** - Reverted (not enough gas, invalid data, etc.)

## Environment Variables

```bash
NEXT_PUBLIC_NETWORK=testnet  # or mainnet
NEXT_PUBLIC_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Transaction rejected" | Check user's STX balance |
| "Contract not found" | Verify CONTRACT_ADDRESS matches deployment |
| "Function not found" | Check function name matches Clarity definition |
| "Anchor mode invalid" | Use `AnchorMode.Any` for Stacks |

## Related Skills

- clarity-contracts: Smart contract definitions
- vibestamp-frontend: Frontend components
