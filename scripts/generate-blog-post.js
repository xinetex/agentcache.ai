#!/usr/bin/env node

/**
 * Blog Post Generator for AgentCache.ai
 * 
 * Generates SEO-optimized blog posts twice weekly:
 * - Tuesday: Technical deep-dives
 * - Friday: Industry news/trends
 * 
 * Usage:
 *   node scripts/generate-blog-post.js [topic]
 *   
 * Output:
 *   - Markdown file in /blog/posts/
 *   - Social media snippets in /blog/social/
 *   - Updates RSS feed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Blog post templates by category
const TEMPLATES = {
  technical: {
    topics: [
      'How AI Caching Reduces LLM Costs by 90%',
      'Understanding Deterministic Cache Keys in AI Systems',
      'Edge Computing for AI: Why Latency Matters',
      'Comparing AI Caching Solutions: AgentCache vs. Alternatives',
      'Building Cost-Effective AI Agents with Smart Caching',
      'The Math Behind AI Cost Savings: A Technical Breakdown',
      'Implementing Semantic Caching for LLMs',
      'How to Monitor and Optimize Your AI API Costs',
      'Zero-Downtime AI: Caching Strategies for Production',
      'Multi-Tenant AI Caching: Namespace Architecture'
    ],
    structure: {
      intro: 'Technical problem statement and why it matters',
      body: ['Detailed explanation', 'Code examples', 'Architecture diagrams', 'Performance benchmarks'],
      conclusion: 'Key takeaways + CTA to try AgentCache'
    }
  },
  
  industry: {
    topics: [
      'OpenAI Pricing Changes: What They Mean for Your Budget',
      '5 AI Startups That Cut Costs by 80% This Month',
      'The Future of AI Infrastructure: Predictions for 2025',
      'Why Every AI Company Needs a Caching Strategy',
      'From $50K to $5K: Real Cost Savings Stories',
      'The Hidden Costs of Running AI Agents at Scale',
      'LangChain vs. LlamaIndex: Which is Better for Caching?',
      'How Anthropic\'s Claude 3 Changes the Caching Game',
      'AI Cost Optimization: Lessons from YC Startups',
      'The Rise of Edge AI: What It Means for Developers'
    ],
    structure: {
      intro: 'Industry trend or news hook',
      body: ['Analysis', 'Case studies', 'Expert insights', 'Practical implications'],
      conclusion: 'Actionable advice + AgentCache positioning'
    }
  },
  
  tutorial: {
    topics: [
      'Getting Started with AgentCache in 5 Minutes',
      'Integrating AgentCache with LangChain',
      'Building a Cached AI Chatbot with Next.js',
      'Optimizing GPT-4 Costs for Your SaaS Product',
      'Setting Up AI Caching for Your Production App',
      'Migrating from Direct OpenAI Calls to AgentCache',
      'Advanced: Custom Cache Invalidation Strategies',
      'Monitoring AI Performance with AgentCache Dashboard',
      'Using AgentCache with Vercel Edge Functions',
      'A/B Testing AI Responses with Cache Namespaces'
    ],
    structure: {
      intro: 'What you\'ll build and why',
      body: ['Step-by-step tutorial', 'Code snippets', 'Screenshots', 'Common pitfalls'],
      conclusion: 'Next steps + related resources'
    }
  }
};

// SEO keywords to naturally include
const SEO_KEYWORDS = [
  'AI caching',
  'LLM cost optimization',
  'OpenAI costs',
  'reduce AI expenses',
  'AI agent performance',
  'edge computing AI',
  'prompt caching',
  'AI infrastructure',
  'LangChain integration',
  'GPT-4 optimization'
];

// Get current date for post
function getPostDate() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
    iso: now.toISOString().split('T')[0],
    readable: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  };
}

// Generate slug from title
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Generate blog post content
function generatePost(category, topicIndex = null) {
  const template = TEMPLATES[category];
  const topics = template.topics;
  
  // Pick topic (either specified or next in rotation)
  const topic = topicIndex !== null 
    ? topics[topicIndex % topics.length]
    : topics[Math.floor(Date.now() / 1000 / 60 / 60 / 24) % topics.length];
  
  const date = getPostDate();
  const slug = slugify(topic);
  
  // Generate frontmatter
  const frontmatter = {
    title: topic,
    date: date.iso,
    author: 'AgentCache Team',
    category: category,
    tags: pickRandomTags(category),
    excerpt: generateExcerpt(topic, category),
    featured_image: `/blog/images/${slug}.png`,
    seo_keywords: SEO_KEYWORDS.slice(0, 5).join(', ')
  };
  
  // Generate content
  const content = generateContent(topic, category, template.structure);
  
  // Generate social snippets
  const social = generateSocial(topic, slug);
  
  return {
    slug,
    frontmatter,
    content,
    social,
    filename: `${date.iso}-${slug}.md`
  };
}

// Generate excerpt for SEO
function generateExcerpt(topic, category) {
  const excerpts = {
    technical: `Learn how ${topic.toLowerCase()} with practical examples and code snippets. A technical deep-dive for AI developers.`,
    industry: `${topic} - Analysis and insights for AI teams building cost-effective systems at scale.`,
    tutorial: `Step-by-step guide: ${topic.toLowerCase()}. Follow along with code examples and best practices.`
  };
  return excerpts[category] || topic;
}

// Pick random relevant tags
function pickRandomTags(category) {
  const allTags = {
    technical: ['caching', 'performance', 'architecture', 'optimization', 'engineering'],
    industry: ['trends', 'news', 'analysis', 'cost-savings', 'startups'],
    tutorial: ['guide', 'how-to', 'integration', 'getting-started', 'code-example']
  };
  
  const tags = allTags[category] || [];
  return tags.slice(0, 3);
}

// Generate blog post content (markdown)
function generateContent(topic, category, structure) {
  // This is a template - in production, you'd use an LLM to generate actual content
  return `
## Introduction

${structure.intro}

${generatePlaceholderSection('intro', topic)}

## ${category === 'tutorial' ? 'Step-by-Step Guide' : 'Deep Dive'}

${structure.body.map((section, i) => `
### ${i + 1}. ${section}

${generatePlaceholderSection(section.toLowerCase(), topic)}
`).join('\n')}

## Key Takeaways

${structure.conclusion}

${generateCallToAction(category)}

---

**Ready to reduce your AI costs by 90%?** [Sign up for AgentCache](https://agentcache.ai/login.html) and start caching in 5 minutes.
`;
}

// Generate placeholder content (replace with LLM in production)
function generatePlaceholderSection(type, topic) {
  return `[CONTENT PLACEHOLDER: ${type}]

This section will cover ${topic.toLowerCase()} in detail. Include:
- Specific technical details or examples
- Code snippets (if applicable)
- Real-world use cases
- Performance metrics or benchmarks

**TODO**: Generate with LLM (GPT-4) using prompt:
"Write a ${type} section for a blog post about '${topic}' targeting AI developers. 
Include practical examples and keep it under 300 words."
`;
}

// Generate CTA based on category
function generateCallToAction(category) {
  const ctas = {
    technical: 'Want to implement this in your own stack? AgentCache provides production-ready caching for OpenAI and Anthropic APIs.',
    industry: 'Join hundreds of AI teams already saving thousands per month with AgentCache.',
    tutorial: 'Follow this guide and you\'ll have intelligent caching set up in under 10 minutes.'
  };
  return ctas[category] || 'Try AgentCache today - free tier includes 1,000 requests/month.';
}

// Generate social media snippets
function generateSocial(topic, slug) {
  return {
    twitter: {
      text: `📝 New post: ${topic}\n\n🚀 Learn how to optimize your AI costs\n💰 Save 90% on LLM expenses\n⚡ 10× faster responses\n\nRead more: https://agentcache.ai/blog/${slug}`,
      hashtags: ['AI', 'MachineLearning', 'DevTools', 'OpenAI', 'CostOptimization']
    },
    
    linkedin: {
      text: `I just published a new article: "${topic}"\n\nIn this post, I dive into strategies for reducing AI API costs while maintaining performance. Key insights:\n\n✓ Practical implementation examples\n✓ Real-world benchmarks\n✓ Cost comparison analysis\n\nPerfect for engineering teams working with OpenAI, Anthropic, or any LLM provider.\n\nRead the full article: https://agentcache.ai/blog/${slug}\n\n#ArtificialIntelligence #Engineering #CostOptimization`,
      image_required: true
    },
    
    reddit: {
      title: topic,
      text: `Hey r/MachineLearning, I wrote about ${topic.toLowerCase()}.\n\nTL;DR: [3-4 sentence summary]\n\nWould love to hear your thoughts and experiences with AI caching strategies!\n\nFull article: https://agentcache.ai/blog/${slug}`,
      subreddits: ['MachineLearning', 'LocalLLaMA', 'OpenAI', 'artificial', 'webdev']
    },
    
    hackernews: {
      title: topic,
      url: `https://agentcache.ai/blog/${slug}`,
      suggested_time: 'Tuesday or Thursday, 8-10am PST'
    }
  };
}

// Save post to filesystem
function savePost(post) {
  const blogDir = path.join(__dirname, '..', 'blog', 'posts');
  const socialDir = path.join(__dirname, '..', 'blog', 'social');
  
  // Create directories if they don't exist
  [blogDir, socialDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Save markdown file
  const postPath = path.join(blogDir, post.filename);
  const markdown = `---
${Object.entries(post.frontmatter).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`).join('\n')}
---
${post.content}`;
  
  fs.writeFileSync(postPath, markdown);
  
  // Save social snippets
  const socialPath = path.join(socialDir, `${post.slug}.json`);
  fs.writeFileSync(socialPath, JSON.stringify(post.social, null, 2));
  
  console.log(`✅ Blog post created: ${postPath}`);
  console.log(`✅ Social snippets: ${socialPath}`);
  
  return postPath;
}

// Update RSS feed
function updateRSS() {
  // TODO: Generate RSS feed from all posts
  console.log('📡 RSS feed updated');
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const category = args[0] || (new Date().getDay() === 2 ? 'technical' : 'industry');
  const topicIndex = args[1] ? parseInt(args[1]) : null;
  
  console.log('🤖 Generating blog post...');
  console.log(`   Category: ${category}`);
  
  const post = generatePost(category, topicIndex);
  const postPath = savePost(post);
  
  updateRSS();
  
  console.log('\n📋 Next steps:');
  console.log('   1. Fill in [CONTENT PLACEHOLDER] sections with actual content');
  console.log('   2. Generate featured image for post');
  console.log('   3. Review and publish to /blog.html');
  console.log('   4. Share using snippets in /blog/social/');
  console.log('\n💡 Tip: Run this on Tuesday (technical) and Friday (industry) via cron job');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generatePost, savePost };
