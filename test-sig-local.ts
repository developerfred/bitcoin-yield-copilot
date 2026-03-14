// Test script to verify signature locally - simulating what Clarity contract does
import { createHash } from 'node:crypto';
import { c32addressDecode } from 'c32check';

// Test data
const telegramHashHex = '2746d54ef4ec35db8f43d4aa1502a535d19bd643accc1b3a78011fa92195dfdf';
const walletContract = 'ST1W1HJVNMWM5RZQ6T7DTJJCYKY64J15KGX3ED251.user-wallet-337d4012';
const recipientAddress = 'ST1D1CNPSJK706QKW86NQ6MMCX7CHRSN0JQ1VANPD';
const amountMicro = BigInt(2000000);
const nonce = BigInt(0);
const expiry = BigInt(3890239);

// Bot public key (from logs)
const botPublicKeyHex = '0354333265fafb5e332e92421494e93ca50143840a85d1e74b2474a45dbd9cffca';

// Simulate @noble/curves signing
const { secp256k1 } = require('@noble/curves/secp256k1');

// Get private key from environment
const privateKeyHex = process.env.AGENT_STACKS_PRIVATE_KEY?.replace('0x', '') || '';
const privateKey = Buffer.from(privateKeyHex, 'hex');

console.log('=== Local Signature Verification Test ===\n');
console.log('Bot Public Key:', botPublicKeyHex);

// Step 1: Build payload
function principalToConsensusBytes(principal) {
  const [accountPart, contractName] = principal.split('.');
  const [version, hash160Hex] = c32addressDecode(accountPart);
  const hash160 = Buffer.from(hash160Hex, 'hex');
  const nameBytes = Buffer.from(contractName, 'utf8');
  const buf = Buffer.alloc(1 + 1 + 20 + 1 + nameBytes.length);
  buf[0] = 0x06;
  buf[1] = version;
  hash160.copy(buf, 2);
  buf[22] = nameBytes.length;
  nameBytes.copy(buf, 23);
  return buf;
}

function standardPrincipalToConsensusBytes(principal) {
  const [version, hash160Hex] = c32addressDecode(principal);
  const hash160 = Buffer.from(hash160Hex, 'hex');
  const buf = Buffer.alloc(1 + 1 + 20);
  buf[0] = 0x05;
  buf[1] = version;
  hash160.copy(buf, 2);
  return buf;
}

function u128(n) {
  const buf = Buffer.alloc(16);
  for (let i = 15; i >= 0; i--) {
    buf[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buf;
}

// Build payload
const walletConsensusBytes = principalToConsensusBytes(walletContract);
const walletHash = createHash('sha256').update(walletConsensusBytes).digest();

const recipientConsensusBytes = standardPrincipalToConsensusBytes(recipientAddress);
const recipientHash = createHash('sha256').update(recipientConsensusBytes).digest();

const telegramHash = Buffer.from(telegramHashHex, 'hex');
const DOMAIN_WITHDRAW = BigInt(10);

const rawPayload = Buffer.concat([
  telegramHash,
  u128(DOMAIN_WITHDRAW),
  walletHash,
  u128(nonce),
  u128(amountMicro),
  u128(expiry),
  recipientHash,
]);

const msgHash = createHash('sha256').update(rawPayload).digest();

console.log('\nPayload Hash:', msgHash.toString('hex'));

// Step 2: Sign
const keyBigInt = BigInt('0x' + privateKeyHex);
const sig = secp256k1.sign(msgHash, keyBigInt, { lowS: true });
const recovery = sig.recovery;
const compactSig = Buffer.from(sig.toCompactRawBytes());

console.log('\n=== Signing ===');
console.log('Recovery from noble:', recovery);

// Step 3: Try different recovery formats
console.log('\n=== Testing Recovery Formats ===');

const formats = [
  { name: 'recovery=0', byte: 0 },
  { name: 'recovery=1', byte: 1 },
  { name: 'recovery=2', byte: 2 },
  { name: 'recovery=3', byte: 3 },
  { name: 'recovery=27', byte: 27 },
  { name: 'recovery=28', byte: 28 },
];

for (const fmt of formats) {
  const fullSig = Buffer.alloc(65);
  fullSig[0] = fmt.byte;
  compactSig.copy(fullSig, 1);
  
  // Try to recover public key (simulating what Clarity does)
  try {
    const sigObj = secp256k1.Signature.fromCompact(compactSig);
    const recovered = sigObj.addRecoveryBit(fmt.byte >= 27 ? fmt.byte - 27 : fmt.byte).recoverPublicKey(msgHash);
    const recoveredCompressed = Buffer.from(recovered.toRawBytes(true));
    
    const matches = recoveredCompressed.toString('hex') === botPublicKeyHex;
    console.log(`${fmt.name}: recovered=${recoveredCompressed.toString('hex')} ${matches ? '✅ MATCH' : '❌ MISMATCH'}`);
  } catch (e) {
    console.log(`${fmt.name}: ERROR - ${e.message}`);
  }
}

console.log('\n=== Expected ===');
console.log('Bot public key:', botPublicKeyHex);
