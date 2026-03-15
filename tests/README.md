# Clarinet Tests - Bitcoin Yield Copilot

This directory contains unit and integration tests for the Clarity smart contracts in the Bitcoin Yield Copilot project.

## Supported Versions

- **Clarinet 1.x/2.x**: Use `clarinet test`
- **Clarinet 3.x**: Use `bun test:clarinet`

## Commands

### Check Contract Syntax
```bash
clarinet check
# or
bunx clarinet check
```

### Run Tests (Clarinet 1.x/2.x)
```bash
clarinet test
```

### Run Tests (Clarinet 3.x)
```bash
bun test:clarinet
bun test:clarinet:watch    # watch mode
bun test:clarinet:coverage  # with coverage
```

### Test Against Testnet
```bash
# Interactive console on testnet
clarinet console --testnet

# Interactive console locally
clarinet console
```

## Test Structure

```
tests/
├── *_test.ts              # Clarinet tests (legacy format)
├── *.test.ts              # TypeScript/Vitest tests
├── deps.ts                # Shared dependencies
└── README.md              # This file
```

## Configuration

The `Clarinet.toml` file is configured with:
- **Production contracts**: Real project contracts
- **Mock contracts**: Simulations of external protocols (ALEX) for testing

### Configuration Files

| File | Description |
|------|-------------|
| `Clarinet.toml` | Contract configuration |
| `vitest.config.ts` | Vitest configuration (TypeScript) |
| `vitest.clarinet.config.ts` | Vitest configuration (Clarinet) |
| `deno.json` | Deno configuration |

## Mock Contracts

For testing without relying on the network:

| Mock | Description |
|------|-------------|
| `mock-sip-010.clar` | SIP-010 token for testing |
| `mock-alex-swap-helper.clar` | ALEX swap helper simulation |
| `mock-alex-fixed-pool.clar` | ALEX liquidity pool simulation |
| `mock-alex-vault.clar` | ALEX vault simulation |

## Writing New Tests (Clarinet 3.x)

```typescript
import { Clarinet, Tx, Chain, types } from './deps.ts';

Clarinet.test({
  name: 'Test description',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user = accounts.get('wallet_1')!;
    
    const block = chain.mineBlock([
      Tx.contractCall('contract-name', 'function-name', [types.uint(100)], user.address)
    ]);
    
    block.receipts[0].result.expectOk();
  }
});
```

## Important Notes

### Clarinet 3.x
- The `clarinet test` command has been removed
- Use Vitest with `vitest-environment-clarinet`
- Run: `bun test:clarinet`

### Known Issues

1. **npm install fails**: Use `bun install` instead of `npm install`
2. **Tests don't run with Deno**: Use Vitest with Clarinet SDK
3. **Inconsistent return types**: Ensure all branches return the same type

## Debug

Enable detailed logs:
```bash
DEBUG=1 bun test:clarinet
```
