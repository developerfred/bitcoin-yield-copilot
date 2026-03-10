;; mock-alex-fixed-pool.clar
;; Mock do ALEX Fixed Weight Pool para testes

(define-constant ERR-INSUFFICIENT-BALANCE (err u2001))
(define-constant ERR-POOL-NOT-FOUND (err u2002))
(define-constant ERR-SLIPPAGE (err u2003))

;; Pool data
(define-map pools
  { token-x: principal, token-y: principal }
  { balance-x: uint, balance-y: uint, shares-total: uint, fee-rate-x: uint, fee-rate-y: uint }
)

;; User shares
(define-map user-shares
  { user: principal, token-x: principal, token-y: principal }
  uint
)

;; ============================================
;; LIQUIDITY FUNCTIONS
;; ============================================

;; Helper simples para calcular shares iniciais
(define-private (calculate-initial-shares (dx uint) (dy uint))
  (let ((product (* dx dy)))
    (if (> product u0)
      (if (> product u1000000)
        u1000
        u100)
      u1)))

(define-public (add-to-position
    (token-x principal)
    (token-y principal)
    (dx uint)
    (dy uint)
    (min-shares uint))
  (let ((pool (default-to 
               { balance-x: u0, balance-y: u0, shares-total: u0, fee-rate-x: u30, fee-rate-y: u30 }
               (map-get? pools { token-x: token-x, token-y: token-y })))
        (balance-x (get balance-x pool))
        (balance-y (get balance-y pool))
        (shares-total (get shares-total pool))
        (new-shares (if (is-eq shares-total u0)
                       (calculate-initial-shares dx dy)
                       (/ (* dx shares-total) balance-x))))
    
    (asserts! (>= new-shares min-shares) ERR-SLIPPAGE)
    
    (map-set pools { token-x: token-x, token-y: token-y }
      { balance-x: (+ balance-x dx),
        balance-y: (+ balance-y dy),
        shares-total: (+ shares-total new-shares),
        fee-rate-x: (get fee-rate-x pool),
        fee-rate-y: (get fee-rate-y pool) })
    
    (let ((current-shares (default-to u0 (map-get? user-shares { user: tx-sender, token-x: token-x, token-y: token-y }))))
      (map-set user-shares { user: tx-sender, token-x: token-x, token-y: token-y }
        (+ current-shares new-shares)))
    
    (ok { token-x: token-x, token-y: token-y, dx: dx, dy: dy, shares: new-shares })))

(define-public (reduce-position
    (token-x principal)
    (token-y principal)
    (percent uint)
    (min-dx uint)
    (min-dy uint))
  (let ((pool (unwrap! (map-get? pools { token-x: token-x, token-y: token-y }) ERR-POOL-NOT-FOUND))
        (user-shares-val (unwrap! (map-get? user-shares { user: tx-sender, token-x: token-x, token-y: token-y }) ERR-INSUFFICIENT-BALANCE))
        (shares-to-remove (/ (* user-shares-val percent) u100))
        (balance-x (get balance-x pool))
        (balance-y (get balance-y pool))
        (shares-total (get shares-total pool))
        (dx (/ (* shares-to-remove balance-x) shares-total))
        (dy (/ (* shares-to-remove balance-y) shares-total)))
    
    (asserts! (>= dx min-dx) ERR-SLIPPAGE)
    (asserts! (>= dy min-dy) ERR-SLIPPAGE)
    
    (map-set pools { token-x: token-x, token-y: token-y }
      { balance-x: (- balance-x dx),
        balance-y: (- balance-y dy),
        shares-total: (- shares-total shares-to-remove),
        fee-rate-x: (get fee-rate-x pool),
        fee-rate-y: (get fee-rate-y pool) })
    
    (map-set user-shares { user: tx-sender, token-x: token-x, token-y: token-y }
      (- user-shares-val shares-to-remove))
    
    (ok { token-x: token-x, token-y: token-y, dx: dx, dy: dy })))

;; ============================================
;; QUERIES
;; ============================================

(define-read-only (get-pool-details
    (token-x principal)
    (token-y principal))
  (let ((pool (map-get? pools { token-x: token-x, token-y: token-y })))
    (if (is-some pool)
      (ok (unwrap-panic pool))
      ERR-POOL-NOT-FOUND)))

(define-read-only (get-user-shares
    (user principal)
    (token-x principal)
    (token-y principal))
  (default-to u0 (map-get? user-shares { user: user, token-x: token-x, token-y: token-y })))
