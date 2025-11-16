// /api/account.js - User Account Management API
export const config = { runtime: 'edge' };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    },
  });
}

// Hash string using SHA-256
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate random API key
function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `ac_live_${hex.slice(0, 48)}`;
}

// Redis helper
async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

// Send email via Resend
async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return { success: false, error: 'Email not configured' };
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'AgentCache <noreply@agentcache.ai>',
      to,
      subject,
      html
    })
  });
  
  return await res.json();
}

// Validate email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
function isValidPassword(password) {
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password);
}

// POST /api/account?action=register
async function register(req) {
  const body = await req.json();
  const { email, password, name } = body;

  // Validate input
  if (!email || !password) {
    return json({ error: 'Email and password required' }, 400);
  }
  
  if (!isValidEmail(email)) {
    return json({ error: 'Invalid email format' }, 400);
  }
  
  if (!isValidPassword(password)) {
    return json({ 
      error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
    }, 400);
  }

  const emailLower = email.toLowerCase();
  const emailHash = await sha256(emailLower);
  
  // Check if user already exists
  const existingUser = await redis('HGET', `user:${emailHash}`, 'email');
  if (existingUser) {
    return json({ error: 'User already exists' }, 409);
  }

  // Hash password
  const passwordHash = await sha256(password);
  
  // Generate API key
  const apiKey = generateApiKey();
  const apiKeyHash = await sha256(apiKey);
  
  // Generate verification token
  const verifyToken = crypto.randomUUID();
  
  // Store user data in Redis
  const userData = {
    email: emailLower,
    name: name || emailLower.split('@')[0],
    passwordHash,
    apiKeyHash,
    plan: 'starter',
    quota: 10000,
    createdAt: Date.now(),
    verified: false,
    verifyToken
  };

  // Store user
  await redis('HSET', `user:${emailHash}`, 
    'email', userData.email,
    'name', userData.name,
    'passwordHash', userData.passwordHash,
    'apiKeyHash', userData.apiKeyHash,
    'plan', userData.plan,
    'quota', userData.quota.toString(),
    'createdAt', userData.createdAt.toString(),
    'verified', 'false',
    'verifyToken', userData.verifyToken
  );
  
  // Store API key mapping
  await redis('HSET', `key:${apiKeyHash}`, 
    'email', userData.email,
    'plan', userData.plan,
    'quota', userData.quota.toString()
  );
  
  // Store verification token
  await redis('SETEX', `verify:${verifyToken}`, 172800, emailHash); // 48h TTL
  
  // Send verification email
  const verifyUrl = `https://agentcache.ai/login.html?token=${verifyToken}`;
  await sendEmail(emailLower, 'Verify your AgentCache account', `
    <h2>Welcome to AgentCache!</h2>
    <p>Hi ${userData.name},</p>
    <p>Thanks for signing up. Please verify your email address to get started:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;text-decoration:none;border-radius:8px;">Verify Email</a></p>
    <p>Or copy this link: ${verifyUrl}</p>
    <p>This link expires in 48 hours.</p>
    <p>Best,<br>The AgentCache Team</p>
  `);

  return json({
    success: true,
    message: 'Account created! Check your email to verify.',
    userId: emailHash,
    apiKey // Send API key in response (store securely!)
  }, 201);
}

// POST /api/account?action=login
async function login(req) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return json({ error: 'Email and password required' }, 400);
  }

  const emailLower = email.toLowerCase();
  const emailHash = await sha256(emailLower);
  
  // Get user data
  const userData = await redis('HGETALL', `user:${emailHash}`);
  if (!userData || userData.length === 0) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Convert array to object
  const user = {};
  for (let i = 0; i < userData.length; i += 2) {
    user[userData[i]] = userData[i + 1];
  }

  // Verify password
  const passwordHash = await sha256(password);
  if (user.passwordHash !== passwordHash) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Check if verified
  if (user.verified !== 'true') {
    return json({ 
      error: 'Email not verified',
      requiresVerification: true 
    }, 403);
  }

  // Get API key
  const apiKeyHash = user.apiKeyHash;
  const apiKeyData = await redis('HGETALL', `key:${apiKeyHash}`);
  
  // Generate session token
  const sessionToken = crypto.randomUUID();
  await redis('SETEX', `session:${sessionToken}`, 86400, emailHash); // 24h session

  return json({
    success: true,
    session: sessionToken,
    user: {
      email: user.email,
      name: user.name,
      plan: user.plan,
      quota: parseInt(user.quota),
      createdAt: parseInt(user.createdAt)
    }
  });
}

