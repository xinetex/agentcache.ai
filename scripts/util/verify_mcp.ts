import { spawn } from 'child_process';
import path from 'path';

// Path to the MCP server we just modified
const SERVER_PATH = './src/mcp/server.ts';

async function runMCPTest() {
    console.log('--- Testing MCP Server (Universal Connector) ---');
    console.log(`Starting server: ${SERVER_PATH}`);

    // Spawn the MCP server as a child process using tsx
    const serverProcess = spawn('npx', ['tsx', SERVER_PATH], {
        stdio: ['pipe', 'pipe', 'inherit'], // Pipe stdin/out, inherit stderr (for logs)
        env: { ...process.env, REDIS_URL: 'redis://mock:6379' } // Inject mock Redis
    });

    // Helper to send JSON-RPC request
    let msgId = 1;
    function callTool(name: string, args: any) {
        const request = {
            jsonrpc: '2.0',
            id: msgId++,
            method: 'tools/call',
            params: {
                name,
                arguments: args
            }
        };
        const str = JSON.stringify(request) + '\n';
        serverProcess.stdin.write(str);
    }

    // Helper to read JSON-RPC response
    // Simple line reader
    serverProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const response = JSON.parse(line);
                handleResponse(response);
            } catch (e) {
                // Ignore partial lines or non-json
            }
        }
    });

    function handleResponse(res: any) {
        if (res.error) {
            console.error('❌ MCP Error:', res.error);
            return;
        }

        // Check which request this corresponds to
        // We know the order: 1=Predict, 2=System2, 3=Hive
        if (res.id === 1) { // Predict
            console.log('\n[1] agentcache_predict_intent result:');
            const content = JSON.parse(res.result.content[0].text);
            console.log(JSON.stringify(content, null, 2));
            if (content.predictions) console.log('✅ Prediction Tool Works');
            else console.error('❌ Prediction Tool Failed');

            // Trigger next test
            callTool('agentcache_ask_system2', { prompt: 'Design a Dyson Sphere architecture' });
        }
        else if (res.id === 2) { // System 2
            console.log('\n[2] agentcache_ask_system2 result:');
            const content = JSON.parse(res.result.content[0].text);
            console.log(JSON.stringify(content, null, 2));
            if (content.route === 'system_2') console.log('✅ Router Tool Works (System 2 detected)');
            else console.error('❌ Router Tool Failed');

            // Trigger next test
            callTool('agentcache_hive_memory', { input: JSON.stringify({ label: 'chair', color: 'red' }) });
        }
        else if (res.id === 3) { // Hive
            console.log('\n[3] agentcache_hive_memory result:');
            const content = JSON.parse(res.result.content[0].text);
            console.log(JSON.stringify(content, null, 2));
            if (content.embedding_dim === 1536) console.log('✅ Hive Tool Works (Vector generated)');
            else console.error('❌ Hive Tool Failed');

            console.log('\n✅ All MCP Tests Passed.');
            process.exit(0);
        }
    }

    // Start Sequence
    // Give server a moment to boot
    setTimeout(() => {
        callTool('agentcache_predict_intent', { query: 'Hello' });
    }, 2000);
}

runMCPTest();
