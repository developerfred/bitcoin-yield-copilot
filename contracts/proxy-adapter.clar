;; proxy-adapter.clar
;; Stable proxy entry point - this address never changes.
;; Implements adapter-trait (v1 compat) and adapter-trait-v2 (proxy dispatch).
;;
;; execute-via receives the implementation as a typed <adapter-trait> argument.
;; The proxy validates it against the registry before delegating.

(use-trait adapter-trait .adapter-trait.adapter-trait)

(impl-trait .adapter-trait.adapter-trait)
(impl-trait .adapter-trait-v2.adapter-trait-v2)

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-INVALID-AMOUNT (err u400))
(define-constant ERR-IMPL-NOT-FOUND (err u410))
(define-constant ERR-IMPL-MISMATCH  (err u411))

;; Key used to look up this proxy in the registry
(define-constant PROXY-NAME "adapter-alex")

;; ============================================
;; PROXY DISPATCH
;; ============================================

;; Primary entry point for upgradeable execution.
;; The caller supplies the current implementation as a typed trait argument.
;; The proxy verifies it matches the registry, then delegates.
;;
;; Usage from user-wallet:
;;   (contract-call? .proxy-adapter execute-via .adapter-alex-v1 amount "deposit")
(define-public (execute-via
    (impl <adapter-trait>)
    (amount uint)
    (action (string-ascii 16)))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    ;; Fetch the currently registered implementation principal
    (let ((registered (unwrap!
                        (contract-call? .proxy-registry get-impl-principal PROXY-NAME)
                        ERR-IMPL-NOT-FOUND)))

      ;; Reject any impl that is not the registered one
      (asserts! (is-eq (contract-of impl) registered) ERR-IMPL-MISMATCH)

      ;; Delegate to the validated implementation
      (contract-call? impl execute amount action)
    )
  )
)

;; adapter-trait-v2: execute-via with principal argument.
;; Used when the caller cannot pass a typed trait (e.g. internal cross-contract calls).
;; Registry check still enforced - no unregistered impl can be injected.
(define-public (execute-via-principal
    (impl principal)
    (amount uint)
    (action (string-ascii 16)))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    (let ((registered (unwrap!
                        (contract-call? .proxy-registry get-impl-principal PROXY-NAME)
                        ERR-IMPL-NOT-FOUND)))
      (asserts! (is-eq impl registered) ERR-IMPL-MISMATCH)

      ;; Cannot call dynamic principal directly in Clarity -
      ;; this function exists for registry validation only.
      ;; Callers must use execute-via with a typed trait argument.
      ERR-IMPL-NOT-FOUND
    )
  )
)

;; adapter-trait compatibility shim - direct calls are blocked.
;; Always use execute-via with the current implementation as argument.
(define-public (execute (amount uint) (action (string-ascii 16)))
  ERR-IMPL-NOT-FOUND
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-balance)
  (ok u0)
)

(define-read-only (get-current-impl)
  (contract-call? .proxy-registry get-implementation PROXY-NAME)
)

(define-read-only (get-current-version)
  (contract-call? .proxy-registry get-impl-version PROXY-NAME)
)

(define-read-only (is-registered-impl (impl principal))
  (match (contract-call? .proxy-registry get-impl-principal PROXY-NAME)
    registered (is-eq impl registered)
    false)
)
