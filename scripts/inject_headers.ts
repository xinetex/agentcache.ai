
import * as fs from 'fs';
import * as path from 'path';

const HEADER = `/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
`;

function injectHeaders(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                injectHeaders(fullPath);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Avoid double injection
            if (!content.includes('Copyright (c) 2026 AgentCache.ai')) {
                console.log(`[IP] Injecting header into: ${fullPath}`);
                const newContent = HEADER + content;
                fs.writeFileSync(fullPath, newContent, 'utf8');
            } else {
                console.log(`[IP] Skip (Header exists): ${fullPath}`);
            }
        }
    }
}

const targetDir = path.resolve(process.cwd(), 'src');
console.log(`🧪 Starting Proprietary Header Injection in: ${targetDir}`);
injectHeaders(targetDir);
console.log("✨ IP Protection Step 2 Complete.");
