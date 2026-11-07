# Arsenal: weapons, ammo, throwables and destruction

All gameplay numbers live in `content/weapons/*.json`, `content/throwables.json`
(built into `packages/shared/src/content/weapons.generated.ts`; docs/CONTENT_PIPELINE.md,
"How to add a weapon") and `content/pickups.json` (pickups; "Pickups" there); nothing in the simulation names a specific weapon.

| Slot | Weapon | Ammo | Second trigger (right mouse) |
|---|---|---|---|
| 1 | Knife | — | — |
| 1 | Battle Axe (pickup) | Shells (12, for the barrel) | Blunderbuss: 9 wide pellets, 2 loads, each loaded by hand from the shells |
| 2 | Pistol | Light rounds | — |
| 3 | Assault Rifle | Rifle rounds | Underbarrel grenade (own ammo, 4 max) |
| 4 | Shotgun | Shells | Both barrels (2 shells, 16 pellets) |
| 5 | Sniper Rifle | Sniper rounds | Zoom |
| 6 | Grenade Launcher | Explosives | — |
| 7 | Submachine Gun | Light rounds | — |
| 8 | Rocket Launcher | Explosives | — (rockets fly straight, hit hard) |
| 9 | Plasma Rifle | Energy cells | Charged orb (8 cells, big splash) |

Right mouse fires a second trigger when the held weapon has one, otherwise it
zooms.

## Gunplay (GUNPLAY_SPEC.md; status in GUNPLAY_GAPS.md)

The gunplay model lives in `sim/gunplay.ts`, driven by each
`WeaponDefinition`: a `family` gives defaults and the weapon's own
`ballistic`, `accuracy`, `kick`, `reload`, `falloff`, `headshot` and
`legshot` override them. Server, client prediction and bots run the same
code.

- **Bullets fly.** Conventional guns fire ballistic bullets: the first 8 m
  are an instant ray, then the round flies at its muzzle velocity, drops
  under gravity and is integrated in two sub-steps a tick. Lag compensation
  rewinds targets for the near ray and for the ticks the shot spent reaching
  the server, then the bullet flies against the live world: you lead for
  travel, never for latency. Beams, the railgun, the gilded pistol and
  shotgun pellets stay hitscan; rockets, grenades and plasma are slow
  projectiles as before.
- **Recoil is mechanical and learnable.** Every round kicks the real aim by
  the weapon's deterministic pattern (with a small, bounded, deterministic
  sideways wobble). Let go and the aim settles back to where the spray
  started along the weapon's own curve. Pull down against it and the recoil
  is used up instead of turning your view, so it never overshoots. The
  camera shows it; the viewmodel kick and a light shake are visual only.
- **Spread** = base + movement + air + sustained fire after the first
  `tight` rounds, capped, then scaled by stance and the sights (accuracy
  blends in while the sights come up; firing is never blocked).
- **Reloads** are staged: magazine out (its rounds go back to reserve; a
  tactical reload keeps one chambered), new magazine in, then the bolt on an
  empty reload. Shotguns and the revolver load round by round and each round
  can be fired straight away. Firing (with a round ready), swapping, sprinting
  off and using something all stop a reload where it is. Tactical reloads are
  quicker than empty ones.
- **Damage** falls off with distance by family and body zones multiply by
  family (shotgun heads ×1.25, precision ×3). Lethality (arcade / standard /
  tactical) scales all of it; Ballistics (arcade / standard / advanced)
  scales velocity and drop.
- **Materials.** Free blocks, props and destructibles are glass, wood,
  drywall, brick, concrete, metal and so on; rounds go through thin cover
  with what energy they have left and come out weaker, and rarely glance off
  metal at a grazing angle. Tile structure counts as concrete.
- **Feedback.** Body hits draw a diamond, head hits a bigger red one with a
  ding, armor a blue square with a clank, kills a sharp X with a crunchy
  confirmation that climbs in pitch with each kill in a row. Tracers fly at
  real speed and only on tracer rounds (`tracerEvery`, plus the magazine's
  last rounds).

