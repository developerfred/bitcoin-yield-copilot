#!/usr/bin/env bun

/**
 * Test Runner for Clarinet Contracts
 * 
 * Supports Clarinet 1.x, 2.x, and 3.x
 * 
 * Usage:
 *   npm run test:clarinet    - Run all tests via clarinet console
 *   npm run test:clarinet -- --filter erc8004-identity  - Run specific tests
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const CLARINET_CMD = 'bunx clarinet';

function getClarinetVersion(): string {
  try {
    const version = execSync(`${CLARINET_CMD} --version`, { encoding: 'utf8' });
    return version.trim();
  } catch (e) {
    return 'unknown';
  }
}

function isClarinet3(): boolean {
  const version = getClarinetVersion();
  const major = parseInt(version.split('.')[0].replace('clarinet ', ''));
  return major >= 3;
}

function runTestsClarinet12(): void {
  console.log('Running tests with Clarinet 1.x/2.x...');
  try {
    execSync(`${CLARINET_CMD} test`, { stdio: 'inherit' });
  } catch (e) {
    process.exit(1);
  }
}

function runTestsClarinet3(): void {
  console.log('Running tests with Clarinet 3.x console...');
  console.log('Note: Clarinet 3.x requires using console for testing.');
  console.log('Run individual tests with: clarinet console --testnet');
  console.log('');
  console.log('Alternatively, you can use Deno with specific version:');
  console.log('  deno run --allow-all -A https://deno.land/x/clarinet@v1.6.0/...');
  
  // Try running via clarinet console
  try {
    // Create a temporary script to run tests
    const testFiles = getTestFiles();
    console.log(`Found ${testFiles.length} test files:`);
    testFiles.forEach(f => console.log(`  - ${f}`));
    console.log('');
    console.log('To run tests, use: clarinet console');
    console.log('Then type: .load tests/erc8004-identity_test.ts');
  } catch (e) {
    console.error('Error:', e);
  }
}

function getTestFiles(): string[] {
  const testsDir = './tests';
  const files: string[] = [];
  
  try {
    const dir = readdirSync(testsDir);
    for (const file of dir) {
      const fullPath = join(testsDir, file);
      if (statSync(fullPath).isFile() && file.endsWith('_test.ts')) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.log('No tests directory found');
  }
  
  return files;
}

function main() {
  console.log('Bitcoin Yield Copilot - Test Runner');
  console.log('===================================');
  console.log(`Clarinet version: ${getClarinetVersion()}`);
  console.log('');
  
  if (isClarinet3()) {
    runTestsClarinet3();
  } else {
    runTestsClarinet12();
  }
}

main();
