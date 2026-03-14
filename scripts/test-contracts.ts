import 'dotenv/config';
import { createNetwork, STACKS_TESTNET } from '@stacks/network';
import { fetchCallReadOnlyFunction } from '@stacks/transactions';

const network = createNetwork(STACKS_TESTNET, 'https://api.testnet.hiro.so');

const CONTRACTS = [
  { address: 'ST1W1HJVNMWM5RZQ6T7DTJJCYKY64J15KGX3ED251', name: 'molbot-registry', function: 'get-total-molbots' },
  { address: 'ST1W1HJVNMWM5RZQ6T7DTJJCYKY64J15KGX3ED251', name: 'molbot-payment', function: 'get-total-payments' },
  { address: 'ST1W1HJVNMWM5RZQ6T7DTJJCYKY64J15KGX3ED251', name: 'usdcx-adapter', function: 'get-balance' },
];

async function testContract(contract: { address: string; name: string; function: string }) {
  console.log(`\n🔍 Testing ${contract.name}...`);
  
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName: contract.function,
      functionArgs: [],
      network: network,
    });
    
    console.log(`✅ ${contract.name} is responding!`);
    console.log(`   Result: ${JSON.stringify(result)}`);
    return true;
  } catch (error) {
    console.error(`❌ ${contract.name} failed:`, error);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing contract integration on testnet...\n');
  
  const results = [];
  
  for (const contract of CONTRACTS) {
    const result = await testContract(contract);
    results.push(result);
  }
  
  console.log('\n📊 Test Summary');
  console.log('===============');
  
  const passed = results.filter(r => r).length;
  console.log(`\n✅ Passed: ${passed}/${CONTRACTS.length}`);
  
  if (passed === CONTRACTS.length) {
    console.log('\n🎉 All contracts are working!');
  } else {
    console.log('\n⚠️ Some contracts need attention');
  }
}

main().catch(console.error);
