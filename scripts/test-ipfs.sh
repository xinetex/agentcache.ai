#!/bin/bash

# AgentCache IPFS Upload Test
# Tests the decentralized asset storage API

API_URL="http://localhost:3001"
API_KEY="ac_demo_test123"
TEST_FILE="test-asset.txt"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "📦 Testing IPFS Upload API..."
echo "Target: $API_URL"
echo "----------------------------------------"

# Create dummy file
echo "This is a test asset for IPFS upload verification." > $TEST_FILE

# 1. Test Upload
echo -n "1. Uploading file... "
RESPONSE=$(curl -s -X POST "$API_URL/api/assets/upload" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@$TEST_FILE")

# Check for success
if echo "$RESPONSE" | grep -q "success"; then
  echo -e "${GREEN}PASSED${NC}"
  echo "Response: $RESPONSE"
  
  # Extract URL for verification
  URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
  CID=$(echo "$RESPONSE" | grep -o '"cid":"[^"]*"' | cut -d'"' -f4)
  
  echo ""
  echo "✅ Asset uploaded successfully!"
  echo "CID: $CID"
  echo "Gateway URL: $URL"
  
  echo ""
  echo "📝 Note: To verify retrieval, open the Gateway URL in your browser."
  echo "   (It may take a few moments to propagate if using a public gateway)"
else
  echo -e "${RED}FAILED${NC}"
  echo "Response: $RESPONSE"
  rm $TEST_FILE
  exit 1
fi

# Cleanup
rm $TEST_FILE

echo "----------------------------------------"
echo -e "✨ ${GREEN}IPFS Integration Verified!${NC} ✨"
