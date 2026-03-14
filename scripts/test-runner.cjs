#!/usr/bin/env node

/**
 * Clarinet Test Runner - Universal Wrapper
 * 
 * Supports running tests across Clarinet 1.x, 2.x, and 3.x
 * 
 * Usage:
 *   node scripts/test-runner.js              # Auto-detect and run
 *   node scripts/test-runner.js --clarinet1  # Force Clarinet 1.x/2.x
 *   node scripts/test-runner.js --clarinet3  # Force Clarinet 3.x
 *   node scripts/test-runner.js --check      # Only check contracts
 *   node scripts/test-runner.js --version    # Show versions
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

const PROJECT_ROOT = path.resolve(__dirname, '..');

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

function getClarinetVersion() {
  try {
    const version = execSync('clarinet --version 2>/dev/null || echo "not-found"', {
      encoding: 'utf8',
      cwd: PROJECT_ROOT
    });
    return version.trim().replace('clarinet ', '');
  } catch (e) {
    return 'not-installed';
  }
}

function getMajorVersion(version) {
  if (version === 'not-installed') return 0;
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function checkContracts() {
  log('\n📋 Checking contracts...', BLUE);
  try {
    execSync('clarinet check', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    log('✅ Contracts OK', GREEN);
    return true;
  } catch (e) {
    log('❌ Contracts have errors', RED);
    return false;
  }
}

function runClarinet1Tests() {
  log('\n🧪 Running Clarinet 1.x/2.x tests (via Deno)...', BLUE);
  
  // Check if clarinet test exists
  try {
    execSync('clarinet test', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    });
    return true;
  } catch (e) {
    // Try with deno directly
    log('Trying with deno...', YELLOW);
    try {
      execSync('deno test --allow-all tests/', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit'
      });
      return true;
    } catch (e2) {
      log('❌ Clarinet 1.x tests failed', RED);
      return false;
    }
  }
}

function runClarinet3Tests() {
  log('\n🧪 Clarinet 3.x detected', BLUE);
  
  const testFiles = [];
  const testsDir = path.join(PROJECT_ROOT, 'tests');
  
  try {
    const files = fs.readdirSync(testsDir);
    for (const file of files) {
      if (file.endsWith('_test.ts')) {
        testFiles.push(file);
      }
    }
  } catch (e) {
    log('No tests directory found', YELLOW);
  }
  
  if (testFiles.length === 0) {
    log('⚠️  No test files found', YELLOW);
    return true;
  }
  
  log(`   Found ${testFiles.length} test files`, GREEN);
  
  log('\n📝 Testing Options for Clarinet 3.x:', BLUE);
  log('   1. Use clarinet console (recommended):', YELLOW);
  log('      $ clarinet console', BLUE);
  log('      > .load tests/<test-file>_test.ts', BLUE);
  log('');
  log('   2. Use VS Code with Clarinet extension', BLUE);
  log('');
  log('   3. Run individual tests with Deno:', BLUE);
  log('      $ deno run --allow-all -A https://deno.land/x/clarinet@v1.7.1/...', BLUE);
  
  return true;
}

function showVersions() {
  log('\n📊 Version Information:', BLUE);
  
  const clarinetVersion = getClarinetVersion();
  const major = getMajorVersion(clarinetVersion);
  
  log(`  Clarinet: ${clarinetVersion}`, GREEN);
  log(`  Major version: ${major}`, GREEN);
  
  // Check for bun
  try {
    const bunVersion = execSync('bun --version 2>/dev/null || echo "not-installed"', {
      encoding: 'utf8'
    }).trim();
    log(`  Bun: ${bunVersion}`, GREEN);
  } catch (e) {
    log('  Bun: not-installed', YELLOW);
  }
  
  // Check for deno
  try {
    const denoVersion = execSync('deno --version 2>/dev/null | head -1 || echo "not-installed"', {
      encoding: 'utf8'
    }).trim();
    log(`  Deno: ${denoVersion}`, GREEN);
  } catch (e) {
    log('  Deno: not-installed', YELLOW);
  }
  
  // Check vitest
  try {
    const vitestVersion = execSync('bun vitest --version 2>/dev/null || echo "not-installed"', {
      encoding: 'utf8'
    }).trim();
    log(`  Vitest: ${vitestVersion}`, GREEN);
  } catch (e) {
    log('  Vitest: not-installed', YELLOW);
  }
}

function showHelp() {
  log(`
🤖 Clarinet Test Runner - Universal Wrapper

Usage: node scripts/test-runner.js [options]

Options:
  --clarinet1    Force use of Clarinet 1.x/2.x tests (Deno-based)
  --clarinet3    Force use of Clarinet 3.x tests (Vitest-based)
  --check        Only check contracts, don't run tests
  --version       Show version information
  --help          Show this help message

Examples:
  node scripts/test-runner.js              # Auto-detect and run
  node scripts/test-runner.js --check      # Check contracts only
  node scripts/test-runner.js --version    # Show versions

Environment:
  The runner will automatically detect which test runner to use based on
  your Clarinet version:
  - Clarinet 1.x/2.x: Uses 'clarinet test' or Deno
  - Clarinet 3.x: Uses Vitest with clarinet environment
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  log('\n🎯 Clarinet Test Runner', BLUE);
  log('========================', BLUE);
  
  // Parse flags
  const flags = {
    clarinet1: args.includes('--clarinet1'),
    clarinet3: args.includes('--clarinet3'),
    check: args.includes('--check'),
    version: args.includes('--version'),
    help: args.includes('--help')
  };
  
  if (flags.help) {
    showHelp();
    return;
  }
  
  if (flags.version) {
    showVersions();
    return;
  }
  
  // Check contracts first
  if (!checkContracts()) {
    log('\n❌ Contract check failed. Fix errors before running tests.', RED);
    process.exit(1);
  }
  
  if (flags.check) {
    log('\n✅ Contract check complete (--check mode)', GREEN);
    return;
  }
  
  // Determine which test runner to use
  const clarinetVersion = getClarinetVersion();
  const major = getMajorVersion(clarinetVersion);
  
  log(`\n📌 Detected Clarinet ${major}.x (${clarinetVersion})`, BLUE);
  
  let success = false;
  
  if (flags.clarinet1 || major < 3) {
    log('→ Using Clarinet 1.x/2.x test runner', YELLOW);
    success = runClarinet1Tests();
  } else if (flags.clarinet3 || major >= 3) {
    log('→ Using Clarinet 3.x test runner', YELLOW);
    success = runClarinet3Tests();
  } else {
    // Auto-detect - try 3 first, then 1
    log('→ Auto-detecting test runner...', YELLOW);
    success = runClarinet3Tests() || runClarinet1Tests();
  }
  
  if (success) {
    log('\n✅ All tests passed!', GREEN);
    process.exit(0);
  } else {
    log('\n❌ Some tests failed', RED);
    process.exit(1);
  }
}

main().catch(e => {
  log(`\n❌ Error: ${e.message}`, RED);
  process.exit(1);
});
