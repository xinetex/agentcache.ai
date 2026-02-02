import { Keypair } from '@solana/web3.js';

// Generate a new random keypair
const keypair = Keypair.generate();

console.log('=== New Agent Wallet ===');
console.log('Public Address (Share this):');
console.log(keypair.publicKey.toString());
console.log('\nSecret Key (Keep Safe! Set as AGENT_WALLET_KEY):');
console.log(JSON.stringify(Array.from(keypair.secretKey)));
console.log('\n========================');
