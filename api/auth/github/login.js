export default async function handler(req, res) {
  // GitHub OAuth configuration
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = 'https://agentcache.ai/api/auth/github/callback';
  
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  // Build GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', clientId);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', 'user:email');
  githubAuthUrl.searchParams.set('state', crypto.randomUUID()); // CSRF protection

  // Redirect to GitHub
  res.redirect(githubAuthUrl.toString());
}
