# Turrets, sentries and vehicles

Place them from MapMaker's Entities → Vehicles tab. Players walk
up and press **E** to get in (driver first, then gunner, then passengers) and
**E** again to get out. The definitions are data in
`packages/shared/src/sim/mounts.ts`. Models come from Kenney Space Kit and
Car Kit (CC0).

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

- **Driving.** W/S throttle and reverse, A/D steer (harder the faster you
  go). Vehicles slide along walls, lose half their speed in a crash and
  follow the ground (terrain included). At speed they run down enemies,
  credited to the driver. Drivers see the vehicle from behind; the camera
  swings round as it turns, and the mouse looks about.
- **Flying.** Skyfighters and dropships drive like hovercraft and also
  climb on jump and dive on crouch; let go and they hold their height. Left
  without a pilot they sink gently to the ground. Bots fly them at ground
  level.
- **Models.** The tank is Quaternius' Tank Pack (CC0) desert tank. The speeder (Striker), hauler (Dispatcher), skyfighter
  (Spitfire) and dropship (Imperial) are from Quaternius' Ultimate
  Spaceships (CC0), trimmed by `tools/content/prepare-ships.mjs`.
- **Shooting from a seat.** Gunners fire the seat's gun (heat, no
  reloading) within its arc. Passengers use their own weapons. Drivers can't
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

Rockfall Canyon has a buggy and a speeder at each base, an MG turret on each
roof, a hauler on the west ledge and two sentries mid-field.

## Did the TimeSplitters MapMaker have these?

As far as we know, no: TimeSplitters 2 and Future Perfect's MapMaker had no
turrets or vehicles you could place. Future Perfect's story mode had mounted
guns and vehicle sections, but they weren't MapMaker pieces. These are our
own addition, sized after the familiar arena-shooter staples: the
four-seat jeep with a gunner, the two-seat hover bike and the six-seat
transport.
