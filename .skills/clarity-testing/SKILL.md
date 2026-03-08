# clarity-testing

> Clarity Smart Contract Testing - Unit, Integration & Property-Based Testing

## Overview

This skill covers testing strategies for Clarity smart contracts using Clarinet's testing framework.

## Testing Framework

Clarity contracts are tested using Clarinet's built-in test runner:

```bash
# Run all tests
clarinet test

# Run specific contract tests
clarinet test contracts/vibestamp-registry

# Run with coverage
clarinet test --coverage
```

## Test File Structure

Tests go in `tests/` directory:

```
tests/
├── vibestamp-registry_test.ts
├── vibestamp-nft_test.ts
└── helpers.ts
```

## Test Format

Tests are written in Clarity or TypeScript:

```typescript
// tests/vibestamp-registry_test.ts

import { describe, it, assert } from 'vitest';

// Test contract interface
const registry = '.vibestamp-registry';

describe('vibestamp-registry', () => {
  describe('register-stamp', () => {
    it('should register a new stamp successfully', () => {
      const hash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const result = chain.callPublicFn(
        registry,
        'register-stamp',
        [
          hash,
          'Test Project',
          'https://test.com',
          'Test description'
        ],
        wallet1.address
      );
      
      assert.isOk(result);
    });

    it('should fail if hash already registered', () => {
      const hash = '0x0000000000000000000000000000000000000000000000000000000000000002';
      
      // First registration - should succeed
      chain.callPublicFn(
        registry,
        'register-stamp',
        [hash, 'Project 1', 'https://proj1.com', 'Desc 1'],
        wallet1.address
      );
      
      // Second registration - should fail
      const result = chain.callPublicFn(
        registry,
        'register-stamp',
        [hash, 'Project 2', 'https://proj2.com', 'Desc 2'],
        wallet2.address
      );
      
      assert.isErr(result);
    });
  });

  describe('verify-stamp', () => {
    it('should return stamp data for registered hash', () => {
      const hash = '0x0000000000000000000000000000000000000000000000000000000000000003';
      
      // Register first
      chain.callPublicFn(
        registry,
        'register-stamp',
        [hash, 'Verified Project', 'https://verified.com', 'Testing'],
        wallet1.address
      );
      
      // Verify
      const result = chain.callReadOnlyFn(
        registry,
        'verify-stamp',
        [hash]
      );
      
      assert.isOk(result);
      assert.equals(result.value['project-name'], 'Verified Project');
    });

    it('should return err for non-existent hash', () => {
      const fakeHash = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
      
      const result = chain.callReadOnlyFn(
        registry,
        'verify-stamp',
        [fakeHash]
      );
      
      assert.isErr(result);
    });
  });
});
```

## Test Setup with Chain and Wallets

```typescript
import { Clarinet, Tx, Chain, Account, types } from '@clarigen/testing';

// Clarinet generates type-safe wrappers
import { vibestampRegistry } from './contracts';

Clarinet.test({
  name: 'full stamp flow',
  fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    
    // Register stamp
    const block = chain.mineBlock([
      vibestampRegistry.registerStam p(
        hash,
        'My Project',
        'https://myproject.com',
        'Description',
        { from: wallet1 }
      )
    ]);
    
    // Check result
    const receipt = block.receipts[0];
    assert.isOk(receipt.result);
    
    // Verify stamp exists
    const stamp = vibestampRegistry.getStamp(hash);
    const stampData = chain.rov(stamp);
    assert.isSome(stampData);
  }
});
```

## Testing NFT (SIP-009)

