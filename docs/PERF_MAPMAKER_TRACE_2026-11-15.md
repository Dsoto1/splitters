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

### Fixes 1, 2 and 6: as built (2026-11-16, `wip/navcheck-fast`; a helper of lane B's splitters22)

- **Merged with Scaling 1 (lane B's splitters22, 2026-11-16):** Scaling 1 landed first with a process-wide `navCache` that also hands the check's navmesh to the jump pads' match in the worker, so fix 1's worker change is now belt and braces: the worker still passes the check's navmesh to `flyPads` outright (`padNav`), and the answer is copied as Scaling 1 has it (its navCache keeps the mesh), not transferred. With `?perfoff=padnav` the worker's pad match still finds the navmesh in navCache, so that switch no longer brings back the old double build; `mapHasPads` (no match without pads) and the page fallback's single build are fix 1's own. `padFlight.test.ts` empties navCache where it compares with matches that build their own.

Measured on this box's SwiftShader (4 cores shared with other agents: compare old and new, not with the owner's
machine). Old = `?perfoff=padnav,editlight` (or `navstop`) on the same build.
- **Fix 1, one navmesh per check.** The jump pads are flown on the check's own navmesh: the worker keeps a copy of
  the exported mesh (`result.prebuilt`, whose original still goes to the page for the Test) and `flyPads(map, { nav })`
  makes each flight's match with it (`Match` option `nav`, imported when `navInputKey` matches; anything else builds as
  before). `validateMapPlay` (validate-map, the page fallback) does the same. A map without pads makes no match
  (`mapHasPads`). Same flights, same warnings (`padFlight.test.ts`: both matches of a miss take it, flights equal to
  a build of their own). Iron Maw (10 pads), in node: the pad flights 3.8-4.3 s → 0.68-0.75 s, the whole check
  7.2 → 4.0 s (warm) and 10.3 → 6.8 s (cold); Eagle Spires (36 pads) 2.3 → 1.4 s; St. John's (no pads) unchanged.
  In MapMaker's worker after an edit on Iron Maw: 9.4 / 9.7 s → 6.2 / 5.8 s. `?perfoff=padnav`.
