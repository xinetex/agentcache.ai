# AgentCache CLI

One-command installer for AgentCache.ai - Automatically integrate AI caching into your project.

## Quick Start

```bash
npx agentcache-init
```

That's it! The CLI will:
- ✅ Auto-detect your framework (Next.js, Express, Hono, etc.)
- ✅ Install `agentcache-client` package
- ✅ Create `agentcache.config.js` with your API key
- ✅ Update `.env` file with your credentials
- ✅ Generate example integration code
- ✅ Provide next steps and documentation links

## What It Does

### 1. Framework Detection
Automatically detects:
- **Next.js** - Creates `app/api/chat/route.ts`
- **Express** - Creates `routes/chat.js`
- **Hono** - Creates example middleware
- **Vercel Serverless** - Creates serverless function
- **Generic** - Creates universal example

### 2. Package Manager Detection
Supports:
- npm
- pnpm
- yarn
- bun

### 3. AI Provider Detection
Detects installed AI SDKs:
- OpenAI (`openai`)
- Anthropic (`@anthropic-ai/sdk`)
- Google AI (`@google/generative-ai`)
- Cohere (`cohere-ai`)

## Usage

### Interactive Mode (Recommended)

```bash
npx agentcache-init
```

Follow the prompts to customize your setup.

### With Options

```bash
# Use demo API key for testing
npx agentcache-init --api-key=ac_demo_test123

# Skip package installation
npx agentcache-init --no-install

# Specify framework
npx agentcache-init --framework=nextjs
```

## Example Output

```
╔═══════════════════════════════════╗
║   AgentCache CLI Installer        ║
╚═══════════════════════════════════╝

Auto-detected:
  Framework: nextjs
  Package manager: pnpm
  AI Providers: OpenAI, Anthropic

✔ Select your framework: › Next.js
✔ Select your package manager: › pnpm
✔ Enter your AgentCache API key: … ac_live_abc123
✔ Install agentcache-client package? … yes
✔ Create agentcache.config.js? … yes
✔ Add API key to .env file? … yes
✔ Create example integration file? … yes

✔ Installed agentcache-client
✔ Created agentcache.config.js
✔ Updated .env.local
✔ Created example: app/api/chat/route.ts

✓ AgentCache setup complete!

Next steps:
  1. Review agentcache.config.js
  2. Check the example integration file
  3. Start your dev server and test caching

Documentation:
  https://agentcache.ai/docs

Dashboard:
  https://agentcache.ai/dashboard-new.html
```

## Files Created

### `agentcache.config.js`
Configuration file with:
- API key (from environment or hardcoded)
- Cache TTL settings
- Provider configuration
- Debug options

### `.env` or `.env.local`
Adds:
```bash
AGENTCACHE_API_KEY=your_key_here
```

### Example Integration File
Framework-specific example showing:
1. How to check cache before LLM call
2. How to call your LLM provider
3. How to store response in cache

**Locations:**
- Next.js: `app/api/chat/route.ts`
- Express: `routes/chat.js`
- Generic: `agentcache-example.js`

## Get Your API Key

1. Visit [agentcache.ai](https://agentcache.ai)
2. Click "Sign up free"
3. Register with your email
4. Copy your API key (starts with `ac_live_`)

**For testing:** Use `ac_demo_test123` (unlimited, no signup required)

## Requirements

- Node.js >= 16.0.0
- npm, pnpm, yarn, or bun

## Commands

```bash
# Initialize AgentCache in current project
npx agentcache-init

# Or install globally
npm install -g agentcache-cli
agentcache-init

# Show help
npx agentcache-init --help
```

## Troubleshooting

### "Command not found"
Make sure you have Node.js >= 16 installed:
```bash
node --version
```

### "API key invalid"
- API keys must start with `ac_`
- Demo key: `ac_demo_test123`
- Get a real key at: https://agentcache.ai/login.html

### "Package installation failed"
Try manually:
```bash
npm install agentcache-client
# or
pnpm add agentcache-client
```

### "Permission denied"
On Linux/Mac, you may need:
```bash
sudo npx agentcache-init
```

## Manual Installation

If you prefer manual setup:

1. Install package:
   ```bash
   npm install agentcache-client
   ```

2. Add to your code:
   ```javascript
   import { AgentCache } from 'agentcache-client';
   
   const cache = new AgentCache(process.env.AGENTCACHE_API_KEY);
   
   // Before calling your LLM
   const cached = await cache.get({
     provider: 'openai',
     model: 'gpt-4',
     messages: [...]
   });
   
   if (cached.hit) {
     return cached.response; // Fast!
   }
   
   // Call LLM, then store
   const response = await openai.chat.completions.create({...});
   await cache.set({...}, response);
   ```

## Support

- **Docs:** https://agentcache.ai/docs
- **Dashboard:** https://agentcache.ai/dashboard-new.html
- **GitHub:** https://github.com/xinetex/agentcache.ai
- **Email:** support@agentcache.ai

## License

MIT © AgentCache.ai
