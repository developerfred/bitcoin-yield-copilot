# Contract Architecture - Gap Analysis

## Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER WALLET FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────┐
│   Telegram    │────►│ User Wallet  │────►│     Wallet Factory           │
│   User        │     │ (main)       │     │  (creates wallets)           │
└──────────────┘     └──────┬───────┘     └────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│ Adapter: ALEX   │ │ Adapter: USDCx│ │ Adapter: Zest   │
│ (sBTC yield)    │ │ (NEW!)       │ │ (sBTC yield)   │
└─────────────────┘ └──────────────┘ └─────────────────┘
```

## New Contracts Created

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEW CONTRACTS (Bounty)                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────┐
│  ERC-8004 Identity   │
│  (on-chain identity)  │
└──────────┬───────────┘
            │
            ▼
┌────────────────────────┐    ┌────────────────────────┐
│  Molbot Registry      │◄───│  Molbot Payment         │
│  (bot registry)       │    │  (x402 payments)        │
└────────────────────────┘    └────────────────────────┘
```

## Gap Analysis

### Gap 1: USDCx Adapter doesn't implement adapter-trait

**Problem**: The `usdcx-adapter.clar` doesn't implement `adapter-trait`, which is required for it to be called by `user-wallet`.

**Solution**: Implement the trait:
