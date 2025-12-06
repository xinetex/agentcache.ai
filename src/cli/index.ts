import { redis } from '../lib/redis.js';
import fs from 'fs';
import path from 'path';

/**
 * AgentCache CLI
 * 
 * Usage:
 *   ac init          - Initialize config
 *   ac status        - View stats
 *   ac help          - Show help
 */

export async function cli(argv: string[]) {
    const command = argv[2] || 'help';
    const args = argv.slice(3);

    console.log(`\n🤖 AgentCache CLI v1.0\n`);

    try {
        switch (command) {
            case 'init':
                await initCommand();
                break;
            case 'status':
                await statusCommand();
                break;
            case 'help':
                showHelp();
                break;
            default:
                console.error(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    } catch (e: any) {
        console.error('Command failed:', e.message);
        process.exit(1);
    } finally {
        // Need to explicitly close Redis or the script hangs
        if (redis && redis.disconnect) {
            // Check if it's a real redis client
            redis.disconnect();
        } else if (redis && redis.quit) {
            await redis.quit();
        }
        process.exit(0);
    }
}

async function initCommand() {
    console.log('Initializing AgentCache project...');
    const configPath = path.join(process.cwd(), 'agentcache.json');

    if (fs.existsSync(configPath)) {
        console.log('⚠️  agentcache.json already exists.');
        return;
    }

    const defaultConfig = {
        name: 'my-agent-project',
        version: '1.0.0',
        pipeline: {
            default: {
                model: 'gpt-4o',
                ttl: 3600
            }
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log('✅ Created agentcache.json');
}

async function statusCommand() {
    console.log('Trying to connect to Redis...');

    // Check connection
    try {
        await redis.ping();
        console.log('✅ Redis Connected');

        // Fetch some basic stats
        const info = await redis.info();
        const dbsize = await redis.dbsize();

        console.log(`\nStats:`);
        console.log(`- Keys: ${dbsize}`);
        console.log(`- Memory: ${parseRedisInfo(info, 'used_memory_human')}`);

    } catch (e: any) {
        console.error('❌ Redis Connection Failed:', e.message);
        console.log('Tip: Ensure REDIS_URL is set in .env');
    }
}

function showHelp() {
    console.log(`
Usage:
  ac <command> [options]

Commands:
  init      Initialize a new AgentCache configuration
  status    Check connection and view basic stats
  help      Show this help message
`);
}

function parseRedisInfo(info: string, key: string) {
    const lines = info.split('\n');
    for (const line of lines) {
        if (line.startsWith(key)) {
            return line.split(':')[1].trim();
        }
    }
    return 'Unknown';
}
