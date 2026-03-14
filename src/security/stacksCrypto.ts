// stacksCrypto.ts
// Stacks cryptography — signing, encryption, key derivation

import {
  getAddressFromPrivateKey,
  makeRandomPrivKey,
  privateKeyToPublic,
} from '@stacks/transactions';
import { secp256k1 } from '@noble/curves/secp256k1.js';
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
    // Use @noble/curves directly — avoids @stacks format wrapping
    const pubKeyBytes = secp256k1.getPublicKey(privateKey, true); // compressed
    const pubBuffer = Buffer.from(pubKeyBytes);

    if (pubBuffer.length !== 33 || (pubBuffer[0] !== 0x02 && pubBuffer[0] !== 0x03)) {
      throw new Error(
        `publicKeyCreate: invalid key — length=${pubBuffer.length} prefix=0x${pubBuffer[0]?.toString(16)}`,
      );
    }
    return pubBuffer;
  }

  // ── ECDSA signing ─────────────────────────────────────────────────────────
  //
  // Output: { signature: 64-byte Buffer (r||s), recovery: 0|1 }
  //
  // CryptoService.createFullSignature prepends the recovery byte to produce
  // the 65-byte [recovery || r || s] buffer that Clarity secp256k1-recover? expects.

  ecdsaSign(msgHash: Buffer, privateKey: Buffer): SignatureResult {
    console.log('=== ecdsaSign ===');
    console.log('msgHash :', msgHash.toString('hex'));
    console.log('privKey length:', privateKey.length, 'bytes');

    if (msgHash.length !== 32) {
      throw new Error(`ecdsaSign: msgHash must be 32 bytes, got ${msgHash.length}`);
    }
    if (privateKey.length !== 32) {
      throw new Error(`ecdsaSign: privateKey must be 32 bytes, got ${privateKey.length}`);
    }

    const sig = secp256k1.sign(msgHash, privateKey, { lowS: true, der: false });
    const signature = Buffer.from(sig);

    const pubKey = this.publicKeyCreate(privateKey);
    
    // Find recovery by trying both values and seeing which recovers correctly
    let recovery = 0;
    let foundRecovery = false;
    
    for (let rec of [0, 1]) {
      const fullSig = Buffer.alloc(65);
      fullSig[0] = rec;
      signature.copy(fullSig, 1);
      
      // Try to recover public key using both methods
      try {
        // Use Signature class to recover
        const sigObj = secp256k1.Signature.fromHex(signature.toString('hex'));
        const recovered = secp256k1.recoverPublicKey(msgHash, fullSig, rec);
        const recoveredHex = Buffer.from(recovered).toString('hex');
        if (recoveredHex === pubKey.toString('hex')) {
          recovery = rec;
          foundRecovery = true;
          break;
        }
      } catch (e) {
        // Continue trying
      }
    }
    
    if (!foundRecovery) {
      // Fallback: assume recovery 0
      recovery = 0;
    }

    console.log('recovery :', recovery);
    console.log('sig (compact):', signature.toString('hex'));

    return { signature, recovery };
  }

  // ── Signature verification ────────────────────────────────────────────────
  //
  // Uses @noble/curves/secp256k1 directly.
  // Recovers the public key from [recovery || r || s] and compares.

  verifySignature(
    msgHash: Buffer,
    signature: Buffer,   // 64-byte compact r || s
    recovery: number,
    expectedPubKey: Buffer,
  ): boolean {
    try {
      // Reconstruct the Signature object with recovery info
      const sig = secp256k1.Signature
        .fromCompact(signature)
        .addRecoveryBit(recovery);

      // Recover the public key
      const recoveredPubKey = sig.recoverPublicKey(msgHash);
      const recoveredBytes = Buffer.from(recoveredPubKey.toRawBytes(true)); // compressed

      return recoveredBytes.toString('hex') === expectedPubKey.toString('hex');
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
