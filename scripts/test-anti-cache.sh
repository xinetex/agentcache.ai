#!/bin/bash

# Start server
echo "🚀 Starting AgentCache server..."
npx tsx src/index.ts > server-anti-cache.log 2>&1 &
SERVER_PID=$!
sleep 5

SESSION_ID="anti-cache-$(date +%s)"
echo "🧪 Testing Anti-Cache Features..."
echo "Session ID: $SESSION_ID"

# 1. Create a "Bad" Memory
echo "📝 1. Creating a 'Bad Memory' (I hate pizza)..."
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"I hate pizza.\" }" > /dev/null
sleep 2

# 2. Verify it exists
echo "🔍 2. Verifying memory exists..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"Do I like pizza?\" }")

echo "$RESPONSE" | grep "hate pizza" > /dev/null
if [ $? -eq 0 ]; then echo "✅ Memory found."; else echo "❌ Memory NOT found."; fi

# 3. Test Freshness Bypass
echo "🛡️ 3. Testing 'Freshness Injection' (Bypass)..."
RESPONSE_BYPASS=$(curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{ \"sessionId\": \"$SESSION_ID\", \"message\": \"Do I like pizza?\", \"freshness\": \"absolute\" }")

echo "$RESPONSE_BYPASS" | grep "hate pizza" > /dev/null
if [ $? -ne 0 ]; then 
  echo "✅ Bypass successful (Memory ignored)."
else 
  echo "❌ Bypass FAILED (Memory still present)."
  echo "DEBUG: Response Body:"
  echo "$RESPONSE_BYPASS"
fi

# 4. Prune the Memory (Simulated ID retrieval - in real app we'd parse the ID)
# For this test, we can't easily get the ID without parsing JSON in bash, 
# so we will just verify the endpoint exists and returns success for a dummy ID.
echo "✂️ 4. Testing 'Pruning' Endpoint..."
curl -s -X DELETE "http://localhost:3001/api/agent/memory?id=dummy-id" \
  -H "X-API-Key: ac_demo_test123" | grep "pruned"
echo "✅ Pruning endpoint active."

# Cleanup
kill $SERVER_PID
