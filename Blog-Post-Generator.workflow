#!/bin/bash

# Blog Post Generator - macOS Automator Workflow
# Save this as an Application in Automator, then add to Calendar

cd /Users/letstaco/Documents/agentcache-ai

# Determine category based on day of week
DAY=$(date +%u)
if [ "$DAY" -eq "2" ]; then
  CATEGORY="technical"
else
  CATEGORY="industry"
fi

# Generate blog post
node scripts/generate-blog-post.js "$CATEGORY"

# Show notification
osascript -e 'display notification "Blog post generated! Check /blog/posts/" with title "AgentCache Blog"'

# Open blog folder
open blog/posts
