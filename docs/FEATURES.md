# What's in the game (inventory, 29 Oct 2026)

Everything players can use, checked against the code, and what exists but isn't reachable yet.

"Maps" counts placements in `maps/*.json`, retired maps included. Retired maps (`shared/src/map/retired.ts`) still ship but no menu offers them. They are phase0_arena, m3_vault, m4_outpost, sky_islands, creature_lab, dead_reel, pharaohs_reach, skyward and sandsweep.

**Ways a player gets a weapon:**
- the mode's starting weapons (`sim/rules.ts`);
- a class loadout (`sim/classes.ts`);
- a map pickup;
- the "Spears only" / "Discs only" rule.

MapMaker's pickup palette lists every item, so **anything below can be placed in a custom map**.

## Weapons (`shared/src/sim/weapons.ts`)

| Weapon | Kind | Slot | Players get it from | Notes |
|---|---|---|---|---|
| Knife | melee | 1 | every loadout except Discs | |
| Pistol | hitscan | 2 | default loadout; Breacher, Mechanic | no pickup item |
| Assault Rifle | hitscan | 3 | Co-op/Zombies/Bomb/Hostage loadout; 109 pickups | alt: underbarrel grenade |
| Shotgun | hitscan | 4 | 112 pickups; Rocketeer, Torch, Bulwark, Mechanic | alt: both barrels |
| Sniper Rifle | hitscan | 5 | 73 pickups | 3× headshot |
| Grenade Launcher | projectile | 6 | 59 pickups; Breacher | |
| Submachine Gun | hitscan | 7 | 114 pickups; Marksman | |
| Rocket Launcher | projectile | 8 | 64 pickups | |
| Plasma Rifle | projectile | 9 | 27 pickups | alt: charged orb |
| Burst Rifle | hitscan, 3-round | 3 | 69 pickups | |
| Marksman Rifle | hitscan | 3 | 57 pickups | zoom |
| Auto Shotgun | hitscan | 4 | 41 pickups | |
| Spin Gun (LMG) | hitscan, spin-up | 7 | 43 pickups; Bulwark | |
| Railgun | beam, charge | 5 | 30 pickups; Marksman | pierces 3 |
| Hand Cannon | hitscan | 2 | 19 pickups; Shade | |
| Sawed-Off | hitscan | 4 | 19 pickups; Runner | |
| Flamethrower | projectile | 9 | 14 pickups; Torch | burn |
| Machine Pistol | hitscan | 2 | 9 pickups; Runner | |
| Laser Rifle | beam, heat | 3 | 7 pickups | no ammo, overheats |
| Gilded Pistol | hitscan | 2 | 6 pickups | 999 damage, 1 round |
| Spear | thrown, retrievable | 1 | Spears-only rule; 6 pickups | one-hit kill; fetch it back |
| Nailgun | projectile | 7 | 4 pickups; Medic | |
| Disc Launcher | projectile | 6 | 4 pickups (frost_basin, ridge_camp) | |
| Arena Disc | disc | 6 | Disc Arena / Discs-only rule | shoves, never hurts; picked up like ammo |
| Flare Gun | sticky projectile | 2 | 2 pickups (cinder_foundry) | fire zone |
| Goo Gun | projectile | 6 | 2 pickups (cinder_foundry) | slow zone |
| Oil Slicker | projectile | 6 | 2 pickups; Torch | oil zone, alt: igniter |
| Freeze Ray | beam | 9 | 2 pickups (cinder_foundry, serene_city) | chill, then freeze |
| Revolver | hitscan | 2 | 1 pickup (training_range) | |
| Pulse Pistol | beam | 2 | 1 pickup (ironhold_prison) | |
| Flak Cannon | bouncing shards | 4 | 1 pickup (reactor) | |
| Grapple Hook | tool | 1 | 1 pickup (serpent_gorge) | |
| Builder | tool | 1 | Fort Wars build phase | places fort pieces |
| Blast Rockets | projectile | 8 | Rocketeer class only | rocket jumps |
| Medi-Beam | heal beam | 1 | Medic class only | |
| **Medkit** | heal | 1 | **MapMaker only** | |
| **Bubble Blaster** | bouncing projectile | 6 | **MapMaker only** | toxic zone |
| **Swarm Launcher** | homing | 8 | **MapMaker only** | |
| **Guided Rocket** | guided | 8 | **MapMaker only** | |
| **Arc Caster** | chain lightning | 9 | **MapMaker only** | |
| **Singularity Cannon** | projectile | 8 | **only on a retired map** | pulls players in |

