// walletManager.ts
import {
  fetchCallReadOnlyFunction,
  cvToValue,
  uintCV,
  principalCV,
  bufferCV,
  stringAsciiCV,
  boolCV,
  listCV,
  tupleCV,
  AnchorMode,
  PostConditionMode,
  makeContractDeploy,
  makeContractCall,
  broadcastTransaction,
  ClarityValue,
  signMessageHashRsv,
} from '@stacks/transactions';
import { stacksCrypto } from '../../security/stacksCrypto.js';
import { createHash, randomBytes } from 'crypto';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { getCurrentNetwork, NetworkConfig } from './network.js';
import { c32addressDecode } from 'c32check';
import {
  opPayload,
  withdrawPayload,
  addProtocolPayload,
  updateProtocolPayload,
  updateLimitsPayload,
  pausePayload,
  unpausePayload,
} from '../../utils/payload-builder.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const DEPLOY_FEE = 500_000n;
const CONTRACT_CALL_FEE = 50_000n;
const MAX_CHAINING_RETRIES = 3;
const CHAINING_RETRY_DELAY = 10000;
const MAX_DEPLOY_ATTEMPTS = 5;
const MAX_BROADCAST_ATTEMPTS = 3;
const TX_CONFIRMATION_ATTEMPTS = 60;
const TX_CONFIRMATION_INTERVAL = 5000;

