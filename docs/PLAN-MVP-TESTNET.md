# Plano de Integração — Bot Telegram + Contratos Stacks

## Visão Geral da Arquitetura

```
Telegram User
      │
      ▼
  Telegram Bot (TypeScript)
      │  assina payloads com bot-privkey
      │  valida identidade via tg-hash
      ▼
  user-wallet.clar          ← hub central de cada usuário
      │  valida assinatura
      │  verifica limites (per-tx, daily, allocation)
      │  registra histórico
      ▼
  adapter-*.clar            ← nossos adapters (allowed-protocols)
      │  interface uniforme via adapter-trait
      │  encapsula lógica de cada protocolo externo
      ▼
  Protocolo Externo         ← ALEX, Zest, Hermetica, Bitflow...
      (só o adapter conhece o protocolo — user-wallet nunca fala direto)

  withdraw-helper.clar      ← fluxo separado só para saques STX
  wallet-factory.clar       ← registry global tg-hash → wallet-contract
```

---

## Estado Atual vs Target

| Componente | Estado Atual | Target |
|---|---|---|
| `op-payload` | sem domain, sem protocol, sem action | domain u40 + sha256(protocol) + sha256(action) |
| `withdraw-payload` | sem wallet-hash | com wallet-hash (compatível com withdraw-helper) |
| `add-proto-payload` | sem domain, sem protocol-hash | domain u50 + sha256(protocol) |
| `update-proto-payload` | mesmo payload que add | domain u51 + sha256(protocol) |
| `limits-payload` | sem domain | domain u60 |
| cross-contract call ao adapter | ausente | chama `protocol.execute` via trait |
| `adapter-trait` | não existe | interface comum para todos os adapters |
| `adapter-alex` | não existe | wraps ALEX AMM |
| `payload-builder.ts` | não existe | espelha todos os payloads em TypeScript |
| fluxo saque 2 passos | não orquestrado | authorize-withdrawal → withdraw-stx |
| endereço protocolo withdraw | `wallet.contractAddress` (errado) | `WITHDRAW_HELPER_CONTRACT` env |

---

## Parte 1 — Contratos

### 1.1 `adapter-trait.clar` (novo)

Interface que todos os adapters devem implementar. O `user-wallet` só conhece esta trait.

```clarity
;; adapter-trait.clar

(define-trait adapter-trait
  (
    ;; Executar deposit ou withdraw no protocolo externo
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
```

---

### 1.2 `user-wallet.clar` — correções

#### A) Novos domain tags

```clarity
;; Adicionar abaixo dos domain tags existentes (u10, u20, u21)
(define-constant DOMAIN-OP-EXECUTE   u40)
(define-constant DOMAIN-ADD-PROTOCOL u50)
(define-constant DOMAIN-UPD-PROTOCOL u51)
(define-constant DOMAIN-UPD-LIMITS   u60)
```

#### B) `op-payload` — incluir domain + protocol + action

```clarity
;; ANTES — sem domain, sem protocol, sem action (replay cross-protocol possível)
(define-private (op-payload (nonce uint) (amount uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes nonce)
      (concat (uint-to-16bytes amount)
              (uint-to-16bytes expiry))))
)

;; DEPOIS
(define-private (op-payload
    (nonce uint) (protocol principal)
    (action (string-ascii 16)) (amount uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-OP-EXECUTE)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (sha256 (unwrap-panic (to-consensus-buff? action)))
          (concat (uint-to-16bytes nonce)
            (concat (uint-to-16bytes amount)
                    (uint-to-16bytes expiry)))))))
)
```

#### C) `withdraw-payload` — incluir wallet-hash

Permite que `withdraw-stx` e `authorize-withdrawal` usem **o mesmo hash** — o bot assina uma vez.

```clarity
;; DEPOIS — inclui self-hash para amarrar à carteira específica
(define-private (withdraw-payload (nonce uint) (amount uint) (expiry uint) (recip-hash (buff 32)))
  (let ((self-hash (sha256 (unwrap-panic (to-consensus-buff? (as-contract tx-sender))))))
    (concat (var-get telegram-hash)
      (concat (uint-to-16bytes DOMAIN-WITHDRAW)
        (concat self-hash
          (concat (uint-to-16bytes nonce)
            (concat (uint-to-16bytes amount)
              (concat (uint-to-16bytes expiry)
                      recip-hash))))))
  )
)
```

#### D) Separar `add-proto-payload` e `update-proto-payload`

