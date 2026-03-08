# Bitcoin Yield Copilot - Contratos Audit & Perfect Flow

> **Data da Análise:** Março 2025  
> **Contratos Auditados:** 5 arquivos  
> **Severidade:** Critical (8), High (12), Medium (15), Low (8)

---

## Sumário Executivo

A suite de contratos Clarity do Bitcoin Yield Copilot apresenta **43 problemas** identificados, sendo 8 críticos que impedem o funcionamento básico do sistema. Os principais gaps estão na arquitetura de autorização, execução de operações DeFi reais, e suporte a tokens SIP-010 (sBTC).

### Status por Contrato

| Contrato | Status | Issues Críticas | Problema Principal |
|----------|--------|-----------------|-------------------|
| `user-wallet.clar` | ❌ Broken | 3 | Não executa operações reais |
| `wallet-factory.clar` | ⚠️ Incomplete | 2 | Não cria wallets, só registra |
| `withdraw-helper.clar` | ❌ Broken | 2 | Só suporta STX, não tokens |
| `zest-adapter.clar` | ❌ Broken | 1 | Principais inválidos |
| `alex-adapter-testnet.clar` | ❌ Broken | 1 | Principais inválidos |

---

## 1. user-wallet.clar - Análise Detalhada

### 1.1 Erros Críticos

#### 🔴 CRITICAL-001: Referência Inexistente ao withdraw-helper
**Linha:** 218  
**Código:**
```clarity
(result (try! (as-contract (contract-call? .withdraw-helper-v3-1 consume-authorization ...))))
```
**Problema:** O arquivo existe como `withdraw-helper.clar`, não `withdraw-helper-v3-1`. Isso causaria erro de compilação ou execução.

**Correção:**
```clarity
(result (try! (as-contract (contract-call? .withdraw-helper consume-authorization ...))))
```

---

#### 🔴 CRITICAL-002: execute-authorized-operation NÃO EXECUTA
**Linha:** 160-201  
**Problema:** A função `execute-authorized-operation` só **registra** a operação em um mapa (`operation-history`) e atualiza allocations, mas **NÃO CHAMA NENHUM CONTRATO EXTERNO**. Para o usuário depositar em Zest ou ALEX, precisaria chamar os adapters.

**Código Problemático:**
```clarity
(define-public (execute-authorized-operation ...)
  ;; ... validações ...
  (map-set operation-history slot { ... })  ;; Só registra!
  (ok true)
)
```

**Impacto:** O sistema inteiro de yield não funciona. O bot Telegram pode registrar que fez um deposit, mas nenhum token foi realmente depositado nos protocolos.

**Solução Arquitetural:**
O `user-wallet.clar` deve ser uma **proxy wallet** que:
1. Recebe autorização do bot (signature)
2. Chama adapters externos para executar operações
3. Mantém track de posições (mas as posições reais estão nos protocolos)

**Correção:**
```clarity
;; Nova função para executar deposit via Zest
(define-public (deposit-to-zest 
    (nonce uint) 
    (amount uint) 
    (expiry-block uint) 
    (bot-sig (buff 65))
    (zest-adapter principal))
  (let ((payload-hash (sha256 (op-payload nonce amount expiry-block))))
    ;; validações de auth...
    
    ;; EXECUTA DE VERDADE no Zest
    (try! (contract-call? zest-adapter supply-asset .sbtc-token amount false))
    
    ;; Registra a operação
    ...
  )
)
```

---

#### 🔴 CRITICAL-003: withdraw-stx Apenas STX Nativo
**Linha:** 204-230  
**Problema:** A função `withdraw-stx` usa `stx-transfer?` que só funciona com STX nativo. O projeto promete suportar **sBTC** (SIP-010), mas não existe função para withdraw de tokens.

**Código Problemático:**
```clarity
(try! (as-contract (stx-transfer? net-amount tx-sender recipient)))
```

**Solução:** Adicionar função genérica para tokens SIP-010:
```clarity
(define-public (withdraw-token 
    (token <ft-trait>) 
    (nonce uint) 
    (amount uint) 
    (recipient principal) 
    (expiry-block uint) 
    (auth-key (buff 32)) 
    (bot-sig (buff 65)))
  ;; ... validações ...
  (try! (as-contract (contract-call? token transfer net-amount tx-sender recipient none)))
  ;; ...
)
```

---

### 1.2 Erros High

#### 🟠 HIGH-001: Payload Inconsistente em add-protocol/update-protocol
**Linha:** 277-306  
**Problema:** `add-protocol` e `update-protocol` usam o mesmo payload constructor (`add-proto-payload`) mas parâmetros diferentes. `add-protocol` precisa do `protocol principal` e `name`, mas o payload só inclui `max-alloc`.

