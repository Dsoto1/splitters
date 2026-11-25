# MapMaker at rest and the leak question (2026-11-24, `wip/editor-idle-1124`)

By a helper of lane B's splitters22, from the owner's M1 trace of 2026-11-24 (58.7 s: 48 s in a Test, then Back to
MapMaker and two edits). The owner said "yes start 1 and 2".

## In plain English

- **MapMaker drew the whole scene every frame, even when nothing moved.** At rest it sat at about 40 fps with the
  main thread about 100% busy (working out what is in view 31%, drawing 46%, binding materials 21%; the editor's own
  code 1.6%). Now it draws every frame only while something moves or changes, and **15 frames a second at rest**
  (4 while the window is in the background), with what is in view worked out once and kept ("frozen") until
  anything changes. Water, swaying plants and the fence's pulse keep moving, at that slower rate.
- **Edits are as quick as before**: the first input wakes it before the frame is drawn, and every frame is drawn for
  half a second after anything changes.
- **Nothing is left stale**: pictures after the common actions (select, drag, place, paint, plan view) are the same
  as the same view drawn afresh, and the same with the old way (`?perfoff=editoridle`).
- **The "panel built twice"** in the trace was real: an edit that selects what it made (duplicate, paste…) built the
  inspector in the selection and again on the next frame. A tile's inspector is about 1,400 nodes, a set piece's
  about 1,800: the trace's 1,357 then 1,462 nodes within 70 ms. Now once.
- **The leak question, settled: one real leak, now fixed; the rest was garbage.** After every Test, the ended match
  (its scene, bodies and materials: **about 190 to 290 MB of script memory on Iron Maw Remix**) stayed in memory under
  MapMaker until the next Test replaced it. Two things held it: the hand fitting's scratch list (`freshWorld`) kept
  the last body's joints, and the scoreboards' rows stayed in the page with click listeners that reach the match.
  Both are emptied now. Back in MapMaker the heap is flat round after round (+3 MB over four Tests, listeners +0).
- **The rises inside a Test were garbage, not leaks**: collected every 10 s, script memory, DOM nodes and listeners
  stay flat through a Test (the trace had no full collection, so they looked like growth).
- **The 575 MB start**: a fresh MapMaker with Iron Maw Remix is 354 to 374 MB after a collection today (297 MB on
  11-15: the content added since). The trace's 575 MB had no collection before it and most likely a previous Test's
  match still held (297 + 290 is about 590 MB): the leak above.

## 1. MapMaker at rest (task 1)

### What changed