**Benchmark weapons** (spec §51 and the seven of GUNPLAY_DIRECTION.md; the
feel audit and the reasoning are in [GUNPLAY_AUDIT.md](GUNPLAY_AUDIT.md)):

| | Service Pistol | Heavy Revolver | SMG | Assault Rifle | Shotgun | Precision (Sniper Rifle) | Rocket Launcher |
|---|---|---|---|---|---|---|---|
| Weapon | `core.pistol` | `core.revolver` | `core.smg` | `core.rifle` | `core.shotgun` | `core.sniper` | `core.rockets` |
| Damage (body) | 24 | 90 (head kills at any range) | 11 | 18 | 10 pellets × 12 | 80 (head ×3) | 40 hit + 120 splash, 5 m |
| Rate | 360 rpm, semi | 90 rpm, semi | 900 rpm | 600 rpm | 80 rpm | 48 rpm | a rocket per 1.5 s |
| Magazine | 12 | 5 | 32 | 30 | 6 | 5 | 1 |
| Velocity | 375 m/s | 300 m/s | 400 m/s | 820 m/s | hitscan pellets | 950 m/s, 2.5 × gravity | 30 m/s |
| First kick | 0.012 rad | 0.12 rad | 0.003 rad, climbing to 0.011 | 0.010, then 0.0085 per round | 0.06 rad | 0.07 rad | — |
| Spread | true first shot | true first shot; 0.022 if fanned | tight 5 rounds, then +0.0065/round | tight 3, then +0.0012 | fixed 0.075 pattern | exact once settled; 0.03 no-scope | — |
| Reload tactical / empty | 0.83 / 1.1 s | round by round: 0.3 s + 0.3 s a round + 0.17 s | 0.9 / 1.2 s | 1.4 / 1.8 s | shell by shell | 1.5 / 1.83 s | 0.9 s |
| Equip | 0.15 s | 0.27 s | 0.2 s | 0.33 s | 0.27 s | 0.5 s | 0.53 s |
| Falloff | 18→45 m to 65% | 25→60 m to 70% | 12→35 m to 55% (steep) | 30→80 m to 75% | 6→22 m to 25% (steep) | 150→300 m to 90% | self-damage ×0.75 |

The **Heavy Revolver** (slot 2, pickup `core.weapon_revolver`) uses the Meshy community Revolver Rustique (CC0 per
the owner, `guns/revolver_rustique.glb`, since the weapons intake of 2026-11-06, below); it replaced the earlier Meshy
revolver (`guns/ironclad_revolver.glb`: the 2026-01-26 download, its lettering painted out; still built), and the
Quaternius revolver stays its fallback. Its holds are read
off the model's own grip (`grip` / `support` in the weapon's `content/weapons/<name>.json`); aiming down the sights
lines the top of the front and rear sights up under the eye.

