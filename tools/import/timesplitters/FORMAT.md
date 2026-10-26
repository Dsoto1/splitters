# TimeSplitters 2 / Future Perfect MapMaker save format (GameCube .gci)

Status: reverse-engineered from 127 sample files (37 in `TS2 Maps/`, 90 in `TSFP Maps/`) by byte statistics only.
No outside documentation was used. No web search was done, so nothing here comes from community sources.
Prototype decoder: `tsdecode.py`. Outputs: `out/<file>.json` and `out/<file>.txt` (ASCII preview).

Confidence labels:
- **confirmed**: holds for every valid sample, and was checked in a way that could have failed (an exact count match, chunks lining up with the end marker, symmetry, etc.).
- **likely**: strong statistical support, but no direct ground truth.
- **guess**: plausible only.

All integers are big-endian.

## 0. Sample inventory

| Group | Count | Notes |
|---|---|---|
| TS2 maps (GTSE/4F) | 36 | 16448 B (64 + 2 x 8192). All 36 decode fully and are consistent. |
| TS2 profile `dangerous.gci` (`Dangerous.son`) | 1 | Not a map; comment2 is `Profile(...)`. The decoder skips it. |
| TSFP maps (G3FE/69 NTSC, plus 3 G3FP PAL) | 89 | 41024 B (64 + 5 x 8192). 80 are fully consistent. |
| TSFP profile `Coyote Son Profile (PAL).gci` | 1 | Not a map. Skipped. |
| TSFP **corrupt** | 9 | BadReligion, All or Nuthin, Biohazard, Boxing Stupid, Bravo Team, Demolition Man, Outpost 13, Sky Harder, YouTube Map. Each has a foreign save's first block (it starts with `TimeSplitters Future Perfect`/`MapMaker (` text) or zeros spliced in at an 8 KiB block boundary (file offsets 0x2040/0x4040/0x8040). This looks like a bad extraction from a fragmented memory card. No reordering of blocks repairs them (all 24 permutations of blocks 1-4 were tried). Tiles before the bad block still decode. |

## 1. GCI wrapper (confirmed, standard GameCube DEntry)

| File off | Size | Field | Values seen |
|---|---|---|---|
| 0x00 | 4 | game code | `GTSE` (TS2 NTSC), `G3FE` (TSFP NTSC), `G3FP` (TSFP PAL) |
| 0x04 | 2 | maker | `4F` (TS2), `69` (TSFP) |
| 0x06 | 1 | unused | 0xFF |
| 0x07 | 1 | banner/icon flags | 0xFB. Banner format bits (&3) = 3, which is not a valid format, so there is **no banner** image. |
| 0x08 | 32 | filename | `<MapName>.map` (`.son` = profile) |
| 0x28 | 4 | mtime (s since 2000-01-01) | |
| 0x2C | 4 | image offset in data | 0x40 |
| 0x30 | 2 | icon formats | 0x0002: icon 0 is RGB5A3 |
| 0x32 | 2 | anim speed | 0x0003: one icon frame |
| 0x34..0x37 | | permissions, copy counter, first block | |
| 0x38 | 2 | block count | 2 (TS2) / 5 (TSFP) |
| 0x3C | 4 | comment offset | 0 |

The payload starts at file 0x40 (payload offsets are file offset minus 0x40):

| File off | Size | Content | Confidence |
|---|---|---|---|
| 0x40 | 32 | comment 1: `TimeSplitters 2` / `TimeSplitters Future Perfect` (bytes after the NUL are constant garbage) | confirmed |
| 0x60 | 32 | comment 2: `MapMaker(<name>)` (TS2) / `MapMaker (<name>)` (TSFP), or `Profile(...)` | confirmed |
| 0x80 | 0x800 | icon, 32x32 RGB5A3. Identical in every file of a game. | confirmed |
| **0x880** | to end | **map data block** (section 2) | confirmed |

The user's observation that "the first ~0x1800 bytes vary and from ~0x2000 on the bytes are identical" is only partly right. The icon (0x80-0x880) is identical across files. The map data starts at 0x880 and has variable length (TS2 0xB48-0x2160 bytes). After the data end, the rest of the file is a **stale buffer**: in 35/36 TS2 files it is byte-identical (>=90% same as the per-offset mode), and BASEMENT has a different stale buffer. It is not data.

## 2. Map data container (confirmed)

```
TS2 : 0x880 u32 L        (data ends at 0x880+L; L counts itself)
      0x884 chunks...
TSFP: 0x880 u32 L        (data ends at 0x884+L)
      0x884 u32 checksum? (algorithm unknown, see section 6)
      0x888 chunks...
chunk := u32 tag, u32 size, size bytes
tag   := 0x013246xx (TS2) / 0x00C776xx (TSFP)
```

