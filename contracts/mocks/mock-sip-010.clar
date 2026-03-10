;; mock-sip-010.clar
;; Mock de token SIP-010 para testes

(define-fungible-token mock-token)

(define-constant TOKEN-NAME "Mock Token")
(define-constant TOKEN-SYMBOL "MOCK")
(define-constant TOKEN-DECIMALS u6)
(define-data-var token-uri (optional (string-utf8 256)) none)

;; ============================================
;; SIP-010 IMPLEMENTATION
;; ============================================

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq sender tx-sender) (err u1))
    (try! (ft-transfer? mock-token amount sender recipient))
    (if (is-some memo)
      (begin
        (print (unwrap-panic memo))
        (ok true))
      (ok true))
  )
)

(define-read-only (get-name)
  (ok TOKEN-NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-token account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-token))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

(define-public (mint (amount uint) (recipient principal))
  (begin
    (try! (ft-mint? mock-token amount recipient))
    (ok true)
  )
)

(define-public (burn (amount uint) (owner principal))
  (begin
    (try! (ft-burn? mock-token amount owner))
    (ok true)
  )
)

(define-public (set-token-uri (uri (optional (string-utf8 256))))
  (begin
    (var-set token-uri uri)
    (ok true)
  )
)