- **Fix 2, the check stops at Test.** `editorApp.test()` takes `MapChecks.prebuilt` first, then `MapChecks.pause()`:
  a check still running has its worker terminated (a Recast build can't be interrupted) and none starts during the
  Test; `show()` (Back to MapMaker) calls `resume()`, which runs the stopped (or held) check again in a new worker. The
  last navmesh stays `prebuilt`. e2e `editor`: Test pressed the moment a check goes to its worker stops it
  (`navStops`), and back in MapMaker it runs again to its end. `?perfoff=navstop`.
- **Fix 6, lighter edits.** The outliner keeps the rows in view that show the same (a row's id, name and level, or a
  heading's label, count and fold) and only sets their marks; on an edit it doesn't read the list's scroll and height
  again. The level strip is made again only when its levels or counts change; the hover card only when its text,
  tone or spot change (no innerHTML and measuring otherwise). Iron Maw, 24 prop moves under a still pointer: elements
  made per edit 159 → 29; the outliner 1.1 → 0.7 ms, the level strip 0.7 → 0.2 ms, hover 9.8-12 → 7.3-9.8 ms (the pick
  itself, not the card); the edit's whole `refresh` is 46-51 ms either way here (the view's `setMap` dominates in
  software; `setMap`'s passes when only props changed were not part of this fix). `?perfoff=editlight`.

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

## 8. Follow-up recordings (2026-11-15, 17:40 to 17:44 UTC)

Read by the same helper. Three files from the owner's Drive (not in the repo):
- the in-game recording of a plain local match, `tiletrigger-perf-iron_maw-2026-11-15-17-41-39.json`: Iron Maw (the official map), Team Deathmatch, 65 players, High, render scale Auto, 83 s;
- its 10 s `tt:` trace, `tiletrigger-iron_maw-2026-11-15-17-40-19.trace.json`;
- a DevTools recording of a Test of Iron Maw Remix in MapMaker, `Trace-20261115T124305.json.gz` (17:43:06, 97 s), with the advanced rendering instrumentation on. Its main-frame breakdowns (style, layout, accessibility, animate, paint, commit) are in it; GPU-side timings are not.

### In plain English

- **The 12.5 ms a frame is not the graphics card, and it isn't always there.** In the new Test recording it is gone: the
  same Test on the same map ran at **54 frames a second** (30 before). Our script costs the same as before (12.3 ms a
  frame, 13.5 before); the browser's unexplained time is now under 1 ms a frame.
- **The plain match had it too:** frames of 31 ms, our script 19.5 ms, and about **11.5 ms a frame outside our
  script**. The same 11 to 12.5 ms whether 137 or 722 things were drawn, or 1 or 49 characters were in view. Real
  graphics-card load would grow with what is drawn, so this looks like a fixed cost a frame in the page itself.
- **What changed between the two:** the browser tab. The Test at 30 fps and the match ran in a tab that had been
  open a long time (the first recording's page was already holding 1.2 GB during Test). The new Test ran in another page
  process (a new process id), and the browser logged a page load at 17:41:42, three seconds after the match recording
  was saved. That fits your
  **"Aw, Snap!"**: the old tab died there, or was reloaded, and the new one was fast.
- **So the likely story is one problem:** a MapMaker session wears the tab down. Memory climbs (1.2 to 1.36 GB of
  script memory during a Test, on top of what the graphics side holds) until every frame pays a fixed toll of
  10 to 15 ms, and in the end Chrome kills the tab. This is a strong reading, not yet proven: the recordings show the
  before and after, not the climb.
- **The crash itself is not in the recordings.** No context loss, error or abrupt end in either DevTools trace. The new
  recording's page went up to 1.36 GB, fell back to about 1.0 GB at a garbage collection, and ended normally.
- **One more thing on your machine:** an ad-blocking browser extension (Chrome id `bgnkhhnnamicmpeenaelnjfhikgbkllg`,
  AdGuard's) adds about 1,100 event listeners to the page a second during play (12,700 to 55,700 in 76 s). Its time is
  small (0.1 ms a frame), but it holds memory.

### Details

| | Test 17:05 (first recording) | Plain match 17:40 | Test 17:43 (new) |
|---|---|---|---|
| Map, players | Iron Maw Remix, 3 bots | Iron Maw, 65 | Iron Maw Remix, 3 bots (as before) |
| Frames a second | 34.6 | 32.7 (median frame 31 ms) | **54.0** (median 16.7, 95th percentile 33.3) |
| Our script a frame | 13.5 ms | 19.5 ms (`tt:` spans); the whole `frame` span 16.2 ms | 12.3 ms (the rAF callback 15.6 ms, of which WebGL calls about 3) |
| Outside our script a frame | **12.5 ms** | **11.5 ms** (per second 10.1 to 12.5; `frame` start to start 30.7 ms, minus the frame span 16.2 = 14.5 ms) | **under 1 ms**: in Chrome's main-frame breakdown, style 0.3, layout 0.2, input 0.2, paint 0.1, commit 0.1, accessibility 0 ms; the rest is our animation-frame callback |
| Page process | 1651 | not in the in-game file | 1862; the browser logged a page load at 17:41:42 |
| Script memory in play | 1.11 to 1.21 GB | not recorded | 1.25 to 1.36 GB, 1.0 GB after a collection at 45 s |
| DOM nodes, listeners | 34-38 k, 10.0-10.4 k | not recorded | 38-46 k; 12.7 k → 55.7 k (the extension) |

- **Not the graphics card's load:** per second in the match, the outside time hardly moves with draw calls (correlation
  0.17; 10.7 ms at 137 draws, 11.2 at 619) or with characters in view. Shadows and post-processing don't explain a
  constant either: the new Test draws the same scene with the same settings without it.
- **Not our script hidden somewhere:** in the first recording the time sat in each frame's task before and after our
  callback, with no JavaScript in it. In the new one those parts take under 1 ms.
- **The new Test's start:** Test at about 6 s, smooth from about 12 s (the other helper's fixes 4 and 5 cover it).
- **Memory in the new Test:** the editor's page was 0.70 GB; the Test took it to 1.25 GB within 5 s and 1.36 GB by 41 s.
  Leaving the editor loaded under a Test (section 5) costs about 0.7 GB.

### Fix 3, rewritten: find what wears the tab down

| Step | Size · lane | What | Expected gain |
|---|---|---|---|
| 3a | S · A | **A memory readout**: the perf recording and the perf overlay record each second Chrome's script memory (`performance.memory`: used, total, limit), the engine's live textures, meshes, materials, geometries and render targets, DOM nodes, and "outside our script" (already there). MapMaker's status bar shows script memory behind a debug flag. Recorded at every Test start and every Back to MapMaker | The next recording shows the climb and what climbs |
| 3b | S · A | **A repeat probe** (`tools/perf`, scratch first): open Iron Maw Remix in MapMaker, then 10 rounds of edit, Test 20 s, Back to MapMaker, reading the same numbers through the browser each round; the same with 10 plain matches back to back | Names the action that leaks (Test round trips, edits, the check workers) in an hour, on a software GPU |
| 3c | M · A (B if it is editor code) | **Fix what 3b finds**: likely candidates are the match's scene, textures and character models not freed on Back to MapMaker, the editor's caches kept for the session, and the 0.7 GB of editor kept under a Test (free its heavy parts while a Test runs) | If this is the toll: 30 → about 50 fps in Tests and matches in a long session on this map (the new Test ran at 54), and no "Aw, Snap!" |
| 3d | S · A | **Say so in the game**: when "outside our script" stays over 8 ms a frame for 30 s, the perf overlay (and a hitch note in recordings) says the tab is slowing and a reload helps | The owner and players know when to reload; future recordings say which state they were in |

## 9. Questions for the owner (follow-up)

**Owner's answers (2026-11-15):** 1) the "Aw, Snap!" came during a Test play of Iron Maw in MapMaker with 15 bots (so in MapMaker's Test, not right after the plain match); 2) the tab had been open a while, not sure how long; 3) a, yes to the memory readout; 4) a, yes to the long-session recording later; 5) a, ad blocker off for that check. Also: reloading the tab takes the owner to the main menu, not back to MapMaker and the map being built (queued as a bug).

