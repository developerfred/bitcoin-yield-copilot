/**
 * Bitcoin Yield Copilot - Test Dependencies
 * 
 * For Clarinet 3.x with Vitest, use:
 * - vitest-environment-clarinet for integration tests
 * - @stacks/clarinet-sdk for simnet access
 */

export function expectOk(result: any): any {
  if (result.isOk !== true) {
    throw new Error(`Expected ok, got: ${JSON.stringify(result)}`);
  }
  return result.value;
}

export function expectErr(result: any): any {
  if (result.isErr !== true) {
    throw new Error(`Expected err, got: ${JSON.stringify(result)}`);
  }
  return result.value;
}

export function expectSome(result: any): any {
  if (result.type !== 'some') {
    throw new Error(`Expected some, got: ${JSON.stringify(result)}`);
  }
  return result.value;
}

export function expectNone(result: any): void {
  if (result.type !== 'none') {
    throw new Error(`Expected none, got: ${JSON.stringify(result)}`);
  }
}

export function expectBool(result: any, expected: boolean): void {
  if (result.type !== 'bool' || result.value !== expected) {
    throw new Error(`Expected ${expected}, got: ${JSON.stringify(result)}`);
  }
}

export function expectUint(result: any, expected: number): void {
  if (result.type !== 'uint' || Number(result.value) !== expected) {
    throw new Error(`Expected uint ${expected}, got: ${JSON.stringify(result)}`);
  }
}

export function expectAscii(result: any, expected: string): void {
  if (result.type !== 'ascii' || result.value !== expected) {
    throw new Error(`Expected ascii "${expected}", got: ${JSON.stringify(result)}`);
  }
}
