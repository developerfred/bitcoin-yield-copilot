# gaia-storage

> Gaia Storage - Decentralized Storage for Stacks Applications

## Overview

Gaia is Stacks' decentralized storage system. It provides high-performance storage for user data while maintaining the security model of Bitcoin.

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌─────────────────┐
│  User       │────▶│  App     │────▶│  Gaia Hub       │
│  Browser    │     │  Server  │     │  (Decentralized)│
└─────────────┘     └──────────┘     └─────────────────┘
                           │                  │
                           ▼                  ▼
                    ┌──────────┐     ┌─────────────────┐
                    │  Data    │     │  Bitcoin        │
                    │  Not     │     │  Anchored       │
                    │  Needed  │     │  Root Hash      │
                    └──────────┘     └─────────────────┘
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| Gaia Hub | Storage provider (can be self-hosted or service) |
| Bucket | User's storage namespace |
| Data store | JSON file in bucket |
| Authentication |wallet-based (BNS or signed token) |

## Gaia for VibeStamp

### Use Cases

| Use Case | Gaia Storage | On-Chain |
|----------|--------------|----------|
| Stamp metadata | ✅ Large descriptions | ❌ 500 char limit |
| Project screenshots | ✅ Images | ❌ Expensive |
| Certificate images | ✅ PNG generation | ❌ Not practical |
| Search index | ✅ Full text | ❌ Not needed |

### Storage Costs

```
On-Chain (Clarity): ~$0.0001/transaction
Gaia Storage:       ~$0.001/GB/month
```

## Integration with Frontend

### Using @stacks/storage

```typescript
import { putFile, getFile, deleteFile } from '@stacks/storage';

const gaiaHubUrl = 'https://hub.gaia.blockstack.org/hub';

// Store project metadata
async function storeProjectMetadata(project: Project) {
  const metadata = JSON.stringify(project);
  
  await putFile(`${userAddress}/projects/${project.id}.json`, metadata, {
    encrypt: false,  // Public data
    hubUrl: gaiaHubUrl
  });
}

// Retrieve metadata
async function getProjectMetadata(projectId: string) {
  const data = await getFile(`projects/${projectId}.json`, {
    hubUrl: gaiaHubUrl
  });
  
  return JSON.parse(data);
}
```

### With Wallet Authentication

```typescript
import { openSignStructuredDataToken } from '@stacks/connect';

async function authenticateWithGaia() {
  // Generate authentication token
  const token = await openSignStructuredDataToken({
    domain: 'vibestamp.xyz',
    statement: 'Sign in to VibeStamp',
    publicKey: userData.profile.publicKey
  });
  
  // Use token for Gaia requests
  return token;
}
```

## Storing NFT Metadata

### Certificate JSON

```typescript
interface CertificateMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
}

async function uploadCertificateMetadata(cert: Certificate): Promise<string> {
  const metadata: CertificateMetadata = {
    name: `VibeStamp #${cert.id}`,
    description: `Proof of authorship for ${cert.projectName}`,
    image: `https://vibestamp.xyz/certificates/${cert.id}.png`,
    external_url: `https://vibestamp.xyz/verify/${cert.hash}`,
    attributes: [
      { trait_type: 'Project', value: cert.projectName },
      { trait_type: 'Block', value: cert.blockHeight },
      { trait_type: 'Timestamp', value: cert.timestamp }
    ]
  };
  
  const uri = `certificates/${cert.id}.json`;
  await putFile(uri, JSON.stringify(metadata), { encrypt: false });
  
  return `https://gaia.gaiablockstack.org/${userAddress}/${uri}`;
}
```

### Certificate Image Generation

```typescript
// Generate certificate image server-side
async function generateCertificateImage(cert: Certificate): Promise<Blob> {
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 800, 600);
  
  // Certificate content
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('VibeStamp', 400, 100);
  
  ctx.font = '32px Inter';
  ctx.fillText(cert.projectName, 400, 180);
  
  ctx.font = '24px Inter';
  ctx.fillText(`Block: #${cert.blockHeight}`, 400, 400);
  ctx.fillText(`Hash: ${cert.hash.slice(0, 16)}...`, 400, 450);
  
  return canvas.toBlob('image/png');
}

