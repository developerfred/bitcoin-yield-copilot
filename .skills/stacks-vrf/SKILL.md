# stacks-vrf

> Stacks Verifiable Random Function (VRF) - Secure Randomness for Clarity

## Overview

This skill covers using Stacks VRF for secure randomness in Clarity smart contracts.

## Why VRF?

Randomness in smart contracts is critical but dangerous. Common weak approaches:

| Method | Vulnerability |
|--------|---------------|
| `block-height` | Predictable, miner-controlled |
| `tx-sender` | Manipulable |
| `sha256(block-data)` | Can be gamed by miners |

**VRF Solution:** Uses Chainlink's VRF or Stacks' native VRF to generate provably random values that cannot be predicted or manipulated.

## Stacks VRF Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Contract       │────▶│  VRF Oracle  │────▶│  Random Value   │
│  Requests       │     │  (off-chain) │     │  on-chain       │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

## VRF Contract Implementation

### 1. Define VRF Trait

```clarity
;; traits/vrf-trait.clar

(define-trait vrf-trait (
  ;; Request randomness - returns request ID
  (request-randomness () (response uint uint))
  
  ;; Get randomness for a request
  (get-randomness (uint) (response (optional (buff 32)) uint))
))
```

### 2. Use VRF in Contract

```clarity
;; contracts/vibestamp-random.clar

(use-trait vrf-trait .vrf-trait.vrf-trait)

;; VRF contract address (testnet/mainnet)
(define-constant VRF-CONTRACT 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRT0VGDN.vrf-oracle)

;; Request mapping
(define-map randomness-requests
  { request-id: uint }
  {
    requester: principal,
    block-height: uint
  }
)

(define-data-var last-request-id uint u0)

;; Request randomness
(define-public (request-random-value)
  (let
    (
      (request-id (+ (var-get last-request-id) u1))
    )
    ;; Call VRF oracle
    (as-contract (contract-call? VRF-CONTRACT request-randomness))
    
    ;; Store request
    (map-set randomness-requests
      { request-id: request-id }
      {
        requester: tx-sender,
        block-height: block-height
      }
    )
    
    (var-set last-request-id request-id)
    (ok request-id)
  )
)

;; Callback - VRF calls this with randomness
(define-public (fulfill-randomness (request-id uint) (randomness (buff 32)))
  (let
    (
      (request (unwrap! (map-get? randomness-requests { request-id: request-id }) ERR-NOT-FOUND))
    )
    ;; Use randomness here
    ;; Store or process random value
    
    (ok true)
  )
)
```

## Alternative: Simple Randomness (Not for Production)

For non-financial use cases, you can use block data combined with user input:

```clarity
;; NOT FOR PRODUCTION FINANCIAL CONTRACTS
;; Use VRF for anything with value

(define-read-only (pseudo-random ()
  (sha256 
    (concat 
      (concat tx-sender block-height)
      (get-seed-from-entropy)
    )
  )
)
```

## Using VRF Results

### Random Selection

```clarity
;; Pick random winner from list
(define-read-only (pick-random-winner (candidates (list 100 principal)))
  (let
    (
      (random-bytes (unwrap! (contract-call? VRF-CONTRACT get-randomness current-request-id) ERR-NONE))
      (random-index (mod (buff-to-uint random-bytes) (len candidates)))
    )
    (ok (element-at candidates random-index))
  )
)
```

### Random NFT Assignment

```clarity
;; Assign random rarity to minted NFT
(define-public (mint-with-rarity (recipient principal))
  (let
    (
      (randomness (unwrap! (contract-call? VRF-CONTRACT get-randomness request-id) ERR-NONE))
      (rarity-index (mod (buff-to-uint randomness) u3))  ;; 0, 1, or 2
      (rarity (unwrap! (element-at rarities rarity-index) ERR-INVALID))
    )
    ;; Mint with assigned rarity
    (ok { token-id: new-id, rarity: rarity })
  )
)

(define-list rarities ["common", "rare", "legendary"])
```

## VRF Integration with Frontend

```typescript
// Request randomness from contract
import { openContractCall } from '@stacks/connect';

async function requestRandomValue() {
  await openContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: 'vibestamp-random',
    functionName: 'request-random-value',
    functionArgs: [],
    onFinish: (result) => {
      console.log('Request ID:', result.requestId);
      // Wait for callback
    }
  });
}

// Listen for VRF callback (via Stacks events)
```

## Testing VRF

```typescript
// Mock VRF for testing
const mockVRF = {
  requestRandomness: () => ok(uint(1)),
  getRandomness: (id: number) => ok(some(hexToBuffer(randomHex())))
};

// In test
chain.mineBlock([
  contractCall('vrf-mock', 'requestRandomness', [], wallet1),
  contractCall('vibestamp', 'fulfill', [uint(1), randomHash], vrfContract)
]);
```

## Cost Considerations

VRF calls cost STX:
- Request: ~5000-10000 STX (testnet)
- Fulfillment: Free (oracle pays)

Check current costs:
```bash
clarinet costs
```

## Security Considerations

| Consideration | Solution |
|---------------|----------|
| Front-running | Use commit-reveal |
| Oracle failure | Multiple VRF sources |
| Callback authenticity | Verify caller is VRF contract |

### Callback Verification

```clarity
(define-public (fulfill-randomness (request-id uint) (randomness (buff 32)))
  ;; Verify only VRF can call
  (asserts! (is-eq contract-caller VRF-CONTRACT) ERR-UNAUTHORIZED)
  ;; ... process randomness
)
```

## When to Use VRF

| Use Case | VRF Needed? |
|----------|-------------|
| Lottery/Game winner | ✅ Yes |
| NFT rarity assignment | ✅ Yes |
| Shuffling deck | ✅ Yes |
| Timestamp (VibeStamp) | ❌ No |
| Block-based ID | ❌ No |

## VibeStamp VRF Usage

VibeStamp doesn't need VRF because:
- First-to-register is deterministic
- Timestamps come from block-height
- No randomness required

But if you add features like:
- Random NFT reveals
- Lottery for featured projects
- Shuffled leaderboards

Then VRF would be needed.

## Related Skills

- clarity-security: Security patterns
- clarity-contracts: Contract implementation
- sip-standards: Token standards
