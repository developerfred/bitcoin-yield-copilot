# sip-standards

> Stacks Improvement Proposals (SIPs) - Token Standards for VibeStamp

## Overview

This skill covers the SIP standards relevant to VibeStamp, particularly SIP-009 (NFT) and SIP-010 (fungible tokens).

## Key SIPs for VibeStamp

| SIP | Description | VibeStamp Usage |
|-----|-------------|-----------------|
| SIP-009 | NFT Standard | Certificate NFT |
| SIP-010 | Fungible Token | Not used |
| SIP-013 | Contract Interfaces | Trait definitions |

## SIP-009: NFT Standard

SIP-009 defines the interface for NFTs on Stacks.

### Required Traits

```clarity
;; NFT Trait - must implement
(impl-trait .sip009-trait.nft-trait)

(define-trait nft-trait (
  ;; Last token ID minted
  (get-last-token-id () (response uint uint))
  
  ;; URI for token metadata
  (get-token-uri (uint) (response (optional (string-utf8 256)) uint))
  
  ;; Owner of token
  (get-owner (uint) (response (optional principal) uint))
  
  ;; Transfer token
  (transfer (uint principal principal) (response bool uint))
))
```

### Implementation Example

```clarity
;; contracts/vibestamp-nft.clar

(impl-trait 'SP2PABAF9FTAJYNFZIWNZDTQYY3JBGAP2QCW5VDM.nft-trait.nft-trait)

;; Token definition
(define-non-fungible-token vibestamp-certificate uint)

;; Data storage
(define-data-var last-token-id uint u0)

(define-map token-metadata
  { token-id: uint }
  {
    hash: (buff 32),
    owner: principal,
    project-name: (string-ascii 100),
    block-height: uint
  }
)

;; SIP-009 Required Functions

;; Get last token ID
(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

;; Get token URI
(define-read-only (get-token-uri (token-id uint))
  (ok (some 
    (concat "https://vibestamp.xyz/api/certificate/" (uint-to-ascii token-id))
  ))
)

;; Get owner
(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? vibestamp-certificate token-id))
)

;; Transfer (for soulbound, always fail)
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  ERR-SOULBOUND
)
```

### Mint Function

```clarity
(define-public (mint-certificate
    (recipient principal)
    (hash (buff 32))
    (project-name (string-ascii 100))
    (stamp-block-height uint))
  (let
    (
      (new-token-id (+ (var-get last-token-id) u1))
    )
    ;; Store metadata
    (map-set token-metadata
      { token-id: new-token-id }
      {
        hash: hash,
        owner: recipient,
        project-name: project-name,
        block-height: stamp-block-height
      }
    )
    
    ;; Mint NFT
    (try! (nft-mint? vibestamp-certificate new-token-id recipient))
    (var-set last-token-id new-token-id)
    
    (ok new-token-id)
  )
)
```

## Soulbound NFTs

VibeStamp uses soulbound (non-transferable) NFTs - the certificate stays with the original owner forever.

### Implementation

```clarity
(define-constant ERR-SOULBOUND (err u201))

;; Always revert transfers
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  ERR-SOULBOUND
)
```

### Why Soulbound?

| Aspect | Regular NFT | Soulbound NFT |
|--------|-------------|---------------|
| Transferable | Yes | No |
| Use Case | Collectibles, art | Identity, certificates |
| VibeStamp | ❌ | ✅ |

## SIP-010: Fungible Token

Not used in VibeStamp, but included for reference:

```clarity
(impl-trait .sip010-trait.ft-trait)

(define-fungible-token vibestamp-token)

(define-trait ft-trait (
  (transfer (uint principal principal (optional (buff 34))) (response bool uint))
  (get-name () (response (string-ascii 32) uint))
  (get-symbol () (response (string-ascii 32) uint))
  (get-decimals () (response uint uint))
  (get-balance (principal) (response uint uint))
  (get-total-supply () (response uint uint))
  (get-token-uri () (response (optional (string-utf8 256)) uint))
))
```

## Contract Interface Traits

