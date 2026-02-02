import 'dotenv/config'; // Load .env
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load .env.local override

import { trustBroker } from '../src/services/trust-broker.js';

async function testBroker() {
    console.log("=== Testing Trust Broker (System 2) ===");

    // Test Case 1: False Claim
    const falseClaim = "The moon is made of solid green cheese and was built by aliens in 1950.";
    console.log(`\n[1] Testing FALSE Claim: "${falseClaim}"`);
    const result1 = await trustBroker.verifyClaim(falseClaim);
    console.log("Result:", JSON.stringify(result1, null, 2));

    // Test Case 2: True Claim
    const trueClaim = "Water molecules consist of two hydrogen atoms and one oxygen atom.";
    console.log(`\n[2] Testing TRUE Claim: "${trueClaim}"`);
    const result2 = await trustBroker.verifyClaim(trueClaim);
    console.log("Result:", JSON.stringify(result2, null, 2));
}

testBroker().catch(console.error);
