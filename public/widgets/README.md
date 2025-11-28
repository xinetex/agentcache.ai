# AgentCache Widgets

Embeddable monitoring widgets for partner integrations.

## Available Widgets

### AgentCache Monitor (`agentcache-monitor.html`)

Real-time monitoring dashboard for JettyThunder users to track their file transfer cache activity.

**Features:**
- Live connection status with edge locations
- Performance metrics (cache hit rate, bandwidth saved)
- Active file transfers with progress bars
- Recent activity feed
- Cache status overview

**Usage:**
```html
<iframe 
  src="https://agentcache.ai/widgets/agentcache-monitor.html?apiKey=USER_API_KEY&userId=USER_ID"
  width="100%" 
  height="800" 
  frameborder="0"
></iframe>
```

**Parameters:**
- `apiKey` (required): User's AgentCache API key
- `userId` (required): User's unique ID
- `period` (optional): Time period for metrics (`1h`, `24h`, `7d`, `30d`) - default: `24h`
- `theme` (optional): Color theme (`dark`, `light`) - default: `dark`

**API Dependency:**
Requires `GET /api/jetty/user-stats` endpoint to be accessible.

**Testing:**
```bash
# Serve locally
python3 -m http.server 8080

# Open in browser
open http://localhost:8080/widgets/agentcache-monitor.html?apiKey=ac_demo_test123&userId=test_user
```

**Integration Documentation:**
See `/docs/JETTYTHUNDER_MONITOR_INTEGRATION.md` for complete integration guide.

## Development

### Adding a New Widget

1. Create HTML file in this directory: `new-widget.html`
2. Use self-contained approach (inline CSS/JS or CDN dependencies)
3. Accept configuration via URL params: `?param1=value1&param2=value2`
4. Add CORS-friendly headers if needed
5. Test locally before deploying
6. Document in this README

### Widget Standards

**✅ Do:**
- Keep widgets self-contained (single HTML file when possible)
- Use URL params for configuration
- Implement error states for missing/invalid config
- Support dark theme by default
- Auto-refresh data at reasonable intervals (5-10 seconds)
- Show loading states
- Handle API errors gracefully

**❌ Don't:**
- Hardcode API keys or credentials
- Make excessive API requests (max 1 req/5s)
- Depend on external frameworks (unless via CDN)
- Assume parent page context
- Store sensitive data in localStorage

### Styling

Use Tailwind CSS via CDN for consistency:
```html
<script src="https://cdn.tailwindcss.com"></script>
```

**Color Palette (Dark Theme):**
- Background: `bg-slate-950`
- Cards: `bg-slate-900/50`
- Borders: `border-slate-800`
- Text Primary: `text-slate-100`
- Text Secondary: `text-slate-400`
- Accent: `text-sky-400` / `text-emerald-400` / `text-amber-400`

### Testing Checklist

- [ ] Widget loads without errors
- [ ] Configuration via URL params works
- [ ] Missing params show helpful error message
- [ ] API auth works correctly
- [ ] Data refreshes automatically
- [ ] Loading states display properly
- [ ] Error states display properly
- [ ] Responsive on different screen sizes
- [ ] Works in iframe embed
- [ ] Works cross-origin (CORS)

## Deployment

Widgets are automatically deployed when pushed to `main` branch (Vercel auto-deploy).

**Production URLs:**
- Monitor Widget: `https://agentcache.ai/widgets/agentcache-monitor.html`

**Testing:**
After deployment, verify:
1. Widget loads at production URL
2. Demo credentials work: `?apiKey=ac_demo_test123&userId=test_user`
3. CORS allows embedding from partner domains
4. API endpoints are accessible

## Support

**For widget users:**
- Integration guides in `/docs/`
- Demo credentials: `apiKey=ac_demo_test123`, `userId=test_user`
- Support email: support@agentcache.ai

**For developers:**
- Widget source code in this directory
- API documentation in `/docs/`
- Example integrations in integration guides