### Defining a Trait

```clarity
;; traits/vibestamp-registry-trait.clar

(define-trait vibestamp-registry-trait (
  (register-stamp (
    (buff 32)          ; hash
    (string-ascii 100) ; project-name
    (string-ascii 200) ; project-url
    (string-ascii 500) ; description
  ) (response { hash: (buff 32), block-height: uint, owner: principal } uint))
  
  (verify-stamp ((buff 32)) 
    (response { 
      verified: bool, 
      owner: principal, 
      block-height: uint,
      project-name: (string-ascii 100),
      project-url: (string-ascii 200),
      description: (string-ascii 500),
      timestamp: uint
    } uint))
  
  (is-registered ((buff 32)) (response bool uint))
))
```

### Using a Trait

```clarity
;; Use the trait in another contract
(use-trait registry-trait .vibestamp-registry-trait.registry-trait)

(define-public (call-registry (registry <registry-trait>) (hash (buff 32)))
  (contract-call? registry verify-stamp hash)
)
```

## Metadata Standards

### Token URI

SIP-009 requires `get-token-uri` to return metadata location:

```clarity
;; Return JSON metadata
;; https://vibestamp.xyz/api/certificate/1
;;
;; Response:
;; {
;;   "name": "VibeStamp #1",
;;   "description": "Project timestamp on Bitcoin",
;;   "image": "https://vibestamp.xyz/cert/1.png",
;;   "attributes": [
;;     { "trait_type": "Project", "value": "My Project" },
;;     { "trait_type": "Block", "value": 123456 }
;;   ]
;; }
```

### Example Metadata

```json
{
  "name": "VibeStamp #42",
  "description": "Proof of authorship timestamp on Bitcoin via Stacks",
  "image": "https://vibestamp.xyz/cert/42.png",
  "external_url": "https://vibestamp.xyz/verify/abc123...",
  "attributes": [
    {
      "trait_type": "Project Name",
      "value": "My Awesome App"
    },
    {
      "trait_type": "Block Height",
      "value": 123456
    },
    {
      "trait_type": "Timestamp",
      "display_type": "date",
      "value": 1704067200
    }
  ]
}
```

## Standard Library Functions

### NFT Functions

| Function | Description |
|----------|-------------|
| `nft-mint?` | Mint new token to address |
| `nft-transfer?` | Transfer token to address |
| `nft-burn?` | Burn/destroy token |
| `nft-get-owner?` | Get current owner |

### Token Functions

| Function | Description |
|----------|-------------|
| `ft-mint?` | Mint tokens |
| `ft-transfer?` | Transfer tokens |
| `ft-burn?` | Burn tokens |
| `ft-get-balance` | Get balance |

## VibeStamp Integration

### Registry → NFT Flow

```clarity
;; In registry contract
(define-public (register-stamp ...)
  ;; ... register logic ...
  
  ;; Call NFT contract to mint
  (try! (contract-call? .vibestamp-nft mint-certificate 
    caller 
    hash 
    project-name 
    block-height))
  
  (ok { hash: hash, block-height: current-block, owner: caller })
)
```

### Frontend Token URI

```typescript
// Fetching NFT metadata
async function getCertificateMetadata(tokenId: number) {
  const response = await fetch(`https://vibestamp.xyz/api/certificate/${tokenId}`);
  return response.json();
}

// Display in UI
function Certificate({ tokenId }) {
  const metadata = useMetadata(tokenId);
  
  return (
    <div className="certificate">
      <img src={metadata.image} alt={metadata.name} />
      <h1>{metadata.name}</h1>
      <p>{metadata.description}</p>
    </div>
  );
}
```

## Explorer Integration

NFTs appear in Stacks Explorer:

```
https://explorer.stacks.co/txid/SP2PABAF9FTAJYNFZIWNZDTQYY3JBGAP2QCW5VDM.vibestamp-nft?chain=mainnet
```

## Related Skills

- clarity-contracts: Contract implementation
- clarity-testing: Testing NFT functionality
- vibestamp-frontend: Displaying NFT certificates
