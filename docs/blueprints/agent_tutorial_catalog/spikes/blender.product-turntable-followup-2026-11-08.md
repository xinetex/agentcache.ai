# Blender Product Turntable — Follow-up Maintainer Run

**Date:** 2026-11-08
**Application:** Blender 5.2.0 LTS, build hash `fbe6228777e7`
**Run status:** Passed in a fresh temporary output directory; one run only. This is maintainer evidence for the live Blender seed, not an opted-in external-agent run and not new evidence for the Inkscape or Synfig adapters.

## Execution

The initial restricted launch exited with code 139 during Metal capability detection before the script started. The documented command succeeded when run through the approved external process permission. The script wrote only to `/private/tmp/agentcache-ai-blender-turntable`.

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --threads 4 \
  --python public/playbooks/create-turntable.py -- \
  /private/tmp/agentcache-ai-blender-turntable
```

Created `product-turntable.blend` and `product-turntable.png`. The render was visually inspected: product and plinth are fully framed and visible with studio lighting.

A separate clean Blender process reopened the project and asserted:

- `Product` and `Display plinth` exist;
- the scene has a camera and at least three lights;
- animation data is present and the end frame is 121;
- render dimensions are 900×900.

The reopen process printed `REOPEN_CHECK_OK 8 121 900 900` and exited 0. This proves one current local run and reopen check. Existing pilot validation records the separate two-run evidence for the published Blender 5.2.0 playbook.
