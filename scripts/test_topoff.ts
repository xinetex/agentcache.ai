
import { ledger } from '../src/services/LedgerService.js';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    console.log("🔋 Testing Auto-Top-Off Logic...");

    const agentId = uuidv4();

    // 1. Create Account with Low Balance ($5)
    await ledger.createAccount(agentId, 'agent', 5.0);
    let acc = await ledger.getAccount(agentId);
    console.log(`Initial Balance: $${acc.balance}`);

    // 2. Check Top Off (Threshold $10, TopUp $50)
    // Should trigger because $5 < $10
    console.log("Checking Top-Off...");
    const triggered = await ledger.checkAutoTopOff(agentId, 10.0, 50.0);

    // 3. Verify
    if (triggered) {
        acc = await ledger.getAccount(agentId);
        console.log(`✅ Top-Off Triggered. New Balance: $${acc.balance}`);

        if (acc.balance >= 55.0) {
            console.log("TEST PASSED: Balance updated correctly.");
        } else {
            console.error("TEST FAILED: Balance did not increase expected amount.");
        }
    } else {
        console.error("TEST FAILED: Top-Off did not trigger.");
    }
}

main().catch(console.error);
