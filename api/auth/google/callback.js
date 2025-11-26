import { generateToken } from '../../../lib/jwt.js';
import { query, transaction } from '../../../lib/db.js';

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/login.html?error=google_auth_failed');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://agentcache.ai' : 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const googleUser = await userResponse.json();

    if (!googleUser.email) {
      throw new Error('No email found');
    }

    // Find or create user
    const result = await transaction(async (client) => {
      // Check if user exists with this email
      let userResult = await client.query(
        'SELECT id, email, full_name, organization_id, role FROM users WHERE email = $1',
        [googleUser.email.toLowerCase()]
      );

      let user;

      if (userResult.rows.length === 0) {
        // Create new user
        const newUserResult = await client.query(`
          INSERT INTO users (email, full_name, is_active, password_hash)
          VALUES ($1, $2, $3, $4)
          RETURNING id, email, full_name, organization_id, role
        `, [
          googleUser.email.toLowerCase(),
          googleUser.name || googleUser.email.split('@')[0],
          true,
          'oauth_google' // Placeholder - OAuth users don't have passwords
        ]);
        user = newUserResult.rows[0];
      } else {
        user = userResult.rows[0];
      }

      // Store or update Google connection
      await client.query(`
        INSERT INTO oauth_connections (user_id, provider, provider_user_id, provider_username)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, provider)
        DO UPDATE SET provider_username = $4, updated_at = NOW()
      `, [user.id, 'google', googleUser.id, googleUser.email]);

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
    console.error('Google OAuth error:', error);
    res.redirect('/login.html?error=google_auth_failed');
  }
}
