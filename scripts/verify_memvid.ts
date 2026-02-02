
import 'dotenv/config';
import { memvidService } from '../src/services/MemvidService.js';
import fs from 'fs';
import path from 'path';

async function main() {
    console.log("📼 Verifying Memvid Integration...");

    // 1. Prepare Data
    const knowledge = [
        {
            title: "AgentCache Manifesto",
            text: "AgentCache is a decentralized economy where AI agents trade knowledge, services, and compute power using a double-entry ledger system.",
            tags: ["manifesto", "core"]
        },
        {
            title: "Memvid Technology",
            text: "Memvid is a single-file memory format (.mv2) that uses video codecs to compress semantic data, enabling portable knowledge for agents.",
            tags: ["tech", "storage"]
        }
    ];

    // 2. Create Pack
    const packName = "verify_test_pack";
    // Clean up old run
    const storageDir = path.resolve('storage_blobs');
    const oldFile = path.join(storageDir, `${packName}.mv2`);
    if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);

    console.log("Step 1: Minting Knowledge Pack...");
    const filePath = await memvidService.createKnowledgePack(packName, knowledge);
    console.log(`✅ Pack Created: ${filePath}`);

    // 3. Query Pack
    console.log("\nStep 2: Querying 'What is AgentCache?'...");
    const answer = await memvidService.queryKnowledgePack(filePath, "What is AgentCache?");

    console.log("\n--- ANSWER ---");
    console.log(answer);
    console.log("--------------\n");

    console.log("Step 3: Querying 'What is Memvid?'...");
    const answer2 = await memvidService.queryKnowledgePack(filePath, "What is Memvid?");
    console.log(`Answer: ${answer2}`);
}

main().catch(console.error);
