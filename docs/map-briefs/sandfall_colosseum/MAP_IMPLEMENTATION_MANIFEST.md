# Sandfall Colosseum: implementation manifest

| | |
|---|---|
| Map | `maps/sandfall_colosseum.json` (id `sandfall_colosseum`, "Sandfall Colosseum": id kept) |
| Source | The owner's brief `BRIEF.md` (2026-11-05) and `reference/` (the Flavius Rule board, its seating chart, Pollice Verso for mood) |
| Author / date | Tile Trigger, rebuilt in MapMaker 2026-11-08 (branch `wip/mapmaker-sandfall`) |
| Status | In progress: see "Progress" |
| Weapon set | Medieval |

## World
- Terrain 320 × 320 m, vertices 2 m apart (161 × 161), x −160..160 (east), z −160..160 (north). Standard grid: 8 m
  cells (cell (x, y) centred on world (8x, 8y)), 4 m levels; the arena's centre is the origin.
- Ground: dirt at −0.15 m; under the sand (x, z within ±26 m) flattened to −1.5 m, so the hypogeum's floors (level −1,
  −4 m) pull the ground down under them and the hatches open through to the halls below.

## Progress
- 2026-11-08: map cleared in MapMaker (Import, drag-box Delete on levels −1..2, the old rules deleted), terrain
  created, the sand's ground flattened; the north stands being placed.
