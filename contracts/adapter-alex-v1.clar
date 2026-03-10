;; adapter-alex-v1.clar
;; Concrete implementation v1 for ALEX Protocol integration
;; Supports: STX deposits/withdrawals, token deposits/withdrawals,
;;           staking, unstaking, and reward claiming -all with revenue fees
;;
;; This contract is immutable after deployment.
;; To upgrade, deploy adapter-alex-v2.clar and call
;; (proxy-registry/set-implementation "adapter-alex" <new-principal>)

(impl-trait .adapter-trait.adapter-trait)

;; ============================================
;; STORAGE
;; ============================================

(define-map user-stx-balances    principal uint)
(define-map user-token-balances  { user: principal, token: principal } uint)
(define-map user-staking-amounts principal uint)

(define-data-var total-stx-deposited    uint u0)
(define-data-var total-yield-claimed    uint u0)
(define-data-var total-revenue-collected uint u0)

;; Revenue configuration
(define-data-var fee-bps  uint u50)                        ;; 0.5% default (50 bps)
(define-data-var treasury principal .wallet-factory)       ;; Fee destination

;; ============================================
;; ERRORS
;; ============================================

(define-constant ERR-INVALID-AMOUNT       (err u400))
(define-constant ERR-INVALID-ACTION       (err u401))
(define-constant ERR-NOT-AUTHORIZED       (err u403))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))
(define-constant ERR-ALEX-CALL-FAILED     (err u500))

;; ============================================
;; TOKEN TRAIT
;; ============================================

(define-trait ft-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
  )
)

;; ============================================
;; REVENUE HELPERS
;; ============================================

(define-private (calculate-fee (amount uint))
  (let ((bps (var-get fee-bps)))
    (if (> bps u0)
      (/ (* amount bps) u10000)
      u0)
  )
)

(define-private (send-token-fee (token <ft-trait>) (fee-amount uint))
  (if (> fee-amount u0)
    (contract-call? token transfer fee-amount tx-sender (var-get treasury) none)
    (ok true))
)

(define-private (send-stx-fee (fee-amount uint))
  (if (> fee-amount u0)
    (as-contract (stx-transfer? fee-amount tx-sender (var-get treasury)))
    (ok true))
)

;; ============================================
;; FEE ADMINISTRATION
;; ============================================

(define-public (set-fee (new-fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender .wallet-factory) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-fee-bps u500) ERR-INVALID-AMOUNT) ;; hard cap: 5%
    (var-set fee-bps new-fee-bps)
    (ok true)
  )
)

(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender .wallet-factory) ERR-NOT-AUTHORIZED)
    (var-set treasury new-treasury)
    (ok true)
  )
)

;; ============================================
;; ADAPTER-TRAIT: execute
;; ============================================

(define-public (execute (amount uint) (action (string-ascii 16)))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (if (is-eq action "deposit")
      (deposit-stx amount)
      (if (is-eq action "withdraw")
        (withdraw-stx amount)
        ERR-INVALID-ACTION))
  )
)

;; ============================================
;; STX OPERATIONS
;; ============================================

(define-public (deposit-stx (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let (
      (fee        (calculate-fee amount))
      (net-amount (- amount fee))
    )
      ;; Pull STX from user into this contract
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

      ;; Credit net amount to user
      (map-set user-stx-balances tx-sender
        (+ (default-to u0 (map-get? user-stx-balances tx-sender)) net-amount))

      ;; Update global counters
      (var-set total-stx-deposited
        (+ (var-get total-stx-deposited) net-amount))
      (var-set total-revenue-collected
        (+ (var-get total-revenue-collected) fee))

      ;; Forward fee to treasury
      (try! (send-stx-fee fee))

      (print { event: "stx-deposited", user: tx-sender,
               amount: amount, fee: fee, net: net-amount })
      (ok { amount: net-amount, allocated: (var-get total-stx-deposited) })
    )
  )
)

(define-public (withdraw-stx (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let (
      (balance (unwrap! (map-get? user-stx-balances tx-sender) ERR-INSUFFICIENT-BALANCE))
    )
      (asserts! (>= balance amount) ERR-INSUFFICIENT-BALANCE)
      (let (
        (fee        (calculate-fee amount))
        (net-amount (- amount fee))
      )
        ;; Return net amount to user
        (try! (as-contract (stx-transfer? net-amount tx-sender tx-sender)))

        ;; Forward fee to treasury
        (try! (send-stx-fee fee))

        ;; Debit user balance
        (map-set user-stx-balances tx-sender (- balance amount))

        ;; Update global counters
        (var-set total-stx-deposited
          (if (>= (var-get total-stx-deposited) net-amount)
            (- (var-get total-stx-deposited) net-amount)
            u0))
        (var-set total-revenue-collected
          (+ (var-get total-revenue-collected) fee))

        (print { event: "stx-withdrawn", user: tx-sender,
                 amount: amount, fee: fee, net: net-amount })
        (ok { amount: net-amount, allocated: (var-get total-stx-deposited) })
      )
    )
  )
)

;; ============================================
;; TOKEN OPERATIONS
;; ============================================

