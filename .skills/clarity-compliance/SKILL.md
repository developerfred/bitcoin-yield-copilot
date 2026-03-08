# clarity-compliance

> Clarity Smart Contract Compliance & Regulatory Considerations

## Overview

This skill covers compliance requirements, regulatory considerations, and best practices for building compliant decentralized applications on Stacks using Clarity.

## Regulatory Landscape

### Key Considerations

1. **Securities Regulations**
   - Are tokens securities?
   - Howey Test implications
   - SEC, FCA, EU MiCA requirements

2. **AML/KYC**
   - Know Your Customer requirements
   - Anti-Money Laundering
   - Travel Rule for transactions

3. **Data Privacy**
   - GDPR (EU)
   - CCPA (California)
   - Data retention requirements

4. **Tax Compliance**
   - Income reporting
   - Capital gains
   - Transaction logging

## Clarity Advantages for Compliance

### 1. Code Transparency

Clarity contracts are **readable** - not just bytecode. Regulators can audit:

```clarity
;; Anyone can read and understand this
(define-public (register-stamp ...)
  (let ((caller contract-caller))
    (asserts! (is-none (map-get? stamps { hash: hash })) ERR-ALREADY-EXISTS)
    (map-set stamps ...)
  )
)
```

### 2. On-Chain Verifiability

All transactions are verifiable on Bitcoin:

```clarity
;; Immutable record
{
  hash: (buff 32),
  owner: principal,
  block-height: uint,
  timestamp: uint  ;; Bitcoin block timestamp
}
```

### 3. No Confidential Information

Clarity cannot hide data - all state is public:

- No private variables
- No encrypted storage
- Complete transparency

## Compliance Patterns

### 1. Oracle-Based Price Feeds

For DeFi, use oracle price feeds:

```clarity
(use-trait oracle-trait .oracle-trait.oracle-trait)

(define-read-only (get-usd-price (oracle <oracle-trait>))
  (contract-call? oracle get-price)
)
```

### 2. Rate Limiting

Prevent abuse with rate limits:

```clarity
(define-map rate-limits 
  { user: principal }
  { count: uint, last-block: uint }
)

(define-constant MAX-REQUESTS-PER-BLOCK u10)

(define-public (rate-limited-action ...)
  (let ((user-rate (default-to { count: u0, last-block: u0 } 
                    (map-get? rate-limits { user: tx-sender })))
    (if (is-eq (get last-block user-rate) block-height)
      (do
        (asserts! (< (get count user-rate) MAX-REQUESTS-PER-BLOCK) ERR-RATE-LIMITED)
        (map-set rate-limits 
          { user: tx-sender }
          { count: (+ (get count user-rate) u1), last-block: block-height }
        )
      )
      (map-set rate-limits 
        { user: tx-sender }
        { count: u1, last-block: block-height }
      )
    )
    ;; ... main logic
  )
)
```

### 3. Blacklist Capability

For sanctioned addresses:

```clarity
(define-map blacklisted { address: principal } { blocked: bool })

(define-public (blacklist-address (addr principal))
  (asserts! (is-eq contract-caller compliance-officer) ERR-UNAUTHORIZED)
  (ok (map-set blacklisted { address: addr } { blocked: true }))
)

(define-read-only (is-blacklisted (addr principal))
  (match (map-get? blacklisted { address: addr })
    record (get blocked record)
    false
  )
)
```

### 4. Pause Functionality

Emergency stop mechanism:

```clarity
(define-data-var paused bool false)
(define-constant ERR-PAUSED (err u50))

(define-public (pause)
  (asserts! (is-eq contract-caller emergency-controller) ERR-UNAUTHORIZED)
  (ok (var-set paused true))
)

(define-public (unpause)
  (asserts! (is-eq contract-caller emergency-controller) ERR-UNAUTHORIZED)
  (ok (var-set paused false))
)

;; Use in functions
(define-public (critical-action ...)
  (asserts! (not (var-get paused)) ERR-PAUSED)
  ;; ... logic
)
```

### 5. Transfer Approval

For token transfers:

