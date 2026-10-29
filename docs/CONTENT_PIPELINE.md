# Content Pipeline — Building the Sandbox

**Status:** proposal, adopted direction.

The team hand-makes the toy box: building pieces, materials, colours, props, interactive objects, character parts and costume pieces, weapons, sounds, and the in-house tools. Players combine those parts their own way (see [`PLAYER_EXPRESSION.md`](PLAYER_EXPRESSION.md)). There are no player-uploaded assets and no generated content (see `OPEN_QUESTIONS.md`, "Decisions"). This document is how the team makes and ships the parts.

## 0. What players get to play with

Breadth and *combinability* matter more than polish per item. Every part shares the grid, scale, attach-point and material rules, so any piece works with any other and each new option multiplies the possibilities.

| Toy box | Vertical slice (M1–M6) | Growth after the slice |
|---|---|---|
| Structural pieces | ~15–20 graybox tiles (11 today) | More shapes per family: big rooms, ramps, bridges, balconies, pits, windows, open-air platforms |
| Materials and tints (painted per surface) | ~20 starter materials + tint swatches (M1.5) | Large library across all world families |
| Themes (default palettes for every piece) | 1 hand-made theme + the prototype grid look | 3–4 themes in Phase 2, then one per world family (tomb, gothic, lab, space station…) |
| Props / dressing | Small set (crates, barrels, cover, lights) | Per-theme prop sets, freely placed |
| Interactive objects | Doors, buttons, destructibles, trigger volumes, pickups, spawners | Elevators, teleporters, hazards, turrets, vehicles later |
| Logic blocks | WHEN → IF → DO with a starter set of events/conditions/actions, plus templates | More blocks and templates, then the visual graph |
| Character parts (heads, torsos, limbs, hands, feet, outerwear, attachments, accessories, swatches) | Enough parts for the Character Designer plus 12 preset characters built with it | Growing part library; the roster targets in CHARACTERS_BOTS_V2 §9 become presets |
| Weapons and items | 6 weapon roles, health/armor, 2 powerups | 20–30 weapons |
| Audio | Weapon/pickup/UI sounds, 1 ambience and music set | Ambience and music per theme; placeable sound emitters |

## 1. Principles

1. **Content is data plus assets, referenced by stable content ID.** Gameplay code never names a specific character, tile or weapon (master spec v1 §23 rule 2).
2. **Gameplay shape and visual dressing are separate.** Collision, navigation and hitboxes come from data (tile cells/ports/solids, capsule classes). Art meshes dress that shape. Visuals can change, or whole themes swap (v1 §8.6), without touching gameplay.
3. **Hand-made, no generated content.** Shipped assets are authored by the team (or, case by case, licensed from conventional asset libraries made by people). Generative AI is not used to create shipped models, textures, sounds, music, voices or writing. Every asset records its author and licence, and characters pass the originality review (CHARACTERS_BOTS_V2 §2).
4. **Budgets are checked by machines.** CI rejects assets over budget, with a wrong skeleton, without provenance, or with a broken reference. People review taste, readability and originality.
5. **Our own tools first.** Official maps are built in MapMaker, so the creator tools get used daily by the people shipping the game.

## 2. Content packs and the registry

```
content/
  core/                     # always present
    pack.json               # id, version, list of content entries
    tiles/*.json            # TileDefinition data (today: shared/src/map/catalog.ts)
    weapons/*.json          # WeaponDefinition data (today: shared/src/sim/weapons.ts)
    characters/*.json       # CharacterDefinition (CHARACTERS_BOTS_V2 §28)
    bots/*.json             # BotProfile (§29)
    themes/*.json           # visual kit mapping per tile family
    props/*.json
    audio/*.json
  <theme-pack>/...          # later packs, referenced by maps' `dependencies`
assets-src/                 # source files (.blend, .psd, .wav): Git LFS or external storage, never shipped
```

- A **ContentRegistry** in `shared` loads pack data and is used by the server, the client and MapMaker alike. No separate representations that drift apart (v1 §18.3).
- Each entry has `id`, `version`, `displayName`, `assets` (built file hashes), `provenance` and `review` fields.
- Maps already declare `dependencies`. The validator checks that every content ID a map uses exists in a declared pack.

## 3. Build: source to shipped asset

