# Synfig Cut-Out Puppet Feasibility Spike

**State:** research advanced; implementation still unverified. On 2026-11-08, the Synfig Studio application and `synfig` CLI were not available in this execution environment, so no app version, project authoring method, render, reopen result, or pass/fail evidence is available.

## Evidence gathered

- The user-provided [cut-out animation tutorial](https://wiki.synfig.org/Doc:Cut-out_Animation) describes a legacy Rotate Layer workflow. Its page does not state a reuse license. Do not copy its sample character, project, screenshots, or wording.
- The current [Synfig User Manual 1.5.1 Skeleton Tool reference](https://synfig.readthedocs.io/en/latest/tools/skeleton.html), retrieved 2026-11-08, says the tool has been available since Synfig Studio 1.5.0. It can create bones by clicking or dragging, adds a child to the active bone, and supports re-parenting. Prefer this current authoring path over mechanically rewriting the older Rotate Layer tutorial.
- The [Synfig 1.5.0 release notes](https://synfig.readthedocs.io/en/latest/releases/development/1.5.0.html), retrieved 2026-11-08, confirm the Skeleton Tool was introduced to create and re-parent bones. The [Skeleton Deformation Layer reference](https://wiki.synfig.org/Skeleton_Deformation_Layer) describes a raster deformation layer with an influence mesh; for this rigid cut-out puppet, first evaluate a Skeleton Layer with original vector or image-part groups. Do not use deformation unless the brief requires bending within a part.
- The official [Basic Bone Tutorial](https://wiki.synfig.org/Doc:Basic_Bone_Tutorial) shows a grouped-part arm and a parent-child skeleton. It is another technical reference, not permission to reuse its prose, artwork, screenshots, or project. Page-specific reuse terms for all Synfig wiki/manual pages remain unverified.
- Synfig's [file format reference](https://wiki.synfig.org/Sif_Format) says `.sif` is XML, `.sifz` is gzip-compressed SIF, and `.sfg` bundles a SIF with assets. It explicitly describes the format as complex, implementation-defined, evolving, and not planned to be frozen. This makes hand-authoring SIF a compatibility risk; use the installed app version's own saved project as the fixture and minimize generated XML.
- The official [CLI syntax page](https://wiki.synfig.org/Doc:Synfig_CLI_Syntax) describes render controls, but its example identifies Synfig 0.62.00, so its exact flags are historical and must not be copied into a current guide without checking the installed executable's `--help` output. A CLI render still does not prove project generation or semantic correctness.
- The official [plugin guide](https://synfig.readthedocs.io/en/latest/plugins.html) documents Python plugins that receive a `.sif` path and modify it. This may support an app-assisted authoring route; plugin compatibility and security behavior must be checked against the installed version before use.

**Current route hypothesis:** use Synfig Studio 1.5.0 or later, if available, to create a small original `.sif` fixture with separate part groups and a Skeleton Layer using the Skeleton Tool. First test a GUI-only procedure for rig setup and keyframes. Then assess a version-matched Python plugin or fixture-based project editing for repeatable agent control. Do not author `.sif` XML from scratch. Confirm the current CLI command from the installed version, render to a new output directory, reopen the project in Synfig Studio, and compare the saved structure before calling any route viable. The CLI renderer alone is not a creation interface.

**Content direction:** write an original agent procedure around a six-part helper character (torso, head, two upper arms, two forearms), with six clearly named groups and a parent-child bone hierarchy. The guide should explain input registration, clean rest-pose checks, bounded bone creation/linking, two requested poses, render verification, and recovery from detached joints or missing assets. This outline is a planning artifact only; it does not adapt the source tutorial's text, art, or project.

## Fixed brief

Build an original two-arm helper character from torso, head, two upper arms, and two forearms on a 512×512 canvas. Use the pose endpoints and 12-frame/24-fps outputs specified in `../../AGENT_TUTORIAL_CATALOG_PLAN.md`.

## Route experiment and stop

Time-box a fixture-based script/plugin route first, then a visible UI route with checkpoints. Record exact app version, steps, outputs, and failure recovery. Inspect whether save/reopen normalizes or drops generated fields. Stop both attempts at eight maintainer hours. A UI-only result may inform research but cannot enter external agent runs or the public index unless it also gains a supported, tested script/launcher that satisfies the public playbook schema.

## Acceptance

Project saves and reopens in Synfig; both clips render 12 numbered, non-empty 512×512 frames at 24 fps; endpoint coordinates match the stated 4 px tolerances; midpoint frames retain limb attachment. Record a separate pass/fail/deferred decision. Do not reuse source tutorial wording, screenshots, example character, or project file.
