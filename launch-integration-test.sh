#!/bin/bash

# Launch script for AgentCache + JettyThunder integration testing
# This script will guide you through starting both systems and testing

echo "🚀 AgentCache + JettyThunder Integration Test Launcher"
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Prerequisites Check${NC}"
echo "--------------------"

# Check if setup was run
if ! grep -q "JETTYTHUNDER_WEBHOOK_SECRET" .env 2>/dev/null; then
  echo -e "${YELLOW}⚠ Setup not complete. Running setup script first...${NC}"
  ./setup-integration.sh
  echo ""
fi

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Inform user about manual steps
echo -e "${BLUE}Quick Start Guide${NC}"
echo "------------------"
echo ""
echo "You'll need 3 terminal windows:"
echo ""
echo -e "${YELLOW}Terminal 1 - AgentCache Server:${NC}"
echo "  cd /Users/letstaco/Documents/agentcache-ai"
echo "  npm run dev"
echo "  (Runs on http://localhost:3000)"
echo ""
echo -e "${YELLOW}Terminal 2 - JettyThunder Server:${NC}"
echo "  cd /Users/letstaco/Documents/jettythunder-v2"
echo "  npm run dev"
echo "  (Runs on http://localhost:3001)"
echo ""
echo -e "${YELLOW}Terminal 3 - Integration Tests:${NC}"
echo "  cd /Users/letstaco/Documents/agentcache-ai"
echo "  ./tests/test-jettythunder-integration.sh"
echo ""
echo "=================================================="
echo ""
echo -e "${GREEN}Option A: Start AgentCache Server Now${NC}"
echo "  This will start the AgentCache server in this terminal."
echo "  You'll need to open 2 more terminals for JettyThunder and tests."
echo ""
echo -e "${GREEN}Option B: Manual Setup${NC}"
echo "  Follow the instructions above to start each service manually."
echo ""
read -p "Start AgentCache server now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo -e "${BLUE}Starting AgentCache server...${NC}"
  echo ""
  echo -e "${YELLOW}Next steps (in other terminals):${NC}"
  echo "1. Start JettyThunder: cd /Users/letstaco/Documents/jettythunder-v2 && npm run dev"
  echo "2. Run tests: cd /Users/letstaco/Documents/agentcache-ai && ./tests/test-jettythunder-integration.sh"
  echo ""
  echo "Press Ctrl+C to stop the server when done testing"
  echo ""
  npm run dev
else
  echo ""
  echo -e "${GREEN}Manual setup chosen.${NC}"
  echo ""
  echo "Follow these steps in order:"
  echo ""
  echo "1. Terminal 1:"
  echo "   cd /Users/letstaco/Documents/agentcache-ai && npm run dev"
  echo ""
  echo "2. Terminal 2:"
  echo "   cd /Users/letstaco/Documents/jettythunder-v2 && npm run dev"
  echo ""
  echo "3. Terminal 3 (wait for both servers to start):"
  echo "   cd /Users/letstaco/Documents/agentcache-ai && ./tests/test-jettythunder-integration.sh"
  echo ""
  echo -e "${BLUE}📚 Documentation:${NC}"
  echo "   - INTEGRATION_STATUS.md - Complete status & next steps"
  echo "   - docs/AGENTCACHE_JETTYTHUNDER_INTEGRATION.md - Full integration guide"
  echo ""
  echo -e "${GREEN}🎉 Ready to test!${NC}"
  echo ""
fi
