import { db } from '../db/client.js';
import { legalContracts, agents } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export interface ContractDraftConfig {
    swarmId: string;
    templateId: string; // e.g. '04-ai-revenue-share-operating-agreement'
    metadata?: any;
}

/**
 * SymbiontBridge: The legal layer for AgentCache.
 * Connects swarm orchestration with binding legal templates from the Symbiont project.
 */
export class SymbiontBridge {
    private templatePath = '/Users/letstaco/Documents/symbiont-contracts/content/templates';

    /**
     * Draft a contract for a swarm based on a template.
     */
    async draftContract(config: ContractDraftConfig): Promise<any> {
        console.log(`[SymbiontBridge] Drafting contract for swarm ${config.swarmId} using template ${config.templateId}`);

        // 1. Load the template
        const fileName = await this.findTemplateFile(config.templateId);
        if (!fileName) throw new Error(`Template ${config.templateId} not found`);
        
        let templateContent = await fs.readFile(path.join(this.templatePath, fileName), 'utf-8');

        // 2. Fetch Swarm/Agent metadata
        // In a real swarm, we'd fetch the participants from the swarm status in Redis/DB
        // For now, let's assume we have a list of actors if swarmId is provided
        const actors = await db.select().from(agents).limit(5); // Mocked association for now
        
        // 3. Merging Logic: Replace [BRACKETED] fields
        const replacements: Record<string, string> = {
            'DATE': new Date().toLocaleDateString(),
            'COMPANY NAME': 'AgentCache Swarm ' + config.swarmId,
            'STATE': 'Delaware (Digital)',
            ...config.metadata
        };

        // Inject Actors into Party descriptions if applicable
        if (config.templateId.includes('partnership') || config.templateId.includes('revenue-share')) {
            let actorBlock = actors.map((a, i) => `**Member ${String.fromCharCode(65 + i)}:**\nName: ${a.name}\nRole: ${a.role}\nID: ${a.id}`).join('\n\n');
            templateContent = templateContent.replace(/## PARTIES[\s\S]*?---/, `## PARTIES\n\n${actorBlock}\n\n---`);
        }

        // Apply general replacements
        for (const [key, val] of Object.entries(replacements)) {
            const regex = new RegExp(`\\[${key}\\]`, 'g');
            templateContent = templateContent.replace(regex, val);
        }

        // 4. Save to DB
        const [contract] = await db.insert(legalContracts).values({
            swarmId: config.swarmId,
            templateId: config.templateId,
            content: templateContent,
            metadata: {
                actors: actors.map(a => ({ id: a.id, name: a.name, role: a.role })),
                ...config.metadata
            },
            status: 'draft'
        }).returning();

        return contract;
    }

    private async findTemplateFile(templateId: string): Promise<string | null> {
        const files = await fs.readdir(this.templatePath);
        // Match by slug (e.g. 04-ai-revenue-share-operating-agreement)
        const match = files.find(f => f.includes(templateId));
        return match || null;
    }

    /**
     * List all available templates from the Symbiont repository.
     */
    async listTemplates(): Promise<any[]> {
        const files = await fs.readdir(this.templatePath);
        return files.filter(f => f.endsWith('.md')).map(f => ({
            id: f.split('.')[0].slice(3), // e.g. "ai-revenue-share-operating-agreement"
            fileName: f,
            name: f.slice(3).replace(/-/g, ' ').replace('.md', '').toUpperCase()
        }));
    }
}

export const symbiontBridge = new SymbiontBridge();
