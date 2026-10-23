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
| W A S D, Space | Move, jump (jumping also stands you up) |
| Shift | Sprint while moving forward: faster, uses the stamina bar (yellow; red when you've run dry). Firing stops a sprint |
| C / Z | Crouch / lie prone (toggles): slower, smaller target, steadier aim |
| Mouse, left / right button | Aim, fire / zoom or alt-fire |
| 1–9 | Pick a weapon slot (press again to cycle weapons in that slot) |
| R | Reload |
| G | Hold to aim a grenade (the arc, bounces and blast area show), let go to throw |
| Shift (scoped) | Hold your breath to steady the sniper scope |
| E | Use: get in / out of vehicles and turrets, doors, switches |
| Tab | Scoreboard |
| F3 | Performance stats |
| F11 or Alt+Enter | Fullscreen (also a button in the pause menu and Options); in fullscreen a quick Esc pauses, holding Esc leaves fullscreen |
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
- [ ] Pistols: hands wrap round the grip (no fingers through the slide), in first person and on other players.
- [ ] Shotguns: `core.sawed_off`, `core.auto_shotgun`. Pistols: `core.hand_cannon` (big kick), `core.gilded_pistol`, `core.machine_pistol`.
- [ ] Status effects show as a tint on screen: burning, poisoned, slowed, frozen.
- [ ] Grenades (G): sticky, incendiary, toxic and vortex grenades from pickups.

## 3. Maps

Play each for a minute: spawn, walk the main routes, pick up a few items, look for holes, floating
props, walls you can see through, spots you get stuck, items you can't reach.

- [ ] `canyon` (Rockfall Canyon): the west ledge, the stairs up to each base roof, the ruins on the east side.
- [ ] `skyward`: jump pads throw you up to the next platform and you land on it.
- [ ] `sky_islands`: see section 4.
- [ ] `ridge_camp`, `twin_spires`, `lantern_quarter`, `frost_basin`, `felicity_yard`, `jungle_steps`,
      `reactor`, `gallows_yard`, `bottling`, `step_temple`, `silo_complex`.
- [ ] Bots move around each map and don't stand stuck against walls.

## 4. Set pieces (`?offline=sky_islands`)

- [ ] Cross a crumbling stepping-stone bridge: each stone shakes, then drops; it comes back a few seconds later.
- [ ] Step on a trapdoor over the lava (west island): it swings away and you fall in; lava hurts fast; climb the steps in the corner to get out.
- [ ] Swim in the centre pond: you sink slowly, hold jump to rise, jump at the surface to climb out; the view goes blue under water; stay under 15 s and you start drowning.
- [ ] Grab a jetpack (north or south island): hold jump in the air to fly; the HUD gauge drains and refills; others see your flame.
- [ ] Shoot a breakable plank block apart; it comes back later.
- [ ] Ride the jump pad on the centre island up to the sky platform.

## 5. Scenery

- [ ] Look past the border on a few maps: a photo sky, ground carrying on, distant scenery fading into haze (mesas on `canyon`/`sandgate`, snowy peaks on `frost_basin`, mountains on `bottling`, a city on `reactor`/`lantern_quarter`, jungle round `step_temple`, a starfield on `skyward`).
- [ ] Sunset, dusk and night maps are lit to match (warm and low, or dim and blue).
- [ ] Grass and flowers grow on the canyon floor; they don't poke through floors, and never hide a crouching player.
- [ ] Frame rate stays smooth when you look across a grassy field (F3 shows it).

## 6. Movement and gunplay

- [ ] Walking feels slower than before; Shift sprints, the stamina bar drains and refills after a short rest; run it dry and you can't sprint until it's back to a quarter.
- [ ] C crouches (view drops, slower, tighter spread), Z goes prone (view near the floor, very slow); you can't stand up under a low ceiling; Space stands you up.
- [ ] Bots crouched or prone look it (crouch pose, lying on the ground) and are harder to hit.
- [ ] Shoot a wall: each round flies from your muzzle, leaves a hole that stays all match, sparks and dust.
- [ ] Shoot someone in the head: red hit marker, "HEADSHOT" on a kill, a ✛ in the kill feed. Leg hits do less damage.
- [ ] Shells fly out of the right side of your gun and rattle on the floor.
- [ ] Sniper: scope in (right mouse) to see the reticle; the sights sway; hold Shift to steady them until your breath runs out. Unscoped, it sprays.
- [ ] Hold G: an arc, bounce rings and the blast area show; let go to throw. The grenade follows the arc unless something moves into its way.
- [ ] Damage a vehicle: a health bar over it, smoke under half, fire under a quarter; inside one, a health panel at the bottom.
- [ ] Bodies stay where they fall after the player respawns (Pause → Bodies: Stay / Fade); shoot a body and it jerks and bleeds.

## 7. Hits, blood and ragdolls

- [ ] Shoot a bot: a meaty thump at the bot, a tick for you, a small red spray and splats on the floor or wall behind it.
- [ ] Kill a bot with a shotgun or rifle: it's thrown along the shot and falls limp down slopes and stairs; a small pool under it.
- [ ] Kill one with a grenade or rocket: it's thrown away from the blast.
- [ ] Blow up a crate or barrel: the chunks bounce, roll and come to rest, then shrink away.
- [ ] Pause → untick **Blood**: no more spray, splats or splat sound (remembered next time).
- [ ] MapMaker → Map properties → **Blood**: pick Alien (green) and Heavy, TEST: blood is green and there's more of it.
- [ ] On `canyon` or `frost_basin`: no rock, log, bush or crate floats at the edge of a slope; rocks and logs lean with the hill, trees stand straight.
- [ ] MapMaker: place a rock on a hillside and drag it up and down the hill: it stays on the ground.

## 8. Shooter homages (`backwoods`, `dockside_depot`, `bunker_cross`, `rail_stockyard`)

- [ ] **Backwoods Lodge:** attack the lodge from the woods by each route: across the yard, past the barn (sniper rifle in the hayloft), along the road to the garage, and through the long drain into the cellar.
- [ ] **Dockside Depot:** fire escape to the roof, drop through a hatch into the offices; crawl the air duct from the back strip into the north-west office; fight across the truck lot.
- [ ] **Bunker Cross:** press **Call the airstrike** in the south control room (E): alarm, blast doors seal, everyone in the yard dies after 6 s; it's ready again after 60 s.
- [ ] **Rail Stockyard:** reach the railgun on the crane perch along the girder from the west shed roof; use the culvert under the yard and the jump pad out of the pit.
- [ ] Each one in Team Deathmatch from the Arcade: teams start on their own sides.

## 9. Teams (Arcade)

- [ ] Arcade → pick a map → set 3 or more team rows with different sizes (try 2,2,2,2,2,2,12).
- [ ] The score bar and Tab scoreboard show every team in its colour.
- [ ] Teams are filled to the sizes you set; teammates don't take damage from you (if friendly fire is off).

## 9b. Objective modes (see [GAME_MODES.md](GAME_MODES.md))

Capture the Flag (`?offline=bunker_cross&gamemode=core.ctf`, also `rail_stockyard`, `twin_spires`):

- [ ] Both flags stand on glowing bases in team colours; the line under the scorebar reads "Your flag: Home" and "<Team> flag: Home".
- [ ] Walk onto the enemy flag: "You have the flag! Take it home!", you are a little slower, a marker points home, E won't get you into a buggy, and a jetpack does nothing until you drop or capture.
- [ ] Bring it home with your flag there: "You captured the flag!", the team score goes up, and the flag is back on its base.
- [ ] With your own flag taken, standing on your base with theirs scores nothing.
- [ ] Die while carrying: the flag lies on the ground where you fell. A teammate of its team touching it sends it home ("returned"); otherwise it goes home after 30 s (the countdown shows).
- [ ] When a bot takes your flag you hear the alarm and see "Your flag has been taken!"; other players see the flag on the carrier's back.
- [ ] Leave it running with bots for a few minutes: the bots capture, return and chase.

King of the Hill (`?offline=bunker_cross&gamemode=core.koth`):

- [ ] The hill ring shows with a marker. Stand in it alone and your team's score climbs once a second; with an enemy inside it reads "Contested" and stops.
- [ ] Every 60 s "The hill has moved!" and the ring jumps to the next spot.

Elimination (`?offline=sandgate&gamemode=core.elim`):

- [ ] When you die you stay out ("Out until the next round"); the status line counts the players standing on each side.
- [ ] When a side is wiped out, "<Team> win round N", a 3 s pause, then everyone respawns for round N+1.

Arcade and MapMaker:

- [ ] Arcade: maps with flag bases and hills show Capture the Flag and King of the Hill tabs; CTF has two team-size steppers; the score row is labelled Captures / Hill seconds / Rounds to win.
- [ ] MapMaker → Entities: place two Flag Bases (the second goes to the other team on its own) and a few Hills. Set Map properties → Mode to Capture the Flag and TEST. Remove one base: validation names the missing team.

## 10. MapMaker

- [ ] Layout: top-bar workspaces **Build / Entities / Logic / Environment / Test** swap the palette's sub-tabs; tile cards show 3D thumbnails; a hover card by the pointer names the piece (size, theme, connectors). Check it at 1280×720 too.
- [ ] Tool bar over the view: **Select (V)**, **Place (P)**, **Erase (X)**, **Paint (B)**, **Walls (O)**, **Terrain (T)**, then **Rotate (R)** and **Delete (Del)**. The lit tool and the line under the bar say what the mouse buttons do.
- [ ] **Erase:** hover anything and it is outlined red and named in the bottom bar; a click deletes it. Try a tile, a prop, a pickup, a door, an NPC squad, a water pool and a rock on a hillside (`canyon` template). Ctrl+Z brings each back in one step. Right-click still erases while placing, even if the mouse wobbles a little.
- [ ] **Select** (outlined cyan) something and press Delete or Backspace, or the bar's Delete.
- [ ] **Rotate** (R or the bar button) turns the selection, or the piece you are about to place (a toast shows the angle).
- [ ] **Level strip** (left of the view): ▲ Up / ▼ Down, Page Up / Page Down, or click a level. A toast says which level you are editing, its grid turns cyan and the other levels are ghosted. Erasing on Level 1 never touches the ground floor; **Show all (H)** shows the levels above too.
- [ ] **Entities → NPCs**: Trooper, Gunner, Heavy, Squad, Hunter Squad, Reinforced Squad and Allied Militia. Pick one, click the map, change it in the inspector; TEST and fight them (the militia follows you).
- [ ] **Curves** tab: small / medium / large round corners and arcades, half-round rooms, round tower, curved corridor, balconies. Rotate them and connect them to the regular rooms with no gaps.
- [ ] Wall styles: **High** (2 storeys), **Tower** (4 storeys), **Fence**.
- [ ] **Boundary** panel: fit a boundary around the map, change its style (invisible / wall / fence) and height; you can't walk out of it in TEST.
- [ ] **Teams** panel: set team sizes; TEST fills the teams with bots.
- [ ] Place a buggy, a turret, a sentry and a jump pad; TEST and use each one.
- [ ] Terrain tab: paint grass/dirt/stone, raise and lower hills, undo a stroke.
- [ ] Terrain tab → Plants: paint Overgrown and Bare patches; **Plants follow the ground** resets them.
- [ ] Props tab → Scatter brush: plant a pine forest, bushes and flowers; Alt-click clears; one undo per click.
- [ ] Entities tab: place a Sky Block high up, a Crumbling Floor, a Trapdoor, Water and Lava; resize them in the inspector; TEST them.
- [ ] Props tab: the new Castle & Siege, Town & Market, Trains & Rail, Shop and Industrial sets.
- [ ] Map properties → Backdrop: switch sky, scenery, ground beyond and haze; the view updates at once.
- [ ] Open one of the new maps as a template, change something, TEST, return with F5.

## Reporting

For each problem, note the map, roughly where (or a screenshot), what you did and what happened.
F3 stats help with anything that feels slow.
