# Blender: Create an exploded desk lamp view

**Status:** Verified · **Version:** 0.1.0 · **Verified app:** Blender 5.2.0 LTS

Create an original six-part desk lamp scene, space the parts along the assembly axis, label each component, and render a square product view. Each product part remains a separate editable mesh.

## Before you begin

- Use Blender 5.2.0 LTS. Other versions have not been verified.
- Choose an empty output directory and confirm `exploded-desk-lamp.blend` and `exploded-desk-lamp.png` do not already exist.
- The script uses generated geometry only. It needs no network, add-ons, or downloaded assets.

## Run

Fetch [`create-exploded-lamp.py`](./create-exploded-lamp.py) and run it with Blender:

```sh
blender --background --python create-exploded-lamp.py -- /approved/output/directory
```

Replace the example with the user-approved directory. The script refuses to overwrite either output.

## Verify the result

1. Confirm Blender exits successfully and both files are non-empty.
2. Reopen the `.blend` project. Confirm it contains six separately named mesh components: base, stem, collar, diffuser, shade, and finial.
3. Confirm the project has six component labels, a camera, lights, and 1000 × 1000 render settings.
4. Inspect the PNG. All six pieces should be visibly separated, labels readable, and the assembly fully framed.
5. Report the Blender version, output paths, checks, and any limitations.

This playbook passed two fresh Blender 5.2.0 LTS runs. A separately launched process reopened the saved project and checked component names, object types, labels, camera, lights, and render dimensions.

## Recovery

- If an output filename already exists, stop and ask before choosing another directory or replacing anything.
- If a part or label is clipped, adjust camera framing in a copy and save to a new approved directory.
- If the app reports that Eevee is unavailable, preserve the error and report the app version; do not silently switch render engines.
- If a component is missing or merged, stop and report which named mesh failed verification.

## Provenance

The model, script, and procedure are original AgentCache content. Blender API references: [mesh operators](https://docs.blender.org/api/current/bpy.ops.mesh.html) and [camera data](https://docs.blender.org/api/current/bpy.types.Camera.html). No source prose, images, example models, or scripts are reproduced.

Download the [sample Blender project](./samples/exploded-desk-lamp.blend) to inspect the result.