```clarity
;; ADD — domain u50
(define-private (add-proto-payload
    (nonce uint) (protocol principal) (max-alloc uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-ADD-PROTOCOL)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (uint-to-16bytes nonce)
          (concat (uint-to-16bytes max-alloc)
                  (uint-to-16bytes expiry))))))
)

;; UPDATE — domain u51 (mesma estrutura, domain diferente)
(define-private (update-proto-payload
    (nonce uint) (protocol principal) (max-alloc uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-UPD-PROTOCOL)
      (concat (sha256 (unwrap-panic (to-consensus-buff? protocol)))
        (concat (uint-to-16bytes nonce)
          (concat (uint-to-16bytes max-alloc)
                  (uint-to-16bytes expiry))))))
)
```

#### E) `limits-payload` — adicionar domain

```clarity
;; DEPOIS
(define-private (limits-payload (nonce uint) (new-max uint) (new-daily uint) (expiry uint))
  (concat (var-get telegram-hash)
    (concat (uint-to-16bytes DOMAIN-UPD-LIMITS)
      (concat (uint-to-16bytes nonce)
        (concat (uint-to-16bytes new-max)
          (concat (uint-to-16bytes new-daily)
                  (uint-to-16bytes expiry))))))
)
```

#### F) `execute-authorized-operation` — trait + cross-contract call

```clarity
(define-public (execute-authorized-operation
    (nonce uint) (protocol <adapter-trait>)
    (action (string-ascii 16)) (amount uint)
    (expiry-block uint) (bot-sig (buff 65)))
  (let (
    (payload-hash (sha256 (op-payload nonce (contract-of protocol) action amount expiry-block)))
    (current-spent (refresh-daily-limit))
  )
    (asserts! (var-get initialized)                              ERR-NOT-INITIALIZED)
    (asserts! (not (var-get is-paused))                          ERR-PAUSED)
    (asserts! (> amount u0)                                      ERR-ZERO-AMOUNT)
    (asserts! (is-eq nonce (var-get current-nonce))              ERR-EXPIRED)
    (asserts! (<= stacks-block-height expiry-block)              ERR-EXPIRED)
    (asserts! (verify-sig payload-hash bot-sig)                  ERR-INVALID-SIGNATURE)

    (let ((proto (unwrap! (map-get? allowed-protocols (contract-of protocol)) ERR-UNKNOWN-PROTOCOL)))
      (asserts! (get enabled proto)                              ERR-UNKNOWN-PROTOCOL)
      (asserts! (<= amount (var-get max-per-tx))                 ERR-LIMIT-EXCEEDED)
      (asserts! (<= (+ current-spent amount) (var-get daily-limit-amount)) ERR-DAILY-LIMIT)

      (let (
        (cur-alloc (get current-allocation proto))
        (max-alloc (get max-allocation proto))
        (new-alloc (if (is-eq action "deposit")
            (begin
              (asserts! (<= (+ cur-alloc amount) max-alloc) ERR-ALLOCATION-EXCEEDED)
              (+ cur-alloc amount))
            (if (is-eq action "withdraw")
              (if (>= cur-alloc amount) (- cur-alloc amount) u0)
              cur-alloc)))
      )
        ;; Cross-contract call ao adapter via trait
        (let ((result (try! (as-contract (contract-call? protocol execute amount action)))))
          (var-set current-nonce (+ (var-get current-nonce) u1))
          (var-set spent-today (+ current-spent amount))
          (map-set allowed-protocols (contract-of protocol)
            (merge proto { current-allocation: new-alloc }))
          (let ((slot (mod (var-get operation-count) MAX-HISTORY)))
            (map-set operation-history slot
              { nonce: nonce, protocol: (contract-of protocol), action: action,
                amount: amount, block: stacks-block-height, canonical-hash: payload-hash })
            (var-set operation-count (+ (var-get operation-count) u1))
          )
          (ok result)
        )
      )
    )
  )
)
```

#### G) Padronizar `stacks-block-height`

Substituir todas as ocorrências de `block-height` por `stacks-block-height` no `user-wallet.clar` e no `withdraw-helper.clar`.

---

### 1.3 `adapter-alex.clar` (novo — exemplo)

O mesmo padrão se repete para todos os adapters. Só muda a lógica interna do `execute`.