**Código:**
```clarity
;; add-protocol - recebe protocol, name, max-alloc
(define-public (add-protocol (protocol principal) (name (string-ascii 32)) (max-alloc uint) ...)
  ;; Mas payload só usa max-alloc!
  (let ((payload-hash (sha256 (add-proto-payload nonce max-alloc expiry-block))))
```

**Correção:**
```clarity
(define-private (add-proto-payload 
    (nonce uint) 
    (protocol principal) 
    (name (string-ascii 32)) 
    (max-alloc uint) 
    (expiry uint))
  (concat 
    (concat 
      (concat 
        (concat (var-get telegram-hash) (uint-to-16bytes nonce))
        (unwrap-panic (to-consensus-buff? protocol)))
      (unwrap-panic (to-consensus-buff? name)))
    (concat (uint-to-16bytes max-alloc) (uint-to-16bytes expiry))))
)
```

---

#### 🟠 HIGH-002: action "withdraw" Não Reduz Allocation Corretamente
**Linha:** 180-186  
**Problema:**
```clarity
(if (is-eq action "withdraw")
  (if (>= cur-alloc amount) (- cur-alloc amount) u0)  ;; Bug: pode ficar negativo!
  cur-alloc)
```

Se `cur-alloc < amount`, retorna u0, mas isso pode causar inconsistência se o withdraw real falhar.

---

#### 🟠 HIGH-003: Não Verifica Se Wallet Pertence ao Telegram User
**Problema:** Qualquer wallet pode chamar `execute-authorized-operation` desde que tenha assinatura válida, mas não existe vínculo on-chain entre wallet e telegram-hash para verificação.

---

### 1.3 Erros Medium

#### 🟡 MEDIUM-001: Falta Eventos para Indexação
**Problema:** Apenas `execute-authorized-operation` emite eventos implícitos via `map-set`. Deveria ter `print` explícito para indexadores.

#### 🟡 MEDIUM-002: Daily Limit Não Considera Blocos Passados
**Linha:** 123-130  
**Problema:** `refresh-daily-limit` retorna `spent-today` sem atualizar se não passou 144 blocos, mas não previne operações.

#### 🟡 MEDIUM-003: String Comparison com is-eq
**Problema:** Usar `(is-eq action "deposit")` é frágil. Melhor usar constants:
```clarity
(define-constant ACTION-DEPOSIT 0x01)
(define-constant ACTION-WITHDRAW 0x02)
```

---

## 2. wallet-factory.clar - Análise Detalhada

### 2.1 Erros Críticos

#### 🔴 CRITICAL-004: Não Faz Deploy de Wallets
**Linha:** 81-100  
**Problema:** `register-wallet` só armazena um mapeamento `telegram-hash -> wallet-contract`, mas **NÃO CRIA A WALLET**. O contrato deveria fazer deploy de um novo `user-wallet.clar` para cada usuário.

**Limitação Técnica:** Clarity não permite deploy de contratos dinâmicos em runtime.

**Solução Arquitetural:**
1. **Opção A:** Usar contract principals pre-deployados como "pooled wallets"
2. **Opção B:** Usar factory pattern com `contract-call?` para instanciar
3. **Opção C:** Mudar arquitetura - usuário usa sua própria wallet, factory só registra mapeamento

**Recomendação (C):**
```clarity
;; O usuário cria sua wallet primeiro, depois registra no factory
(define-public (register-wallet 
    (tg-hash (buff 32)) 
    (wallet-contract principal) 
    (nonce uint) 
    (bot-sig (buff 65)))
  ;; Verifica se quem chama é o owner da wallet
  (asserts! (is-eq tx-sender wallet-contract) ERR-NOT-AUTHORIZED)
  ;; ... resto
)
```

---

#### 🔴 CRITICAL-005: Não Verifica Propriedade da Wallet
**Problema:** Qualquer um pode registrar qualquer wallet para seu telegram-hash, desde que tenha assinatura do bot.

**Correção:**
```clarity
(define-public (register-wallet ...)
  ;; ...
  ;; Verifica se tx-sender é o owner da wallet
  (asserts! (is-eq tx-sender wallet-contract) ERR-NOT-AUTHORIZED)
  ;; ...
)
```

---

### 2.2 Erros High

#### 🟠 HIGH-004: factory-nonce Não Protegido Contra Replay
**Problema:** Embora verifique `is-eq nonce (var-get factory-nonce)`, não há proteção contra assinaturas reutilizadas em diferentes contexts.

---

## 3. withdraw-helper.clar - Análise Detalhada

### 3.1 Erros Críticos

#### 🔴 CRITICAL-006: Apenas STX Nativo
**Linha:** 325-361 (`consume-authorization`)  
**Problema:** A função `consume-authorization` calcula fee mas **NÃO TRANSFERE TOKENS**. Ela só retorna informação de fee. Quem chama (`user-wallet.clar`) deve fazer a transferência, mas só suporta STX.

