# Refined Technical Roadmap - Bitcoin Yield Copilot

## Fundamental Principles

The Bitcoin Yield Copilot must remain:
- ✅ **Simple for the average user** - "Put my sBTC to work"
- ✅ **Secure by design** - smart contract wallet with limits
- ✅ **Yield-oriented** - focus on generating Bitcoin yield
- ✅ **Autonomous** - makes decisions based on data paid via x402

Molbots are an **additional feature** that:
- Allows the Copilot itself to be a "molbot" offering services
- Enables revenue stream via x402
- Adds value to user (e.g., hire specialized yield strategist)

---

## Refined Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Telegram)                              │
│         "Put my sBTC to work" → Bot executes deposit            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              BITCOIN YIELD COPILOT (Main Agent)                │
│  • Manages user yield                                          │
│  • Can hire specialized molbots (e.g., yield optimizer)        │
│  • Earns revenue offering services via x402                    │
│  • Has ERC-8004 identity                                       │
└──────┬──────────────────────────┬──────────────────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼─────────────────────────────┐
│  x402 Data  │          │    Molbot Marketplace (EXTENSION)     │
│  Endpoints  │          │  • Copilot = yield molbot            │
│  (paid API) │          │  • Yield Strategist molbot           │
│  sBTC/STX   │          │  • Content Generator molbot          │
└─────────────┘          │  • Users can hire services           │
                         └────────────────────────────────────────┘
```

---

## Phase 1: CORE - Maintain and Improve (Weeks 1-2)

### 1.1 Core Features (Maintain)

| Feature | Status | Action |
|---------|--------|--------|
