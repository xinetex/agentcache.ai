#!/usr/bin/env node

/**
 * Blog Content Filler
 * 
 * Automatically fills [CONTENT PLACEHOLDER] sections in blog posts
 * using Gemini/OpenAI/Anthropic with up-to-date context and examples.
 * 
 * Usage:
 *   node scripts/fill-blog-content.js [post-filename.md]
 *   
 *   If no filename provided, fills the most recent post.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - supports multiple LLM providers
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'; // 'openai', 'anthropic', or 'gemini'
const API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('❌ No API key found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY');
  process.exit(1);
}

// System prompt for the LLM
const SYSTEM_PROMPT = `You are an expert technical writer for AgentCache.ai, a platform that reduces LLM API costs by 90% through intelligent caching.

Write engaging, technically accurate content for AI developers. Your writing style:
- Hook with a problem or surprising stat
- Include real code examples (Python/JavaScript)
- Use concrete numbers and benchmarks
- SEO-optimized (keywords: AI caching, LLM cost optimization, reduce OpenAI costs)
- Actionable and practical

Current context (November 2025):
- OpenAI just raised GPT-4 prices
- LangChain v0.3 added caching
- Anthropic Claude 3.5 is expensive
- YC W25 has 30+ AI companies
- Edge AI is mainstream

When given a [CONTENT PLACEHOLDER] section, write 200-300 words that fit the context. Include code if relevant.`;

// Find most recent blog post
function findMostRecentPost() {
  const postsDir = path.join(__dirname, '..', 'blog', 'posts');
  const files = fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(postsDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  return files.length > 0 ? files[0].name : null;
}

// Parse blog post markdown
function parsePost(content) {
  const lines = content.split('\n');
  let frontmatter = {};
  let body = '';
  let inFrontmatter = false;
  let frontmatterLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true;
      } else {
        // End of frontmatter
        body = lines.slice(i + 1).join('\n');
        break;
      }
    } else if (inFrontmatter) {
      frontmatterLines.push(line);
    }
  }
  
  // Parse frontmatter
  frontmatterLines.forEach(line => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      frontmatter[match[1]] = match[2];
    }
  });
  
  return { frontmatter, body };
}

// Extract placeholder sections
function extractPlaceholders(body) {
  const placeholders = [];
  const lines = body.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('[CONTENT PLACEHOLDER:')) {
      const match = line.match(/\[CONTENT PLACEHOLDER:\s*([^\]]+)\]/);
      if (match) {
        const type = match[1];
        
        // Find context (heading before placeholder)
        let heading = '';
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].startsWith('#')) {
            heading = lines[j].replace(/^#+\s*/, '');
            break;
          }
        }
        
        // Find the full placeholder block (including TODO)
        let startLine = i;
        let endLine = i;
        for (let j = i; j < lines.length; j++) {
          if (lines[j].includes('**TODO**') || lines[j].includes('This section will cover')) {
            endLine = j;
          } else if (j > i && lines[j].trim() === '') {
            endLine = j - 1;
            break;
          }
        }
        
        placeholders.push({
          type,
          heading,
          startLine,
          endLine,
          originalText: lines.slice(startLine, endLine + 1).join('\n')
        });
        
        i = endLine; // Skip to end of this placeholder
      }
    }
  }
  
  return placeholders;
}

// Generate content using LLM
async function generateContent(frontmatter, heading, placeholderType) {
  const title = frontmatter.title;
  const category = frontmatter.category;
  
  const prompt = `You're writing a section for a blog post titled "${title}" (category: ${category}).

Section heading: ${heading}
Section type: ${placeholderType}

Write 200-300 words for this section. Follow this structure based on type:

For "intro": Hook with problem → Why it matters → What reader will learn
For "analysis": Data/trends → Implications → Expert perspective  
For "case studies": Company scenario → Problem → Solution → Results with numbers
For "technical": Concept explanation → Code example → Benchmarks

Include:
- Concrete examples or code (if technical)
- Real numbers/benchmarks
- Actionable insights

Write in markdown format. Do NOT include the heading (it's already there). Start directly with content.`;

  try {
    let content = '';
    
    if (LLM_PROVIDER === 'openai') {
      content = await callOpenAI(prompt);
    } else if (LLM_PROVIDER === 'anthropic') {
      content = await callAnthropic(prompt);
    } else if (LLM_PROVIDER === 'gemini') {
      content = await callGemini(prompt);
    }
    
    return content.trim();
  } catch (err) {
    console.error(`Failed to generate content for ${heading}:`, err.message);
    return `[Generation failed for ${placeholderType}. Please fill manually.]`;
  }
}

// OpenAI API call
async function callOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// Anthropic API call
async function callAnthropic(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    })
  });
  
  const data = await response.json();
  return data.content[0].text;
}

// Gemini API call
async function callGemini(prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    })
  });
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Fill placeholders in post
async function fillPost(postPath) {
  console.log(`📝 Processing: ${path.basename(postPath)}`);
  
  const content = fs.readFileSync(postPath, 'utf8');
  const { frontmatter, body } = parsePost(content);
  const placeholders = extractPlaceholders(body);
  
  if (placeholders.length === 0) {
    console.log('✅ No placeholders found. Post is complete!');
    return;
  }
  
  console.log(`🔍 Found ${placeholders.length} placeholder(s) to fill`);
  
  let updatedBody = body;
  let offset = 0;
  
  for (const placeholder of placeholders) {
    console.log(`   Generating: ${placeholder.heading} (${placeholder.type})`);
    
    const newContent = await generateContent(frontmatter, placeholder.heading, placeholder.type);
    
    // Replace placeholder with generated content
    const lines = updatedBody.split('\n');
    const adjustedStart = placeholder.startLine + offset;
    const adjustedEnd = placeholder.endLine + offset;
    
    lines.splice(adjustedStart, adjustedEnd - adjustedStart + 1, newContent);
    updatedBody = lines.join('\n');
    
    // Adjust offset for next replacement
    const oldLines = adjustedEnd - adjustedStart + 1;
    const newLines = newContent.split('\n').length;
    offset += (newLines - oldLines);
  }
  
  // Reconstruct full post
  const frontmatterStr = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  
  const finalContent = `---\n${frontmatterStr}\n---\n${updatedBody}`;
  
  // Write back
  fs.writeFileSync(postPath, finalContent);
  console.log('✅ Post updated successfully!');
  console.log(`📂 Location: ${postPath}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  let postFile = args[0];
  
  if (!postFile) {
    postFile = findMostRecentPost();
    if (!postFile) {
      console.error('❌ No blog posts found');
      process.exit(1);
    }
    console.log(`🎯 Using most recent post: ${postFile}`);
  }
  
  const postPath = path.join(__dirname, '..', 'blog', 'posts', postFile);
  
  if (!fs.existsSync(postPath)) {
    console.error(`❌ Post not found: ${postPath}`);
    process.exit(1);
  }
  
  await fillPost(postPath);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
