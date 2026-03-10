;; user-wallet.clar - Simplified for Testnet

(use-trait adapter-trait .adapter-trait.adapter-trait)

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
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-SIGNATURE (err u402))
(define-constant ERR-LIMIT-EXCEEDED (err u403))
(define-constant ERR-EXPIRED (err u404))
(define-constant ERR-PAUSED (err u405))
(define-constant ERR-UNKNOWN-PROTOCOL (err u406))
(define-constant ERR-DAILY-LIMIT (err u407))
(define-constant ERR-NOT-INITIALIZED (err u408))
(define-constant ERR-ALREADY-INITIALIZED (err u409))
(define-constant ERR-INVALID-LIMITS (err u410))
(define-constant ERR-ZERO-AMOUNT (err u411))
(define-constant ERR-PROTOCOL-EXISTS (err u412))
(define-constant ERR-ALLOCATION-EXCEEDED (err u413))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))
(define-constant ERR-EMERGENCY (err u420))

(define-constant BLOCKS-PER-DAY u144)
(define-constant MAX-HISTORY u100)
(define-constant DOMAIN-PAUSE u20)
(define-constant DOMAIN-UNPAUSE u21)
(define-constant DOMAIN-OP-EXECUTE u40)
(define-constant DOMAIN-ADD-PROTOCOL u50)
(define-constant DOMAIN-UPD-PROTOCOL u51)
(define-constant DOMAIN-UPD-LIMITS u60)
(define-constant ZERO-HASH32 0x0000000000000000000000000000000000000000000000000000000000000000)
(define-constant ZERO-PUBKEY33 0x000000000000000000000000000000000000000000000000000000000000000000)

(define-data-var initialized bool false)
(define-data-var telegram-hash (buff 32) ZERO-HASH32)
(define-data-var bot-pubkey (buff 33) ZERO-PUBKEY33)
(define-data-var is-paused bool false)
(define-data-var current-nonce uint u0)
(define-data-var max-per-tx uint u0)
(define-data-var daily-limit-amount uint u0)
(define-data-var spent-today uint u0)
(define-data-var last-reset-block uint u0)
(define-data-var operation-count uint u0)

(define-map allowed-protocols principal { name: (string-ascii 32), max-allocation: uint, current-allocation: uint, enabled: bool })
(define-map operation-history uint { nonce: uint, protocol: principal, action: (string-ascii 16), amount: uint, block: uint, canonical-hash: (buff 32) })

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

