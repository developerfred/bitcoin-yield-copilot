;; Molbot Payment Contract
;; Handles payments between molbots using x402 protocol

(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-MOLBOT-INACTIVE (err u402))
(define-constant ERR-INVALID-TOKEN (err u400))

(define-map payments
  { sender: principal, nonce: uint }
  {
    recipient: principal,
    amount: uint,
    token: (string-ascii 8),
    service-data: (buff 256),
    completed: bool
  }
)

(define-map user-payment-counts principal uint)
(define-map molbot-balances principal uint)
(define-data-var payment-nonce uint u0)

(define-public (pay-molbot
    (molbot principal)
    (amount uint)
    (token (string-ascii 8))
    (service-data (buff 256))
  )
  (let (
    (molbot-info (contract-call? .molbot-registry get-molbot molbot))
    (current-nonce (var-get payment-nonce))
    (bot (unwrap! molbot-info ERR-NOT-FOUND))
  )
    (asserts! (get active bot) ERR-MOLBOT-INACTIVE)
    (asserts! (is-eq token "STX") ERR-INVALID-TOKEN)
    (try! (stx-transfer? amount tx-sender molbot))
    (map-set payments { sender: tx-sender, nonce: current-nonce } {
      recipient: molbot,
      amount: amount,
      token: token,
      service-data: service-data,
      completed: true
    })
    (map-set user-payment-counts tx-sender 
      (+ (default-to u0 (map-get? user-payment-counts tx-sender)) u1))
    (map-set molbot-balances molbot
      (+ (default-to u0 (map-get? molbot-balances molbot)) amount))
    (var-set payment-nonce (+ current-nonce u1))
    (ok { payment-id: current-nonce, amount: amount })
  )
)

(define-read-only (get-payment (sender principal) (nonce uint))
  (ok (map-get? payments { sender: sender, nonce: nonce }))
)

(define-read-only (get-user-payment-count (user principal))
  (ok (default-to u0 (map-get? user-payment-counts user)))
)

(define-read-only (get-molbot-balance (molbot principal))
  (ok (default-to u0 (map-get? molbot-balances molbot)))
)

(define-read-only (get-total-payments)
  (ok (var-get payment-nonce))
)
