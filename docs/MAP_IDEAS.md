# Map ideas: what we could build with today's kit

32 original map concepts built only from what Tile Trigger already has: the
core tiles, the seven Style Packs (01 Military Compound, 02 Frontier Dust, 04
Orbital Station, 05 Gothic Estate, 06 Jungle Ruins, 07 Neon Megacity, 08
Suburban Chaos), the v20 logic kit (lights, blocks, movers, team filters),
force fields, low-gravity zones, liquids, traps, jump pads, vehicles, the
transport plane, NPC squads and creatures, playlists and every game mode.
Imperial Arena and Egypt are being finished now, so **portals**, **cage lifts**
and **portcullis movers** are counted as available; where an idea depends on
how they behave (whether a portal can be switched by logic, say), it says so.

None of these repeat a map already in `maps/` (Dustwater's station train,
Neon Spire's glass elevator, Hollowmere's trap manor, Primeval Park, Runway
Nine, Iron Tide, Ironhold Prison and the rest were checked). Where an idea is
close to one of them, it says what makes it different.

**How to read an entry.** *Kit* lists the features that make the signature
moment work. *Gap* lists a small thing the kit lacks; every concept works
without it, and the gap says what it would add. Complexity: **S** is about a
day of scripting in `tools/maps/`, **M** a few days, **L** a week or more with
heavy logic or a large terrain. Budgets are from [MAP_BUDGETS.md](MAP_BUDGETS.md):
150 breakable, crumbling or trapdoor blocks, 300 active pieces, 80 prop
models, 3,000 solid blocks.

## Index

| # | Map | Group | Modes | Players | Build |
|---|---|---|---|---|---|
| 1 | Crashsite Verdance | Immersive | CTF, TDM, Co-op variant | 8–16 | M |
| 2 | Sunken Nave | Immersive | DM, TDM, KOTH | 4–12 | M |
| 3 | Motherlode | Immersive | Bomb, TDM | 8–12 | M |
| 4 | Gull Rock Light | Immersive | Hostage, Elimination | 6–10 | M |
| 5 | Floodgate | Tactical | Bomb, Elimination | 8–10 | M |
| 6 | Shoot House | Tactical | Elimination | 6–10 | S |
| 7 | Fogbound | Tactical | CTF, TDM | 12–24 | S |
| 8 | No Man's Field | Tactical | CTF, TDM | 8–16 | S |
| 9 | Clockwork | Tactical (duel) | DM, TDM 2v2 | 2–6 | S |
| 10 | Express Lobby | Spectacle | KOTH, TDM | 8–16 | M |
| 11 | Meltdown Protocol | Spectacle | TDM, Elimination | 8–16 | M |
| 12 | Crater Lair | Spectacle | Bomb, CTF | 8–16 | L |
| 13 | Crash Bowl | Spectacle | DM, TDM (vehicles) | 8–16 | S |
| 14 | Low Bridge | Out of the box | Bomb, TDM | 8–12 | M |
| 15 | Erosion | Out of the box | DM, Elimination, Disc Arena | 4–12 | S |
| 16 | Sinking Atoll | Out of the box | KOTH, TDM | 8–16 | M |
| 17 | Möbius Halls | Out of the box | DM, TDM, CTF | 4–10 | M |
| 18 | Feather and Lead | Out of the box | CTF (Classes), DM | 8–12 | S |
| 19 | Matchstick Hotel | Out of the box | TDM, Elimination | 6–12 | M |
| 20 | After Hours | Co-op | Co-op | 1–8 | M |
| 21 | Grand Larceny | Co-op (playlist) | Co-op chain | 2–8 | L |
| 22 | Iron Caravan | Co-op | Co-op escort | 2–8 | M |
| 23 | Tomb of Nine Gates | Co-op | Co-op | 1–8 | L |
| 24 | Beast Games | Co-op | Co-op waves | 1–8 | M |
| 25 | Operation Highwire | Large scale | TDM + objectives | 32–96 | L |
| 26 | Interstate Rumble | Large scale | TDM, KOTH | 16–32 | M |
| 27 | Coral Crown | Large scale | CTF | 16–48 | L |
| 28 | Avalanche Run | Large scale | Race (combat) | 4–12 | M |
| 29 | Wheel of Peril | Party | Team 4v12, custom logic | 8–16 | M |
| 30 | Midnight Midway | Party | Zombies, DM | 4–12 | L |
| 31 | Pantry Raid | Party | TDM, CTF, DM | 6–12 | M |
| 32 | Sushi Belt Sumo | Party | Disc Arena, DM | 4–8 | S |

---

## 1. Immersive set pieces

### Crashsite Verdance
**Hook:** an orbital module fell into the jungle a year ago, and the jungle is winning.

**The fantasy.** You fight through a white sci-fi corridor tilted 20 degrees,
step out of a torn hull into a waterfall basin, and the reactor that brought
the ship down still hums, so its hall floats.

**Layout sketch**
- The wreck runs diagonally across the middle. Its corridors are Orbital Station rooms rebuilt as pitched blocks (15–25 degrees, every slope walkable), so whole wings lean.
- The Reactor Hall survived intact in a crater, with a low-gravity zone (0.35) and coolant leaking into a green-tinted acid pool under the catwalk.
- On the jungle side are a Stepped Temple the ship clipped (half its top terrace replaced by a hull section), Giant Trees with plank flights, and a River Channel.
- At the breach, a torn hull wall (Broken wall edges, Climbing Vines up through the gap) joins the wreck's upper deck to the canopy walks.
- Bases sit at both ends: a Salvager camp (Military tents, Floodlight Masts) and a temple shrine.

**Signature moment.** You sprint up a leaning corridor, drop through a
viewport into the reactor hall and float down past the core while someone
lobs goo at you from the catwalk. *Kit:* pitched blocks, Low-Gravity Zone,
tinted Acid, Climbing Vines, Space Viewport props, Overgrown rock facade.

**Modes and players.** CTF and TDM, 8–16. A co-op variant has Oculi and
Cyclopes nesting in the wreck.

**Packs and props.** Orbital Station (hull facade, reactor core, cryo pods,
trusses, floor cables), Jungle Ruins (giant root, liana, vine curtain,
waterfall), Military (tents, floodlights).

**Why it's fun.** The fight changes as the floor tilts. Leaning corridors
make strange sightlines, and the floaty reactor is a reward room.

**Build:** M.
**Gap:** none needed. A *tilted room* tile option would save hand-building
the leaning corridors out of blocks.

### Sunken Nave
**Hook:** a Gothic cathedral flooded to the pews; the crypt is fully underwater.

**The fantasy.** You wade a candlelit nave chest-deep, stained glass glowing
above, and hold your breath to swim the drowned crypt for the railgun.

**Layout sketch**
- The nave is a Great Hall with Column rows, flooded 1.4 m deep with grey-green tinted Water. Pews show above the surface as low cover.
- Side aisles are Raised Ledges, dry, walked in single file between columns.
- The crypt sits a level below and is fully submerged. A 10–12 s swim reaches an air-pocket chamber (a room whose ceiling sits above the water line) holding the railgun. Drowning starts at 15 s, so the swim back is tense.
- The organ loft is a balcony over the west door, and the bell tower a Watchtower with the sniper rifle.
- The cloister garden outside is dry ground with a Cemetery Plot and a Mausoleum, with the crypt stairs coming up inside it.

**Signature moment.** In the crypt swim the view goes blue and hazy and you
can hear someone else coming the other way. *Kit:* Water depth and
drowning, liquid *Colour*, Candelabra and Chandelier lights guttering
(blink), Gothic stone facade.

