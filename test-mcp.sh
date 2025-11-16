#!/bin/bash

# Quick MCP Server Test
echo "🚀 Testing AgentCache MCP Server..."
echo ""

# Set environment variables
export AGENTCACHE_API_KEY="ac_demo_test123"
export AGENTCACHE_API_URL="https://agentcache.ai"

echo "📍 Configuration:"
echo "  - API URL: $AGENTCACHE_API_URL"
echo "  - API Key: ${AGENTCACHE_API_KEY:0:15}..."
echo ""

echo "🔨 Building MCP server..."
pnpm run mcp:build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🎉 MCP Server is ready!"
    echo ""
    echo "📖 To use with Claude Desktop, add to your config:"
    echo ""
    echo '{
  "mcpServers": {
    "agentcache": {
      "command": "node",
      "args": ["'$(pwd)'/dist/mcp/server.js"],
      "env": {
        "AGENTCACHE_API_KEY": "ac_demo_test123"
      }
    }
  }
}'
    echo ""
    echo "📁 Config location:"
    echo "  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"
else
    echo "❌ Build failed!"
    exit 1
fi
