# Bitcoin Yield Copilot — Implementation Plan
## Adapter Delegation System + ERC-8004 Identity Foundation

> **Stacks Consensus Assumptions:** Nakamoto release active. `stacks-block-height` used everywhere
> for block-relative timing. `block-height` (Bitcoin blocks) used only for cross-chain anchoring.
> Tenure-change blocks respected — no assumptions about 1:1 Bitcoin/Stacks block ratio.

---

## Table of Contents

1. [The Core Challenge](#1-the-core-challenge)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 0 — Fix Critical Bugs](#phase-0--fix-critical-bugs-before-anything-else)
4. [Phase 1 — Adapter Delegation Engine](#phase-1--adapter-delegation-engine)
5. [Phase 2 — Withdraw Flow Unification](#phase-2--withdraw-flow-unification)
6. [Phase 3 — ERC-8004 Identity Stub](#phase-3--erc-8004-identity-stub)
7. [Phase 4 — Mainnet Hardening](#phase-4--mainnet-hardening)
8. [Contract Interaction Map](#contract-interaction-map)
9. [Stacks Consensus Notes](#stacks-consensus-notes)
10. [Testing Checklist](#testing-checklist)

---

## 1. The Core Challenge

The biggest unsolved architectural problem in the current codebase is:

> **`execute-authorized-operation` validates the bot's signature and updates internal
> accounting, but never actually calls the DeFi adapter. The STX/sBTC never moves
> to the protocol.**

This means a user who says "deposit 0.1 sBTC into Zest" gets a successful
transaction that records the intent onchain — but their funds stay in the
`user-wallet` contract untouched.

The fix requires **delegated execution**: after signature verification, `user-wallet`
must call the registered adapter contract and forward the funds. This is
non-trivial in Clarity because:

- Clarity does not support dynamic `contract-call?` by principal at runtime
- The adapter must be passed as a **trait reference** at call time
- The caller (bot/agent) must supply the concrete adapter contract that implements
  `adapter-trait` alongside the operation parameters

This is the central design constraint everything else flows from.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  TELEGRAM / AGENT LAYER                                         │
│  Claude Sonnet reasons → signs payload with bot private key     │
│  Passes: (nonce, protocol-principal, adapter-trait-ref,         │
│           action, amount, expiry, sig)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │  contract-call
┌────────────────────────▼────────────────────────────────────────┐
│  user-wallet.clar                                               │
│  1. Verify initialized, not paused                             │
│  2. Verify nonce (replay protection)                           │
│  3. Verify expiry (stacks-block-height)                        │
│  4. Verify secp256k1 signature over canonical payload          │
│  5. Check per-tx and daily limits                              │
│  6. Check protocol allocation cap                              │
│  7. DELEGATE → adapter-trait call (new)                        │
│  8. Update internal accounting                                 │
│  9. Write operation-history                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │  contract-call? via trait
┌────────────────────────▼────────────────────────────────────────┐
│  adapter-zest.clar / adapter-alex.clar / adapter-hermetica.clar │
│  Implements adapter-trait                                       │
│  Receives: (amount, action)                                     │
│  Calls: protocol-specific Clarity contracts                     │
│  Returns: { amount: uint, allocated: uint }                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│  STACKS DEFI PROTOCOLS                                          │
│  Zest / ALEX / Hermetica / Bitflow                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ERC-8004 IDENTITY LAYER (Phase 3 — stub now, full later)       │
│  agent-identity.clar                                            │
│  • Stores agent's onchain DID                                   │
│  • Records operation hashes for reputation                      │
│  • Verifiable by any third party                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Fix Critical Bugs (Before Anything Else)

These must be fixed before any new feature work. They prevent compilation
or produce incorrect behavior.

### Bug 0.1 — `withdraw-payload` syntax error in testnet wallet

**File:** `user-wallet.clar` (testnet/simplified version)

**Problem:** The `let` binding in `withdraw-payload` opens but the body
expression is missing — `concat` is inside the binding list, not the body.

**Current (broken):**
```clarity
(define-private (withdraw-payload (nonce uint) (amount uint) (expiry uint) (recip-hash (buff 32)))
  (let ((self-hash (sha256 (unwrap-panic (to-consensus-buff? (as-contract tx-sender)))))
    (concat (var-get telegram-hash) ...)))   ;; ← concat is the binding value, no body
```

**Fixed:**
```clarity
(define-private (withdraw-payload (nonce uint) (amount uint) (expiry uint) (recip-hash (buff 32)))
  (let ((self-hash (sha256 (unwrap-panic (to-consensus-buff? (as-contract tx-sender))))))
    (concat (var-get telegram-hash)
      (concat (uint-to-16bytes DOMAIN-WITHDRAW)
        (concat self-hash
          (concat (uint-to-16bytes nonce)
            (concat (uint-to-16bytes amount)
              (concat (uint-to-16bytes expiry) recip-hash))))))))
```

**Note:** The `self-hash` binding adds the wallet contract's own principal hash
to the withdraw payload. This is correct — it domain-separates withdrawals
per-wallet so a signature for wallet A cannot be replayed on wallet B.

### Bug 0.2 — Standardize on `stacks-block-height` everywhere

**Problem:** `withdraw-helper.clar` uses `block-height` (Bitcoin anchor blocks).
`user-wallet.clar` testnet version uses `stacks-block-height`. When these two
contracts interact via `consume-authorization`, the `expiry-block` check in
`withdraw-helper` fires on a different clock than the one used when the
authorization was created in `user-wallet`.

**Fix:** Replace every `block-height` in `withdraw-helper.clar` with
`stacks-block-height`. The `last-reset-block` daily limit tracking must also
use `stacks-block-height`. Update `BLOCKS-PER-DAY` comment to note this is
Stacks blocks, not Bitcoin blocks.

```clarity
;; Before
(define-constant BLOCKS-PER-DAY u144)  ;; Bitcoin blocks/day

;; After
(define-constant BLOCKS-PER-DAY u864)
;; Stacks Nakamoto: ~6 Stacks blocks per Bitcoin block × 144 Bitcoin blocks/day
;; Adjust based on observed tenure cadence. Conservative: use u720 for safety margin.
```

> **Stacks consensus note:** Post-Nakamoto, Stacks produces blocks within every
> Bitcoin tenure. Actual Stacks blocks per day varies. Use `u720` as a
> conservative floor; the exact number depends on miner behavior. For a
> production system, consider an oracle or reading `(get-stacks-block-info?)`
> to calibrate dynamically.

### Bug 0.3 — `adapter-alex.clar` self-transfer

**Problem:**
```clarity
(try! (as-contract (stx-transfer? amount tx-sender (as-contract tx-sender))))
```
Inside `as-contract`, `tx-sender` is already the contract itself. This is a
no-op transfer from the contract to itself.

**Fix:** The adapter should receive STX from `user-wallet` via a prior
`stx-transfer?`, then the adapter calls the protocol. The deposit flow
is redesigned in Phase 1 below.

### Bug 0.4 — `initialize` only registers first protocol element

**File:** `user-wallet.clar` (testnet version)

**Problem:** Uses `element-at protocols u0` — only the first protocol in the
list is registered. The `map register-protocol protocols` from the production
version correctly iterates all.

**Fix:** Restore the `map register-protocol` pattern from production:
```clarity
(define-private (register-protocol (p { address: principal, name: (string-ascii 32), max-alloc: uint }))
  (map-set allowed-protocols (get address p)
    { name: (get name p), max-allocation: (get max-alloc p),
      current-allocation: u0, enabled: true }))

;; In initialize:
(map register-protocol protocols)
```

---

## Phase 1 — Adapter Delegation Engine

**This is the core engineering challenge.** The goal is to make
`execute-authorized-operation` actually move funds to the DeFi protocol.

### 1.1 The Clarity Trait Constraint

Clarity's type system requires that trait-typed arguments appear as function
parameters — you cannot read a `principal` from a map and call it as a trait
at runtime. This is by design (enables static analysis).

**Consequence:** The bot/agent must pass the adapter contract as a typed
parameter alongside the operation. The `user-wallet` then verifies that this
contract matches what is registered in `allowed-protocols`.

### 1.2 Updated `execute-authorized-operation` Signature

```clarity
(use-trait adapter-trait .adapter-trait.adapter-trait)

(define-public (execute-authorized-operation
    (nonce uint)
    (protocol principal)           ;; address used for accounting lookup
    (adapter <adapter-trait>)      ;; concrete contract passed by caller
    (action (string-ascii 16))
    (amount uint)
    (expiry-block uint)
    (bot-sig (buff 65)))
```

**Important:** `(as-contract tx-sender)` of `adapter` must equal `protocol`.
Add this assertion after unwrapping the protocol config:

```clarity
;; Verify the adapter contract matches the registered protocol address
(asserts! (is-eq (contract-of adapter) protocol) ERR-UNKNOWN-PROTOCOL)
```

> `contract-of` is a Clarity built-in that extracts the principal from a
> trait reference. This ensures the bot cannot pass a malicious adapter
> that satisfies the trait but points to a different contract.

### 1.3 STX Transfer Before Adapter Call

For `"deposit"` actions, `user-wallet` must send STX to the adapter before
calling `execute`. The adapter then uses those funds to interact with the
DeFi protocol:

```clarity
;; Inside execute-authorized-operation, after all assertions pass:
(if (is-eq action "deposit")
  (begin
    ;; Send STX from user-wallet to adapter
    (try! (as-contract (stx-transfer? amount tx-sender (contract-of adapter))))
    ;; Call adapter — it now holds the STX and routes to protocol
    (try! (as-contract (contract-call? adapter execute amount action)))
  )
  (if (is-eq action "withdraw")
    (begin
      ;; Adapter pulls from protocol and sends back to user-wallet
      (try! (as-contract (contract-call? adapter execute amount action)))
      ;; No STX transfer here — adapter sends directly to user-wallet
    )
    (err ERR-UNKNOWN-PROTOCOL)
  )
)
```

### 1.4 Updated `adapter-trait`

The trait needs minor updates to support the bidirectional flow:

```clarity
;; adapter-trait.clar
(define-trait adapter-trait
  (
    ;; Execute deposit or withdraw
    ;; For deposit: adapter receives STX before this call, routes to protocol
    ;; For withdraw: adapter retrieves from protocol, sends back to caller
    (execute
      (uint (string-ascii 16))
      (response { amount: uint, allocated: uint } uint)
    )

    ;; Total currently allocated in this adapter (for health checks)
    (get-balance
      ()
      (response uint uint)
    )

    ;; Returns the protocol principal this adapter targets
    ;; Used by user-wallet for cross-verification
    (get-protocol-address
      ()
      (response principal uint)
    )
  )
)
```

### 1.5 Updated `adapter-alex.clar` — Correct Deposit Flow

```clarity
(define-public (execute (amount uint) (action (string-ascii 16)))
  (if (is-eq action "deposit")
    (begin
      ;; At this point, user-wallet has already transferred STX to this contract.
      ;; We now have the STX and route it to ALEX protocol.
      ;; For MVP: wrap STX → wSTX, then add to ALEX pool
      (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERR-INSUFFICIENT-BALANCE)
      ;; TODO: actual ALEX deposit call once pool addresses confirmed on testnet
      ;; (try! (as-contract (contract-call? ALEX-RESERVE-POOL add-to-balance TOKEN-WSTX amount)))
      (var-set total-allocated (+ (var-get total-allocated) amount))
      (ok { amount: amount, allocated: (var-get total-allocated) })
    )
    (if (is-eq action "withdraw")
      (begin
        ;; Retrieve from ALEX and send back to user-wallet (tx-sender in this context)
        (asserts! (>= (var-get total-allocated) amount) ERR-INSUFFICIENT-BALANCE)
        ;; TODO: actual ALEX withdrawal
        (try! (as-contract (stx-transfer? amount (as-contract tx-sender) tx-sender)))
        (var-set total-allocated (- (var-get total-allocated) amount))
        (ok { amount: amount, allocated: (var-get total-allocated) })
      )
      (err u401)
    )
  )
)

(define-read-only (get-protocol-address)
  (ok ALEX-VAULT)
)
```

### 1.6 Canonical Payload — Include Adapter Hash

The op-payload must commit to the adapter contract to prevent the bot from
being tricked into routing to a different adapter than intended:

```clarity
(define-private (op-payload
    (nonce uint)
    (protocol principal)
    (adapter principal)      ;; NEW: adapter contract hash included
    (action (string-ascii 16))
    (amount uint)
    (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-OP-EXECUTE)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (sha256 (unwrap-panic (to-consensus-buff? adapter)))  ;; NEW
          (concat (sha256 (unwrap-panic (to-consensus-buff? action)))
            (concat (uint-to-16bytes nonce)
              (concat (uint-to-16bytes amount)
                      (uint-to-16bytes expiry)))))))))
```

The bot signs over the adapter principal. If a different adapter is submitted
on-chain, `verify-sig` fails.

---

## Phase 2 — Withdraw Flow Unification

### 2.1 The Two-Nonce Problem

Currently, `withdraw-stx` uses `helper-nonce` which feeds into
`withdraw-helper`'s per-wallet nonce, while `execute-authorized-operation`
uses `user-wallet`'s `current-nonce`. A single user has two independent
counters the bot must track.

**Proposed unification:** Withdraw from the wallet (to the user's Stacks
address) goes through a single path. The `withdraw-helper` nonce becomes
the authoritative counter for all withdrawals. `user-wallet`'s nonce is
used only for internal protocol operations (deposit, rebalance, etc.).

Bot state becomes:
```
user_wallet_nonce  → for: execute-authorized-operation
                         emergency-pause, unpause
                         update-limits, add-protocol, update-protocol

withdraw_helper_nonce → for: authorize-withdrawal → withdraw-stx/withdraw-token
```

These are semantically distinct operations. Keeping them separate is correct.
The bot must track both, clearly labeled in its state DB.

### 2.2 Withdraw Authorization Flow (Revised)

The two-step withdraw (authorize then consume) is the right pattern — it
prevents the adapter from being the withdrawal executor. Keep it, but
document it explicitly:

```
Step 1 (bot calls withdraw-helper):
  authorize-withdrawal(wallet, nonce, amount, recipient, expiry, tg-proof, bot-sig)
  → validates everything, stores pending-auth, returns auth-key

Step 2 (user-wallet calls withdraw-helper, same tx):
  withdraw-stx calls consume-authorization(wallet, recipient, amount, auth-key)
  → verifies all match, advances nonce, calculates fee split, returns net/fee/treasury
  → user-wallet executes the actual stx-transfer?
```

**Key insight:** Steps 1 and 2 cannot be atomic in the same transaction
unless `user-wallet` calls `withdraw-helper.authorize-withdrawal` first,
then calls itself recursively — which Clarity disallows. In practice, the
bot submits both calls in sequence. The `expiry-block` window covers the
latency between blocks.

**For MVP:** Keep the two-call pattern. The bot submits `authorize-withdrawal`
in block N, then `withdraw-stx` in block N+1 (within expiry window).

---

## Phase 3 — ERC-8004 Identity Stub

ERC-8004 is an agent identity standard being deployed on Stacks mainnet.
The goal here is to build the stub contract now so the integration point
is well-defined, without depending on the final ERC-8004 spec being frozen.

### 3.1 `agent-identity.clar` — The Stub

This contract is deployed by the same key as `user-wallet`. It serves as the
agent's onchain footprint and will be upgraded to full ERC-8004 compliance
once the spec is finalized.

```clarity
;; agent-identity.clar
;; ERC-8004 stub — records agent actions for reputation accumulation
;; Full ERC-8004 compliance to be added post-mainnet launch

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant MAX-HISTORY u500)

;; Agent identity metadata
(define-data-var agent-name (string-ascii 64) "bitcoin-yield-copilot")
(define-data-var agent-version (string-ascii 16) "0.1.0")
(define-data-var agent-pubkey (buff 33) 0x000000000000000000000000000000000000000000000000000000000000000000)
(define-data-var action-count uint u0)

;; Authorized callers (user-wallet contracts managed by this agent)
(define-map authorized-wallets principal bool)

;; Action log — mirrors operation-history but at the agent level
(define-map action-log
  uint
  {
    wallet: principal,
    protocol: principal,
    action: (string-ascii 16),
    amount: uint,
    block: uint,
    op-hash: (buff 32)    ;; canonical-hash from user-wallet operation
  }
)

;; ERC-8004 forward compatibility: these fields will be populated
;; once the standard is finalized on aibtcdev mainnet
(define-data-var erc8004-did (optional (string-ascii 128)) none)
(define-data-var erc8004-contract (optional principal) none)

;; Only CONTRACT-OWNER can authorize wallets
(define-public (authorize-wallet (wallet principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set authorized-wallets wallet true)
    (ok true)))

(define-public (deauthorize-wallet (wallet principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set authorized-wallets wallet false)
    (ok true)))

;; Called by user-wallet after each successful operation
;; This is the reputation accumulation hook
(define-public (record-action
    (wallet principal)
    (protocol principal)
    (action (string-ascii 16))
    (amount uint)
    (op-hash (buff 32)))
  (begin
    (asserts! (default-to false (map-get? authorized-wallets tx-sender))
              ERR-NOT-AUTHORIZED)
    (let ((slot (mod (var-get action-count) MAX-HISTORY)))
      (map-set action-log slot
        { wallet: wallet, protocol: protocol, action: action,
          amount: amount, block: stacks-block-height, op-hash: op-hash })
      (var-set action-count (+ (var-get action-count) u1))
      (ok (var-get action-count)))))

;; ERC-8004 migration hook — called once spec is live
(define-public (bind-erc8004 (did (string-ascii 128)) (identity-contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (var-get erc8004-did)) ERR-NOT-AUTHORIZED) ;; one-time bind
    (var-set erc8004-did (some did))
    (var-set erc8004-contract (some identity-contract))
    (ok true)))

;; Read-only
(define-read-only (get-agent-info)
  { name: (var-get agent-name),
    version: (var-get agent-version),
    action-count: (var-get action-count),
    erc8004-did: (var-get erc8004-did),
    erc8004-contract: (var-get erc8004-contract) })

(define-read-only (get-action (idx uint))
  (map-get? action-log (mod idx MAX-HISTORY)))

(define-read-only (is-authorized-wallet (wallet principal))
  (default-to false (map-get? authorized-wallets wallet)))
```

### 3.2 Hook `user-wallet` to `agent-identity`

Add an optional `record-action` call at the end of `execute-authorized-operation`.
Use `as-contract` so `user-wallet` is `tx-sender` in the identity contract.
Make it non-fatal — if identity recording fails, the operation still succeeds:

```clarity
;; At the end of execute-authorized-operation, after updating operation-count:
(match (as-contract (contract-call? .agent-identity record-action
    tx-sender protocol action amount payload-hash))
  success-val true      ;; ignore success value
  err-val true)         ;; non-fatal: identity recording failure does not revert
```

> Using `match` with both branches returning `true` ensures the `try!`
> is not used — a failure in `agent-identity` will not abort the main operation.
> This is intentional: reputation recording is best-effort in the stub phase.

### 3.3 ERC-8004 Migration Path

When ERC-8004 is live on aibtcdev mainnet:

1. Call `bind-erc8004` with the DID string and identity contract address
2. Upgrade `agent-identity.clar` to `agent-identity-v2.clar` that implements
   the full ERC-8004 trait
3. `user-wallet` calls `v2` via trait reference (same pattern as adapters)
4. Past `action-log` data is portable — the history is already onchain

No migration of existing operation data is needed. The `op-hash` fields in
`action-log` point back to the canonical hashes in `user-wallet`'s
`operation-history` map, so full auditability is preserved.

---

## Phase 4 — Mainnet Hardening

### 4.1 Payload Versioning

Add a `VERSION` constant to the payload format so the bot can distinguish
which contract version it is signing for:

```clarity
(define-constant PAYLOAD-VERSION u1)

(define-private (op-payload ...)
  (concat (uint-to-16bytes PAYLOAD-VERSION)   ;; prepend version
    (concat (var-get telegram-hash) ...)))
```

The bot checks this version before signing. When contracts are upgraded,
version bumps to `u2`. Old signatures are invalid on new contracts by design.

### 4.2 `wallet-factory` — Use `stacks-block-height`

Same fix as 0.2. Replace `block-height` in `deactivate-wallet` and
`reactivate-wallet` expiry checks.

### 4.3 Protocol Allocation — Track Net vs. Gross

Currently `current-allocation` is incremented on deposit and decremented on
withdraw. This tracks net allocated but not accumulated yield. Add a
`lifetime-deposited` field to the protocol map for reporting:

```clarity
(define-map allowed-protocols
  principal
  { name: (string-ascii 32),
    max-allocation: uint,
    current-allocation: uint,
    lifetime-deposited: uint,   ;; NEW: never decremented
    enabled: bool }
)
```

### 4.4 Withdrawal Minimum — Keep in `withdraw-helper`

`MIN-WITHDRAW-AMOUNT u1000` (microSTX) is defined in `withdraw-helper`.
This is the right place. The `user-wallet` should not need its own minimum.
One source of truth.

### 4.5 `add-protocol` — Signature Must Include Protocol Name

Currently `add-proto-payload` hashes the protocol principal but not the name.
A replay attack could register the same principal with a different name
(if a collision were found). Include the name in the payload:

```clarity
(define-private (add-proto-payload (nonce uint) (protocol principal) (name (string-ascii 32)) (max-alloc uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-ADD-PROTOCOL)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (sha256 (unwrap-panic (to-consensus-buff? name)))  ;; NEW
          (concat (uint-to-16bytes nonce)
            (concat (uint-to-16bytes max-alloc)
                    (uint-to-16bytes expiry))))))))
```

---

## Contract Interaction Map

```
wallet-factory.clar
  └─ register-wallet(tg-hash, wallet-contract, nonce, sig)
       └─ stores: user-wallets[tg-hash] = { wallet-contract, active }
       └─ stores: wallet-owners[wallet-contract] = tg-hash

user-wallet.clar  (one per user, deployed by factory)
  ├─ initialize(tg-hash, bot-pk, max-per-tx, day-limit, protocols)
  │
  ├─ execute-authorized-operation(nonce, protocol, adapter<trait>, action, amount, expiry, sig)
  │    ├─ verify-sig(op-payload(...))
  │    ├─ check limits (per-tx, daily, allocation)
  │    ├─ stx-transfer? → adapter  [if deposit]
  │    ├─ contract-call? adapter.execute(amount, action)
  │    ├─ update allowed-protocols[protocol].current-allocation
  │    ├─ write operation-history[slot]
  │    └─ (optional) agent-identity.record-action(...)
  │
  ├─ withdraw-stx(helper-nonce, amount, recipient, expiry, auth-key, sig)
  │    ├─ verify-sig(withdraw-payload(...))
  │    ├─ withdraw-helper.consume-authorization(wallet, recipient, amount, auth-key)
  │    └─ stx-transfer? net-amount → recipient
  │         stx-transfer? fee-amount → treasury
  │
  └─ admin: emergency-pause, unpause, update-limits, add-protocol, update-protocol

withdraw-helper.clar  (one global, deployed by team)
  ├─ register-wallet(wallet, tg-hash, max-per-tx, daily-limit)
  ├─ authorize-withdrawal(wallet, nonce, amount, recipient, expiry, tg-proof, sig)
  │    └─ stores pending-auth[auth-key]
  └─ consume-authorization(wallet, recipient, amount, auth-key)
       └─ returns { net-amount, fee-amount, treasury }

adapter-trait.clar  (interface)
  └─ execute(amount, action) → { amount, allocated }
  └─ get-balance() → uint
  └─ get-protocol-address() → principal  [NEW]

adapter-alex.clar  (implements adapter-trait)
adapter-zest.clar  (implements adapter-trait)  [to be built]
adapter-hermetica.clar  (implements adapter-trait)  [to be built]
adapter-bitflow.clar  (implements adapter-trait)  [to be built]

agent-identity.clar  (ERC-8004 stub)
  ├─ authorize-wallet(wallet)
  ├─ record-action(wallet, protocol, action, amount, op-hash)
  └─ bind-erc8004(did, identity-contract)  [migration hook]
```

---

## Stacks Consensus Notes

These notes are critical for correct behavior post-Nakamoto.

### Block Height Variables

| Variable | Meaning | Use in these contracts |
|---|---|---|
| `stacks-block-height` | Stacks chain height (fast blocks) | All expiry and timing logic |
| `block-height` | Bitcoin block height (slow, ~10 min) | Cross-chain anchoring only |
| `tenure-height` | Bitcoin blocks that opened a tenure | Not used directly |

**Rule:** Use `stacks-block-height` everywhere in these contracts.
Never mix the two in the same comparison.

### `BLOCKS-PER-DAY` Calibration

Post-Nakamoto, Stacks targets ~5 second block times within a tenure.
One Bitcoin tenure ≈ 144 Bitcoin blocks ≈ ~24 hours.
Within a tenure, Stacks produces many blocks (exact count depends on miner).

```clarity
;; Conservative estimate for daily limit reset
;; 144 Bitcoin blocks × ~5-6 Stacks blocks per Bitcoin block = ~720-864
;; Using 720 as safe lower bound (resets slightly faster than 24h at the floor)
(define-constant BLOCKS-PER-DAY u720)
```

This is a product decision: a smaller value = more frequent resets = more
permissive spending limits. Err on the conservative side for security.

### `secp256k1-recover?` in Clarity

- Returns `(optional (buff 33))` — the recovered public key in compressed form
- The signature must be the 65-byte recoverable format (r || s || v)
- The payload must be SHA-256 hashed before passing to `secp256k1-recover?`
  (the hash is not applied internally)
- The recovered key is compared to `bot-pubkey` — this is how the bot's
  authority is validated without storing a traditional keypair

**Bot signing requirement:**
```typescript
// The bot MUST sign the sha256 hash of the payload, not the payload itself
const payloadHash = sha256(buildOpPayload(nonce, protocol, adapter, action, amount, expiry));
const sig = signRecoverable(payloadHash, botPrivateKey); // 65 bytes, recoverable
```

### `to-consensus-buff?`

Used to serialize principals and strings into deterministic byte sequences for
hashing. For `uint`, the consensus encoding is 17 bytes (1-byte prefix + 16
bytes). The `uint-to-16bytes` helper strips the prefix byte with `slice?`:

```clarity
(define-private (uint-to-16bytes (n uint))
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? n)) u1 u17)))
```

This produces a fixed-length 16-byte encoding suitable for payload construction.
The 1-byte type prefix (`0x01` for uint) is stripped because all fields in a
payload are known-type — the prefix would add no information and just waste
space in the hash preimage.

---

## Testing Checklist

### Phase 0 — Regression

- [ ] `withdraw-payload` compiles and produces deterministic output
- [ ] `initialize` registers all protocols in the list (not just index 0)
- [ ] Daily limit resets based on `stacks-block-height`, not `block-height`
- [ ] `BLOCKS-PER-DAY` calibrated to Stacks blocks on testnet

### Phase 1 — Adapter Delegation

- [ ] `execute-authorized-operation` with `"deposit"` and valid adapter:
  - STX leaves `user-wallet`
  - STX arrives at `adapter`
  - Adapter calls protocol (or stub records it)
  - `current-allocation` incremented
  - `operation-history` entry written
- [ ] Same call with adapter principal ≠ protocol principal → `ERR-UNKNOWN-PROTOCOL`
- [ ] Same call with non-trait-conforming contract → compile-time rejection
- [ ] Deposit exceeding `max-allocation` → `ERR-ALLOCATION-EXCEEDED`
- [ ] Deposit exceeding `max-per-tx` → `ERR-LIMIT-EXCEEDED`
- [ ] Deposit exceeding remaining daily limit → `ERR-DAILY-LIMIT`
- [ ] Replay same nonce → `ERR-EXPIRED`
- [ ] Expired block → `ERR-EXPIRED`
- [ ] Invalid signature → `ERR-INVALID-SIGNATURE`

### Phase 2 — Withdraw Flow

- [ ] Full two-step withdraw succeeds: authorize → consume → transfer
- [ ] Consumed auth cannot be reused
- [ ] Fee calculation: `net = amount - (amount * fee-bps / 10000)`
- [ ] Fee transferred to treasury, net to recipient
- [ ] Expired auth (past expiry-block) → `ERR-EXPIRED` on consume

### Phase 3 — Agent Identity

- [ ] `record-action` succeeds when called by authorized wallet
- [ ] `record-action` fails when called by non-authorized address
- [ ] Identity recording failure does NOT revert `execute-authorized-operation`
- [ ] `bind-erc8004` can only be called once (idempotency guard)
- [ ] `action-log` correctly wraps at `MAX-HISTORY` slots

### Phase 4 — Hardening

- [ ] Payload version mismatch → signature invalid (test with wrong version byte)
- [ ] `add-protocol` payload includes name hash
- [ ] `lifetime-deposited` only increments, never decrements

---

## Deployment Order

```
1. adapter-trait.clar          (no dependencies)
2. agent-identity.clar         (no dependencies)
3. withdraw-helper.clar        (no dependencies)
4. adapter-alex.clar           (depends on adapter-trait)
5. adapter-zest.clar           (depends on adapter-trait)
6. wallet-factory.clar         (no dependencies)
7. user-wallet.clar            (depends on all above)
   → initialize(...)
   → withdraw-helper.register-wallet(user-wallet-address, ...)
   → agent-identity.authorize-wallet(user-wallet-address)
```

Each `user-wallet` deployment (one per user) requires steps 7's
post-deploy initialization calls.

---

## Open Questions for Post-MVP

1. **sBTC adapter:** sBTC is an SIP-010 token, not native STX. The `withdraw-token`
   function exists but the adapter interface uses `stx-transfer?`. Define an
   sBTC-specific adapter that works with `ft-trait` and `contract-call? token transfer`.

2. **Rebalance action:** Currently only `"deposit"` and `"withdraw"` are handled.
   A `"rebalance"` action (withdraw from A, deposit to B, atomically) would require
   a two-adapter call in one transaction. Clarity supports this but the payload
   and trait signature need new domain tags.

3. **ERC-8004 DID format:** The `string-ascii 128` DID field is a placeholder.
   When the aibtcdev spec is published, update to the correct type and validation.

4. **x402 payments:** Data feed costs (APY oracles, price feeds) are paid in STX
   by the agent offchain before submitting transactions. No Clarity changes needed
   for x402 integration — it is an HTTP payment layer, not a smart contract layer.
   The `agent-identity` contract can optionally record x402 payment receipts as
   action-log entries for transparency.

5. **Multi-sig upgrade path:** `CONTRACT-OWNER` is currently a single key. For
   production, consider replacing the owner checks with a `(is-eq tx-sender
   (var-get owner))` pattern where `owner` is updatable via a threshold
   signature, or integrate with a Stacks multisig contract.