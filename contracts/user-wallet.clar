;; user-wallet.clar - Simplified for Testnet

(use-trait adapter-trait    .adapter-trait.adapter-trait)
(use-trait adapter-trait-v2 .adapter-trait-v2.adapter-trait-v2)

(define-trait ft-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED      (err u401))
(define-constant ERR-INVALID-SIGNATURE   (err u402))
(define-constant ERR-LIMIT-EXCEEDED      (err u403))
(define-constant ERR-EXPIRED             (err u404))
(define-constant ERR-PAUSED              (err u405))
(define-constant ERR-UNKNOWN-PROTOCOL    (err u406))
(define-constant ERR-DAILY-LIMIT         (err u407))
(define-constant ERR-NOT-INITIALIZED     (err u408))
(define-constant ERR-ALREADY-INITIALIZED (err u409))
(define-constant ERR-INVALID-LIMITS      (err u410))
(define-constant ERR-ZERO-AMOUNT         (err u411))
(define-constant ERR-PROTOCOL-EXISTS     (err u412))
(define-constant ERR-ALLOCATION-EXCEEDED (err u413))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))

(define-constant BLOCKS-PER-DAY     u144)
(define-constant MAX-HISTORY        u100)
(define-constant DOMAIN-PAUSE       u20)
(define-constant DOMAIN-UNPAUSE     u21)
(define-constant DOMAIN-OP-EXECUTE  u40)
(define-constant DOMAIN-ADD-PROTOCOL u50)
(define-constant DOMAIN-UPD-PROTOCOL u51)
(define-constant DOMAIN-UPD-LIMITS  u60)
(define-constant ZERO-HASH32   0x0000000000000000000000000000000000000000000000000000000000000000)
(define-constant ZERO-PUBKEY33 0x000000000000000000000000000000000000000000000000000000000000000000)

(define-data-var initialized        bool    false)
(define-data-var telegram-hash      (buff 32) ZERO-HASH32)
(define-data-var bot-pubkey         (buff 33) ZERO-PUBKEY33)
(define-data-var is-paused          bool    false)
(define-data-var current-nonce      uint    u0)
(define-data-var max-per-tx         uint    u0)
(define-data-var daily-limit-amount uint    u0)
(define-data-var spent-today        uint    u0)
(define-data-var last-reset-block   uint    u0)
(define-data-var operation-count    uint    u0)

(define-map allowed-protocols principal
  { name: (string-ascii 32), max-allocation: uint, current-allocation: uint, enabled: bool })

(define-map operation-history uint
  { nonce: uint, protocol: principal, action: (string-ascii 16),
    amount: uint, block: uint, canonical-hash: (buff 32) })

;; ============================================
;; PRIVATE HELPERS
;; ============================================

(define-private (uint-to-16bytes (n uint))
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? n)) u1 u17)))

(define-private (verify-sig (payload-hash (buff 32)) (sig (buff 65)))
  (match (secp256k1-recover? payload-hash sig)
    recovered (is-eq recovered (var-get bot-pubkey))
    err-val false))

(define-private (refresh-daily-limit)
  (if (>= (- stacks-block-height (var-get last-reset-block)) BLOCKS-PER-DAY)
    (begin (var-set spent-today u0) (var-set last-reset-block stacks-block-height) u0)
    (var-get spent-today)))

;; ============================================
;; PAYLOAD CONSTRUCTORS
;; ============================================

(define-private (op-payload (nonce uint) (protocol principal) (action (string-ascii 16)) (amount uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-OP-EXECUTE)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (sha256 (unwrap-panic (to-consensus-buff? action)))
          (concat (uint-to-16bytes nonce)
            (concat (uint-to-16bytes amount) (uint-to-16bytes expiry))))))))

(define-private (pause-payload (nonce uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-PAUSE)
      (concat (uint-to-16bytes nonce) (uint-to-16bytes expiry)))))

(define-private (unpause-payload (nonce uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-UNPAUSE)
      (concat (uint-to-16bytes nonce) (uint-to-16bytes expiry)))))

(define-private (limits-payload (nonce uint) (new-max uint) (new-daily uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-UPD-LIMITS)
      (concat (uint-to-16bytes nonce)
        (concat (uint-to-16bytes new-max)
          (concat (uint-to-16bytes new-daily) (uint-to-16bytes expiry)))))))

