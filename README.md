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
| Deploy | Railway / Fly.io (Node.js container) |
| Language | TypeScript |

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
- Telegram Bot Token
- Anthropic API Key
- Stacks wallet with sBTC

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/bitcoin-yield-copilot.git
cd bitcoin-yield-copilot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your environment variables
# See .env.example for required variables

# Start development server
npm run dev
```

### Environment Variables

```env
# Anthropic
ANTHROPIC_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=

# Stacks
AGENT_STACKS_PRIVATE_KEY=
STACKS_NETWORK=mainnet

# MCP Server (aibtcdev)
AIBTC_MCP_SERVER_PATH=./node_modules/.bin/aibtc-mcp

# x402
X402_FACILITATOR_URL=https://x402.aibtc.com

# ERC-8004
AGENT_IDENTITY_CONTRACT=
```

---

## Project Structure

```
bitcoin-yield-copilot/
├── src/
│   ├── bot/
│   │   ├── index.ts          # Grammy bot setup
│   │   ├── handlers/         # Command handlers (/start, /portfolio, etc)
│   │   └── middleware/       # Auth, rate limiting
│   ├── agent/
│   │   ├── copilot.ts        # Main agent loop (Claude API)
│   │   ├── strategy.ts       # Yield decision logic
│   │   ├── memory.ts         # User preferences (SQLite)
│   │   └── identity.ts       # ERC-8004 integration
│   ├── mcp/
│   │   ├── client.ts         # MCP client for aibtc-mcp-server
│   │   └── tools.ts          # Tool mappings used
│   ├── x402/
│   │   └── client.ts         # Paid data feeds consumption
│   └── protocols/
│       ├── zest.ts           # Zest-specific helpers
│       ├── alex.ts           # ALEX-specific helpers
│       ├── hermetica.ts      # Hermetica-specific helpers
│       └── bitflow.ts        # Bitflow-specific helpers
├── contracts/                # Clarity contracts (if needed)
├── tests/
├── docs/
├── .env.example
├── package.json
└── README.md
```

---

## Development Milestones

### Week 1–2: Foundation
- Repo setup, basic CI/CD (Railway)
- Functional Telegram bot with `/start` and onboarding
- Claude API integration with basic tool use
- Connection to aibtc-mcp-server (testnet)

### Week 3–4: Core Yield
- Real-time APY reading (Zest, ALEX, Hermetica, Bitflow)
- Deposit execution via MCP (testnet)
- Transaction confirmation + notifications
- Functional portfolio overview

### Week 5–6: Memory and Strategy
- User preferences memory system (SQLite)
- Risk profile logic in agent
- APY variation alerts
- Action history with reasoning

### Week 7–8: Identity and x402
- ERC-8004 integration (agent identity onchain)
- Data feeds consumption via x402 (sBTC)
- Testnet → mainnet migration
- Tests with real users (5–10 beta users)

### Week 9–10: Polish and Launch
- UX refinement based on feedback
- Complete documentation (README, usage guide)
- Stable production deployment
- Onboarding 20+ real users
- Launch post on Stacks Forum + Twitter

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

## Post-Grant: Growth Roadmap

**Phase 2 (months 3–6):** Autonomous rebalancing without manual approval, more protocol support, web version

**Phase 3 (months 6–12):** Multi-user with shared strategies, sBTC cross-chain integration (Wormhole), revenue model (fee on yield generated)

**Sustainability:** 0.1–0.5% performance fee on yield generated by agent. With $100K in managed TVL = ~$500–2,500/year in fees. Not dependent on grants to survive.

---

## License

MIT
