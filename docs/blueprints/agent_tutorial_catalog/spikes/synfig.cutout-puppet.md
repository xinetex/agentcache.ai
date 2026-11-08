# Synfig Cut-Out Puppet Feasibility Spike

**State:** research advanced; implementation still unverified. On 2026-11-08, the Synfig Studio application and `synfig` CLI were not available in this execution environment, so no app version, project authoring method, render, reopen result, or pass/fail evidence is available.

## Evidence gathered

- The official [cut-out animation tutorial](https://wiki.synfig.org/Doc:Cut-out_Animation) describes the workflow concepts to investigate: create separate aligned part images; preserve their registration and layer order; group body parts; place pivots at joints; apply inherited parent motion and local limb motion; then animate exposed parameters. Its page does not state a reuse license. Do not copy its sample character, project, screenshots, or wording.
- Synfig's [file format reference](https://wiki.synfig.org/Sif_Format) says `.sif` is XML, `.sifz` is gzip-compressed SIF, and `.sfg` bundles a SIF with assets. It explicitly describes the format as complex, implementation-defined, evolving, and not planned to be frozen. This makes hand-authoring SIF a compatibility risk; use the installed app version's own saved project as the fixture and minimize generated XML.
- The official [CLI syntax](https://wiki.synfig.org/Doc:Synfig_CLI_Syntax) documents rendering controls including output type, dimensions, FPS, time range, and output path. This supports a deterministic render/check stage, but does not prove project generation or semantic correctness.
- The official [plugin guide](https://synfig.readthedocs.io/en/latest/plugins.html) documents Python plugins that receive a `.sif` path and modify it. This may support an app-assisted authoring route; plugin compatibility and security behavior must be checked against the installed version before use.

**Current route hypothesis:** use Synfig Studio to save a tiny original fixture, then programmatically alter only a minimal supported subset of its XML (or use a version-matched Synfig Python plugin) and render via the CLI. Reopen the generated project in Synfig Studio and compare the saved structure before calling this viable. The CLI renderer alone is not a creation interface.

## Fixed brief

Build an original two-arm helper character from torso, head, two upper arms, and two forearms on a 512×512 canvas. Use the pose endpoints and 12-frame/24-fps outputs specified in `../../AGENT_TUTORIAL_CATALOG_PLAN.md`.

## Route experiment and stop

Time-box a fixture-based script/plugin route first, then a visible UI route with checkpoints. Record exact app version, steps, outputs, and failure recovery. Inspect whether save/reopen normalizes or drops generated fields. Stop both attempts at eight maintainer hours. A UI-only result may inform research but cannot enter external agent runs or the public index unless it also gains a supported, tested script/launcher that satisfies the public playbook schema.

## Acceptance

Project saves and reopens in Synfig; both clips render 12 numbered, non-empty 512×512 frames at 24 fps; endpoint coordinates match the stated 4 px tolerances; midpoint frames retain limb attachment. Record a separate pass/fail/deferred decision. Do not reuse source tutorial wording, screenshots, example character, or project file.
