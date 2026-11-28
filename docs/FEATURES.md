# What's in the game (inventory, 29 Oct 2026)

Everything players can use, checked against the code, and what exists but isn't reachable yet.

"Maps" counts placements in `maps/*.json`, retired maps included. Retired maps (`shared/src/map/retired.ts`) still ship but no menu offers them. They are phase0_arena, m3_vault, m4_outpost, sky_islands, creature_lab, dead_reel, pharaohs_reach, skyward and sandsweep. Citadel joined them on 2026-11-24 (owner): a saved Match Setup that names a retired map plays Sandgate instead, with a line saying so.

**Training maps** (`TRAINING_MAPS` in the same file; owner, 2026-11-24: "its just training and testing"): the Training Range. No map list, category, featured list, Quick Play, vote, rotation, playlist, host page or launcher, or online listing offers it, and it has no modes to pick. **Armory → Test my loadout** (the Armory's header; on Profile → Favourite loadout as Test weapons until 2026-11-28, owner: "it should be in a different location"; Profile's loadout now has a **Weapons** button into the Armory) opens it alone, offline: your favourite class's loadout (the class screen can swap it), every other gun on the range's racks, your optic picks, no bots, no score or clock, nothing counted in your career. Esc opens the pause menu and Esc again (its "◀ Armory", controller B) or "Back to the Armory" comes back to the Armory, Test my loadout focused (Enter or controller A goes again); a phone uses the II button. The tutorial plays on it too. `isUnlistedMap` (retired or training) is the filter every list uses.

