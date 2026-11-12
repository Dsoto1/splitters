# Turrets, sentries and vehicles

Place them from MapMaker's Entities → Vehicles tab. Players walk
up and press **E** to get in (driver first, then gunner, then passengers) and
**E** again to get out. The definitions are data in
`packages/shared/src/sim/mounts.ts`. Models come from Kenney Space Kit
and Car Kit, Meshy Community models (the snowmobile, the buggy, and the four of the vehicle refresh), Quaternius' Ultimate
Spaceships and Tank Pack (all CC0).

| Mount | Seats | What it does |
|---|---|---|
| Heavy MG Turret | 1 gunner | A heavy machine gun on a tripod, ±80° arc, overheats instead of reloading. Drawn at twice its model's built size (`scale` 2: 3 m long, the top of the receiver 1.28 m up, chest height to the gunner standing behind it); you see your own gun in front of you when you man it |
| Rocket Turret | 1 gunner | Slow, heavy rockets, ±70° arc (model: a Meshy community cannon on a pedestal, CC0 per the owner, `guns/arc_cannon_turret.glb`, centred on its pedestal so it turns about it) |
| Sentry Gun | none | Aims and fires on its own at its team's enemies (no team: everyone) |
| Arc Turret | none | An auto-turret like the Sentry Gun, with a tell: it winds up (0.75 s, a growing charge ball and a warning sound) on an enemy it can see within 22 m, then locks an energy arc on that hits 5 every 0.1 s and jumps to one enemy within 6 m of them (half damage). Breaking its line of sight or leaving its reach drops the lock and the charge; a 2 s lock ends in a 1.25 s vent. 240 health. Drawn on the Rocket Turret's cannon in its own violet energy colour (`MountDef.glow`). MapMaker warns (`mount.arc_spawn`) when one stands within 12 m of a spawn it would shoot at. See "Arc Turret" below |
| Speeder | 2 (pilot, passenger) | Hovering; the pilot fires twin blasters ahead, the passenger shoots their own weapon |
| Buggy | 6 (driver, front passenger, 4 on the deck) | Everyone but the driver shoots their own weapon, all round: the front passenger sits, the four in the back stand on the open deck behind the cage |
| Hauler | 6 (pilot, gunner, 4 passengers) | A slow hovering transport with a rocket gunner |
| Skyfighter | 1 pilot | Flies: the pilot climbs (Space) and dives (Ctrl/crouch), up to 30 m above where it was parked, firing twin blasters ahead |
| Dropship | 6 (pilot, gunner, 4 passengers) | A flying troop carrier with an all-round door gun; riders stand on the deck |
| Tank | 3 (driver, cannon, roof gun) | Slow and heavy (1200 health): the cannon fires explosive shells within 35° of the nose, the roof gun works all round |
| Gun Jeep | 5 (driver, roof gun, 3 passengers) | Wheeled light: a quick pickup with an all-round machine gun on the back (380 health); a passenger in the cab and two sitting on the bed's side rails shoot their own weapons |
| Armored Rover | 5 (driver, front gun, rear gun, 2 riders) | Wheeled heavy: slow, grippy and 900 health; the front gunner covers ±75° ahead, the rear gunner ±90° behind |
| Hover Bike | 1 rider | Hover: the fastest thing on the map (31 m/s), fragile (170 health), no gun |
| Gunship | 3 (pilot, left and right door guns) | Flying, on the dropship's flight model: the pilot fires blasters ahead, each door gunner covers ±70° off their own side (950 health) |
| Troop Truck | 6 (driver, cab passenger, 4 on the bed) | Wheeled heavy, no gun: a six-wheeled army truck (700 health); the cab passenger sits, the four on the flatbed stand, and all five shoot their own weapons |
| Snow Sled | 2 (driver, passenger) | A snowmobile with hover handling: quick and slidey, sits on the snow instead of floating; both riders sit astride the saddle |

- **Driving.** W/S throttle and reverse, A/D steer (harder the faster you
  go), or **look to steer** (Options → Controls → Vehicle steering: the
  vehicle turns toward where you look, Warthog style, and the view stays
  where you point it; A/D still steer too; classic is the default). Vehicles slide along walls, lose half their speed in a crash and
  follow the ground (terrain included). At speed they run down enemies,
  credited to the driver.
