# MapMaker editing requests: report (helper session, 2026-11-13)

Branch `wip/mapmaker-editing`. The three requests from HANDOFF ("Asked by the owner of the other session, 2026-11-11
evening"): the selection lag on big maps, selecting an existing path or road, and fitting the ground to a build. All
three are built and checked on the branch; nothing is on `main` or a check branch. The numbers and checks below are
for 07fc683 (before `origin/main` was merged in); see the end for the state after the merge.

## 1. An edit on a big map

What the page spends in script (ms; frame drawing taken off), built client, software rendering, one run each with
`node tools/perf/editor-edit.mjs` on main cff59ef and on the branch. Runs vary by about 15%. "Longest" is the longest
single stretch of MapMaker's own work: the hang that is felt.

| St. John's (3,395 entities, 2,500 blocks) | before | after | longest before | longest after |
|---|---|---|---|---|
| click to select | 348 | 170 | 327 | 178 |
| move a prop (drag, 8 pointer steps) | 1,467 | 482 | 922 | 247 |
| undo that | 805 | 279 | 719 | 289 |
| move a block (one edit) | 654 | 362 | 572 | 230 |
| undo that | 671 | 266 | 584 | 221 |

| Iron Maw (990 entities) | before | after | longest before | longest after |
|---|---|---|---|---|
| click to select | 203 | 89 | 150 | 91 |
| move a prop (drag) | 730 | 277 | 513 | 251 |
| undo that | 438 | 225 | 420 | 175 |
| move a block | 450 | 115 | 398 | 88 |
| undo that | 287 | 92 | 234 | 61 |

- **Cause.** Every edit clipped all level faces again (`visibleFaces`) and rebuilt every level mesh: about 440 ms on
  St. John's, even for a moved prop, which draws no level geometry.
- **Now.** Faces are kept between edits and only the boxes near a change are clipped again
  (`packages/shared/src/map/facesUpdate.ts`; its test checks the result equals a full pass after runs of edits on
  St. John's, Iron Maw and the coverage map). Level meshes are cut by style and 48 m ground square and only the touched
  ones rebuilt (`mapMeshes.ts` `buildBoxes`, only with the `keep` argument MapMaker passes; the game's path is as it
  was). Entity markers are put again only when the entity or what it stands on changed. `validateMap` and the
  overlaps check run in a second worker (a `check` job in `mapTestWorkerCore.ts`). One pick per hover update; blocks
  and props well clear of the pointer ray are skipped before their meshes are tried.
- **Behaviour change.** The issues list and the status pill update a moment after an edit (about 0.15 s plus the
  worker), not in the same frame. `__editor.issues` and Test still work them out on the spot.
- **Still on the page per edit (St. John's).** About 15 ms per pointer step of a drag (the marker pass and the
  flush-lift check), the inspector rebuild (20 to 55 ms), the draft write (12 to 20 ms, 0.4 s later), sending the map
  to each worker (about 10 ms). The first use of an editor material (selection ring, gizmo) compiles a shader: 0.4 to
  0.8 s once in software rendering.
- **Not measured on a real GPU.** A new recording from the owner is the test that matters.
- **For the pick code.** `pickEntities` skips a block or prop whose centre is further from the pointer ray than its
  size plus 1.5 m: a piece drawn far from its stored position would be skipped.

## 2. Select an existing path or road

- **Works.** With Select, a road, trail, track or route under the pointer (and nothing else there) lights up and its
  card names it ("Path 1: Asphalt road, 396 m, 33 points"); a click opens it in the Paths tool. The Paths pane has
  **Length (m)** by number (longer runs straight on from the last point with one more point; shorter ends where the
  path was that far along: `packages/shared/src/editor/pathEdit.ts`) and **Add points at the end / at the start**.
  Dragging a point, Shift-click to insert and right-click or Del to remove are as they were.
- **Looked at** (St. John's and the test map): the card and the pane read well.
- **Weak.** The lit line is thin and white, hard to see on an asphalt road's own white markings. A path under a block
  or a prop cannot be picked this way (the thing on top wins). Length works on the last point only (Reverse direction
  for the other end). A loop has no Length field.

## 3. Fit the ground to a build

- **Works.** **Fit ground to this** and **Settle onto the ground** in the inspector's Ground section (with Blend,
  default 6 m) and in the selection menu; the same two for a path in the Paths pane. Stored heights only (a
  `setTerrain` command), one undo step each (`packages/shared/src/editor/groundFit.ts`). Nothing in `settle.ts`,
  `groundBore.ts`, `geometry.ts` or `terrain*.ts`.
- **Looked at.** On St. John's a 16-block build: 38 terrain points raised, up to 0.72 m. The picture taken was steeply
  top-down and does not show the before and after clearly: nobody has yet seen a closed gap from eye level on a real
  map. The unit test and the e2e checks measure the heights.
- **Limits.** A second Fit on a build the ground already meets is refused (undo, then fit with another Blend). One
  base height per selection (terraced buildings: one at a time). The ground is level for one terrain cell round the
  footprint, so the cell size limits how tight the fit is. It does not repaint the ground or re-bed props standing on
  the ground it moved.

## Checks (at 07fc683)

| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm test:changed` | pass: 268 files, 2,923 tests (new: facesUpdate, pathEdit, groundFit) |
| e2e `editor`, `editorpieces`, `editortools`, `editorenv` | pass |
| e2e `editorux` | first run: 2 failed, both new item 2 undo checks (the test pressed Ctrl+Z before the pane was redrawn, so it went to the typed field); the test's wait fixed; re-run pass, 158 checks |
| e2e `visual`, `offline` (`mapMeshes.ts` is shared with the game) | pass, 65 checks |
| the full suite | not run (a check branch); `pnpm ci:plan` picks every shard |

## Questions for the owner

1. Settle onto the ground puts free blocks and props on the lowest ground under them (nothing hangs; the uphill side
   is buried) and moves tiles and set pieces by whole levels to the level nearest the ground. Is that the rule, or
   the highest or average ground?
2. For a thin floor slab the base is its top (the ground comes flush with the floor). Right for a foundation; is it
   right for a lone platform?
3. Blend: 6 m by default, the bank running further where the height difference is large (2 m out for 1 m up). Good,
   or steeper?
4. Should Fit also repaint the ground it raised, or re-bed the props on it?
5. A new recording on a real GPU once this lands.
