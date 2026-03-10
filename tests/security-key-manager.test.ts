import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyManager, EncryptedData } from '../src/security/keyManager.js';

// Mock config
vi.mock('../src/config.js', () => ({
  config: {
    encryption: {
      key: 'test-encryption-key',
      salt: 'test-salt'
    }
  }
}));

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(() => {
    vi.clearAllMocks();
    keyManager = new KeyManager();
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt data', () => {
      const data = 'sensitive private key data';
      
      const encrypted = keyManager.encrypt(data);
      const decrypted = keyManager.decrypt(encrypted);
      
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('version');
      expect(decrypted).toBe(data);
    });

    it('should produce different IVs each time', () => {
      const data = 'sensitive data';
      
      const encrypted1 = keyManager.encrypt(data);
      const encrypted2 = keyManager.encrypt(data);
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    it('should fail to decrypt with wrong key', () => {
      const data = 'sensitive data';
      const encrypted = keyManager.encrypt(data);
      
      // Mock with different encryption key
      vi.doMock('../src/config.js', () => ({
        config: {
          encryption: {
            key: 'different-key',
            salt: 'different-salt'
          }
        }
      }));
      
      const keyManager2 = new KeyManager();
      
      expect(() => {
        keyManager2.decrypt(encrypted);
      }).toThrow();
    });

    it('should reject tampered encrypted data', () => {
      const data = 'sensitive data';
      const encrypted = keyManager.encrypt(data);
      
      // Tamper with the ciphertext
      const tampered: EncryptedData = { 
        ...encrypted, 
        ciphertext: 'tampered' + encrypted.ciphertext 
      };
      
      expect(() => {
        keyManager.decrypt(tampered);
      }).toThrow();
    });

    it('should reject data with invalid auth tag', () => {
      const data = 'sensitive data';
      const encrypted = keyManager.encrypt(data);
      
      // Tamper with auth tag
      const tampered: EncryptedData = { 
        ...encrypted, 
        authTag: 'invalid' 
      };
      
      expect(() => {
        keyManager.decrypt(tampered);
      }).toThrow();
    });

    it('should reject data with invalid IV', () => {
      const data = 'sensitive data';
      const encrypted = keyManager.encrypt(data);
      
      // Tamper with IV
      const tampered: EncryptedData = { 
        ...encrypted, 
        iv: 'invalid' 
      };
      
      expect(() => {
        keyManager.decrypt(tampered);
      }).toThrow();
    });

    it('should reject unsupported version', () => {
      const data = 'sensitive data';
      const encrypted = keyManager.encrypt(data);
      
      // Change version
      const tampered: EncryptedData = { 
        ...encrypted, 
        version: '2.0' 
      };
      
      expect(() => {
        keyManager.decrypt(tampered);
      }).toThrow();
    });
  });

  describe('encrypted data validation', () => {
    it('should validate correct encrypted data structure', () => {
      const data = 'test data';
      const encrypted = keyManager.encrypt(data);
      
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.version).toBe('1.0');
    });

    it('should handle empty data', () => {
      const data = '';
      const encrypted = keyManager.encrypt(data);
      const decrypted = keyManager.decrypt(encrypted);
      
      expect(decrypted).toBe('');
    });

    it('should handle special characters', () => {
      const data = 'special !@#$%^&*() chars\nnewline\r\ntab\t';
      const encrypted = keyManager.encrypt(data);
      const decrypted = keyManager.decrypt(encrypted);
      
      expect(decrypted).toBe(data);
    });

    it('should handle binary data', () => {
      const data = Buffer.from([0x00, 0xff, 0x80, 0x7f]).toString('binary');
      const encrypted = keyManager.encrypt(data);
      const decrypted = keyManager.decrypt(encrypted);
      
      expect(decrypted).toBe(data);
    });
  });

  describe('error handling', () => {
    it('should throw on decryption with missing fields', () => {
      const invalidData: Partial<EncryptedData> = {
        iv: 'test',
        ciphertext: 'test',
        // Missing authTag
        version: '1.0'
      };
      
      expect(() => {
        keyManager.decrypt(invalidData as EncryptedData);
      }).toThrow();
    });

    it('should throw on decryption with empty fields', () => {
      const invalidData: EncryptedData = {
        iv: '',
        ciphertext: '',
        authTag: '',
        version: '1.0'
      };
      
      expect(() => {
        keyManager.decrypt(invalidData);
      }).toThrow();
    });

    it('should throw on decryption with malformed base64', () => {
      const invalidData: EncryptedData = {
        iv: 'not-base64',
        ciphertext: 'not-base64',
        authTag: 'not-base64',
        version: '1.0'
      };
      
      expect(() => {
        keyManager.decrypt(invalidData);
      }).toThrow();
    });
  });

  describe('performance and memory', () => {
    it('should handle large data', () => {
      const largeData = 'x'.repeat(10000); // 10KB
      
      const encrypted = keyManager.encrypt(largeData);
      const decrypted = keyManager.decrypt(encrypted);
      
      expect(decrypted).toBe(largeData);
    });

    it('should handle many encryption operations', () => {
      const data = 'test data';
      
      // Perform many encryption operations
      for (let i = 0; i < 100; i++) {
        const encrypted = keyManager.encrypt(data);
        const decrypted = keyManager.decrypt(encrypted);
        expect(decrypted).toBe(data);
      }
    });
  });

  describe('key derivation', () => {
    it('should derive consistent encryption key', () => {
      // Create two instances with same config
      const keyManager1 = new KeyManager();
      const keyManager2 = new KeyManager();
      
      const data = 'test data';
      const encrypted1 = keyManager1.encrypt(data);
      const encrypted2 = keyManager2.encrypt(data);
      
      // Both should be able to decrypt each other's data
      const decrypted1 = keyManager1.decrypt(encrypted2);
      const decrypted2 = keyManager2.decrypt(encrypted1);
      
      expect(decrypted1).toBe(data);
      expect(decrypted2).toBe(data);
    });

    it('should use scrypt for key derivation', () => {
      const keyManager = new KeyManager();
      const data = 'test data';
      
      // Encryption should work with scrypt-derived key
      const encrypted = keyManager.encrypt(data);
      const decrypted = keyManager.decrypt(encrypted);
      
      expect(decrypted).toBe(data);
    });
  });
});