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
| `confirm_deposit_{protocol}_{amount}` | Handle deposit confirmation |
| `confirm_withdraw_{protocol}_{amount}` | Handle withdraw confirmation |
| `cancel_action` | Cancel pending action |

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

## Onboarding Flow

1. User sends `/start`
2. Bot requests wallet connection
3. User connects via WebApp
4. Bot stores wallet address
5. Onboarding complete

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
