#!/bin/bash

# Test Customer-Critical Endpoints
#
# This script runs integration tests against customer-critical endpoints
# to ensure audio1.tv and jettythunder.app services remain functional.
#
# Usage:
#   ./scripts/test-customer-endpoints.sh [environment]
#
# Examples:
#   ./scripts/test-customer-endpoints.sh production  # Test against production
#   ./scripts/test-customer-endpoints.sh preview    # Test against Vercel preview
#   ./scripts/test-customer-endpoints.sh            # Test against staging/localhost

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment setup
ENVIRONMENT=${1:-staging}
TEST_BASE_URL=""

case "$ENVIRONMENT" in
  production)
    TEST_BASE_URL="https://agentcache.ai"
    echo -e "${YELLOW}⚠️  WARNING: Testing against PRODUCTION${NC}"
    echo "Press Ctrl+C within 5 seconds to cancel..."
    sleep 5
    ;;
  preview)
    # Get Vercel preview URL from git branch
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    TEST_BASE_URL="https://agentcache-ai-$(echo $BRANCH | tr '/' '-')-drgnflai-jetty.vercel.app"
    echo -e "${BLUE}Testing against preview deployment: $TEST_BASE_URL${NC}"
    ;;
  staging)
    TEST_BASE_URL="https://agentcache-ai-staging.vercel.app"
    echo -e "${BLUE}Testing against staging: $TEST_BASE_URL${NC}"
    ;;
  localhost)
    TEST_BASE_URL="http://localhost:3001"
    echo -e "${BLUE}Testing against localhost: $TEST_BASE_URL${NC}"
    ;;
  *)
    echo -e "${RED}Unknown environment: $ENVIRONMENT${NC}"
    echo "Valid options: production, preview, staging, localhost"
    exit 1
    ;;
esac

echo "================================================="
echo "  AgentCache Customer Endpoint Tests"
echo "================================================="
echo "Environment: $ENVIRONMENT"
echo "Base URL: $TEST_BASE_URL"
echo "================================================="
echo ""

# Export for tests
export TEST_BASE_URL=$TEST_BASE_URL
export RUN_INTEGRATION_TESTS=true

# Check if npm test is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install Node.js and npm.${NC}"
    exit 1
fi

# Run tests
echo -e "${BLUE}Running audio1.tv endpoint tests...${NC}"
npm test tests/integration/audio1tv.test.ts

echo ""
echo -e "${BLUE}Running jettythunder.app endpoint tests...${NC}"
npm test tests/integration/jettythunder.test.ts

# Summary
echo ""
echo "================================================="
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All customer endpoint tests passed!${NC}"
    echo "================================================="
    exit 0
else
    echo -e "${RED}❌ Some customer endpoint tests failed!${NC}"
    echo "================================================="
    exit 1
fi
