import crypto from 'crypto';

// Simple key generation and encryption script
function generateEncryptedKey() {
  console.log('🔐 Gerador Simples de Chave Criptografada\n');

  // 1. Generate secure private key (32 bytes)
  const privateKey = crypto.randomBytes(32).toString('hex');
  console.log('✅ Chave privada gerada:', privateKey);

  // 2. Validate it's proper format
  if (!/^[0-9a-f]{64}$/i.test(privateKey)) {
    console.error('❌ Chave inválida gerada');
    process.exit(1);
  }
  console.log('✅ Formato válido: 64 caracteres hexadecimais');

  // 3. Simple encryption demonstration (AES-256-GCM)
  const encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-min-32-chars';
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  const envFormat = `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}:1.0`;
  
  console.log('\n📦 Chave criptografada (para .env):');
  console.log(`ENCRYPTED_PRIVATE_KEY=${envFormat}`);
  console.log('');
  console.log('📋 INSTRUÇÕES:');
  console.log('1. Adicione ao seu .env:');
  console.log(`   ENCRYPTED_PRIVATE_KEY=${envFormat}`);
  console.log('   ENCRYPTION_KEY=sua-chave-secreta-min-32-caracteres');
  console.log('');
  console.log('2. A chave original NUNCA deve ser commitada!');
  console.log('   ✅ Criptografada: SEGURO para commit');
  console.log('   ❌ Plaintext: NUNCA commit');
}

generateEncryptedKey();