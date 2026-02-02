
/**
 * ClawTasks Bounty Explorer
 * Lists currently active bounties to help study the market.
 */

import fetch from 'node-fetch';

const CLAW_API = 'https://clawtasks.com/api';

async function main() {
    console.log(`\n🔎 ClawTasks Bounty Explorer\n`);

    try {
        const res = await fetch(`${CLAW_API}/bounties?status=open`);
        if (!res.ok) {
            throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const bounties = data.bounties || [];

        if (bounties.length === 0) {
            console.log('No open bounties found.');
            return;
        }

        console.log(`Found ${bounties.length} active bounties:\n`);
        console.log('ID    | REWARD  | TITLE');
        console.log('------------------------------------------------------------');

        bounties.slice(0, 15).forEach(b => {
            const reward = `${b.amount} USDC`.padEnd(8);
            const title = b.title.length > 50 ? b.title.substring(0, 47) + '...' : b.title;
            console.log(`${b.id.toString().padEnd(5)} | ${reward} | ${title}`);
        });

        if (bounties.length > 15) {
            console.log(`\n...and ${bounties.length - 15} more.`);
        }

    } catch (err) {
        console.error('Failed to list bounties:', err.message);
    }
}

main();
