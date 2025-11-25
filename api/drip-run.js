export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

async function sendDrip(to, kind) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.SENDGRID_API;
  const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || 'support@agentcache.ai';
  const FROM_NAME = process.env.MAIL_FROM_NAME || 'AgentCache.ai';

  let subject = 'Welcome to AgentCache.ai';
  let html = '';
  if (kind === '0') {
    subject = 'Getting started: Save your first $10 today';
    html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
      <h2>Welcome ⚡</h2>
      <p>Try caching a single prompt and see an instant hit. Docs: https://agentcache.ai/docs.html</p>
    </body></html>`;
  } else if (kind === '2') {
    subject = 'Real-world ROI: 85% hit rate example';
    html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
      <h2>ROI Example</h2>
      <p>100K calls → $3,000 → $499 with AgentCache. Case study inside.</p>
    </body></html>`;
  } else if (kind === '5') {
    subject = 'Scale up: Next steps and roadmap';
    html = `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
      <h2>Scale</h2>
      <p>Increase TTLs, tag cache keys, and enable custom rules. Reply if you want help.</p>
    </body></html>`;
  }
  const text = subject;

  if (RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html, text }) });
    if (!r.ok) throw new Error('Resend failed');
    return;
  }
  if (SENDGRID_API_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: FROM_EMAIL, name: FROM_NAME }, subject, content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }] }) });
    if (!r.ok) throw new Error('SendGrid failed');
    return;
  }
}

export default async function handler(req) {
  const u = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const headerToken = (auth.startsWith('Bearer ') ? auth.slice(7) : '');
  const qpToken = u.searchParams.get('token') || '';
  const token = headerToken || qpToken;
  if (!token || token !== (process.env.DRIP_TOKEN || '')) return json({ error: 'Unauthorized' }, 401);

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const key = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !key) return json({ error: 'Service not configured' }, 500);

  const now = Math.floor(Date.now() / 1000);
  const kinds = ['0', '2', '5'];
  let sent = 0;

  for (const kind of kinds) {
    const getDue = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ commands: [["ZRANGEBYSCORE", `drip:${kind}`, 0, now, 'LIMIT', 0, 100]] }) });
    const arr = await getDue.json();
    const emails = Array.isArray(arr) ? arr[0]?.result || [] : [];
    if (!emails.length) continue;

    for (const email of emails) {
      try { await sendDrip(email, kind); sent++; } catch { }
    }
    // remove all processed
    await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ commands: [["ZREMRANGEBYSCORE", `drip:${kind}`, 0, now]] }) });
  }

  return json({ ok: true, sent, ts: new Date().toISOString() });
}
