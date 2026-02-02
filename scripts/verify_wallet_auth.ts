
import fetch from 'node-fetch';

async function main() {
    console.log("🔐 Verifying Wallet Authentication...");

    const BASE_URL = 'http://localhost:3000'; // Assuming server is running, or we mock the handler call if not.
    // Since we usually run "scripts/" against a live dev server or we need to spin one up.
    // If no server, we can mock the fetch calls or import the handler directly?
    // Importing handler directly is safer for "unit test" style in this env.

    // Let's actually assume we generally run these against the deployed/running instance.
    // If localhost:3000 isn't up, this fails. 
    // Given previous steps used 'curl' and failed, I should probably use a direct handler test or mock the network.

    // But wait, in previous steps I successfully ran 'verify_risk_intel.ts'. How?
    // Ah, that was importing the Service class directly.
    // This is an API endpoint (Next.js/Vercel function). 

    // I will try to use the handler directly by mocking req/res objects.
    // This is robust against server downtime.

    // @ts-ignore
    const handler = (await import('../api/auth/wallet.js')).default;

    const mockRes = () => {
        const res: any = {};
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (data) => {
            res.data = data;
            return res;
        };
        res.setHeader = () => { };
        res.end = () => { };
        return res;
    };

    // 1. Get Nonce
    console.log("\n1. Requesting Nonce...");
    const req1 = {
        method: 'POST',
        url: '/api/auth/nonce',
        body: { address: '0x123ExampleWalletAddress' }
    };
    const res1 = mockRes();

    await handler(req1, res1);
    console.log(`Status: ${res1.statusCode}`);
    console.log(`Nonce: ${res1.data?.nonce}`);

    if (res1.statusCode !== 200 || !res1.data.nonce) {
        console.error("❌ Failed to get nonce");
        return;
    }

    // 2. Login
    console.log("\n2. Logging in with Signature...");
    const req2 = {
        method: 'POST',
        url: '/api/auth/wallet-login',
        body: {
            address: '0x123ExampleWalletAddress',
            nonce: res1.data.nonce,
            signature: '0xMockSignature'
        }
    };
    const res2 = mockRes();

    // Mock DB Call inside handler? 
    // The handler uses 'neon'. If credentials fail, it might crash.
    // We rely on the fact that existing code usually runs ok with MockRedis but DB is harder.
    // If DB fails (likely), we'll see it.

    try {
        await handler(req2, res2);
        console.log(`Status: ${res2.statusCode}`);
        console.log(`User ID: ${res2.data?.user?.id}`);
        console.log(`Token: ${res2.data?.token ? 'JWT_PRESENT' : 'MISSING'}`);

        if (res2.statusCode === 200 && res2.data.token) {
            console.log("✅ SUCCESS: Wallet Login verified (User Auto-Created + JWT Issued).");
        } else {
            console.log("❌ FAILURE: Login failed.");
            console.log(res2.data);
        }
    } catch (e) {
        console.error("❌ Crash during Login:", e);
    }
}

main().catch(console.error);
