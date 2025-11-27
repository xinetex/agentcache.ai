/**
 * Seed Sector Pipeline Templates
 * Populates database with all 10 production-ready sector templates
 * Usage: TEST_USER_EMAIL='user@example.com' node scripts/seed-sector-templates.js
 */

import { neon } from '@neondatabase/serverless';
import { PIPELINE_PRESETS } from '../src/config/presets.js';

const sql = neon(process.env.DATABASE_URL);

async function seedSectorTemplates() {
  const testEmail = process.env.TEST_USER_EMAIL || 'demo@agentcache.ai';
  
  console.log(`🌱 Seeding sector templates for user: ${testEmail}`);

  // Get or create test user
  let user = await sql`
    SELECT id FROM users WHERE email = ${testEmail} LIMIT 1
  `;

  if (user.length === 0) {
    console.log('📝 Creating test user...');
    user = await sql`
      INSERT INTO users (email, password_hash, full_name, is_active)
      VALUES (
        ${testEmail},
        '$2b$10$dummyhashforseeding1234567890',
        'Test User',
        true
      )
      RETURNING id
    `;
  }

  const userId = user[0].id;
  console.log(`✅ User ID: ${userId}`);

  // Seed templates for each sector
  const sectors = Object.keys(PIPELINE_PRESETS);
  let totalSeeded = 0;

  for (const sector of sectors) {
    const presets = PIPELINE_PRESETS[sector];
    
    for (const preset of presets) {
      try {
        // Calculate complexity
        const nodeCount = preset.nodes.length;
        const cacheCount = preset.nodes.filter(n => n.type.includes('cache')).length;
        let complexityTier = 'simple';
        let complexityScore = 10;
        
        if (nodeCount > 6 || cacheCount > 2) {
          complexityTier = 'enterprise';
          complexityScore = 85;
        } else if (nodeCount > 4 || cacheCount > 1) {
          complexityTier = 'complex';
          complexityScore = 60;
        } else if (nodeCount > 2) {
          complexityTier = 'moderate';
          complexityScore = 35;
        }

        // Parse monthly cost from estimatedSavings
        const monthlyCost = parseFloat(preset.estimatedSavings.replace(/[^0-9.]/g, '')) * 0.30; // 30% of savings as cost

        // Check if already exists
        const existing = await sql`
          SELECT id FROM pipelines 
          WHERE user_id = ${userId} 
          AND name = ${preset.name}
          AND sector = ${sector}
        `;

        if (existing.length > 0) {
          console.log(`⏭️  Skipping ${preset.name} (already exists)`);
          continue;
        }

        // Insert pipeline
        await sql`
          INSERT INTO pipelines (
            user_id,
            name,
            description,
            sector,
            nodes,
            connections,
            complexity_tier,
            complexity_score,
            monthly_cost,
            status
          ) VALUES (
            ${userId},
            ${preset.name},
            ${preset.description},
            ${sector},
            ${JSON.stringify(preset.nodes)},
            ${JSON.stringify(preset.edges)},
            ${complexityTier},
            ${complexityScore},
            ${monthlyCost},
            'draft'
          )
        `;

        totalSeeded++;
        console.log(`✅ Seeded: ${preset.name} (${sector})`);
      } catch (error) {
        console.error(`❌ Failed to seed ${preset.name}:`, error.message);
      }
    }
  }

  console.log(`\n🎉 Seeded ${totalSeeded} pipeline templates across ${sectors.length} sectors`);
  console.log(`\n📊 Summary:`);
  for (const sector of sectors) {
    const count = PIPELINE_PRESETS[sector].length;
    console.log(`   ${sector}: ${count} templates`);
  }
}

// Run seed
seedSectorTemplates()
  .then(() => {
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });
