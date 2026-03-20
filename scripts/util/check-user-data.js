import { createClient } from '@vercel/postgres';

async function checkUser() {
  const client = createClient();
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT id, email, full_name, organization_id, role, created_at
      FROM users
      WHERE email = 'verdoni@gmail.com'
    `);
    
    if (result.rows.length > 0) {
      console.log('User found:', JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('No user found with email verdoni@gmail.com');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUser();
