# Sunken Kingdom: map implementation manifest

| | |
|---|---|
| Map id / name | `sunken_kingdom` / Sunken Kingdom (`maps/sunken_kingdom.json`, map format 24) |
| Source image | `docs/map-briefs/sunken_kingdom_reference.jpg` (owner-approved overhead reference) |
| Brief | `docs/map-briefs/BUILD_01_Sunken_Kingdom.md` (as merged 2026-10-30) and `AGENT_BUILD_CONTRACT.md` v1.0 |
| Author | Tile Trigger (built by a Claude agent session, 2026-10-30) |
| Status | Built, saved, reloaded in MapMaker and the game, bot matches run; not yet played by a person; awaiting the owner's review |
| Approved decisions | None beyond the brief and image yet; open questions are in `DECISIONS_AND_DEVIATIONS.md` |

## World frame

- Units: metres. +X east, +Z north, +Y up (the reference image's top is north).
- Grid: MapMaker cells of 8 m, levels of 4 m. Tile `(x, y, z)` has its origin cell centred on world `(8x, 4z, 8y)`.
- Map centre: the palace courtyard's fountain at **(-4, 0, -4)** (the courtyard is four 2 × 2 Round Arcades meeting at a cell corner).
- Playable bounds: x -100 to 92, z -92 to 84 (**192 × 176 m**), invisible walls 30 m high (`bounds`).
- Terrain: 121 × 121 vertices at 2 m (origin (-124, -124), 240 m square), `baseY` -0.15, sand ground; outside the bounds it rises
  into dunes 9–16 m high. Terrain boundary walls on.
- Scale check: run speed 5.2 m/s; flag to flag 190 m (~37 s); the palace ring 175 m (~34 s). For 16–32 players (two teams of
  up to 16, `teamSetup` [16, 16]). MAP_BUDGETS.md calls 200–400 m "large"; this is a dense 192 × 176 m town, sized for foot play.

### Vertical layers

| Layer | Height (y) | What is there |
|---|---|---|
| Cistern | floor -4.0 | Tunnels, the flooded hall (water -4.0 to -3.6), three sunken stair courts open to the sky |
| Flooded courts | bed -1.65 (deep pockets -2.9), water surface -0.7 | Lagoon, north pool, SE channel and basin: 0.95 m wading, swimming in the deep pockets |
| Main tier | ground -0.04, floors 0 | Palace, ring street, east quarter, gatehouse, fountain court, south and south-west courts, cistern road |
| Upper tier | ground 3.96, floors 4 | Western colonnade terrace, market arcade, north spring and gate, temple terraces |
| Roofs and terraces | 4 (palace wing roofs), 8 (arcade walkways, gatehouse pylon terrace, hypostyle roofs on the upper tier at 12), 6/8/10 (stepped temple tiers on the upper tier) | Local rooftop clusters only |

## Combat zones

| Zone | Extent (x, z) | Layer | Engagement | Cover |
|---|---|---|---|---|
| Ruined palace (centre) | -28..20, -28..20 | main, roofs 4 | close inside the wings, mid across the round courtyard | arcade piers, wing rooms, four columned gate halls, fountain |
| Palace ring street | the band 25–36 m from (-4, -4) | main | mid | rubble, carved pillars, low walls, statues |
| Lagoon (west flooded court) | -62..-29, -36..30 | flooded | mid, exposed (wading slows you to 0.85) | drowned pillars, fallen blocks, the colossal head |
| Western colonnade (Embers base) | -100..-60, -44..44 | upper | long over the lagoon (cliff edge, broken parapets) | colonnade, houses, sanctuary, Anubis shrines |
| Market arcade | -84..-28, 44..76 | upper, walkways 8 | close: one lane between shops and two-storey arcades | stalls, amphorae, chests, shop rooms |
| North spring and gate | -20..12, 44..84 | upper, pylon terrace 8 | mid | spring basin, obelisk, pylon towers |
| North pool and falls | -20..12, 28..46 | flooded | mid, the north ring's crossing | rubble blocks, pillar |
| Temple terraces | 28..92, 36..84 | upper, 6–10 on the temple | mid (terraces), long from the shrine | stepped temple, hypostyle hall, sanctuary, obelisk |
| East quarter | 28..60, -16..36 | main | mid | large ruined hall, houses, low walls |
| Eastern gatehouse (Tide base) | 60..92, -28..28 | main, pylon terrace 4 | mid, long from the pylon | pylon towers, round tower, guard houses, low walls |
| SE channel and basin | 20..64, -34..-16 | flooded | mid | banks, palms |
| Fountain court | 28..76, -84..-56 | main | mid | raised fountain plaza, curved walls, houses |
| South court and sphinx avenue | -20..20, -92..-60 | main | mid, a long axis north up the avenue | arch, sphinxes, obelisks, ruined rooms |
| South-west court | -100..-28, -92..-52 | main | close to mid | houses, temple wall and gate, ruined court |
| Cistern road (over the cistern) | -52..52, -52..-44 | main | long axis east–west, broken up | rubble, pillars, stelae, kerbs |
| Buried cistern | -68..68, -52..-44 (+ south court -4..4, -68..-52) | cistern | close | tunnel bends, hall columns |

## Traversal graph (measured on the bot navmesh, `routes.mts` in the build scratchpad)

| Route | Start → end (via) | Access | Elevation change | Narrowest point | Length, time at run speed | Alternates |
|---|---|---|---|---|---|---|
| L1 Palace ring (surface loop 1) | ring south → east → north → west (lagoon shore) → south | open street | none | ~6 m between the palace wall and the lagoon shore (west side) | 175 m, ~34 s | through the palace (four gate halls, courtyard) |
| L2 Northern terraces (surface loop 2) | colonnade → market lane → north spring → temple terraces → (NE stairs) east quarter → gatehouse → palace → colonnade | 5 stairs and a carved ramp between the tiers | +4 / -4 (6 m climbed in all) | market lane (one cell, 8 m, stalls in it) | 456 m, ~88 s | the north crescent's open ground behind the market; arcade walkways (8 m) |
| L3 Southern water courts (surface loop 3) | colonnade → SW court → south arch → fountain court → SE channel ford → gatehouse → ring → lagoon → colonnade | stairs off the colonnade, wading crossings | -1.8 (water) to +4 | SW court between the houses (~8 m) | 545 m, ~105 s | cistern road; the lagoon's dry east shore |
| U Buried cistern (underground bypass) | west stair court → tunnel → flooded hall → tunnel → east stair court | open stairs down 4 m at each end | -4 / +4 | tunnels 3.6 m wide | 145 m, ~28 s | south exit (hall → south stair court → sphinx avenue, 25 m) |
| Flag to flag (shortest) | Embers flag (-80, 4, 0) → Tide flag (76, 0, -8) | | -5.4 / +1.4 | | 190 m, ~37 s | through the palace, round the ring, the north terraces, the cistern |

Stairs between the tiers: north crescent at cells (-6, 5), (-2, 5), (3, 5) (Open Stairs climbing north), the temple terraces
at (6, 4), (9, 4) and the carved ramp x 28–40, z 30–44; the colonnade at (-7, -5) and (-7, 4) (climbing west); the cistern at
(-8, -6), (8, -6), (0, -8) (Open Stairs placed on level -1). Rooftops: palace west wing (stairwell (-3, 2) east door, climbing
vines at (-28.7, 0, -2.6)), palace east wing (stairwell (2, -3) north door), arcade walkways (Arcade Stairs (-9, 8), (-5, 8)),
gatehouse pylon terrace (stairs inside its west face), north pylon terrace (stairs inside its south face), stepped temple
(its south stair). None of the roof clusters join each other.

## Landmarks

| Landmark | Real pieces (catalog ids) | Where |
|---|---|---|
| Ruined palace with its round (domed) courtyard | 4 × `core.round_arcade_m`, 4 × `egypt.hypostyle` gate halls, `core.room_columns` wings (Egyptian facade, roofs, two sunken pools), 2 × `core.room_tall` towers, 2 × `core.stairwell`, `prop.fountain`, 2 × `prop.eg_statue_pharaoh` | cells -3..2, -3..2; fountain (-4, 0, -4) |
| Market arcade | 6 × `imperial.arcade` / `imperial.arcade_stair`, 4 × `egypt.house`, 5 shop rooms (`core.room_columns`), stalls, amphorae | cells -11..-4, 6..9 (level 1) |
| Western colonnade | 8 × `imperial.colonnade` facing east, `egypt.house` ×2, `egypt.sanctuary`, papyrus columns, Anubis shrines | cells -9 (and -11), -4..4 (level 1) |
| Eastern gatehouse | `egypt.pylon` (gate east–west), `core.round_tower`, 3 × `egypt.house`, seated pharaoh | cells 8..11, -3..2 |
| Buried cistern | 10 × `imperial.tunnel`, 3 × `core.room_columns` hall (flooded), 3 × `core.stairs_open` in sunken stair courts, 13 courtyard tiles above (`core.yard`, `jungle.ruined_court`) | row y = -6, level -1 |
| Partly flooded lower courts | terrain basins + 10 water bodies, 3 `prop.jg_waterfall` falls | lagoon, north pool and channel, spring, SE channel and basin, west feed, cistern, palace pools |
| Temple terraces | `jungle.ziggurat` (stepped temple), 4 × `egypt.hypostyle`, `egypt.sanctuary` | cells 6..10, 6..8 (level 1) |
| North gate | `egypt.pylon` (gate north–south), spring basin | cells -1..1, 10 (level 1) |
| South approach | `imperial.triumphal_arch`, `egypt.avenue`, sphinxes, obelisks | cells 0, -10..-9 |
| Fountain court | `core.plaza` (raised fountain), 2 × `core.round_half_m` | cells 4..9, -10..-8 |

## Modes

`supportedModes`: `core.tdm`, `core.ctf`, `core.deathmatch`, `core.koth` (`playableModes` adds `core.elim`, `core.forts` and
`core.zombies`). Teams: `embers` (west, the colonnade) and `tide` (east, the gatehouse). Recommended players 16–32.

## Terrain, water and hazards

- Upper tier: `z ≥ 44`, or `x ≤ -60 and z ≥ -44`, or `x ≥ 44 and z ≥ 36`; cliff faces dressed with Sandstone Blocks walls
  (blocks) and Rough Sandstone parapets in 5 m pieces with 4 m gaps.
- Flooded courts: water boxes listed below; wading depth 0.95 m (`SWIM_DEPTH` is 1.0), deep pockets swim (no drowning risk
  in practice: every pocket is a few metres from wading ground). No lava, acid or swamp; no fall damage (map physics default).
- Out of bounds: invisible walls at the bounds and the terrain's own boundary walls; nothing to fall off (the cistern courts
  are 4 m deep with stairs).
