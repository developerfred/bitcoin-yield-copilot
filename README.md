# Bitcoin Yield Copilot

Autonomous Telegram agent that manages Bitcoin yield in the Stacks ecosystem with natural language interface, ERC-8004 onchain identity, and x402 payments in sBTC.

---

## The Problem

The Stacks ecosystem has $545M+ in TVL, mature DeFi protocols (Zest, ALEX, Bitflow, Hermetica), and sBTC as Bitcoin's native liquidity layer. Agent infrastructure exists: `aibtc-mcp-server` with 120+ tools, x402 operational, ERC-8004 launching on mainnet.

**What's missing is the product.** None of these tools have a usable interface for ordinary users. A user with BTC doesn't know how to put sBTC in yield — they won't install Claude Desktop, configure MCP servers, and learn which Clarity contracts to call.

---

## The Solution

**Bitcoin Yield Copilot** is a Telegram agent that does one thing well: autonomously manages your Bitcoin yield in Stacks using natural language.

```
User: "Put my sBTC to work"
Agent: "Found 3 options: Zest (8.2% APY), Hermetica (6.1%), 
        ALEX LP (11.4% with higher risk). Which do you prefer?"
User: "Zest"
Agent: [executes deposit, confirms onchain, sends receipt]
       "Done. 0.05 sBTC deposited in Zest.
        Next checkpoint in 7 days."
```

---

## Architecture

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
│  • ERC-8004 Identity (onchain reputation)               │
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

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Interface | Telegram Bot API (Grammy.js) |
| Reasoning | Claude Sonnet 4 via Anthropic API |
| Stacks Tools | aibtc-mcp-server (MCP via stdio) |
| Identity | ERC-8004 (aibtcdev mainnet) |
| Agent Payments | x402-stacks (sBTC/STX) |
| Memory | SQLite local (preferences) + Stacks onchain (positions) |
| Deploy | Railway / Fly.io / Docker (Node.js container) |
| Language | TypeScript |
| Smart Contracts | Clarity (Stacks) |

---

## Features — MVP

### Core: Yield Management
- **Discover yields**: Agent queries current APYs from Zest, Hermetica, ALEX, and Bitflow in real-time via MCP
- **Deposit**: Executes deposit to protocol chosen by user
- **Withdraw**: Withdraws position + accumulated yield
- **Portfolio overview**: Summarizes all open positions with PnL

### Personalization
- Risk profile (conservative / moderate / aggressive)
- Allowed tokens (sBTC only / sBTC + STX / all)
- APY variation alerts (e.g., "notify me if Zest drops below 5%")
- Transaction history with agent reasoning

### Smart Contract Wallet
- Each user gets a dedicated Clarity smart contract wallet
- Factory pattern for wallet deployment
- Authorized operations via Telegram user authentication
- Configurable transaction and daily limits

### ERC-8004 Identity
- Agent has an onchain verifiable identity
- Every action executed is signed by the agent's identity
- Reputation accumulated over time (base for future features)