- **Cameras.** Drivers and pilots start in the **cockpit**: the eye sits at
  the driver's seat (a seated head height, a little forward, or the
  vehicle's own `cockpitEye` in `MOUNT_DEFS` where the model needs it), the
  ridden model is drawn one-sided so the hood, nose and frame show without
  the inside of the roof and doors in the way (a vehicle with an in-house
  cockpit, the buggy, draws it for you alone: see "In-house cockpits" below), and the view turns with the
  vehicle while the mouse looks round within about 130° of the nose. The view
  leans with the vehicle's drawn tilt only gently (damped, a third of it and
  at most ~6° on the ground; flyers follow their bank and climb more, up to
  ~20°), and getting out always gives back the level on-foot view. **H**
  (controller: R3) switches the driver to the **chase camera**: a spring on
  the orbit round the vehicle (so it stays steady on screen at speed), pulled
  back and widened with speed, pulled in where a wall or the ground is in the
  way (ignoring the vehicle's own box), with free look that swings back
  behind the vehicle a second after you stop moving the mouse. The choice is
  kept per class, ground or air, in the browser (`tiletrigger.vehicleCamera`).
  Gunners and passengers always look from their seat: passengers turn with
  the vehicle, gun seats hold their aim (within the gun's arc) and stay level
  so the reticle is true. The use prompt shows the H key while you drive.
  Your own weapon stays hidden while you drive or man a gun.
- **Flying.** Skyfighters and dropships drive like hovercraft and also
  climb on jump and dive on crouch; let go and they hold their height. Left
  without a pilot they sink gently to the ground. Bots fly them at ground
  level.
- **Models.** The vehicle refresh (2026-11-11; Meshy Community CC0 from the owner's Drive, built by
  `prepare-guns.mjs` from `content/guns.json`: about 14-20k triangles plus a quarter-size level from 40 m,
  1-2k colour and 1k normal maps, 1.5-2.1 MB each): the **gun jeep** is the Recon Trike
  (`vehicles/recon_jeep.glb`, a Warthog-style four-wheeler with a pintle gun on the cage), the **hover bike** TNR 1017
  (`vehicles/tnr_hover_bike.glb`), the **speeder** Cyber Fang Mk III (`vehicles/cyber_fang.glb`) and the **armored
  rover** Dust Runner (`vehicles/dust_runner.glb`, a closed off-roader). Re-skins only: each keeps its box,
  handling, guns and health; the seats were moved onto the new models (measured on them, notes in
  `content/vehicles/<id>.json`) and the models they replaced are their `fallback`. The transport plane is the
  Hauler's model drawn 2.35 times its size (below). The
  **gunship** is the Sky Cruiser (`vehicles/sky_cruiser.glb`, Meshy Community, CC0; 2026-11-12): its box is fitted to
  the hull, the pilot sits in the closed cab and each door gunner sits on their door's sill, feet on the step board
  (measurements in `content/vehicles/gunship.json`); handling, guns and health are as before. The snow sled is "Snowmobile" by
  roygbpjyt (Meshy Community, CC0; `content/guns.json`, built by
  `prepare-guns.mjs`: 20k triangles plus a 5k one from 40 m, 2048 px colour
  and 1024 px normal map, 1.42 MB, 3.0 m long), replacing Kenney Holiday Kit's
  long sled on 2026-11-04; its riders sit astride (`straddle` on the seats). The tank is Quaternius' Tank Pack (CC0) desert tank. The hauler (Dispatcher), skyfighter
  (Spitfire) and dropship (Imperial) are from Quaternius' Ultimate
  Spaceships (CC0), trimmed by `tools/content/prepare-ships.mjs`.
  The buggy (vehicle refresh part 2, 2026-11-11) is a Meshy Community sci-fi buggy (`Meshy_AI__1108120754`, CC0;
  `vehicles/sixer_buggy.glb`, 20k triangles plus a quarter LOD, 2048 px colour map): a tube-frame four-wheeler with
  a cage over two seats and an open deck behind, where four riders stand (the owner's layout: driver, a seated
  front passenger, four standing). The suspension's contact points and hub height are the old buggy's
  (`vehicle.suspension.wheels`, `hub`), so it drives as before. The Tactical Off-Road Beast it replaced is its
  `fallback`.
  The **troop truck** (2026-11-11) is Ironclad Vanguard (Meshy Community CC0, the owner's Drive,
  `Meshy_AI_Ironclad_Vanguard_1111000212_texture.glb`; `vehicles/troop_truck.glb`, 20k triangles plus a quarter LOD):
  a three-axle army truck, a closed cab ahead of an open flatbed where four riders stand, on six suspension
  points; its box is the whole truck, tires included (2.8 × 2.54 × 5.6 m). Not placed on
  any real map yet (the coverage map has one).
  **Tires** (2026-11-12): the buggy, the gun jeep, the troop truck and the armored rover all ride on the owner's
  separate Rugged Off-Road Tire (`vehicles/offroad_tire.glb`), one at each hub: `wheels` in the vehicle's JSON
  (`model`, `at`: the hubs in the mount's frame, and `radius` and `width`: the size it is drawn at, the model
  scaled to them). `mountVisuals.ts` puts each on a pivot at its hub, so it rolls with the speed (by its drawn
  radius), the front pair steers, and each rides its own spring (see Suspension below). The bodies' own tires are
  cut out of them at build time and thrown away (`parts` in `content/guns.json` with `round` and `drop`: a
  wheel-shaped cut that leaves the arch on the body), and `rideHeight` holds the body where it stood on them.
  Before, the tires were kept as parts (`wheel_*`) and spun about their boxes' middles: the box cuts took fenders
  with them and were off the axles, and the armored rover's never turned.
- **Shooting from a seat.** Gunners fire the seat's gun (heat, no
  reloading) within its arc; side door guns (the gunship's) have arcs centred
  on their own side (`facing` on the seat). Passengers use their own weapons. Drivers can't
  shoot unless the seat has a gun (the speeder's and skyfighter's pilots).
- **Damage.** Bullets, projectiles and blasts hurt mounts. A destroyed mount
  explodes, throws out everyone aboard into the blast and comes back where it
  was placed after its respawn delay (set per mount in the inspector).
  Sentries can be given a team in the inspector.
- **Damage states** (everyone sees them; thresholds in `mounts.ts`):
  light grey smoke under 60% health, thick black smoke and sparks under
  35%, on fire under 15%. A **burning** vehicle loses health on its own
  (from 15% it blows in about 5 s) unless something finishes it first; the
  people inside see "Vehicle on fire — bail out!" on their vehicle health
  panel. Whoever hit it last gets the kills when it goes up.
- **Explosions.** A layered fireball (white flash, core, outer ball and
  bursts of flame round it), a shockwave ring along the ground, sparks,
  charred chunks on the effects physics and a column of black smoke; a deep
  boom and falling metal; cameras shake, out to about six blast radii. The
  blast hurts players, other mounts and destructibles in reach, so parked
  vehicles, barrels, gas cans and explosive props go up in chains, and it
  lights oil. Its kills show "✹ Wreck" in the feed, credited to the
  attacker.
- **Wrecks.** A destroyed vehicle leaves a charred, smoking hulk where it
  fell (a downed flyer drops to the ground): solid cover in the simulation
  and in client prediction, with no seats (it reads as not alive, so bots
  never try to board it). It stands for 20 s (never past the respawn delay
  less 1.5 s), then stops being solid and sinks and fades while the vehicle
  waits to respawn at home. Turrets and sentries leave no wreck.
- **Crashes.** Driving into another vehicle, a wreck or a turret at 5 m/s
  or more (closing speed) hurts both, `(closing − 3) × 8` shared out by
  weight: a hover bike into a tank comes off far worse. Each driver is credited for
  the other's damage, and the lighter one is shoved. Running people over
  (5 m/s+) hurts and throws them, credited to the driver. Both play a metal
  crash with sparks.
- **Lava, acid and water.** Lava sets a vehicle on fire at once and burns
  20% of its health a second; acid eats 6% a second; a ground vehicle
  sunk deeper than its body floods (12% a second). Hovercraft and flyers ride
  over water.
- **Vehicle damage setting** (arcade setup, more rules; `rules.vehicleDamage`):
  Normal, Tough (vehicles take half damage) or Off (indestructible, except by
  falling off the map). Turrets and sentries always take full damage.
- **Net code.** Mounts go out in every snapshot (`mt`: health %, state bits
  alive / wreck / burning, occupants); `explode` events carry `m` for a
  vehicle blowing up, and `crash` events a position and strength;
  your seat comes in your private state (`mo`). Riding isn't predicted
  locally: the server moves you, and the client smooths the vehicle's pose.
  Vehicle bodies are in the prediction physics, so walking into one feels
  solid.

- **Roads.** On a map with a track, wheeled vehicles grip the road
  better and are a little slower off it. A track can carry NPC-driven
  ambient cars in any mode (see GAME_MODES.md, "Tracks and NPC traffic";
  Race mode was removed on 2026-11-08). `TrackDriver`
  (`sim/trackDriver.ts`) drives any vehicle round a track.

Rockfall Canyon has a buggy, a speeder and a hover bike at each base, an MG
turret on each roof, a hauler on the west ledge, a dropship on the east and
two sentries mid-field. Coldwater Gulch adds a gun jeep to each base's apron;
Frost Basin a pair of snow sleds on each plateau, a glider on each roof and
the air drop (below).

## Arc Turret

`MOUNT_DEFS.sentry_arc` (`sentry.arc`: `ArcSentrySpec`), its weapon `core.sentry_arc`, run by `Match.runArcSentry`.
The point is a counterable auto-turret: the Sentry Gun fires on sight and its spread decides the fight, the Arc
Turret never misses but tells you it is coming and lets go when you break its line.

| | Sentry Gun | Arc Turret | Heavy MG Turret (manned) | Rocket Turret (manned) |
|---|---|---|---|---|
| Damage | 7 a round, every 7 ticks (60/s), 0.03 rad spread | 5 a hit, every 6 ticks (50/s), no miss; jumps once (6 m, half) | 11 every 4 ticks (165/s) | 110 splash, 30 on impact |
| Range | 30 m | 22 m | 160 m | rockets |
| Before the first hit | turning only | 0.75 s wind-up, lined up (±0.2 rad) | gunner | gunner |
| 100 health in the open | ~1.6 s if every round lands | 20 hits: 2.65 s from the start of the wind-up (1.9 s of arc) | ~0.6 s | 1 rocket near-hit |
| Counter | cover, distance (spread) | break its line of sight or leave 22 m: the lock and the charge drop, the next lock needs the full wind-up; a full 2 s lock (100 at most) ends in a 1.25 s vent | kill the gunner | dodge |

States go to clients as mount snapshot bits (`MOUNT_FLAG_CHARGING`, `MOUNT_FLAG_ARC`): the body glows brighter
through the wind-up and a ball of its colour grows over the gun where the arc starts (`View.arcSentryGlow`);
the warning sound (`trap.warn`) plays as a wind-up starts; each hit is an `arc` event with the mount's index
(`m`), drawn in its colour and heard as a crackle a few times a second. Bots treat it as the Sentry Gun: a target
they shoot back at (`hostileSentries`). Unit tests: `packages/shared/test/arcSentry.test.ts`; e2e: the vehicles
flow's `arcTurretChecks`. Not placed on any official map (the owner decides where).

## In-house cockpits

Up close the buggy's Meshy body (one 2048 px colour map over all 4.4 m) smears
and its roll cage turns to lumpy blobs, so the driver's own cockpit view draws
parts we build ourselves instead, crisp at any distance. They are data, one
entry per mount id in `packages/client/src/content/cockpits.ts`, built into
geometry by `game/cockpitGeometry.ts` (no model files, nothing to download):

- **tubes**: round bars along a path of points, corners rounded at a bend
  radius (the roll cage, grab handles);
- **boxes** with rounded edges and **discs** (panels, floor, lamps, pedals);
- **seats**: bucket seats (cushion, backrest, side bolsters, headrest, shell)
  from a crease point, a recline and a width, with a five-point **harness**
  if asked;
- **wheel**: rim, spokes, hub and column at a point, along a column direction;
  it turns with the front wheels' steering (`ms` in the snapshot) times `lock`;
- **gauges**: dials with ticks; a `speed` needle reads the speed against `max`,
  a `revs` needle runs a made-up gearbox; **switches**: toggle rows;
- **hide**: boxes in the mount's frame; the body's triangles wholly inside one
  are left out of your copy of the body while the parts show.

Everything is in the mount's frame (the same as `MOUNT_DEFS` seats and
`cockpitEye`), and `mirror` repeats a part on the other side. Colours are a
named palette; four surfaces (powder-coat paint, seat fabric, plastic and
rubber, bare steel) are PBR materials over the parts' vertex colours, with a
small generated roughness grain. Everyone else, and your chase camera, see the
body alone (`game/cockpitInterior.ts` adds the parts under your vehicle's body
node, so they ride its springs and tilt).

The buggy's was measured on its model (slices of the triangles; refitted to the
sci-fi buggy on 2026-11-11): the roof frame at 1.65 m on rails 0.58 m either side
from the hoop behind the cabin (z -0.6, where the deck starts) to the front bar
with its lamps (z 0.4), a hoop behind the seats (z -0.15), A-pillars and a centre
brace falling to the hood, one row of seats (the deck riders stand), the wheel on
the left at z 0.58 and a cowl over the dash so the road shows past the hood. About 17k triangles in 9 draws (4 surfaces static, 2 for the
wheel, one per needle), built once on first use. The gun jeep can get
one by adding an entry.

