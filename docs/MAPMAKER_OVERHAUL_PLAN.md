# MapMaker overhaul: the quality-of-life list (owner-approved, 2026-11-06)

The owner asked what MapMaker could use, compared with the Far Cry and TimeSplitters editors. They approved the whole
list and the extras: "all if able". HANDOFF "MapMaker quality-of-life list" has the original proposal.

Already done from the owner's earlier ask: **the real buildable area.**
- The grid is local round where you work.
- The playable boundary and the build limit are always outlined.
- Building outside the boundary is a "scenery zone" (BUILDING_KIT.md, "Where you can build").

**Set pieces** (docs/SET_PIECES_PLAN.md) are their own queue item.

## Rules that frame it
- **Maps are declarative data** (docs/MULTIPLAYER_DIRECTION.md).
  - A new map field gets a format version and a migration, with older maps loading unchanged.
  - Nothing in a map is a script.
- **No uploads.** Copy and paste between maps, templates and the outliner's hide and lock use the browser's local
  storage, like saved maps.
- **One source of truth.** Every new edit is a shared editor command with undo (`packages/shared/src/editor`),
  tested headless. The UI only wires it up.
- **The ground is worked out, never stored** (fixed 2026-11-07, HANDOFF "MapMaker's ground under floors").
  - The document keeps the ground as made. MapMaker shows the ground as played: paths laid in, the terrain kept under
    every floor (`EditorView.setMap`, from the same pieces as `withGroundAsPlayed`, which loading uses).
  - A tool that needs the ground under the pointer uses `EditorApp.shownGround`.
  - Anything bedded on the ground is bedded on the document's own ground; the view and loading re-bed it.
  - No command writes the lowered ground into the document: groups, paste and templates move floors like any edit.
- **Performance.** MapMaker stays smooth on the owner's M1. Anything that shows in play (time of day, weather) goes
  through the perf budgets and the phone tiers.
- **Tests.** Each phase adds e2e checks to the `editorux` flow and regenerates the `mapmaker.png` baseline when the
  look changes (`pnpm e2e:baselines`).

## Phase 1: feedback while building (quick wins)
1. **The ghost says why.**
   - Today a tile's ghost already turns green or red.
   - Next to the cursor, before you click, it now also says why it's refused: overlap, past the build limit, no floor
     under it, and so on (`checkPlacement`, `buildLimitReason`).
   - The same goes for props and set pieces.
2. **A live budget bar.**
   - It covers entities, destructibles, vehicles, lights, props and draw estimate, the environment budget and the map's
     size (RESOURCE_BUDGETS, MAP_BUDGETS.md).
   - It is colour-coded and names whatever tips a budget over.
   - It updates on each edit from cheap counters, not a full validation every frame.
3. **A measure tool.** Click two points to get the distance, the height difference and the slope. It snaps to cells
   and surfaces.
4. **Props snap to surfaces, with randomise.**
   - A prop drops onto whatever is under the cursor: a tabletop, a roof, the ground.
   - Optionally, each placement gets a random turn, size and variant within a range.
5. **A shortcut overlay.**
   - Press `?` to see every key.
   - It is generated from the same table the keys are bound with, so it can't go stale.

## Phase 2: the interface
1. **Mode tabs:** Build, Props, Gameplay, Logic, Environment, Paths, Test. Each has its own palette and inspector.
2. **Collapsible panels,** remembered per person.
3. **An outliner:** everything in the map in one list.
   - It is searchable, grouped by kind and level.
   - Clicking an entry selects it and frames it.
   - Hide and lock are editor-only (kept per map in local storage, not in the map file).
   - It must stay quick with 4,096 entries.
4. **Favourites and recently used pieces** in the palette.
5. **Split `editorApp.ts`** (about 4,700 lines) along the modes first, with no change in behaviour, before adding to
   it.

## Phase 3: workflow
1. **Play from here.**
   - Start a local test match with you standing at the camera spot.
   - Esc returns to MapMaker at the same view, with undo history intact.
2. **A top-down plan view:** an overhead orthographic camera, level by level.
   - It shows tile outlines and icons for spawns, objectives and pickups.
   - It exports a PNG of the plan.
3. **Groups.**
   - Group a selection, then move, turn, mirror or duplicate it as one, and ungroup it.
   - Groups belong to one map. Set pieces are the shareable kind, and groups reuse their selection code.
4. **Copy and paste between maps:** a MapMaker clipboard in local storage. Pasted items get new IDs and are placed
   relative to the cursor.
5. **Templates.** Start a new map from an official starter layout: arena, symmetric CTF, assault, open terrain.
6. **Mirror for team maps.**
   - Mirror a selection or half the map across a line or a point.
   - Team things swap sides: spawns, flags, bases.
7. **Note pins:** notes left on the map for its makers.
   - They show in MapMaker, never in play.
   - They are stored in the map as editor notes (a format bump).
8. **The card-shot camera.**
   - Set the menu card shot from the current view, eye level by default.
   - Preview it in the card's frame.

## Phase 4: testing the map
1. **A bot test run from MapMaker.**
   - A headless bot match on the map, run in a worker for a few minutes.
   - Heatmaps afterwards: where bots went, got stuck, died, and where their routes failed.
   - It builds on Bot AI Phase A (the scorecard and the navigation audit, docs/BOT_AI_PLAN.md).
2. **Sightlines and spawn exposure.**
   - For each spawn: how much can see it, and from how far.
   - Long sightlines drawn on the map.
   - Warnings for exposed spawns.
3. **Bot hints:** chokepoints, sniper and camp spots, staging spots, jump links. These are Bot AI Phase D's hints,
   placed here.

## Phase 5: time of day and weather (map data, a format bump)
1. **Time of day:** a sun time per map (sun angle, light colour, sky blend) between the existing sky presets.
   - It is fixed for the match, so the shadow cache (perf round 2) stays valid.
2. **Weather:** rain, snow, wind, fog banks, with their sounds.
   - Phone tiers: Low draws no particles, only the mist.
   - It is a map setting the host may override.
   - Its effect on play is kept small: what you can see, through fog.

## Phase 6: a guided first-time tour
A short, skippable, interactive tour, remembered once done: place a room, a spawn and a pickup, then test it. It comes
last, once the interface has settled.

## Order
- **After set pieces part 2.** Both touch the palette, the ghost and selection, and set pieces give groups their
  machinery.
- **In the agreed queue:** after the showpiece maps, Environment Phase 2 and the tiers (HANDOFF "Owner-approved
  order"), then community maps.
- **Phase 1 can move earlier** if the owner wants the quick wins sooner.
