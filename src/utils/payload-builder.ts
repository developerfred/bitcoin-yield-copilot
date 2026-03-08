// payload-builder.ts
// Central point for all payload signing operations
// Mirrors the Clarity contract payloads

import { sha256 } from '@noble/hashes/sha256';
import { serializeCV, principalCV, stringAsciiCV } from '@stacks/transactions';
import { c32addressDecode } from 'c32check';

// Domain tags - must match Clarity contracts
export const DOMAINS = {
  WITHDRAW:           10n,
  PAUSE:              20n,
  UNPAUSE:            21n,
  SET_FEE:            30n,
  OP_EXECUTE:         40n,
  ADD_PROTOCOL:       50n,
  UPDATE_PROTOCOL:    51n,
  UPDATE_LIMITS:      60n,
  FACTORY_REGISTER:   40n,
  FACTORY_DEACTIVATE: 41n,
  FACTORY_REACTIVATE: 42n,
} as const;

// Convert uint128 to 16 bytes big-endian
function u128(n: bigint): Uint8Array {
  const buf = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

// Hash a principal (address) using SHA256 of consensus-buff serialization
function pHash(address: string): Uint8Array {
  const cv = principalCV(address);
  return sha256(serializeCV(cv));
}

// Concatenate multiple Uint8Arrays
function cat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// Hash string-ascii for action hashing
function actionHash(action: string): Uint8Array {
  const cv = stringAsciiCV(action);
  return sha256(serializeCV(cv));
}

// ─────────────────────────────────────────────────────────────────────────────
// User Wallet Payloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Operation payload for execute-authorized-operation
 * Domain: u40
 * Fields: tgHash · domain · sha256(protocol) · sha256(action) · nonce · amount · expiry
 */
export function opPayload(
  tgHash: Uint8Array,
  protocol: string,
  action: string,
  nonce: bigint,
  amount: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.OP_EXECUTE),
    pHash(protocol),
    actionHash(action),
    u128(nonce),
    u128(amount),
    u128(expiry),
  ));
}

/**
 * Withdraw payload - same for withdraw-stx (user-wallet) and authorize-withdrawal (withdraw-helper)
 * Domain: u10
 * Fields: tgHash · domain · sha256(wallet) · nonce · amount · expiry · sha256(recipient)
 */
export function withdrawPayload(
  tgHash: Uint8Array,
  walletAddress: string,
  nonce: bigint,
  amount: bigint,
  expiry: bigint,
  recipient: string,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.WITHDRAW),
    pHash(walletAddress),
    u128(nonce),
    u128(amount),
    u128(expiry),
    pHash(recipient),
  ));
}

/**
 * Add protocol payload
 * Domain: u50
 * Fields: tgHash · domain · sha256(protocol) · nonce · maxAlloc · expiry
 */
export function addProtocolPayload(
  tgHash: Uint8Array,
  protocol: string,
  nonce: bigint,
  maxAlloc: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.ADD_PROTOCOL),
    pHash(protocol),
    u128(nonce),
    u128(maxAlloc),
    u128(expiry),
  ));
}

/**
 * Update protocol payload
 * Domain: u51
 * Fields: tgHash · domain · sha256(protocol) · nonce · maxAlloc · expiry
 */
export function updateProtocolPayload(
  tgHash: Uint8Array,
  protocol: string,
  nonce: bigint,
  maxAlloc: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.UPDATE_PROTOCOL),
    pHash(protocol),
    u128(nonce),
    u128(maxAlloc),
    u128(expiry),
  ));
}

/**
 * Update limits payload
 * Domain: u60
 * Fields: tgHash · domain · nonce · newMax · newDaily · expiry
 */
export function updateLimitsPayload(
  tgHash: Uint8Array,
  nonce: bigint,
  newMax: bigint,
  newDaily: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.UPDATE_LIMITS),
    u128(nonce),
    u128(newMax),
    u128(newDaily),
    u128(expiry),
  ));
}

/**
 * Pause payload
 * Domain: u20
 * Fields: tgHash · domain · nonce · expiry
 */
export function pausePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.PAUSE),
    u128(nonce),
    u128(expiry),
  ));
}

/**
 * Unpause payload
 * Domain: u21
 * Fields: tgHash · domain · nonce · expiry
 */
export function unpausePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.UNPAUSE),
    u128(nonce),
    u128(expiry),
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Factory Payloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory register payload
 * Domain: u40
 * Fields: tgHash · domain · sha256(contract) · nonce
 */
export function factoryRegisterPayload(
  tgHash: Uint8Array,
  walletContract: string,
  nonce: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.FACTORY_REGISTER),
    pHash(walletContract),
    u128(nonce),
  ));
}

/**
 * Factory deactivate payload
 * Domain: u41
 * Fields: tgHash · domain · nonce · expiry
 */
export function factoryDeactivatePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.FACTORY_DEACTIVATE),
    u128(nonce),
    u128(expiry),
  ));
}

/**
 * Factory reactivate payload
 * Domain: u42
 * Fields: tgHash · domain · nonce · expiry
 */
export function factoryReactivatePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(
    tgHash,
    u128(DOMAINS.FACTORY_REACTIVATE),
    u128(nonce),
    u128(expiry),
  ));
}

/**
 * Withdraw helper set-fee payload
 * Domain: u30
 * Fields: ZERO-HASH · domain · nonce · newFee · expiry
 */
export function setFeePayload(
  nonce: bigint,
  newFee: bigint,
  expiry: bigint,
): Uint8Array {
  const zeroHash = new Uint8Array(32);
  return sha256(cat(
    zeroHash,
    u128(DOMAINS.SET_FEE),
    u128(nonce),
    u128(newFee),
    u128(expiry),
  ));
}
