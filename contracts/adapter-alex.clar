;; adapter-alex.clar
;; Full Adapter for ALEX Protocol integration
;; Supports: STX, Tokens, Staking with REVENUE on ALL operations

(impl-trait .adapter-trait.adapter-trait)

;; ============================================
;; STORAGE
;; ============================================

(define-map user-stx principal uint)
(define-map user-token-balances { user: principal, token: principal } uint)
(define-map user-staking principal uint)

(define-data-var total-stx-deposited uint u0)
(define-data-var total-yield-claimed uint u0)
(define-data-var total-revenue-collected uint u0)

;; Revenue configuration
(define-data-var fee-bps uint u50)          ;; 0.5% default fee (50 bps)
(define-data-var treasury principal .wallet-factory)  ;; Treasury address

;; ============================================
;; ERRORS
;; ============================================

(define-constant ERR-INVALID-AMOUNT (err u400))
(define-constant ERR-INVALID-ACTION (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))
(define-constant ERR-ALEX-CALL-FAILED (err u500))

;; ============================================
;; TRAIT (for token operations)
;; ============================================

(define-trait ft-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
  )
)

;; ============================================
;; REVENUE MANAGEMENT
;; ============================================

;; Calculate fee amount from basis points
(define-private (calculate-fee (amount uint))
  (let ((bps (var-get fee-bps)))
    (if (> bps u0)
      (/ (* amount bps) u10000)
      u0)
  )
)

;; Transfer fee to treasury
(define-private (transfer-fee-to-treasury (token <ft-trait>) (fee-amount uint))
  (if (> fee-amount u0)
    (contract-call? token transfer fee-amount tx-sender (var-get treasury) none)
    (ok true)
  )
)

;; Transfer STX fee to treasury
(define-private (transfer-stx-fee-to-treasury (fee-amount uint))
  (if (> fee-amount u0)
    (as-contract (stx-transfer? fee-amount tx-sender (var-get treasury)))
    (ok true)
  )
)

;; Update fee configuration (only owner)
(define-public (set-fee (new-fee-bps uint))
  (begin
    (asserts! (is-eq tx-sender .wallet-factory) (err u401))
    (asserts! (<= new-fee-bps u500) (err u400)) ;; Max 5%
    (var-set fee-bps new-fee-bps)
    (ok true)
  )
)

;; Update treasury address
(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender .wallet-factory) (err u401))
    (var-set treasury new-treasury)
    (ok true)
  )
)

;; ============================================
;; CORE: Execute (required by adapter-trait)
;; ============================================

(define-public (execute (amount uint) (action (string-ascii 16)))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    (if (is-eq action "deposit")
      (deposit-stx amount)
      (if (is-eq action "withdraw")
        (withdraw-stx amount)
        ERR-INVALID-ACTION
      )
    )
  )
)

;; ============================================
;; STX OPERATIONS WITH REVENUE
;; ============================================

