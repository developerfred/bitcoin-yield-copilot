// Comprehensive test to compare Node.js payload with Clarity contract expectations
import { createHash } from 'node:crypto';
import { c32addressDecode } from 'c32check';

const BOT_PRIVATE_KEY = process.env.AGENT_STACKS_PRIVATE_KEY || '753b7cc01a1a2e86221266a154af739c41dcafdb5a5f0c3e3a343712e120b270';
const botPrivateKey = Buffer.from(BOT_PRIVATE_KEY, 'hex');

// Import noble for signing
import { secp256k1 } from '@noble/curves/secp256k1';

// ============================================================================
// Test Data from the actual transaction
// ============================================================================

const telegramHashHex = '2746d54ef4ec35db8f43d4aa1502a535d19bd643accc1b3a78011fa92195dfdf';
const walletContract = 'ST1W1HJVNMWM5RZQ6T7DTJJCYKY64J15KGX3ED251.user-wallet-337d4012';
const recipientAddress = 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD';
const amountMicro = BigInt(2000000);
const nonce = BigInt(0);
const expiry = BigInt(3890225);

console.log('=== Analyzing Transaction Data ===\n');
console.log('Telegram Hash:', telegramHashHex);
console.log('Wallet Contract:', walletContract);
console.log('Recipient:', recipientAddress);
console.log('Amount (microSTX):', amountMicro.toString());
console.log('Nonce:', nonce.toString());
console.log('Expiry:', expiry.toString());

// ============================================================================
// Step 1: Calculate consensus bytes for wallet (contract principal)
// ============================================================================

function principalToConsensusBytes(principal: string): Buffer {
  const [accountPart, contractName] = principal.split('.');
  const [version, hash160Hex] = c32addressDecode(accountPart);
  const hash160 = Buffer.from(hash160Hex, 'hex');
  const nameBytes = Buffer.from(contractName, 'utf8');
  
  // Formato: [0x06][version(1)][hash160(20)][name-length(1)][name]
  const buf = Buffer.alloc(1 + 1 + 20 + 1 + nameBytes.length);
  buf[0] = 0x06;  // tipo: contract principal
  buf[1] = version;
  hash160.copy(buf, 2);
  buf[22] = nameBytes.length;
  nameBytes.copy(buf, 23);
  return buf;
}

// ============================================================================
// Step 2: Calculate wallet hash (sha256 of consensus bytes)
// ============================================================================

const walletConsensusBytes = principalToConsensusBytes(walletContract);
const walletHash = createHash('sha256').update(walletConsensusBytes).digest();

console.log('\n=== Wallet Consensus Bytes ===');
console.log('Hex:', walletConsensusBytes.toString('hex'));
console.log('Length:', walletConsensusBytes.length, 'bytes');
console.log('Wallet Hash (sha256):', walletHash.toString('hex'));

// ============================================================================
// Step 3: Calculate recipient hash (sha256 of consensus bytes for standard principal)
// ============================================================================

function standardPrincipalToConsensusBytes(principal: string): Buffer {
  const [version, hash160Hex] = c32addressDecode(principal);
  const hash160 = Buffer.from(hash160Hex, 'hex');
  
  // Formato: [0x05][version(1)][hash160(20)]
  const buf = Buffer.alloc(1 + 1 + 20);
  buf[0] = 0x05;  // tipo: standard principal
  buf[1] = version;
  hash160.copy(buf, 2);
  return buf;
}

const recipientConsensusBytes = standardPrincipalToConsensusBytes(recipientAddress);
const recipientHash = createHash('sha256').update(recipientConsensusBytes).digest();

console.log('\n=== Recipient Consensus Bytes ===');
console.log('Hex:', recipientConsensusBytes.toString('hex'));
console.log('Length:', recipientConsensusBytes.length, 'bytes');
console.log('Recipient Hash (sha256):', recipientHash.toString('hex'));

// ============================================================================
// Step 4: Build the exact payload (same as Clarity contract)
// ============================================================================

function u128(n: bigint): Buffer {
  const buf = Buffer.alloc(16);
  for (let i = 15; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

const DOMAIN_WITHDRAW = BigInt(10);

const telegramHash = Buffer.from(telegramHashHex, 'hex');

const rawPayload = Buffer.concat([
  telegramHash,                    // 32 bytes
  u128(DOMAIN_WITHDRAW),           // 16 bytes
  walletHash,                       // 32 bytes
  u128(nonce),                      // 16 bytes
  u128(amountMicro),                // 16 bytes
  u128(expiry),                    // 16 bytes
  recipientHash,                    // 32 bytes
]);

console.log('\n=== Raw Payload ===');
console.log('Hex:', rawPayload.toString('hex'));
console.log('Length:', rawPayload.length, 'bytes');

// ============================================================================
// Step 5: Calculate the message hash (sha256 of payload)
// ============================================================================

const msgHash = createHash('sha256').update(rawPayload).digest();

console.log('\n=== Message Hash (sha256 of payload) ===');
console.log('Hex:', msgHash.toString('hex'));

// ============================================================================
// Step 6: Sign the message
// ============================================================================

const sig = secp256k1.sign(msgHash, botPrivateKey, { lowS: true });
const recovery = sig.recovery as number;
const compactSig = Buffer.from(sig.toCompactRawBytes());

console.log('\n=== Signature ===');
console.log('Recovery:', recovery);
console.log('Compact sig:', compactSig.toString('hex'));

// ============================================================================
// Step 7: Try different signature formats
// ============================================================================

console.log('\n=== Testing Different Signature Formats ===\n');

const formats = [
  { name: 'raw (0/1)', add: 0 },
  { name: 'compressed (2/3)', add: 2 },
  { name: 'eth-uncompressed (27/28)', add: 27 },
  { name: 'eth-compressed (29/30)', add: 29 },
];

for (const fmt of formats) {
  const fullSig = Buffer.alloc(65);
  fullSig[0] = recovery + fmt.add;
  compactSig.copy(fullSig, 1);
  
  console.log(`${fmt.name} (recovery byte = ${recovery + fmt.add}):`);
  console.log('  Full signature:', fullSig.toString('hex').slice(0, 4) + '...' + fullSig.toString('hex').slice(-4));
  
  // Verify locally
  try {
    const sigObj = secp256k1.Signature.fromCompact(compactSig);
    const recovered = sigObj.addRecoveryBit(recovery).recoverPublicKey(msgHash);
    const recoveredCompressed = Buffer.from(recovered.toRawBytes(true));
    console.log('  Recovered pubkey:', recoveredCompressed.toString('hex'));
  } catch (e) {
    console.log('  Error:', e);
  }
  console.log('');
}

// ============================================================================
// Step 8: Show what public key the contract expects
// ============================================================================

const botPublicKey = secp256k1.getPublicKey(botPrivateKey, true);
console.log('=== Bot Public Key (Expected by Contract) ===');
console.log('Compressed:', Buffer.from(botPublicKey).toString('hex'));
console.log('Length:', Buffer.from(botPublicKey).length, 'bytes');
