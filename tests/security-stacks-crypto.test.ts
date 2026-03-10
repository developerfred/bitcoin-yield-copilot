import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StacksCrypto } from '../src/security/stacksCrypto.js';

// Mock config
vi.mock('../src/config.js', () => ({
  config: {
    encryption: {
      key: 'test-encryption-key',
      salt: 'test-salt'
    }
  }
}));

describe('StacksCrypto', () => {
  let crypto: StacksCrypto;

  beforeEach(() => {
    vi.clearAllMocks();
    crypto = new StacksCrypto();
  });

  describe('key generation', () => {
    it('should generate random private key', () => {
      const privateKey = crypto.makeRandomPrivKey();
      
      expect(privateKey).toBeTruthy();
      expect(privateKey.data).toHaveLength(32); // 32 bytes
    });

    it('should convert private key to public key', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const publicKey = crypto.privateKeyToPublic(privateKey);
      
      expect(publicKey).toBeTruthy();
      expect(publicKey.data).toHaveLength(33); // Compressed public key
    });

    it('should get address from private key', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const address = crypto.getAddressFromPrivateKey(privateKey);
      
      expect(address).toBeTruthy();
      expect(address).toMatch(/^SP[0-9A-Z]+$/); // Stacks address format
    });

    it('should generate consistent address from same private key', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const address1 = crypto.getAddressFromPrivateKey(privateKey);
      const address2 = crypto.getAddressFromPrivateKey(privateKey);
      
      expect(address1).toBe(address2);
    });
  });

  describe('signing and verification', () => {
    it('should sign message and verify signature', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const message = Buffer.from('test message');
      
      const signature = crypto.signCompact(message, privateKey);
      const isValid = crypto.verifyCompact(message, signature.signature, signature.recovery);
      
      expect(signature).toHaveProperty('signature');
      expect(signature).toHaveProperty('recovery');
      expect(signature.signature).toHaveLength(64); // 64-byte compact signature
      expect(isValid).toBe(true);
    });

    it('should sign message and get recoverable signature', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const message = Buffer.from('test message');
      
      const result = crypto.signRecoverable(message, privateKey);
      
      expect(result).toHaveProperty('signature');
      expect(result).toHaveProperty('recovery');
      expect(result.signature).toBeTruthy();
      expect([0, 1]).toContain(result.recovery);
    });

    it('should recover public key from signature', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const message = Buffer.from('test message');
      const signature = crypto.signRecoverable(message, privateKey);
      
      const recoveredPublicKey = crypto.recoverPublicKey(
        message,
        signature.signature,
        signature.recovery
      );
      
      expect(recoveredPublicKey).toBeTruthy();
    });

    it('should generate deterministic signature', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const message = Buffer.from('test message');
      
      const signature1 = crypto.signCompact(message, privateKey);
      const signature2 = crypto.signCompact(message, privateKey);
      
      // With deterministic ECDSA, same inputs should produce same signature
      expect(signature1.signature.toString('hex')).toBe(signature2.signature.toString('hex'));
      expect(signature1.recovery).toBe(signature2.recovery);
    });
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt data', () => {
      const data = 'sensitive private key data';
      
      const encrypted = crypto.encrypt(data);
      const decrypted = crypto.decrypt(encrypted);
      
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('version');
      expect(decrypted).toBe(data);
    });

    it('should fail to decrypt with wrong key', () => {
      const data = 'sensitive data';
      const encrypted = crypto.encrypt(data);
      
      // Create another crypto instance with different key
      vi.doMock('../src/config.js', () => ({
        config: {
          encryption: {
            key: 'different-key',
            salt: 'different-salt'
          }
        }
      }));
      
      const crypto2 = new StacksCrypto();
      
      expect(() => {
        crypto2.decrypt(encrypted);
      }).toThrow();
    });

    it('should reject tampered encrypted data', () => {
      const data = 'sensitive data';
      const encrypted = crypto.encrypt(data);
      
      // Tamper with the ciphertext
      const tampered = { ...encrypted, ciphertext: 'tampered' + encrypted.ciphertext };
      
      expect(() => {
        crypto.decrypt(tampered);
      }).toThrow();
    });

    it('should reject data with invalid auth tag', () => {
      const data = 'sensitive data';
      const encrypted = crypto.encrypt(data);
      
      // Tamper with auth tag
      const tampered = { ...encrypted, authTag: 'invalid' };
      
      expect(() => {
        crypto.decrypt(tampered);
      }).toThrow();
    });
  });

  describe('hash functions', () => {
    it('should compute SHA256 hash', () => {
      const data = Buffer.from('test data');
      const hash = crypto.sha256(data);
      
      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(32); // 32 bytes
    });

    it('should compute consistent SHA256 hash', () => {
      const data = Buffer.from('test data');
      const hash1 = crypto.sha256(data);
      const hash2 = crypto.sha256(data);
      
      expect(hash1.toString('hex')).toBe(hash2.toString('hex'));
    });

    it('should compute HMAC-SHA256', () => {
      const key = Buffer.from('secret key');
      const data = Buffer.from('test data');
      const hmac = crypto.hmacSha256(key, data);
      
      expect(hmac).toBeTruthy();
      expect(hmac).toHaveLength(32); // 32 bytes
    });

    it('should produce different HMAC with different keys', () => {
      const data = Buffer.from('test data');
      const hmac1 = crypto.hmacSha256(Buffer.from('key1'), data);
      const hmac2 = crypto.hmacSha256(Buffer.from('key2'), data);
      
      expect(hmac1.toString('hex')).not.toBe(hmac2.toString('hex'));
    });
  });

  describe('key derivation', () => {
    it('should derive encryption key from password and salt', () => {
      const password = 'test-password';
      const salt = 'test-salt';
      
      const derivedKey = crypto.deriveKey(password, salt);
      
      expect(derivedKey).toBeTruthy();
      expect(derivedKey).toHaveLength(32); // 32 bytes for AES-256
    });

    it('should derive consistent key from same inputs', () => {
      const password = 'test-password';
      const salt = 'test-salt';
      
      const key1 = crypto.deriveKey(password, salt);
      const key2 = crypto.deriveKey(password, salt);
      
      expect(key1.toString('hex')).toBe(key2.toString('hex'));
    });

    it('should derive different keys with different salts', () => {
      const password = 'test-password';
      
      const key1 = crypto.deriveKey(password, 'salt1');
      const key2 = crypto.deriveKey(password, 'salt2');
      
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });

    it('should derive different keys with different passwords', () => {
      const salt = 'test-salt';
      
      const key1 = crypto.deriveKey('password1', salt);
      const key2 = crypto.deriveKey('password2', salt);
      
      expect(key1.toString('hex')).not.toBe(key2.toString('hex'));
    });
  });

  describe('error handling', () => {
    it('should throw on invalid private key for signing', () => {
      const invalidKey = { data: Buffer.alloc(31) }; // Too short
      const message = Buffer.from('test');
      
      expect(() => {
        crypto.signCompact(message, invalidKey);
      }).toThrow();
    });

    it('should throw on invalid signature for verification', () => {
      const message = Buffer.from('test');
      const invalidSignature = Buffer.alloc(63); // Wrong length
      const recovery = 0;
      
      expect(() => {
        crypto.verifyCompact(message, invalidSignature, recovery);
      }).toThrow();
    });

    it('should throw on invalid recovery parameter', () => {
      const privateKey = crypto.makeRandomPrivKey();
      const message = Buffer.from('test');
      const signature = crypto.signCompact(message, privateKey);
      
      expect(() => {
        crypto.verifyCompact(message, signature.signature, 2); // Invalid recovery (>1)
      }).toThrow();
    });
  });
});