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
guns (CC0). The assault rifle, sniper rifle, SMG, shotgun, rocket launcher and
frag grenade use Styloo's Guns Asset Pack (CC0: AK-47, AWP, MAC-10, pump
shotgun, RPG, frag; `content/guns.json`), each keeping its Quaternius model as
`view.fallback` in case the pack's file is missing. Sounds come from our own synthesiser
recipes.

| Slot | Weapon | How it fires |
|---|---|---|
| 2 | Pulse Pistol | Semi-auto energy bolts (cells) |
| 2 | Hand Cannon | Semi-auto, 58 damage, heavy recoil, pushes the target |
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
  `recoil` adds camera kick on the client and spread bloom on the server.
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
