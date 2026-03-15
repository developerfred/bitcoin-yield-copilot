import pino from 'pino';

const logger = pino({ name: 'security:llm-guard' });

export interface SecurityConfig {
  maxPromptLength: number;
  maxToolCallsPerMinute: number;
  enablePromptInjectionDetection: boolean;
  enableJailbreakDetection: boolean;
  suspiciousPatterns: string[];
  blockedPatterns: string[];
}

const DEFAULT_CONFIG: SecurityConfig = {
  maxPromptLength: 10000,
  maxToolCallsPerMinute: 30,
  enablePromptInjectionDetection: true,
  enableJailbreakDetection: true,
  suspiciousPatterns: [
    'ignore previous instructions',
    'ignore all previous',
    'disregard your guidelines',
    'bypass your restrictions',
    'override your rules',
    'forget your instructions',
    'new instructions:',
    'system prompt',
    '# instructions',
    'you are now',
    'pretend to be',
    'roleplay as',
    'act as if',
    'delimiters',
    'xml tags',
    'ignoreabove',
    'system:',
    'assistant:',
    'user:',
  ],
  blockedPatterns: [
    '<script',
    'javascript:',
    'onerror=',
    'onclick=',
    'eval(',
    'innerHTML',
    '__proto__',
    'constructor',
  ],
};

export class LLMGuard {
  private config: SecurityConfig;
  private toolCallCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startRateLimitCleanup();
  }

  validateUserInput(input: string): { valid: boolean; error?: string; sanitized?: string } {
    if (!input || input.trim().length === 0) {
      return { valid: false, error: 'Empty input not allowed' };
    }

    if (input.length > this.config.maxPromptLength) {
      return { valid: false, error: `Input exceeds maximum length of ${this.config.maxPromptLength}` };
    }

    const lowerInput = input.toLowerCase();

    for (const pattern of this.config.blockedPatterns) {
      if (lowerInput.includes(pattern.toLowerCase())) {
        logger.warn({ pattern, input: input.slice(0, 100) }, 'Blocked pattern detected');
        return { valid: false, error: 'Input contains blocked content' };
      }
    }

    if (this.config.enablePromptInjectionDetection) {
      const injectionScore = this.detectPromptInjection(input);
      if (injectionScore > 0.7) {
        logger.warn({ score: injectionScore, input: input.slice(0, 100) }, 'High prompt injection probability');
        return { valid: false, error: 'Input appears to contain prompt injection attempt' };
      }
    }

    if (this.config.enableJailbreakDetection) {
      const jailbreakScore = this.detectJailbreak(input);
      if (jailbreakScore > 0.6) {
        logger.warn({ score: jailbreakScore, input: input.slice(0, 100) }, 'Jailbreak attempt detected');
        return { valid: false, error: 'Input appears to contain jailbreak attempt' };
      }
    }

    const sanitized = this.sanitizeInput(input);
    return { valid: true, sanitized };
  }

  private detectPromptInjection(input: string): number {
    const lowerInput = input.toLowerCase();
    let score = 0;
    let matches = 0;

    for (const pattern of this.config.suspiciousPatterns) {
      if (lowerInput.includes(pattern.toLowerCase())) {
        matches++;
        score += 0.15;
      }
    }

    if (input.includes('```') || input.includes('###') || input.includes('---')) {
      score += 0.2;
      matches++;
    }

    if (/^ignore\s+all/i.test(input) || /^\s*you\s+are/i.test(input)) {
      score += 0.3;
    }

    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = input.match(urlPattern);
    if (urls && urls.length > 2) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private detectJailbreak(input: string): number {
    let score = 0;
    const lowerInput = input.toLowerCase();

    const jailbreakPhrases = [
      'do anything now',
      'anything goes',
      'no rules',
      'no restrictions',
      'without limits',
      'jailbreak',
      'developer mode',
      ' DAN ',
      'evil',
      'super evil',
    ];

    for (const phrase of jailbreakPhrases) {
      if (lowerInput.includes(phrase)) {
        score += 0.25;
      }
    }

    if (/^act\s+as\s+/i.test(input) || /^pretend\s+/i.test(input)) {
      score += 0.2;
    }

    if (input.length > 500 && !input.includes('?')) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  private sanitizeInput(input: string): string {
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  checkToolCallRate(userId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.toolCallCounts.get(userId);

    if (!bucket || bucket.resetTime < now) {
      bucket = { count: 0, resetTime: now + 60000 };
      this.toolCallCounts.set(userId, bucket);
    }

    bucket.count++;
    const remaining = Math.max(0, this.config.maxToolCallsPerMinute - bucket.count);

    return {
      allowed: bucket.count <= this.config.maxToolCallsPerMinute,
      remaining,
    };
  }

  private startRateLimitCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.toolCallCounts.entries()) {
        if (bucket.resetTime < now) {
          this.toolCallCounts.delete(key);
        }
      }
    }, 60000);
  }
}

export const llmGuard = new LLMGuard();
