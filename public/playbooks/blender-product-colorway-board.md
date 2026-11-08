# Blender: Create a three-color product comparison board

**Status:** Verified · **Version:** 0.1.0 · **Verified app:** Blender 5.2.0 LTS

Build three simple bottle-shaped product variants in ocean, citrus, and moss colors, then save one editable Blender project and a comparison render. The scene is generated from original geometry and materials; it uses no customer or downloaded assets.

## Before you begin

- Use Blender 5.2.0 LTS. Other versions may work, but have not been verified.
- Ask the user to select an output directory. Confirm `product-colorway-board.blend` and `product-colorway-board.png` are unused.
- The script writes only to that directory and refuses to overwrite files.

## Run

Fetch [`create-colorway-board.py`](./create-colorway-board.py) and run it with Blender:

```sh
blender --background --python create-colorway-board.py -- /approved/output/directory
```

Use the approved directory in place of the example path.

## Verify the result

1. Confirm successful process exit and non-empty project and render files.
2. Reopen the project and confirm there are three named bottle bodies and three distinct enamel materials.
3. Inspect the PNG: all three variants should be in frame, visibly different in color, and labeled.
4. Report Blender version, paths, checks, and limitations. This playbook has been run twice and the saved project reopened on Blender 5.2.0 LTS only.

## Recovery

- Stop if either output name is already taken; ask before selecting another location.
- If any variant is clipped, increase camera `ortho_scale` or adjust the target, then save to a new approved path.
- If labels are hard to read, adjust their size or front offset in a copy. Check they remain in front of each bottle.
- If Eevee is unavailable or a script operation fails, retain the error output and report the app version before changing the workflow.

## Provenance

The script, geometry, materials, and procedure are original AgentCache content. API references: [Blender mesh operators](https://docs.blender.org/api/current/bpy.ops.mesh.html) and [Material](https://docs.blender.org/api/current/bpy.types.Material.html). No source prose, images, or scripts are reproduced; the references are recorded as API-fact lookups only.

Download the [sample Blender project](./samples/product-colorway-board.blend) to inspect the verified result.