// POST /api/account?action=verify
async function verify(req) {
  const body = await req.json();
  const { token } = body;

  if (!token) {
    return json({ error: 'Verification token required' }, 400);
  }

  // Get email hash from token
  const emailHash = await redis('GET', `verify:${token}`);
  if (!emailHash) {
    return json({ error: 'Invalid or expired verification token' }, 400);
  }

  // Mark user as verified
  await redis('HSET', `user:${emailHash}`, 'verified', 'true');
  
  // Delete verification token
  await redis('DEL', `verify:${token}`);

  return json({
    success: true,
    message: 'Email verified! You can now log in.'
  });
}

// POST /api/account?action=get-api-key
async function getApiKey(req) {
  const sessionToken = req.headers.get('x-session-token');
  
  if (!sessionToken) {
    return json({ error: 'Session token required' }, 401);
  }

  // Get user from session
  const emailHash = await redis('GET', `session:${sessionToken}`);
  if (!emailHash) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Get user's API key hash
  const apiKeyHash = await redis('HGET', `user:${emailHash}`, 'apiKeyHash');
  if (!apiKeyHash) {
    return json({ error: 'API key not found' }, 404);
  }

  // Note: We can't retrieve the original API key, only show the hash
  // User should have saved it during registration
  return json({
    apiKeyHash: apiKeyHash.slice(0, 16) + '...',
    message: 'For security, full API key is only shown once during registration'
  });
}

// POST /api/account?action=reset-api-key
async function resetApiKey(req) {
  const sessionToken = req.headers.get('x-session-token');
  
  if (!sessionToken) {
    return json({ error: 'Session token required' }, 401);
  }

  // Get user from session
  const emailHash = await redis('GET', `session:${sessionToken}`);
  if (!emailHash) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  // Generate new API key
  const newApiKey = generateApiKey();
  const newApiKeyHash = await sha256(newApiKey);
  
  // Get user data
  const userData = await redis('HGETALL', `user:${emailHash}`);
  const user = {};
  for (let i = 0; i < userData.length; i += 2) {
    user[userData[i]] = userData[i + 1];
  }

  // Delete old API key mapping
  if (user.apiKeyHash) {
    await redis('DEL', `key:${user.apiKeyHash}`);
  }

  // Update user with new API key hash
  await redis('HSET', `user:${emailHash}`, 'apiKeyHash', newApiKeyHash);
  
  // Create new API key mapping
  await redis('HSET', `key:${newApiKeyHash}`, 
    'email', user.email,
    'plan', user.plan,
    'quota', user.quota
  );

  return json({
    success: true,
    apiKey: newApiKey,
    message: 'API key reset successfully. Save this key securely!'
  });
}

// POST /api/account?action=update-profile
async function updateProfile(req) {
  const sessionToken = req.headers.get('x-session-token');
  
  if (!sessionToken) {
    return json({ error: 'Session token required' }, 401);
  }

  // Get user from session
  const emailHash = await redis('GET', `session:${sessionToken}`);
  if (!emailHash) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const body = await req.json();
  const { name } = body;

  if (name) {
    await redis('HSET', `user:${emailHash}`, 'name', name);
  }

  return json({
    success: true,
    message: 'Profile updated'
  });
}

