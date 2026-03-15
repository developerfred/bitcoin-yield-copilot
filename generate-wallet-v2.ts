import { generateSecretKey, generateWallet } from '@stacks/wallet-sdk';
import { getAddressFromPrivateKey } from '@stacks/transactions';

async function main() {
  // Generate a fresh 24-word BIP-39 mnemonic (256 bits entropy)
  const mnemonic = generateSecretKey(256);

  // Derive the Stacks wallet — same derivation path as Leather/Xverse (BIP44 m/44'/5757'/0'/0/0)
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });

  const account = wallet.accounts[0];
  const privateKey = account.stxPrivateKey;

  // Derive addresses using @stacks/transactions (no TransactionVersion enum needed)
  // 'testnet' and 'mainnet' are accepted as string literals in current versions
  const testnetAddress = getAddressFromPrivateKey(privateKey, 'testnet');
  const mainnetAddress = getAddressFromPrivateKey(privateKey, 'mainnet');

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         Stacks Wallet — Key Generation           ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('Mnemonic (24 words):');
  console.log(' ', mnemonic);
  console.log('');
  console.log('Private Key (hex):');
  console.log(' ', privateKey);
  console.log('');
  console.log('Address (testnet):', testnetAddress);
  console.log('Address (mainnet):', mainnetAddress);
  console.log('');
  console.log('─────────────────────────────────────────────────────');
  console.log('Copy to your .env file:');
  console.log('─────────────────────────────────────────────────────');
  console.log('');
  console.log(`DEPLOYER_MNEMONIC="${mnemonic}"`);
  console.log(`DEPLOYER_PRIVATE_KEY=${privateKey}`);
  console.log(`DEPLOYER_ADDRESS_TESTNET=${testnetAddress}`);
  console.log(`DEPLOYER_ADDRESS_MAINNET=${mainnetAddress}`);
  console.log('');
  console.log('⚠️  NEVER commit .env or share these values.');
  console.log('⚠️  Anyone with the mnemonic or private key owns this wallet.');
  console.log('');
}

main().catch(console.error);