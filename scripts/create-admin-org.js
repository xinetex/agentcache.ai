import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function createOrgAndAssign() {
  try {
    // Create organization for Richard Verdoni (platform admin)
    const [org] = await sql`
      INSERT INTO organizations (
        name, 
        slug, 
        sector, 
        contact_email, 
        contact_name,
        plan_tier,
        max_namespaces,
        max_api_keys,
        max_users
      ) VALUES (
        'AgentCache Platform',
        'agentcache-platform',
        'enterprise',
        'verdoni@gmail.com',
        'Richard Verdoni',
        'enterprise',
        999,
        999,
        999
      )
      ON CONFLICT (slug) DO UPDATE
      SET updated_at = NOW()
      RETURNING *
    `;
    
    console.log('✅ Created organization:', org.name);
    
    // Assign user to organization as owner
    await sql`
      UPDATE users
      SET organization_id = ${org.id},
          role = 'owner'
      WHERE email = 'verdoni@gmail.com'
    `;
    
    console.log('✅ Assigned verdoni@gmail.com as owner');
    
    // Create default namespaces
    const defaultNamespaces = [
      { name: 'production', display_name: 'Production', description: 'Production environment' },
      { name: 'staging', display_name: 'Staging', description: 'Staging environment' },
      { name: 'development', display_name: 'Development', description: 'Development environment' },
    ];
    
    for (const ns of defaultNamespaces) {
      await sql`
        INSERT INTO namespaces (
          organization_id,
          name,
          display_name,
          description
        ) VALUES (
          ${org.id},
          ${ns.name},
          ${ns.display_name},
          ${ns.description}
        )
        ON CONFLICT (organization_id, name) DO NOTHING
      `;
    }
    
    console.log('✅ Created default namespaces');
    
    // Create organization settings
    await sql`
      INSERT INTO organization_settings (
        organization_id,
        features,
        preferences
      ) VALUES (
        ${org.id},
        '{"multi_tenant": true, "sso": false, "custom_nodes": true, "lab_access": true}'::jsonb,
        '{"default_sector": "enterprise"}'::jsonb
      )
      ON CONFLICT (organization_id) DO NOTHING
    `;
    
    console.log('✅ Created organization settings');
    console.log('');
    console.log('Organization ID:', org.id);
    console.log('Slug:', org.slug);
    console.log('Sector:', org.sector);
    console.log('');
    console.log('🎉 Done! Login at: https://agentcache.ai/login.html');
    console.log('   Email: verdoni@gmail.com');
    console.log('   Password: temppass123');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

createOrgAndAssign();