**Modes and players.** DM, TDM and KOTH (the hill is the altar dais, which
sits just above the water), 4–12.

**Packs and props.** Gothic Estate (candelabra, chandelier, sarcophagus,
weeping angel, tall headstones, portrait), Gothic theme, Ruins props as
fallen masonry in the water.

**Why it's fun.** Water slows everyone in the nave, so the dry aisles and
the loft matter. The crypt is a high-risk detour for a power weapon.

**Build:** M.
**Gap:** a *Water surface caustics/underwater light* tweak would sell it; not
needed.

### Motherlode
**Hook:** a frontier gold mine that goes down five levels, and the bottom is lava.

**The fantasy.** Claim jumpers descend a working mine with dynamite while
prospectors defend the two richest seams, riding ore carts through the dark.

**Layout sketch**
- The surface is a pithead (Mine Entrance, Water Tower, Livery Stable as the assay office, Wind Pump).
- Three timbered levels are joined by Mine Tunnels, Rock Stairs and a cage lift (Egypt/Imperial kit) as the mine hoist.
- Mine Carts roll on 12 m pingpong runs. Ride one through a tunnel or take cover behind it as it passes.
- At the deepest level, the Glory Hole, a Rope Bridge crosses a chasm over Lava with two crumbling planks in the middle.
- Bomb sites are the North Seam (a stope with timber frames) and the Glory Hole bridgehead.

**Signature moment.** A defender cuts the hoist (button: *Send mover* parks
the cage at the top) and the attackers have to take the long Rock Stair way
down under fire, or jump the Rope Bridge with the bomb. *Kit:* Mine Cart
movers, cage lift, Rope Bridge, Lava glow, Dynamite (throwable and crates
that go up when shot), Bomb sites.

**Modes and players.** Bomb (5v5) and TDM, 8–12.

**Packs and props.** Frontier Dust (mine timber frame, mine rails, ore and
hopper wagons, dynamite crates, buffer stop), Jungle Ruins (Cave Passage,
Cave Mouth, Cliff), fire braziers for light.

**Why it's fun.** It's a vertical Bomb map, which is rare. Dynamite crates
near each site can blow the defenders out of their nest, or blow you up.

**Build:** M.
**Gap:** a *mine lamp* light fixture (hanging lantern) would read better than
bulbs.

### Gull Rock Light
**Hook:** a stormy-night lighthouse where the sweeping beam is the most dangerous thing on the map.

**The fantasy.** Smugglers hold the keeper's family in a sea cave. The
coastguard comes in by speeder under a beam that lights up anyone in the
open.

**Layout sketch**
- The lighthouse is a Round Tower stacked four storeys, with Stairwells and a lamp gallery (Round Balcony) on top.
- A ring of 8 spotlights round the lamp blink on one after another (a repeating timer runs a *Light on/off* sequence), so the "beam" sweeps the cliffs every 4 s.
- The keeper's cottage and boathouse use Victorian brick, with a garage-door boat shed.
- The smugglers' cave runs from a Cave Mouth at the waterline up to the cellar. The rescue zone is the coastguard pier.
- A shipwreck on the rocks is pitched blocks for a broken hull, plus Pirate & Coast props, half in the sea.

**Signature moment.** You're crossing the cliff path when the sweep comes
round, and you have to choose between diving flat behind the wall or
sprinting for it. *Kit:* light sequences from timers and *Flash light*,
Shoreline & sea border, Stormy sky, ground mist in the coves, Hostage
followers, Speeders and Hauler over water.

**Modes and players.** Hostage (Coastguard rescue the family) and
Elimination, 6–10.

**Packs and props.** Gothic Estate (Victorian brick facade, gas lamps), Pirate
& Coast, Military (crates as contraband), Rocks.

**Why it's fun.** The light is a rhythm everyone learns: move in the dark,
freeze in the light. Escorting hostages along a cliff path under that sweep
is tense.

**Build:** M.
**Gap:** a **rotating spotlight** (a cone light carried by a turning mover)
would replace the 8-lamp fake with a real beam.

---

## 2. Tactical and competitive

### Floodgate
**Hook:** a hydro dam where defenders can raise the bridges, at a price.

**The fantasy.** A concrete dam with a turbine hall and a control room;
attackers come up the spillway and across the crest.

**Layout sketch**
- The crest road runs across the top (Compound Wall as parapets), with two Drawbridges over the spillway channels.
- The turbine hall (Warehouse with catwalk gantries) is Site A. The control room (Pillbox-style windows over the reservoir) is Site B.
- The spillway is a River Channel with Water. Wade or swim it under the bridges; it's slow but out of the sightlines.
- An inspection gallery runs inside the dam: Corridor and Stairwell between the sites, the defenders' rotate route.
- The attackers' approach is a gravel road with Shipping Containers and Floodlight Masts.

**Signature moment.** A defender hits the team-only winch button: the
drawbridge lifts for 20 s (alarm lights blink), then the button is on a 45 s
cooldown. Attackers can blow the winch housing (a Destructible Barrier wired
to *Object destroyed* → disable the button) to keep the bridge down for the
round. *Kit:* Drawbridge movers, Team only buttons with cooldown, Alarm
Light, Destructible Barrier, Water swim route, Bomb sites.

**Modes and players.** Bomb 5v5 and Elimination, 8–10.

**Packs and props.** Military Compound (Blast Door on the control room,
sandbags, barriers), Industrial (pipes, valves, tanks), Grey Corrugated.

**Why it's fun.** It's a utility play everyone can see coming. Timing the
bridge to split the attackers' push, and the attackers' answer of killing
the winch first, make a real mind game.

**Build:** M.
**Gap:** none.

### Shoot House
**Hook:** a training shoot house whose walls are rearranged by the defenders before every round.

**The fantasy.** A plywood-and-concrete close-quarters facility.
Defenders pick one of three floor plans in secret, and attackers find out
which one at the first doorway.

**Layout sketch**
- A single-storey 4 × 4-cell building under a Beamed roof, with a catwalk overhead (the instructors' gantry) open to both sides.
- Eight Sliding Walls (trigger movers) stand at room boundaries. Each layout is a set of *Move mover to point* actions.
- The defender spawn has three team-only buttons (Layout A, B and C), enabled only for the first 12 s. Each sets a lamp in the defender spawn to red, blue or green.
- Breakable Planks over two windows give attackers fresh entries.
- The hostage room or bomb site stays fixed; only the routes to it change.

**Signature moment.** Your team stacks on the door you breached through
last round, and it's a wall now. *Kit:* Sliding Wall movers, Team only
buttons enabled by a *Match starts* rule and disabled by a timer,
Breakable Planks, Elimination's per-round reset (the walls go home every
round).

**Modes and players.** Elimination 3v3 to 5v5, 6–10.

**Packs and props.** Military Compound (Bunker concrete, olive corrugated,
ammo crates, target-like warning signs), core Warehouse dressing.

**Why it's fun.** Every round the attackers have to read the house again,
and the defenders' pick becomes part of the meta.

**Build:** S.
**Gap:** a logic **random pick** action, and a variable that survives the
round reset, would add a "house picks" option and alternating layouts.

### Fogbound
**Hook:** trench warfare where the fog fills the trenches and the hilltops stand clear.

**The fantasy.** You move through a white river of mist at head height. Only
the watchtowers and the ridge see over it, and they see everyone who climbs
out.

