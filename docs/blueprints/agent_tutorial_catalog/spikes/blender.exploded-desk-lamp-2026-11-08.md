# Blender Exploded Desk Lamp Pilot

**Date:** 2026-11-08 14:00 UTC
**Application:** Blender 5.2.0 LTS, build hash `fbe6228777e7`
**Scope:** Two successful fresh script runs, one clean-process project reopen, and visual review of the render.

## Result

| Run | Project / render | Reopen | Result |
| --- | --- | --- | --- |
| 1 | `/private/tmp/agentcache-ai-exploded-run2/exploded-desk-lamp.blend` and `.png`; 1000×1000 | Not reopened | Pass |
| 2 | `/private/tmp/agentcache-ai-exploded-run3/exploded-desk-lamp.blend` and `.png`; 1000×1000 | Separate Blender process; six named mesh parts, six labels, camera, lights, and dimensions checked | Pass |

Both runs exited with code 0, created non-empty outputs, and passed the script's component count and unique-name assertions. The clean reopen printed `PROJECT_REOPEN_OK ... parts=6 labels=6 1000 1000`. The render was visually inspected: all components are separated along the vertical assembly axis, labels are readable, and the full product fits in frame.

The first design trial revealed that Blender's generated default object names were unique but not semantic. That output was excluded from verification. The script was corrected to set and assert the six semantic component names before both counted runs.

## Limitations

- A restricted first Blender launch exited before script startup during Metal capability detection. The two counted runs completed with the approved local graphics-capable process permission; no network was used.
- Blender 5.2.0 emitted a deprecation warning that `Material.use_nodes` is expected to be removed in Blender 6.0. The script works on 5.2.0; future-version compatibility is unverified.
- This is an illustrative exploded layout, not a dimensionally accurate manufacturing model.
- The runs were performed by the maintainer. They are not external-agent execution evidence.

## Published artifacts

The sample `.blend` and preview PNG were copied from the second successful run into `public/playbooks/samples/exploded-desk-lamp.blend` and `public/playbooks/previews/exploded-desk-lamp.png`. The human and machine playbooks state Blender 5.2.0 LTS as the only tested version.