### x402 Payments
- Agent consumes external data feeds (prices, APYs) via x402 paying in STX
- Transparent flow for user: data cost is embedded in service fee

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or bun
- Telegram Bot Token
- Anthropic API Key
- Stacks wallet with sBTC (testnet for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/developerfred/bitcoin-yield-copilot.git
cd bitcoin-yield-copilot

# Install dependencies
npm install
# or
bun install

# Copy environment file
cp .env.example .env

# Configure your environment variables
# See .env.example for required variables

# Start development server
npm run dev

# Or start just the bot
npm run dev:bot

# Or start static server
npm run dev:static
```

### Environment Variables

```env
# Anthropic / OpenRouter
ANTHROPIC_API_KEY=
LLM_PROVIDER=anthropic  # or 'openrouter'
OPENROUTER_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=

# Stacks Network
STACKS_NETWORK=testnet  # mainnet, testnet, or devnet
STACKS_API_URL=https://stacks-node-api.testnet.alexlab.co

# Wallet Connection
APP_DOMAIN=https://bitcoin-yield.com
APP_NAME=Bitcoin Yield Copilot
MINI_APP_URL=

# MCP Server
AIBTC_MCP_SERVER_PATH=./node_modules/.bin/aibtc-mcp
AIBTC_MCP_NETWORK=testnet
MCP_USE_DOCKER=false

# x402 Payments
X402_FACILITATOR_URL=https://x402.aibtc.com

# ERC-8004 Identity
AGENT_IDENTITY_CONTRACT=

# Database
DATABASE_PATH=./data/agent.db

# Encryption
ENCRYPTION_KEY=your-32-char-encryption-key
KEY_DERIVATION_SALT=your-16-char-salt

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

---

## Project Structure

```
bitcoin-yield-copilot/
├── src/
│   ├── agent/
│   │   ├── claude.ts         # Claude API integration
│   │   └── database.ts       # SQLite database for users, positions, transactions
│   ├── api/
│   │   ├── auth.ts           # Authentication endpoints
│   │   └── keyDelivery.ts    # Key delivery endpoints
│   ├── bot/
│   │   ├── auth/             # Telegram auth
│   │   ├── config/           # Bot configuration
│   │   ├── handlers/         # Command handlers
│   │   │   ├── index.ts      # Main handlers (/start, /portfolio, /yields, /alerts)
│   │   │   ├── onboarding.ts # User onboarding flow
│   │   │   ├── deposit.ts   # Deposit operations
│   │   │   ├── withdraw.ts  # Withdraw operations
│   │   │   ├── protocols.ts # Protocol management
│   │   │   ├── alex.ts      # ALEX DEX integration
│   │   │   └── wallet.ts   # Wallet commands
│   │   ├── middleware/       # Auth, rate limiting, error handling
│   │   └── wallet/          # Wallet management
│   │       ├── WalletManager.ts    # Main wallet manager
│   │       ├── network.ts          # Network configuration
│   │       ├── session.ts          # Session management
│   │       └── connection.ts       # Wallet connection
│   ├── protocols/
│   │   └── alex.ts          # ALEX DeFi protocol integration
│   ├── utils/
│   │   └── payload-builder.ts # Transaction payload building
│   ├── security/
│   │   ├── stacksCrypto.ts  # Stacks cryptography
│   │   └── keyManager.ts    # Key management
│   ├── mcp/
│   │   └── client.ts        # MCP client for aibtc-mcp-server
│   ├── x402/
│   │   └── client.ts         # x402 payment client
│   ├── config.ts             # Environment configuration
│   └── index.ts             # Entry point
├── contracts/                # Clarity smart contracts
│   ├── user-wallet.clar     # User wallet contract
│   ├── wallet-factory.clar  # Wallet factory
│   ├── withdraw-helper.clar # Withdraw helper
│   ├── alex-adapter.clar    # ALEX protocol adapter
│   └── adapter-trait.clar   # Adapter trait
├── docs/                    # Documentation
├── tests/                   # Test files
├── .env.example             # Environment template
├── package.json
└── README.md
```

---

## Smart Contracts

The project includes Clarity smart contracts for secure wallet management:

| Contract | Purpose |
|----------|---------|
| `user-wallet.clar` | Individual user wallet with authorized operations |
| `wallet-factory.clar` | Factory for deploying user wallets |
| `withdraw-helper.clar` | Helper for withdrawals with fee management |
| `alex-adapter.clar` | ALEX protocol integration |
| `adapter-trait.clar` | Trait defining adapter interface |

---

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Start or restart onboarding |
| `/connect` | Connect or reconnect wallet |
| `/wallet` | View contract wallet info |
| `/yields` | Discover current yield opportunities |
| `/portfolio` | View your positions |
| `/alex` | Access ALEX DEX |
| `/deposit` | Deposit funds |
| `/withdraw` | Withdraw funds |
| `/alerts` | Manage APY alerts |
| `/help` | Show help message |

---

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Production

```bash
npm start
```

### Docker

```bash
docker build -t bitcoin-yield-copilot .
docker run -p 3000:3000 --env-file .env bitcoin-yield-copilot
```

---

## Documentation

See the `docs/` directory for comprehensive documentation:

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System architecture
- [BOT.md](./docs/BOT.md) - Telegram bot module
- [AGENT.md](./docs/AGENT.md) - AI agent module
- [API.md](./docs/API.md) - REST API documentation
- [PROTOCOLS.md](./docs/PROTOCOLS.md) - DeFi protocol integrations
- [UTILS.md](./docs/UTILS.md) - Utilities and configuration
- [CONTRACTS.md](./docs/CONTRACTS.md) - Clarity smart contracts
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Deployment guide
- [CONTRIBUTING.md](./docs/CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](./docs/SECURITY.md) - Security considerations

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Users onboarded | 20+ |
| Transactions executed | 50+ |
| TVL managed by agent | > $1,000 in sBTC |
| Protocols integrated | 3+ (Zest, ALEX, Hermetica) |
| Bot uptime | > 95% |

---

## Risks and Mitigations

| Risk | Probability | Mitigation |
|------|-------------|------------|
| aibtc-mcp-server API changes | Medium | Version dependency, contribute upstream |
| Exploit in integrated DeFi protocol | Low | Limit max exposure per protocol, alerts |
| ERC-8004 mainnet delayed | Medium | Work without identity in MVP, add later |
| Unexpected gas cost | Low | Transaction simulation before execution |
| Telegram bot ban | Very low | Have web interface fallback |

---

## Roadmap

### Phase 1 (Current MVP)
- Telegram bot with natural language interface
- Wallet connection via WebApp
- Deposit/withdraw to DeFi protocols
- Portfolio overview
- Risk profiles and alerts

### Phase 2 (Months 3-6)
- Autonomous rebalancing without manual approval
- More protocol support
- Web version

### Phase 3 (Months 6-12)
- Multi-user with shared strategies
- sBTC cross-chain integration (Wormhole)
- Revenue model (fee on yield generated)

---

## License

MIT
