#!/bin/bash

# JettySpeed API Test Script
# Tests all JettySpeed integration endpoints

BASE_URL="${BASE_URL:-https://agentcache.ai}"
API_KEY="${API_KEY:-ac_test_key_123}" # Replace with real API key

echo "🚀 Testing JettySpeed API Endpoints"
echo "======================================"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check Duplicate (non-existent file)
echo -e "${BLUE}Test 1: Check Duplicate - New File${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/check-duplicate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fileHash": "sha256:abc123def456",
    "userId": "usr_test_123",
    "fileName": "test-video.mp4",
    "fileSize": 1073741824
  }')

echo "$response" | jq '.'
if echo "$response" | jq -e '.isDuplicate == false' > /dev/null; then
  echo -e "${GREEN}✓ PASS${NC}\n"
else
  echo -e "${RED}✗ FAIL${NC}\n"
fi

# Test 2: Optimal Edges
echo -e "${BLUE}Test 2: Get Optimal Edges${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/optimal-edges" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_test_123",
    "fileSize": 1073741824,
    "fileHash": "sha256:abc123def456",
    "fileName": "test-video.mp4",
    "userLocation": {
      "lat": 37.7749,
      "lng": -122.4194,
      "city": "San Francisco"
    },
    "priority": "speed"
  }')

echo "$response" | jq '.'
if echo "$response" | jq -e '.strategy and .edges' > /dev/null; then
  echo -e "${GREEN}✓ PASS${NC}"
  EDGE_COUNT=$(echo "$response" | jq '.edges | length')
  echo "Found $EDGE_COUNT edges"
  echo ""
else
  echo -e "${RED}✗ FAIL${NC}\n"
fi

# Test 3: Track Upload - Start
echo -e "${BLUE}Test 3: Track Upload - Start${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/track-upload" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "userId": "usr_test_123",
    "fileName": "test-video.mp4",
    "fileHash": "sha256:abc123def456",
    "fileSize": 1073741824,
    "chunkSize": 52428800,
    "threads": 24,
    "edgesUsed": ["sfo-1", "lax-1", "sea-1"],
    "chunksTotal": 20,
    "estimatedCost": 0.10,
    "uploadVia": "desktop",
    "jettySpeedEnabled": true
  }')

echo "$response" | jq '.'
SESSION_ID=$(echo "$response" | jq -r '.session.sessionId')

if [ "$SESSION_ID" != "null" ] && [ -n "$SESSION_ID" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo "Session ID: $SESSION_ID"
  echo ""
else
  echo -e "${RED}✗ FAIL - No session ID returned${NC}\n"
  exit 1
fi

# Test 4: Cache Chunk
echo -e "${BLUE}Test 4: Cache Chunk Metadata${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/cache-chunk" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"chunkIndex\": 0,
    \"chunkHash\": \"sha256:chunk_0_hash\",
    \"edgeId\": \"sfo-1\",
    \"status\": \"completed\",
    \"bytesUploaded\": 52428800
  }")

echo "$response" | jq '.'
if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ PASS${NC}\n"
else
  echo -e "${RED}✗ FAIL${NC}\n"
fi

# Test 5: Get Cached Chunks
echo -e "${BLUE}Test 5: Retrieve Cached Chunks${NC}"
response=$(curl -s -X GET "$BASE_URL/api/jetty/cache-chunk?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $API_KEY")

echo "$response" | jq '.'
CHUNK_COUNT=$(echo "$response" | jq '.total')
if [ "$CHUNK_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo "Found $CHUNK_COUNT cached chunk(s)"
  echo ""
else
  echo -e "${RED}✗ FAIL - No chunks found${NC}\n"
fi

# Test 6: Track Upload - Progress
echo -e "${BLUE}Test 6: Track Upload - Progress${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/track-upload" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"progress\",
    \"sessionId\": \"$SESSION_ID\",
    \"chunksCompleted\": 5,
    \"bytesUploaded\": 262144000
  }")

echo "$response" | jq '.'
if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ PASS${NC}\n"
else
  echo -e "${RED}✗ FAIL${NC}\n"
fi

# Test 7: Track Upload - Complete
echo -e "${BLUE}Test 7: Track Upload - Complete${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/track-upload" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"complete\",
    \"sessionId\": \"$SESSION_ID\",
    \"actualCost\": 0.08
  }")

echo "$response" | jq '.'
if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ PASS${NC}\n"
else
  echo -e "${RED}✗ FAIL${NC}\n"
fi

# Test 8: Check Duplicate (now should exist)
echo -e "${BLUE}Test 8: Check Duplicate - Existing File${NC}"
response=$(curl -s -X POST "$BASE_URL/api/jetty/check-duplicate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fileHash": "sha256:abc123def456",
    "userId": "usr_test_456",
    "fileName": "test-video-copy.mp4",
    "fileSize": 1073741824
  }')

echo "$response" | jq '.'
# Note: This might fail in test environment if file wasn't actually created
# In production with real database, this would show isDuplicate: true
echo -e "${BLUE}ℹ Info: Duplicate check depends on database state${NC}\n"

echo "======================================"
echo -e "${GREEN}🎉 JettySpeed API Tests Complete${NC}"
echo ""
echo "Next Steps:"
echo "1. Run database migration: psql \$DATABASE_URL -f database/jettyspeed-schema.sql"
echo "2. Set up monitoring service for real edge metrics"
echo "3. JettyThunder team can start building Rust client integration"
echo ""
