# Jetty Prod Bootstrap Status

Updated: 2026-03-14
Host: `jetty-prod-1`
IPv4: `178.104.4.86`
Role: `ClawSave / MaxxPoly runtime host`

## Current State

The server was rebuilt onto a clean Ubuntu 24.04 image and SSH access was recovered with the local
operator key.

The following host bootstrap work is complete:

- `root` SSH access works with the local `id_ed25519` key.
- Base packages were installed: `git`, `curl`, `ca-certificates`, `nodejs`, `npm`, `sudo`.
- The local `jettyagent` checkout was copied to `/opt/jettyagent`.
- Workspace dependencies were installed with `npm ci` in
  `/opt/jettyagent/prophet-office`.
- The `jetty` system user exists.
- The MaxxPoly service and timer units were installed:
  - `maxxpoly-autopilot.service`
  - `maxxpoly-watchdog.service`
  - `maxxpoly-watchdog.timer`
  - `maxxpoly-guardrail.service`
  - `maxxpoly-guardrail.timer`
- The environment template was installed at `/etc/jettyagent/jettyagent.env`.
- All MaxxPoly units were left disabled on purpose.

## Safety Constraints Applied

The trading bot was not started.

The following were intentionally not changed:

- MaxxPoly strategy logic
- Kalshi credentials
- Runtime secret material
- Service enablement state

This host is scaffolded but not live.

## Verified Host Artifacts

- Repo root: `/opt/jettyagent`
- Env file: `/etc/jettyagent/jettyagent.env`
- Service units: `/etc/systemd/system/maxxpoly-*`
- Runner scripts:
  - `/usr/local/bin/maxxpoly-autopilot-runner.sh`
  - `/usr/local/bin/maxxpoly-watchdog.sh`
  - `/usr/local/bin/maxxpoly-guardrail.sh`

## Remaining Bring-Up Work

### Required before any service start

Populate `/etc/jettyagent/jettyagent.env` with real values for:

- `KALSHI_API_KEY_ID`
- `KALSHI_API_KEY_FILE`
- `AGENT_PRIVATE_KEY`
- `JETTY_STORAGE_API_KEY`
- `JETTY_STORAGE_API_URL`

Also ensure the referenced Kalshi key file exists at the path configured by
`KALSHI_API_KEY_FILE`, with restrictive permissions.

### Recommended before production start

- Upgrade the host from Ubuntu's Node 18 baseline to Node 20 and rerun `npm ci`.
  Reason: several dependencies warn that they expect Node `>=20.10`.
- Run one manual dry check before enabling the service:
  - `cd /opt/jettyagent/prophet-office`
  - `npm run maxxpoly:netcheck`
  - `npm run maxxpoly:guardrail -- --json`
- Confirm storage/API reachability from the host.
- Add passive receipt export and relay wiring after the runtime is stable.

## Start Sequence

Once secrets are in place and a manual dry check passes:

```bash
systemctl enable --now maxxpoly-autopilot.service
systemctl enable --now maxxpoly-watchdog.timer
systemctl enable --now maxxpoly-guardrail.timer
```

## Post-Start Verification

```bash
systemctl status maxxpoly-autopilot.service
systemctl status maxxpoly-watchdog.timer
systemctl status maxxpoly-guardrail.timer
journalctl -u maxxpoly-autopilot.service -n 100 --no-pager
```

## Strategic Fit

This host is the right place for the continuous runtime pieces that should not depend on Vercel:

- MaxxPoly execution loop
- watchdog and guardrail timers
- receipt relay
- future ROI and trust backfill workers

Public product surfaces should remain on Vercel. Continuous agent operations should remain on
Hetzner.
