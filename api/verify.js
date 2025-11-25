export const config = { runtime: 'nodejs' };

function b64url(bytes) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function sendWelcomeEmail(to, key) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.SENDGRID_API;
  const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || 'support@agentcache.ai';
  const FROM_NAME = process.env.MAIL_FROM_NAME || 'AgentCache.ai';
  const subject = 'Your AgentCache.ai API key';
  const html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
    <h2>Welcome to AgentCache.ai ⚡</h2>
    <p>Here is your API key (store it securely):</p>
    <pre style="background:#111;color:#eee;padding:12px;border-radius:8px">${key}</pre>
    <p>Quickstart:</p>
    <pre style="background:#111;color:#eee;padding:12px;border-radius:8px">fetch('/api/cache/get', { method:'POST', headers:{ 'content-type':'application/json','X-API-Key':'${key}' }, body: JSON.stringify({ provider:'openai', model:'gpt-4', messages:[{role:'user',content:'Explain Python'}] }) })</pre>
    <p>Docs: https://agentcache.ai/docs.html</p>
  </body></html>`;
  const text = `Your AgentCache.ai key: ${key}\nDocs: https://agentcache.ai/docs.html`;
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${RESEND_API_KEY}`, 'content-type':'application/json' }, body: JSON.stringify({ from:`${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html, text })});
    if (!res.ok) throw new Error('Resend send failed');
    return;
  }
  if (SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', { method:'POST', headers:{ Authorization:`Bearer ${SENDGRID_API_KEY}`, 'content-type':'application/json' }, body: JSON.stringify({ personalizations:[{ to:[{email:to}] }], from:{ email:FROM_EMAIL, name:FROM_NAME }, subject, content:[{type:'text/plain', value:text},{type:'text/html', value:html}] })});
    if (!res.ok) throw new Error('SendGrid send failed');
    return;
  }
}

export default async function handler(req) {
  try {
    const u = new URL(req.url);
    const token = u.searchParams.get('token');
    if (!token) {
      return new Response('Missing token', { status: 400 });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const auth = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !auth) return new Response('Service not configured', { status: 500 });

    // Resolve token -> email
    const getRes = await fetch(`${url}/get/verify:${token}`, {
      headers: { Authorization: `Bearer ${auth}` },
      cache: 'no-store',
    });
    const email = await getRes.text();
    if (!getRes.ok || !email) {
      return new Response('Invalid or expired token', { status: 400 });
    }

    const now = new Date().toISOString();

    // Generate API key
    const rand = new Uint8Array(24); crypto.getRandomValues(rand);
    const plainKey = `ac_live_${b64url(rand)}`;
    const hash = await sha256Hex(plainKey);
    const suffix = plainKey.slice(-6);

    // Promote to active + store key metadata
    const nowSec = Math.floor(Date.now()/1000);
    const pipeline = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        commands: [
          ['DEL', `verify:${token}`],
          ['SREM', 'subscribers:pending', email],
          ['SADD', 'subscribers', email],
          ['HSET', `subscriber:${email}`, 'status', 'active', 'verifiedAt', now, 'apiKeyHash', hash, 'apiKeySuffix', suffix, 'plan', 'free', 'monthlyQuota', '1000'],
          ['SADD', 'keys:active', hash],
          ['HSET', `key:${hash}`, 'email', email, 'createdAt', now],
          ['HSET', `usage:${hash}`, 'plan', 'free', 'monthlyQuota', '1000'],
          // schedule drips at 0,2,5 day marks
          ['ZADD', 'drip:0', nowSec, email],
          ['ZADD', 'drip:2', nowSec + 2*86400, email],
          ['ZADD', 'drip:5', nowSec + 5*86400, email]
        ],
      }),
    });
    if (!pipeline.ok) return new Response('Failed to update status', { status: 500 });

    // Email plaintext key to user (only time shown)
    try { await sendWelcomeEmail(email, plainKey); } catch {}

    return new Response(null, { status: 302, headers: { Location: `/thanks.html?email=${encodeURIComponent(email)}&suffix=${encodeURIComponent(suffix)}` } });
  } catch (err) {
    return new Response('Unexpected error', { status: 500 });
  }
}
