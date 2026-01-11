import 'dotenv/config';
import { SwarmNode } from '../src/lib/swarm/protocol.js';

async function main() {
    console.log('--- Verifying Swarm Wiring (Pub/Sub) ---');

    // 1. Create Agents
    const requester = new SwarmNode('requester-agent', ['mgmt']);
    const worker = new SwarmNode('worker-agent', ['coding']);

    // 2. Join Swarm
    await requester.join();
    await worker.join();

    // 3. Setup Listeners
    worker.on('task', (task) => {
        console.log(`[Worker] Received task: ${task.type}`);
        // Worker bids immediately
        worker.bidForTask(task.id, 0.99);
    });

    requester.on('bid', (bid) => {
        console.log(`[Requester] Received bid from ${bid.agentId} with score ${bid.bidScore}`);
        process.exit(0); // Success!
    });

    // 4. Broadcast Task
    console.log('[Requester] Broadcasting task...');
    const taskId = await requester.broadcastTask('code_gen', { prompt: 'Hello World' });

    // Requester needs to listen for bids on this specific task
    await requester.listenForBids(taskId);

    // Timeout if fails
    setTimeout(() => {
        console.error('❌ Test Timed Out. Wiring failed.');
        process.exit(1);
    }, 2000);
}

main();