## Suspension (the Warthog feel)

The buggy, the gun jeep and the troop truck ride on **raycast suspension** in the simulation
(`shared/src/sim/suspension.ts`, tuning in `MOUNT_DEFS[…].vehicle.suspension`):
one ray straight down per wheel each tick finds the ground under it, and a
spring and damper per wheel push on a sprung body above the chassis. The four
pushes set the body's **height, pitch and roll**: it bounces over bumps, leans
out of turns, squats under power and dives under the brakes, keeps the spin it
leaves a ramp with and drops its nose a little in the air (the tumble), and
lands on its springs with a bounce (hard landings hit the bump stops). Wheels
off the ground (over a crest, two on a kerb) grip less. The chassis itself
moves as before (the vehicle probe, its collision box level), so hit boxes,
seats and shots are unchanged; the sprung body is what everyone sees, sent in
snapshots as `ms` (MULTIPLAYER_PROTOCOL.md §17).

Both are also **loose at speed** (`drift`: the share of tyre grip lost at top
speed, rising with the square of speed), so a hard turn flat out powerslides,
and the handbrake (Space) still breaks grip for a proper slide.

| Vehicle | Springs (freq, damping) | Travel / bump stop | Squat · lean (rad per m/s²) | Air tumble | Landing | Drift | Steering lock |
|---|---|---|---|---|---|---|---|
| Buggy | 1.5 Hz, 0.32 (soft, bouncy) | 0.20 / 0.16 m | 0.004 · 0.0045 | 1.4 rad/s² | 0.5 | 0.55 | 0.5 rad |
| Gun Jeep | 1.8 Hz, 0.38 (a pickup: firmer) | 0.16 / 0.13 m | 0.0028 · 0.0038 | 1.2 rad/s² | 0.45 | 0.4 | 0.45 rad |
| Troop Truck (six wheels) | 1.9 Hz, 0.45 (a truck: stiff) | 0.14 / 0.11 m | 0.002 · 0.0025 | 0.8 rad/s² | 0.4 | 0.15 | 0.4 rad |
| Armored Rover | 1.9 Hz, 0.45 (the truck's) | 0.14 / 0.11 m | 0.002 · 0.0025 | 0.8 rad/s² | 0.4 | none | 0.4 rad |

The armored rover got its springs on 2026-11-12, so its tires steer and ride them; its speeds, turn, grip and mass
are as before, and on level ground it drives the same tick for tick (`packages/shared/test/suspension.test.ts`).
The tank stays heavy and planted, and the
hovercraft and flyers are unchanged: their bodies are drawn settling to the
ground as before (`View.suspend`, drawing only).

In first person the cockpit eye follows the springs eased (COCKPIT_EYE_FOLLOW
in vehicleCamera.ts: well under half of a landing's bounce, all of a steady
lean), on top of the view's already damped tilt, so the bounce shows in the
dash and the frame, not in your stomach.

**Cost.** Four rays per vehicle per tick, only while it moves: a parked vehicle
stops once its springs settle, empty vehicles far from every player skip it,
and past 96 rays in a tick (24 four-wheelers) the rest reuse the ground they
found last tick on two ticks of three.

## Handling classes

Every vehicle is one of the classes the simulation already runs, with its
own tuning (top speed, acceleration, turn rate, grip, weight, health, blast):

| Class | How it drives | Vehicles |
|---|---|---|
| Wheeled light | Grippy, quick to turn, ramps launch it, hard landings dent it (buggy and gun jeep: on raycast suspension, loose at speed) | Buggy, Gun Jeep |
| Wheeled heavy | Slow to speed up, high grip and weight: shrugs off pushes, loses little in crashes | Armored Rover (14 m/s, accel 7, turn 1.25 rad/s, grip 0.38, 3.6 t, 900 health), Troop Truck (16 m/s, accel 8.5, turn 1.4 rad/s, grip 0.36, 3 t, 700 health; on raycast suspension) |
| Tracked | Slowest, heaviest, turns on the spot | Tank |
| Hover | Low grip, drifts, floats over bumps, no landing damage | Speeder, Hauler, Hover Bike, Snow Sled |
| Flying | Hover handling plus climb (jump) and dive (crouch) up to a ceiling | Skyfighter, Dropship, Gunship |

## Paint skins

Every placed vehicle or turret has a **Paint** setting in MapMaker's inspector
(`skin` on the mount entity): Automatic, Factory paint, Desert, Forest, Snow,
Urban grey or Team colour. Automatic paints a team-owned vehicle (one given a
team in the inspector) in its team's colour and leaves the rest in factory
paint, so the team bases on Coldwater Gulch and Frost Basin read at a glance.
Skins are a tint over the model's own colours (the model gets its own copy of
its materials); pale skins glow a touch so snow paint reads white. Paid
upgrades are not planned.

