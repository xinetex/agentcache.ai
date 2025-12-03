import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
    console.log('Creating tables...');
    try {
        // 1. Agents
        await sql`
      CREATE TABLE IF NOT EXISTS agents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        role text NOT NULL,
        config jsonb DEFAULT '{}',
        status text DEFAULT 'idle',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `;
        console.log('✅ Agents table created');

        // 2. Memories
        await sql`
      CREATE TABLE IF NOT EXISTS memories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id uuid REFERENCES agents(id),
        content text NOT NULL,
        embedding jsonb,
        tags text[],
        importance real DEFAULT 1.0,
        created_at timestamp DEFAULT now()
      );
    `;
        console.log('✅ Memories table created');

        // 3. Knowledge Nodes
        await sql`
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE,
        value jsonb NOT NULL,
        author_agent_id uuid REFERENCES agents(id),
        confidence real DEFAULT 1.0,
        last_verified_at timestamp DEFAULT now()
      );
    `;
        console.log('✅ Knowledge Nodes table created');

        // 4. Decisions
        await sql`
      CREATE TABLE IF NOT EXISTS decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id uuid REFERENCES agents(id),
        action text NOT NULL,
        reasoning text,
        outcome jsonb,
        timestamp timestamp DEFAULT now()
      );
    `;
        console.log('✅ Decisions table created');

    } catch (e) {
        console.error('❌ Error creating tables:', e);
    }
}

main();