1. **When did the "Aw, Snap!" happen?**
   - a) **Right after the plain match, as you saved its recording (17:41): the recordings point there (recommended reading)**
   - b) Earlier, in MapMaker, before the match
   - c) Not sure
2. **How long had that tab been open before the match?**
   - a) **A long while: the first recording's session, with several Tests (recommended reading)**
   - b) It was fresh
   - c) Not sure
3. **A small memory readout in the perf overlay and recordings** (Chrome's script memory and the engine's counts; step 3a):
   - a) **Yes (recommended)**
   - b) Only in recordings, not on screen
   - c) No
4. **One more check from you, when convenient:** after an hour of MapMaker with several Tests, record 20 s of a Test with the in-game recorder, then reload the tab and record the same Test again.
   - a) **Yes (recommended: it shows the toll building up, on your machine)**
   - b) Not now: rely on the probe (3b)
5. **The ad-blocking extension:** for that check, turn it off for the site?
   - a) **Yes, for the check only (recommended: it rules it out)**
   - b) No, keep it as players will have it

## 10. Fix 3a-3d done: what the repeat probe found (2026-11-15, `wip/mem-leak`)

By a helper of lane A's lead. The probe (`tools/perf/memory-probe.mjs`, docs/PERF_TOOLS.md) ran on this box's
software GPU: MapMaker on **Iron Maw Remix** (the official Iron Maw opened as a remix: 990 things; the owner's own
remix is not in the repo), 10 rounds of a small edit → Test with 15 bots for 20 s → Back to MapMaker, then 10 plain
matches from the menu (Iron Maw, Team Deathmatch, 15 bots, 20 s each). After each round it collects garbage twice and
reads Chrome's script heap, the page's DOM and listeners, the engine's live objects, and the objects still in the
heap that are disposed.

