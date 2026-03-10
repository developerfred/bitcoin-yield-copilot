# Deployment Guide

This guide covers deploying Bitcoin Yield Copilot in various environments.

## Prerequisites

- Node.js 20+
- npm or bun package manager
- Telegram Bot Token
- Anthropic API Key
- Stacks wallet (for mainnet)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/developerfred/bitcoin-yield-copilot.git
cd bitcoin-yield-copilot
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | sk-ant-... |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | 123456:ABC-DEF |
| `STACKS_NETWORK` | Network to use | testnet |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STACKS_API_URL` | (testnet URL) | Stacks API endpoint |
| `DATABASE_PATH` | ./data/agent.db | Database file path |
| `LOG_LEVEL` | info | Logging level |
| `ENCRYPTION_KEY` | (default) | 32-char encryption key |

## Running Locally

### Development Mode

```bash
# Start all services (bot + static server)
npm run dev
```

### Bot Only

```bash
npm run dev:bot
```

### Static Server Only

```bash
npm run dev:static
```

### Build for Production

```bash
npm run build
npm start
```

## Docker Deployment

### Build Image

```bash
docker build -t bitcoin-yield-copilot .
```

### Run Container

```bash
docker run -d \
  --name bitcoin-yield-copilot \
  -p 3000:3000 \
  --env-file .env \
  bitcoin-yield-copilot
```

### Docker Compose

```bash
docker-compose up -d
```

## Production Considerations

### Security

1. **Never commit secrets**: Use environment variables
2. **Use strong encryption key**: Generate 32+ random characters
3. **Enable HTTPS**: Required for Telegram WebApp
4. **Rate limiting**: Configure appropriate limits

### Monitoring

1. **Log level**: Set to `info` for production
2. **Health checks**: Monitor `/health` endpoint
3. **Error tracking**: Set up error reporting

### Backups

1. **Database**: Regularly backup SQLite database
2. **Environment**: Keep .env secure and backed up

## Testing

### Run Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
npm test -- --run tests/agent
```

## Networks

### Testnet

Use testnet for development and testing:
- No real funds at risk
- Faster transactions
- Faucets available for STX/sBTC

### Mainnet

Use mainnet for production:
- Real funds
- Actual transaction fees
- Full DeFi integration

## Troubleshooting

### Bot Not Responding

1. Check bot token is correct
2. Verify webhook URL is set
3. Check logs for errors

### Transaction Failures

1. Verify wallet has sufficient balance
2. Check network is correct (testnet/mainnet)
3. Verify contract addresses are correct

### Database Issues

1. Check file permissions
2. Verify disk space
3. Backup before modifications
