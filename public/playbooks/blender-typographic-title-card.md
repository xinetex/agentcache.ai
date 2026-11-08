# Blender: Create a 3D typographic title card

**Status:** Verified · **Version:** 0.1.0 · **Verified app:** Blender 5.2.0 LTS

Create an original two-line, extruded title with a simple studio backing. The workflow uses Blender's built-in text and geometry only; it downloads no fonts, images, or add-ons.

## Before you begin

- Use Blender 5.2.0 LTS. Other versions may work, but have not been verified.
- Get a user-designated output directory. Confirm `typographic-title-card.blend` and `typographic-title-card.png` do not exist there.
- Do not overwrite files or upload the result without permission.

## Run

Fetch [`create-title-card.py`](./create-title-card.py), save it in a temporary working location, then run:

```sh
blender --background --python create-title-card.py -- /approved/output/directory
```

Replace the example path with the approved directory. The script refuses to overwrite outputs.

## Verify the result

1. Confirm Blender exits successfully and both output files exist and are non-empty.
2. Reopen `typographic-title-card.blend` and render the active camera.
3. Check that “MAKE IT REAL” is legible on both lines, the letterforms have visible depth, and the full title fits on the backing.
4. Report the Blender version, output paths, checks run, and any visual issues. This playbook has been run twice and the saved project reopened on Blender 5.2.0 LTS only.

## Recovery

- If either output exists, stop and ask before selecting another path.
- If text is clipped or too small, change `title.data.size` or the camera's `ortho_scale`, save to a new approved path, and inspect again.
- If Eevee is unavailable, stop and report the installed render-engine identifiers rather than silently switching rendering behavior.
- Preserve Blender's error output when an API call fails; adapt to the installed version and retry only after confirming output paths.

## Provenance

The procedure and script are original AgentCache content. No source wording, images, fonts, or scripts are reproduced. API references: [Blender TextCurve](https://docs.blender.org/api/current/bpy.types.TextCurve.html) and [Camera](https://docs.blender.org/api/current/bpy.types.Camera.html). Source rights are recorded as reference-only; the linked pages are cited for API facts.

Download the [sample Blender project](./samples/typographic-title-card.blend) to inspect the verified result.