### In plain English

- **Every Test left the whole match behind, and every match left its models' pictures on the graphics card.** Two
  separate leaks, both fixed:
  1. **The ended match stayed in memory.** After Back to MapMaker the match's scene (disposed, but still reachable)
     held about **200 MB of script memory** under MapMaker until the next Test replaced it, or for good when it was
     the first scene to build a shader. What held it: the engine's shader cache (each compiled shader kept the
     callbacks it was built with, and through them its material and scene) and the page's test hooks
     (`window.__cs`, `__flashHold`, `__sim`/`__give`, `__match`), which are set in every match, not only in tests.
  2. **Textures piled up on the graphics card.** A model file that finished loading after its match ended (guns,
     characters, props still coming in when you left) was never disposed: its textures stayed in the engine for the
     rest of the tab's life. On Iron Maw that was **about 16 textures (36 MB of video memory) per short Test**,
     growing with every map, character and gun seen. This is the likeliest wear on the owner's tab: video memory
     filling until the driver pages, then "Aw, Snap!".
- **After the fixes the probe is flat**: script memory back in MapMaker 349 → 351 MB over 10 Tests (0.2 MB a round),
  textures on the card 178 every round; 10 plain matches 377 → 384 MB, settling by the fourth.
- **What it doesn't change:** MapMaker stays loaded under a Test (about 300 MB of script memory and 330 MB of
  textures on Iron Maw; a Test adds about 400 MB and 440 MB more while it runs). Freeing MapMaker's heavy parts during
  a Test would make Back to MapMaker slower; not done (a follow-up if the owner's long-session recording still climbs).
- **Test start, a side effect:** the textures that leaked were also, by accident, a cache: a second Test found its
  guns' and characters' textures still on the card. Now each Test loads them again (from the browser's cache: no
  download, but decoding and uploading). For the Test start work (fix 5): keep a deliberate, bounded cache if it
  matters.

### Numbers (Iron Maw Remix, 15 bots; MapMaker with the map open: 297 MB script, 178 textures on the card, 346 MB)

| After each round | Before (5 rounds of 10 s) | Shader-cache and hook fix only (7 rounds) | Both fixes (10 rounds) |
|---|---|---|---|
| Script memory back in MapMaker | 558, 560, 487, 510, 682 MB | 474, 342, 342, 342, 344, 344, 344 MB | 349, 350, 350, 350, 351, 351, 351, 351, 351, 351 MB |
| Disposed scenes still in the heap | 1 (the last match; 648 of its materials) | 0 after the first round | 0 |
| Textures on the graphics card | 178, 178, 178, 224, 224 | 178, 200, 205, 236, 283, 288, 293 (346 → 600 MB) | 178 every round |
| DOM nodes, listeners | flat | flat | flat |

Plain matches back to back (after both fixes): script memory at the menu 377, 380, 382, 383, 383, 383, 383, 383, 384, 384 MB;
textures on the card 178 throughout; DOM nodes +12 and listeners +4 a match (the menu footer's fullscreen hint kept
every old footer alive: fixed with the rest). On Sandgate (a short check of the texture fix): textures 68 → 102 →
104 → 107 after three Tests before, 71 → 71 → 71 → 71 after.

Not leaks, found on the way: the match setup panel last shown stays referenced by the menu (one copy, about 3,000
nodes); a Test's loading waits (`prewarm`'s capped races, up to 25 s) keep the ended match alive until they time out.

### What changed

- `effectScrub.ts`: when a match's scene is disposed (`GameView.dispose`), every compiled shader drops the
  build-time callbacks that held its material (they never run again for a compiled shader).
- The test hooks are taken off when their match ends (`session.exit`, `LocalTransport.close`); `__flashHold` is
  defined once, outside the view.
- `content/sceneGone.ts`: a model file (models, characters, gear, creatures, environment species) that loads after
  its scene went is disposed at once.
- 3a (the readout), 3d (the note) and the reload back to MapMaker are in docs/PERF_TOOLS.md, "Reading the overlay".