```clarity
;; adapter-alex.clar
(impl-trait .adapter-trait.adapter-trait)

(define-constant ALEX-AMM 'SP...alex-amm-pool-v2)
(define-data-var total-allocated uint u0)

(define-public (execute (amount uint) (action (string-ascii 16)))
  (if (is-eq action "deposit")
    (begin
      (try! (as-contract (contract-call? ALEX-AMM add-liquidity amount u0)))
      (var-set total-allocated (+ (var-get total-allocated) amount))
      (ok { amount: amount, allocated: (var-get total-allocated) })
    )
    (if (is-eq action "withdraw")
      (begin
        (try! (as-contract (contract-call? ALEX-AMM remove-liquidity amount u0)))
        (var-set total-allocated
          (if (>= (var-get total-allocated) amount)
            (- (var-get total-allocated) amount) u0))
        (ok { amount: amount, allocated: (var-get total-allocated) })
      )
      (err u400)
    )
  )
)

(define-read-only (get-balance) (ok (var-get total-allocated)))
```

---

### 1.4 Tabela final de payloads

| Função | Contrato | Domain | Campos em ordem |
|---|---|---|---|
| `execute-authorized-operation` | user-wallet | u40 | tg-hash · D · sha256(protocol) · sha256(action) · nonce · amount · expiry |
| `withdraw-stx` | user-wallet | u10 | tg-hash · D · sha256(wallet) · nonce · amount · expiry · sha256(recipient) |
| `authorize-withdrawal` | withdraw-helper | u10 | tg-hash · D · sha256(wallet) · nonce · amount · expiry · sha256(recipient) ✅ mesmo hash |
| `add-protocol` | user-wallet | u50 | tg-hash · D · sha256(protocol) · nonce · max-alloc · expiry |
| `update-protocol` | user-wallet | u51 | tg-hash · D · sha256(protocol) · nonce · max-alloc · expiry |
| `update-limits` | user-wallet | u60 | tg-hash · D · nonce · new-max · new-daily · expiry |
| `emergency-pause` | user-wallet | u20 | tg-hash · D · nonce · expiry |
| `unpause` | user-wallet | u21 | tg-hash · D · nonce · expiry |
| `emergency-pause` | withdraw-helper | u20 | ZERO-HASH32 · D · nonce · expiry (admin global) |
| `set-fee` | withdraw-helper | u30 | ZERO-HASH32 · D · nonce · new-fee · expiry |
| `register-wallet` | wallet-factory | u40 | tg-hash · D · sha256(contract) · nonce |
| `deactivate-wallet` | wallet-factory | u41 | tg-hash · D · nonce · expiry |
| `reactivate-wallet` | wallet-factory | u42 | tg-hash · D · nonce · expiry |

---

## Parte 2 — Bot TypeScript

### 2.1 `src/utils/payload-builder.ts` (novo)

Ponto central — toda assinatura do bot passa por aqui. Espelha a tabela acima.

```typescript
import { sha256 } from '@noble/hashes/sha256';
import { principalCV, serializeCV, stringAsciiCV } from '@stacks/transactions';

export const DOMAINS = {
  WITHDRAW:           10n,
  PAUSE:              20n,
  UNPAUSE:            21n,
  SET_FEE:            30n,
  OP_EXECUTE:         40n,
  ADD_PROTOCOL:       50n,
  UPDATE_PROTOCOL:    51n,
  UPDATE_LIMITS:      60n,
  FACTORY_REGISTER:   40n,
  FACTORY_DEACTIVATE: 41n,
  FACTORY_REACTIVATE: 42n,
} as const;

function u128(n: bigint): Uint8Array {
  const buf = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) { buf[i] = Number(n & 0xffn); n >>= 8n; }
  return buf;
}

function pHash(address: string): Uint8Array {
  return sha256(serializeCV(principalCV(address)));
}

function cat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ── user-wallet ───────────────────────────────────────────────────────────────

export function opPayload(
  tgHash: Uint8Array, protocol: string, action: string,
  nonce: bigint, amount: bigint, expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash, u128(DOMAINS.OP_EXECUTE),
    pHash(protocol),
    sha256(serializeCV(stringAsciiCV(action))),
    u128(nonce), u128(amount), u128(expiry),
  ));
}

// Mesmo payload para withdraw-stx (user-wallet) E authorize-withdrawal (withdraw-helper)
export function withdrawPayload(
  tgHash: Uint8Array, walletAddress: string,
  nonce: bigint, amount: bigint, expiry: bigint, recipient: string,
): Uint8Array {
  return sha256(cat(
    tgHash, u128(DOMAINS.WITHDRAW),
    pHash(walletAddress),
    u128(nonce), u128(amount), u128(expiry),
    pHash(recipient),
  ));
}

export function addProtocolPayload(
  tgHash: Uint8Array, protocol: string,
  nonce: bigint, maxAlloc: bigint, expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash, u128(DOMAINS.ADD_PROTOCOL),
    pHash(protocol), u128(nonce), u128(maxAlloc), u128(expiry),
  ));
}

export function updateProtocolPayload(
  tgHash: Uint8Array, protocol: string,
  nonce: bigint, maxAlloc: bigint, expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash, u128(DOMAINS.UPDATE_PROTOCOL),
    pHash(protocol), u128(nonce), u128(maxAlloc), u128(expiry),
  ));
}

export function updateLimitsPayload(
  tgHash: Uint8Array,
  nonce: bigint, newMax: bigint, newDaily: bigint, expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash, u128(DOMAINS.UPDATE_LIMITS),
    u128(nonce), u128(newMax), u128(newDaily), u128(expiry),
  ));
}

export function pausePayload(tgHash: Uint8Array, nonce: bigint, expiry: bigint): Uint8Array {
  return sha256(cat(tgHash, u128(DOMAINS.PAUSE), u128(nonce), u128(expiry)));
}

export function unpausePayload(tgHash: Uint8Array, nonce: bigint, expiry: bigint): Uint8Array {
  return sha256(cat(tgHash, u128(DOMAINS.UNPAUSE), u128(nonce), u128(expiry)));
}

// ── wallet-factory ────────────────────────────────────────────────────────────

export function factoryRegisterPayload(
  tgHash: Uint8Array, walletContract: string, nonce: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash, u128(DOMAINS.FACTORY_REGISTER),
    pHash(walletContract), u128(nonce),
  ));
}
```

