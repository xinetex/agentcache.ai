/** AI Provider Bridge for Moonshot (kimi)
 * 
 * This bridges agentcache-ai service from OpenAI to Moonshot
 * to bypass OpenAI quota issues
 */

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'kimi' | 'moonshot';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export const moonshotConfig: AIProviderConfig = {
  provider: 'kimi',
  endpoint: 'https://api.moonshot.cn/v1/chat/completions',
  model: 'moonshot-v1-8k',
  maxTokens: 4000,
  temperature: 0.7
};

export const vercelAIConfig = {
  provider: 'vercel-ai-gateway',
  endpoint: 'https://api.vercel.com/drgnflai-jetty/ai-gateway',
  model: 'vercel-ai-gateway/moonshotai/kimi-k2',
  maxTokens: 8000,
  temperature: 0.7
};

export async function callMoonshotAPI(messages: any[], config = moonshotConfig) {
  const response = await fetch(config.endpoint!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    })
  });

  if (!response.ok) {
    throw new Error(`Moonshot API Error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

export async function callVercelAIGateway(messages: any[], config = vercelAIConfig) {
  const response = await fetch("https://api.vercel.com/drgnflai-jetty/ai-gateway/moonshotai/kimi-k2", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VERCEL_AI_GATEWAY_TOKEN}`
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2',
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

// Default to vercel AI gateway for better reliability
export const defaultAIProvider = callVercelAIGateway;
export const defaultAIProviderConfig = vercelAIConfig;