;; withdraw-helper.clar v3

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant BLOCKS-PER-DAY u144)
(define-constant MAX-TX-PER-BLOCK u5)
(define-constant MIN-WITHDRAW-AMOUNT u1000)

;; Domain tags
(define-constant DOMAIN-WITHDRAW u10)
(define-constant DOMAIN-PAUSE u20)
(define-constant DOMAIN-UNPAUSE u21)
(define-constant DOMAIN-SET-FEE u30)

;; Revenue settings
(define-constant MAX-FEE-BPS u500)
(define-constant ZERO-PUBKEY33 0x000000000000000000000000000000000000000000000000000000000000000000)
(define-constant ZERO-HASH32 0x0000000000000000000000000000000000000000000000000000000000000000)

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-SIGNATURE (err u402))
(define-constant ERR-EXPIRED (err u404))
(define-constant ERR-PAUSED (err u405))
(define-constant ERR-ZERO-AMOUNT (err u411))
(define-constant ERR-AMOUNT-TOO-SMALL (err u416))
(define-constant ERR-RATE-LIMIT (err u417))
(define-constant ERR-WALLET-REVOKED (err u418))
(define-constant ERR-DAILY-LIMIT (err u419))
(define-constant ERR-LIMIT-EXCEEDED (err u420))
(define-constant ERR-INVALID-PUBKEY (err u421))
(define-constant ERR-ALREADY-INITIALIZED (err u422))
(define-constant ERR-WALLET-NOT-FOUND (err u423))
(define-constant ERR-INVALID-RECIPIENT (err u424))
(define-constant ERR-INVALID-LIMITS (err u425))
(define-constant ERR-NOT-REVOKED (err u426))
(define-constant ERR-AUTH-EXISTS (err u427))
(define-constant ERR-INVALID-FEE (err u428))

;; Storage
(define-data-var bot-pubkey (buff 33) ZERO-PUBKEY33)
(define-data-var paused bool false)
(define-data-var admin-nonce uint u0)

;; Revenue
(define-data-var fee-bps uint u0)
(define-data-var treasury principal CONTRACT-OWNER)

(define-map wallets principal { telegram-hash: (buff 32), current-nonce: uint })
(define-map spending-limits principal { max-per-tx: uint, daily-limit: uint, spent-today: uint, last-reset-block: uint })
(define-map rate-limits principal { count: uint, block: uint })
(define-map revoked-wallets principal bool)

;; Pending auth uses a composite key: sha256(wallet-bytes ++ nonce-16bytes)
(define-map pending-auth (buff 32) { wallet: principal, recipient: principal, amount: uint, expiry-block: uint })

;; Serialization Helpers
(define-private (uint-to-16bytes (n uint))
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? n)) u1 u17))
)

(define-private (auth-key (wallet principal) (nonce uint))
  (sha256 (concat
    (unwrap-panic (to-consensus-buff? wallet))
    (uint-to-16bytes nonce)))
)

;; Payload Constructors
(define-private (withdraw-payload (tg-hash (buff 32)) (wallet-hash (buff 32)) (nonce uint) (amount uint) (expiry uint) (recip-hash (buff 32)))
  (concat
    (concat
      (concat
        (concat
          (concat
            (concat tg-hash (uint-to-16bytes DOMAIN-WITHDRAW))
            wallet-hash)
          (uint-to-16bytes nonce))
        (uint-to-16bytes amount))
      (uint-to-16bytes expiry))
    recip-hash)
)

(define-private (pause-payload (tg-hash (buff 32)) (nonce uint) (expiry uint))
  (concat
    (concat
      (concat tg-hash (uint-to-16bytes DOMAIN-PAUSE))
      (uint-to-16bytes nonce))
    (uint-to-16bytes expiry))
)

(define-private (unpause-payload (tg-hash (buff 32)) (nonce uint) (expiry uint))
  (concat
    (concat
      (concat tg-hash (uint-to-16bytes DOMAIN-UNPAUSE))
      (uint-to-16bytes nonce))
    (uint-to-16bytes expiry))
)