**The Practice range** (`maps/practice_range.json`, a training map; owner, 2026-11-19: "a quiet map to try every weapon, the scopes and slide and peek, with targets at marked distances"): **Quick Play → Practice range** (the panel's foot, beside the tutorial; `?range=practice` from the URL) opens it alone, offline, like Test my loadout, and the pause menu's "◀ Menu" or "Leave the range" goes back to the menu. Behind the firing line every weapon waits on eight racks, one per kind, each row signed (they come back a second after you take one, and the host's Mix up leaves them as placed); ammo, grenades, armour and health at the line's ends. Downrange, steel silhouettes at 10, 25, 50, 75, 100, 150 and 200 m (staggered so none hides another), each under a sign with its distance; five plates at 15 m; a silhouette at 20 m that stays up for sprays; a peek wall with a target behind either edge (Q / E); and a slide lane with low cover at its end and a target past it. The targets are MapMaker's Practice Targets (docs/MAPMAKER_SCENARIO.md, "Practice Targets"): each of your hits reads out the zone, your distance, what that round would do to a player there and how many such hits down a fresh one ("Head · 42 m · 96 · 2 hits to down"). Built in MapMaker only.

**Ways a player gets a weapon:**
- the mode's starting weapons (`sim/rules.ts`);
- a class loadout (`sim/classes.ts`);
- a map pickup;
- a weapon dropped by the fallen (rule "Drop weapon on death", default on: `sim/drops.ts`);
- the "Spears only" / "Discs only" rule.

MapMaker's pickup palette lists every item, so **anything below can be placed in a custom map**.

## Weapons (`content/weapons/*.json`, behaviour in `shared/src/sim/weapons.ts`)

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
| Disc Launcher | projectile | 6 | 4 pickups (frost_basin) | |
| Arena Disc | disc | 6 | Disc Arena / Discs-only rule | shoves, never hurts; picked up like ammo |
| Flare Gun | sticky projectile | 2 | 2 pickups (cinder_foundry) | fire zone |
| Goo Gun | projectile | 6 | 2 pickups (cinder_foundry) | slow zone |
| Oil Slicker | projectile | 6 | 2 pickups; Torch | oil zone, alt: igniter |
| Freeze Ray | beam (alt: freeze blast) | 9 | 2 pickups (cinder_foundry, serene_city) | chill, then freeze; the blast holds them in ice 3 s |
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
- Arc Turret (the arc sentry's locked arc: docs/VEHICLES.md, "Arc Turret")

### Weapon Manager (the owner's, `?mode=weapons` → Manage)
An owner and team tool on the weapon tuning page (`?mode=weapons&view=manage`; client `tools/weaponManager.ts`, loaded only when opened, never in the menu's bundle). It changes nothing in the game by itself: it makes a change file, and a session applies it in the repo.

**What it shows**, for every weapon: its picture, name, category and family, description (`notes.description` in its content file; the design note shows in grey where there is none yet), stats, sounds and weapon sets. Filters: All, Edited, Hidden; a search box. One column on a phone.

**What the owner can do** (Edit on any weapon):
1. **Rename** it (its display name; a name another weapon has is refused).
2. **Hide** it, and **Unhide** with one click. A hidden weapon leaves random pickups and the host's mix-up, weapon sets' lists (Mixed bag's "all" too), class loadouts (a class never loses all its weapons), Roulette's signatures (the plain signature or the rifle instead) and MapMaker's palette. **A map that places it still spawns it there**, as placed (in a weapon set with its own list, a placed pickup swaps like any weapon outside the set), and MapMaker's inspector marks it "Hidden". The base kit can't be hidden: a mode's starting weapons, a set's spawn and sniper guns, the rifle (Roulette's fallback); the page says why.
3. **Pick its sounds**: fire, alt-fire (weapons with a second-trigger shot) and reload, from the game's own sound library (`content/sounds.json`, in content provenance), with ▶ to hear each. No uploads. Also (owner, 2026-11-24) **Explosion** (only a weapon that fires something that blows up: played in place of the shared `explosion`, the debris still under it; `view.explosionSound`) and **Impact** (its own hit sound, layered on the struck surface's own; `view.impactSound`). Both are none until picked, so nothing changes until the owner picks one; "None" in the picker takes one away. **Throwables** (listed after the weapons) pick their Explosion the same way (`explosionSound` in `content/throwables.json`; the change file's `throwables` block).
4. **Edit** its category, description and weapon sets (the sets with a list: Military, Sci-fi, Medieval, Chaos; a set's spawn and sniper guns stay).
5. **Edit its stats** as the data has them: damage, pellets, fire interval, magazine, reserve, reload times, draw, range, falloff, headshot, spread, bullet or projectile speed, splash, move speed, sprint to fire, and recoil (a multiplier on every round's kick). Each value stays within its range (`STAT_FIELDS` in `tools/content/weapon-edits-format.mjs`); the game's value shows beside each edited one; the live comparison (stat bars, recoil path, spread cones, damage and time to kill) draws the game's weapon and the edit side by side.
6. **Add a note** or suggestion ("make this louder", "needs a scope") for the team.
7. **Reset** a weapon, or everything, to how it is in the game.

**How a change reaches the game, in plain steps:**
1. The edits stay in the owner's browser (this device only) until sent.
2. **Send changes** shows what changed and the change file (JSON, versioned): **Download** it (put it in Google Drive) or **Copy** it (paste it to a session in chat).
3. The session saves it and runs `node tools/content/apply-weapon-edits.mjs <file>` (`--check` to only check). It refuses the whole file if anything is wrong (unknown weapon or sound, a stat out of range, a newer version, hiding the base kit), warns where the repo changed since the page saw it, writes the edits into `content/weapons/<name>.json` and `content/weapon-sets.json` (untouched lines stay as they were), adds each note to docs/QUEUE.md under "Weapon notes from the owner", rebuilds the weapon, pickup, set and Roulette tables and prints a summary.
4. The session runs `pnpm content:rebuild` (and rewrites the resolved-weapons fixture the tool names), checks and lands it like any change (a check run, then a train). Until it lands, the game is unchanged.

### Throwables

| Throwable | Players get it from |
|---|---|
| Frag | 1 to start (2 in Zombies, none in Discs); 159 pickups; Rocketeer |
| Mine | 20 pickups; Breacher |
| Dynamite | 8 pickups |
| Incendiary | 7 pickups |
| Toxic gas | 5 pickups |
| Sandbag | 2 pickups |
| Sheep | 1 pickup (primeval_park) |
| Airstrike | 1 pickup (iron_compound); 9-kill streak |
| **Sticky, Gravity, Holy, Cluster** | **MapMaker only** |

## Pickups, power-ups and abilities (`content/pickups.json`, `sim/items.ts`)

| Item | Where |
|---|---|
| Health 25 / 50 | 439 / 160 pickups |
| Armour 25 / 75 (absorbs 2/3, max 100) | 188 / 91 pickups |
| Ammo box (half refill, all weapons) | 184 pickups |
| Typed ammo: light, rifle, shells, sniper, explosive, cells, fuel, chem | various (chem only on cinder_foundry) |
| Double Damage (×2, 15 s) | 33 pickups |
| Speed Boost (×1.35, 15 s) | grand_marquee, void_yard |
| **Overdrive, Regen, Rapid Fire, Phantom, Moon Boots, Vampire, Bottomless Mag** (below) | **MapMaker only** (and the coverage map) |
| Jetpack | pantry_raid only |
| Glider | eagle_spires, fernwood_moon, frost_basin |
| Disc powers: fast, triple, split, freeze (3 throws each) | the 3 Disc Arena maps |
| **UAV Uplink** | **MapMaker only** (the UAV itself is the 3-kill streak) |

- **Kill streaks** (on/off in the menu): 3 kills UAV, 5 Supply Pulse, 7 Counter-UAV, 9 Airstrike.
- **Phantom** is the one invisibility pickup, and only partly (a shimmer); the Shade class's cloak is the other.

### Power-ups (owner, 2026-11-24; `content/pickups.json`, `sim/powerups.ts`)

Nine, each with its own pickup model, HUD line (icon, seconds, a bar of the time left), sound, bot value and a host
switch (Match setup → Power-ups, one chip each; a dedicated server's rules `speedboost`, `doubledamage`, `overdrive`,
`regen`, `rapidfire`, `phantom`, `moonboots`, `vampire`, `bottomless`; all on by default, off: its pickups aren't on
the map). The numbers are starting points (`rules.powerup` in the pickups file), to tune in play:

| Power-up | Lasts | Respawn | Bot value | Does |
|---|---|---|---|---|
| Speed Boost | 15 s | 60 s | 0.6 | ×1.35 speed |
| Double Damage | 15 s | 60 s | 0.85 | ×2 damage |
| **Overdrive** (rare) | 8 s | 120 s | 0.95 | nothing hurts you (a fall out of the map still kills); ×1.15 speed; running into an enemy knocks them 9 m/s back and 4.5 m/s up for 10 damage, once a second each (a fall soon after is your kill: "Overdrive" in the kill feed). A steady gold glow on you that swells and settles at 0.8 Hz (held still with Reduce flashing); no rainbow, no flicker |
| **Regen** | 20 s | 45 s | 0.55 (more when hurt) | 5 health a second, up to full |
| **Rapid Fire** | 15 s | 60 s | 0.75 | fire cooldown ×1.5 faster, reloads ×1.5; with Double Damage on too the fire rate is ×1.2, so the two make 2.4× the damage a second, not 3× (GUNPLAY_SPEC §10: moderate TTK; one systemic multiple, every gun keeps its shape) |
| **Phantom** | 12 s | 60 s | 0.6 | enemies see 12 % of you (a slow shimmer, steady with Reduce flashing), no name tag; teammates a ghost (40 %); firing shows you for 1 s; bots only spot you up close (as in a bush) |
| **Moon Boots** | 15 s | 45 s | 0.4 | gravity ×0.45, jump ×1.35 (about four times as high), no fall damage |
| **Vampire** | 15 s | 60 s | 0.65 | 25 % of the damage your hits deal (never more than they had) comes back as health, up to full |
| **Bottomless Mag** | 12 s | 60 s | 0.7 | the gun in hand stays full: no ammo used, no reloads (a reload under way stops); heat guns still heat |

Bots go for power-ups like any pickup (Regen most when hurt) and back away from an enemy in Overdrive within 16 m
(`OVERDRIVE_KEEP_AWAY`). Others see Overdrive, Double Damage, Speed, Vampire and Rapid Fire as a glow on the body
(`game/powerupGlow.ts`); Regen, Moon Boots and Bottomless don't show. Prediction runs them all as the host does (speed,
gravity, jump, the faster cooldowns and reloads, the full magazine).

A power-up's glow now reaches the character's own meshes (it only lit the stand-in capsule, so Double Damage and Speed
showed only as the flame at the feet). A see-through body (Phantom, and the Shade's cloak) wears a blended copy of an
opaque character material while see-through: the characters' PBR materials are OPAQUE, which ignores a mesh's
`visibility`, so a cloaked Shade had been drawn solid (`view.ts` `seeThrough`).

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
| Co-op | players vs the map's NPCs | 3 (blackout (retired), mercy_ward, primeval_park) |
| Zombies | endless waves | all 77 |
| Disc Arena | knock players into the void, 10 knock-offs | 3 (erosion, grid_rings, sushi_belt_sumo) |
| (Race, removed 2026-11-08) | tracks stay: NPC traffic laps them in every mode | 5 with a track (apex_ring, neon_spire, sandsweep, serene_city, undergate_transit) |

Match setting **Weapons**: Normal / Spears only / Discs only (any mode).

## Other features

### Vehicles
- 16 kinds (the Arc Turret, new, on no official map yet; the rest all used on maps): MG and rocket turrets, sentry, arc turret, speeder, buggy, hauler, skyfighter, dropship, tank, gun jeep, armored rover, hover bike, gunship, snow sled, troop truck. The Go-Kart and the Ice Cream Truck were retired on 2026-11-12: maps that name them get a Hover Bike and a Buggy (VEHICLES.md, "Retired vehicles").
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
- They drive vehicles.
- They take over for players who are away.

### Characters
- 38 looks plus NPC looks.
- (The Character Designer was removed on 2026-11-25: over 200 characters to choose from; docs/CHARACTERS.md.)
- Body-size setting.

### MapMaker
- Every item, NPC and prop.
- Style packs: military, frontier, imperial, orbital, gothic, jungle, neon, suburban, egypt.
- Paths: one tool for roads, the track (NPC traffic) and AI routes (loops, one-way, direction arrows); squads patrol routes, driving bots follow them.
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
| `?range` | Test my loadout straight from the URL (the Training Range with your loadout); `?range=practice` the Practice range |
| `?mode=editor` | open MapMaker directly |
| `?mode=assets`, `?mode=characters` | asset and character viewers |
| `?mode=weapons` | weapon tuning: up to three weapons side by side (stat bars, recoil path, spread cones, damage and time to kill over distance, drop and holdover); `&w=core.smg,core.revolver&ballistics=advanced&hp=100`. Its Manage tab (`&view=manage`) is the owner's Weapon Manager (above) |
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