(define-public (deposit-stx (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Calculate fee
    (let ((fee (calculate-fee amount))
          (net-amount (- amount fee)))
    
      ;; Transfer STX from user to adapter
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      
      ;; Update user balance
      (let ((current (default-to u0 (map-get? user-stx tx-sender))))
        (map-set user-stx tx-sender (+ current net-amount)))
      
      ;; Update totals
      (var-set total-stx-deposited (+ (var-get total-stx-deposited) net-amount))
      (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
      
      ;; Transfer fee to treasury
      (try! (transfer-stx-fee-to-treasury fee))
      
      (print { event: "alex-deposit", user: tx-sender, amount: amount, fee: fee, net: net-amount })
      (ok { amount: net-amount, allocated: (var-get total-stx-deposited) })
    )
  )
)

(define-public (withdraw-stx (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Check user balance
    (let ((current (unwrap! (map-get? user-stx tx-sender) ERR-INSUFFICIENT-BALANCE)))
      (asserts! (>= current amount) ERR-INSUFFICIENT-BALANCE)
      
      ;; Calculate fee
      (let ((fee (calculate-fee amount))
            (net-amount (- amount fee)))
        
        ;; Transfer STX back to user
        (try! (as-contract (stx-transfer? net-amount tx-sender tx-sender)))
        
        ;; Transfer fee to treasury
        (try! (transfer-stx-fee-to-treasury fee))
        
        ;; Update tracking
        (map-set user-stx tx-sender (- current amount))
        (var-set total-stx-deposited 
          (if (>= (var-get total-stx-deposited) net-amount)
            (- (var-get total-stx-deposited) net-amount)
            u0))
        (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
        
        (print { event: "alex-withdraw", user: tx-sender, amount: amount, fee: fee, net: net-amount })
        (ok { amount: net-amount, allocated: (var-get total-stx-deposited) })
      )
    )
  )
)

;; ============================================
;; TOKEN OPERATIONS WITH REVENUE
;; ============================================

(define-public (deposit-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Calculate fee
    (let ((fee (calculate-fee amount))
          (net-amount (- amount fee))
          (token-principal (contract-of token)))
      
      ;; Transfer tokens from user
      (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
      
      ;; Update user balance
      (let ((key { user: tx-sender, token: token-principal }))
        (map-set user-token-balances key 
          (+ (default-to u0 (map-get? user-token-balances key)) net-amount)))
      
      ;; Transfer fee to treasury (use token trait)
      (try! (transfer-fee-to-treasury token fee))
      
      ;; Update revenue
      (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
      
      (print { event: "token-deposit", user: tx-sender, token: token-principal, amount: amount, fee: fee, net: net-amount })
      (ok net-amount)
    )
  )
)

(define-public (withdraw-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    (let ((token-principal (contract-of token))
          (key { user: tx-sender, token: token-principal })
          (current (unwrap! (map-get? user-token-balances key) ERR-INSUFFICIENT-BALANCE)))
      
      (asserts! (>= current amount) ERR-INSUFFICIENT-BALANCE)
      
      ;; Calculate fee
      (let ((fee (calculate-fee amount))
            (net-amount (- amount fee)))
        
        ;; Transfer tokens to user
        (try! (as-contract (contract-call? token transfer net-amount tx-sender tx-sender none)))
        
        ;; Transfer fee to treasury (use token trait)
        (try! (transfer-fee-to-treasury token fee))
        
        ;; Update tracking
        (map-set user-token-balances key (- current amount))
        
        ;; Update revenue
        (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
        
        (print { event: "token-withdraw", user: tx-sender, token: token-principal, amount: amount, fee: fee, net: net-amount })
        (ok net-amount)
      )
    )
  )
)

;; ============================================
;; STAKING OPERATIONS WITH REVENUE
;; ============================================

(define-public (stake-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    (let ((fee (calculate-fee amount))
          (net-amount (- amount fee))
          (token-principal (contract-of token)))
      
      ;; Transfer tokens from user
      (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
      
      ;; Update staking balance
      (let ((current (default-to u0 (map-get? user-staking tx-sender))))
        (map-set user-staking tx-sender (+ current net-amount)))
      
      ;; Transfer fee to treasury (use token trait)
      (try! (transfer-fee-to-treasury token fee))
      
      ;; Update revenue
      (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
      
      (print { event: "staked", user: tx-sender, token: token-principal, amount: amount, fee: fee, net: net-amount })
      (ok net-amount)
    )
  )
)

(define-public (unstake-token (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    (let ((current (unwrap! (map-get? user-staking tx-sender) ERR-INSUFFICIENT-BALANCE)))
      (asserts! (>= current amount) ERR-INSUFFICIENT-BALANCE)
      
      (let ((fee (calculate-fee amount))
            (net-amount (- amount fee))
            (token-principal (contract-of token)))
        
        ;; Transfer tokens back to user
        (try! (as-contract (contract-call? token transfer net-amount tx-sender tx-sender none)))
        
        ;; Transfer fee to treasury (use token trait)
        (try! (transfer-fee-to-treasury token fee))
        
        ;; Update staking balance
        (map-set user-staking tx-sender (- current amount))
        
        ;; Update revenue
        (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
        
        (print { event: "unstaked", user: tx-sender, token: token-principal, amount: amount, fee: fee, net: net-amount })
        (ok net-amount)
      )
    )
  )
)

;; Claim rewards with revenue share
(define-public (claim-rewards (token <ft-trait>))
  (begin
    (let ((staking-bal (unwrap! (map-get? user-staking tx-sender) ERR-INSUFFICIENT-BALANCE)))
      (asserts! (> staking-bal u0) ERR-INSUFFICIENT-BALANCE)
      
      ;; Calculate yield (simplified - 1% of staked amount)
      (let ((yield-amount (/ staking-bal u100))
            (fee (calculate-fee yield-amount))
            (net-yield (- yield-amount fee))
            (token-principal (contract-of token)))
        
        ;; Update totals
        (var-set total-yield-claimed (+ (var-get total-yield-claimed) net-yield))
        (var-set total-revenue-collected (+ (var-get total-revenue-collected) fee))
        
        ;; Transfer net yield to user
        (try! (as-contract (contract-call? token transfer net-yield tx-sender tx-sender none)))
        
        ;; Transfer fee to treasury (use token trait)
        (try! (transfer-fee-to-treasury token fee))
        
        (print { event: "rewards-claimed", user: tx-sender, token: token-principal, yield: yield-amount, fee: fee, net: net-yield })
        (ok net-yield)
      )
    )
  )
)

;; ============================================
;; LEGACY FUNCTIONS
;; ============================================

(define-public (stake (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (ok amount)
  )
)

(define-public (unstake (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (ok amount)
  )
)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (get-balance)
  (ok (var-get total-stx-deposited))
)

(define-read-only (get-user-stx-balance (user principal))
  (ok (default-to u0 (map-get? user-stx user)))
)

(define-read-only (get-user-token-balance (user principal) (token principal))
  (let ((key { user: user, token: token }))
    (ok (default-to u0 (map-get? user-token-balances key)))
  )
)

(define-read-only (get-user-staking-balance (user principal))
  (ok (default-to u0 (map-get? user-staking user)))
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
