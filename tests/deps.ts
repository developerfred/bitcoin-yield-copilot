/**
 * Bitcoin Yield Copilot - Test Dependencies
 * 
 * IMPORTANT: This file works with Clarinet 1.x/2.x (Deno-based)
 * 
 * For Clarinet 3.x with Vitest, two options:
 * 1. Migrate tests to new @stacks/clarinet-sdk format
 * 2. Use 'clarinet console' for testing
 */

import { Clarinet, Tx, Chain, types } from 'https://deno.land/x/clarinet@v1.7.1/index.ts';

export { Clarinet, Tx, Chain, types };

export type Account = {
  address: string;
  name: string;
};

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(msg || `Expected ${expectedStr} but got ${actualStr}`);
  }
}
