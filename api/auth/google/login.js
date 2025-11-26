export default async function handler(req, res) {
  // Google OAuth configuration
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://agentcache.ai' : 'http://localhost:3000');
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  // Build Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection

  // Redirect to Google
  res.redirect(googleAuthUrl.toString());
}