const CLARITY_ERRORS: Record<number, string> = {
  401: 'Unauthorized',
  402: 'Invalid signature',
  403: 'Transaction limit exceeded',
  404: 'Invalid nonce or expiration block',
  405: 'Contract paused',
  406: 'Unknown or disabled protocol',
  407: 'Daily limit exceeded',
  408: 'Contract not initialized',
  409: 'Contract already initialized',
  410: 'Invalid limits',
  411: 'Zero amount not allowed',
  412: 'Protocol already registered',
  413: 'Allocation limit exceeded',
  414: 'Insufficient balance',
  415: 'Transaction expired',
  416: 'Amount too small',
  417: 'Rate limit exceeded',
  418: 'Wallet revoked',
  419: 'Daily limit exceeded',
  420: 'Transaction limit exceeded',
  421: 'Invalid public key',
  422: 'Contract already initialized',
  423: 'Wallet not found',
  424: 'Invalid recipient',
  425: 'Invalid limits',
  426: 'Wallet is not revoked',
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface WalletState {
  connected: boolean;
  address?: string;
  pubKey?: string;
  network?: string;
}

export interface ContractWalletRecord {
  telegramUserId: string;
  telegramHash: string;
  contractAddress: string;
  deployTxId: string;
  createdAt: number;
  isActive: boolean;
  network: string;
}

export interface WalletLimits {
  maxPerTransaction: bigint;
  dailyLimit: bigint;
}

export interface ProtocolConfig {
  address: string;
  name: string;
  maxAlloc: bigint;
}

export interface OperationRequest {
  telegramUserId: string;
  protocol: string;
  action: 'deposit' | 'withdraw' | 'swap';
  amount: bigint;
  expiryBlocks?: number;
}

export interface SignedOperation {
  nonce: bigint;
  signature: Buffer;
  expiryBlock: number;
}

export interface BroadcastResult {
  txid: string;
}

export interface WalletInfo {
  initialized: boolean;
  isPaused: boolean;
  currentNonce: bigint;
  maxPerTransaction: bigint;
  dailyLimit: bigint;
  remainingToday: bigint;
  botPublicKey: string;
  telegramHash: string;
  [key: string]: any;
}

export interface TransactionOptions {
  fee?: bigint;
  nonce?: bigint;
  anchorMode?: AnchorMode;
  postConditionMode?: PostConditionMode;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Deriva uma chave privada a partir de uma mnemônica
 */
async function privateKeyFromMnemonic(mnemonic: string, accountIndex = 0): Promise<string> {
  const wordCount = mnemonic.trim().split(/\s+/).length;
  if (wordCount !== 12 && wordCount !== 24) {
    throw new Error(`Mnemonic must be 12 or 24 words, got ${wordCount}`);
  }

  try {
    const { generateWallet } = await import('@stacks/wallet-sdk');
    const wallet = await generateWallet({ secretKey: mnemonic, password: '' });
    const account = wallet.accounts[accountIndex];
    if (!account) throw new Error(`No account at index ${accountIndex}`);
    return account.stxPrivateKey;
  } catch (e: any) {
    if (!e.message?.includes('Cannot find module')) throw e;
  }

  try {
    const { mnemonicToSeedSync, validateMnemonic } = await import('@scure/bip39');
    const { wordlist } = await import('@scure/bip39/wordlists/english.js');
    const { HDKey } = await import('@scure/bip32');

    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    const derived = root.derive(`m/44'/5757'/0'/0/${accountIndex}`);
    if (!derived.privateKey) throw new Error('Failed to derive private key');

    return Buffer.from(derived.privateKey).toString('hex') + '01';
  } catch (e: any) {
    if (!e.message?.includes('Cannot find module')) throw e;
  }

  throw new Error('No mnemonic derivation library found');
}

/**
 * Verifica se uma string é uma mnemônica válida
 */
function isMnemonic(value: string): boolean {
  const words = value.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
}

/**
 * Extrai valores de objetos Clarity de forma segura
 */
export function extractClarityValue(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  if ('type' in obj && 'value' in obj) {
    if (obj.type === 'uint' || obj.type === 'int') {
      return typeof obj.value === 'string' ? BigInt(obj.value) : obj.value;
    }
    if (obj.type === 'bool') {
      return Boolean(obj.value);
    }
    if (obj.type === 'true') return true;
    if (obj.type === 'false') return false;
    return obj.value;
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = extractClarityValue(value);
    }
    return result;
  }
  
  return obj;
}

/**
 * Valida um endereço Stacks
 */
export function validateStacksAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  address = address.trim();
  
  try {
    if (address.includes('.')) {
      const parts = address.split('.');
      if (parts.length !== 2) return false;
      
      const [accountPart, contractName] = parts;
      c32addressDecode(accountPart);
      
      if (!contractName || !/^[a-zA-Z0-9_-]{1,128}$/.test(contractName)) {
        return false;
      }
      
      return true;
    } else {
      c32addressDecode(address);
      return true;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Detecta a rede a partir de um endereço
 */
export function detectNetworkFromAddress(address: string): 'mainnet' | 'testnet' | null {
  if (address.startsWith('SP') || address.startsWith('SM')) return 'mainnet';
  if (address.startsWith('ST') || address.startsWith('SN')) return 'testnet';
  return null;
}

/**
 * Normaliza uma chave pública (remove prefixo 0x)
 */
function normalizePubKey(raw: any): string {
  if (!raw) return '';
  const s = typeof raw === 'string' ? raw : String(raw);
  return s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
}

/**
 * Cria um buffer uint128 em big-endian
 */
function uint128BE(n: bigint): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64BE(n >> 64n, 0);
  buf.writeBigUInt64BE(n & 0xFFFFFFFFFFFFFFFFn, 8);
  return buf;
}

// ============================================================================
// BLOCKCHAIN SERVICE
// ============================================================================

/**
 * Serviço para interagir com a blockchain Stacks
 */
class BlockchainService {
  constructor(
    private networkConfig: NetworkConfig,
    private botAddress: string,
    private botPrivateKeyForSdk: string
  ) {}

  /**
   * Estima a taxa para uma transação
   */
  async estimateFee(txByteSize: number): Promise<bigint> {
    try {
      const res = await fetch(`${this.networkConfig.apiUrl}/v2/fees/transfer`);
      const rate = await res.json() as number;
      const fee = BigInt(Math.ceil(rate * txByteSize * 1.5));
      const min = 1_000n;
      return fee > min ? fee : min;
    } catch {
      return 50_000n;
    }
  }

  /**
   * Obtém o nonce atual de uma conta
   */
  async fetchAccountNonce(address: string): Promise<bigint> {
    try {
      const res = await fetch(`${this.networkConfig.apiUrl}/v2/accounts/${address}?proof=0`);
      const data = await res.json() as { nonce: number };
      return BigInt(data.nonce ?? 0);
    } catch {
      return 0n;
    }
  }

  /**
   * Obtém o nonce atual com retry
   */
  async getCurrentNonceWithRetry(maxRetries = 5): Promise<bigint> {
    try {
      const pendingUrl = `${this.networkConfig.apiUrl}/extended/v1/address/${this.botAddress}/transactions?limit=50`;
      const pendingRes = await fetch(pendingUrl);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json() as any;
        const pendingCount = pendingData.results?.filter((tx: any) => 
          tx.tx_status === 'pending' || tx.tx_status === 'in_mempool'
        ).length || 0;
        
        if (pendingCount >= 25) {
          console.log(`[BlockchainService] ⚠️ ${pendingCount} transactions pending, waiting...`);
          await new Promise(r => setTimeout(r, 10000));
        }
      }
    } catch (error) {
      // Ignora erro na verificação
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        const nonce = await this.fetchAccountNonce(this.botAddress);
        console.log(`[BlockchainService] Current nonce: ${nonce} (attempt ${i+1}/${maxRetries})`);
        
        if (nonce > 1000n) {
          console.log(`[BlockchainService] ⚠️ Nonce too high: ${nonce}`);
        }
        
        return nonce;
      } catch (error) {
        console.log(`[BlockchainService] Error (attempt ${i+1}/${maxRetries}):`, error);
        if (i < maxRetries - 1) {
          const delay = 2000 * (i + 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw new Error('Failed to fetch nonce after multiple retries');
  }

  /**
   * Obtém o bloco atual
   */
  async fetchCurrentBlock(): Promise<number> {
    const res = await fetch(`${this.networkConfig.apiUrl}/v2/info`);
    const data = await res.json() as { stacks_tip_height: number };
    return data.stacks_tip_height;
  }

  /**
   * Verifica se um contrato existe
   */
  async checkContractExists(contractAddress: string, contractName: string): Promise<boolean> {
    try {
      const url = `${this.networkConfig.apiUrl}/v2/contracts/${contractAddress}.${contractName}`;
      const response = await fetch(url);
      if (response.status === 404) return false;
      if (response.ok) {
        const data = await response.json();
        return !!data;
      }
      return false;
    } catch (error) {
      console.error(`[BlockchainService] Error checking contract existence: ${error}`);
      return false;
    }
  }

  /**
   * Faz broadcast de uma transação
   */
  async broadcastTx(tx: any): Promise<BroadcastResult> {
    const result = await broadcastTransaction({ transaction: tx, network: this.networkConfig.network });
    if (!result || 'error' in result) {
      const r = result as any;
      const detail = [r?.error, r?.reason, r?.reason_data?.message].filter(Boolean).join(' — ');
      throw new Error(`Broadcast failed: ${detail || 'unknown error'}`);
    }
    const txid = (result as any).txid ?? (result as any).tx_id;
    if (!txid) throw new Error(`Broadcast returned no txid: ${JSON.stringify(result)}`);
    return { txid };
  }

  /**
   * Obtém detalhes de erro de uma transação
   */
  async getDetailedError(txid: string): Promise<string> {
    try {
      const res = await fetch(`${this.networkConfig.apiUrl}/extended/v1/tx/${txid}`);
      const data = await res.json() as any;

      if (data.tx_status === 'abort_by_response') {
        if (data.tx_result) {
          const resultHex = data.tx_result.hex || data.tx_result;
          if (resultHex && typeof resultHex === 'string') {
            // Check for standard error format (0x...01... where 01 = err)
            if (resultHex.startsWith('0x')) {
              const stripped = resultHex.slice(2); // Remove 0x
              
              // Parse Clarity error: last chars indicate error code
              // Format: [type prefix][4-byte uint error code in big-endian]
              if (stripped.length >= 2) {
                const typeIndicator = stripped.slice(0, 2);
                if (typeIndicator === '01') {
                  // It's an (err ...) - take the last 4 bytes as the error code (big-endian uint)
                  const errorCodeHex = stripped.slice(-8); // Last 8 hex chars = 4 bytes
                  const errorCode = parseInt(errorCodeHex || '0', 16);
                  const msg = CLARITY_ERRORS[errorCode];
                  
                  // Special handling for common errors
                  if (errorCode === 420) {
                    return `Erro 420: Limite de transação excedido. O valor solicitado ultrapassa o limite máximo por transação.`;
                  }
                  if (errorCode === 427) {
                    return `Erro 427: Authorization already exists. Wait for previous transaction to expire or try with a new nonce.`;
                  }
                  if (errorCode === 404) {
                    return `Erro 404: Nonce mismatch or transaction expired. Check the nonce and expiry.`;
                  }
                  return `Erro ${errorCode}: ${msg ?? 'Erro desconhecido'}`;
                }
              }
              
              // Check for ContractAlreadyExists (0x0809)
              if (stripped.includes('0809')) {
                return 'Contrato já existe (0x0809)';
              }
            }
            return `Abortado pelo Clarity: ${resultHex}`;
          }
          return `Abortado pelo Clarity: ${data.tx_result}`;
        }
        return `Transação abortada (status: ${data.tx_status})`;
      }
      
      return `Status: ${data.tx_status}`;
    } catch (e) {
      return `Erro ao obter detalhes: ${e}`;
    }
  }

  /**
   * Aguarda confirmação de uma transação com retry automático para erros de rate limit
   */
  async waitForConfirmation(txid: string, maxAttempts = TX_CONFIRMATION_ATTEMPTS): Promise<void> {
    console.log(`[BlockchainService] Waiting for tx confirmation: ${txid}`);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, TX_CONFIRMATION_INTERVAL));
      const res = await fetch(`${this.networkConfig.apiUrl}/extended/v1/tx/${txid}`);
      const data = await res.json() as { tx_status: string };

      if (data.tx_status === 'success') {
        console.log(`[BlockchainService] Tx confirmada com sucesso.`);
        return;
      }
      if (data.tx_status?.startsWith('abort')) {
        const detail = await this.getDetailedError(txid);
        
        if (detail.includes('412') || detail.includes('409') || detail.includes('ContractAlreadyExists') || detail.includes('0x0809') || detail.includes('Contrato já existe')) {
          console.log(`[BlockchainService] Contract already exists error detected - treating as success.`);
          return;
        }
        
        throw new Error(`Tx falhou: ${detail}`);
      }
      console.log(`[BlockchainService] Waiting... (attempt ${i + 1}/${maxAttempts})`);
    }
    throw new Error(`Timeout: Transaction ${txid} was not mined in 5 minutes.`);
  }

  /**
   * Aguarda confirmação com retry para erro 420 (rate limit)
   * Este método é usado para transações que podem falhar por rate limiting
   */
  async waitForConfirmationWithRetry(
    txid: string, 
    maxAttempts: number = 12,
    onRateLimit?: () => Promise<void>
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[BlockchainService] Waiting for tx with retry: ${txid}`);
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, TX_CONFIRMATION_INTERVAL));
      
      try {
        const res = await fetch(`${this.networkConfig.apiUrl}/extended/v1/tx/${txid}`);
        const data = await res.json() as { tx_status: string };

        if (data.tx_status === 'success') {
          console.log(`[BlockchainService] Tx confirmed successfully.`);
          return { success: true };
        }
        
        if (data.tx_status?.startsWith('abort')) {
          const detail = await this.getDetailedError(txid);
          
          // Error 420 = Transaction limit exceeded - rate limit
          if (detail.includes('420') || detail.includes('rate limit')) {
            console.log(`[BlockchainService] Rate limit (420) detected, waiting and retrying... (${i + 1}/${maxAttempts})`);
            
            // Call optional callback to refresh nonce
            if (onRateLimit) {
              await onRateLimit();
            }
            
            // Wait longer before retry
            await new Promise(r => setTimeout(r, 15000));
            continue;
          }
          
          return { success: false, error: detail };
        }
      } catch (e) {
        console.log(`[BlockchainService] Error checking tx (attempt ${i + 1}/${maxAttempts}):`, e);
      }
      
      console.log(`[BlockchainService] Waiting... (attempt ${i + 1}/${maxAttempts})`);
    }
    
    return { success: false, error: 'Timeout waiting for transaction' };
  }

  /**
   * Faz uma chamada read-only a um contrato
   */
  async callReadOnlyFunction<T = any>(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: ClarityValue[] = []
  ): Promise<T> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        senderAddress: this.botAddress,
        network: this.networkConfig.network,
      });
      
      return cvToValue(result) as T;
    } catch (error) {
      console.error(`[BlockchainService] Error in read-only call ${functionName}:`, error);
      throw error;
    }
  }
}

// ============================================================================
// CRYPTO SERVICE
// ============================================================================

/**
 * Serviço para operações criptográficas
 */
class CryptoService {
  constructor(
    private botPrivateKey: Buffer,
    private botPublicKey: Buffer,
    private botPrivateKeyForSdk?: string
  ) {}

  /**
   * Deriva o hash de um usuário do Telegram
   */
  deriveTelegramHash(telegramUserId: string, salt: string): Buffer {
    return createHash('sha256').update(`${telegramUserId}:${salt}`).digest();
  }

  /**
   * Converte um principal para bytes de consenso
   */
  
  principalToConsensusBytes(principal: string): Buffer {
    if (principal.includes('.')) {
      const [accountPart, contractName] = principal.split('.');
      const [version, hash160Hex] = c32addressDecode(accountPart);
      const hash160 = Buffer.from(hash160Hex, 'hex');
      const nameBytes = Buffer.from(contractName, 'utf8');
      
      // Formato: [0x06][version(1)][hash160(20)][name-length(1)][name]
      const buf = Buffer.alloc(1 + 1 + 20 + 1 + nameBytes.length);
      buf[0] = 0x06;                                      // tipo: contract principal
      buf[1] = version;                                   // versão
      hash160.copy(buf, 2);                               // hash160 (20 bytes)
      buf[22] = nameBytes.length;                         // tamanho do nome
      nameBytes.copy(buf, 23);                             // nome do contrato
      return buf;
      
    } else {
      const [version, hash160Hex] = c32addressDecode(principal);
      const hash160 = Buffer.from(hash160Hex, 'hex');
      
      // Formato: [0x05][version(1)][hash160(20)]
      const buf = Buffer.alloc(1 + 1 + 20);
      buf[0] = 0x05;                                      // tipo: standard principal
      buf[1] = version;                                   // versão
      hash160.copy(buf, 2);                               // hash160 (20 bytes)
      return buf;
    }
  }

  /**
   * Calcula o hash de um principal
   */
  hashPrincipalData(principal: string): Buffer {
  const consensus = this.principalToConsensusBytes(principal);
  return createHash('sha256').update(consensus).digest();
}

  /**
   * Cria uma assinatura para uma mensagem
   */
  signMessage(message: Buffer): { signature: Buffer; recovery: number } {
    const { signature, recovery } = stacksCrypto.ecdsaSign(message, this.botPrivateKey);
    return { signature, recovery };
  }

  /**
   * Cria uma assinatura usando a função oficial do Stacks
   * que é compatível com Clarity secp256k1-recover?
   */
  createFullSignature(message: Buffer): Buffer {
    // Use signMessageHashRsv from Stacks SDK - this is the Clarity-compatible format
    const signatureHex = signMessageHashRsv({
      messageHash: message.toString('hex'),
      privateKey: this.botPrivateKeyForSdk!,
    });
    
    const sig = Buffer.from(signatureHex, 'hex');
    
    console.log('[CryptoService] Signature created (Stacks SDK):', {
      sigLength: sig.length,
      sigHex: sig.toString('hex').slice(0, 20) + '...'
    });
    
    return sig;
  }

  /**
   * Verifica uma assinatura
   */
  async verifySignature(
    signature: Buffer,
    message: Buffer,
    expectedPubKey: Buffer
  ): Promise<boolean> {
    try {
      const { recoverPublicKey } = await import('@noble/secp256k1');
      
      const recovery = signature[0];
      const compactSig = signature.slice(1);
      
      const sigWithRecovery = Buffer.concat([Buffer.from([recovery]), compactSig]);
      const recoveredPubKeyUncompressed = recoverPublicKey(sigWithRecovery, message, { prehash: false });
      const recoveredPubKeyBuffer = Buffer.from(recoveredPubKeyUncompressed);
      
      let recoveredPubKeyCompressed: Buffer;
      if (recoveredPubKeyBuffer[0] === 0x04) {
        const x = recoveredPubKeyBuffer.slice(1, 33);
        const y = recoveredPubKeyBuffer.slice(33, 65);
        const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
        recoveredPubKeyCompressed = Buffer.concat([Buffer.from([prefix]), x]);
      } else {
        recoveredPubKeyCompressed = recoveredPubKeyBuffer;
      }
      
      return expectedPubKey.toString('hex') === recoveredPubKeyCompressed.toString('hex');
    } catch (error) {
      console.error('[CryptoService] Signature verification error:', error);
      return false;
    }
  }

  /**
   * Constrói payload de autorização
   */
  buildAuthPayload(
    telegramHash: Buffer,
    walletHash: Buffer,
    nonce: bigint,
    amount: bigint,
    expiry: bigint,
    recipientHash: Buffer
  ): Buffer {
    return Buffer.concat([
      telegramHash,
      walletHash,
      uint128BE(nonce),
      uint128BE(amount),
      uint128BE(expiry),
      recipientHash,
    ]);
  }

  /**
   * Constrói payload de operação
   */
  buildOperationPayload(
    telegramHash: Buffer,
    nonce: bigint,
    amount: bigint,
    expiryBlock: bigint
  ): Buffer {
    return Buffer.concat([
      telegramHash,
      uint128BE(nonce),
      uint128BE(amount),
      uint128BE(expiryBlock),
    ]);
  }
}

// ============================================================================
// CONTRACT SERVICE
// ============================================================================

/**
 * Serviço para interações com contratos
 */
class ContractService {
  constructor(
    private blockchainService: BlockchainService,
    private cryptoService: CryptoService,
    private botAddress: string,
    private botPrivateKeyForSdk: string,
    private withdrawHelperContract: string,
    private factoryContract: string
  ) {}

  /**
   * Carrega o código fonte do contrato
   */
  static loadContractSource(): string {
    const filePath = path.resolve(process.cwd(), 'contracts', 'user-wallet.clar');

    if (!fs.existsSync(filePath)) {
      throw new Error(`Contract source not found at ${filePath}`);
    }

    const raw = fs.readFileSync(filePath);

    const offenders: string[] = [];
    for (let i = 0; i < raw.length && offenders.length < 5; i++) {
      if (raw[i] > 127) {
        const ctx = raw.slice(Math.max(0, i - 20), i + 20).toString('latin1');
        offenders.push(`offset ${i} (0x${raw[i].toString(16)}): ...${ctx}...`);
      }
    }
    if (offenders.length > 0) {
      throw new Error(`user-wallet.clar contains non-ASCII characters.\n` +
        offenders.map(o => `  ${o}`).join('\n'));
    }

    return raw.toString('ascii');
  }

  /**
   * Faz deploy de um contrato
   */
  async deployContract(
    contractName: string,
    options: TransactionOptions = {}
  ): Promise<BroadcastResult> {
    const nonce = options.nonce || await this.blockchainService.getCurrentNonceWithRetry();
    
    const deployTx = await makeContractDeploy({
      contractName,
      codeBody: ContractService.loadContractSource(),
      senderKey: this.botPrivateKeyForSdk,
      network: this.blockchainService['networkConfig'].network,
      clarityVersion: 3,
      anchorMode: options.anchorMode || AnchorMode.Any,
      postConditionMode: options.postConditionMode || PostConditionMode.Allow,
      fee: options.fee || DEPLOY_FEE,
      nonce,
    });

    return this.blockchainService.broadcastTx(deployTx);
  }

  /**
   * Chama uma função de contrato
   */
  async callContractFunction(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: ClarityValue[],
    options: TransactionOptions = {}
  ): Promise<BroadcastResult> {
    // Validar argumentos
    for (let i = 0; i < functionArgs.length; i++) {
      const arg = functionArgs[i];
      if (!arg || typeof arg !== 'object' || !('type' in arg) || !('value' in arg)) {
        throw new Error(`Argument ${i} for ${functionName} is not a valid Clarity Value`);
      }
    }
    
    const nonce = options.nonce || await this.blockchainService.getCurrentNonceWithRetry();
    
    const tx = await makeContractCall({
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      senderKey: this.botPrivateKeyForSdk,
      network: this.blockchainService['networkConfig'].network,
      nonce,
      anchorMode: options.anchorMode || AnchorMode.Any,
      postConditionMode: options.postConditionMode || PostConditionMode.Allow,
      fee: options.fee || CONTRACT_CALL_FEE,
    });

    return this.blockchainService.broadcastTx(tx);
  }

  /**
   * Lê o nonce de uma wallet no helper
   */
  async readHelperNonce(walletContract: string): Promise<bigint> {
    const [addr, name] = this.withdrawHelperContract.split('.');
    
    try {
      const result = await this.blockchainService.callReadOnlyFunction(
        addr,
        name,
        'get-wallet-nonce',
        [principalCV(walletContract)]
      );
      
      return BigInt(result ?? 0);
    } catch (error) {
      console.error(`[ContractService] Error reading helper nonce for ${walletContract}:`, error);
      return 0n;
    }
  }

  /**
   * Lê o nonce de uma wallet
   */
  async readWalletNonce(walletContract: string): Promise<bigint> {
    const [addr, name] = walletContract.split('.');
    
    try {
      const result = await this.blockchainService.callReadOnlyFunction(
        addr,
        name,
        'get-wallet-info',
        []
      );
      
      const info = extractClarityValue(result);
      return BigInt(info['current-nonce']?.toString() || info['currentNonce']?.toString() || '0');
    } catch (error) {
      console.error(`[ContractService] Error reading wallet nonce for ${walletContract}:`, error);
      return 0n;
    }
  }

  /**
   * Lê o nonce da factory
   */
  async readFactoryNonce(): Promise<bigint> {
    if (!this.factoryContract) return 0n;
    
    const [addr, name] = this.factoryContract.split('.');
    
    try {
      const result = await this.blockchainService.callReadOnlyFunction(
        addr,
        name,
        'get-factory-nonce',
        []
      );
      
      return BigInt(result ?? 0);
    } catch (error) {
      console.error('[ContractService] Error reading factory nonce:', error);
      return 0n;
    }
  }

  /**
   * Obtém informações da wallet
   */
  async getWalletInfo(contractAddress: string): Promise<WalletInfo | null> {
    const [contractAddr, contractName] = contractAddress.split('.');

    try {
      const result = await this.blockchainService.callReadOnlyFunction(
        contractAddr,
        contractName,
        'get-wallet-info',
        []
      );

      const rawInfo = extractClarityValue(result);
      
      return rawInfo as WalletInfo;
    } catch (error) {
      console.error(`[ContractService] Error getting wallet info for ${contractAddress}:`, error);
      return null;
    }
  }

  /**
   * Obtém configuração de protocolo
   */
  async getProtocolConfig(contractAddress: string, protocolAddress: string): Promise<any> {
    const [contractAddr, contractName] = contractAddress.split('.');

    return this.blockchainService.callReadOnlyFunction(
      contractAddr,
      contractName,
      'get-protocol-config',
      [principalCV(protocolAddress)]
    );
  }

  /**
   * Obtém a chave pública do bot no helper
   */
  async getHelperBotPublicKey(): Promise<string> {
    const [helperAddr, helperName] = this.withdrawHelperContract.split('.');
    
    const result = await this.blockchainService.callReadOnlyFunction(
      helperAddr,
      helperName,
      'get-bot-public-key',
      []
    );
    
    return normalizePubKey(result);
  }

  /**
   * Checks if a wallet is registered in the helper
   */
  async isWalletRegisteredInHelper(walletContract: string): Promise<boolean> {
  try {
    const [helperAddr, helperName] = this.withdrawHelperContract.split('.');
    const result = await this.blockchainService.callReadOnlyFunction(
      helperAddr,
      helperName,
      'get-wallet-telegram-hash',
      [principalCV(walletContract)]
    );
    // Returns (optional (buff 32)) — null/undefined/false means not registered
    return result !== null && result !== undefined && result !== false;
  } catch {
    return false;
  }
}

  /**
   * Checks if a contract is initialized
   */
  async isContractInitialized(contractAddress: string): Promise<boolean> {
    try {
      const info = await this.getWalletInfo(contractAddress);
      return info?.initialized === true;
    } catch {
      return false;
    }
  }

  /**
   * Inicializa um contrato de wallet
   */
  async initializeWallet(
    contractAddress: string,
    telegramHash: Buffer,
    botPublicKey: Buffer,
    limits: WalletLimits,
    protocols: ProtocolConfig[]
  ): Promise<string> {
    const [contractAddr, contractName] = contractAddress.split('.');

    //const validProtocols = protocols.filter(p => p.address && p.address.length > 10);
    
    /*const protocolsList = listCV(validProtocols.map(p =>
      tupleCV({
        address: principalCV(p.address),
        name: stringAsciiCV(p.name),
        'max-alloc': uintCV(p.maxAlloc),
      }),
    ));*/

    const result = await this.callContractFunction(
      contractAddr,
      contractName,
      'initialize',
      [
        bufferCV(telegramHash),
        bufferCV(botPublicKey),
        uintCV(limits.maxPerTransaction),
        uintCV(limits.dailyLimit)        
      ]
    );

    return result.txid;
  }

  /**
   * Registra uma wallet no helper
   */
  async registerWalletInHelper(
    walletContract: string,
    telegramHash: Buffer,
    limits: WalletLimits
  ): Promise<string> {
    const [helperAddr, helperName] = this.withdrawHelperContract.split('.');
    
    const result = await this.callContractFunction(
      helperAddr,
      helperName,
      'register-wallet',
      [
        principalCV(walletContract),
        bufferCV(telegramHash),
        uintCV(limits.maxPerTransaction),
        uintCV(limits.dailyLimit)
      ]
    );

    return result.txid;
  }

  /**
   * Registra uma wallet na factory
   */
  async registerWalletInFactory(
    telegramHash: Buffer,
    contractAddress: string
  ): Promise<string> {
    if (!this.factoryContract) return '';
    
    const [factoryAddr, factoryName] = this.factoryContract.split('.');
    
    const factoryNonce = await this.readFactoryNonce();
    
    const principalCVBytes = serializeCV(principalCV(contractAddress));
    const contractHashInput = createHash('sha256').update(principalCVBytes).digest();
    
    const payload = Buffer.concat([
      telegramHash,
      contractHashInput,
      uint128BE(factoryNonce),
    ]);
    
    const msg = createHash('sha256').update(payload).digest();
    const signature = this.cryptoService.createFullSignature(msg);

    const result = await this.callContractFunction(
      factoryAddr,
      factoryName,
      'register-wallet',
      [
        bufferCV(telegramHash),
        principalCV(contractAddress),
        uintCV(factoryNonce),
        bufferCV(signature)
      ]
    );

    return result.txid;
  }

  /**
   * Inicializa o helper
   */
  async initializeHelper(botPublicKey: Buffer): Promise<string> {
    const [helperAddr, helperName] = this.withdrawHelperContract.split('.');
    
    const result = await this.callContractFunction(
      helperAddr,
      helperName,
      'initialize',
      [bufferCV(botPublicKey)]
    );

    return result.txid;
  }

  /**
   * Executa uma operação autorizada
   */
  async executeAuthorizedOperation(
    contractAddress: string,
    nonce: bigint,
    protocol: string,
    action: string,
    amount: bigint,
    expiryBlock: bigint,
    signature: Buffer
  ): Promise<string> {
    const [addr, name] = contractAddress.split('.');
    
    const result = await this.callContractFunction(
      addr,
      name,
      'execute-authorized-operation',
      [
        uintCV(nonce),
        principalCV(protocol),
        stringAsciiCV(action),
        uintCV(amount),
        uintCV(expiryBlock),
        bufferCV(signature),
      ]
    );

    return result.txid;
  }
}

// ============================================================================
// DATABASE SERVICE
// ============================================================================

/**
 * Serviço para operações de banco de dados
 */
class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initDb();
  }

  private initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contract_wallets (
        telegram_hash    TEXT PRIMARY KEY,
        contract_address TEXT NOT NULL UNIQUE,
        deploy_txid      TEXT NOT NULL,
        created_at       INTEGER NOT NULL,
        is_active        INTEGER NOT NULL DEFAULT 1,
        network          TEXT NOT NULL DEFAULT 'testnet'
      );
      CREATE TABLE IF NOT EXISTS operation_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_hash    TEXT NOT NULL,
        contract_address TEXT NOT NULL,
        txid             TEXT,
        protocol         TEXT NOT NULL,
        action           TEXT NOT NULL,
        amount           TEXT NOT NULL,
        status           TEXT NOT NULL,
        created_at       INTEGER NOT NULL
      );
    `);
  }

  /**
   * Salva um registro de wallet
   */
  saveWalletRecord(record: Omit<ContractWalletRecord, 'telegramUserId'>): void {
    this.db.prepare(`
      INSERT INTO contract_wallets
        (telegram_hash, contract_address, deploy_txid, created_at, is_active, network)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(record.telegramHash, record.contractAddress, record.deployTxId, record.createdAt, record.network);
  }

  /**
   * Obtém uma wallet pelo hash do Telegram
   */
  getWalletByTelegramHash(telegramHash: string): Omit<ContractWalletRecord, 'telegramUserId'> | null {
    const row = this.db.prepare('SELECT * FROM contract_wallets WHERE telegram_hash = ?').get(telegramHash) as any;
    if (!row) return null;
    
    return {
      telegramHash: row.telegram_hash,
      contractAddress: row.contract_address,
      deployTxId: row.deploy_txid,
      createdAt: row.created_at,
      isActive: row.is_active === 1,
      network: row.network,
    };
  }

  /**
   * Registra uma operação no log
   */
  logOperation(
    telegramHash: string,
    contractAddress: string,
    txid: string,
    protocol: string,
    action: string,
    amount: bigint,
    status: string = 'completed'
  ): void {
    this.db.prepare(`
      INSERT INTO operation_log
        (telegram_hash, contract_address, txid, protocol, action, amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      telegramHash,
      contractAddress,
      txid,
      protocol,
      action,
      amount.toString(),
      status,
      Date.now()
    );
  }

  /**
   * Obtém histórico de operações
   */
  getOperationHistory(telegramHash: string, limit = 10): any[] {
    return this.db
      .prepare('SELECT * FROM operation_log WHERE telegram_hash = ? ORDER BY created_at DESC LIMIT ?')
      .all(telegramHash, limit);
  }
}

// ============================================================================
// WALLET MANAGER (MAIN CLASS)
// ============================================================================

export class WalletManager {
  private networkConfig: NetworkConfig;
  private botPrivateKey: Buffer;
  private botPrivateKeyForSdk: string;
  private botPublicKey: Buffer;
  private botAddress: string;
  private salt: string;
  private factoryContract: string;
  private withdrawHelperContract: string;
  
  private blockchainService: BlockchainService;
  private cryptoService: CryptoService;
  private contractService: ContractService;
  private databaseService: DatabaseService;

  private constructor(network?: NetworkConfig) {
    this.networkConfig = network ?? getCurrentNetwork();
  }

  static async create(network?: NetworkConfig): Promise<WalletManager> {
    const instance = new WalletManager(network);
    await instance.init();
    return instance;
  }

  /**
 * DEBUG: Lista todas as wallets no banco
 */
async debugListWallets(): Promise<void> {
  console.log('\n=== DEBUG: WALLETS IN DATABASE ===');
  
  const wallets = this.databaseService['db']
    .prepare('SELECT * FROM contract_wallets')
    .all();
  
  console.log(`Total wallets: ${wallets.length}`);
  
  for (const wallet of wallets as any[]) {
    console.log({
      telegram_hash: wallet.telegram_hash,
      contract_address: wallet.contract_address,
      is_active: wallet.is_active,
      network: wallet.network
    });
  }
  
  console.log('=== END DEBUG ===\n');
}

  private async init() {
    // Configurar chaves
    await this.setupKeys();
    
    // Configurar serviços
    this.blockchainService = new BlockchainService(
      this.networkConfig,
      this.botAddress,
      this.botPrivateKeyForSdk
    );
    
    this.cryptoService = new CryptoService(
      this.botPrivateKey,
      this.botPublicKey,
      this.botPrivateKeyForSdk
    );
    
    this.contractService = new ContractService(
      this.blockchainService,
      this.cryptoService,
      this.botAddress,
      this.botPrivateKeyForSdk,
      this.withdrawHelperContract,
      this.factoryContract
    );
    
    this.databaseService = new DatabaseService(process.env.DB_PATH ?? './data/copilot.db');

    console.log('\n🔧 Verificando configuração do withdraw-helper...');
    const isHelperReady = await this.ensureHelperInitialized();
    
    if (!isHelperReady) {
      console.warn('⚠️  Withdraw-helper is not ready! Withdrawals may fail.');
      console.warn('   Verifique manualmente ou aguarde a inicialização.');
    } else {
      console.log('✅ Withdraw-helper configured correctly!');
    }
    
    console.log('\n🎉 WalletManager initialized successfully!\n');
    await this.debugListWallets();
  }

  private async setupKeys() {
    const rawEnv = process.env.AGENT_STACKS_PRIVATE_KEY ?? '';
    const mnemonicEnv = process.env.AGENT_STACKS_MNEMONIC ?? '';

    let resolvedKeyHex: string;

    // Robust private key cleaning - handles ALL Stacks key formats
    function cleanPrivateKey(input: string): string {
      let hex = input.replace('0x', '').toLowerCase();
      
      // Handle common Stacks formats:
      // Format 1: 05 + 62 hex + 01 = 66 chars → 05 + 62 hex = 64 chars
      // Format 2: 64 hex + 01 = 66 chars → 64 hex
      // Format 3: 64 hex (already clean)
      
      // First remove trailing '01' if present
      if (hex.endsWith('01') && hex.length > 64) {
        hex = hex.slice(0, -2);
      }
      
      // Now ensure it's exactly 64 chars
      if (hex.length !== 64) {
        throw new Error(`Invalid private key length: ${input.length} → ${hex.length} after cleaning`);
      }
      
      return hex;
    }

    if (rawEnv && !isMnemonic(rawEnv)) {
      resolvedKeyHex = cleanPrivateKey(rawEnv);
      console.log(`[WalletManager] Using direct private key`);
    } else if (mnemonicEnv || isMnemonic(rawEnv)) {
      const mnemonic = mnemonicEnv || rawEnv;
      const accountIdx = parseInt(process.env.AGENT_STACKS_ACCOUNT_INDEX ?? '0', 10);

      console.log(`[WalletManager] Deriving key from mnemonic (account index ${accountIdx})…`);
      const derived = await privateKeyFromMnemonic(mnemonic, accountIdx);
      resolvedKeyHex = cleanPrivateKey(derived);
    } else {
      throw new Error('No agent key configured');
    }

    this.botPrivateKey = Buffer.from(resolvedKeyHex, 'hex');
    this.botPrivateKeyForSdk = resolvedKeyHex + '01';

    this.botPublicKey = stacksCrypto.publicKeyCreate(this.botPrivateKey, true);
    if (this.botPublicKey.length !== 33) {
      throw new Error(`botPublicKey must be 33 bytes, got ${this.botPublicKey.length}`);
    }
    const prefix = this.botPublicKey[0];
    if (prefix !== 0x02 && prefix !== 0x03) {
      throw new Error(`botPublicKey is not a valid compressed secp256k1 key`);
    }
    console.log(`[WalletManager] Bot pubkey (${this.botPublicKey.length}B): ${this.botPublicKey.toString('hex')}`);

    this.salt = process.env.TELEGRAM_HASH_SALT ?? '';
    if (!this.salt) throw new Error('TELEGRAM_HASH_SALT not configured');

    this.botAddress = process.env.AGENT_STACKS_ADDRESS ?? '';
    this.factoryContract = process.env.FACTORY_CONTRACT_ADDRESS ?? '';
    this.withdrawHelperContract = process.env.WITHDRAW_HELPER_CONTRACT ?? '';

    if (!this.withdrawHelperContract) {
      throw new Error('WITHDRAW_HELPER_CONTRACT not configured');
    }
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  getBotAddress(): string {
    return this.botAddress;
  }

  getNetwork(): NetworkConfig {
    return this.networkConfig;
  }

  /**
   * Obtém o estado da wallet para um usuário
   */
  getStateForUser(telegramUserId: string): WalletState {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) return { connected: false };
    return { 
      connected: record.isActive, 
      address: record.contractAddress, 
      network: record.network 
    };
  }

  /**
   * Checks if a user is connected
   */
  isConnected(telegramUserId: string): boolean {
    return this.getStateForUser(telegramUserId).connected;
  }

  /**
   * Obtém o endereço da wallet de um usuário
   */
  getAddress(telegramUserId: string): string | undefined {
    return this.getStateForUser(telegramUserId).address;
  }

  /**
   * Obtém uma wallet do cache/database
   */
  getCachedWallet(telegramUserId: string | number): ContractWalletRecord | null {
  // Converter para string (telegram IDs são números, mas no DB são strings)
  const userIdStr = String(telegramUserId);
  
  const hash = this.cryptoService.deriveTelegramHash(userIdStr, this.salt).toString('hex');
  const record = this.databaseService.getWalletByTelegramHash(hash);
  
  if (!record) {
    console.log(`[WalletManager] No wallet found for user ${userIdStr} with hash ${hash}`);
    
    // DEBUG: Listar todas as wallets no banco
    try {
      const allWallets = this.databaseService['db']
        .prepare('SELECT telegram_hash, contract_address FROM contract_wallets')
        .all();
      console.log(`[WalletManager] Wallets in DB:`, allWallets);
    } catch (e) {
      console.error('[WalletManager] Error listing wallets:', e);
    }
    
    return null;
  }
  
  // Criar um NOVO objeto em vez de modificar o existente
  return {
    ...record,
    telegramUserId: userIdStr, // Garantir que é string
  };
}


  /**
   * Obtém informações da wallet de um usuário
   */
  async getWalletInfo(telegramUserId: string): Promise<WalletInfo | null> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) return null;
    
    return this.contractService.getWalletInfo(record.contractAddress);
  }

  /**
   * Obtém limites restantes para um usuário
   */
  async getRemainingLimits(telegramUserId: string) {
    const info = await this.getWalletInfo(telegramUserId);
    if (!info) return null;
    
    return {
      remainingToday: BigInt(info['remaining-today']?.toString() || '0'),
      maxPerTx: BigInt(info['max-per-transaction']?.toString() || '0'),
      isPaused: Boolean(info['is-paused']),
    };
  }

  /**
   * Obtém configuração de protocolo para um usuário
   */
  async getProtocolConfig(telegramUserId: string, protocolAddress: string) {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) return null;
    
    return this.contractService.getProtocolConfig(record.contractAddress, protocolAddress);
  }

  /**
   * Obtém histórico de operações
   */
  getOperationHistory(telegramUserId: string, limit = 10) {
    const hash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt).toString('hex');
    return this.databaseService.getOperationHistory(hash, limit);
  }

  /**
   * Checks if a user's contract is initialized
   */
  async isContractInitialized(telegramUserId: string): Promise<boolean> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) return false;
    
    return this.contractService.isContractInitialized(record.contractAddress);
  }

  /**
   * Verifica se a chave pública do bot coincide com a do contrato
   */
  private async verifyBotPublicKey(): Promise<boolean> {
    try {
      const onChainPubKey = await this.contractService.getHelperBotPublicKey();
      const ourPubKey = this.botPublicKey.toString('hex');
      return onChainPubKey === ourPubKey;
    } catch (error) {
      console.error('[verifyBotPublicKey] Erro:', error);
      return false;
    }
  }

  private async registerProtocols(
    contractAddress: string,
    telegramHash: Buffer,
    protocols: ProtocolConfig[],
  ): Promise<void> {
    console.log(`[registerProtocols] Registering ${protocols.length} protocols...`);

    for (const protocol of protocols) {
      // Tentar até 3 vezes por protocolo
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const nonce = await this.contractService.readWalletNonce(contractAddress);
          const currentBlock = await this.blockchainService.fetchCurrentBlock();
          const expiryBlock = currentBlock + 10;

          // Construir payload conforme o contrato add-protocol
          const protocolHash = this.cryptoService.hashPrincipalData(protocol.address);

          const payload = Buffer.concat([
            telegramHash,
            uint128BE(BigInt(50)), // DOMAIN-ADD-PROTOCOL = u50
            protocolHash,           // sha256 do principal do protocolo
            uint128BE(nonce),
            uint128BE(protocol.maxAlloc),
            uint128BE(BigInt(expiryBlock)),
          ]);

          const msgHash = createHash('sha256').update(payload).digest();
          const signature = this.cryptoService.createFullSignature(msgHash);

          const [addr, name] = contractAddress.split('.');

          await this.contractService.callContractFunction(
            addr,
            name,
            'add-protocol',
            [
              principalCV(protocol.address),
              stringAsciiCV(protocol.name),
              uintCV(protocol.maxAlloc),
              uintCV(nonce),
              uintCV(BigInt(expiryBlock)),
              bufferCV(signature),
              bufferCV(telegramHash),
            ]
          );

          console.log(`[registerProtocols] ✅ ${protocol.name} registered (${protocol.address})`);

          // Aguardar entre protocolos para não conflitar nonces
          await new Promise(resolve => setTimeout(resolve, 6000));
          break;

        } catch (error: any) {
          const isAlreadyRegistered =
            error.message?.includes('412') ||
            error.message?.includes('ERR-PROTOCOL-EXISTS');

          if (isAlreadyRegistered) {
            console.log(`[registerProtocols] ${protocol.name} already registered, skipping.`);
            break;
          }

          console.error(`[registerProtocols] Error registering ${protocol.name} (attempt ${attempt}/3):`, error.message);

          if (attempt === 3) {
            // Não lança erro — wallet ainda funciona sem o protocolo
            console.warn(`[registerProtocols] ⚠️ Failed to register ${protocol.name} after 3 attempts. Continuing...`);
          } else {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
    }

    console.log(`[registerProtocols] Protocol registration complete.`);
  }

  /**
   * Verifica e inicializa o withdraw-helper se necessário
   */
  async ensureHelperInitialized(): Promise<boolean> {
    console.log('\n🔧 Verificando inicialização do withdraw-helper...');

    try {
      const onChainPubKey = await this.contractService.getHelperBotPublicKey();
      const ourPubKey = this.botPublicKey.toString('hex');

      console.log(`📍 On-chain bot pubkey: ${onChainPubKey}`);
      console.log(`📍 Our bot pubkey:      ${ourPubKey}`);

      const zeroKey = '000000000000000000000000000000000000000000000000000000000000000000';

      if (onChainPubKey === zeroKey) {
        console.log('⚠️  Withdraw-helper NOT initialized. Initializing NOW...');

        const txId = await this.contractService.initializeHelper(this.botPublicKey);
        console.log(`✅ Withdraw-helper initialized! TX: ${txId}`);

        await new Promise(r => setTimeout(r, 12_000));
        
        const verified = await this.verifyBotPublicKey();
        console.log(verified ? '✅ Initialization verified!' : '❌ Verification failed!');
        return verified;

      } else if (onChainPubKey === ourPubKey) {
        console.log('✅ Withdraw-helper is already initialized with the correct key!');
        return true;

      } else {
        console.error('❌ Withdraw-helper initialized with DIFFERENT KEY!');
        console.error(`   Esperado:   ${ourPubKey}`);
        console.error(`   Encontrado: ${onChainPubKey}`);
        return false;
      }

    } catch (error) {
      console.error('❌ Erro ao verificar inicialização:', error);
      return false;
    }
  }

  /**
   * Inicializa o contrato para um usuário com valores padrão
   */
  async initializeContractForUser(telegramUserId: string): Promise<void> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) {
      throw new Error(`Wallet not found for user ${telegramUserId}`);
    }
    
    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    
    const limits: WalletLimits = {
      maxPerTransaction: 1000000000n,
      dailyLimit: 10000000000n,
    };
    
    const protocols: ProtocolConfig[] = [];
    
    await this.contractService.initializeWallet(
      record.contractAddress,
      telegramHash,
      this.botPublicKey,
      limits      
    );
  }

  /**
   * Cria uma nova wallet de contrato para um usuário
   */

    // WalletManager.ts - createContractWallet (com logs de debug)

