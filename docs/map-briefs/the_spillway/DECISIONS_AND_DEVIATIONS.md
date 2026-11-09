# The Spillway: decisions and deviations

From the approved brief `docs/map-briefs/MAP_02_The_Spillway.md` and its reference `spillway_reference.jpg` (the
owner moved map builds into the MapMaker lane on 2026-11-08 and approved this brief). Branch `wip/mapmaker-spillway`.

## How it is made
- In MapMaker only (CLAUDE.md, "Maps"). A scratch Playwright driver (in the agent's scratchpad, not the repo) works
  the real MapMaker of a `vite preview` build as a person does: New map, Map properties (ID `the_spillway`, name,
  modes, teams, players, weapon set), Environment → Terrain (Create terrain, the brushes held and dragged in the plan
  view: Flatten at typed heights, Raise, Smooth, Paint), the palette's cards and a click where the ghost is green, R to
  turn, PgUp/PgDn for the level, the inspector (block sizes and materials, room options), the Walls tool, the card-shot
  camera, Export to `maps/the_spillway.json`. No map file written or edited by hand or by a script.

## Plan (the layout, before building)
Orientation: north (+Z) is upstream. Cells of 8 m (cell (x, y) is centred on world (8x, 8y)), levels of 4 m.

- **The dam** across the gorge's north side: a concrete gravity dam (solid concrete blocks), its crest a 16 m wide
  road 16 m up (level 4) running about 190 m east to west; the reservoir behind it to the north (outside the play
  area). Long range along the crest.
- **Intake towers** on the crest's upstream side: concrete towers out of the reservoir with a gate house each on the
  crest.
- **Powerhouse** at the dam's foot (mid level): one connected building of two turbine halls (generator halls) joined
  by a machine/control block, doors between them and out to the toe deck; stairs up to the crest. Close range inside.
- **Downstream rocky basin** (low, level 0): the tailrace river out of the powerhouse running south, rocks and pines,
  two deliberate crossings.
- **West maintenance yard** (the larger wing): terraces stepping from the crest's west abutment down to a
  maintenance terrace and the basin; a service road up the terraces; loading dock, sheds, containers. Medium range on
  the terraces.
- **East wing** (the smaller wing): the **switchyard** on a terrace at the dam's east abutment (transformers, pylons)
  and the **east service tunnel**, a roofed gallery through the rock from the basin to the switchyard side.
- **Spine**: three parallel east-west lanes (the crest; the powerhouse halls; the toe deck and basin road) tied by a
  small number of north-south connections (stairs and ramps), so not a web of platforms.

## Choices (the conservative option where it is the owner's call; questions in the report)
- **Scale**: Battlefield, 24 v 24 by default, playable to 32 v 32 (the brief says 32-64 players), within
  MAP_BUDGETS' large-map and 48 v 48 budgets.
- **Modes**: Team Deathmatch main, Capture the Flag and King of the Hill offered (the brief's three).
- **Spawns, pickups, objectives** (the brief leaves them open and says not to invent them on the concept): placed so
  the map plays, and listed for the owner to confirm.
- **No vehicles**: the brief says vehicle placements are not specified. The service roads are wide enough for them
  later.
- **Weapon set**: Military (an industrial dam), to be confirmed.
