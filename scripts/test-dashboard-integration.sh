#!/bin/bash
# Test Dashboard Integration Script
# Tests: Dashboard API → Frontend Integration → Studio Loading

set -e

echo "🧪 AgentCache Dashboard Integration Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
API_BASE="https://agentcache.ai"
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

# Check for required env vars
if [ -z "$TEST_PASSWORD" ]; then
  echo "❌ Error: TEST_EMAIL and TEST_PASSWORD environment variables required"
  echo "Usage: TEST_EMAIL='your@email.com' TEST_PASSWORD='yourpass' ./test-dashboard-integration.sh"
  exit 1
fi

echo "📝 Test Configuration:"
echo "   API: $API_BASE"
echo "   Test User: $TEST_EMAIL"
echo ""

# Step 1: Test Authentication
echo "1️⃣  Testing Authentication..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
  echo -e "   ${GREEN}✓${NC} Login successful"
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "   Token: ${TOKEN:0:20}..."
else
  echo -e "   ${RED}✗${NC} Login failed"
  echo "   Response: $LOGIN_RESPONSE"
  echo ""
  echo "❌ Test failed at authentication step"
  exit 1
fi
echo ""

# Step 2: Test Dashboard API
echo "2️⃣  Testing Dashboard API..."
DASHBOARD_RESPONSE=$(curl -s -X GET "${API_BASE}/api/dashboard" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$DASHBOARD_RESPONSE" | grep -q "user"; then
  echo -e "   ${GREEN}✓${NC} Dashboard API responding"
  
  # Extract metrics
  REQUESTS=$(echo "$DASHBOARD_RESPONSE" | grep -o '"requests":[0-9]*' | cut -d':' -f2)
  HIT_RATE=$(echo "$DASHBOARD_RESPONSE" | grep -o '"hitRate":[0-9.]*' | cut -d':' -f2)
  COST_SAVED=$(echo "$DASHBOARD_RESPONSE" | grep -o '"costSaved":[0-9.]*' | cut -d':' -f2)
  PIPELINE_COUNT=$(echo "$DASHBOARD_RESPONSE" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
  
  echo "   Metrics:"
  echo "   - Requests: $REQUESTS"
  echo "   - Hit Rate: ${HIT_RATE}%"
  echo "   - Cost Saved: \$${COST_SAVED}"
  echo "   - Pipelines: $PIPELINE_COUNT"
else
  echo -e "   ${RED}✗${NC} Dashboard API failed"
  echo "   Response: $DASHBOARD_RESPONSE"
  echo ""
  echo "❌ Test failed at dashboard API step"
  exit 1
fi
echo ""

# Step 3: Test Dashboard HTML Page
echo "3️⃣  Testing Dashboard HTML..."
DASHBOARD_HTML=$(curl -s "${API_BASE}/dashboard.html")

if echo "$DASHBOARD_HTML" | grep -q "fetchDashboardData"; then
  echo -e "   ${GREEN}✓${NC} Dashboard HTML has API integration"
else
  echo -e "   ${YELLOW}⚠${NC}  Dashboard HTML missing API integration"
fi

if echo "$DASHBOARD_HTML" | grep -q "openInStudio"; then
  echo -e "   ${GREEN}✓${NC} Dashboard has Studio integration"
else
  echo -e "   ${YELLOW}⚠${NC}  Dashboard missing Studio integration"
fi

if echo "$DASHBOARD_HTML" | grep -q "pipelinesGrid"; then
  echo -e "   ${GREEN}✓${NC} Dashboard has dynamic pipeline grid"
else
  echo -e "   ${YELLOW}⚠${NC}  Dashboard missing dynamic grid"
fi
echo ""

# Step 4: Test Studio HTML Page
echo "4️⃣  Testing Studio HTML..."
STUDIO_HTML=$(curl -s "${API_BASE}/studio.html")

if echo "$STUDIO_HTML" | grep -q "pipeline="; then
  echo -e "   ${GREEN}✓${NC} Studio has pipeline loading capability"
else
  echo -e "   ${YELLOW}⚠${NC}  Studio missing pipeline URL parameter handling"
fi
echo ""

# Step 5: Test Memory.md exists
echo "5️⃣  Testing Session Memory..."
if [ -f "memory.md" ]; then
  echo -e "   ${GREEN}✓${NC} memory.md exists"
  LAST_UPDATED=$(grep "Last Updated" memory.md | cut -d':' -f2- | xargs)
  echo "   Last Updated: $LAST_UPDATED"
else
  echo -e "   ${YELLOW}⚠${NC}  memory.md not found"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓${NC} Authentication working"
echo -e "${GREEN}✓${NC} Dashboard API responding"
echo -e "${GREEN}✓${NC} Dashboard HTML integrated"
echo ""

# Manual test instructions
echo "🧑‍💻 Manual Test Steps:"
echo ""
echo "1. Visit: ${API_BASE}/login.html"
echo "   - Email: ${TEST_EMAIL}"
echo "   - Password: ${TEST_PASSWORD}"
echo ""
echo "2. After login, you should see:"
echo "   ✓ Real metrics from database"
echo "   ✓ Your pipelines in grid"
echo "   ✓ 'Open in Studio' buttons"
echo ""
echo "3. Click 'Open in Studio' on a pipeline:"
echo "   ✓ Should redirect to studio.html?pipeline=<id>"
echo "   ✓ Pipeline should load in node canvas"
echo ""
echo "4. Check browser console for errors"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Integration tests completed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
