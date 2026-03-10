# Bitcoin Yield Copilot - Architecture

This document describes the high-level architecture of the Bitcoin Yield Copilot project.

## System Overview

Bitcoin Yield Copilot is an autonomous Telegram agent that manages Bitcoin yield in the Stacks ecosystem. It uses natural language interface to allow users to deposit, withdraw, and monitor their Bitcoin yield across various DeFi protocols.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    USER                                  │
│              Telegram / Web Interface                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              COPILOT AGENT LAYER                         │
│  • Claude Sonnet (reasoning + intent)                   │
│  • User preferences memory                               │
│  • Yield strategy (own logic)                            │
│  • ERC-8004 Identity (onchain reputation)              │
└──────┬──────────────────────────┬───────────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────────────────────┐
│  x402 Data  │          │    aibtc-mcp-server            │
│  Endpoints  │          │  (120+ Stacks tools)           │
│  (paid API) │          │  • Zest deposit/withdraw      │
│  sBTC/STX   │          │  • ALEX swap                   │
└─────────────┘          │  • Bitflow LP                  │
                        │  • Hermetica vault              │
                        │  • STX stacking                 │
                        └────────────────┬────────────────┘
                                         │
                        ┌────────────────▼────────────────┐
                        │      STACKS BLOCKCHAIN          │
                        │  Clarity Smart Contracts        │
                        │  sBTC • STX • USDCx             │
                        └─────────────────────────────────┘
```

## Component Descriptions

### 1. Telegram Bot Layer (`src/bot/`)

The bot layer handles all user interactions via Telegram:

- **Handlers** (`src/bot/handlers/`): Command handlers for /start, /portfolio, /yields, /alerts, /deposit, /withdraw, and AI-powered message processing
- **Middleware** (`src/bot/middleware/`): Authentication, rate limiting, and error handling
- **Wallet** (`src/bot/wallet/`): Wallet connection management via WebApp
- **Auth** (`src/bot/auth/`): Telegram authentication callbacks
- **Config** (`src/bot/config/`): Bot configuration

### 2. Agent Layer (`src/agent/`)

The AI agent provides intelligent conversation and transaction execution:

- **Claude Integration** (`claude.ts`): Interfaces with Claude Sonnet 4 API for natural language understanding
- **Database** (`database.ts`): SQLite storage for users, positions, transactions, and alerts
- **Memory**: Stores user preferences, risk profiles, and transaction history

### 3. MCP Server Layer

The Model Context Protocol server provides Stacks blockchain tools:

- Protocol integrations (Zest, ALEX, Hermetica, Bitflow)
- Wallet balance queries
- Transaction execution
- Smart contract interactions

### 4. x402 Payments Layer (`src/x402/`)

The x402 client handles payments for data feeds:

- **Payment Requests**: Create and manage payment requests
- **Endpoint Consumption**: Automatic payment for paid API endpoints
- **Verification**: On-chain payment verification

### 5. Security Layer (`src/security/`)

Security utilities for the application:

- **stacksCrypto**: Cryptographic operations for Stacks
- **keyManager**: Key management and derivation

### 6. Smart Contract Layer (`contracts/`)

Clarity smart contracts manage user wallets:

- **user-wallet.clar**: Individual user wallet contracts
- **wallet-factory.clar**: Factory for deploying user wallets
- **withdraw-helper.clar**: Helper for withdrawals
- **alex-adapter.clar**: ALEX protocol adapter
- **zest-adapter.clar**: Zest protocol adapter
- **adapter-trait.clar**: Adapter interface definition

### 7. REST API Layer (`src/api/`)

HTTP endpoints for external integrations:

- **auth.ts**: User authentication
- **keyDelivery.ts**: Secure key delivery

## Data Flow

### Deposit Flow

```
User (Telegram) → Bot Handler → Claude Agent → MCP Server
                                                    ↓
                                              Smart Contract
                                                    ↓
                                              Blockchain Confirmation
                                                    ↓
                                              User Notification
```

### Withdraw Flow

```
User (Telegram) → Bot Handler → Wallet Manager → Withdraw Helper
                                                         ↓
                                                    User Wallet Contract
                                                         ↓
                                                    Recipient Address
                                                         ↓
                                              Blockchain Confirmation
```

### Payment Flow (x402)

```
Agent → Data Endpoint (402) → x402 Facilitator → Payment
                 ↓                                   ↓
           Retry with                     On-chain Verification
           Payment Proof
```

## Security Model

- **Authentication**: Telegram user ID verification
- **Wallet Isolation**: Each user has dedicated smart contract wallet
- **Transaction Limits**: Configurable per-transaction and daily limits
- **Encryption**: Sensitive data encrypted at rest
- **Identity**: ERC-8004 integration for onchain agent identity
- **Rate Limiting**: Prevents abuse via message frequency limits

## Module Reference

| Module | Path | Purpose |
|--------|------|---------|
| Bot | `src/bot/` | Telegram bot handlers |
| Agent | `src/agent/` | AI agent logic |
| API | `src/api/` | REST API endpoints |
| Protocols | `src/protocols/` | DeFi protocol integrations |
| Utils | `src/utils/` | Utility functions |
| x402 | `src/x402/` | Payment client |
| Security | `src/security/` | Cryptography & keys |
| MCP | `src/mcp/` | MCP client |
| Contracts | `contracts/` | Clarity smart contracts |
