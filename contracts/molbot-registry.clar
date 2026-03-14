;; Molbot Registry Contract
;; Registry for AI agent molbots that can be hired for services
;; Part of the x402 molbot payment system

(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-ALREADY-REGISTERED (err u409))

(define-map molbots
  principal
  {
    name: (string-ascii 64),
    description: (string-ascii 256),
    capability: (string-ascii 32),
    price-per-call: uint,
    payment-token: (string-ascii 8),
    active: bool,
    owner: principal,
    registered-at: uint
  }
)

(define-data-var total-molbots uint u0)

(define-public (register-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capability (string-ascii 32))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (begin
    (asserts! (is-none (map-get? molbots tx-sender)) ERR-ALREADY-REGISTERED)
    (map-set molbots tx-sender {
      name: name,
      description: description,
      capability: capability,
      price-per-call: price-per-call,
      payment-token: payment-token,
      active: true,
      owner: tx-sender,
      registered-at: stacks-block-height
    })
    (var-set total-molbots (+ (var-get total-molbots) u1))
    (ok true)
  )
)

(define-public (update-molbot
    (name (string-ascii 64))
    (description (string-ascii 256))
    (capability (string-ascii 32))
    (price-per-call uint)
    (payment-token (string-ascii 8))
  )
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry {
      name: name,
      description: description,
      capability: capability,
      price-per-call: price-per-call,
      payment-token: payment-token
    }))
    (ok true))
)

(define-public (set-active (active bool))
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry { active: active }))
    (ok true))
)

(define-public (deactivate)
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry { active: false }))
    (ok true))
)

(define-public (reactivate)
  (let ((entry (unwrap! (map-get? molbots tx-sender) ERR-NOT-FOUND)))
    (asserts! (is-eq (get owner entry) tx-sender) ERR-NOT-AUTHORIZED)
    (map-set molbots tx-sender (merge entry { active: true }))
    (ok true))
)

(define-read-only (get-molbot (address principal))
  (map-get? molbots address)
)

(define-read-only (get-molbot-price (address principal))
  (match (map-get? molbots address)
    molbot (ok (get price-per-call molbot))
    (err ERR-NOT-FOUND)
  )
)

(define-read-only (is-registered (address principal))
  (ok (is-some (map-get? molbots address)))
)

(define-read-only (is-active (address principal))
  (match (map-get? molbots address)
    molbot (ok (get active molbot))
    (ok false)
  )
)

(define-read-only (get-total-molbots)
  (ok (var-get total-molbots))
)
