# Arsenal: weapons, ammo, throwables and destruction

All gameplay numbers live in `packages/shared/src/sim/weapons.ts` and
`sim/items.ts`; nothing in the simulation names a specific weapon.

| Slot | Weapon | Ammo | Second trigger (right mouse) |
|---|---|---|---|
| 1 | Knife | — | — |
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

**Benchmark weapons** (spec §51):

| | Service Pistol | Heavy Revolver | SMG | Assault Rifle |
|---|---|---|---|---|
| Damage (body) | 24 | 70 (head ×1.75 kills) | 11 | 18 |
| Rate | 360 rpm | 106 rpm, semi | 900 rpm | 600 rpm |
| Magazine | 12 | 6 | 32 | 30 |
| Velocity | 375 m/s | 300 m/s | 400 m/s | 820 m/s |
| First kick | 0.012 rad | 0.10 rad | 0.004 rad, 0.009 from round 5 | 0.010, then 0.0085 per round |
| Recovery | fast | slow (≈0.6 s) | very fast | medium |
| Spread | true first shot | true first shot | tight 4 rounds, then +0.0045/round | tight 3, then +0.0012 |
| Reload tactical / empty | 0.83 / 1.1 s | round by round: 0.3 s + 0.27 s a round + 0.17 s | 0.9 / 1.2 s | 1.4 / 1.8 s |
| Equip | 0.15 s | 0.27 s | 0.2 s | 0.37 s |
| Falloff | 18→45 m to 65% | 25→60 m to 70% | 12→35 m to 55% (steep) | 30→80 m to 75% |

The **Heavy Revolver** (slot 2, pickup `core.weapon_revolver`) uses the
Quaternius Ultimate Gun Pack revolver (CC0).

**Training Range** (`maps/training_range.json`, built by
`packages/server/src/tools/maps/training_range.ts`): boards at 10, 25, 50,
100 and 200 m, boards sliding side to side at 25, 50 and 100 m, penetration
panels (glass, drywall, planks, sheet metal, brick, concrete) with a board
behind each, and a concrete recoil wall.

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
guns (CC0). Sounds come from our own synthesiser
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

**Variants for Classes and Disc Arena** (added last, so older weapon codes
are unchanged; each has a pickup like every weapon):

| Slot | Weapon | Variant of | How it fires |
|---|---|---|---|
| 6 | Arena Disc | Disc Launcher | Three discs that bounce and come back; a hit shoves, never hurts (Disc Arena) |
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
