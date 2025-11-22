import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

// Default ports
const DEFAULT_APP_PORT = 3000;
const DEFAULT_REDIS_PORT = 6379;

async function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false)); // Port in use
        server.once('listening', () => {
            server.close();
            resolve(true); // Port available
        });
        server.listen(port);
    });
}

async function findNextPort(startPort) {
    let port = startPort;
    while (!(await checkPort(port))) {
        port++;
    }
    return port;
}

async function updateEnv(appPort, redisPort) {
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or Append PORT
    if (envContent.includes('PORT=')) {
        envContent = envContent.replace(/PORT=\d+/, `PORT=${appPort}`);
    } else {
        envContent += `\nPORT=${appPort}`;
    }

    // Update or Append REDIS_PORT (custom var for compose)
    if (envContent.includes('REDIS_PORT=')) {
        envContent = envContent.replace(/REDIS_PORT=\d+/, `REDIS_PORT=${redisPort}`);
    } else {
        envContent += `\nREDIS_PORT=${redisPort}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Configuration updated: App Port ${appPort}, Redis Port ${redisPort}`);
}

async function main() {
    console.log('🔍 Checking ports...');

    const appPort = await findNextPort(DEFAULT_APP_PORT);
    if (appPort !== DEFAULT_APP_PORT) {
        console.log(`⚠️  Port ${DEFAULT_APP_PORT} is busy. Switching to ${appPort}.`);
    }

    const redisPort = await findNextPort(DEFAULT_REDIS_PORT);
    if (redisPort !== DEFAULT_REDIS_PORT) {
        console.log(`⚠️  Port ${DEFAULT_REDIS_PORT} is busy. Switching to ${redisPort}.`);
    }

    await updateEnv(appPort, redisPort);
    console.log('🚀 Ready to launch. Run "docker-compose up" now.');
}

main();
