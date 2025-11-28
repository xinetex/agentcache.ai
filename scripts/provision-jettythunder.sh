#!/bin/bash

# Provision JettyThunder API Key
# Usage: ./scripts/provision-jettythunder.sh [environment]

ENVIRONMENT=${1:-production}
API_URL=${AGENTCACHE_API_URL:-http://localhost:3001}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AgentCache API Key Provisioning"
echo "  Client: JettyThunder"
echo "  Environment: $ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📡 Sending provisioning request to: $API_URL/api/provision/jettythunder"
echo ""

response=$(curl -s -X POST "$API_URL/api/provision/jettythunder" \
  -H "Content-Type: application/json" \
  -d "{\"environment\": \"$ENVIRONMENT\"}")

# Check if request was successful
if echo "$response" | grep -q '"success": *true'; then
  echo "✅ Successfully provisioned JettyThunder API key!"
  echo ""
  
  # Extract key and namespace
  api_key=$(echo "$response" | grep -o '"api_key": *"[^"]*"' | sed 's/"api_key": *"\(.*\)"/\1/')
  namespace=$(echo "$response" | grep -o '"namespace": *"[^"]*"' | sed 's/"namespace": *"\(.*\)"/\1/')
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Provisioning Details"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "API Key:      $api_key"
  echo "Namespace:    $namespace"
  echo "Environment:  $ENVIRONMENT"
  echo "Rate Limit:   10,000,000 requests/month"
  echo "Tier:         Enterprise"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Environment Variables (Add to Vercel)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "AGENTCACHE_API_KEY=$api_key"
  echo "AGENTCACHE_API_URL=$API_URL"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Next Steps"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1. Add environment variables to Vercel:"
  echo "   vercel env add AGENTCACHE_API_KEY"
  echo "   (paste the key above)"
  echo ""
  echo "2. Update edge-cdn.ts in JettyThunder repo"
  echo ""
  echo "3. Deploy to Vercel:"
  echo "   git push origin main"
  echo ""
  echo "4. Test the integration"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📚 Documentation: $API_URL/docs/jettythunder"
  echo "💬 Support: support@agentcache.ai"
  echo ""
else
  echo "❌ Failed to provision API key"
  echo ""
  echo "Response:"
  echo "$response" | jq '.' 2>/dev/null || echo "$response"
  echo ""
  exit 1
fi
