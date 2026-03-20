#!/bin/bash

# AgentCache JettySpeed Database Migration
# This script runs the JettySpeed schema migration

set -e

echo "🚀 AgentCache JettySpeed Database Migration"
echo "============================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in environment"
  echo "Loading from .env file..."
  set -a
  source .env
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL is not configured"
  echo "Please set DATABASE_URL in your .env file"
  exit 1
fi

echo "✅ Database URL configured"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "❌ ERROR: psql is not installed"
  echo "Install PostgreSQL client: brew install postgresql"
  exit 1
fi

echo "✅ psql is installed"
echo ""

# Run migration
echo "📦 Running JettySpeed schema migration..."
echo ""

if psql "$DATABASE_URL" -f database/jettyspeed-schema.sql; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "📊 Created tables:"
  echo "  - edge_locations (20 pre-seeded)"
  echo "  - edge_metrics"
  echo "  - upload_sessions"
  echo "  - file_hashes"
  echo "  - upload_patterns"
  echo "  - edge_performance_daily"
  echo "  - user_file_references"
  echo ""
  echo "🎉 Database is ready for JettySpeed!"
else
  echo ""
  echo "❌ Migration failed!"
  echo ""
  echo "If tables already exist, you can drop them first:"
  echo "  psql \$DATABASE_URL -c 'DROP TABLE IF EXISTS edge_locations CASCADE;'"
  exit 1
fi
