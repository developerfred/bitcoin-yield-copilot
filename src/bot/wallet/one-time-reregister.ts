// one-time-reregister.ts
import { createWalletManager } from './WalletManager.js';

const wm = await createWalletManager();
const db = (wm as any).databaseService['db'];

const wallets = db.prepare('SELECT telegram_hash, contract_address FROM contract_wallets WHERE is_active = 1').all();

for (const row of wallets as any[]) {
  const contractAddr = row.contract_address;
  const telegramHashBuf = Buffer.from(row.telegram_hash, 'hex');
  const isRegistered = await (wm as any).contractService.isWalletRegisteredInHelper(contractAddr);

  if (!isRegistered) {
    console.log(`Registering ${contractAddr}...`);
    const limits = { maxPerTransaction: 1_000_000_000n, dailyLimit: 10_000_000_000n };
    await (wm as any).contractService.registerWalletInHelper(contractAddr, telegramHashBuf, limits);
    console.log(`  ✅ Done`);
  } else {
    console.log(`  ⏭ Already registered: ${contractAddr}`);
  }
}