```clarity
(define-map allowances 
  { owner: principal, spender: principal }
  { amount: uint }
)

(define-public (approve (spender principal) (amount uint))
  (ok (map-set allowances 
    { owner: tx-sender, spender: spender }
    { amount: amount }
  ))
)

(define-public (transfer-from (from principal) (amount uint))
  (let (
    (allowance (unwrap! (map-get? allowances { owner: from, spender: tx-sender }) ERR-NO-ALLOWANCE))
  )
    (asserts! (>= (get amount allowance) amount) ERR-INSUFFICIENT-ALLOWANCE)
    (map-set balances { owner: from } (- (get balance from) amount))
    (map-set balances { owner: tx-sender } (+ (get balance tx-sender) amount))
    (ok true)
  ))
)
```

## Data Privacy Compliance

### GDPR Considerations

| Requirement | Clarity Solution |
|-------------|-----------------|
| Right to Deletion | Cannot delete on-chain data - design limitation |
| Data Minimization | Only store necessary data |
| Transparency | All data public by design |
| Consent | N/A - no personal data should be on-chain |

**Recommendation:** Do not store PII (Personally Identifiable Information) on-chain. Use off-chain storage for any PII.

```clarity
;; BAD - Don't do this
(define-map user-profiles 
  { user: principal }
  { 
    name: (string-ascii 100),     ;; PII - don't store
    email: (string-ascii 100),     ;; PII - don't store
    country: (string-ascii 2)     ;; May be PII
  }
)

;; GOOD - Store only necessary data
(define-map user-records
  { user: principal }
  {
    registered-at: uint,
    kyc-hash: (buff 32)  ;; Reference to off-chain KYC
  }
)
```

### Data Retention

On-chain data is immutable - design accordingly:

```clarity
;; Archive old data reference
(define-map archived-stamps
  { hash: (buff 32) }
  { 
    archived-at: uint,
    ipfs-reference: (string-ascii 100)
  }
)
```

## Audit Trail

### Transaction Logging

```clarity
(define-map events
  { index: uint }
  {
    event-type: (string-ascii 50),
    user: principal,
    data-hash: (buff 32),
    timestamp: uint
  }
)

(define-data-var event-count uint u0)

(define-public (log-event (event-type (string-ascii 50)) (data-hash (buff 32)))
  (let ((current-index (var-get event-count)))
    (map-set events 
      { index: current-index }
      {
        event-type: event-type,
        user: tx-sender,
        data-hash: data-hash,
        timestamp: block-height
      }
    )
    (var-set event-count (+ current-index u1))
    (ok current-index)
  ))
)
```

### Verification

All events can be verified on-chain:

```clarity
(define-read-only (get-event (index uint))
  (map-get? events { index: index })
)

(define-read-only (get-events-count)
  (ok (var-get event-count))
)
```

## Stacks-Specific Considerations

### Bitcoin Settlement

- All transactions settle on Bitcoin
- Immutable timestamp from Bitcoin blocks
- Highest available finality

### Wallet Requirements

- No KYC required to create wallet
- Pseudonymous by default
- Consider: Should you require KYC for your protocol?

### Cross-Chain Considerations

- Stacks is Bitcoin L2
- No direct Ethereum compatibility
- Different regulatory treatment than EVM chains

## VibeStamp Compliance

For VibeStamp specifically:

### Data Stored On-Chain

| Data | PII? | Consideration |
|------|------|---------------|
| Project name | No | Public info |
| Project URL | No | Public info |
| Description | No | Public info |
| Owner principal | Pseudonym | Not directly identifying |
| Block height | No | Timestamp only |

### Recommendations

1. **No KYC Required** - VibeStamp is permissionless
2. **Public by Design** - All stamps are verifiable
3. **No PII On-Chain** - User-provided data is public anyway
4. **Immutable Record** - Cannot delete timestamps

### Potential Concerns

| Concern | Mitigation |
|---------|-----------|
| Copyright disputes | First-to-register is evidence, not legal ruling |
| Illegal content | Cannot censor - consider DMCA process for hosting |
| Spam registrations | Could add small registration fee |

## Industry Standards

### For DeFi

- [ ] Token logic follows standards (SIP-009, SIP-010)
- [ ] Oracles for price feeds
- [ ] Emergency pause capability
- [ ] Timelock for upgrades
- [ ] Rate limiting

### For Identity

- [ ] No PII on-chain
- [ ] Off-chain KYC with hash references
- [ ] User-controlled data
- [ ] Deletion mechanisms for off-chain data

### For Financial

- [ ] Accurate accounting
- [ ] Audit trail
- [ ] Pause functionality
- [ ] Access controls
- [ ] Compliance officer role

## Related Skills

- clarity-contracts: Contract implementation
- clarity-security: Security patterns
- clarity-audit: Audit methodology
