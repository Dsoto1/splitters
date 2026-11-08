# Iron Coast: decisions and deviations

## How it was made
- In MapMaker only (CLAUDE.md, "Maps"): a scratch Playwright driver (not in the repo) works the real MapMaker of a
  `vite preview` build the way a person does: File → New, the Terrain tab's brushes dragged over the ground, the
  palette's cards clicked where they are and the pointer clicked on the map where a ghost is green, R and M to turn
  and mirror, PgUp/PgDn for the level, the inspector's fields, Map properties, and Export to `maps/iron_coast.json`.
  No map file was written or edited by hand or by a script.
- The owner's reference (`shingle_point_reference.jpg`) was unwarped to a rough top-down plan in map metres and laid
  over the ground with MapMaker's **Trace image** (Terrain → Real places, the owner's tool; never saved in the map) to
  build on.
- What MapMaker lacked, added to MapMaker for every map: **oblong terrains** (Create terrain takes a width and depth,
  the grid 2.5 m past 320 m: 380 × 320 m here) and **Flatten to a typed height** (the Terrain tab's "Flatten to (m)");
  and `bot-report` reports **Breakthrough** (sectors taken, when each fell, the outcome, reinforcements left).

## Choices
- **Heights on the 4 m grid.** Set pieces stand on 4 m levels, so the cliff's heights are levels: 8 m at the grand
  stair's gatehouse (its two flights climb two levels: the lowest point of the cliff, as the image has it), 12 m west
  and in the centre, 16 m on the east headland (the highest). The guns: **B1** 8 m on the west promontory (the lowest
  gun), **B2** 12 m at the cliff edge over the stone stair, **B3** 16 m on a knoll set back from the 12 m cliff over the
  wooden stair (B2 and B3 differ in height and set-back, as the image draws them), **B4** 16 m on the headland.
- **No tunnels under the terrain.** The terrain is a height grid (2.5 m apart): it can't overhang, so a room "inside"
  the cliff would have the ground's slope cutting through its front. The pieces at the cliff stand in cuts and coves
  sculpted into it, the ground flattened over each footprint and one vertex round it, so the cliff rises outside the
  piece and never through it. The cave (route 6) is the Cliff Casemate in a cove with the Cliff Stair Tower behind it;
  the tower's top storey stands over the crest as the crest bunker.

## Part 2 (2026-11-08): terrain, plants, the beach's balance, the visual pass
All in MapMaker, driven like a person (the same scratch Playwright driver), Export to `maps/iron_coast.json`.

- **Where the "unnatural and jagged" look came from** (owner, 2026-11-07). Three things, measured on the map:
  1. The **border**: "Cliffs & mountains" on all four sides, ragged peaks 30-60 m tall, standing in the sea south of
     the beach too. The most jagged thing in every picture. Now per side: **Shoreline & sea** south, **Forest wall**
     north, east and west (Sky tab, Border, Per side).
  2. **The heights:** part 1 levelled the cliff top and the crest to exact 4 m levels (5,700 vertices at exactly 16.15
     m, 1,500 at 12.15 m) with the steps between them one grid cell (2.5 m) wide, and the cuts left one-cell spikes and
     pits along the cliff's foot (a 6.4 m spike between 1.5 and 0.6 m ground, ditches at -0.1 m in front of 1 m beach).
     On a 2.5 m grid a step one cell wide draws as a hard edge that zigzags wherever the cliff runs across the grid.
  3. **The paint**: each ground material is its own mesh of whole 2.5 m cells, so material borders are square steps
     (grass squares on the cliff, sand squares at its foot).
- **The grid** (the owner's question: is it the 2.5 m grid?). Partly. The cliff must stay steeper than the 50° players
  and bots can walk up, or the seven routes stop meaning anything; on a 2.5 m grid a 12 m cliff is only that steep over
  one or two cells, and anything that rounds it opens it. Measured (a flood over the terrain at 48°, beach to crest,
  pieces left out): MapMaker's **Smooth all** (Light, ground under every built piece kept) opens about 30 new places
  to climb the cliff, a smoothing that follows the cliff's contours instead 33, a first brush pass with a 3-5 m scree
  apron 30. **MapMaker can't go finer here**: a terrain is at most 161 vertices a side, so 380 m needs 2.5 m.
  *Proposed, not built (owner's call)*: raise the cap to 321 (1.25 m cells) and add **Terrain → Change grid** (resample
  the heights, paint and plants to a finer or coarser grid, one undo step). A 12 m cliff could then be a 60-70° face
  over four to eight cells with a rounded lip and a scree foot, still unclimbable; the cost is four times the terrain's
  triangles (collision, navmesh, drawing) and a map file about 400 KB larger.
- **So the brushes worked inside that limit** (every pass checked with the same climb flood; nothing new opened):
  the cliff's foot levelled to the beach's 1 m 1.5-9 m in front of the face (Flatten to 1 m: the spikes and pits
  gone), a low scree apron raised against the face (Raise, varied), the inland terrace banks behind the crest (12 m to
  16 m, one cell apart) softened into grassy banks (Smooth); then **Paint steep slopes as stone**, a ragged band of
  gravel shingle along the foot, and twelve shell craters (Lower, their floors dark earth). Rounding the crest's lip
  was tried and undone: it opened eight places (x -25, -20 and 60-85).
- **Plants** (the brief was silent; part 1 was a greybox): the foliage layer painted Overgrown in a band 3-12 m behind
  the crest, Lush on the bluffs' faces (stone grows pebbles and a few shrubs) and round the village and the fort,
  Grassy elsewhere on grass; **none on the sand or the shingle** (Bare). Props, all with the scatter brush or the
  Props palette: 114 bushes along the crest and at the routes' heads (first the Bushes set; its Kenney bushes were
  teal and toy-like, so the patches were cleared and planted again with our Broadleaf Shrub, `?env=1`'s procedural
  shrubs: 109 of them, 5 Kenney left; walk-through, they conceal, bots treat them as cover), 24 trees on the flanks and behind the village (Leafy woods), 32 hedges in four hedgerows on the
  flanks' fields, all out of the beach's and the fields' main sightlines.
- **The beach**: 43 Czech hedgehogs in three ragged bands, 10 Belgian gates in the surf, 19 tank traps in short rows by
  the cliff's foot, two cold wrecks and two **burning wrecks** (the prop finished: smoke column `smoke.wreck`, a steady
  campfire flame; nothing flashes, Reduce flashing or not), twelve craters. The **Belgian Gate** (Element C) was missing
  from the palette, so it is a new kit prop (`prop.belgian_gate`, built in code like the hedgehog: collision along its
  members, metal surface).
