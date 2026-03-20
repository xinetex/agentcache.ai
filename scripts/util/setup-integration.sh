#!/bin/bash

# AgentCache + JettyThunder Integration Setup Script
# Run this to configure and test the integration

set -e

echo "🚀 AgentCache + JettyThunder Integration Setup"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Must run from agentcache-ai directory${NC}"
  exit 1
fi

# Step 1: Environment Variables
echo -e "${BLUE}Step 1: Environment Variables${NC}"
echo "-------------------------------"

if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠ No .env file found. Creating from example...${NC}"
  cp .env.example.jetty .env
  echo -e "${GREEN}✓ Created .env file${NC}"
  echo -e "${YELLOW}⚠ Please edit .env and add your credentials, then run this script again${NC}"
  exit 0
fi

# Check for required variables
MISSING=0

if ! grep -q "JETTYTHUNDER_API_URL" .env; then
  echo -e "${YELLOW}⚠ Missing JETTYTHUNDER_API_URL${NC}"
  echo "JETTYTHUNDER_API_URL=http://localhost:3001" >> .env
  echo -e "${GREEN}✓ Added JETTYTHUNDER_API_URL (dev mode)${NC}"
fi

if ! grep -q "JETTYTHUNDER_WEBHOOK_SECRET" .env; then
  echo -e "${YELLOW}⚠ Missing JETTYTHUNDER_WEBHOOK_SECRET${NC}"
  SECRET=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
  echo "JETTYTHUNDER_WEBHOOK_SECRET=$SECRET" >> .env
  echo -e "${GREEN}✓ Generated JETTYTHUNDER_WEBHOOK_SECRET${NC}"
fi

if ! grep -q "INTERNAL_WEBHOOK_SECRET" .env; then
  echo -e "${YELLOW}⚠ Missing INTERNAL_WEBHOOK_SECRET${NC}"
  SECRET=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
  echo "INTERNAL_WEBHOOK_SECRET=$SECRET" >> .env
  echo -e "${GREEN}✓ Generated INTERNAL_WEBHOOK_SECRET${NC}"
fi

echo -e "${GREEN}✓ Environment variables configured${NC}"
echo ""

# Step 2: Check JettyThunder
echo -e "${BLUE}Step 2: Check JettyThunder Project${NC}"
echo "-----------------------------------"

JETTY_PATH="/Users/letstaco/Documents/jettythunder-v2"

if [ ! -d "$JETTY_PATH" ]; then
  echo -e "${RED}✗ JettyThunder project not found at $JETTY_PATH${NC}"
  exit 1
fi

echo -e "${GREEN}✓ JettyThunder project found${NC}"

# Check if JettyThunder has the required files
if [ ! -f "$JETTY_PATH/server/routes/agentcache.ts" ]; then
  echo -e "${RED}✗ JettyThunder AgentCache routes not found${NC}"
  echo "  Please ensure JettyThunder has integrated the AgentCache endpoints"
  exit 1
fi

echo -e "${GREEN}✓ JettyThunder AgentCache routes found${NC}"
echo ""

# Step 3: Database Check
echo -e "${BLUE}Step 3: Database Status${NC}"
echo "-----------------------"

if grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  echo -e "${GREEN}✓ DATABASE_URL is set${NC}"
  echo ""
  echo "To run database migration:"
  echo "  psql \$DATABASE_URL -f database/jettyspeed-schema.sql"
else
  echo -e "${YELLOW}⚠ DATABASE_URL not set (optional for testing without DB)${NC}"
  echo "  Set DATABASE_URL in .env to enable database features"
fi

echo ""

# Step 4: Dependencies
echo -e "${BLUE}Step 4: Check Dependencies${NC}"
echo "---------------------------"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠ node_modules not found. Installing...${NC}"
  npm install
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

echo ""

# Step 5: Summary
echo "=============================================="
echo -e "${BLUE}Setup Summary${NC}"
echo "=============================================="
echo ""
echo "✅ Environment configured"
echo "✅ JettyThunder project verified"
echo "✅ Dependencies ready"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo ""
echo "1. Start AgentCache (this project):"
echo "   ${BLUE}npm run dev${NC}"
echo ""
echo "2. Start JettyThunder (in another terminal):"
echo "   ${BLUE}cd $JETTY_PATH && npm run dev${NC}"
echo ""
echo "3. Run integration tests (in another terminal):"
echo "   ${BLUE}./tests/test-jettythunder-integration.sh${NC}"
echo ""
echo "📚 Documentation:"
echo "   - Integration Guide: docs/AGENTCACHE_JETTYTHUNDER_INTEGRATION.md"
echo "   - Status Report: INTEGRATION_STATUS.md"
echo "   - API Reference: docs/JETTY_SPEED_API.md"
echo ""
echo "🎉 Setup complete! Ready to test integration."
echo ""