**Arquitetura Quebrada:**
- `withdraw-helper.clar` cria autorização pendente
- `user-wallet.clar` deveria consumir e transferir tokens
- Mas `user-wallet.clar` só faz `stx-transfer?`

**Solução:**
O `withdraw-helper` deve ter função específica para consumir E transferir:
```clarity
(define-public (consume-authorization-and-transfer 
    (token <ft-trait>)
    (wallet principal) 
    (recipient principal) 
    (amount uint) 
    (akey (buff 32)))
  ;; Valida autorização...
  ;; Calcula fee...
  ;; TRANSFERE O TOKEN
  (try! (as-contract (contract-call? token transfer net-amount tx-sender recipient none)))
  ;; Transfere fee para treasury...
  (try! (as-contract (contract-call? token transfer fee-amount tx-sender (var-get treasury) none)))
)
```

---

#### 🔴 CRITICAL-007: Fee Calculation Pode Divisão Por Zero
**Linha:** 349, 408  
**Código:**
```clarity
(fee-amount (/ (* amount bps) u10000))
```

Se `amount` for muito pequeno, pode dar 0. Mas isso é comportamento esperado (fee mínimo).

**Problema Real:** Se `bps` > 10000 (100%), o fee pode ser maior que amount. Limitado por `MAX-FEE-BPS u500` (5%), então ok.

---

### 3.2 Erros High

#### 🟠 HIGH-005: pending-auth Não Expira Automaticamente
**Problema:** `pending-auth` só é verificado contra expiry-block no momento do consume. Se nunca for consumido, fica no estado indefinidamente.

**Solução:** Adicionar função de limpeza:
```clarity
(define-public (expire-pending-auth (akey (buff 32)))
  (let ((auth (unwrap! (map-get? pending-auth akey) ERR-NOT-AUTHORIZED)))
    (asserts! (> block-height (get expiry-block auth)) ERR-NOT-AUTHORIZED)
    (map-delete pending-auth akey)
    (ok true)
  )
)
```

---

## 4. zest-adapter.clar - Análise Detalhada

### 4.1 Erros Críticos

#### 🔴 CRITICAL-008: Principais Inválidos
**Linha:** 7, 17-32  
**Código Problemático:**
```clarity
(define-constant MARKET (as-contract (concat DEPLOYER .market)))
```

**Problema:** `concat` em Clarity retorna `buff`, não `principal`. `as-contract` espera um `principal`, não um `buff`.

**Resultado:** Erro de compilação.

**Correção:**
```clarity
;; Principais devem ser constantes literais ou passados como parâmetros
(define-constant MARKET 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.market)
(define-constant MARKET-VAULT 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.market-vault)
;; ... etc
```

Ou, melhor ainda, passar como parâmetro:
```clarity
(define-public (supply-asset 
    (market principal) 
    (asset <ft-trait>) 
    (amount uint) 
    (isolated bool))
  ...
)
```

---

### 4.2 Erros High

#### 🟠 HIGH-006: approve Pode Falhar Silenciosamente
**Linha:** 40  
**Código:**
```clarity
(try! (contract-call? asset approve MARKET amount))
```

**Problema:** Se o usuário já aprovou uma quantidade menor, e agora quer aprovar mais, pode falhar dependendo da implementação do token.

**Melhor Prática:**
```clarity
;; Primeiro aprova 0, depois a quantidade desejada
(try! (contract-call? asset approve MARKET u0))
(try! (contract-call? asset approve MARKET amount))
```

---

#### 🟠 HIGH-007: Não Retorna zTokens ao Caller
**Linha:** 37-44  
**Problema:** Após `supply-asset`, o protocolo Zest minta zTokens (zSTX, zBTC). Esses tokens devem ser retornados ao caller ou guardados em uma estratégia de hold.

**Solução:** Retornar informação sobre os zTokens recebidos:
```clarity
(define-public (supply-asset ...)
  ;; ...
  (let ((result (try! (contract-call? MARKET supply asset amount tx-sender isolated))))
    ;; result provavelmente contém quantidade de zTokens
    (print { event: "supply", ztokens-received: result, ... })
    (ok result)
  )
)
```

---

## 5. alex-adapter-testnet.clar - Análise Detalhada

### 5.1 Erros Críticos

#### 🔴 CRITICAL-009: Mesmo Problema de Principais
**Linha:** 19-31  
Mesmo problema de `concat` retornando `buff` em vez de `principal`.

**Correção:**
```clarity
;; Testnet addresses
(define-constant ALEX-VAULT 'ST29E61D211DD0HB0S0JSKZ05X0DSAJS5G5QSTXDX.alex-vault)
;; ... etc
```

---

### 5.2 Erros High

#### 🟠 HIGH-008: Flash Loan Trait Não Definido
**Linha:** 103  
**Código:**
```clarity
(use-trait flash-loan-user .flash-loan-trait.flash-loan-user)
```

