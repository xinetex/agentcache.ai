# Vercel AI SDK Integration

AgentCache works seamlessly with the Vercel AI SDK `streamText` and `generateText` functions.

## Next.js App Router

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { agentcache } from 'agentcache';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1].content;

  // 1. Check Cache
  const cached = await agentcache.get(lastMessage);
  if (cached) {
    return new Response(cached);
  }

  // 2. Generate Stream
  const result = await streamText({
    model: google('gemini-1.5-flash'),
    messages,
    onFinish: async ({ text }) => {
      // 3. Cache Result (Fire and forget)
      await agentcache.set(lastMessage, text);
    },
  });

  return result.toDataStreamResponse();
}
```
