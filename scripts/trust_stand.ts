import { trustBroker } from '../src/services/trust-broker.js';
import readline from 'readline';

// The "Menu"
const MENU = `
 🌭  Welcome to the TRUST STAND!  🌭
=====================================
 "Get your fresh, hot Truths here!"
 
 [1] The "Basic Dog" (Quick Verify)  - 1 Credit
 [2] The "Works" (Deep Reasoning)    - 5 Credits
 [3] "Sample Platter" (Run Demos)    - Free
 [4] Close Up Shop
=====================================
`;

// ASCII Art for serving
const SERVED_ART = `
      _
    C( )
     | |    <-- Here is your Truth!
    /___\
`;

async function openStand() {
    console.clear();
    console.log(MENU);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const ask = (q: string) => new Promise<string>(r => rl.question(q, r));

    while (true) {
        const choice = await ask('\nWhat are you hungry for? (1-4): ');

        if (choice === '4') {
            console.log('👋 Closing up! See ya!');
            rl.close();
            process.exit(0);
        }

        if (choice === '3') {
            console.log('\n🧑‍🍳 Whiping up some samples...');
            const samples = [
                "The sky is green.",
                "Solana is faster than Ethereum.",
                "Bancache is a decentralized bank."
            ];
            for (const s of samples) {
                console.log(`\nCustomer asks: "${s}"`);
                const result = await trustBroker.verifyClaim(s);
                console.log(`Veridct: ${result.verdict} (${Math.round(result.confidence * 100)}% sure)`);
            }
            continue;
        }

        if (choice === '1' || choice === '2') {
            const claim = await ask('\n🗣️  What\'s the rumor/claim? ');
            console.log('\n🔥 Grilling that up for you (System 2 Reasoning)...');

            const start = Date.now();
            const result = await trustBroker.verifyClaim(claim);
            const time = ((Date.now() - start) / 1000).toFixed(1);

            console.log(SERVED_ART);
            console.log(`\n🧾 RECEIPT:`);
            console.log(`--------------------------------`);
            console.log(`Claim:  "${claim}"`);
            console.log(`Verdict: ${result.verdict === 'TRUE' ? '✅ TRUE' : result.verdict === 'FALSE' ? '❌ FALSE' : '❓ UNCERTAIN'}`);
            console.log(`Confid:  ${Math.round(result.confidence * 100)}%`);
            console.log(`Cook Time: ${time}s`);
            console.log(`--------------------------------`);
            console.log(`Reasoning: ${result.reasoning}`);
            console.log(`--------------------------------`);
        }
    }
}

// Start user loop
openStand().catch(console.error);