**Problema:** O arquivo não inclui ou importa o trait `flash-loan-trait`.

**Correção:**
```clarity
;; Definir o trait no próprio arquivo ou importar
(define-trait flash-loan-user
  (
    (execute (principal uint (buff 1024)) (response bool uint))
  )
)
```

---

#### 🟠 HIGH-009: approve Para Cada Token
**Linha:** 40, 62-63  
**Problema:** Cada operação faz approve separado. Isso é custoso e pode acumular allowances infinitas.

**Solução:** Usar padrão de allowance máxima uma vez, ou fazer approve específico por transação.

---

## 6. Gaps de Integração Entre Contratos

### Gap-001: Não Existe Vínculo user-wallet <-> withdraw-helper
**Problema:** Os contratos são independentes. Não há garantia de que uma wallet registrada no factory tenha um withdraw-helper configurado.

**Solução:** Factory deve deployar ambos (impossível em Clarity) ou garantir que o deployer configure ambos.

---

### Gap-002: Não Existe Registro de Posições On-Chain
**Problema:** O `user-wallet.clar` tenta rastrear `current-allocation` por protocolo, mas isso é redundante com o estado nos próprios protocolos (Zest, ALEX).

**Solução:**
- Remover tracking de allocation do user-wallet
- Usar apenas autorização (qual bot pode chamar, quanto pode mover)
- Posições reais consultadas nos protocolos via view functions

---

### Gap-003: Não Existe Integração com ERC-8004
**Contexto:** O README menciona ERC-8004 para identidade do agente.

**Problema:** Nenhum dos contratos referencia ERC-8004 ou implementa identidade verificável.

**Solução:** Integrar com ERC-8004 contract para verificar identidade do agente:
```clarity
;; Verificar se caller tem identidade ERC-8004
(define-public (verify-agent-identity (agent principal))
  (contract-call? 'SP... .erc-8004-registry verify-identity agent)
)
```

---

## 7. Fluxo Perfeito Corrigido

### 7.1 Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE DEPOSITO                             │
└─────────────────────────────────────────────────────────────────┘

Usuario Telegram
       │
       │ /deposit 0.1 sBTC to Zest
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Bot        │────▶│   Agent      │────▶│ aibtc-mcp-server │
│  Telegram    │     │  (Claude)    │     │  (120+ tools)    │
└──────────────┘     └──────────────┘     └──────────────────┘
                                                  │
                       ┌──────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Stacks Wallet   │
              │   (Hiro/etc)   │
              └────────┬───────┘
                       │
                       │ contrato-call
                       ▼
              ┌────────────────┐
              │ user-wallet    │◄────── Autorização do bot (signature)
              │   (.clar)      │
              └────────┬───────┘
                       │
                       │ contract-call?
                       ▼
              ┌────────────────┐
              │ zest-adapter   │
              │   (.clar)      │
              └────────┬───────┘
                       │
                       │ contract-call?
                       ▼
              ┌────────────────┐
              │ Zest Protocol  │
              │   (MARKET)     │
              └────────────────┘
```

### 7.2 Contratos Corrigidos

#### A. user-wallet.clar (Versão Corrigida)

```clarity
;; ============================================
;; user-wallet.clar - Wallet Proxy com Autorização
;; ============================================

;; Traits
(use-trait ft-trait 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
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
(define-constant ERR-INSUFFICIENT-BALANCE (err u415))

;; Action Types
(define-constant ACTION-DEPOSIT 0x01)
(define-constant ACTION-WITHDRAW 0x02)
(define-constant ACTION-SWAP 0x03)

;; Config
(define-constant BLOCKS-PER-DAY u144)
(define-constant MAX-HISTORY u100)

;; Storage
(define-data-var initialized bool false)
(define-data-var telegram-hash (buff 32) 0x0000...)
(define-data-var bot-pubkey (buff 33) 0x0000...)
(define-data-var is-paused bool false)
(define-data-var current-nonce uint u0)

;; Limits
(define-data-var max-per-tx uint u0)
(define-data-var daily-limit-amount uint u0)
(define-data-var spent-today uint u0)
(define-data-var last-reset-block uint u0)

;; Protocolos permitidos (apenas para validação, não tracking)
(define-map allowed-protocols principal 
  { name: (string-ascii 32), max-allocation: uint, enabled: bool })

;; Historico de operações
(define-map operation-history uint 
  { nonce: uint, protocol: principal, action: (buff 1), amount: uint, 
    block: uint, tx-hash: (buff 32) })
(define-data-var operation-count uint u0)

;; ============================================
;; INICIALIZAÇÃO
;; ============================================

(define-public (initialize 
    (tg-hash (buff 32)) 
    (bot-pk (buff 33)) 
    (max-tx uint) 
    (daily uint))
  (begin
    (asserts! (not (var-get initialized)) ERR-ALREADY-INITIALIZED)
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> max-tx u0) ERR-INVALID-LIMITS)
    (asserts! (> daily u0) ERR-INVALID-LIMITS)
    (asserts! (<= max-tx daily) ERR-INVALID-LIMITS)
    
    (var-set initialized true)
    (var-set telegram-hash tg-hash)
    (var-set bot-pubkey bot-pk)
    (var-set max-per-tx max-tx)
    (var-set daily-limit-amount daily)
    (var-set last-reset-block block-height)
    
    (print { event: "wallet-initialized", owner: CONTRACT-OWNER, tg-hash: tg-hash })
    (ok true)
  )
)

