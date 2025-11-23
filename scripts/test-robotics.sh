#!/bin/bash

# AgentCache Robotics Verification Script
# Tests cache invalidation and listener registration APIs

API_URL="http://localhost:3001"
API_KEY="ac_demo_test123"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🤖 Starting Robotics API Verification..."
echo "Target: $API_URL"
echo "Key: $API_KEY"
echo "----------------------------------------"

# 1. Test Cache Invalidation
echo -n "1. Testing Cache Invalidation... "
RESPONSE=$(curl -s -X POST "$API_URL/api/cache/invalidate" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "test-robotics/*",
    "reason": "verification_script"
  }')

if echo "$RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}PASSED${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

# 2. Test Listener Registration
echo -n "2. Testing Listener Registration... "
LISTENER_RES=$(curl -s -X POST "$API_URL/api/listeners/register" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "checkInterval": 3600000,
    "namespace": "robotics-test"
  }')

if echo "$LISTENER_RES" | grep -q "success"; then
  echo -e "${GREEN}PASSED${NC}"
  # Extract ID for cleanup
  LISTENER_ID=$(echo "$LISTENER_RES" | grep -o '"listenerId":"[^"]*"' | cut -d'"' -f4)
else
  echo -e "${RED}FAILED${NC}"
  echo "Response: $LISTENER_RES"
  exit 1
fi

# 3. Verify Listener Listing
echo -n "3. Verifying Listener List... "
LIST_RES=$(curl -s "$API_URL/api/listeners/register" \
  -H "X-API-Key: $API_KEY")

if echo "$LIST_RES" | grep -q "$LISTENER_ID"; then
  echo -e "${GREEN}PASSED${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "Response: $LIST_RES"
  exit 1
fi

# 4. Cleanup (Unregister Listener)
echo -n "4. Cleaning up... "
DELETE_RES=$(curl -s -X DELETE "$API_URL/api/listeners/register?id=$LISTENER_ID" \
  -H "X-API-Key: $API_KEY")

if echo "$DELETE_RES" | grep -q "success"; then
  echo -e "${GREEN}PASSED${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "Response: $DELETE_RES"
fi

echo "----------------------------------------"
echo -e "✨ ${GREEN}All Robotics APIs Verified Successfully!${NC} ✨"