- Paint: sand, hex paving on the ring street, gravel in the beds, moss with plants round the water, stone on the slopes.
- Navigation: built when a match loads (`NavWorld.build`); nothing stored. Every spawn, pickup, flag and hill reaches every
  named zone (navcheck, see QA_REPORT.md).

## Screenshot viewpoints

| Picture | Camera |
|---|---|
| `screenshots/top_down_mapmaker.jpg` | MapMaker, photo mode, straight down from (-4, 205, -4) |
| `screenshots/fp_western_colonnade.jpg` | feet (-66, 4, 12), looking ESE over the lagoon to the palace |
| `screenshots/fp_market_arcade.jpg` | feet (-82, 4, 56), looking east down the market lane |
| `screenshots/fp_palace_courtyard.jpg` | feet (6, 0, -14), inside the round arcade looking NW to the fountain |
| `screenshots/fp_lagoon.jpg` | feet (-34, 0, -28), on the lagoon shore looking NNW to the colonnade cliff and its falls |
| `screenshots/fp_buried_cistern.jpg` | feet (-50, -4, -48), in the west tunnel looking east to the flooded hall |
| `screenshots/fp_north_cascade.jpg` | feet (-4, 0, 22), the palace's north gate looking north over the pool to the falls |

QA results: `QA_REPORT.md`.

