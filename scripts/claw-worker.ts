
/**
 * ClawTasks Worker: Trust Broker
 * 
 * This agent acts as a specialized worker on the ClawTasks network.
 * It listens for "verification" bounties and uses the TrustBroker service (Moonshot LLM)
 * to verify claims and earn rewards.
 */

import fetch from 'node-fetch';
import { trustBroker } from '../src/services/trust-broker.js';

const CLAW_API = 'https://clawtasks.com/api';
const POLLING_INTERVAL = 10000; // 10 seconds

// Configuration
const AGENT_NAME = 'AgentCache_TrustBroker';
// In a real scenario, we'd persist the wallet/token. For demo, we might auto-generate.
// Assuming we have an API token from environment or we register ephemerally.
const API_TOKEN = process.env.CLAW_API_TOKEN;

async function main() {
    console.log(`[ClawWorker] Starting Trust Broker Agent: ${AGENT_NAME}`);

    if (!API_TOKEN) {
        console.error('Error: CLAW_API_TOKEN environment variable is required.');
        console.error('Please register at https://clawtasks.com and get your token.');
        process.exit(1);
    }

    // 1. Update Profile (Advertise Skills)
    await updateProfile();

    // 2. Start Polling Loop
    console.log('[ClawWorker] Listening for verification bounties...');
    setInterval(pollForWork, POLLING_INTERVAL);

    // Initial poll
    await pollForWork();
}

async function updateProfile() {
    try {
        const res = await fetch(`${CLAW_API}/agents/me`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify({
                bio: "I am the Trust Broker. I verify claims, fact-check statements, and audit posts using multi-modal AI reasoning.",
                specialties: ["verification", "fact-checking", "truth", "audit", "lidar-verification"],
                available: true
            })
        });

        if (res.ok) {
            console.log('[ClawWorker] Profile updated successfully.');
        } else {
            console.error('[ClawWorker] Failed to update profile:', await res.text());
        }
    } catch (err) {
        console.error('[ClawWorker] Profile update error:', err);
    }
}

async function pollForWork() {
    try {
        // Search for open bounties matching our skills
        const url = `${CLAW_API}/bounties?status=open&skills=verification,fact-checking,truth`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        const bounties = data.bounties || [];

        if (bounties.length === 0) {
            // console.log('[ClawWorker] No work found.');
            return;
        }

        console.log(`[ClawWorker] Found ${bounties.length} potential tasks.`);

        for (const bounty of bounties) {
            await processBounty(bounty);
        }

    } catch (err) {
        console.error('[ClawWorker] Polling error:', err);
    }
}

async function processBounty(bounty) {
    console.log(`[ClawWorker] Analyzing Bounty #${bounty.id}: "${bounty.title}"`);

    // 1. Claim the bounty
    const claimRes = await fetch(`${CLAW_API}/bounties/${bounty.id}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });

    if (!claimRes.ok) {
        console.log(`[ClawWorker] Failed to claim bounty #${bounty.id} (maybe taken).`);
        return;
    }

    console.log(`[ClawWorker] Claimed Bounty #${bounty.id}. Working...`);
    const startTime = Date.now();

    try {
        // 2. Execute Work (Trust Broker Verification)
        // Assuming the bounty description contains the claim to verify.
        const claimText = bounty.description;
        const result = await trustBroker.verifyClaim(claimText);

        // 3. Submit Work
        const submitRes = await fetch(`${CLAW_API}/bounties/${bounty.id}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_TOKEN}`
            },
            body: JSON.stringify({
                result: JSON.stringify(result, null, 2),
                metadata: {
                    agent: AGENT_NAME,
                    latency_ms: Date.now() - startTime,
                    engine: "AgentCache TrustBroker v1"
                }
            })
        });

        if (submitRes.ok) {
            console.log(`[ClawWorker] SUCCESS! Submitted verification for Bounty #${bounty.id}.`);
            console.log(`[ClawWorker] Verdict: ${result.verdict} (Confidence: ${result.confidence})`);
        } else {
            console.error(`[ClawWorker] Failed to submit result:`, await submitRes.text());
        }

    } catch (err) {
        console.error(`[ClawWorker] Error processing bounty #${bounty.id}:`, err);
        // Should ideally unclaim or fail the bounty here
    }
}

// Start
main().catch(console.error);
