export const config = { runtime: 'nodejs' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  try {
    // Test basic operations
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey || !apiKey.startsWith('ac_')) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    const body = await req.json();
    
    return new Response(JSON.stringify({
      status: 'success',
      message: 'Basic cache test working',
      received: {
        provider: body?.provider,
        model: body?.model,
        messageCount: body?.messages?.length
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Error in test endpoint',
      details: err?.message,
      stack: err?.stack
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
