# St. John's: the recording of 2026-11-13

What the Chrome recording you sent on 2026-11-13 says, and what to fix first. Every number below was
computed from the recording itself. The file stays outside the repo.

**The headline: this recording is of MapMaker, not of a match.** Its code is the editor's
(`editorApp`, the Paths tool, the hover card, the map-check workers). There are no characters, no bots
on the page and no HUD in it. So it answers "why does editing St. John's feel slow", and it cannot be set
against the Roulette recording of 2026-11-10. A match recording is still needed for that (section 7).

- **Frame rate:** 45.5 frames a second over 43 s. The middle frame takes 17.1 ms, the slowest 5% take
  29 ms or more, the slowest 1% take 146 ms or more.
- **Two different stretches.** Selecting and moving things (1 to 34 s): 52.7 fps. The Paths tool
  (34 to 43 s): 22.8 fps, with freezes of 110 to 640 ms.
- **The page's main thread is busy 86% of the time.** Drawing the scene takes 8.7 ms a frame; each
  pointer move costs another 4.4 ms; so a 16.7 ms frame is full before anything is edited.

## 1. What was recorded

| | |
|---|---|
| Start | 2026-11-13 20:27:43 UTC (the trace's `startTime`) |
| Length | 43.06 s |
| Page | `https://trigger.toshiroplay.com/` with no URL parameters |
| Build | assets stamped `v=4f7c9e7`, which is main at 2026-11-13 18:30 UTC. That build has the "MapMaker editing" landing in it (the pick that skips far blocks and the second check worker are both seen running) |
| What was on screen | MapMaker: the Select tool until 34 s, then the Paths tool, one path picked and its points dragged |
| Map | not in the trace. The page address carries no map name; "St. John's" is from you |
| Window | 1365 × 958 CSS pixels at device pixel ratio 2 (so about 2730 × 1916 real pixels for the whole page; the 3D view is a part of that) |
| Screen refresh | 60 a second (the browser's frame clock ticks every 16.67 ms) |
| Browser and version | not in the trace |
| Computer, CPU, GPU | not in the trace |
| Graphics setting | not in the trace |
| Recording options | DevTools with the JavaScript sampler and screenshots on (450 screenshots). Both add some cost of their own |
| Our own timing spans (`tt:` names) | none. They exist only in a match with "Capture 10 s trace" pressed; MapMaker has none |

The repo's copy of St. John's has 3,395 entities (2,500 blocks, 733 props) and 31 paths with 295 points.
The map you had open may differ.

## 2. Frame rate and frame times

A **frame** here is one run of the page's animation callback (the trace's
`PageAnimator::serviceScriptedAnimations` events, 1,960 of them). **Frame time** is the gap between two
of them. Frames actually shown on screen (the compositor's `AnimationFrame::Presentation` events, 1,957)
agree: 46.3 a second, middle 16.7 ms, 95th percentile 33.3 ms.

| | whole recording | selecting and moving (1 to 34 s) | Paths tool (34 to 43 s) |
|---|---|---|---|
| Frames a second | 45.5 | 52.7 | 22.8 |
| Middle (median) frame time | 17.1 ms | 17.2 ms | 16.8 ms |
| 95th percentile | 29.3 ms | 25.5 ms | 191 ms |
| 99th percentile | 146 ms | 76 ms | 505 ms |
| Longest | 749 ms (the recorder starting) | 123 ms | 641 ms |
| Frames over 33 ms | 84 | 50 | 33 |
| Frames over 50 ms | 60 | 32 | 27 |
| Frames over 100 ms | 37 | 10 | 26 |

Of the shown frames, 1,678 came one screen refresh after the last (16.7 ms), 156 came two refreshes
after (33 ms), and about 50 came later than that. The browser counted 643 dropped frames.

**Steady or spiky?** Steady near 60 with small dips while selecting; very spiky in the Paths tool.

| Seconds | Frames a second | Slowest frame | What was happening |
|---|---|---|---|
| 0 to 5 | 39 | 749 ms | recorder start-up (710 ms), then clicks and edits |
| 5 to 10 | 47 | 111 ms | clicks and edits, about one a second |
| 10 to 15 | 55 | 96 ms | moving the pointer over the map |
| 15 to 20 | 59 | 72 ms | camera moves, little hovering |
| 20 to 25 | 56 | 120 ms | drag edits |
| 25 to 30 | 53 | 123 ms | drag edits |
| 30 to 35 | 46 | 641 ms | a drag, then a path picked (the 641 ms) |
| 35 to 40 | 14 | 526 ms | Paths tool: dragging path points |
| 40 to 43 | 38 | 359 ms | Paths tool |

## 3. Where a frame goes

### The main thread, by kind of work

The **main thread** is the one thread that runs the page's code and draws its panels. Totals over the
43.06 s, from the trace's own timed events, and divided by the 1,960 frames:

| Kind of work | Total | Per frame | Share |
|---|---|---|---|
| Our code and Babylon (scripting) | 29.6 s | 15.1 ms | 69% |
| Garbage collection (the browser freeing memory) | 0.5 s | 0.2 ms | 1% |
| Style and layout (working out where panel elements go) | 1.5 s | 0.8 ms | 4% |
| Paint and compositing (drawing the panels, handing the frame over) | 1.8 s | 0.9 ms | 4% |
| Hit testing (which element is under the pointer) | 0.9 s | 0.5 ms | 2% |
| Intersection observers (the palette's "is this thumbnail on screen" checks) | 0.9 s | 0.4 ms | 2% |
| Other browser work | 1.3 s | 0.7 ms | 3% |
| The recorder starting | 0.7 s | once | 2% |
| Idle | 5.9 s | 3.0 ms | 14% |

Scripting splits by what started it:

| Started by | Total | Count | Each |
|---|---|---|---|
| The frame callback (draw the scene) | 20.7 s | 1,960 | middle 8.4 ms, 95th percentile 11.7 ms |
| Pointer moves | 8.6 s | 1,406 | middle 4.4 ms, 95th percentile 6.9 ms, 24 over 50 ms |
| Mouse button down | 1.0 s | 21 | 55 to 77 ms for a click that selects; 117 and 121 ms in the Paths tool |
| Mouse button up | 0.5 s | 21 | one of 470 ms (picking a path) |
| Keys | 0.25 s | 18 | about 30 ms for the eight that edited |
| Wheel | 0.18 s | 43 | 4 ms |
| Timers | 0.4 s | 2,028 | small |

**Other threads.**
- One map-check worker (a **worker** is a background thread) was busy 25.8 s of the 43 s. It rebuilt the
  navigation mesh eleven times, 2.0 to 3.1 s each, once after each burst of edits. It does not block
  the page, but it keeps one CPU core busy most of the time.
- The second check worker: 1.0 s in total, 40 to 100 ms a check.
- The GPU process's main thread (the browser's side of talking to the graphics card): 7.2 s, about
  3.7 ms a frame, no single task over 16 ms. How long the graphics card itself took is not recorded.

### Inside scripting, by part of MapMaker

From the JavaScript sampler (427,000 samples on the main thread, 43.7 s). "Per frame" divides by 1,960
frames, so a cost that only happens on pointer moves or in the Paths tool is averaged thin here; its
real size per event is in the notes.

| Part | Total | Per frame | Share | Notes |
|---|---|---|---|---|
| Scene: choosing what to draw (`_evaluateActiveMeshes`) | 7.2 s | 3.7 ms | 16.6% | every frame. 2.1 s of it is world-matrix checks (`computeWorldMatrix`, `_isSynchronized`) |
| Scene: sending the draws (`_RenderSorted`, `Mesh.render`, material binding) | 6.6 s | 3.4 ms | 15.0% | every frame. Solid things 5.0 s, cut-out 0.7 s, see-through 0.7 s |
| Scene: the rest of Babylon's per-camera pass (`_renderForCamera` itself) | 2.9 s | 1.5 ms | 6.7% | every frame |
| Paths tool redrawing its markers (`drawMarkers`) | 4.4 s | 2.2 ms | 10.1% | really 110 to 180 ms per redraw, almost all between 34 and 43 s |
| Hover pick (what is under the pointer) | 3.7 s | 1.9 ms | 8.5% | 1,124 picks, middle 3.5 ms each |
| Browser-internal time (`(program)`) | 6.9 s | 3.5 ms | 15.8% | layout, paint, hit tests, handing frames over |
| Idle | 5.2 s | 2.7 ms | 11.9% | |
| Rebuild after an edit (`refresh`, without the marker redraws inside it) | 1.3 s | 0.6 ms | 2.9% | really 60 to 110 ms on the frame after an edit |
| Hover card (the tip by the pointer) | 0.8 s | 0.4 ms | 1.9% | about 0.8 ms a pointer move, with the pick it shares counted above |
| Garbage collection | 0.4 s | 0.2 ms | 1.0% | |
| Everything else | 4.2 s | 2.1 ms | 9.6% | includes selecting (`setSelection`, 0.8 s, middle 29 ms a selection) and foliage regrown after a path edit (`grow`, 0.4 s outside `refresh`, three stretches of 113 to 140 ms) |

The game's other subsystems (characters, animation, skinning, bots, physics, shadows, effects, HUD,
networking, audio) do not appear: MapMaker runs none of them. No shadow pass was sampled. Scene drawing
as a whole (`scene.render`) is 17.0 s: **8.7 ms a frame, 39%**.

### Top functions

By self time (time in the function's own lines):

| Function | Self | Share | What it is |
|---|---|---|---|
| `(program)` | 6.9 s | 15.8% | browser internals |
| `(idle)` | 5.2 s | 11.9% | |
| `markAsDirty` (Babylon) | 3.1 s | 7.0% | a material telling every mesh in the scene it changed |
| `_evaluateActiveMeshes` (Babylon) | 2.7 s | 6.2% | the loop over all meshes, each frame |
| `_renderForCamera` (Babylon) | 2.6 s | 5.9% | |
| `_isSynchronized` (Babylon) | 1.4 s | 3.1% | "has this mesh moved?" checks |
| `computeWorldMatrix` (Babylon) | 0.9 s | 2.1% | |
| `Mesh.render` (Babylon) | 0.9 s | 2.0% | one draw |
| a pick helper in `editorView.pickEntities` | 0.8 s | 1.9% | run for every mesh on every pointer move |
| `updateHoverCard` | 0.8 s | 1.8% | |
| `addCount` (Babylon) | 0.6 s | 1.3% | Babylon's own counters |
| outliner `draw` | 0.4 s | 0.9% | the list redrawn on every selection |

By total time (the function and all it calls): `scene.render` 17.0 s; `_evaluateActiveMeshes` 7.2 s;
`_RenderSorted` 6.6 s; `updatePointer` 6.3 s; `updateHover` 5.1 s; `drawMarkers` 4.4 s; `pickNow`
3.6 s; `markAsDirty` 3.4 s; `computeWorldMatrix` 2.5 s; `pickEntities` 2.2 s; `refresh` 1.9 s;
`updateHoverCard` 1.2 s.

**How sure the names are.** The build is minified, but Babylon's method names and our class method
names survive in it, so these are read straight from the trace: `drawMarkers`, `updatePointer`,
`updateHover`, `updateHoverTarget`, `updateHoverCard`, `pick`, `pickNow`, `pickEntities`,
`entityShown`, `setMap`, `setEntities`, `refresh`, `setSelection`, `renderInspector`,
`renderMapProperties`, `endMarquee`, `editPath`, and all the Babylon names. These are my reading, from
matching the call order against the source: the pick helper is the `owner` / `clear` test inside
`pickEntities` (editorView.ts); `draw` under `setSelection` is `outliner.draw(true)` (outlinerPanel.ts);
`grow` is `foliage.grow` (foliage.ts); the worker's long job is the navigation check (it calls recast's
`rasterizeTriangles`, `buildRegions` and `buildPolyMeshDetail`, which are named).

## 4. Hitches

A **long task** is one unbroken piece of main-thread work of 50 ms or more: nothing else, not even a
frame, can happen during it. There are 56 (40 over 100 ms, 4 over 250 ms), 8.0 s in all.

| When | How long | What is in it |
|---|---|---|
| 0.0 s | 749 ms | the recorder's sampler starting (710 ms). Not the game's |
| 34.2 s | 477 ms | mouse-up that picked a path to edit (`endMarquee` → `editPath` → `drawMarkers` 429 ms, of which `markAsDirty` 285 ms) |
| 36.8, 39.3, 41.3 s | 376 to 525 ms | the frame after a path point was dropped: `refresh` 312 to 325 ms (`setMap` 157 to 171 ms, `drawMarkers` 118 to 281 ms), often with a 146 to 166 ms pointer move in the same task |
| 34.6 to 42.1 s, 24 times | 110 to 197 ms | one pointer move in the Paths tool: `drawMarkers` (60 to 70% of it `markAsDirty`) |
| 35.6, 38.2 s | 121, 117 ms | mouse-down on a path point: `drawMarkers` again |
| 37.6, 39.9, 41.9 s | 138 to 147 ms | foliage put back after the path edit: copying meshes (`DeepCopy` about 80 ms) and re-measuring instances (`thinInstanceRefreshBoundingInfo` about 30 ms) |
| 2.2 to 33.0 s, about 15 times | 60 to 121 ms | the frame after an ordinary edit: `refresh` 63 to 90 ms. In it: the level and entities redrawn (`setMap`, middle 18 ms, up to 37), the inspector rebuilt (11 to 28 ms, of which Map properties about 25 ms), a forced layout of 25 to 27 ms (`pickPlane` reads the canvas's rectangle straight after the panels were rewritten), layout and style 26 ms |
| 12 clicks | 55 to 77 ms | click to select: `setSelection` (outliner redraw 12 to 28 ms, inspector, outlines) |

**Not the cause:** garbage collection (252 collections, 0.34 s in total, the longest 15 ms; the heap
moved between 403 and 613 MB). No shader compilation and no texture upload showed up as a long task.
No task on the GPU process's main thread ran over 16 ms.

## 5. Compared with the recording of 2026-11-10

They cannot be compared fairly, and I have not tried to.

| | 2026-11-10 (HANDOFF's summary) | 2026-11-13 (this one) |
|---|---|---|
| What ran | a Roulette match, 41 players and 63 bots | MapMaker, nobody on the map |
| Window | 1920 × 1080 at 2 | 1365 × 958 at 2 |
| Frame rate | about 25 fps, 40 ms median | 45.5 fps, 17.1 ms median |
| Biggest costs | characters 13.6 ms, scene 11.5 ms, shadows 6.7 ms | scene 8.7 ms, pointer moves 4.4 ms each, Paths redraws 110 to 180 ms each |

- **What improved:** not established. Character steps 1 and 2 (the body pool, parked animations) cannot
  be seen here: there are no characters in this recording.
- **What did not:** not established, for the same reason.
- **What is new:** everything in this document is about MapMaker, which the earlier recording did not
  cover.

The fairer yardstick is the MapMaker editing report of the same day
(`docs/MAPMAKER_EDITING_REPORT_2026-11-13.md`), which measured the same build without a graphics card
and asked for a recording on a real one. Loosely (its figures are script time for a whole scripted
action, on a slower software renderer):

| | Its figure, after its fixes | This recording |
|---|---|---|
| Click to select | 170 ms | 55 to 77 ms a click |
| An edit | 266 to 482 ms | 60 to 121 ms for the frame after one |
| Inspector rebuild | 20 to 55 ms | 11 to 28 ms |
| Pointer step of a drag | about 15 ms | about 4 to 7 ms |

So on your machine ordinary edits are near a tenth of a second, not a hang. What that report did not
measure, and what this recording shows as the worst part, is the Paths tool.

## 6. Fixes, in order

Gains are per frame unless said. "Sure" means the evidence is direct; "likely" means it rests on my
reading of Babylon or of our code.

| # | Fix | Evidence | Expected gain | Size | Files | Runs into |
|---|---|---|---|---|---|---|
| 1 | **Paths tool: stop rebuilding every marker on every pointer step.** `drawMarkers` throws away and rebuilds the line, the arrows and every point ball of every path. Each new line makes its own material, and that makes Babylon walk every mesh in the scene (`markAsDirty`). Give the lines one shared material per colour, and redraw only the path that changed, at most once a frame | `drawMarkers` 4.4 s; `markAsDirty` under it 3.4 s (77%); each redraw 110 to 180 ms; Paths tool at 22.8 fps | A Paths pointer step from 110 to 180 ms down to 25 to 40 ms with the shared material alone (the 77% is measured; that a shared material avoids it is my reading of Babylon, so likely); under 10 ms with only the changed path redrawn (likely). The 477 ms pick and the 376 to 525 ms drops lose 120 to 430 ms each | S | `packages/client/src/editor/pathTool.ts`. Check `routeTool.ts` for the same pattern | no claim found |
| 2 | **Inspector: do not rebuild Map properties on every edit.** | `renderMapProperties` about 25 ms in each of the edit frames; 269 ms in all | 20 to 25 ms off each edit (sure) | XS | `editor/inspector.ts` | the tunnel lane's step 4 touches `inspector.ts` (3 lines) |
| 3 | **Read the canvas's rectangle once, not after the panels change.** The hover update inside `refresh` asks for it right after the panels were rewritten, so the browser must lay out the whole page there and then | `pickPlane` → `getRenderingCanvasClientRect` → `getBoundingClientRect`: 25 to 27 ms in each of five edit frames; 133 ms in all | 25 ms off those edits (sure it is there; likely that caching removes it rather than moving it) | XS | `editor/editorView.ts` (`pickPlane`, `pointerRay`) | the tunnel lane's step 4 touches `editorView.ts` |
| 4 | **Outliner: on a selection, change the highlighted rows, not the whole list.** | outliner `draw` 324 ms over 27 selections, 12 to 28 ms each | 10 to 25 ms off each click (sure) | S | `editor/outlinerPanel.ts`, `editor/editorApp.ts` (`setSelection`) | no claim found |
| 5 | **Hover pick: make it cheaper.** It tests every mesh's owner on every pointer move, and rebuilds its list of boxes and tiles each time. Keep those lists per document, and bucket entities on a grid so the ray tests only what is near it | `pickNow` 3.6 s, middle 3.5 ms a pick; `pickEntities` 2.2 s; the per-mesh test 0.9 s | 1.5 to 2.5 ms off each pointer move (likely); about 1 to 1.5 ms a frame while the pointer moves | M | `editor/hover.ts`, `editor/editorView.ts` | the tunnel lane's step 4 changes both (its click-through pick of buried pieces) |
| 6 | **Hover card: write it only when its text changes, and move it with a transform.** | `updateHoverCard` 1.2 s with what it calls (0.7 s in its own lines), about 0.8 ms a move; style, layout and paint 3.4 s over the recording | 0.3 to 0.8 ms a pointer move, plus part of the 1.7 ms a frame of layout and paint (unsure how much of that is the card) | S | `editor/hover.ts` | the tunnel lane's step 4 |
| 7 | **Freeze the world matrix of placed things that are not being edited.** Babylon re-checks each frame whether each mesh moved | `computeWorldMatrix` 2.1 s inside the active-mesh pass, 1.1 ms a frame, half of it `_isSynchronized` | 0.5 to 1.0 ms a frame (likely; the level meshes are already frozen, the entities appear not to be) | S | `editor/editorView.ts` | the tunnel lane's step 4 |
| 8 | **Measure this before deciding: draw only when something changed.** MapMaker redraws the whole scene 60 times a second even when the camera, the map and the pointer are still | `scene.render` 8.7 ms on every one of 1,960 frames | Up to 8.7 ms on a still frame, none on a moving one. How many frames were still: not established | M | `editor/editorApp.ts` (`frame`), `editor/editorView.ts` | the tunnel lane's step 4 (`editorView.ts`) |
| 9 | **Measure this before deciding: fewer meshes in the editor's scene.** The active-mesh pass and the draws both grow with the number of separate meshes | active-mesh pass 3.7 ms, draws 3.4 ms a frame | Not established: the trace does not say how many meshes or draws there are | M to L | `editor/editorView.ts`, `mapMeshes.ts` | the St. John's rebuild from tiles (weapon and vehicle lane) will change the count anyway; tunnel step 4 |
| 10 | **Navigation check: do less of it.** Every burst of edits costs 2 to 3 s of one core | one worker busy 25.8 s of 43 s, eleven builds | Nothing on the page's frame time; a cooler machine and quicker issue lists. Needs a decision (check only the changed area, or only on demand) | M | `editor/mapTestWorkerCore.ts`, `editor/mapChecks.ts`, shared navigation code | `mapChecks.ts` against `wip/mapmaker-ci-proposals` (HANDOFF's merge note) |
| 11 | **Foliage after a path edit: move, do not clone.** | three stretches of 113 to 140 ms, `DeepCopy` about 80 ms each | about 100 ms off each path edit (likely) | S | `packages/client/src/foliage.ts`, `editor/editorView.ts` | none found for `foliage.ts` |

Fix 1 alone should bring the Paths tool from about 23 fps back to the 50s. Fixes 2 to 4 take an edit
from about 80 to 110 ms to about 30 to 50 ms and a click from about 57 ms to about 35 ms.

## 7. What this recording cannot tell us

- **Anything about a match.** Characters, bots, shadows, effects, the HUD and the network are not in
  it. Whether steps 1 and 2 of the character work helped on your machine is still open.
- **The computer.** No browser version, CPU or GPU is in the file.
- **The graphics card's own time.** Only the browser's side is recorded (3.7 ms a frame). Whether the
  card or the processor sets the pace is not established; the processor side alone (8.7 ms to draw plus
  4.4 ms a pointer move plus about 3 ms of browser work) already fills a 16.7 ms frame.
- **Meshes and draw calls.** Not in a trace. Fixes 8 and 9 wait on them.
- **Which map, for certain.** The address has no map name.
- **How much the recorder cost.** The sampler and the screenshots slow the page a little; the 710 ms at
  the start is the recorder's.

**One more recording would settle the match question.** In a St. John's Roulette match, the same
settings as on 2026-11-10 (High, 1920 × 1080): Esc → Settings → Record performance → Start, play two
minutes, Stop and save. That file carries the machine, the settings, the mesh and draw counts and the
per-system split, and compares directly with 2026-11-10. If you also want a DevTools trace of the
match, press "Capture 10 s trace" in the same menu while DevTools records, so our own `tt:` spans are
in it. A second run on Low graphics would show whether the card or the processor is the limit.

**For MapMaker:** after fix 1, a short recording like this one (hover, select, move a prop, drag a path
point), with a line saying the browser and the computer.
