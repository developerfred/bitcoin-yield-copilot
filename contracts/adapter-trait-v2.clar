;; adapter-trait-v2.clar
;; Extended adapter interface used by proxy-adapter.
;;
;; execute-via accepts the implementation as a typed <adapter-trait> argument.
;; This matches the concrete signature in proxy-adapter.clar exactly.
;;
;; NOTE: Clarity does not allow a trait to reference itself recursively,
;; so execute-via references the base adapter-trait, not adapter-trait-v2.

(use-trait adapter-trait .adapter-trait.adapter-trait)

(define-trait adapter-trait-v2
  (
    ;; Direct execution - implemented by concrete adapters (v1, v2, ...)
    (execute
      (uint (string-ascii 16))
      (response { amount: uint, allocated: uint } uint)
    )

    ;; Proxy execution - the impl is validated against the registry
    ;; inside the proxy before the call is forwarded.
    (execute-via
      (<adapter-trait> uint (string-ascii 16))
      (response { amount: uint, allocated: uint } uint)
    )

    ;; Total currently allocated in this adapter
    (get-balance
      ()
      (response uint uint)
    )
  )
)
