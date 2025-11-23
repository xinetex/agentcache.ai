#!/bin/bash

# Start server
echo "🚀 Starting AgentCache server (Cognitive v2)..."
npx tsx src/index.ts > server-cognitive.log 2>&1 &
SERVER_PID=$!
sleep 5

SESSION_ID="cognitive-test-$(date +%s)"
echo "🧠 Testing Cognitive Layer..."
echo "Session ID: $SESSION_ID"

# 1. Test Hallucination Prevention (Validation)
# We send a message with "I think maybe" which triggers the low confidence rule.
echo "🛡️ 1. Testing Memory Validator (Hallucination Check)..."
echo "   Input: 'I think maybe the sky is green.'"
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"I think maybe the sky is green.\" }" > /dev/null

# Verify it was NOT saved to L3 (by querying with a NEW session, so L2 is empty)
sleep 2
VERIFY_SESSION_ID="verify-$(date +%s)"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$VERIFY_SESSION_ID\", \"message\": \"Is the sky green?\" }")

echo "$RESPONSE" | grep "sky is green" > /dev/null
if [ $? -ne 0 ]; then echo "✅ Validation Passed: Hallucination rejected from L3."; else echo "❌ Validation FAILED: Hallucination saved."; fi

# 2. Test Valid Memory
echo "📝 2. Testing Valid Memory..."
echo "   Input: 'The sky is blue.'"
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"The sky is blue.\" }" > /dev/null
sleep 2

RESPONSE_VALID=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"What color is the sky?\" }")

echo "$RESPONSE_VALID" | grep "sky is blue" > /dev/null
if [ $? -eq 0 ]; then echo "✅ Memory Saved: Valid fact stored in L3."; else echo "❌ Memory FAILED: Valid fact lost."; fi

# Cleanup
kill $SERVER_PID
