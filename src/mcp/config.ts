/**
 * Resolve the credential used by the AgentCache MCP client.
 * A missing key is a configuration error: never fall back to a shared demo key.
 */
export function getAgentCacheApiKey(override?: string): string {
  const apiKey = override?.trim() || process.env.AGENTCACHE_API_KEY?.trim() || process.env.API_KEY?.trim();
  if (!apiKey) {
    throw new Error('AGENTCACHE_API_KEY is required to use AgentCache MCP tools.');
  }
  return apiKey;
}
