export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Check environment variables
    const envCheck = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      NODE_ENV: process.env.NODE_ENV || 'not set'
    };

    // Try to import db module
    let dbImportError = null;
    try {
      const { query } = await import('../../lib/db.js');
      envCheck.db_module = 'imported successfully';
      
      // Try a simple query
      try {
        const result = await query('SELECT 1 as test');
        envCheck.db_connection = 'connected';
        envCheck.db_test = result.rows[0];
      } catch (queryError) {
        envCheck.db_connection = 'failed';
        envCheck.db_error = queryError.message;
      }
    } catch (importError) {
      dbImportError = importError.message;
      envCheck.db_module = 'import failed';
      envCheck.import_error = importError.message;
    }

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: envCheck
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
