
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

async function main() {
    console.log("⚙️ Verifying User Settings & Auth...");

    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL missing");
        process.exit(1);
    }

    // 0. Get a real user ID for testing
    const sql = neon(process.env.DATABASE_URL);
    const users = await sql`SELECT id, email FROM users LIMIT 1`;

    if (users.length === 0) {
        console.error("❌ No users found in DB. Please run logic to create a user first (e.g. login).");
        // Create a temporary user if none exist?
        console.log("Creating temporary test user...");
        const newUser = await sql`
            INSERT INTO users (email, password_hash, name) 
            VALUES ('test_settings@example.com', 'hash', 'Settings Tester')
            RETURNING id, email
        `;
        users.push(newUser[0]);
    }

    const validUser = users[0];
    console.log(`Using Test User: ${validUser.email} (${validUser.id})`);

    // 1. Generate Mock Token
    const token = jwt.sign(
        { id: validUser.id, email: validUser.email },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    );

    // Mock Handler imports because server might not be running on port
    const settingsHandler = (await import('../api/user/settings.js')).default;
    const authHandler = (await import('../api/auth/actions.js')).default;

    const mockRes = () => {
        const res: any = {};
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (data) => { res.data = data; return res; };
        res.setHeader = () => { };
        res.end = () => { };
        return res;
    };

    // --- TEST 1: PUT Settings ---
    console.log("\n1. Saving Settings...");
    const payload = {
        themePref: 'dark',
        notificationsEnabled: false,
        sectorConfig: {
            robotics: { unit: 'imperial' }, // Changing default
            finance: { riskTolerance: 'aggressive' }
        }
    };

    const req1 = {
        method: 'PUT',
        url: '/api/user/settings',
        headers: { authorization: `Bearer ${token}` },
        body: payload
    };
    const res1 = mockRes();

    await settingsHandler(req1, res1);

    if (res1.statusCode !== 200) {
        console.error("❌ Save Failed:", res1.data);
    } else {
        console.log("✅ Settings Saved.");
    }

    // --- TEST 2: GET Settings ---
    console.log("\n2. Fetching Settings...");
    const req2 = {
        method: 'GET',
        url: '/api/user/settings',
        headers: { authorization: `Bearer ${token}` }
    };
    const res2 = mockRes();

    await settingsHandler(req2, res2);
    const data = res2.data;

    console.log("Config:", JSON.stringify(data, null, 2));

    if (data.themePref === 'dark' && data.sectorConfig.robotics.unit === 'imperial') {
        console.log("✅ Persistence Verified.");
    } else {
        console.error("❌ Persistence Mismatch.");
    }

    // --- TEST 3: Forgot Password ---
    console.log("\n3. Testing Forgot Password...");
    const req3 = {
        method: 'POST',
        url: '/api/auth/forgot-password',
        body: { email: validUser.email }
    };
    const res3 = mockRes();
    await authHandler(req3, res3);

    if (res3.statusCode === 200) {
        console.log("✅ Forgot Password Triggered.");
    } else {
        console.error("❌ Forgot Password Failed.");
    }
}

main().catch(console.error);
