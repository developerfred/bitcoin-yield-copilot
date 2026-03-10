# clarity-security

> Clarity Smart Contract Security Patterns & Vulnerabilities

## Overview

This skill covers security patterns, common vulnerabilities, and best practices for writing secure Clarity smart contracts on Stacks.

## Why Clarity is Different from Solidity

Clarity was designed to be **decidable** - you can mathematically prove what your code will do before running it. This eliminates many vulnerabilities common in Solidity:

- **No reentrancy** - Clarity has no recursive calls, external calls complete before continuing
- **No integer overflow** - `uint` operations are checked by the VM
- **No delegatecall** - Prevents proxy pattern vulnerabilities
- **Explicit state changes** - All state modifications are visible in the code

## Common Clarity Vulnerabilities

### 1. tx-sender vs contract-caller

**VULNERABLE:**
```clarity
(define-public (change-owner (new-owner principal))
  (asserts! (is-eq tx-sender contract-owner) ERR-UNAUTHORIZED)
  (ok (set-contract-owner new-owner))
)
```

**SECURE:**
```clarity
(define-public (change-owner (new-owner principal))
  (asserts! (is-eq contract-caller contract-owner) ERR-UNAUTHORIZED)
  (ok (set-contract-owner new-owner))
)
```

**Why:** `tx-sender` can be spoofed in contract-call scenarios. Use `contract-caller` for authentication.

### 2. Missing Threshold Checks

**VULNERABLE:**
```clarity
(define-public (set-threshold (new-threshold uint))
  (asserts! (is-eq tx-sender contract-owner) ERR-UNAUTHORIZED)
  (ok (var-set threshold new-threshold))
)
```

**SECURE:**
```clarity
;; Define minimum threshold to prevent centralization
(define-constant MIN-THRESHOLD u1)
(define-constant MAX-THRESHOLD u10)

(define-public (set-threshold (new-threshold uint))
  (asserts! (is-eq contract-caller contract-owner) ERR-UNAUTHORIZED)
  (asserts! (and (>= new-threshold MIN-THRESHOLD) 
                 (<= new-threshold MAX-THRESHOLD)) ERR-INVALID-THRESHOLD)
  (ok (var-set threshold new-threshold))
)
```

### 3. Using unwrap-panic

**VULNERABLE:**
```clarity
(define-read-only (get-balance (who principal))
  (ok (unwrap-panic (map-get? balances who)))
)
```

**SECURE:**
```clarity
(define-constant ERR-BALANCE-NOT-SET (err u1))

(define-read-only (get-balance (who principal))
  (ok (unwrap! (map-get? balances who) ERR-BALANCE-NOT-SET))
)
```

**Why:** `unwrap-panic` aborts the entire call stack with no useful error. Use explicit error codes.

### 4. Missing Access Control

**VULNERABLE:**
```clarity
(define-public (mint-tokens (amount uint))
  ;; No check - anyone can mint!
  (ok (var-set total-supply (+ (var-get total-supply) amount)))
)
```

**SECURE:**
```clarity
(define-constant ERR-UNAUTHORIZED (err u100))

(define-public (mint-tokens (amount uint))
  (asserts! (is-eq contract-caller contract-owner) ERR-UNAUTHORIZED)
  (ok (var-set total-supply (+ (var-get total-supply) amount)))
)
```

### 5. Front-Running Protection

Clarity contracts can be vulnerable to front-running. Use commit-reveal pattern:

```clarity
;; Commit phase
(define-map commits 
  { user: principal, commitment: (buff 32) }
  { hash: (buff 32), timestamp: uint }
)

(define-public (commit (hash (buff 32)))
  (ok (map-set commits 
    { user: tx-sender, commitment: hash }
    { hash: hash, timestamp: block-height }
  ))
)

;; Reveal phase - only works after commit
(define-public (reveal (secret (buff 32)))
  (let ((commitment (unwrap! (map-get? commits { user: tx-sender, commitment: (sha256 secret) }) ERR-NO-COMMIT))
        (commit-height (get timestamp commitment)))
    (asserts! (>= block-height (+ commit-height u1)) ERR-TOO-EARLY)
    (ok true)
  ))
)
```

### 6. Weak Randomness

**VULNERABLE:**
```clarity
(define-read-only (get-random)
  (sha256 (concat (get value-at-block (- block-height u1)) tx-sender))
)
```

**SECURE:**
Use Stacks VRF (Verifiable Random Function):

```clarity
(use-trait vrf-trait .vrf-trait.vrf-trait)

(define-read-only (get-random-from-vrf (vrf-contract <vrf-trait>))
  (let ((response (contract-call? vrf-contract get-random)))
    (ok response)
  )
)
```

### 7. Signature Replay

Protect against signature replay attacks:

```clarity
(define-map nonces { owner: principal } { nonce: uint })

(define-public (execute-with-signature (sig (buff 65)) (nonce uint))
  (let ((current-nonce (unwrap! (map-get? nonces { owner: tx-sender }) ERR-NO NONCE)))
    (asserts! (is-eq nonce current-nonce) ERR-INVALID-NONCE)
    ;; Verify signature and execute
    (map-set nonces { owner: tx-sender } { nonce: (+ current-nonce u1) })
    (ok true)
  ))
)
```

## Security Best Practices Checklist

### Access Control
- [ ] All public functions have explicit access control
- [ ] Use `contract-caller` instead of `tx-sender`
- [ ] Critical functions have threshold/multi-sig requirements
- [ ] Owner changes require time-locks

### Input Validation
- [ ] All inputs validated with explicit bounds
- [ ] No `unwrap-panic` without prior check
- [ ] Use `unwrap!` or `unwrap-err!` with error codes
- [ ] String length limits enforced

### State Management
- [ ] Clear state transition logic
- [ ] No reliance on block data for critical logic
- [ ] Use commit-reveal for sensitive operations
- [ ] Nonces for signature-based actions

### Error Handling
- [ ] All errors have explicit constants
- [ ] Error codes documented and consistent
- [ ] No silent failures
- [ ] Panic functions avoided

### Upgradability
- [ ] Consider immutable patterns where possible
- [ ] If upgradable, use proxy pattern correctly
- [ ] Storage layout documented
- [ ] Migration paths defined

## VibeStamp Security Considerations

For VibeStamp specifically:

### Register Function
```clarity
(define-public (register-stamp
    (hash (buff 32))
    (project-name (string-ascii 100))
    (project-url (string-ascii 200))
    (description (string-ascii 500)))
  (let ((caller contract-caller))
    ;; Check hash not already registered - good
    (asserts! (is-none (map-get? stamps { hash: hash })) ERR-ALREADY-EXISTS)
    
    ;; Good: Uses block-height for timestamp (immutable)
    ;; Good: First-to-register pattern is fair
    ;; Consider: Add minimum time between registrations per address?
    (map-set stamps ...)
  )
)
```

### NFT Minting
```clarity
(define-public (mint-certificate ...)
  ;; CRITICAL: Only registry contract should be able to mint
  (asserts! (is-eq contract-caller REGISTRY-CONTRACT) ERR-NOT-AUTHORIZED)
  ;; ... mint logic
)
```

## Related Skills

- clarity-contracts: Contract implementation
- clarity-audit: Audit methodology
- clarity-compliance: Regulatory considerations
