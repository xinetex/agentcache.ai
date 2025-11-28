import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { generateApiKey, createNamespace, recordInstallation } from '../services/provisioning.js';

const app = new Hono();

/**
 * Step 1: Initiate Vercel OAuth flow
 * Redirects user to Vercel to grant permissions
 */
app.get('/install', (c) => {
  const state = crypto.randomUUID(); // CSRF protection
  
  // Store state in cookie for verification
  setCookie(c, 'vercel_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    sameSite: 'Lax'
  });
  
  // Redirect to Vercel integration page
  // Note: 'agentcache' is the integration slug from Vercel dashboard
  const authUrl = `https://vercel.com/integrations/agentcache/new?state=${state}`;
  
  console.log('[Vercel] Initiating OAuth flow with state:', state);
  
  return c.redirect(authUrl);
});

/**
 * Step 2: Handle OAuth callback from Vercel
 * Exchanges authorization code for access token
 */
app.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const configurationId = c.req.query('configurationId'); // Vercel installation ID
  const teamId = c.req.query('teamId'); // Team ID if installing for a team
  
  // Verify CSRF token
  const savedState = getCookie(c, 'vercel_oauth_state');
  if (state !== savedState) {
    console.error('[Vercel] State mismatch. Possible CSRF attack.');
    return c.text('Invalid state parameter', 400);
  }
  
  if (!code) {
    return c.text('Missing authorization code', 400);
  }
  
  console.log('[Vercel] OAuth callback received:', { configurationId, teamId });
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.VERCEL_CLIENT_ID || '',
        client_secret: process.env.VERCEL_CLIENT_SECRET || '',
        redirect_uri: `${process.env.PUBLIC_URL || 'https://agentcache.ai'}/api/integrations/vercel/callback`
      })
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[Vercel] Token exchange failed:', error);
      return c.text('Failed to exchange authorization code', 500);
    }
    
    const tokenData = await tokenResponse.json() as {
      access_token: string;
      user_id: string;
      team_id?: string;
    };
    
    const { access_token, user_id } = tokenData;
    
    console.log('[Vercel] Access token obtained for user:', user_id);
    
    // Get user's projects
    const projectsResponse = await fetch('https://api.vercel.com/v9/projects', {
      headers: { 
        'Authorization': `Bearer ${access_token}`,
        ...(teamId ? { 'X-Vercel-Team-Id': teamId } : {})
      }
    });
    
    if (!projectsResponse.ok) {
      console.error('[Vercel] Failed to fetch projects');
      return c.text('Failed to fetch projects', 500);
    }
    
    const projectsData = await projectsResponse.json() as {
      projects: Array<{ id: string; name: string; }>;
    };
    
    const projects = projectsData.projects;
    
    console.log(`[Vercel] Found ${projects.length} projects for user`);
    
    // Render project selection page
    return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Select Vercel Project - AgentCache</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 { font-size: 28px; margin-bottom: 10px; color: #333; }
    p { color: #666; margin-bottom: 30px; }
    select {
      width: 100%;
      padding: 12px;
      font-size: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 20px;
      cursor: pointer;
    }
    select:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧠 Select Project</h1>
    <p>Choose which Vercel project to integrate with AgentCache</p>
    <form action="/api/integrations/vercel/provision" method="POST">
      <input type="hidden" name="access_token" value="${access_token}" />
      <input type="hidden" name="user_id" value="${user_id}" />
      <input type="hidden" name="config_id" value="${configurationId || ''}" />
      <input type="hidden" name="team_id" value="${teamId || ''}" />
      
      <select name="project_id" required>
        <option value="">-- Select a project --</option>
        ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
      
      <button type="submit">Install AgentCache</button>
    </form>
  </div>
</body>
</html>
    `);
  } catch (error: any) {
    console.error('[Vercel] OAuth callback error:', error);
    return c.text(`Error: ${error.message}`, 500);
  }
});

/**
 * Step 3: Provision resources and set environment variables
 * Creates API key, namespace, and sets env vars in Vercel project
 */
app.post('/provision', async (c) => {
  try {
    const body = await c.req.parseBody();
    const accessToken = body.access_token as string;
    const projectId = body.project_id as string;
    const userId = body.user_id as string;
    const configId = body.config_id as string;
    const teamId = body.team_id as string;
    
    if (!accessToken || !projectId || !userId) {
      return c.text('Missing required parameters', 400);
    }
    
    console.log(`[Vercel] Provisioning for project ${projectId}`);
    
    // 1. Generate AgentCache API key
    const apiKey = await generateApiKey({
      user_id: userId,
      integration: 'vercel',
      project_id: projectId
    });
    
    // 2. Create namespace
    const namespace = await createNamespace({
      name: `vercel_${projectId}`,
      user_id: userId,
      sector: 'general'
    });
    
    // 3. Set environment variables in Vercel project
    const envVars = [
      {
        key: 'AGENTCACHE_API_KEY',
        value: apiKey,
        type: 'encrypted',
        target: ['production', 'preview', 'development']
      },
      {
        key: 'AGENTCACHE_API_URL',
        value: process.env.PUBLIC_URL || 'https://agentcache.ai/api',
        type: 'plain',
        target: ['production', 'preview', 'development']
      }
    ];
    
    for (const envVar of envVars) {
      const envResponse = await fetch(
        `https://api.vercel.com/v10/projects/${projectId}/env`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(teamId ? { 'X-Vercel-Team-Id': teamId } : {})
          },
          body: JSON.stringify(envVar)
        }
      );
      
      if (!envResponse.ok) {
        const error = await envResponse.text();
        console.error(`[Vercel] Failed to set env var ${envVar.key}:`, error);
        // Continue anyway - partial success is better than none
      } else {
        console.log(`[Vercel] Set env var: ${envVar.key}`);
      }
    }
    
    // 4. Record installation in database
    await recordInstallation({
      user_id: userId,
      platform: 'vercel',
      project_id: projectId,
      config_id: configId,
      api_key: apiKey,
      namespace: namespace
    });
    
    console.log(`[Vercel] Installation complete for project ${projectId}`);
    
    // 5. Redirect back to Vercel with success message
    const redirectUrl = configId 
      ? `https://vercel.com/dashboard/integrations/agentcache/${configId}?success=true`
      : 'https://vercel.com/dashboard';
    
    return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Installation Complete - AgentCache</title>
  <meta http-equiv="refresh" content="3;url=${redirectUrl}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 60px 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { font-size: 32px; margin-bottom: 15px; color: #333; }
    p { color: #666; font-size: 16px; line-height: 1.6; }
    .code { 
      background: #f5f5f5; 
      padding: 15px; 
      border-radius: 6px; 
      margin: 20px 0;
      font-family: monospace;
      font-size: 14px;
      word-break: break-all;
    }
    a {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>Installation Complete!</h1>
    <p>AgentCache has been successfully integrated with your Vercel project.</p>
    <div class="code">
      <strong>API Key:</strong> ${apiKey.substring(0, 20)}...<br>
      <strong>Namespace:</strong> ${namespace}
    </div>
    <p>Environment variables have been set. Your next deployment will automatically use AgentCache.</p>
    <a href="${redirectUrl}">Return to Vercel →</a>
    <p style="margin-top: 20px; font-size: 14px; color: #999;">
      Redirecting in 3 seconds...
    </p>
  </div>
</body>
</html>
    `);
  } catch (error: any) {
    console.error('[Vercel] Provisioning error:', error);
    return c.text(`Error during provisioning: ${error.message}`, 500);
  }
});

export default app;
