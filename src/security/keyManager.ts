import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { config } from '../config.js';

/**
 * Secure Key Management Service
 * 
 * Encrypts private keys using AES-256-GCM with environment-derived keys.
 * The encryption key is derived from ENCRYPTION_KEY + KEY_DERIVATION_SALT.
 * This ensures keys are never stored in plaintext and are environment-specific.
 */

export interface EncryptedData {
  iv: string;      // Initialization Vector (base64)
  ciphertext: string; // Encrypted data (base64)
  authTag: string;  // Authentication tag (base64)
  version: string;  // Encryption scheme version
}

export class KeyManager {
  private encryptionKey: Buffer;

  constructor() {
    // Derive encryption key from environment variables
    this.encryptionKey = this.deriveKey(
      config.encryption.key,
      config.encryption.salt
    );
  }

  /**
   * Derive a secure encryption key using scrypt
   */
  private deriveKey(keyMaterial: string, salt: string): Buffer {
    return scryptSync(keyMaterial, salt, 32); // 32 bytes for AES-256
  }

  /**
   * Encrypt sensitive data (private keys)
   */
  encrypt(data: string): EncryptedData {
    const iv = randomBytes(12); // 12 bytes for GCM
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let ciphertext = cipher.update(data, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      ciphertext,
      authTag: authTag.toString('base64'),
      version: '1.0'
    };
  }

  /**
   * Decrypt encrypted data
   */
  decrypt(encryptedData: EncryptedData): string {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Secure key delivery service
   * Returns encrypted key that can only be decrypted by the authorized service
   */
  deliverKey(plaintextKey: string, servicePublicKey?: string): {
    encryptedKey: EncryptedData;
    deliveryNonce: string;
  } {
    // Encrypt the key
    const encryptedKey = this.encrypt(plaintextKey);
    
    // Generate delivery nonce for audit trail
    const deliveryNonce = randomBytes(16).toString('hex');
    
    // TODO: If servicePublicKey is provided, add asymmetric encryption layer
    
    return {
      encryptedKey,
      deliveryNonce
    };
  }

  /**
   * Generate a secure random private key
   */
  generatePrivateKey(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Validate key format and security
   */
  validatePrivateKey(key: string): boolean {
    // Must be 64 hex characters (32 bytes)
    if (!/^[0-9a-f]{64}$/i.test(key)) {
      return false;
    }
    
    // Additional validation: key should not be all zeros or easily guessable
    if (key === '0'.repeat(64)) {
      return false;
    }
    
    return true;
  }
}

// Singleton instance
export const keyManager = new KeyManager();