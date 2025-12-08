
import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'https://agentcache.ai/api';
const ADMIN_EMAIL = 'admin@agentcache.ai';
const ADMIN_PASS = 'AdminPassword123!';

// Simple sleep helper
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function attemptLogin(role: string, email: string, pass: string) {
    process.stdout.write(`⏳ [${role}] Logging in as ${email}... `);

    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });

        if (res.status === 200) {
            const data = await res.json();
            console.log("✅ SUCCESS");
            console.log(`   Basic Info: ID=${data.user.id}, Role=${data.user.role}`);
            return true;
        } else {
            // Try to parse error
            let errText = res.statusText;
            try {
                const errJson = await res.json();
                errText = errJson.error || errJson.message || errText;
            } catch (e) { }

            console.log(`❌ FAILED (${res.status}): ${errText}`);
            return false;
        }
    } catch (e: any) {
        console.log(`💥 NETWORK ERROR: ${e.message}`);
        return false;
    }
}

async function registerTestUser() {
    const timestamp = Date.now();
    const email = `testuser_${timestamp}@agentcache.ai`;
    const password = `UserPass${timestamp}!`;
    const name = `Test User ${timestamp}`;

    console.log(`\n🆕 Creating new Regular User: ${email}`);

    try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });

        if (res.status === 200) {
            console.log("   ✅ Registration Successful");
            return { email, password };
        } else {
            console.log(`   ❌ Registration Failed (${res.status})`);
            return null;
        }
    } catch (e) {
        console.log(`   💥 Registration/Network Error`);
        return null;
    }
}

async function run() {
    console.log(`🚀 Starting Login Polling Script`);
    console.log(`   Target: ${BASE_URL}`);
    console.log(`   -------------------------------------------`);

    // 1. Loop Admin
    let adminSuccess = false;
    while (!adminSuccess) {
        adminSuccess = await attemptLogin('ADMIN', ADMIN_EMAIL, ADMIN_PASS);
        if (!adminSuccess) {
            await sleep(2000); // Wait 2s before retry
        }
    }

    console.log(`\n🎉 Admin Login Verified! Proceeding to Regular User test...\n`);

    // 2. Loop Regular User
    // First, we need a user. We'll try to register one. 
    // If registration fails (e.g. server error), we retry registration loop?
    // User request was "do the same with a regular user" -> implied login.
    // I'll assume we register once successfully, then login loop.

    let testUser = null;
    while (!testUser) {
        testUser = await registerTestUser();
        if (!testUser) await sleep(2000);
    }

    let userSuccess = false;
    while (!userSuccess) {
        userSuccess = await attemptLogin('USER', testUser.email, testUser.password);
        if (!userSuccess) {
            await sleep(2000);
        }
    }

    console.log(`\n✨ ALL SYSTEMS GO. Admin and User login verified.`);
    process.exit(0);
}

run();