(define-private (set-fee-payload (tg-hash (buff 32)) (nonce uint) (new-fee uint) (expiry uint))
  (concat
    (concat
      (concat
        (concat tg-hash (uint-to-16bytes DOMAIN-SET-FEE))
        (uint-to-16bytes nonce))
      (uint-to-16bytes new-fee))
    (uint-to-16bytes expiry))
)

;; Signature Verification
(define-private (verify-sig (payload-hash (buff 32)) (sig (buff 65)))
  (match (secp256k1-recover? payload-hash sig)
    recovered (is-eq recovered (var-get bot-pubkey))
    recover-err false
  )
)

;; Daily Limit Helpers
(define-private (refresh-daily-limit (wallet principal))
  (let (
    (limits (unwrap! (map-get? spending-limits wallet) ERR-WALLET-NOT-FOUND))
    (elapsed (- stacks-block-height (get last-reset-block limits)))
  )
    (if (>= elapsed BLOCKS-PER-DAY)
      (begin
        (map-set spending-limits wallet
          (merge limits { spent-today: u0, last-reset-block: stacks-block-height }))
        (ok u0))
      (ok (get spent-today limits)))
  )
)

(define-private (check-spending-caps (wallet principal) (amount uint) (current-spent uint))
  (let (
    (limits (unwrap! (map-get? spending-limits wallet) ERR-WALLET-NOT-FOUND))
    (new-spent (+ current-spent amount))
  )
    (asserts! (<= amount (get max-per-tx limits)) ERR-LIMIT-EXCEEDED)
    (asserts! (<= new-spent (get daily-limit limits)) ERR-DAILY-LIMIT)
    (ok true)
  )
)

(define-private (debit-spending (wallet principal) (amount uint))
  (let ((limits (unwrap! (map-get? spending-limits wallet) ERR-WALLET-NOT-FOUND)))
    (map-set spending-limits wallet
      (merge limits { spent-today: (+ (get spent-today limits) amount) }))
    (ok true)
  )
)

;; Rate Limit
(define-private (check-and-increment-rate-limit (wallet principal))
  (let (
    (data (default-to { count: u0, block: u0 } (map-get? rate-limits wallet)))
    (same-block (is-eq (get block data) stacks-block-height))
    (cur-count (if same-block (get count data) u0))
  )
    (asserts! (< cur-count MAX-TX-PER-BLOCK) ERR-RATE-LIMIT)
    (map-set rate-limits wallet { count: (+ cur-count u1), block: stacks-block-height })
    (ok true)
  )
)

(define-private (is-valid-recipient? (recipient principal))
  (not (is-eq recipient (as-contract tx-sender)))
)

;; Contract Initialization
(define-public (initialize (bot-pk (buff 33)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (var-get bot-pubkey) ZERO-PUBKEY33) ERR-ALREADY-INITIALIZED)
    (asserts! (not (is-eq bot-pk ZERO-PUBKEY33)) ERR-INVALID-PUBKEY)
    (var-set bot-pubkey bot-pk)
    (print { event: "initialized", block: stacks-block-height })
    (ok true)
  )
)

;; Revenue: Set Fee
(define-public (set-fee (new-fee-bps uint) (new-treasury principal) (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let ((payload-hash (sha256 (set-fee-payload ZERO-HASH32 nonce new-fee-bps expiry-block))))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get admin-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (<= new-fee-bps MAX-FEE-BPS) ERR-INVALID-FEE)
    (asserts! (not (is-eq new-treasury (as-contract tx-sender))) ERR-INVALID-RECIPIENT)
    (var-set fee-bps new-fee-bps)
    (var-set treasury new-treasury)
    (var-set admin-nonce (+ (var-get admin-nonce) u1))
    (print { event: "fee-updated", fee-bps: new-fee-bps, treasury: new-treasury, block: stacks-block-height })
    (ok true)
  )
)

