import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function seedLogicPack() {
    console.log("Seeding Logic Pack...");
    
    try {
        let packRes = await sql`SELECT id FROM sector_packs WHERE name = 'Flow Logic'`;
        let packId;
        if (packRes.length > 0) {
            packId = packRes[0].id;
        } else {
            const inserted = await sql`
                INSERT INTO sector_packs (name, description, is_official)
                VALUES ('Flow Logic', 'Advanced control flow and node mechanics inspired by n8n', true)
                RETURNING id;
            `;
            packId = inserted[0].id;
        }

        // Templates to insert
        const templates = [
            {
                name: 'IF / Classifier',
                description: 'Classifies files using BYOK LLM and routes them to different output nodes.',
                category: 'logic',
                required_inputs: ['classification_prompt', 'true_node', 'false_node'],
                workflow_schema: { type: 'branch', condition: 'llm_classify' }
            },
            {
                name: 'Merge (Wait)',
                description: 'Waits until all connected input folders receive files before proceeding.',
                category: 'logic',
                required_inputs: ['expected_inputs_count'],
                workflow_schema: { type: 'merge', condition: 'all_received' }
            },
            {
                name: 'Batch / Split',
                description: 'Splits multi-item files (like CSVs or multi-page PDFs) into individual items.',
                category: 'logic',
                required_inputs: ['split_delimiter_or_type'],
                workflow_schema: { type: 'split', execution: 'batch_sequential' }
            }
        ];

        for (const tpl of templates) {
            const tplRes = await sql`SELECT id FROM action_templates WHERE name = ${tpl.name} AND pack_id = ${packId}`;
            if (tplRes.length === 0) {
                await sql`
                    INSERT INTO action_templates (pack_id, name, description, category, required_inputs, workflow_schema)
                    VALUES (${packId}, ${tpl.name}, ${tpl.description}, ${tpl.category}, ${JSON.stringify(tpl.required_inputs)}::jsonb, ${JSON.stringify(tpl.workflow_schema)}::jsonb)
                `;
                console.log(`Inserted template: ${tpl.name}`);
            } else {
                console.log(`Template already exists: ${tpl.name}`);
            }
        }
        
        console.log("Done.");
    } catch (e) {
        console.error("Error seeding Logic Pack:", e);
    }
}

seedLogicPack();