## Records (generated from the map file)

### Structure instances (tiles)

| Tile id | Piece (catalog id) | Cell (x, y, level) | Rotation | World centre of origin cell (x, y, z) | Options / edges |
|---|---|---|---|---|---|
| tile_0001 | `core.round_arcade_m` | -2, -2, 0 | 0° | (-16, 0, -16) |  |
| tile_0002 | `core.round_arcade_m` | -2, 1, 0 | 90° | (-16, 0, 8) |  |
| tile_0003 | `core.round_arcade_m` | 1, 1, 0 | 180° | (8, 0, 8) |  |
| tile_0004 | `core.round_arcade_m` | 1, -2, 0 | 270° | (8, 0, -16) |  |
| tile_0005 | `egypt.hypostyle` | -1, 2, 0 | 0° | (-8, 0, 16) |  |
| tile_0006 | `egypt.hypostyle` | 0, -3, 0 | 0° | (0, 0, -24) |  |
| tile_0007 | `egypt.hypostyle` | -3, -1, 0 | 0° | (-24, 0, -8) |  |
| tile_0008 | `egypt.hypostyle` | 2, 0, 0 | 0° | (16, 0, 0) |  |
| tile_0009 | `core.room_columns` | -2, 2, 0 | 0° | (-16, 0, 16) | facade egyptian, ceiling roof, layout rubble; 0,0,0:N broken |
| tile_0010 | `core.room_columns` | 0, 2, 0 | 0° | (0, 0, 16) | facade egyptian, ceiling roof, layout empty; 0,0,0:N arch |
| tile_0011 | `core.room_columns` | 1, 2, 0 | 0° | (8, 0, 16) | facade egyptian, ceiling roof, layout empty, floor sunken; 0,0,0:N window |
| tile_0012 | `core.room_columns` | -2, -3, 0 | 0° | (-16, 0, -24) | facade egyptian, ceiling roof, layout empty, floor sunken; 0,0,0:S window |
| tile_0013 | `core.room_columns` | -1, -3, 0 | 0° | (-8, 0, -24) | facade egyptian, ceiling roof, layout empty; 0,0,0:S arch |
| tile_0014 | `core.room_columns` | 1, -3, 0 | 0° | (8, 0, -24) | facade egyptian, ceiling open, layout rubble; 0,0,0:S broken |
| tile_0015 | `core.room_columns` | -3, -2, 0 | 0° | (-24, 0, -16) | facade egyptian, ceiling roof, layout empty; 0,0,0:W window |
| tile_0016 | `core.room_columns` | -3, 0, 0 | 0° | (-24, 0, 0) | facade egyptian, ceiling roof, layout empty; 0,0,0:W broken |
| tile_0017 | `core.room_columns` | -3, 1, 0 | 0° | (-24, 0, 8) | facade egyptian, ceiling roof, layout empty; 0,0,0:W arch |
| tile_0018 | `core.room_columns` | 2, -1, 0 | 0° | (16, 0, -8) | facade egyptian, ceiling roof, layout low_cover; 0,0,0:E broken |
| tile_0019 | `core.room_columns` | 2, -2, 0 | 0° | (16, 0, -16) | facade egyptian, ceiling roof, layout empty; 0,0,0:E arch |
| tile_0020 | `core.room_columns` | 2, 1, 0 | 0° | (16, 0, 8) | facade egyptian, ceiling roof, layout empty; 0,0,0:E window |
| tile_0021 | `core.room_tall` | -3, -3, 0 | 0° | (-24, 0, -24) | facade egyptian, ceiling roof |
| tile_0022 | `core.room_tall` | 2, 2, 0 | 0° | (16, 0, 16) | facade egyptian, ceiling roof |
| tile_0023 | `core.stairwell` | -3, 2, 0 | 180° | (-24, 0, 16) | 0,0,1:W door, 0,0,1:N door |
| tile_0024 | `core.stairwell` | 2, -3, 0 | 90° | (16, 0, -24) | 0,0,1:W door |
| tile_0025 | `core.room_columns` | -10, 6, 1 | 0° | (-80, 4, 48) | facade egyptian, ceiling roof, layout empty; 0,0,0:N arch, 0,0,0:S window |
| tile_0026 | `core.room_columns` | -9, 6, 1 | 0° | (-72, 4, 48) | facade egyptian, ceiling roof, layout low_cover; 0,0,0:N wide, 0,0,0:S window |
| tile_0027 | `core.room_columns` | -8, 6, 1 | 0° | (-64, 4, 48) | facade egyptian, ceiling roof, layout empty; 0,0,0:N arch, 0,0,0:S broken |
| tile_0028 | `core.room_columns` | -5, 6, 1 | 0° | (-40, 4, 48) | facade egyptian, ceiling roof, layout empty; 0,0,0:N arch, 0,0,0:S window |
| tile_0029 | `core.room_columns` | -4, 6, 1 | 0° | (-32, 4, 48) | facade egyptian, ceiling roof, layout rubble; 0,0,0:N broken, 0,0,0:S window |
| tile_0030 | `imperial.arcade` | -10, 8, 1 | 180° | (-80, 4, 64) |  |
| tile_0031 | `imperial.arcade_stair` | -9, 8, 1 | 180° | (-72, 4, 64) |  |
| tile_0032 | `imperial.arcade` | -8, 8, 1 | 180° | (-64, 4, 64) |  |
| tile_0033 | `egypt.house` | -7, 8, 1 | 0° | (-56, 4, 64) |  |
| tile_0034 | `imperial.arcade` | -6, 8, 1 | 180° | (-48, 4, 64) |  |
| tile_0035 | `imperial.arcade_stair` | -5, 8, 1 | 180° | (-40, 4, 64) |  |
| tile_0036 | `imperial.arcade` | -4, 8, 1 | 180° | (-32, 4, 64) |  |
| tile_0037 | `egypt.house` | -9, 9, 1 | 180° | (-72, 4, 72) |  |
| tile_0038 | `egypt.house` | -6, 9, 1 | 180° | (-48, 4, 72) |  |
| tile_0039 | `egypt.pylon` | 1, 10, 1 | 180° | (8, 4, 80) |  |
| tile_0040 | `jungle.ziggurat` | 6, 6, 1 | 0° | (48, 4, 48) |  |
| tile_0041 | `egypt.hypostyle` | 9, 6, 1 | 0° | (72, 4, 48) |  |
| tile_0042 | `egypt.hypostyle` | 10, 6, 1 | 0° | (80, 4, 48) |  |
| tile_0043 | `egypt.hypostyle` | 9, 7, 1 | 0° | (72, 4, 56) |  |
| tile_0044 | `egypt.hypostyle` | 10, 7, 1 | 0° | (80, 4, 56) |  |
| tile_0045 | `egypt.sanctuary` | 10, 8, 1 | 180° | (80, 4, 64) |  |
| tile_0046 | `egypt.pylon` | 11, -2, 0 | 270° | (88, 0, -16) |  |
| tile_0047 | `core.round_tower` | 8, 0, 0 | 0° | (64, 0, 0) |  |
| tile_0048 | `egypt.house` | 9, -2, 0 | 90° | (72, 0, -16) |  |
| tile_0049 | `egypt.house` | 8, -3, 0 | 0° | (64, 0, -24) |  |
| tile_0050 | `egypt.house` | 10, 2, 0 | 180° | (80, 0, 16) |  |
| tile_0051 | `imperial.colonnade` | -9, -4, 1 | 270° | (-72, 4, -32) |  |
| tile_0052 | `imperial.colonnade` | -9, -3, 1 | 270° | (-72, 4, -24) |  |
| tile_0053 | `imperial.colonnade` | -9, -2, 1 | 270° | (-72, 4, -16) |  |
| tile_0054 | `imperial.colonnade` | -9, -1, 1 | 270° | (-72, 4, -8) |  |
| tile_0055 | `imperial.colonnade` | -9, 1, 1 | 270° | (-72, 4, 8) |  |
| tile_0056 | `imperial.colonnade` | -9, 2, 1 | 270° | (-72, 4, 16) |  |
| tile_0057 | `imperial.colonnade` | -9, 3, 1 | 270° | (-72, 4, 24) |  |
| tile_0058 | `imperial.colonnade` | -9, 4, 1 | 270° | (-72, 4, 32) |  |
| tile_0059 | `egypt.house` | -11, -3, 1 | 90° | (-88, 4, -24) |  |
| tile_0060 | `egypt.house` | -11, 2, 1 | 90° | (-88, 4, 16) |  |
| tile_0061 | `egypt.sanctuary` | -11, 0, 1 | 90° | (-88, 4, 0) |  |
| tile_0062 | `core.stairs_open` | -6, 5, 0 | 270° | (-48, 0, 40) |  |
| tile_0063 | `core.stairs_open` | -2, 5, 0 | 270° | (-16, 0, 40) |  |
| tile_0064 | `core.stairs_open` | 3, 5, 0 | 270° | (24, 0, 40) |  |
| tile_0065 | `core.stairs_open` | 6, 4, 0 | 270° | (48, 0, 32) |  |
| tile_0066 | `core.stairs_open` | 9, 4, 0 | 270° | (72, 0, 32) |  |
| tile_0067 | `core.stairs_open` | -7, -5, 0 | 180° | (-56, 0, -40) |  |
| tile_0068 | `core.stairs_open` | -7, 4, 0 | 180° | (-56, 0, 32) |  |
| tile_0069 | `imperial.triumphal_arch` | 0, -10, 0 | 0° | (0, 0, -80) |  |
| tile_0070 | `egypt.avenue` | 0, -9, 0 | 0° | (0, 0, -72) |  |
| tile_0071 | `core.plaza` | 6, -9, 0 | 0° | (48, 0, -72) | 0,0,0:S open, 0,0,0:W open, 1,0,0:S open, 1,0,0:E open, 0,1,0:N open, 0,1,0:W open, 1,1,0:N open, 1,1,0:E open |
| tile_0072 | `core.round_half_m` | 4, -10, 0 | 0° | (32, 0, -80) |  |
| tile_0073 | `core.round_half_m` | 9, -10, 0 | 270° | (72, 0, -80) |  |
| tile_0074 | `imperial.tunnel` | -6, -6, -1 | 90° | (-48, -4, -48) | 0,0,0:S arch |
| tile_0075 | `imperial.tunnel` | -5, -6, -1 | 90° | (-40, -4, -48) |  |
| tile_0076 | `imperial.tunnel` | -4, -6, -1 | 90° | (-32, -4, -48) |  |
| tile_0077 | `imperial.tunnel` | -3, -6, -1 | 90° | (-24, -4, -48) |  |
| tile_0078 | `imperial.tunnel` | -2, -6, -1 | 90° | (-16, -4, -48) |  |
| tile_0079 | `imperial.tunnel` | 2, -6, -1 | 90° | (16, -4, -48) |  |
| tile_0080 | `imperial.tunnel` | 3, -6, -1 | 90° | (24, -4, -48) |  |
| tile_0081 | `imperial.tunnel` | 4, -6, -1 | 90° | (32, -4, -48) |  |
| tile_0082 | `imperial.tunnel` | 5, -6, -1 | 90° | (40, -4, -48) |  |
| tile_0083 | `imperial.tunnel` | 6, -6, -1 | 90° | (48, -4, -48) | 0,0,0:N arch |
| tile_0084 | `core.room_columns` | -1, -6, -1 | 0° | (-8, -4, -48) | ceiling open |
| tile_0085 | `core.room_columns` | 0, -6, -1 | 0° | (0, -4, -48) | ceiling open; 0,0,0:S wide |
| tile_0086 | `core.room_columns` | 1, -6, -1 | 0° | (8, -4, -48) | ceiling open |
| tile_0087 | `core.stairs_open` | -8, -6, -1 | 180° | (-64, -4, -48) |  |
| tile_0088 | `core.stairs_open` | 8, -6, -1 | 0° | (64, -4, -48) |  |
| tile_0089 | `core.stairs_open` | 0, -8, -1 | 90° | (0, -4, -64) |  |
| tile_0090 | `jungle.ruined_court` | -6, -6, 0 | 0° | (-48, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0091 | `core.yard` | -5, -6, 0 | 0° | (-40, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0092 | `core.yard` | -4, -6, 0 | 0° | (-32, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0093 | `jungle.ruined_court` | -3, -6, 0 | 0° | (-24, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0094 | `core.yard` | -2, -6, 0 | 0° | (-16, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0095 | `core.yard` | -1, -6, 0 | 0° | (-8, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0096 | `jungle.ruined_court` | 0, -6, 0 | 0° | (0, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0097 | `core.yard` | 1, -6, 0 | 0° | (8, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0098 | `core.yard` | 2, -6, 0 | 0° | (16, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0099 | `jungle.ruined_court` | 3, -6, 0 | 0° | (24, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0100 | `core.yard` | 4, -6, 0 | 0° | (32, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0101 | `core.yard` | 5, -6, 0 | 0° | (40, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0102 | `jungle.ruined_court` | 6, -6, 0 | 0° | (48, 0, -48) | 0,0,0:N open, 0,0,0:E open, 0,0,0:S open, 0,0,0:W open |
| tile_0140 | `egypt.house` | -10, -7, 0 | 0° | (-80, 0, -56) |  |
| tile_0141 | `egypt.house` | -10, -9, 0 | 90° | (-80, 0, -72) |  |
| tile_0142 | `jungle.temple_wall` | -9, -10, 0 | 0° | (-72, 0, -80) |  |
| tile_0143 | `jungle.ruined_court` | -8, -8, 0 | 0° | (-64, 0, -64) |  |
| tile_0144 | `jungle.temple_gate` | -5, -9, 0 | 90° | (-40, 0, -72) |  |
| tile_0145 | `egypt.house` | -4, -9, 0 | 270° | (-32, 0, -72) |  |
| tile_0146 | `core.room_columns` | -5, -10, 0 | 0° | (-40, 0, -80) | facade egyptian, ceiling open, layout rubble; 0,0,0:N broken, 0,0,0:E arch |
| tile_0147 | `core.room_columns` | -2, -9, 0 | 0° | (-16, 0, -72) | facade egyptian, ceiling roof, layout low_cover; 0,0,0:E arch, 0,0,0:N door |
| tile_0148 | `core.room_columns` | 2, -9, 0 | 0° | (16, 0, -72) | facade egyptian, ceiling open, layout rubble; 0,0,0:W broken, 0,0,0:N arch |
| tile_0149 | `jungle.temple_wall` | -2, -10, 0 | 180° | (-16, 0, -80) |  |
| tile_0150 | `jungle.temple_wall` | 2, -10, 0 | 180° | (16, 0, -80) |  |
| tile_0151 | `egypt.house` | 9, -8, 0 | 270° | (72, 0, -64) |  |
| tile_0152 | `egypt.house` | 4, -8, 0 | 90° | (32, 0, -64) |  |
| tile_0153 | `jungle.temple_wall` | 9, -5, 0 | 0° | (72, 0, -40) |  |
| tile_0154 | `core.room_large` | 5, 0, 0 | 0° | (40, 0, 0) | facade egyptian, ceiling roof, layout rubble; 0,0,0:W arch, 1,0,0:E wide, 0,1,0:N broken, 1,0,0:S arch |
| tile_0155 | `egypt.house` | 5, -2, 0 | 0° | (40, 0, -16) |  |
| tile_0156 | `jungle.temple_wall` | 7, 3, 0 | 270° | (56, 0, 24) |  |
| tile_0157 | `egypt.house` | 5, 3, 0 | 180° | (40, 0, 24) |  |
| tile_0158 | `egypt.house` | 2, 7, 1 | 180° | (16, 4, 56) |  |
| tile_0159 | `egypt.house` | 3, 9, 1 | 180° | (24, 4, 72) |  |
| tile_0160 | `jungle.ruined_court` | 3, 7, 1 | 0° | (24, 4, 56) |  |
| tile_0161 | `core.room_columns` | -11, 8, 1 | 0° | (-88, 4, 64) | facade egyptian, ceiling open, layout rubble; 0,0,0:E broken, 0,0,0:S arch |

### Spawns

| Id | Team (faction) | Position (x, y, z) | Facing |
|---|---|---|---|
| spawn_0369 | embers | (-80, 4, -36) | 90° |
| spawn_0370 | embers | (-80, 4, -28) | 90° |
| spawn_0371 | embers | (-80, 4, -20) | 90° |
| spawn_0372 | embers | (-80, 4, -12) | 90° |
| spawn_0373 | embers | (-80, 4, 12) | 90° |
| spawn_0374 | embers | (-80, 4, 20) | 90° |
| spawn_0375 | embers | (-80, 4, 28) | 90° |
| spawn_0376 | embers | (-80, 4, 36) | 90° |
| spawn_0377 | embers | (-96, 4, -36) | 90° |
| spawn_0378 | embers | (-96, 4, -12) | 90° |
| spawn_0379 | embers | (-96, 4, 12) | 90° |
| spawn_0380 | embers | (-96, 4, 28) | 90° |
| spawn_0381 | embers | (-88, 4, 44) | 180° |
| spawn_0382 | embers | (-80, 4, 48) | 180° |
| spawn_0383 | embers | (-88, 4, -44) | 0° |
| spawn_0384 | embers | (-72, 4, -44) | 0° |
| spawn_0385 | tide | (80, 0, 0) | -90° |
| spawn_0386 | tide | (80, 0, 8) | -90° |
| spawn_0387 | tide | (80, 0, -16) | -90° |
| spawn_0388 | tide | (80, 0, -24) | -90° |
| spawn_0389 | tide | (72, 0, 24) | -90° |
| spawn_0390 | tide | (64, 0, 16) | -90° |
| spawn_0391 | tide | (56, 0, 16) | -90° |
| spawn_0392 | tide | (56, 0, -8) | -90° |
| spawn_0393 | tide | (56, 0, 0) | -90° |
| spawn_0394 | tide | (64, 0, -8) | -90° |
| spawn_0395 | tide | (72, 0, -8) | -90° |
| spawn_0396 | tide | (80, 0, 24) | -90° |
| spawn_0397 | tide | (88, 0, 16) | -90° |
| spawn_0398 | tide | (88, 0, 24) | -90° |
| spawn_0399 | tide | (48, 0, -8) | -90° |
| spawn_0400 | tide | (72, 0, 16) | -90° |
| spawn_0401 | free-for-all | (-56, 4, 72) | 180° |
| spawn_0402 | free-for-all | (-36, 4, 56) | -90° |
| spawn_0403 | free-for-all | (-80, 4, 64) | 90° |
| spawn_0404 | free-for-all | (-28, 0, -40) | 0° |
| spawn_0405 | free-for-all | (20, 0, -36) | 0° |
| spawn_0406 | free-for-all | (24, 0, 24) | -90° |
| spawn_0407 | free-for-all | (-28, 0, 30) | 90° |
| spawn_0408 | free-for-all | (20, 0, 36) | -90° |
| spawn_0409 | free-for-all | (36, 4, 64) | 90° |
| spawn_0410 | free-for-all | (80, 4, 72) | -90° |
| spawn_0411 | free-for-all | (-20, 4, 78) | 180° |
| spawn_0412 | free-for-all | (20, 4, 76) | 180° |
| spawn_0413 | free-for-all | (-80, 0, -64) | 90° |
| spawn_0414 | free-for-all | (-36, 0, -72) | 0° |
| spawn_0415 | free-for-all | (-20, 0, -82) | 0° |
| spawn_0416 | free-for-all | (8, 0, -88) | 0° |
| spawn_0417 | free-for-all | (24, 0, -80) | 0° |
| spawn_0418 | free-for-all | (76, 0, -70) | -90° |
| spawn_0419 | free-for-all | (84, 0, -46) | -90° |
| spawn_0420 | free-for-all | (36, 0, -12) | -90° |
| spawn_0421 | free-for-all | (-24, -4, -48) | 90° |
| spawn_0422 | free-for-all | (24, -4, -48) | -90° |
| spawn_0423 | free-for-all | (-96, 4, 0) | 90° |
| spawn_0424 | free-for-all | (76, 0, 32) | 180° |

### Objectives

| Id | Mode | Kind | Position | Notes |
|---|---|---|---|---|
| flag_0425 | core.ctf (and core.forts) | flag base, team embers | (-80, 4, 0) | |
| flag_0426 | core.ctf (and core.forts) | flag base, team tide | (76, 0, -8) | |
| hill_0427 | core.koth | hill | (-4, 0, 8) | radius default |
| hill_0428 | core.koth | hill | (-58, 4, 56) | radius default |
| hill_0429 | core.koth | hill | (46, 0, -62) | radius default |
| hill_0430 | core.koth | hill | (36, 4, 50) | radius default |

### Pickups

| Id | Item (registry id) | Position | Respawn |
|---|---|---|---|
| pickup_0431 | `core.weapon_rockets` | (0, -4, -48) | item's own |
| pickup_0432 | `core.weapon_sniper` | (-64, 4, 24) | item's own |
| pickup_0433 | `core.weapon_sniper` | (88, 4, -2) | item's own |
| pickup_0434 | `core.weapon_marksman` | (56, 10, 56) | item's own |
| pickup_0435 | `core.weapon_launcher` | (-4, 0, 8) | item's own |
| pickup_0436 | `core.armor_large` | (-8, 0, 16) | item's own |
| pickup_0437 | `core.armor_large` | (-40, 4, 72) | item's own |
| pickup_0438 | `core.weapon_shotgun` | (-64, 4, 56) | item's own |
| pickup_0439 | `core.weapon_auto_shotgun` | (-40, 4, 62) | item's own |
| pickup_0440 | `core.weapon_smg` | (-84, 4, 60) | item's own |
| pickup_0441 | `core.weapon_shotgun` | (-32, -4, -48) | item's own |
| pickup_0442 | `core.weapon_smg` | (32, -4, -48) | item's own |
| pickup_0443 | `core.weapon_burst_rifle` | (-16, 4, 64) | item's own |
| pickup_0444 | `core.weapon_rifle` | (0, 0, -78) | item's own |
| pickup_0445 | `core.weapon_rifle` | (-64, 0, -64) | item's own |
| pickup_0446 | `core.weapon_burst_rifle` | (46, 0, -56) | item's own |
| pickup_0447 | `core.weapon_lmg` | (44, 0, 4) | item's own |
| pickup_0448 | `core.weapon_flamethrower` | (36, 0, -40) | item's own |
| pickup_0449 | `core.weapon_gilded_pistol` | (64, 4, 40) | item's own |
| pickup_0450 | `core.weapon_marksman` | (-44, -1.6, -6) | item's own |
| pickup_0451 | `core.grenades` | (-24, 0, -44) | item's own |
| pickup_0452 | `core.grenades` | (16, 0, 28) | item's own |
| pickup_0453 | `core.grenades` | (-72, 4, -32) | item's own |
| pickup_0454 | `core.grenades` | (64, 0, 24) | item's own |
| pickup_0455 | `core.armor_small` | (-40, 0, 26) | item's own |
| pickup_0456 | `core.armor_small` | (28, 0, -40) | item's own |
| pickup_0457 | `core.armor_small` | (20, 4, 56) | item's own |
| pickup_0458 | `core.armor_small` | (-60, 0, -84) | item's own |
| pickup_0459 | `core.armor_small` | (64, 0, -64) | item's own |
| pickup_0460 | `core.armor_small` | (-4, -1.6, 40) | item's own |
| pickup_0461 | `core.health_large` | (-4, 0, -16) | item's own |
| pickup_0462 | `core.health_large` | (-4, 3, 68) | item's own |
| pickup_0463 | `core.health_large` | (4, 0, -60) | item's own |
| pickup_0464 | `core.health_small` | (-84, 4, -16) | item's own |
| pickup_0465 | `core.health_small` | (-84, 4, 16) | item's own |
| pickup_0466 | `core.health_small` | (72, 0, 8) | item's own |
| pickup_0467 | `core.health_small` | (64, 0, -16) | item's own |
| pickup_0468 | `core.health_small` | (-56, 4, 48) | item's own |
| pickup_0469 | `core.health_small` | (40, 4, 48) | item's own |
| pickup_0470 | `core.health_small` | (-32, 0, -60) | item's own |
| pickup_0471 | `core.health_small` | (24, 0, -64) | item's own |
| pickup_0472 | `core.health_small` | (-16, -4, -48) | item's own |
| pickup_0473 | `core.health_small` | (16, -4, -48) | item's own |
| pickup_0474 | `core.health_small` | (32, 0, 12) | item's own |
| pickup_0475 | `core.health_small` | (-36, 0, -28) | item's own |
| pickup_0476 | `core.ammo` | (-72, 4, 0) | item's own |
| pickup_0477 | `core.ammo` | (72, 0, 0) | item's own |
| pickup_0478 | `core.ammo` | (-4, 0, -26) | item's own |
| pickup_0479 | `core.ammo` | (-48, 4, 68) | item's own |
| pickup_0480 | `core.ammo` | (60, 4, 44) | item's own |
| pickup_0481 | `core.ammo` | (0, -4, -44) | item's own |

### Liquids

| Id | Liquid | Box min (x, y, z) | Box max | Tint |
|---|---|---|---|---|
| water_0162 | water | (-62, -2.9, -36) | (-29, -0.7, 30) | #2fc8c4 |
| water_0163 | water | (-20, -2.9, 28) | (12, -0.7, 45.5) | #2fc8c4 |
| water_0164 | water | (-8, 3, 45.5) | (0, 3.5, 64) | #2fc8c4 |
| water_0165 | water | (-14, 2.6, 64) | (6, 3.5, 77) | #2fc8c4 |
| water_0166 | water | (20, -1.7, -30) | (52, -0.7, -20) | #2fc8c4 |
| water_0167 | water | (52, -1.7, -34) | (64, -0.7, -16) | #2fc8c4 |
| water_0168 | water | (-70, 3.1, -12) | (-60, 3.5, -4) | #2fc8c4 |
| water_0169 | water | (-12, -4, -52) | (12, -3.6, -44) | #3aa8a0 |
| water_0170 | water | (4.5, -0.5, 12.5) | (11.5, 0, 19.5) | #2fc8c4 |
| water_0171 | water | (-19.5, -0.5, -27.5) | (-12.5, 0, -20.5) | #2fc8c4 |

### Lights and ladders

| Id | Kind | Position | Notes |
|---|---|---|---|
| light_0354 | light (bulb) | (-58, -1.7, -45.5) | #ff9a3c, range 11, flickers |
| light_0355 | light (bulb) | (-11, -1.7, -45) | #ff9a3c, range 11, flickers |
| light_0356 | light (bulb) | (11, -1.7, -51) | #ff9a3c, range 11, flickers |
| light_0357 | light (bulb) | (58, -1.7, -50.5) | #ff9a3c, range 11, flickers |
| light_0358 | light (bulb) | (-36, -1.5, -48) | #ff9a3c, range 11, flickers |
| light_0359 | light (bulb) | (36, -1.5, -48) | #ff9a3c, range 11, flickers |
| light_0360 | light (bulb) | (-8, 2.4, 22) | #ff9a3c, range 11, flickers |
| light_0361 | light (bulb) | (0, 2.4, -32) | #ff9a3c, range 11, flickers |
| light_0362 | light (bulb) | (-32, 2.4, -4) | #ff9a3c, range 11, flickers |
| light_0363 | light (bulb) | (24, 2.4, -4) | #ff9a3c, range 11, flickers |
| light_0364 | light (none) | (-4, -2, -48) | #7fe0d8, range 14 |
| ladder_0103 | ladder | (-28.7, 0, -2.6) | 4.4 m, vines |

### Props by model

175 props, 31 models.

| Model | Count |
|---|---|
| `prop.eg_papyrus` | 35 |
| `prop.jg_rubble_blocks` | 18 |
| `prop.jg_carved_pillar` | 13 |
| `prop.eg_palm` | 11 |
| `prop.nt_palm_tall` | 11 |
| `prop.nt_palm_curved` | 10 |
| `prop.palm_tall` | 10 |
| `prop.eg_torch` | 8 |
| `prop.mn_rock_spires` | 6 |
| `prop.boulder_jagged` | 6 |
| `prop.rocks_tall` | 5 |
| `prop.boulder_flat` | 5 |
| `prop.eg_obelisk` | 4 |
| `prop.jg_waterfall` | 3 |
| `prop.eg_sphinx` | 3 |
| `prop.eg_statue_pharaoh` | 3 |
| `prop.eg_stele` | 3 |
| `prop.stall` | 3 |
| `prop.eg_column_papyrus` | 2 |
| `prop.eg_anubis` | 2 |
| `prop.stall_green` | 2 |
| `prop.im_amphorae` | 2 |
| `prop.barrel` | 2 |
| `prop.fountain` | 1 |
| `prop.jg_stone_idol` | 1 |
| `prop.eg_cat_statue` | 1 |
| `prop.eg_sarcophagus` | 1 |
| `prop.crate_large` | 1 |
| `prop.eg_chest` | 1 |
| `prop.rn_urn_broken` | 1 |
| `prop.rn_urn` | 1 |

### Blocks

47 solid blocks: 18 `core.pbr_sandstone_blocks`, 29 `core.pbr_rough_sandstone` (terrace walls and parapets, stair-court retaining walls and kerbs, low ruined walls).
