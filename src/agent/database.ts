import BetterSqlite3 from 'better-sqlite3';
import { config } from '../config.js';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino({ name: 'database' });

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath?: string) {
    const finalPath = dbPath ?? config.database.path;
    
    // Ensure directory exists
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(finalPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT UNIQUE NOT NULL,
        stacks_address TEXT,
        risk_profile TEXT,
        allowed_tokens TEXT,
        is_onboarded INTEGER DEFAULT 0,
        onboarding_step TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        token TEXT NOT NULL,
        amount REAL NOT NULL,
        apy REAL NOT NULL,
        tx_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        protocol TEXT,
        token TEXT,
        amount REAL,
        tx_hash TEXT,
        status TEXT NOT NULL,
        reasoning TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS apy_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        threshold REAL NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    `);

    logger.info('Database initialized');
  }

  // User methods
  async createUser(telegramId: string): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO users (telegram_id) VALUES (?)
    `);
    stmt.run(telegramId);
    return this.getUserId(telegramId);
  }

  async getUser(telegramId: string) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(telegramId);
  }

  async getUserId(telegramId: string): Promise<number> {
    const user = await this.getUser(telegramId);
    return user?.id;
  }

  async updateOnboardingStep(telegramId: string, step: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users SET onboarding_step = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
    `);
    stmt.run(step, telegramId);
  }

  async updateRiskProfile(telegramId: string, riskProfile: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users SET risk_profile = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
    `);
    stmt.run(riskProfile, telegramId);
  }

  async updateAllowedTokens(telegramId: string, tokens: string[]): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users SET allowed_tokens = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
    `);
    stmt.run(JSON.stringify(tokens), telegramId);
  }

  async updateStacksAddress(telegramId: string, address: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users SET stacks_address = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
    `);
    stmt.run(address, telegramId);
  }

  async completeOnboarding(telegramId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users SET is_onboarded = 1, onboarding_step = NULL, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?
    `);
    stmt.run(telegramId);
  }

  // Position methods
  async createPosition(userId: number, protocol: string, token: string, amount: number, apy: number, txHash?: string): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO positions (user_id, protocol, token, amount, apy, tx_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(userId, protocol, token, amount, apy, txHash);
    return result.lastInsertRowid as number;
  }

  async getUserPositions(userId: number) {
    const stmt = this.db.prepare('SELECT * FROM positions WHERE user_id = ?');
    return stmt.all(userId);
  }

  async deletePosition(positionId: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM positions WHERE id = ?');
    stmt.run(positionId);
  }

  // Transaction methods
  async createTransaction(
    userId: number,
    type: string,
    protocol: string,
    token: string,
    amount: number,
    txHash: string,
    status: string,
    reasoning?: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (user_id, type, protocol, token, amount, tx_hash, status, reasoning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(userId, type, protocol, token, amount, txHash, status, reasoning);
    return result.lastInsertRowid as number;
  }

  async getUserTransactions(userId: number, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(userId, limit);
  }

  // Alert methods
  async createAlert(userId: number, protocol: string, threshold: number): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO apy_alerts (user_id, protocol, threshold) VALUES (?, ?, ?)
    `);
    const result = stmt.run(userId, protocol, threshold);
    return result.lastInsertRowid as number;
  }

  async getUserAlerts(userId: number) {
    const stmt = this.db.prepare('SELECT * FROM apy_alerts WHERE user_id = ? AND is_active = 1');
    return stmt.all(userId);
  }

  async deleteAlert(alertId: number): Promise<void> {
    const stmt = this.db.prepare('UPDATE apy_alerts SET is_active = 0 WHERE id = ?');
    stmt.run(alertId);
  }

  close(): void {
    this.db.close();
  }
}

let _db: Database | null = null;

export function getDatabase(dbPath?: string): Database {
  if (!_db) {
    _db = new Database(dbPath);
  }
  return _db;
}

export const db = new Database();
