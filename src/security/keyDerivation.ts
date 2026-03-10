import { scryptSync, randomBytes } from 'crypto';
import { config } from '../config.js';

/**
 * Advanced Key Derivation System
 * 
 * Derives encryption keys from multiple environment factors:
 * - ENCRYPTION_KEY (primary secret)
 * - KEY_DERIVATION_SALT (per-environment salt)
 * - Application-specific context
 * - Network environment
 * 
 * This ensures keys are unique to each deployment environment.
 */

export class KeyDerivation {
  
  /**
   * Derive environment-specific encryption key
   */
  deriveEnvironmentKey(): Buffer {
    const keyMaterial = config.encryption.key;
    const salt = this.generateEnvironmentSalt();
    
    return scryptSync(keyMaterial, salt, 32); // 32 bytes for AES-256
  }

  /**
   * Generate salt based on environment characteristics
   */
  private generateEnvironmentSalt(): string {
    const factors = [
      config.encryption.salt,                    // Base salt from config
      config.stacks.network,                    // Network environment (testnet/mainnet)
      process.env.NODE_ENV || 'development',    // Node environment
      process.env.HOSTNAME || '',               // Machine hostname
      this.getApplicationFingerprint()          // Application-specific fingerprint
    ];

    return factors.join(':');
  }

  /**
   * Create application fingerprint for additional entropy
   */
  private getApplicationFingerprint(): string {
    const appFactors = [
      config.telegram.botToken.substring(0, 8),  // First 8 chars of bot token
      config.llm.provider,                      // LLM provider
      process.pid.toString(),                    // Process ID
      Math.floor(Date.now() / 3600000).toString() // Hour timestamp
    ];

    return appFactors.join('|');
  }

  /**
   * Derive key for specific purpose with additional context
   */
  derivePurposeKey(purpose: string, context?: string): Buffer {
    const baseKey = this.deriveEnvironmentKey();
    const purposeSalt = this.generatePurposeSalt(purpose, context);
    
    return scryptSync(baseKey.toString('hex'), purposeSalt, 32);
  }

  /**
   * Generate salt for specific key purpose
   */
  private generatePurposeSalt(purpose: string, context?: string): string {
    const factors = [
      purpose,
      context || '',
      Math.floor(Date.now() / 86400000).toString(), // Daily timestamp
      randomBytes(4).toString('hex')               // Random component
    ];

    return factors.join(':');
  }

  /**
   * Rotate derivation parameters (for security maintenance)
   */
  rotateDerivationParameters(): {
    newSalt: string;
    fingerprint: string;
  } {
    const newSalt = randomBytes(16).toString('hex');
    const newFingerprint = this.getApplicationFingerprint();
    
    // In real implementation, this would update environment variables
    // and re-encrypt all keys with new derivation parameters
    
    return {
      newSalt,
      fingerprint: newFingerprint
    };
  }

  /**
   * Validate key derivation parameters
   */
  validateDerivationParameters(): boolean {
    // Check that all required factors are present
    const factors = [
      config.encryption.key,
      config.encryption.salt,
      config.stacks.network,
      process.env.NODE_ENV
    ];

    return factors.every(factor => factor && factor.length > 0);
  }

  /**
   * Get derivation audit information
   */
  getDerivationAudit(): {
    environment: string;
    factors: string[];
    isValid: boolean;
  } {
    return {
      environment: process.env.NODE_ENV || 'development',
      factors: [
        `key: ${config.encryption.key ? 'SET' : 'MISSING'}`,
        `salt: ${config.encryption.salt ? 'SET' : 'MISSING'}`,
        `network: ${config.stacks.network}`,
        `node_env: ${process.env.NODE_ENV || 'development'}`
      ],
      isValid: this.validateDerivationParameters()
    };
  }
}

// Singleton instance
export const keyDerivation = new KeyDerivation();