(define-public (deposit-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let (
      (fee             (calculate-fee amount))
      (net-amount      (- amount fee))
      (token-principal (contract-of token))
      (key             { user: tx-sender, token: token-principal })
    )
      ;; Pull tokens from user
      (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

      ;; Credit net amount to user
      (map-set user-token-balances key
        (+ (default-to u0 (map-get? user-token-balances key)) net-amount))

      ;; Forward fee to treasury
      (try! (send-token-fee token fee))

      (var-set total-revenue-collected
        (+ (var-get total-revenue-collected) fee))

      (print { event: "token-deposited", user: tx-sender,
               token: token-principal, amount: amount, fee: fee, net: net-amount })
      (ok net-amount)
    )
  )
)

(define-public (withdraw-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let (
      (token-principal (contract-of token))
      (key             { user: tx-sender, token: token-principal })
      (balance         (unwrap! (map-get? user-token-balances key) ERR-INSUFFICIENT-BALANCE))
    )
      (asserts! (>= balance amount) ERR-INSUFFICIENT-BALANCE)
      (let (
        (fee        (calculate-fee amount))
        (net-amount (- amount fee))
      )
        ;; Return net amount to user
        (try! (as-contract (contract-call? token transfer net-amount tx-sender tx-sender none)))

        ;; Forward fee to treasury
        (try! (send-token-fee token fee))

        ;; Debit user balance
        (map-set user-token-balances key (- balance amount))

        (var-set total-revenue-collected
          (+ (var-get total-revenue-collected) fee))

        (print { event: "token-withdrawn", user: tx-sender,
                 token: token-principal, amount: amount, fee: fee, net: net-amount })
        (ok net-amount)
      )
    )
  )
)

;; ============================================
;; STAKING OPERATIONS
;; ============================================

(define-public (stake-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let (
      (fee             (calculate-fee amount))
      (net-amount      (- amount fee))
      (token-principal (contract-of token))
    )
      ;; Pull tokens from user
      (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

      ;; Credit staked balance
      (map-set user-staking-amounts tx-sender
        (+ (default-to u0 (map-get? user-staking-amounts tx-sender)) net-amount))

      ;; Forward fee to treasury
      (try! (send-token-fee token fee))

      (var-set total-revenue-collected
        (+ (var-get total-revenue-collected) fee))

      (print { event: "token-staked", user: tx-sender,
               token: token-principal, amount: amount, fee: fee, net: net-amount })
      (ok net-amount)
    )
  )
)

(define-public (unstake-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let (
      (balance (unwrap! (map-get? user-staking-amounts tx-sender) ERR-INSUFFICIENT-BALANCE))
    )
      (asserts! (>= balance amount) ERR-INSUFFICIENT-BALANCE)
      (let (
        (fee             (calculate-fee amount))
        (net-amount      (- amount fee))
        (token-principal (contract-of token))
      )
        ;; Return net amount to user
        (try! (as-contract (contract-call? token transfer net-amount tx-sender tx-sender none)))

        ;; Forward fee to treasury
        (try! (send-token-fee token fee))

        ;; Debit staked balance
        (map-set user-staking-amounts tx-sender (- balance amount))

        (var-set total-revenue-collected
          (+ (var-get total-revenue-collected) fee))

        (print { event: "token-unstaked", user: tx-sender,
                 token: token-principal, amount: amount, fee: fee, net: net-amount })
        (ok net-amount)
      )
    )
  )
)

;; Claim staking rewards -simplified: 1% of staked balance
(define-public (claim-rewards (token <ft-trait>))
  (begin
    (let (
      (staked-balance (unwrap! (map-get? user-staking-amounts tx-sender) ERR-INSUFFICIENT-BALANCE))
    )
      (asserts! (> staked-balance u0) ERR-INSUFFICIENT-BALANCE)
      (let (
        (yield-amount    (/ staked-balance u100))
        (fee             (calculate-fee yield-amount))
        (net-yield       (- yield-amount fee))
        (token-principal (contract-of token))
      )
        ;; Transfer net yield to user
        (try! (as-contract (contract-call? token transfer net-yield tx-sender tx-sender none)))

        ;; Forward fee to treasury
        (try! (send-token-fee token fee))

        ;; Update counters
        (var-set total-yield-claimed
          (+ (var-get total-yield-claimed) net-yield))
        (var-set total-revenue-collected
          (+ (var-get total-revenue-collected) fee))

        (print { event: "rewards-claimed", user: tx-sender,
                 token: token-principal, yield: yield-amount, fee: fee, net: net-yield })
        (ok net-yield)
      )
    )
  )
)

;; ============================================
;; LEGACY STUBS (kept for backward compatibility)
;; ============================================

(define-public (stake (amount uint))
  (begin (asserts! (> amount u0) ERR-INVALID-AMOUNT) (ok amount))
)

(define-public (unstake (amount uint))
  (begin (asserts! (> amount u0) ERR-INVALID-AMOUNT) (ok amount))
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-balance)
  (ok (var-get total-stx-deposited))
)

(define-read-only (get-user-stx-balance (user principal))
  (ok (default-to u0 (map-get? user-stx-balances user)))
)

(define-read-only (get-user-token-balance (user principal) (token principal))
  (ok (default-to u0 (map-get? user-token-balances { user: user, token: token })))
)

(define-read-only (get-user-staking-balance (user principal))
  (ok (default-to u0 (map-get? user-staking-amounts user)))
)

(define-read-only (get-total-yield-claimed)
  (ok (var-get total-yield-claimed))
)

(define-read-only (get-total-revenue-collected)
  (ok (var-get total-revenue-collected))
)

(define-read-only (get-fee-config)
  { fee-bps: (var-get fee-bps), treasury: (var-get treasury) }
)
