# Map and asset budgets

How big maps can get, and what an asset may cost, so Tile Trigger stays smooth
in a browser on an ordinary laptop (integrated graphics, 8 GB RAM) with 8–24
players and bots.

## Map budgets

The validator (`validateMap`, MapMaker's warnings badge, `pnpm validate-map`)
warns when a map goes over these. They are soft limits: the map still loads
and plays, it may just run slowly on weaker machines. Hard limits come from
the map format (4,096 entities, terrain 161 × 161 vertices).

| What | Budget | Why |
|---|---|---|
| Playable footprint | 400 m across | Bot navigation, network relevance and draw distance are tuned for this. Terrain tops out at 320 m. |
| Tiles | 1,500 | Merged into a few meshes; mostly a navmesh build-time cost. |
| Props | 1,500 | Untinted props are GPU instances (one draw call per model), so the cost is mostly in the variety of models (next row). |
| Different prop models | 80 | Each model is a download (≈20–100 KB) and one draw call per part. |
| Solid free blocks | 3,000 | Merged into the level's meshes by material, like tiles (a castle hall is a few hundred blocks); the cost is mostly the navmesh build when the map loads. |
| Breakable / crumbling / trapdoor blocks | 150 | Each is simulated every tick and its state is sent to players. |
| Bodies of liquid | 32 | Each is a see-through surface (transparency is expensive). |
| Active pieces | 300 | Doors, traps, zones, NPC squads, vehicles, pads and buttons think every tick. |
| Lights | 256 | Lights are clustered (each pixel only adds up the lamps that reach it), but overlapping ones still cost every pixel they light; fixtures nothing switches are merged into a few meshes. |

Suggested sizes by player count:

| Map | Players | Footprint | Typical content |
|---|---|---|---|
| Arena / skirmish | 2–6 | 40–100 m | 50–300 tiles, up to 300 props |
| Standard | 4–12 | 100–200 m | 200–800 tiles or a 160 m terrain, up to 800 props |
| Large (vehicles) | 8–24 | 200–400 m | 240–320 m terrain, up to 1,500 props, 4–10 vehicles |

## Asset budgets

Enforced by `pnpm content:check` for every imported model:

| Asset | Budget | What we actually ship |
|---|---|---|
| Placeable prop | ≤ 6,000 triangles, ≤ 400 KB | 267 Kenney props: average ≈ 260 triangles and 22 KB; the biggest (a steam locomotive) 1,666 triangles and 104 KB. 110 sci-fi kit pieces: average ≈ 520 triangles and 70 KB (their trim-sheet textures are embedded at 512 px colour + 256 px normal), the biggest (pipe column) 3,455 triangles and 242 KB; 7.8 MB for all of them, so a map using 20 of them adds ≈ 1.5 MB |
| Weapon / vehicle model | ≤ 6,000 triangles | 1,000–3,000 typical |
| Surface textures | 512 px colour + normal | 83 files, 3.2 MB in all |
| Sky photos | 2048 × 1024 JPEG | 25–125 KB each |
| Characters | shared skeleton, LODs | 9.2 MB for every body, outfit and animation |
| Creatures (NPC) | ≤ 20,000 triangles, ≤ 1.5 MB (character budget) | 5 models, 1.4 MB in all: imp 8.6k triangles / 597 KB, puglin 4.5k / 330 KB, aliens 2.1k–5.7k / 78–242 KB |

A match only downloads what its map uses: the props, sky and textures it
places, plus the weapons and characters in play. A typical map needs 2–6 MB of
props and textures on top of the game itself (≈ 7 MB of script, cached after
the first visit).

## Cheap free models

We only use free, human-made assets that are CC0 (or credit-only). The cheapest
to run are low-poly kits that share one small colour texture:

| Source | Licence | Why it's cheap | In use |
|---|---|---|---|
| Kenney 3D kits (kenney.nl) | CC0 | 50–2,000 triangles, one shared 64 px colour map per kit | 14 kits: survival, furniture, graveyard, pirate, space station, factory, mini dungeon, city, nature, castle, fantasy town, train, mini market, platformer (+ blaster, car, space for weapons and vehicles) |
| Quaternius (quaternius.com) | CC0 (Bestiary kit: QAL, see ASSET_SOURCES.md) | Flat-coloured low-poly; the sci-fi kit uses shared trim sheets | Guns, characters, animations, sci-fi set pieces, creatures |
| KayKit (kaylousberg.itch.io) | CC0 | One gradient atlas per pack | Candidate for dungeon and adventure sets |
| Poly Haven (polyhaven.com) | CC0 | Photo-real; use sparingly (heavier textures) | Sky photos |
| ambientCG (ambientcg.com) | CC0 | Scanned materials, downscaled to 512 px | All wall and floor materials |

For a new prop, prefer: under 1,500 triangles, sharing an existing kit's
texture, and a simple collision box (`collide: box`, `trunk` or `none` in
`content/props.json`).

## Keeping it fast

- Props use GPU instancing: in a match every copy of an untinted prop is an instance of its model with the model's meshes merged per material (one draw per material for all copies however many parts the model has); tinted props get their own materials, so tint sparingly.
- Destructibles (crates, barrels, panes, boards, walls) are GPU thin instances: one draw per part shape and material for the whole map; a body darkens with damage through its instance colour and a broken one's instances collapse. Pickups' shapes are instances too.
- Terrain plants are thinned in 32 m chunks and drawn in 64 m sectors (one draw per plant mesh per sector, culled per sector) only near the camera, in a plain lambert material, casting no shadows. Grass, tall grass, flowers and pebbles thin out with distance (all of them close by, a third at the edge of their range) and by graphics setting (Low: half the range and a third as many; Medium: 80% of the range, three quarters as many); shrubs and bushes always grow in full.
- Distant scenery is built from a few large meshes and fades into haze.
- Bots path on a navmesh built once per map.
- City facades are GPU thin instances: one draw per piece and material, however many bays use it.
- Borders cost a few dozen draw calls however long the boundary (merged meshes and thin instances; low-poly conifers stand in for trees behind the front row, the window texture for facades above the second storey). The detailed models (front-row trees, facades) are split into 120 m squares so the ones behind you are culled: Apex Ring's 1.58 km boundary was ≈0.6 M triangles wherever you looked.

### Big maps at 48 v 48

The server's tick (60 Hz, 16.7 ms) and a player's frame both grow with the
crowd, so a map meant for 96 players should stay inside these on top of the
budgets above:

- **Lights**: up to 256 (validator). Only lights that logic switches, or that
  start off or blinking, cost a draw call each; the rest share materials and
  their fixtures are merged. Prefer `fixture: 'none'` for fill light.
- **Terrain**: the format's 161 × 161 at 2 m (320 m) is the most a map should
  use; 2.5 m spacing (400 m) is fine for open ground. Character movement on
  terrain is the dearest thing the server does: bots in big matches use a
  coarse move over it (the terrain's height function instead of its collision
  mesh), players keep the exact one.
- **Navigation**: one navmesh at 0.2 m cells for every map. Coarser cells
  (0.25–0.3 m) halve the build on Norman Shores and Apex Ring but close
  doorways (40% of Norman Shores' spawn pairs lost their route), so there is
  no per-map setting; keep big maps connected with wide openings (≥ 1.4 m)
  instead. Routes may be long: path searches have 65,535 nodes and 8,192
  polygons, and routes that don't exist are remembered.
- **Water in the middle**: a lake or a canyon nobody can cross makes every
  route go round it; give it two crossings or more so bots spread out.
- **Props**: instanced, so the count matters less than the number of
  different models (80) and tints (each tint is its own material).
- **Measure**: `pnpm bench:96:maps` (server, 96 bots, 60 s a map) and
  `node tools/perf/client-perf.mjs <map>` after `pnpm build` (headless
  Chromium, 96 players offline: draw calls, meshes, triangles, shadow casters).

#### Before and after (October 2026 performance pass)

Server, 96 bots, Team Deathmatch 48 v 48, 60 s (`pnpm bench:96:maps`), four
bots standing in for players. The box (4 cores) was shared with other heavy
jobs at load 16–24 for the comparison runs, so wall-clock ticks were 2–3×
inflated; the process CPU time per tick is the fairer measure (at load ~3 the
old code's average tick matched its CPU time). Old and new ran alternately,
map by map.

| Map | CPU ms/tick before | after | Path queries failing before | after | Kills before → after |
|---|---|---|---|---|---|
| Norman Shores | 13.5–14.3 | 7.4–7.5 | 70% (4,485 of 6,387) | 2–3% | 4 → 1–2* |
| Apex Ring | 11.9–13.3 | 8.5–9.1 | 2% | 1% | 34 → 32 |
| Capitol Mall | 12.3–12.6 | 8.1–8.7 | 41% | 2–4% | 32 → 27–32 |
| Riot Junction | 10.8–11.0 | 8.7–9.2 | 1% | 1% | 80 → 87–91 |
| Eagle Spires | 12.1–12.5 | 7.7–7.8 | 55% | 17–19% | 40 → 30–37 |
| Shingle Point | 12.4 | 8.5–8.7 | 19% | 7–8% | 41 → 38–40 |
| Frost Basin | 11.8 | 7.9–8.0 | 40% | 14–16% | 33 → 30–31 |
| Primeval Park | 15.7 | 9.9–10.0 | 16% | 13–14% | 103 → 71–89 |

\* Norman Shores' sides start on opposite shores; bots now take the long way
round (they used to give up and idle at the water: 8.6% idle samples before,
2.5% after) and a minute is barely enough to cross. Remaining failures are
goals truly out of reach (roofs, pads' far ends); they are remembered, so they
cost a lookup. Where the time goes now (CPU, per tick): bot thinking 2–4 ms,
character moves 2–4 ms (almost all coarse), vehicles and traffic < 1 ms
(Apex Ring's ambient karts ~2 ms), snapshots ~0.5 ms.

Client, headless Chromium (SwiftShader, so frame rates are meaningless; draw
calls and triangles are not), 96 players offline, Medium graphics:

| Map | Draw calls before | after | Triangles drawn before | after | Shadow-map casters before | after |
|---|---|---|---|---|---|---|
| Norman Shores | 6,116 | 2,389 | 7.34 M | 4.35 M | 6,316 | 1,447 |
| Frost Basin | 3,892 | 1,157 | 1.95 M | 0.69 M | 3,853 | 1,175 |

Terrain plants on Norman Shores (the grassiest big map), in view: before,
≈0.61 M triangles of grass in PBR materials, all of it also drawn into the
shadow map; after, 0.52 M on High, 0.31 M (2,500 plants) on Medium, a lambert
material and no shadow casting. Apex Ring on Medium: 0.07 M.

### Clumped 48 v 48 (bot AI pass, October 2026)

The owner's report: 48 v 48 gets choppy when the bots bunch up. In a clump
every bot sees dozens of enemies: before this pass each perception cast a sight
line to every enemy in view (200–260 rays a tick on the clumped maps), and
every fighting bot thought in full every tick.

**Measure**: `pnpm bench:96:clump` (96 bots, TDM 48 v 48, 10 s warm-up then
30 s, Norman Shores, Frost Basin and Riot Junction, each spread out as they
play and clumped: everyone put on a ~40 m patch in the middle, each side on
its half, respawns put straight back). Add `--skills=mixed` for accuracy per
bot skill. It prints process CPU per tick (avg, p95 tick by tick) and a
breakdown: bot think (perception, decisions, paths, aim, sight rays), movement
(character moves), combat (firing, bullets in flight) and the rest.
`packages/shared/test/clumpPerf.test.ts` keeps a clump within 1.35× the
spread match's CPU a tick, with fewer than 90 sight rays a tick.

**What changed** (big matches only, past `BOT_FULL_RATE` bots; smaller
matches think and see exactly as before, only cheaper rays and fewer
allocations reach them):

- Bots think in full at 20 Hz (`BOT_THINK_EVERY` = 3 ticks, staggered by
  slot). In between, a fighting bot *steers* (`BotBrain.steer`): perception
  still runs on its own schedule, the aim tracks the target and the trigger
  discipline runs every tick, and the move carries on; it falls back to a full
  think when perception changes target, a decision is due (10 Hz), it is hurt
  or shot at, or it was doing anything but aiming and shooting. A bot with
  nobody to fight repeats its last move between thinks (as before, but two
  ticks in three instead of one in two).
- Think budget: at most an even share (thinking bots / 3) + 6 full thinks a
  tick; the rest of those due wait one tick (steering, or holding their move
  and trigger) and go first on the next. The loop starts at a different bot
  every tick (round robin) and nobody waits two ticks running.
- Perception casts sight lines nearest first (sticking with the current
  target): at most 16 while looking for a target, 6 once it has one. Enemies
  it had no ray for stay tracked (reaction time kept) for half a second.
- `SightCache`: actor-to-actor sight lines are symmetric, so one ray answers
  both bots, and is reused for up to 6 ticks while neither eye has moved
  0.6 m. Cleared when a door, breakable or built piece changes
  (`PhysicsWorld.structureVersion`).
- Cheaper rays: `PhysicsWorld` casts through one reused `Ray` (no vectors made
  per cast): about a third cheaper a ray (5.7 → 3.6 µs on Riot Junction,
  11.3 → 7.2 µs on Frost Basin, 8,700–8,900 eye-to-eye rays in a clump).
- A spatial grid (`ViewGrid`, 8 m cells) of each side's living members, built
  once a tick, for keeping teammates apart. (Perception doesn't use it: in a
  clump everyone is in sight range anyway, and the nearest-first cap bounds the
  work.)
- Fewer allocations: inventory views reused tick to tick, perception scratch
  arrays, one view shape for every bot (keeps the bot code monomorphic: a
  property added to some views made all bot code measurably slower), no
  per-bot closures, coasting copies the input field by field, bullet target
  lists shared per side for a pass.

**Results**, CPU ms per tick (process CPU, breakdown scaled by CPU/wall), old
and new run alternately, map by map, on a 4-core box shared with other
agents (load 11–14). The simulation is deterministic, so kills, accuracy and
stuck counts are exact for these seeds; times vary ±0.3 ms run to run.
p95 is dominated by the box's load (scheduling), not by the code.

| Map | Layout | Code | CPU avg | CPU p95 | Bot think | Movement | Combat | Rest | Sight rays/tick | Full thinks/tick |
|---|---|---|---|---|---|---|---|---|---|---|
| Norman Shores | spread | before | 6.24 | 14.1 | 2.04 | 3.66 | 0.10 | 0.44 | 1 | 49 |
| | | after | 6.20 | 14.7 | **1.73** | 3.90 | 0.09 | 0.48 | 1 | 33 |
| | clumped | before | 8.17 | 17.3 | 2.83 | 4.09 | 0.67 | 0.57 | 260 | 92 |
| | | after | **7.21** | 15.0 | **2.02** | 4.29 | 0.43 | 0.47 | **29** | 59 |
| Frost Basin | spread | before | 6.93 | 15.4 | 2.54 | 3.56 | 0.28 | 0.55 | 10 | 57 |
| | | after | 6.47 | 14.3 | **1.94** | 3.75 | 0.17 | 0.61 | 7 | 40 |
| | clumped | before | 7.08 | 15.5 | 3.25 | 2.80 | 0.45 | 0.58 | 124 | 81 |
| | | after | 7.10 | 15.5 | **2.45** | 3.59 | 0.53 | 0.53 | **37** | 52 |
| Riot Junction | spread | before | 7.68 | 15.8 | 2.85 | 3.50 | 0.63 | 0.71 | 99 | 72 |
| | | after | **6.80** | 13.7 | **2.23** | 3.61 | 0.39 | 0.57 | **33** | 39 |
| | clumped | before | 6.42 | 13.4 | 2.65 | 2.69 | 0.53 | 0.55 | 211 | 86 |
| | | after | **5.89** | 13.0 | **2.10** | 2.77 | 0.48 | 0.54 | **33** | 52 |

Bot thinking is 21–29 % cheaper in a clump and 15–24 % spread out; sight
rays 4–9× fewer. Clumped over spread CPU: 1.31 → 1.16 (Norman Shores),
1.02 → 1.10 (Frost Basin), 0.84 → 0.87 (Riot Junction). Character movement is
now the larger half of a tick (3–4 ms), and moved up where bots stand still
less (Frost Basin clumped: idle samples 17.7 % → 12.6 %): that is the next
thing to cut.

Behaviour (mixed easy/normal/hard bots; accuracy = rounds that hit / fired):

| Map, clumped | Easy before → after | Normal | Hard | Kills | Stuck recoveries |
|---|---|---|---|---|---|
| Norman Shores | 29.8 → 31.9 % | 42.4 → 43.5 % | 58.8 → 62.1 % | 365 → 350 | 36 → 72 |
| Frost Basin | 13.0 → 7.2 % | 26.3 → 23.8 % | 34.8 → 34.0 % | 143 → 91 | 56 → 80 |
| Riot Junction | 23.8 → 22.1 % | 35.9 → 37.9 % | 50.7 → 52.5 % | 278 → 250 | 39 → 91 |

One-on-one aim (`botai.test.ts`, 15 m strafing target) is unchanged to the
round: easy 19.5 %, normal 38.8 %, hard 59.1 %; pistol at 8 m 35.9 % strafing,
50.3 % still. Trade-offs: rounds fired in a clump are 5–15 % fewer (bots
think less often about *whether* to fight, not about aiming), Frost Basin's
clump had fewer kills and its easy bots hit less in this seed, and stuck
recoveries roughly double in clumps (bots crowding each other keep their move
a tick or two longer before re-pathing; they recover as before).

### Player settings (Options)

- **Render scale** (default Auto): pixels drawn per screen point. Retina
  screens have two per point, so Native draws four times as many pixels as
  Standard; Auto draws 1.25 per point (barely softer, much cooler on
  laptops). Performance draws 0.75. Applies at once.
- **Frame cap** (default 60 fps): ProMotion displays refresh at 120 Hz and the
  game would otherwise draw every refresh; 30 fps for battery, Unlimited to
  follow the screen. Applies at once. Frames fall due on a steady beat
  (`FramePacer`): a refresh within a few milliseconds of the due time draws,
  so a 60 Hz screen draws every refresh under the 60 cap (skipping any refresh
  that came 1.5 ms early dropped about one frame in ten when callbacks wander
  by a few milliseconds).
- **Graphics** (Low / Medium / High): shadows, then far shadows, ambient
  occlusion, bloom and light shafts; the border's detailed trees and facades
  are drawn to 160 m on Low and 260 m on Medium (the low-poly rows behind
  them always). Applies from the next match.

On a MacBook (M1) the defaults (Auto, 60 fps, Medium) keep the fans quiet; High
with Native scale at 120 fps is roughly six times the GPU work.
