# Importing maps from the original games: plan

Goal: take a map a player built in the original TimeSplitters MapMaker (or
another game's level editor) and rebuild it in ChronoSplit with our own
look-alike pieces, so it plays the same.

## How hard is it?

| Step | Effort | Notes |
|---|---|---|
| 1. Get the save off the console | Small | PS2 saves export with memory card tools (e.g. `mymc` reads `.ps2`/`.psu`/`.max`), GameCube saves as `.gci`, Xbox saves copy as folders. Emulator memory card files work too. |
| 2. Decode the map format | **Unknown, the big one** | As far as I know the MapMaker save format isn't publicly documented. Decoding it means comparing several known saves byte by byte: one empty map, one with a single tile, the same tile moved or turned, one per item, and so on. With good samples that's days to a couple of weeks. If the data is compressed or encrypted, longer. |
| 3. Master list (original piece → ours) | Medium | One row per original tile, item, weapon and logic block (see below). The tile grid is close to ours (rooms, corridors, stairs, levels on a grid), which is what makes this practical. |
| 4. Converter | Small, once 2 and 3 are done | Reads the decoded map and writes a ChronoSplit map through the same commands MapMaker uses (`tools/mapkit.ts`), then validates it and its navmesh like any map. |
| 5. Gaps | Ongoing | Pieces we don't have yet get a stand-in (a block of the right size) and a note, so the map still loads and plays. |

## The master list

A data file, `content/import/<game>-mapmaker.json`, one entry per original
piece:

```json
{
  "original": { "id": 17, "name": "(as the game names it)", "category": "tile" },
  "ours": { "kind": "tile", "id": "core.corridor_l", "rotationOffset": 1 },
  "fit": "exact",
  "notes": "the original's window becomes our 'window' wall style"
}
```

- `fit`: `exact` (same shape and size), `close` (look-alike, same footprint) or `stand-in` (placeholder until we build one).
- Tiles map to our grid tiles and wall styles, items to our pickups, weapons to our weapons, start points to spawns, and logic (Future Perfect had some) to our WHEN → IF → DO rules where possible.
- We fill it in from the original game's piece list and screenshots of each piece, not from memory, so it's right. Missing pieces become a to-do list for new tiles and props.

## What I need from you

1. Which game and platform: TimeSplitters 1, 2 or Future Perfect; PS2, GameCube or Xbox (or an emulator).
2. A few map saves, ideally including some tiny test maps:
   - an empty map;
   - one map with a single room tile;
   - the same tile turned 90°;
   - the same tile moved one cell;
   - one map with a single weapon pickup;
   - one or two real maps you like.
3. A screenshot of each map from the MapMaker overview, so we can check the decode against what you see.

## Ground rules

- We convert **layouts** (where the tiles, items and spawns go), never the
  original game's art, sounds or models. Every piece is drawn with our own
  CC0 look-alikes, as the homage maps already are.
- Only convert maps you made, or maps whose authors are happy for them to be
  converted. The original games' built-in levels stay homages: inspired by,
  not copied.
- Other games' editors work the same way when their formats are documented
  (Quake's `.map` brush format is, for example), with the same rule: community
  maps with their authors' permission.