// POST /api/account?action=request-reset
async function requestReset(req) {
  const body = await req.json();
  const { email } = body;

  if (!email || !isValidEmail(email)) {
    return json({ error: 'Valid email required' }, 400);
  }

  const emailLower = email.toLowerCase();
  const emailHash = await sha256(emailLower);
  
  // Check if user exists
  const userEmail = await redis('HGET', `user:${emailHash}`, 'email');
  
  // Always return success to prevent email enumeration
  if (!userEmail) {
    return json({
      success: true,
      message: 'If account exists, password reset email has been sent'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomUUID();
  
  // Store reset token with 1-hour expiry
  await redis('SETEX', `reset:${resetToken}`, 3600, emailHash);
  
  // Get user name
  const userName = await redis('HGET', `user:${emailHash}`, 'name');
  
  // Send reset email
  const resetUrl = `https://agentcache.ai/login.html?reset=${resetToken}`;
  await sendEmail(emailLower, 'Reset your AgentCache password', `
    <h2>Password Reset Request</h2>
    <p>Hi ${userName || 'there'},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;text-decoration:none;border-radius:8px;">Reset Password</a></p>
    <p>Or copy this link: ${resetUrl}</p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
    <p>Best,<br>The AgentCache Team</p>
  `);

  return json({
    success: true,
    message: 'If account exists, password reset email has been sent'
  });
}

// POST /api/account?action=reset-password
async function resetPassword(req) {
  const body = await req.json();
  const { token, newPassword } = body;

  if (!token || !newPassword) {
    return json({ error: 'Token and new password required' }, 400);
  }

  if (!isValidPassword(newPassword)) {
    return json({ 
      error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
    }, 400);
  }

  // Get email hash from reset token
  const emailHash = await redis('GET', `reset:${token}`);
  if (!emailHash) {
    return json({ error: 'Invalid or expired reset token' }, 400);
  }

  // Hash new password
  const newPasswordHash = await sha256(newPassword);
  
  // Update password
  await redis('HSET', `user:${emailHash}`, 'passwordHash', newPasswordHash);
  
  // Delete reset token
  await redis('DEL', `reset:${token}`);
  
  // Invalidate all existing sessions for this user
  // (Optional: more secure but requires session tracking)

  return json({
    success: true,
    message: 'Password reset successfully. You can now log in.'
  });
}

// POST /api/account?action=resend-verification
async function resendVerification(req) {
  const body = await req.json();
  const { email } = body;

  if (!email || !isValidEmail(email)) {
    return json({ error: 'Valid email required' }, 400);
  }

  const emailLower = email.toLowerCase();
  const emailHash = await sha256(emailLower);
  
  // Get user data
  const userData = await redis('HGETALL', `user:${emailHash}`);
  if (!userData || userData.length === 0) {
    // Don't reveal if user exists
    return json({
      success: true,
      message: 'If account exists and is unverified, verification email has been sent'
    });
  }

  // Convert array to object
  const user = {};
  for (let i = 0; i < userData.length; i += 2) {
    user[userData[i]] = userData[i + 1];
  }

  // Check if already verified
  if (user.verified === 'true') {
    return json({
      success: true,
      message: 'Account is already verified'
    });
  }

  // Generate new verification token
  const verifyToken = crypto.randomUUID();
  
  // Update user with new token
  await redis('HSET', `user:${emailHash}`, 'verifyToken', verifyToken);
  
  // Store verification token
  await redis('SETEX', `verify:${verifyToken}`, 172800, emailHash); // 48h TTL
  // Send verification email
  const verifyUrl = `https://agentcache.ai/login.html?token=${verifyToken}`;
  await sendEmail(emailLower, 'Verify your AgentCache account', `
    <h2>Verify Your Email</h2>
    <p>Hi ${user.name},</p>
    <p>Please verify your email address to activate your AgentCache account:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;text-decoration:none;border-radius:8px;">Verify Email</a></p>
    <p>Or copy this link: ${verifyUrl}</p>
    <p>This link expires in 48 hours.</p>
    <p>Best,<br>The AgentCache Team</p>
  `);

  return json({
    success: true,
    message: 'Verification email sent'
  });
}

// Main handler
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, X-Session-Token'
      }
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'register':
        return await register(req);
      case 'login':
        return await login(req);
      case 'verify':
        return await verify(req);
      case 'get-api-key':
        return await getApiKey(req);
      case 'reset-api-key':
        return await resetApiKey(req);
      case 'update-profile':
        return await updateProfile(req);
      case 'request-reset':
        return await requestReset(req);
      case 'reset-password':
        return await resetPassword(req);
      case 'resend-verification':
        return await resendVerification(req);
      default:
        return json({ error: 'Invalid action' }, 400);
    }
  } catch (err) {
    console.error('Account API error:', err);
    return json({ error: 'Internal server error', details: err.message }, 500);
  }
}
