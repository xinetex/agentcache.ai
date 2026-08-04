import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const sql = neon(process.env.DATABASE_URL);

async function run() {
    console.log('Pushing schema manually...');
    
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE,
                password_hash TEXT,
                wallet_address TEXT UNIQUE,
                name TEXT,
                role TEXT DEFAULT 'user',
                plan TEXT DEFAULT 'free',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('users created');

        await sql`
            CREATE TABLE IF NOT EXISTS agents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                config JSONB DEFAULT '{}',
                status TEXT DEFAULT 'idle',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('agents created');

        await sql`
            CREATE TABLE IF NOT EXISTS workflows (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                owner_id UUID REFERENCES users(id),
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                settings JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('workflows created');

        await sql`
            CREATE TABLE IF NOT EXISTS smart_nodes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                owner_id UUID REFERENCES users(id),
                workflow_id UUID REFERENCES workflows(id),
                name TEXT NOT NULL,
                node_type TEXT DEFAULT 'directory',
                status TEXT DEFAULT 'active',
                pos_x REAL DEFAULT 0,
                pos_y REAL DEFAULT 0,
                memory_context JSONB DEFAULT '{}',
                spec_truth JSONB DEFAULT '{}',
                properties JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('smart_nodes created');

        await sql`
            CREATE TABLE IF NOT EXISTS node_connections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_id UUID REFERENCES workflows(id) NOT NULL,
                source_node_id UUID REFERENCES smart_nodes(id) NOT NULL,
                target_node_id UUID REFERENCES smart_nodes(id) NOT NULL,
                source_port TEXT DEFAULT 'output',
                target_port TEXT DEFAULT 'input',
                data_mapping JSONB DEFAULT '{}',
                condition JSONB,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('node_connections created');

        await sql`
            CREATE TABLE IF NOT EXISTS node_properties (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_id UUID REFERENCES smart_nodes(id) NOT NULL,
                key TEXT NOT NULL,
                value JSONB NOT NULL,
                value_type TEXT DEFAULT 'string',
                display_label TEXT,
                group_name TEXT,
                sort_order INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('node_properties created');

        await sql`
            CREATE TABLE IF NOT EXISTS node_agents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_id UUID REFERENCES smart_nodes(id) NOT NULL,
                agent_id UUID REFERENCES agents(id),
                role_name TEXT NOT NULL,
                permissions JSONB DEFAULT '{}',
                assigned_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('node_agents created');

        await sql`
            CREATE TABLE IF NOT EXISTS node_intents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                node_id UUID REFERENCES smart_nodes(id) NOT NULL,
                action_type TEXT NOT NULL,
                status TEXT DEFAULT 'idle',
                execution_log JSONB DEFAULT '[]',
                scheduled_time TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('node_intents created');

        await sql`
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workflow_id UUID REFERENCES workflows(id) NOT NULL,
                triggered_by TEXT,
                status TEXT DEFAULT 'running',
                started_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP,
                node_results JSONB DEFAULT '{}',
                error_message TEXT
            );
        `;
        console.log('workflow_executions created');

        console.log('DONE!');
    } catch (e) {
        console.error(e);
    }
}

run();
