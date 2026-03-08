import { createHash } from 'crypto';

async function main() {
  const { generateWallet } = await import('@stacks/wallet-sdk');
  const mnemonic = process.env.AGENT_STACKS_MNEMONIC!;
  const wallet = await generateWallet({ secretKey: mnemonic, password: '' });
  const account = wallet.accounts[0];
  
  console.log(`stxPrivateKey raw: ${account.stxPrivateKey}`);
  console.log(`stxPrivateKey length: ${account.stxPrivateKey.length}`);
  
  let privHex = account.stxPrivateKey.replace('0x', '').toLowerCase();
  console.log(`after strip 0x: ${privHex} (${privHex.length} chars)`);
  
  if (privHex.length === 66 && privHex.endsWith('01')) {
    privHex = privHex.slice(0, 64);
    console.log(`after strip 01: ${privHex} (${privHex.length} chars)`);
  }
  
  const privKey = Buffer.from(privHex, 'hex');
  console.log(`privKey bytes: ${privKey.length}`);
  console.log(`privKey hex: ${privKey.toString('hex')}`);
  
  // Test if it's a valid secp256k1 key (should be 32 bytes, < order)
  const SECP256K1_ORDER = Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 'hex');
  console.log(`is 32 bytes: ${privKey.length === 32}`);
  console.log(`less than order: ${privKey.compare(SECP256K1_ORDER) < 0}`);

  // Test with noble/secp256k1 if available
  try {
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const pubKey = secp256k1.getPublicKey(privKey, true);
    console.log(`noble pubkey: ${Buffer.from(pubKey).toString('hex')}`);
    
    const testMsg = createHash('sha256').update('test').digest();
    const sig = secp256k1.sign(testMsg, privKey);
    console.log(`noble sig recovery: ${sig.recovery}`);
    console.log(`noble sig r: ${sig.r.toString(16).padStart(64,'0')}`);
    console.log(`noble sig s: ${sig.s.toString(16).padStart(64,'0')}`);
    
    // Monta VRS 65 bytes
    const rBytes = Buffer.from(sig.r.toString(16).padStart(64,'0'), 'hex');
    const sBytes = Buffer.from(sig.s.toString(16).padStart(64,'0'), 'hex');
    const sig65 = Buffer.alloc(65);
    sig65[0] = sig.recovery!;
    rBytes.copy(sig65, 1);
    sBytes.copy(sig65, 33);
    console.log(`noble sig65 (VRS): ${sig65.toString('hex')}`);
    console.log(`recovery é 0 ou 1: ${sig.recovery === 0 || sig.recovery === 1}`);
  } catch(e) {
    console.log(`noble não disponível: ${e}`);
  }
}

main().catch(console.error);