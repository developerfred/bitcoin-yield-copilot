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
└──────┬──────────────────────────┬───────────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────────────────────┐
│  x402 Data  │          │    aibtc-mcp-server            │
│  Endpoints  │          │  (120+ Stacks tools)           │
│  (paid API) │          │  • Zest deposit/withdraw      │
│  sBTC/STX   │          │  • ALEX swap                   │
└─────────────┘          │  • Bitflow LP                  │
                        │  • Hermetica vault              │
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

- **Handlers** (`src/bot/handlers/`): Command handlers for /start, /portfolio, /yields, /alerts, and AI-powered message processing
- **Middleware** (`src/bot/middleware/`): Authentication, rate limiting, and error handling
- **Wallet** (`src/bot/wallet/`): Wallet connection management via WebApp

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

### 4. Smart Contract Layer (`contracts/`)

Clarity smart contracts manage user wallets:

- **user-wallet.clar**: Individual user wallet contracts
- **wallet-factory.clar**: Factory for deploying user wallets
- **withdraw-helper.clar**: Helper for withdrawals
- **alex-adapter.clar**: ALEX protocol adapter

## Data Flow

1. **User Message**: User sends message via Telegram
2. **Handler Processing**: Bot handler processes command or forwards to AI
3. **AI Reasoning**: Claude agent interprets intent and determines action
4. **Tool Execution**: Agent calls appropriate tools (MCP or internal)
5. **Transaction Building**: Payload builder creates signed transactions
6. **Execution**: Transactions submitted to Stacks blockchain
7. **Confirmation**: User receives confirmation with transaction hash

## Security Model

- **Authentication**: Telegram user ID verification
- **Wallet Isolation**: Each user has dedicated smart contract wallet
- **Transaction Limits**: Configurable per-transaction and daily limits
- **Encryption**: Sensitive data encrypted at rest
- **Identity**: ERC-8004 integration for onchain agent identity

## Module Reference

| Module | Path | Purpose |
|--------|------|---------|
| Bot | `src/bot/` | Telegram bot handlers |
| Agent | `src/agent/` | AI agent logic |
| API | `src/api/` | REST API endpoints |
| Protocols | `src/protocols/` | DeFi protocol integrations |
| Utils | `src/utils/` | Utility functions |
| Contracts | `contracts/` | Clarity smart contracts |