- The first chunk is a **version marker** with no body: TS2 `..26` with value 0x7C (124), TSFP `..67` with value 0x12D (301). Every file has it.
- The last chunk is an **end marker** with no body: TS2 `..29`, TSFP `..6A`. Its value = (bytes from the first chunk to the end marker) = L-12. Checked on all 116 consistent files: walking the chunks lands exactly on the end marker at the offset implied by L. (Early on I took the end-marker value for a chunk length and the stale buffer behind it for an "encoded copy". That is wrong.)

TS2 chunk order: `26 27 [2a] 28 2b x10 2c x1+ [2d...] [2e...] [2f] 29`.
TSFP chunk order: `67 68 72 [73] [74] [75] 69 [6b...] [6c...] [6d...] [6e...] [6f...] 70 71 6a`.

| Tag | Size | Meaning | Confidence |
|---|---|---|---|
| TS2 27 | 0x364 | map settings, name, texts (2.1) | name/text/tile count confirmed, rest guess |
| TS2 2a | n x 0x10 | ? list of 16-byte records (absent in 13 maps) | unknown |
| TS2 28 | var | **tile list** (2.2) | confirmed |
| TS2 2b | 0x60 x10 | AI/character slots named `Enemy 1`..`Enemy 10` | likely |
| TS2 2c/2d/2e | 0x30 / 0x30-0x80 / 0x50-0x70 | story-mode logic? Story maps have many of them, arena maps have one 2c. | guess |
| TS2 2f | 0x100 | ? present in ~2/3 of maps | unknown |
| TSFP 68 | 0x3D0 | map settings, name, texts (3.1) | name/text/tile count confirmed |
| TSFP 72 | 0x100 | 64-entry RGBA colour palette (identical in all files) | likely |
| TSFP 73 | n x 0x40 | user label strings (`Door 1`, `Ceiling Auto Gun 2`, ...) | likely |
| TSFP 69 | var | **tile list** (3.2) | confirmed |
| TSFP 6b/6c/6d/6e/6f | 0x20/0x50-0x70/0xC0/0x220/0x90 each | logic/AI/objectives? | unknown |
| TSFP 70/71/74/75 | 8/0x10/var/var | ? | unknown |

## 2.1 TS2 settings chunk 0x27 (offsets relative to chunk body)

| Off | Type | Field | Confidence |
|---|---|---|---|
| 0x00 | u32 | flags (0x1A4..0x1A7, 0x1E4..0x1E7) | unknown bits |
| 0x04 | u32 | **tile record count** (equals the parsed count in 36/36) | confirmed |
| 0x08 | u16 | 0..4, maybe **theme/tileset** | guess |
| 0x0A | u16 | 0 for most arena maps, nonzero for story maps | unknown |
| 0x0E | 10 x u16 | probably **weapon set** (the same 10-value default list in many maps) | guess |
| 0x24 | 5 x u16 | ? (values 1..0x27) | unknown |
| 0x42 | char[32] | **map name** | confirmed |
| 0x62 | char[256] | description / subtitle (story maps) | confirmed (text) |
| 0x162 | char[512] | briefing text (story maps) | confirmed (text) |
| 0x362 | u8 | always 1 | unknown |

## 2.2 TS2 tile record (chunk 0x28), 20 + 12*k bytes (confirmed: all 36 maps parse exactly to the chunk end, and the count matches 0x27+4)

| Off | Type | Field | Confidence |
|---|---|---|---|
| 0 | u32 | **tile type** (0..29 seen) | confirmed as a type id. Names are unknown; see the footprint/exit table. |
| 4 | s8 | **x** grid (-20..19) | confirmed |
| 5 | s8 | **y** grid | confirmed |
| 6 | s8 | **z level** (-3..3) | confirmed (values are small and cluster; Plus has 2 levels) |
| 7 | u8 | **rotation** 0..3 | confirmed. Quarter turns **counter-clockwise** in (x right, y up). Tested: corridor exit statistics are sharp with world_dir = local_dir + rot, and blur with the opposite sign. |
| 8 | u16 | ? (0, small ints, bit patterns like 0x11/0x22/0x33/0x44/0x55/0x88/0xAA/0xCC) | guess: per-side flags (doors/windows) |
| 10 | u16 | **k = number of 12-byte attachments** that follow | confirmed |
| 12 | RGBA | **light colour** (0xFEFEFEFF default, others like 404040FF, 8080FEFF) | likely |
| 16 | u32 | 0 or byte-packed flags (0x0C000000, 0x02000000, ...) | unknown |
| 20 | 12 x k | attachments = placed items (2.3) | |