---

### 2.2 Corrigir `protocol-handler.ts`

```typescript
// ERRADO — usa o próprio contrato como protocolo
const withdrawProtocolAddress = wallet.contractAddress;

// CORRETO — adapter é o protocolo registrado
const ADAPTER_ALEX = process.env.ADAPTER_ALEX_CONTRACT!;
const ADAPTER_ZEST = process.env.ADAPTER_ZEST_CONTRACT!;

// /addwithdraw → registra o withdraw-helper
await walletManager.addProtocol(userId, {
  address: process.env.WITHDRAW_HELPER_CONTRACT!,
  name: 'Withdraw',
  maxAlloc: 1_000_000_000n,
}, expiryBlocks);

// /addalex → registra o adapter-alex
await walletManager.addProtocol(userId, {
  address: ADAPTER_ALEX,
  name: 'ALEX',
  maxAlloc: 5_000_000_000n,
}, expiryBlocks);
```

---

### 2.3 Handler `/withdraw` — fluxo 2 passos correto

```typescript
bot.command('withdraw', async (ctx) => {
  const parts  = ctx.message?.text?.split(' ') ?? [];
  const amount = parseFloat(parts[1] ?? '');
  if (isNaN(amount) || amount <= 0)
    return ctx.reply('Uso: /withdraw <STX>\nEx: /withdraw 10');

  const userId    = String(ctx.from!.id);
  const manager   = await getWalletManager();
  const wallet    = manager.getCachedWallet(userId);
  if (!wallet) return ctx.reply('❌ Use /start primeiro.');

  const rawAmount   = BigInt(Math.round(amount * 1_000_000));
  const recipient   = wallet.ownerAddress;
  const tgHash      = manager.getTelegramHash(userId);
  const expiry      = await manager.getCurrentBlock() + 10n;
  const helperNonce = await manager.getWithdrawHelperNonce(userId);

  // Uma assinatura serve para os dois contratos (mesmo payload)
  const payload = withdrawPayload(tgHash, wallet.contractAddress, helperNonce, rawAmount, expiry, recipient);
  const sig     = manager.signPayload(payload);

  const msg = await ctx.reply('⏳ Autorizando saque...');

  try {
    // Passo 1 — withdraw-helper.authorize-withdrawal
    const { authKey } = await manager.authorizeWithdrawal(
      userId, helperNonce, rawAmount, recipient, expiry, sig
    );

    // Passo 2 — user-wallet.withdraw-stx
    const txId = await manager.withdrawStx(
      userId, helperNonce, rawAmount, recipient, expiry, authKey, sig
    );

    await ctx.api.editMessageText(ctx.chat!.id, msg.message_id,
      `✅ *Saque Enviado!*\n\nValor: *${amount} STX*\nTX: \`${txId}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (err: any) {
    await ctx.api.editMessageText(ctx.chat!.id, msg.message_id,
      `❌ *Erro:* ${err.message}`, { parse_mode: 'Markdown' }
    );
  }
});
```

