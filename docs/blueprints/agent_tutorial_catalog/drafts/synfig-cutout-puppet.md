# Draft: Build a Cut-Out Puppet in Synfig

**State:** Draft only — not executable or publishable yet

**Target app:** Synfig Studio 1.5.0 or later, exact tested version not yet available

**Output:** Editable Synfig project plus a short numbered pose sequence

**Rights:** Original procedure and original art only. Source pages are reference-only because page-level reuse terms remain unresolved. No source tutorial prose, screenshots, project, or sample art is included.

## Goal

Create an original six-part helper character from separate torso, head, upper-arm, and forearm artwork. Rig it with a parent-child skeleton, animate two supplied poses, save an editable project, and render a short image sequence that an agent can inspect.

## Required inputs

- Six user-provided or newly created original image parts: torso, head, left upper arm, left forearm, right upper arm, and right forearm.
- Parts share one 512×512 registration canvas, transparent background, consistent scale, and enough overlap at each joint to prevent gaps while rotating.
- A user-approved output directory that contains no files with the planned output names.
- Two pose descriptions with measurable joint positions; do not invent the character's intended motion.

If the parts do not share registration or a joint is unclear, stop and ask for corrected art or a clearer pose brief. Do not reshape or overwrite source assets without approval.

## Agent procedure outline

1. **Check the environment.** Record the installed Synfig Studio version and inspect the installed renderer's help output. Confirm the app is at least 1.5.0 for the documented Skeleton Tool path. If not, stop and report the version; do not fall back silently to the older Rotate Layer method.
2. **Check the files.** Confirm all six inputs exist, have matching canvas dimensions and alpha, and use the same origin. Confirm the output directory is user-designated and target filenames are unused. Keep source assets unchanged.
3. **Create the rest-pose project.** Start a new project at the brief's canvas dimensions and frame rate. Import each original part as its own layer, preserve registration, set the front-to-back order from the supplied brief, and name each layer clearly. Verify the assembled rest pose before rigging.
4. **Group the body parts.** Place each part in its own clearly named group so it can be associated with one bone. Save a new project copy. Verify all groups remain aligned and visible.
5. **Build the bone hierarchy.** Add a Skeleton Layer with the current Skeleton Tool. Create a torso root, a head child, and left/right upper-arm children with forearm children. Confirm the parent-child links from the layer/handle display before attaching artwork. Keep the rest pose intact.
6. **Attach and test the groups.** Use the app's supported group-to-bone link operation. The exact linking control and whether group roots or child handles should be linked must be confirmed in the installed version before this step is treated as executable. Move one bone at a time, verify only the intended group and descendants respond, then restore the rest pose. If linkage moves a part unexpectedly or the control is unavailable, undo to the saved copy and stop; do not repair by editing project XML.
7. **Animate the two supplied poses.** Use the animation controls supported by the installed version to place key poses at the first and last requested frames. Scrub every output frame and inspect joint attachment, layer order, and the character staying within frame. Do not move rig origins as an ad hoc fix; return to the saved rig copy and correct the hierarchy or attachment.
8. **Render to new files.** Read the installed renderer's help output and use its version-matched command to render the requested frame range into a new subfolder. Do not use CLI flags copied from older Synfig documentation. Preserve logs and stop if the renderer reports missing assets or an incomplete frame range.
9. **Reopen and verify.** Reopen the saved project in Synfig Studio. Confirm all six named groups, the six-bone hierarchy, both key poses, and linked artwork persist. Confirm the expected number of numbered images, dimensions, alpha, and non-empty output files. Inspect the first, middle, and last frames for detached joints or missing art.

## Recovery rules

- Never overwrite a project, image, or render without explicit approval. Use a new output folder for a rerun.
- If imported pieces lose registration, return to the untouched assets and re-import; do not shift each piece by eye.
- If a joint separates, revert to the saved rest-pose project and re-check overlap, bone origin, parent chain, and group association one at a time.
- If the current Synfig build cannot reliably preserve the rig on save/reopen, stop the automation experiment and document the version and failure. Do not claim a verified playbook.
- If rendering fails, preserve the project and logs, confirm the installed renderer's supported options, and rerun only into an empty approved output folder.

## Verification record required before publication

- Exact Synfig Studio and renderer versions.
- One full run plus a clean rerun in separate output folders.
- Saved project reopens with groups, bones, links, and key poses intact.
- All requested frames render and pass count, size, alpha, and non-empty checks.
- First/middle/last frames visually inspected; joint separation and unwanted cropping are absent.
- Supported launcher/command and recovery steps recorded from the tested app.
- Rights register reviewed; original art and text confirmed; no source assets reused.
- Machine record validated against `public/playbooks/schema.json` only after all mandatory fields and evidence exist.

## Sources consulted

- [Synfig User Manual 1.5.1: Skeleton Tool](https://synfig.readthedocs.io/en/latest/tools/skeleton.html) — confirms the tool is available from 1.5.0 and documents bone creation, active-bone parenting, and re-parenting.
- [Synfig 1.5.0 release notes](https://synfig.readthedocs.io/en/latest/releases/development/1.5.0.html) — confirms the Skeleton Tool was introduced in that release.
- [Synfig User Manual: Skeleton Deformation Layer](https://wiki.synfig.org/Skeleton_Deformation_Layer) — consulted to distinguish raster deformation from a rigid grouped-part rig.
- [Synfig Basic Bone Tutorial](https://wiki.synfig.org/Doc:Basic_Bone_Tutorial) — reference for checking grouped-part and bone-link behavior; no tutorial expression or assets reused.
- [Original cut-out animation tutorial](https://wiki.synfig.org/Doc:Cut-out_Animation) — the user-provided starting reference; its Rotate Layer procedure is treated as historical input, not copied into this draft.

All source links are retained for technical provenance. Their page-specific reuse terms have not been established, so they remain reference-only and this draft stays internal.
