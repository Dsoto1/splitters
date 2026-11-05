# Sandfall Colosseum rebuild: owner's brief (2026-11-05)

Not started. It follows set pieces (agreed queue item 3). Build with MapMaker's own tools (CLAUDE.md "Maps") and
docs/map-briefs/AGENT_BUILD_CONTRACT.md.

## The owner's words
"Replicate the layout of my game Flavius Rule (classic). It should feel epic, grand, and be much more immersive than
today's map. It should have a Roman village surrounding it and a volcano off in the distance. The arena itself should
use most of the assets we have today, just with better layout and grander scale. Under the stands should be a tunnel
network that goes around the arena. It can branch off to show where the animals are caged or where the gladiators
get their rest and recovery or imprisonment. The village around it could have a main square that leads to the arena
entrance. The colosseum height should be at least 6–8 levels high (if possible). This is your moment to shine!"

On the reference pictures: "disregard the NPCs. It's a 13×13 arena with pillars and a tunnel system under it, which
can connect to the larger arena spaces outside (for this map we are exploring more theme). The stands should be much
more epic and grand; this is just my exact board game layout and I want to expand and imagine more through this map
refresh. I really like the emperor box we already have, so make sure that comes back."

## Reference (in `reference/`)
- `flavius-rule-board.jpg`: the owner's board game arena (Flavius Rule, classic).
- `flavius-rule-seating-chart.jpg`: the same board with its stands.
- `pollice-verso-mood.png`: mood only. Jean-Léon Gérôme's *Pollice Verso* (1872, public domain): a high red podium
  wall with an ornate balustrade, the emperor's box, banners, packed tiers.

## Reading of the board (for the floor plan)
**Floor**
- 13×13 sand floor: a 12×12 grid (rows A–L, columns 1–12) plus a central cross lane at row F/G and column 6/7 that
  splits it into four quadrants, Q1–Q4.
- One cell is about one MapMaker cell.
- Scale it up so the floor reads as a real arena at FPS height. Agree the cell size before building.

**Pillars** (column icons) are cover:
- one near each quadrant's inner corner;
- pairs flanking the central zones;
- one at each end of the north and south zones and of the west and east zones.

Follow the board's positions.

**Gates and access**
- Four corner gates, numbered 1–4: the spawn and entry gates at the corners.
- Four trapdoor hatches (wooden squares) around the centre, at the corners of the inner red zone's ring. These lead
  down into the tunnel network (the hypogeum).

**Zones**
- Five round medallion plates: the centre, plus one at the inner edge of the north, south, west and east zones.
  Good for objective or hill points, or lift-cage risers.
- North and south yellow zones (4 wide × 4 deep at the middle of each edge) and west and east black zones (4 × 4 at
  the middle of each side): four distinct fighting areas.
- The central red zone: two offset 2×2-cell blocks around the centre (the beasts' pit on the board). On this map it
  is the arena's dangerous heart: the spike traps and fire jets of today's map, or lift cages.

**Stands (seating chart)**
- Eight stand sections, two per side, each with its colour marker.
- Dark corner towers at the four corners above the gates.
- On this map they become 6–8 storeys of seating, galleries, arcades and vomitoria, with the emperor's box at the
  centre of one long side (today's `imperial.emperor_box` tile comes back).

## What the map adds beyond the board
- **Tunnel network under the stands:** a ring around the arena, branching to:
  - the animal cages;
  - the gladiators' quarters (rest, recovery, imprisonment);
  - the hatches up into the arena;
  - out to larger spaces outside the arena.
- **Roman village** around it, with a main square leading to the arena's main entrance.
- **Volcano** in the distance, as a backdrop.
- **Assets:** mostly today's Imperial Arena and Roman pieces, at a grander scale. New detail is made in house, as
  set pieces where they repeat: arcade bay, vomitorium, stair tower, tunnel junction, cage block, insula.

## Open (ask the owner)
- Cell size: how big one board square is in metres.
- Modes to support; today's map supports its own set. CTF between gates 1/2 and 3/4, KOTH on the medallions, TDM.
- Which side gets the emperor's box.
