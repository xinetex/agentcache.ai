import { generateToken } from '../../../lib/jwt.js';
import { query, transaction } from '../../../lib/db.js';

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/login.html?error=github_auth_failed');
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = `${process.env.VERCEL_URL || 'https://agentcache.ai'}/api/auth/github/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error || !tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const githubUser = await userResponse.json();

    // Get user's primary email
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const emails = await emailsResponse.json();
    const primaryEmail = emails.find(e => e.primary)?.email || emails[0]?.email;

    if (!primaryEmail) {
      throw new Error('No email found');
    }

    // Find or create user
    const result = await transaction(async (client) => {
      // Check if user exists with this email
      let userResult = await client.query(
        'SELECT id, email, full_name, organization_id, role FROM users WHERE email = $1',
        [primaryEmail.toLowerCase()]
      );

      let user;

      if (userResult.rows.length === 0) {
        // Create new user
        const newUserResult = await client.query(`
          INSERT INTO users (email, full_name, is_active, password_hash)
          VALUES ($1, $2, $3, $4)
          RETURNING id, email, full_name, organization_id, role
        `, [
          primaryEmail.toLowerCase(),
          githubUser.name || githubUser.login,
          true,
          'oauth_github' // Placeholder - OAuth users don't have passwords
        ]);
        user = newUserResult.rows[0];
      } else {
        user = userResult.rows[0];
      }

      // Store or update GitHub connection
      await client.query(`
        INSERT INTO oauth_connections (user_id, provider, provider_user_id, provider_username)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET provider_username = $4, updated_at = NOW()
      `, [user.id, 'github', githubUser.id.toString(), githubUser.login]);

      return user;
    });

    // Generate JWT
    const token = generateToken({
      userId: result.id,
      email: result.email,
      organizationId: result.organization_id,
      role: result.role || 'member'
    });

    // Redirect to frontend with token
    res.redirect(`/login.html?token=${token}&auth=success`);

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect('/login.html?error=github_auth_failed');
  }
}
