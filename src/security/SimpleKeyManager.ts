import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Simple Key Manager for testing
 * Uses direct encryption key instead of derived keys
 */

export interface EncryptedData {
  iv: string;      // Initialization Vector (base64)
  ciphertext: string; // Encrypted data (base64)
  authTag: string;  // Authentication tag (base64)
  version: string;  // Encryption scheme version
}

export class SimpleKeyManager {
  private encryptionKey: Buffer;

  constructor(encryptionKey: string) {
    // Use key directly (first 32 bytes)
    this.encryptionKey = Buffer.from(encryptionKey.slice(0, 32));
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

// Export simple instance for testing
export const simpleKeyManager = new SimpleKeyManager(
  process.env.ENCRYPTION_KEY || 'default-encryption-key-min-32-chars'
);