## Parachutes and gliders

Anyone falling from height can open a parachute: **hold Space while falling,
at least 5 m above the ground**. It settles to a 4 m/s sink and steers at
5.5 m/s with WASD; **crouch cuts it away**; it packs itself up when you land,
swim or catch a ladder. Landing under a canopy never does fall damage. With a
**Glider** (a pickup, lost when you die) the canopy is a hang-glider instead:
2.4 m/s sink, 15 m/s forward along your view (W faster, S slower), so a jump
off Frost Basin's cliffs reaches the ridges. With a jetpack on, Space is
thrust and never pulls the cord.

Jumping out of the transport plane, or out of a flyer high up, arms the
**automatic opener**: if you haven't opened it by about 28 m above the
ground, it opens for you. Bots always have it (and never cut away), so they
come down safely from flyers and the plane. The HUD offers "Open your
parachute (Space)" whenever a fall is high enough.

Drawn from code (no model files): a striped dome on rigging lines, or a delta
wing with a control bar, over the wearer's head; gliders fly lying forward.
The sim is `shared/src/sim/parachute.ts` (run inside `stepMovement`, so
client prediction matches); snapshots carry `ch` (canopy) and `dr` (opener
armed), private state `gl` (glider).

## Retired vehicles

The **Go-Kart** (`kart`) and the **Ice Cream Truck** (`ice_cream_truck`) were retired on 2026-11-12 (owner, after
seeing every vehicle side by side: simple old models next to the rest). Their definitions and palette entries are
gone. A map names a vehicle by id, so the two ids stay readable for good (`RETIRED_MOUNTS` in
`packages/shared/src/sim/mounts.ts`, `packages/shared/src/map/mountAliases.ts`), the way retired props and tiles do: a
map that names one is still a valid file as written, and as played it has the vehicle that took its place.

