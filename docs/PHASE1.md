# Phase 1 — Vertical Slice

Scope is MASTER_SPEC_V2 §11. It is large, so it is delivered in milestones, each of which leaves the game playable. The first milestone builds the core loop from §17: *open browser → build room → place → Test → fight → return to editor → change → Test again*.

## Rendering engine decision: stay on Babylon.js, WebGPU first

**Decision:** keep Babylon.js. Run on WebGPU where the browser provides a working device and fall back to WebGL2 automatically.

Why:

- **WebGPU is already the default path.** Babylon ships a WebGPU backend with native WGSL shaders. At startup the client renders a few probe frames. If the WebGPU device is lost (bad drivers, software adapters) it switches to WebGL2 on a fresh canvas instead of crashing. `?renderer=webgl2|webgpu` overrides it. The F3 panel shows which one is active.
- **WebGL2 is still required.** WebGPU coverage is good on Chromium browsers and recent Safari, and still uneven elsewhere. A browser FPS cannot drop those players.
- **What WebGPU actually buys an arena FPS:** cheaper draw submission (more props and characters per frame), compute shaders (GPU particles, culling, skinning), and better multithreaded-friendly APIs. The early bottlenecks here are CPU-side simulation and network, not GPU features. So WebGPU is a scaling win later, not a blocker now.
- **Switching engines is cheap if it is ever needed.** Rendering is a thin layer (`client/src/game/view.ts`, `editor/editorView.ts`, `mapMeshes.ts`). Simulation, physics (Rapier), navigation (Recast), networking and the map format are engine-independent shared TypeScript, and the dedicated server never touches the renderer.

Alternatives considered:

| Option | Verdict |
|---|---|
| **Three.js** (WebGPURenderer + TSL) | Viable, with a large community. It is more DIY (no built-in inspector, scene tooling or GUI), so it is a lateral move. |
| **PlayCanvas** | Solid WebGPU support. Its strength is a hosted editor we would not use, since MapMaker is our own editor. |
| **Godot 4 web export** | WebGL2-only on the web today. It also needs a large WASM download and cross-origin-isolation headers for threads. Most importantly, it can't share TypeScript simulation code with the dedicated server, which breaks the "same code for prediction, server and TEST" architecture. |
| **Unity / Unreal** | Unity's WebGPU target is experimental with heavy builds; Unreal has no web target. Neither fits an in-browser editor with instant TEST. |

Rules that keep the WebGPU path healthy:

- Upload textures from raw buffers rather than canvases. A canvas `DynamicTexture` upload killed the device on the software adapter.
- Merge static map geometry (3 draw calls for the whole layout). Use thin instances for repeated props.
- Avoid WebGL-only extensions in custom shaders. Prefer Babylon's node or standard materials until a shader needs to be hand-written in both GLSL and WGSL.

Verification: the cloud container's software WebGPU adapter loses its device on first present (even for a hand-written raw-WebGPU triangle), so only the fallback can be exercised there. That fallback is tested. Check the WebGPU path on real GPUs in Chrome/Edge and Safari.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M1 | MapMaker core loop: Classic Grid building, spawns, undo/redo, levels, validation, save/load, in-browser TEST, offline play | **Done** |
| M2 | Weapons and items: 6 weapon roles (pistol, automatic, shotgun, precision, explosive, melee), weapon/health/armor pickups, 2 powerups, bot weapon choice and pickup seeking, lag compensation | Next |
| M3 | Scenario primitives: doors, buttons, destructibles, trigger volumes, WHEN → IF → DO logic (data-only interpreter), objectives, LOGIC/ENTITIES workspaces | |
| M4 | NPCs: factions model, one enemy faction, one NPC squad archetype, encounter spawners, the co-op scenario | |
| M5 | Team Deathmatch on factions, 12 placeholder characters, character select, bots inheriting character personalities | |
| M6 | Multiplayer slice: hosting an editor map on the dedicated server (map transfer), 8-slot proof, staged 16/24/32 load tests, bundle splitting, §11 acceptance pass | |

## M1 — what exists

**MapMaker** (`client/src/editor/`, model in `shared/src/editor/`):

- 11 Classic Grid pieces: room, pillar room, corridor, corner, T-junction, dead end, crossroads, column room, low-cover room, dais room, stairs. Palette thumbnails are generated from the real tile geometry.
- Tools: Select, tile placement with a live green/red ghost, spawn placement. R rotates (ghost, selection or spawn facing). Right-click erases. Overlapping placements are refused with a reason.
- Selection: click, Shift-add, drag-move (tiles snap to cells, spawns to 0.5 m), arrow-key nudge, Shift+PgUp/PgDn to move between levels, Ctrl+D duplicate, Delete, F focus.
- Inspector: replace tile type (checked for fit), edit position, level and spawn facing, plus map name, description and recommended players.
- Levels: PgUp/PgDn (or `[` `]`) changes the active floor. Floors above are hidden unless "Show all levels" (H) is on.
- Undo/redo for every change, including renames and inspector edits. Multi-object operations are one step. History keeps exact documents, so undo restores item order.
- Validation panel: schema/semantic checks plus navmesh reachability between spawns, recomputed after each change. Clicking an issue selects and frames the object. The top-bar pill summarises status. TEST is blocked while errors exist.
- Persistence: rolling autosave (restored on reload), a local map library (Save / Open), Export/Import of `.cmap.json` files, and the Phase 0 Arena as a remixable template (keeps `parentId` lineage).

**TEST** (F5 or ▶ TEST): the current, unsaved document runs as an in-browser `Match` behind `LocalTransport`. This is the same simulation and protocol as the dedicated server, with a chosen bot count and skill. The second Esc (or F5, or "Back to MapMaker") returns to the editor with camera, selection, level and history untouched. Startup measured at 150–220 ms in the container, against a 1–3 s target.

**Shell:** a main menu with MapMaker, offline play vs bots (same local transport), and online play. One Babylon engine is shared across modes.

**Tests:** 41 unit/integration tests, plus `pnpm e2e` (Playwright). The e2e suite builds a map with mouse input, drag-moves, undoes and redoes, runs TEST and returns, saves, reloads, reopens from the library, and runs two online clients against the dedicated server.

## Known M1 gaps

- No marquee selection or copy/paste between maps yet (duplicate covers in-map copies).
- Validation reports navmesh *reachability* but there is no visual navmesh/bot-path debug overlay in TEST yet (spec v1 §7.5). That is planned with M2's bot work.
- Rebuilding meshes on every edit is fine at slice scale. Large maps will need per-tile chunks.
- Map storage is browser-local (plus file export). Cloud storage arrives with accounts in Phase 5.
- The leftover "WebGPU context restoration failed" console error after a fallback is Babylon noise from the abandoned engine. It is harmless.
