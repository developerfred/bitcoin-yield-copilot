;; alex-adapter-testnet-v2.clar
;; Adapter ALEX Protocol - Testnet v2
;; Enderecos oficiais da ALEX Testnet
;; Integracao perfeita com user-wallet.clar

;; ============================================
;; TRAITS
;; ============================================

;; Trait SIP-010 padrao
(define-trait sip-010-trait
  (
    (transfer (uint principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

;; Trait do Swap Helper
(define-trait swap-helper-trait
  (
    (swap-helper 
      (principal principal uint uint) 
      (response (tuple (dx uint) (dy uint) (token-x principal) (token-y principal)) uint))
    (get-helper
      (principal principal uint)
      (response (tuple (dx uint) (dy uint)) uint))
  )
)

;; Trait do Fixed Weight Pool
(define-trait fixed-weight-pool-trait
  (
    (add-to-position
      (principal principal uint uint uint)
      (response (tuple (token-x principal) (token-y principal) (dx uint) (dy uint) (shares uint)) uint))
    (reduce-position
      (principal principal uint uint uint)
      (response (tuple (token-x principal) (token-y principal) (dx uint) (dy uint)) uint))
    (get-pool-details
      (principal principal)
      (response (tuple (balance-x uint) (balance-y uint) (fee-rate-x uint) (fee-rate-y uint) (shares-total uint)) uint))
  )
)

;; Trait do Simple Weight Pool
(define-trait simple-weight-pool-trait
  (
    (add-to-position
      (principal principal uint uint)
      (response (tuple (token-x principal) (token-y principal) (shares uint)) uint))
    (reduce-position
      (principal principal uint)
      (response (tuple (token-x principal) (token-y principal) (dx uint) (dy uint)) uint))
  )
)

;; Trait do Vault
(define-trait vault-trait
  (
    (flash-loan
      (principal principal uint (buff 1024))
      (response (tuple (loan-amount uint) (fee-amount uint)) uint))
    (get-balance
      (principal)
      (response uint uint))
  )
)

;; ============================================
;; CONSTANTES - ENDERECOS ALEX TESTNET
;; ============================================

;; Deployer oficial ALEX Testnet
(define-constant ALEX-DEPLOYER 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX)

;; Contratos principais ALEX Testnet
(define-constant CONTRACT-VAULT 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.alex-vault)
(define-constant CONTRACT-RESERVE-POOL 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.alex-reserve-pool)
(define-constant CONTRACT-FIXED-WEIGHT-POOL 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.fixed-weight-pool-v1-02)
(define-constant CONTRACT-SIMPLE-WEIGHT-POOL 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.simple-weight-pool-alex)
(define-constant CONTRACT-SWAP-HELPER 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.swap-helper-v1-03)

;; Tokens principais ALEX Testnet
(define-constant TOKEN-ALEX 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.age000-governance-token)
(define-constant TOKEN-AUTO-ALEX 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.auto-alex)
(define-constant TOKEN-WSTX 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wstx)
(define-constant TOKEN-XBTC 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wbtc)
(define-constant TOKEN-XUSD 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wxusd)
(define-constant TOKEN-USDA 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.token-wusda)

;; ============================================
;; ERROS
;; ============================================

(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))
(define-constant ERR-ALEX-CALL-FAILED (err u500))
(define-constant ERR-INVALID-PARAM (err u501))
(define-constant ERR-INVALID-TOKEN (err u502))
(define-constant ERR-POOL-NOT-FOUND (err u503))
(define-constant ERR-SLIPPAGE-TOO-HIGH (err u504))
(define-constant ERR-ZERO-AMOUNT (err u505))
(define-constant ERR-APPROVE-FAILED (err u506))

;; ============================================
;; STORAGE
;; ============================================

;; Guarda as posicoes de LP do usuario neste adapter
(define-map user-lp-positions
  principal
  (list 50 { pool-id: uint, token-x: principal, token-y: principal, shares: uint, block: uint })
)

;; Contador de operacoes por usuario
(define-map user-operation-count
  principal
  uint
)

;; ============================================
;; EVENTS
;; ============================================

(define-private (log-swap (token-x principal) (token-y principal) (dx uint) (dy uint) (user principal))
  (print {
    event: "alex-swap",
    token-x: token-x,
    token-y: token-y,
    dx: dx,
    dy: dy,
    user: user,
    block: block-height
  })
)

(define-private (log-add-liquidity (token-x principal) (token-y principal) (dx uint) (dy uint) (shares uint) (user principal))
  (print {
    event: "alex-add-liquidity",
    token-x: token-x,
    token-y: token-y,
    dx: dx,
    dy: dy,
    shares: shares,
    user: user,
    block: block-height
  })
)

(define-private (log-remove-liquidity (token-x principal) (token-y principal) (dx uint) (dy uint) (user principal))
  (print {
    event: "alex-remove-liquidity",
    token-x: token-x,
    token-y: token-y,
    dx: dx,
    dy: dy,
    user: user,
    block: block-height
  })
)

;; ============================================
;; SWAPS
;; ============================================

;; Swap entre dois tokens quaisquer usando o swap-helper
;; Esta funCao deve ser chamada pelo user-wallet.clar ou diretamente pelo usuario
(define-public (swap
    (token-x <sip-010-trait>)
    (token-y <sip-010-trait>)
    (dx uint)
    (min-dy uint))
  (begin
    ;; Validacoes
    (asserts! (> dx u0) ERR-ZERO-AMOUNT)
    (asserts! (> min-dy u0) ERR-ZERO-AMOUNT)

    ;; Verificar saldo do usuario
    (let ((user-balance (try! (contract-call? token-x get-balance tx-sender))))
      (asserts! (>= user-balance dx) ERR-INSUFFICIENT-BALANCE)

      ;; Transferir tokens do usuario para este contrato
      (try! (contract-call? token-x transfer dx tx-sender (as-contract tx-sender) none))

      ;; Aprovar tokens para o swap-helper
      (try! (as-contract (contract-call? token-x transfer dx (as-contract tx-sender) CONTRACT-SWAP-HELPER none)))

      ;; Executar swap
      (let ((result (contract-call? CONTRACT-SWAP-HELPER swap-helper
                      (contract-of token-x)
                      (contract-of token-y)
                      dx
                      min-dy)))
        (match result
          ok-val (begin
            ;; Transferir tokens recebidos para o usuario
            (try! (as-contract (contract-call? token-y transfer (get dy ok-val) (as-contract tx-sender) tx-sender none)))

            ;; Log evento
            (log-swap (contract-of token-x) (contract-of token-y) dx (get dy ok-val) tx-sender)

            ;; Retornar resultado
            (ok ok-val)
          )
          err-val (begin
            ;; Reverter em caso de erro (idealmente teria rollback)
            (print { event: "alex-swap-failed", error: err-val })
            ERR-ALEX-CALL-FAILED
          )
        )
      )
    )
  )
)

;; Swap STX (wrapped) para outro token
(define-public (swap-stx-for-token
    (token-y <sip-010-trait>)
    (wstx <sip-010-trait>)
    (dx uint)
    (min-dy uint))
  (begin
    ;; Verificar que wstx e o token correto
    (asserts! (is-eq (contract-of wstx) TOKEN-WSTX) ERR-INVALID-TOKEN)
    (swap wstx token-y dx min-dy)
  )
)

;; Swap token para STX (wrapped)
(define-public (swap-token-for-stx
    (token-x <sip-010-trait>)
    (wstx <sip-010-trait>)
    (dx uint)
    (min-dy uint))
  (begin
    ;; Verificar que wstx e o token correto
    (asserts! (is-eq (contract-of wstx) TOKEN-WSTX) ERR-INVALID-TOKEN)
    (swap token-x wstx dx min-dy)
  )
)

;; ============================================
;; LIQUIDITY PROVISION
;; ============================================

;; Adicionar liquidez em Fixed Weight Pool (50/50)
(define-public (add-liquidity-fixed
    (token-x <sip-010-trait>)
    (token-y <sip-010-trait>)
    (dx uint)
    (dy uint)
    (min-shares uint))
  (begin
    ;; Validacoes
    (asserts! (> dx u0) ERR-ZERO-AMOUNT)
    (asserts! (> dy u0) ERR-ZERO-AMOUNT)
    (asserts! (> min-shares u0) ERR-ZERO-AMOUNT)

    ;; Verificar saldos
    (let ((balance-x (try! (contract-call? token-x get-balance tx-sender)))
          (balance-y (try! (contract-call? token-y get-balance tx-sender))))
      (asserts! (>= balance-x dx) ERR-INSUFFICIENT-BALANCE)
      (asserts! (>= balance-y dy) ERR-INSUFFICIENT-BALANCE)

      ;; Transferir tokens para este contrato
      (try! (contract-call? token-x transfer dx tx-sender (as-contract tx-sender) none))
      (try! (contract-call? token-y transfer dy tx-sender (as-contract tx-sender) none))

      ;; Aprovar tokens para o pool
      (try! (as-contract (contract-call? token-x transfer dx (as-contract tx-sender) CONTRACT-FIXED-WEIGHT-POOL none)))
      (try! (as-contract (contract-call? token-y transfer dy (as-contract tx-sender) CONTRACT-FIXED-WEIGHT-POOL none)))

      ;; Adicionar liquidez
      (let ((result (contract-call? CONTRACT-FIXED-WEIGHT-POOL add-to-position
                      (contract-of token-x)
                      (contract-of token-y)
                      dx
                      dy
                      min-shares)))
        (match result
          ok-val (begin
            ;; Atualizar posicoes do usuario
            (update-lp-position tx-sender (contract-of token-x) (contract-of token-y) (get shares ok-val))

            ;; Log evento
            (log-add-liquidity (contract-of token-x) (contract-of token-y) dx dy (get shares ok-val) tx-sender)

            (ok ok-val)
          )
          err-val (begin
            (print { event: "alex-add-liquidity-failed", error: err-val })
            ERR-ALEX-CALL-FAILED
          )
        )
      )
    )
  )
)

;; Adicionar liquidez em Simple Weight Pool
(define-public (add-liquidity-simple
    (token-x <sip-010-trait>)
    (token-y <sip-010-trait>)
    (dx uint)
    (dy uint))
  (begin
    ;; Validacoes
    (asserts! (> dx u0) ERR-ZERO-AMOUNT)
    (asserts! (> dy u0) ERR-ZERO-AMOUNT)

    ;; Verificar saldos
    (let ((balance-x (try! (contract-call? token-x get-balance tx-sender)))
          (balance-y (try! (contract-call? token-y get-balance tx-sender))))
      (asserts! (>= balance-x dx) ERR-INSUFFICIENT-BALANCE)
      (asserts! (>= balance-y dy) ERR-INSUFFICIENT-BALANCE)

      ;; Transferir tokens para este contrato
      (try! (contract-call? token-x transfer dx tx-sender (as-contract tx-sender) none))
      (try! (contract-call? token-y transfer dy tx-sender (as-contract tx-sender) none))

      ;; Aprovar tokens para o pool
      (try! (as-contract (contract-call? token-x transfer dx (as-contract tx-sender) CONTRACT-SIMPLE-WEIGHT-POOL none)))
      (try! (as-contract (contract-call? token-y transfer dy (as-contract tx-sender) CONTRACT-SIMPLE-WEIGHT-POOL none)))

      ;; Adicionar liquidez
      (let ((result (contract-call? CONTRACT-SIMPLE-WEIGHT-POOL add-to-position
                      (contract-of token-x)
                      (contract-of token-y)
                      dx
                      dy)))
        (match result
          ok-val (begin
            ;; Atualizar posicoes do usuario
            (update-lp-position tx-sender (contract-of token-x) (contract-of token-y) (get shares ok-val))

            ;; Log evento
            (log-add-liquidity (contract-of token-x) (contract-of token-y) dx dy (get shares ok-val) tx-sender)

            (ok ok-val)
          )
          err-val (begin
            (print { event: "alex-add-liquidity-simple-failed", error: err-val })
            ERR-ALEX-CALL-FAILED
          )
        )
      )
    )
  )
)

;; Remover liquidez de Fixed Weight Pool
(define-public (remove-liquidity-fixed
    (token-x <sip-010-trait>)
    (token-y <sip-010-trait>)
    (percent uint)
    (min-dx uint)
    (min-dy uint))
  (begin
    ;; Validacoes
    (asserts! (> percent u0) ERR-ZERO-AMOUNT)
    (asserts! (<= percent u100) ERR-INVALID-PARAM)

    ;; Remover liquidez
    (let ((result (contract-call? CONTRACT-FIXED-WEIGHT-POOL reduce-position
                    (contract-of token-x)
                    (contract-of token-y)
                    percent
                    min-dx
                    min-dy)))
      (match result
        ok-val (begin
          ;; Transferir tokens recebidos para o usuario
          (try! (as-contract (contract-call? token-x transfer (get dx ok-val) (as-contract tx-sender) tx-sender none)))
          (try! (as-contract (contract-call? token-y transfer (get dy ok-val) (as-contract tx-sender) tx-sender none)))

          ;; Log evento
          (log-remove-liquidity (contract-of token-x) (contract-of token-y) (get dx ok-val) (get dy ok-val) tx-sender)

          (ok ok-val)
        )
        err-val (begin
          (print { event: "alex-remove-liquidity-failed", error: err-val })
          ERR-ALEX-CALL-FAILED
        )
      )
    )
  )
)

;; Remover liquidez de Simple Weight Pool
(define-public (remove-liquidity-simple
    (token-x <sip-010-trait>)
    (token-y <sip-010-trait>)
    (percent uint))
  (begin
    ;; Validacoes
    (asserts! (> percent u0) ERR-ZERO-AMOUNT)
    (asserts! (<= percent u100) ERR-INVALID-PARAM)

    ;; Remover liquidez
    (let ((result (contract-call? CONTRACT-SIMPLE-WEIGHT-POOL reduce-position
                    (contract-of token-x)
                    (contract-of token-y)
                    percent)))
      (match result
        ok-val (begin
          ;; Transferir tokens recebidos para o usuario
          (try! (as-contract (contract-call? token-x transfer (get dx ok-val) (as-contract tx-sender) tx-sender none)))
          (try! (as-contract (contract-call? token-y transfer (get dy ok-val) (as-contract tx-sender) tx-sender none)))

          ;; Log evento
          (log-remove-liquidity (contract-of token-x) (contract-of token-y) (get dx ok-val) (get dy ok-val) tx-sender)

          (ok ok-val)
        )
        err-val (begin
          (print { event: "alex-remove-liquidity-simple-failed", error: err-val })
          ERR-ALEX-CALL-FAILED
        )
      )
    )
  )
)

;; ============================================
;; VAULT OPERATIONS
;; ============================================

;; Adicionar ao vault (ex: collateral)
(define-public (add-to-vault
    (token <sip-010-trait>)
    (amount uint))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    ;; Transferir tokens para este contrato
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Aprovar para o reserve pool
    (try! (as-contract (contract-call? token transfer amount (as-contract tx-sender) CONTRACT-RESERVE-POOL none)))

    ;; Adicionar ao vault
    (let ((result (contract-call? CONTRACT-RESERVE-POOL add-to-balance (contract-of token) amount)))
      (match result
        ok-val (begin
          (print { event: "alex-vault-add", token: (contract-of token), amount: amount, user: tx-sender, block: block-height })
          (ok ok-val)
        )
        err-val (begin
          (print { event: "alex-vault-add-failed", error: err-val })
          ERR-ALEX-CALL-FAILED
        )
      )
    )
  )
)

;; ============================================
;; QUERIES (READ-ONLY)
;; ============================================

;; Obter detalhes de um pool
(define-read-only (get-pool-details-fixed
    (token-x principal)
    (token-y principal))
  (contract-call? CONTRACT-FIXED-WEIGHT-POOL get-pool-details token-x token-y)
)

;; Obter informaCao do vault
(define-read-only (get-vault-balance
    (token principal))
  (contract-call? CONTRACT-VAULT get-balance token)
)

;; Obter posicoes de LP do usuario
(define-read-only (get-user-lp-positions (user principal))
  (default-to (list) (map-get? user-lp-positions user))
)

;; Obter contador de operacoes
(define-read-only (get-user-operation-count (user principal))
  (default-to u0 (map-get? user-operation-count user))
)

;; Obter estimativa de swap
(define-read-only (get-swap-estimate
    (token-x principal)
    (token-y principal)
    (dx uint))
  (contract-call? CONTRACT-SWAP-HELPER get-helper token-x token-y dx)
)

;; Verificar se token e suportado
(define-read-only (is-supported-token (token principal))
  (or
    (is-eq token TOKEN-ALEX)
    (is-eq token TOKEN-AUTO-ALEX)
    (is-eq token TOKEN-WSTX)
    (is-eq token TOKEN-XBTC)
    (is-eq token TOKEN-XUSD)
    (is-eq token TOKEN-USDA)
  )
)

;; ============================================
;; HELPERS PRIVADOS
;; ============================================

(define-private (update-lp-position
    (user principal)
    (token-x principal)
    (token-y principal)
    (shares uint))
  (let ((current-positions (default-to (list) (map-get? user-lp-positions user)))
        (new-position { pool-id: (len current-positions), token-x: token-x, token-y: token-y, shares: shares, block: block-height }))
    (map-set user-lp-positions
      user
      (unwrap-panic (as-max-len? (append current-positions new-position) u50)))
  )
)

(define-private (increment-operation-count (user principal))
  (let ((current (default-to u0 (map-get? user-operation-count user))))
    (map-set user-operation-count user (+ current u1))
  )
)
