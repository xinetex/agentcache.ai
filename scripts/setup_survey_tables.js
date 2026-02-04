#!/usr/bin/env node
/**
 * Create Survey Tables and Seed Test Data
 * Run: node scripts/setup_survey_tables.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
    console.log('\n🔧 Setting up Survey Tables...\n');

    try {
        // 1. Create survey_responses table
        console.log('📋 Creating survey_responses table...');
        await sql`
            CREATE TABLE IF NOT EXISTS survey_responses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                channel TEXT NOT NULL,
                user_id TEXT,
                question TEXT NOT NULL,
                response TEXT NOT NULL,
                sentiment TEXT DEFAULT 'neutral',
                insights JSONB DEFAULT '[]'::jsonb,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;
        console.log('✅ survey_responses table ready.');

        // 2. Create index on channel
        await sql`
            CREATE INDEX IF NOT EXISTS survey_channel_idx ON survey_responses(channel)
        `;
        console.log('✅ Index created.');

        // 3. Create market_insights table
        console.log('📋 Creating market_insights table...');
        await sql`
            CREATE TABLE IF NOT EXISTS market_insights (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                week_of TIMESTAMP NOT NULL,
                top_skills JSONB DEFAULT '[]'::jsonb,
                pain_points JSONB DEFAULT '[]'::jsonb,
                opportunities JSONB DEFAULT '[]'::jsonb,
                survey_count INTEGER DEFAULT 0,
                bounty_analysis JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;
        console.log('✅ market_insights table ready.');

        // 4. Seed some test data to validate the pipeline
        console.log('\n🌱 Seeding test survey responses...');

        const testResponses = [
            {
                channel: 'telegram',
                userId: 'test_user_001',
                question: "What's the most tedious task your agent does repeatedly?",
                response: "Re-embedding the same documents over and over. The LLM costs are killing us.",
                sentiment: 'negative'
            },
            {
                channel: 'moltbook',
                userId: 'moltbook_agent_42',
                question: "Would you pay for a caching layer that cut your LLM costs 70%?",
                response: "Absolutely. We spend $500/month on redundant completions alone.",
                sentiment: 'positive'
            },
            {
                channel: 'clawtasks',
                userId: 'bounty_hunter_x',
                question: "What API or service do you wish existed for agents?",
                response: "A semantic cache that understands when two prompts are asking the same thing.",
                sentiment: 'positive'
            },
            {
                channel: 'telegram',
                userId: 'swarm_dev_99',
                question: "What's the biggest bottleneck in your agent workflow?",
                response: "Waiting for LLM responses. Each tool call takes 2-5 seconds.",
                sentiment: 'negative'
            },
            {
                channel: 'moltbook',
                userId: 'dao_contributor',
                question: "Describe a workflow you wish you could automate but can't.",
                response: "Verifying trust scores for new agents before my swarm interacts with them.",
                sentiment: 'neutral'
            }
        ];

        for (const r of testResponses) {
            await sql`
                INSERT INTO survey_responses (channel, user_id, question, response, sentiment)
                VALUES (${r.channel}, ${r.userId}, ${r.question}, ${r.response}, ${r.sentiment})
            `;
        }
        console.log(`✅ Seeded ${testResponses.length} test responses.`);

        // 5. Verify
        const count = await sql`SELECT COUNT(*) as count FROM survey_responses`;
        console.log(`\n📊 Total survey responses in database: ${count[0].count}`);

        console.log('\n✨ Survey system ready to harvest responses!\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

main();
