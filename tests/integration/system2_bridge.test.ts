
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'child_process';
import net from 'node:net';
import fetch from 'node-fetch';

async function canBindLocalPort(): Promise<boolean> {
    return await new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', () => {
            resolve(false);
        });

        server.listen(0, '127.0.0.1', () => {
            server.close(() => resolve(true));
        });
    });
}

const pythonCheck = spawnSync('python3', ['--version'], { encoding: 'utf8' });
const bindCheck = await canBindLocalPort();
const SHOULD_RUN = pythonCheck.status === 0 && bindCheck && process.env.SKIP_SYSTEM2_BRIDGE_TEST !== 'true';
const describeIntegration = SHOULD_RUN ? describe : describe.skip;

async function waitForSystem2(port: number, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(`http://localhost:${port}/reason`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'healthcheck' }),
            });

            if (response.status === 200) {
                return;
            }
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
    }

    throw new Error(`System 2 service did not become ready in time. ${lastError ? String(lastError) : ''}`.trim());
}

describeIntegration('System 2 Bridge Integration', () => {
    let pythonServer: ReturnType<typeof spawn> | undefined;
    const PORT = 8085;

    beforeAll(async () => {
        // Start the Python server
        console.log('Starting Python System 2 Service...');
        pythonServer = spawn('python3', ['src/services/system2/server.py']);

        pythonServer.stdout.on('data', (data) => console.log(`[Python]: ${data}`));
        pythonServer.stderr.on('data', (data) => console.error(`[Python Error]: ${data}`));
        pythonServer.on('error', (err) => console.error('[Python Spawn Error]:', err));

        await waitForSystem2(PORT, 5000);
    }, 10000);

    afterAll(() => {
        if (pythonServer) {
            console.log('Stopping Python Service...');
            pythonServer.kill();
        }
    });

    it('should receive a reasoned response from the Python microservice', async () => {
        const response = await fetch(`http://localhost:${PORT}/reason`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'Solve the Riemann Hypothesis using AoT.' })
        });

        expect(response.status).toBe(200);

        const data = await response.json() as any;

        expect(data.status).toBe('success');
        expect(data.engine).toContain('Atom of Thoughts');
        expect(data.trace).toHaveLength(3); // Decomposition, Reasoning, Contraction
        expect(data.trace[0].atomic_state).toBe('analyzing_complexity');
    });
});
