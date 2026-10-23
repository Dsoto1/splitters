# Turrets, sentries and vehicles

Place them from MapMaker's Entities tab (Vehicles & Turrets). Players walk
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

- **Driving.** W/S throttle and reverse, A/D steer (harder the faster you
  go). Vehicles slide along walls, lose half their speed in a crash and
  follow the ground (terrain included). At speed they run down enemies,
  credited to the driver. Drivers see the vehicle from behind; the camera
  swings round as it turns, and the mouse looks about.
- **Shooting from a seat.** Gunners fire the seat's gun (heat, no
  reloading) within its arc. Passengers use their own weapons. Drivers can't
  shoot unless the seat has a gun (the speeder's pilot).
- **Damage.** Bullets, projectiles and blasts hurt mounts. A destroyed mount
  explodes, throws out everyone aboard into the blast and comes back where it
  was placed after its respawn delay (set per mount in the inspector).
  Sentries can be given a team in the inspector.
- **Net code.** Mounts go out in every snapshot (`mt`) with their occupants;
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