**Layout sketch**
- A 200 m terrain with trench networks dug 1.5–2 m into it (Trench, Corner, Junction, Fire Step and Dugout tiles), so ground mist pools exactly in them.
- No-man's-land between them is cratered (Rocks scatter, Steel Hedgehogs, Razor Wire, Broken Barriers).
- A central ridge has a ruined chapel (Ruins props) as the only high ground. Guard Towers stand at both base lines.
- Dugouts are the flag rooms, roofed with a single entrance each.
- Mist is set to 85%, with Overcast sky, haze 40%.

**Signature moment.** Mid-push in the trench you see a shape three metres
ahead and can't tell if it's a teammate until the name tag. Climbing a fire
step puts your head up into clear air and in view of the ridge sniper.
*Kit:* ground mist (pools in low ground, thins with height), Trench tiles,
Gas grenades sitting in the trenches, Proximity mines, MG turret on the
towers.

**Modes and players.** CTF and TDM, 12–24.

**Packs and props.** Military Compound (whole trench set, sandbag nests,
camouflage nets, barbed wire), Ruins.

**Why it's fun.** Fog as cover is a mechanic nobody has had on our maps:
fights in the trench are point-blank, while the ridge is a sniper duel above
the clouds.

**Build:** S.
**Gap:** none. A *mist height* setting per map would let it be tuned to the
trench depth exactly.

### No Man's Field
**Hook:** a battlefield split by force-field lanes that open and close on a clock, and you can always shoot through them.

**The fantasy.** Two compounds face each other across a band of five
crossing lanes, each sealed by a humming force field. You can see the enemy
the whole time, but you can only cross when your lane is open.

**Layout sketch**
- A symmetric map; each half is a compound with a flag in a Pillbox.
- The middle band is five Corridors (Clear and Windowed) running across the halfway line, each with a Force Field midway.
- A repeating 8 s timer drops two fields and raises the rest in a fixed rotation (left pair, centre, right pair). Alarm Lights over each lane blink 2 s before it opens.
- Above the band, a catwalk with railings is permanently open but fully exposed.
- Under the band, one maintenance tunnel is open only when every field is up, the reverse of the lanes.

**Signature moment.** Two squads stand nose to nose across a field,
emptying magazines through it, with grenades arcing over, and then the lamp
blinks. *Kit:* Force Field (blocks movement, not shots; *Drop/Rebuild
block*), repeating Timers, Blink light, KOTH-style central catwalk.

**Modes and players.** CTF and TDM, 8–16.

**Packs and props.** Orbital Station (laser gate frames, field emitters) on a
Military Compound layout, or all-Neon for a night version.

**Why it's fun.** It's readable chaos: everyone knows the rhythm, so timing
pushes to the lane clock becomes the skill.

**Build:** S.
**Gap:** **team-only force fields** (pass for one team, wall for the other)
would add one-way defensive lanes.

### Clockwork
**Hook:** a duel inside a giant clock tower where the pendulum is a weapon.

**The fantasy.** Gears, bells and a pendulum the size of a bus swinging
through the middle of the arena.

**Layout sketch**
- A tall shaft three storeys high: Atrium base, Catwalk Corners round it, a belfry on top under a Beamed roof.
- The pendulum is a block carried by a hinged mover pivoting at the top of the shaft, swinging ±40 degrees through the middle storey (pingpong *angles*, a level hinge through the marker).
- Gear platforms are three pingpong Lifts at offset waits ("the escapement"), the fastest way up.
- At the clock face, the west wall is a Window bay. Behind it, a narrow ledge is the sniper perch.
- In the belfry, a Crusher (a bell hammer) fires on the hour.

