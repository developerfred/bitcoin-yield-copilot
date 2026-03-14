;; ERC-8004 Identity Contract
;; Standard for on-chain identity of AI agents on Stacks
;; Allows the Bitcoin Yield Copilot to have a verifiable on-chain identity

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-ALREADY-REGISTERED (err u409))

;; Identity data structure
(define-map identities
  principal
  {
    domain: (string-ascii 64),
    nonce: uint,
    active: bool,
    registered-at: uint
  }
)

;; Store capabilities for each identity
(define-map identity-capabilities
  principal
  (list 10 (string-ascii 32))
)

;; Track total identities
(define-data-var total-identities uint u0)

;; ============================================================================
;; Public Functions
;; ============================================================================

(define-public (register-identity
    (domain (string-ascii 64))
    (capabilities (list 10 (string-ascii 32)))
  )
  (begin
    (asserts! (is-none (map-get? identities tx-sender)) ERR-ALREADY-REGISTERED)
    
    (map-set identities tx-sender {
      domain: domain,
      nonce: u0,
      active: true,
      registered-at: stacks-block-height
    })
    
    (map-set identity-capabilities tx-sender capabilities)
    
    (var-set total-identities (+ (var-get total-identities) u1))
    
    (ok true)
  )
)

(define-public (update-identity
    (domain (string-ascii 64))
    (capabilities (list 10 (string-ascii 32)))
  )
  (let ((entry (unwrap! (map-get? identities tx-sender) ERR-NOT-FOUND)))
    (map-set identities tx-sender (merge entry { domain: domain }))
    (map-set identity-capabilities tx-sender capabilities)
    (ok true))
)

(define-public (set-active (active bool))
  (let ((entry (unwrap! (map-get? identities tx-sender) ERR-NOT-FOUND)))
    (map-set identities tx-sender (merge entry { active: active }))
    (ok true))
)

(define-public (sign-action
    (action (string-ascii 64))
    (payload (buff 32))
  )
  (let (
    (identity (unwrap! (map-get? identities tx-sender) ERR-NOT-FOUND))
    (action-hash (sha256 (concat payload (unwrap-panic (to-consensus-buff? (get nonce identity))))))
  )
    (map-set identities tx-sender (merge identity { nonce: (+ (get nonce identity) u1) }))
    (ok { action-hash: action-hash, nonce: (+ (get nonce identity) u1) })
  )
)

;; ============================================================================
;; Read-Only Functions
;; ============================================================================

(define-read-only (get-identity (owner principal))
  (map-get? identities owner)
)

(define-read-only (get-capabilities (owner principal))
  (map-get? identity-capabilities owner)
)

(define-read-only (is-active (owner principal))
  (match (map-get? identities owner)
    identity (ok (get active identity))
    (ok false)
  )
)

(define-read-only (is-registered (owner principal))
  (ok (is-some (map-get? identities owner)))
)

(define-read-only (get-total-identities)
  (ok (var-get total-identities))
)
