;; adapter-trait.clar
;; Interface comum para todos os adapters de protocolo

(define-trait adapter-trait
  (
    ;; Executar deposit ou withdraw no protocolo externo
    ;; action: "deposit" ou "withdraw"
    ;; Retorna o amount efetivamente processado e o total alocado
    (execute
      (uint (string-ascii 16))
      (response { amount: uint, allocated: uint } uint)
    )

    ;; Total atualmente alocado neste adapter
    (get-balance
      ()
      (response uint uint)
    )
  )
)