**Footprint and anchor (confirmed for common types).** (x,y) is the **minimum corner** of the tile's footprint after rotation. Odd rotations swap w and h. This was tested against three other anchoring conventions (pivot-rotation CW/CCW, centre). Only min-corner gives zero overlaps for the multi-cell types.

Footprints were inferred as the largest size giving zero overlap with other tiles:

| type | w x h | exits (local; rot 0 = as listed) | n | confidence |
|---|---|---|---|---|
| 1 | 1x1 | E,S (corner) | 218 | confirmed |
| 2 | 1x1 | N,S (straight) | 305 | confirmed |
| 9 | 1x1 | N,S,W (T-junction; W only 0.60) | 562 | likely |
| 17 | 1x1 | E,N,W,S (cross) | 167 | confirmed |
| 0 | 1x2 | S at (0,0), N at (0,1) (2-long straight, maybe stairs) | 71 | likely |
| 14 | 1x2 | S only (dead end / end cap?) | 87 | likely |
| 10, 15, 19 | 3x1 | room-width connectors, e.g. the arms of "Plus" | 158/107/29 | likely |
| 18 | 1x3 | E side + W middle | 112 | likely |
| 12, 16, 21 | 3x3 | rooms (21: N+S only; 16: all sides) | 52/180/43 | likely |
| 3, 8, 28 | 2x2 | | 12/5/19 | guess |
| 4 | 1x2? | never has same-level neighbours; can overlap a corridor (Plus) | 49 | guess (overlay or vertical piece) |
| 5, 6, 7, 11, 13, 20, 22-27, 29 | see `TS2_SIZE` | | <=17 each | guess (upper bounds only) |

## 2.3 TS2 attachment (12 bytes)

`u16 kind, u16 id, u32 v, u32 junk`

- kind (0..60) = **item type**. Likely, but which number is which item is unknown. kinds 8, 9, 20-24 appear at most once per map (flags/bags/specials?). kinds 11-14 and 29 appear in most maps with multiple copies (weapons/ammo/health/spawns?).
- id is 9001.. (0x2329..). The distribution falls off with value (9001: 485, 9002: 157, 9003: 143, ...), so it is most likely 9000 + slot index within the tile. Guess.
- v is 4 in most rows, sometimes 0/2/6. Unknown.
- The last u32 is stale memory: it often repeats bytes of neighbouring records. Likely junk.

The decoder outputs attachments as `items` with the parent tile's x,y,z. No position within the tile has been found yet.

## 3. TSFP

## 3.1 TSFP settings chunk 0x68

| Off | Field | Confidence |
|---|---|---|
| 0x04 | **tile record count** (matches the parsed count in all 80 valid maps; mismatches in corrupt ones) | confirmed |
| 0x08,0x0A,0x0C | small ints (0x08: 0..41) | unknown (theme? game mode?) |
| 0x18 | 10 x 4 bytes `u16 id, u8 (0x02/0x0F), u8 0xFF`: probably the weapon set | guess |
| 0x62 | char[20] **map name** | confirmed |
| 0x76 | description text | confirmed (text) |
| 0x156 | briefing text | confirmed (text) |
| 0x238 | u32 with bit flags, then **L-4 again**, then 2 u32 | the L copy is confirmed; the rest is unknown |

## 3.2 TSFP tile record (chunk 0x69): variable length

Confirmed: all 80 valid maps parse exactly to the chunk end, and the count matches.

| Off | Type | Field | Confidence |
|---|---|---|---|
| 0x00 | u32 | **tile type** (0..44) | confirmed as id |
| 0x04 | u8 | **x** (0..39, so the grid is 40x40) | confirmed |
| 0x05 | u8 | **y** | confirmed |
| 0x06 | s8 | **z level** (-2..3; one outlier at -8) | confirmed |
| 0x07 | u8 | **rotation** 0..3 | confirmed range; direction assumed as TS2 |
| 0x08 | 4 bytes | byte 0 is in {0,1,2,3,4,6,...}; maybe per-tile theme/texture set | guess |
| 0x0C | RGBA | light colour 1 | likely |
| 0x10 | RGBA | light colour 2 / ambient (usually 101010FF) | guess |
| 0x14 | u32 | usually 0; otherwise a float pattern | unknown |
| 0x18 | f32 | usually 0.25 (also 1.0, 0.45, 0.0) | unknown (light radius/intensity?) |
| 0x1C | u32 | **n_items** that follow the record | confirmed |
| 0x20 | u16 | **n_links** | confirmed |
| 0x22 | u16 | 0/1/0x100/0x200/0x300... | unknown |
| 0x24 | u16 | **record length** without items (>= 0x28) | confirmed |
| 0x28 | 8 x n_links | cell links: `u16 my_cell_id, u16 neighbour_cell_id, u32 flag(0/1)` | likely |
| reclen | items | n_items x (24 + 4n) bytes (3.3) | layout confirmed |

