# Sunken Kingdom: decisions and deviations

Differences from the approved reference image and the brief, and the choices made where they leave room. Items marked
**Owner** are ones the contract says to ask about; they were not decided beyond what is described here.

## Open questions for the owner

1. **Owner: the dome.** The image's palace has a domed courtyard. MapMaker has no dome piece, so the courtyard is a ring of
   four Round Arcades (32 m across) round a fountain, open to the sky: it reads as a ruined dome's drum. A real dome (or the
   shell of a fallen one) needs a new model: listed under "Meshy" below. Nothing was invented in its place.
2. **Owner: tier height.** The upper terraces are one MapMaker level (4 m) above the town, the flooded courts about 1.7 m
   below it. The image suggests taller cliffs (8 m or more). Going to two levels doubles every stair (two flights per climb)
   and lengthens the map's routes; asked rather than done.
3. **Owner: CTF with bots.** Flags sit in each team's base (Embers at the colonnade, Tide in the gatehouse court), 190 m apart
   by the shortest route. Bot-only 8 v 8 CTF took and returned the flag but did not capture in 7 minutes (QA_REPORT.md).
   Moving the flags nearer the middle would change the bases; asked rather than done.

## Deviations from the image

| Image | Built | Why |
|---|---|---|
| Domed palace courtyard | Round arcaded courtyard, no dome | No dome piece (see question 1) |
| Tall golden cliffs round the city | 4 m sandstone-faced terraces inside; dunes rising 9–16 m outside the bounds, rock spires and boulders at the edge | One-level tiers (question 2). The "cliffs" border was tried and dropped: its 30 m red walls boxed the oasis in and hid the dunes |
| Many separate turquoise pools and channels | Four flooded courts (lagoon, north pool with its channel and spring, SE channel and basin) plus the west feed, the cistern and two palace pools: 10 water bodies | Water is an axis-aligned box in the format: each court is a terrain basin under one box, so a winding channel becomes straight runs |
| Waterfalls from the terraces | Three `prop.jg_waterfall` falls: north cascade (into the north pool), west feed (into the lagoon), palace drain (into the SE channel) | The Jungle Ruins waterfall is the only falls piece; it is drawn only (no current) |
| Bridges and causeways over the water | None: crossings are wading (0.95 m deep) and dry shores | The brief: "Avoid adding more bridges", "water must not be the only obstacle" |
| A wide rooftop network | Local rooftop clusters only: palace west wing, palace east wing, market arcade walkways, the two pylon terraces, the temple | The brief: "rooftops connect locally, not continuously" |
| Image proportions | 192 × 176 m, palace 48 m square | The image sets no scale; sized for 16–32 on foot (flag to flag ~37 s at run speed) |

## Decisions where the brief leaves room

- **Districts** (from the image's layout, north at the top): palace in the middle; western colonnade on the west terrace
  overlooking the lagoon; market arcade north-west on the upper tier; north gate and spring at the top middle; temple terraces
  (stepped temple, hypostyle hall, sanctuary) north-east; eastern gatehouse on the east edge; round fountain court south-east;
  sphinx avenue and arch at the south; ruined houses south-west.
- **Bases are not mirrored**: Embers hold an elevated colonnade with a cliff edge and two stairs down; Tide hold a ground-level
  gate court behind a pylon with a terrace. Spawns: 16 per team in each base, 24 free-for-all spread over every district.
- **Buried cistern**: tunnels at level -1 under a paved road (the road's tiles are its roof), a flooded columned hall
  (rockets), sunken stair courts open to the sky at the west, east and south ends. Tile stairwells could not be used: the
  terrain above a level -1 stairwell fills its shaft, so each entrance is a 4 m deep court cut into the terrain with Open
  Stairs placed on level -1 and sandstone retaining walls.
- **Weapons** (registry ids, see the manifest): snipers on each base's high point (colonnade cliff edge, gatehouse pylon),
  a marksman rifle on the temple shrine and another in the lagoon, shotguns and SMGs in the market and the cistern, rockets in
  the cistern hall (the bypass is worth taking), the launcher and big armour in the palace, the LMG in the east quarter's hall,
  the flamethrower by the SE channel, rifles in the outer courts.
- **King of the Hill**: hills at the palace courtyard, the market lane, the fountain court and the temple terraces.
- **Vehicles**: none (the brief: foot movement).
- **Look**: theme Sands of Egypt (`core.egypt`); Egyptian facades on rooms; Jungle Ruins props for the falls, carved pillars,
  fallen blocks and the colossal head; sky "sunset" for the golden light, dunes scenery.
- **Palace roof access**: the west wing's roofs are reached by climbing vines (a MapMaker ladder) as well as a stairwell door.

## How it was made (and how that differs from hand-editing)

Everything is MapMaker's own data and edits: tiles from the catalog, blocks, props, water, spawns, pickups, flags, hills,
lights, a ladder, terrain via `setTerrain` (the command every terrain brush stroke issues), map settings via the inspector's
commands, and MapMaker's **Settle on ground** for the props. The edits were written as a list of MapMaker edit commands in a
scratch script (not committed), replayed in MapMaker in a browser through its editor (`EditorApp.run`, New → Large → Sand
first) and saved with MapMaker's **Export** button. The terrain heights were computed for the planned tiers and basins and
applied as whole-terrain edits rather than painted stroke by stroke with the mouse; anyone can keep sculpting them with the
brushes. Nothing was added to MapMaker: every piece the map needed already existed. No map build script is in the repo.

MapMaker's export stamps `metadata.release` (map id, version, content hash). The shipped file leaves it out, like the other 89
maps in `maps/`: the stamp's hash no longer matches after loading (the loader settles terrain under floors), which made the
validator warn "changed since it was exported".

## Brief wording

The brief's anti-repetition clause says not to reuse "the overhead silhouette, mirrored placement, water distribution, or
radial bridge network of Sunken Kingdom or The Spillway" (a clause shared across the briefs). Read as: do not copy The
Spillway or any other existing map. There is no map called The Spillway in `maps/` today.

## Meshy (owner's subscription) wish list

Not generated; for the owner to approve:
1. **Ruined sandstone dome**: a half-collapsed dome on a round drum, ~20 m across and ~12 m tall, broken open on one side,
   weathered gold sandstone with a band of carving; to stand over the palace's round courtyard (visual, no collision needed
   beyond its drum).
2. **Carved waterfall spout**: a lion or serpent head spout set in a 4 m sandstone terrace wall, water pouring from its mouth;
   for the north cascade and the west feed so the falls read as built ruins rather than a natural fall.
