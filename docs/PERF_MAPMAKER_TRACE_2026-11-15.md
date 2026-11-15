# MapMaker on a real GPU: the owner's recording of 2026-11-15

Read by a helper of lane A's lead from the owner's Chrome Performance recording `Trace-20261115T120546.json.gz`
(the owner's Drive; 70 MB, 547 MB unpacked; not in the repo). Every number below was computed from the recording.
It answers `docs/MAPMAKER_EDITING_REPORT_2026-11-13.md` question 5 (a real-GPU MapMaker recording after an edit on a
big map).

## In plain English

- **Editing itself is now smooth.** For the 90 s of editing in this recording (paths, selecting, deleting six things,
  dragging, copy and paste, flying round, the right-click menu, Mirror) MapMaker drew **59.3 frames a second**,
  with the middle frame and even the slowest 5 % at 16.7 ms (a full 60). Only 23 frames in 90 s were late, and each
  of those was an edit landing: about **45 ms** (one or two missed frames), the worst 138 ms (an edit that rebuilt the
  ground). The editing report's fixes hold up on your machine.
- **What is slow is Test.** From pressing Test to playing smoothly took **about 10 seconds**: 4.4 s building the
  bots' navigation, then 5.5 s of loading at 4 to 11 frames a second, with one 0.86 s freeze.
- **And the test itself ran at 30 frames a second** (34.6 a second, every frame 33 ms), with your 3 bots. Our own
  script needs only 13.5 ms a frame; another 12 to 13 ms a frame is the browser's own work outside our code, which
  this kind of recording can't name. Together they just miss 16.7 ms, so Chrome drops to every other screen refresh.
  This was not there while editing. It may be the graphics card or something on the page during play; one short
  follow-up recording will say (question 2).
- **The issues list runs about 8 seconds behind each edit.** After every edit a background worker re-checks bot
  navigation, and it builds the whole navigation mesh twice each time (once for the check, once again for the
  jump-pad test). It kept one processor core busy for 71 of the 90 s, and it was still running when you pressed
  Test, so the two navmesh builds competed.
- **Memory:** MapMaker used 600 to 770 MB; during Test 1.2 GB (the editor stays loaded under the match).

## 1. What was recorded

| | |
|---|---|
| Start | 2026-11-15 17:05:46 UTC, 125.2 s long |
| Page | `https://trigger.toshiroplay.com/`, build `09fe2dd` (main at 15:24 UTC: the hold-to-use landing, with the main scene drawing step 1 and both MapMaker speed landings) |
| Map | **Iron Maw Remix** (the title bar); the status bar reads "15 tiles · 4 set pieces · 990 things". Your own map, not in `maps/` (Iron Maw itself has 990 entities, the editing report's second test map) |
| Window | device pixel ratio 2, the page 2730 × 1916 device pixels; screen at 60 a second |
| Recording | DevTools Performance with the JavaScript sampler (one sample every 0.117 ms) and screenshots (450, the first 8.6 s only) |
| Not in it | GPU timings (Metal), draw counts, the browser version, our own `tt:` spans (a match's Capture button makes those) |

**What you did** (from input events, the screenshots and which of our functions ran):

| Time (s) | What |
|---|---|
| 0-6 | Paths tool on "Dirt trail, open, 91 m": pointing and dragging points, mouse-wheel zoom |
| 6-16 | Select; a Boulder selected; **Delete** six times (9 to 15 s) |
| 19-43 | Drags (moving things), right-click menus, the Mirror dialog |
| 45-63 | Flying round with the keyboard |
| 66-86 | More selecting and dragging; **Duplicate** (72 s), **Paste** twice (80, 83 s), mouse-wheel zoom |
| 87.5 | **Test** pressed (3 bots) |
| 92-97.5 | The test loading |
| 97.5-125 | Playing the test (moving, shooting; pointer lock at 120 s) |

## 2. Editing (0 to 91 s)

| | |
|---|---|
| Frames a second | **59.3** (5,368 frames over 90.5 s) |
| Frame time: median / 95th / 99th percentile | 16.7 / 16.7 / 33.3 ms |
| Frames over 33 ms / 50 ms / 100 ms | 23 / 23 / 4 (the longest 167 ms) |
| Main thread busy | 56 % (rAF callback median 7.3 ms, 90th percentile 10.2 ms) |
| Per ordinary frame | drawing the scene 5.5 ms; each pointer move 1.4 ms on average (hover pick and card), at most 14 ms |
| Garbage collection | 0.3 s in all (211 minor, 2 major): not a factor |
| Style, layout, paint | under 2 % of the time |
| GPU process | 10 to 20 % busy (60 % in the first 2 s while the view warmed up) |

**An edit** (the 25 frames whose rAF took over 25 ms: deletes, drag ends, duplicate, paste; mean 46.5 ms):

| Part of the edit's frame (`editorApp.refresh` and what it calls) | ms |
|---|---|
| `refresh` in all | 36.1 |
| `EditorView.setMap` (level faces, terrain check, entities, glass, backdrop) | 15.5 |
| of which level meshes (`buildLevelMeshes`, `buildBoxes`) | 2.3 |
| of which the terrain rebuilt (`buildTerrain`, `buildTerrainBlend`; in 4 of the 25) | 4.3 averaged (16 to 45 ms when it ran) |
| of which entity markers (`setEntities`, `flushLifts`) | 2.6 |
| the outliner rebuilding every row (`OutlinerPanel.update` → `rebuildRows`) | 5.9 |
| the level picker (`renderLevels`) | 4.2 |
| hover again (`updateHover`, `updateHoverCard`) | 3.5 |
| selection outlines (`updateSelectionVisuals`) | 2.2 |
| the inspector (`renderInspector`) | 1.8 |
| sending the map to the check worker, the autosave timer | under 1 |
| drawing the frame itself | 10.1 |

Against the editing report's software-rendering timings for Iron Maw (select 89 ms, move a prop 277 ms, move a block
115 ms, each "longest" 60 to 250 ms), the real machine is three to five times quicker: every edit is one frame of
about 45 ms. The report's "still on the page per edit" list (inspector rebuild 20 to 55 ms, about 15 ms per drag step,
the draft write, sending to the workers) is now 2 to 10 ms each. Nothing in editing needs work for frame rate.

The page's DOM grows from 36,000 to 132,000 nodes over the 90 s and falls back at a garbage collection (the outliner
and inspector rebuilding their rows: thousands of `slotchange` events a second while they do). Harmless today, a sign
of where the per-edit work goes.

