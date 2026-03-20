import { db } from './src/db/client.js';
import { hubAgents } from './src/db/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

async function seed() {
    console.log('--- Seeding Hub Agents ---');
    
    const profiles = [
        {
            id: 'prof_researcher',
            name: 'Deep Research Alpha',
            role: 'researcher',
            domain: ['tech', 'science', 'market'],
            strengths: ['web search', 'paper analysis', 'synthesis'],
            environment: 'production',
            modelBackend: 'gpt-4o'
        },
        {
            id: 'prof_optimizer',
            name: 'Latency Ghost',
            role: 'optimizer',
            domain: ['infrastructure', 'code'],
            strengths: ['performance tuning', 'caching strategies'],
            environment: 'production',
            modelBackend: 'gpt-4o-mini'
        },
        {
            id: 'prof_sentry',
            name: 'Wall-E Sentry',
            role: 'sentry',
            domain: ['security', 'compliance'],
            strengths: ['anomaly detection', 'log audit'],
            environment: 'production',
            modelBackend: 'gpt-4o'
        },
        {
            id: 'prof_analyst',
            name: 'Quant Scale',
            role: 'analyst',
            domain: ['finance', 'usage'],
            strengths: ['data visualization', 'trend prediction'],
            environment: 'production',
            modelBackend: 'claude-3-5-sonnet'
        }
    ];

    for (const p of profiles) {
        try {
            const existing = await db.select().from(hubAgents).where(eq(hubAgents.id, p.id)).limit(1);
            if (existing.length === 0) {
                await db.insert(hubAgents).values({
                    ...p,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    preferences: {},
                    preferenceConfidence: 0.5,
                    sessionCount: 0
                });
                console.log(`[Seed] Profile ${p.name} inserted.`);
            } else {
                console.log(`[Seed] Profile ${p.name} already exists.`);
            }
        } catch (e) {
            console.error(`[Seed] Failed to seed ${p.name}:`, e.message);
        }
    }

    console.log('--- Seed Complete ---');
    process.exit(0);
}

seed();
