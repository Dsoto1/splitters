# Arsenal: weapons, ammo, throwables and destruction

All gameplay numbers live in `packages/shared/src/sim/weapons.ts` and
`sim/items.ts`; nothing in the simulation names a specific weapon.

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

The **Heavy Revolver** (slot 2, pickup `core.weapon_revolver`) uses a Meshy
community revolver (CC0 per the owner, `guns/ironclad_revolver.glb`, 5k
triangles: a modern long-barrelled revolver with a ventilated rib and an olive
grip; the lettering, skull decal and tally marks it came with were painted out
of its colour map, see ASSET_SOURCES.md). The Quaternius Ultimate Gun Pack
revolver (CC0) stays as its `fallback`. Its holds are read off the model's own
grip (`grip` / `support` in `weapons.ts`); aiming down the sights lines the top
of the front and rear sights up under the eye.

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
at targets 6–18 m away.

**Destruction.** Destructible entities: crate, explosive barrel, breakable
wall, window pane (one hit), board barricade, gas cylinder (explodes) and
generator (explodes). Panes and boards snap to doorways and windows. 84 props
are breakable too, and powder kegs, machines, valves and fire baskets explode.
Explosions chain into other destructibles in range.

## Extended arsenal (32 weapons)

Several weapons now share each slot: a number key picks the slot and pressing
it again cycles through what you carry there (the weapon bar shows a pip per
extra weapon). Weapons are keyed by a small code on the wire (`weaponCode`).
Models are Quaternius Modular Sci Fi Guns (CC0; each energy weapon gets its
own accent colour on the kit's orange trim, and its hold points are placed on
the model's own grip, handguard and stock) and Quaternius Ultimate Gun Pack
guns (CC0). The assault rifle, shotgun, rocket launcher and frag grenade use
Styloo's Guns Asset Pack (CC0: AK-47, pump shotgun, RPG, frag;
`content/guns.json`), each keeping its Quaternius model as `view.fallback` in
case the pack's file is missing. No weapon stats changed with these models.

**The owner's Meshy models** (Meshy, owned; pack `meshy-owned-guns` in
`content/guns.json`, built from the textured GLB downloads by
`prepare-guns.mjs`, 3–6k triangles, a 512 px rebaked colour map each). Each
falls back (`view.fallback`) to a model built from the repo (the Quaternius or
Kenney one, the knife, or the medkit built in code), and its holds are read off
its own grip, handguard and stock:

| Model | Weapon or turret | Replaced |
|---|---|---|
| Tommy Gun | Submachine Gun (`core.smg`) | Styloo MAC-10 |
| Rotary Gatling Gun | Spin Gun (`core.lmg`) | Meshy community plasma spin gun |
| Military sniper rifle | Sniper Rifle (`core.sniper`) | Styloo AWP |
| Neon Flux | Burst Rifle | Quaternius rifle |
| Frontier Rifle | Marksman Rifle | Quaternius rifle |
| Futuristic Blaster | Plasma Rifle | Quaternius sci-fi rifle |
| Ornate energy handgun | Pulse Pistol | Quaternius sci-fi pistol |
| Freeze Gun | Freeze Ray | Quaternius sci-fi gun |
| Mystical Glue Gun | Goo Gun | Quaternius sci-fi gun |
| Steampunk Battle Axe | Battle Axe (new) | — (the knife as the fallback) |
| Plastic toy machine gun on a tripod | Heavy MG Turret (`turret_mg`, `core.mount_mg`) | Kenney twin turret |
| Large Sentry Gun | Sentry Gun (`sentry`, `core.sentry_gun`) | Kenney turret |
| Medkit | health pickups, Medkit and Medi-Beam | boxes built in code |

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
- **Mix up weapon pickups** (`MatchRules.mixPickups`: match setup → Arsenal,
  the pause menu's Host tab, where it applies at once): every weapon pickup not
  marked **Keep fixed** (`keepFixed`) rolls within the category of the weapon
  placed there. Off by default.
- Rolls are `rollPickup(seed, pickup id, roll number)` (`sim/pickupRoll.ts`),
  so a match replays the same; the snapshot's `pw` lists the pickups that hold
  something other than what was placed, and clients draw that. Bots read what
  lies there now. Validation warns when a random pickup shows a weapon of
  another category (`pickup.random_item`).

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
blast that throws people about; pickup `core.dynamite`).

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
