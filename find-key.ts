import { secp256k1 } from '@noble/curves/secp256k1';

const keys = [
  '8491da0ac2a26b85ae99113ebe801de078fe113cf5d179f480af33766934f62501',
  'dbf681ac48e826a9a2ca37c4eff951da5e21a76d32da6aa321e6c25d03ab6ff901',
  '05fe75f0058e1f7e0fba0f615b9d4d62c9762ea85db695d4891637840c7f086001',
  '753b7cc01a1a2e86221266a154af739c41dcafdb5a5f0c3e3a343712e120b270',
];

console.log('Looking for public key: 0354333265fafb5e332e92421494e93ca50143840a85d1e74b2474a45dbd9cffca');
console.log('Looking for public key: 03dd307936689d6996254c673316f3deb87c030e9de1d47fae78b3d27b7ccd44f5');
console.log('');

for (const key of keys) {
  const pubkey = secp256k1.getPublicKey(key, true);
  console.log('Private:', key.slice(0, 8) + '...');
  console.log('Public:', Buffer.from(pubkey).toString('hex'));
  console.log('');
}
