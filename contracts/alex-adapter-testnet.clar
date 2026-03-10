;; alex-adapter-testnet.clar
;; Adapter para integracao completa com ALEX Protocol na TESTNET.
;; Usa os enderecos oficiais fornecidos (deployer ST29E61D...).
;; Suporta AMM pools, swaps, add/remove liquidity, vaults, etc.
;; Use traits SIP-010 para tokens (definidos no ALEX testnet).

(use-trait ft-trait 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.sip-010-trait-ft-standard.sip-010-trait)

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))
(define-constant ERR-ALEX-CALL-FAILED (err u500))
(define-constant ERR-INVALID-PARAM (err u501))
(define-constant ERR-INVALID-TOKEN (err u502))

;; Testnet Deployer e Contratos Principais
(define-constant DEPLOYER 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX)

(define-constant ALEX-VAULT (as-contract (concat DEPLOYER .alex-vault)))
(define-constant ALEX-RESERVE-POOL (as-contract (concat DEPLOYER .alex-reserve-pool)))
(define-constant FIXED-WEIGHT-POOL (as-contract (concat DEPLOYER .fixed-weight-pool-v1-02)))
(define-constant SIMPLE-WEIGHT-POOL (as-contract (concat DEPLOYER .simple-weight-pool-alex)))
(define-constant SWAP-HELPER (as-contract (concat DEPLOYER .swap-helper-v1-03)))

;; Tokens Principais (SIP-010)
(define-constant TOKEN-ALEX (as-contract (concat DEPLOYER .age000-governance-token)))
(define-constant TOKEN-AUTO-ALEX (as-contract (concat DEPLOYER .auto-alex)))
(define-constant TOKEN-WSTX (as-contract (concat DEPLOYER .token-wstx)))
(define-constant TOKEN-XBTC (as-contract (concat DEPLOYER .token-wbtc)))
(define-constant TOKEN-XUSD (as-contract (concat DEPLOYER .token-wxusd)))
(define-constant TOKEN-USDA (as-contract (concat DEPLOYER .token-wusda)))

;; === AMM Swaps (usando swap-helper para rotas multi-hop) ===

;; Swap simples: token X -> token Y (via swap-helper)
(define-public (swap (token-x <ft-trait>) (token-y <ft-trait>) (dx uint) (min-dy uint))
  (begin
    (asserts! (> dx u0) ERR-INVALID-PARAM)
    ;; Aprovar token-x pro swap-helper se necessario (geralmente o caller aprova antes)
    (try! (contract-call? token-x approve SWAP-HELPER dx))
    (let ((result (contract-call? SWAP-HELPER swap token-x token-y dx min-dy)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-CALL-FAILED)))
  )
)

;; Swap especIfico: STX (via wstx) -> outro token
(define-public (swap-stx-for-token (token-y <ft-trait>) (dx uint) (min-dy uint))
  (swap TOKEN-WSTX token-y dx min-dy)
)

;; Swap token -> STX (via wstx)
(define-public (swap-token-for-stx (token-x <ft-trait>) (dx uint) (min-dy uint))
  (swap token-x TOKEN-WSTX dx min-dy)
)

;; === Liquidity Provision (Add/Remove) ===

;; Add liquidity em fixed-weight pool (ex: STX-token)
(define-public (add-liquidity-fixed (token-y <ft-trait>) (dx uint) (dy uint) (min-shares uint))
  (begin
    (asserts! (and (> dx u0) (> dy u0)) ERR-INVALID-PARAM)
    (try! (contract-call? TOKEN-WSTX approve FIXED-WEIGHT-POOL dx))
    (try! (contract-call? token-y approve FIXED-WEIGHT-POOL dy))
    (let ((result (contract-call? FIXED-WEIGHT-POOL add-to-position TOKEN-WSTX token-y dx dy min-shares)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-CALL-FAILED)))
  )
)

;; Add liquidity em simple-weight pool (ex: ALEX pools simples)
(define-public (add-liquidity-simple (token-x <ft-trait>) (token-y <ft-trait>) (dx uint) (dy uint))
  (begin
    (asserts! (and (> dx u0) (> dy u0)) ERR-INVALID-PARAM)
    (try! (contract-call? token-x approve SIMPLE-WEIGHT-POOL dx))
    (try! (contract-call? token-y approve SIMPLE-WEIGHT-POOL dy))
    (let ((result (contract-call? SIMPLE-WEIGHT-POOL add-to-position token-x token-y dx dy)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-CALL-FAILED)))
  )
)

;; Remove liquidity (reduz posicao e recebe tokens de volta)
(define-public (remove-liquidity (pool principal) (token-x <ft-trait>) (token-y <ft-trait>) (percent uint) (min-dx uint) (min-dy uint))
  (begin
    (asserts! (and (> percent u0) (<= percent u100)) ERR-INVALID-PARAM)
    ;; Assuma que o LP token e transferido pro pool antes (ou use reduce-position direto se suportado)
    (let ((result (contract-call? pool reduce-position token-x token-y percent min-dx min-dy)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-CALL-FAILED)))
  )
)

;; === Vault Functions (ex: add collateral, flash loans) ===

;; Add to vault (ex: colateral em reserve-pool)
(define-public (add-to-vault (token <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    (try! (contract-call? token approve ALEX-RESERVE-POOL amount))
    (let ((result (contract-call? ALEX-RESERVE-POOL add-to-balance token amount)))
      (match result ok-val (ok ok-val) err-val (err ERR-ALEX-CALL-FAILED)))
  )
)

;; Flash loan (requer implementacao de flash-loan-user trait no seu contrato caller)
(use-trait flash-loan-user .flash-loan-trait.flash-loan-user)  ;; Defina ou importe o trait
(define-public (execute-flash-loan (loan-user <flash-loan-user>) (token <ft-trait>) (amount uint) (data (buff 1024)))
  (let ((result (contract-call? ALEX-VAULT flash-loan loan-user token amount data)))
    (match result ok-val (ok ok-val) err-val (err ERR-ALEX-CALL-FAILED)))
)

;; === Read-Only Helpers (para queries no frontend ou logica) ===

(define-read-only (get-pool-details-fixed (token-x <ft-trait>) (token-y <ft-trait>))
  (contract-call? FIXED-WEIGHT-POOL get-pool token-x token-y)
)

(define-read-only (get-vault-info (vault-id uint))
  (contract-call? ALEX-VAULT get-vault-by-id vault-id)
)

;; Print events para debugging
(define-private (log-event (event (string-ascii 32)) (data { amount: uint, token: principal }))
  (print (merge { event: event, caller: tx-sender } data))
)