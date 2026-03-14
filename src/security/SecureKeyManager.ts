import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface SecureKeyConfig {
  encryptionKey: string;
  salt: string;
}

export class SecureKeyManager {
  private encryptionKey: Buffer;
  private ivLength = 16;
  private saltLength = 32;
  private tagLength = 16;

  constructor(config: SecureKeyConfig) {
    this.encryptionKey = scryptSync(config.encryptionKey, config.salt, 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64');
    
    const iv = data.subarray(0, this.ivLength);
    const tag = data.subarray(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = data.subarray(this.ivLength + this.tagLength);
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  maskKey(key: string, visibleChars = 4): string {
    if (key.length <= visibleChars) {
      return '*'.repeat(key.length);
    }
    return key.slice(0, visibleChars) + '*'.repeat(key.length - visibleChars);
  }

  generateSecureId(): string {
    return randomBytes(16).toString('hex');
  }
}

export const createSecureKeyManager = (config: SecureKeyConfig): SecureKeyManager => {
  return new SecureKeyManager(config);
};
