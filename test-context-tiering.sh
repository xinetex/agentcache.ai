#!/bin/bash

# Start the server in the background
echo "🚀 Starting AgentCache server..."
npx tsx src/index.ts > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Define Session ID
SESSION_ID="test-session-$(date +%s)"

echo "🧪 Testing Context Tiering (L1/L2)..."
echo "Session ID: $SESSION_ID"

# 1. Send First Message
echo "📝 Sending Message 1: 'Hello, I am a robot.'"
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Hello, I am a robot.\"
  }" | json_pp

echo -e "\n\n"

# 2. Send Second Message (Should retrieve history)
echo "📝 Sending Message 2: 'What did I just say?'"
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ac_demo_test123" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What did I just say?\"
  }" | json_pp

# Cleanup
echo -e "\n\n🛑 Stopping server..."
kill $SERVER_PID