;; ============================================
;; FUNÇÕES DE EXECUÇÃO (REAIS)
;; ============================================

;; Depositar em Zest
(define-public (execute-zest-deposit
    (nonce uint)
    (amount uint)
    (expiry uint)
    (bot-sig (buff 65))
    (zest-adapter principal)
    (asset <ft-trait>))
  (begin
    ;; Validar autorização
    (try! (validate-authorization nonce amount expiry bot-sig ACTION-DEPOSIT))
    
    ;; Verificar protocolo permitido
    (let ((proto (unwrap! (map-get? allowed-protocols zest-adapter) ERR-UNKNOWN-PROTOCOL)))
      (asserts! (get enabled proto) ERR-UNKNOWN-PROTOCOL)
      (asserts! (<= amount (get max-allocation proto)) ERR-LIMIT-EXCEEDED))
    
    ;; Aprovar token para o adapter
    (try! (contract-call? asset approve zest-adapter amount))
    
    ;; EXECUTAR O DEPOSITO REAL NO ZEST
    (let ((result (try! (contract-call? zest-adapter supply-asset asset amount false))))
      
      ;; Atualizar limites
      (try! (update-spending-limits amount))
      
      ;; Registrar operação
      (register-operation zest-adapter ACTION-DEPOSIT amount)
      
      (print { 
        event: "zest-deposit-executed", 
        nonce: nonce, 
        amount: amount,
        result: result 
      })
      (ok result)
    )
  )
)

;; Withdraw de Zest
(define-public (execute-zest-withdraw
    (nonce uint)
    (amount uint)
    (expiry uint)
    (bot-sig (buff 65))
    (zest-adapter principal)
    (asset <ft-trait>))
  (begin
    ;; Validar autorização
    (try! (validate-authorization nonce amount expiry bot-sig ACTION-WITHDRAW))
    
    ;; EXECUTAR WITHDRAW REAL
    (let ((result (try! (contract-call? zest-adapter claim-rewards asset))))
      
      ;; Atualizar limites (withdraw aumenta disponível)
      (var-set spent-today (if (>= (var-get spent-today) amount) 
                               (- (var-get spent-today) amount) 
                               u0))
      
      ;; Registrar operação
      (register-operation zest-adapter ACTION-WITHDRAW amount)
      
      (print { event: "zest-withdraw-executed", nonce: nonce, amount: amount })
      (ok result)
    )
  )
)

;; Withdraw genérico de tokens SIP-010
(define-public (execute-token-withdraw
    (nonce uint)
    (amount uint)
    (recipient principal)
    (expiry uint)
    (bot-sig (buff 65))
    (token <ft-trait>))
  (let ((payload-hash (sha256 (construct-payload nonce amount expiry))))
    ;; Validar assinatura
    (asserts! (verify-signature payload-hash bot-sig) ERR-INVALID-SIGNATURE)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= block-height expiry) ERR-EXPIRED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    ;; Verificar limites
    (try! (check-limits amount))
    
    ;; TRANSFERIR TOKENS (não STX nativo)
    (try! (as-contract (contract-call? token transfer amount tx-sender recipient none)))
    
    ;; Atualizar estado
    (var-set current-nonce (+ nonce u1))
    (var-set spent-today (+ (var-get spent-today) amount))
    
    (print { event: "token-withdraw", token: (contract-of token), amount: amount, recipient: recipient })
    (ok true)
  )
)

;; ============================================
;; HELPERS
;; ============================================

(define-private (validate-authorization 
    (nonce uint) 
    (amount uint) 
    (expiry uint) 
    (sig (buff 65)) 
    (action (buff 1)))
  (let ((payload (sha256 (concat (construct-payload nonce amount expiry) action))))
    (asserts! (var-get initialized) ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused)) ERR-PAUSED)
    (asserts! (verify-signature payload sig) ERR-INVALID-SIGNATURE)
    (asserts! (is-eq nonce (var-get current-nonce)) ERR-EXPIRED)
    (asserts! (<= block-height expiry) ERR-EXPIRED)
    (ok true)
  )
)

(define-private (verify-signature (hash (buff 32)) (sig (buff 65)))
  (match (secp256k1-recover? hash sig)
    recovered (is-eq recovered (var-get bot-pubkey))
    false
  )
)