| Retired | Reads as | Why that one |
|---|---|---|
| Go-Kart (`kart`: 1 seat, no gun, 20 m/s, 220 health) | Hover Bike (`hover_bike`) | Also one seat and no gun, a quick thing to run people over with. Faster (31 m/s), more fragile (170 health), and it hovers and drifts where the kart gripped |
| Ice Cream Truck (`ice_cream_truck`: 4 seats, no gun, 16 m/s, 520 health) | Buggy (`buggy`) | Also no mounted gun, its riders shooting their own weapons, so a map gains no machine gun it was not made with (the Gun Jeep would bring one). Six seats for four, a little quicker (18 m/s) and lighter (450 health), 0.25 m wider a side |

- A placed vehicle keeps its place, facing, team, paint and respawn time. A track's NPC cars (`ambientVehicle`) and
  its old race vehicle read the same way; a track that doesn't say gets Hover Bikes (the default was the Go-Kart).
- Saved, community and published maps that still name a retired id load, check and play
  (`packages/shared/test/mountAliases.test.ts`, with Cedar Lane's file as it was). Nothing about the file changes: its
  release stamp still describes it (no new version, no "changed since it was exported").
- MapMaker opens such a map as made, draws and describes the retired vehicle as its replacement, and says so: the
  vehicle's inspector shows "Go-Kart (retired)" as its Type with **Replace all** (every one on the map and the track's
  cars, one undo step), the track's pane has the same button, and the checks list `mount.retired` (a warning). The
  shipped maps were changed that way and name the new vehicles.
