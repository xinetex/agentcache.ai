#!/bin/sh
set -eu

IMAGE_NAME="${AGENTCACHE_MCP_IMAGE:-agentcache-mcp:local}"
API_URL="${AGENTCACHE_API_URL:-https://agentcache.ai}"

if [ -z "${AGENTCACHE_API_KEY:-}" ]; then
  echo "AGENTCACHE_API_KEY is required." >&2
  exit 1
fi

docker build -f Dockerfile.mcp -t "${IMAGE_NAME}" .

exec docker run --rm -i \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --pids-limit=128 \
  --memory=512m \
  --cpus=1 \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --user 1001:1001 \
  -e AGENTCACHE_API_KEY="${AGENTCACHE_API_KEY}" \
  -e AGENTCACHE_API_URL="${API_URL}" \
  -e AGENTCACHE_MCP_SANDBOX=container \
  "${IMAGE_NAME}"
