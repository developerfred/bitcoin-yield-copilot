# clarity-deployment

> Clarity Smart Contract Deployment - Testnet, Mainnet & Operations

## Overview

This skill covers deploying Clarity smart contracts to Stacks testnet and mainnet using Clarinet.

## Prerequisites

```bash
# Install Clarinet
brew install clarinet

# Or via cargo
cargo install clarinet

# Verify installation
clarinet --version
```

## Project Configuration

### Clarinet.toml

```toml
[project]
name = "vibestamp"
description = "On-chain authorship registry for makers"
authors = []
telemetry = false
cache_dir = ".clarinet"

[contracts.vibestamp-registry]
path = "contracts/vibestamp-registry.clar"
clarity_version = 2
epoch = "2.5"

[contracts.vibestamp-nft]
path = "contracts/vibestamp-nft.clar"
clarity_version = 2
epoch = "2.5"

[repl.settings]
analysis = ["check_checker", "costs"]
```

## Local Development

### Start Local Dev Environment

```bash
# Start local blockchain simulator
clarinet integrate

# This opens a dashboard at http://localhost:8000
```

### Console Testing

```bash
# Open REPL console
clarinet console

# Or for specific contract
clarinet console --contracts vibestamp-registry
```

### Check Contracts

```bash
# Type check and analyze
clarinet check

# Check costs
clarinet costs

# Full analysis
clarinet analyze
```

## Testnet Deployment

### Step 1: Generate Deployment Key

```bash
# Create new deployment key
clarinet new-deployment-key

# Or use existing
# Your wallet address will be the contract deployer
```

### Step 2: Configure Deployment

```bash
# Initialize deployments
clarinet deployments generate testnet
```

This creates `deployments/default.testnet.yaml`:

```yaml
---
id: 0
name: Testnet deployment
network: testnet
clarity-version: 2
contracts:
  - vibestamp-registry
  - vibestamp-nft
```

### Step 3: Deploy

```bash
# Deploy to testnet
clarinet deployments apply --testnet

# Or with specific config
clarinet deployments apply -f deployments/custom.testnet.yaml
```

### Step 4: Verify

```bash
# Check deployment status
clarinet deployments show testnet

# Verify on explorer
# https://explorer.stacks.co/txid/YOUR_TX_ID?chain=testnet
```

## Mainnet Deployment

### Step 1: Requirements

- STX tokens for deployment (one-time)
- KYC may be required on some exchanges
- Consider using a multi-sig for production

### Step 2: Configure Mainnet

```bash
# Generate mainnet deployment
clarinet deployments generate mainnet
```

### Step 3: Simulate First

```bash
# Test deployment locally with mainnet-like conditions
clarinet test
clarinet check
clarinet costs
```

### Step 4: Deploy

```bash
# Deploy to mainnet (WARNING: Costs STX)
clarinet deployments apply --mainnet

# You'll be prompted to confirm
# Review transaction details before signing
```

### Step 5: Verify

```bash
# Show deployment info
clarinet deployments show mainnet

# Verify on explorer
# https://explorer.stacks.co/txid/YOUR_TX_ID?chain=mainnet
```

## Environment Variables

### Frontend Configuration

```bash
# .env.local for testnet
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM

# .env.local for mainnet
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
```

## Contract Interactions

### Via Clarinet Console

```bash
clarinet console

# Register stamp
(contract-call .vibestamp-registry register-stamp 
  0x0000000000000000000000000000000000000000000000000000000000000001
  "My Project"
  "https://myproject.com"
  "Description"
)

# Verify
(contract-call .vibestamp-registry verify-stamp 
  0x0000000000000000000000000000000000000000000000000000000000000001
)
```

### Via CLI (Broadcast)

```bash
# Generate transaction
clarinet contract call \
  --mainnet \
  --contract-name vibestamp-registry \
  --function register-stamp \
  --fee 10000

# Sign and broadcast
clarinet contract call \
  --mainnet \
  --keyfile key.json \
  --contract-name vibestamp-registry \
  --function register-stamp \
  --hex
```

## Deployment Best Practices

### Pre-Deployment Checklist

- [ ] Run `clarinet check` - no errors
- [ ] Run `clarinet test` - all tests pass
- [ ] Review costs with `clarinet costs`
- [ ] Test on testnet first
- [ ] Verify contract on explorer
- [ ] Update frontend env vars
- [ ] Set up monitoring

### Security Checklist

- [ ] Access control implemented
- [ ] No `unwrap-panic` without checks
- [ ] Input validation
- [ ] Tested on testnet
- [ ] Consider timelock for upgrades

### Operations Checklist

- [ ] Backup deployment keys
- [ ] Document contract addresses
- [ ] Update frontend configuration
- [ ] Set up alerts
- [ ] Verify integration

## Troubleshooting

### Common Errors

| Error | Solution |
|-------|----------|
| "Contract already exists" | Use different name or force deploy |
| "Insufficient balance" | Get more STX for gas |
| "Invalid signature" | Check keyfile path |
| "clarity version mismatch" | Update Clarinet.toml |

### Funding Account

```bash
# Get testnet STX from faucet
# https://explorer.stacks.co/sandbox/csrf

# Or via CLI
clarinet console
(faucet-stx u1000000 TX-SENDER)
```

## Upgrade Pattern

For upgrades, use a proxy pattern:

```clarity
;; contracts/vibestamp-proxy.clar
;;

(define-constant IMPLEMENTATION .vibestamp-registry-v2)

(define-public (forward (fn (string-ascii 50)) (args (list 100)))
  (contract-call? IMPLEMENTATION fn args)
)
```

## Multi-Sig Deployment

For production, consider multi-sig:

```bash
# Generate multi-sig wallet
clarinet wallet generate

# Configure in deployment
# deployments/default.mainnet.yaml
---
wallet: "multisig"
signers:
  - wallet_1
  - wallet_2
threshold: 2
```

## Monitoring

### Post-Deployment

```bash
# Track contract
# Mainnet: https://explorer.stacks.co/address/YOUR_ADDRESS?chain=mainnet

# Set up alerts for contract calls
# Use Stacks blockchain API
```

### Health Checks

```bash
# Check contract is callable
clarinet console
(contract-call .vibestamp-registry get-total-stamps)
```

## Commands Summary

| Command | Description |
|---------|-------------|
| `clarinet check` | Type check contracts |
| `clarinet test` | Run tests |
| `clarinet costs` | Analyze runtime costs |
| `clarinet console` | Interactive REPL |
| `clarinet integrate` | Start local dev environment |
| `clarinet deployments apply --testnet` | Deploy to testnet |
| `clarinet deployments apply --mainnet` | Deploy to mainnet |

## VibeStamp Deployment Flow

1. **Local** → `clarinet test` → All pass
2. **Testnet** → Deploy → Verify → Test integration
3. **Mainnet** → Deploy → Verify → Update frontend

## Related Skills

- clarity-contracts: Contract implementation
- clarity-testing: Test writing
- clarity-security: Security patterns
