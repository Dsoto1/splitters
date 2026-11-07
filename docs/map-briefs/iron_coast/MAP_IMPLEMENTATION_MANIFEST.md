# Iron Coast (MAP 21): implementation manifest

| | |
|---|---|
| Map | `maps/iron_coast.json` (id `iron_coast`, "Iron Coast") |
| Source | The owner's reference `docs/map-briefs/shingle_point_reference.jpg`, marked up as `MAP_21_reference_annotated.jpg`; the approved layout `docs/map-briefs/MAP_21_Iron_Coast.md` (owner, 2026-11-07: "Yes follow the image, call it Iron Coast") |
| Author / date | Tile Trigger, built in MapMaker 2026-11-07 |
| Status | Part 1: the playable greybox with Breakthrough (this file's tables); part 2: the visual pass |
| Players | 24 v 24 (Map's pick, `teamSetup [24, 24]`), 16-64 (`recommendedPlayers`); plays to 32 v 32 and 48 v 48 on dedicated hosts |
| Modes | Breakthrough (the map's mode), Team Deathmatch (also offered); Elimination with TDM; Zombies anywhere |
| Weapon set | Military |

## World
- Terrain 380 × 320 m, vertices 2.5 m apart (153 × 129), x −190..190 (east), z −160..160 (north). The sea is south,
  the village north: the attack pushes north. Standard grid: 8 m cells (cell (x, y) is centred on world (8x, 8y)),
  4 m levels.
- Heights (world y): sea bed −4, water surface −0.4, the beach 0 to 1.2 at the cliff foot; the cliff 8 m at the
  grand stair (the lowest), 12 m west and centre, 16 m on the east headland; the promontory west 8 m; the crest
  terraces 12 m to z ≈ 24, B3's knoll 16 m; the fields and village plateau 16 m from z ≈ 36.
- The cliff (map metres, by x): its top edge from z −36 (west) to −22 (the gate) and −37 (the headland), its foot
  from −56 (the promontory) to −34 (the gate); see `DECISIONS_AND_DEVIATIONS.md` for how the pieces meet it.
- Boundary: the terrain's invisible walls.

## Structures (set pieces; anchor cell, level, turn)
| Piece | Where | Cell, level | Notes |
|---|---|---|---|
| Gun Casemate (B1) | West promontory | (−21, −4), 2 (8 m) | the lowest gun; route 1 reaches it |
| Gun Casemate (B2) | Centre-left, at the cliff edge | (−8, −3), 3 (12 m) | over the stone stair (route 3) |
| Gun Casemate (B3) | Centre-right, set back on its knoll | (6, −2), 4 (16 m) | over the wooden stair (route 5) |
| Gun Casemate (B4) | East headland | (20, −3), 4 (16 m) | the biggest and highest; route 7 reaches it |
| Grand Cliff Stair (Gatehouse) | Centre | (−1, −6), 0 | route 4: two flights, the gatehouse, the plaza at 8 m |
| Cliff Stair Tower | Under B2 | (−6, −5), 0 | route 3: 12 m, out at its top onto the crest beside B2 |
| Cliff Casemate | The big cave (A2) | (12, −6), 0 | route 6: the cave mouth on the beach, its rooms in a cove |
| Cliff Stair Tower | Behind the cave | (12, −3), 0 | route 6: the tunnel's climb; its top storey is the crest bunker |
| Command Bunker | The village's head | (−2, 11), 4 | C: the round fort, its command room the final hold |
| Beached Landing Craft ×4 | On the sand | (−17, −11), (−4, −12), (6, −12), (15, −11), 0 | cover on the beach |

## Progress (2026-11-07, 23:30 UTC: part 1 done)
**Done, in `maps/iron_coast.json` (all through MapMaker's UI):** terrain 380 × 320 (sculpted, painted); the 13 set
pieces above; the stair routes 1, 2, 5, 7 (Open Stairs, rot 0 climbs east, 2 west, 3 north) with their ground cut;
cliff-foot pillboxes and compound walls; 10 landing slabs (Sky Blocks, 0.3 m, at each stair head / tower door: they
fix one-way dips the 2.5 m terrain grid leaves at every head); the sea (water 470 × 132, surface −0.4); 30 pickups;
Breakthrough: 3 sectors (lines z −75, −40, 32; the guns' sector needs 2 of 4), A1 (−92, 0, −47), A2 (92, 1, −50),
B1–B4 at each casemate's gun, C the fort's command room (−4, 16, 100) r 6; 6 spawn groups × 16 (beach and cliff-foot
attackers TDM team 1, fields and village defenders team 2); Map properties (Military Compound theme, Breakthrough +
TDM also offered, 24 v 24, 16–64 players, Military weapons, sunset/ocean backdrop); crest trenches, ruins, two crest
pillboxes, the B/C compound walls (z 36–44) and 16 village houses (last export).
**Part 1's last steps (2026-11-07, evening):**
- The cut-off spawn `spawn_jclhkikyqj` (55, 12, 18) stood inside the ruins tile at cell (7, 2), level 3: selected from
  MapMaker's issues list (a click on the issue selects and frames it), X typed 66 in the inspector (now (66, 12, 18),
  open crest at 12 m, the same attackers' sector-3 group), Export. `pnpm validate-map maps/iron_coast.json`: **OK (0
  issues)**.
- Map card picture: `packages/client/public/maps/shots/iron_coast.jpg` (capture-map-shots; the automatic camera looks
  east along the west crest from (−79, 40, −4)); `pnpm content:check` OK.
- A Breakthrough fix found by bot-report on this map: a sector falling mid-tick kept the last sector's defender plan
  for that tick, so a beach gunner's gun duty read past the guns' sector's empty list of guns (a goal with no
  position: bot-report crashed). `BreakthroughMode.plan` now plans again when the sector changes (unit test in
  `shared/test/breakthrough.test.ts`).

**Checked (after main's Bot AI Phase C merged in):**
- bot-report, `--mode=core.breakthrough --seconds=1200`, seeds 1-3 (time each sector fell; how it ended; stuck
  recoveries):
  - 16 v 16: A 49 / 42 / 51 s, B 211 / 154 / 160 s, C – / 298 / 268 s. Seed 1 held at C by the clock (attack 135
    reinforcements left, 1405 stuck recoveries); seeds 2, 3 broke through (111, 95 stuck).
  - 24 v 24: A 60 / 40 / 39 s, B 178 / 182 / 148 s, C – / 413 / – s. Seeds 1 and 3 held at C, the attack out of
    reinforcements; seed 2 broke through (stuck 515 / 336 / 284).
  - Before the merge (main's older bots) every one of the six broke through: 16 v 16 A 44-54 s, B 118-170 s, C
    306-638 s; 24 v 24 A 43-61 s, B 128-158 s, C 301-368 s.
  - The balance: the beach falls too fast (40-60 s, every run); B takes 2-3 minutes; the fort's command room is where
    it is decided. Stuck hot spots (bot-report `stuckAt`): the foot of route 1 on the west promontory (−152, 2-6, −52
    to −44: 624 recoveries in one run), the foot of route 5 under B3 (44, 2, −40), and the C command room (4, 20, 100,
    stationed bots). Seed 1 at 16 v 16 is that: the attack stalled, not the defence.
- Performance, `pnpm bench 48|64 60 maps/iron_coast.json --mode=core.breakthrough` (headless server tick, load 17 on 4
  shared cores): 48 bots avg 5.86 ms (CPU 4.33, p95 16.8), 64 bots avg 6.15 ms (CPU 4.94, p95 16.2); budget 16.67.

**Left (next steps, in order):**
1. The stair feet bots get stuck at (route 1 west, route 5 under B3): a landing slab or a wider cut at each foot, in
   MapMaker; then bot-report again (stuck per match should fall well under 300 at 24 v 24).
2. The beach: A falls in under a minute. Candidates (owner's call): A1/A2 zone time up (MapMaker, the objective's
   seconds), the cliff-foot strongpoints' defenders posted further forward, or more cover for the defenders there.
3. Part 2, the visual pass: hedgehogs, tank traps, logs, landing craft in the surf, craters, sandbags (props from the
   Props tab, Facing in the inspector); haze/mist (Sky tab; the range fields didn't take values typed 0.45/0.25: try
   45/25); two burning wrecks: the prop `landing_craft_wreck_burning` (PropFlame `smoke`, propFlames.ts asks
   `smoke.wreck`) is saved unfinished on `wip/iron-coast-wreck`; it still needs the palette atlas
   (build-palette-atlas.mjs), `content:build` and `content:check`.

**MapMaker driver tricks (the scratch driver won't survive):**
- Keep ONE MapMaker open (vite preview, not dev) and feed it command files; reloading a big map costs minutes. Import
  refuses nothing now (unfinished maps open, this branch). Export: `#ed-export` is hidden (display none) at 1280 px:
  click it in the page (`document.getElementById('ed-export').click()`) and wait for the download.
- Terrain strokes: Flatten with "Flatten to (m)" typed; the brush works by TIME (dt), so hold each point ≥ 350 ms;
  move the camera straight over each point (`view.yaw=0; view.pitch=-1.5; applyCamera(); camera.position.set(x, y+70,
  z)`) and render one frame before projecting (`view.project`) and moving the pointer; nudge the pointer 2 px or no
  pointermove fires. A 720 × 450 window is 3× faster, but its centre is under the level strip (`#ed-levels`): shift the
  camera so the point lands on open canvas (`elementFromPoint` is a CANVAS).
- Pieces: Set pieces tab card by mouse position, R/M/PgUp/PgDn, hover the anchor cell (cell c centred on 8c) and
  click when `__editor.pieceHover.ok`. Tiles the same (`__editor.hoverCell`). Entities: the card, then a click on the
  ground seen from above; then the inspector rows by label (X, Height, Z, Facing °, Width (X), Thickness, Depth (Z)).
- Terrain is a height grid: no overhangs. Pieces against the cliff stand in cuts flattened over their footprint plus
  one vertex; stair heads need a landing slab or bots can't walk back down.
