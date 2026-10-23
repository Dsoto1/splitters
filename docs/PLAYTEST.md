# Playtest guide

A checklist for a hands-on pass through the game. Tick each box as you go and
note anything odd (where you were, what you did, what you expected).

## Setup

```bash
pnpm install
pnpm dev:client        # http://localhost:5173
pnpm dev:server        # only for "Play online"
```

Jump straight into any map with `http://localhost:5173/?offline=<map>`, e.g.
`?offline=canyon`. Click the game once to capture the mouse.

| Key | Does |
| --- | --- |
| W A S D, Space | Move, jump |
| Mouse, left / right button | Aim, fire / zoom or alt-fire |
| 1–9 | Pick a weapon slot (press again to cycle weapons in that slot) |
| R | Reload |
| G | Throw grenade |
| E | Use: get in / out of vehicles and turrets, doors, switches |
| Tab | Scoreboard |
| F3 | Performance stats |
| F5 | Back to MapMaker (when testing from MapMaker) |
| Esc | Pause (Esc twice leaves) |

Console shortcut (F12 → Console, offline matches only): `__give('core.railgun')`
puts any weapon in your hands. The IDs are listed in the weapon test below.

## 1. Vehicles and turrets (`?offline=canyon`, `?offline=frost_basin`)

- [ ] Walk up to the buggy in front of your base: the prompt says **E Drive the Buggy**.
- [ ] E puts you in the driver's seat with a chase camera; W/S drive, A/D steer, the mouse looks around.
- [ ] Drive over grass, up the hills and across the canyon: no falling through the ground, no getting stuck on flat ground.
- [ ] Drive into an enemy: they take damage.
- [ ] E again: you step out beside the vehicle, on your feet.
- [ ] The buggy takes 4 (driver, gunner, 2 passengers). With bots or a friend online, check that the gunner seat fires the mounted MG.
- [ ] The **hauler** (canyon, on the west side of mid) takes 6. The **speeder** takes 2, and the driver fires its blasters.
- [ ] **MG turret** on each base roof: E to man it; it only turns within its arc; hold fire until it overheats (the HUD shows heat in °) and check it cools down.
- [ ] **Rocket turret** (Frost Basin): slow, heavy rockets.
- [ ] **Sentries** (canyon mid): they shoot you on sight; destroy one and it comes back after about a minute.
- [ ] Blow up a vehicle with someone inside (rockets or grenades): riders are thrown out, the wreck comes back later at its parking spot.

## 2. Weapons

Pick them up around the maps or use `__give`. For each one, check that it fires, looks and sounds
distinct, reloads (or overheats), and that the recoil feels right.

- [ ] Several weapons in one slot: pressing the number again cycles through them (the weapon bar shows dots).
- [ ] Fire modes: `core.burst_rifle` (3-round bursts), `core.marksman` (one shot per click), `core.lmg` (spins up before firing).
- [ ] Energy weapons overheat instead of reloading: `core.laser_rifle`, `core.pulse_pistol`, `core.arc_caster` (lightning jumps between nearby enemies), `core.freeze_ray` (slows, then freezes).
- [ ] `core.railgun`: a beam that goes through several players in a line.
- [ ] Bouncers: `core.bubble_blaster` (toxic bubbles that bounce off walls and leave a poison cloud), `core.flak`, `core.nailgun`.
- [ ] `core.disc_launcher`: explosive discs that knock players back.
- [ ] `core.goo_gun`: goo splats that slow anyone standing in them. `core.flare_gun`: flares stick where they land and set fires.
- [ ] `core.oil_slicker`: oil slicks you slide on; its right-click igniter (or `core.flamethrower` / `core.flare_gun`) sets the oil alight.
- [ ] `core.swarm`: homing rockets. `core.singularity`: pulls players in.
- [ ] Shotguns: `core.sawed_off`, `core.auto_shotgun`. Pistols: `core.hand_cannon` (big kick), `core.gilded_pistol`, `core.machine_pistol`.
- [ ] Status effects show as a tint on screen: burning, poisoned, slowed, frozen.
- [ ] Grenades (G): sticky, incendiary, toxic and vortex grenades from pickups.

## 3. Maps

Play each for a minute: spawn, walk the main routes, pick up a few items, look for holes, floating
props, walls you can see through, spots you get stuck, items you can't reach.

- [ ] `canyon` (Rockfall Canyon): the west ledge, the stairs up to each base roof, the ruins on the east side.
- [ ] `skyward`: jump pads throw you up to the next platform and you land on it.
- [ ] `ridge_camp`, `twin_spires`, `lantern_quarter`, `frost_basin`, `felicity_yard`, `jungle_steps`,
      `reactor`, `gallows_yard`, `bottling`, `step_temple`, `silo_complex`.
- [ ] Bots move around each map and don't stand stuck against walls.

## 4. Teams (Arcade)

- [ ] Arcade → pick a map → set 3 or more team rows with different sizes (try 2,2,2,2,2,2,12).
- [ ] The score bar and Tab scoreboard show every team in its colour.
- [ ] Teams are filled to the sizes you set; teammates don't take damage from you (if friendly fire is off).

## 5. MapMaker

- [ ] **Curves** tab: small / medium / large round corners and arcades, half-round rooms, round tower, curved corridor, balconies. Rotate them and connect them to the regular rooms with no gaps.
- [ ] Wall styles: **High** (2 storeys), **Tower** (4 storeys), **Fence**.
- [ ] **Boundary** panel: fit a boundary around the map, change its style (invisible / wall / fence) and height; you can't walk out of it in TEST.
- [ ] **Teams** panel: set team sizes; TEST fills the teams with bots.
- [ ] Place a buggy, a turret, a sentry and a jump pad; TEST and use each one.
- [ ] Terrain tab: paint grass/dirt/stone, raise and lower hills, undo a stroke.
- [ ] Open one of the new maps as a template, change something, TEST, return with F5.

## Reporting

For each problem, note the map, roughly where (or a screenshot), what you did and what happened.
F3 stats help with anything that feels slow.
