import { getAddressFromPrivateKey, randomPrivateKey } from '@stacks/transactions';

// Generate random private key
const privateKey = randomPrivateKey();

// Generate address for testnet
const address = getAddressFromPrivateKey(privateKey, 'testnet');

console.log('=== Stacks Testnet Wallet ===');
console.log('');
console.log('Private Key (hex):', privateKey);
console.log('Address (testnet):', address);
console.log('');
console.log('⚠️  IMPORTANT: This key is for TEST ENVIRONMENT only!');
console.log('⚠️  DO NOT use on mainnet with real funds!');
