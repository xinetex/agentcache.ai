#!/bin/bash

# go-live.sh - Verify Production Readiness

echo "🔍 Verifying Production Readiness..."

# 1. Check Stripe Keys
if [[ -z "$STRIPE_SECRET_KEY" ]]; then
  echo "❌ STRIPE_SECRET_KEY is missing!"
  exit 1
fi

if [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
  echo "⚠️  STRIPE_SECRET_KEY is still in TEST mode (sk_test_...)"
  echo "   (This is fine for staging, but NOT for moneymaking)"
else
  echo "✅ STRIPE_SECRET_KEY looks like a LIVE key"
fi

# 2. Check Webhook Endpoint
echo "🔍 Checking billing webhook endpoint..."
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" https://agentcache.ai/api/webhooks/stripe)

if [[ "$HTTP_STATUS" == "405" ]] || [[ "$HTTP_STATUS" == "200" ]]; then
  # 405 Method Not Allowed is good (means it exists but wants POST)
  echo "✅ Webhook endpoint is reachable (Status: $HTTP_STATUS)"
else
  echo "❌ Webhook endpoint failed check (Status: $HTTP_STATUS)"
fi

echo "🚀 Ready to go live if keys are set!"
