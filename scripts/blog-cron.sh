#!/bin/bash

# Blog Automation Cron Script
# Called by launchd twice weekly (Tuesday/Friday)

set -e  # Exit on error

# Navigate to project directory
cd /Users/letstaco/Documents/agentcache-ai

# Create logs directory if needed
mkdir -p logs

# Log start time
echo "====================================" >> logs/blog-automation.log
echo "Blog automation started at $(date)" >> logs/blog-automation.log

# Determine category based on day of week (Tuesday=technical, Friday=industry)
DAY=$(date +%u)
if [ "$DAY" -eq "2" ]; then
  CATEGORY="technical"
  echo "Category: Technical deep-dive" >> logs/blog-automation.log
else
  CATEGORY="industry"
  echo "Category: Industry/trends" >> logs/blog-automation.log
fi

# Generate blog post
echo "Generating blog post..." >> logs/blog-automation.log
node scripts/generate-blog-post.js "$CATEGORY" >> logs/blog-automation.log 2>&1

# Check if post was created
LATEST_POST=$(ls -t blog/posts/*.md | head -1)
if [ -f "$LATEST_POST" ]; then
  echo "✅ Post created: $LATEST_POST" >> logs/blog-automation.log
  
  # Send macOS notification
  osascript -e 'display notification "New blog post generated! Review in /blog/posts/" with title "AgentCache Blog" sound name "Glass"'
  
  # Optional: Open in default markdown editor
  # open "$LATEST_POST"
  
else
  echo "❌ Failed to create blog post" >> logs/blog-automation.log
  osascript -e 'display notification "Blog post generation failed. Check logs." with title "AgentCache Blog" sound name "Basso"'
  exit 1
fi

echo "Blog automation completed at $(date)" >> logs/blog-automation.log
echo "" >> logs/blog-automation.log

exit 0
