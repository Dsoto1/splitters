# FPS homage maps

Maps built in tribute to classic FPS levels: our own names, layouts recreated from memory at our grid scale, built only from the kit in this repo.

## Dockside Depot (`dockside_depot`)

An homage to Counter-Strike's **cs_assault**, rebuilt from memory with our own kit (script: `packages/server/src/tools/maps/dockside_depot.ts`). It is a two-storey warehouse on an industrial lot at dusk. Tide defend inside the warehouse, Embers attack from the road at the south-west corner, and six neutral spawns cover deathmatch. Built for 8–16 players, TDM and deathmatch.

**Routes in**
- **Loading door** (a wide archway, south): from the parking lot, past the semi-trailer, the box truck and the container stacks.
- **Side door** (west): from the alley.
- **Personnel door** (south-east) and **front door** (east): from the east lane.
- **Fire escape to the roof**: two open flights up the alley wall. They stand in for the ladder, since the kit has no ladders. From the roof, two **hatches** drop into the upper level: one onto the south catwalk, one into the north-east office.
- **Air duct**: a cramped 2.3 m sheet-metal crawlway built from free blocks. It starts on the back strip behind the warehouse, climbs 4 m inside, and comes out through the wall of the north-west office.
- **Inside**: the hall is two storeys tall with crates and shelving. Two stairs climb to a ring of catwalks and offices, and a railed bridge crosses the middle. A stair hut in the north-east office leads up to the roof, so defenders can reach it too.

**Key pickups**
- **Sniper rifle**: on the roof among the vents.
- **Double damage**: on the bridge over the hall.
- **Heavy armour**: at the top of the duct.
- **Big health**: on the back strip.
- **Rocket launcher**: in the parking lot between the trucks.
- Other weapons are spread across the alley, the east lane, the lot, the hall, the catwalk and the offices.

## Rail Stockyard (`rail_stockyard`)

An homage to Half-Life deathmatch's **Stalkyard**. Script: `packages/server/src/tools/maps/rail_stockyard.ts`. Factory theme with gravel ground, dusk sky over a city skyline. Deathmatch and team deathmatch, 6–12 players. Embers spawn in the west shed and south-west yard, Tide in the east shed and south-east yard, with six neutral spawns on the dock, catwalk and south yard.

**Routes**
- **The yard**: open gravel with an east-west line of rolling stock (gap in the middle), a south spur of wagons, and cargo stacks one crate high to hop on.
- **Loading pit**: a 3 × 2 cell pit sunk one level into the middle of the yard. Open stairs lead down from the west and the east, there is one open drop on the north side, and a jump pad in the pit throws you back up into the south yard.
- **Culvert**: a tunnel from the pit's south wall under the yard to a T, then west and east to stair huts in the south-west and south-east yard.
- **Catwalk loop**: a covered dock along the north edge with a catwalk on its roof. It joins the upper floors of both sheds, and two flights of open stairs lead up to it from the yard. A boxcar parked against the catwalk lets you walk out onto its roof.
- **Sheds**: two-storey brick sheds, each with an atrium and windows over the yard and the pit. The west shed has a stairwell up to its roof.
- **The perch**: a bare 2.4 m girder runs from the west roof, 8 m above the yard, to a crane perch over the pit. It is the only way to the perch.

**Key pickups**: the railgun on the crane perch; rockets in the culvert mouth below the pit; large armour on the boxcar roof; large health on the pit floor; small armour in each shed's upper rooms; a shotgun on the dock; an auto-shotgun on the catwalk; a plasma rifle in the south yard; a grenade launcher in the pit; a marksman rifle at the west end of the catwalk.

## Bunker Cross (`bunker_cross`)

An homage to Half-Life deathmatch's **Crossfire**, rebuilt to the original's layout with our own kit (script: `packages/server/src/tools/maps/bunker_cross.ts`). Two concrete bases face each other west and east across a courtyard sunk 4 m and open to the sky. Deathmatch, team deathmatch, CTF and King of the Hill.

**Routes**
- **The courtyard**: ramps climb out of all four corners; each base basement has two doors straight onto the floor.
- **The bridge**: a railed bridge crosses the middle at ground-floor height, with rockets on it and the damage boost underneath.
- **Rim catwalks**: fenced catwalks a storey up along both rims, over side halls with slit windows.
- **Sniper nests**: a gallery and a sandbagged roof nest on each base, each with a sniper rifle.
- **Tunnels and the shelter**: tunnels from both bases meet in a shelter under the bridge (railgun); two drop holes in the courtyard lead down, jump pads lead back up.

**The air strike**: a button in a control room off the north side hall (red lamps). It sounds the siren three times and starts a 10 s countdown; at 7 s the four shelter doors lock (amber lamps), at 10 s buried charges go off in a wave across the courtyard, ramps, bridge, catwalks and roof nests. The doors reopen about 17 s after the press; the button rearms after 60 s.

## Backwoods Lodge (`backwoods`)

An homage to Counter-Strike's **cs_militia**, rebuilt from memory with our own kit (script: `packages/server/src/tools/maps/backwoods.ts`). Frontier Saloon theme on terrain, under a cloudy sky with forest scenery. A big three-level wooden lodge stands on the high ground at the north end of a farm property. A creek ravine runs across the south, with pine woods beyond it. TDM and deathmatch, 8–16 players. Embers defend the lodge (8 spawns across the cellar, the garage, the main floor and upstairs) and Tide attack from a camp in the woods (8 spawns). Six neutral spawns cover deathmatch: the barn, the shed, the drain junction, the road, the west field and the hill behind the lodge.

**The lodge**
- **Lower floor** (stone, at yard level): the garage, with two wide doors onto the driveway; a workshop, a laundry, a boiler room and a big cellar; and a side door on the west.
- **Main floor**: a rear door onto a raised back deck with steps down to the yard, and a front door onto a porch with steps down to the drive. Stairs lead up from the garage into the living room.
- **Upstairs**: bedrooms, a bathroom and an attic hall, with windows all round and a balcony over the deck looking straight down the yard.

**Routes**
- **The yard** (centre): an open field rising gently from the creek to the lodge. Cover comes from hay bales, an old stone wall, a hay cart and lone oaks. A fence line with gates runs across it. Getting in means taking the deck steps to the rear door, under fire from the upstairs windows and the balcony.
- **Barn flank** (west): over the footbridge (past the old watermill) to the two-storey barn, then past the outhouse and the woodpiles to the cellar side door. From the barn's hayloft windows you can trade shots with the lodge.
- **The road** (east): over the road bridge and along the gravel road past the shed to the driveway. From there the garage doors lead to the lower floor, or the porch steps to the front door.
- **The drain**: a concrete culvert opens on the creek bed below the yard. It runs north to a junction with a side niche, turns east, then runs north under the whole yard. Stairs at its end climb into the lodge cellar. On the surface it shows as a slightly raised grass strip.

**Key pickups**
- **Sniper rifle**: in the barn hayloft, by the window facing the lodge.
- **Rocket launcher**: in the niche off the drain junction.
- **Heavy armour**: in the roadside shed.
- **Big health**: on the barn floor.
- **Marksman rifle**: upstairs in the lodge. The lodge also has a shotgun in the cellar, an SMG in the living room and small armour upstairs.
- **Grenade launcher**: behind the old stone wall in the yard.
- **Plasma rifle**: on the creek bed under the road bridge.
- **LMG**: by the footbridge.
- **The camp**: a burst rifle, an SMG, small armour and grenades.
