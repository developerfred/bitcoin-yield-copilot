;; proxy-registry.clar
;; Stores and versions adapter implementations
;; Only the contract owner can perform upgrades

(define-constant CONTRACT-OWNER tx-sender)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-SAME-IMPL (err u409))

;; Current implementation per adapter name
(define-map implementations
  (string-ascii 32)
  { impl: principal, version: uint, updated-at: uint }
)

;; Full version history per adapter name
(define-map impl-history
  { name: (string-ascii 32), version: uint }
  principal
)

;; ============================================
;; WRITE
;; ============================================

(define-public (set-implementation
    (name (string-ascii 32))
    (new-impl principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)

    (let (
      (current     (map-get? implementations name))
      (new-version (match current entry (+ (get version entry) u1) u1))
    )
      ;; Prevent redundant upgrade to same contract
      (match current
        entry (asserts! (not (is-eq (get impl entry) new-impl)) ERR-SAME-IMPL)
        true)

      ;; Archive current version before overwriting
      (match current
        entry (map-set impl-history
                { name: name, version: (get version entry) }
                (get impl entry))
        true)

      (map-set implementations name
        { impl:       new-impl,
          version:    new-version,
          updated-at: stacks-block-height })

      (print { event:    "implementation-upgraded",
               name:     name,
               new-impl: new-impl,
               version:  new-version,
               block:    stacks-block-height })

      (ok new-version)
    )
  )
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-implementation (name (string-ascii 32)))
  (map-get? implementations name)
)

(define-read-only (get-impl-principal (name (string-ascii 32)))
  (match (map-get? implementations name)
    entry (some (get impl entry))
    none)
)

(define-read-only (get-impl-version (name (string-ascii 32)))
  (match (map-get? implementations name)
    entry (some (get version entry))
    none)
)

(define-read-only (get-historical-impl (name (string-ascii 32)) (version uint))
  (map-get? impl-history { name: name, version: version })
)
