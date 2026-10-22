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

### Official maps

- Built in MapMaker, saved to `maps/`, validated in CI (`validate-map`), and bot-tested with the headless bench (no stuck bots, every spawn reachable).

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
