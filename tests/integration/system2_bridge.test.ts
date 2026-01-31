
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import fetch from 'node-fetch';

const SHOULD_RUN = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = SHOULD_RUN ? describe : describe.skip;

describeIntegration('System 2 Bridge Integration', () => {
    let pythonServer;
    const PORT = 8085;

    beforeAll(async () => {
        // Start the Python server
        console.log('Starting Python System 2 Service...');
        pythonServer = spawn('python3', ['src/services/system2/server.py']);

        pythonServer.stdout.on('data', (data) => console.log(`[Python]: ${data}`));
        pythonServer.stderr.on('data', (data) => console.error(`[Python Error]: ${data}`));
        pythonServer.on('error', (err) => console.error('[Python Spawn Error]:', err));

        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
    });

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
