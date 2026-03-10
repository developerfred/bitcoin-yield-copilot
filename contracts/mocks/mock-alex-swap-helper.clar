;; mock-alex-swap-helper.clar
;; Mock do ALEX Swap Helper para testes

(define-constant ERR-POOL-NOT-FOUND (err u1002))
(define-constant ERR-SLIPPAGE (err u1003))

;; Taxa de swap simulada: 0.3%
(define-constant SWAP-FEE-BPS u30)

;; Pool reserves (token-x -> token-y -> { balance-x, balance-y })
(define-map pools
  { token-x: principal, token-y: principal }
  { balance-x: uint, balance-y: uint, fee: uint }
)

;; ============================================
;; SWAP FUNCTIONS
;; ============================================

(define-public (swap-helper
    (token-x principal)
    (token-y principal)
    (dx uint)
    (min-dy uint))
  (let ((pool (unwrap! (map-get? pools { token-x: token-x, token-y: token-y }) ERR-POOL-NOT-FOUND))
        (balance-x (get balance-x pool))
        (balance-y (get balance-y pool))
        (fee (get fee pool)))
    
    ;; Calcular dy baseado na constant product formula: x * y = k
    ;; dy = (dx * balance-y) / (balance-x + dx)
    ;; Aplicar taxa
    (let ((dx-with-fee (/ (* dx (- u10000 fee)) u10000))
          (dy (/ (* dx-with-fee balance-y) (+ balance-x dx))))
      
      ;; Verificar slippage
      (asserts! (>= dy min-dy) ERR-SLIPPAGE)
      
      ;; Atualizar pool
      (map-set pools { token-x: token-x, token-y: token-y }
        { balance-x: (+ balance-x dx), balance-y: (- balance-y dy), fee: fee })
      
      (ok { dx: dx, dy: dy, token-x: token-x, token-y: token-y })
    )
  )
)

(define-read-only (get-helper
    (token-x principal)
    (token-y principal)
    (dx uint))
  (let ((pool (unwrap! (map-get? pools { token-x: token-x, token-y: token-y }) ERR-POOL-NOT-FOUND))
        (balance-x (get balance-x pool))
        (balance-y (get balance-y pool))
        (fee (get fee pool)))
    
    (let ((dx-with-fee (/ (* dx (- u10000 fee)) u10000))
          (dy (/ (* dx-with-fee balance-y) (+ balance-x dx))))
      
      (ok { dx: dx, dy: dy })
    )
  )
)

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

(define-public (create-pool
    (token-x principal)
    (token-y principal)
    (initial-x uint)
    (initial-y uint))
  (begin
    (asserts! (is-none (map-get? pools { token-x: token-x, token-y: token-y })) (err u1004))
    (map-set pools { token-x: token-x, token-y: token-y }
      { balance-x: initial-x, balance-y: initial-y, fee: SWAP-FEE-BPS })
    (ok true)
  )
)

(define-public (update-pool
    (token-x principal)
    (token-y principal)
    (new-x uint)
    (new-y uint))
  (begin
    (asserts! (is-some (map-get? pools { token-x: token-x, token-y: token-y })) ERR-POOL-NOT-FOUND)
    (map-set pools { token-x: token-x, token-y: token-y }
      { balance-x: new-x, balance-y: new-y, fee: SWAP-FEE-BPS })
    (ok true)
  )
)
