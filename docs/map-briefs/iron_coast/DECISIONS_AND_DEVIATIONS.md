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
