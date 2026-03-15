import pino from 'pino';

const logger = pino({ name: 'security:supply-chain' });

export interface SupplyChainConfig {
  allowedNpmRegistries: string[];
  trustedPackagePatterns: RegExp[];
  blockedPackagePatterns: RegExp[];
  requireChecksumVerification: boolean;
  enableDockerImageVerification: boolean;
}

const DEFAULT_CONFIG: SupplyChainConfig = {
  allowedNpmRegistries: [
    'https://registry.npmjs.org',
  ],
  trustedPackagePatterns: [
    /^@anthropic-ai\//,
    /^@stacks\//,
    /^@scure\//,
    /^grammy/,
    /^pino/,
    /^zod/,
    /^dotenv/,
    /^@modelcontextprotocol\//,
  ],
  blockedPackagePatterns: [
    /-exe$/,
    /\.exe$/,
    /eval/,
    /exec/,
    /shell/,
  ],
  requireChecksumVerification: true,
  enableDockerImageVerification: true,
};

export class SupplyChainGuard {
  private config: SupplyChainConfig;
  private verifiedPackages: Set<string> = new Set();
  private packageChecksums: Map<string, string> = new Map();

  constructor(config: Partial<SupplyChainConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validatePackageInstallation(packageName: string, version: string): { allowed: boolean; reason?: string } {
    logger.debug({ package: packageName, version }, 'Validating package installation');

    for (const blocked of this.config.blockedPackagePatterns) {
      if (blocked.test(packageName)) {
        logger.warn({ package: packageName }, 'Blocked package pattern detected');
        return { allowed: false, reason: `Package name matches blocked pattern: ${blocked}` };
      }
    }

    if (!this.isPackageTrusted(packageName)) {
      logger.warn({ package: packageName }, 'Package not in trusted list');
      return { allowed: false, reason: `Package ${packageName} is not in the trusted list` };
    }

    return { allowed: true };
  }

  private isPackageTrusted(packageName: string): boolean {
    for (const pattern of this.config.trustedPackagePatterns) {
      if (pattern.test(packageName)) {
        return true;
      }
    }
    return false;
  }

  validateDockerImage(imageName: string): { allowed: boolean; reason?: string } {
    if (!this.config.enableDockerImageVerification) {
      return { allowed: true };
    }

    const allowedImages = [
      'aibtc-mcp-server',
    ];

    const imageBase = imageName.split(':')[0].split('/').pop() || '';

    if (!allowedImages.includes(imageBase)) {
      logger.warn({ image: imageName }, 'Docker image not in allowed list');
      return { allowed: false, reason: `Docker image ${imageName} is not in the allowed list` };
    }

    return { allowed: true };
  }

  verifyPackageChecksum(packageName: string, expectedChecksum: string): boolean {
    if (!this.config.requireChecksumVerification) {
      return true;
    }

    const stored = this.packageChecksums.get(packageName);
    if (stored && stored !== expectedChecksum) {
      logger.error({ package: packageName, expected: expectedChecksum, actual: stored }, 'Package checksum mismatch!');
      return false;
    }

    this.packageChecksums.set(packageName, expectedChecksum);
    this.verifiedPackages.add(packageName);
    return true;
  }

  isPackageVerified(packageName: string): boolean {
    return this.verifiedPackages.has(packageName);
  }

  getTrustedPackages(): string[] {
    return this.config.trustedPackagePatterns.map(p => p.source);
  }
}

export const supplyChainGuard = new SupplyChainGuard();
