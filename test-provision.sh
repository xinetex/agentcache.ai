#!/bin/bash

# Test AgentCache provisioning endpoint
# This simulates what the 1-click install would do

echo "Testing AgentCache Provisioning..."
echo ""

curl -X POST https://agentcache.ai/api/portal/provision \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "JettyThunder Test",
    "email": "test@jettythunder.app",
    "sector": "filestorage",
    "planTier": "professional",
    "namespaces": ["jt_test_seagate", "jt_test_wd"]
  }' | jq '.'

echo ""
echo "If successful, you'll see:"
echo "  - Organization ID"
echo "  - API Key (ac_live_...)"
echo "  - Default namespaces created"