- `editor/renderGate.ts` (new): decides per display refresh whether MapMaker draws. **Full** for 500 ms after any input
  (keys anywhere; the pointer over the view, dragging, or just leaving it; a click, a slider or a field anywhere; a
  resize, focus), after any change in what the view shows (the camera's place, turn, field of view and plan-view
  bounds; the canvas's size; the scene's meshes, materials, textures, nodes, geometries, lights, particle systems and
  skeletons counted; observers on the scene's before and after render, which is how card shots and plan pictures wait
  for a frame; anything still loading; the document's revision, the selection, the level, Show all, the outliner's
  hide flags) and while the app is busy (a terrain stroke, a drag, a fly-look, any held key). **Idle**: 15 frames a
  second (4 with the window not focused), so anything that changes without telling (water, plants in the wind, the
  electric fence, a model's texture arriving) shows within 67 ms. At rest the active meshes are frozen
  (`scene.freezeActiveMeshes`, the meshes' own matrices not frozen so anything animated still moves), worked out
  again every second, and thawed before the first frame of any change. A scene still compiling a shader is not
  frozen (tried again a second later).
- Materials are **not** frozen: water, weather and the fence set their time on their materials every frame, and the
  idle rate already removes most of the binding cost.
- The editor's own per-frame work (the fly keys, refresh, the measure tool, notes, hints, plan view, minimap, Tile
  View, the memory readout) still runs every refresh: it was 1.6% of the trace, and it is how changes are noticed.
- `?perfoff=editoridle` draws every frame and never freezes (and builds the inspector after every edit), as before.
- The inspector after an edit: `Inspector.refreshInspector` skips the build when it already shows this very document,
  revision and selection (it was built in `setSelection` an instant before). Duplicate on a tile: 2 builds → 1.

### Numbers

Measured with `tools/perf/editor-idle.mjs` on Iron Maw Remix (942 things) in this box's software renderer, which
draws one to two frames a second however little the page does (the GPU process is the limit), so its frame rate says
nothing about a real GPU. What it does show:

| At rest, after the scene settles | `?perfoff=editoridle` (as before) | Now |
|---|---|---|
| Frames drawn | every display refresh | at most 15 a second (4 unfocused) |
| Main thread per frame drawn (JS and WebGL calls) | 14.9 to 25.9 ms | 9.4 to 14.1 ms; frozen 6.3 to 8.9 ms |
| A frozen frame against a full one | | 55 to 70 % of the time |

On the owner's M1 (the trace: about 40 fps at 100% of the main thread, about 25 ms a frame): **about 15 × 25 ms ×
0.6 ≈ 225 ms a second, so about 20 to 25% of the main thread at rest instead of 100%**, the frame rate shown at rest
15 instead of 40, and every frame again as soon as anything moves. This is a projection; the owner's check: the same
map in Chrome's Performance panel with and without `?perfoff=editoridle`.

### Nothing stale

`IDLE_SHOTS=<dir> node tools/perf/editor-idle.mjs` (1280 × 720 at deviceScaleFactor 2) after: the map opened, the
camera flown forward, a thing selected, dragged, a Pistol's ghost hovered and placed, Structure paint hovered and
clicked, plan view and back (the select step picks the prop nearest the middle of the view, Mine Cart (Ore) 2, and
the drag shows its handle). Each picture against the same view drawn afresh: **0% of pixels differ, in all ten**.
Each against the same step with `?perfoff=editoridle`: **identical, all ten**. (An earlier run differed only in a
toast fading between pictures, on the DOM, not the view.) Pictures: the helper's scratchpad `idle/on/` and
`idle/off/` (`<step>.png` as shown, `<step>-fresh.png` drawn afresh).

## 2. The leak question (task 2)

### The probe

`tools/perf/memory-probe.mjs` (from fix 3b) now also reads every `PROBE_SAMPLE_S` seconds inside a Test, counts
Babylon observers, elements and Web Audio nodes in the heap, can fail over a margin (`PROBE_CHECK=<MB>,<nodes>,<listeners>`
over rounds 2 to the last), and with `PROBE_HEAP` tags every disposed scene still in the heap with a `LeakedScene`
before its snapshots (the open map's too). `tools/perf/heap-retainers.mjs <snapshot> --match=LeakedScene` reads a
snapshot of any size as a stream and prints the paths from the roots that hold it (WeakMap entries, which hold only
while their key does, left out); `--diff=<older>` the constructors that grew most.

Run: Iron Maw Remix, 15 bots, 5 rounds of a small edit → Test 30 s (read at 10, 20, 30 s) → Back, collected twice
before each reading, dev server, software GPU.

### Per round, back in MapMaker (map open: 354 MB before, 374 MB after; listeners 7,634 / 7,640)

| Round | Before: script heap | listeners | DOM nodes | disposed scenes in the heap | After: script heap | listeners | DOM nodes | disposed scenes |
|---|---|---|---|---|---|---|---|---|
| 1 | 648.1 MB | 7,762 | 31,322 | 1 (5,241 disposed nodes, 692 materials) | 641.7 MB | 7,768 | 31,367 | 0 |
| 2 | 642.0 | 7,759 | 31,318 | 1 | 449.1 | 7,643 | 30,496 | 0 |
| 3 | 633.7 | 7,759 | 31,332 | 1 | 450.6 | 7,643 | 30,498 | 0 |
| 4 | 631.4 | 7,762 | 31,341 | 1 | 451.4 | 7,643 | 30,500 | 0 |
| 5 | (page crashed: a second probe ran beside it) | | | | 452.1 | 7,643 | 30,502 | 0 |

Rounds 2 to 5 after the fixes: heap +3 MB, DOM +6, listeners +0 (`PROBE_CHECK=20,200,20` passes). Round 1's 641.7 MB after the fixes held no scene and did not come back: the same round alone (no readings inside the Test) is 449.8 MB, and 449.9 MB 30 s later.

Inside a Test (rounds 2 to 4, before the fixes; the same after): script heap 670 to 690 MB at 10, 20 and 30 s, DOM
31,250 to 31,290, listeners 7,826 to 7,858: flat. The trace's rises in a Test (185 MB a minute, 225 nodes and 50
listeners a second) are the HUD's and the match's short-lived objects, freed by the full collection the trace never
reached.

### What held the ended match, and the fixes

1. `Window.__gripFit → setGripFit's module scope → CHAIN → a body's TransformNode → its scene`: `game/freshWorld.ts`
   keeps one array for the chain of joints it works out, and left it filled after the call. Emptied after every call
   (a `finally`), unit test `freshWorld.test.ts` ("keeps no node after a call").
2. `#scoreboard → its rows → a row's click listener → ScoreBoard.onRow → Hud → GameSession → GameView → its scene`:
   the scoreboard element stays in the page and the next match only empties it when it starts. `GameSession.exit`
   empties `#scoreboard` and `#pause-scores` as the match goes (`game/session.ts`, four lines).
3. A check that it stays fixed: the e2e `editortools` flow, back from Play from here, collects garbage and checks no
   disposed scene is left in the heap (waiting up to 26 s for a Test's loading waits).

Left in memory after the first Test on purpose: the compiled shaders and model data caches (Sandgate: 171 → 220 MB
after the first Test, 224 MB after the second; the snapshot diff is array buffers, effects and WebGL programs).
