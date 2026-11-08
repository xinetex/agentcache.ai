# Blender Live Seed — Local Maintainer Smoke Pass

**Date:** 2026-11-08
**Application:** Blender 5.2.0 LTS, build hash `fbe6228777e7`
**Scope:** One fresh script run per live playbook, followed by opening all three saved projects in a separate clean Blender process. This is maintainer evidence, not an opted-in external-agent run, a second-run verification claim, or evidence for another app.

## Results

| Playbook | Script run | Output dimensions | Reopen checks | Result |
| --- | --- | --- | --- | --- |
| Product turntable | Exit 0; `.blend` and PNG written | 900×900 | `Product`, `Display plinth`, camera, three lights, animation data, frame end 121 | Pass |
| Typographic title card | Exit 0; `.blend` and PNG written | 1200×800 | Camera, light, scene objects, render dimensions | Pass |
| Product colorway board | Exit 0; `.blend` and PNG written | 1200×750 | Camera, lights, scene objects, render dimensions | Pass |

All three renders were visually opened. The turntable product/plinth are visible and fully framed; the title card is legible and centered; the three colorway bottles and labels are visible. Reopen process output:

```text
PROJECT_REOPEN_OK .../product-turntable.blend 8 900 900
PROJECT_REOPEN_OK .../typographic-title-card.blend 6 1200 800
PROJECT_REOPEN_OK .../product-colorway-board.blend 15 1200 750
```

## Environment and limits

The first restricted turntable launch exited with code 139 during Metal capability detection before the script started. The playbooks completed when Blender was run with the approved external process permission. `Material.use_nodes` emitted a Blender 6.0 deprecation warning in all scripts; all three results were on Blender 5.2.0 LTS only.

Temporary outputs are in `/private/tmp/agentcache-ai-blender-{turntable,titlecard,colorway}` and are not public catalog assets. Existing published validation evidence still governs the `verified` labels. This smoke pass only confirms the three current scripts run and their project files reopen in the available app version.

## Live discovery check

The public `/create` page displayed three Blender playbooks and the live JSON index returned those same three records, each marked verified for Blender 5.2.0 LTS. The browser's direct navigation to the `.py` script URL was blocked by the client (`ERR_BLOCKED_BY_CLIENT`), so this session did not independently fetch the production-hosted script or binary sample. The generated local scripts were run from the current workspace; do not describe that as proof that a newly fetched remote script executed.
