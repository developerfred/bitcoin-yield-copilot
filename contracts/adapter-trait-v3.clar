(define-trait adapter-trait-v3
  (
    (execute (uint (string-ascii 16)) (response { amount: uint, allocated: uint } uint))
    (get-balance () (response uint uint))
    (get-pending-rewards () (response uint uint))
    (emergency-withdraw () (response uint uint))
  )
)
