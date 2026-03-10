# Telegram Bot Module

This document describes the bot module (`src/bot/`) which handles all Telegram interactions.

## Overview

The bot module uses Grammy.js to create a Telegram bot with command handlers, middleware, and wallet management.

## Handler Files

### Main Handler (`handlers/index.ts`)

The main handler file sets up all bot commands and message processing.

#### Command Handlers

| Command | Description |
|---------|-------------|
| `/start` | Start or restart onboarding |
| `/connect` | Connect or reconnect wallet |
| `/wallet` | View contract wallet info |
| `/yields` | Discover current yield opportunities |
| `/portfolio` | View your positions |
| `/alex` | Access ALEX DEX |
| `/deposit` | Deposit funds into yield protocol |
| `/withdraw` | Withdraw funds from yield protocol |
| `/addwithdraw` | Initialize and activate withdrawal protocol |
| `/alerts` | Manage APY alerts |
| `/help` | Show help message |

#### AI Message Handler

Text messages not matching commands are processed by Claude AI:

1. User sends message
2. Bot sends "Thinking..." response
3. Claude processes message with user context
4. Tool calls are executed if needed
5. Response sent back to user

#### Callback Handlers

| Pattern | Description |
|---------|-------------|
| `withdraw:activate` | Handle withdrawal protocol activation |
| `withdraw:cancel` | Cancel pending action |
| `confirm_deposit_{protocol}_{amount}` | Handle deposit confirmation |
| `confirm_withdraw_{protocol}_{amount}` | Handle withdraw confirmation |
| `alex:swap` | Handle ALEX swap confirmation |
| `alex:pool_{poolId}` | Handle pool selection |

## Middleware

### Auth Middleware (`middleware/auth.ts`)

Handles user authentication and session management.

### Rate Limiting (`middleware/rate-limit.ts`)

Prevents abuse by limiting message frequency.

### Error Handling (`middleware/error.ts`)

Catches and handles errors gracefully.

## Wallet Management

### WalletManager (`wallet/WalletManager.ts`)

Manages user wallet connections and operations.

**Key Methods:**

- `connect(telegramId, walletData)`: Connect wallet
- `disconnect(telegramId)`: Disconnect wallet
- `getAddress(telegramId)`: Get wallet address
- `executeOperation(telegramId, protocol, action, amount)`: Execute operation
- `getRemainingLimits(telegramId)`: Get transaction limits

### Connection (`wallet/connection.ts`)

Handles wallet connection flows.

### Session (`wallet/session.ts`)

Manages user sessions.

### Network (`wallet/network.ts`)

Network configuration (mainnet/testnet).

## Additional Handler Files

### Onboarding (`handlers/onboarding.ts`)

Complete onboarding flow management:
- Risk profile selection (conservative/moderate/aggressive)
- Token selection (sBTC only, sBTC + STX, all tokens)
- Contract wallet deployment
- Withdrawal address management
- Balance queries via Hiro API

### Deposit (`handlers/deposit.ts`)

Handles deposit operations:
- Deposit command processing
- Balance checking
- Transaction building and execution

### Withdraw (`handlers/withdraw.ts`)

Handles withdrawal operations:
- Withdrawal command processing
- Address validation
- Two-step withdrawal (authorize + withdraw)

### Protocols (`handlers/protocols.ts`)

Protocol management:
- Add/remove withdrawal protocols
- Protocol status monitoring
- Activation flows

### ALEX (`handlers/alex.ts`)

ALEX DEX integration:
- Pool listing and selection
- Token swaps
- Liquidity positions

### Wallet (`handlers/wallet.ts`)

Wallet-related commands:
- Connect wallet via WebApp
- Disconnect wallet
- View wallet info

1. User sends `/start`
2. Bot requests wallet connection
3. User connects via WebApp
4. Bot stores wallet address
5. Onboarding complete

### Wallet Management

### WalletManager (`wallet/WalletManager.ts`)

Manages user wallet connections and operations.

**Key Methods:**

- `connect(telegramId, walletData)`: Connect wallet
- `disconnect(telegramId)`: Disconnect wallet
- `getAddress(telegramId)`: Get wallet address
- `executeOperation(telegramId, protocol, action, amount)`: Execute operation
- `getRemainingLimits(telegramId)`: Get transaction limits
- `createContractWallet(telegramId)`: Deploy new contract wallet
- `initializeContractForUser(telegramId)`: Initialize user contract
- `withdrawStx(telegramId, amount, recipient)`: Execute withdrawal

### Connection (`wallet/connection.ts`)

Handles wallet connection flows.

### Session (`wallet/session.ts`)

Manages user sessions.

### Network (`wallet/network.ts`)

Network configuration (mainnet/testnet).

## Onboarding Flow

1. User sends `/start`
2. Bot requests wallet connection
3. User connects via WebApp
4. Bot stores wallet address
5. Onboarding complete

## Onboarding Flow

## Message Examples

```
User: "Show me yields"
Bot: [Fetches APYs from protocols]
Bot: "📈 Current Yield Opportunities:
      🟢 ZEST: 8.20% APY (sBTC)
      🟡 ALEX: 6.50% APY (sBTC)"

User: "Put my sBTC to work"
Bot: [Claude processes]
Bot: "I found 3 options:
      1. Zest (8.2% APY)
      2. ALEX LP (11.4% APY)
      3. Hermetica (6.1% APY)
      Which do you prefer?"
```
