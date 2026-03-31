# Supply Chain Hardening

This repo treats package installs, MCP servers, and AI-suggested tooling as code execution.

## Operating Rules

1. Do not install Python packages on the host machine for normal project work.
2. Use an isolated `venv`, container, or disposable VM for Python tooling.
3. Do not expose production credentials to experimental tooling, third-party MCP servers, or AI-generated scripts.
4. Treat MCP servers as untrusted runtimes unless they are reviewed and intentionally sandboxed.
5. Prefer exact-pinned dependencies in tracked Python requirements files.
6. Review transitive dependency changes in pull requests before merge.

## Repo Controls

- GitHub dependency review runs on dependency-related pull requests.
- Dependabot is enabled for npm and pip surfaces tracked in this repo.
- `npm run security:python-deps` enforces exact pins in:
  - `sdk/python/requirements.txt`
  - `transcoder-service/requirements.txt`

## Developer Guidance

### Python

Use isolated installs:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install --requirement sdk/python/requirements.txt
```

For CI or release-sensitive environments, prefer hash-locked requirements generated from reviewed pins.

### MCP And Agent Tooling

- Run third-party MCP servers in containers when possible.
- Do not mount `~/.ssh`, cloud credentials, wallet directories, or production `.env` files into MCP runtimes.
- Prefer read-only mounts and minimal outbound network access.
- For the built-in AgentCache MCP server, use the contained runner documented in [mcp-containment.md](/Users/letstaco/Documents/agentcache-ai/docs/security/mcp-containment.md).

### Secrets

- Keep production secrets out of day-to-day developer shells.
- Prefer short-lived credentials and brokered auth over long-lived static tokens.
- Maintain rotation playbooks for Vercel, Neon, Upstash, Stripe, GitHub, and deploy SSH keys.

## Minimum Review Standard For New Dependencies

Before merging a new dependency:

1. Confirm why it is needed.
2. Check whether it is direct or transitive.
3. Check maintenance posture and release history.
4. Check license impact.
5. Check install-time behavior and whether it runs setup hooks or native builds.
6. Confirm the dependency lands in an isolated environment if it is high risk.

## Near-Term Next Steps

1. Move sensitive local workflows into containers or disposable environments.
2. Add canary credentials and alerting for unexpected use.
3. Replace exact pins with hash-locked requirements for Python release paths.
