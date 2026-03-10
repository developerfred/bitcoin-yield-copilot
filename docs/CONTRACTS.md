# Clarity Smart Contracts

This document describes the Clarity smart contracts used in Bitcoin Yield Copilot.

## Overview

The smart contracts manage user wallets, enabling secure Bitcoin yield operations on the Stacks blockchain.

## Contracts

### 1. User Wallet (`user-wallet.clar`)

The main user wallet contract that handles deposits, withdrawals, and authorized operations.

**Key Functions:**

- `execute-authorized-operation`: Executes operations authorized by the Telegram user
- `deposit`: Accepts STX deposits
- `withdraw-stx`: Withdraws STX to a specified recipient
- `get-balance`: Returns the wallet's STX balance
- `get-nonce`: Returns the current transaction nonce

**Data Structures:**

- `operator-map`: Maps Telegram user IDs to authorized operators
- `protocol-map`: Maps protocol names to their contract addresses

### 2. Wallet Factory (`wallet-factory.clar`)

Deploys new user wallet contracts for each user.

**Key Functions:**

- `register`: Registers a new user wallet
- `get-wallet-address`: Returns the wallet address for a Telegram user
- `deactivate`: Deactivates a wallet
- `reactivate`: Reactivates a deactivated wallet

### 3. Withdraw Helper (`withdraw-helper.clar`)

Helper contract for handling withdrawals across protocols.

**Key Functions:**

- `authorize-withdrawal`: Authorizes a withdrawal request
- `set-fee`: Sets the withdrawal fee
- `withdraw`: Executes a withdrawal

### 4. ALEX Adapter (`alex-adapter.clar`)

Integration contract for ALEX DeFi protocol.

**Key Functions:**

- `deposit-to-pool`: Deposits liquidity to ALEX pools
- `withdraw-from-pool`: Withdraws liquidity from pools
- `swap`: Executes token swaps

### 5. Adapter Trait (`adapter-trait.clar`)

Defines the interface for protocol adapters.

**Required Functions:**

- `deposit`
- `withdraw`
- `get-balance`

### 6. Zest Adapter (`zest-adapter.clar`)

Integration contract for Zest protocol.

**Key Functions:**

- `deposit`: Deposit into Zest vaults
- `withdraw`: Withdraw from Zest vaults
- `get-balance`: Check vault balance

## Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| Wallet Factory | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPG5GM.user-wallet-factory` |
| Withdraw Helper | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPG5GM.withdraw-helper` |

## Contract Addresses (Mainnet)

| Contract | Address |
|----------|---------|
| Wallet Factory | `SP000000000000000000002Q6VF78.user-wallet-factory` |
| Withdraw Helper | `SP000000000000000000002Q6VF78.withdraw-helper` |

## Clarity Error Codes

| Code | Message |
|------|---------|
| 401 | Unauthorized |
| 402 | Invalid signature |
| 403 | Transaction limit exceeded |
| 404 | Invalid nonce or expiration block |
| 405 | Contract paused |
| 406 | Unknown or disabled protocol |
| 407 | Daily limit exceeded |
| 408 | Contract not initialized |
| 409 | Contract already initialized |
| 410 | Invalid limits |
| 411 | Zero amount not allowed |
| 412 | Protocol already registered |
| 413 | Allocation limit exceeded |
| 414 | Insufficient balance |
| 415 | Transaction expired |
| 416 | Amount too small |

## Deployment

Contracts are deployed using the Clarinet CLI:

```bash
clarinet contracts:publish
```

## Networks

- **Testnet**: For development and testing
- **Mainnet**: For production use
