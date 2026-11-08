# Blender Playbook Pilot Validation

**Validated:** 2026-11-08 11:31 UTC
**Application:** Blender 5.2.0 LTS (`fbe6228777e7`, arm64 macOS)
**Status:** Three playbooks passed a first run, a clean rerun, saved-project reopening, and visual review on this exact app version.

## Results

| Playbook | Outputs checked | Reopened scene checks | Visual review |
| --- | --- | --- | --- |
| [Product turntable](../../public/playbooks/blender-product-turntable.md) | [Sample project](../../public/playbooks/samples/product-turntable.blend), `.blend`, and 900×900 PNG present and non-empty | `Product`, `Display plinth`, camera, three area lights, animation data, frame end 121 | Product and plinth fully framed and lit |
| [Typographic title card](../../public/playbooks/blender-typographic-title-card.md) | [Sample project](../../public/playbooks/samples/typographic-title-card.blend), `.blend`, and 1200×800 PNG present and non-empty | Text body, backing, camera, two area lights, render dimensions | Both title lines legible, centered, and inside frame |
| [Product colorway board](../../public/playbooks/blender-product-colorway-board.md) | [Sample project](../../public/playbooks/samples/product-colorway-board.blend), `.blend`, and 1200×750 PNG present and non-empty | Three named bottle bodies, camera, three area lights, render dimensions | Three distinct, labeled products fully visible |

Each script was run twice in separate, fresh temporary output directories. After the second run, each saved project was reopened in Blender and checked with scene assertions. The second-run PNG previews and `.blend` samples are published in `public/playbooks/previews/` and `public/playbooks/samples/`.

## Environment note

Blender's headless launch crashes during Metal capability detection when run inside the restricted process environment; the Python script does not start in that case. The same executable and scripts completed when launched with the approved out-of-sandbox process permission. This matches a [Blender issue report for sandboxed macOS Metal detection](https://projects.blender.org/blender/blender/issues/165753). This is an execution-environment limitation, not evidence of a playbook failure.

The scripts emit a Blender 5.2 deprecation warning because `Material.use_nodes` is planned for removal in Blender 6.0. The scripts currently use it for compatibility with older Blender releases, but only Blender 5.2.0 LTS is verified. No broader compatibility claim is made.

## Repeat commands

```sh
"/Applications/Blender.app/Contents/MacOS/Blender" \
  --background --factory-startup --threads 4 \
  --python public/playbooks/create-turntable.py -- /approved/output/directory
```

Substitute `create-title-card.py` or `create-colorway-board.py` for the other playbooks. The approved output directory must already exist and contain neither target output file.
