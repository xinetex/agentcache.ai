# Blog Automation Guide

Two ways to generate blog content for AgentCache.ai:

## Option 1: Google Gemini Gem (Manual, Flexible)

### Setup:
1. Go to https://gemini.google.com
2. Click "Create a Gem" (if available in your region)
3. Paste contents of `gemini-blog-writer.json` into the configuration

### Usage:
```
1. Your automation generates a blog skeleton with placeholders
2. Copy the markdown file content
3. Paste into Gemini Gem: "Fill in this blog skeleton: [paste content]"
4. Gem generates full article
5. Copy back to markdown file
```

**Pros**: 
- Full control, can tweak tone/style
- Good for sensitive/strategic topics
- Can chat back-and-forth to refine

**Cons**:
- Manual copy-paste workflow
- Takes 2-3 minutes per post

---

## Option 2: Automated Script (Fully Automated)

### Setup:
```bash
# Set your LLM API key
export OPENAI_API_KEY="sk-xxx"
# OR
export ANTHROPIC_API_KEY="sk-ant-xxx"
# OR
export GEMINI_API_KEY="xxx"

# Optional: Choose provider (defaults to openai)
export LLM_PROVIDER="openai"  # or "anthropic" or "gemini"
```

### Usage:
```bash
# Fill most recent blog post automatically
node scripts/fill-blog-content.js

# Or specify a specific post
node scripts/fill-blog-content.js 2025-11-16-your-post.md
```

**Pros**:
- Fully automated (GitHub Action runs this automatically)
- Consistent quality
- Uses latest context (updates weekly)

**Cons**:
- Uses API credits (~$0.05-0.15 per post)
- Less control over tone

---

## Full Automation Flow (Current Setup)

**What happens every Tuesday/Friday at 9am:**

1. **macOS launchd** triggers `blog-cron.sh`
2. **Skeleton generated**: `generate-blog-post.js` creates markdown with placeholders
3. **Content filled**: `fill-blog-content.js` uses OpenAI/Anthropic/Gemini to fill sections
4. **Committed to GitHub**: Auto-push to main branch
5. **Vercel deploys**: Blog goes live at agentcache.ai/blog.html
6. **Social snippets created**: Ready to share on Twitter/LinkedIn

You get a macOS notification when complete!

---

## Manual Override

Want to write a specific post manually?

```bash
# 1. Generate skeleton
node scripts/generate-blog-post.js technical 3

# 2. Manually edit the markdown file
code blog/posts/2025-11-16-your-title.md

# 3. Skip auto-fill and commit directly
git add blog/
git commit -m "Add custom blog post"
git push origin main
```

---

## Gemini Gem Configuration

File: `gemini-blog-writer.json`

Contains:
- **Instructions**: Detailed writing guidelines for AgentCache blog
- **Post templates**: Intro, technical, case study, tutorial formats
- **SEO keywords**: AI caching, LLM cost optimization, etc.
- **Current context**: November 2025 AI industry trends
- **Quality checklist**: What makes a good post

Use this as a prompt when creating your Gem.

---

## Cost Comparison

| Method | Cost/Post | Time | Quality |
|--------|-----------|------|---------|
| **Gemini Gem (manual)** | Free | 3 min | Excellent (you control it) |
| **OpenAI GPT-4o-mini** | $0.05 | 30 sec | Very good |
| **Anthropic Claude Haiku** | $0.08 | 30 sec | Very good |
| **Gemini API** | $0.03 | 30 sec | Good |

---

## Troubleshooting

### "No placeholders found"
The post is already complete. This is normal if you manually filled it or ran the script twice.

### "API key not found"
Set environment variable:
```bash
echo 'export OPENAI_API_KEY="sk-xxx"' >> ~/.zshrc
source ~/.zshrc
```

### "Generation failed"
- Check API key is valid
- Check API quota/billing
- Try switching provider: `export LLM_PROVIDER="anthropic"`

### Post quality is poor
- Edit `SYSTEM_PROMPT` in `fill-blog-content.js`
- Or use Gemini Gem for manual control
- Update context section with recent trends

---

## Examples

### Gemini Gem Input:
```
Fill in this blog skeleton:

---
title: How AI Caching Reduces LLM Costs by 90%
category: technical
---

## Introduction
[CONTENT PLACEHOLDER: intro]

## Deterministic Cache Keys
[CONTENT PLACEHOLDER: cache keys]
```

### Automated Script Output:
```bash
$ node scripts/fill-blog-content.js

🎯 Using most recent post: 2025-11-16-how-ai-caching-reduces-llm-costs-by-90.md
📝 Processing: 2025-11-16-how-ai-caching-reduces-llm-costs-by-90.md
🔍 Found 4 placeholder(s) to fill
   Generating: Introduction (intro)
   Generating: Deterministic Cache Keys (cache keys)
   Generating: Performance Benchmarks (benchmarks)
   Generating: Key Takeaways (conclusion)
✅ Post updated successfully!
📂 Location: /Users/you/Documents/agentcache-ai/blog/posts/2025-11-16-how-ai-caching-reduces-llm-costs-by-90.md
```

---

## Recommendation

**For most posts**: Use the automated script (already configured in GitHub Actions)

**For important/sensitive posts**: Use Gemini Gem for manual control

**For quick fixes**: Edit markdown files directly

Your blog now publishes automatically twice per week with high-quality, SEO-optimized content! 🎉