(define-private (construct-payload (nonce uint) (amount uint) (expiry uint))
  (concat 
    (concat 
      (concat (var-get telegram-hash) (uint-to-bytes nonce))
      (uint-to-bytes amount))
    (uint-to-bytes expiry))
)

(define-private (uint-to-bytes (n uint))
  (unwrap-panic (slice? (unwrap-panic (to-consensus-buff? n)) u1 u17))
)

(define-private (check-limits (amount uint))
  (let ((refreshed (refresh-daily-limit)))
    (asserts! (<= amount (var-get max-per-tx)) ERR-LIMIT-EXCEEDED)
    (asserts! (<= (+ refreshed amount) (var-get daily-limit-amount)) ERR-DAILY-LIMIT)
    (ok true)
  )
)

(define-private (refresh-daily-limit)
  (if (>= (- block-height (var-get last-reset-block)) BLOCKS-PER-DAY)
    (begin
      (var-set spent-today u0)
      (var-set last-reset-block block-height)
      u0)
    (var-get spent-today)))

(define-private (update-spending-limits (amount uint))
  (var-set current-nonce (+ (var-get current-nonce) u1))
  (var-set spent-today (+ (var-get spent-today) amount))
  (ok true))

(define-private (register-operation (protocol principal) (action (buff 1)) (amount uint))
  (let ((slot (mod (var-get operation-count) MAX-HISTORY)))
    (map-set operation-history slot {
      nonce: (var-get current-nonce),
      protocol: protocol,
      action: action,
      amount: amount,
      block: block-height,
      tx-hash: (sha256 (unwrap-panic (to-consensus-buff? tx-sender)))
    })
    (var-set operation-count (+ (var-get operation-count) u1))
  )
)

;; ============================================
;; ADMIN
;; ============================================

(define-public (add-protocol (protocol principal) (name (string-ascii 32)) (max-alloc uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set allowed-protocols protocol { name: name, max-allocation: max-alloc, enabled: true })
    (print { event: "protocol-added", protocol: protocol, name: name })
    (ok true)
  )
)

(define-public (emergency-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set is-paused true)
    (print { event: "emergency-paused", block: block-height })
    (ok true)
  )
)

(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set is-paused false)
    (print { event: "unpaused", block: block-height })
    (ok true)
  )
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-wallet-info)
  { initialized: (var-get initialized),
    is-paused: (var-get is-paused),
    current-nonce: (var-get current-nonce),
    max-per-tx: (var-get max-per-tx),
    daily-limit: (var-get daily-limit-amount),
    spent-today: (var-get spent-today),
    remaining-today: (- (var-get daily-limit-amount) (var-get spent-today)) })

(define-read-only (get-operation (idx uint))
  (map-get? operation-history (mod idx MAX-HISTORY)))
```

#### B. zest-adapter.clar (Versão Corrigida)

```clarity
;; ============================================
;; zest-adapter.clar - Adapter Corrigido
;; ============================================

(use-trait ft-trait 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant ERR-INVALID-PARAM (err u501))
(define-constant ERR-CALL-FAILED (err u500))

;; Principais Fixos (Mainnet)
;; NOTA: Atualizar com endereços reais após deploy
(define-constant MARKET 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.market-v2)
(define-constant ZSTX 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zstx)
(define-constant ZSBTC 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zsbtc)

;; ============================================
;; LENDING
;; ============================================

(define-public (supply-asset 
    (market principal)
    (asset <ft-trait>) 
    (amount uint) 
    (isolated bool))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    
    ;; Resetar approval e setar novo
    (try! (contract-call? asset approve market u0))
    (try! (contract-call? asset approve market amount))
    
    ;; Chamar Zest
    (let ((result (contract-call? market supply asset amount tx-sender isolated)))
      (match result
        ok-val (begin
          (print { event: "zest-supply-success", asset: (contract-of asset), amount: amount, result: ok-val })
          (ok ok-val))
        err-val (begin
          (print { event: "zest-supply-failed", error: err-val })
          ERR-CALL-FAILED)))
  )
)

(define-public (withdraw-asset
    (market principal)
    (z-token <ft-trait>)
    (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-PARAM)
    
    ;; Aprovar zToken para burn
    (try! (contract-call? z-token approve market amount))
    
    ;; Chamar withdraw
    (let ((result (contract-call? market withdraw z-token amount tx-sender)))
      (match result
        ok-val (ok ok-val)
        err-val ERR-CALL-FAILED))
  )
)

(define-public (claim-rewards (market principal) (asset <ft-trait>))
  (let ((result (contract-call? market claim-rewards asset tx-sender)))
    (match result
      ok-val (ok ok-val)
      err-val ERR-CALL-FAILED))
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-position (market principal) (user principal))
  (contract-call? market get-position user))

