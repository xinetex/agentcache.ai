#!/usr/bin/env node
/**
 * Check Survey Responses in the Database
 * Run: node scripts/check_survey_responses.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
    console.log('\n📊 Checking Survey Responses...\n');

    try {
        // Check survey_responses table
        const responses = await sql`
            SELECT id, channel, question, response, sentiment, created_at 
            FROM survey_responses 
            ORDER BY created_at DESC 
            LIMIT 20
        `;

        console.log(`Found ${responses.length} survey responses:\n`);

        if (responses.length === 0) {
            console.log('❌ No survey responses yet.\n');
        } else {
            responses.forEach((r, i) => {
                console.log(`${i + 1}. [${r.channel}] ${r.created_at?.toISOString?.() || r.created_at}`);
                console.log(`   Q: ${r.question?.slice(0, 60)}...`);
                console.log(`   A: ${r.response?.slice(0, 80)}...`);
                console.log(`   Sentiment: ${r.sentiment}\n`);
            });
        }

        // Check market_insights table
        console.log('\n📈 Checking Market Insights...\n');
        const insights = await sql`
            SELECT id, week_of, survey_count, opportunities, pain_points
            FROM market_insights
            ORDER BY week_of DESC
            LIMIT 5
        `;

        if (insights.length === 0) {
            console.log('❌ No market insights generated yet.\n');
        } else {
            insights.forEach((r, i) => {
                console.log(`${i + 1}. Week of: ${r.week_of}`);
                console.log(`   Survey Count: ${r.survey_count}`);
                console.log(`   Opportunities: ${JSON.stringify(r.opportunities)?.slice(0, 100)}...`);
                console.log(`   Pain Points: ${JSON.stringify(r.pain_points)?.slice(0, 100)}...\n`);
            });
        }

    } catch (err) {
        if (err.message?.includes('does not exist')) {
            console.log('⚠️  Tables not created yet. Run migrations: npm run db:migrate\n');
        } else {
            console.error('Error:', err.message);
        }
    }
}

main();
