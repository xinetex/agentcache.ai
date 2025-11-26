import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon.tech');
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? {
        rejectUnauthorized: false
      } : false
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const start = Date.now();
  const pool = getPool();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function getClient() {
  const pool = getPool();
  return await pool.connect();
}

export async function transaction(callback) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default { query, getClient, transaction, closePool };
