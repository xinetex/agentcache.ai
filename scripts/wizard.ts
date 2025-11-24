import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const steps = [
    { id: '1', label: '🤖 Verify Robotics (Fleet Intelligence)', script: 'scripts/verify_robotics.ts' },
    { id: '2', label: '🏥 Verify Healthcare (Compliance Firewalls)', script: 'scripts/verify_compliance.ts' },
    { id: '3', label: '💸 Verify Finance (HFT Speed Layer)', script: 'scripts/verify_finance.ts' },
    { id: '4', label: '📚 Verify DocuCache (Documentation RAG)', script: 'scripts/verify_docs.ts' },
    { id: '5', label: '🚀 Run ALL Verifications', script: 'ALL' },
    { id: '6', label: '🐙 Deploy to GitHub', script: 'DEPLOY' },
    { id: 'q', label: 'Quit', script: 'QUIT' }
];

function clearScreen() {
    console.clear();
    console.log('\x1b[36m%s\x1b[0m', `
    ___                    __  ______           __         
   /   | ____ ____  ____  / /_/ ____/___ ______/ /_  ___ 
  / /| |/ __ \`/ _ \\/ __ \\/ __/ /   / __ \`/ ___/ __ \\/ _ \\
 / ___ / /_/ /  __/ / / / /_/ /___/ /_/ / /__/ / / /  __/
/_/  |_\\__, /\\___/_/ /_/\\__/\\____/\\__,_/\\___/_/ /_/\\___/ 
      /____/                                             
  `);
    console.log('\x1b[32m%s\x1b[0m', '      AgentCache Command Center v1.0\n');
}

async function runScript(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`\n\x1b[33m> Running ${scriptPath}...\x1b[0m\n`);

        const cmd = 'npx';
        const args = ['tsx', scriptPath];

        const child = spawn(cmd, args, { stdio: 'inherit', shell: true });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n\x1b[32m✔ Success\x1b[0m`);
                resolve();
            } else {
                console.log(`\n\x1b[31m✘ Failed (Exit Code: ${code})\x1b[0m`);
                reject(new Error(`Script failed with code ${code}`));
            }
        });
    });
}

async function deploy() {
    console.log('\n\x1b[33m> Preparing Deployment...\x1b[0m');
    // In a real scenario, this would run git commands or vercel deploy
    console.log('Running git push...');

    return new Promise<void>((resolve) => {
        const child = spawn('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
        child.on('close', (code) => {
            if (code === 0) console.log('\n\x1b[32m✔ Deployed to GitHub\x1b[0m');
            else console.log('\n\x1b[31m✘ Deployment Failed\x1b[0m');
            resolve();
        });
    });
}

async function showMenu() {
    clearScreen();
    console.log('Select an action:');
    steps.forEach(s => console.log(`  [${s.id}] ${s.label}`));

    rl.question('\n> ', async (answer) => {
        const choice = answer.trim();
        const step = steps.find(s => s.id === choice);

        if (!step) {
            if (choice.toLowerCase() === 'q') process.exit(0);
            console.log('Invalid choice.');
            setTimeout(showMenu, 1000);
            return;
        }

        try {
            if (step.script === 'QUIT') {
                process.exit(0);
            } else if (step.script === 'DEPLOY') {
                await deploy();
            } else if (step.script === 'ALL') {
                for (const s of steps.slice(0, 4)) {
                    await runScript(s.script);
                }
            } else {
                await runScript(step.script);
            }

            console.log('\nPress ENTER to return to menu...');
            rl.once('line', showMenu);

        } catch (err) {
            console.error(err);
            console.log('\nPress ENTER to return to menu...');
            rl.once('line', showMenu);
        }
    });
}

// Start
showMenu();