**Cell link graph (likely).** Every grid cell of every tile gets a global id starting at 1001 (0x3E9), allocated consecutively per tile. A 3x3 room uses 9 ids. Links pair a boundary cell of this tile with the neighbour tile's cell, and they appear in both directions. In Hallway 2, the room at (19,26) has cells 0x3EB..0x3F3 linked to tile 18 at (19,25), which links back. This graph is the in-game connectivity (navigation/portals), and it would be the best ground truth for exits.

**Footprints.** The same min-corner rule as TS2 gives the fewest overlaps. Per-type sizes are in `TSFP_SIZE`:
- 1x1 for types 1, 6, 8, 9, 14, 15, 17, 27, 30, 35-38, 40: confirmed. Linked neighbours are at +-1.
- 3x1 for types 10, 18, 19: likely.
- 3x3 for types 11, 12, 13, 16, 20, 21, 23-25, 31-33, 39, 41: likely (neighbours at +-3; about 9 cell ids).
- The other sizes are guesses.

Some TSFP maps contain **exact duplicate tile records** at the same position (e.g. STARGATE). This is real data (most likely the stacking glitch), not a parse error. The decoder keeps the duplicates.

## 3.3 TSFP item (24 + 4n bytes)

| Off | Field | Confidence |
|---|---|---|
| 0x00 | u32 0/1/2/0xFFFFFFFF | unknown (team? 0xFFFFFFFF on kinds 10-13) |
| 0x04, 0x08 | u32 | unknown (slot/position within tile?) |
| 0x0C | u32: low byte = **item kind** (0..77). The upper bytes are sometimes flags. | likely |
| 0x10 | u16 0..7, mostly even, so maybe **facing in 45 deg steps** | guess |
| 0x12 | u16 usually 0xFFFF | unknown |
| 0x14 | u8 n, 3 bytes | n confirmed |
| 0x18 | n x u32 refs: object ids (9001+, e.g. 0x232A) or cell ids (1001+). These are probably logic links (e.g. a switch to a door). | likely |

Kinds 10-13 occur at most twice per map (team-based: flags/bases?). Kinds 15 and 16 occur at most once.

## 4. Validation done

