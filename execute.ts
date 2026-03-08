import { serializeCV, principalCV } from '@stacks/transactions';

// At the beginning of withdrawStx, before any hash:
const testAddr = 'STDCND8M9A694V0ARTZTHKSYHE58523BPTRT114D';

const [ver, h160hex] = c32addressDecode(testAddr);
const h160 = Buffer.from(h160hex, 'hex');

// Method 1: your principalToConsensusBytes
const method1 = Buffer.alloc(22);
method1[0] = 0x05;
method1[1] = ver;
h160.copy(method1, 2);
console.log(`[TEST] method1 (manual):  ${method1.toString('hex')}`);
console.log(`[TEST] method1 hash:      ${createHash('sha256').update(method1).digest().toString('hex')}`);

// Method 2: serializeCV
const method2 = Buffer.from(serializeCV(principalCV(testAddr)));
console.log(`[TEST] method2 (serializeCV): ${method2.toString('hex')}`);
console.log(`[TEST] method2 hash:          ${createHash('sha256').update(method2).digest().toString('hex')}`);