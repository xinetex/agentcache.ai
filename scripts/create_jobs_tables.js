import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function createTables() {
    console.log("Creating Flow Logic tables...");
    
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS file_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_id UUID REFERENCES smart_nodes(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(512),
                file_type VARCHAR(50),
                file_size_bytes BIGINT,
                status VARCHAR(50) DEFAULT 'pending', -- pending, processed, error
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log("Created file_events table.");

        await sql`
            CREATE TABLE IF NOT EXISTS jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_id UUID REFERENCES smart_nodes(id) ON DELETE CASCADE,
                file_event_id UUID REFERENCES file_events(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'running', -- running, complete, failed
                logs JSONB DEFAULT '[]',
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE
            );
        `;
        console.log("Created jobs table.");
        
        console.log("Done.");
    } catch (e) {
        console.error("Error creating tables:", e);
    }
}

createTables();
