import 'dotenv/config';
import { SwarmNode } from '../src/lib/swarm/protocol.js';

async function main() {
    console.log('--- Verifying Python Swarm Agent ---');

    // 1. Create TS Requester
    const requester = new SwarmNode('ts-requester', ['mgmt']);
    await requester.join();

    // 2. Setup Listener for Bids
    // We expect the Python agent to bid on 'transcode_video'
    requester.on('bid', (bid) => {
        console.log(`✅ [TS-Requester] Received bid from Python Agent: ${bid.agentId} (Score: ${bid.bidScore})`);

        // If we get a bid, success!
        // In a full test we'd wait for result, but this proves wiring.
        console.log('SUCCESS: Python SDK is talking to TypeScript SDK.');
        process.exit(0);
    });

    // 3. Broadcast Task
    console.log('[TS-Requester] Broadcasting transcode_video task...');
    const taskId = await requester.broadcastTask('transcode_video', {
        input_bucket: 'test-bucket',
        input_key: 'test-video.mp4'
    });

    // Subscribe to responses
    await requester.listenForBids(taskId);

    // Timeout
    setTimeout(() => {
        console.error('❌ Test Timed Out. Python agent did not respond. Is it running?');
        process.exit(1);
    }, 5000);
}

main();
