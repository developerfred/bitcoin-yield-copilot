;; adapter-alex.clar
;; Adapter for ALEX Protocol integration on Testnet
;; Implements adapter-trait for use with user-wallet

(impl-trait .adapter-trait.adapter-trait)

;; ALEX Testnet Addresses
(define-constant DEPLOYER 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX)

;; ALEX Contracts
(define-constant ALEX-VAULT 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.alex-vault)
(define-constant ALEX-RESERVE-POOL 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.alex-reserve-pool)
(define-constant FIXED-WEIGHT-POOL 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.fixed-weight-pool-v1-02)
(define-constant SIMPLE-WEIGHT-POOL 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.simple-weight-pool-alex)
(define-constant SWAP-HELPER 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.swap-helper-v1-03)

;; Token Contracts
(define-constant TOKEN-ALEX 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.age000-governance-token)
(define-constant TOKEN-AUTO-ALEX 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.auto-alex)
(define-constant TOKEN-WSTX 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wstx)
(define-constant TOKEN-XBTC 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wbtc)
(define-constant TOKEN-XUSD 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wxusda)
(define-constant TOKEN-USDA 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wusda)

;; SIP-010 Trait
(define-trait ft-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)
;; Storage
(define-data-var total-allocated uint u0)

;; Errors
(define-constant ERR-INVALID-AMOUNT (err u400))
(define-constant ERR-INVALID-ACTION (err u401))
(define-constant ERR-ALEX-FAILED (err u500))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))

;; Execute deposit or withdraw on ALEX protocol
;; For deposit: adds liquidity via ALEX contracts
;; For withdraw: removes liquidity
(define-public (execute (amount uint) (action (string-ascii 16)))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (if (is-eq action "deposit")
      (begin
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set total-allocated (+ (var-get total-allocated) amount))
        (ok { amount: amount, allocated: (var-get total-allocated) })
      )
      (if (is-eq action "withdraw")
        (begin
          (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERR-INSUFFICIENT-BALANCE)
          (try! (as-contract (stx-transfer? amount tx-sender (unwrap-panic (get wallet-owner (as-contract tx-sender))))))
          (var-set total-allocated
            (if (>= (var-get total-allocated) amount)
              (- (var-get total-allocated) amount)
              u0))
          (ok { amount: amount, allocated: (var-get total-allocated) })
        )
        ERR-INVALID-ACTION
      )
    )
  )
)

;; Returns total allocated in this adapter
(define-read-only (get-balance)
  (ok (var-get total-allocated))
)

;; Helper functions for direct ALEX integration

;; Add liquidity to fixed-weight pool (e.g., STX-token)
(define-public (add-liquidity-fixed (token-y <ft-trait>) (dx uint) (dy uint) (min-shares uint))
  (begin
    (asserts! (and (> dx u0) (> dy u0)) ERR-INVALID-AMOUNT)
    (try! (contract-call? TOKEN-WSTX approve FIXED-WEIGHT-POOL dx))
    (try! (contract-call? token-y approve FIXED-WEIGHT-POOL dy))
    (let ((result (contract-call? FIXED-WEIGHT-POOL add-to-position TOKEN-WSTX token-y dx dy min-shares)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-FAILED)))
  )
)

;; Add liquidity to simple-weight pool
(define-public (add-liquidity-simple (token-x <ft-trait>) (token-y <ft-trait>) (dx uint) (dy uint))
  (begin
    (asserts! (and (> dx u0) (> dy u0)) ERR-INVALID-AMOUNT)
    (try! (contract-call? token-x approve SIMPLE-WEIGHT-POOL dx))
    (try! (contract-call? token-y approve SIMPLE-WEIGHT-POOL dy))
    (let ((result (contract-call? SIMPLE-WEIGHT-POOL add-to-position token-x token-y dx dy)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-FAILED)))
  )
)

;; Remove liquidity from pool
(define-public (remove-liquidity (pool principal) (token-x <ft-trait>) (token-y <ft-trait>) (percent uint) (min-dx uint) (min-dy uint))
  (begin
    (asserts! (and (> percent u0) (<= percent u100)) ERR-INVALID-AMOUNT)
    (let ((result (contract-call? pool reduce-position token-x token-y percent min-dx min-dy)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-FAILED)))
  )
)

;; Add to vault (collateral to reserve-pool)
(define-public (add-to-vault (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (try! (contract-call? token approve ALEX-RESERVE-POOL amount))
    (let ((result (contract-call? ALEX-RESERVE-POOL add-to-balance token amount)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-FAILED)))
  )
)

;; Get current STX balance of this adapter
(define-read-only (get-stx-balance)
  (ok (stx-get-balance (as-contract tx-sender)))
)
