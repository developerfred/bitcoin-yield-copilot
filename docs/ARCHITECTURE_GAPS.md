# 🔄 Arquitetura de Contratos - Análise de Gaps

## 📊 Diagrama de Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER WALLET FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│   Telegram    │────►│ User Wallet  │────►│     Wallet Factory         │
│   User        │     │ (main)       │     │  (cria wallets)           │
└──────────────┘     └──────┬───────┘     └────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│ Adapter: ALEX    │ │ Adapter: USDCx│ │ Adapter: Zest   │
│ (sBTC yield)     │ │ (NOVO!)       │ │ (sBTC yield)   │
└─────────────────┘ └──────────────┘ └─────────────────┘
```

## 🆕 Contratos Novos Criados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NOVOS CONTRATOS (Bounty)                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────┐
│  ERC-8004 Identity    │
│  (identidade on-chain)│
└──────────┬───────────┘
           │
           ▼
┌────────────────────────┐    ┌────────────────────────┐
│  Molbot Registry      │◄───│  Molbot Payment         │
│  (registro de bots)   │    │  (pagamentos x402)      │
└────────────────────────┘    └────────────────────────┘
```

## 🔍 ANÁLISE DE GAPS

### Gap 1: USDCx Adapter não implementa adapter-trait

**Problema**: O `usdcx-adapter.clar` não implementa o `adapter-trait`, que é necessário para ser chamado pelo `user-wallet`.

**Solução**: Implementar o trait:

```clarity
(impl-trait .adapter-trait.adapter-trait)
```

### Gap 2: Molbot Payment não integrado ao user-wallet

**Problema**: O `molbot-payment` é um contrato separado, mas deveria ser chamado pelo user-wallet para pagar serviços de molbots.

**Solução**: Adicionar função de callback no user-wallet ou criar integração.

### Gap 3: ERC-8004 Identity não conectado ao Copilot

**Problema**: O contrato de identidade existe, mas o bot Telegram não o usa para registrar a identidade do agente.

**Solução**: Integrar ao TypeScript client.

## ✅ CORREÇÕES NECESSÁRIAS

### 1. USDCx Adapter - Implementar adapter-trait

```clarity
;; Adicionar no início do contrato
(impl-trait .adapter-trait.adapter-trait)
```

### 2. User Wallet - Adicionar suporte para Molbot Payment

O user-wallet precisa de uma função para pagar molbots:

```clarity
(define-public (pay-molbot-service
    (molbot principal)
    (amount uint)
    (service-type (string-ascii 32))
  )
  ;; Chama molbot-payment contract
)
```

### 3. Integrar ERC-8004 ao Bot

O TypeScript precisa chamar `register-identity` na inicialização do Copilot.

---

## 📋 AÇÕES PARA CORRIGIR

| Gap | Severidade | Ação |
|-----|------------|------|
| USDCx sem adapter-trait | 🔴 Alta | Adicionar impl-trait |
| Molbot payment não integrado | 🔴 Alta | Adicionar função no user-wallet |
| ERC-8004 não conectado | 🟡 Média | Integrar ao TypeScript |
| Tests não executados | 🔴 Alta | Configurar ambiente |
