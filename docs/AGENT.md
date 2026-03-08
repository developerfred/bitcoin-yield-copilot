# Agent Module

This document describes the agent module (`src/agent/`) which powers the AI capabilities of Bitcoin Yield Copilot.

## Claude Integration (`claude.ts`)

The Claude agent interfaces with Claude Sonnet 4 to provide natural language understanding and tool execution.

### ClaudeAgent Class

```typescript
class ClaudeAgent {
  constructor()
  sendMessage(
    messages: IncomingMessage[],
    tools: Tool[],
    systemPrompt?: string
  ): Promise<{ response: string; toolCalls: ToolUseBlock[] }>
}
```

### Methods

#### `sendMessage()`

Sends messages to Claude and receives responses with optional tool calls.

**Parameters:**

- `messages`: Array of incoming messages (user, assistant, tool_result)
- `tools`: Array of available tools for the agent to use
- `systemPrompt`: Optional custom system prompt

**Returns:**

- `response`: Claude's text response
- `toolCalls`: Array of tool calls to execute

### Available Tools

The agent has access to the following tools:

| Tool | Description |
|------|-------------|
| `get_yields` | Get current yield opportunities from DeFi protocols |
| `get_portfolio` | Get user portfolio positions |
| `deposit` | Deposit funds into a yield protocol |
| `withdraw` | Withdraw funds from a yield protocol |
| `get_balance` | Get wallet balance |

## Database (`database.ts`)

The database module provides SQLite storage for user data, positions, and transactions.

### Database Class

```typescript
class Database {
  constructor(dbPath?: string)
}
```

### Tables

#### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| telegram_id | TEXT | Unique Telegram user ID |
| stacks_address | TEXT | User's Stacks address |
| contract_address | TEXT | User's contract wallet address |
| risk_profile | TEXT | User's risk preference (conservative/moderate/aggressive) |
| allowed_tokens | TEXT | JSON array of allowed tokens |
| is_onboarded | INTEGER | Onboarding status (0/1) |
| onboarding_step | TEXT | Current onboarding step |
| deploy_attempts | INTEGER | Number of deployment attempts |
| last_error | TEXT | Last deployment error |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

#### Positions Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| protocol | TEXT | Protocol name |
| token | TEXT | Token symbol |
| amount | REAL | Position amount |
| apy | REAL | Annual percentage yield |
| tx_hash | TEXT | Transaction hash |
| created_at | DATETIME | Creation timestamp |

#### Transactions Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| type | TEXT | Transaction type (deposit/withdraw) |
| protocol | TEXT | Protocol name |
| token | TEXT | Token symbol |
| amount | REAL | Transaction amount |
| tx_hash | TEXT | Transaction hash |
| status | TEXT | Transaction status |
| reasoning | TEXT | Agent's reasoning |
| created_at | DATETIME | Creation timestamp |

#### Alerts Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| protocol | TEXT | Protocol name |
| threshold | REAL | APY threshold |
| is_active | INTEGER | Active status |
| created_at | DATETIME | Creation timestamp |

### Methods

#### User Management

- `createUser(telegramId)`: Create new user
- `getUser(telegramId)`: Get user by Telegram ID
- `updateOnboardingStep(telegramId, step)`: Update onboarding step
- `updateRiskProfile(telegramId, profile)`: Update risk profile
- `updateAllowedTokens(telegramId, tokens)`: Update allowed tokens
- `updateStacksAddress(telegramId, address)`: Update Stacks address
- `updateContractAddress(telegramId, address)`: Update contract wallet address
- `completeOnboarding(telegramId)`: Mark onboarding complete
- `incrementDeployAttempt(telegramId)`: Increment deployment attempts
- `clearDeployAttempts(telegramId)`: Clear deployment attempts
- `updateLastError(telegramId, error)`: Update last error

#### Position Management

- `createPosition(userId, protocol, token, amount, apy, txHash)`: Create position
- `getUserPositions(userId)`: Get all user positions
- `deletePosition(positionId)`: Delete position

#### Transaction Management

- `createTransaction(...)`: Create transaction record
- `getUserTransactions(userId, limit)`: Get user transactions

#### Alert Management

- `createAlert(userId, protocol, threshold)`: Create APY alert
- `getUserAlerts(userId)`: Get user alerts
- `deleteAlert(alertId)`: Delete alert

#### Wallet Management

- `saveWallet(telegramId, data)`: Save wallet data
- `getWallet(telegramId)`: Get wallet by Telegram ID
- `deleteWallet(telegramId)`: Delete wallet

## Usage Example

```typescript
import { ClaudeAgent } from './claude.js';
import { getDatabase } from './database.js';

const agent = new ClaudeAgent();
const db = getDatabase();

// Send message to Claude
const { response, toolCalls } = await agent.sendMessage(
  [{ role: 'user', content: 'Show me my portfolio' }],
  agentTools
);
```
