# Player Expression — The Sandbox

**Status:** adopted direction.

## The idea

We build the toy box. Players supply the imagination.

The team hand-makes a large library of **parts, materials, colours and costume pieces**. Our in-house tools (MapMaker, terrain, scenario logic, Character Designer) let players **combine** them freely. Each new option multiplies the possibilities rather than adding to them, so two players with the same toy box make maps and characters that look nothing alike. Every element still comes from the sandbox: nothing is imported or uploaded, and nothing is generated.

```
20 heads × 20 torsos × 15 leg sets × 30 outerwear × 25 accessories × 3 colour slots (48 swatches each)
  = more combinations than players will ever exhaust, from ~110 hand-made parts
```

## 1. Map look: "paint it your way"

The shape of a map comes from tiles; its **look** is chosen surface by surface.

- **Surface slots per tile:** floor, walls, ceiling/underside, trim, and the tile's solids (pillars, cover, steps). Each slot takes a **material** and a **tint**, overriding the theme default.
- **Paint tool:** brush one surface, the whole tile, a flood-fill of connected tiles of the same type, or a whole level. An eyedropper copies a look, and "apply theme" resets.
- **Themes are starting palettes, not cages.** A tile can use any material from any theme, so an Egyptian floor under space-station walls is the player's call.
- **Material library (hand-made):** stone, brick, plaster, concrete, wood, metal plate, rust, tile, marble, carpet, fabric, sci-fi panels, grates, glass, emissive strips, and so on. Each has pattern scale and tint parameters, so every material is many looks.
- **Props** come with material/colour variants. **Lights** have colour and intensity. **Atmosphere** covers sky, fog, time of day and ambience.
- **Signage** comes from our decal library. Player-typed text is filtered (moderation baseline).

## 2. Terrain (Phase 2)

Sculpt and paint with the same material library, so outdoor areas match indoor tiles.

## 3. Scenario

Doors, buttons, destructibles, NPC encounters, objectives and WHEN → IF → DO logic (PHASE1 M3–M4). Placed NPCs use **character looks** from the designer, so a scenario's villain can be built to fit its story.

## 4. Character Designer

Built on CHARACTERS_BOTS_V2 §8 (modular production) and §7 (body families).

| Layer | Player chooses |
|---|---|
| Body family | Average, athletic, heavy, lanky, short, tall… (sets skeleton and gameplay capsule class) |
| Body parts | Head, torso, left arm, right arm (limb swapping), hands, legs, feet |
| Costume | Outerwear, head attachment / hair / hat, face attachment (glasses, masks, beards), back attachment, accessory A/B |
| Colour | Skin tone, eye colour, and primary / secondary / accent colour per part from curated swatches, plus material finish (cloth, leather, metal, gloss) |
| Personality | Animation attitude (swagger, nervous, robotic…), voice set, name, default bot personality |

Rules that keep it working:

- **Parts are tagged** with body family, attach points and conflicts (e.g. a full helmet hides hair; long coats hide belts). The designer only offers combinations that fit, so nothing clips through.
- **Looks are cosmetic.** Hitboxes are the fixed capsule for the body family's class, and competitive playlists can normalise classes. A tiny or bulky look gives no hit advantage.
- **Readability.** One accent region is reserved for team colour in team modes, the designer enforces minimum contrast, and silhouettes stay within body-family bounds.
- **Official roster = presets built with the same designer.** The team's 12 slice characters (and later the roster) are curated combinations plus a few hero-only parts. Bots use presets or "Random Chaos" combinations.
- **Unlocks** add parts and swatches to the toy box through play (CHARACTERS_BOTS_V2 §22), never stats.

### How others see it in multiplayer

- A look is a small data record: body family, a part ID per slot, and colour indices. That is roughly 30–60 bytes, sent once in the roster when a player joins.
- Every part is shipped game content, so other players' clients load it from our own content CDN (cached, lazily), and everyone sees the same character.
- Every part is within budget, so **any combination is within the character budget**. At load time the parts are merged into one mesh with one material atlas per character, keeping draw calls flat at 32 players.
- Looks are saved per account (several slots) and shareable as a short code. A look code can also be used for an NPC in MapMaker.

## 5. "Within reason": look-alikes

Players will build their own versions of characters they love from our generic pieces (a cowboy hat, a lab coat, a space helmet, a bandana). That is the point of a sandbox, and it needs nothing from the original game. To keep it on the right side of the line:

- We ship **generic** costume pieces. We don't ship parts that copy a specific franchise character's distinctive design, logo or signature outfit as a set (CHARACTERS_BOTS_V2 §2).
- **No official presets** named after or deliberately imitating other franchises' characters.
- Player looks and names fall under the community content policy (`OPEN_QUESTIONS.md`): filtered names, reports, and takedown if a rights holder complains.

## 6. Data and code implications

- **Map format v2** adds per-tile `surfaces: { slot: { material, tint } }` overrides plus map-level `atmosphere`. This is the first real migration: v1 maps upgrade with "use theme defaults". It stays data-only, and every material is a catalog ID.
- **CharacterLook** schema in `shared` (versioned, validated like maps). The roster message carries one look per player.
- **Content registry** gains `materials/`, `swatches/`, `character-parts/` with tags and budgets (CONTENT_PIPELINE.md).
- Rendering: material slots on tile meshes (one merged mesh per material in use), runtime character assembly and merge.

## 7. Where it lands in the roadmap

| Piece | When |
|---|---|
| Map materials, tints and the Paint tool (graybox-era starter library of ~20 materials), format v2 migration | **M1.5**, small and visible, before weapons |
| Props with variants, lights, atmosphere | M3 alongside scenario objects |
| Rig standard, first part library, Character Designer, 12 preset characters built with it | **M5** |
| Terrain sculpt/paint | Phase 2 |
| Larger part, material and theme libraries; unlocks | Phase 2 onward (content expansion) |
