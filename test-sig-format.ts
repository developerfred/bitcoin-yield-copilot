// Test script to verify signature format
import { secp256k1 } from '@noble/curves/secp256k1';
import { createHash } from 'node:crypto';

// Bot private key (from env)
const BOT_PRIVATE_KEY = process.env.AGENT_STACKS_PRIVATE_KEY || '753b7cc01a1a2e86221266a154af739c41dcafdb5a5f0c3e3a343712e120b270';
const botPrivateKey = Buffer.from(BOT_PRIVATE_KEY, 'hex');

// Test message (just some bytes)
const testMsg = createHash('sha256').update('test message').digest();

console.log('=== Testing Signature Format ===\n');

// Sign with @noble/curves
const sig = secp256k1.sign(testMsg, botPrivateKey, { lowS: true });
const recovery = sig.recovery as number;
const compactSig = Buffer.from(sig.toCompactRawBytes());

console.log('Original recovery from noble:', recovery);
console.log('Compact sig (64 bytes):', compactSig.toString('hex'));

// Test different recovery byte formats
const formats = [
  { name: 'Original (0/1)', value: recovery },
  { name: 'Compressed (2/3)', value: recovery + 2 },
  { name: 'Ethereum uncompressed (27/28)', value: recovery + 27 },
  { name: 'Ethereum compressed (29/30)', value: recovery + 29 },
];

for (const fmt of formats) {
  const sigBytes = Buffer.alloc(65);
  sigBytes[0] = fmt.value;
  compactSig.copy(sigBytes, 1);
  console.log(`\n${fmt.name} (${fmt.value}):`);
  console.log('  Signature:', sigBytes.toString('hex').slice(0, 2) + '...' + sigBytes.toString('hex').slice(-2));
  
  // Try to recover the public key using noble (simulating what Clarity does)
  try {
    // In Clarity, secp256k1-recover? takes (hash, signature) and returns the recovered pubkey
    // Let's simulate this with noble
    const sigObj = secp256k1.Signature.fromCompact(compactSig);
    const sigWithRecovery = sigObj.addRecoveryBit(recovery);
    const recoveredPubKey = sigWithRecovery.recoverPublicKey(testMsg);
    const recoveredCompressed = Buffer.from(recoveredPubKey.toRawBytes(true)); // compressed
    
    console.log('  Recovered pubkey:', recoveredCompressed.toString('hex'));
  } catch (e) {
    console.log('  Error recovering:', e);
  }
}

// Also show what public key we should get
const botPublicKey = secp256k1.getPublicKey(botPrivateKey, true); // compressed
console.log('\n=== Bot Public Key ===');
console.log('Compressed (33 bytes):', Buffer.from(botPublicKey).toString('hex'));
console.log('Length:', Buffer.from(botPublicKey).length, 'bytes');
