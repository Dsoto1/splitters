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

An homage to Half-Life deathmatch's **Crossfire**, rebuilt from memory with our own kit (script: `packages/server/src/tools/maps/bunker_cross.ts`). Bunker theme, clear sky over desert mesas and sand. Two concrete bunkers face each other across an open 40 × 40 m yard cut in half by a dry canal. Deathmatch and team deathmatch, 6–16 players. Embers spawn in the north bunker and Tide in the south one; 16 neutral spawns in both bunkers, the galleries and the tunnels cover deathmatch.

**Routes**
- **The yard**: open ground with a little cover: two crate stacks, two low walls, broken columns in front of each bunker, concrete barriers, a skip and two explosive drums.
- **The canal**: a 4 m deep dry canal across the middle of the yard. A railed bridge crosses it in the centre, and you can drop in either side of the bridge. Four jump pads throw you back up onto the yard.
- **Bunker halls**: each bunker has a ground-floor hall with three blast doors onto the yard and doorways to the back rooms.
- **Sniper galleries**: a storey up, over each hall, with windows and a firing slit looking over the yard. Stairwells at both ends lead up to them.
- **Tunnels**: under the east and west flanks of the yard. They join the canal through two culverts, each with a blast door, and stairs at each end climb into the tunnel rooms at the corners of both bunkers.

**Key pickups**
- **Railgun**: in the north bunker's storeroom, behind the back rooms.
- **Heavy armour**: in the south bunker's control room, next to the airstrike button.
- **Rocket launcher**: on the canal floor under the bridge.
- **Double damage**: on the bridge.
- **Sniper rifles**: one in each gallery.
- Shotguns, SMGs, big health and small armour are in both bunkers. The tunnels have a grenade launcher, a burst rifle and grenades, and the yard has a rifle and a plasma rifle.

**The airstrike**

The button is in the control room, deep in the south bunker.
- **On the press**: the button switches off. Everyone sees "AIRSTRIKE INBOUND! Get inside!", and the alarm sounds three times over 4 s.
- **At +5 s**: all eight blast doors lock shut: six bunker doors and the two culvert mouths.
- **At +6 s**: 110 charges go off at once, with a boom. They are hidden just under the floor every 4 m across the yard and the canal floor, in the bridge deck, and on top of the crate stacks and ruins.
- **At +8 s**: the doors unlock.
- **At +60 s**: the button comes back on, with a chime.

Anyone outside dies. Each charge is a logic-only proximity mine with 1000 damage that stays disabled except for the one second it fires, so it never goes off underfoot. Walls and the closed doors block the blasts, so the bunkers, galleries and tunnels are safe. Only someone standing in a doorway keeps that door from closing.

Built from the scenario kit:
- one button with a 60 s cooldown;
- a master rule for the alarm, the messages and the cooldown;
- a rule that locks, closes and unlocks the doors;
- eleven rules that each enable, fire and disable ten charges, because a rule holds at most 32 actions.