## 3. The navigation check after each edit

`MapChecks` (`packages/client/src/editor/mapChecks.ts`) sends the map to the `mapchecks` worker after every edit
(`checkNavigation` → `mapTestWorkerCore.ts` `k: 'nav'`). On this map each check took **7.6 to 9.2 s**, and they ran
back to back: 9 checks, the worker busy **71 s of the 91 s** of editing (one core at 100 %). The issues list's
navigation warnings were 8 to 16 s behind the map.

Each check builds the navmesh **twice** (the CPU profile under the worker's entry):

| Inside one check | share | about |
|---|---|---|
| `validateMapNavigation` → `mapNavigation` → `NavWorld.build` (Recast: `buildPolyMeshDetail`, `buildRegions`, `rasterizeTriangles`; ledge-drop links) | 53 % | 4.1 s |
| `flyPads` → `flyer` → `new Match(map, …)`, which builds the bots' navmesh again before flying the jump pads | 40 % | 3.0 s |
| the navigation audit, the pads' flights, physics steps | 7 % | 0.5 s |

The same navmesh built by the Test's simulation worker took 4.4 s. The check that started at 89.1 s (after the pastes)
was still running until 96.8 s, beside the Test's own navmesh build and its loading.

## 4. Test: starting (87.5 to 97.5 s)

| | |
|---|---|
| Test pressed → the match's navmesh built | 4.4 s in the simulation worker (`simWorkerCore` `start` → `build`); MapMaker kept drawing at 60 meanwhile |
| Then loading | 5.5 s at **4 to 11 frames a second**; tasks of 861, 285, 222, 206, 205, 176 ms … (19 over 100 ms) |
| The 861 ms task | the match's first message (`netTransport.push` → `receive`, 244 ms), the view's warm-up (`warm`, `begin`, 350 ms), building the map's meshes (`buildMap`, 163 ms) |
| Over the 5.5 s | texture uploads (`texImage2D`) 0.65 s; characters made (`create`) 0.41 s; static batches (`flushStatic`, `rebuild`) 0.31 s; about 280 textures and models requested at 92 to 93 s (many likely already in the editor's scene: to check) |

So about **10 s from the click to playing**: 4.4 s of navmesh, then 5.5 s of choppy loading.

## 5. Test: playing (97.5 to 125 s)

| | |
|---|---|
| Frames a second | **34.6**; median and 95th percentile both 33.3 ms (every other refresh); 27 frames of 50 ms, none over 84 ms |
| Main thread busy | **100 %** |
| Our script a frame | 13.5 ms (`matchCode` `frame`): scene drawing 11.2 ms (main view 8.8, render targets 1.7, shadow map 0.6), characters about 1.5 ms (`pose`, `afterAnimations`, `gripPlaced`), snapshots from the worker 0.6 ms |
| Outside our script a frame | about **12.5 ms**: in each frame's task, about 6 ms before the animation-frame callback and about 6 ms after layout, with no JavaScript, style, layout, paint or GC in it (the sampler shows `(program)`) |
| GPU process | 15 to 18 % busy (as in editing). Time on the graphics card itself is not in this recording |
| Simulation worker | 13 to 19 % busy |
| Memory | JS heap 1.1 to 1.2 GB (659 MB just before Test); DOM nodes up about 150 a second and event listeners about 15 a second during play |

13.5 ms of script alone would fit 60 frames a second. The 12.5 ms that this recording can't name pushes every frame
past 16.7 ms. It was **not there while editing** (in editing such time was 2 % of the main thread; here 40 %). Where
it can come from (to be told apart by a recording with more detail, question 2):
- **Waiting on the graphics card.** A busy GPU makes the page's thread wait in the browser's own code, which the
  sampler can only call `(program)`. The play view draws far more than the editor (shadows, post effects, water) at
  2730 × 1916 × the render scale.
- **The browser's frame work for the game's page** (HUD canvases such as the minimap, animations, accessibility
  updates for an extension; the DOM is about 36,000 nodes).

If it is the graphics card it is in every match, not only in Test: the St. John's recordings read frame time from our
own `tt:` spans, which only see our script.

## 6. Ranked fixes

| # | Size · lane | Fix | Expected gain |
|---|---|---|---|
| 1 | S · B | **Build the navmesh once per check.** `flyPads` (`shared/src/sim/padFlight.ts` `flyer`) makes a whole `Match`, which builds the bots' navmesh again; fly the pads in a match made without navigation (or on the check's own physics). Skip the pad flights when the map has no pads | Each check 7.7 → about 4.5 s; the issues list catches up twice as fast; half the background CPU |
| 2 | S · B | **Stop the navigation check when Test starts** (terminate or ignore the `mapchecks` worker's job, start none during the test; check again on return) | Test's navmesh build and loading no longer share the machine with a second build; 0.5 to 2 s off the start on machines with fewer cores |
| 3 | M · A | **Name the 12.5 ms a frame outside our script in play** (engine/render): the owner's follow-up recording (question 2), then: a Test at a lower render scale or Low to see whether it is the GPU; the minimap and HUD canvases; whether it is in a plain match too | If it is removed or halved, Test (and possibly every match) from 30 to 45-60 frames a second |
| 4 | M · A | **Give Test the navmesh the check already built** when the map is unchanged since the last check (export the navmesh from the `mapchecks` worker, hand it to the simulation worker); the check builds it from the map as shown, so check it equals what `loadMap` plays | Test start about 10 → 6 s |
| 5 | M · A | **A smoother Test start**: keep the editor's textures and models for the match instead of fetching them again; spread texture uploads, characters and static batches over frames; split the first-message/view warm-up (861 ms) | The 0.86 s freeze and 5.5 s at 4-11 fps down to 2-3 s of mostly smooth frames |
| 6 | S · B | **Cheaper edits**: the outliner updates only the rows an edit touched (5.9 ms); `renderLevels` and the hover card only when what they show changed (7.7 ms); `setMap` skips the level-face and backdrop passes when only props changed | An edit 46 → about 30 ms (two missed frames → one); fewer DOM nodes made |
| 7 | L · B | **An incremental navmesh for the check** (Recast tiles: rebuild only the tiles round an edit) | The navigation warnings within a second of an edit; nearly no background CPU |

## 7. Questions for the owner

**Owner's answers (2026-11-15): all recommended picks** (1a Test is the slow part, 2a a follow-up recording of both, 3a keep checking after every edit, 4a fix 3 first, then 2, 4, 5). Fix 3 waits on the follow-up recording; the Test-start fixes 4 and 5 (lane A) start meanwhile, fix 2 and fix 1 go to lane B.

1. **What felt slow to you in this session?**
   - a) Pressing Test and the test itself **(recommended reading of the recording: editing ran at 59 frames a second, Test took 10 s to start and ran at 30)**
   - b) Editing itself (say which action)
   - c) Both
2. **A follow-up recording to name the 12.5 ms a frame:** a plain local match on Iron Maw Remix with 3 bots, then the same as a Test, each 20 s, in DevTools Performance with "Enable advanced rendering instrumentation (slow)" ticked under the gear, the screenshots off.
   - a) **Yes, both (recommended)**
   - b) The Test only
   - c) Not now
3. **The navigation warnings after an edit** (8 s behind today; about 4 s with fix 1):
   - a) **Keep checking after every edit, quicker with fix 1, incremental later with fix 7 (recommended)**
   - b) Check navigation only when I press Check or Test
   - c) Check after every edit but pause while I drag or type
4. **Test start order**: fixes 2, 4 and 5 make Test start quicker; fix 3 makes it play smoother.
   - a) **Fix 3 first (frame rate), then 2, 4, 5 (recommended: it may help every match too)**
   - b) Test start first (2, 4, 5), then 3
