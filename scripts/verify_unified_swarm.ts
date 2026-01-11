import 'dotenv/config';
import { SwarmNode } from '../src/lib/swarm/protocol.js';

async function main() {
    console.log('--- 🌍 Grand Unified Swarm Test ---');
    console.log('🔑 SWARM_SECRET_KEY:', process.env.SWARM_SECRET_KEY ? '******' : 'NOT SET (using default)');

    const requester = new SwarmNode('monitor-agent', ['mgmt']);
    await requester.join();

    let pythonFound = false;
    let adNetworkFound = false;

    // Listen for activity
    requester.on('bid', (bid) => {
        console.log(`🤑 Bid received! Task: ${bid.taskId.substring(0, 8)}... Agent: ${bid.agentId} Score: ${bid.bidScore}`);

        if (bid.agentId.includes('transcoder')) {
            console.log('✅ Python Transcoder is ALIVE and BIDDING.');
            pythonFound = true;
        }
        if (bid.agentId.includes('ad-network')) {
            console.log('✅ Ad Network is ALIVE and BIDDING.');
            adNetworkFound = true;
        }

        checkSuccess();
    });

    requester.on('result', (res) => {
        console.log(`📦 Result received! Task: ${res.taskId.substring(0, 8)}... Agent: ${res.agentId} Status: ${res.status}`);
    });

    // 1. Trigger Transcoder (Python)
    console.log('\n[1] 🎬 Broadcasting "transcode_video" task...');
    const t1 = await requester.broadcastTask('transcode_video', { file: 's3://bucket/test.mp4' });
    await requester.listenForBids(t1);

    // 2. Trigger Ad Network (Node.js)
    console.log('\n[2] 📢 Broadcasting "serve_ad" task...');
    const t2 = await requester.broadcastTask('serve_ad', { context: 'homepage' });
    await requester.listenForBids(t2);

    function checkSuccess() {
        if (pythonFound && adNetworkFound) {
            console.log('\n✨✨✨ SUCCESS! The Entire Ecosystem is Connected! ✨✨✨');
            process.exit(0);
        }
    }

    // Timeout
    setTimeout(() => {
        console.log('\n⏰ Timeout waiting for agents.');
        if (!pythonFound) console.log('❌ Python Transcoder did not respond.');
        if (!adNetworkFound) console.log('❌ Ad Network did not respond.');
        process.exit(1);
    }, 5000);
}

main();
