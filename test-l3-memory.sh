#!/bin/bash

# Start the server in the background
echo "🚀 Starting AgentCache server..."
npx tsx src/index.ts > server-l3.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Define Session ID
SESSION_ID="l3-test-$(date +%s)"

echo "🧪 Testing L3 Cold Tier (Vector Memory)..."
echo "Session ID: $SESSION_ID"

# 1. Store a "Memory" (Write-Through)
echo "📝 Sending Message 1: 'My favorite color is blue.'"
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"My favorite color is blue.\"
  }" | json_pp

echo -e "\n\nWaiting for vector indexing (simulated)..."
sleep 2

# 2. Query for that memory (Semantic Search)
# Even though we ask a DIFFERENT question, it should find the memory about "blue"
echo "📝 Sending Message 2: 'What color do I like?'"
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What color do I like?\"
  }" | json_pp

# Cleanup
echo -e "\n\n🛑 Stopping server..."
kill $SERVER_PID