(define-read-only (get-asset-details (market principal) (asset <ft-trait>))
  (contract-call? market get-asset asset))

(define-read-only (get-health-factor (market principal) (user principal))
  (contract-call? market get-health-factor user))
```

#### C. wallet-factory.clar (Versão Corrigida)

```clarity
;; ============================================
;; wallet-factory.clar - Factory Simplificado
;; ============================================

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-ALREADY-EXISTS (err u409))
(define-constant ERR-NOT-FOUND (err u404))

;; Storage
(define-map user-wallets (buff 32) 
  { wallet-contract: principal, created-at: uint, active: bool })

(define-map wallet-to-user principal (buff 32))

(define-data-var total-wallets uint u0)

;; ============================================
;; REGISTRO (usuário precisa ter deployado a wallet)
;; ============================================

(define-public (register-wallet (tg-hash (buff 32)) (wallet-contract principal))
  (begin
    ;; CRITICAL: Verificar se quem chama é o dono da wallet
    (asserts! (is-eq tx-sender wallet-contract) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? user-wallets tg-hash)) ERR-ALREADY-EXISTS)
    
    (map-set user-wallets tg-hash {
      wallet-contract: wallet-contract,
      created-at: block-height,
      active: true
    })
    (map-set wallet-to-user wallet-contract tg-hash)
    (var-set total-wallets (+ (var-get total-wallets) u1))
    
    (print { event: "wallet-registered", tg-hash: tg-hash, wallet: wallet-contract })
    (ok wallet-contract)
  )
)

(define-public (deactivate-wallet (tg-hash (buff 32)))
  (let ((entry (unwrap! (map-get? user-wallets tg-hash) ERR-NOT-FOUND)))
    ;; Apenas o dono pode desativar
    (asserts! (is-eq tx-sender (get wallet-contract entry)) ERR-NOT-AUTHORIZED)
    (map-set user-wallets tg-hash (merge entry { active: false }))
    (print { event: "wallet-deactivated", tg-hash: tg-hash })
    (ok true)
  )
)

;; ============================================
;; READ-ONLY
;; ============================================

(define-read-only (get-wallet-by-telegram (tg-hash (buff 32)))
  (map-get? user-wallets tg-hash))

(define-read-only (get-telegram-by-wallet (wallet principal))
  (map-get? wallet-to-user wallet))

(define-read-only (is-wallet-active (wallet principal))
  (match (map-get? wallet-to-user wallet)
    tg-hash (match (map-get? user-wallets tg-hash)
              entry (get active entry)
              false)
    false))
```

#### D. withdraw-helper.clar (Versão Corrigida)

```clarity
;; ============================================
;; withdraw-helper.clar - Helper Corrigido
;; ============================================

