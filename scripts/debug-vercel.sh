#!/bin/bash
# automated Vercel log fetcher

echo "🔍 Finding latest production deployment..."
DEPLOYMENT_URL=$(npx vercel ls --prod | grep "https://" | head -n 1 | awk '{print $2}')

if [ -z "$DEPLOYMENT_URL" ]; then
  echo "❌ Could not find a production deployment."
  exit 1
fi

echo "✅ Found: $DEPLOYMENT_URL"
echo "📜 Fetching logs (Ctrl+C to stop trailing)..."
npx vercel logs "$DEPLOYMENT_URL" $1 $2
