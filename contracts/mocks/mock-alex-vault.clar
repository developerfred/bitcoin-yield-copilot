;; mock-alex-vault.clar
;; Mock do ALEX Vault para testes

(define-constant ERR-INSUFFICIENT-BALANCE (err u3001))

;; Balances por token
(define-map vault-balances principal uint)

;; Taxa de flash loan: 0.09%
(define-constant FLASH-LOAN-FEE-BPS u9)

;; ============================================
;; VAULT OPERATIONS
;; ============================================

(define-public (add-to-balance
    (token principal)
    (amount uint))
  (let ((current-balance (default-to u0 (map-get? vault-balances token))))
    (map-set vault-balances token (+ current-balance amount))
    (ok { token: token, amount: amount, new-balance: (+ current-balance amount) })
  )
)

(define-public (remove-from-balance
    (token principal)
    (amount uint))
  (let ((current-balance (unwrap! (map-get? vault-balances token) ERR-INSUFFICIENT-BALANCE)))
    (asserts! (>= current-balance amount) ERR-INSUFFICIENT-BALANCE)
    (map-set vault-balances token (- current-balance amount))
    (ok { token: token, amount: amount, new-balance: (- current-balance amount) })
  )
)

;; ============================================
;; FLASH LOANS (SIMPLIFIED)
;; ============================================

(define-read-only (flash-loan
    (loan-user principal)
    (token principal)
    (amount uint)
    (data (buff 1024)))
  (let ((fee (/ (* amount FLASH-LOAN-FEE-BPS) u10000)))
    ;; Simular flash loan - em producao, isso executaria o callback
    (ok { loan-amount: amount, fee-amount: fee })
  )
)

;; ============================================
;; QUERIES
;; ============================================

(define-read-only (get-balance
    (token principal))
  (ok (default-to u0 (map-get? vault-balances token)))
)

(define-read-only (get-vault-by-id
    (vault-id uint))
  (ok { id: vault-id, owner: tx-sender, tokens: (list) })
)
