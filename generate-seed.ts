import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { generateWallet } from '@stacks/wallet-sdk';

async function createWallet() {
  // 1. Generate mnemonic using the industry standard BIP-39
  const mnemonic = bip39.generateMnemonic(wordlist);
  
  // 2. Use the SDK only for what it's good at: Derivation
  // (Even if exports change, this is usually the most stable entry point)
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: 'password', // optional, usually kept simple for testing
  });

  const account = wallet.accounts[0];

  console.log('=== Wallet Generator (Stable) ===');
  console.log('Mnemonic:', mnemonic);
  console.log('Address (Testnet):', account.address);
  console.log('Private Key:', account.stxPrivateKey);
}

createWallet();