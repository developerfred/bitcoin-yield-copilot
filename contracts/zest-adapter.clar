;; zest-adapter.clar
;; Adapter para integracao completa com Zest Protocol (lending, borrowing, vaults, rewards).
;; Usa addresses mainnet oficiais (deployer SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N).
;; Para testnet, substitua DEPLOYER por address deployado manualmente.
;; Suporta V2 features: supply, borrow, repay, liquidate, claim-rewards.

(use-trait ft-trait 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.sip-010-trait-ft-standard.sip-010-trait)

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))
(define-constant ERR-ZEST-CALL-FAILED (err u500))
(define-constant ERR-INVALID-PARAM (err u501))
(define-constant ERR-INVALID-ASSET (err u502))

;; Mainnet Deployer e Contratos Principais (baseado em txs e docs V2)
(define-constant DEPLOYER 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N)

(define-constant MARKET (as-contract (concat DEPLOYER .market))) ;; Central hub for lending ops
(define-constant MARKET-VAULT (as-contract (concat DEPLOYER .market-vault))) ;; Position storage
(define-constant POOL-VAULT (as-contract (concat DEPLOYER .pool-vault))) ;; Pool vault for assets
(define-constant BORROW-HELPER (as-contract (concat DEPLOYER .borrow-helper-v2-2))) ;; Borrow helper

;; Vaults Especificos (ex: para STX, sBTC, stSTX)
(define-constant VAULT-STX (as-contract (concat DEPLOYER .vault-stx)))
(define-constant VAULT-SBTC (as-contract (concat DEPLOYER .vault-sbtc)))
(define-constant VAULT-STSTX (as-contract (concat DEPLOYER .vault-ststx)))

;; Tokens (zTokens for yield-bearing)
(define-constant ZSTX (as-contract (concat DEPLOYER .zstx-v1))) ;; zSTX
(define-constant ZSBTC (as-contract (concat DEPLOYER .zsbtc))) ;; zsBTC
(define-constant ZSTSTX (as-contract (concat DEPLOYER .zststx))) ;; zstSTX

;; === Lending Functions (Supply/Add Collateral) ===

;; Supply asset to market (add collateral, choose isolated or yield-bearing)
(define-public (supply-asset (asset <ft-trait>) (amount uint) (isolated bool))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    (try! (contract-call? asset approve MARKET amount))
    (let ((result (contract-call? MARKET supply asset amount tx-sender isolated))) ;; isolated: non-rehypothecated
      (match result ok-val (ok ok-val) err-val (err ERR-ZEST-CALL-FAILED)))
  )
)

;; Supply to specific vault (ex: STX vault)
(define-public (supply-to-vault (vault principal) (asset <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    (try! (contract-call? asset approve vault amount))
    (let ((result (contract-call? vault add-to-position asset amount)))
      (match result ok-val (ok ok-val) err-val (err ERR-ZEST-CALL-FAILED)))
  )
)

;; === Borrowing Functions ===

;; Borrow from market using helper
(define-public (borrow (asset <ft-trait>) (amount uint) (min-received uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    (let ((result (contract-call? BORROW-HELPER borrow asset amount min-received)))
      (match result ok-val (ok ok-val) err-val (err ERR-ZEST-CALL-FAILED)))
  )
)

;; === Repay Functions ===

;; Repay borrow (full or partial)
(define-public (repay (asset <ft-trait>) (amount uint) (borrower principal))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    (try! (contract-call? asset approve MARKET amount))
    (let ((result (contract-call? MARKET repay asset amount borrower)))
      (match result ok-val (ok ok-val) err-val (err ERR-ZEST-CALL-FAILED)))
  )
)

;; === Liquidation Functions ===

;; Liquidate position (call if health factor low)
(define-public (liquidate (borrower principal) (asset-collateral <ft-trait>) (asset-debt <ft-trait>) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    (let ((result (contract-call? MARKET liquidate borrower asset-collateral asset-debt amount)))
      (match result ok-val (ok ok-val) err-val (err ERR-ZEST-CALL-FAILED)))
  )
)

;; === Rewards and Claims ===

;; Claim rewards (ex: from yield-bearing collateral)
(define-public (claim-rewards (asset <ft-trait>))
  (let ((result (contract-call? MARKET claim-rewards asset tx-sender)))
    (match result ok-val (ok ok-val) err-val (err ERR-ZEST-CALL-FAILED)))
)

;; === Read-Only Queries ===

(define-read-only (get-position (user principal))
  (contract-call? MARKET-VAULT get-position user)
)

(define-read-only (get-asset-details (asset <ft-trait>))
  (contract-call? MARKET get-asset asset)
)

(define-read-only (get-health-factor (user principal))
  (contract-call? MARKET get-health-factor user)
)

;; Log events for debugging
(define-private (log-event (event (string-ascii 32)) (data { amount: uint, asset: principal }))
  (print (merge { event: event, caller: tx-sender } data))
)