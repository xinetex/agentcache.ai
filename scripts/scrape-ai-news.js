#!/usr/bin/env node

/**
 * AI News Scraper
 * 
 * Scrapes recent AI/LLM news to provide up-to-date context for blog posts.
 * Sources: HackerNews, OpenAI blog, Anthropic blog, dev.to, etc.
 * 
 * Usage:
 *   node scripts/scrape-ai-news.js
 *   
 * Output: context.json with recent news for LLM to use
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// News sources
const SOURCES = {
  hackernews: {
    name: 'Hacker News AI',
    url: 'https://hn.algolia.com/api/v1/search?query=AI+costs+OR+OpenAI+pricing+OR+LLM+caching&tags=story&numericFilters=created_at_i>',
    parser: parseHackerNews
  },
  devto: {
    name: 'Dev.to AI',
    url: 'https://dev.to/api/articles?tag=ai&per_page=10',
    parser: parseDevTo
  }
};

// Fetch recent articles (last 7 days)
async function scrapeNews() {
  const weekAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
  const articles = [];
  
  console.log('🔍 Scraping AI news from the last 7 days...\n');
  
  // Hacker News
  try {
    const hnUrl = SOURCES.hackernews.url + weekAgo;
    const response = await fetch(hnUrl);
    const data = await response.json();
    const hnArticles = parseHackerNews(data);
    articles.push(...hnArticles);
    console.log(`✅ Hacker News: ${hnArticles.length} articles`);
  } catch (err) {
    console.error('❌ Hacker News failed:', err.message);
  }
  
  // Dev.to
  try {
    const response = await fetch(SOURCES.devto.url);
    const data = await response.json();
    const devArticles = parseDevTo(data);
    articles.push(...devArticles);
    console.log(`✅ Dev.to: ${devArticles.length} articles`);
  } catch (err) {
    console.error('❌ Dev.to failed:', err.message);
  }
  
  return articles;
}

// Parse Hacker News response
function parseHackerNews(data) {
  return data.hits
    .filter(hit => hit.title && hit.url)
    .slice(0, 10)
    .map(hit => ({
      title: hit.title,
      url: hit.url,
      source: 'Hacker News',
      date: new Date(hit.created_at_i * 1000).toISOString().split('T')[0],
      points: hit.points || 0,
      comments: hit.num_comments || 0
    }));
}

// Parse Dev.to response
function parseDevTo(data) {
  return data
    .filter(article => article.published_at)
    .slice(0, 10)
    .map(article => ({
      title: article.title,
      url: article.url,
      source: 'Dev.to',
      date: article.published_at.split('T')[0],
      reactions: article.public_reactions_count || 0,
      comments: article.comments_count || 0
    }));
}

// Generate context summary for LLM
function generateContext(articles) {
  // Sort by engagement (points/reactions)
  const sorted = articles.sort((a, b) => {
    const aScore = (a.points || a.reactions || 0);
    const bScore = (b.points || b.reactions || 0);
    return bScore - aScore;
  });
  
  const topStories = sorted.slice(0, 5);
  
  const context = {
    generated_at: new Date().toISOString(),
    week_summary: {
      total_articles: articles.length,
      top_topics: extractTopics(articles),
      trending: topStories.map(a => `${a.title} (${a.source})`)
    },
    recent_articles: sorted.map(article => ({
      title: article.title,
      url: article.url,
      source: article.source,
      date: article.date,
      engagement: article.points || article.reactions || 0
    })),
    llm_prompt_context: generateLLMContext(topStories)
  };
  
  return context;
}

// Extract common topics from titles
function extractTopics(articles) {
  const keywords = {};
  const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
  
  articles.forEach(article => {
    const words = article.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.includes(w));
    
    words.forEach(word => {
      keywords[word] = (keywords[word] || 0) + 1;
    });
  });
  
  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, mentions: count }));
}

// Generate context string for LLM
function generateLLMContext(topStories) {
  const trends = topStories.map(s => `- ${s.title}`).join('\n');
  
  return `Recent AI Industry Trends (Last 7 Days):

${trends}

Use these trending topics to inform your blog post. Reference specific developments, pricing changes, or community discussions when relevant. Keep content fresh and timely.`;
}

// Save context to file
function saveContext(context) {
  const contextDir = path.join(__dirname, '..', 'blog');
  const contextPath = path.join(contextDir, 'context.json');
  
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }
  
  fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
  console.log(`\n📝 Context saved: ${contextPath}`);
  console.log(`\n🔥 Top trends this week:`);
  context.week_summary.top_topics.slice(0, 5).forEach(topic => {
    console.log(`   - ${topic.word} (${topic.mentions} mentions)`);
  });
}

// Main
async function main() {
  try {
    const articles = await scrapeNews();
    
    if (articles.length === 0) {
      console.log('⚠️  No articles found. Check your internet connection.');
      return;
    }
    
    const context = generateContext(articles);
    saveContext(context);
    
    console.log(`\n✅ Scraped ${articles.length} articles successfully!`);
    console.log(`💡 Use this context when generating blog posts for up-to-date references.\n`);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
