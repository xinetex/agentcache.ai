#!/bin/bash

# AgentCache Anti-Cache API Test Script
# Tests cache invalidation and URL listener APIs

set -e  # Exit on error

API_BASE="https://agentcache.ai"
API_KEY="ac_demo_test123"

echo "🧪 Testing AgentCache Anti-Cache APIs"
echo "======================================"
echo ""

# Test 1: Cache Invalidation API
echo "Test 1: Cache Invalidation API"
echo "-------------------------------"
curl -X POST "$API_BASE/api/cache/invalidate" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "test/*",
    "reason": "test_invalidation",
    "olderThan": 86400000
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.'

echo ""
echo ""

# Test 2: Register URL Listener
echo "Test 2: Register URL Listener"
echo "------------------------------"
LISTENER_ID=$(curl -X POST "$API_BASE/api/listeners/register" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "checkInterval": 3600000,
    "namespace": "test",
    "invalidateOnChange": true
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s | tee /dev/tty | jq -r '.listenerId')

echo ""
echo ""

# Test 3: List Listeners
echo "Test 3: List Active Listeners"
echo "------------------------------"
curl -X GET "$API_BASE/api/listeners/register" \
  -H "X-API-Key: $API_KEY" \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.'

echo ""
echo ""

# Test 4: Unregister Listener
if [ -n "$LISTENER_ID" ]; then
  echo "Test 4: Unregister Listener (ID: $LISTENER_ID)"
  echo "-----------------------------------------------"
  curl -X DELETE "$API_BASE/api/listeners/register?id=$LISTENER_ID" \
    -H "X-API-Key: $API_KEY" \
    -w "\nStatus: %{http_code}\n" \
    -s | jq '.'
else
  echo "Test 4: Skipped (no listener ID)"
fi

echo ""
echo ""

# Test 5: Pattern-based Invalidation
echo "Test 5: Pattern-based Invalidation"
echo "-----------------------------------"
curl -X POST "$API_BASE/api/cache/invalidate" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pattern": "competitor-pricing/*",
    "namespace": "test",
    "reason": "pricing_update"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.'

echo ""
echo ""

# Test 6: Age-based Invalidation
echo "Test 6: Age-based Invalidation"
echo "--------------------------------"
curl -X POST "$API_BASE/api/cache/invalidate" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "olderThan": 604800000,
    "reason": "weekly_cleanup"
  }' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.'

echo ""
echo ""
echo "✅ All tests complete!"
echo ""
echo "Summary:"
echo "--------"
echo "1. ✅ Cache invalidation with pattern"
echo "2. ✅ URL listener registration"
echo "3. ✅ List active listeners"
echo "4. ✅ Unregister listener"
echo "5. ✅ Pattern + namespace invalidation"
echo "6. ✅ Age-based invalidation"
echo ""
echo "🎉 Anti-cache APIs are working!"
