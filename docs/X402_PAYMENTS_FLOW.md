# x402 Payments Integration - Bitcoin Yield Copilot

## Overview

This document describes the x402 payments integration implemented for the Bitcoin Yield Copilot project. The x402 protocol enables autonomous AI agents to make payments for API calls and data feeds using Stacks blockchain tokens (STX, sBTC, USDCx).

## Architecture

### Components

```
┌─────────────────────────────────────────────┐
│         Bitcoin Yield Copilot               │
├─────────────────────────────────────────────┤
│  X402Client                                 │
│  ├── Payment request creation               │
│  ├── Payment execution                      │
│  ├── Transaction verification               │
│  └── Paid endpoint consumption              │
├─────────────────────────────────────────────┤
│  YieldStrategy                              │
│  ├── Paid/free data source selection        │
│  ├── APY calculation with cost adjustment   │
│  ├── Risk assessment                        │
│  └── Opportunity scoring                    │
└─────────────────────────────────────────────┘
```

### Payment Flow

```
1. Agent requests yield data
   ↓
2. Check if paid data enabled
   ├── Yes: Call paid API with x402
   │   ↓
   │   3.1 API returns 402 Payment Required
   │     ↓
   │   3.2 X402Client creates payment request
   │     ↓
   │   3.3 Make STX payment transaction
   │     ↓
   │   3.4 Wait for confirmation
   │     ↓
   │   3.5 Retry API with payment proof
   │     ↓
   │   3.6 Receive paid data
   │
   └── No: Use free/static data
        ↓
       3.1 Use hardcoded values
```

### Cost Structure

| Component | Cost Type | Example Value |
|-----------|-----------|---------------|
| **Data Feed** | Per API call | 0.001 STX per protocol |
| **Transaction Fee** | Gas fee | 0.001 STX per payment |
| **Data Processing** | Time-based | 0.001% per second |

## Implementation Details

### X402Client

```typescript
// Key functionality:
- createPaymentRequest(): Creates 402 payment request
- verifyPayment(): Verifies on-chain transaction
- makePayment(): Executes STX payment
- consumePaidEndpoint(): Handles 402 response automatically
- createPaymentEndpoint(): Creates monetized API endpoints
```

### YieldStrategy Integration

The YieldStrategy now includes data cost calculations in APY calculations:

```typescript
netApy = rawApy - protocolFee - dataCost
```

Where:
- `protocolFee`: Protocol-specific fee (0.1-0.3%)
- `dataCost`: x402 payment cost (0.001-0.01%)

### Environment Configuration

```env
# Enable/disable paid data
ENABLE_PAID_DATA=true

# x402 facilitator URL
X402_FACILITATOR_URL=https://x402.aibtc.com

# Stacks agent private key
AGENT_STACKS_PRIVATE_KEY=your-private-key-here
```

## Usage Examples

### Consuming Paid APIs

```typescript
import { x402Client } from '../x402/client';

// Automatic payment handling
const apyData = await x402Client.getPaidAPYData('zest');
// Returns: { apy: 8.5, tvl: 55000000, timestamp: ..., source: 'zest' }

const priceData = await x402Client.getPaidPriceData(['sBTC', 'STX']);
// Returns: { sBTC: 65000, STX: 2.5 }
```

### Creating Monetized Endpoints

```typescript
import { x402Client } from '../x402/client';

const paidHandler = x402Client.createPaymentEndpoint(
  '0.001', // Price in STX
  'Premium yield data',
  async (req) => {
    // Your API logic here
    return { apy: 8.5, tvl: 55000000 };
  }
);

// Use in Express/API route
app.get('/premium-yield', paidHandler);
```

### Yield Strategy Integration

```typescript
import { YieldStrategy } from '../agent/strategy';

const preferences = {
  riskProfile: 'moderate',
  allowedTokens: ['sBTC'],
  maxDataCost: 0.1,
  minNetApy: 5.0,
};

const strategy = new YieldStrategy(preferences);
const opportunities = await strategy.findBestYieldOpportunities(1000);

// Returns filtered, scored opportunities with net APY
```

## Testing

### Unit Tests

```bash
# Run x402 client tests
npm test -- --testPathPattern=x402

# Run strategy tests
npm test -- --testPathPattern=strategy
```

### Integration Tests

```typescript
// Test payment flow
const client = new X402Client({ network: 'testnet' });
const request = await client.createPaymentRequest('0.001', 'Test');
const payment = await client.makePayment(request);
const verified = await client.verifyPayment(request, payment.transactionHash);
```

## Security Considerations

1. **Private Key Management**: Agent private keys should be stored securely
2. **Payment Verification**: All payments are verified on-chain before data delivery
3. **Rate Limiting**: Implement rate limiting to prevent payment spam
4. **Cost Controls**: User preferences limit maximum data cost expenditure

## Cost-Benefit Analysis

| Scenario | Data Quality | Cost | Use Case |
|----------|-------------|------|----------|
| **Paid Data** | Real-time, accurate | 0.001-0.01% per call | High-value decisions |
| **Free Data** | Static, approximate | 0% | Initial exploration |

## Future Enhancements

1. **Multi-token Support**: Add sBTC and USDCx payment options
2. **Batch Payments**: Group multiple API calls into single transaction
3. **Payment Escrow**: Escrow payments for multi-step operations
4. **Cost Optimization**: AI-driven cost-benefit analysis for data purchases
5. **Revenue Model**: Monetize agent's yield recommendations via x402

## References

- [x402 Protocol Documentation](https://x402.org)
- [Stacks x402 Integration](https://www.stacksx402.com)
- [Coinbase x402 Repository](https://github.com/coinbase/x402)
- [Stacks Documentation](https://docs.stacks.co)