;; Wallet Management
(define-public (register-wallet (wallet principal) (telegram-hash (buff 32)) (max-per-tx uint) (daily-limit uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? wallets wallet)) ERR-ALREADY-INITIALIZED)
    (asserts! (> max-per-tx u0) ERR-INVALID-LIMITS)
    (asserts! (> daily-limit u0) ERR-INVALID-LIMITS)
    (asserts! (<= max-per-tx daily-limit) ERR-INVALID-LIMITS)
    (asserts! (not (is-eq telegram-hash ZERO-HASH32)) ERR-INVALID-PUBKEY)
    (map-set wallets wallet
      { telegram-hash: telegram-hash, current-nonce: u0 })
    (map-set spending-limits wallet
      { max-per-tx: max-per-tx, daily-limit: daily-limit,
        spent-today: u0, last-reset-block: stacks-block-height })
    (print { event: "wallet-registered", wallet: wallet,
             max-per-tx: max-per-tx, daily-limit: daily-limit,
             block: stacks-block-height })
    (ok true)
  )
)

(define-public (update-wallet-limits (wallet principal) (new-max-per-tx uint) (new-daily-limit uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-some (map-get? wallets wallet)) ERR-WALLET-NOT-FOUND)
    (asserts! (> new-max-per-tx u0) ERR-INVALID-LIMITS)
    (asserts! (> new-daily-limit u0) ERR-INVALID-LIMITS)
    (asserts! (<= new-max-per-tx new-daily-limit) ERR-INVALID-LIMITS)
    (let ((limits (unwrap! (map-get? spending-limits wallet) ERR-WALLET-NOT-FOUND)))
      (map-set spending-limits wallet
        (merge limits { max-per-tx: new-max-per-tx, daily-limit: new-daily-limit }))
      (print { event: "wallet-limits-updated", wallet: wallet,
               max-per-tx: new-max-per-tx, daily-limit: new-daily-limit,
               block: stacks-block-height })
      (ok true)
    )
  )
)

(define-public (revoke-wallet (wallet principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-some (map-get? wallets wallet)) ERR-WALLET-NOT-FOUND)
    (map-set revoked-wallets wallet true)
    (print { event: "wallet-revoked", wallet: wallet, block: stacks-block-height })
    (ok true)
  )
)

(define-public (unrevoke-wallet (wallet principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (default-to false (map-get? revoked-wallets wallet)) ERR-NOT-REVOKED)
    (map-set revoked-wallets wallet false)
    (print { event: "wallet-unrevoked", wallet: wallet, block: stacks-block-height })
    (ok true)
  )
)

;; Emergency Controls
(define-public (emergency-pause (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let ((payload-hash (sha256 (pause-payload ZERO-HASH32 nonce expiry-block))))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get admin-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (var-set paused true)
    (var-set admin-nonce (+ (var-get admin-nonce) u1))
    (print { event: "emergency-pause-activated", nonce: nonce, block: stacks-block-height })
    (ok true)
  )
)

(define-public (emergency-unpause (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let ((payload-hash (sha256 (unpause-payload ZERO-HASH32 nonce expiry-block))))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (var-get paused) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get admin-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (var-set paused false)
    (var-set admin-nonce (+ (var-get admin-nonce) u1))
    (print { event: "emergency-unpause-activated", nonce: nonce, block: stacks-block-height })
    (ok true)
  )
)

;; Authorization logic
(define-public (authorize-withdrawal (wallet principal) (nonce uint) (amount uint) (recipient principal) (expiry-block uint) (tg-proof (buff 32)) (bot-sig (buff 65)))
  (let (
    (wallet-data (unwrap! (map-get? wallets wallet) ERR-WALLET-NOT-FOUND))
    (wallet-hash (sha256 (unwrap-panic (to-consensus-buff? wallet))))
    (recip-hash (sha256 (unwrap-panic (to-consensus-buff? recipient))))
    (payload-hash (sha256 (withdraw-payload
                      (get telegram-hash wallet-data)
                      wallet-hash nonce amount expiry-block recip-hash)))
    (akey (auth-key wallet nonce))
  )
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (not (default-to false (map-get? revoked-wallets wallet))) ERR-WALLET-REVOKED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= amount MIN-WITHDRAW-AMOUNT) ERR-AMOUNT-TOO-SMALL)
    (asserts! (is-valid-recipient? recipient) ERR-INVALID-RECIPIENT)
    (asserts! (is-eq nonce (get current-nonce wallet-data)) ERR-EXPIRED)
    (asserts! (is-eq tg-proof (get telegram-hash wallet-data)) ERR-NOT-AUTHORIZED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (is-none (map-get? pending-auth akey)) ERR-AUTH-EXISTS)

    (let ((current-spent (try! (refresh-daily-limit wallet))))
      (try! (check-spending-caps wallet amount current-spent))
      (try! (check-and-increment-rate-limit wallet))

      (map-set pending-auth akey
        { wallet: wallet,
          recipient: recipient,
          amount: amount,
          expiry-block: expiry-block })

      (print { event: "withdrawal-authorized", wallet: wallet,
               recipient: recipient, amount: amount,
               nonce: nonce, auth-key: akey, block: stacks-block-height })

      (ok { recipient: recipient, amount: amount, auth-key: akey })
    )
  )
)

