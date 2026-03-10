// crypto.ts
// Stacks cryptography — signing, encryption, key derivation
//
// ⚠️  Zero @noble/* imports.
//
//  SHA-256 / HMAC  → node:crypto  (built-in, zero deps)
//  ECDSA signing   → @stacks/transactions signMessageHashRsv
//  Verify          → @stacks/encryption verifyMessageSignatureRsv
//  Key derivation  → @stacks/transactions getAddressFromPrivateKey / makeRandomPrivKey

import {
  getAddressFromPrivateKey,
  makeRandomPrivKey,
  privateKeyToPublic,
  signMessageHashRsv,
} from '@stacks/transactions';
import { verifyMessageSignatureRsv } from '@stacks/encryption';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { config } from '../config.js';

// ============================================================================
// Types
// ============================================================================

export interface EncryptedData {
  iv: string;
  ciphertext: string;
  authTag: string;
  version: string;
}

export interface SignatureResult {
  signature: Buffer; // 64-byte compact r || s
  recovery: number;  // 0 or 1
}

// ============================================================================
// StacksCrypto
// ============================================================================

export class StacksCrypto {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = scryptSync(config.encryption.key, config.encryption.salt, 32);
  }

  // ── AES-256-GCM encrypt / decrypt ────────────────────────────────────────

  encrypt(data: string): EncryptedData {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let ciphertext = cipher.update(data, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    return {
      iv: iv.toString('base64'),
      ciphertext,
      authTag: cipher.getAuthTag().toString('base64'),
      version: '1.0',
    };
  }

  decrypt(encryptedData: EncryptedData): string {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let out = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
    out += decipher.final('utf8');
    return out;
  }

  // ── Public key derivation ─────────────────────────────────────────────────

  publicKeyCreate(privateKey: Buffer, _compressed = true): Buffer {
    const privHex = privateKey.toString('hex') + '01';
    const pubKey = privateKeyToPublic(privHex);

    let pubBuffer: Buffer;
    if (Buffer.isBuffer(pubKey)) {
      pubBuffer = pubKey;
    } else if (typeof pubKey === 'object' && pubKey !== null && 'data' in pubKey) {
      const d = (pubKey as { data: string | Uint8Array }).data;
      pubBuffer = d instanceof Uint8Array ? Buffer.from(d) : Buffer.from(d as string, 'hex');
    } else if (typeof pubKey === 'string') {
      pubBuffer = Buffer.from(pubKey, 'hex');
    } else {
      throw new Error('publicKeyCreate: unexpected public key format');
    }

    if (pubBuffer.length !== 33 || (pubBuffer[0] !== 0x02 && pubBuffer[0] !== 0x03)) {
      throw new Error(
        `publicKeyCreate: invalid key — length=${pubBuffer.length} prefix=0x${pubBuffer[0]?.toString(16)}`,
      );
    }
    return pubBuffer;
  }

  // ── ECDSA signing ─────────────────────────────────────────────────────────

  ecdsaSign(msgHash: Buffer, privateKey: Buffer): SignatureResult {
    const privHex = privateKey.toString('hex');
    const hashHex = msgHash.toString('hex');

    console.log('=== ecdsaSign ===');
    console.log('msgHash :', hashHex);

    const rsvResult = signMessageHashRsv({ message: hashHex, privateKey: privHex });

    const rsvHex = typeof rsvResult === 'string'
      ? rsvResult
      : (rsvResult as any).data ?? (rsvResult as any).signature ?? String(rsvResult);

    const rsvBuf = Buffer.from(rsvHex, 'hex');
    const recovery = rsvBuf[0];            // 0 or 1
    const signature = rsvBuf.slice(1, 65); // 64 bytes r || s

    console.log('recovery :', recovery);
    console.log('sig      :', signature.toString('hex'));

    // Self-verify
    const pubKey = this.publicKeyCreate(privateKey);
    const verified = this.verifySignature(msgHash, signature, recovery, pubKey);
    console.log('self-verify:', verified ? 'PASSED ✅' : 'FAILED ❌');

    return { signature, recovery };
  }

  // ── Signature verification ────────────────────────────────────────────────

  verifySignature(
    msgHash: Buffer,
    signature: Buffer,
    recovery: number,
    expectedPubKey: Buffer,
  ): boolean {
    try {
      const recoveryHex = recovery.toString(16).padStart(2, '0');
      const rsvHex = recoveryHex + signature.toString('hex');

      return verifyMessageSignatureRsv({
        message: msgHash.toString('hex'),
        signature: rsvHex,
        publicKey: expectedPubKey.toString('hex'),
      });
    } catch (err) {
      console.error('verifySignature error:', err);
      return false;
    }
  }

  // ── Misc helpers ──────────────────────────────────────────────────────────

  generatePrivateKey(): string {
    return makeRandomPrivKey();
  }

  getAddressFromPrivateKey(privateKey: Buffer): string {
    return getAddressFromPrivateKey(privateKey.toString('hex') + '01');
  }

  validatePrivateKey(key: string): boolean {
    return /^[0-9a-f]{64}$/i.test(key) && key !== '0'.repeat(64);
  }

  deliverKey(plaintextKey: string): { encryptedKey: EncryptedData; deliveryNonce: string } {
    return {
      encryptedKey: this.encrypt(plaintextKey),
      deliveryNonce: randomBytes(16).toString('hex'),
    };
  }

  // ── Static node:crypto helpers ────────────────────────────────────────────

  static sha256(data: Uint8Array): Uint8Array {
    return new Uint8Array(createHash('sha256').update(data).digest());
  }

  static hmacSha256(key: Uint8Array, ...messages: Uint8Array[]): Uint8Array {
    const h = createHmac('sha256', key);
    for (const m of messages) h.update(m);
    return new Uint8Array(h.digest());
  }
}

export const stacksCrypto = new StacksCrypto();