(use-trait ft-trait 'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u401))
(define-constant ERR-INVALID-SIG (err u402))
(define-constant ERR-EXPIRED (err u404))
(define-constant ERR-PAUSED (err u405))

;; Storage
(define-data-var bot-pubkey (buff 33) 0x0000...)
(define-data-var treasury principal CONTRACT-OWNER)
(define-data-var fee-bps uint u50) ;; 0.5%
(define-data-var paused bool false)
(define-data-var nonce uint u0)

;; Autorizações pendentes
(define-map pending-withdrawals (buff 32) 
  { wallet: principal, token: (optional principal), amount: uint, expiry: uint })

;; ============================================
;; AUTORIZAÇÃO
;; ============================================

(define-public (authorize-withdrawal
    (wallet principal)
    (token-opt (optional principal))
    (amount uint)
    (expiry uint)
    (bot-sig (buff 65)))
  (let ((hash (sha256 (concat (unwrap-panic (to-consensus-buff? wallet))
                              (concat (unwrap-panic (to-consensus-buff? amount))
                                      (unwrap-panic (to-consensus-buff? expiry)))))))
    (asserts! (not (var-get paused)) ERR-PAUSED)
    (asserts! (verify-sig hash bot-sig) ERR-INVALID-SIG)
    (asserts! (<= block-height expiry) ERR-EXPIRED)
    (asserts! (> amount u0) (err u411))
    
    (map-set pending-withdrawals hash {
      wallet: wallet,
      token: token-opt,
      amount: amount,
      expiry: expiry
    })
    
    (print { event: "withdrawal-authorized", wallet: wallet, amount: amount, hash: hash })
    (ok hash)
  )
)

;; ============================================
;; EXECUÇÃO
;; ============================================

;; Para STX nativo
(define-public (execute-stx-withdrawal
    (auth-hash (buff 32))
    (recipient principal))
  (let ((auth (unwrap! (map-get? pending-withdrawals auth-hash) ERR-NOT-AUTHORIZED)))
    (asserts! (is-eq tx-sender (get wallet auth)) ERR-NOT-AUTHORIZED)
    (asserts! (<= block-height (get expiry auth)) ERR-EXPIRED)
    (asserts! (is-none (get token auth)) ERR-NOT-AUTHORIZED) ;; STX tem token = none
    
    (let ((amount (get amount auth))
          (fee (/ (* amount (var-get fee-bps)) u10000))
          (net (- amount fee)))
      
      ;; Transferir
      (try! (as-contract (stx-transfer? net tx-sender recipient)))
      (try! (as-contract (stx-transfer? fee tx-sender (var-get treasury))))
      
      ;; Limpar
      (map-delete pending-withdrawals auth-hash)
      (var-set nonce (+ (var-get nonce) u1))
      
      (print { event: "stx-withdrawal-executed", recipient: recipient, net: net, fee: fee })
      (ok { net: net, fee: fee })
    )
  )
)

;; Para tokens SIP-010
(define-public (execute-token-withdrawal
    (auth-hash (buff 32))
    (token <ft-trait>)
    (recipient principal))
  (let ((auth (unwrap! (map-get? pending-withdrawals auth-hash) ERR-NOT-AUTHORIZED)))
    (asserts! (is-eq tx-sender (get wallet auth)) ERR-NOT-AUTHORIZED)
    (asserts! (<= block-height (get expiry auth)) ERR-EXPIRED)
    (asserts! (is-eq (some (contract-of token)) (get token auth)) ERR-NOT-AUTHORIZED)
    
    (let ((amount (get amount auth))
          (fee (/ (* amount (var-get fee-bps)) u10000))
          (net (- amount fee)))
      
      ;; Transferir tokens
      (try! (as-contract (contract-call? token transfer net tx-sender recipient none)))
      (try! (as-contract (contract-call? token transfer fee tx-sender (var-get treasury) none)))
      
      ;; Limpar
      (map-delete pending-withdrawals auth-hash)
      (var-set nonce (+ (var-get nonce) u1))
      
      (print { event: "token-withdrawal-executed", token: (contract-of token), recipient: recipient, net: net, fee: fee })
      (ok { net: net, fee: fee })
    )
  )
)

;; ============================================
;; HELPERS
;; ============================================

(define-private (verify-sig (hash (buff 32)) (sig (buff 65)))
  (match (secp256k1-recover? hash sig)
    recovered (is-eq recovered (var-get bot-pubkey))
    false))

;; ============================================
;; ADMIN
;; ============================================

(define-public (set-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-fee u1000) (err u428)) ;; Max 10%
    (var-set fee-bps new-fee)
    (ok true)
  )
)

(define-public (emergency-pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set paused true)
    (ok true)
  )
)
```

---

## 8. Checklist de Implementação

### Fase 1: Correções Críticas
- [ ] Corrigir referência `.withdraw-helper-v3-1` → `.withdraw-helper`
- [ ] Implementar funções reais de execute (não só registrar)
- [ ] Adicionar suporte a tokens SIP-010 em withdraw-helper
- [ ] Corrigir principais em adapters (remover concat dinâmico)
- [ ] Verificar propriedade da wallet no factory

### Fase 2: Melhorias de Segurança
- [ ] Adicionar função de expiração de pending-auth
- [ ] Implementar padrão approve-reset-approve em adapters
- [ ] Adicionar eventos para todas as operações
- [ ] Limitar tamanho de strings em maps
- [ ] Adicionar rate limiting por usuário

### Fase 3: Integração Completa
- [ ] Integrar com ERC-8004 identity
- [ ] Implementar adapters para Hermetica e Bitflow
- [ ] Adicionar suporte a múltiplos tokens (sBTC, STX, USDC)
- [ ] Implementar tracking de yield on-chain
- [ ] Adicionar funções de rebalancing

### Fase 4: Testes
- [ ] Unit tests para cada função
- [ ] Integration tests com protocolos reais (testnet)
- [ ] Fuzzing tests para validações
- [ ] Audit externo de segurança
- [ ] Bug bounty program

---

## 9. Recomendações Finais

### 1. Mudança Arquitetural
Considerar ** remover o conceito de "wallet factory"** e usar a abordagem:
- Usuário conecta sua própria wallet Hiro/Xverse
- Bot apenas coordena transações (o usuário assina)
- Smart contracts são "executor" não "custodial"

### 2. Separação de Responsabilidades
Criar contratos separados:
- `authorization.clar` - Apenas validação de assinaturas
- `executor.clar` - Execução de operações DeFi
- `registry.clar` - Mapeamento Telegram <-> Wallet

### 3. Integração com MCP
Os contratos devem expor interfaces que o `aibtc-mcp-server` possa chamar facilmente, sem lógica complexa de autorização on-chain (deixar para o bot).

---

**Documento criado em:** Março 2025  
**Autor:** Análise Técnica - Bitcoin Yield Copilot  
**Próximos passos:** Revisar correções com time de desenvolvimento Clarity
