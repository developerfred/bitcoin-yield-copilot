import { randomUUID } from 'crypto';

/**
 * Wallet session for a user
 */
export interface WalletSession {
  id: string;
  userId: string;
  walletAddress: string;
  publicKey?: string;
  network: string;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
}

/**
 * Session store interface
 */
export interface SessionStore {
  create(session: WalletSession): Promise<void>;
  get(sessionId: string): Promise<WalletSession | null>;
  getByUserId(userId: string): Promise<WalletSession | null>;
  update(sessionId: string, updates: Partial<WalletSession>): Promise<void>;
  delete(sessionId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

/**
 * In-memory session store (for development)
 * Should be replaced with Redis or database in production
 */
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, WalletSession>();
  private userSessions = new Map<string, string>(); // userId -> sessionId

  async create(session: WalletSession): Promise<void> {
    // Delete any existing session for this user
    const existing = await this.getByUserId(session.userId);
    if (existing) {
      await this.delete(existing.id);
    }

    this.sessions.set(session.id, session);
    this.userSessions.set(session.userId, session.id);
  }

  async get(sessionId: string): Promise<WalletSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if expired
    if (new Date() > session.expiresAt) {
      await this.delete(sessionId);
      return null;
    }

    return session;
  }

  async getByUserId(userId: string): Promise<WalletSession | null> {
    const sessionId = this.userSessions.get(userId);
    if (!sessionId) return null;
    return this.get(sessionId);
  }

  async update(sessionId: string, updates: Partial<WalletSession>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const updated = { ...session, ...updates, lastActiveAt: new Date() };
    this.sessions.set(sessionId, updated);
  }

  async delete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.userSessions.delete(session.userId);
      this.sessions.delete(sessionId);
    }
  }

  async deleteExpired(): Promise<void> {
    const now = new Date();
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        await this.delete(id);
      }
    }
  }
}

/**
 * Session manager for wallet connections
 */
export class WalletSessionManager {
  private store: SessionStore;
  private sessionDurationMs: number;

  constructor(store: SessionStore, sessionDurationMs = 30 * 60 * 1000) {
    this.store = store;
    this.sessionDurationMs = sessionDurationMs;

    // Clean up expired sessions every 5 minutes
    setInterval(() => this.store.deleteExpired(), 5 * 60 * 1000);
  }

  /**
   * Create a new wallet session for a user
   */
  async createSession(
    userId: string,
    walletAddress: string,
    publicKey: string | undefined,
    network: string
  ): Promise<WalletSession> {
    const now = new Date();
    const session: WalletSession = {
      id: randomUUID(),
      userId,
      walletAddress,
      publicKey,
      network,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.sessionDurationMs),
      lastActiveAt: now,
    };

    await this.store.create(session);
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<WalletSession | null> {
    return this.store.get(sessionId);
  }

  /**
   * Get session by user ID
   */
  async getSessionByUserId(userId: string): Promise<WalletSession | null> {
    return this.store.getByUserId(userId);
  }

  /**
   * Check if user has an active wallet session
   */
  async hasActiveSession(userId: string): Promise<boolean> {
    const session = await this.getSessionByUserId(userId);
    return session !== null && new Date() <= session.expiresAt;
  }

  /**
   * Extend session expiration
   */
  async extendSession(userId: string): Promise<void> {
    const session = await this.getSessionByUserId(userId);
    if (!session) throw new Error('No active session');

    await this.store.update(session.id, {
      expiresAt: new Date(Date.now() + this.sessionDurationMs),
    });
  }

  /**
   * Disconnect wallet (delete session)
   */
  async disconnect(userId: string): Promise<void> {
    const session = await this.getSessionByUserId(userId);
    if (session) {
      await this.store.delete(session.id);
    }
  }

  /**
   * Get wallet address for user if connected
   */
  async getWalletAddress(userId: string): Promise<string | null> {
    const session = await this.getSessionByUserId(userId);
    return session?.walletAddress || null;
  }
}

// Default instance
const defaultStore = new InMemorySessionStore();
export const walletSessionManager = new WalletSessionManager(defaultStore);