async createContractWallet(
  telegramUserId: string,
  limits: WalletLimits,
  protocols: ProtocolConfig[],
): Promise<ContractWalletRecord> {
  console.log(`[createContractWallet] Starting for user: ${telegramUserId}`);
  
  // Verificar se já existe
  const existing = this.getCachedWallet(telegramUserId);
  if (existing) {
    console.log(`[WalletManager] User ${telegramUserId} already has wallet: ${existing.contractAddress}`);
    return existing;
  }

  const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
  console.log(`[createContractWallet] telegramHash: ${telegramHash.toString('hex')}`);
  
  let lastError: Error | null = null;
  let contractName = '';
  let contractAddress = '';
  let deployResult: BroadcastResult | null = null;
  
  for (let attempt = 1; attempt <= MAX_DEPLOY_ATTEMPTS; attempt++) {
    const contractSuffix = randomBytes(4).toString('hex');
    contractName = `user-wallet-${contractSuffix}`;
    contractAddress = `${this.botAddress}.${contractName}`;

    console.log(`[createContractWallet] Generated contract name: ${contractName} (attempt ${attempt}/${MAX_DEPLOY_ATTEMPTS})`);

    const alreadyExists = await this.blockchainService.checkContractExists(this.botAddress, contractName);
    if (alreadyExists) {
      console.log(`[createContractWallet] Contract ${contractName} already exists, trying new name...`);
      lastError = new Error(`Contract ${contractName} already exists`);
      continue;
    }

    console.log(`[createContractWallet] Deploying ${contractName}...`);
    const deployNonce = await this.blockchainService.getCurrentNonceWithRetry();
    console.log(`[createContractWallet] Deploy TX with nonce: ${deployNonce}`);
    
    try {
      deployResult = await this.contractService.deployContract(contractName, { nonce: deployNonce });
      console.log(`[createContractWallet] Deploy TX: ${deployResult.txid}`);
      
      await this.blockchainService.waitForConfirmation(deployResult.txid);
      console.log(`[createContractWallet] Deploy confirmed`);
      
      // Aguardar propagação do contrato na rede
      console.log(`[createContractWallet] Waiting for contract propagation...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos
      
      break;
      
    } catch (deployError: any) {
      console.error(`[createContractWallet] Deploy error:`, deployError);
      if (deployError.message?.includes('ContractAlreadyExists') || deployError.message?.includes('0x0809') || deployError.message?.includes('Contrato já existe')) {
        console.log(`[createContractWallet] Contract ${contractName} already exists (from deploy error), trying new name...`);
        lastError = deployError;
        continue;
      }
      throw deployError;
    }
  }

  if (!deployResult) {
    console.error(`[createContractWallet] Failed to deploy after ${MAX_DEPLOY_ATTEMPTS} attempts`);
    throw lastError || new Error(`Failed to deploy contract after ${MAX_DEPLOY_ATTEMPTS} attempts`);
  }

  // Wait and check if contract is initialized
  console.log(`[createContractWallet] Waiting for contract to be available...`);
  let isInitialized = false;
  for (let i = 0; i < 10; i++) {
    try {
      isInitialized = await this.contractService.isContractInitialized(contractAddress);
      console.log(`[createContractWallet] Contract check ${i + 1}/10: ${isInitialized}`);
      if (isInitialized) break;
    } catch (error: any) {
      console.log(`[createContractWallet] Contract check ${i + 1}/10 failed:`, error?.message || error);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  if (!isInitialized) {
    console.log(`[createContractWallet] Contract not found after 30 seconds, attempting initialization anyway...`);
  }

  if (!isInitialized) {
    console.log(`[createContractWallet] Initializing contract...`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.contractService.initializeWallet(
          contractAddress,
          telegramHash,
          this.botPublicKey,
          limits,
          protocols
        );
        console.log(`[createContractWallet] Contract initialized successfully (attempt ${attempt}/3).`);
        await new Promise(resolve => setTimeout(resolve, 8000));
        await this.registerProtocols(contractAddress, telegramHash, protocols);
        
        break;
      } catch (initError: any) {
        console.error(`[createContractWallet] Initialization error (attempt ${attempt}/3):`, initError);
        if (attempt === 3) {
          throw initError;
        }
        if (initError.message?.includes('NoSuchContract')) {
          console.log(`[createContractWallet] Contract not found yet, waiting 5 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw initError;
      }
    }
  } else {
    console.log(`[createContractWallet] Contract already initialized, skipping.`);
  }

  // Verificar registro no helper
  console.log(`[createContractWallet] Checking if wallet is registered in helper...`);
  const isRegisteredInHelper = await this.contractService.isWalletRegisteredInHelper(contractAddress);
  console.log(`[createContractWallet] isRegisteredInHelper: ${isRegisteredInHelper}`);

  // In createContractWallet, replace the silent catch:
  if (!isRegisteredInHelper) {
    console.log(`[createContractWallet] Registering wallet in withdraw-helper...`);
    // Retry up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const regTxid = await this.contractService.registerWalletInHelper(
          contractAddress, telegramHash, limits
        );
        await this.blockchainService.waitForConfirmation(regTxid);
        console.log(`[createContractWallet] ✅ Wallet registered in withdraw-helper.`);
        break;
      } catch (error: any) {
        console.error(`[createContractWallet] Register attempt ${attempt}/3 failed:`, error?.message);
        if (attempt === 3) {
          // Don't throw — wallet is still usable, withdrawStx will re-register lazily
          console.warn(`[createContractWallet] ⚠️ Helper registration failed — will retry on first withdrawal.`);
        } else {
          await new Promise(r => setTimeout(r, 6000));
        }
      }
    }
  }

  // Registrar na factory
  if (this.factoryContract) {
    console.log(`[createContractWallet] Checking factory registration...`);
    try {
      // Try to register - if already registered, contract will throw error
      await this.contractService.registerWalletInFactory(telegramHash, contractAddress);
      console.log(`[createContractWallet] Registered in factory.`);
    } catch (error: any) {
      // Check if error indicates already registered
      if (error.message?.includes('ERR_ALREADY_REGISTERED') || 
          error.message?.includes('already registered') ||
          error.message?.includes('ConflictingNonceInMempool')) {
        console.log(`[createContractWallet] Already registered in factory (or pending), skipping.`);
      } else {
        // Re-throw other errors
        console.error(`[createContractWallet] Factory registration error:`, error);
      }
    }
  }

  // SALVAR NO BANCO DE DADOS
  console.log(`[createContractWallet] Saving to database...`);
  
  const record: ContractWalletRecord = {
    telegramUserId,
    telegramHash: telegramHash.toString('hex'),
    contractAddress,
    deployTxId: deployResult?.txid ?? 'unknown',
    createdAt: Date.now(),
    isActive: true,
    network: this.networkConfig.name,
  };

  try {
    this.databaseService.saveWalletRecord(record);
    console.log(`[createContractWallet] Wallet record saved: ${contractAddress}`);
  } catch (dbError) {
    console.error(`[createContractWallet] Database save error:`, dbError);
    throw dbError;
  }

  // VERIFICAR SE FOI SALVO
  const savedRecord = this.databaseService.getWalletByTelegramHash(telegramHash.toString('hex'));
  if (savedRecord) {
    console.log(`[createContractWallet] ✅ VERIFIED: Wallet found in DB after save`);
  } else {
    console.error(`[createContractWallet] ❌ CRITICAL: Wallet NOT found in DB immediately after save!`);
  }

  console.log(`[createContractWallet] Returning record:`, {
    telegramUserId: record.telegramUserId,
    contractAddress: record.contractAddress
  });

  return record;
}

  /**
   * Assina uma operação usando o novo payload com protocol e action
   */
  async signOperation(req: OperationRequest): Promise<SignedOperation> {
    const record = this.getCachedWallet(req.telegramUserId);
    if (!record) throw new Error(`Wallet not found for userId ${req.telegramUserId}`);

    const telegramHash = this.cryptoService.deriveTelegramHash(req.telegramUserId, this.salt);
    const nonce = await this.contractService.readWalletNonce(record.contractAddress);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiryBlock = currentBlock + (req.expiryBlocks ?? 10);

    // Use the new opPayload with protocol and action
    const payload = opPayload(
      Buffer.from(telegramHash),
      req.protocol,
      req.action,
      nonce,
      req.amount,
      BigInt(expiryBlock)
    );
    
    const signature = this.cryptoService.createFullSignature(Buffer.from(payload));

    return { nonce, signature, expiryBlock };
  }

  /**
   * Executa uma operação autorizada
   */
  async executeOperation(
    telegramUserId: string,
    protocol: string,
    action: 'deposit' | 'withdraw' | 'swap',
    amount: bigint,
    expiryBlocks = 10
  ): Promise<{ txId: string }> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error('Wallet not found');

    const signed = await this.signOperation({
      telegramUserId,
      protocol,
      action,
      amount,
      expiryBlocks
    });

    const txId = await this.contractService.executeAuthorizedOperation(
      record.contractAddress,
      signed.nonce,
      protocol,
      action,
      amount,
      BigInt(signed.expiryBlock),
      signed.signature
    );

    return { txId };
  }

  /**
   * Executa saque com retry automático para erros de rate limit (420)
   */
  async withdrawStx(
    telegramUserId: string,
    recipientAddress: string,
    amountMicro: bigint,
    expiryBlocks: number = 20,
    maxRetries: number = 3
  ): Promise<{ txIdAuth: string; txIdWithdraw: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[withdrawStx] Attempt ${attempt}/${maxRetries}`);
        
        const result = await this.executeWithdrawStx(telegramUserId, recipientAddress, amountMicro, expiryBlocks);
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        const errorMsg = error?.message || '';
        
        // Check if it's a rate limit error (420)
        const isRateLimit = errorMsg.includes('420') || errorMsg.includes('Transaction limit exceeded');
        
        // Check if it's an auth exists error (427)
        const isAuthExists = errorMsg.includes('427') || errorMsg.includes('Authorization already exists');
        
        if (isRateLimit && attempt < maxRetries) {
          const waitTime = 15000 * attempt; // 15s, 30s, 45s
          console.log(`[withdrawStx] Rate limit detected (420), waiting ${waitTime/1000}s before retry...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        
        if (isAuthExists && attempt < maxRetries) {
          // ERR-AUTH-EXISTS means there's a pending authorization
          // Wait for it to expire (typically 5-10 blocks)
          const waitTime = 30000 * attempt; // 30s, 60s, 90s
          console.log(`[withdrawStx] Auth exists (427), waiting ${waitTime/1000}s for pending auth to expire...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        
        // Re-throw if not a rate limit error or out of retries
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Executa o saque efetivamente (lógica principal)
   */
  private async executeWithdrawStx(
    telegramUserId: string,
    recipientAddress: string,
    amountMicro: bigint,
    expiryBlocks: number = 10
  ): Promise<{ txIdAuth: string; txIdWithdraw: string }> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error('Wallet not found for user');
    if (!record.isActive) throw new Error('Wallet is inactive');

    if (!validateStacksAddress(recipientAddress)) {
      throw new Error('Invalid recipient address');
    }

    const isPubKeyValid = await this.verifyBotPublicKey();
    if (!isPubKeyValid) {
      throw new Error('Bot public key mismatch with contract');
    }

    const walletContract = record.contractAddress;

    // Ensure wallet is registered in the helper before proceeding
    const isRegistered = await this.contractService.isWalletRegisteredInHelper(walletContract);
    if (!isRegistered) {
      console.log('[withdrawStx] Wallet not registered in helper — registering now...');
      const telegramHashForReg = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);

      const walletInfo = await this.contractService.getWalletInfo(walletContract);
      const limits: WalletLimits = {
        maxPerTransaction: BigInt(walletInfo?.['max-per-transaction']?.toString() ?? '1000000000'),
        dailyLimit: BigInt(walletInfo?.['daily-limit']?.toString() ?? '10000000000'),
      };

      const regTxid = await this.contractService.registerWalletInHelper(
        walletContract,
        telegramHashForReg,
        limits
      );
      console.log(`[withdrawStx] Registered in helper, TX: ${regTxid}`);
      await this.blockchainService.waitForConfirmation(regTxid);
      await new Promise(r => setTimeout(r, 5000));
    }

    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiry = currentBlock + expiryBlocks;

    // Nonce vem do HELPER
    const helperNonce = await this.contractService.readHelperNonce(walletContract);

    console.log(`[withdrawStx] wallet: ${walletContract}`);
    console.log(`[withdrawStx] recipient: ${recipientAddress}`);
    console.log(`[withdrawStx] amount: ${amountMicro}`);
    console.log(`[withdrawStx] helperNonce: ${helperNonce}`);
    console.log(`[withdrawStx] expiry: ${expiry}`);

    // Get the wallet's telegram hash from the helper contract to verify
    const [helperAddr, helperName] = this.withdrawHelperContract.split('.');

    const walletData = await this.blockchainService.callReadOnlyFunction(
      helperAddr,
      helperName,
      'get-wallet-telegram-hash',
      [principalCV(walletContract)]
    );

    console.log('[withdrawStx] Stored telegram hash from helper:', walletData);
    console.log('[withdrawStx] Our telegram hash:', telegramHash.toString('hex'));

    // Calculate wallet hash: sha256(to-consensus-buff?(wallet))
    const walletConsensusBytes = this.cryptoService.principalToConsensusBytes(walletContract);
    const walletHash = createHash('sha256').update(walletConsensusBytes).digest();
    console.log('[withdrawStx] walletConsensusBytes:', walletConsensusBytes.toString('hex'));
    console.log('[withdrawStx] walletHash:', walletHash.toString('hex'));

    // Calculate recipient hash: sha256(to-consensus-buff?(recipient)) - FULL bytes, no slice
    const recipientConsensusBytes = this.cryptoService.principalToConsensusBytes(recipientAddress);
    const recipientHash = createHash('sha256').update(recipientConsensusBytes).digest();
    console.log('[withdrawStx] recipientConsensusBytes:', recipientConsensusBytes.toString('hex'));
    console.log('[withdrawStx] recipientHash:', recipientHash.toString('hex'));

    console.log('[withdrawStx] DEBUG payload inputs:', {
      tgHash: telegramHash.toString('hex'),
      walletHash: walletHash.toString('hex'),
      nonce: helperNonce.toString(),
      amount: amountMicro.toString(),
      expiry: expiry.toString(),
      expiryType: typeof expiry,
      expiryHex: typeof expiry === 'bigint' ? '0x' + expiry.toString(16) : 'N/A',
      recipientHash: recipientHash.toString('hex')
    });

    // IMPORTANT: Build the raw payload (NOT hashed) exactly as the contract's withdraw-payload function
    const expiryBigInt = BigInt(expiry);
    console.log('[withdrawStx] expiryBigInt:', expiryBigInt.toString(), 'hex:', '0x' + expiryBigInt.toString(16));
    const rawPayload = withdrawPayload(
      telegramHash,     // tg-hash - this is the actual telegram hash, not ZERO_HASH
      walletHash,       // wallet-hash
      helperNonce,      // nonce
      amountMicro,      // amount
      expiryBigInt,   // expiry
      recipientHash     // recip-hash
    );

    console.log('[withdrawStx] Raw payload length:', rawPayload.length);
    console.log('[withdrawStx] Raw payload (hex):', Buffer.from(rawPayload).toString('hex'));

    // The contract does: (let ((payload-hash (sha256 (withdraw-payload ...))))
    const msgHash = createHash('sha256').update(rawPayload).digest();
    console.log('[withdrawStx] msgHash:', msgHash.toString('hex'));

    const helperSig = this.cryptoService.createFullSignature(msgHash);
    console.log('[withdrawStx] signature (65 bytes):', helperSig.toString('hex'));
    console.log('[withdrawStx] signature recovery byte:', helperSig[0]);
    console.log('[withdrawStx] signature r:', helperSig.slice(1, 33).toString('hex'));
    console.log('[withdrawStx] signature s:', helperSig.slice(33, 65).toString('hex'));
    console.log('[withdrawStx] botPublicKey (33 bytes):', this.botPublicKey.toString('hex'));

    // Step 1: authorize-withdrawal no helper
    // Try all 3 signature formats to find which one works
    console.log('[withdrawStx] Testing signature formats...');
    
    const msgHashHex = msgHash.toString('hex');
    
    const signatureFormats = [
      { name: 'raw-0', transform: (sig: Buffer) => { const s = Buffer.from(sig); s[0] = 0; return s; } },
      { name: 'raw-1', transform: (sig: Buffer) => { const s = Buffer.from(sig); s[0] = 1; return s; } },
      { name: 'raw-2', transform: (sig: Buffer) => { const s = Buffer.from(sig); s[0] = 2; return s; } },
      { name: 'raw-3', transform: (sig: Buffer) => { const s = Buffer.from(sig); s[0] = 3; return s; } },
      { name: 'sdk', transform: (sig: Buffer) => sig },
    ];
    
    let authResult: any = null;
    let usedFormat = '';
    
    for (const fmt of signatureFormats) {
      let fullSig: Buffer;
      
      if (fmt.name === 'sdk') {
        const sig = signMessageHashRsv({
          messageHash: msgHashHex,
          privateKey: this.botPrivateKeyForSdk!,
        });
        fullSig = Buffer.from(sig, 'hex');
      } else {
        const { signature, recovery } = stacksCrypto.ecdsaSign(msgHash, this.botPrivateKey);
        fullSig = fmt.transform(signature);
      }
      
      console.log(`[withdrawStx] Trying ${fmt.name}: recovery=${fullSig[0]}, sig=${fullSig.toString('hex').slice(0,20)}...`);
      
      try {
        const testResult = await this.contractService.callContractFunction(
          helperAddr,
          helperName,
          'authorize-withdrawal',
          [
            principalCV(walletContract),
            uintCV(helperNonce),
            uintCV(amountMicro),
            principalCV(recipientAddress),
            uintCV(BigInt(expiry)),
            bufferCV(telegramHash),
            bufferCV(fullSig),
          ]
        );
        
        // Check if transaction succeeded
        await new Promise(r => setTimeout(r, 3000));
        const res = await fetch(`${this.networkConfig.apiUrl}/extended/v1/tx/${testResult.txid}`);
        const data = await res.json() as { tx_status: string };
        
        if (data.tx_status === 'success') {
          authResult = testResult;
          usedFormat = fmt.name;
          console.log(`[withdrawStx] ✅ ${fmt.name} worked!`);
          break;
        } else {
          console.log(`[withdrawStx] ❌ ${fmt.name} failed: ${data.tx_status}`);
          // Get more details about the failure
          try {
            const details = await fetch(`${this.networkConfig.apiUrl}/extended/v1/tx/${testResult.txid}`);
            const detailData = await details.json();
            console.log('[withdrawStx] TX Details:', JSON.stringify(detailData, null, 2));
          } catch(e) {
            console.log('[withdrawStx] Could not get TX details');
          }
        }
      } catch (e) {
        console.log(`[withdrawStx] ❌ ${fmt.name} error: ${e}`);
      }
    }
    
    if (!authResult) {
      throw new Error('All signature formats failed');
    }
    
    console.log(`[withdrawStx] Using format: ${usedFormat}`);
    
    console.log('[withdrawStx] Arg types:', {
      wallet: typeof walletContract,
      nonce: typeof helperNonce,
      amount: typeof amountMicro,
      recipient: typeof recipientAddress,
      expiry: typeof expiry,
      tgProof: 'buff32',
      botSig: 'buff65 len=' + helperSig.length
    });

    console.log(`[withdrawStx] Auth TX: ${authResult.txid}`);
    await this.blockchainService.waitForConfirmation(authResult.txid);

    // Calculate auth-key: sha256(to-consensus-buff?(wallet) ++ uint-to-16bytes(nonce))
    const authKey = createHash('sha256')
      .update(Buffer.concat([
        walletConsensusBytes,
        uint128BE(helperNonce),
      ]))
      .digest();
    console.log(`[withdrawStx] authKey: ${authKey.toString('hex')}`);

    // Aguardar propagação
    await new Promise(r => setTimeout(r, 5000));

    // Step 2: withdraw-stx na user-wallet
    console.log('[withdrawStx] Calling withdraw-stx...');
    const [walletAddr, walletName] = walletContract.split('.');

    const withdrawResult = await this.contractService.callContractFunction(
      walletAddr,
      walletName,
      'withdraw-stx',
      [
        uintCV(amountMicro),              // amount
        principalCV(recipientAddress),    // recipient
        uintCV(BigInt(expiry)),           // expiry-block
        bufferCV(authKey),                // auth-key
      ]
    );

    console.log(`[withdrawStx] Withdraw TX: ${withdrawResult.txid}`);

    this.databaseService.logOperation(
      telegramHash.toString('hex'),
      walletContract,
      withdrawResult.txid,
      this.withdrawHelperContract,
      'withdraw-stx',
      amountMicro
    );

    return { txIdAuth: authResult.txid, txIdWithdraw: withdrawResult.txid };
  }

// Métodos auxiliares
private calculateWalletHash(principal: string): Buffer {
  const consensusBytes = this.cryptoService.principalToConsensusBytes(principal);
  return createHash('sha256').update(consensusBytes).digest();
}

private calculateRecipientHash(recipient: string): Buffer {
  const consensusBytes = this.cryptoService.principalToConsensusBytes(recipient);
  // Remove o primeiro byte (tipo)
  const dataBytes = consensusBytes.slice(1);
  return createHash('sha256').update(dataBytes).digest();
}

private buildHelperWithdrawPayload(
  telegramHash: Buffer,
  walletHash: Buffer,
  nonce: bigint,
  amount: bigint,
  expiry: bigint,
  recipientHash: Buffer
): Buffer {
  const DOMAIN_WITHDRAW = 10n;
  
  return Buffer.concat([
    telegramHash,                    // 32 bytes - tg-hash
    uint128BE(DOMAIN_WITHDRAW),       // 16 bytes - DOMAIN-WITHDRAW
    walletHash,                       // 32 bytes - wallet-hash
    uint128BE(nonce),                  // 16 bytes - nonce
    uint128BE(amount),                  // 16 bytes - amount
    uint128BE(expiry),                  // 16 bytes - expiry
    recipientHash,                     // 32 bytes - recip-hash
  ]);
}

private buildUserWithdrawPayload(
  telegramHash: Buffer,
  nonce: bigint,
  amount: bigint,
  expiry: bigint,
  recipientHash: Buffer
): Buffer {
  const DOMAIN_WITHDRAW = 10n;
  
  return Buffer.concat([
    telegramHash,                    // 32 bytes - var-get telegram-hash
    uint128BE(DOMAIN_WITHDRAW),       // 16 bytes - DOMAIN-WITHDRAW
    uint128BE(nonce),                  // 16 bytes - nonce
    uint128BE(amount),                  // 16 bytes - amount
    uint128BE(expiry),                  // 16 bytes - expiry
    recipientHash,                     // 32 bytes - recip-hash
  ]);
}

private async verifyHelperPayload(
  walletContract: string,
  helperNonce: bigint,
  amount: bigint,
  expiry: number,
  telegramHash: Buffer,
  recipientAddress: string,
  expectedHash: Buffer
): Promise<void> {
  try {
    const [helperAddr, helperName] = this.withdrawHelperContract.split('.');
    
    // Primeiro, obter o telegram-hash da wallet do contrato helper
    const walletData = await this.blockchainService.callReadOnlyFunction(
      helperAddr,
      helperName,
      'get-wallet-telegram-hash',
      [principalCV(walletContract)]
    );
    
    console.log('  Contract stored telegramHash:', walletData);
    console.log('  Our telegramHash:', telegramHash.toString('hex'));
    
    // Does the contract have a debug function? If not, we can skip
  } catch (e) {
    console.log('  Debug verification skipped:', e.message);
  }
}

  /**
   * Pausa emergencial
   */
  async emergencyPause(telegramUserId: string, expiryBlocks = 10): Promise<string> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error(`Wallet not found for userId ${telegramUserId}`);

    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    const nonce = await this.contractService.readWalletNonce(record.contractAddress);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiryBlock = currentBlock + expiryBlocks;

    const payload = Buffer.concat([
      telegramHash,
      uint128BE(nonce),
      uint128BE(BigInt(expiryBlock)),
    ]);
    
    const msgHash = createHash('sha256').update(payload).digest();
    const signature = this.cryptoService.createFullSignature(msgHash);

    const [addr, name] = record.contractAddress.split('.');
    
    const result = await this.contractService.callContractFunction(
      addr,
      name,
      'emergency-pause',
      [
        uintCV(nonce),
        uintCV(BigInt(expiryBlock)),
        bufferCV(signature),
        bufferCV(telegramHash),
      ]
    );

    return result.txid;
  }

  /**
   * Despausa
   */
  async unpause(telegramUserId: string, expiryBlocks = 10): Promise<string> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error(`Wallet not found for userId ${telegramUserId}`);

    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    const nonce = await this.contractService.readWalletNonce(record.contractAddress);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiryBlock = currentBlock + expiryBlocks;

    const payload = Buffer.concat([
      telegramHash,
      uint128BE(nonce),
      uint128BE(BigInt(expiryBlock)),
    ]);
    
    const msgHash = createHash('sha256').update(payload).digest();
    const signature = this.cryptoService.createFullSignature(msgHash);

    const [addr, name] = record.contractAddress.split('.');
    
    const result = await this.contractService.callContractFunction(
      addr,
      name,
      'unpause',
      [
        uintCV(nonce),
        uintCV(BigInt(expiryBlock)),
        bufferCV(signature),
      ]
    );

    return result.txid;
  }

  /**
   * Atualiza limites
   */
  async updateLimits(
    telegramUserId: string,
    newMaxPerTx: bigint,
    newDaily: bigint,
    expiryBlocks = 10,
  ): Promise<string> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error(`Wallet not found for userId ${telegramUserId}`);

    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    const nonce = await this.contractService.readWalletNonce(record.contractAddress);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiryBlock = currentBlock + expiryBlocks;

    const payload = Buffer.concat([
      telegramHash,
      uint128BE(nonce),
      uint128BE(newMaxPerTx),
      uint128BE(newDaily),
      uint128BE(BigInt(expiryBlock)),
    ]);
    
    const msgHash = createHash('sha256').update(payload).digest();
    const signature = this.cryptoService.createFullSignature(msgHash);

    const [addr, name] = record.contractAddress.split('.');
    
    const result = await this.contractService.callContractFunction(
      addr,
      name,
      'update-limits',
      [
        uintCV(newMaxPerTx),
        uintCV(newDaily),
        uintCV(nonce),
        uintCV(BigInt(expiryBlock)),
        bufferCV(signature),
        bufferCV(telegramHash),
      ]
    );

    return result.txid;
  }

  /**
   * Adiciona protocolo
   */
  async addProtocol(
    telegramUserId: string,
    protocol: ProtocolConfig,
    expiryBlocks = 10,
  ): Promise<string> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error(`Wallet not found for userId ${telegramUserId}`);

    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    const nonce = await this.contractService.readWalletNonce(record.contractAddress);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiryBlock = currentBlock + expiryBlocks;

    const payload = Buffer.concat([
      telegramHash,
      uint128BE(nonce),
      uint128BE(protocol.maxAlloc),
      uint128BE(BigInt(expiryBlock)),
    ]);
    
    const msgHash = createHash('sha256').update(payload).digest();
    const signature = this.cryptoService.createFullSignature(msgHash);

    const [addr, name] = record.contractAddress.split('.');
    
    const result = await this.contractService.callContractFunction(
      addr,
      name,
      'add-protocol',
      [
        principalCV(protocol.address),
        stringAsciiCV(protocol.name),
        uintCV(protocol.maxAlloc),
        uintCV(nonce),
        uintCV(BigInt(expiryBlock)),
        bufferCV(signature),
        bufferCV(telegramHash),
      ]
    );

    return result.txid;
  }

  /**
   * Atualiza protocolo
   */
  async updateProtocol(
    telegramUserId: string,
    protocolAddress: string,
    newMaxAlloc: bigint,
    enabled: boolean,
    expiryBlocks = 10,
  ): Promise<string> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) throw new Error(`Wallet not found for userId ${telegramUserId}`);

    const telegramHash = this.cryptoService.deriveTelegramHash(telegramUserId, this.salt);
    const nonce = await this.contractService.readWalletNonce(record.contractAddress);
    const currentBlock = await this.blockchainService.fetchCurrentBlock();
    const expiryBlock = currentBlock + expiryBlocks;

    const payload = Buffer.concat([
      telegramHash,
      uint128BE(nonce),
      uint128BE(newMaxAlloc),
      uint128BE(BigInt(expiryBlock)),
    ]);
    
    const msgHash = createHash('sha256').update(payload).digest();
    const signature = this.cryptoService.createFullSignature(msgHash);

    const [addr, name] = record.contractAddress.split('.');
    
    const result = await this.contractService.callContractFunction(
      addr,
      name,
      'update-protocol',
      [
        principalCV(protocolAddress),
        uintCV(newMaxAlloc),
        boolCV(enabled),
        uintCV(nonce),
        uintCV(BigInt(expiryBlock)),
        bufferCV(signature),
        bufferCV(telegramHash),
      ]
    );

    return result.txid;
  }

  /**
   * Updates wallet limits (not implemented)
   */
  async updateWalletLimits(telegramUserId: string, limits: WalletLimits): Promise<void> {
    const record = this.getCachedWallet(telegramUserId);
    if (!record) {
      throw new Error(`Wallet not found for user ${telegramUserId}`);
    }
    // TODO: Implementar
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _instancePromise: Promise<WalletManager> | null = null;

export function createWalletManager(network?: NetworkConfig): Promise<WalletManager> {
  if (!_instancePromise) _instancePromise = WalletManager.create(network);
  return _instancePromise;
}

export const getWalletManager = createWalletManager;