
import { spawn } from 'child_process';
import fetch from 'node-fetch'; // Assuming node context, but might need global fetch if running with ts-node/modern node

// Start the server or assume it is running?
// Let's assume the user is running the dev server, or we can try to require the API file directly (hard with Hono structure).
// Best approach: Just make a fetch call to expected local port 3001 (based on index.ts defaults)

async function verifySentry() {
    console.log('🛡️ Verifying Shodan Sentry Agent...');

    const API_URL = 'http://localhost:3000'; // Or 3001? Task history showed 3001 in seed script

    // 1. Configure IPs (using a known safe public IP like Google DNS or Cloudflare just for test)
    // Cloudflare DNS: 1.1.1.1 (Safe to query)
    const testIP = '1.1.1.1';
    console.log(`\nTesting /api/sentry/check with IP: ${testIP}`);

    try {
        const response = await fetch(`${API_URL}/api/sentry/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ips: [testIP] })
        });

        const data = await response.json();

        if (response.status === 200 && data.success) {
            console.log('✅ API Request Successful');
            console.log(`checked: ${data.targetsChecked}`);
            console.log(`status:  ${data.status}`);

            if (data.alerts && data.alerts.length > 0) {
                console.log('\n⚠️ Alerts Found (Expected for public IPs like 1.1.1.1):');
                data.alerts.forEach((alert: any) => {
                    console.log(`- [${alert.level}] ${alert.message}`);
                });
            } else {
                console.log('\n✅ No alerts found (Secure)');
            }
        } else {
            console.error('❌ API Request Failed:', data);
        }

    } catch (error) {
        console.error('❌ Network Error (Is server running?):', error);
        console.log('Suggestion: Run `npm run dev` in another terminal.');
    }
}

verifySentry();