(define-public (initialize (tg-hash (buff 32)) (bot-pk (buff 33)) (max-per-tx-v uint) (day-limit uint))
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

(define-public (execute-authorized-operation 
  (nonce uint) 
  (protocol principal)
  (action (string-ascii 16)) 
  (amount uint) 
  (expiry-block uint) 
  (bot-sig (buff 65))
  (protocol-contract <adapter-trait>))
  (let ((payload-hash (sha256 (op-payload nonce protocol action amount expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    
    ;; Get the protocol configuration from the map
    (let ((proto (unwrap! (map-get? allowed-protocols protocol) ERR-UNKNOWN-PROTOCOL)))
      (asserts! (get enabled proto) ERR-UNKNOWN-PROTOCOL)
      (asserts! (<= amount (var-get max-per-tx)) ERR-LIMIT-EXCEEDED)
      
      ;; Check daily limits
      (let ((current-spent (refresh-daily-limit)))
        (asserts! (<= (+ current-spent amount) (var-get daily-limit-amount)) ERR-DAILY-LIMIT)
        
        ;; Update allocation based on action type
        (let ((cur-alloc (get current-allocation proto))
              (max-alloc (get max-allocation proto))
              (new-alloc (if (is-eq action "deposit")
                           (begin 
                             (asserts! (<= (+ cur-alloc amount) max-alloc) ERR-ALLOCATION-EXCEEDED) 
                             (+ cur-alloc amount))
                           (if (is-eq action "withdraw") 
                               (if (>= cur-alloc amount) 
                                   (- cur-alloc amount) 
                                   u0) 
                               cur-alloc))))
          
          ;; Update state
          (var-set current-nonce (+ (var-get current-nonce) u1))
          (var-set spent-today (+ current-spent amount))
          (map-set allowed-protocols protocol (merge proto { current-allocation: new-alloc }))
          
          ;; Record operation in history
          (let ((slot (mod (var-get operation-count) MAX-HISTORY)))
            (map-set operation-history slot 
              { 
                nonce: nonce, 
                protocol: protocol, 
                action: action, 
                amount: amount, 
                block: stacks-block-height, 
                canonical-hash: payload-hash 
              })
            (var-set operation-count (+ (var-get operation-count) u1))
            
            ;; Execute the protocol action (deposit or withdraw)
            (try! (as-contract (contract-call? protocol-contract execute amount action)))
            
            (ok { amount: amount, allocated: new-alloc })))))))

(define-public (withdraw-stx
  (amount uint) 
  (recipient principal) 
  (expiry-block uint) 
  (auth-key (buff 32)))
  (begin
    ;; Validate contract state and operational conditions
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    
    ;; Verify withdrawal amount meets minimum requirements
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    ;; Ensure the authorization hasn't expired by comparing current block height
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    
    ;; Confirm the provided auth-key corresponds to a valid pending authorization
    ;; This prevents unauthorized withdrawals using arbitrary or forged keys
    (asserts! 
      (is-some (contract-call? .withdraw-helper get-pending-auth auth-key)) 
      ERR-NOT-AUTHORIZED)
    
    ;; Verify the contract holds sufficient STX tokens to fulfill the withdrawal
    (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERR-INSUFFICIENT-BALANCE)
    
    ;; Consume the pre-authorized withdrawal that was created by the bot via authorize-withdrawal
    ;; The authorization contains the exact parameters (user, recipient, amount) for this transaction
    (let ((result (try! (as-contract 
                    (contract-call? .withdraw-helper 
                      consume-authorization 
                      tx-sender        ;; Within as-contract context, tx-sender refers to the user's wallet principal
                      recipient 
                      amount 
                      auth-key)))))
      
      ;; Decompose the result to extract the net amount (after fees) and fee allocation
      (let (
        (net-amount (get net-amount result))
        (fee-amount (get fee-amount result))
        (treasury   (get treasury result))
      )
        ;; Transfer the net amount (principal minus fees) to the designated recipient
        (try! (as-contract (stx-transfer? net-amount tx-sender recipient)))
        
        ;; Conditionally transfer accumulated fees to the treasury if any fees were assessed
        (if (> fee-amount u0)
          (try! (as-contract (stx-transfer? fee-amount tx-sender treasury)))
          true)
        
        ;; Return confirmation with detailed breakdown of the transaction amounts
        (ok { net-amount: net-amount, fee-amount: fee-amount })
      )
    )
  )
)

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
    ;; Verifica que a auth-key pendente existe e e valida antes de consumir
    (asserts! 
      (is-some (contract-call? .withdraw-helper get-pending-auth auth-key)) 
      ERR-NOT-AUTHORIZED)
    ;; Consome a autorizacao ja criada pelo bot via authorize-withdrawal
    (let ((result (try! (as-contract 
                    (contract-call? .withdraw-helper 
                      consume-authorization 
                      tx-sender        ;; dentro de as-contract, tx-sender = user-wallet principal
                      recipient 
                      amount 
                      auth-key)))))
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

(define-public (emergency-pause (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (pause-payload nonce expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (var-set is-paused true)
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (unpause (nonce uint) (expiry-block uint) (bot-sig (buff 65)))
  (let ((payload-hash (sha256 (unpause-payload nonce expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (var-get is-paused) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (var-set is-paused false)
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (update-limits (new-max-per-tx uint) (new-daily uint) (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
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

(define-public (add-protocol (protocol principal) (name (string-ascii 32)) (max-alloc uint) (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (add-proto-payload nonce protocol max-alloc expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (> max-alloc u0) ERR-INVALID-LIMITS)
    (asserts! (is-none (map-get? allowed-protocols protocol)) ERR-PROTOCOL-EXISTS)
    (map-set allowed-protocols protocol { name: name, max-allocation: max-alloc, current-allocation: u0, enabled: true })
    (var-set current-nonce (+ (var-get current-nonce) u1))
    (ok true)))

(define-public (update-protocol (protocol principal) (new-max-alloc uint) (enabled bool) (nonce uint) (expiry-block uint) (bot-sig (buff 65)) (tg-proof (buff 32)))
  (let ((payload-hash (sha256 (update-proto-payload nonce protocol new-max-alloc expiry-block))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block) ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (> new-max-alloc u0) ERR-INVALID-LIMITS)
    (let ((proto (unwrap! (map-get? allowed-protocols protocol) ERR-UNKNOWN-PROTOCOL)))
      (map-set allowed-protocols protocol (merge proto { max-allocation: new-max-alloc, enabled: enabled }))
      (var-set current-nonce (+ (var-get current-nonce) u1))
      (ok true))))

(define-read-only (get-wallet-info)
  (let ((spent (var-get spent-today)) (lim (var-get daily-limit-amount)))
    { initialized: (var-get initialized), is-paused: (var-get is-paused), current-nonce: (var-get current-nonce), max-per-transaction: (var-get max-per-tx), daily-limit: lim, spent-today: spent, remaining-today: (if (>= spent lim) u0 (- lim spent)) }))

(define-read-only (get-protocol-config (protocol principal)) (map-get? allowed-protocols protocol))
(define-read-only (get-operation (idx uint)) (map-get? operation-history (mod idx MAX-HISTORY)))
(define-read-only (get-operation-count) (var-get operation-count))
(define-read-only (verify-identity (proof (buff 32))) (is-eq proof (var-get telegram-hash)))

;; ============================================
;; EMERGENCY FUNCTIONS - Prevent user funds from being locked
;; ============================================

;; Emergency withdraw from adapter - allows user to recover funds if bot is unresponsive
;; Requires telegram proof to verify ownership
(define-public (emergency-withdraw-from-adapter 
  (adapter <adapter-trait>)
  (amount uint)
  (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    ;; Call adapter to withdraw funds back to this wallet
    (as-contract (contract-call? adapter execute amount "withdraw"))
  )
)

;; Emergency transfer - allows user to transfer any tokens directly from wallet
;; Requires telegram proof to verify ownership
(define-public (emergency-transfer 
  (token <ft-trait>)
  (amount uint)
  (recipient principal)
  (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    ;; Transfer tokens directly to recipient
    (as-contract (contract-call? token transfer amount tx-sender recipient none))
  )
)

;; Emergency STX transfer - allows user to transfer STX directly from wallet
(define-public (emergency-transfer-stx 
  (amount uint)
  (recipient principal)
  (tg-proof (buff 32)))
  (begin
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (is-eq tg-proof (var-get telegram-hash)) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (>= (stx-get-balance (as-contract tx-sender)) amount) ERR-INSUFFICIENT-BALANCE)
    
    ;; Transfer STX directly to recipient
    (as-contract (stx-transfer? amount tx-sender recipient))
  )
)

;; Get contract STX balance for emergency verification
(define-read-only (get-contract-stx-balance)
  (stx-get-balance (as-contract tx-sender))
)
