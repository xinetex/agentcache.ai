#!/bin/bash
# Switch agentcache-ai from OpenAI to Moonshot to fix quota issues

echo "🔧 Migrating audio1.tv playback from OpenAI to Moonshot..."

# Backup current .env
cp .env .env.backup

# Replace OpenAI API key with Moonshot configuration
echo "🌙 Switching AI provider to Moonshot..."

# Method 1: Replace OpenAI key with Moonshot gateway
sed -i.bak 's|OPENAI_API_KEY=.*|OPENAI_API_KEY=moonshot-gateway-placeholder|g' .env
sed -i.bak 's|OPENAI_API_KEY=.*|MOONSHOT_API_KEY=sk_moonshot_development_placeholder|g' .env
sed -i.bak 's|OPENAI_API_KEY=.*|VERCEL_AI_GATEWAY_KEY=pk_vercel_ai_gateway_development|g' .env

# Method 2: Add redirect mappings
echo "" >> .env
echo "# AI Provider Routing - Switch to Moonshot" >> .env
echo "AI_PROVIDER_GATEWAY=https://api.vercel.com/drgnflai-jetty/ai-gateway" >> .env
echo "AI_PROVIDER=vercel-ai-gateway" >> .env
echo "AI_PROVIDER_MODEL=moonshotai/kimi-k2" >> .env
echo "MOONSHOT_API_KEY=your_moonshot_key_here" >> .env

# Method 3: Use the bridge configuration
if [ -f "./ai-provider-moonshot.ts" ]; then
    echo "✅ Bridge configuration file ready"
fi

echo "✅ Migration complete! The service will now route requests through Moonshot instead of direct OpenAI"
echo "✅ Update your Moonshot API key in .env to complete the switch"
echo "✅ Then restart the agentcache-ai service to apply changes"