(define-private (add-proto-payload (nonce uint) (protocol principal) (max-alloc uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-ADD-PROTOCOL)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (uint-to-16bytes nonce)
          (concat (uint-to-16bytes max-alloc) (uint-to-16bytes expiry)))))))

(define-private (update-proto-payload (nonce uint) (protocol principal) (max-alloc uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-UPD-PROTOCOL)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (uint-to-16bytes nonce)
          (concat (uint-to-16bytes max-alloc) (uint-to-16bytes expiry)))))))

;; ============================================
;; SHARED VALIDATION & STATE UPDATE
;; Used by both execute-authorized-operation and execute-via-proxy
;; ============================================

(define-private (validate-and-update-state
    (nonce uint)
    (protocol principal)
    (action (string-ascii 16))
    (amount uint)
    (expiry-block uint)
    (bot-sig (buff 65)))
  (let ((payload-hash (sha256 (op-payload nonce protocol action amount expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)

    (let ((proto (unwrap! (map-get? allowed-protocols protocol) ERR-UNKNOWN-PROTOCOL)))
      (asserts! (get enabled proto) ERR-UNKNOWN-PROTOCOL)
      (asserts! (<= amount (var-get max-per-tx)) ERR-LIMIT-EXCEEDED)

      (let ((current-spent (refresh-daily-limit)))
        (asserts! (<= (+ current-spent amount) (var-get daily-limit-amount)) ERR-DAILY-LIMIT)

        (let (
          (cur-alloc (get current-allocation proto))
          (max-alloc (get max-allocation proto))
          (new-alloc (if (is-eq action "deposit")
                       (begin
                         (asserts! (<= (+ cur-alloc amount) max-alloc) ERR-ALLOCATION-EXCEEDED)
                         (+ cur-alloc amount))
                       (if (is-eq action "withdraw")
                         (if (>= cur-alloc amount) (- cur-alloc amount) u0)
                         cur-alloc)))
        )
          ;; Advance nonce and update spend tracker
          (var-set current-nonce (+ (var-get current-nonce) u1))
          (var-set spent-today (+ current-spent amount))

          ;; Update protocol allocation
          (map-set allowed-protocols protocol
            (merge proto { current-allocation: new-alloc }))

          ;; Record in history ring buffer
          (let ((slot (mod (var-get operation-count) MAX-HISTORY)))
            (map-set operation-history slot
              { nonce: nonce, protocol: protocol, action: action,
                amount: amount, block: stacks-block-height,
                canonical-hash: payload-hash })
            (var-set operation-count (+ (var-get operation-count) u1))
            (ok { new-alloc: new-alloc, amount: amount })
          )
        )
      )
    )
  )
)

;; ============================================
;; INITIALIZE
;; ============================================

(define-public (initialize
    (tg-hash (buff 32))
    (bot-pk (buff 33))
    (max-per-tx-v uint)
    (day-limit uint))
  (begin
    (asserts! (not (var-get initialized)) ERR-ALREADY-INITIALIZED)
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (is-eq tg-hash ZERO-HASH32)) ERR-NOT-AUTHORIZED)
    (asserts! (not (is-eq bot-pk ZERO-PUBKEY33)) ERR-NOT-AUTHORIZED)
    (asserts! (> max-per-tx-v u0) ERR-INVALID-LIMITS)
    (asserts! (> day-limit u0) ERR-INVALID-LIMITS)
    (asserts! (<= max-per-tx-v day-limit) ERR-INVALID-LIMITS)
    (var-set initialized true)
    (var-set telegram-hash tg-hash)
    (var-set bot-pubkey bot-pk)
    (var-set max-per-tx max-per-tx-v)
    (var-set daily-limit-amount day-limit)
    (var-set last-reset-block stacks-block-height)
    (ok true)))

;; ============================================
;; EXECUTE - direct adapter (legacy, v1 adapters)
;; ============================================

(define-public (execute-authorized-operation
    (nonce uint)
    (protocol principal)
    (action (string-ascii 16))
    (amount uint)
    (expiry-block uint)
    (bot-sig (buff 65))
    (protocol-contract <adapter-trait>))
  (let ((state (try! (validate-and-update-state nonce protocol action amount expiry-block bot-sig))))
    (try! (as-contract (contract-call? protocol-contract execute amount action)))
    (ok { amount: (get amount state), allocated: (get new-alloc state) })
  )
)

;; ============================================
;; EXECUTE - via proxy (upgradeable adapters)
;;
;; Use this for any adapter registered in proxy-registry.
;; Pass the proxy as <adapter-trait> and the current impl separately.
;; The proxy validates impl against the registry before delegating.
;;
;; Because Clarity does not support interdependent traits, the proxy
;; exposes execute-via with a typed <adapter-trait> argument.
;; user-wallet passes both contracts; the proxy does the registry check.
;;
;; Example:
;;   (contract-call? .user-wallet execute-via-proxy
;;     nonce 'SP...proxy-adapter "deposit" amount expiry sig
;;     .proxy-adapter .adapter-alex-v1)
;; ============================================

(define-public (execute-via-proxy
    (nonce uint)
    (protocol principal)
    (action (string-ascii 16))
    (amount uint)
    (expiry-block uint)
    (bot-sig (buff 65))
    (proxy <adapter-trait-v2>)
    (impl  <adapter-trait>))
  (let ((state (try! (validate-and-update-state nonce protocol action amount expiry-block bot-sig))))
    (try! (as-contract (contract-call? proxy execute-via impl amount action)))
    (ok { amount: (get amount state), allocated: (get new-alloc state) })
  )
)

;; ============================================
;; WITHDRAW STX
;; ============================================

(define-public (withdraw-stx
    (amount uint)
    (recipient principal)
    (expiry-block uint)
    (auth-key (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts!
      (is-some (contract-call? .withdraw-helper get-pending-auth auth-key))
      ERR-NOT-AUTHORIZED)
    (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERR-INSUFFICIENT-BALANCE)

    (let ((result (try! (as-contract
                    (contract-call? .withdraw-helper
                      consume-authorization
                      tx-sender recipient amount auth-key)))))
      (let (
        (net-amount (get net-amount result))
        (fee-amount (get fee-amount result))
        (treasury   (get treasury result))
      )
        (try! (as-contract (stx-transfer? net-amount tx-sender recipient)))
        (if (> fee-amount u0)
          (try! (as-contract (stx-transfer? fee-amount tx-sender treasury)))
          true)
        (ok { net-amount: net-amount, fee-amount: fee-amount })
      )
    )
  )
)

;; ============================================
;; WITHDRAW TOKEN
;; ============================================

(define-public (withdraw-token
    (token <ft-trait>)
    (amount uint)
    (recipient principal)
    (expiry-block uint)
    (auth-key (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts!
      (is-some (contract-call? .withdraw-helper get-pending-auth auth-key))
      ERR-NOT-AUTHORIZED)

    (let ((result (try! (as-contract
                    (contract-call? .withdraw-helper
                      consume-authorization
                      tx-sender recipient amount auth-key)))))
      (let (
        (net-amount (get net-amount result))
        (fee-amount (get fee-amount result))
        (treasury   (get treasury result))
      )
        (try! (as-contract (contract-call? token transfer net-amount tx-sender recipient none)))
        (if (> fee-amount u0)
          (try! (as-contract (contract-call? token transfer fee-amount tx-sender treasury none)))
          true)
        (ok { net-amount: net-amount, fee-amount: fee-amount })
      )
    )
  )
)

;; ============================================
;; ADMIN OPERATIONS
;; ============================================

(define-public (emergency-pause
    (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (pause-payload nonce expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (var-set is-paused true)
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (unpause
    (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let ((payload-hash (sha256 (unpause-payload nonce expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (var-get is-paused) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (var-set is-paused false)
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (update-limits
    (new-max-per-tx uint) (new-daily uint)
    (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (limits-payload nonce new-max-per-tx new-daily expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (> new-max-per-tx u0) ERR-INVALID-LIMITS)
    (asserts! (> new-daily u0) ERR-INVALID-LIMITS)
    (asserts! (<= new-max-per-tx new-daily) ERR-INVALID-LIMITS)
    (var-set max-per-tx new-max-per-tx)
    (var-set daily-limit-amount new-daily)
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (add-protocol
    (protocol principal) (name (string-ascii 32)) (max-alloc uint)
    (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (add-proto-payload nonce protocol max-alloc expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (> max-alloc u0) ERR-INVALID-LIMITS)
    (asserts! (is-none (map-get? allowed-protocols protocol)) ERR-PROTOCOL-EXISTS)
    (map-set allowed-protocols protocol
      { name: name, max-allocation: max-alloc, current-allocation: u0, enabled: true })
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (update-protocol
    (protocol principal) (new-max-alloc uint) (enabled bool)
    (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (update-proto-payload nonce protocol new-max-alloc expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (> new-max-alloc u0) ERR-INVALID-LIMITS)
    (let ((proto (unwrap! (map-get? allowed-protocols protocol) ERR-UNKNOWN-PROTOCOL)))
      (map-set allowed-protocols protocol
        (merge proto { max-allocation: new-max-alloc, enabled: enabled }))
      (var-set current-nonce (+ (var-get current-nonce) u1))
      (ok true))))

;; ============================================
;; EMERGENCY RECOVERY
;; ============================================

;; Recover funds from a direct adapter (legacy)
(define-public (emergency-withdraw-from-adapter
    (adapter <adapter-trait>)
    (amount uint)
    (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (as-contract (contract-call? adapter execute amount "withdraw"))
  )
)

;; Recover funds from a proxy-backed adapter
(define-public (emergency-withdraw-from-proxy
    (proxy <adapter-trait-v2>)
    (impl  <adapter-trait>)
    (amount uint)
    (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (as-contract (contract-call? proxy execute-via impl amount "withdraw"))
  )
)

(define-public (emergency-transfer
    (token <ft-trait>)
    (amount uint)
    (recipient principal)
    (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (as-contract (contract-call? token transfer amount tx-sender recipient none))
  )
)

(define-public (emergency-transfer-stx
    (amount uint)
    (recipient principal)
    (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERR-INSUFFICIENT-BALANCE)
    (as-contract (stx-transfer? amount tx-sender recipient))
  )
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-wallet-info)
  (let ((spent (var-get spent-today)) (lim (var-get daily-limit-amount)))
    { initialized:        (var-get initialized),
      is-paused:          (var-get is-paused),
      current-nonce:      (var-get current-nonce),
      max-per-transaction: (var-get max-per-tx),
      daily-limit:        lim,
      spent-today:        spent,
      remaining-today:    (if (>= spent lim) u0 (- lim spent)) }))

(define-read-only (get-protocol-config (protocol principal))
  (map-get? allowed-protocols protocol))

(define-read-only (get-operation (idx uint))
  (map-get? operation-history (mod idx MAX-HISTORY)))

(define-read-only (get-operation-count) (var-get operation-count))

(define-read-only (verify-identity (proof (buff 32)))
  (is-eq proof (var-get telegram-hash)))

(define-read-only (get-contract-stx-balance)
  (stx-get-balance (as-contract tx-sender)))

;; ============================================
;; TOKEN BALANCE QUERIES
;; Cross-contract calls (even read-only ones) must use define-public in Clarity.
;; These functions do not modify state - they are safe to call freely.
;; All balances are queried for THIS wallet contract, not the tx-sender.
;; ============================================

;; Balance of any SIP-010 token held by this wallet
(define-public (get-token-balance (token <ft-trait>))
  (contract-call? token get-balance (as-contract tx-sender))
)

;; sBTC balance - explicit alias for readability.
;; Pass the sBTC contract as argument to avoid hardcoding testnet/mainnet addresses.
;;
;; Testnet:  'SM3VDXK3WZVKL2YXBF7JNEBXPVLQKFHCPEFBNWN.sbtc-token
;; Mainnet:  confirm address before deploy
(define-public (get-sbtc-balance (sbtc-contract <ft-trait>))
  (contract-call? sbtc-contract get-balance (as-contract tx-sender))
)

;; STX + one token balance in a single call - useful for bot dashboard queries.
;; Returns STX in micro-STX and token amount in its native decimals.
(define-public (get-all-balances (token <ft-trait>))
  (let (
    (stx-bal   (stx-get-balance (as-contract tx-sender)))
    (token-bal (try! (contract-call? token get-balance (as-contract tx-sender))))
  )
    (ok {
      stx:   stx-bal,
      token: token-bal
    })
  )
)

;; Total value allocated across all registered protocols for a given token.
;; Queries each adapter that implements get-balance.
;; NOTE: this reflects what the wallet THINKS is allocated (on-chain accounting),
;;       not the live balance inside the adapter - for that, query the adapter directly.
(define-read-only (get-portfolio-summary)
  {
    stx-in-wallet:       (stx-get-balance (as-contract tx-sender)),
    operation-count:     (var-get operation-count),
    is-paused:           (var-get is-paused),
    daily-limit:         (var-get daily-limit-amount),
    spent-today:         (var-get spent-today),
    remaining-today:     (let ((spent (var-get spent-today)) (lim (var-get daily-limit-amount)))
                           (if (>= spent lim) u0 (- lim spent)))
  }
)