(define-public (consume-authorization (wallet principal) (recipient principal) (amount uint) (akey (buff 32)))
  (let ((auth (unwrap! (map-get? pending-auth akey) ERR-NOT-AUTHORIZED)))
    (asserts! (is-eq tx-sender wallet) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq wallet (get wallet auth)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq recipient (get recipient auth)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq amount (get amount auth)) ERR-NOT-AUTHORIZED)
    (asserts! (<= stacks-block-height (get expiry-block auth)) ERR-EXPIRED)

    ;; Advance nonce
    (let ((wallet-data (unwrap! (map-get? wallets wallet) ERR-WALLET-NOT-FOUND)))
      (map-set wallets wallet
        (merge wallet-data
          { current-nonce: (+ (get current-nonce wallet-data) u1) }))

      ;; Debit spending limit
      (try! (debit-spending wallet amount))

      ;; Clear pending auth
      (map-delete pending-auth akey)

      ;; Calculate fee split
      (let (
        (bps (var-get fee-bps))
        (fee-amount (if (> bps u0) (/ (* amount bps) u10000) u0))
        (net-amount (- amount fee-amount))
      )
        (print { event: "authorization-consumed", wallet: wallet,
                 recipient: recipient, amount: amount,
                 fee-amount: fee-amount, net-amount: net-amount,
                 auth-key: akey, block: stacks-block-height })
        (ok { net-amount: net-amount,
              fee-amount: fee-amount,
              treasury: (var-get treasury) })
      )
    )
  )
)

;; Read-only queries
(define-read-only (get-wallet-nonce (wallet principal))
  (default-to u0 (get current-nonce (map-get? wallets wallet)))
)

(define-read-only (get-wallet-telegram-hash (wallet principal))
  (get telegram-hash (map-get? wallets wallet))
)

(define-read-only (get-wallet-limits (wallet principal))
  (map-get? spending-limits wallet)
)

(define-read-only (get-remaining-daily-limit (wallet principal))
  (let (
    (limits (unwrap! (map-get? spending-limits wallet) none))
    (elapsed (- stacks-block-height (get last-reset-block limits)))
    (spent (if (>= elapsed BLOCKS-PER-DAY) u0 (get spent-today limits)))
    (lim (get daily-limit limits))
  )
    (some (if (>= spent lim) u0 (- lim spent)))
  )
)

(define-read-only (get-pending-auth (akey (buff 32)))
  (map-get? pending-auth akey)
)

(define-read-only (is-wallet-revoked (wallet principal))
  (default-to false (map-get? revoked-wallets wallet))
)

(define-read-only (is-contract-paused) (var-get paused))

(define-read-only (get-admin-nonce) (var-get admin-nonce))

(define-read-only (get-bot-public-key) (var-get bot-pubkey))

(define-read-only (get-fee-config)
  { fee-bps: (var-get fee-bps), treasury: (var-get treasury) }
)

(define-read-only (compute-fee (amount uint))
  (let (
    (bps (var-get fee-bps))
    (fee (if (> bps u0) (/ (* amount bps) u10000) u0))
  )
    { fee: fee, net-amount: (- amount fee), fee-bps: bps }
  )
)