import { Bot } from 'grammy';
import { keyManager } from '../security/keyManager.js';
import { config } from '../config.js';
import pino from 'pino';

const logger = pino({
  level: config.log.level,
  name: 'key-delivery'
});

/**
 * Secure Key Delivery API
 * 
 * Provides authenticated endpoints for key management:
 * - Generate new encrypted keys
 * - Deliver keys to authorized services
 * - Rotate encryption keys
 * - Audit key access
 */

export class KeyDeliveryAPI {
  private bot: Bot;
  private authorizedServices: Set<string>;

  constructor(bot: Bot) {
    this.bot = bot;
    this.authorizedServices = new Set();
    
    // Pre-authorized services (could be loaded from config)
    this.authorizedServices.add('wallet-manager');
    this.authorizedServices.add('transaction-service');
  }

  /**
   * Generate and deliver a new encrypted private key
   */
  async generateKey(serviceName: string, requesterId: string): Promise<{
    success: boolean;
    encryptedKey?: any;
    deliveryNonce?: string;
    error?: string;
  }> {
    // Authentication check
    if (!this.isServiceAuthorized(serviceName)) {
      logger.warn({ serviceName, requesterId }, 'Unauthorized service key request');
      return { success: false, error: 'Service not authorized' };
    }

    try {
      // Generate secure private key
      const privateKey = keyManager.generatePrivateKey();
      
      // Encrypt and deliver
      const delivery = keyManager.deliverKey(privateKey);
      
      logger.info({
        serviceName,
        requesterId,
        deliveryNonce: delivery.deliveryNonce
      }, 'Key generated and encrypted');

      return {
        success: true,
        encryptedKey: delivery.encryptedKey,
        deliveryNonce: delivery.deliveryNonce
      };

    } catch (error) {
      logger.error({ error, serviceName, requesterId }, 'Key generation failed');
      return { success: false, error: 'Key generation failed' };
    }
  }

  /**
   * Deliver an existing encrypted key to authorized service
   */
  async deliverKey(
    encryptedKey: any,
    serviceName: string,
    requesterId: string
  ): Promise<{
    success: boolean;
    redeliveredKey?: any;
    deliveryNonce?: string;
    error?: string;
  }> {
    if (!this.isServiceAuthorized(serviceName)) {
      logger.warn({ serviceName, requesterId }, 'Unauthorized key delivery request');
      return { success: false, error: 'Service not authorized' };
    }

    try {
      // Re-encrypt with current environment key for additional security
      const delivery = keyManager.deliverKey(encryptedKey);
      
      logger.info({
        serviceName,
        requesterId,
        deliveryNonce: delivery.deliveryNonce
      }, 'Key redelivered with fresh encryption');

      return {
        success: true,
        redeliveredKey: delivery.encryptedKey,
        deliveryNonce: delivery.deliveryNonce
      };

    } catch (error) {
      logger.error({ error, serviceName, requesterId }, 'Key delivery failed');
      return { success: false, error: 'Key delivery failed' };
    }
  }

  /**
   * Rotate encryption keys (for security maintenance)
   */
  async rotateKeys(): Promise<{ success: boolean; message: string }> {
    logger.info('Initiating encryption key rotation');
    
    // In a real implementation, this would:
    // 1. Generate new encryption key
    // 2. Re-encrypt all stored keys
    // 3. Update environment variables
    // 4. Verify all keys are accessible
    
    return {
      success: true,
      message: 'Key rotation simulated - implement proper key rotation procedure'
    };
  }

  /**
   * Authorization check
   */
  private isServiceAuthorized(serviceName: string): boolean {
    return this.authorizedServices.has(serviceName);
  }

  /**
   * Add service to authorized list
   */
  authorizeService(serviceName: string): void {
    this.authorizedServices.add(serviceName);
    logger.info({ serviceName }, 'Service authorized for key access');
  }

  /**
   * Remove service from authorized list
   */
  deauthorizeService(serviceName: string): void {
    this.authorizedServices.delete(serviceName);
    logger.info({ serviceName }, 'Service deauthorized from key access');
  }

  /**
   * Get audit log of key operations
   */
  getAuditLog(): any[] {
    // This would query a database in real implementation
    return [
      {
        timestamp: new Date().toISOString(),
        event: 'service_started',
        message: 'KeyDeliveryAPI initialized'
      }
    ];
  }
}

// Export singleton
let keyDeliveryInstance: KeyDeliveryAPI | null = null;

export function getKeyDeliveryAPI(bot?: Bot): KeyDeliveryAPI {
  if (!keyDeliveryInstance && bot) {
    keyDeliveryInstance = new KeyDeliveryAPI(bot);
  }
  return keyDeliveryInstance!;
}