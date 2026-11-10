# The Spillway: decisions and deviations

From the approved brief `docs/map-briefs/MAP_02_The_Spillway.md` and its reference `spillway_reference.jpg` (the
owner moved map builds into the MapMaker lane on 2026-11-08 and approved this brief). Branch `wip/mapmaker-spillway`.

## How it is made
- In MapMaker only (CLAUDE.md, "Maps"). A scratch Playwright driver (in the agent's scratchpad, not the repo) works
  the real MapMaker of a `vite preview` build as a person does: New map (Sky map, then Environment → Terrain → Create
  terrain 320 × 240 m), Map properties (ID `the_spillway`, name, theme, boundary, modes, teams, players, weapon set,
  description), the Terrain tab's brushes held and dragged in the plan view (Flatten at typed heights, Smooth, Paint,
  Paint steep slopes as stone), the palette's cards and a click where the ghost is green (R to turn, PgUp/PgDn for
  the level), the Entities tab's blocks and water sized in the inspector, spawns, flags, hills and pickups with their
  tools, props and the scatter brush, Sky's backdrop, the card-shot camera, Export to `maps/the_spillway.json`. No map
  file was written or edited by hand or by a script.
- Selecting a placed block, water or spawn again to correct it in the inspector used MapMaker's own selection (the same
  call its issues list makes); every change went through the inspector's fields.

## Layout as built (cells of 8 m: cell (x, y) is centred on world (8x, 8y); levels of 4 m; north (+Z) upstream)
- **The dam**: four concrete blocks (Bunker-grey PBR concrete) x −100..100, z 76..92, top at 16 m (level 4): the crest
  road, 16 m wide and ~200 m long, the long-range lane. Parapets both sides: 1.4 m upstream (nobody jumps into the
  reservoir), 1.1 m downstream with gaps where the stair towers and the roof stair arrive. A gantry crane and concrete
  barriers on the crest for cover.
- **Intake towers**: three concrete shafts (10 × 10 m, to 22 m) out of the reservoir against the crest's upstream face,
  spaced unevenly (x −56, −8, 48).
- **The reservoir**: water to 13 m behind the dam (z 92..120), inside the boundary at its near shore (the boundary
  runs at z 107); the crest's 1.4 m parapet and short parapets at the abutments keep players out of it.
- **The powerhouse** (mid level, floor at 4 m, level 1), one connected building at the dam's toe, x −52..36: a Loading
  Dock as the erection bay (west), two Power Core Halls side by side as the generator halls (their doors and gallery
  doors meet, so the halls open into each other on both floors), the Server Vault turned half round as the control
  room (east). Close range inside. Its roof (12 m) is a deck; an Open Stairs flight climbs from it to the crest.
- **The dam toe**: the toe terrace at 4 m (z 28..92) in front of and behind the powerhouse; the strip between the
  powerhouse and the dam face; two Stair Towers (4 levels) up the dam face from the toe to the crest (x −64, 56), their
  tops lookouts over the crest. A 4 m retaining edge drops to the basin, crossed by a Grand Flight (west) and a Long
  Ramp (east), with the tailrace valves and pipework on the deck.
- **The downstream basin** (low, 0 m): the tailrace river (water to −0.8 m in a 3 m deep channel) runs south from
  under the powerhouse, bends west and leaves to the south; a Catwalk Bridge (3 cells) and a concrete weir walk cross
  it; a Bunker Cluster guards the south-east; our pines and rocks round the edges.
