# clarity-contracts

> VibeStamp Clarity Smart Contracts - Core Knowledge

## Project Context

VibeStamp is a web app that timestamps project hashes on the Bitcoin blockchain via Stacks. The smart contracts are written in Clarity and deployed on Stacks (Bitcoin L2).

## Contract Architecture

### 1. vibestamp-registry.clar (Core)

The main contract that stores all stamp records:

```clarity
;; Key data structures
(define-map stamps
  { hash: (buff 32) }
  {
    owner: principal,
    block-height: uint,
    project-name: (string-ascii 100),
    project-url: (string-ascii 200),
    description: (string-ascii 500),
    timestamp: uint
  }
)

(define-map owner-stamps
  { owner: principal }
  { hashes: (list 100 (buff 32)) }
)
```

**Important Functions:**
- `register-stamp` - Public function to register a new stamp (first to register wins)
- `verify-stamp` - Read-only function to verify a stamp exists
- `get-stamp` - Get stamp data by hash
- `is-registered` - Check if hash already exists
- `get-stamps-by-owner` - Get all stamps for an address

**Error Codes:**
- `ERR-ALREADY-EXISTS` (u100)
- `ERR-NOT-FOUND` (u101)
- `ERR-INVALID-HASH` (u102)
- `ERR-NAME-TOO-LONG` (u103)

### 2. vibestamp-nft.clar (SIP-009)

Soulbound NFT certificate (non-transferable):

```clarity
(impl-trait 'SP2PABAF9FTAJYNFZIWNZDTQYY3JBGAP2QCW5VDM.nft-trait.nft-trait)
(define-non-fungible-token vibestamp-certificate uint)
```

**Key Points:**
- Soulbound = cannot be transferred (transfer always returns ERR-SOULBOUND)
- Mint called by registry contract after stamp registration
- Token URI points to certificate metadata API

## Development Commands

```bash
# Test contracts locally
clarinet test

# Check contracts for errors
clarinet check

# Deploy to testnet
clarinet deployments apply --testnet

# Deploy to mainnet
clarinet deployments apply --mainnet
```

## Frontend Integration

From the frontend, contracts are called via `@stacks/transactions`:

```typescript
// Convert hex hash to Clarity buffer
function hexToClarity(hex: string) {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bufferCV(bytes);
}

// Register stamp - triggers Leather Wallet popup
await openContractCall({
  contractAddress: CONTRACT_ADDRESS,
  contractName: 'vibestamp-registry',
  functionName: 'register-stamp',
  functionArgs: [
    hexToClarity(hash),
    stringAsciiCV(projectName),
    stringAsciiCV(projectUrl),
    stringAsciiCV(description),
  ],
});

// Verify stamp - free, no wallet needed
const result = await callReadOnlyFunction({
  contractAddress: CONTRACT_ADDRESS,
  contractName: 'vibestamp-registry',
  functionName: 'verify-stamp',
  functionArgs: [hexToClarity(hash)],
});
```

## Environment Variables

```bash
NEXT_PUBLIC_NETWORK=testnet  # or mainnet
NEXT_PUBLIC_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| First-to-register wins | Simplest fair rule - no disputes |
| SHA-256 (buff 32) | Standard hash size in Clarity |
| Soulbound NFT | Certificate is identity, not speculation |
| Read-only verify free | Anyone can verify without wallet |

## File Locations

- Contracts: `contracts/*.clar`
- Tests: `tests/*_test.ts`
- Config: `Clarinet.toml`

## Related Skills

- stacks-integration: Wallet and transaction handling
- vibestamp-frontend: Next.js frontend components