---

### 2.4 Corrigir `executeContractOperation` em `alex-handler.ts`

```typescript
async function executeContractOperation(
  ctx: Context, userId: number,
  action: 'deposit' | 'withdraw',
  adapterAddress: string,
  rawAmount: bigint,
  description: string,
): Promise<void> {
  const manager = await getWalletManager();
  const wallet  = manager.getCachedWallet(String(userId));
  if (!wallet) throw new Error('Wallet not found');

  const tgHash = manager.getTelegramHash(String(userId));
  const nonce  = await manager.getWalletNonce(String(userId));
  const expiry = await manager.getCurrentBlock() + 10n;

  const payload = opPayload(tgHash, adapterAddress, action, nonce, rawAmount, expiry);
  const sig     = manager.signPayload(payload);

  const result = await manager.executeOperation(
    String(userId), adapterAddress, action, rawAmount, nonce, expiry, sig
  );

  clearSession(userId);

  await ctx.reply(
    `✅ *${action === 'deposit' ? 'Deposit' : 'Withdraw'} Enviado!*\n\n${description}\nTX: \`${result.txId}\``,
    { parse_mode: 'Markdown', reply_markup: mainMenuKbd },
  );
}
```

---

### 2.5 Variáveis de ambiente

```env
WALLET_FACTORY_CONTRACT=SP....wallet-factory
WITHDRAW_HELPER_CONTRACT=SP....withdraw-helper
ADAPTER_ALEX_CONTRACT=SP....adapter-alex
ADAPTER_ZEST_CONTRACT=SP....adapter-zest
ADAPTER_HERMETICA_CONTRACT=SP....adapter-hermetica
ADAPTER_BITFLOW_CONTRACT=SP....adapter-bitflow
BOT_PRIVATE_KEY=<secp256k1 privkey hex>
BOT_PUBLIC_KEY=<secp256k1 compressed pubkey 33 bytes hex>
```

---

## Parte 3 — Ordem de Execução

### Deploy dos contratos

```
1. adapter-trait.clar           sem dependências
2. adapter-alex.clar            impl adapter-trait
3. adapter-zest.clar            impl adapter-trait
4. adapter-hermetica.clar       impl adapter-trait
5. adapter-bitflow.clar         impl adapter-trait
6. user-wallet.clar             usa adapter-trait  ← breaking change, re-deploy
   (withdraw-helper e wallet-factory não precisam de re-deploy)
```

> ⚠️ Re-deploy do `user-wallet` invalida nonces e `allowed-protocols` existentes.
> O bot deve re-inicializar todas as carteiras ativas após o deploy.

### Implementação do bot

```
1. payload-builder.ts             base de tudo
2. WalletManager — novos métodos:
     getTelegramHash(userId)
     signPayload(payload)
     getWithdrawHelperNonce(userId)
     authorizeWithdrawal(...)
     withdrawStx(...)
     getCurrentBlock()
3. Corrigir protocol-handler.ts   endereços corretos dos adapters
4. Novo handler /withdraw         fluxo 2 passos
5. Corrigir alex-handler.ts       payload correto via payload-builder
6. Testes no testnet
```

---

## Checklist

### Contratos
- [ ] Criar `adapter-trait.clar`
- [ ] Corrigir `op-payload` — domain u40 + sha256(protocol) + sha256(action)
- [ ] Corrigir `withdraw-payload` — incluir sha256(wallet)
- [ ] Separar `add-proto-payload` (u50) de `update-proto-payload` (u51)
- [ ] Adicionar domain em `limits-payload` (u60)
- [ ] Adicionar cross-contract call ao adapter em `execute-authorized-operation`
- [ ] Padronizar `stacks-block-height` em todos os contratos
- [ ] Criar `adapter-alex.clar`
- [ ] Criar demais adapters
- [ ] Re-deploy `user-wallet.clar`

### Bot
- [ ] Criar `payload-builder.ts`
- [ ] Expandir `WalletManager` com métodos de saque e assinatura
- [ ] Corrigir endereços de protocolo em `protocol-handler.ts`
- [ ] Implementar handler `/withdraw` com 2 passos
- [ ] Corrigir `executeContractOperation` em `alex-handler.ts`
- [ ] Configurar variáveis de ambiente dos adapters
- [ ] Testes no testnet