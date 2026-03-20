
import { spawn } from 'child_process';
import path from 'path';

/**
 * Verification Script for AgentCache CLI
 * Spawns the `bin/ac` executable and verifies output.
 */

async function runCommand(args: string[]): Promise<{ stdout: string, stderr: string, code: number | null }> {
    return new Promise((resolve, reject) => {
        const cliPath = path.resolve(process.cwd(), 'bin/ac');
        const child = spawn(cliPath, args, { cwd: process.cwd() });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());

        child.on('close', (code) => {
            resolve({ stdout, stderr, code });
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`❌ Assertion Failed: ${message}`);
    }
    console.log(`✅ ${message}`);
}

async function verify() {
    console.log('🧪 Verifying AgentCache CLI...\n');

    // 1. Test "help" command
    console.log('Test 1: "help" command');
    const help = await runCommand(['help']);
    assert(help.code === 0, 'Exit code should be 0');
    assert(help.stdout.includes('AgentCache CLI'), 'Output should contain title');
    assert(help.stdout.includes('init'), 'Output should contain init command');
    assert(help.stdout.includes('status'), 'Output should contain status command');

    // 2. Test "status" command
    console.log('\nTest 2: "status" command');
    const status = await runCommand(['status']);
    assert(status.code === 0, 'Exit code should be 0');
    assert(status.stdout.includes('Redis Connected') || status.stdout.includes('Redis connected'), 'Should connect to Redis');
    assert(status.stdout.includes('Keys:'), 'Should show key count');

    // 3. Test invalid command
    console.log('\nTest 3: Invalid command');
    const invalid = await runCommand(['unknown-cmd']);
    assert(invalid.code === 1, 'Exit code should be 1');
    assert(invalid.stderr.includes('Unknown command'), 'Stderr should mention unknown command');

    console.log('\n✨ CLI Verification Passed!');
}

verify().catch(err => {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
});
