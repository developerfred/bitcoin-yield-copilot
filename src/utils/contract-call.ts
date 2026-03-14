import { config } from '../config.ts';

export interface ContractCallArg {
  type: string;
  value: string;
}

export interface ContractCallResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

export type Network = 'mainnet' | 'testnet' | 'devnet';

const NETWORK_API_URLS: Record<Network, string> = {
  mainnet: 'https://stacks-node-api.mainnet.alexlab.co',
  testnet: 'https://stacks-node-api.testnet.alexlab.co',
  devnet: 'http://localhost:39999',
};

export async function callContract(
  network: Network,
  contractAddress: string,
  functionName: string,
  args: ContractCallArg[]
): Promise<ContractCallResult> {
  const apiUrl = config.stacks.apiUrl || NETWORK_API_URLS[network];
  
  const url = `${apiUrl}/v2/contracts/call-read/${contractAddress}/${functionName}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: contractAddress.split('.')[0],
        arguments: args.map(arg => encodeArg(arg)),
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    
    if (data.ok && data.result) {
      return { ok: true, value: decodeResult(data.result) };
    }
    
    return { ok: false, error: data.error || 'Unknown error' };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function encodeArg(arg: ContractCallArg): string {
  const { type, value } = arg;
  
  if (type === 'uint') {
    return bytesToHex(serializeUInt(BigInt(value)));
  }
  if (type === 'string') {
    return bytesToHex(serializeString(value));
  }
  if (type === 'bool') {
    return bytesToHex(new Uint8Array([value === 'true' ? 1 : 0]));
  }
  if (type === 'principal') {
    return bytesToHex(serializePrincipal(value));
  }
  if (type === 'buff') {
    return bytesToHex(new TextEncoder().encode(value));
  }
  
  return bytesToHex(new Uint8Array([0]));
}

function serializeUInt(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(16, '0');
  return hexToBytes(hex);
}

function serializeString(str: string): Uint8Array {
  const len = str.length;
  const lenBytes = new Uint8Array(2);
  new DataView(lenBytes.buffer).setUint16(0, len, false);
  
  const strBytes = new TextEncoder().encode(str);
  return concatUint8Arrays(lenBytes, strBytes);
}

function serializePrincipal(addr: string): Uint8Array {
  if (addr.includes('.')) {
    const [address, name] = addr.split('.');
    const addrBytes = decodeAddress(address);
    const nameBytes = new TextEncoder().encode(name);
    const nameLen = new Uint8Array(1);
    nameLen[0] = nameBytes.length;
    return concatUint8Arrays(new Uint8Array([1]), addrBytes, nameLen, nameBytes);
  }
  return concatUint8Arrays(new Uint8Array([0]), decodeAddress(addr));
}

function decodeAddress(addr: string): Uint8Array {
  return base32Decode(addr);
}

function base32Decode(addr: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of addr.replace(/[=\s]/g, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function decodeResult(hex: string): unknown {
  if (!hex || hex === '0x') return null;
  if (hex.startsWith('0x')) hex = hex.slice(2);
  
  if (hex.length === 64 && hex.slice(-16) === '0000000000000000') {
    return (parseInt(hex.slice(0, 16), 16)).toString();
  }
  
  return hex;
}