async function uploadCertificateImage(cert: Certificate): Promise<string> {
  const blob = await generateCertificateImage(cert);
  await putFile(`certificates/${cert.id}.png`, blob, { encrypt: false });
  return gaiaUrl;
}
```

## Gaia Hub Configuration

### Self-Hosted (Advanced)

```yaml
# gaia-hub-config.json
{
  "serverName": "my-gaia-hub",
  "version": "1.0.0",
  "bucket": "vibestamp",
  "drives": [
    {
      "class": "aws",
      "aws": {
        "endpoint": "s3.amazonaws.com",
        "bucket": "my-vibestamp-bucket"
      }
    }
  ],
  "proofsConfig": {
    "proofsRequired": 0
  }
}
```

### Using Existing Providers

| Provider | Hub URL |
|----------|---------|
| Blockstack Gaia | https://hub.gaia.blockstack.org/hub |
| Dots | https://gaia.hub.textile.io/hub |
| Self-hosted | Custom |

## Reading Data Without Wallet

### Public Data

```typescript
// Public data accessible without authentication
async function fetchPublicData(gaiaUrl: string) {
  const response = await fetch(gaiaUrl);
  return response.json();
}

// Example: fetch certificate metadata
const certMetadata = await fetchPublicData(
  'https://gaia.gaiablockstack.org/ST1XXX/certificates/1.json'
);
```

## Data Structure

### VibeStamp Data Model

```typescript
interface UserData {
  // Bucket: {address}/
  profile: {
    name: string;
    avatar?: string;
  };
  
  // Bucket: {address}/projects/
  projects: {
    [id: string]: {
      name: string;
      url: string;
      description: string;
      createdAt: number;
      stamps: string[]; // hash IDs
    }
  };
  
  // Bucket: {address}/certificates/
  certificates: {
    [id: string]: {
      hash: string;
      tokenId: number;
      mintedAt: number;
    }
  };
}
```

## Comparison: On-Chain vs Gaia

| Aspect | On-Chain (Clarity) | Gaia Storage |
|--------|-------------------|--------------|
| Cost | ~$0.01/transaction | ~$0.001/GB/month |
| Permanence | Forever | Until hub exists |
| Accessibility | Anyone | Anyone with URL |
| Query Speed | Slow (blockchain) | Fast (CDN) |
| Data Size | Limited (<1MB) | Unlimited |
| Updates | Difficult | Easy |

## Best Practices

### What to Store On-Chain

- Hashes (SHA-256)
- Timestamps (block-height)
- Ownership (principals)
- Critical references (Gaia URLs)

### What to Store in Gaia

- Full project descriptions
- Images/screenshots
- Certificate art
- Search indexes
- User preferences

### Security

```typescript
// Encrypt sensitive data
import { encryptContent, decryptContent } from '@stacks/encryption';

const privateData = { notes: 'secret info' };

// Encrypt before upload
const encrypted = await encryptContent(privateData, {
  publicKey: ownerPublicKey
});
await putFile('private/data.json', encrypted);

// Decrypt after download
const decrypted = await decryptContent(encrypted, {
  privateKey: ownerPrivateKey
});
```

## VibeStamp Storage Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    VibeStamp Data                       │
├─────────────────────┬───────────────────────────────────┤
│  On-Chain           │  Gaia Storage                     │
│  - hash             │  - Full descriptions              │
│  - owner            │  - Project images                 │
│  - block-height     │  - Certificate PNGs               │
│  - name (100char)   │  - Rich metadata JSON            │
│  - url (200char)    │                                   │
│  - desc (500char)  │                                   │
└─────────────────────┴───────────────────────────────────┘
```

## Related Skills

- clarity-contracts: Contract implementation
- vibestamp-frontend: Frontend integration
- sip-standards: NFT metadata
