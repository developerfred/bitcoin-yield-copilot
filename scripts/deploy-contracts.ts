import 'dotenv/config';
import { createNetwork, STACKS_TESTNET } from '@stacks/network';
import { makeContractDeploy, broadcastTransaction, AnchorMode, PostConditionMode } from '@stacks/transactions';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const network = createNetwork(STACKS_TESTNET, 'https://api.testnet.hiro.so');

const CONTRACT_PATHS = [
  'adapter-trait-v3.clar',
  'molbot-payment.clar',
  'usdcx-adapter.clar',
];

const PRIVATE_KEY = process.env.AGENT_STACKS_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('Error: AGENT_STACKS_PRIVATE_KEY not set');
  process.exit(1);
}

async function deployContract(contractPath: string) {
  const fullPath = resolve(process.cwd(), 'contracts', contractPath);
  const contractName = contractPath.replace('.clar', '');
  
  console.log(`\n📦 Deploying ${contractName}...`);
  
  try {
    const codeBody = readFileSync(fullPath, 'utf-8');
    
    const tx = await makeContractDeploy({
      contractName,
      codeBody,
      senderKey: PRIVATE_KEY,
      network: network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    });
    
    const result = await broadcastTransaction({ transaction: tx, network: network });
    
    console.log(`✅ ${contractName} deployed!`);
    console.log(`   TX ID: ${result.txid}`);
    
    return {
      name: contractName,
      txId: result.txid,
    };
  } catch (error) {
    console.error(`❌ Failed to deploy ${contractName}:`, error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting deployment to testnet...\n');
  console.log(`Network: testnet`);
  console.log(`Deployer: Using private key from AGENT_STACKS_PRIVATE_KEY`);
  
  const deployed = [];
  
  for (const contract of CONTRACT_PATHS) {
    const result = await deployContract(contract);
    if (result) {
      deployed.push(result);
    }
  }
  
  console.log('\n📊 Deployment Summary');
  console.log('=====================');
  
  if (deployed.length > 0) {
    console.log('\n✅ Successfully deployed:');
    for (const d of deployed) {
      console.log(`   ${d.name}: TX ${d.txId}`);
    }
  } else {
    console.log('\n❌ No contracts deployed successfully');
  }
}

main().catch(console.error);
