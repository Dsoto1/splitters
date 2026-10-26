# Turrets, sentries and vehicles

Place them from MapMaker's Entities → Vehicles tab. Players walk
up and press **E** to get in (driver first, then gunner, then passengers) and
**E** again to get out. The definitions are data in
`packages/shared/src/sim/mounts.ts`. Models come from Kenney Space Kit,
Car Kit and Holiday Kit, Quaternius' Ultimate Spaceships and Tank Pack (all CC0).

| Mount | Seats | What it does |
|---|---|---|
| Heavy MG Turret | 1 gunner | Twin machine gun on a pedestal, ±80° arc, overheats instead of reloading |
| Rocket Turret | 1 gunner | Slow, heavy rockets, ±70° arc |
| Sentry Gun | none | Aims and fires on its own at its team's enemies (no team: everyone) |
| Go-Kart | 1 driver | Very quick, no gun: run people over |
| Speeder | 2 (pilot, passenger) | Hovering; the pilot fires twin blasters ahead, the passenger shoots their own weapon |
| Buggy | 4 (driver, gunner, 2 passengers) | The gunner works a roof machine gun all round; passengers shoot their own weapons |
| Hauler | 6 (pilot, gunner, 4 passengers) | A slow hovering transport with a rocket gunner |
| Skyfighter | 1 pilot | Flies: the pilot climbs (Space) and dives (Ctrl/crouch), up to 30 m above where it was parked, firing twin blasters ahead |
| Dropship | 6 (pilot, gunner, 4 passengers) | A flying troop carrier with an all-round door gun; riders stand on the deck |
| Tank | 3 (driver, cannon, roof gun) | Slow and heavy (1200 health): the cannon fires explosive shells within 35° of the nose, the roof gun works all round |
| Gun Jeep | 3 (driver, roof gun, passenger) | Wheeled light: a quick pickup with an all-round machine gun on the back (380 health) |
| Armored Rover | 5 (driver, front gun, rear gun, 2 riders) | Wheeled heavy: slow, grippy and 900 health; the front gunner covers ±75° ahead, the rear gunner ±90° behind |
| Hover Bike | 1 rider | Hover: the fastest thing on the map (31 m/s), fragile (170 health), no gun |
| Gunship | 3 (pilot, left and right door guns) | Flying, on the dropship's flight model: the pilot fires blasters ahead, each door gunner covers ±70° off their own side (950 health) |
| Ice Cream Truck | 4 (driver, 3 riders) | Wheeled light, the fun one: no gun, but the three riders shoot their own weapons out of the windows |
| Snow Sled | 2 (driver, passenger) | Hover handling on runners: quick and slidey, sits on the snow instead of floating |

- **Driving.** W/S throttle and reverse, A/D steer (harder the faster you
  go). Vehicles slide along walls, lose half their speed in a crash and
  follow the ground (terrain included). At speed they run down enemies,
  credited to the driver.
- **Cameras.** Drivers and pilots start in the **cockpit**: the eye sits at
  the driver's seat (a seated head height, a little forward, or the
  vehicle's own `cockpitEye` in `MOUNT_DEFS` where the model needs it), the
  ridden model is drawn one-sided so the hood, nose and frame show without
  the inside of the roof and doors in the way, and the view turns with the
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
- **Models.** The gun jeep (pickup truck), armored rover (delivery truck) and
  ice cream truck (van) are Kenney Car Kit models recoloured at build time;
  the hover bike (speeder A), gunship (cargo craft B) and transport plane
  (cargo craft A) are from Kenney Space Kit; the snow sled is Kenney Holiday
  Kit's long sled. The tank is Quaternius' Tank Pack (CC0) desert tank. The speeder (Striker), hauler (Dispatcher), skyfighter
  (Spitfire) and dropship (Imperial) are from Quaternius' Ultimate
  Spaceships (CC0), trimmed by `tools/content/prepare-ships.mjs`.
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
  weight: a kart into a tank comes off far worse. Each driver is credited for
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

- **Roads.** On a map with a race track, wheeled vehicles grip the road
  better and are a little slower off it. Race mode puts everyone in a
  vehicle on the start grid; a track can also carry NPC-driven ambient cars
  in any mode (see GAME_MODES.md, Race). `TrackDriver`
  (`sim/trackDriver.ts`) drives any vehicle round a track.

Rockfall Canyon has a buggy, a speeder and a hover bike at each base, an MG
turret on each roof, a hauler on the west ledge, a dropship on the east and
two sentries mid-field. Coldwater Gulch adds a gun jeep to each base's apron;
Frost Basin a pair of snow sleds on each plateau, a glider on each roof and
the air drop (below).

## Handling classes

Every vehicle is one of the classes the simulation already runs, with its
own tuning (top speed, acceleration, turn rate, grip, weight, health, blast):

| Class | How it drives | Vehicles |
|---|---|---|
| Wheeled light | Grippy, quick to turn, ramps launch it, hard landings dent it | Go-Kart, Buggy, Gun Jeep, Ice Cream Truck |
| Wheeled heavy | Slow to speed up, high grip and weight: shrugs off pushes, loses little in crashes | Armored Rover |
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

## The transport plane and air drop

A **Transport Plane** (MapMaker: Entities → Gameplay; map entity `airplane`,
format v19) flies a fixed route over the map: its marker is the route's
anchor, the route is a list of [x, z] points (metres from the marker, edited
as a point list in the inspector), flown at an **altitude** above the marker,
once every **lap time**; a **closed** route loops, an open one flies first
to last and then starts over, throwing out anyone still aboard. Where it is
depends only on the match clock, so it costs nothing on the wire beyond the
usual mount snapshot. It can't be hurt and doesn't block anything.

Players ride it on 24 benches (seated passengers with a chase camera, unable
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