**Signature moment.** Every 60 s the clock strikes: a timer fires the belfry
crushers, flashes every light and plays the boom four times, and the
pendulum keeps swinging through anyone fighting on the middle catwalk.
*Kit:* hinged movers (the drawbridge's level hinge, swung both ways),
movers at 4 m/s or more run over what they sweep, pingpong Lifts, Crusher
trap fired from logic, Grandfather Clock props.

**Modes and players.** DM 1v1 to free-for-all of 6, TDM 2v2.

**Packs and props.** Gothic Estate (grandfather clock, walnut panels, brass
trim, candle chandelier), Industrial (gears as scaled valves and pipes).

**Why it's fun.** A tight duel map with one big rhythm hazard. Baiting your
opponent into the pendulum's arc is the move people will remember.

**Build:** S.
**Gap:** confirm that the run-over strike applies to hinged (rotating)
blocks by their tip speed; if not, it's a small fix. A **continuously turning
mover** would add real gears.

---

## 3. Over-the-top spectacle

### Express Lobby
**Hook:** a skyscraper's elevator core is the arena: six cars, twelve floors, no safe ride.

**The fantasy.** A Neon Megacity tower's open atrium has six glass elevator
cabs racing up and down. You fight by jumping from cab to cab, and the shaft
kills anyone who gets in a car's way.

**Layout sketch**
- A 2 × 2-cell open shaft 48 m tall, built from blocks, with landing slabs on every other floor and Glass tower facades outside.
- Six Tower Elevators on pingpong at 5–6 m/s, with different waits so cabs pass each other.
- Two mezzanines are reachable *only* by riding a cab past them; they hold the KOTH hills.
- A machine room on the roof has a helipad (Gunship) and a button that **drops the floor of one cab** (*Drop/crumble block* on its floor). The riders fall into the shaft and have to open parachutes.
- In the lobby at the bottom are revolving-door force fields, a vending machine and a Holo Billboard showing the floor number.

**Signature moment.** The cab floor vanishes at floor 11 and four players
pop parachutes inside an elevator shaft, shooting each other on the way
down. *Kit:* Tower Elevator movers (bots ride lifts), run-over at 4 m/s,
logic block drop, parachutes (5 m minimum, hold Space), Gunship on the roof.

**Modes and players.** KOTH and TDM, 8–16.

**Packs and props.** Neon Megacity (glass tower facade, AC units, antennas,
billboards, neon signs), Orbital (consoles in the machine room).

**Why it's fun.** Vertical chaos with a shared rhythm, cab hops are a skill
to master, and the drop button is pure spectacle. It's different from Neon
Spire's single glass lift because the cars *are* the map.

**Build:** M.
**Gap:** confirm a carried block can be dropped and rebuilt by logic while
its mover runs. **Logic-set mover speed** would allow an "express" button.

### Meltdown Protocol
**Hook:** the station falls apart in four timed stages, and the last team in the escape pods wins.

**The fantasy.** A reactor station at the end of its life. Every two minutes
something else fails: lights go red, fields drop, floors give way into
lava, and then the evacuation siren.

**Layout sketch**
- An Orbital Station ring round a Reactor Hall, with catwalks over a Lava pit (glowing, under grated floors made of solid blocks).
- **Stage 1** (0:00): normal play.
- **Stage 2** (2:00): every light turns red and blinks, and the lab force fields drop, opening shortcuts.
- **Stage 3** (4:00): the catwalk floors over the lava drop in sequence (logic *Drop block*, never coming back), and the reactor's low-gravity zone becomes the only way across.
- **Stage 4** (6:00): escape pod bays unlock (Locked Doors open). A team-only zone in each pod fires when *every living player* of that team is inside, and that team wins the round.

**Signature moment.** At 5:50 the whole ring is red and strobing, the floor
you used all match is gone, and your team is sprinting for the pod while the
other team tries to hold its door. *Kit:* timers and Wait sequences, Light
colour/blink, Force Field drop, Drop block, Lava, Low-Gravity Zone, zone
"every living player of team", *End the round: instigator wins*.

**Modes and players.** TDM and Elimination (one escape per round), 8–16.

**Packs and props.** Orbital Station (reactor core, coolant pipes, consoles,
cryo pods as escape pods, sealed bulkheads, airlock frames).

**Why it's fun.** It's a deathmatch with a third act. The map tells a story
in six minutes, and the final scramble flips the score logic on its head.

**Build:** M.
**Gap:** a **hurt-zone logic action** (damage everyone in a zone) would let
the reactor "go critical" outside the pods for a true finale.

### Crater Lair
**Hook:** a villain's volcano base with a rocket on the pad. If the defenders hold, it launches with people on it.

**The fantasy.** A rocket gantry inside a caldera, a monorail round the rim,
a drawbridge over the lava moat, and a countdown.

**Layout sketch**
- A terrain caldera (a ring of rock, Cliffs border) with a Lava lake and the launch pad on a basalt island in the middle.
- The rim monorail is a Sky Tram on a long pingpong run between the barracks and the control bunker.
- A Drawbridge over the lava moat is lowered from the control room (team-only button).
- The rocket is a tall stack of turned blocks (a curved hull, as Round Tower walls are built) on a trigger mover, with storage tanks round its base as the bomb site.
- The fuel farm has explosive Fuel Tanks and Storage Tanks chained close together.

**Signature moment.** The round ends with the defenders holding. A rule
sends the rocket mover 250 m straight up at 12 m/s, carrying everyone
standing on the gantry decks bolted to it, who jump off and parachute down.
If the attackers win, the bomb goes off in the tank farm and the chain
reaction rolls across the pad. *Kit:* trigger movers carrying blocks and
players, parachutes, explosive props chaining, Sky Tram, Drawbridge, Lava,
Bomb sites.

**Modes and players.** Bomb (5v5 to 8v8) and CTF, 8–16.

**Packs and props.** Military Compound (tanks, floodlights, blast doors),
Orbital Station (consoles, transmitter, satellite dish), Volcano Lair theme.

**Why it's fun.** The win screen is a rocket ride. It's absurd, it'll get
clipped, and it costs nothing in rules.

**Build:** L (the rocket and the caldera).
**Gap:** a **rocket prop** (or a launch-gantry tile) would replace the block
stack. Confirm there's no top speed or height limit on movers.

### Crash Bowl
**Hook:** a vehicle-only derby stadium with a lava moat and the crowd's MG turrets.

**The fantasy.** A floodlit dirt bowl full of go-karts, ice cream trucks and
gun jeeps, with ramps, a centre island of traps, and fire.

**Layout sketch**
- A sunken terrain bowl 90 m across, with a lava ring between the infield and the outer track.
- Pitched-block ramps over the lava ring (wheeled light vehicles launch off ramps).
- On the centre island, Crushers and Flame Jets on a cycle, and an Oil Slicker pickup to set the arena alight.
- Grandstands (Terrace tiles) behind Tall fences, with MG Turrets for players who bail out.
- Respawning vehicles at four "pit garages" (Vehicle Sheds).

**Signature moment.** Oil on the infield, someone fires the igniter, and
three karts and an ice cream truck hit the burning ramp together. *Kit:*
vehicle crashes credited to the driver, burning vehicles, wrecks as cover,
lava setting vehicles on fire, oil and fire spread, ramps launching wheeled
light vehicles, Vehicle damage setting.

**Modes and players.** DM and TDM, 8–16.

**Packs and props.** Military (vehicle sheds, barriers, floodlight masts),
Suburban (petrol pumps that explode), Neon (neon barriers as the infield
kerb).

**Why it's fun.** It's a short, loud, easy-to-learn chaos match where
everybody wrecks everybody.

**Build:** S.
**Gap:** **jump pads that launch vehicles** (a car pad) would add the big air
moment.

---

## 4. Out-of-the-box mechanics

### Low Bridge
**Hook:** a train heist where the train never moves; the world does.

**The fantasy.** Bandits fight along the roofs of a speeding express on a
trestle over a misty canyon, and every so often a tunnel arch comes through
at head height.

**How the trick works.** The train (Steam Locomotive, Passenger Cars,
flatbeds on chassis blocks) is static, standing on a trestle 40 m above a
canyon floor hidden by 90% ground mist. Everything *else* moves: telegraph
poles, signal gantries, trestle cross-beams and tunnel arches are blocks with
props riding along, on **loop movers** with four points: past the train, then
down under the trestle deck, back along underneath out of sight, and up
again. At 14 m/s they sell the speed; the far mesas barely move anyway, as
they wouldn't from a real train.

**Layout sketch**
- Six cars on the trestle: locomotive, tender, mail car (vault inside), passenger car, dining car, caboose.
- You walk through the cars (dressed with the bar/restaurant and lobby recipes) or along the roofs, the fast but exposed route.
- Tunnel arches (logic-sent movers on timers) sweep the roof line. A whistle (*Play sound*) and flashing lamp give 2 s of warning: crouch or drop between the cars.
- The bomb site is the mail car's strongbox. The bandits spawn on the caboose, the guards in the locomotive.

**Signature moment.** A firefight on the roof, the whistle blows, half the
players dive flat, and the arch sweeps the ones who didn't. *Kit:* loop
movers with hidden return legs, props riding movers, run-over at 4 m/s,
timers and sound cues, ground mist, Mesas scenery.

**Modes and players.** Bomb and TDM, 8–12.

**Packs and props.** Frontier Dust (steam locomotive, passenger car, wagons,
rail line, wanted board), Military crates as cargo.

**Why it's fun.** It's the train-top fight every action film has, made from
a mover trick, and the arches are a gloriously cheap kill.

**Build:** M.
**Gap:** a **snap-back leg** (a mover returning to point 1 instantly) would
remove the hidden return route. Check the arch height against the crouched
capsule.

### Erosion
**Hook:** the floor is the clock. Every tile you step on is gone.

**The fantasy.** A grid of stone tiles over acid. Each crumbles a second
after you touch it and never comes back, and the outer rings drop on their
own as the match runs.

**Layout sketch**
- Upper deck: 9 × 9 crumble blocks, 6 m each, *Comes back* off.
- Lower deck: 8 × 8 crumble blocks 6 m below, offset half a tile.
- Green-tinted Acid below both. Falling from the upper deck lands you on the lower one, if it's still there.
- Rings drop on a timer: the outer ring of the upper deck at 1:30, the next at 2:30, and so on (*Drop block* lists).
- Four jump pads on lower-deck corners throw you back up, while the upper deck lasts.

**Signature moment.** The last two players on three tiles, each trying to
force the other to step. *Kit:* crumble blocks (amber rim, 145 of the 150
budget), Drop block sequences, Acid, jump pads, Disc Arena knock-offs.

**Modes and players.** DM, Elimination (the floor rebuilds every round) and
Disc Arena, 4–12.

**Packs and props.** Any. The night version uses Neon Megacity glow trim,
the day version Jungle Ruins mossy cobbles over a swamp.

**Why it's fun.** Movement itself costs something. Rounds end fast, and the
arena tells you who played it smart.

**Build:** S.
**Gap:** a **random pick** action (drop a random block from a group) would
make every round's collapse different.

### Sinking Atoll
**Hook:** the tide doesn't rise; the island sinks.

**The fantasy.** A fishing village on a coral atoll is going under. Every 90
s the ground lurches and drops another metre into the sea, until only the
lighthouse rock is dry.

**Layout sketch**
- The village is built from free blocks (piers, plank houses on stilts, a market square), all carried by one trigger mover. Its points are 0, −1, −2 … −6 m.
- The lighthouse rock is static terrain, the last high ground, and it holds the final KOTH hill.
- The sea is Water at a fixed level round it all, and the Shoreline & sea border.
- Every 90 s a rule flashes all lights, plays the boom and sends the mover one point down. Players riding the blocks go with it.
- Hauler and Speeders ride over the water once the docks are gone.

**Signature moment.** At minute 7 the market square is waist-deep and
everyone is fighting on rooftops, swimming between them, with the hill on
the only dry rock. *Kit:* movers carrying many blocks and riders, Move mover
to point, Water swimming and drowning, hover vehicles over water, KOTH hill
order.

**Modes and players.** KOTH (hills ordered from low ground to the rock) and
TDM, 8–16.

**Packs and props.** Pirate & Coast, Frontier planks (Weathered Siding),
Jungle Ruins plants (palms, banana plants).

**Why it's fun.** The map shrinks from the bottom up, which changes routes
and sightlines every 90 s.

**Build:** M.
**Gap:** a **liquid as a logic or mover target** (a water box that rises)
would allow a true rising tide over ordinary tiles. Check the cost of a
mover carrying a few hundred blocks.

### Möbius Halls
**Hook:** a small house that is bigger on the inside, and the corridor at the end leads back to its own start.

**The fantasy.** An impossible office: rooms that join in ways the minimap
can't draw, and an enemy who appears behind you from the door you just
walked through.

**Layout sketch**
- Eight compact rooms (office, library, kitchen, lab, each a different pack theme) joined by doorways, where every door frame is a **portal** pair to a room that's elsewhere on the grid.
- A "long corridor" whose far end portals back to its near end, with a sniper rifle in the middle of it.
- A staircase that goes up four times and arrives on the floor it started from (portal at the top landing).
- A low-gravity hall where one portal exit is on the ceiling ledge.
- In the CTF version, both flags are in the "same" room, joined by two different portal chains.

**Signature moment.** You follow someone through a door into the kitchen,
and they come out of the library behind you. *Kit:* portals (Imperial
Arena/Egypt), Low-Gravity Zone, room dressing per pack, doors.

**Modes and players.** DM, TDM and CTF, 4–10.

**Packs and props.** Mixed on purpose: Gothic library, Suburban kitchen,
Orbital lab, Frontier saloon bar.

**Why it's fun.** Learning the map is the game: the first match is
bewildering, and by the fifth you're setting up portal flanks.

**Build:** M.
**Gap:** depends on how portals land. Wanted: logic Enable/Disable on a
portal pair (a "rewire the house" button), momentum and projectiles carried
through, and a see-through portal surface.

### Feather and Lead
**Hook:** a lab where every wing has a different gravity, and every class plays differently in each.

**The fantasy.** A physics research complex: the moon chamber, the
centrifuge and the heavy hall. Rocket jumps in one wing barely leave the
ground, and in the next they reach the ceiling.

**Layout sketch**
- **Moon wing** (gravity 0.2): a Tall Room atrium with high ledges reachable only by jumping. Jump pads throw you across the whole hall.
- **Heavy wing** (gravity 2.5): low ceilings, no jumping on to cover, and grenades and players drop hard. The pads here barely lift you.
- **Normal wing**: the flag rooms and spawns.
- The crossing ring is a corridor loop joining all three wings. Each door has a sign (Neon Sign: "0.2 G", "2.5 G").
- The centrifuge is a pingpong Sky Tram running round the ring's outer track.

**Signature moment.** A Rocketeer rocket-jumps in the moon wing and sails 40
m over the flag room, and a Bulwark in the heavy wing simply can't be pushed
off the point. *Kit:* Low-Gravity Zone at 0.1–3 (above 1 is heavier,
sinking orange motes), jump pads traced through zones, Classes (Rocketeer,
Runner's double jump, Disc jumps).

**Modes and players.** CTF with Classes, DM, 8–12.

**Packs and props.** Orbital Station (labs, consoles, holo globe, cryo pods).

**Why it's fun.** Each class has a wing where it shines, so the meta changes
by room.

**Build:** S.
**Gap:** **logic-switched gravity** (zones that Enable/Disable or change
value) would allow a "gravity flip" event every few minutes.

### Matchstick Hotel
**Hook:** a frontier hotel where nearly every wall can be shot or blown out.

**The fantasy.** A two-storey wooden hotel. By the end of a match there are
holes through every room, and the fight runs through the walls instead of
the doors.

**Layout sketch**
- The hotel is 2 × 3 cells over two storeys. Interior walls are Breakable Planks blocks (about 110 of them), plus Destructible Barriers in the lobby.
- The saloon on the ground floor has swinging doors and a gallery, the hotel rooms are upstairs, and the cellar is reached through a trapdoor.
- Breakable Planks floors in two rooms drop you into the room below.
- Outside are the main street, the livery and the water tower (sniper).
- Oil Slicker and Flamethrower pickups sit in the cellar. Oil and fire spread is the "burn the hallway" play.

**Signature moment.** A grenade through the floor of room 4, and the whole
team drops into the saloon from above. *Kit:* Breakable Planks (back after
N s, or never), breakable blocks as rule targets, Dynamite, Oil Slicker
igniter, Saloon Doors.

**Modes and players.** TDM and Elimination (walls rebuild between rounds),
6–12.

**Packs and props.** Frontier Dust (saloon, siding, hitching posts, barrels,
powder kegs).

**Why it's fun.** Every match plays a different map. Explosives are tools
for making routes, not just for scoring kills.

**Build:** M.
**Gap:** **wood that burns** (a material fire spreads along, like oil) and a
higher **breakable block budget** for denser buildings.

---

## 5. Co-op and scenario

### After Hours
**Hook:** a night at the museum where the exhibits come to life one gallery at a time.

**The fantasy.** You're the night guards. The Hall of Antiquities' statues
wake, the alien gallery's specimens get loose, and the tank in the Military
wing is the last way out.

**Layout sketch**
- **Grand Atrium:** a 2 × 2 Atrium with a skyfighter hung as an exhibit (a real mount, flyable in the atrium).
- **Hall of Antiquities:** colossal heads, serpent heads, sarcophagi, golden idol (Jungle Ruins). Breaking a sarcophagus starts an imp encounter.
- **Gothic gallery:** portraits, suits of armour, weeping angels. Lights gutter as you enter, and zombies come out from behind the angels.
- **Space Hall:** satellite, holo globe, cryo pods with Oculi and Cyclopes inside (the pods are breakable, and their encounters start on *Object destroyed*).
- **Military wing:** a roped-off Tank behind a Locked Door. A button in the curator's office opens it, and the tank drives through a breakable wall into the atrium for the Scolitex finale.

**Signature moment.** The armour gallery lamps flash, and the "exhibit"
puglin that was a statue a second ago is running at you. Then you drive a
museum tank through the atrium wall. *Kit:* NPC encounters started by logic,
Destroy object on exhibit props, Light flash and blink, Allied Militia
(night guard bots), Tank mount, Breakable Wall (explosives only).

**Modes and players.** Co-op 1–8, scaled by reinforcements per extra
player.

**Packs and props.** Jungle Ruins, Gothic Estate, Orbital Station, Military
(the tank), Suburban (gift shop: vending machines, fridges).

**Why it's fun.** Each gallery is a themed encounter with its own creature,
and the finale is a set piece.

**Build:** M.
**Gap:** a **dormant NPC** (stands frozen like a statue until a rule wakes
it) would make the reveal perfect; for now the prop breaks and the NPC
spawns in its place.

### Grand Larceny
**Hook:** a four-map heist that carries your loot, score and guns from the lobby to the getaway.

**The fantasy.** A bank job with four acts: in through the tower, crack the
vault, out by the roof, and lose them on the freeway.

**The chain** (a playlist in `maps/playlists/`, `carry: { score, loadout }`):
1. **Lobby Hours** (Neon Megacity bank tower): get past the lobby's laser fences (disable them at a security console) and ride the Tower Elevator to the vault floor while Syndicate guards hunt you.
2. **The Drill** (vault floor): open the Vault Door look on a 90 s drill timer, holding the floor against three waves, with Alarm Lights blinking the whole time.
3. **Rooftop** (helipad): fight up the stairwells to the roof, hold the helipad until a Locked Door opens on the Dropship, and *Next map* fires when every living player is aboard (a zone on the deck).
4. **Getaway** (freeway): an Armored Rover on a point-to-point track with ambient traffic. Clear NPC roadblocks (squads started by zones) and reach the docks (*End the round: players win*).

**Signature moment.** Map 3 ends with the whole crew in the dropship,
and map 4 opens with you in the rover, still holding the same weapons and
ammo you had on the roof. *Kit:* playlists with carry, *Next map*, timers,
NPC squads, Locked Doors, Tower Elevator, Dropship, track with ambient
cars.

**Modes and players.** Co-op chain, 2–8.

**Packs and props.** Neon Megacity, Frontier Dust (vault door look), Orbital
consoles, Military barriers for the roadblocks.

**Why it's fun.** It's a campaign in 25 minutes. Carry makes the ammo you
save in act 2 matter in act 4.

**Build:** L (four maps).
**Gap:** a **zone event for a vehicle entering**, and **NPC-driven hostile
vehicles** (police cars that chase), for the getaway.

### Iron Caravan
**Hook:** race a strongbox wagon through bandit country while the canyon tries to kill it.

**The fantasy.** A convoy escort as a moving set piece: the rover drives,
the jeeps scout, and every bend springs something.

**Layout sketch**
- A 1.2 km point-to-point track through a Frontier canyon (Road tool, dirt surface, laid into terrain).
- **Ambush 1:** a zone fires Falling Rocks across the road and starts two bandit squads on the ridge.
- **Ambush 2:** a Drawbridge over a river starts raised. Someone has to get out, climb to the winch hut and press the button while the rest hold.
- **Ambush 3:** a stampede of ambient go-karts painted as runaway carts comes the other way (ambient cars run anyone over).
- The finale is a fortified railway depot: hold the rover in the yard zone until the train arrives (a Steam Train mover sent by logic).

**Signature moment.** The rocks come down behind the rover, the snipers
open up from the ridge, and the gunner on the rover's rear turret is the
only one who can reach them. *Kit:* track and Road tool, ambient cars,
Falling Rocks fired from zones, NPC squads with hunt and hold orders,
Drawbridge on a button, Armored Rover and Gun Jeeps, Steam Train.

**Modes and players.** Co-op escort, 2–8.

**Packs and props.** Frontier Dust (rail station, covered wagons, cacti,
wanted boards), Military (barriers, sandbag nests for the bandit camps).

**Why it's fun.** It's an action-film convoy. Who drives and who guns
becomes a team decision.

**Build:** M.
**Gap:** a **zone that fires for a vehicle**, so the rover itself, not its
driver, triggers the end.

### Tomb of Nine Gates
**Hook:** descend through nine portcullised chambers to the pharaoh's idol, then outrun the tomb on the way back up.

**The fantasy.** An Egyptian tomb-raid: cage lifts down the shafts, gates
slamming behind you, sarcophagi cracking open, and the long climb out with
the idol.

**Layout sketch**
- Nine chambers on three levels joined by **cage lifts**, each sealed by a **portcullis mover**.
- Each gate is a small puzzle: a button pair that must both be pressed (zone with N players), three scarab pickups collected (Pickup taken + counter), a rotten floor over embalming fluid (green Acid), a corridor of cycling spike floors and flame jets.
- Sarcophagi are breakable, and each wakes a zombie encounter when broken.
- The idol chamber holds the Golden Idol on an altar. Taking it starts the escape: Falling Rocks drop behind you, gates slam shut in sequence, and a timer runs.
- The escape route back up differs from the way down (vines and rock stairs instead of lifts).

**Signature moment.** The idol comes off the altar, every portcullis on the
level drops at once, and a 90 s escape clock appears on the HUD. *Kit:*
portcullis movers, cage lifts, objectives and HUD timers, Collect 3 items
template, trap rows with offsets, Falling Rocks, zombies.

**Modes and players.** Co-op 1–8.

**Packs and props.** Egypt (being finished), Jungle Ruins (stele, altar stone,
vine curtain, golden idol), Dungeon props, braziers.

**Why it's fun.** A proper dungeon crawl with a race finale, and each gate is
a short puzzle the team solves together.

**Build:** L.
**Gap:** a **mummy look** for the zombie role (a skin or tint per encounter).

### Beast Games
**Hook:** an arena where the creatures come up from below on cage lifts, and between waves you choose your own handicap.

**The fantasy.** Gladiator co-op in the Imperial Arena: portcullises
grind open, beasts rise out of the floor, and the emperor's box offers you
three deals.

**Layout sketch**
- An oval arena (Round Arcade walls, Terrace seating) with sand floor and Low cover pillars.
- Six **cage lifts** in the arena floor. Each wave's encounter spawns in the cages below, then rules send the lifts up and the **portcullises** open.
- Spike floors and flame jets cycle in two quadrants and switch quadrants every wave.
- **The emperor's box** is three buttons (team-only, enabled only between waves): Armoury (enable rocket pickups), Mercy (enable health), or Glory (double the next wave for double score). The choice is stored in a variable that drives the next wave.
- Wave 10 is a Scolitex champion rising alone in the centre lift.

**Signature moment.** Wave 8: someone picks Glory, every cage rises at once,
and the floor fills with imps. *Kit:* cage lifts, portcullis movers,
encounters started by logic, variables, buttons enabled by timers,
cycling traps, Score.

**Modes and players.** Co-op waves 1–8.

**Packs and props.** Imperial Arena (being finished), Castle & Siege, braziers
and banners.

**Why it's fun.** A Zombies-style horde with choices between waves that make
every run different, plus a big-boss finale.

**Build:** M.
**Gap:** confirm NPCs standing on a carried block ride the mover like
players do.

---

## 6. Vehicles and large scale

### Operation Highwire
**Hook:** 48 v 48 on a mountain fortress, where the attackers arrive by air every life.

**The fantasy.** A castle-turned-missile-base on a peak. Attackers jump out
of a transport plane over it, gliders and all, while defenders hold
three lines with tanks and turrets.

**Layout sketch**
- A 320 m terrain peak with snowy cliffs (Cliffs border). The fortress has three rings: outer wall, bailey, keep.
- **Outer wall:** Compound Walls and a Compound Gate with a Blast Door, and Destructible Barriers to breach. Rocket and MG turrets sit on the towers.
- **Bailey:** a Helipad (two Gunships for the defence), a Vehicle Shed with a Tank, and a cable car (Sky Tram) to an eagle's-nest sniper tower.
- **Keep:** three generators (explosive props) in the deep halls. Destroying all three (*Object destroyed* → variable → *End the round: instigator wins*) wins for the attackers.
- **Attackers' side:** the Transport Plane loops over the peak at 80 m with *Air drop: every spawn*. Glider pickups and Dropships sit at a forward landing zone in the valley.

**Signature moment.** Forty players step out of the plane together, a sky
full of canopies over the castle while the flak (MG turrets) opens up.
*Kit:* Transport Plane with air drop, parachutes and gliders, 96 players and
bots, turrets, Tank, Gunship, Blast Door, Destructible Barriers, explosive
props as objectives, team leaders.

**Modes and players.** TDM with objective logic, 32–96 (24v24 to 48v48).

**Packs and props.** Military Compound, Castle & Siege, Snow ground,
Floodlight Masts.

**Why it's fun.** The biggest spectacle we can run: a mass drop in every
life and a three-stage push.

**Build:** L.
**Gap:** a **sector attack/defence mode** (stages, tickets, the spawn line
moving forward as objectives fall); logic alone can't move spawns.

### Interstate Rumble
**Hook:** a firefight on a freeway interchange where the traffic never stops.

**The fantasy.** A cloverleaf of elevated roads over a city at dusk, with
cars, cabs and trucks lapping the whole time. Cross the lanes at your peril.

**Layout sketch**
- An elevated track circuit (Road tool) on decks 8–12 m up, with ramps, two overpasses and a tunnel through a block. 12 ambient cars lap it all match.
- Below, a toll plaza (KOTH hill 1), a gas station (hill 2; the pumps explode) and a truck stop (hill 3).
- Billboard catwalks (Holo Billboards on Platform tiles) over the lanes are the sniper spots.
- Hover Bikes and Gun Jeeps ride on the deck. A Gunship sits on a hospital roof.
- City blocks border with lit windows, and Dusk sky.

**Signature moment.** Two squads fight across four lanes and an ambient
semi takes out the one in the middle of the road. *Kit:* track ambient cars
(run anyone over, can be taken or shot up), pit lane, vehicles, explosive
petrol pumps, KOTH moving hills, Holo Billboards.

**Modes and players.** TDM and KOTH, 16–32.

**Packs and props.** Neon Megacity (elevated pillars, street lights, sign
gantries, traffic lights), Suburban Chaos (gas station tile, petrol pumps,
family cars).

**Why it's fun.** Traffic is a third team nobody controls. Hijacking a cab
mid-lap is the stylish play.

**Build:** M.
**Gap:** **ambient vehicle variety** (mixed models on one track instead of one
ambient vehicle type).

### Coral Crown
**Hook:** an island-hopping air and sea CTF across a reef.

**The fantasy.** Two volcanic islands with flag bases and a sunken galleon
between them. Hovercraft skim the water, skyfighters dogfight overhead, and
divers sneak the flag through the reef.

**Layout sketch**
- A 320 m terrain mostly under shallow and deep Water. Two volcanic islands (Lava pools in their craters) are the bases.
- In the middle, a reef atoll with the galleon wreck (pitched blocks, Pirate & Coast props): half in, half out of the water, with a swim-through hold.
- Each base has Skyfighters, a Hauler (it rides over water) and Speeders.
- Swim routes run through the reef: deep water hides you but drowning starts at 15 s, with surfacing points among the rocks.
- Shoreline & sea border on every side.

**Signature moment.** The flag carrier can't use vehicles, so the flag
goes back by swimming, and the defenders hunt the snorkel line from a
gunship. *Kit:* CTF carrier rules (no vehicles, no jetpack), water swimming,
hover vehicles over water, flyers, Lava.

**Modes and players.** CTF 8v8 to 24v24.

**Packs and props.** Jungle Ruins (palms, bamboo, colossal head on a reef),
Pirate & Coast, Military helipads.

**Why it's fun.** The rule that the flag can't ride vehicles makes the
swim-back the climax of every capture.

**Build:** L.
**Gap:** none. An **underwater vehicle** would be the dream.

### Avalanche Run
**Hook:** a downhill combat race on speeders, with the mountain trying to bury you.

**The fantasy.** Start at a summit observatory and race 1.5 km down a snowy
mountain through an ice cave, a ski village and a collapsing bridge.

**Layout sketch**
- A point-to-point track on a 320 m terrain, dropping about 120 m.
- **Ice cave:** a Cave Passage section with crumble blocks as icicles overhead (Falling Rocks with zone triggers).
- **Ski village:** Suburban houses with Snowy facades, the road between them, and Sentry Guns on the chalet balconies (combat race).
- **The bridge:** crumble planks across a chasm. The first racer through gets across, and anyone close behind may not.
- **Finish:** the lodge at the bottom, spectators' Terrace with gliders for those who crashed out.

**Signature moment.** You're second through the bridge and it crumbles under
your hover, and you make it by riding the edge. *Kit:* Race mode (combat,
checkpoints, back on track), Road tool on terrain, Falling Rocks traps,
crumble blocks, sentries sleeping in a clean race, Snow paint skins.

**Modes and players.** Race, combat on, 4–12.

**Packs and props.** Military (sentries), Suburban (houses, garages),
Snowy peaks backdrop, Pine forest scatter.

**Why it's fun.** A downhill race is a story with a start, a middle and an
end, and the traps make every heat different.

**Build:** M.
**Gap:** a **slippery ice surface** (low-grip ground for wheeled vehicles and
players).

---

## 7. Party and casual

### Wheel of Peril
**Hook:** a TV game show where the audience team votes on which trap fires next.

**The fantasy.** Four contestants run a lit studio obstacle course while 12
audience members in the gallery press giant buttons to vote between two
dooms.

**Layout sketch**
- Team preset 4v12: Contestants and Audience. The audience spawns in a gallery above the stage.
- Five stages in a row, each with a two-option vote: SPIKES or FLAMES, FLOOR or CRUSHER, LASERS or MINES, and so on. Each stage has two big team-only buttons in the gallery.
- The vote is one variable: the left button adds 1 and the right subtracts 1. When the stage's 10 s timer runs out, the rule fires the left trap if the variable is above 0, otherwise the right.
- Holo Billboards over each stage flash the winning word, and lights strobe (*Flash light*).
- The golden buzzer at the end is a button: *End the round, instigator wins*.

**Signature moment.** The whole gallery mashing FLOOR while the lead
contestant stands on the trapdoors. *Kit:* team-only buttons, variables
and conditions, timers, traps fired from logic, Trapdoor blocks, neon
signs and billboards, team presets [4, 12].

**Modes and players.** Team match with custom logic, 8–16 (also 2v6).

**Packs and props.** Neon Megacity (billboards, signs, neon barriers), Orbital
(consoles as podiums).

**Why it's fun.** Players who are out still play, and the audience creates
the jokes.

**Build:** M.
**Gap:** **bulletproof glass** (see-through, stops shots: the opposite of a
force field) for the gallery, a **per-team loadout** (unarmed audience), and
**swapping sides between rounds**.

### Midnight Midway
**Hook:** a haunted carnival where every ride is a logic set piece.

**The fantasy.** A fairground after closing time, with the rides still
running. A ghost train, a drop tower, bumper karts and a coaster, plus
zombies in the hall of mirrors.

**Layout sketch**
- **Ghost Train:** a Mine Cart mover through a dark tunnel. Lights flash at set points, a trapdoor drops one car's rider into the cellar, and puglins wait in alcoves.
- **Drop Tower:** a Tower Elevator 30 m up on pingpong at 6 m/s. At the top you get a sniper view of the whole park, and you can jump off and parachute down.
- **Bumper rink:** Go-Karts inside an Electric Fence ring (it zaps and throws you back).
- **The Coaster:** an elevated wooden track (Rope Bridge-style sagging decks) with ambient Go-Karts lapping it. Ride the decks or get run over.
- **Shooting gallery:** ten breakable targets. Breaking all ten (counter variable) opens the prize booth with the Gilded Pistol.

**Signature moment.** You win the Gilded Pistol at the shooting gallery and
fight off a zombie wave from the top of the Drop Tower. *Kit:* Mine Cart
mover, Tower Elevator, Electric Fence trap, ambient track cars, breakable
props with Object destroyed counters, Zombies waves, light flashes.

**Modes and players.** Zombies (4 + bots) and DM, 4–12.

**Packs and props.** Neon Megacity (neon signs: TUNNEL OF TERROR, holo
kiosk, noodle stall), Gothic (gas lamps, weeping angels in the ghost train),
Suburban (playground slide, trampoline as the bouncy castle).

**Why it's fun.** Each ride is a mini-game with a payoff, and the park has a
night-out mood.

**Build:** L.
**Gap:** **turning movers** for a carousel and a Ferris wheel (with gondolas
that stay level). Neither is needed, but they're the iconic rides.

### Pantry Raid
**Hook:** two teams of toy soldiers fight across a giant kitchen.

**The fantasy.** You're action figures. The kitchen table is a three-storey
plateau, the oven is a lava cave, and the sink is a lake.

**Layout sketch**
- **Kitchen table:** a block slab 8 m high on four leg-blocks, with chairs as stepped blocks to climb it. Plates and cups are Platforms and Round Towers.
- **Counter run:** 12 m high along one wall. The Fridge Freezer, Microwave and Washing Machine are scaled 4x (the microwave explodes when shot), and the sink is grey-tinted Water to swim across.
- **The oven:** its door is a **Drawbridge** (ovens open on a horizontal hinge). Lowered by a knob button, it becomes a ramp into the oven, where Flame Jets are the burners and a Lava floor is the element.
- **The toaster:** a pair of jump pads that pop you onto the counter. Cupboard doors are Sliding Walls.
- **Floor:** oak boards. Under the fridge, a crawlspace with a dropped "cereal box" (blocks with a neon sign reading CRUNCH-O'S as its label).

**Signature moment.** The oven door slams down as a ramp and the whole team
charges into the burning oven for the flag. *Kit:* free blocks at any size,
props scaled 0.25–4x, Drawbridge hinge mover, jump pads, Flame Jet trap,
Water and Lava, neon signs as labels.

**Modes and players.** TDM, CTF (flags: the cookie jar and the sugar bowl)
and DM, 6–12.

**Packs and props.** Suburban Chaos (fridge, microwave, washer, barbecue as
the "grill"), Home and Furniture, Kitchen dressing recipe for detail at
scale.

**Why it's fun.** Everyone knows a kitchen, so the joke lands instantly, and
the scale makes the verticality wild.

**Build:** M.
**Gap:** **prop scale above 4x** (up to 10x for true toy scale), and a
**vertical-hinge mover** for the fridge door that swings open.

### Sushi Belt Sumo
**Hook:** Disc Arena on plates riding a conveyor belt over the void.

**The fantasy.** A neon sushi bar the size of a stadium. The decks are
plates riding a rectangular belt, and the chef's island in the middle has
the power discs.

**Layout sketch**
- **The belt:** eight 6 m square decks, each on its own **loop mover** with four points round a 60 × 30 m rectangle, the point lists offset so they're spaced evenly. They run at 3 m/s, under the run-over speed.
- **The chef's island:** a static centre with the four power discs (fast, triple, split, freeze).
- Jump pads from the island to the belt and from the belt corners to two "sake bottle" towers.
- The void below, under a Night sky, with Neon block bar walls round the edge as backdrop.
- Neon signs: TAKO, SALMON, WASABI, one on each plate's side.

**Signature moment.** You knock someone off a plate just as it rounds a
corner and the next plate comes up empty behind them. *Kit:* loop movers
with four points (square decks translate round a rectangle without needing
to turn), Disc Arena rules, power discs, jump pads, neon signs.

**Modes and players.** Disc Arena and DM, 4–8.

**Packs and props.** Neon Megacity (noodle stall, signs, holo kiosk, neon
barriers).

**Why it's fun.** Instant to read, endlessly replayable, and the moving
decks make every throw a lead.

**Build:** S.
**Gap:** none. **Turning movers** would add a lazy-susan turntable.

---

## Top 10 to build next (fun per unit of effort)

1. **Erosion** (S): 145 crumble blocks, one acid pool and a few drop sequences, for a whole match format.
2. **Sushi Belt Sumo** (S): eight loop movers and a Disc Arena; reads at a glance.
3. **Low Bridge** (M): the mover treadmill is the cleverest trick here, and it reuses the Steam Train props.
4. **Express Lobby** (M): six Tower Elevators and one floor-drop button for the most clip-worthy moment.
5. **Fogbound** (S): mostly terrain, trench tiles and a mist value, for a genuinely new kind of cover.
6. **Pantry Raid** (M): blocks and scaled props only; it's the easiest idea to pitch in one sentence.
7. **Clockwork** (S): a duel map with one signature hazard (the hinged pendulum).
8. **No Man's Field** (S): force fields and a repeating timer make a competitive map with its own rhythm.
9. **Wheel of Peril** (M): logic-only, and it turns being out into playing.
10. **After Hours** (M): the best co-op showcase for NPC encounters, and it uses all seven packs.

Next in line: Meltdown Protocol, Matchstick Hotel and Floodgate.

## Kit gaps these ideas surfaced

Small additions, roughly in order of how many ideas they'd lift:

- **Turning movers**: yaw rotation and continuous spin (carousels, turntables, gears, a rotating spotlight), and Ferris-wheel gondolas that stay level. Today's hinge is one level axis with angles per point.
- **Random pick in logic**: drop a random block from a group, choose a random layout. Also a variable that survives the round reset, and comparing two variables.
- **Liquids as logic and mover targets**: water that rises or drains, for a true rising tide, flooding rooms and draining the crypt.
- **Slippery surface material**: ice or polished floor with low grip for players and wheeled vehicles. Oil puddles exist as a weapon hazard, but there is no ground material.
- **Bulletproof glass**: see-through and stops shots, the inverse of a force field. Plus **team-only force fields**.
- **Hurt zone action**: damage everyone inside a zone from logic (a reactor going critical, a gas leak, a closing storm).
- **Logic-switched gravity**: Enable/Disable or a new value on a gravity zone, for gravity flips.
- **Mover controls**: speed set by logic, and a snap-back return leg (no hidden return route needed for treadmill scenery).
- **Mounts riding movers**: turrets on trains, cable cars and elevator cabs. Also confirm NPCs ride carried blocks.
- **Vehicle-aware triggers**: a zone event for a vehicle entering, and jump pads that launch vehicles.
- **Per-team or per-zone loadouts**, and **side swap between rounds** (game shows, asymmetric modes).
- **Prop scale above 4x** for toy-scale maps, and a **vertical-hinge** mover for side-swinging doors.
- **Dormant NPCs**: frozen "statue" encounters that a rule wakes, plus a per-encounter look (mummies).
- **Burning materials**: wood that carries fire like oil, and a higher breakable block budget than 150.
- **Sector attack/defence mode**: staged objectives with spawn lines that move up, for 48v48 sieges.
- **Hostile NPC vehicles** (pursuers) and **mixed ambient vehicle types** on one track.
- **New props and fixtures**: rocket/launch gantry, Ferris wheel, carousel, mine lamp, rotating spotlight.
- **To verify, not build**: the run-over strike on hinged rotating blocks, dropping a carried block while its mover runs, mover speed and height limits, and the cost of one mover carrying hundreds of blocks. For portals: logic Enable/Disable, momentum and projectiles through, and a see-through surface.