- **West maintenance yard** (the larger wing): the yard terrace at 8 m (level 2) with two Barracks, a Vehicle Shed, a
  Guard Tower, containers and tanks; the upper west terrace at 16 m (the dam's west abutment) with a Stair Tower up
  from the yard; graded ramps (terrain) from the basin up to the yard and from the yard to the upper terrace; a Ramp
  Junction (two levels) from the basin to the yard's edge; Open Stairs from the toe up to the yard.
- **East wing** (the smaller wing): the switchyard at 16 m (the east abutment: transformers, power poles, a Barracks as
  the control house, a Guard Tower), a graded ramp road down its east side and a Stair Tower down to the east toe yard
  (4 m); the **east service tunnel**: eight Vaulted Tunnel tiles (64 m) through a rock spur from the east service yard
  to the east toe yard, under a rock roof (a free block in PBR rock); the service yard ramps down to the basin.
- **Spine**: three parallel east-west lanes (the crest; the powerhouse's halls and the toe deck; the basin with the
  river) tied by a few north-south connections (the stair towers, the roof stair, the grand flight and ramp, the tunnel,
  the wings' ramps), so not a web of platforms.

## Choices (the conservative option where it is the owner's call; questions in the report)
- **Scale**: Battlefield, 24 v 24 by default (`teamSetup`), 16-64 recommended players, 64 spawns (32 a side) so it holds
  32 v 32. MapMaker's teams panel says a match holds 32 (the offline / test cap); a hosted match takes the 48-64.
- **Modes**: Team Deathmatch main; Capture the Flag and King of the Hill follow from the two flag bases and three hills
  (and Elimination, Fort Wars, Roulette and Zombies from those, as on every map).
- **Spawns, flags, hills, pickups** (the brief leaves them open and says not to invent them on the concept; the map
  can't play without them): Embers in the west maintenance yard (and 4 on the upper west terrace), Tide in the
  switchyard, the east toe yard and the east service yard. Flags: the west yard and the switchyard. Hills: the crest's
  middle, the east generator hall, the basin by the catwalk bridge. Pickups by range: the sniper on the crest,
  marksman rifles on the two abutments, shotgun and SMG in the generator halls, the LMG at the bunker cluster, rockets
  on the toe deck, rifles in the basin, grenades by the loading dock and in the tunnel, health and armour spread.
- **Weapon set**: Military (an industrial dam), for the owner to confirm.
- **No vehicles**: the brief says vehicle placements are not specified. The yards' ramps and the east road are wide
  enough for them later.
- **No Reactor Room**: its reactor core is a nuclear reactor; a hydro plant's generator halls are the Power Core Halls
  (a turbine drum under the gallery). The Server Vault is the control room; the Loading Dock is the erection bay.
- **Lights**: only the set pieces' own (36): steady, nothing blinking; Reduce flashing is untouched.
- **Foliage**: our pines (Pine forest scatter: env pines and spruces) only; no Kenney plants. Rocks from the Rocks
  scatter set.

## Deviations from the brief and the reference
- The reference shows the powerhouse as a broad deck over the tailrace with several pools and falls; here it is one
  building on the toe terrace with the river leaving from under it: water limited to the reservoir, one tailrace and
  the weir (the brief: no ornamental waterfalls, no canals).
- The reference's many small platforms between the falls are left out (the brief: not islands of platforms).
- The east service tunnel's roof is a free block of rock over a cut (MapMaker's terrain is a height grid: it can't
  hold a hole through a hill), so from the spur's top it reads as a rock cap, not unbroken hillside.
- The intake towers are solid concrete shafts (no interiors): the brief names them as landmarks, not routes.

## MapMaker findings (for the next map build)
- The ground under a floor is lowered only within 3 m of the floor's top (FLOOR_REACH): a tunnel or room buried
  deeper keeps its hill over it. Cut the slot with Flatten at the floor's height, then roof it.
- New terrain sits 0.15 m under a level; with a flight's first 0.25 m step that is a 0.4 m lip bots can't climb, so
  a stair from the ground is cut off at its foot. Flatten the ground at a stair's foot to the floor's height (0 m on
  the ground level).
- The Flatten brush levels at a steady rate a frame: on a busy machine hold each dab (300 ms or more), or the ground
  stops short of the height; two flattened areas side by side leave a ditch between them unless they overlap.
- The inspector sometimes drops the first edit after a placement (it redraws): check each field and set it again.
