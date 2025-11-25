export const config = { runtime: 'nodejs' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function upstashPipeline(commands, url, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ commands }),
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  return res.json();
}

function htmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emailTemplate({ verifyUrl }) {
  const safeUrl = htmlEscape(verifyUrl);
  return {
    subject: 'Confirm your email for AgentCache.ai',
    text: `Welcome to AgentCache.ai!\n\nPlease confirm your email by clicking this link: ${verifyUrl}\n\nIf you did not request this, you can ignore this message.`,
    html: `<!doctype html><html><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
      <h2>Welcome to AgentCache.ai ⚡</h2>
      <p>Confirm your email to get early access and your demo API key.</p>
      <p><a href="${safeUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Confirm email</a></p>
      <p style="color:#555">Or paste this link in your browser:<br/>${safeUrl}</p>
      <hr style="border:none;height:1px;background:#eee"/>
      <p style="color:#666">You received this because your email was submitted on agentcache.ai</p>
    </body></html>`,
  };
}

async function sendEmail({ to, fromEmail, fromName, verifyUrl }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.SENDGRID_API;
  const { subject, text, html } = emailTemplate({ verifyUrl });

  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to, subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend error: ${res.status}`);
    return true;
  }
  if (SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid error: ${res.status}`);
    return true;
  }
  throw new Error('No email provider configured');
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || 'support@agentcache.ai';
  const FROM_NAME = process.env.MAIL_FROM_NAME || 'AgentCache.ai';

  if (!url || !token) return json({ error: 'Service not configured' }, 500);

  try {
    const body = await req.json();
    const email = (body.email || '').trim();
    if (!/.+@.+\..+/.test(email)) return json({ error: 'Valid email required' }, 400);

    // metadata
    const u = new URL(req.url);
    const utm = {
      source: body.utm_source || u.searchParams.get('utm_source') || '',
      medium: body.utm_medium || u.searchParams.get('utm_medium') || '',
      campaign: body.utm_campaign || u.searchParams.get('utm_campaign') || '',
    };
    const referer = req.headers.get('referer') || '';
    const ua = req.headers.get('user-agent') || '';
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || '';
    const now = new Date().toISOString();

    // generate verify token (UUID ok in edge)
    const tokenId = crypto.randomUUID();
    const verifyKey = `verify:${tokenId}`;

    const commands = [
      ['SADD', 'subscribers:pending', email],
      [
        'HSET',
        `subscriber:${email}`,
        'email',
        email,
        'status',
        'pending',
        'createdAt',
        now,
        'ip',
        ip,
        'ua',
        ua,
        'referer',
        referer,
        'utm',
        JSON.stringify(utm),
      ],
      ['SETEX', verifyKey, 172800, email], // 48h
    ];

    await upstashPipeline(commands, url, token);

    const verifyUrl = `${u.origin}/api/verify?token=${tokenId}`;
    await sendEmail({ to: email, fromEmail: FROM_EMAIL, fromName: FROM_NAME, verifyUrl });

    // Optional Slack alert
    const slack = process.env.SLACK_WEBHOOK_URL;
    if (slack) {
      await fetch(slack, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `🆕 Waitlist: ${email}  utm=${utm.source}/${utm.medium}/${utm.campaign}` }),
      }).catch(() => { });
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: 'Unexpected error', details: err?.message || String(err) }, 500);
  }
}