- Container: in all 36 TS2 and 80 TSFP files, the chunk walk lands exactly on the end marker at 0x880+L (TS2) or 0x884+L (TSFP).
- Tile count: equals the header count in all valid maps (36 + 80).
- Shape checks on the ASCII previews (`out/*.txt`), with symmetry measured over footprint cells:
  - TS2 "Plus", level z=1, is a plus: a 3x3 centre and 3-wide arms. Its symmetry is 180 deg rotation 0.68 and mirror 0.67, because the corner pieces on level 0 are not symmetric.
  - TS2 "Clover": a ring corridor of types 1/2 around 3x3 rooms. It is exactly symmetric (1.00) under 90 deg rotation and both mirrors.
  - TS2 "Maze": a dense field of 1x1 corridor pieces (straights/corners/T's/crosses).
  - TS2 "Symmetry": 0.77 type-match under 90 deg rotation.
  - TSFP "Cloverleaf": exactly symmetric (1.00) under 180 deg rotation.
  - TSFP "Hallway 2": a long (29-cell) mirror-symmetric hallway with matching bases at both ends.
- Rotation direction: corridor exit statistics only work with CCW (2.2).
- Not verified: whether +y is "north" in game, i.e. maps may come out mirrored. The previews print +y upward.

## 5. Unknowns

1. Tile type names / visual meshes per theme, and the exact footprints for rare types.
2. Theme/tileset field (TS2 0x27+0x08 is a guess; TSFP unknown), game-mode/weapon-set/music/lighting settings.
3. Item kind -> item name table. Position of an item within its tile (TS2 has no obvious offset field; TSFP maybe +4/+8). Facing.
4. Vertical semantics: stairs/ramps/lifts (TS2 type 0/4, TSFP 0/2/15 with 2-level cell spans), and what z means in world units.
5. TSFP checksum at 0x884. Not CRC-32 (normal/reflected), CRC-32C, the other common polys, Adler-32, FNV-1a, djb2, or byte/u16/u32 sums over any natural range, with the field zeroed or skipped. Not needed for reading; needed for writing saves back. TS2 shows no checksum in the data block.
6. TS2 chunks 2a/2c/2d/2e/2f, TSFP 6b-6f/70/71/74/75: story-mode logic, AI, objectives, lights?
7. Map orientation (mirror) relative to in-game compass.

## 6. Controlled test saves that would resolve them

Make these in each game's MapMaker on one memory card and export each as a GCI (one change per save):

| # | Save | Resolves |
|---|---|---|
| 1 | Empty map (just the start tile if mandatory), default settings | baseline for every settings field; the minimal chunk set |
| 2 | Same as 1 but with a different theme/tileset (one save per theme) | theme field location |
| 3 | One straight corridor at the default cursor position, rot 0 | coordinate origin; the type id for "straight" |
| 4 | Same tile, rotated 90 deg, 180 deg and 270 deg (3 saves) | rotation encoding/direction (check CCW) |
| 5 | Same tile moved one step east, then one step north (2 saves) | x/y axis direction (mirror question) |
| 6 | Same tile one level up | z encoding |
| 7 | One of each piece in the tile palette, each in a separate save (or one save per piece, placed in palette order) | type id -> name table and exact footprints |
| 8 | A large room at a known cursor spot, rot 0 and rot 90 | anchor convention for multi-cell pieces |
| 9 | Corridor + one weapon pickup; then the same with a different weapon; then the item in a different cell of a large room | item kind table, item position-in-tile field |
| 10 | Same as 9 with the item rotated (TSFP) | facing field |
| 11 | Each player-start / flag / bag / ammo / health / armour item | remaining item kinds |
| 12 | Change one game setting at a time (game type, weapon set, music, lighting, bots) | settings fields |
| 13 | Change one tile's light colour | colour field confirmation |
| 14 | Two saves identical except for one byte of the name (TSFP) | isolates the checksum's input range; then brute-force the algorithm (or read it from the DOL via a disassembler) |
| 15 | One stairs piece connecting levels 0 and 1 | vertical pieces |

## 7. Findings from the converter (`packages/server/src/tools/import-timesplitters.ts`)

- **TSFP cell ids (likely).** Ids are handed out tile by tile from 1001 in record order, and row by row over the footprint at rotation 0 (`id = base + i + w*j`, then rotated like the footprint). With per-type id counts learned from the samples (the most common step between consecutive tiles), 81% of same-level links resolve to two adjacent cells. Several types take more ids than footprint cells: 15 (1x1, 2 ids), 27 (1x1, 3), 42 (1x1, 12), 19 (3x1, 7), 13/20/23/24/31-33/39/41 (3x3, 10-14): probably extra levels (stairs, shafts, tall rooms).
- **TSFP vertical links.** Types 2 (2x1) and 15 (1x1) link to a tile one level up at their far end: stairs/ramps. Most other cross-level links point down (dz -1..-5) from open pieces (17, 16, 10, 42) and are probably sight/drop portals, not walkways.
- **TSFP tiles without links.** 2,049 of 8,892 tiles have no links and sit right over another tile, almost all types 17, 16 and 6 with `b08` byte 0 in {0, 1, 3}. In "Romulus" the whole z=0 layer repeats z=-1 this way. Most likely the upper storey of tall spaces (or outdoor scenery).
- **TSFP `b08` low 12 bits (guess).** Look like 4 sides x 3 segments of per-side flags (bits 0-2 S, 3-5 E, 6-8 N, 9-11 W at rotation 0): the cells along the edge of an open block of type 17 set the bit of their outer side (corner cells two bits). Probably walls or windows along the edge of open areas.
- **TS2 type 14** (1x2) has a same-level exit at its S end and the level above beyond its N end in 61% of placements: stairs up.
- **TS2 type 21** (3x3, exits N and S) meets the level above along its E side in 88% of placements.
- **Tile light colour (likely).** TS2 +12 and Future Perfect +0x0C are RGBA colours from a small palette (channels 00/40/60/80/a0/c0/fe): fefefe on most tiles, 000000 on about 600 (lights off?), and reds, ambers, yellows and blues on whole rooms. The converter turns each into one light of that colour (save 13 would confirm it).
- **Connectivity (assumed from the game).** MapMaker refuses to save a map whose pieces don't all join up, so every area of an original is reachable. Where the converter's reading leaves an area cut off, it joins it back with the smallest change (docs/ORIGINAL_MAPS.md, "Joining up"); about 2,400 floor cells in areas that touch nothing else stay cut off, which points at pieces we can't decode yet (lifts, ladders, tall pieces).
