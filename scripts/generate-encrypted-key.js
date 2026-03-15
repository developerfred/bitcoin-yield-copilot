#!/usr/bin/env node

/**
 * Script para gerar chave privada segura e criptografada
 * 
 * Uso: node scripts/generate-encrypted-key.js
 * 
 * Gera:
 * 1. Chave privada segura (32 bytes random)
 * 2. Versão criptografada para o .env
 * 3. Instruções para deploy seguro
 */

import { keyManager } from '../src/security/keyManager.js';

function main() {
  console.log('🔐 Gerador de Chave Privada Segura\n');

  // 1. Gerar chave privada segura
  const privateKey = keyManager.generatePrivateKey();
  console.log('✅ Chave privada gerada:', privateKey);

  // 2. Validar a chave
  const isValid = keyManager.validatePrivateKey(privateKey);
  console.log('✅ Validação da chave:', isValid ? 'PASSOU' : 'FALHOU');

  if (!isValid) {
    console.error('❌ Chave inválida gerada');
    process.exit(1);
  }

  // 3. Criptografar a chave
  const encrypted = keyManager.encrypt(privateKey);
  const envFormat = `${encrypted.iv}:${encrypted.ciphertext}:${encrypted.authTag}:${encrypted.version}`;
  
  console.log('\n📦 Chave criptografada (para .env):');
  console.log(`ENCRYPTED_PRIVATE_KEY=${envFormat}`);

  // 4. Testar decrypt (round-trip)
  try {
    const decrypted = keyManager.decrypt(encrypted);
    const roundTripValid = decrypted === privateKey;
    
    console.log('\n🔄 Teste de decrypt:', roundTripValid ? '✅ SUCESSO' : '❌ FALHA');
    
    if (!roundTripValid) {
      console.error('Falha no ciclo encrypt/decrypt');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro no decrypt:', error.message);
    process.exit(1);
  }

  // 5. Instruções
  console.log('\n📋 INSTRUÇÕES:');
  console.log('1. Adicione ao seu .env:');
  console.log(`   ENCRYPTED_PRIVATE_KEY=${envFormat}`);
  console.log('   ENCRYPTION_KEY=sua-chave-secreta-min-32-caracteres');
  console.log('   KEY_DERIVATION_SALT=sal-para-seu-ambiente');
  console.log('');
  console.log('2. Remova a chave plaintext do .env:');
  console.log('   # REMOVA ESTA LINHA:');
  console.log('   # AGENT_STACKS_PRIVATE_KEY=0000000000000000000000000000000000000000000000000000000000000000');
  console.log('');
  console.log('3. A chave privada original NUNCA deve ser commitada:');
  console.log('   ✅ Criptografada: SEGURO para commit');
  console.log('   ❌ Plaintext: NUNCA commit');
  console.log('');
  console.log('4. Para produção, use chaves diferentes por ambiente!');
}

// Configuração de erro
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Executar
main();