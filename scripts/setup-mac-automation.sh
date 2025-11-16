#!/bin/bash

# Setup Blog Automation on macOS
# Installs launchd agent to run blog generation Tuesday/Friday at 9am

set -e

echo "🤖 Setting up AgentCache Blog Automation on macOS..."
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "❌ This script is for macOS only"
  exit 1
fi

# Make scripts executable
echo "📝 Making scripts executable..."
chmod +x /Users/letstaco/Documents/agentcache-ai/scripts/blog-cron.sh
chmod +x /Users/letstaco/Documents/agentcache-ai/scripts/generate-blog-post.js

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p /Users/letstaco/Documents/agentcache-ai/logs

# Copy plist to LaunchAgents (if not already there)
PLIST_FILE="/Users/letstaco/Library/LaunchAgents/com.agentcache.blog.plist"

if [ -f "$PLIST_FILE" ]; then
  echo "⚠️  Plist already exists. Unloading existing agent..."
  launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

echo "📋 Verifying plist exists..."
if [ ! -f "$PLIST_FILE" ]; then
  echo "❌ Plist file not found at $PLIST_FILE"
  echo "   Make sure the file was created correctly."
  exit 1
fi

# Load the launch agent
echo "🚀 Loading launch agent..."
launchctl load "$PLIST_FILE"

echo ""
echo "✅ Blog automation setup complete!"
echo ""
echo "📅 Schedule:"
echo "   - Tuesday at 9:00 AM (technical posts)"
echo "   - Friday at 9:00 AM (industry posts)"
echo ""
echo "📂 Locations:"
echo "   - Posts: /Users/letstaco/Documents/agentcache-ai/blog/posts/"
echo "   - Social: /Users/letstaco/Documents/agentcache-ai/blog/social/"
echo "   - Logs: /Users/letstaco/Documents/agentcache-ai/logs/blog-automation.log"
echo ""
echo "🧪 Test it now:"
echo "   bash /Users/letstaco/Documents/agentcache-ai/scripts/blog-cron.sh"
echo ""
echo "🔍 Check status:"
echo "   launchctl list | grep agentcache"
echo ""
echo "🛑 Stop automation:"
echo "   launchctl unload $PLIST_FILE"
echo ""
echo "🔄 Restart automation:"
echo "   launchctl unload $PLIST_FILE"
echo "   launchctl load $PLIST_FILE"