```
Blender / DCC export (glTF 2.0)
  -> validate (gltf-validator, naming, scale, skeleton)
  -> optimise (gltf-transform: dedupe, weld, meshopt compression, KTX2/Basis textures)
  -> build lower-detail LODs by mesh simplification, and render a thumbnail/portrait
  -> budget check
  -> content-hashed output in dist/content/  (CDN-ready, immutable, cacheable)
  -> registry entry updated with hashes + measured stats
```

Run it with `pnpm content:build` (local) and `pnpm content:check` (CI, fails on any violation).

### Pack imports from a downloads directory

Some packs are too big to keep in the repo, or their licence forbids
redistributing the raw files (the Quaternius Bestiary kit, QAL v1.0). For
these only the licence summary lives in `assets-src/<pack>/License.txt`; the
built files and their lock files are committed, and `content:check` verifies
them by hash. To re-run an import, download the packs from the creator's page,
unzip each into its own folder inside one downloads directory (the extracted
folder can sit directly in it or one level down), and run:

| Pack(s) | Command | Writes |
|---|---|---|
| Universal Base Characters, Modular Outfits – Fantasy, Universal Animation Library 1 + 2 | `node tools/content/prepare-characters.mjs <dir>` | `public/characters`, `content/characters.lock.json` |
| Modular SciFi MegaKit (`Modular SciFi MegaKit[Standard]`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `sf_*` props in `public/props`, `content/props.lock.json`, `shared/src/content/props.generated.ts` |
| Bestiary – Dungeon Monsters Kit (`Bestiary - Dungeon Monsters Kit[Standard]`), the MegaKit's aliens, Quaternius' Zombie (`Zombie by @Quaternius`) | `node tools/content/prepare-creatures.mjs <dir>` (creatures whose download is not there are kept as built) | `public/creatures`, `content/creatures.lock.json` |
| madduck's Modular 3D Hospital Environment (unzipped into a folder named `modular-3d-hospital-environment`, so its `FBX/` folder is inside) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `hp_*` props (untextured FBX: flat colours per material from `colors`, height bands from a prop's `bands`) |
| LowPolyAssets' Low Poly Wild West (the folder `Low Poly Wild West`, with its `Clutter`, `Miscellaneous`, `Modular`, `Nature` and `Transportation` folders) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `ww_*` props (untextured FBX, material colours kept; wall pieces with doorways collide as `openings`) |
| SigilsVault's Modular Dungeon Kit (the folder `modular dungeon kit`, holding `Modular Dungeon Pieces/` and `Props/`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `sd_*` props, from the GLB versions (textures embedded, shrunk to 256 px) |
| loafbrr's Fences (the folder `Fences`, one folder per fence set inside) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `lf_*` props, from the GLBs (maps shrunk to 256 px; pieces marked `flatten`, the metal fence, lose their photo maps for a flat colour per face) |
| Kenney Modular Space Kit, Space Kit and City Kit Roads, each unzipped into a folder named after its zip (`kenney_modular-space-kit_1.0`, `kenney_space-kit`, `kenney_city-kit-roads`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the Orbital Station and Neon Megacity `os_*` / `nc_*` kit props in `public/props`, `content/props.lock.json`, `shared/src/content/props.generated.ts` |
| Kenney Retro Urban Kit, City Kit (Industrial), Train Kit (`kenney_retro-urban-kit`, `kenney_city-kit-industrial_2.0`, `kenney_train-kit`, the zips from kenney.nl unzipped) | `node tools/content/prepare-props.mjs --downloads <dir>` | the Military Compound and Frontier Dust Kenney props in `public/props`, `content/props.lock.json`, `shared/src/content/props.generated.ts` |
| Kenney City Kit (Commercial) (`kenney_city-kit-commercial_2.1`) | `node tools/content/prepare-packs.mjs --downloads <dir>` | the Neon Megacity towers in `public/packs`, `content/packs.lock.json` |
| Designersoup Low Poly Car Pack 1 and its extras (`Designersoup_Low_Poly_Car_Pack_Volume_1_updated`, `extras`: each zip unzipped into a folder of that name), Low Poly Household Items (`Low_Poly_Household_Items`), Elbolillo's Gas station, Metro and House (the rars unpacked: `Gas_station`, `Metro_PSX`, `House`), loafbrr's Mines and Caves Set (`MinesAndCaves_Set_blend_gltf_fbx`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `car_*`, `ds_*`, `hh_*`, `gs_*`, `mt_*`, `hs_*` and `mc_*` props: FBX read by `tools/content/fbx.mjs`, the Elbolillo textures swapped for flat colours by `tools/content/flatten.mjs` |
| The owner's Meshy downloads (Meshy, owned: generated by the owner on their Meshy subscription): the rigged GLBs as `<id>.glb`, and the textured FBX folders (`Meshy_AI_<name>_…_texture_fbx`, unrigged: goblin, wealthy otter, Boglurker the toad, salamander warlord, hyena warrior) anywhere inside | `node tools/content/prepare-meshy-characters.mjs <dir>` (characters whose download is not there are kept as built; `ONLY=meshy_goblin,…` rebuilds just those; skin weights from `autoskin.mjs`) | `public/characters/meshy_*.glb`, `content/meshy.lock.json` |
| Meshy community T-pose characters (CC0 per owner; the unzipped `Meshy_AI_Elder_T_POSE_…`, `Meshy_AI_T_Pose_{Alien,Cat,Pilot,Pirate,Titan}_…_texture_fbx` folders) anywhere inside the same dir | `ONLY=meshy_elder,meshy_alien,meshy_cat,meshy_pilot,meshy_pirate,meshy_titan node tools/content/prepare-meshy-characters.mjs <dir>` | `public/characters/meshy_{elder,alien,cat,pilot,pirate,titan}.glb`, `content/meshy.lock.json` (with the model name and download date) |
| Meshy rock pile (`Meshy_AI_Rock_Pile_…_texture_remesh_tri_fbx`, owned like the above) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `rock_pile` prop (colour map attached by material name, 1024 px JPEG, `dropEmissive`) |
| Meshy community weapons and props (CC0 per owner; the unzipped `Meshy_AI_ANACONDA_44_…`, `Meshy_AI_Plasma_Annihilator_X_…`, `Meshy_AI_Nebula_Arc_Cannon_…`, `Meshy_AI_Industrial_Control_Panel_…`, `Meshy_AI_Wreckage_…` and `Meshy_AI_Spiky_Dinosaur_…_texture_fbx` folders, each named in its entry's `download`) | `node tools/content/prepare-guns.mjs --downloads <dir>` and `node tools/content/prepare-props.mjs --downloads <dir>` | `public/models/guns/{ironclad_revolver,plasma_spin_gun,arc_cannon_turret}.glb`, `content/guns.lock.json`; the `mp_*` props, `content/props.lock.json` (both through `tools/content/meshy-mesh.mjs`, below) |
| Meshy community nature models (Meshy community, CC0 per owner; each `Meshy_AI_<name>_…_texture_fbx` zip unzipped into a folder named `meshy-community-nature`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `mn_*` Nature props, built by `tools/content/nature.mjs` (below) |
| Styloo Guns Asset Pack (`Styloo Guns Asset Pack GLTF FBX V1.1`), CC0 Guns & Explosives Pack (the rar's `Guns&Explosives` folder) | `node tools/content/prepare-guns.mjs --downloads <dir>` | `public/models/guns`, `content/guns.lock.json` (see `content/guns.json`) |

Locomotion clips (walk, run, sprint) come from Library 1: the Standard edition
of Library 2 (43 clips, listed 2026-10-27) has no jog, run, sprint, strafe or
aim-run loops, only `Walk_Carry_Loop`, the zombie walk and a slide, so nothing
there replaces them. If a later rig changes those clips, update the measured
gait numbers in `packages/client/src/game/gait.ts` (`test/gait.test.ts`
re-measures them from `rig.glb` and fails until they match).

Then `pnpm content:build` (provenance) and `pnpm content:check`. Without
`--downloads` (or when a pack's folder is not in the downloads directory),
`prepare-props.mjs` rebuilds the in-repo packs and keeps the kit props as
built (checking them against the lock file), so a downloads directory holding
only some of the kits rebuilds just those. Kits with an `images` folder in
`content/props.json` (the MegaKit, and the Orbital and Neon Kenney kits) get
their materials baked and shrunk; the other GLB kits are normalised as they
are. Never copy the raw downloads into the repo. (Older Train Kit props whose
source GLB is in `assets-src/kenney-train-kit/` keep building from there.)

**Meshy API** (`tools/content/meshy-api.mjs`, needs `MESHY_API_KEY`): checks
the owner's credit balance, lists the account's API tasks and downloads a
task's files (`download <kind> <task id> <dir>`, into a dir outside the repo)
for the scripts above. The API only sees tasks made through the API: models
made on meshy.ai's site and community downloads are downloaded by hand.

**Meshy downloads** (`tools/content/meshy-mesh.mjs`, `meshy: true` packs in
`content/guns.json` and `content/props.json`). Meshy's textured FBX is one
mesh of 0.3–3.3 million triangles whose colour map is cut into thousands of
islands scattered over the atlas. Keeping those seams (`surface: texture`, the
seam-aware simplifier the creature originals use) stops far above a prop's
budget, so `surface: rebake` (the default for props) closes the seams, cuts the
mesh with colour and normals weighing in, lays it out afresh in flat charts
(triangles facing the same way along x, y or z, projected flat; creases over
40° keep their own normals) and paints the new map from the full download by
casting a ray along the low mesh's normal through every texel (the nearest
outward-facing surface wins; gutters and misses are filled from their
neighbours). `dropHidden` first drops the triangles no ray from outside can
reach (a wreck's engine bay and seat stuffing: 25% of it). `paintOut` (guns)
paints lettering and logos out of the colour map before anything else, from
colour rules (near-white, orange); `stone` (props) turns the map to stone of
one colour; `centre: base` (guns) centres a turret on its pedestal.
`surface: vertex` keeps the colours in the vertices instead (no image).

Pieces we make ourselves in code are licence `Owned`, which `content:check`
accepts for our own work:

- `node tools/content/prepare-packs.mjs` writes the Orbital Station and Neon
  Megacity props' sources to `assets-src/tiletrigger-stylepacks/` and the
  facade files to `public/packs` on every run.
- `node tools/content/build-kit-props.mjs` writes the Military Compound and
  Frontier Dust props (flat colours, a few hundred to 2,700 triangles each) to
  `assets-src/tiletrigger-kit/`.
- `node tools/content/build-style-props.mjs` writes the Gothic Estate, Jungle
  Ruins and Suburban Chaos props (56 pieces, flat colours, modelled with
  `tools/content/pieces.mjs`) to `assets-src/tiletrigger-styleprops/`.
- `node tools/content/prepare-ancient.mjs` writes the Imperial Arena and Sands
  of Egypt props (flat colours, built with `pieces.mjs`) to
  `assets-src/tiletrigger-ancient/`.

`prepare-props.mjs` then builds them like any in-repo pack. The 05, 06 and 08
facades are boxes drawn with the level (`map/geometry.ts`), so they need no
files; their new ambientCG sets come from `prepare-textures.mjs --only`.

Kit props (`content/props.json` entries of a pack with a `download` folder)
take extra fields: `src` may list several pieces merged in kit space (a wall
and its top), `yaw` turns the piece so it faces +Z, `scale` replaces `height`
(the kit is already metric), `lift` raises flat pieces off the floor,
`simplify` decimates heavy pieces, and `collide` adds `stairs` (walkable
steps toward +Z, at most 0.25 m each), `frame` (a doorway open in the middle)
and `shell` (boxes following the footprint, for corners and curved railings),
written as `boxes` in the prop definition.

Packs with `convert: true` (FBX-only packs and one-scene sets) are read with
`tools/content/fbx.mjs` (three.js' FBXLoader, world transforms baked in) or as
GLB; `src` is a file, or `file#<regex>` to keep only the scene objects whose
name (or a parent's) matches. The pack's `scale` (or the prop's) takes the
model to metres, `yaw` turns it to face +Z, `simplify` decimates it (normals
are dropped first and each face gets its own again), and `flatten` packs lose
their textures for one colour per face. `maps` attaches colour maps a download leaves
unlinked (by material name), `textureSize` keeps them as JPEGs of that size, and
`dropVertexColors` drops painting masks exported as vertex colours. Vertices are quantized.

Packs with `nature: true` (the Meshy community trees, plants and rocks) are
dense scanned-style meshes with a fragmented UV atlas, which neither the
triangles nor the texture survive a normal decimation. `tools/content/nature.mjs`
welds them by position alone, rebuilds clouds of separate leaves on a voxel grid
(`remesh` cells, `shell` for open leaves; meshoptimizer's remesher), simplifies
each level of detail to its triangle count, and paints every face with the
area-weighted colour of the original faces nearest it (one colour per face, as
8-bit vertex colours: no image ships). A prop's `nature` field lists its levels
(`lods`: `[triangles, distance]`, LOD0 first) and, for trees, an `impostor`
distance: a 128 × 256 picture of the model, rendered at build time by the small
software rasteriser in `tools/content/raster.mjs`, on a card that turns about
its upright axis to face the camera. The extra levels are glTF nodes whose
`extras` carry `{ lod, distance, billboard }`; `ModelLibrary` takes them out of
the loaded container (everything that copies a model sees LOD0 only) and gives
the instanced copy of a placed prop Babylon LOD levels, so every copy picks its
own level by distance. The lock file counts LOD0 against the prop budget and
lists the other levels as `lodTriangles`. Terrain plants use a model's lightest
mesh level.

### Starting budgets (to be tuned by profiling)

| Asset | LOD0 triangles | Textures | Other |
|---|---|---|---|
| Character | ≤ 15k | 1 × 2048² atlas (base, ORM, normal) | Shared humanoid skeleton, ≤ 60 bones, 3 LODs + impostor |
| Weapon viewmodel | ≤ 8k | 1024² | Sockets: muzzle, hand_r, hand_l |
| Weapon world model | ≤ 2k | shares the viewmodel atlas | |
| Tile kit piece | ≤ 3k per piece | Theme trim sheet / atlas | Must sit inside the tile's cell bounds; doorways keep 3 × 3 m clearance |
| Prop | ≤ 2k | Theme atlas | Collision proxy declared in data |
| Audio SFX | — | — | 48 kHz, mono, loudness-normalised, ≤ 2 s typical |

## 4. Per content type

### Characters (CHARACTERS_BOTS_V2 §30, condensed)

1. **Concept:** DNA sheet (era, archetype, species, body family, personality, twist, motif), then a batch of silhouette thumbnails.
2. **Originality gate 1:** checklist §2.2. No prompts or briefs that name existing franchise characters.
3. **Model (by hand):** modular parts on the **shared skeleton** for the body family (spec published as `docs/RIG_STANDARD.md` before M5).
4. **Rig check:** automated bone names/hierarchy/rest pose plus deformation test poses.
5. **Materials and LODs** via the build step.
6. **Data:** `characters/<id>.json` (default bot profile, voice set, animation attitude, tags).
7. **Readability:** the roster-wall tool (silhouette and lit views, equal size) and in-arena distance checks.
8. **Originality gate 2 and approval:** recorded in the entry's `review` field.

### Environment kits and tiles

- Gameplay shape stays in tile data, as today. An art kit supplies meshes per tile *part* (floor, wall, doorway frame, stairs, columns) per theme, snapped to the same grid and ports.
- The kit viewer shows every tile in the theme next to its collision boxes. `content:check` verifies each art piece sits inside its tile's cell and doesn't block a doorway.
- New tiles are added as data first (graybox is playable immediately), with art following.

### Weapons and items

- Data definition (damage, fire rate, bot desirability) plus viewmodel, world model, muzzle/impact effects and audio set, all referenced by ID.
- Balance changes are data-only and need no art rebuild.

### Audio

- Original recordings, foley and synthesis by the team.
- If a conventional (human-recorded) sound library is ever used, it must be **CC0 or a commercial licence**. No CC-BY-NC, no "personal use". CC-BY is allowed only with an attribution entry, and every file's licence and source go into provenance.
- Loudness normalisation and trimming run in the build step.
- Current state: [`AUDIO.md`](AUDIO.md). Kenney CC0 packs plus an in-house weapon synthesiser, listed in `content/sounds.json`.

### Official maps

- Built in MapMaker, saved to `maps/`, validated in CI (`validate-map`), and bot-tested with the headless bench (no stuck bots, every spawn reachable).
- **Map thumbnails.** Every map has two thumbnails, always shown as separate boxes, never composited
  (`frontend/mapThumbs.ts`):
  - **Picture:** an in-game look at the map. Shipped maps (not retired ones) ship an automatic one,
    `packages/client/public/maps/shots/<id>.jpg` (640×360 JPEG, at most 60 KB, checked by `content:check`).
    Regenerate after changing a map: `pnpm build`, serve it
    (`pnpm --filter @tiletrigger/client exec vite preview --port 4799`), then
    `node tools/content/capture-map-shots.mjs http://localhost:4799 [map ids…]`
    (`SHOT_CANDIDATES=<dir>` also keeps every rendered candidate for review). The tool picks the camera
    itself: eye points across the play area (a grid at two heights, plus spawns, pickups and objectives),
    raised above the floor, kept under ceilings and out of geometry, 16 directions each, scored by
    raycasting the map's collision world (seeing far, many distinct structures, looking across the play
    area; anything solid within a few metres ahead, close walls, lots of sky or void lose). The best three
    distinct views are rendered and judged again on the image (detail and contrast; big flat areas such as
    a wall, blank sky or one material lose). Look at the pictures afterwards. Where the choice is poor, fix
    the camera in the map script, `m.thumbnailCamera(position, target)` (stored as
    `metadata.thumbnailCamera`), and the tool uses it as is.
  - **Plan:** the flat top-down MapMaker schematic, drawn live from the map (`frontend/mapPlan.ts`): tile
    floors, walls, blocks and props as outlines, terrain as height contours, and dots for spawns (team
    colours), pickups, flags, hills, bomb sites, hostages, NPC squads and vehicles.
  - **Maker pictures:** MapMaker → Map properties → **Set thumbnail** frames the editor camera's view (a
    16:9 guide over the viewport) and captures it in-engine as a 384×216 JPEG stored in the map
    (`metadata.thumbnail` with the camera in `metadata.thumbnailCamera`, format v22, capped at 48,000
    data-URL characters so it rides along in saves, exports and every map transfer). It replaces the
    automatic picture; **Clear** goes back to it. There is no way to pick an image file: players can't
    upload assets.

### Palette pictures (MapMaker)

MapMaker's palette shows a picture of every shipped tile, prop and vehicle/turret (about 1,350
pieces) without rendering 3D thumbnails in the browser: they are pre-rendered into sprite sheets.

- `packages/client/public/thumbs/<group>.<hash>.webp`: one atlas per palette group
  (`editor/paletteCatalog.ts`: tiles, vehicles, nature and the seven prop themes), 80 px cells
  (rendered at 160 px and shrunk), 16 to a row, transparent background, WebP.
- `packages/client/public/thumbs/palette.json`: piece key (`tile:core.room`, `prop:prop.barrel`,
  `mount:tank`) → atlas, cell, a hash of what the picture was made from (the tile's definition or the
  model file) and the content pack a prop comes from (for search).
- MapMaker loads an atlas the first time one of its pieces is shown and draws the cells as CSS
  sprites (`editor/paletteAtlas.ts`); a piece missing from the atlas is rendered at runtime by
  `ModelThumbnails`, as before.
- `content:check` fails when a shipped piece has no picture, its hash no longer matches (the model
  or tile changed), a piece in the atlas isn't shipped, an atlas has the wrong size or isn't a
  WebP, an atlas is over 400 KB or all of them over 3 MB, or another file sits in `thumbs/`.

After adding or changing tiles, props or vehicles, rebuild them with the game's own renderer: `pnpm
build`, serve it (`pnpm --filter @tiletrigger/client exec vite preview --port 4799`), then
`node tools/content/build-palette-atlas.mjs http://localhost:4799` (`--all` re-renders everything;
`ATLAS_JOBS=2` uses two pages). Pieces whose hash is unchanged keep their cells, and groups with no
change keep their file. The tool and the check list the pieces with
`tools/content/palette-items.ts` (run by Node with `--experimental-transform-types`).

## 5. In-house tools to build

These are tools for the team's artists and designers. The player-facing creation tools are MapMaker itself (PHASE1.md).

| Tool | Purpose | When |
|---|---|---|
| ContentRegistry + pack loader | Single source of content truth for client/server/editor | With M2 (weapons as data) |
| `content:build` / `content:check` | Optimise, budget-check, provenance-check in CI | M2 |
| Asset viewer (dev page in the client) | Inspect any asset: LODs, wireframe, sockets, budgets | M2 |
| `RIG_STANDARD.md` + Blender export preset | One skeleton per body family; one-click compliant export | Before M5 |
| Character viewer + roster wall | Animation playback, silhouette mode, side-by-side readability | M5 |
| Kit viewer | Theme art over tile collision; port/doorway clearance overlay | First art theme |
| `ASSET_SOURCES.md` (built by script) | Licence/attribution ledger built from provenance fields | M2, CI-maintained |

## 6. Roles and review

- **Content owner** per pack approves additions.
- **Originality reviewer** signs both character gates (a second person, not the author).
- **Readability review** at each roster-wall milestone (CHARACTERS_BOTS_V2 §31).
- CI is the performance and compliance gatekeeper. Humans handle taste, readability and originality.
