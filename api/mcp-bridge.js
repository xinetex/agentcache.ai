
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the MCP server executable
// We use 'tsx' to run the TypeScript server directly for now
const SERVER_PATH = path.resolve(__dirname, '../../mcp/server.ts');

/**
 * executeMCPRequest
 * Spawns the MCP server (or reuses a persistent one if we implemented a pool),
 * sends a JSON-RPC request to stdin, and waits for the response on stdout.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { request } = req.body; // Expecting a full JSON-RPC request object

    if (!request) {
        return res.status(400).json({ error: 'Missing request body' });
    }

    console.log('[MCP Bridge] Spawning server for request:', request.method);

    // Spawn the MCP server as a subprocess
    // In a production environment, you might want to keep a persistent process pool
    // to avoid the overhead of node startup time per request.
    const mcpProcess = spawn('npx', ['tsx', SERVER_PATH], {
        env: { ...process.env, PATH: process.env.PATH },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let outputData = '';
    let errorData = '';
    let responseSent = false;

    // Handle Stdout
    mcpProcess.stdout.on('data', (data) => {
        outputData += data.toString();
        // Check if we have a complete JSON-RPC response (usually a single line)
        try {
            const lines = outputData.trim().split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('{')) { // simplistic check
                    const response = JSON.parse(line);
                    // If it matches the ID (or we just take the first valid JSON response)
                    if (!responseSent) {
                        res.json(response);
                        responseSent = true;
                        mcpProcess.kill(); // Terminate after response
                    }
                }
            }
        } catch (e) {
            // Partial data, wait for more
        }
    });

    // Handle Stderr
    mcpProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.error('[MCP Bridge] Stderr:', data.toString());
    });

    // Handle Close
    mcpProcess.on('close', (code) => {
        if (!responseSent) {
            res.status(500).json({ error: 'MCP Server exited without response', details: errorData });
        }
    });

    // Send Request
    // Wrap in JSON-RPC 2.0 format if not already? 
    // The SDK server expects standard JSON-RPC.
    // The frontend should send { jsonrpc: "2.0", method: "tools/call", params: {...}, id: 1 }

    // BUT the @modelcontextprotocol/sdk StdioServerTransport reads line-delimited JSON.
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
}