**Training Range** (`maps/training_range.json`, built by
`maps/training_range.json`): the gunplay test arena
of GUNPLAY_DIRECTION.md, described in [GUNPLAY_AUDIT.md](GUNPLAY_AUDIT.md#gunplay-test-arena).

**Ammo pickups.** The general Ammo Box gives half a pickup to every weapon and
one underbarrel grenade. Typed boxes (Light, Rifle, Shells, Sniper, Explosives,
Energy Cells; told apart by their stripe colour) fill every weapon of that type
with a full pickup; Explosives also refill underbarrel grenades.

**Throwables (G).** One kind is carried at a time, with a count shown beside
the ammo. Frag grenades bounce and go off after 2.5 s (everyone spawns with
one; packs give two, up to four). Proximity mines stick where they land, arm
after 1.2 s and go off when an enemy comes within 2.2 m. Bots throw grenades
at targets 6–18 m away. Each throwable with a model (content/throwables.json
`view`) shows it in your hands while you line up the throw (G held: the gun goes away, both hands on it), in flight
and lying as a pickup (two of it on the ring); see "Weapons intake of 2026-11-06" below.

**Destruction.** Destructible entities: crate, explosive barrel, breakable
wall, window pane (one hit), board barricade, gas cylinder (explodes) and
generator (explodes). Panes and boards snap to doorways and windows. 84 props
are breakable too, and powder kegs, machines, valves and fire baskets explode.
Explosions chain into other destructibles in range.

## Weapons intake of 2026-11-06: new models, sharper textures, smoke

The owner: "Added a bunch of new weapons, all Meshy community"; the 3DModelsCC0 kit "has good ones too, not sure we
need the nuclear bomb or flare gun though"; "We can replace our tommy gun with the 3DModelsCC0 one, and bring in those
others to replace any one-off originals we have"; and "we want these weapons to look a little sharper, clearer, better
resolution". Every model below was rendered and checked by eye first. Each weapon's `view.fallback` stays the model
built from the repo (always there), as earlier swaps did; the downloads that were replaced stay built in the repo
(content/guns.json), so going back is a one-line change. Built by `tools/content/prepare-guns.mjs`
(content/guns.json: the pack's own PBR maps, `held` copies, `pbr`); holds read off gridded side views of each built
model (CHARACTERS.md, "Holding weapons").

| New model | Source | Weapon | Replaced |
|---|---|---|---|
| Suomi KP (`guns/suomi_kp.glb`) | 3DModelsCC0 | Submachine Gun (`core.smg`) | Meshy Tommy Gun |
| AK-47 (`guns/ak47_cc0.glb`) | 3DModelsCC0 | Assault Rifle (`core.rifle`) | Styloo AK-47 |
| M4A1 (`guns/m4a1.glb`) | 3DModelsCC0 | Burst Rifle | Meshy Neon Flux |
| Makarov (`guns/makarov.glb`; its magazine, laid out beside it in the download, put back in the grip) | 3DModelsCC0 | Pistol (`core.pistol`) | flat kit pistol |
| Grease Gun (`guns/grease_gun.glb`; held as a compact long gun) | 3DModelsCC0 | Machine Pistol | flat kit machine pistol |
| Shotgun (`guns/shotgun_cc0.glb`) | 3DModelsCC0 | Shotgun | Styloo shotgun |
| Sniper (`guns/scoped_rifle.glb`: posed nose-up in the download, built levelled, magazine seated) | 3DModelsCC0 | Marksman Rifle | Meshy Frontier Rifle |
| BK 220 (`guns/bk220.glb`) | Meshy Community | Hand Cannon (a heavy semi-automatic: the Heavy Revolver is the revolver) | flat kit revolver |
| Revolver Rustique (`guns/revolver_rustique.glb`) | Meshy Community | Heavy Revolver | Meshy revolver (2026-01-26) |
| gilded flintlock (unnamed download, `guns/flintlock.glb`) | Meshy Community | Gilded Pistol (one shot, one kill) | flat kit pistol |
| Plasma Defender (`guns/plasma_defender.glb`) | Meshy Community | Pulse Pistol | Meshy ornate handgun |
| Scrapfire Assault Blaster (`guns/scrapfire.glb`) | Meshy Community | Nailgun (a drum-fed scrap gun) | flat kit nailgun |

Grenades (the owner's picks, 2026-11-06), one model each in the hand, in flight and on the pickup:

| Model | Throwable | Replaced |
|---|---|---|
| Globe Grenade (`guns/globe_grenade.glb`) | Frag; the 3DModelsCC0 frag (`guns/frag_m67.glb`) is its look in the Military weapon set | Styloo frag (the fallback) |
| Countdown Sphere (`guns/countdown_sphere.glb`; the blinking light kept on top) | Sticky | shapes in code |
| "just a grenade" (`guns/vortex_grenade.glb`, its own projectile look `vortexNade`: the Singularity Cannon keeps `vortex`) | Vortex | shapes in code |
| Sunburst Grenade (`guns/sunburst_grenade.glb`) | Cluster Bomb (its bomblets stay small shapes) | shapes in code |
| Toxic Splash (`guns/toxic_splash.glb`) | Gas | shapes in code |
| 3DModelsCC0 Molotov (`guns/molotov.glb`) | Incendiary | shapes in code |
| 3DModelsCC0 smoke grenade (`guns/smoke_m18.glb`) | **Smoke Grenade** (new, below); the Meshy sci-fi canister (`guns/smoke_scifi.glb`) is its Sci-fi set look | — |
| 3DModelsCC0 anti-tank mine (as before) | Proximity Mine (now also its pickup) | coloured discs on the pickup |

Still drawn in code (no model fits yet): the holy bomb, sheep, airstrike flare, sandbags and dynamite (neither the
pack's pipe bomb nor its M24 reads as Frontier dynamite). Spare, kept out of the game: the pack's Luger, C4, claymore,
pipe bomb and M24 (docs/IMPORT_LIST.md). Not imported: the nuclear bomb and the flare gun (the owner), the flashbang
(dropped over seizure risk: nothing in the game flashes the whole screen white).

**Texture tiers.** The weapon in your own hands draws a sharper copy of its model by graphics setting; everyone else's
copy (other players' hands, drops, pickups, Low) stays small:

| Copy | Colour map | Normal map | Metal/roughness | Loaded |
|---|---|---|---|---|
| everyone's (`guns/<name>.glb`, with its lower level of detail) | 512 px | 512 | 256 | with the match, for every gun it can hold |
| Medium, in your hands (`guns/<name>.medium.glb`) | 1024 | 512 | 256 | only for the guns you hold |
| High, in your hands (`guns/<name>.high.glb`) | 2048 | 1024 | 512 | only for the guns you hold |

- The held copy is the same mesh (same holds, muzzle and sights), named in the weapon's `view.held`. Your gun shows
  everyone's copy at once and the sharper one is swapped in when it has loaded (`View.sharpenViewmodel`); a gun you no
  longer carry frees its held copy's video memory (`View.trimViewmodels`, `ModelLibrary.release`).
- **Measured** (five guns held: pistol, rifle, SMG, shotgun, hand cannon; textures counted at 4 bytes a texel with
  mipmaps): **High +140 MB** (28 MB a gun: its 2048 px colour map 22.4, normal 5.6, metal/roughness 1.4), **Medium
  +35 MB** (7 MB a gun), **Low +0** (everyone's copies are already loaded with the match). For scale, the whole scene's
  textures at High were 292 MB before (the level, characters, shadow maps). Over 1024 px metal/roughness maps at High
  measured +160 MB and showed nothing more, so they ship at half the normal map's size.
- Downloads: see the table in HANDOFF ("Weapons intake of 2026-11-06"): a held High copy is 0.2-1.5 MB, fetched once
  per gun you pick up.
- **GPU-compressed textures (KTX2 / Basis):** not used. Babylon 9.32 reads them through its KTX2 decoder, whose wasm
  transcoders it serves only from cdn.babylonjs.com (the npm package holds just the 24 KB decoder); the game must not
  load code from a third-party CDN (offline and LAN play, the site's policy), and this environment can't reach it to
  vendor them. The encoder side is workable (`ktx2-encoder` on npm, 3.3 MB wasm). With the transcoders vendored, a
  2048 px colour map would take about 5.6 MB of video memory instead of 22 (UASTC to BC7/ASTC).

**Kept metal and roughness.** The new models keep their source's metal and roughness (`pbr` in content/guns.json)
instead of a forced matte finish. The game's scenes have no environment map (bare metal drew black), so a weapon's
metal materials reflect a soft gradient in the map's own light (`game/weaponFinish.ts`): dim at night, a bright band
above, blurred by roughness.

**Smoke Grenade** (`smoke`, code 12, pickup `core.smoke_grenades`; owner, 2026-11-06). Thrown like a frag; after 1.5 s
a cloud billows out where it lies to 5 m across its radius over 2.5 s (`SMOKE`, `smokeRadius` in `sim/weapons.ts`),
sits, and thins over its last 3 s: 18 s in all. It is only sight:
- **Bots and the match** (`Match.sees`, `smokeBlocks`): a sight line crossing 1.6 m or more of a cloud is blocked:
  bots don't see (or shoot at) whoever is behind it, sentries and arc turrets don't lock through it, homing missiles
  don't steer to someone behind it, and a spawn point behind it counts as unseen. Someone a metre off inside the cloud
  is still seen.
- **Players:** the cloud is soft grey puffs (`ZoneVisuals`, a steady mid grey scaled by the map's light, never white);
  with your eye in it, the scene's fog eases to a mid grey you see 2-3 m through (`View.updateSmokeFog`, eased in and
  out over about two thirds of a second: no flash, no white-out, no flicker); an enemy's marker behind smoke isn't
  drawn.
- **Shots, blasts and movement go through it** (they use the physics' own lines).
- **Bots use it:** a hurt bot caught in the open by an enemy 10-45 m off throws one a few metres toward it, so the
  cloud stands between them while it moves on; bounding cover to cover (Phase B), the moving half sends one ahead
  before it crosses open ground (`considerSmoke`, `BotBrain.smokeScreen`; docs/BOTS.md, "Smoke").
- **Weapon sets:** in Military and Sci-fi (docs/WEAPON_SETS_PLAN.md); `throwableModel(kind, set)` gives a set's look
  (the canister in Sci-fi, the realistic frag in Military) once sets pick it.

## Extended arsenal (32 weapons)

Several weapons now share each slot: a number key picks the slot and pressing
it again cycles through what you carry there (the weapon bar shows a pip per
extra weapon). Weapons are keyed by a small code on the wire (`weaponCode`).
Models are Quaternius Modular Sci Fi Guns (CC0; each energy weapon gets its
own accent colour on the kit's orange trim, and its hold points are placed on
the model's own grip, handguard and stock) and Quaternius Ultimate Gun Pack
guns (CC0). Since the weapons intake of 2026-11-06 (above) most of these have newer models. The assault rifle, shotgun, rocket launcher and frag grenade use
Styloo's Guns Asset Pack (CC0: AK-47, pump shotgun, RPG, frag;
`content/guns.json`), each keeping its Quaternius model as `view.fallback` in
case the pack's file is missing. No weapon stats changed with these models.

**Meshy models from the owner's Drive** (Meshy Community CC0 per the owner's rule of 2026-11-06, recorded as owned
before; pack `meshy-community-arsenal` in `content/guns.json`, built from the textured GLB downloads by
`prepare-guns.mjs`, 3–6k triangles, a 512 px rebaked colour map each). Each
falls back (`view.fallback`) to a model built from the repo (the Quaternius or
Kenney one, the knife, or the medkit built in code), and its holds are read off
its own grip, handguard and stock:

| Model | Weapon or turret | Replaced |
|---|---|---|
| Tommy Gun | Submachine Gun (`core.smg`) until 2026-11-06, replaced by the Suomi KP (still built) | Styloo MAC-10 |
| Rotary Gatling Gun | Spin Gun (`core.lmg`) | Meshy community plasma spin gun |
| Military sniper rifle | Sniper Rifle (`core.sniper`) | Styloo AWP |
| Neon Flux | Burst Rifle until 2026-11-06, replaced by the M4A1 (still built) | Quaternius rifle |
| Frontier Rifle | Marksman Rifle until 2026-11-06, replaced by the scoped rifle (still built) | Quaternius rifle |
| Futuristic Blaster | Plasma Rifle | Quaternius sci-fi rifle |
| Ornate energy handgun | Pulse Pistol until 2026-11-06, replaced by the Plasma Defender (still built) | Quaternius sci-fi pistol |
| Freeze Gun | Freeze Ray | Quaternius sci-fi gun |
| Mystical Glue Gun | Goo Gun | Quaternius sci-fi gun |
| Steampunk Battle Axe | Battle Axe (new) | — (the knife as the fallback) |
| Plastic toy machine gun on a tripod | Heavy MG Turret (`turret_mg`, `core.mount_mg`) | Kenney twin turret |
| Large Sentry Gun | Sentry Gun (`sentry`, `core.sentry_gun`) | Kenney turret |
| Medkit | health pickups, Medkit and Medi-Beam | boxes built in code |

Also Meshy community models (CC0 per the owner, pack `meshy-community-weapons`):
the carved spear (download "T Pose Figure") is the Spear's (`core.spear`; held, pickup,
thrown and stuck), replacing the spear built in code, which stays as its fallback; and the
Plasma Blaster (download of 2026-11-02) is the Singularity Cannon's (`guns/plasma_blaster.glb`,
0.66 m, 13.7k triangles plus a LOD, 1024 px colour map), replacing the Quaternius sci-fi sniper
(`weapons/singularity.glb`, the fallback). Its orange glowing panels and muzzle ring are recoloured
to the cannon's purple (`#b07aff`) with an emissive map of them (`glow` in guns.json,
prepare-guns.mjs). Holds: grip on the rear handle with the fingers through the guard, support
under the front shroud, shoulder at the back, muzzle at the front ring; checked with
`grip-sheet.mjs` (WEAPONS=core.singularity) and `grip-audit.mjs` (WEAPONS_ADD=singularity:core.singularity:
no flag the rifle doesn't raise on the same characters). Its behaviour is unchanged.

The Freeze Gun, Glue Gun, Futuristic Blaster and toy machine gun became the
models of the Freeze Ray, Goo Gun, Plasma Rifle and Heavy MG Turret rather than
new weapons: each already does what the model shows, and a second freeze or
glue gun would be one of the "statistically similar" weapons
GUNPLAY_DIRECTION.md warns against. Sounds come from our own synthesiser
recipes.

| Slot | Weapon | How it fires |
|---|---|---|
| 2 | Pulse Pistol | Semi-auto energy bolts (cells) |
| 2 | Hand Cannon | Semi-auto, 58 damage, heavy recoil, pushes the target |
| 2 | Heavy Revolver | Six rounds, 70 damage, savage kick, loaded round by round |
| 2 | Gilded Pistol | One shot, one kill; slow reload, rare pickup |
| 2 | Flare Gun | Arcing flare that sticks to what it hits, burns and lights oil |
| 2 | Machine Pistol | Very fast, blooms wide |
| 3 | Burst Rifle | Three-round bursts per trigger pull |
| 3 | Laser Rifle | Continuous beam, no ammo: overheats, then locks until cool |
| 3 | Marksman Rifle | Semi-auto, 0.7 zoom |
| 4 | Sawed-Off | Two barrels, 14 pellets, knockback |
| 4 | Auto Shotgun | Automatic, big recoil |
| 4 | Flak Cannon | Seven shards that ricochet twice |
| 5 | Railgun | Charges for 0.4 s, then pierces up to four players; one body hit kills an unarmoured player |
| 6 | Disc Launcher | Fast disc, big knockback (disc-jumping works) |
| 6 | Bubble Blaster | Slow, floating toxic bubbles that bounce off walls up to 7 times, then burst into a poison cloud |
| 6 | Goo Gun | Lobbed goo that slows and leaves a sticky puddle |
| 6 | Oil Slicker | Oil puddles you slide on; right mouse fires an igniter that sets them alight |
| 7 | Spin Gun | Spins up before firing, 120-round belt |
| 7 | Nailgun | Fast ricocheting nails |
| 8 | Swarm Launcher | Four homing mini-missiles per shot |
| 8 | Singularity Cannon | A field that drags players in for 2.4 s, then collapses with a blast |
| 9 | Arc Caster | Lightning that jumps to three more enemies; heat instead of ammo |
| 9 | Flamethrower | Short-range flame stream: sets players burning, lights oil |
| 9 | Freeze Ray | Beam that chills; enough chill freezes the target solid for 1.4 s |

**Battle Axe** (`core.battle_axe`, slot 1, pickup `core.weapon_battle_axe`,
category melee). The model is a flintlock blunderbuss with an axe blade under
its muzzle, so it is both:

- **Swing** (left mouse, and the quick-melee key): 85 damage, one swing per
  0.8 s, 2.7 m reach, a 6 m/s shove along the swing. Spends nothing.
- **Blunderbuss** (right mouse with the axe in hand, or middle mouse / V like
  every second trigger): 9 pellets of 11 (99 at most) in a wide 0.12 rad cone,
  24 m reach, steep falloff (full to 4 m, down to a fifth at 16 m), head ×1.25.
  Measured on a still target: 99 at 2 m, ~85 at 4 m, ~43 at 6 m, ~26 at 8 m,
  ~16 at 10 m, ~6 at 14 m (the Shotgun kills to about 6 m and still does ~40
  at 10 m). Shots 0.6 s apart; a heavy kick (0.1 rad up, settling over about
  a second), a big flash and a cloud of black-powder smoke from the barrel's
  mouth (`view.muzzleAt`, first and third person), the Shotgun's report
  pitched down.
- **Ammo**: the barrel holds 2 loads (`alt.max`; HUD: loads big, shells small,
  "RMB Blunderbuss"). Loads come from a reserve of **shotgun shells** (12 at
  most, 4 from a pickup, filled by shell boxes and the general ammo box), one
  at a time: R, or the alt trigger on an empty barrel, loads them (0.27 s
  open, 1.1 s a load, 0.23 s close: 1.6 s for one, 2.7 s for two). A swing
  stops loading at once (loads already in stay); the alt trigger fires as
  soon as one is in. Shells rather than an ammo type of its own: shell boxes
  already lie on the maps and a shotgun's shot is what it fires; a "powder
  and shot" type would need its own boxes everywhere for one weapon.
- **Bots** value it at 0.45 for 0–2.5 m, and out to ~7 m while the barrel is
  loaded (`barrelReach`): they close in to swing, fire the barrel at a target a
  few steps beyond the blade, and load it again when nobody is near.

It answers "why pick this up?" with a two-hit kill up close that throws people
off ledges, and a blast for the step just out of reach (blast and swing kill
together).

## Weapon categories and random pickups

Every weapon a pickup can hold has a `category` (`WEAPON_CATEGORIES` in
`sim/weapons.ts`): pistols, SMGs and machine guns, rifles, shotguns, snipers,
explosives, melee, specials. Tools (medkit, medi-beam, grapple, builder),
mode-only weapons (arena disc) and mounted guns have none and never roll.

- **Random from category** (MapMaker: select a weapon pickup → Weapon →
  "Random from category: …"; map field `random` on the pickup, format v24):
  the pickup holds a weapon of that category, rolled again each time it is
  taken (so it comes back as something new; with more than one in the
  category it never repeats the last). MapMaker shows a weapon of the category.
- **Mix up weapon pickups** (`MatchRules.mixPickups`: match setup → Advanced
  rules → Weapons, pickups & vehicles; the pause menu's Host tab, where Apply
  now applies it at once): every weapon pickup not
  marked **Keep fixed** (`keepFixed`) rolls within the category of the weapon
  placed there. Off by default.
- Rolls are `rollPickup(seed, pickup id, roll number)` (`sim/pickupRoll.ts`),
  so a match replays the same; the snapshot's `pw` lists the pickups that hold
  something other than what was placed, and clients draw that. Bots read what
  lies there now. Validation warns when a random pickup shows a weapon of
  another category (`pickup.random_item`).

## Weapon drops

**Drop weapon on death** (`MatchRules.dropWeapons`, default on: match setup →
Advanced rules → Weapons, pickups & vehicles; the pause menu's Host tab, where
Apply now applies it at once and off clears the drops lying about): when a player or bot dies (not NPCs), `chooseDrop`
(`sim/drops.ts`) picks the weapon in hand, else the most desirable one, that
has a pickup item and a category (not a tool, mode-only weapon or mounted gun),
isn't a fetched-back throw (spear), isn't in the starting loadout (rules or
class) and has ammo (magazine + reserve; heat weapons always count, plain melee
never). It lies on the ground straight below the body (a raycast; none over
the void) for `DROP_LIE_SECONDS` (30), at most `MAX_DROPS` (24, oldest first),
carrying exactly that ammo (and second-trigger rounds). Everything else is
discarded. A pickup (same radius as map pickups) gives the weapon whole to
someone without it (coming up like a map pickup's), or tops up the reserve of
someone with it (`takeDropAmmo`), the rest staying on the ground. Never in
Disc Arena, races or spears/discs only (`dropsInPlay`). The snapshot's `dw`
lists the drops lying ([id, item, x, y, z, yaw]; repeated fields, sent when
they change); clients draw the pickup's weapon on its side on a small ring.
Bots see drops as weapon pickups.

**Variants for Classes and Disc Arena** (added last, so older weapon codes
are unchanged; each has a pickup like every weapon):

| Slot | Weapon | Variant of | How it fires |
|---|---|---|---|
| 6 | Arena Disc | Disc Launcher | Three discs that bounce and drop where they stop, picked up again like ammo; a hit shoves, never hurts (Disc Arena) |
| 8 | Blast Rockets | Rocket Launcher | Four-rocket drum, smaller blast, knockback: rocket-jump (Rocketeer) |
| 1 | Medi-Beam | Medkit | Heals the teammate in your sights 6 HP five times a second, 9 m (Medic) |

**Grenades (G):** frag, proximity mine, sticky (rides on whoever it hits),
incendiary (a pool of fire), gas (a toxic cloud), vortex (a small
singularity) and dynamite (Style Pack 02 Frontier Dust: a 3 s fuse, a 6 m
blast that throws people about; pickup `core.dynamite`). And the Smoke Grenade (a cloud that hides whoever is
behind it, 18 s; pickup `core.smoke_grenades`): see "Weapons intake of 2026-11-06".

**Mechanics** (all data on `WeaponDefinition` / `ProjectileSpec`):

- **Triggers.** `fireMode` is auto, semi or burst. `windupTicks` adds spin-up
  or charge (`windupResets` charges every shot). `heat` replaces ammo.
  `recoil` (weapons without a gunplay family) is a deterministic camera climb
  plus spread bloom on the server; family weapons use `kick` and `accuracy`.
- **Hitscan.** `pierce`, `chain` (jumps, range, falloff), `status` and
  `knockback`.
- **Projectiles.** `pellets` (several projectiles per shot), `bounce` and
  `maxBounces`, `sticky` (to the world, or riding on players), `homing`,
  `drag`, `knockback`, `status`, `zone` (a hazard left where it bursts) and
  `ignites`.
- **Status effects.** Burn (12 dps) and poison (9 dps) do damage over time,
  credited to whoever caused them. Slow is 55% speed. Chill builds up, then
  freezes the target solid: no moving or firing.
- **Hazards.** Zones live on the server and go out in snapshots (`zn`):
  - fire: burns you and does damage while you stand in it;
  - toxic: poisons;
  - goo: slows;
  - oil: slick ground, where running feeds a slide;
  - singularity: pulls players in, then implodes.
  Flames, flares and explosions set oil alight, and fire spreads along it.
- **Movement.** `MoveState.vx/vz` is a push velocity (knockback, pulls,
  slides) that dies away on the ground. Client prediction replays it with the
  server's status speed and the oil under your feet.

## Jetpack

Not a weapon but a pickup (`core.jetpack`): hold jump in the air to fly, with fuel that refills while you are not thrusting. See [SET_PIECES.md](SET_PIECES.md).
