# Security Guide

This document outlines security considerations for Bitcoin Yield Copilot.

## Overview

Bitcoin Yield Copilot handles user funds and requires careful security considerations.

## Smart Contract Security

### Wallet Isolation

- Each user has a dedicated smart contract wallet
- Wallets are deployed via factory contract
- Operations require user authorization

### Transaction Limits

- Configurable per-transaction limits
- Daily spending limits
- Rate limiting on operations

### Audit

Smart contracts should be audited before mainnet deployment.

## Application Security

### Authentication

- Telegram user ID verification
- Token-based session management
- Encrypted key storage

### Encryption

- Sensitive data encrypted at rest
- Encryption key must be 32+ characters
- Use environment variables for secrets

### Input Validation

- Validate all user inputs
- Sanitize data before blockchain calls
- Type checking on all parameters

## Best Practices

### Production Deployment

1. Use strong, unique encryption keys
2. Enable HTTPS
3. Configure rate limiting
4. Set up monitoring and alerts

### Key Management

- Never commit private keys
- Use secrets management
- Rotate keys periodically

## Docker Secrets (Production)

For production deployments, use Docker Secrets to isolate sensitive data.

### Step 1: Create Secret Files

Create a directory for secrets (add to `.gitignore`):

```bash
mkdir -p secrets
```

Create individual secret files:

```bash
echo "your_telegram_bot_token" > secrets/telegram_token.txt
echo "sk-ant-..." > secrets/anthropic_key.txt
echo "your_stacks_private_key" > secrets/stacks_private_key.txt
```

### Step 2: Update docker-compose.production.yml

```yaml
services:
  bot:
    secrets:
      - telegram_token
      - anthropic_key
      - stacks_private_key
    environment:
      - TELEGRAM_BOT_TOKEN=/run/secrets/telegram_token
      - ANTHROPIC_API_KEY=/run/secrets/anthropic_key
      - STACKS_PRIVATE_KEY=/run/secrets/stacks_private_key

secrets:
  telegram_token:
    file: ./secrets/telegram_token.txt
  anthropic_key:
    file: ./secrets/anthropic_key.txt
  stacks_private_key:
    file: ./secrets/stacks_private_key.txt
```

### Step 3: Deploy

```bash
docker-compose -f docker-compose.production.yml up -d
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key for Claude |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `STACKS_PRIVATE_KEY` | Yes | Bot's Stacks private key |
| `LLM_PROVIDER` | No | `anthropic`, `openrouter`, or `minimax` |
| `MINIMAX_API_KEY` | No* | Minimax API key |
| `MINIMAX_GROUP_ID` | No* | Minimax group ID |
| `OPENROUTER_API_KEY` | No* | OpenRouter API key |

*Required based on LLM provider choice

### Monitoring

- Track transaction failures
- Monitor for suspicious activity
- Set up alerts for errors

## Reporting Security Issues

For security vulnerabilities, please contact the maintainers directly.
