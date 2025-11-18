#!/bin/bash
# Test script for AgentCache Swarm API
# Usage: ./test-swarm.sh

set -e

API_KEY="${API_KEY:-ac_demo_test123}"
BASE_URL="${BASE_URL:-https://agentcache.ai}"

echo "🧪 Testing AgentCache Swarm API"
echo "================================"
echo "Base URL: $BASE_URL"
echo "API Key: $API_KEY"
echo ""

# Test 1: Health check (cache endpoint)
echo "1️⃣  Testing cache health..."
curl -s -X POST "$BASE_URL/api/cache/check" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","model":"gpt-4","messages":[{"role":"user","content":"test"}]}' \
  | jq -e '.cached != null' > /dev/null && echo "✅ Cache API working" || echo "❌ Cache API failed"
echo ""

# Test 2: Swarm parallel strategy
echo "2️⃣  Testing swarm parallel strategy..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/swarm" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "parallel",
    "models": [
      {"provider": "openai", "model": "gpt-4"},
      {"provider": "anthropic", "model": "claude-3-opus"}
    ],
    "messages": [{"role": "user", "content": "Hello, this is a test"}]
  }')

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Swarm API working"
  TRACE_ID=$(echo "$RESPONSE" | jq -r '.traceId')
  echo "📊 Trace ID: $TRACE_ID"
  
  # Test 3: Retrieve trace
  echo ""
  echo "3️⃣  Testing trace retrieval..."
  sleep 2  # Wait for trace to be stored
  TRACE=$(curl -s "$BASE_URL/api/trace?id=$TRACE_ID")
  
  if echo "$TRACE" | jq -e '.traceId' > /dev/null; then
    echo "✅ Trace API working"
    echo "$TRACE" | jq '.summary'
  else
    echo "❌ Trace API failed"
    echo "$TRACE" | jq '.'
  fi
else
  echo "❌ Swarm API failed"
  echo "$RESPONSE" | jq '.'
fi

echo ""
echo "4️⃣  Testing swarm fastest strategy..."
curl -s -X POST "$BASE_URL/api/swarm" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "fastest",
    "models": [
      {"provider": "openai", "model": "gpt-4o-mini"},
      {"provider": "google", "model": "gemini-flash"}
    ],
    "messages": [{"role": "user", "content": "Quick test"}]
  }' \
  | jq -e '.success' > /dev/null && echo "✅ Fastest strategy working" || echo "❌ Fastest strategy failed"

echo ""
echo "5️⃣  Testing swarm cheapest strategy..."
curl -s -X POST "$BASE_URL/api/swarm" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "cheapest",
    "models": [
      {"provider": "google", "model": "gemini-flash"},
      {"provider": "openai", "model": "gpt-4o-mini"}
    ],
    "messages": [{"role": "user", "content": "Cost test"}]
  }' \
  | jq -e '.success' > /dev/null && echo "✅ Cheapest strategy working" || echo "❌ Cheapest strategy failed"

echo ""
echo "================================"
echo "✨ Testing complete!"
echo ""
echo "📊 View dashboard: $BASE_URL/swarm-observability.html"
