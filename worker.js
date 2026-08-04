import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function callOllama(endpoint, prompt) {
    if (!endpoint) return false;
    try {
        const res = await fetch(`${endpoint.replace(/\/+$/, '')}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama3', prompt: prompt, stream: false })
        });
        if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
        const data = await res.json();
        const responseText = data.response.trim().toLowerCase();
        return responseText.includes('true') || responseText.includes('yes');
    } catch (err) {
        console.error(`[Ollama Error]`, err);
        return false;
    }
}

async function processEvents() {
    try {
        // ATOMIC LOCK: Grab pending events and immediately mark them processing using a CTE
        // Note: For neon serverless HTTP, CTE updates are single-transaction atomic
        const lockedEvents = await sql`
            WITH pending_batch AS (
                SELECT id FROM file_events 
                WHERE status = 'pending'
                LIMIT 10
                FOR UPDATE SKIP LOCKED
            )
            UPDATE file_events fe
            SET status = 'processing'
            FROM pending_batch pb
            WHERE fe.id = pb.id
            RETURNING fe.*
        `;

        if (lockedEvents.length === 0) return;
        console.log(`[Worker] Atomically locked ${lockedEvents.length} events for processing.`);

        for (const event of lockedEvents) {
            // Cycle Detection (Infinite Loop Protection)
            const visited = event.visited_nodes || [];
            if (visited.includes(event.node_id)) {
                console.error(`[Worker] CYCLE DETECTED! File ${event.file_name} already visited node ${event.node_id}. Aborting.`);
                await sql`UPDATE file_events SET status = 'failed' WHERE id = ${event.id}`;
                continue;
            }
            
            // Join node properties (we do this per-event now since the CTE locked the raw events)
            const nodeData = await sql`
                SELECT sn.properties, sn.node_type, u.settings as user_settings
                FROM smart_nodes sn
                JOIN users u ON sn.owner_id = u.id
                WHERE sn.id = ${event.node_id}
            `;
            if (nodeData.length === 0) {
                await sql`UPDATE file_events SET status = 'failed' WHERE id = ${event.id}`;
                continue;
            }
            const { properties, node_type, user_settings } = nodeData[0];
            const schema = properties?.workflowSchema;

            const jobRes = await sql`
                INSERT INTO jobs (node_id, file_event_id, status)
                VALUES (${event.node_id}, ${event.id}, 'running')
                RETURNING id
            `;
            const jobId = jobRes[0].id;

            try {
                let nextNodeId = null;
                const newVisited = [...visited, event.node_id];

                if (schema?.type === 'branch') {
                    console.log(`[Worker] Executing BRANCH logic for ${event.file_name}...`);
                    const userPrompt = properties?.classification_prompt || "Is this an important file?";
                    const fullPrompt = `You are a strict routing AI. Answer only 'true' or 'false'.\nFile name: ${event.file_name}\nQuestion: ${userPrompt}`;
                    
                    let decision = false;
                    if (user_settings?.ollamaEndpoint) {
                        decision = await callOllama(user_settings.ollamaEndpoint, fullPrompt);
                    }
                    const handleId = decision ? 'true' : 'false';
                    const connections = await sql`
                        SELECT target_node_id FROM node_connections 
                        WHERE source_node_id = ${event.node_id} AND source_port = ${handleId}
                    `;
                    if (connections.length > 0) nextNodeId = connections[0].target_node_id;
                    
                } else if (schema?.type === 'merge') {
                    console.log(`[Worker] Executing MERGE logic for ${event.file_name}...`);
                    const reqCount = properties?.requiredInputsCount || 2;
                    const recentEvents = await sql`
                        SELECT count(*) as cnt FROM file_events 
                        WHERE node_id = ${event.node_id} AND created_at > NOW() - INTERVAL '1 hour'
                    `;
                    if (recentEvents[0].cnt >= reqCount) {
                        const connections = await sql`SELECT target_node_id FROM node_connections WHERE source_node_id = ${event.node_id}`;
                        if (connections.length > 0) nextNodeId = connections[0].target_node_id;
                    }
                } else if (schema?.type === 'split') {
                    console.log(`[Worker] Executing SPLIT logic for ${event.file_name}...`);
                    const isCsv = event.file_name.endsWith('.csv');
                    const numSplits = isCsv ? 3 : 1;
                    const connections = await sql`SELECT target_node_id FROM node_connections WHERE source_node_id = ${event.node_id}`;
                    if (connections.length > 0) {
                        const targetId = connections[0].target_node_id;
                        for (let i = 1; i <= numSplits; i++) {
                            const newFileName = isCsv ? `${event.file_name}_row_${i}` : event.file_name;
                            await sql`
                                INSERT INTO file_events (node_id, file_name, file_path, file_type, status, visited_nodes)
                                VALUES (${targetId}, ${newFileName}, ${event.file_path}, ${event.file_type}, 'pending', ${JSON.stringify(newVisited)}::jsonb)
                            `;
                        }
                    }
                } else {
                    console.log(`[Worker] Executing standard action for ${event.file_name}...`);
                    const connections = await sql`SELECT target_node_id FROM node_connections WHERE source_node_id = ${event.node_id}`;
                    if (connections.length > 0) nextNodeId = connections[0].target_node_id;
                }

                // Mark job complete
                await sql`UPDATE jobs SET status = 'complete', completed_at = NOW() WHERE id = ${jobId}`;
                await sql`UPDATE file_events SET status = 'processed' WHERE id = ${event.id}`;

                // Propagate file to next node if connected (except for SPLIT which handles it manually)
                if (nextNodeId && schema?.type !== 'split') {
                    await sql`
                        INSERT INTO file_events (node_id, file_name, file_path, file_type, status, visited_nodes)
                        VALUES (${nextNodeId}, ${event.file_name}, ${event.file_path}, ${event.file_type}, 'pending', ${JSON.stringify(newVisited)}::jsonb)
                    `;
                }

            } catch (err) {
                console.error(`[Worker] Job ${jobId} failed:`, err);
                await sql`UPDATE jobs SET status = 'failed' WHERE id = ${jobId}`;
                await sql`UPDATE file_events SET status = 'error' WHERE id = ${event.id}`;
            }
        }
    } catch (e) {
        console.error("[Worker] Error during polling:", e);
    }
}

setInterval(processEvents, 5000);
console.log("Worker process started with Transaction Locking and Cycle Detection.");