- **Stair feet (routes 1 and 5)**: both stairs climb out of a cut in flights, and the ground beside the first flight
  ramps up under the next flight's floor slab: a wedge bots walked into and stuck. Each side of the flight now has a
  solid concrete cheek (Sky Blocks): route 1 two 1.9 × 8 × 10.4 m cheeks beside the second flight and the top of the
  first (x -156..-148, z -54.5..-44), route 5 two 2.9 × 4 × 1.9 m cheeks where the first flight meets the second (x
  44..47). The cut is no wider; the wedges are gone.
- **Beach balance, option 1a**: Breakthrough's defenders post a step behind each sandbag wall within 60 m of a
  sector's objectives, nearest first, before the crest's trenches 50 m back. Ten sandbag positions (six walls, four
  stacks) in front of A1 and A2 put the defenders' trench share at the strongpoints. That alone left A falling in 40-70
  s (the stairs fixed at the same time made the attack stronger: six breakthroughs in six), so half the beach sector's
  defender spawns moved from the crest's back (z 10) to the cliff top over the zones, and a machine-gun nest
  (`turret_mg`) went behind each strongpoint's sandbags (the defenders' gun crews, a quarter of them, post there
  first). The numbers: HANDOFF's Iron Coast entry.
- **Haze 0.4, mist 0.2** (golden hour, the sunset sky kept).
