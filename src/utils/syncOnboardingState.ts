import BetterSqlite3 from 'better-sqlite3';
import { getDatabase } from '../agent/database.js';

export async function syncOnboardingToAuth(): Promise<void> {
  console.log('[Sync] Syncing onboarding state to auth system...');

  try {
    const onboardingDb = new BetterSqlite3(process.env.DB_PATH ?? './data/copilot.db');

    const completed = onboardingDb.prepare(`
      SELECT telegram_id, contract_address 
      FROM onboarding_state 
      WHERE step = 'done' AND contract_address IS NOT NULL
    `).all() as { telegram_id: string; contract_address: string }[];

    console.log(`[Sync] Found ${completed.length} completed onboardings`);

    const db = getDatabase();

    for (const row of completed) {
      try {
        const user = await db.getUser(row.telegram_id) as any;

        if (!user?.is_onboarded) {          
          await db.createUser(row.telegram_id);
          await db.updateStacksAddress(row.telegram_id, row.contract_address);
          await db.completeOnboarding(row.telegram_id);          
          console.log(`[Sync] ✅ User ${row.telegram_id} synced`);
        } else {
          console.log(`[Sync] User ${row.telegram_id} already onboarded, skipping`);
        }
      } catch (err) {
        console.error(`[Sync] Failed for user ${row.telegram_id}:`, err);
      }
    }

    onboardingDb.close();
    console.log('[Sync] Done.');

  } catch (err) {
    console.error('[Sync] Fatal error:', err);
  }
}