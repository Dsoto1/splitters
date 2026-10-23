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
  converted. Community maps that were shared freely may be converted, with
  credit to the author (when the save or its source names one) and removed on
  request. The original games' built-in levels stay homages: inspired by,
  not copied.
- Raw saves (`.gci` and other memory card files) never go into the repo
  (`.gitignore` ignores `*.gci`); only the converted layouts do.
- Other games' editors work the same way when their formats are documented
  (Quake's `.map` brush format is, for example), with the same rule: community
  maps with their authors' permission.

## TimeSplitters 2 / Future Perfect importer (first version)

Status: the GameCube saves decode (format notes and confidence labels in
[`tools/import/timesplitters/FORMAT.md`](../tools/import/timesplitters/FORMAT.md)),
and a first converter turns every valid save into a playable map. Tile
**shapes and openings** are inferred; tile **looks**, item kinds and logic are
not known yet, so the maps are faithful in layout and only roughly in feel.

### Running it

```sh
# 1. Decode the saves (pure byte parsing; nothing in a save is executed):
python3 -I tools/import/timesplitters/tsdecode.py /tmp/tsdecode <saves>/*.gci
# 2. Convert (from packages/server):
npx tsx src/tools/import-timesplitters.ts --decoded /tmp/tsdecode --report /tmp/ts-report.json
#    or both steps at once:  --gci "<dir of .gci files>" (repeatable)
#    --write-table  adds newly seen tile types to the mapping table (keeps your edits, refreshes counts)
#    --only tsfp_hallway_2  converts one map
```

It writes `maps/imported/<game>_<slug>.json` (`ts2_…`, `tsfp_…`). Each map is
validated like any other (schema, rules, bot navmesh: every spawn and pickup
reachable) before it is written. Profiles and corrupt saves are skipped with
the reason. Imported maps appear in the Arcade under their own **Imported
maps** heading (loaded in their own chunk after the menu is up) and start
directly with `?offline=<id>`, e.g. `?offline=tsfp_hallway_2`. They are not
MapMaker templates.

Each map keeps the original **name** and **description**; the description ends
with the credit "Imported from a TimeSplitters 2 MapMaker save." (or
"TimeSplitters: Future Perfect"). The saves store no author field, so
`metadata.author` is empty; when it is set (by hand, or by a later decoder),
the Arcade shows "Map by …" under the description.

### The mapping table

`content/import/timesplitters-mapmaker.json` has one entry per observed tile
type id per game: footprint (and, for Future Perfect, how many cell ids the
type takes in the link numbering), our strategy and tile, a rotation offset,
`exits` (TS2 only), `fit` (`exact` / `close` / `stand-in`), `confidence`,
notes, and how many saves and placements use it. Strategies: `auto` (each cell
becomes our corridor, corner, T, crossroads or dead end, picked and turned by
the openings the save shows), `fill` (every cell becomes the given 1 × 1 tile
with no walls inside, so a 3 × 3 original room is one 24 m room), `tile` (one
of our multi-cell tiles with the same footprint, turned by the original
rotation plus `rotationOffset`), `skip`. Controlled test saves (FORMAT.md §6)
should refine it: put the confirmed name in `original.name`, raise
`confidence`, and switch `fill` to a matching `tile` where we have one.

### What is exact and what is guessed

| Part | Status |
|---|---|
| Tile positions, levels, rotations, footprints of common types | From the save (confirmed in FORMAT.md). Footprints of rare types are upper bounds. |
| Scale | One original cell = one 8 m cell, one original level = one 4 m level, re-based so the main area's most common level is level 0. Original +x/+y = our east/north; the in-game compass is unverified, so a map may be mirrored. |
| Openings (Future Perfect) | From the save's cell links: two cells connect where the links say so. Links resolve to exact cells for about 80% of same-level pairs (cell ids are handed out tile by tile, row by row); the rest connect along the whole shared side of the two linked tiles. |
| Openings (TS2) | From per-type exit tables (statistical, see FORMAT.md) for corridor pieces; unknown pieces connect wherever the neighbour has an exit, and two unknown multi-cell pieces always connect. |
| Doorway style | Our choice: a doorway between pieces, a wide doorway between two rooms, no wall inside a room or inside a block of linked open cells (2 × 2 or bigger: courtyards, big halls). |
| Stairs | 1 × 1 and 1 × 2 pieces whose ends meet two levels (Future Perfect: links to the level above; TS2: an exit at one level and only the level above or below at the other end) become our Stairs or Long Ramp, turned to climb the right way. 200 in the current set. Other vertical pieces (lifts, ladders, tall shafts) are unknown, so some upper floors are cut off. |
| Tiles with no links (Future Perfect) | Skipped when stacked right over another tile (most likely the upper storey of a tall space, or scenery): about 2,000 of 8,900 tiles, almost all of types 17, 16 and 6. Elsewhere they become closed rooms. |
| Items | Kinds unknown. Pickups go where the original had items (in the main connected area), handed out from a balanced default set (weapons, health, armour, ammo); spawns are spread out by farthest-point sampling. All placeholders. |
| Theme | A ChronoSplit theme picked from keywords in the name, then the description ("Fire Temple" → Volcano Lair, "Ice Temple" → Arctic, "Romulus" → Marble Temple…). TS2 maps without a keyword use the guessed tileset field; others a stable pick from the name. |
| Lights, logic, AI, objectives, game settings | Not converted. |

### Current result (36 TS2 + 80 Future Perfect saves)

All 116 valid saves convert, load, validate with no errors and no navmesh
warnings; the 9 corrupt Future Perfect saves and the 2 profiles are skipped.
Stand-ins (pieces whose meaning is a guess) are mostly Future Perfect types
30, 27, 42, 4, 5, 3, 28, 44 and TS2 types 4, 28, 23. The converter's log and
`--report` list every stand-in, skipped tile, unreachable area and warning per
map.
