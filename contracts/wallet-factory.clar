;; wallet-factory.clar

;; Constants
(define-constant CONTRACT-OWNER tx-sender)

;; Domain tags
(define-constant DOMAIN-REGISTER u40)
(define-constant DOMAIN-DEACTIVATE u41)
(define-constant DOMAIN-REACTIVATE u42)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-SIG (err u402))
(define-constant ERR-ALREADY-EXISTS (err u409))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-NOT-CONFIGURED (err u412))

;; Storage
(define-map user-wallets
  (buff 32)
  { wallet-contract: principal, created-at-block: uint, active: bool }
)

(define-map wallet-owners principal (buff 32))

(define-data-var total-wallets uint u0)
(define-data-var bot-pubkey (buff 33) 0x000000000000000000000000000000000000000000000000000000000000000000)
(define-data-var configured bool false)
(define-data-var factory-nonce uint u0)

;; Serialization helpers
(define-private (uint-to-16bytes (n uint))
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? n)) u1 u17))
)

;; Payload constructors
(define-private (register-payload (tg-hash (buff 32)) (contract-hash (buff 32)) (nonce uint))
  (concat
    (concat
      (concat tg-hash (uint-to-16bytes DOMAIN-REGISTER))
      contract-hash)
    (uint-to-16bytes nonce))
)

(define-private (deactivate-payload (tg-hash (buff 32)) (nonce uint) (expiry uint))
  (concat
    (concat
      (concat tg-hash (uint-to-16bytes DOMAIN-DEACTIVATE))
      (uint-to-16bytes nonce))
    (uint-to-16bytes expiry))
)

(define-private (reactivate-payload (tg-hash (buff 32)) (nonce uint) (expiry uint))
  (concat
    (concat
      (concat tg-hash (uint-to-16bytes DOMAIN-REACTIVATE))
      (uint-to-16bytes nonce))
    (uint-to-16bytes expiry))
)

;; Signature verification
(define-private (verify-sig (payload-hash (buff 32)) (sig (buff 65)))
  (match (secp256k1-recover? payload-hash sig)
    recovered-value (is-eq recovered-value (var-get bot-pubkey))
    err-value false
  )
)

;; Configuration
(define-public (configure (pubkey (buff 33)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get configured)) ERR-NOT-AUTHORIZED)
    (var-set bot-pubkey pubkey)
    (var-set configured true)
    (ok true)
  )
)

;; Wallet registration
(define-public (register-wallet (tg-hash (buff 32)) (wallet-contract principal) (nonce uint) (bot-sig (buff 65)))
  (let (
    (contract-hash (sha256 (unwrap-panic (to-consensus-buff? wallet-contract))))
    (payload-hash (sha256 (register-payload tg-hash contract-hash nonce)))
  )
    (asserts! (var-get configured) ERR-NOT-CONFIGURED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIG)
    (asserts! (is-eq nonce (var-get factory-nonce)) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? user-wallets tg-hash)) ERR-ALREADY-EXISTS)

    (map-set user-wallets tg-hash
      { wallet-contract: wallet-contract,
        created-at-block: stacks-block-height,
        active: true })
    (map-set wallet-owners wallet-contract tg-hash)
    (var-set total-wallets (+ (var-get total-wallets) u1))
    (var-set factory-nonce (+ (var-get factory-nonce) u1))
    (ok wallet-contract)
  )
)

;; Deactivate wallet
(define-public (deactivate-wallet (tg-hash (buff 32)) (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let (
    (payload-hash (sha256 (deactivate-payload tg-hash nonce expiry-block)))
    (wallet-entry (unwrap! (map-get? user-wallets tg-hash) ERR-NOT-FOUND))
  )
    (asserts! (var-get configured) ERR-NOT-CONFIGURED)
    (asserts! (is-eq nonce (var-get factory-nonce)) ERR-NOT-AUTHORIZED)
    (asserts! (<= stacks-block-height expiry-block) ERR-NOT-AUTHORIZED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIG)
    (map-set user-wallets tg-hash (merge wallet-entry { active: false }))
    (var-set factory-nonce (+ (var-get factory-nonce) u1))
    (ok true)
  )
)

;; Reactivate wallet
(define-public (reactivate-wallet (tg-hash (buff 32)) (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let (
    (payload-hash (sha256 (reactivate-payload tg-hash nonce expiry-block)))
    (wallet-entry (unwrap! (map-get? user-wallets tg-hash) ERR-NOT-FOUND))
  )
    (asserts! (var-get configured) ERR-NOT-CONFIGURED)
    (asserts! (is-eq nonce (var-get factory-nonce)) ERR-NOT-AUTHORIZED)
    (asserts! (<= stacks-block-height expiry-block) ERR-NOT-AUTHORIZED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIG)
    (map-set user-wallets tg-hash (merge wallet-entry { active: true }))
    (var-set factory-nonce (+ (var-get factory-nonce) u1))
    (ok true)
  )
)

;; Read-only queries
(define-read-only (get-wallet (tg-hash (buff 32)))
  (map-get? user-wallets tg-hash)
)

(define-read-only (get-wallet-owner (wallet-contract principal))
  (map-get? wallet-owners wallet-contract)
)

(define-read-only (is-registered-wallet (wallet-contract principal))
  (is-some (map-get? wallet-owners wallet-contract))
)

(define-read-only (is-active-wallet (wallet-contract principal))
  (match (map-get? wallet-owners wallet-contract)
    tg-hash
      (match (map-get? user-wallets tg-hash)
        entry (get active entry)
        false)
    false)
)

(define-read-only (get-total-wallets) (var-get total-wallets))
(define-read-only (get-factory-nonce) (var-get factory-nonce))
(define-read-only (get-bot-pubkey) (var-get bot-pubkey))