**Vehicle and turret guns** (never carried):
- Mounted MG
- Mounted Rockets
- Tank Cannon
- Speeder Blasters
- Sentry Gun (also the Mechanic's sentry)

### Throwables

| Throwable | Players get it from |
|---|---|
| Frag | 1 to start (2 in Zombies, none in Discs/Race); 159 pickups; Rocketeer |
| Mine | 20 pickups; Breacher |
| Dynamite | 8 pickups |
| Incendiary | 7 pickups |
| Toxic gas | 5 pickups |
| Sandbag | 2 pickups |
| Sheep | 1 pickup (primeval_park) |
| Airstrike | 1 pickup (iron_compound); 9-kill streak |
| **Sticky, Vortex, Holy, Cluster** | **MapMaker only** |

## Pickups, power-ups and abilities (`sim/items.ts`)

| Item | Where |
|---|---|
| Health 25 / 50 | 439 / 160 pickups |
| Armour 25 / 75 (absorbs 2/3, max 100) | 188 / 91 pickups |
| Ammo box (half refill, all weapons) | 184 pickups |
| Typed ammo: light, rifle, shells, sniper, explosive, cells, fuel, chem | various (chem only on cinder_foundry) |
| Double Damage (×2, 15 s) | 33 pickups |
| Speed Boost (×1.35, 15 s) | grand_marquee, void_yard |
| Jetpack | pantry_raid only |
| Glider | eagle_spires, fernwood_moon, frost_basin |
| Disc powers: fast, triple, split, freeze (3 throws each) | the 3 Disc Arena maps |
| **UAV Uplink** | **MapMaker only** (the UAV itself is the 3-kill streak) |

- **Kill streaks** (on/off in the menu): 3 kills UAV, 5 Supply Pulse, 7 Counter-UAV, 9 Airstrike.
- **No invisibility pickup.** The only cloak is the Shade class.

### Classes (match setting "Classes")

Not available in Co-op, Zombies, Forts, or with Spears/Discs only.

| Class | Role | Notes |
|---|---|---|
| Runner | offence | double jump |
| Rocketeer | offence | |
| Torch | offence | |
| Breacher | defence | |
| Bulwark | defence | 200 HP |
| Mechanic | defence | G builds a sentry that heals and restocks |
| Medic | support | Medi-Beam; G overcharge |
| Marksman | support | |
| Shade | support | G cloak; backstab |

## Game modes (`sim/rules.ts`)

A map offers its listed modes, plus these automatically:
- CTF and Fort Wars wherever there are flag bases;
- King of the Hill with hills;
- Elimination wherever Team Deathmatch is;
- Bomb with bombsites;
- Hostage with hostages and a rescue zone;
- Race with a race-track path;
- Zombies on every map.

| Mode | Rules | Live maps |
|---|---|---|
| Deathmatch | free-for-all, 15 kills | 69 |
| Team Deathmatch | team kills to 40, 2–8 teams; optional Leader hunt | 70 |
| Elimination | rounds, no respawn | 71 |
| King of the Hill | moving hill, 120 points | 53 |
| Capture the Flag | 3 captures | 48 |
| Fort Wars | 150 s build phase with the Builder, then CTF | 48 (only fort_meadow lists it) |
| Bomb | plant/defuse at A/B, rounds | 14 |
| Hostage Rescue | lead hostages out | 8 |
| Co-op | players vs the map's NPCs | 5 (after_hours, blackout, mercy_ward, primeval_park, stonewatch_keep) |
| Zombies | endless waves | all 77 |
| Disc Arena | knock players into the void, 10 knock-offs | 3 (erosion, grid_rings, sushi_belt_sumo) |
| Race | checkpoints and laps in vehicles | 4 (apex_ring, neon_spire, serene_city, undergate_transit) |

Match setting **Weapons**: Normal / Spears only / Discs only (any mode).

## Other features

### Vehicles
- 16 kinds, all used on maps: MG and rocket turrets, sentry, kart, speeder, buggy, hauler, skyfighter, dropship, tank, gun jeep, armored rover, hover bike, gunship, ice cream truck, snow sled.
- Vehicles have skins.
- Airdrop plane with parachutes and gliders (eagle_spires, frost_basin, runway_nine).

### NPCs
- 18 kinds. Official maps use trooper, gunner, heavy, imp, puglin, cyclops, oculus, scolitex and zombie.
- **Never placed on any map** (MapMaker only): sniper, goblin, otter, boglurker, warlord, hyena, alien (Visitor), pirate, titan.
- Squads take orders and enter through vents, hatches, burrows or breaches.

### Scenario objects (MapMaker)
- door (5 styles), button, destructible, zone, trap (6 kinds), jump pad, ladder;
- block (solid, breakable, crumble, trapdoor);
- liquids (water, lava, acid, swamp);
- light, mover, portal, glass;
- flag, hill, bombsite, hostage, rescue.

Portals appear only on pantry_raid and sandfall_colosseum.

### Map logic (WHEN → IF → DO)
- **Events never used on official maps:** door opened/closed, trap fired, objective completed, NPC killed.
- **Actions never used:** next map, light toggle.

### Playlists
**Night Shift is unreachable.** 3 of its 4 maps are retired, so the menu and the Host Service drop it. Only a dedicated server's `PLAYLIST=` setting still loads it.

### Bots
- Easy, normal and hard.
- Mixed, arena and tactical styles, with per-character personalities.
- They drive vehicles and race.
- They take over for players who are away.

### Characters
- 38 looks plus NPC looks.
- Character Designer.
- Body-size setting.

### MapMaker
- Every item, NPC and prop.
- Style packs: military, frontier, imperial, orbital, gothic, jungle, neon, suburban, egypt.
- Paths: one tool for roads, the race track and AI routes (loops, one-way, direction arrows); squads patrol routes, driving bots follow them.
- Logic panel.
- Owner-only Publish.

### Hosting
- In the browser (join codes, relay option).
- Dedicated server: `packages/server`, with `MAP`, `MODE`, `BOT_FILL`, `PLAYLIST` and `ADMIN_TOKEN`.
- LAN discovery.
- Host Service with console and launcher.
- `/host` page.
- Official listed servers are still to come.

### Accounts
- Google sign-in.
- Profiles with a username and region.
- Region-sorted game browser.
- Away/reconnect.

### Spectating
- **Kill cam**: as you die the view turns to your killer and follows them from behind your body (3.5 s, or until you respawn), with a banner: who, the weapon, their health left. A killer out of view: it looks where the shot came from. Any spectator key skips it.
- **Watching while dead** (after the kill cam; the whole round in Elimination, Bomb, Hostage): follow a player over the shoulder (click / → next, right click / ← previous; a controller's RB / LB), or fly a free camera (Space or Y; WASD, E/Q up and down, Shift faster), kept inside the map's bounds. Touch: ◀ Camera ▶ buttons.
- **Spectate by choice**: pause menu → Spectate (a bot fills your place, your slot and score wait); Join game (or J) puts you back.
- **Rule**: in team modes a dead player follows only their team, no free camera; pure spectators, free-for-all modes, offline matches and whoever runs the match may follow anyone and use the free camera.
- Watching with the controls counts as activity: the away and idle rules leave you alone (docs/MULTIPLAYER_PROTOCOL.md §15).

### Hidden entry points
| URL flag | What it does |
|---|---|
| `?offline=<map>` | the only way into retired maps |
| `?mode=editor`, `?mode=designer` | open MapMaker or the Character Designer directly |
| `?mode=assets`, `?mode=characters` | asset and character viewers |
| `?test=1`, `?god=1` | localhost only |
| `?stats` | stats overlay |
| `?sim=main` | runs the match on the page's main thread |
| `?renderer=` | forces a renderer |

### Planned but not built
See `docs/STAGED_IDEAS.md`:
- Dustwater trains;
- Runway Nine airplane set piece;
- Blackout enemies;
- Mercy Ward rooftop zombies;
- map rework batches.
