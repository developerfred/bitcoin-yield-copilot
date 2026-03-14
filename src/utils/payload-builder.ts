// payload-builder.ts
// Central point for all payload signing operations
// Mirrors the Clarity contract payloads
//
// ⚠️  Zero @noble/* imports — SHA-256 is provided by Node's built-in
//     node:crypto (createHash), which is byte-for-byte identical to
//     @noble/hashes/sha256 and has no version conflicts.


import { stringAsciiCV, serializeCV } from '@stacks/transactions'; // serializeCV só para actionHash
import { c32addressDecode } from 'c32check';
import { createHash } from 'node:crypto';

// ============================================================================
// Domain tags — must match Clarity contracts
// ============================================================================

export const DOMAINS = {
  WITHDRAW: 10n,
  PAUSE: 20n,
  UNPAUSE: 21n,
  SET_FEE: 30n,
  OP_EXECUTE: 40n,
  ADD_PROTOCOL: 50n,
  UPDATE_PROTOCOL: 51n,
  UPDATE_LIMITS: 60n,
  FACTORY_REGISTER: 40n,
  FACTORY_DEACTIVATE: 41n,
  FACTORY_REACTIVATE: 42n,
} as const;

// ============================================================================
// Internal primitives — Node built-ins only, zero extra deps
// ============================================================================

/** SHA-256 via Node crypto — identical output to @noble/hashes sha256 */
function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

/** Convert uint128 → 16 bytes big-endian */
function u128(n: bigint): Uint8Array {
  const buf = new Uint8Array(16);
  for (let i = 15; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

/** Concatenate multiple Uint8Arrays */
function cat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/** SHA-256 of the consensus-buff serialization of a Clarity principal */
function clarityPrincipalBytes(address: string): Uint8Array {
  const [accountPart, contractName] = address.includes('.')
    ? address.split('.')
    : [address, null];

  const [version, hash160Hex] = c32addressDecode(accountPart);
  const hash160 = Buffer.from(hash160Hex, 'hex');

  if (contractName) {
    const nameBytes = Buffer.from(contractName, 'utf8');
    const buf = Buffer.alloc(1 + 1 + 20 + 1 + nameBytes.length);
    buf[0] = 0x06;
    buf[1] = version;
    hash160.copy(buf, 2);
    buf[22] = nameBytes.length;
    nameBytes.copy(buf, 23);
    return buf;
  } else {
    const buf = Buffer.alloc(1 + 1 + 20);
    buf[0] = 0x05; // ← diferença crítica vs serializeCV que usa 0x06
    buf[1] = version;
    hash160.copy(buf, 2);
    return buf;
  }
}

function pHash(address: string): Uint8Array {
  return sha256(clarityPrincipalBytes(address));
}
/** SHA-256 of the consensus-buff serialization of a Clarity string-ascii */
function actionHash(action: string): Uint8Array {
  return sha256(serializeCV(stringAsciiCV(action)));
}

// ============================================================================
// User Wallet Payloads
// ============================================================================

/**
 * Operation payload — execute-authorized-operation
 * Domain u40: tgHash · domain · sha256(protocol) · sha256(action) · nonce · amount · expiry
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

// payload-builder.ts - Updated withdrawPayload to match contract exactly

/**
 * Withdraw payload for withdraw-helper
 * Must match the contract's withdraw-payload function exactly:
 * 
 * (define-private (withdraw-payload (tg-hash (buff 32)) (wallet-hash (buff 32)) (nonce uint) (amount uint) (expiry uint) (recip-hash (buff 32)))
 *   (concat
 *     (concat
 *       (concat
 *         (concat
 *           (concat
 *             (concat tg-hash (uint-to-16bytes DOMAIN-WITHDRAW))
 *             wallet-hash)
 *           (uint-to-16bytes nonce))
 *         (uint-to-16bytes amount))
 *       (uint-to-16bytes expiry))
 *     recip-hash)
 * )
 * 
 * Note: This is NOT hashed. The contract then does:
 * (let ((payload-hash (sha256 (withdraw-payload ...))))
 *   ...)
 */
export function withdrawPayload(
  tgHash: Uint8Array,
  walletHash: Uint8Array,
  nonce: bigint,
  amount: bigint,
  expiry: bigint,
  recipHash: Uint8Array,
): Uint8Array {
  // Return the raw payload (NOT hashed) - the contract does the hashing
  return cat(
    tgHash,
    u128(DOMAINS.WITHDRAW),
    walletHash,
    u128(nonce),
    u128(amount),
    u128(expiry),
    recipHash,
  );
}

/**
 * Add protocol payload
 * Domain u50: tgHash · domain · sha256(protocol) · nonce · maxAlloc · expiry
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
 * Domain u51: tgHash · domain · sha256(protocol) · nonce · maxAlloc · expiry
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
 * Domain u60: tgHash · domain · nonce · newMax · newDaily · expiry
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
 * Domain u20: tgHash · domain · nonce · expiry
 */
export function pausePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(tgHash, u128(DOMAINS.PAUSE), u128(nonce), u128(expiry)));
}

/**
 * Unpause payload
 * Domain u21: tgHash · domain · nonce · expiry
 */
export function unpausePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(tgHash, u128(DOMAINS.UNPAUSE), u128(nonce), u128(expiry)));
}

// ============================================================================
// Wallet Factory Payloads
// ============================================================================

/**
 * Factory register payload
 * Domain u40: tgHash · domain · sha256(contract) · nonce
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
 * Domain u41: tgHash · domain · nonce · expiry
 */
export function factoryDeactivatePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(tgHash, u128(DOMAINS.FACTORY_DEACTIVATE), u128(nonce), u128(expiry)));
}

/**
 * Factory reactivate payload
 * Domain u42: tgHash · domain · nonce · expiry
 */
export function factoryReactivatePayload(
  tgHash: Uint8Array,
  nonce: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(tgHash, u128(DOMAINS.FACTORY_REACTIVATE), u128(nonce), u128(expiry)));
}

/**
 * Withdraw helper set-fee payload
 * Domain u30: ZERO-HASH · domain · nonce · newFee · expiry
 */
export function setFeePayload(
  nonce: bigint,
  newFee: bigint,
  expiry: bigint,
): Uint8Array {
  return sha256(cat(new Uint8Array(32), u128(DOMAINS.SET_FEE), u128(nonce), u128(newFee), u128(expiry)));
}