```typescript
describe('vibestamp-nft', () => {
  it('should mint certificate after registration', () => {
    const hash = '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    // Register stamp
    chain.mineBlock([
      Tx.contractCall(
        'vibestamp-registry',
        'register-stamp',
        [hash, 'NFT Project', 'https://nft.com', 'Testing NFT'],
        wallet1.address
      )
    ]);
    
    // Check NFT was minted
    const lastToken = chain.callReadOnlyFn(
      'vibestamp-nft',
      'get-last-token-id',
      []
    );
    
    assert.equals(lastToken, types.uint(1));
  });

  it('should NOT allow transfer (soulbound)', () => {
    const result = chain.callPublicFn(
      'vibestamp-nft',
      'transfer',
      [types.uint(1), wallet1.address, wallet2.address],
      wallet1.address
    );
    
    // Soulbound - should always fail
    assert.isErr(result);
  });
});
```

## Property-Based Testing

```typescript
describe('property tests', () => {
  it('register-stamp should work for any valid hash', () => {
    // Generate random valid hash
    const randomHash = generateRandomHash();
    
    const result = chain.callPublicFn(
      registry,
      'register-stamp',
      [
        randomHash,
        'Random Project',
        'https://random.com',
        'Random desc'
      ],
      wallet1.address
    );
    
    assert.isOk(result);
  });

  it('string length limits enforced', () => {
    // Name too long (> 100 chars)
    const longName = 'a'.repeat(101);
    
    const result = chain.callPublicFn(
      registry,
      'register-stamp',
      [
        hash,
        longName,
        'https://test.com',
        'Desc'
      ],
      wallet1.address
    );
    
    assert.isErr(result);
  });
});
```

## Integration Testing Multi-Contract

```typescript
describe('integration: registry + NFT', () => {
  it('should mint NFT when stamp registered', () => {
    const hash = '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    // Mine block with registration
    const block = chain.mineBlock([
      Tx.contractCall(
        'vibestamp-registry',
        'register-stamp',
        [hash, 'Integration', 'https://test.com', 'Testing'],
        wallet1.address
      )
    ]);
    
    // Check receipt
    const receipt = block.receipts[0];
    assert.isOk(receipt.result);
    
    // Verify NFT exists
    const tokenId = chain.callReadOnlyFn(
      'vibestamp-nft',
      'get-last-token-id',
      []
    );
    
    // NFT should be minted
    assert.ok(tokenId);
  });
});
```

## Test Helper Functions

```typescript
// tests/helpers.ts

export function generateTestHash(name: string, url: string, desc: string): string {
  const content = `${name}|${url}|${desc}`;
  // Simple hash for testing (not secure, just for tests)
  return '0x' + content.split('').map(c => 
    c.charCodeAt(0).toString(16).padStart(2, '0')
  ).join('').padEnd(64, '0').slice(0, 64);
}

export function assertStampEquals(result: any, expected: Partial<Stamp>) {
  if (expected.owner) assert.equals(result.owner, expected.owner);
  if (expected.projectName) assert.equals(result['project-name'], expected.projectName);
  if (expected.projectUrl) assert.equals(result['project-url'], expected.projectUrl);
}
```

## Running Tests

```bash
# All tests
clarinet test

# Watch mode
clarinet test --watch

# Specific file
clarinet test tests/vibestamp-registry_test.ts

# With verbose output
clarinet test --verbose

# Show costs
clarinet test --costs
```

## Coverage

```bash
# Generate coverage report
clarinet test --coverage

# View coverage in browser
clarinet test --coverage --html
```

## Test Best Practices

| Practice | Description |
|----------|-------------|
| Test happy path | Normal operation works |
| Test edge cases | Boundary conditions |
| Test failures | Error cases |
| Test reverts | All error codes |
| Integration tests | Multi-contract flows |
| Property tests | Random inputs |

## VibeStamp Test Coverage

For VibeStamp, ensure tests cover:

- [ ] Register new stamp (success)
- [ ] Register duplicate hash (fail)
- [ ] Verify existing stamp
- [ ] Verify non-existent stamp
- [ ] Get stamps by owner
- [ ] NFT mint after registration
- [ ] NFT transfer blocked (soulbound)
- [ ] String length limits
- [ ] Empty inputs
- [ ] Invalid hashes

## Related Skills

- clarity-contracts: Contract implementation
- clarity-security: Security patterns
- clarity-audit: Audit methodology
