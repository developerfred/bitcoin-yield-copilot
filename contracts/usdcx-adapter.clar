;; USDCx Adapter Contract
;; Allows user-wallet to interact with USDCx pools for yield generation
;; Implements the adapter-trait for integration with user-wallet

(impl-trait .adapter-trait.adapter-trait)

(define-constant ERR-INSUFFICIENT-BALANCE (err u401))

(define-data-var total-allocated uint u0)
(define-data-var pending-rewards uint u0)

(define-map user-balances
  principal
  uint
)

(define-public (execute
    (amount uint)
    (action (string-ascii 16))
  )
  (if (is-eq action "deposit")
    (begin
      (try! (contract-call? .mock-sip-010 transfer amount tx-sender .usdcx-adapter (some 0x)))
      (map-set user-balances tx-sender 
        (+ (default-to u0 (map-get? user-balances tx-sender)) amount))
      (var-set total-allocated (+ (var-get total-allocated) amount))
      (ok { amount: amount, allocated: (var-get total-allocated) })
    )
    (if (is-eq action "withdraw")
      (begin
        (asserts! 
          (<= amount (default-to u0 (map-get? user-balances tx-sender)))
          ERR-INSUFFICIENT-BALANCE
        )
        (map-set user-balances tx-sender 
          (- (default-to u0 (map-get? user-balances tx-sender)) amount))
        (var-set total-allocated (- (var-get total-allocated) amount))
        (try! (contract-call? .mock-sip-010 transfer amount .usdcx-adapter tx-sender (some 0x)))
        (ok { amount: amount, allocated: (var-get total-allocated) })
      )
      (ok { amount: u0, allocated: (var-get total-allocated) })
    )
  )
)

(define-read-only (get-balance)
  (ok (var-get total-allocated))
)

(define-read-only (get-user-balance (user principal))
  (ok (default-to u0 (map-get? user-balances user)))
)

(define-read-only (get-pending-rewards)
  (ok (var-get pending-rewards))
)

(define-public (emergency-withdraw)
  (let ((balance (var-get total-allocated)))
    (var-set total-allocated u0)
    (map-set user-balances tx-sender u0)
    (as-contract (try! (contract-call? .mock-sip-010 transfer balance .usdcx-adapter tx-sender (some 0x))))
    (ok balance)
  )
)

(define-public (add-rewards (amount uint))
  (begin
    (var-set pending-rewards (+ (var-get pending-rewards) amount))
    (ok true)
  )
)

(define-public (claim-rewards)
  (let ((rewards (var-get pending-rewards)))
    (asserts! (> rewards u0) ERR-INSUFFICIENT-BALANCE)
    (var-set pending-rewards u0)
    (as-contract (try! (contract-call? .mock-sip-010 transfer rewards .usdcx-adapter tx-sender (some 0x))))
    (ok rewards)
  )
)
