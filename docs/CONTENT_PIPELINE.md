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
    weapons/*.json          # WeaponDefinition data (today: content/weapons/*.json, see "How to add a weapon")
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
| Meshy character downloads from the owner's Drive (Meshy Community CC0 unless the owner says they made them, owner 2026-11-06; licence per manifest, `source.license`): the rigged GLBs as `<id>.glb` or matched by `source.file`, and the textured FBX folders (`Meshy_AI_<name>_…_texture_fbx`, unrigged: goblin, wealthy otter, salamander warlord) anywhere inside | `node tools/content/prepare-meshy-characters.mjs <dir>` (characters whose download is not there are kept as built; `ONLY=meshy_goblin,…` rebuilds just those; skin weights from `autoskin.mjs`) | `public/characters/meshy_*.glb`, `content/meshy.lock.json` |
| Meshy community T-pose characters (CC0 per owner; the unzipped `Meshy_AI_Elder_T_POSE_…`, `Meshy_AI_T_Pose_{Alien,Cat,Pilot,Pirate,Titan}_…_texture_fbx` folders) anywhere inside the same dir | `ONLY=meshy_elder,meshy_alien,meshy_cat,meshy_pilot,meshy_pirate,meshy_titan node tools/content/prepare-meshy-characters.mjs <dir>` | `public/characters/meshy_{elder,alien,cat,pilot,pirate,titan}.glb`, `content/meshy.lock.json` (with the model name and download date) |
| Meshy rock pile (`Meshy_AI_Rock_Pile_…_texture_remesh_tri_fbx`, Meshy Community CC0 per the owner: pack `meshy-community-rock-pile`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `rock_pile` prop (colour map attached by material name, 1024 px JPEG, `dropEmissive`) |
| Meshy community weapons and props (CC0 per owner; the unzipped `Meshy_AI_ANACONDA_44_…`, `Meshy_AI_Plasma_Annihilator_X_…`, `Meshy_AI_Nebula_Arc_Cannon_…`, `Meshy_AI_Industrial_Control_Panel_…`, `Meshy_AI_Wreckage_…` and `Meshy_AI_Spiky_Dinosaur_…_texture_fbx` folders, each named in its entry's `download`) | `node tools/content/prepare-guns.mjs --downloads <dir>` and `node tools/content/prepare-props.mjs --downloads <dir>` | `public/models/guns/{ironclad_revolver,plasma_spin_gun,arc_cannon_turret}.glb`, `content/guns.lock.json`; the `mp_*` props, `content/props.lock.json` (both through `tools/content/meshy-mesh.mjs`, below) |
| Meshy community nature models (Meshy community, CC0 per owner; each `Meshy_AI_<name>_…_texture_fbx` zip unzipped into a folder named `meshy-community-nature`) | `node tools/content/prepare-props.mjs --downloads <dir>` | the `mn_*` Nature props, built by `tools/content/nature.mjs` (below) |
| Meshy weapon, turret, medkit and vehicle downloads from the owner's Drive (textured GLBs `Meshy_AI_<name>_<id>_texture.glb`, named in each entry's `glb`; the download folders may sit side by side, or be linked, one level down) | `node tools/content/prepare-guns.mjs --downloads <dir>` (`ONLY=guns/<file>.glb` for one) | `public/models/guns/*.glb` and `public/models/vehicles/*.glb` of pack `meshy-community-arsenal` (Meshy Community CC0, the buggy and its tire too; an entry's `url` names its post, or the share link the owner gave, when known), `content/guns.lock.json` (then `capture-weapon-icons.mjs` and, for turrets, `build-palette-atlas.mjs`) |
| Meshy community pickup and prop downloads of 2026-11-03 (CC0 per owner; `medical_supply.glb`, `ammo_rifle.glb`, `ww2_ammo_crate.glb` in the folder `drive-2026-11-03-pickups`) | `ONLY=pickups/health_large.glb,pickups/ammo_rifle.glb node tools/content/prepare-guns.mjs --downloads <dir>/drive-2026-11-03-pickups`; `ONLY=ww2_ammo_crate node tools/content/prepare-props.mjs --downloads <dir>` (then `build-palette-atlas.mjs`) | `public/models/pickups/{health_large,ammo_rifle}.glb` (pack `meshy-community-pickups`, drawn by `game/pickupVisuals.ts`; pickup models sit in guns.json like the medkit and keep to the small-prop budget, as a map carries many) and `props/ww2_ammo_crate.glb` (pack `meshy-community-drive-1103`) |
| The owner's Meshy landmark uploads of 2026-10-31 (Meshy Community CC0 per the owner's rule of 2026-11-06; textured GLBs, named in each entry's `src`; the monk statue is the `_stylize.glb` from its zip), all in one folder named `owned_landmarks` | `node tools/content/prepare-props.mjs --downloads <dir>` (`ONLY=<id>,…` for some) | pack `meshy-community-landmarks`: market stalls (`dc_market_stall`, `mv_market_stall`, `rustic_market_stall`), the wishing well (`dc_well` and `mv_well`, one download), the crawler crane `dc_crane`, statues (`jt_statue_large`, `temple_fire_statue`, `temple_spear_statue`, `temple_monk_statue`) and fountains (`town_fountain`, `lion_head_fountain`, `eagle_fountain`); all hero tier |
| The Meshy airliner of 2026-11-04 (Meshy Community CC0 per the owner, 2026-11-06; the refined GLB in a folder `airliner-2026-11-04/refined/airliner.glb`; preview task 01a1a451-1dda-77ed-82ec-810c24ac1e9a, refine 01a1a451-ee8d-72d3-99ea-48063cd52abe) | `node tools/content/fuselage-profile.mjs <dir>` (its cross-section for the cabin kit, `assets-src/tiletrigger-cabin/fuselage.json`, and its collision and openings, written into its pack file), then `ONLY=airliner_shell node tools/content/prepare-props.mjs --downloads <dir>` | `props/airliner_shell.glb` (pack `meshy-community-airliner`, hero tier: 19.7k triangles, a 6.1k one from 120 m, 1.38 MB) |
| "Snowmobile" by roygbpjyt (Meshy Community, CC0: Meshy Terms of Use §3.3 "Community License"; the textured GLB `snowmobile.glb` in a folder `snowmobile-cc0-2026-11-04`) | `ONLY=vehicles/snowmobile.glb node tools/content/prepare-guns.mjs --downloads <dir>` | `public/models/vehicles/snowmobile.glb` (pack `meshy-community-snowmobile`, vehicle tier: 20k triangles plus a 5k one from 40 m, 2048 px colour and 1024 px normal map, 1.42 MB), the Snow Sled's model |
| The amphibious landing craft of 2026-11-06 (Meshy community, CC0 per owner; the textured GLB `Meshy_AI_Amphibious_Landing_Cr_1106110500_texture.glb` in a folder `intake-2026-11-06`) | `ONLY=lcvp_beached node tools/content/prepare-props.mjs --downloads <dir>` (then `build-palette-atlas.mjs`) | `props/lcvp_beached.glb` (pack `meshy-community-drive-1106`, hero tier: 16k triangles, a 4k one from 40 m, a baked normal map, 1.0 MB; collides as voxels), the Landing Craft (Beached): static dressing and cover, in the Beached Landing Craft set piece |
| Styloo Guns Asset Pack (`Styloo Guns Asset Pack GLTF FBX V1.1`), CC0 Guns & Explosives Pack (the rar's `Guns&Explosives` folder; unpack it with `unar`: three of its files don't unpack, none used) | `node tools/content/prepare-guns.mjs --downloads <dir>` | `public/models/guns`, `content/guns.lock.json` (see `content/guns.json`) |
| The weapons and grenades of 2026-11-06 (Meshy Community CC0: the 11 `Meshy_AI_<name>_1106…_texture.glb` in a folder `intake-2026-11-06c`) and the Guns & Explosives pack's guns and grenades, side by side in one downloads dir | `ONLY=guns/<out>.glb,… node tools/content/prepare-guns.mjs --downloads <dir>` (a `held` gun writes three files: everyone's, `.medium.glb` and `.high.glb`) | pack `meshy-community-drive-1106c` and `3dmodelscc0-guns-explosives` entries in `content/guns.json`; ARSENAL.md, "Weapons intake of 2026-11-06" |

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
their `content/props/<pack>.json` (the MegaKit, and the Orbital and Neon Kenney kits) get
their materials baked and shrunk; the other GLB kits are normalised as they
are. Never copy the raw downloads into the repo. (Older Train Kit props whose
source GLB is in `assets-src/kenney-train-kit/` keep building from there.)

**Meshy downloads** (`tools/content/meshy-mesh.mjs`, `meshy: true` packs in
`content/guns.json` and `content/props/<pack>.json`). Meshy's textured FBX is one
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
Props take `paintOut` too (the guns' colour rules); a rule with `within` (boxes in
the built prop's frame) only touches the texels of the download's triangles
inside them (the airliner's nacelle lettering, not its windows of the same
grey), and the download's normal map goes flat under everything painted out,
or its relief would draw the marking again. A GLB download's metal/roughness map is dropped (the built
material is matte); `metalDarken: k` (prepare-guns.mjs) first folds its bare metal into the colour map, darkened
toward `k` (the snowmobile's ski struts and springs: grey in the colour map, dark steel only through the metal
channel), and `roughness` sets the built material's (default 0.85; the snowmobile's 0.5 keeps its glossy paint's
sheen). `bakeSize` sets the rebake's map
(px, default 1024) before `textureSize` shrinks it.

**Openings and box collision (any prop).** `cut` lists boxes
`[x0, y0, z0, x1, y1, z1]` in the prop's frame as the game draws it (x
mirrored like the collision boxes) where the built model is cut away, every
level of detail included; triangles crossing a box are clipped to its faces,
so the opening has straight edges (the airliner's doors). `collide: "boxes"`
takes the collision from the prop's own `boxes` (same frame); `collide:
"model"` from the `collision` boxes a code-built GLB carries in its first
node's extras (the cabin kit), normalised with the model. `scale` instead of
`height` keeps a code-built piece at exactly its modelled size.

**Normal maps (shape kept past the cut).** The cut mesh alone shades as flat,
lumpy facets: the download's 10k–1.8M triangles become a few thousand. So
`bakeNormals` (meshy-mesh.mjs) bakes a tangent-space normal map onto the cut
mesh's texture coordinates: each texel casts along the cut surface's normal to
the full download (as the colour rebake does), takes the download's
interpolated normal there, bent by Meshy's own normal map, and writes it in the
cut mesh's tangent space; the GLB carries the TANGENT attribute it was baked
against (`vertexTangents`) and the map as the material's `normalTexture`
(JPEG, 4:4:4, half the colour map's size; 512 px for weapons). The green
channel's sign was settled by rendering in Babylon against the download with
the colour map off (`GREEN` in meshy-mesh.mjs). Meshy characters get the same,
in their own texture layout (`prepare-meshy-characters.mjs`, 512 px). Vertices
are quantized with 8-bit normals and tangents (`MESHY_QUANTIZE`).
`ONLY=<id>,… node tools/content/prepare-props.mjs --downloads <dir>` rebuilds
just those props.

**The weapons intake's options** (`prepare-guns.mjs`, 2026-11-07): `maps`/`materials` put the Guns & Explosives pack's
own PBR maps on its FBX (colour, normal with a DirectX map's green flipped, metal and roughness packed for glTF;
`color` for a material with none); `move` shifts an object in the download's units (a magazine laid out for show, put
back); `noseDown` levels a model posed tilted (the pack's sniper); `height` scales an upright throwable by its height;
`pbr` keeps the source's metal and roughness (a Meshy GLB's metal/roughness map painted into the rebaked charts from
the same rays: `rebake`'s `also`) instead of a matte finish; `held` writes the weapon's copy for everyone plus Medium
and High copies for your own hands (colour 1024/2048, normal 512/1024, metal/roughness 256/512; budget tier `held`).
The pack's models are joined into one mesh and given their `lod`. ARSENAL.md, "Texture tiers", has the numbers.

**Budget tiers.** `budgets` in `content/props.json` (shared by every prop pack) and `content/guns.json` are
the default caps (props 6,000 triangles / 400 KB; guns 8,000 / 512 KB);
`budgets.tiers.hero` (20,000 triangles, 1.6 MB, and a lower level of detail
required above 8,000) applies to entries marked `"budget": "hero"`: big landmark
props (excavator, haul truck, historic building, gantry crane, the shipping
containers; 1024 px colour map) and the first-person weapons, turrets and the
buggy. `content:check` reads the tier from the lock file entry. A hero entry
carries `lod: [share of triangles, metres]` (props default `[0.25, 40]`, guns
`[0.2, 12]`): a node with `extras.lod` that `ModelLibrary` turns into a Babylon
LOD level for placed props (merged instances) and for instanced copies (a
crowd's held guns, pickups); the first-person gun, a plain copy, always draws
full detail.

**Cockpit interiors.** A Meshy entry in `content/guns.json` may carry
`interior: { out, label, box, triangles, maxError, textureSize, normalSize,
budget }`: `prepare-guns.mjs` builds the body, then a second GLB from the same
download cropped to `box` (`[[x, y, z], [x, y, z]]` in the built model's frame,
metres, +Z forward, Y centred on the model's bounds; the source triangles whose
centre is inside), cut to its own `triangles` with its own colour and normal
maps, and placed with exactly the body's yaw, scale and centring, so the two
line up. The GLB's root node carries `extras.cockpit.box`. Both are rebuilt
together (`ONLY=` naming either). Budget tier `cockpit` (36,000 triangles,
5 MB). No model uses it now: the buggy's cropped interior (31.9k triangles,
3.6 MB) was replaced by a cockpit built in-house from data (docs/VEHICLES.md,
"In-house cockpits"), and the game no longer reads the box.

Pieces we make ourselves in code are licence `Owned`, which `content:check`
accepts for our own work:

- `node tools/content/prepare-packs.mjs` writes the Orbital Station and Neon
  Megacity props' sources to `assets-src/tiletrigger-stylepacks/` and the
  facade files to `public/packs` on every run.
- `node tools/content/build-kit-props.mjs` writes the Military Compound and
  Frontier Dust props (flat colours, a few hundred to 2,700 triangles each) to
  `assets-src/tiletrigger-kit/`. A piece with real surfaces
  (`content/surfaces/tiletrigger-kit.json` `props`: the beach-landing pieces) is
  one material per surface, its colours painted as vertex colours on it, so each
  copy on a map is one GPU instance and one draw per surface, not per colour.
- `node tools/content/build-style-props.mjs` writes the Gothic Estate, Jungle
  Ruins and Suburban Chaos props (56 pieces, flat colours, modelled with
  `tools/content/pieces.mjs`) to `assets-src/tiletrigger-styleprops/`.
- `node tools/content/prepare-ancient.mjs` writes the Imperial Arena and Sands
  of Egypt props (flat colours, built with `pieces.mjs`) to
  `assets-src/tiletrigger-ancient/`.
- `node tools/content/prepare-cabin.mjs` writes the airliner cabin kit
  (fuselage sections lofted from the shell's measured rings in
  `assets-src/tiletrigger-cabin/fuselage.json`, seats, bins, galley,
  lavatory, divider, boarding stairs; flat colours, each with its collision
  boxes) to `assets-src/tiletrigger-cabin/`, and `assembly.json` there (where
  each section sits in the shell). docs/BUILDING_KIT.md, "Airliner".

`prepare-props.mjs` then builds them like any in-repo pack. The 05, 06 and 08
facades are boxes drawn with the level (`map/geometry.ts`), so they need no
files; their new ambientCG sets come from `prepare-textures.mjs --only`.

Kit props (`content/props/<pack>.json` entries of a pack with a `download` folder)
take extra fields: `src` may list several pieces merged in kit space (a wall
and its top), `yaw` turns the piece so it faces +Z, `scale` replaces `height`
(the kit is already metric), `lift` raises flat pieces off the floor,
`simplify` decimates heavy pieces, and `collide` adds `stairs` (walkable
steps toward +Z, at most 0.25 m each), `frame` (a doorway open in the middle),
`shell` (boxes following the footprint, for corners and stair corners;
`shellTop` leaves out what is higher than that many metres, so a crane's boom
passes overhead) and `voxel` (boxes following the model in 3D, for anything
with an opening), written as `boxes` in the prop definition ("Prop collision" below).

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
- New tiles are added as data first (graybox is playable immediately), with art following: the core kit is in
  `content/tiles/` ("Tiles and edge styles" below).

### Weapons and items

- Data definition (damage, fire rate, bot desirability) plus viewmodel, world model, muzzle/impact effects and audio set, all referenced by ID.
- Balance changes are data-only and need no art rebuild.

#### How to add a weapon

Weapons, throwables, classes and class abilities are data (docs/CONTENT_SCALABILITY.md, "Weapons as data"); the
behaviour (projectile kinds, alt fire, status effects, the ability handlers, `gunplayOf`) stays in code. Read
`docs/GUNPLAY_SPEC.md` and `docs/GUNPLAY_DIRECTION.md` first: a new weapon has to be clearly different from the ones
there are.

| File | Holds |
|---|---|
| `content/weapons/families.json` | `defaults` (what every weapon file starts from) and the ten gunplay `families` (velocity, spread, recoil, falloff, head and leg multipliers) |
| `content/weapons/<name>.json` | one weapon: id `core.<name>`, its network `code`, and only the values that differ from `defaults` |
| `content/throwables.json`, `content/classes.json`, `content/abilities.json` | thrown equipment, classes (loadout, health, speed, ability) and each ability's numbers |
| `content/codes.lock.json` | every network code ever given (written by the generator; never edit by hand) |

1. **Copy the closest weapon** to `content/weapons/<name>.json` and set `id` to `core.<name>`.
2. **Give it a new `code`:** the highest code in `content/codes.lock.json` plus one. Codes go on the wire and into
   inventories: never change one, never reuse one, also after a weapon is removed (the lock keeps it).
3. **Name and place it:** `displayName`, `category` (what random weapon pickups roll it as; leave it out for tools,
   mode-only and mounted weapons), `slot` (1 melee and tools, 2 sidearms, 3 rifles, 4 shotguns, 5 precision,
   6 lobbers, 7 automatics, 8 heavy, 9 energy and chemical; 0 mounted guns, never carried).
4. **Pick a `family`** for a conventional gun: it brings ballistic bullets, the spread model, the recoil pattern,
   falloff and the head and leg multipliers. Override only what differs: `accuracy` and `kick` merge field by field
   with the family's, `ballistic` too (`null`: hitscan), while `falloff` and `reload` replace it whole (write all of
   their fields). Exotic weapons (beams, heat, projectiles) can go without a family.
5. **Numbers:** time is in ticks (60 a second: `fireIntervalTicks` 6 is 600 RPM, `reloadTicks` 90 is 1.5 s).
   Damage is per pellet. `projectile` for anything that flies (its fields are in `ProjectileSpec`, sim/weapons.ts),
   `heat` for a weapon without ammunition, `alt` for a second trigger.
6. **Presentation:** `view.model` and `view.fallback` must exist under `packages/client/public/models` (or be a
   `procedural/` model), `view.sound` in `content/sounds.json` (default `fire.<name>`). Holds (`view.hold`) are set
   with the grip tool, not by hand or in the Workbench.
7. **Notes:** put the design intent in `notes` (`design`, `model`, or the field it explains), not in code comments.
8. **Generate and check:** `pnpm content:weapons` (`node tools/content/weapons.mjs`) checks the schema (an unknown
   field is an error), the references (ammo types, models, sounds, slots 0-9, codes; classes naming real weapons,
   throwables and abilities) and writes `packages/shared/src/content/weapons.generated.ts`,
   `weaponFamilies.generated.ts` (the families, which load with a match, not the menu) and the lock. `--check`
   only verifies that both are up to date (the unit test `tools/content/test/weapons.test.mjs` does the same).
9. **Test:** `pnpm typecheck`, `pnpm test:changed` and the `arsenal` e2e flow; a weapon that changes an existing
   one's numbers also changes `packages/shared/test/fixtures/weapons-resolved.json` (rewrite it with
   `UPDATE_WEAPON_FIXTURE=1 pnpm vitest run packages/shared/test/weaponsData.test.ts` and read the diff: only the
   weapon you meant to change may move). A new weapon is added to the fixture the same way.
10. **Pictures:** its icon comes from the "Capture portraits" workflow (`tools/content/capture-weapon-icons.mjs`).

A throwable or class is added the same way in its file, with the next code: their codes run 0, 1, 2... without
gaps (clients read them by position). A class ability is code first (`sim/classes.ts`), then its numbers go in
`content/abilities.json`.

The Workbench (`.control-center/workbench.json`) shows weapons, weapon families, classes, class abilities and
throwables from these files; id, code, kind and holds are read-only there.

### Vehicles, turrets and NPC roles

Mounts (vehicles, turrets, sentries) and NPC roles are data too (docs/CONTENT_SCALABILITY.md step 4): the numbers are
in JSON, the behaviour in code (driving, suspension, flying, sentry aim and the arc lock in the match; the brain;
`NPC_PROFILE`, the NPC skins and their colours in `sim/npc.ts`; `NPC_KEPT_LOOKS` in `content/looks.ts`).

| File | Holds |
|---|---|
| `content/vehicles/<id>.json` | one mount: `kind` (`turret`, `sentry`, `vehicle`), `order` (MapMaker palette order), model, health, collision box, seats (role, label, place, mounted `weapon`, aim `arc`), get-in reach, respawn, blast, `armour` and `bailHealth`, the `vehicle` handling (speeds, grip, mass, hover, fly, suspension, `pivot`, `idleBrake`, `routeFit`) or the `sentry` block, drawing numbers (`rideHeight`, `wheels`, `cockpitEye`, `glow`), `blurb` and `notes` |
| `content/npcs.json` | every NPC role: its network `code`, health, weapon, speed, size (`scale`), `damage` multiple, `creature` / `melee`, the character `look` it is drawn as, and `bot` (what its bot profile changes from `NPC_PROFILE`) |

#### How to add a vehicle or turret

1. **Copy the closest mount** to `content/vehicles/<id>.json` (`id` = the file name, lower case and `_`). Maps name
   a mount by id: never rename one. Mounts have no network code (a mount travels as its map entity index).
2. **Give it an `order`:** where it goes in MapMaker's palette and inspector (unique; renumber freely, maps don't
   store it). The two route crafts (`airplane: true`: `airplane`, `dropship_drop`) have none and can't be placed.
3. **Kind and seats:** a `turret` has gunner seats only, each with a mounted `weapon`; a `sentry` has no seats,
   `enterRadius` 0 and a `sentry` block; a `vehicle` has a `vehicle` block and exactly one `driver`. Gunners need a
   `weapon` (a slot-0 weapon from content/weapons: add a new mounted gun there first); a driver may have one (fires
   ahead within `arc`); passengers never do (they shoot their own). `arc` is radians either side of the seat's
   `facing` (leave it out for all round). Seat `offset` is the feet, or the cushion with `seated: true`; a seated
   rider's `legDrop` is the floor under the cushion and `straddle` (radians) turns the thighs out either side of a
   saddle (the snowmobile).
4. **Model:** `model` (and `wheels.model`) must exist under `packages/client/public/models` (content/models.json or
   guns.json builds it). The palette picture comes from `pnpm content:rebuild`. `fallback` names the model drawn if
   `model` fails to load (the one it replaced: the Tank's Quaternius model). A guns.json `lod` level is drawn on
   vehicles too, per part (ModelLibrary.attachLods).
   **A gun that turns on a vehicle** (the Tank): build the model in parts (guns.json `parts`, prepare-guns.mjs
   `splitParts`: boxes in the built frame cut it into `hull`, `turret` and `barrel` on pivot nodes, with a `cap` disc
   closing the deck under a turning turret), and give the mount `turret: { seat, pitch }`: that seat's aim turns the
   turret within its `arc` and pitches the barrel within `pitch` (drawing only; shots leave from the gunner's eye as on
   every mounted weapon). Measure the boxes and pivots on a first build without `parts`.
   **Tanks and armour** (owner, 2026-11-07; the Tank is the example):
   - `armour`: `surface` (a surface type from content/surface-types.json: its ballistic class decides what rounds do
     to the hull, `armor` stops them all, its impact the sparks and sound; empty: metal), the share of each kind of
     damage it takes, `bullets` (every hitscan and ballistic round), `blasts` (splash and a projectile's direct hit:
     rockets, grenades, shells) and `melee` (each default 1; crashes, falls and hazards always take full damage), and
     `sealed`: nobody aboard can be shot, blasted or struck from outside, and everyone still inside dies with it when it
     is destroyed (credited to whoever destroyed it). The Tank: `armor`, bullets 0.1, blasts 1.25, melee 0, sealed.
   - A seat's `ammo` (`max`, optional `start`, `refillSeconds`, `pickups`): limited rounds for its mounted gun, one
     back every `refillSeconds` (0: none over time) and all of them when the vehicle, crewed, drives over one of the
     ammo pickups `pickups` names (ids from content/pickups.json, ammo pickups only; absent: none refills it) while it is
     up (it takes it; any other pickup is left lying). The HUD counts them (`PrivateState.mo[3]`). The Tank's cannon:
     10, one every 15 s, `pickups: ["core.ammo"]` (the general Ammo Box only, owner 2026-11-08: Light, Rifle, Shells,
     Sniper rounds and the rest no longer refill it).
   - A gunner seat's `driverFires`: while it is empty the driver fires its gun, the shot kept within its arc (and a
     turret seat's aim turns the model's turret). At most one per vehicle; the driver must have no gun of their own. The
     Tank's cannon has it (kept by the owner, 2026-11-08: a crew of one can fight).
   - Weapons that hurt vehicles more say so in their own data (content/weapons/<name>.json): `vehicleDamage`
     multiplies what the weapon's rounds, direct hits and blasts do to a vehicle (kind `vehicle`; players, turrets and
     sentries take the usual), before the vehicle's `armour` share; above 1 it also marks the weapon as one bots fetch
     and draw against vehicles (as a splash of 50 or more does: grenade launchers). The rockets (owner, 2026-11-08):
     `core.rockets`, `core.guided`, `core.swarm`, `core.blast_rockets` and `core.mount_rockets` are 2. Against the Tank
     (blasts 1.25): a Rocket Launcher hit on its side is 2 × (40 + 120) × 1.25 = 400, so 3 kill it (4 off its front or
     at an angle; 6 before), a Guided Rocket 412 (3), a Blast Rocket 288 (5), a full Swarm volley 500 (3); a grenade
     launcher's grenade stays 125 (10), a cannon shell 262 (5). Light vehicles go quicker too: a Rocket Launcher hit is
     320 to anything unarmoured (a buggy, 450, in 2; a kart, speeder or hover bike in 1).
   - `vehicle.pivot` (rad/s): tracks, turning on the spot, fading out by 5 m/s. The Tank: 0.8.
   - `vehicle.idleBrake` (m/s²): with nobody at the wheel it brakes to a stop at this rate, its slide too (default 10;
     not ambient track cars, which a track driver drives). From 12.7 m/s a Hauler (12) stops in about 7 m.
   - `vehicle.routeFit`: bot drivers take only routes clear this share of its half width either side
     (bots/vehicles.ts `vehicleRouteFits`; default 0.95, the probe's width; the Tank 0.8), and high enough for its hull
     (`half[1]` × 2) over the highest ground within half its length (a level hull up stairs); and its footprint (that
     width, its full length) swept along the route's heading every 0.75 m, swinging through both legs at a corner, must
     clear doorways and gaps (`hullFits`: a 1.3 m sled doesn't take a 1.6 m door it would have to turn in). Flyers have
     no check.
   - `bailHealth`: bots get out below this share of health (default 0.3; the Tank 0.25), or when it is on fire.
   Bots: drivers fight from a sealed vehicle (close to 28 m, hold and turn the hull onto the target), fire limited
   shells only at targets worth one (a vehicle, a turret or a sentry; someone on foot past 10 m while over 30 % of the
   load is left, or with another enemy beside them), drive to one of the pickups the seat's `ammo.pickups` names
   (the Ammo Box) within 120 m when out, and prefer a tank to another vehicle (15 m further, 20 m more detour).
   Against one (owner, 2026-11-08): an armoured vehicle (`armour.bullets` under 0.5, or sealed) with an enemy aboard
   within 60 m is remembered for 12 s; a bot carrying no weapon that hurts vehicles (frag grenades don't count against
   armour) goes up to 60 m for a launcher (30 m for other vehicles), values launcher pickups (and ammo for an empty
   launcher) 3 times more, draws a launcher it carries even before it has a target, and aims explosives at the middle of
   the hull (the crew can't be hit and the turret isn't solid). `pnpm bot-report` prints a `tanks` line for maps with
   one (with the launchers picked up).
5. **Generate and check:** `pnpm content:vehicles` (`node tools/content/vehicles.mjs`) checks the schema (an unknown
   field is an error), the weapons, the models, the seats by kind and the order, and writes
   `packages/shared/src/content/mounts.generated.ts`; `--check` only verifies it is up to date.
6. **Test:** `pnpm typecheck`, `pnpm test:changed` and the `vehicles` e2e flow. Changing a mount's numbers changes
   `packages/shared/test/fixtures/vehicles-resolved.json`: rewrite it with
   `UPDATE_VEHICLE_FIXTURE=1 pnpm vitest run packages/shared/test/vehiclesNpcsData.test.ts` and read the diff.
   To offer it in a Style Pack, add it to that pack's `mounts` (`editor/stylePacks.ts`).

#### How to add an NPC role

1. **Add it to `content/npcs.json`** with the next `code` (the highest in `content/codes.lock.json` `npcRoles` plus
   one): NPC snapshots carry it and clients read a role back by position, so codes run 0, 1, 2... with no gaps and a
   code is never changed or reused (the lock keeps it).
2. **Numbers:** `health`, `weapon` (a carried weapon, slot 1-9), `speed` (multiple of a player's), `scale` (drawn
   size), `damage` (multiple on its attacks, default 1), `melee` (charges into claw range).
3. **Looks:** a soldier role is drawn as a uniformed mannequin (its colour: `NPC_LOOK_COLORS` and `NPC_ARM_COLORS` in
   `sim/npc.ts`, code); `look` draws it as a character look from `content/characters` instead; `creature: true` needs
   its body in `sim/creatures.ts` `CREATURE_SPECS` first (code).
4. **Bot:** `bot.id` (`core.npc_<role>`), `displayName`, the 0-100 traits that differ from `NPC_PROFILE` and `tags`
   (ones the brain reads: docs/BOTS.md).
5. **Generate and check:** `pnpm content:npcs` (`node tools/content/npcs.mjs`) checks the schema, the weapon, the
   look, the creature body, the tags and the codes, and writes `packages/shared/src/content/npcRoles.generated.ts`
   (`NPC_ROLES` in code order, `CREATURE_ROLES`, the specs and bot changes) and the lock.
6. **Test:** `pnpm typecheck`, `pnpm test:changed` and the `zombies` and `outpost` e2e flows (NPC squads); rewrite
   `npc-roles-resolved.json` as above and read the diff. MapMaker's encounter roster offers every role in
   `NPC_ROLES` (client `editor/editorApp.ts`).

`pnpm content:rebuild` and `pnpm content:check` run all the data generators (weapons, vehicles, NPC roles, pickups, materials, tiles). The
Workbench shows **Vehicles & turrets** and **NPC roles** from these files; id, kind, order, code, creature and look are
read-only there, and a seat's place is edited in the JSON (the Workbench edits the first three seats' weapon and arc).

### Pickups

Pickup items and the pickup rules are data too (docs/CONTENT_SCALABILITY.md step 5): the names and numbers are in
`content/pickups.json`, what each effect does is code (`sim/match.ts` `applyItem`; random weapon pickups,
`sim/pickupRoll.ts`; how much bots want one, `bots/brain.ts` `pickupNeed`; the pickup models and MapMaker's icons and
groups in the client).

| File | Holds |
|---|---|
| `content/pickups.json` `pickups` | every pickup, in MapMaker's palette order: `id`, `displayName`, `effect` (its `kind` and numbers), `respawnSeconds` (the default; a placed pickup can override it), `botValue` (0-1, before the situation scales it), `notes` |
| `content/pickups.json` `rules` | `armor` (`max`, `absorb`: the share of incoming damage armour takes while any is left), `powerup` (`speedBoost`, `damageBoost` multiples), `pickup` (`radius`: how close you walk to take one) |

#### How to add a pickup

1. **Add it at the end of `pickups`** (the order is the palette order and the order a random weapon pickup rolls
   from, so inserting in the middle changes what a seeded match rolls). `id` is `core.<name>`; maps name a pickup by
   id, so never rename or remove one a map or Style Pack uses (the generator refuses). Pickups have **no network
   code**: pickup events and snapshots carry the id.
2. **Effect:** `health` / `armor` (`amount`), `ammo` (`ammo`: one ammo type, which fills those weapons by their
   `pickupAmmo`; leave it out for the general box, half a pickup to every weapon), `throwable` (`throwable` from
   content/throwables.json, `count` up to its `max`), `weapon` (`weapon`: a carried weapon, slot 1-9; the id must be
   `core.weapon_<name>`, since drops and the match look a weapon's pickup up by it), `powerup` (`powerup` `speed` or
   `damage`, `seconds`), `jetpack`, `glider`, `uav` (`seconds`), `disc` (`power`). A new kind of effect is code first
   (`ItemEffect` in `sim/items.ts`, `applyItem`, `pickupNeed`, the client's pickup model and MapMaker's group), then
   its case in the generator's schema.
3. **Names and bot value:** a weapon pickup takes its weapon's `displayName` and a disc power its label
   (`sim/discs.ts`) when `displayName` is left out; a weapon pickup without `botValue` gets
   0.55 + `respawnSeconds` / 120, at most 0.9 (power weapons respawn slower and are worth more). Every other pickup
   writes both.
4. **Generate and check:** `pnpm content:pickups` (`node tools/content/pickups.mjs`) checks the schema (an unknown
   field is an error), the weapons, ammo types, throwables, powerups and disc powers, the numbers (amounts, seconds
   and respawn above 0, bot value 0-1, throwable count within the carry limit), that every pickup `maps/*.json` and
   the Style Packs (`editor/stylePacks.ts` `pickups`) name exists, and writes
   `packages/shared/src/content/pickups.generated.ts` (`CORE_ITEMS`, `PICKUP_RULES`); `--check` only verifies it
   is up to date (`tools/content/test/pickups.test.mjs` does the same). A weapon renamed in content/weapons renames
   its pickup on the next run.
5. **Test:** `pnpm typecheck`, `pnpm test:changed` and the `arsenal` e2e flow. Changing a pickup's numbers or adding
   one changes `packages/shared/test/fixtures/pickups-resolved.json`: rewrite it with
   `UPDATE_PICKUP_FIXTURE=1 pnpm vitest run packages/shared/test/pickupsData.test.ts` and read the diff. To offer it
   in a Style Pack, add it to that pack's `pickups`.

`pnpm content:rebuild` and `pnpm content:check` run it with the other data generators. The Workbench shows
**Pickups** (name, respawn, bot value and the effect's numbers; id, kind, weapon and disc power read-only) and
**Pickup rules** from this file.

### Materials and themes

Library surface materials, themes and the tint swatches are data too (docs/CONTENT_SCALABILITY.md step 6): names,
colours and settings in `content/materials.json`; drawing is code (the pattern painters,
`packages/client/src/materials/patterns.ts`; the Babylon materials, `client/mapMeshes.ts`). What a material is made of
for bullets and how hits on it look is its optional `surface` (a surface type, next section; `ballistic` overrides the
class alone); unset, both are guessed from the id and category as before (`materialClass` in `sim/gunplay.ts`, the
`guess` words of `content/surface-types.json`). Which terrain layer a material paints as (`map/terrainPaint.ts`) is
derived in code; the eight terrain grounds (`map/terrain.ts`) are stored by index in
maps and stay in code.

| File | Holds |
|---|---|
| `content/materials.json` `materials` | every material, in MapMaker's palette order: `id`, `displayName`, `category` (palette group: `MATERIAL_CATEGORIES`), either a procedural `pattern` (`PATTERN_IDS`) with `base` and `accent` colours, or a scanned `texture` set with `base` (its average colour, for minimaps and icons); `scale` (metres one repeat covers), `shine` (0 matte to 1 glossy), `emissive` (glows whatever the light), optional `surface` (a type in `content/surface-types.json`) and `ballistic` (a class in `BALLISTIC_MATERIALS`), `notes` |
| `content/materials.json` `themes` | every theme: `id`, `displayName`, `sky` colour and `slots` (`floor`, `walls`, `solids`, `underside`, `trim`: each a `material` and optional `tint`) |
| `content/materials.json` `tintSwatches` | the tints MapMaker offers first (any #rrggbb is allowed) |

#### How to add a material or theme

1. **Add it to `materials`** where it belongs in the palette (the order is only the palette's; maps don't store it).
   `id` is `core.<name>`; maps, tiles, themes, Style Packs and code name a material by id, so never rename or remove
   one that is used (the generator refuses). Materials have **no network code**: maps carry the id.
2. **Procedural or scanned:** a procedural material names a `pattern` and gives `base` and `accent` (lower-case
   #rrggbb). A new pattern is code first (its id in `PATTERN_IDS`, `map/materials.ts`, and its painter in
   `client/materials/patterns.ts`). A scanned material gives `texture` (and no pattern or accent): the set must be in
   `content/textures.json` and prepared (`node tools/content/prepare-textures.mjs --only <id>`), so that
   `packages/client/public/textures/<id>_color.jpg` and `_normal.jpg` exist (and `_emission.jpg` for `emissive`).
3. **Settings:** `scale` above 0, `shine` 0-1, `emissive: true` only for light panels, neon, lava.
4. **A theme** sets each of the five slots to a `material` from the list and an optional `tint`, plus the `sky`
   colour. Keep `core.prototype` (the fallback theme). Offer it in a Style Pack through that pack's `themes` (and new
   materials through its `materials`, `editor/stylePacks.ts`).
5. **Generate and check:** `pnpm content:materials` (`node tools/content/materials.mjs`) checks the schema (an unknown
   field is an error), patterns and categories, colours, numbers, the texture sets and their files, unique ids, that
   the themes' materials exist and that every material and theme named in `maps/*.json`, the Style Packs' `themes` and
   `materials`, the terrain grounds (`TERRAIN_SURFACES`) and code (`material:` / `surface:` / `skin:` 'core.…' in the
   shared and client sources) exists, and writes `packages/shared/src/content/materials.generated.ts`
   (`CORE_MATERIALS`, `CORE_THEMES`, `TINT_SWATCHES`); `--check` only verifies it is up to date
   (`tools/content/test/materials.test.mjs` does the same). The Style Pack tiles' own paint (`paint(box, '<name>')` in
   `map/packTiles*.ts`) is checked by `packages/shared/test/materialsData.test.ts`.
6. **Test:** `pnpm typecheck`, `pnpm test:changed` and the `editor` and `visual` e2e flows. Changing or adding a
   material changes `packages/shared/test/fixtures/materials-resolved.json`: rewrite it with
   `UPDATE_MATERIAL_FIXTURE=1 pnpm vitest run packages/shared/test/materialsData.test.ts` and read the diff (it also
   shows each material's ballistic class and terrain layer, so a rename that changes what bullets do shows there).

`pnpm content:rebuild` and `pnpm content:check` run it with the other data generators. The Workbench shows
**Materials** (name, category, pattern, texture, colours, tiling, shine, glow, notes; id read-only) and **Themes**
(name, sky, each slot's material and tint, notes; id read-only) from this file.

### Surface types

What a surface is made of, for gameplay, is one shared list: `content/surface-types.json` (generator
`tools/content/surface-types.mjs` → `packages/shared/src/content/surfaceTypes.generated.ts`, read through
`packages/shared/src/sim/surfaceTypes.ts`). The server's ballistic class and the client's impact effect and sound come
from the same type, so they can't disagree for anything that names one. These are gameplay types, not looks (a prop's
look is its model).

| File | Holds |
|---|---|
| `content/surface-types.json` `types` | each type: `id`, `name`, `ballistic` (its class: `BALLISTIC_MATERIALS` / `MATERIAL_BALLISTICS` in `sim/gunplay.ts`, penetration resistance, ricochet, destruction), `impact` (`decal`: `hole` or `none`; `debris`: any of `dust`, `splinters`, `chips`, `leaves`, `sparks`; `sound`: `hard`, `wood`, `metal`, `soft`, `glass`, `water` or `none`) and optional `footstep` (a family for later; not played yet) |
| `content/surface-types.json` `guess` | the legacy effect guess for entries with no `surface`: words per type (moved unchanged from content/vfx.json `map.surfaces`), else `fallback` |
| `content/vfx.json` `map.impacts` | how each type's hit is drawn, keyed by type id: `sparks`, `dust` colour and `dustSize`, `chips` and `chip` colour (splinters, leaves, grit), the Binbun `accent` |
| `content/props/<pack>.json` | `surface` on a prop, or at the file's top level for every prop of the pack (a prop's own wins) |
| `content/materials.json` | `surface` (and `ballistic` to override its class alone) on a library material |
| `content/sounds.json` | the impact sounds per family: `impact.world` (hard), `impact.wood`, `impact.metal`, `impact.soft`, `impact.glass`, `water.splash` |

The types (2026-11-04): `concrete`, `stone`, `rock` (boulders, cliffs; stone class), `brick`, `plaster` (drywall),
`wood`, `thin_wood`, `bark` (trunks, stumps, logs; class `heavy_wood`, full cover), `foliage` (bushes; class
`foliage`, pass-through), `metal`, `sheet_metal` (thin_metal), `glass`, `dirt`, `grass`, `sand`, `gravel`, `snow`
(all soil), `water`, `flesh`, `fabric` and `plastic` (drywall), `armor`, `energy`.

**Unset keeps today's behaviour.** A prop or material with no `surface` keeps the ballistic class `materialClass`
guesses from its id and the effect the `guess` words give, exactly as before; nothing changes until a surface is set.
Tile structure stays concrete to the server (effects guessed from the tile id and theme), terrain concrete to the
server and dirt on the client. `packages/shared/test/surfaceTypes.test.ts` compares every material's and prop's class
and effect with `packages/shared/test/fixtures/surface-classes-before.json` (taken before surface types; never
regenerated) and lists every intended change by id: setting a surface that changes a class means adding it there, on
purpose.

#### How to add or change one

1. **Name a prop's surface** with `"surface": "<type>"` in its entry in `content/props/<pack>.json` (or the pack's top
   level), a material's in `content/materials.json`. Prefer a type whose class is what the piece should do to bullets;
   if the class must differ (rare), a material can add `ballistic`.
2. **A new type**: add it to `types` and its drawing to `content/vfx.json` `map.impacts` (what it draws must match its
   `debris`: sparks only if it lists `sparks`, `chips` only for `chips`, `splinters` or `leaves`, `dust` only for
   `dust`). A new ballistic class is code first (`BALLISTIC_MATERIALS` and `MATERIAL_BALLISTICS`, `sim/gunplay.ts`;
   read docs/GUNPLAY_SPEC.md and GUNPLAY_DIRECTION.md first).
3. **Generate and check:** `node tools/content/surface-types.mjs` checks the schema (unknown fields are errors), that every
   class is in `BALLISTIC_MATERIALS`, every surface named by a prop, pack or the guess is a type, every type has its
   drawing in vfx.json and nothing else does, and writes the generated file (`--check` only verifies; it runs in
   `pnpm content:check` and `pnpm content:rebuild`; `tools/content/materials.mjs` checks materials' `surface` and
   `ballistic`). Then `node tools/content/vfx-map.mjs` if vfx.json changed.
4. **Test:** `pnpm typecheck`, `pnpm test:changed` (the fixture test above; `packages/client/test/fxMap.test.ts`) and
   the `physicsfx` and `arsenal` e2e flows.

The Workbench shows **Surface types** (name, class, decal, debris, sound, footstep; id read-only) and a surface and
ballistic column on **Materials**.

### Environment species (procedural, Phase 1)

The procedural environment (docs/PROCEDURAL_ENVIRONMENT.md, plan in PROCEDURAL_ENVIRONMENT_AUDIT.md §9–10): trees,
shrubs, grass, boulders and cliff faces generated in code from seeds, owned, nothing downloaded or AI-made.

- **Sources:** `content/environment.json` (generator version, the pack's provenance, picture seeds, budgets per
  category and level of detail) and `content/environment/<family>.json` (species: id `env.<family>.<species>`,
  category, `assetVersion` with a note per version, nav, role, conceals, placement rules, the generator's settings and
  seed, levels of detail, the far stand-in, material variants with their colours).
- **Build:** `pnpm content:environment` (`node tools/content/environment.mjs`; `content:rebuild` and `content:check`
  run it). Code in `tools/content/env/`: `rng.mjs` (the only randomness: seeded; `Math.random` is banned by the test),
  `noise.mjs`, `textures.mjs` (bark, rock, leaves atlas), `tree.mjs`, `conifer.mjs`, `plants.mjs`, `rock.mjs`, `deadwood.mjs`,
  `branches.mjs`, `impostor.mjs` (software rasteriser for the far cards), `mesh.mjs` (GLB writer).
- **Outputs:** `packages/client/public/env/<family>.<species>.<variant>.glb` (level 0 plain; lighter levels with glTF
  extras `{ lod, distance }`, the crossed-card stand-in `{ crossed }`), `env/bark.webp`, `bark_n.webp`, `rock.webp`,
  `rock_n.webp`, `leaves.webp`; `content/environment.lock.json` (sha, bytes, triangles per level, generator and asset
  versions, the atlas cards' alpha coverage); `packages/shared/src/content/environment.generated.ts` (gameplay only:
  size, collision shapes, surface, nav, conceals, placement) and `packages/client/src/content/environment.generated.ts`
  (files, level distances, pictures). Vertex colours carry species and season, so material variants share pictures.
- **Checks:** `--check` rebuilds in memory and fails unless every file is byte-identical; budgets per level and per
  file; leaf cards cover ≥ 55 % of their rectangles; `tools/content/test/environment.test.mjs` (built twice, budgets,
  cliff seams, coverage, no Math.random); `packages/shared/test/environmentData.test.ts` (schema, surfaces, and
  `fixtures/environment-resolved.json`, which pins every species' shapes and size by assetVersion: a change to them
  needs an assetVersion bump, a note and a fixture entry, on purpose: it is a gameplay change).
- **Maps:** species are props (`model: 'env.…'`, optional `variant`); `getProp` gives a view of them with no box: their
  shapes collide (`map/environment.ts` → physics capsules, hulls, meshes; nav triangles; `shapeAt` → surface).
- **Showcase:** `maps/env_showcase.json` (made in MapMaker with `?env=1`; in `RETIRED_MAPS`, never offered): the §10
  stress target, 2,001 trees, 401 boulders, 30 cliff panels, 94 shrubs and ~46 k grass clumps (thick grass painted
  over the 200 m square). Play it with `?offline=env_showcase&env=1`; compare with
  `PERF_QUERY=env=1 node tools/perf/client-perf.mjs env_showcase` against `node tools/perf/client-perf.mjs backwoods`
  (`PERF_BOTS=2`, medium, same turn at the spawn). Its 2,526 species placements are within the environment budget (docs/MAP_BUDGETS.md): it validates clean.
- **Ground cover the plants brush grows** (owner, 2026-11-05: our own grass replaces Kenney's): `env.grass.clump`
  (summer, dry), `env.flower.meadow` (white daisy, yellow buttercup, purple clover, red poppy (assetVersion 2: the buttercup card
  in red, no new atlas cell): basal leaves and stems in vertex colour, a flower-head card per stem from the leaves
  atlas' `flower.*` cells) and `env.fern.bracken` (summer,
  autumn: fronds as bent `fern.0` cards), then (owner, 2026-11-05, items 2a and 3a) `env.rock.pebbles` (category
  `rock`: four rounded convex stones up to 0.58 m across, bedded to their waist, grey and sand, 60 triangles, rock
  surface; assetVersion 2 made them bigger (1.24 × 0.32 m at scale 1, was 0.83 × 0.13) so they read at play distance)
  and `env.water.eelgrass` (7–8 long ribbons in a seeded S, green and olive, 49 triangles). Ground cover and small
  rocks are checked to have no collision or nav; they are decoration (role `decorative`, no concealment) except the
  fern, which conceals (role `cover`; assetVersion 2): its cylinder comes from its bounds like any bush, so at the
  Kenney fern's 0.9 m (scale 1.62) it hides a crouching player (`packages/shared/test/conceal.test.ts` proves the
  replacements hide players in the same stances, and from bots, as the Kenney fern and small bush did).
  `packages/client/src/foliage.ts` grows them at every plants level in every match and in MapMaker, no flag needed:
  grass and tall grass → the clump (2.2 a Kenney patch's count), flowers → the meadow flowers, low plants → the
  fern, bushes → `env.shrub.broadleaf` at its lighter level (100 triangles), pebbles → `env.rock.pebbles` (the sand
  variant on sand), shallow water → `env.water.eelgrass`. MapMaker offers them, and the shrub, in Nature → Plants &
  Flowers / Rocks & Wood (pictured from their first variant, in the `environment` palette atlas) and the scatter brushes plant them; Kenney's grass, flowers, low
  plant, fern, small bush and stones and the Meshy eelgrass are retired from the palette (`editor/paletteCatalog.ts`
  `RETIRED_PROPS`), still loaded and drawn where maps place them.
- **Swapping placed pieces:** MapMaker's prop inspector has **Replace all N <prop>** (`replacePropsCommand`,
  shared/src/editor/operations.ts): every prop of that model becomes the chosen prop or species variant, keeping ID,
  position, facing, name, solid and tint; "Keep height" (default) scales it to the old piece's height (concealment
  follows), "Keep scale" keeps the number; a prop bedded into the terrain is bedded again under its new footprint;
  one undo step. A retired piece suggests its replacement (`REPLACEMENTS`). The nine maps that placed Kenney grass,
  ferns, flowers, low plants or stones by hand were updated with it (HANDOFF, Environment Phase 1c).
- **Environment Phase 2 (2026-11-08): trees, bushes and hedges** (the owner's rule: no Kenney foliage anywhere).
  Nine species, generated the same way:
  - `env.broadleaf.maple` (Field Maple: a rounder, denser crown on a taller bole; summer, autumn) and
    `env.broadleaf.acacia` (Umbrella Acacia: the oak generator's lobes drawn flat and wide across the top,
    `generator.umbrella`, longer scaffold limbs `limbStep`, its own `acacia.0` leaf card; green, dry);
  - `env.conifer.spruce` (a dense narrow spire, branches to the ground; summer, snow): conifer settings only;
  - `env.palm.coconut` and `env.palm.leaning` (`tools/content/env/palm.mjs`: a ringed trunk leaning from a bulb and
    curving back up, 14–18 pinnate fronds as folded, bent strips of the `palm.0` / `palm.1` cards, dead fronds and
    nuts on the nearest level; collision three trunk capsules; green, dry);
  - `env.cactus.saguaro` (`env/cactus.mjs`: a 12-ribbed column and 2–3 elbowed arms, the star-shaped rings' normals
    from their shape, the areoles on the bark picture's cactus strip at the rib crests; collision the column and each
    arm's two stretches as capsules; green, dry);
  - `env.shrub.laurel` (a large dense evergreen bush, 1.7 m, conceals; green, dry);
  - `env.hedge.privet` (4.8 × 1.2 × 0.8 m) and `env.hedge.yew` (3.6 × 2.2 × 1.2 m) (`env/hedge.mjs`: a clipped block
    along z with rolled top edges, a core of leaf and the `hedge.0` cards set just proud of it; collision one hull that
    stops everything, nav obstacle, role blocking, surface `bark` like the trunks (a species may name its `surface`),
    and, colliding, they stand upright: `envTilts` is plants without shapes).
  The bark picture is 1024 × 512 now (four strips: `BARK_STRIPS` oak, pine, palm, cactus) and the leaves atlas
  1024 × 1280 (a fifth row: `palm.0`, `palm.1`, `acacia.0`, `hedge.0`); every GLB was rebuilt for the new uv, shapes
  and sizes unchanged. The plant budget is 700 / 200 / 8 triangles (hedges are long). `conceal.test.ts` proves the
  laurel and shrub hide players as the Kenney bushes did (by height; the leafy bush's cylinder is 5 cm narrower).
- **Scenery outside the map** uses our species too (`client/src/environment/envScatter.ts`, an EnvironmentVisuals of
  its own with bigger squares): the forest border's undergrowth, front and far rows, the backdrop belt's plants and the
  scenery forest's far trees (stand-ins only). In matches the environment renderer is on by default (`?env=0` draws
  species as prop nodes); MapMaker draws them as prop nodes.
- **Rocks and deadwood for Rockfall Canyon (2026-11-11):** counterparts of the Kenney pieces the map places, near
  their sizes, two variants each (bare, moss), all solid nav obstacles:
  - `env.rock.boulder_round` (2.0 × 1.4 × 2.2 m; for `prop.rock_large`): the boulder generator with `round` (the
    subdivided hull relaxed until edges and corners are gone) and `fit` (its size); collision is the rounded form's
    hull, thinned to 32 points;
  - `env.rock.slab` (3.7 × 0.4 × 3.0 m; `prop.rock_flat`; generator kind `slab`): a flat top that falls 8 cm across,
    to stand and walk on; one hull. `nav: obstacle`, so navigation gets its footprint and its top as a surface;
  - `env.rock.outcrop` (4.2 × 2.4 × 4.2 m; `prop.rocks_tall`; kind `outcrop`): three fused masses, role blocking;
    one hull per mass (20 points each), so the notches between them stay open; faces buried in a neighbour are dropped;
  - `env.deadwood.log` (0.53 × 0.57 × 2.2 m along z; `prop.log`; family `deadwood`, category `deadwood`,
    `tools/content/env/deadwood.mjs`): a tapered trunk with a sawn butt showing rings, a broken end and two branch
    stubs; bark and, for the cut faces, vertex-coloured wood (material `env.grass`); one hull, surface `bark`. Not
    breakable (species carry no breakable data; `prop.log` has 60 health).
  They are in MapMaker's Environment group (Boulders, Deadwood) but not in the brush presets (a new species in a
  preset's mix changes what a seed paints). Their palette pictures come with the next `pnpm content:rebuild`.
- **Rock:** boulders are a convex hull cut by 8–12 fracture planes (the collision hull), then, on the visual surface
  only and only inward of the hull: bedding grooves, corner chips (never at the six corners that set the bounds) and a
  little edge wear; vertex colour from strata, curvature (cavities dark, worn edges pale), patchy moss and hue patches.
  Cliff panels add joint blocks to their near levels only (the collision level is unchanged) and read colour noise on
  a circle round the panel, so neighbours match. The rock picture (`rock.webp`: albedo, roughness in alpha;
  `rock_n.webp`) is drawn tri-planar in world space on medium and high (`EnvRockPlugin`, envMaterials.ts, GLSL and
  WGSL: no uv seams, no two boulders alike, a larger second sample of the same picture breaks up the repeat); low
  keeps the GLB's box-projected uv.
- **Adding a species** (Phase 2+): a new entry in its family file (or a new family file and generator kind), budgets
  for its category, run the build, add its fixture entry, check it in `?envlab`. No simulation code changes.
- **Map budget:** environment species have their own (docs/MAP_BUDGETS.md), apart from props.

### Kit props (procedural, Phase 6)

Simple man-made props generated in code from seeds, the way the environment species are (docs/PROCEDURAL_ENVIRONMENT.md
§11 Phase 6, owner-approved 2026-11-05): owned, nothing downloaded or AI-made. They replace the Kenney toy crates,
barrels and boxes first; fences and walls, then containers, come next.

- **Sources:** `content/kitprops.json` (generator version, pack provenance, budgets by generator kind, `aliases`) and
  `content/kitprops/<type>.json` (families: id `kit.<type>.<name>`, display name, palette `category` (an existing prop
  category), `assetVersion` with a note per version, `size` (the box it fills), `surface` (a surface type: impacts and
  ballistics), `detail` (the content/surfaces.json picture drawn on it), optional `breakable`, the generator's kind and
  settings, levels of detail, variants: `index`, `name`, `seed`, `look` (colours and wear) and optional `set` (settings
  of its own: an X brace, no brace, narrower planks)).
- **Build:** `node tools/content/kitprops.mjs` (`content:rebuild` and `content:check` run it, after prepare-props).
  Code in `tools/content/kit/`: `geom.mjs` (flat-shaded boards and boxes, turned shells, colour helpers; every quad faces
  the way it is asked to), `crate.mjs` (the board crate: sheathing inside a batten frame on every face, a diagonal or X
  brace, skids; the steel-framed crate; the open cargo bin), `drum.mjs` (a steel drum turned from a profile: chimes,
  rolling hoops, a lid with bungs or open with something inside; paint worn bare at the hoops, rust from seeded noise),
  `carton.mjs` (a taped carton with softened corners and bowed sides, a label or a second tape), `furniture.mjs`
  (tables, chairs and benches, bookcases), `shop.mjs` (shelving, stalls, counters, bins), `sofa.mjs` (armchairs and
  sofas: a frame on feet or a skirt, seat and leaning back cushions, piping, a throw or a scatter cushion; the corner
  sofa with its chaise), `bed.mjs` (the double bed and the bunk bed), `furniture.mjs` again for the office chair and
  the pedestal table (these five collide as finer boxes set by their generator settings, as the props they replace did),
  `cabinet.mjs` (cabinets: a carcass on a recessed plinth, doors, drawers and open bays under a top; appliances: a
  fridge's doors, a stove's hob rings, knobs and oven door, a washing machine's round door; handles and knobs stand
  inside the box, the case set back for them), `glb.mjs` (the writer).
  Randomness only from `env/rng.mjs` streams.
- **Outputs:** `packages/client/public/kit/<type>.<name>.<variant>.glb`: one material (the family's surface: roughness,
  metalness and material extras `{ surface, tile, uv, detail }` that `client/content/propSurfaces.ts` turns into the
  shared detail map, as for the Kenney props), vertex colours for everything else, box-projected detail coordinates in
  TEXCOORD_1 (whole millimetres), lighter levels as nodes with glTF extras `{ lod, distance }` (ModelLibrary and the prop
  batches read them; one material keeps every level one mesh). `content/kitprops.lock.json` (sha, bytes, triangles per
  level, bounds, generator and asset versions) and `packages/shared/src/content/kitProps.generated.ts` (`KIT_PROPS`:
  each family as a PropDefinition; `KIT_FAMILIES`: surface, level distances, each variant's file; `KIT_ALIASES`).
- **In the game:** a family is an ordinary catalogue prop (`CORE_PROPS`, `getProp`; shared/src/content/kitProps.ts), so
  collision, settling, footing, budgets, breaking, the palette and the inspector need nothing new. Its collision is its
  box: every variant's level 0 fills `size` to 2 mm and no level leaves it (the build and
  `tools/content/test/kitprops.test.mjs` check). Variants (`PropEntity.variant`) share the size, collision, surface and
  breakable data and change only the drawn file (`kitModelFile`; client game/propVisuals.ts). MapMaker offers each
  family in its category; the prop inspector picks a variant, Randomise rolls one.
- **Budgets:** triangles per level by kind (`budgets.triangles`), bytes per file; and against what each alias
  replaces: from the first lighter level on, no more triangles than the retired prop (content/props.lock.json).
  The Kenney crates were 124 triangles, the barrel 412, the cardboard box 60.
- **Aliases** (`aliases`: retired id → family, variant, scale): as played, loadMap gives a retired prop's placements
  the family (shared/src/map/propAliases.ts, after set pieces are expanded); MapMaker keeps the map as made, lists the
  retired props as `RETIRED_PROPS` (out of the palette) and suggests the family in Replace all (`REPLACEMENTS`). Each
  family has the retired prop's exact size and a surface of the same ballistic class, so an alias changes no
  collision box, breakable health, ballistic class or footing (`packages/shared/test/kitProps.test.ts` checks every
  official map; the pieces whose class is changed on purpose are its `REMATERIALLED` list: the iron fences, the wooden
  furniture and cabinets, the sofas, the beds, the bin and the white goods). The retired props' files stay in the build until no official map places them (MapMaker's Replace all)
  and no alias needs them.
- **Adding a family:** an entry in its type file (or a new type file and generator kind in `KINDS`), a budget for its
  kind, run the build, add it to the content test's family list, look at it in the lineup
  (`node tools/content/prop-lineup.mjs` with `ONLY=`, or `window.__lineup.show(['kit.crate.wood#2'], 'eye')`). A change
  to a family's size, collision or surface bumps its `assetVersion` with a note: it is a gameplay change.

### Tiles and edge styles

The core building kit is data (docs/CONTENT_SCALABILITY.md step 7, scope "core kit"): what a tile occupies, where its
doorways can open, its default walls and the parts it is built from are in `content/tiles/core.json`; how each side
of a cell can be built (an edge style: what collides, the trim, the openings) is in `content/tiles/edges.json`. The
builders are code: the parts (`map/catalog.ts`: `kitPart`, `resolveKitTile`), the room options (layouts, floor
inserts, ceilings, corners), the facades and the auto/open rule (`map/geometry.ts`), `TILE_DIMENSIONS` (8 m cells,
4 m levels, 0.5 m walls, 3 m doorways). The Style Pack tiles drawn in code (`paint(box, …)` in `map/packTiles*.ts`)
stay there and follow the kit in the catalog.

| File | Holds |
|---|---|
| `content/tiles/core.json` `tiles` | every kit tile in palette order: `id`, `displayName`, `category` (palette group: `TILE_CATEGORIES`), `blurb`, `cells` or `footprint` ([w, d] or [w, d, levels]), `floors` (levels with a slab), `ports` (`{side, level, cell}`, or `{allSides: level}`, or `{perimeter: [w, d], levels}`), `open`, `edgeDefault`, `edgeDefaults` (`"dx,dy,dz:S"`: style), `configurable` (room options), `model` (`file`, `lift`), `solids` and `extraFloors` (parts), `notes` |
| `content/tiles/edges.json` `edges` | every edge style in MapMaker's order: `id`, `label`; `auto` and `open` are `rule`s in code; the rest give `segments` (collide: `u` along the side, `y` up, `t` thick, or a `repeat`), `trim` (`base`, `cornice`, `frame`, `window`, `arch` (a segmental arch's voussoirs, keystone and soffit: `u`, `y` springing and crown, `count`, `band`, `key`) or a box with `depth`; `outside`: on the wall's outer face too where nothing is built beyond the side), `trimFrom`, `openings` ([u0, u1, y0, y1]: framed under a facade, glazed when `glass`), `corner`, `facade`, `street`, `openDefault`, `dressing` (`door` / `window` with `span`, or `see-through`), `notes` |

A part names one builder and its numbers (local metres: x east, y up, z north from the first cell's centre and
floor): `box` [x0, y0, z0, x1, y1, z1] (with `yaw`), `flight` (steps of 0.25 m: `axis`, `dir`, `from`,
`across`, `steps`, `base`, `run`, `floor`), `descending` (steps down off a raised block), `rail` (1 m railing),
`columns` (square columns at points), `partition` (a thin interior wall with gaps), `lamp`, `arc`, `arcTrim`,
`arcade` (curves; `turns` in quarter turns), `roundRoom`, `discStrips` (a half-round floor), `vault` (a segmental
barrel vault in tilted strips: `axis`, `span`, `along`, `spring`, `crown`), `block` (a model's collision, centred on the
footprint). `kind` says what paints it: `solid` (default; the theme's solids slot), `wall`,
`floor`, `trim` (drawn, never collides) or `prop` (collides, invisible: a model is drawn); `surface` gives every box
a part builds (a box, a flight's steps) a library material of its own. Edge values are metres or `half`, `-half`, `half-0.75`, `-half+0.75`, `height`,
`height*2`, `height-0.15`, `height*2-0.2`, `min(3.5,height)`.

#### How to add a tile or an edge style

1. **A tile:** add it to `content/tiles/core.json` where it belongs in the palette (the order is only the palette's).
   `id` is `core.<name>` (or `city.` / `orbital.` / `neon.` for those pieces); maps and Style Packs name a tile by id,
   so never rename or remove one they use (the generator refuses). Tiles have **no network code**: a map carries the
   id. Give its cells (or a `footprint`), the levels with floors, the ports, and its parts from the builders above. A
   new kind of part is code first (`KitPart` and `kitPart` in `map/catalog.ts`), then its case in the generator's
   schema. To offer it in a Style Pack, add it to that pack's `tiles` (`editor/stylePacks.ts`).
2. **An edge style:** add it to `content/tiles/edges.json` (between `auto` and `open`, which stay first and last);
   maps store a side's style by id, so never rename or remove one a map uses. Give `segments` and `trim` (an empty
   list for none), and the flags that apply. MapMaker offers it at once (Walls & Openings, the inspector; its icon is
   drawn from the segments) and maps accept it.
3. **Generate and check:** `pnpm content:tiles` (`node tools/content/tiles.mjs`) checks the schema (an unknown field is
   an error), palette groups and sides (`map/tileOptions.ts`), cells and footprints, that ports and default edges
   sit on the tile's own cells, default edges are edge styles, one builder per part, boxes with min ≤ max, models
   under `packages/client/public`, surfaces are materials in `content/materials.json`, edge values and repeats, that
   glass styles have openings, unique ids, and that every tile and edge style `maps/*.json` and the Style Packs name
   exists (kit ids here, other prefixes in `packTiles*.ts`); it writes `packages/shared/src/content/kitTiles.generated.ts`
   (`KIT_TILES`) and `edgeStyles.generated.ts` (`EDGE_STYLES`, `EDGE_STYLE_LABELS`, `EDGE_SHAPES` and the glass,
   corner, facade and street lists); `--check` only verifies they are up to date (`tools/content/test/tiles.test.mjs`
   does the same).
4. **Test:** `pnpm typecheck`, `pnpm test:changed` and the `editor`, `visual`, `scenery` and `maps` e2e flows; a
   climbable tile also needs its bot paths (`test/kit.test.ts`). Changing a tile or a style changes
   `packages/shared/test/fixtures/tiles-resolved.json` (the kit, the styles at six sizes, and a hash of what every map
   builds: geometry, trim, facades, glass, validation, room dressing): rewrite it with
   `UPDATE_TILE_FIXTURE=1 pnpm vitest run packages/shared/test/tilesData.test.ts` and read the diff. A changed tile
   also needs its palette picture redrawn (`pnpm content:rebuild`; the picture is keyed by a hash of the tile's
   resolved definition, key order included, so keep a tile's keys in their order).

`pnpm content:rebuild` and `pnpm content:check` run it with the other data generators. The Workbench shows **Kit tiles**
(name, palette group, blurb, floors, open, room options, default edge, model; id, cells, ports and parts read-only:
edited in the JSON) and **Edge styles** (name, trim offset, the glass / corner / facade / street / open flags, room
dressing; id, segments, trim and openings read-only) from these files.

### Set pieces

Set pieces (docs/SET_PIECES_PLAN.md) are multi-cell structures placed as one, made of the ordinary map pieces: a
carriageway through a hall, an enclosed skybridge. They are data: `content/setpieces/<family>.json` (one family a
file) and `content/setpieces/roles.json` (the role packs), checked and built by `tools/content/setpieces.mjs` into
`packages/shared/src/content/setPieces.generated.ts` (`SET_PIECE_DEFS`, `SET_PIECE_PACKS`). Only map loading and
MapMaker read them (`map/setPieceLibrary.ts`, through `loadMap`): the menu's first download leaves them out
(`node tools/ci/bundle-budget.mjs`).

| File | Holds |
|---|---|
| `content/setpieces/<family>.json` | `family` (the file's name) and `pieces`: `id` (`setpiece.<name>`), `displayName`, `category` (MapMaker's Set pieces tab group), `blurb`, `packs` (the role packs it suits), `footprint` (`cells` [dx, dy] and `levels` [dz min, dz max]: what it claims on the grid), `mirror` (`free`, or `none` for a piece with a tile that isn't its own mirror image), `roles` (its own value for a role no pack gives), `ports` (`side`, `cell`, `level`, `kind` `door` or `opening`: where it meets what is built round it, facing out of the footprint), `parts`, `markers` (`doorPair`, `spot`: notes for logic and MapMaker, inert in play), `notes` |
| `content/setpieces/aliases.json` `tiles` | Retired tiles: `tile` (a catalog tile kept loadable, out of MapMaker's palette), `piece` (the set piece that replaces it: it must cover exactly the tile's cells and levels unturned), `since`, `notes`. Generated into `SET_PIECE_TILE_ALIASES`; a map that places the tile plays the piece in its place (`map/setPieceAliases.ts`) and MapMaker's tile inspector offers Replace all. An entry is never removed. |
| `content/setpieces/roles.json` `packs` | `id`, `displayName`, `stylePack` (the Style Pack it goes with), `themes` (maps in these themes take it when a placement names no pack; a theme has one pack at most), `roles`: `stone`, `trim`, `floor`, `paving`, `roof`, `wood`, `metal` (a library material and optional tint), `facade` (a room facade), `door` (a door style), `glass` (`breakable`, `reinforced` or `none`) |

A part is a map piece in the piece's own frame: a **tile** (`kind: "tile"`, `tile`, `x`, `y`, `z` cells from the anchor
cell, `rotation`, and `edges`, `glass`, `upperFloors` keyed in the tile's own frame, `surfaces`, `options`, as a map's
tile placement), or a **block**, **prop**, **door**, **ladder** or **light** (`position` in metres from the anchor
cell's centre on its level's floor, `yaw`, and the entity's own fields). Where re-theming should change a look, a part
names a role instead of a value: a surface or a block's `material` `{ "role": "stone" }`, a door's `style`
`{ "role": "door" }`, a room's `facade` `{ "role": "facade" }`, a window's glass `{ "role": "glass" }`. A placement
takes each role from its overrides, else its pack (its own `pack`, else the pack listing the map's theme), else the
piece's `roles`; a material role nothing gives leaves the part's surface to the theme (stone: walls, trim: trim, floor
and paving: floor, roof: roof, wood and metal: solids).

**Placements** (map format v27, `setPieces` on the map: `id`, `piece`, `x`, `y`, `z`, `rotation`, `mirror`, `pack`,
`overrides` with `roles` and `hide` by part index) expand at load into ordinary tiles and entities
(`map/setPieces.ts` `expandSetPieces`), with ids `sp_<placement id>_<part index>`: a placement's id is at most 48
characters, so with at most 1024 parts every part's id stays a StableId (64). The mirror swaps east and west in place
over the footprint (dx → W − dx, W the footprint's least plus greatest dx), then the turn goes clockwise about the
anchor cell. Tiles mirror only onto themselves (`tileMirrorAxis`: their cells, ports, default edges and parts are their
own mirror image), turned the other way with their edge, glass and upper-floor keys mirrored; blocks, props, doors,
ladders and lights mirror in position and facing (a block's roll too; an untilted block turned a quarter keeps its yaw
with its width and depth swapped). A map can carry pieces of its own (`setPieceDefs`, ids `local.<name>`: saved from a
selection in MapMaker), so it plays anywhere.

#### How to add a set piece

1. **The piece:** add it to its family's file (or a new `content/setpieces/<family>.json`). Maps name a piece by id
   and its parts by index, so **an id never changes and parts are only ever added at the end** (hide one in a
   placement instead; the generator refuses to lose a piece a map places). Build it from kit tiles, edge styles and
   room options first: the tile, geometry and collision pipeline stays the one source of truth. A new kind of kit part
   is code (`map/catalog.ts`, `map/geometry.ts`) and an edge style is `content/tiles/edges.json` ("Tiles and edge
   styles"), never something only a set piece has.
2. **Roles:** name roles for what should re-theme; add a role pack to `roles.json` for a new look (an id never
   changes either: maps name packs).
3. **Generate and check:** `node tools/content/setpieces.mjs` checks the files' shape (an unknown field is an error),
   the packs' materials, facades, door styles, themes and Style Packs, ids, families and the pieces and packs maps
   name; then, with the game's own code (`tools/content/setpieces-check.ts`), each piece against the map schema and
   `map/setPieceCheck.ts` (tiles, props and materials exist, the footprint covers every part, ports face out of it,
   markers name its parts, `mirror: "free"` only when every tile mirrors onto itself), and placed in a map in each
   turn, mirrored and not, in each of its packs and in a theme with none: `validateMap` must find no error in what it
   expands into. It writes the generated file; `--check` (in `pnpm content:check`) only verifies it is up to date.
   `pnpm content:rebuild` runs it after the tiles.
4. **Test:** `packages/shared/test/setPieceExpand.test.ts` (every turn × mirror × pack; determinism; ids),
   `setPiecePlay.test.ts` (collision, trim and nav from the expansion equal the exploded map's; the z-fighting audit
   over every piece; shots, players and bots through its arches and doorways: a piece whose ports are not all walled
   doorways or arches, such as a trench, a stand or a tunnel, goes in its `OPEN_SIDED` list and is proved by a test of
   its own, as in `setPieces3.test.ts`) and `setPieceEdit.test.ts` (placement checks, commands, budgets) pick a new
   piece up; add a case for what is new about it. Look at it in the game (MapMaker
   → TEST): nothing floating, upside down, flickering or blocking an opening.

The map as played (hand-placed pieces and parts together) holds at most 4096 tiles and 4096 entities and 2 MB of JSON,
the schema's own caps: it is what a joining player's welcome carries and every client loads it again. The file's caps
count what it stores (a placement is one entry, at most 1024).

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
    a wall, blank sky or one material lose). Look at the pictures afterwards. Where the choice is poor, set
    the card camera in MapMaker: Map properties → **Card shot** (eye level by default, seen in the card's
    frame; stored as `metadata.cardCamera`, format v30), export the map, and the tool renders from it as is.
    (An older fixed camera, `metadata.thumbnailCamera`, is used when there is no card camera.)
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

MapMaker's palette shows a picture of every shipped tile, prop and vehicle/turret (about 1,600
pieces) without rendering 3D thumbnails in the browser: they are pre-rendered into sprite sheets.

- `packages/client/public/thumbs/<atlas>.<hash>.webp`: one atlas per content source
  (`editor/paletteCatalog.ts` `atlasGroup`): `tiles-<style pack>` (the tile id's prefix: `tiles-core`,
  `tiles-desert`), `props-<content pack>` (the prop's `content/props/<pack>.json`) and `vehicles`.
  80 px cells (rendered at 160 px and shrunk), 16 to a row, transparent background, WebP. Two
  branches adding different packs write different files, and the hash in the name keeps two
  versions of one atlas apart, so atlases never conflict in git.
- `packages/client/public/thumbs/palette.json`: the index (version 2), one line per atlas, sorted:
  its file, rows, bytes, the pack its props come from (for search) and its pieces in cell order as
  `[palette key, hash of what the picture was made from]` (the tile's definition or the model file).
  The client builds its key lookup from it (`editor/paletteAtlas.ts`).
- MapMaker loads an atlas the first time one of its pieces is shown and draws the cells as CSS
  sprites; a piece missing from the atlas is rendered at runtime by `ModelThumbnails`, as before.
- `content:check` fails when a shipped piece has no picture, its hash no longer matches (the model
  or tile changed, or the prop moved pack), a piece in the atlas isn't shipped, an atlas has the wrong
  size, isn't a WebP or isn't named after its atlas, an atlas is over 400 KB, all of them over 3 MB,
  the index over 160 KB, or another file sits in `thumbs/`.

`pnpm content:rebuild` (below) keeps them up to date. By hand: `node
tools/content/build-palette-atlas.mjs --offline` rewrites the atlases from the pictures already made
(a piece keeps its cell from whichever atlas held it) and exits with code 3 when something needs
rendering; to render, `pnpm build`, serve it (`pnpm --filter @tiletrigger/client exec vite preview
--port 4799`), then `node tools/content/build-palette-atlas.mjs http://localhost:4799` (`--all`
re-renders everything; `ATLAS_JOBS=2` uses two pages). Atlases with no change keep their file. The
tool and the check list the pieces with `tools/content/palette-items.ts` (run by Node with
`--experimental-transform-types`).

### Prop surfaces (man-made Kenney props)

Kenney paints every part one flat colour: a material per colour in the older kits (Furniture, Space
Kit: `wood`, `metalDark`, `carpet`…) or one palette texture (`colormap`) whose swatches the faces point
at in the newer ones. That flatness is much of the "toy" look (docs/LOOK.md). `tools/content/surfaces.mjs`
maps each colour to a surface, as data, when `prepare-props.mjs` builds the prop:

- **Surfaces** (`content/surfaces.json`): `wood`, `painted_wood`, `painted_metal`, `metal`, `concrete`,
  `stone`, `fabric`, `plastic`, `cardboard`, `glass`. Each names one of our ambientCG sets
  (`content/textures.json`; nothing new downloaded), its roughness and metalness, `tile` (metres per
  repeat), `detail` (how strongly it changes colour, roughness and normals, 0-1) and `grime`. The tool
  turns each set into one shared 256 px Babylon detail map, `public/surfaces/<id>.webp` (RGBA: high-passed
  brightness, normal y, roughness, normal x; tileable grime blotches worked into brightness and roughness),
  locked in `content/surfaces.lock.json`. `glass` has no picture (roughness only).
- **Mapping, one file per pack** (`content/surfaces/<pack>.json`): `default` (any colour not listed;
  `none` leaves it as it is), `materials` (flat-material kits, by material name), `colors` (palette kits:
  `#rrggbb` of a swatch; the nearest listed colour within 40 wins, since Kenney's swatches are gradients),
  `minShare` (a palette prop's surfaces under this share of its area join its largest, default 0.18, so most
  props stay at one or two parts), `skip` (props left alone) and `props.<id>` (a prop's own `default`,
  `materials`, `colors`, matched before the pack's). `node tools/content/surfaces.mjs --palette <pack>` lists
  the colours a pack uses, grouped by family, with their area and which props use them.
- **What a prop gets**: each mapped part keeps its colour (the base colour or the palette swatch) as the
  tint, gets the surface's roughness and metalness, a second set of texture coordinates box-projected in
  the prop's frame as drawn (after `height`/`scale`; whole centimetres in 16 bits, KHR_mesh_quantization), and
  material extras `{ surface, tile, uv, detail }`. A palette material whose faces land on several surfaces is split into one
  part per surface (one draw each for every copy on the map). The game (`content/propSurfaces.ts`, from
  `ModelLibrary`) gives those materials the shared detail map; on low graphics it is left off. (A flat-colour
  material also gets a shared 1×1 white colour map on the same coordinates: Babylon picks a mesh's texture
  coordinates before the detail map asks for them, and without a texture of its own the material would draw
  its detail from nowhere.)
- **Natural pieces are never mapped** (trees, bushes, grass, plants, rocks, logs, stumps, cliffs: a
  procedural environment replaces them): the Nature Kit has no mapping file, and the other packs `skip`
  theirs.
- **Kit props kept as built** (packs from a `download`: City Kit Industrial and Roads, Retro Urban,
  the Modular Space and Space kits) are surfaced once, in place; changing their mapping afterwards needs
  their download (`--downloads`). The lock entry lists `surfaces`, and provenance says so.

Mapped packs: Castle, City (Commercial, Industrial, Roads), Factory, Fantasy Town, Furniture, Graveyard,
Mini Dungeon, Mini Market, Modular Space, Pirate, Platformer, Retro Urban, Space, Space Station,
Survival and Train kits. Real-world sizes are the props' `height` in their pack files as before (the
2026-11-04 pass shrank the chunkiest clutter: barrels, the powder keg, bottle, bucket, anvil, lantern,
candles, shopping cart, fridge); collision follows the built size.

### Prop collision

What a placed prop collides with (shots, players, bots' navigation, cover) is its catalogue collision
(`props.generated.ts`: `collision`, the box round it, and `boxes`, finer boxes in its own space that
replace it), built by `prepare-props.mjs` from its pack entry's `collide`:

| `collide` | Collision |
|---|---|
| `box` (default) | its bounds (kit walls with one face thickened to 0.2 m); natural rocks two rounded tiers. Only where the box is the shape (crates): bounds that stand off the model fail the slack audit |
| `none` | none: decoration you walk and shoot through |
| `trunk` | a column standing on the model's real trunk, as thick as the trunk (0.2–0.5 m) |
| `voxel` | boxes that follow the model in 3D: arches, windows, holes, doorways and the space under tables, bridges and vehicles stay open |
| `stairs`, `frame`, `openings` | steps a player walks up; a doorway between posts; every doorway along a wall |
| `shell` | 2.5D: a column over each 0.4 m cell of the footprint, as high as the model there, cells of one height (within 0.1 m, or the coarser step the box budget allows) merged (corner pieces, round railings, stair corners) |
| `boxes`, `model` | boxes the pack entry gives, or a code-built model carries |

**Voxel collision** (`tools/content/voxel-collision.mjs`, owner's bug of 2026-11-06: rounds stopped in empty
air inside arches, windows and holes, because `shell` and `box` fill every overhang): the model's
triangles are rasterised into 0.1 m cubes; the space reachable from the sides and from above (never
up from under the ground, so a wall with no floor face stays solid inside) through cubes no triangle
touches is open, everything else solid. The solid cubes are covered exactly by boxes, then merged
two at a time, cheapest first, while a merge fills little open space and none of it in sight (no
cube a straight line from outside reaches along x or z, or down from above, more than 0.1 m from
the model: no merge closes a window or a niche), and each box face open all across is pulled in to
the model inside the box, so bullet holes sit on the stone. A single plane of the model (a kit wall
with one face) gets 0.2 m round it. Each prop keeps to a box budget (48; `budget: "hero"` props 160;
`voxelBudget` for a prop that needs more, with the reason in the change): when the boxes don't fit,
the build tries coarser cubes and bigger merges (`VOXEL_LADDER`) and takes the first that fits and
still leaves every opening open. `voxelCell` and `voxelAir` set where the ladder starts.
Deterministic; `prepare-props.mjs` keeps the results in `node_modules/.cache/tiletrigger/` by the
model's bytes and the settings, so a rebuild only voxelises what changed.

**Trunk columns**: a `trunk` prop's column used to stand in the middle of its footprint, which a crown
or an arm to one side moves off the trunk (Meshy birches 1.5 m off, broadleaf trees 0.6 m, street
lights 0.9 m): rounds stopped in the air beside the tree and players walked through the trunk. Now
the model is cut into 0.25 m slices; the column stands on the narrowest slice of the bottom 1.5 m,
follows the trunk up while its cross-section stays narrow (leaning with it, as thick as it, 0.2 m at
least), carries on straight up while the model closes round it (inside a pine's tiers or a crown)
and stops where neither holds (where a broadleaf tree forks, where a pole ends). A column within
12 cm of the old one is left as it was.

**The openings audit** (`node tools/content/prop-openings.mjs`, in `pnpm content:check`): every prop's
collision against its model, as straight lines along x and z that miss the model but cross the
collision. Lines with the model on both sides of them (the ground and the sky may close them below
and above: a window, a hole, an arch, a doorway, a gateway between posts, under a table or a bridge)
that a 0.5 m square fits in are a filled **opening**: the check fails unless the prop collides as
`voxel` (or `frame`/`openings`) or says why in `fills` (nine do: five long stair flights kept solid
underneath, hand-built collision of the airliner and its stairs, the bucket-wheel excavator's
lattice, one city block). Lines reached from either side (over a car's bonnet, beside a column's
shaft) are **slack**: the slack audit below. Gaps narrower than 0.5 m (bars and fence rails) are no
opening. The check also fails on a voxel prop over its budget or not rebuilt, and a trunk column the
build would now put elsewhere. `packages/shared/test/fixtures/prop-openings.json` records every prop
whose collision these passes changed (lines through what its old collision filled, now clear; points
of its model its new one holds) and a digest of every other prop's collision; after a deliberate
collision change, `node tools/content/prop-openings.mjs --fixture <git ref before>` enters the props
changed since that ref (against what they were before) and keeps the earlier entries.

**The slack audit** (owner's bug of 2026-11-06, Capitol Mall: "These pillars are blocking my bullets":
the white Ionic column's box was as wide as its plinth and capital all the way up, 0.28 m of
invisible wall beside its round shaft along x and 0.55 m at 45°). `voxel-collision.mjs` `propSlack`
looks along x, along z and along both diagonals (rounds come from every side, and a square box round
a round shaft stands furthest off it at 45°): in the plane across each direction, cut into 5 cm
squares, a line that crosses the collision, misses the model and is reached from beside the prop
without crossing the model is slack; each row's widest run of it is measured. **A prop carries slack
when, seen along one of the four directions, air 0.15 m or wider beside its model runs over 30 % or
more of its collision's height** (`SLACK_WIDTH`, `SLACK_SHARE`): about the width of a head or a
shoulder at the edge of cover, over enough of the prop that rounds at someone beside it meet it.
`pnpm content:check` fails a `box` prop that carries slack unless it collides as `voxel` (or `trunk`
for a pole) or its entry says why in `fills`; natural rocks keep their two rounded tiers (a collision
model of their own, to climb on) and aren't checked. Props of the other modes are listed, not failed:
`node tools/content/prop-openings.mjs --slack` lists every prop that carries slack (how much of its
height, how wide, seen along what, the maps placing it). The pass of 2026-11-06 moved 391 `box` props
to `voxel` (28 columns, pillars, obelisks and posts first, then the rest: statues, vehicles,
furniture, machines, fences and the like); 18 keep their box with a `fills` reason, round or thin
pieces whose voxel collision is that same box (barrels, drums, bins, pots, picket panels: a box
round a barrel stands off it only at 45°). Prop collision boxes on the 73 maps in play went from
31,682 to 58,638 (Iron Maw, the busiest, 1,481 to 3,281); physics and navmesh build times and shot
raycasts on the busiest maps stayed within the noise. Bars and rails as voxel: rounds pass between
bars where the gap is wider than the 0.1 m the merges may fill beside the model (`dg_arch_bars`), and
stop on a plate where it is narrower (`iron_fence`'s close bars).

Breakable props collide as their `boxes` too (one collider each in `ScenarioBodies`, all of them the
prop: a shot anywhere damages it); their bounds still decide blasts, footing and paths.

### Real-world sizes

Props stand at their real-world size beside the characters: 1.80 m standard (1.40 m small, 2.12 m
large), the standing eye at 1.6 m. Furniture is judged by what it is for, not by its bounding box: a
chair by its seat, a table by its top, a bed by its mattress, a fridge, a bookcase or a door by its
height. A tall back over a small, low seat reads as a child's chair beside a 1.8 m body.

| Piece | Reference |
|---|---|
| Dining chair | seat 0.46 m |
| Office chair | seat 0.48 m |
| Bar stool / counter stool | seat 0.75 m / 0.65 m |
| Sofa or armchair | seat 0.44 m (back 0.85–0.95 m) |
| Bench | seat 0.45 m |
| Desk or table | top 0.75–0.78 m |
| Kitchen counter | 0.92 m |
| Bar or shop counter | 1.05 m |
| Bed | top 0.5–0.6 m, length 2.0 m |
| Bunk | 1.6–1.8 m |
| Toilet | seat 0.42 m |
| Sink or wash basin | rim 0.85 m |
| Fridge | 1.75–1.85 m |
| Bookcase | 1.8–2.0 m |
| Door opening | 2.05–2.1 m × 0.9 m |

A chair seat narrower than about 0.42 m reads as a child's chair too.

- **The catalogue carries the size**: one `height` per prop in its pack file (the pack's `scale` when a
  whole pack is off), chosen so its seat, top or height lands on the reference. Maps place props at ×1;
  an instance scale is for a deliberate difference (Pantry Raid's giant kitchen), never to make up for a
  prop the catalogue has wrong.
- **Real size, no "game size" factor** (owner, 2026-11-07: "Keep real size"): furniture stands at the
  reference sizes, with no factor over them to make it read bigger. The lineup drawn at ×1.1 (`SCALE=1.1`)
  showed why: seats then sit at 0.48–0.50 m and read high beside the 1.8 m body, and rooms built around
  today's sizes crowd (a living room's sofa and armchair run together).
- **The 10 % rule**: a prop whose seat, top or height is more than 10 % off its reference (off the
  range, where the reference is one) gets a new height; one within 10 % keeps its own. A height scales
  the prop whole, so where its proportions are off (a bed top right but the bed 3.6 m long) it is listed
  below instead of stretched.
- **Kept-as-built props follow their height** (packs from a `download` that isn't being rebuilt):
  `prepare-props.mjs` scales the built model about its foot to a new `height` (a rebuild from the
  download makes it at that height anyway).
- **`node tools/content/prop-sizes.mjs`** measures every furniture prop from its built model: its kind
  and reference (`tools/content/furniture.mjs`), the seat or top (the largest upward-facing area in the
  band of its height where that sits), the height that would bring it to the reference, its width then,
  and how the maps place it; it marks seats narrower than 0.42 m. `PACKS=` or `ONLY=` limit it, `--json`
  prints JSON. The area can catch the wrong face (a basin's bowl, armrests, a dungeon chair named
  "Stool"): look at those in the lineup.
- **`node tools/content/prop-lineup.mjs <url> <out dir>`** (against a served build; `?mode=lineup`,
  `packages/client/src/tools/propLineup.ts`) draws a sheet per pack: its furniture and everyday props in
  rows beside the three characters and a ruler, the seat, table, counter and door heights drawn across,
  each row from a standing player's eye and from the side. `PACKS=` or `ONLY=` pick props;
  `SCALE=<factor>` draws them that much bigger, to show a "game size" factor without changing anything.
- **Maps after a resize**, in MapMaker (never by hand): placements whose instance scale made up for the
  old size go back to ×1, props resting on a resized prop follow its top, and a prop whose new bounds
  reach into a wall or a neighbour moves clear of it.

The pass of 2026-11-06 (measured from the built models, before → after):

| Prop | Height | Seat, top or rim |
|---|---|---|
| `bench` (Kenney Furniture) | 0.45 → 0.92 m | seat 0.22 → 0.46 m |
| `graveyard_bench` (Kenney Graveyard) | 0.5 → 1.02 m | seat 0.22 → 0.45 m |
| `office_chair` (Kenney Furniture) | 1.0 → 1.26 m | seat 0.37 → 0.47 m |
| `dungeon_chair` (Kenney Mini Dungeon) | 0.8 → 1.12 m | seat 0.33 → 0.46 m |
| `hm_couch`, `hm_couch_large`, `hm_couch_l`, `hm_armchair` (Quaternius House) | 0.85 → 1.04 m | seat 0.35–0.37 → 0.43–0.45 m |
| `hm_dresser` (Quaternius House) | 1.0 → 0.8 m | top 1.0 → 0.8 m (65 of its 79 placements were at ×0.8) |
| `mt_bench` (Metro) | 0.81 → 0.96 m | seat 0.39 → 0.47 m |
| `hh_toilet` (Household) | 1.01 → 0.89 m | seat 0.48 → 0.42 m |
| `hh_desk` (Household) | 0.85 → 0.77 m | top 0.84 → 0.76 m |
| `hh_basin` (Household) | 0.76 → 0.95 m | rim 0.67 → 0.84 m |

The maps followed in MapMaker: 44 Kenney benches at ×2.5, ×2.6 or ×1.5 (Cormorant Isle, Diamond Park,
Neon Galleria, Riot Junction, Grand Marquee) and St John's 65 dressers at ×0.8 went back to ×1; 7
monitors and lamps on household desks came down with the desk tops; 27 placements (14 sofas, 6
armchairs, 6 benches, a basin) moved 0.05–0.32 m clear of the wall, bookcase or plant their new size
reached into. Listed, not changed:

- Seats the right height but narrow: Kenney `chair` (0.40 m wide, 182 placements) and the household
  `hh_chair` (0.41 m, 80): widening them takes the model.
- Low beds whose length is right: Kenney `bed` (top 0.38 m, 1.95 m long) and the household beds (top
  0.38 m, 2.22 m long); raising the top to 0.5 m would make them 2.6–2.9 m long. Quaternius
  `hm_bed_king` is the other way: top 0.65 m but 3.6 m long and 2.8 m wide.
- `hp_wheelchair`: seat 0.40 m, but bigger it would be 0.83 m wide and 1.23 m long.
- Doors sized to their wall kits: the hospital's doors are 3.0 m high in 3.75 m doorways, and the Wild
  West, sci-fi, castle and dungeon doors follow their walls; a real-size door needs its kit and its
  maps rebuilt.
- The household kettle (0.55 m) and desk fan (0.59 m) are twice their size, but Pantry Raid places the
  kettle at ×4 as a giant, and MapMaker's scale stops at 4.
- `hm_chair_wood` (seat 0.42 m) and `hm_chair_office` (0.44 m) are within 10 % and keep their heights.

### Adding a prop pack

Props live one file per content pack, `content/props/<pack>.json` (the pack id is the file name),
read by `tools/content/props-manifest.mjs` for every tool:

```json
{
  "pack": { "title": "…", "creator": "…", "url": "…", "license": "CC0-1.0", "licenseFile": "assets-src/<pack>/License.txt", "retrieved": "2026-11-04" },
  "order": 830,
  "props": [
    { "id": "…", "src": "…", "name": "…", "category": "…", "height": 1.2, "collide": "box" }
  ]
}
```

- `pack` is the pack's licence and build settings (what `packs.<id>` was in the old single file);
  props carry no `pack` field. `content/props.json` holds only the budgets shared by every pack.
- **Order.** The prop table (`props.generated.ts`, so the palette within each category) lists props by
  `order`, then pack id, then place in the file. A prop may carry its own `order`: from it until the
  next prop with one, those props sit there instead (how a pack's trees sit with the other packs'
  trees). Orders in a file only go up. A new pack takes a number above the highest in use; two
  branches picking the same number still give one order (by pack id) and no merge conflict.
- **Build.** Add the sources (`assets-src/<pack>/` with `License.txt`, or a `download` folder), then
  `pnpm content:rebuild`. Commit the pack file, the built GLBs and what the rebuild wrote.

**`pnpm content:rebuild`** (`tools/content/rebuild.mjs`) rebuilds every generated content file in
order, deterministically (run twice, the second run changes nothing): settle and format the lock
files (`tools/content/lockfile.mjs`) → `prepare-props.mjs` and `character-manifests.mjs` (the prop
and character tables; packs from downloads kept as built) → the palette atlas offline, and only when
a picture is missing `pnpm build`, `vite preview` on a free port (never 4173, 4391 or 4567; stopped by
its PID) and the atlas tool rendering against it → `content:build` (provenance) → `content:check`.

**After a merge**, resolve the source files git couldn't merge (a pack file both sides edited, code,
maps; the rebuild stops and lists them), then run `pnpm content:rebuild` and `git add` what it wrote.
Generated files are rewritten, not merged: `props.generated.ts`, `characters.generated.ts`,
`provenance.json` and the palette index, conflict markers and all. The lock files (every
`content/*.lock.json`) and `provenance.json` are one entry per line, sorted by file, so different
files merge line by line; where git still conflicts in a lock (neighbouring lines), the rebuild keeps
both sides' entries and, for a file on both sides, the one matching the file on disk. What can
still conflict: the same pack file edited on both sides, the same built GLB rebuilt on both sides
(binary: pick one and rebuild the other), and an entry one side removed inside a conflicting part of
a lock (it comes back from the other side: the props lock is rewritten anyway; for the others
`content:check` names the missing file).

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
