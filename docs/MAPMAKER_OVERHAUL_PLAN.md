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
   - **As built (2026-11-08, `wip/mapmaker-p1a`):** `PlacementCheck` refusals carry `short` beside `reason`
     (`checkLayout`, `buildLimitShort`); `shared/src/editor/ghostWhy.ts` has `tileGhostCheck` (the Platform-on-an-
     upper-storey rule too), `zoneNote` and `entityGhostNote` (spawns, pickups, props, vehicles, NPCs: "No floor
     under it" from the ground within 1.5 m or a floor, block or wall top within 1 m, as the spawn check; outside the
     boundary; the scenery note; hung props and objects only get the zone notes). The hover card shows it (red ✗,
     amber ⚠, blue ℹ, each with its words); the status line has the whole reason. Worked out once per cell / spot and
     document version. Entities are warned, not refused (owner's call, HANDOFF). Tests `shared/test/ghostWhy.test.ts`;
     e2e in `editorux` (`editorPhase1aChecks`).
   - **As built, the owner's follow-up (2026-11-09, `wip/mapmaker-followups`; owner 5b: "refuse"):** spawns, pickups,
     props, vehicles and NPCs over nothing, and spawns, pickups, vehicles and NPCs outside the playable boundary or
     past the build limit, are refused: `entityGhostNote` gives `bad`, the ghost is tinted red (`EditorView`
     `setPropGhost`/`setEntityGhost`, an overlay over its own look), the card says ✗ and "Can't be placed here", the
     status line the reason, and `placeAtHover` places nothing (`ghostRefuses`). What it stands on is the map as drawn
     with blocks and solid props (`surfaceBoxes`, so a pickup on a crate is fine) and liquids (a boat on a pool).
     Props outside the boundary keep the scenery-zone note (`PROPS_REFUSED_OUTSIDE = false`, the owner's call);
     objects (doors, zones, lights, logic) are never refused. Moving, pasting and editing aren't refused. Checked
     against every map in `maps/` and `maps/templates/`: no entity there needs placing over nothing (wall shelves,
     torches and the boats were placed on a floor or the ground and raised or moved after; placing then moving still
     works). Tests `ghostWhy.test.ts`; e2e `editorPhase1aChecks` (a spawn and a prop over nothing: red, no place).
2. **A live budget bar.**
   - It covers entities, destructibles, vehicles, lights, props and draw estimate, the environment budget and the map's
     size (RESOURCE_BUDGETS, MAP_BUDGETS.md).
   - It is colour-coded and names whatever tips a budget over.
   - It updates on each edit from cheap counters, not a full validation every frame.
   - **As built (2026-11-08, `wip/mapmaker-p1a`):** `shared/src/editor/budgetCounters.ts`: `BUDGET_ROWS` (entities,
     props, prop models, draws, lights, destructibles, vehicles, the four environment budgets, the file's size),
     `countBudgets` (from scratch) and `BudgetTracker`, fed by `EditHistory.onChange` (each command, undo's inverse,
     reset): it counts only what the command touches; a set-piece, theme or set-piece-definition edit recounts the
     parts (as played, from the cached expansion); a settings edit re-measures the file without its items (the
     file's size is exact: `serializeMap`'s bytes, per item cached). The draw estimate is a draw per different
     untinted prop model, per tinted prop, per species variant and per liquid, against 80 + 24 + 32 (owner's call).
     UI `client/src/editor/budgetBar.ts`: a pill beside the level strip (OK / Near at 80 % / Over, colour and word),
     naming the worst budget; its name selects what it counts (`budgetCulprits`); the arrow lists every row. Test
     `shared/test/budgetCounters.test.ts` (counters = full count after commands, a batch, a stroke, every undo and
     redo; over a budget exactly when the validator warns).
   - **As built, the owner's follow-up (2026-11-09, `wip/mapmaker-followups`; owner 8b):** the bar is a compact item
     in the bottom status bar (between the counts and the status line): the colour, the word and the budget it names,
     the name still selecting what it counts and the arrow still listing every row (above the bar). The status line
     gives way (ellipsis) on a narrow window. e2e: `editorPhase1aChecks` checks it sits in the bar.
3. **A measure tool.** Click two points to get the distance, the height difference and the slope. It snaps to cells
   and surfaces.
   - **As built** (`wip/mapmaker-p1b`): the Measure tool, U and the tool bar (`editor/measureTool.ts`; the maths in
     shared `editor/measure.ts`, unit-tested in `mapmakerTools.test.ts`). Two clicks: distance, rise, slope in degrees
     and percent; a third chains a path with its total; right-click takes a point back; Esc clears; it stays on screen
     with another tool until then. Points snap to the Snap step on surfaces and the ground, to an object's top's middle
     (props, blocks), and a wall face's height to the step; Ctrl or Alt: free. Each stretch says whether a player
     could make it, from `PLAYER` (`sim/constants.ts`, as `sim/movement.ts` moves): the step (walk ≤ 0.3 m, jump ≤
     1.22 m, "too high") and the gap (a sprinting jump's reach to that height). Labels are DOM over the view; nothing
     is stored. e2e: `editorMeasureChecks` in `editorux`.
   - **As built, the owner's follow-up (2026-11-09, `wip/mapmaker-followups`; owner 4b):** the jump hint samples the
     ground along the line. `sampleProfile` (shared `editor/measure.ts`) reads what is under the stretch every 25 cm
     (`restUnder` on the map as drawn and the ground as shown, nothing higher than a jump above the higher end, so roofs
     and bridges overhead aren't the floor); `profileVerdict` judges it against `PLAYER`: neighbouring rises steeper than
     50° and over a step add up to one step (the steepest is the verdict's step); a fall that comes back near its height
     is a gap only when you couldn't climb out of it (deeper than a jump, or nothing under it), its width on the long
     side to within a sample; a ditch you can climb out of is a drop and a step. The labels and the status line give the
     step's height and the gap's width. `MeasureTool` keeps each stretch's verdict until the map changes (sampling once
     per stretch, not per frame). Tests in `mapmakerTools.test.ts` (a ramp walkable, a stair walkable, a ledge a step,
     a pit a gap, jumpable and too far, a deep pit, a ditch); e2e `measureRampCheck` (a 30° ramp of ground in the real
     editor: walkable, its ends 4.6 m apart).
4. **Props snap to surfaces, with randomise.**
   - A prop drops onto whatever is under the cursor: a tabletop, a roof, the ground.
   - Optionally, each placement gets a random turn, size and variant within a range.
   - **As built** (`wip/mapmaker-p1b`): `propDrop` (shared `editor/surfaceSnap.ts`) casts the pointer's ray at the map
     as drawn (tiles shown, blocks, solid props: `editor/surfaceBoxes.ts`, once per document version) and the ground
     as shown (`shownGround`). A top: the prop sits on it; a side: it stands off the face and drops to what is below;
     the ground: bedded into the document's ground (the view re-beds it). The grid snap still applies to x and z, and
     the prop lands on what is under the snapped spot. Over nothing (open air on an upper level), the level's plane,
     as before. Randomise (`editor/propPlaceOptions.ts`, `rollProp` in shared `editor/propRandom.ts`): off by default;
     turn any / ±90 / ±45 / ±15 / none, size ±0-30 % clamped to the prop's allowed scale (0.25-4, an environment
     species' own range), a variant for props with variants (the environment species). Seeded (`?test=1`: seed 1),
     roll by roll, and the ghost (`setPropGhost`, now with scale and variant) shows the next roll. Unit tests: table,
     roof, ground, a wall's foot, the snapped edge; e2e: table, ground, Randomise in `editorux`.
5. **A shortcut overlay.**
   - Press `?` to see every key.
   - It is generated from the same table the keys are bound with, so it can't go stale.
   - **As built (2026-11-08, `wip/mapmaker-p1a`):** `shared/src/editor/keymap.ts`: `EDITOR_KEYS` (pressed keys, first
     match wins), `EDITOR_KEY_NOTES` (held keys: `FLY_KEYS`, `FREE_PLACE_KEYS`; the mouse; the palette's own keys),
     `matchEditorKey`, `editorKeyGroups`. MapMaker's keydown handler is `matchEditorKey` plus `keyActions` (a Record
     over every action); the fly camera and free placing read their codes from the table. Every key does what it did,
     except Shift+/ (`?`), which opens the list (/ still searches). Phase 1B's U (measure) and its Esc order (a ring
     drag cancelled first, then a measurement cleared, then Select) are in the table (`measure`, `escape`), as are the
     measure tool's no-snap keys (`FREE_MEASURE_KEYS`) and the ring drag in the Mouse group. Overlay `client/src/editor/keyOverlay.ts`: a modal
     dialog (MapMaker's keys are off while it's open), the tool bar's **Keys** button. Test `shared/test/keymap.test.ts`
     (every key × Shift × Ctrl/⌘ against the old handler; every key it answers is listed; no key matched by hand in
     editorApp.ts).

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
   - **As built** (`wip/mapmaker-p3a`): Shift+F5 and ▶ Here beside PLAY TEST (`EditorApp.playFromHere`). The spot is
     shared `editor/playFromHere.ts` (`playFromHereSpot`): the floor, roof, block top or ground straight under the
     camera (`restUnder` over the map's boxes, blocks and solid props, and `shownGround`), else the nearest such spot
     in rings of 0.5 m out to 4 m, with room for a standing player (no box between a step and 1.8 m up, the player's
     radius round) and ground no steeper than PLAYER.maxSlopeDegrees; refused with a reason (nothing below, no room,
     too steep, outside the boundary). The match: TestRequest/LocalMatchOptions `startAt`, `Match.startHere` (the
     player put there at once, out of any race car or drop plane, and any life before play begins starts there too;
     `beginPlay` clears it, so later lives use the spawn points); the client's first life takes the server's pitch
     (session.ts). The editor is only hidden while you play, so the view, selection and history are as they were.
     Unit tests `mapmakerWorkflow.test.ts`; e2e `editorWorkflowChecks` in `editorux`.
2. **A top-down plan view:** an overhead orthographic camera, level by level.
   - It shows tile outlines and icons for spawns, objectives and pickups.
   - It exports a PNG of the plan.
   - **As built** (`wip/mapmaker-p3a`): K and the top bar's Plan (`editor/planView.ts`, `PlanView`; the maths in shared
     `editor/planView.ts`: `planFrame`, `planToScreen` / `screenToPlan`, `planZoom` about the pointer, `planPan`,
     `planTiles`, `planMarkers`, unit-tested). The editor camera turns orthographic, straight down, north up, over
     the level the selector picks (Show all off while it's on); `scene.clipPlane` cuts at 0.6 of a level above the
     floor (the terrain's materials are exempt, so hills stay whole). Tile outlines and icons are a 2D canvas over the
     view (redrawn only when the frame, level, selection or document changes). Picking and dragging are the editor's
     own (the pointer's ray points straight down). Export PNG: the next frame without the editing aids, the icons
     over it, a key strip, downloaded as `<map>-<level>-plan.png`. Nothing is stored.
3. **Groups.**
   - Group a selection, then move, turn, mirror or duplicate it as one, and ungroup it.
   - Groups belong to one map. Set pieces are the shareable kind, and groups reuse their selection code.
   - **As built** (`wip/mapmaker-p3b`): `MapDocument.groups` (v31: id, optional name, 2+ member ids of the map's own
     tiles, entities and set-piece placements; one group a thing). `editor/groups.ts`: `groupCommand`,
     `ungroupCommand`, `renameGroupCommand` (setGroups, one undo step each); `withGroups` widens a selection to whole
     groups: MapMaker's `setSelection` runs every selection through it, as a set piece or moving build is picked whole,
     and Alt-click (`single`) picks one. So moving, turning, flipping (M: `flipCommand`, east ↔ west over its middle),
     duplicating (`withCopiedGroups`: the copies are a group) and deleting need no group code of their own.
     `withGroupsTidied` drops members an edit removes, in the same undo step (MapMaker's `run`). Shift-click on a
     selected group's member takes the group out. validateMap warns on a member that isn't in the map or is in two
     groups. Inspector: `editor/groupPanel.ts`.
4. **Copy and paste between maps:** a MapMaker clipboard in local storage. Pasted items get new IDs and are placed
   relative to the cursor.
   - **As built:** `editor/clipboard.ts`: `copySelection` (the things, the map's own set-piece definitions they use,
     whole groups, the source's grid and theme, an anchor: the middle of its cells on its lowest level),
     `parseClipboard`, `pasteCommand` (new ids through `editor/copyItems.ts` `freshCopies`, which keeps movers' blocks
     and portal pairs linked; the anchor on the cell under the pointer, on the level edited; one undo step).
     `pasteRefusal`: another cell size or level height is refused; another theme too while `PASTE_ACROSS_THEMES` is off
     (an owner's call: HANDOFF, Phase 3 part B). Client: `editor/clipboardStore.ts` (localStorage `tiletrigger.editor.clipboard`).
5. **Templates.** Start a new map from an official starter layout: arena, symmetric CTF, assault, open terrain.
   - **As built:** `maps/templates/<id>.json` (arena, ctf, assault, open_terrain), built in MapMaker (its tools in the
     plan view; CTF's east half made with Mirror…) and exported. They sit outside `maps/*.json`, so the map index, the
     menu, playlists and the content tools never see them. `editor/templates.ts` (`MAP_TEMPLATES`,
     `startFromTemplate`: a new id, name and dates); New map → Start from (`editor/templatePicker.ts`, each template its
     own chunk). `mapTemplates.test.ts`: each validates with no errors or warnings and every spawn and pickup reachable.
6. **Mirror for team maps.**
   - Mirror a selection or half the map across a line or a point.
   - Team things swap sides: spawns, flags, bases.
   - **As built:** `editor/mirror.ts`. `mirrorCommand` (a mirrored copy, or the selection flipped in place),
     `mirrorHalfCommand` (`mapHalf`: what lies wholly on one side; things on the line stay; refused while the other
     half has anything on it), `flipCommand`. Lines east ↔ west or north ↔ south, or a point (a half turn), snapped to
     a cell's middle or edge. Tiles: `tileMirrorTwin` finds the turn of a tile that is its mirror image (cells, ports,
     default walls, solid and floor boxes; a corridor with cover on one side is itself turned half round, a corner a
     quarter), and walls, glass and upper floors are carried over; a tile with none is refused across a line. Set
     pieces flip `mirror`. Things: positions, facings, offsets (movers, planes, ziplines) and a block's roll. In a copy,
     the map's first two teams swap (spawns, flags, team zones, doors, buttons, ziplines, team vehicles); Breakthrough
     spawn groups keep their side. Terrain and paths aren't mirrored (an owner's call: HANDOFF, Phase 3 part B). One undo step.
     Dialog: `editor/mirrorDialog.ts` (Shift+M). A unit test checks every mirrored tile's geometry is the mirror image.
7. **Note pins:** notes left on the map for its makers.
   - They show in MapMaker, never in play.
   - They are stored in the map as editor notes (a format bump).
   - **As built:** `MapDocument.editorNotes` (v31, with groups; a chained no-op migration from v30): id, position,
     text (1-500). `editor/notes.ts`: add, edit, move, delete (setNotes, one undo step each), `listNotes`. Neither
     notes nor groups are in the content hash (`canonicalMapJson`) or read by play. Client `editor/noteTool.ts`: pins
     drawn over the view (HTML, projected each frame), a click opens a pin's editor, the Note tool (J) pins a new note
     where you click and drags pins; Map properties → Notes lists them (go to, delete).
8. **The card-shot camera.**
   - Set the menu card shot from the current view, eye level by default.
   - Preview it in the card's frame.
   - **As built** (`wip/mapmaker-p3a`): Map properties → Card shot (`editor/cardShot.ts`; shared `editor/cardShot.ts`):
     Set card shot… (eye level on: `eyeLevel`, 1.7 m over `restUnder`, kept as you fly), Preview, Clear. The frame is
     16:9, centred on the camera's axis, and the camera's FOV over it is the card picture's (`cardViewFov`: 0.9 rad
     across the frame's height, as capture-map-shots.mjs renders 960×540). Saved as `metadata.cardCamera` (position,
     yaw, pitch; format v30, a no-op migration; left out of the content hash like the thumbnail camera) by
     `setCardCameraCommand`, one undo step. `capture-map-shots.mjs` takes the card camera first, then
     `thumbnailCamera`, then its automatic choice.
9. **Turning by mouse** (owner, 2026-11-07: "add to the mapmaker overhaul, it makes most sense").
   - **Today:** you turn things only by R / Shift+R, the right-click menu's Rotate and Rotate a little, the
     toolbar's rotate button, and the inspector's "Facing °" field. The gizmo's arrows only show the axes and can't
     be grabbed.
   - **Add a rotate ring** on the selection gizmo: drag it to turn the selection about its centre. It snaps by the
     selected thing's own step (`yawStep`: tiles, set pieces, zones and water 90°; objects and NPCs 90°; spawns 45°;
     props and vehicles 15°), with Shift for the finer step.
   - **Show the angle while dragging,** and let Esc cancel the drag. A drag is one undo step.
   - **Quick facings:** four buttons in the inspector (0°, 90°, 180°, 270°) set the facing in one click.
   - **As built** (`wip/mapmaker-p1b`): the ring (`editor/rotateRing.ts`, drawn by `EditorView.setRing` beside
     `setGizmo`) is a circle round the selection's centre, clear of what is selected (at least 2.2 m). The pointer
     grabs it within 12 px on screen; the status line says so. A drag measures the turn from where it was grabbed,
     snaps it with `ringStep` (the selection's own `yawStep`, Shift the fine one; the coarsest step of a mixed
     selection; tiles, set pieces, zones and water 90° always) and previews it (things turned, tiles and set pieces
     outlined where they'd land, red where they can't), the angle in a label by the pointer and spokes and an arc on
     the ring. Letting go runs `turnByCommand`, which is `rotateCommand` with an `angle` (new): one undo step, about
     the centre exactly as R. Esc (or leaving the window) cancels. Quick facings (`editor/quickFacings.ts`,
     `setFacingCommand`): a Face row of four buttons under Facing ° (things), and under Rotation (tiles, set pieces),
     the current one lit. Fixed on the way: `rotateCommand` with a negative quarter turn left tiles' rotation
     negative. Unit tests in `mapmakerTools.test.ts`; e2e `editorTurnChecks` in `editorux` (a prop and a spawn turned
     by dragging, Shift, Esc, undo, quick facings on a spawn and a tile).

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
