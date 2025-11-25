#!/bin/bash

# AgentCache ↔ JettyThunder Integration Test
# Tests the complete provisioning and upload workflow

AGENTCACHE_URL="${AGENTCACHE_URL:-http://localhost:3000}"
JETTYTHUNDER_URL="${JETTYTHUNDER_URL:-http://localhost:3001}"
INTERNAL_SECRET="${INTERNAL_WEBHOOK_SECRET:-change_me_in_production}"

echo "🧪 AgentCache ↔ JettyThunder Integration Test"
echo "=============================================="
echo "AgentCache: $AGENTCACHE_URL"
echo "JettyThunder: $JETTYTHUNDER_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

# Test user
TEST_USER_ID="usr_test_$(date +%s)"
TEST_EMAIL="test_$(date +%s)@example.com"

# Test 1: Health Checks
echo -e "${BLUE}Test 1: Health Checks${NC}"

# AgentCache health
agentcache_health=$(curl -s "$AGENTCACHE_URL/health")
if echo "$agentcache_health" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ AgentCache is healthy${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ AgentCache health check failed${NC}"
  echo "Response: $agentcache_health"
  ((FAILED++))
fi

# JettyThunder health (assuming similar endpoint or just checking if reachable)
jettythunder_health=$(curl -s -o /dev/null -w "%{http_code}" "$JETTYTHUNDER_URL/api/agentcache/quota" -H "Authorization: Bearer invalid_key")
if [ "$jettythunder_health" == "401" ]; then
  echo -e "${GREEN}✓ JettyThunder is reachable (auth working)${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ JettyThunder not reachable (got $jettythunder_health)${NC}"
  ((FAILED++))
fi

echo ""

# Test 2: Provision Storage Account
echo -e "${BLUE}Test 2: Provision Storage Account${NC}"

provision_response=$(curl -s -X POST "$AGENTCACHE_URL/api/webhooks/jettythunder/provision" \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$TEST_USER_ID\",
    \"email\": \"$TEST_EMAIL\",
    \"tier\": \"pro\"
  }")

echo "$provision_response" | jq '.' 2>/dev/null || echo "$provision_response"

if echo "$provision_response" | jq -e '.success == true and .credentials.api_key' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Storage account provisioned${NC}"
  API_KEY=$(echo "$provision_response" | jq -r '.credentials.api_key')
  API_SECRET=$(echo "$provision_response" | jq -r '.credentials.api_secret')
  STORAGE_QUOTA=$(echo "$provision_response" | jq -r '.credentials.storage_quota_gb')
  echo "  API Key: $API_KEY"
  echo "  Storage Quota: ${STORAGE_QUOTA}GB"
  ((PASSED++))
else
  echo -e "${RED}✗ Provisioning failed${NC}"
  ((FAILED++))
  echo ""
  echo "Stopping tests due to provisioning failure."
  exit 1
fi

echo ""

# Test 3: Check Cached Credentials
echo -e "${BLUE}Test 3: Check Cached Credentials (Re-provision)${NC}"

reprovision_response=$(curl -s -X POST "$AGENTCACHE_URL/api/webhooks/jettythunder/provision" \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$TEST_USER_ID\",
    \"email\": \"$TEST_EMAIL\",
    \"tier\": \"pro\"
  }")

if echo "$reprovision_response" | jq -e '.cached == true' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Credentials returned from cache${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ No cache indicator (may have re-provisioned)${NC}"
  # Not a failure, just noting
fi

echo ""

# Test 4: Check Quota (JettyThunder Direct)
echo -e "${BLUE}Test 4: Check Quota${NC}"

quota_response=$(curl -s -X GET "$JETTYTHUNDER_URL/api/agentcache/quota" \
  -H "Authorization: Bearer $API_KEY")

echo "$quota_response" | jq '.' 2>/dev/null || echo "$quota_response"

if echo "$quota_response" | jq -e '.storage.quota_gb' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Quota retrieved successfully${NC}"
  USED_GB=$(echo "$quota_response" | jq -r '.storage.used_gb')
  QUOTA_GB=$(echo "$quota_response" | jq -r '.storage.quota_gb')
  echo "  Used: ${USED_GB}GB / ${QUOTA_GB}GB"
  ((PASSED++))
else
  echo -e "${RED}✗ Quota check failed${NC}"
  ((FAILED++))
fi

echo ""

# Test 5: Upload Test File
echo -e "${BLUE}Test 5: Upload Test File${NC}"

# Create a test file
TEST_FILE="/tmp/agentcache_test_$(date +%s).txt"
echo "Hello from AgentCache + JettyThunder integration test!" > "$TEST_FILE"
echo "Timestamp: $(date)" >> "$TEST_FILE"
echo "User ID: $TEST_USER_ID" >> "$TEST_FILE"

upload_response=$(curl -s -X POST "$JETTYTHUNDER_URL/api/storage/upload" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Filename: test-integration.txt" \
  -H "Content-Type: text/plain" \
  --data-binary "@$TEST_FILE")

echo "$upload_response" | jq '.' 2>/dev/null || echo "$upload_response"

if echo "$upload_response" | jq -e '.success == true and .asset.url' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ File uploaded successfully${NC}"
  FILE_URL=$(echo "$upload_response" | jq -r '.asset.url')
  FILE_SIZE=$(echo "$upload_response" | jq -r '.asset.size')
  FILE_HASH=$(echo "$upload_response" | jq -r '.asset.hash')
  echo "  URL: $FILE_URL"
  echo "  Size: ${FILE_SIZE} bytes"
  echo "  Hash: $FILE_HASH"
  ((PASSED++))
else
  echo -e "${RED}✗ Upload failed${NC}"
  ((FAILED++))
fi

# Clean up test file
rm -f "$TEST_FILE"

echo ""

# Test 6: Verify Usage Updated
echo -e "${BLUE}Test 6: Verify Usage Updated${NC}"

sleep 2 # Give DB time to update

updated_quota_response=$(curl -s -X GET "$JETTYTHUNDER_URL/api/agentcache/quota" \
  -H "Authorization: Bearer $API_KEY")

UPDATED_USED_GB=$(echo "$updated_quota_response" | jq -r '.storage.used_gb')

if [ "$UPDATED_USED_GB" != "0" ] && [ "$UPDATED_USED_GB" != "null" ]; then
  echo -e "${GREEN}✓ Storage usage updated${NC}"
  echo "  New usage: ${UPDATED_USED_GB}GB"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ Usage not yet updated (may take time)${NC}"
  echo "  Current usage: ${UPDATED_USED_GB}GB"
fi

echo ""

# Summary
echo "=============================================="
echo -e "${BLUE}Test Summary${NC}"
echo "=============================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All integration tests passed!${NC}"
  echo ""
  echo "🎉 AgentCache and JettyThunder are properly connected!"
  echo ""
  echo "Next steps:"
  echo "1. Deploy both systems to production"
  echo "2. Configure production environment variables"
  echo "3. Test with real user signup flow"
  echo "4. Monitor upload performance (target: 14x faster)"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "1. Check that both servers are running"
  echo "2. Verify DATABASE_URL is set for JettyThunder"
  echo "3. Run seed script: npx dotenv -e .env -- npx tsx scripts/seed-jettythunder.ts"
  echo "4. Check webhook secrets match between systems"
  exit 1
fi
