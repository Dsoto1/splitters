# Content Pipeline

**Status:** proposal, adopted direction. All shipped content (characters, environment kits, props, weapons, audio, UI, official maps) is made or licensed in-house. Players build maps in MapMaker only from catalog content. There are no player-uploaded models, textures or audio (see `OPEN_QUESTIONS.md`, "Decisions").

## 1. Principles

1. **Content is data plus assets, referenced by stable content ID.** Gameplay code never names a specific character, tile or weapon (master spec v1 §23 rule 2).
2. **Gameplay shape and visual dressing are separate.** Collision, navigation and hitboxes come from data (tile cells/ports/solids, capsule classes). Art meshes dress that shape. Visuals can change, or whole themes swap (v1 §8.6), without touching gameplay.
3. **Every asset has a provenance record** (who or what made it, under which license) and passes the originality review before it ships (CHARACTERS_BOTS_V2 §2).
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
  -> generate LODs (simplify) and a thumbnail/portrait render
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
3. **Model:** modular parts on the **shared skeleton** for the body family (spec published as `docs/RIG_STANDARD.md` before M5).
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

- Original recordings and synthesis first. Licensed libraries second.
- Library rules: **CC0 or a commercial licence only.** No CC-BY-NC, no "personal use". CC-BY is allowed only with an attribution entry. Every file's licence and source URL go into provenance.
- Loudness normalisation and trimming run in the build step.

### Official maps

- Built in MapMaker, saved to `maps/`, validated in CI (`validate-map`), and bot-tested with the headless bench (no stuck bots, every spawn reachable).

## 5. AI-assisted tools: allowed as raw material, with rules

Connected in this environment: **Meshy** (3D generation/texturing), **Freesound** (sound library), **Artlist** (images, video, music, voice). They are useful for concept exploration, blockouts and placeholder audio.

- Treat output as **raw material**: it always gets human art direction, cleanup, retopology/rigging to our standard, and both originality gates.
- **Never** prompt with franchise names, specific characters, or "in the style of" a living artist or existing game.
- Record the tool, plan/tier and date in provenance. **Confirm each service's commercial-use terms for the plan in use before shipping anything derived from it.**
- Purely machine-generated material may get weak or no copyright protection in some jurisdictions. Substantial human authorship is what makes an asset defensibly *ours*. Get legal advice before relying on AI output for hero characters.

## 6. In-house tools to build

| Tool | Purpose | When |
|---|---|---|
| ContentRegistry + pack loader | Single source of content truth for client/server/editor | With M2 (weapons as data) |
| `content:build` / `content:check` | Optimise, budget-check, provenance-check in CI | M2 |
| Asset viewer (dev page in the client) | Inspect any asset: LODs, wireframe, sockets, budgets | M2 |
| `RIG_STANDARD.md` + Blender export preset | One skeleton per body family; one-click compliant export | Before M5 |
| Character viewer + roster wall | Animation playback, silhouette mode, side-by-side readability | M5 |
| Kit viewer | Theme art over tile collision; port/doorway clearance overlay | First art theme |
| `ASSET_SOURCES.md` (generated) | Licence/attribution ledger built from provenance fields | M2, CI-maintained |

## 7. Roles and review

- **Content owner** per pack approves additions.
- **Originality reviewer** signs both character gates (a second person, not the author).
- **Readability review** at each roster-wall milestone (CHARACTERS_BOTS_V2 §31).
- CI is the performance and compliance gatekeeper. Humans handle taste, readability and originality.
