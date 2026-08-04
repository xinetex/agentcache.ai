import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
    console.log('Adding Template and Sector DB tables...');
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS sector_packs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                description TEXT,
                version TEXT DEFAULT '1.0.0',
                is_official BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('sector_packs created');

        await sql`
            CREATE TABLE IF NOT EXISTS action_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pack_id UUID REFERENCES sector_packs(id),
                name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                workflow_schema JSONB DEFAULT '{}',
                required_inputs JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;
        console.log('action_templates created');

        // Seed the Creative Sector Pack
        const packRes = await sql`
            INSERT INTO sector_packs (name, description, is_official) 
            VALUES ('Creative & Entertainment', 'Automated DAM, Web Generation, and Brochures for creative industries.', true)
            RETURNING id;
        `;
        
        const packId = packRes[0].id;
        
        // Seed the Web Gallery Template
        await sql`
            INSERT INTO action_templates (pack_id, name, description, category, required_inputs)
            VALUES (
                ${packId}, 
                'Web Gallery Generator', 
                'Drop N images to scaffold a beautiful HTML/CSS portfolio webpage. Requires agent vision tagging.', 
                'Creative',
                '[{"id":"title", "label":"Gallery Title", "type":"string"}]'::jsonb
            );
        `;
        
        // Seed the Brochure Template
        await sql`
            INSERT INTO action_templates (pack_id, name, description, category, required_inputs)
            VALUES (
                ${packId}, 
                'Automated PDF Brochure', 
                'Generate a PDF deck from image assets. BLOCKS for user input (Title, Copy, Theme) before finalizing.', 
                'Creative',
                '[{"id":"title", "label":"Brochure Title", "type":"string"}, {"id":"copy", "label":"Marketing Copy", "type":"text"}]'::jsonb
            );
        `;

        console.log('Seeded templates!');
        console.log('DONE!');
    } catch (e) {
        console.error(e);
    }
}

run();
