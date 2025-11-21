#!/bin/bash

# Test the Hybrid System (Cognitive Memory + Reasoning Cache)
echo "🧠 Testing Hybrid Memory System..."
echo "=================================="

# Start server
echo "🚀 Starting AgentCache server..."
npx tsx src/index.ts > server-hybrid.log 2>&1 &
SERVER_PID=$!
sleep 5

SESSION_ID="hybrid-test-$(date +%s)"
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: First interaction (cache miss)
echo "📝 Test 1: First interaction..."
echo "   Input: 'What is the capital of France?'"
RESPONSE1=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"What is the capital of France?\" }")

echo "$RESPONSE1" | jq '.'
echo ""

# Test 2: Memory recall (should use L2)
sleep 2
echo "📝 Test 2: Memory recall from L2..."
echo "   Input: 'What did I just ask?'"
RESPONSE2=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"What did I just ask?\" }")

echo "$RESPONSE2" | jq '.'
echo ""

# Test 3: Semantic recall with new session (should use L3)
sleep 2
NEW_SESSION_ID="hybrid-test-new-$(date +%s)"
echo "📝 Test 3: Semantic recall from L3 (new session)..."
echo "   New Session ID: $NEW_SESSION_ID"
echo "   Input: 'Tell me about France'"
RESPONSE3=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$NEW_SESSION_ID\", \"message\": \"Tell me about France\" }")

echo "$RESPONSE3" | jq '.'
echo ""

# Check if reasoning tokens were stored
echo "✅ Hybrid System Test Complete!"
echo ""
echo "Check the responses above for:"
echo "  - 'response' field (AI answer)"
echo "  - 'contextSource' (L1/L2/L3/HYBRID)"
echo "  - 'metadata.reasoningTokens' (if Moonshot is configured)"
echo "  - 'metadata.cacheHit' (true if reasoning was cached)"
echo ""

# Cleanup
kill $SERVER_PID