- Never reuse a retired id for something new.

## Drawing a model larger: `scale`

A mount can draw its model larger or smaller than it was built (`scale` in `content/vehicles/<id>.json`,
`MountDef.scale`, 0.25 to 4, default 1): about its footprint's centre, its lowest point still on the ground (or at
its ride height). Drawing only: `half`, the seats and `cockpitEye` are metres as always and must be fitted to the
model at that size, and its lower levels of detail come in that many times further off. Two use it: the Transport
Plane (the Hauler's model at 2.35) and the Heavy MG Turret (2). It costs no download; the texture is that much
coarser, so for a model seen close up at a much larger size, build it larger in `content/guns.json` instead.

## The transport plane and air drop

The craft is the **Hauler's model drawn 2.35 times its size** (owner, 2026-11-12): the Ironbound Voyager at 16 m long,
a closed hull 4.2 m wide and 5.65 m tall. That is the length the old plane's box had, so riders leave from the same
place behind it and the chase camera sits where it did. Its 24 riders are in the hold, two columns of twelve, out of
sight in the closed hull (measurements in `content/vehicles/airplane.json`).

A **Transport Plane** (MapMaker: Entities → Gameplay; map entity `airplane`,
format v19) flies a fixed route over the map: its marker is the route's
anchor, the route is a list of [x, z] points (metres from the marker, edited
as a point list in the inspector), flown at an **altitude** above the marker,
once every **lap time**; a **closed** route loops, an open one flies first
to last and then starts over, throwing out anyone still aboard. Where it is
depends only on the match clock, so it costs nothing on the wire beyond the
usual mount snapshot. It can't be hurt and doesn't block anything.

Players ride it on 24 benches (passengers with a chase camera, unable
to shoot) and **jump out with E or Space** at any time: out of the tail with
half the plane's speed, the parachute opener armed. **Air drop** decides who
starts aboard: *Off* (it just flies over), *Round start* (everyone's first
spawn of each round is in the plane: a battle-royale start) or *Every spawn*.
Bots aboard pick a drop point (the enemy flag in Capture the Flag, a hill in
King of the Hill, a bomb site in Bomb, otherwise their own base) and jump when
the plane passes over it, then parachute in.

The validator errors on route points closer than 10 m and warns when the
plane passes under 12 m over the ground or buildings, flies slower than 8 or
faster than 90 m/s, or strays more than 60 m outside the map boundary. Frost
Basin has one: a 520 m loop over both bases at 70 m, with air drop at round
start.

## Did the TimeSplitters MapMaker have these?

As far as we know, no: TimeSplitters 2 and Future Perfect's MapMaker had no
turrets or vehicles you could place. Future Perfect's story mode had mounted
guns and vehicle sections, but they weren't MapMaker pieces. These are our
own addition, sized after the familiar arena-shooter staples: the
four-seat jeep with a gunner, the two-seat hover bike and the six-seat
transport.
