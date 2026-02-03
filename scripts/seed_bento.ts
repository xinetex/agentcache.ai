import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

// 1. Setup DB Connection
if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is missing!");
    process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// 2. Data to Seed (Migrated from index.html)
import { DEFAULT_LANES as LANES, DEFAULT_CARDS as CARDS } from '../src/config/bentoDefaults.js';

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
