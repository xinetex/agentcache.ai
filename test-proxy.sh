#!/bin/bash

# AgentCache Frictionless Proxy Test
# This demonstrates how agents can use AgentCache with ZERO code changes

echo "🚀 Testing AgentCache Frictionless Proxy"
echo "========================================"
echo ""

# Test 1: OpenAI proxy (cache miss)
echo "📝 Test 1: OpenAI proxy - First request (cache miss)"
echo ""
curl -s -X POST https://agentcache.ai/v1/chat/completions \
  -H "Authorization: Bearer ac_demo_test123" \
  -H "X-OpenAI-Key: $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in 3 words"}],
    "max_tokens": 10
  }' | jq -r '
    if .error then
      "❌ Error: \(.error) - \(.message)"
    else
      "✅ Response: \(.choices[0].message.content)"
    end
  '

echo ""
echo "Waiting 2 seconds before testing cache hit..."
sleep 2
echo ""

# Test 2: OpenAI proxy (cache hit)
echo "📝 Test 2: Same request (should be cache hit)"
echo ""
curl -s -X POST https://agentcache.ai/v1/chat/completions \
  -H "Authorization: Bearer ac_demo_test123" \
  -H "X-OpenAI-Key: $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -D - \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in 3 words"}],
    "max_tokens": 10
  }' 2>&1 | grep -E "(X-Cache|X-Cache-Latency)" | head -2

echo ""
echo "========================================"
echo "✨ Key takeaway:"
echo "   Agents just change OPENAI_BASE_URL to https://agentcache.ai/v1"
echo "   Everything else works exactly the same!"
echo ""
echo "📖 Full documentation: https://agentcache.ai/proxy.html"
