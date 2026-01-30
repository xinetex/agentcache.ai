import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

// 1. Setup DB Connection
if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is missing!");
    process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// 2. Data to Seed (Migrated from index.html)
const LANES = [
    { id: 'mission', title: 'MISSION PROTOCOL', size: 'large', speed: 8000 },
    { id: 'usecases', title: 'USE CASES', size: 'medium', speed: 4000 },
    { id: 'stats', title: 'LIVE STATS', size: 'small', speed: 3000 }
];

const CARDS = [
    // --- MISSION LANE (Hero + Problem/Solution) ---
    {
        id: 'mission-1', laneId: 'mission', template: 'hero',
        data: { title: 'AI FOR EVERYONE', subtitle: 'ZERO LATENCY', content: 'AgentCache stores the first response. The next 999 are instant. Cut costs by 95% and eliminate wait times.' }
    },
    {
        id: 'mission-problem-1', laneId: 'mission', template: 'hero',
        data: { title: 'SLOW AGENTS?', subtitle: 'THE PROBLEM', content: 'Your AI calls GPT-4 for "What is 2+2?" 1,000 times a day. Same question. Same slow 5-second wait.' }
    },
    {
        id: 'mission-2', laneId: 'mission', template: 'hero',
        data: { title: '100x FASTER', subtitle: 'THE SOLUTION', content: 'Responses in <50ms from 200+ edge locations. Your users wait less, your agents do more.' }
    },
    {
        id: 'mission-problem-2', laneId: 'mission', template: 'hero',
        data: { title: '$10k BILL?', subtitle: 'COST SPIRAL', content: 'Every token costs money. 90% of your requests are redundant. Stop paying for the same answer twice.' }
    },
    {
        id: 'mission-3', laneId: 'mission', template: 'hero',
        data: { title: 'START FREE', subtitle: 'NO CREDIT CARD', content: '10,000 requests/month free forever. Setup in 30 seconds with just one line of code.' }
    },

    // --- USE CASES LANE ---
    {
        id: 'case-ai', laneId: 'usecases', template: 'standard',
        data: { title: 'AI Responses', subtitle: 'LLM COMPLETIONS', content: 'Cache completions from OpenAI, Anthropic, Groq. 92% average hit rate means massive savings.', image: '/assets/studio-dashboard.png' }
    },
    {
        id: 'case-tools', laneId: 'usecases', template: 'standard',
        data: { title: 'Tool Calls', subtitle: 'DETERMINISTIC', content: 'Perfect for weather, currency, and package lookups. 100% hit rate for identical tool calls.', image: '/assets/studio-dashboard.png' }
    },
    {
        id: 'case-db', laneId: 'usecases', template: 'standard',
        data: { title: 'DB Queries', subtitle: 'POSTGRES / SQL', content: 'Cache expensive SQL queries with a 5-minute TTL. Reduce database load instantly.', image: '/assets/studio-dashboard.png' }
    },
    {
        id: 'case-embed', laneId: 'usecases', template: 'standard',
        data: { title: 'Embeddings', subtitle: 'VECTOR STORE', content: 'Cache vector embeddings. Save $1,000s/month on redundant vectorization.', image: '/assets/studio-dashboard.png' }
    },

    // --- PRICING LANE ---
    {
        id: 'price-free', laneId: 'pricing', template: 'standard',
        data: { title: 'Community', subtitle: '$0 / MONTH', content: 'Forever free. 10,000 requests/month. All cache types included. Public namespace. 7-day TTL.', image: '/assets/console-preview.jpg' }
    },
    {
        id: 'price-pro', laneId: 'pricing', template: 'standard',
        data: { title: 'Pro', subtitle: '$49 / MONTH', content: '1 Million requests/month. Private namespaces. Custom TTL up to 90 days. Priority support.', image: '/assets/console-preview.jpg' }
    },
    {
        id: 'price-ent', laneId: 'pricing', template: 'standard',
        data: { title: 'Enterprise', subtitle: 'CUSTOM', content: 'Unlimited requests. Dedicated infrastructure. SLA guarantees. White-label options with 24/7 support.', image: '/assets/console-preview.jpg' }
    },

    // --- STATS LANE (Refactored from Legacy) ---
    {
        id: 'stat-requests', laneId: 'stats', template: 'stat',
        data: { title: '427,319', subtitle: 'REQUESTS CACHED', content: 'Requests served instantly from the edge today.' }
    },
    {
        id: 'stat-savings', laneId: 'stats', template: 'stat',
        data: { title: '$8,546', subtitle: 'MONEY SAVED', content: 'Total user savings today based on average token costs.' }
    },
    {
        id: 'stat-latency', laneId: 'stats', template: 'stat',
        data: { title: '42ms', subtitle: 'AVG LATENCY', content: 'Global average response time for cached hits.' }
    },
    {
        id: 'stat-hitrate', laneId: 'stats', template: 'stat',
        data: { title: '92%', subtitle: 'CACHE HIT RATE', content: 'Average cache hit rate across all community apps.' }
    }
];

// 3. Main Seed Function
async function seedBento() {
    console.log("🌱 Seeding Bento Grid Content...");

    try {
        // 0. Ensure Tables Exist (Manual Migration since Drizzle Push is flaky in non-interactive)
        console.log(`- Verifying Schema...`);
        await sql`
      CREATE TABLE IF NOT EXISTS lanes (
        id text PRIMARY KEY,
        title text NOT NULL,
        size text NOT NULL,
        speed integer DEFAULT 4000
      );
    `;
        await sql`
      CREATE TABLE IF NOT EXISTS cards (
        id text PRIMARY KEY,
        lane_id text REFERENCES lanes(id),
        template text NOT NULL,
        data jsonb NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `;

        // Seed Lanes
        for (const lane of LANES) {
            console.log(`- Inserting Lane: ${lane.id}`);
            await sql`
        INSERT INTO lanes (id, title, size, speed) 
        VALUES (${lane.id}, ${lane.title}, ${lane.size}, ${lane.speed})
        ON CONFLICT (id) DO UPDATE 
        SET title = EXCLUDED.title, size = EXCLUDED.size, speed = EXCLUDED.speed
      `;
        }

        // Seed Cards
        for (const card of CARDS) {
            console.log(`- Inserting Card: ${card.id}`);
            await sql`
        INSERT INTO cards (id, lane_id, template, data) 
        VALUES (${card.id}, ${card.laneId}, ${card.template}, ${JSON.stringify(card.data)})
        ON CONFLICT (id) DO UPDATE 
        SET lane_id = EXCLUDED.lane_id, template = EXCLUDED.template, data = EXCLUDED.data
      `;
        }

        console.log("✅ Seeding Complete!");
    } catch (error) {
        console.error("❌ Seeding Failed:", error);
    }
}

seedBento();
