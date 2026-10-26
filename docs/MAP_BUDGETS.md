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

- Props use GPU instancing; tinted props get their own materials, so tint sparingly.
- Terrain plants are instanced in 32 m chunks and drawn only near the camera.
- Distant scenery is built from a few large meshes and fades into haze.
- Bots path on a navmesh built once per map.
- City facades are GPU thin instances: one draw per piece and material, however many bays use it.
- Borders cost a few dozen draw calls however long the boundary (merged meshes and thin instances; low-poly conifers stand in for trees behind the front row, the window texture for facades above the second storey): ≈0.6 M triangles on Apex Ring's 1.58 km boundary.

### Player settings (Options)

- **Render scale** (default Auto): pixels drawn per screen point. Retina
  screens have two per point, so Native draws four times as many pixels as
  Standard; Auto draws 1.25 per point (barely softer, much cooler on
  laptops). Performance draws 0.75. Applies at once.
- **Frame cap** (default 60 fps): ProMotion displays refresh at 120 Hz and the
  game would otherwise draw every refresh; 30 fps for battery, Unlimited to
  follow the screen. Applies at once.
- **Graphics** (Low / Medium / High): shadows, then far shadows, ambient
  occlusion, bloom and light shafts. Applies from the next match.

On a MacBook (M1) the defaults (Auto, 60 fps, Medium) keep the fans quiet; High
with Native scale at 120 fps is roughly six times the GPU work.
