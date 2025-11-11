# Building and Publishing agentcache-client

## Quick Build

```bash
cd packages/client

# Install dependencies
npm install

# Build the package
npm run build

# This creates:
# - dist/index.js (CommonJS)
# - dist/index.mjs (ES Module)
# - dist/index.d.ts (TypeScript types)
```

## Test Locally

```bash
# In packages/client/
npm link

# In your test project
npm link agentcache-client

# Test it
node test.js
```

**test.js:**
```javascript
const { AgentCache } = require('agentcache-client');

const cache = new AgentCache('ac_demo_test123');

cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }]
}).then(result => {
  console.log('Result:', result);
}).catch(err => {
  console.error('Error:', err);
});
```

## Publish to NPM

### First Time Setup

```bash
# Login to NPM
npm login
# Enter credentials for AgentCache.ai NPM account
```

### Publish

```bash
cd packages/client

# Build first
npm run build

# Publish (checks prepublishOnly script automatically)
npm publish

# For first publish, make it public
npm publish --access public
```

### Version Bumping

```bash
# Patch (1.0.0 → 1.0.1)
npm version patch

# Minor (1.0.0 → 1.1.0)
npm version minor

# Major (1.0.0 → 2.0.0)  
npm version major

# Then publish
npm publish
```

## Update Landing Page

After publishing, update `public/index.html`:

**Change from:**
```javascript
// REST API - works now, no installation needed
const apiKey = 'ac_demo_test123';
```

**To:**
```javascript
// 1) Install
// npm i agentcache-client
import { AgentCache } from 'agentcache-client';

const cache = new AgentCache('ac_demo_test123');

// 2) Use it
const result = await cache.get({
  provider: 'openai',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is Python?' }]
});

if (result.hit) {
  console.log('✅ Cache hit!', result.latency_ms + 'ms');
  return result.response;
}
```

## Package Contents

```
agentcache-client/
├── dist/
│   ├── index.js        # CommonJS (require)
│   ├── index.mjs       # ES Module (import)
│   └── index.d.ts      # TypeScript types
├── README.md
├── LICENSE
└── package.json
```

## Verification

After publishing:

```bash
# Install from NPM
npm install agentcache-client

# Test
node -e "const {AgentCache} = require('agentcache-client'); console.log(new AgentCache('test'))"
```

## Troubleshooting

### Error: Module not found

Make sure `tsup` built successfully:
```bash
ls -la dist/
```

### TypeScript errors

Check `tsconfig.json` is correct and run:
```bash
npm run build
```

### Publish permission denied

Make sure you're logged in to the right NPM account:
```bash
npm whoami
```

## CI/CD (Future)

Add to `.github/workflows/publish.yml`:

```yaml
name: Publish Package
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: cd packages/client && npm install
      - run: cd packages/client && npm run build
      - run: cd packages/client && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Success Criteria

- ✅ `npm install agentcache-client` works
- ✅ TypeScript types available
- ✅ Works in Node.js (CommonJS and ESM)
- ✅ Works in browsers (via bundler)
- ✅ README shows on [npmjs.com/package/agentcache-client](https://npmjs.com/package/agentcache-client)
- ✅ Can import and use immediately
