#!/bin/bash
# End-to-End Test: JettyThunder Organization Provisioning
# Tests the complete flow from provisioning to cache API usage

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE="${API_BASE:-https://agentcache.ai}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  JettyThunder Provisioning Test Suite ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Provision Organization
echo -e "${BLUE}[1/5] Provisioning JettyThunder organization...${NC}"

PROVISION_RESPONSE=$(curl -s -X POST "${API_BASE}/api/portal/provision" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": {
      "name": "JettyThunder Test",
      "sector": "filestorage",
      "contact_email": "test@jettythunder.app",
      "contact_name": "Test Admin",
      "plan_tier": "enterprise"
    },
    "scale": "single_tenant",
    "namespace_strategy": "auto"
  }')

if echo "$PROVISION_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Organization provisioned successfully${NC}"
    
    ORG_NAME=$(echo "$PROVISION_RESPONSE" | jq -r '.organization.name')
    ORG_SLUG=$(echo "$PROVISION_RESPONSE" | jq -r '.organization.slug')
    API_KEY=$(echo "$PROVISION_RESPONSE" | jq -r '.api_key')
    
    echo "  Organization: $ORG_NAME"
    echo "  Slug: $ORG_SLUG"
    echo "  API Key: ${API_KEY:0:20}..."
    
    # Extract namespaces
    NAMESPACES=$(echo "$PROVISION_RESPONSE" | jq -r '.namespaces[].name')
    echo "  Namespaces:"
    for ns in $NAMESPACES; do
        echo "    - $ns"
    done
else
    echo -e "${RED}✗ Provisioning failed${NC}"
    echo "$PROVISION_RESPONSE" | jq '.'
    exit 1
fi

echo ""

# Step 2: Test Cache SET with first namespace
FIRST_NAMESPACE=$(echo "$NAMESPACES" | head -n1)
echo -e "${BLUE}[2/5] Testing cache SET (namespace: $FIRST_NAMESPACE)...${NC}"

SET_RESPONSE=$(curl -s -X POST "${API_BASE}/api/cache/set" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "X-Cache-Namespace: ${FIRST_NAMESPACE}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "test-key-001",
    "value": {"message": "Hello from JettyThunder!", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
    "ttl": 3600
  }')

if echo "$SET_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Cache SET successful${NC}"
    echo "$SET_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Cache SET failed${NC}"
    echo "$SET_RESPONSE" | jq '.'
    exit 1
fi

echo ""

# Step 3: Test Cache GET
echo -e "${BLUE}[3/5] Testing cache GET (namespace: $FIRST_NAMESPACE)...${NC}"

GET_RESPONSE=$(curl -s -X GET "${API_BASE}/api/cache/get?key=test-key-001" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "X-Cache-Namespace: ${FIRST_NAMESPACE}")

if echo "$GET_RESPONSE" | jq -e '.value' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Cache GET successful (HIT)${NC}"
    echo "$GET_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Cache GET failed${NC}"
    echo "$GET_RESPONSE" | jq '.'
    exit 1
fi

echo ""

# Step 4: Test namespace isolation (try accessing with wrong namespace)
SECOND_NAMESPACE=$(echo "$NAMESPACES" | sed -n '2p')
if [ -n "$SECOND_NAMESPACE" ]; then
    echo -e "${BLUE}[4/5] Testing namespace isolation (wrong namespace: $SECOND_NAMESPACE)...${NC}"
    
    ISOLATION_RESPONSE=$(curl -s -X GET "${API_BASE}/api/cache/get?key=test-key-001" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "X-Cache-Namespace: ${SECOND_NAMESPACE}")
    
    if echo "$ISOLATION_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Namespace isolation working (expected 404)${NC}"
        echo "$ISOLATION_RESPONSE" | jq '.'
    else
        echo -e "${RED}✗ Namespace isolation failed (data leaked!)${NC}"
        echo "$ISOLATION_RESPONSE" | jq '.'
        exit 1
    fi
else
    echo -e "${BLUE}[4/5] Skipping namespace isolation test (only one namespace)${NC}"
fi

echo ""

# Step 5: Test unauthorized access
echo -e "${BLUE}[5/5] Testing access control (invalid API key)...${NC}"

UNAUTH_RESPONSE=$(curl -s -X GET "${API_BASE}/api/cache/get?key=test-key-001" \
  -H "Authorization: Bearer ac_live_invalid_fake_key_12345" \
  -H "X-Cache-Namespace: ${FIRST_NAMESPACE}")

if echo "$UNAUTH_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Access control working (expected 401)${NC}"
    echo "$UNAUTH_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Access control failed (unauthorized access allowed!)${NC}"
    echo "$UNAUTH_RESPONSE" | jq '.'
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All Tests Passed! 🎉                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "JettyThunder is ready to onboard!"
echo ""
echo "Integration Details:"
echo "  API Base: $API_BASE"
echo "  Organization: $ORG_NAME ($ORG_SLUG)"
echo "  API Key: ${API_KEY:0:20}...${API_KEY: -8}"
echo "  Namespaces: $(echo $NAMESPACES | tr '\n' ', ' | sed 's/,$//')"
echo ""
echo "Example cURL request:"
echo "  curl -X POST '$API_BASE/api/cache/set' \\"
echo "    -H 'Authorization: Bearer $API_KEY' \\"
echo "    -H 'X-Cache-Namespace: $FIRST_NAMESPACE' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"key\": \"my-key\", \"value\": \"my-value\"}'"
