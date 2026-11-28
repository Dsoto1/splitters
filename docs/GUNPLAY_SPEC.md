# Gunplay, Ballistics & Weapon Feel Design Specification

**Project:** Browser-first arcade FPS / MapMaker platform  
**Document role:** Authoritative design reference for firearm handling, ballistics, damage feedback, ammunition/environment interaction, reloads, recoil, aim assistance, kill feedback, death presentation, and creator-facing combat rules.  
**Status:** Pre-production design target. All numerical values are tuning baselines, not immutable constants.

---

## 1. Design Goal

Gunplay must be **immediately responsive, highly readable, mechanically learnable, and rewarding to master**.

The game is intentionally fantastical in characters, maps, weapons, and scenarios, but weapon handling must have enough physical consistency that players can develop real skill.

The target feeling is:

- Easy to understand in seconds.
- Responsive from the first input frame.
- Satisfying at point-blank range.
- Skillful at medium and long range.
- Distinct weapon personalities rather than statistically similar guns.
- Predictable enough to learn recoil, velocity, drop, reload timing, and effective range.
- Forgiving enough that casual players can participate.
- Deep enough that strong players can noticeably outperform through movement, tracking, leading, recoil control, positioning, and weapon knowledge.
- Visually and audibly satisfying without obscuring gameplay information.

### Core Principle

> **Every weapon should make a different promise to the player.**

A revolver should not feel like a slower pistol. A heavy machine gun should not feel like an SMG with more damage. A rail weapon should not feel like a sniper rifle with a different model.

Each weapon must have an intentionally exaggerated profile containing meaningful strengths and meaningful liabilities.

---

# 2. Combat Pillars

## 2.1 Immediate Input Response

Vital combat inputs must begin immediately whenever mechanically legal:

- Fire
- Aim
- Reload cancel
- Weapon swap
- Melee
- Sprint / evade
- Interact
- Use equipment

Cosmetic animation must never be allowed to make the player feel as though the game ignored a valid command.

## 2.2 Physical Projectiles Where They Matter

Long-range shooting should require:

- Leading moving targets.
- Understanding projectile velocity.
- Compensating for gravity/drop.
- Predicting movement.

However, simulation must not make close-range arcade combat feel sluggish.

## 2.3 Extreme Weapon Identity

Weapon attributes should occupy broad ranges rather than clustering around a safe middle.

Examples:

- Revolver: huge impact, low capacity, slow cadence, severe kick.
- SMG: instant handling, extremely high cadence, weak individual rounds, escalating dispersion.
- Battle rifle: strong velocity and precision, demanding recoil.
- Shotgun: devastating nearby, increasingly unreliable with distance.
- LMG: enormous sustained pressure, poor agility and reload commitment.
- Marksman rifle: powerful controlled shots, weaker close-range handling.

## 2.4 Readability Before Realism

Physics may be plausible, but gameplay information must remain obvious.

Players should understand:

- Why they missed.
- Why a shot did less damage.
- Whether armor stopped it.
- Whether a projectile penetrated something.
- Whether the target is nearly dead.
- Whether recoil or dispersion caused deviation.

## 2.5 Learnable Systems

Randomness should create texture, not determine fights.

Prefer:

- Deterministic recoil patterns or strongly bounded recoil behaviors.
- Predictable recovery.
- Clearly defined spread growth.
- Consistent projectile velocity.
- Consistent penetration rules.

Avoid hidden arbitrary accuracy penalties.

---

# 3. Combat Simulation Model

The weapon system should support three firing models.

## 3.1 Hitscan

Used when immediate ray-based behavior produces better gameplay than physical travel.

Good candidates:

- Very short-range energy weapons.
- Beam weapons.
- Special arcade weapons.
- Certain close-range pellet simulations if required for performance.

Hitscan should **not** automatically be the default simply because it is easier to implement.

## 3.2 Ballistic Projectile

Preferred for conventional bullets.

Projectile properties include:

```text
muzzleVelocity
gravityScale
drag
mass
caliber
energy
penetrationClass
ricochetPotential
tracerFrequency
lifetime
```

This enables visible and learnable:

- Travel time.
- Target leading.
- Bullet drop.
- Penetration.
- Material interaction.

## 3.3 Slow Projectile

Used for visibly traveling ordnance:

- Rockets.
- Grenades.
- Plasma.
- Arrows.
- Thrown weapons.
- Experimental weapons.

These can have much more dramatic trajectories.

---

# 4. Hitscan vs Projectile Balance

A hybrid system is recommended.

Conventional firearms should generally use ballistic projectiles, but **close-range behavior must remain crisp**.

Recommended approach:

### Near Range

For approximately the first **5–10 meters**, conventional bullets should effectively feel instantaneous to the player even if internally simulated as fast projectiles.

Do not introduce artificial visual delay.

### Medium Range

Projectile travel becomes perceptible and leading begins to matter.

### Long Range

Velocity, gravity, drag where applicable, and target movement become important.

The exact transition depends on weapon velocity.

A pistol round should require more lead than a high-velocity rifle round at equivalent range.

### Example velocity families

These are gameplay baselines rather than real-world replicas:

| Projectile family | Approx. gameplay velocity |
|---|---:|
| Heavy slow handgun | 250–350 m/s |
| Standard handgun | 325–450 m/s |
| SMG / light cartridge | 350–500 m/s |
| Rifle | 650–900 m/s |
| Precision rifle | 800–1100 m/s |
| Heavy fictional slug | 200–500 m/s |
| Plasma / visible energy | 80–300 m/s |
| Rocket | 40–120 m/s |

These ranges should be tuned against actual map dimensions rather than realism alone.

---

# 5. Gravity & Bullet Drop

Gravity should be **subtle at ordinary combat distances and meaningful at extended distances**.

We do not want players aiming several feet above an opponent at 30 meters.

Instead:

- Close range: effectively negligible.
- Medium range: visible to skilled players.
- Long range: deliberate compensation required.
- Extreme range: substantial skill requirement.

Scopes may provide optional markings that correspond to useful holdover distances.

Do not automatically compensate for drop unless a weapon specifically has that characteristic.

**Implementation note (2026-11-18): holdover marks.** A scope (`view.zoomFov`) and a real optic (`view.optic`) on a
bullet weapon carry short marks down the crosshair at 200, 300, 400, 500, 600 and 800 m (within its reach), labelled
in hundreds of metres, longer every 200 m. Each sits the drop at that distance below the centre (`holdoverMarks` in
`sim/gunplay.ts`, from `flightTo` under the match's ballistics rule; rounds leave from the eye along the aim, so there
is no zero distance and nothing compensates by itself), placed for the view's own zoom (client `game/holdover.ts`; the
second zoom spreads them). Marks closer than about 1 % of the reticle's radius to the centre are left off, so a gun
whose drop never matters inside its reach (the Marksman Rifle) shows none.

### Creator Control

Scenario rules may expose:

```text
Ballistics:
[ Arcade ] [ Standard ] [ Advanced ]
```

**Arcade** reduces gravity/travel effects.  
**Standard** is the official multiplayer default.  
**Advanced** increases projectile physics emphasis.

Weapon identity must remain intact across all three.

---

# 6. Leading Moving Targets

Projectile velocity must be sufficiently differentiated that leading becomes weapon knowledge.

Example:

A player sprinting laterally at long range should require:

- Almost no lead with an extremely fast precision weapon.
- Modest lead with a rifle.
- Significant lead with a pistol or heavy slug.
- Dramatic lead with plasma/launchers.

This creates mastery without adding interface complexity.

Optional training ranges should include moving targets specifically for learning lead and drop.

---

# 7. Ammunition / Round Families

Ammunition should affect more than damage.

Each projectile can influence:

- Damage.
- Armor effectiveness.
- Penetration.
- Velocity.
- Drop.
- Recoil impulse.
- Environmental damage.
- Ricochet.
- Suppression effects if enabled.
- Tracer visibility.

Recommended families:

## Standard / Ball

Balanced general-purpose ammunition.

## Hollow / Expanding

Strong against unarmored targets; poor penetration.

Environmental behavior:

- Weak against metal.
- Limited wall penetration.
- Strong flesh impact feedback.

## Armor-Piercing

Lower soft-target advantage but improved armor/material penetration.

Can pass through thin metal, wood, or light cover depending on caliber.

## Heavy / Magnum

High impulse, high damage, stronger environmental reaction, greater recoil, often lower weapon capacity/cadence.

## Subsonic

Lower velocity and increased drop, quieter report when paired with appropriate weapon systems.

## Incendiary

May ignite compatible materials or targets under defined conditions.

Should be visually readable but not turn every impact into fireworks.

## Explosive

Small area effect, destructible-environment interaction, usually rare and strongly constrained.

## Flechette

Multiple narrow projectiles, good soft-target behavior, unusual spread/penetration characteristics.

## Slug

Shotgun single projectile with much better range and penetration but demands precision.

## Buckshot / Pellet

Multiple physical or logically grouped projectiles with predictable spread behavior.

## Tracer

Provides visual trajectory information; may reveal shooter position.

Tracer frequency should be configurable (for example every third/fifth round) rather than necessarily every bullet.

## Energy / Plasma

Visible slower projectile, unusual armor/material interaction, potentially no conventional drop or a custom trajectory.

## Exotic

The architecture must support deliberately absurd ammunition:

- Bouncing rounds.
- Sticky projectiles.
- Drilling rounds.
- Electric arcs.
- Freeze rounds.
- Paint/marker rounds.
- Portal or teleport effects.

These are content-level behaviors built on standardized projectile hooks.

---

# 8. Material Interaction

Environment materials should expose ballistic properties.

Recommended material classes:

```text
Flesh
Glass
Thin Wood
Heavy Wood
Drywall / Light Wall
Stone
Brick
Concrete
Thin Metal
Heavy Metal
Armor Plate
Water
Terrain / Soil
Special / Energy Surface
```

Each material can define:

```text
penetrationResistance
ricochetChance
energyLoss
impactEffect
decalType
destructionDamageMultiplier
soundSet
```

### Examples

**Glass**
- Easily penetrated.
- Shatters.
- Low projectile energy loss.

**Wood**
- Light rounds may penetrate thin surfaces.
- Heavy rounds penetrate more reliably.
- Splinters communicate impact.

**Concrete**
- Most small arms stop.
- Strong dust/chip response.
- Heavy weapons may damage destructible variants.

**Metal**
- Sparks and strong impact sound.
- Certain shallow-angle impacts may ricochet.

### Penetration

Penetration should be energy-based rather than binary where practical.

Conceptually:

```text
remainingEnergy = projectileEnergy - materialResistance
```

If energy remains above a threshold, the projectile exits with reduced:

- Velocity.
- Damage.
- Penetration capacity.

This allows a powerful rifle round to pass through a thin wall but arrive weakened.

### Ricochet

Ricochets should be rare, readable, and bounded.

They should primarily provide spectacle and occasional skill expression—not random unavoidable deaths.

### Implementation note: surface types (2026-11-04)

The classes above live in `sim/gunplay.ts` (`BALLISTIC_MATERIALS`, `MATERIAL_BALLISTICS`). What a surface is made of
comes from one shared list, `content/surface-types.json` (docs/CONTENT_PIPELINE.md, "Surface types"): each type names
its ballistic class and its impact (decal, debris, sound family), so the server's penetration and ricochet and the
client's impact effect and sound agree. Props and library materials name a type (`surface`); unset ones keep the
class guessed from their id (`materialClass`). Two classes were added with it:

- **Heavy Wood** (`heavy_wood`, resist 6000, no ricochet, destruction 0.3): tree trunks, stumps and logs (surface
  `bark`). Full cover: a 0.5 m trunk post stops every round in the game (the strongest, the precision family, carries
  3000 energy), as concrete did, but nothing ricochets off bark and hits show splinters and a wood knock.
- **Foliage** (`foliage`, resist 30, no ricochet): bushes. Rounds pass through barely slowed; bushes still have no
  collider and still conceal from bots.

Boulders and cliffs are `rock` (the stone class, as rocks already were) instead of concrete. Owner decision Q3 of
PROCEDURAL_ENVIRONMENT_AUDIT.md; `packages/shared/test/surfaceTypes.test.ts` lists every prop whose class changed.

### Implementation note: material classes fixed (owner, 2026-11-23)

When library materials got surfaces (2026-11-22), 42 kept the class the id guess had given them as a `ballistic`
override, so nothing changed then. Most were regex accidents. The owner's fixes, data only (`content/materials.json`):

- **White Orbital Station / Industrial / sci-fi panels** (`pbr_white_panel`, `orbital_panel`, `scifi_panel`): `panel`
  read as a glass pane. Now sheet metal (`thin_metal`): a 0.4 m panel wall stops the pistol, SMG, rifle and battle
  rifle; the marksman and precision rifles punch through, weakened; grazing hits may ricochet (45%, as sheet metal).
- **Bunker Concrete** (`pbr_bunker_panels`: Military walls, the set-piece stone role, the MapMaker barrier): glass, now
  concrete. Full cover; the barrier (400 HP) takes 56 Assault Rifle hits instead of 8.
- **Lights** (`light_strip`, `glow_trim`, `lamp_glow`, `beacon_red`): bulletproof `energy` (meant for force fields
  only), now plastic (drywall): rounds pass, a wall behind still stops them. **Neon tubes** are surface `glass` (glass
  chips and sound).
- **Masonry**: the lighthouse wall (`light` in lighthouse: energy), carved temple stone (`car`: sheet metal, 45%
  ricochet), painted hieroglyphs (`paint`: drywall) and the five sandstones (`sand`: soil) are all `stone`.
- **Cleanups**: prefab cladding sheet metal (was heavy metal), wattle and the mashrabiya lattice thin wood (still
  breakable screens), adobe soil (no ricochet off mud), planks labelled `thin_wood` (no change in play).
- **Unchanged on purpose**: floor grates and walkways (thin metal), render on masonry, roads and floors as soil, and the
  rest listed in CONTENT_PIPELINE.md, "Ballistic overrides that stay on purpose". Ice keeps its class; an ice surface
  type comes later.

`packages/shared/test/surfaceTypes.test.ts` (`INTENDED_MATERIALS`) lists each change by id;
`packages/shared/test/materialBallistics.test.ts` shoots each through the server's rules.

---

# 9. Environmental Damage

Different weapons should leave different signatures.

Examples:

### Pistol
- Small decals.
- Breaks glass.
- Damages small fragile props.

### Magnum / Heavy Revolver
- Larger material reaction.
- Can break light wooden objects.
- Stronger impulse.

### Rifle
- Better penetration.
- Chips masonry.
- Punches through appropriate cover.

### Shotgun
- Wide surface damage.
- Excellent against doors/glass/light props.

### LMG
- Sustained environmental destruction.

### Explosive
- Structural/destructible damage.
- Debris and impulse.

MapMaker objects should expose:

```text
Ballistic Damage: On/Off
Destructible: On/Off
Material Type
Health
Minimum Penetration Class
Explosion Response
```

---

# 10. Damage Model

The default official rules should favor **moderate TTK rather than extreme high or ultra-low TTK**.

Reasoning:

- Low enough that weapons feel dangerous.
- High enough for movement and aim skill to matter.
- Allows unusual characters and weapons without constant instant deaths.
- Works better with 16v16 and chaotic scenarios.

Recommended baseline:

> A competent player who gets the first accurate shots should have a strong advantage, but a defender with better movement/aim can still reverse the engagement.

### TTK Profiles

MapMaker / server rules should expose:

```text
LETHALITY
[ Arcade ] [ Standard ] [ Tactical ] [ Custom ]
```

Possible behavior:

**Arcade**
- ~125–150% effective health.
- Longer fights.
- Strong emphasis on tracking and powerups.

**Standard**
- Official intended balance.
- Moderate TTK.

**Tactical**
- ~65–80% effective health.
- Much more lethal.

**Custom**
- Creator-controlled health/damage multipliers.

As built (`gunplay.ts` `LETHALITY_HEALTH`): Arcade 1.4× effective health, Standard 1×, Tactical 0.72×, applied as one
damage multiple so every gun keeps its shape. Re-read 2026-11-16 with the clearer ranges: unchanged.

**Body TTK at Standard, ideal aim** (seconds, body shots to kill in brackets; `pnpm gun-report`, docs/gunplay-audit.json;
before → after the clearer ranges and damage by impact speed of 2026-11-16). Arcade multiplies the shots by about 1.4,
Tactical by about 0.72.

| Gun | 10 m | 25 m | 50 m | 100 m |
|---|---|---|---|---|
| Pistol | .67 (5) | .70 (5) | 1.10 (7) → **1.78 (11)** | 1.23 (7) → **1.97 (11)** |
| Heavy Revolver | .67 (2) | .72 (2) | .80 (2) | .97 (2) → **1.67 (3)** |
| Hand Cannon | .50 (2) | .55 (2) | 1.13 (3) → **1.63 (4)** | 1.30 (3) → **2.33 (5)** |
| Machine Pistol | .75 (16) | 2.43 (29) → **3.03 (41)** | 2.50 (29) → **3.12 (41)** | – (reach 60 m) |
| Pulse Pistol | .60 (5) | .75 (6) | 1.35 (10) → **1.95 (14)** | 1.35 (10) → **– (reach 90 m)** |
| SMG | .40 (7) | .63 (10) → **.83 (13)** | .90 (13) → **1.37 (20)** | 1.02 (13) → **1.53 (20)** → **1.67 (22)** |
| Assault Rifle | .50 (6) | .52 (6) | .75 (8) | 1.00 (10) |
| Burst Rifle | .53 (6) | .55 (6) | .92 (8) | 1.30 (11) |
| Battle Rifle | .60 (4) | .62 (4) | .83 (5) | 1.10 (6) |
| Spin Gun (LMG) | .55 (12) | .57 (12) | .65 (13) | .87 (16) |
| Marksman Rifle | .60 (3) | .62 (3) | .63 (3) | 1.00 (4) |
| Precision Rifle | .83 (2) | .85 (2) | .87 (2) | .92 (2) |
| Shotgun | .75 (2) | – | – | – |

The long guns did not move: at Standard damage by impact speed gives exactly the old distances (§37).

Arms as their own zone (2026-11-17, §11) moved one cell: the SMG at 100 m, 20 → 22 rounds (1.53 → 1.67 s), its spread
there putting some rounds on an arm. Every other ideal body cell is unchanged (the report aims at the chest's middle);
hip-fire, ADS and tracking cells, which spray, take about one round more in places. Arcade and Tactical scale as before.

**Arm shots to kill at Standard, 10 m** (unarmoured, every round on an arm; body in brackets): Pistol 5 (5), Heavy
Revolver 2 (2), Hand Cannon 2 (2), Pulse Pistol 5 (5), Machine Pistol 18 (16), SMG 8 (7), Assault Rifle 7 (6), Burst Rifle 7 (6),
Battle Rifle 5 (4), Spin Gun 13 (12), Marksman Rifle 4 (3), Precision Rifle 2 (2). The one-shot and two-shot guns keep
their counts on an arm, as do the Pistol and Pulse Pistol (24 a round: 21.6 still kills in five); the rest take one
round more, the Machine Pistol two. From the report's first-hit damage (docs/gunplay-audit.json `firstHit`). Ranges
(falloff) are unchanged.

Important:

**Do not rebalance every gun separately for these modes.** Apply systemic modifiers so relative weapon identity remains intact.

---

# 11. Body Damage

Recommended simple readable model:

```text
Head       1.5–2.0× depending on weapon
Upper body 1.0×
Arms       0.8–1.0×
Legs       0.75–0.9×
```

Specific weapons can vary.

Shotguns may use reduced headshot multipliers to prevent random pellet distribution from producing excessive instant kills.

Explosives should not use conventional headshot logic.

**Implementation note (2026-11-04): measured hit shapes.** Zones are no longer height bands on a 0.4 m capsule.
Every look has its own head sphere, torso, thigh, shin and (where they stick out) arm shapes measured from its model
standing, crouching and prone; the zone is the shape a round meets (head sphere: head, legs: legs, torso and arms:
upper body at 1.0×; the zone is the shape whose own core the round passes nearest). Lag compensation rewinds the
same shapes.

**Arms (2026-11-17):** the arm shapes are their own zone now, at **0.9×** for every bullet family (`arms` in
content/weapons/families.json; a weapon may set `armshot`; weapons without a family 0.9): between the body and the
legs (0.8-0.9), inside the spec's 0.8-1.0. Server-authoritative (sim/hitbox.ts, sim/match.ts `zoneScale`), from the
same measured rows. The rule is unchanged: the shape whose core the round passes deepest into wins, so a round through
a forearm into the chest is a body shot, and one that clips a forearm held out and misses the chest is an arm shot
(about 2 % of rounds aimed at the chest's middle from any side, about a third of upper-body hits sprayed near a body).
Arm hits show the body marker; the target flinches as for a body hit. Every shape carries a margin (`HITBOX_MARGIN`: 0.18 m body, 0.12 m head at a 1.8 m body) so hit rates
and TTK stay where the 0.8 m capsule had them: a standard chest is 0.68 × 0.62 m with it, the head 0.50 m across.
Melee keeps its forgiving reach and thrown projectiles are 0.12 m thick. docs/CHARACTERS.md, "Hitboxes".

---

# 12. Recoil Philosophy

Recoil should be **strongly learnable**.

Every automatic weapon has:

1. Initial kick.
2. Sustained recoil behavior.
3. Horizontal behavior.
4. Recovery speed.
5. Spread growth.

These are separate parameters.

Do not use spread as a substitute for recoil.

### Predictable Recovery

When firing stops, aim should recover toward the player's pre-recoil orientation using a consistent weapon-specific curve.

The player must always be able to learn:

> “If I stop firing now, this gun settles in approximately this amount of time.”

Avoid random or inconsistent recentering.

### Player Counter-Control

Players must be able to counter vertical recoil through input.

Do not completely negate their input with animation.

---

# 13. Extreme Weapon Profiles

Weapons should deliberately occupy extremes.

## Heavy Revolver

```text
Damage          VERY HIGH
Fire Rate       LOW
Initial Recoil  EXTREME
Recovery        SLOW but predictable
Capacity        5–6
Reload          Deliberate rhythmic reload
Accuracy        Excellent first shot
Velocity        Medium
Penetration     Strong
```

Feel:

> Every trigger pull is an event.

## SMG

```text
Damage          LOW
Fire Rate       VERY HIGH
Initial Recoil  VERY LOW
Sustained Recoil MEDIUM
Spread Growth   HIGH
Recovery        VERY FAST
Capacity        HIGH
Velocity        Low/Medium
```

Feel:

> Immediately controllable, increasingly wild if the trigger stays down.

Short bursts remain accurate.

## Assault Rifle

Balanced but **not boring**.

```text
Damage          MEDIUM
Fire Rate       MEDIUM/HIGH
Initial Recoil  MEDIUM
Sustained       Predictable vertical climb
Spread          LOW/MEDIUM
Velocity        HIGH
```

## Battle Rifle

```text
Damage          HIGH
Fire Rate       MEDIUM/LOW
Recoil          HIGH
Accuracy        HIGH
Velocity        VERY HIGH
Capacity        MEDIUM
```

## Shotgun

```text
Damage          EXTREME CLOSE
Cadence         LOW/MEDIUM
Range           LOW
Environment     VERY HIGH
Reload          Shell rhythm
```

## LMG

```text
Damage          MEDIUM
Fire Rate       HIGH
Capacity        EXTREME
Handling        POOR
Reload          VERY LONG
Sustained Fire  Excellent
```

## Precision Rifle

```text
Damage          VERY HIGH
Fire Rate       LOW
Velocity        EXTREME
Handling        POOR CLOSE
Drop            LOW but meaningful at extreme range
```

## Machine Pistol

Extremely high fire rate and mobility with aggressive ammunition consumption and poor sustained precision.

## Lever Action

Strong damage with a distinctive fire/rechamber rhythm and rewarding deliberate cadence.

## Burst Rifle

Burst timing should be mechanically meaningful rather than merely cosmetic.

---

# 14. First-Shot Accuracy & Spread

Spread should communicate weapon role.

### Recommended model

```text
baseSpread
movementSpread
airSpread
sustainedFireSpread
maxSpread
spreadRecovery
```

Avoid arbitrary bloom that makes bullets feel disconnected from the barrel.

The first shot from a settled precision-capable weapon should generally go where the reticle indicates.

### SMG Example

First 3–5 rounds:

> Tight.

Rounds 6–15:

> Rapidly increasing dispersion.

Release trigger:

> Very quick recovery.

This naturally teaches burst control without a tutorial box.

---

# 15. Hip Fire vs ADS

ADS should improve precision and visual targeting but should not be mandatory for every weapon.

### Hip-fire specialists

- Shotguns.
- SMGs.
- Certain pistols.
- Weird arcade weapons.

### ADS specialists

- Rifles.
- Marksman weapons.
- Snipers.

Players should be able to fire during the ADS transition.

Do not require the animation to finish before the weapon responds.

Accuracy can smoothly interpolate toward ADS values.

### Look speed while zoomed

Zoomed look speed follows the zoom 1:1 at the crosshair ("monitor distance 0"): the mouse sensitivity is
multiplied by `tan(fov/2) / tan(hipFov/2)`, so a given mouse movement moves the image at the screen centre
as far as it does in hip fire, for sights and every scope level alike. The player's **Zoom sensitivity**
(0.2–3×, default 1×) multiplies on top, easing in as the sights come up so nothing jumps
(`zoomLookScale` in `packages/client/src/game/lookFilter.ts`).

### Sights that line up

**Implementation note (2026-11-19; owner, 2026-11-18, the sights and scopes pass, step 1).** Aiming down the sights
puts the camera behind each gun's own drawn sights, with the front sight's top on the point of aim: the crosshair's
centre, where the round goes (rounds leave from the eye along the aim, §5). The gun is turned and moved to the eye;
nothing about the shot changes, and the blend, the field of view (0.72 of the hip's), the bob, the kick and the sway
are as they were. At the hip nothing changes.

- **The fit** (`tools/content/sight-fit.mjs`, run by `pnpm content:rebuild`, checked by `pnpm content:check`) reads each
  gun's model. On the plane of the barrel it takes the gun's top profile and the line that rests on it across the
  middle between the grip and the muzzle: its front end is the **front sight**'s top, its rear end the **rear sight**.
  A slice across the rear sight then says what the eye does there: through the middle of an **aperture**'s hole, over
  the ears of a **notch** (through the notch's own middle), or 1.5 mm over a plain **post** or, with a front sight
  only, the receiver (**bead**), so the front sight shows above it. The **eye point** is on the line through the two,
  as far behind the gun as it aimed before (the stock's end 0.2 m ahead of the eye, a handgun at its hip distance):
  any nearer and the camera's near plane (0.1 m) cuts the stock open inside the view. The line from the eye to the
  front sight is tested against the model's triangles and must be clear.
- **The table** is `packages/shared/src/content/sightFit.generated.ts` (eye, rear and front points per weapon, in the
  model's space like `view.muzzleAt`), loaded with the match's view, not with the menu. `game/sightPose.ts` turns it
  into the gun's placement (`sightPlacement`); `view.ts` blends to it from the hip.
- **Tolerance: 0.1°** (`SIGHT_TOLERANCE_DEG`) between the sights and the aim. Before the fit the 13 fitted guns were
  0.6° to 4.1° off (the gun's highest point sat 6 mm under the eye line, centred on its bounds); as drawn (the sheet's rays)
  the front sight's top is now within 0.03° of the aim's height and its middle within 0.09° across. `packages/client/test/sightPose.test.ts` holds every fitted gun to it and names the fitted, the
  hand-corrected and the excluded weapons, so a new gun cannot slip in unfitted.
- **No fit** (`SIGHT_EXCLUDED`, each with its reason): guns whose models have no usable sights keep the placement they
  had: the flat-topped kit guns (Arc Caster, Bubble Blaster, Flak Cannon, Laser Rifle, Oil Slicker, Flamethrower,
  Swarm Launcher, Disc Launcher, Arena Disc), the tube launchers (Rocket Launcher, Guided Rocket, Blast Rockets,
  Grenade Launcher), the Spin Gun (held at the hip), the Sawed-Off, the Singularity Cannon, the Plasma Rifle (an open
  sight box, no irons), the Flare Gun (drawn broken open), the Gilded Pistol (its cock stands in the line) and the Spear.
  Eight of them carry an optic since step 2 (below); the rest keep that placement.
  Scopes (`view.zoomFov`: Marksman Rifle, Precision Rifle, Railgun) hide the gun behind the scope overlay, the Battle
  Rifle brings its optic's eyepiece to the eye (`view.optic`), and melee weapons, tools and mounted guns do not aim.
- **The audit** is the sight sheet, `?mode=sights` (client `tools/sightSheet.ts`): each weapon from the eye as the game
  places it, the crosshair's centre marked, a target 15 m off; ←/→ step through the weapons, A toggles the aim, B the
  placement from before the fit. `window.__sights.audit()` casts rays at the gun as drawn and reports how far its
  top edge on the centre column (the front sight's top) is from the aim, the blade's middle across, and the nearest
  drawn point to the eye.

**The weapons intake's guns (2026-11-22; owner reports: the Woodland SMG's front post sat under the aim dot, the
Flintlock Pistol's fists filled the aim).** The intake had excluded five guns "until the sights pass" and the checks let
any exclusion with a reason through, so the Woodland SMG aimed over the top of its bounds (its front sight's hood) with
the post 1.3° under the HUD's dot. Now:
- the fit reads a front sight's hood wider than its band (a ring up to 4.4 cm across, its post a little further into
  it): the Woodland SMG's post is its front sight, and it is fitted (it carries a red dot by default, irons on choice);
- **an exclusion is refused** for a gun with no optic (`content/optics.json` `none`) whose sights the tool can read (a
  fit with no flags, or one only `blocked`): fit it, with a correction where the line is blocked, or give it an optic;
- **the hands stay out of the sight picture**: `sightPose.test.ts` holds each hand's point (`view.hold`) under the aim
  at full aim for every optic a gun may carry (`HANDS_UNDER_AIM_DEG`: a handgun's 14°, its fists drawn some 11° above
  their points; a long gun's shooting hand 8°, its support hand 3°, both behind the gun), and the sight sheet's audit
  measures the drawn arms round the aim (`arms`, the frame drawn with them and without; under 3° fails). The Flintlock
  Pistol's hold points moved down and back onto its butt (18.8° and 20.1° under the aim; they were 9.0° and 10.4°).

**Adding a gun.** Run `node tools/content/sight-fit.mjs --report`. A gun whose sights it finds joins the table; look at
it on the sight sheet, then add it to `FITTED` in `sightPose.test.ts`. When the tool reports `no-sights`, `off-bore`
(the line is over 4° off the barrel), `rear-on-stock` or `blocked`, decide in `content/sight-fit.json`: a
**correction** (`rear` and/or `front` points read off the model, with the reason) when the gun has sights the tool
misread, or an **exclusion** (with the reason) when it has none. No corrections were needed for the first 13.

### Optics by gun

**Implementation note (2026-11-19; owner, 2026-11-18, the sights and scopes pass, step 2: "real optics by gun: red dot
or holographic for close range, 2-3x for rifles and carbines, a full scope for snipers, each with its own reticle,
keeping the holdover marks").** Every hand-held gun carries one optic, or none with its reason. **No gun's zoom
changed**: each got the optic that matches the zoom it had (the sights' 0.72 of the hip field of view is 1.52×).

| Optic (kind) | Reticle | Guns | Zoom |
|---|---|---|---|
| Iron sights (`irons`) | none: the front sight is the aim | Pistol, Heavy Revolver, Hand Cannon, Pulse Pistol, Machine Pistol, SMG, Nailgun, Shotgun, Auto Shotgun, Freeze Ray, Goo Gun, Assault Rifle, Burst Rifle, Woodland SMG (since 2026-11-27) | 1.52× |
| Red dot (`reddot`) | a dot on its glass | Laser Rifle, Bubble Blaster, Sawed-Off | 1.52× |
| Holographic (`holo`) | a ring with four ticks and a dot, on its glass | Flak Cannon, Disc Launcher, Arena Disc, Plasma Rifle (its model's own sight box), Arc Caster (its model's own scope tube, since 2026-11-27) | 1.52× |
| 2-3× optic (`scope`) | a chevron with holdover ticks | Battle Rifle (3.5×, the model's tube), Marksman Rifle (2.19×, the scope overlay) | as before |
| Sniper scope (`sniper`) | a fine crosshair with holdover marks | Sniper Rifle (3.95×, 8.9× on the wheel), Railgun (3.13×) | as before |
| none | the HUD's aim dot, as before | the Rocket Launcher, Guided Rocket, Blast Rockets, Grenade Launcher, Swarm Launcher, Oil Slicker, Flamethrower, Spin Gun, Singularity Cannon, Flare Gun, Gilded Pistol, Spear | 1.52× |

- **A model's own sight** (`window`): the glass and its mark go in the model's opening, a clip hides what lies behind it
  while aimed; `round` for a round eyepiece (the glass and the clip a disc), `lens` for a closed sight whose own glass and
  body stand in the line (the z range the check along the barrel leaves out). Such a gun may offer a red dot or a
  holographic mark in it (only the mark changes; nothing is built): the Desert Carbine's holographic sight, the
  Twin-Shot Rifle's red dot tube and the Blaster X-42's scope tube carry a red dot by default (owner, 2026-11-22, "2a").
- **One sight at a time** (owner, 2026-11-27, "two sights stacked": the Woodland SMG's red dot on a riser over its own
  rear sight, the Arc Caster's holographic box on top of its own scope tube, "looks very odd"). Every gun in `weapons`
  says what its model has of its own, `hasSight`: `"optic"` (a scope, a red dot or holographic sight, or a sight box:
  the Arc Caster, Plasma Rifle, Desert Carbine, Twin-Shot Rifle, Blaster X-42 and the scoped guns), `"irons"` (iron
  sights only) or false (none: Bubble Blaster, Sawed-Off, Flak Cannon, Disc Launcher, Arena Disc, Laser Rifle), each
  read off the model on the sight sheet (`__sights.inspect('rear' | 'side' | 'top')` shows the shown gun from outside).
  A gun with an optic of its own aims down it (its `window`, its own tube or its scope) and `tools/content/optics.mjs`
  refuses any housing built in code for it, default or allowed (`packages/client/test/optics.test.ts` holds the list).
  The Woodland SMG aims down its iron sights and offers no housing: one would stand on its raised rear sight. A saved
  pick a gun no longer offers falls back to its default (`optics.ts opticOf`; the host's check does the same). The red
  dot's tube now sits on a tapered saddle along most of its length instead of a short post, so it reads as seated on the
  gun's top.
- **The table** is `content/optics.json`: `kinds` (reticle, housing, aimed field of view: `adsFov` for 1× sights, a
  `mag` range for magnified ones, the glass's size and the mark's) and `weapons` (`default` and `allowed`: those the loadout
  may pick, below, "Optic choice"), `none` with reasons. `tools/content/optics.mjs` (run by
  `pnpm content:rebuild`, checked by `pnpm content:check`) checks it and writes
  `packages/shared/src/content/optics.generated.ts`, loaded with the match's view, not the menu. A zoom stays in the
  weapon file (`view.zoomFov`, `view.optic.mag`); the tool only checks it lies inside its kind's range.
- **Housings** for the red dot (a tube) and the holographic sight (a hooded frame) are built in code
  (`game/opticHousing.ts`: a few boxes and a tube in one mesh, no outside models) and stand on the gun's top at the
  **mount** the tool measures from the model: the rearmost flat stretch of the top from the hand forward that the rest of
  the gun does not stand in front of, sized to the gun's length (0.85-1.2); a `mount` or, for a model with an open sight
  of its own (the Plasma Rifle), a `window` can be set by hand with its reason. A `window` is also a clip while aimed: a
  depth-only sheet over the opening, drawn first, so nothing of the gun behind it shows (the Plasma Rifle's box holds
  loose scraps of its model). They are on your own gun, in third person
  and on other players' guns; crowds (GPU-instanced guns), pickups and icons show the plain model.
- **Reticles on the glass, not the HUD.** The glass's material works out for each of its pixels where that pixel is in
  the view (the tangents of its angles from the view's axis, from its clip position and the projection) and lights the
  mark's pixels. So the mark is on the point of aim itself (the middle of the view: rounds leave the eye along the aim,
  §5), stays there while the gun bobs and kicks, is hidden outside the window, and is one screen pixel sharp at any
  resolution. Steady, brightness capped (0.92; 0.8 with Reduce flashing), a red under High's bloom threshold: no
  flicker, no bloom, no halo. Iron sights show no HUD dot; `#reddot` remains only for the guns with no optic.
- **Magnified reticles** are the HUD's (`#optic`, `#scope`, `data-reticle`): `chevron` (its tip the aim) for the 2-3×
  optics, `fine` for the sniper scopes, with the holdover marks of §5 placed for each view's own half-angle
  (`game/holdover.ts`, unchanged).
- **The sight picture.** A glass 0.4-0.7 m from the eye is a few dozen pixels across, so an aimed gun with a glass is
  drawn larger about the view axis as it comes up (`optics.ts` `pictureScale`: its window's half-height brought to 0.13
  of the screen's, at most 2×; 0.2 and 3× until 2026-11-23, below), the frame the Battle Rifle's optic uses: only x and y scale, every depth stays, nothing
  nears the near plane. Long guns' iron sights get it gently (`ironsPicture`: the rear sight as large as at 0.36 m, at
  most 1.6×: the Assault Rifle, SMG and shotguns 1.6×, the Burst Rifle 1.26×; handguns unchanged). Points on the axis
  stay on it, so the sights stay on the aim. The gun's bob and kick are drawn that much smaller, so they move the
  picture as far as before; the hands keep their own size.
- **The audit**: the sight sheet shows every weapon that aims with its optic (scopes with their own view and marks) and
  `__sights.audit()` adds the reticle's distance from the aim: a glass's mark found on the drawn frame (the pixels it
  changes when switched off), a HUD reticle's origin as laid out. All measured 0.00° (glass marks at most 0.01°).
  `packages/client/test/optics.test.ts` names every gun's optic and zoom and holds the rest (a weapon without an entry
  fails with what to do); `tools/content/test/optics.test.mjs` covers the tool.

**The eye at a long gun's glass (2026-11-23; owner's screenshot of the Woodland SMG, "that scope tho": a huge crude tube
on a blocky square mount filling the middle of the screen, the view through it seeming aimed elsewhere, the gun low with
its rear a big black shape).** Causes: a gun aimed through a red dot or holographic sight stood wholly ahead of the eye
(its rear end 0.2 m ahead, as an unfitted gun), so the glass was 0.5-0.65 m off and the sight picture drew the whole gun
up to 3× larger to bring its window to 0.2 of the screen: housing, riser, slab and receiver all grew with it (the
Woodland SMG, mounted far forward on its rear sight block, at the 3× cap). The lens itself was on the aim (in the owner's
screenshot the dot sits within a pixel or two of the glass's middle and the glass shows the world straight through; the
camera was looking at the grass), but with that much gun round it the view read as aimed elsewhere. Now:
- **The eye comes to the glass** on a long gun (`view.hold.style` long): `tools/content/optics.mjs` `fitEye` measures the
  eye's place from the model (`mount.eye`, model z): the glass 0.3 m off (`EYE_NEAREST`), or further where the gun near
  the eye would show in the aimed view (points within 0.16 m of the eye, the near plane's 0.1 m and a margin, must be out
  of the picture as drawn). 0.3-0.39 m on the 16 long guns (the Woodland SMG 0.39, its receiver under the eye). Handguns
  are held out as before. `sightPose.ts` `glassPlacement` uses it.
- **A smaller sight picture**: the window's half-height 0.13 of the screen's, the gun drawn at most 2× (0.2 and 3× before);
  most long guns now draw at 1-1.5×. The model's own sight windows (Desert Carbine, Twin-Shot Rifle, Blaster X-42) share
  the cap.
- **The red dot's mount**: a low clamp and a tapered riser in place of the square block on a square slab.
- **Checks**: `optics.test.ts` holds every glass as drawn (`optics.ts` `glassAt`, where `opticHousing.ts` puts it), both
  ends of its housing and every 2x eyepiece on the aim for every optic a gun offers, and each long gun's eye fitted
  (0.3-0.45 m, picture at most 2×, window at most 0.13); `tools/content/test/optics.test.mjs` checks the fit (nothing near
  the eye shows; nearer, the Woodland SMG's receiver would); the sight sheet's audit adds `lens` (the drawn glass's middle
  against the aim, failing over 0.1°).
The 2x optic was already right on every gun that offers it (its eyepiece on the aim at 0.12 m, the world at 2×); unchanged.

**Adding a gun or changing its optic.** Give it an entry in `content/optics.json` (`weapons`, or `none` with a reason),
run `node tools/content/optics.mjs` (`--report` prints the table and mounts), look at it on the sight sheet, then name
it in `optics.test.ts`. A new kind: add it to `kinds`; a new housing shape or mark needs its builder or shader branch
in `opticHousing.ts`.

### Scope feel

**Implementation note (2026-11-19; owner, 2026-11-18, the sights and scopes pass, step 3: "scope feel: sway with
breath-hold on Shift/stamina, scope edge darkening, zoom steps, a soft sniper glint (calm under Reduce flashing)").**
For the magnified optics: the Battle Rifle, the Marksman Rifle, the Sniper Rifle and the Railgun. Nothing about a shot
changed (damage, spread, recoil, timing), nor the sim or the protocol; `game/scopeFeel.ts` holds the rules,
`content/optics.json` the feel numbers (`feel`, and `steps` per kind or gun).

- **Sway and breath** (as before, now data). Through a magnified optic the aim drifts in a slow figure of eight, and
  the drift moves the real aim: `sway` 0.0035 rad (0.2°), the same angle at every zoom. **Shift** (which sprints
  otherwise; never while aiming) or a controller's sprint button holds your breath on a meter of its own, not on sprint
  stamina: the drift shrinks to `swayHeld` 0.12 of its size for `breathSeconds` 3.5 s; run out and it grows to
  `swaySpent` 2.2 × until the meter is back to `readyAt` 0.5 (2 s; a full refill takes `recoverSeconds` 4 s, scoped
  or not). New: the drift's size **eases** between the three (`settle` 0.15 s) where it used to jump, which moved the
  aim by up to a quarter degree in one frame when the breath was taken and far more when it ran out; the meter's label
  reads "Out of breath" in red while spent (steady, no blinking); a controller can hold breath.
- **Zoom steps** on the mouse wheel while scoped (`steps`: shares of the gun's own aimed field of view; the first is
  always 1, the zoom the gun comes up at; unchanged from before, now data): Sniper Rifle 3.95× → 8.87×, Railgun
  3.13× → 7.08×, Marksman Rifle 2.19× → 5.04× (`[1, 0.45]`). The Battle Rifle's tube has one zoom (3.5×). The
  holdover marks are placed for the field of view of the step you are on, so they spread out at the second zoom.
- **The eye box (scope shadow).** Inside the glass the picture darkens softly toward the edge, and a darker crescent
  slides in from the side: with your own turning (the clear picture leads the turn), against a kick (the gun rises,
  the shadow comes in from the top) and a little with the sway; it eases back when the view is steady, and holding
  breath stills it with the sway. It is a dark sheet with a clear round hole the size of the glass (soft from 0.8 to
  1.08 glass radii), clipped to the glass and slid by a CSS transform: no render pass, no repaint, as sharp as the
  screen. The hole never moves further than 0.5 radii, so the reticle's centre is always at least 0.3 radii clear.
  Coming up to the eye the shadow starts off the middle and opens.
- **The surround** (the black round the glass) now comes in at once with the zoom and goes out over 0.1 s. It used
  to fade in over 0.16 s and cut out: since the zoom snaps, the magnified picture showed all over the screen for a
  few frames before the dark arrived (over pale ground, a bright flash), and leaving a scope cut from black to the
  scene in one frame. Coming up to the eye is shown by the eye box opening instead.
- **The glint.** Other players see a small, soft, steady point of light at the scope of a player who aims a
  sniper-kind optic (Sniper Rifle, Railgun) their way: within 14° between that player's aim and the line to your eye
  (full within 4°), from 18 m (full from 30 m; nearer you see the gun), down to 0.55 of its level by 320 m. It is one
  square of four vertices facing the camera, its soft round worked out in its shader, drawn in the scene with the
  scene's own depth, so walls, hills and crates hide it for nothing; no fog, no depth written. It spans the same angle
  at any distance (its square the tangent 0.02 at the hip: 18 px across on a 720-line screen, the light its middle third;
  through your own scope the square root of the zoom larger). Steady: its level only eases (0.15 s up, 0.25 s down), its colour stays under
  High's bloom threshold, a thin dark ring keeps it readable against a bright sky. `game/scopeGlint.ts`.
- **Who is scoped: the host says.** `PlayerSnapshot.zm` (docs/MULTIPLAYER_PROTOCOL.md section 23) is set by the
  match while a player's scope picture is up: a magnified optic in hand, the aim button held, the gun ready and its
  aim at least half way up (`GunState.ads` ≥ 0.5, the line between a no-scope shot and a scoped one: 0.1 s after the
  button), and it goes the tick the aim is let go. The glint is drawn only with it and a sniper-kind optic (Sniper
  Rifle, Railgun), so a player who merely holds the rifle, reloads it or runs with it does not glint. Bots are no
  different: a bot holds the aim button when it fires a scoped weapon, or waits on a shot with one, at something more
  than 7 m off (`bots/brain.ts`), and its `zm` comes from the same state; the glint no longer reads a bot's AI state.
  **Older hosts** (from before the field) never send it, and nothing in the protocol tells such a host from one where
  nobody is scoped: there nobody glints. The earlier guess (`seemsScoped`: a sniper-kind weapon held, alive, not
  sprinting; for a bot, fighting) is gone: a missing glint is better than a wrong one.
- **Reduce flashing** (docs/LOOK.md): the shadow moves less far (0.3 radii), less dark (0.6 against 0.94) and through
  a quarter-second filter, so turning hard left and right cannot swing a dark area from side to side; the surround
  goes out over 0.22 s; the glint is dimmer (0.5 against 0.85) and comes up over half a second. The `flashing`
  flow's `scope` (by day) and `glint` (at night) moments record them.

| Number (`content/optics.json` unless noted) | Before | Now |
|---|---|---|
| `feel.sway`, `swayHeld`, `swaySpent` | 0.0035 rad, × 0.12, × 2.2 (in code) | the same, as data |
| `feel.breathSeconds`, `recoverSeconds`, `readyAt` | 3.5 s, 4 s, 0.5 (in code) | the same, as data |
| `feel.settle` (the drift's size easing) | 0 (a jump) | 0.15 s |
| `steps`: sniper kind, and the Marksman Rifle | `[1, 0.45]` (in code, every scope overlay) | the same, as data |
| `steps`: 2-3× kind (the Battle Rifle) | one zoom | `[1]` |
| Surround fade in (`style.css`, then `scopeFeel.ts`) | 0.16 s, growing from 1.15 × | 0 (with the zoom) |
| Surround fade out (`SCOPE_FADE`) | 0 (a cut) | 0.1 s (0.22 s calm) |
| Eye box (`EYE_BOX`): turn 1.5, kick 2.2, sway 0.1, decay 0.12 s, most 0.5 radii, dark 0.94 | none | new (calm: 1, 1.2, 0.06, filter 0.25 s, 0.3, 0.6) |
| Glint (`GLINT`): cone 14° (full 4°), 18-30 m in, 0.55 by 320 m, level 0.85, rise 0.15 s, fall 0.25 s | none | new (calm: level 0.5, rise 0.5 s) |

Tests: `packages/client/test/scopeFeel.test.ts` (the numbers above, the breath's times, the easing, the shadow's
limits, the glint's cone); `tools/content/test/optics.test.mjs` (the table's checks).

**Left for later:** the Marksman and Sniper scopes are still the full-screen overlay with the gun hidden; their models
carry scope tubes that the Battle Rifle's frame (`opticView.ts`) could look through instead. The snapshot bit above.


### Optic choice

**Implementation note (2026-11-22; owner, 2026-11-18, the sights and scopes pass, step 4: "optic choice per weapon in the
loadout (red dot, holographic or 2x), built on 1 and 2").** For a gun that may carry more than one optic, the player picks
which in their loadout: **Profile → Favourite loadout → Optics** (every gun with a choice, its own optic first), or
**Pause → Settings → Optic** for the gun in hand. The pick is kept per gun in this browser (client `opticPrefs.ts`), goes
to the match as you join and when you change it (docs/MULTIPLAYER_PROTOCOL.md section 27), and everyone draws the optic
you picked on your gun (the roster's `op`). **Nothing about a shot changes with it**: damage, spread (aiming tightens
every gun's spread the same, through any optic), recoil and timing are the gun's own; no gun's own zoom changed. What
changes is what you see: the sight picture, the reticle and, with the 2x optic, a narrower view.

| Gun | Optics offered (its own first) |
|---|---|
| Assault Rifle, Submachine Gun, Compact Carbine | iron sights, red dot, holographic, 2x |
| Burst Rifle, Amarillo | iron sights, 2x (their front sight, or the Amarillo's rear block, stands in a red dot's or a holographic sight's window) |
| Laser Rifle | red dot, holographic, 2x |
| Shotgun, Auto Shotgun, Runebreaker, Nailgun, Freeze Ray, Goo Gun | iron sights, red dot, holographic |
| Pistol, Heavy Revolver, Hand Cannon, Pulse Pistol, Machine Pistol, Laser Blaster | iron sights, red dot |
| Bubble Blaster | red dot, holographic |
| Desert Carbine, Twin-Shot Rifle, Blaster X-42 | red dot, holographic (in the model's own sight) |
| Arc Caster | holographic, red dot (in the model's own scope tube, since 2026-11-27) |
| Flak Cannon, Disc Launcher, Arena Disc | holographic, red dot |
| none: Sawed-Off (red dot), Plasma Rifle (its own sight box), Flintlock Pistol (irons), Woodland SMG (irons, since 2026-11-27: a housing stood on its rear sight) | |
| none: snipers and every gun with a scope of its own (Battle Rifle, Marksman, Nova 6, Lever-Action, Crossbow, Sniper Rifle, Railgun) | they keep their scope |

- **The 2x optic** (kind `x2`, housing `magtube`, `power` 2: twice the hip view, a little more than the sights' 1.52x)
  is a tube built in code on the gun's top (`game/opticHousing.ts` `scopeParts`: a foot and two rings, the tube, an
  eyepiece bell and a wider objective bell, a turret; no outside model), standing on the gun's mount. Aimed, it is looked
  through as the Battle Rifle's own tube is (`opticView.ts`): the eyepiece (the tube's rear end, its clear radius the
  glass's) comes to the eye at the usual relief (0.12 m), the world narrows to 2x, the HUD's `#optic` shades round the
  glass and draws the **chevron** with the holdover marks of §5 for that view, and scope feel applies (sway, Shift
  breath-hold, the eye box). `optics.ts` `eyepieceOf` gives the eyepiece (`OpticSpec`) from the mount, so every place
  that looked through a model's own tube (`sightPose.ts`, `view.ts`, `session.ts`, the sight sheet) takes it the same
  way. One zoom (`steps` [1]). It sets `PlayerSnapshot.zm` while up (a magnified optic), so others' clients know you
  are scoped; it never glints (only sniper scopes do).
- **One mount a gun.** Every built housing a gun may carry (red dot, holographic, 2x) stands on one mount, found by
  `tools/content/optics.mjs` for the first of them in its list (its default when that is built) and checked for each:
  nothing ahead of it in its window's lower half, nothing **behind** it in its window as the eye sees it (the gun
  between the eye and the glass may cover only the lowest 15 %; for the 2x, nothing over the eyepiece's lowest 15 %
  between the eye and the tube), and the line from the eye through its glass clear. A gun that fails for an optic does
  not offer it, or gets a hand-set `mount` with its reason (the Amarillo's 2x: ahead of its rear block).
- **Who carries what.** `opticOf(def, choice)` takes a pick only when the gun's `allowed` has it, else the default, so a
  stale or foreign pick is harmless. `opticFor(def, slot)`: your own from your loadout at once, anyone else's from the
  roster; bots carry each gun's default (bot sets have no loadouts), and so does everyone on a host older than the field.
  Your own first-person gun is built again when you change its optic (`view.ts` `refreshOptics`), others' when the roster
  says theirs changed; crowds (GPU-instanced guns) draw no housing, as before.
- **Checks.** `packages/client/test/optics.test.ts` names every gun's choice and checks every offered optic (glass marks
  on the aim, the 2x's eyepiece on the aim at its relief and 2x, its holdover marks); `packages/shared/test/opticChoice.test.ts`
  the wire and the match (made valid, the roster, spectators, bots, `zm`); `tools/content/test/optics.test.mjs` the tool's
  new checks; the `characters3` e2e flow picks the 2x for the Assault Rifle in the pause menu, aims through it and checks
  the roster. The sight sheet (`?mode=sights`) shows any optic on any gun (`__sights.show(id, { optic })`) and its audit
  passes for every offered pair.

---

# 16. Animation Priority & Interrupt Rules

This is a hard requirement.

> **Animation represents game state. Animation does not own game state.**

The animation system must never prevent a valid emergency action solely because a cosmetic sequence is still playing.

### Priority concept

```text
DEATH / INCAPACITATION
↓
FIRE (when mechanically legal)
↓
MELEE / EMERGENCY ACTION
↓
WEAPON SWAP
↓
ADS
↓
RELOAD
↓
INSPECT / COSMETIC
```

Exact ordering can vary by weapon, but cosmetic actions are always lowest priority.

### Reload Cancel

A reload can be interrupted by:

- Firing if ammunition is already available.
- Weapon swap.
- Melee.
- Sprint/evade where appropriate.
- Interact where appropriate.

Magazine state must reflect the actual reload stage reached.

### Shotgun Example

Shell inserted → that shell exists immediately.

Player may interrupt and fire it.

### Magazine Weapon Example

Possible stages:

1. Magazine removed.
2. New magazine inserted.
3. Chamber action if required.

The weapon's usable state follows these mechanical events, not the animation's final frame.

---

# 17. Reload Rhythm

Reload speed should be part of weapon identity.

Avoid making every weapon reload in roughly 2 seconds.

Examples:

### SMG

Fast, snappy magazine change.

### Assault Rifle

Reliable medium reload.

### Heavy Revolver

Slow deliberate sequence; potentially individual rounds or speedloader depending on model.

### Shotgun

Per-shell reload creates tactical rhythm:

> Load 1 → can fire → load another → can fire.

### LMG

Major commitment.

The huge magazine advantage is paid for through an intentionally dangerous reload window.

### Energy Weapon

May vent heat rather than reload.

### Reload Mastery

Optional perfect-timing mechanics can exist on specific weapons, but should **not** become a universal rhythm minigame.

---

# 18. Reload Rules

Support both:

**Tactical Reload** — ammunition remains in magazine/system as appropriate.

**Empty Reload** — usually longer due to chamber/bolt requirement.

This difference should be noticeable but not tedious.

Creator settings may optionally enable hardcore magazine retention, but this is not default behavior.

---

# 19. Weapon Switching

Switching must feel fast enough that carrying multiple weapons matters.

Weapons can have different equip speeds:

- Pistol: extremely fast.
- SMG: fast.
- Rifle: medium.
- LMG: slow.
- Rocket launcher: slow.

A player caught reloading a heavy weapon should often be rewarded for swapping to a sidearm instead of waiting.

This creates meaningful sidearm gameplay.

## 19.1 Choosing a weapon: categories, keys and the wheel (as built, owner 2026-11-22)

With dozens of weapons on you (a pickup deathmatch, the Training Range), choosing is by **category**. Eight
categories, in this order everywhere (the wheel clockwise from the top, the keys 1-8):
**Pistols, SMGs, Rifles, Shotguns, Snipers, Heavy, Energy, Melee & gadgets**
(`packages/client/src/game/wheelCategories.ts`). A weapon's category comes from its own data, never a list of names:
melee weapons and tools (medkit, grapple, builder, medi-beam) → Melee & gadgets; energy cells or heat → Energy;
explosives and the `lmg` family → Heavy; the other specials → Pistols if a sidearm (slot 2), else Heavy; otherwise its
pickup `category`. A new weapon, or one whose category the Weapon Manager changes, lands in its slice with no code
change. (`slot` stays in the data: pickups' auto-switch and bots still read it.)

- **Category keys** (default 1-8; Options → Controls → Weapons rebinds them, docs/CONTROLS.md): away from the category, the key takes out the weapon you used last in it (its first, the first time);
  again, the next one you hold in it, round to the first. Holding the key doesn't spin through it.
- **The wheel** (hold Tab since 2026-11-23, was Q; hold a controller's Y, the Weapons button on a phone): the eight slices, each with its key,
  the icon of its last pick and how many you hold; empty slices dimmed and not pickable. Pointing at a slice opens its
  weapons on an outer arc (icon and name; the middle shows the pointed one's ammo), laid out so the slice's last pick
  sits in line with the slice: a quick flick to a slice and letting go brings it back, and moving round the arc picks
  another. The mouse, the right stick and a finger point it the same way (`categoryAim`); letting go (a click, a lift)
  switches.
- **Unchanged:** the mouse wheel steps through everything held (in category order, as on the wheel; through a scope it steps the zoom); X
  (a tap of Q until 2026-11-23) goes back to your last weapon; Fort Wars' builder takes keys 1-8 as its pieces.
- **On the wire** nothing changed: a switch is still the weapon code in the next inputs (`PlayerInput.weapon`), sent
  until a snapshot both acknowledges an input that carried it and shows it in hand (`weaponRequest.ts`). Bots never
  used the keys or the wheel.
- **The number-key bug (2026-11-22):** the old keys picked a `slot` (2 pistols, 3 rifles…) and, from another slot,
  always the slot's first weapon: the Pistol, the AK. A request was also dropped by any snapshot showing the asked-for
  weapon in hand, even one from before the host read it (a quick press out and straight back was lost), and a request
  for a weapon no longer held stayed, so every key counted from a weapon outside its slot and landed on the first.

---

# 20. Aim Assist

Aim assistance must be **subtle** and primarily intended for controller parity/accessibility.

Mouse should generally receive no magnetic aim correction.

Controller assistance may include:

- Mild slowdown near valid targets.
- Very small rotational assistance while actively tracking.
- Optional projectile-lead assistance only for deliberately casual settings, not competitive default.

Never visibly drag the player's reticle onto a target.

Aim assist strength must be configurable.

Cross-input matchmaking may expose aim-assist policy.

---

# 21. Hit Feedback

Every successful shot should communicate immediately through several restrained channels.

Possible layers:

- Hitmarker.
- Impact sound.
- Target reaction.
- Material/flesh effect.
- Small crosshair response.
- Damage number only if mode/UI enables it.

Avoid enormous hitmarkers that obscure the target.

### Distinct Hit Feedback

Differentiate:

```text
Normal hit
Headshot
Armor hit
Shield hit
Critical / weak point
Kill
```

Players should recognize these largely by **sound and shape**, not by reading text.

As built (2026-11-17): **shield hit** is a hit on a player under spawn protection (its shield takes the round, no
damage): a pale gold ring, round where every other marker is angular, and a high thin ping (the armour clank pitched
up and softer). The client knows from the snapshot's `FX_PROTECTED` bit; no new event. **Critical / weak point**: the
game has no weak points yet (no shielded enemies or vehicles with a weak spot), so there is no marker for it.

---

# 22. Crunchy Kill Confirmation

Kills should feel decisive.

Recommended layers:

1. Distinct kill-confirmation sound.
2. Sharper hitmarker transformation.
3. Brief visual pulse.
4. Strong target death response.
5. Kill feed entry.
6. Optional tiny score/medal event.

The sound is particularly important.

It should be short enough that rapid multikills produce a satisfying rhythm rather than audio clutter.

### Multi-Kill Rhythm

Consecutive kills can subtly escalate the confirmation sound or UI treatment.

Do not cover the screen in medals.

---

# 23. Impact Reactions

Character reaction must reinforce weapon power without stealing control excessively.

Examples:

- Pistol → small flinch.
- Magnum → strong upper-body response.
- Shotgun → large impulse at close range.
- Explosion → dramatic physical reaction.

In competitive multiplayer, reaction animations must not create long unavoidable stun-lock chains unless a specific weapon explicitly owns that mechanic.

### Implementation: stopping power (2026-10-30)

Arcade-light, server-authoritative (`packages/shared/src/sim/impact.ts`):

- Each weapon has a **stopping power** 0..1 (`stoppingPower` on the definition;
  default by category: pistol 0.15, SMG 0.12, rifle 0.3, shotgun 0.8, sniper
  0.9, explosive 0.4, melee 0.55, special 0.25; revolvers 0.45; mounted guns 0.3).
- A full hit at power 1 shoves the body 3.6 m/s along the shot (on the
  ground, gone in about a quarter of a second: a pistol round moves someone
  ~7 cm, a shotgun blast ~35 cm) and slows it by 42 % for 0.12–0.42 s
  (scaled by power). Pellets add up to their weapon's figures; a round
  softened by range or glass gives its share.
- **No stun-lock**: in one stagger window the shove stops at 4.5 m/s, the
  slow at 50 % (and at the hardest weapon's own slow), the window at 0.6 s
  however many rounds land; then the body is immune for 0.5 s. Under
  sustained fire at most ~55 % of the time is slowed.
- The shove is push velocity and the slow part of the status speed (`ms`),
  so the local player's prediction replays both on reconciliation; bots run
  the same movement, so suppressing fire slows a push.
- `knockback` stays for weapons that deliberately shove hard (the Battle Axe,
  the railgun), on top.

**Punchier (owner, 2026-11-16: "punchier please").** Measured in the sim (one full hit at 5 m on a standing
target; `impact.test.ts`). Shove 4.4 m/s at power 1 (was 3.6); powers shotgun and sniper 1.0 (0.8, 0.9), revolvers
0.75 (0.45), the Battle Rifle 0.6 (a rifle's 0.3), rifle 0.3, pistol 0.12 (0.15), SMG 0.1 (0.12): the heavy hitters
most, rifles a little more, SMGs and pistols as light as before. Ground travel of one hit, before → after: SMG
5 → 5 cm, pistol 6 → 6 cm, rifle 12 → 16 cm, Battle Rifle 12 → 31 cm, shotgun 33 → 52 cm, Precision Rifle 38 → 52 cm,
Marksman 37 → 52 cm, Hand Cannon 62 → 82 cm and Heavy Revolver 90 → 131 cm (their own `knockback` on top). **In the
air** a body takes 1.5× the shove (`IMPACT.airShove`) and, with no ground grip, carries it until it lands: a shotgun
blast on a jumping player 1.5 → 3.4 m. Stagger: slow 48 % at power 1 (42 %), 0.12–0.5 s (0.12–0.42). **The no-stun-lock
caps are unchanged** (slow 50 %, window 0.6 s, immunity 0.5 s); the shove's own cap grew with the shove (5.5 m/s, was
4.5) so one blast is never cut. The **drawn flinch** is bigger (head 0.7 rad, twist 0.5, buckle 0.3) and lasts 0.5 s,
and heavy hits (power 0.6 and up: the Battle Rifle, revolvers, shotguns, snipers) play the hit clip. The **player who
is hit** gets a small camera kick (`client/src/game/hitKick.ts`): presentation only (split recoil, §29: the aim does
not move), up about 1.3° for a full power-1 hit and a little away from the round, capped at 1.8° however many rounds
land, gone in 0.6 s. Reduce flashing: both the kick (0.55×, eased in over 90 ms, slower to settle) and the flinch
(eased in over 100 ms) lose their snap. Damage by impact speed (§37) scales the shove with the damage.
- The **flinch** is drawn only (`characterAnimator.flinch`): head hits snap
  the head back, torso hits twist the shoulders away from the round, leg hits
  buckle the body; a heavy hit (stopping power × 2.2 or damage/25 of 1.6+) plays
  the `hit` / `hit_head` clip on the upper body.
- **Explosions** (`blastKnockback`, `blastThrow`): every explosion of 35+
  splash damage throws (4 + damage × 0.06 m/s, 6–13, unless it sets its own
  `knockback`), up 0.9× (more from below, at least 0.35×) and out 0.85×,
  falling to 40 % at the edge. Your own blast throws 0.7× out and 0.8× up: a
  rocket at your feet is a ~2.4 m rocket jump.
- **Unarmed quick melee** (`UNARMED`, `BUTTON_MELEE`): punch 15 damage, 1.9 m,
  stopping power 0.5, 0.37 s between strikes; kick (moving forward, or within
  0.6 s of a punch) 22 damage, 2.2 m, stopping power 0.85 plus a 3.2 m/s shove,
  0.7 s. No lockout of the gun.

---

# 24. Death Presentation

Deaths should be readable, fast, and entertaining.

Support:

- Authored death animations.
- Physics blending/ragdoll.
- Directional impulse.
- Explosive reactions.
- Special weapon-specific deaths where appropriate.

The game has an absurd tone, so death presentation can be exaggerated without becoming gore-dependent.

---

# 25. Death Cam

Default multiplayer death flow:

1. Death occurs.
2. Very brief impact hold if appropriate.
3. Camera provides readable view of death/attacker.
4. Optional killcam depending on mode.
5. Respawn flow.

Death cameras should answer:

> “What killed me and from where?”

rather than merely showing a cinematic.

### Killcam

For modes where information leakage is acceptable, show approximately **2–4 seconds** surrounding the kill.

For competitive modes where teammate callouts make this problematic, killcam may be delayed, shortened, or disabled.

---

# 26. Slow Motion

Slow motion should be a **special punctuation tool**, not routine interruption.

Good uses:

- Final kill of a round.
- Scenario boss death.
- Challenge completion.
- Last player elimination.
- Particularly dramatic environmental kill.
- Offline/local modes.

Avoid global slow motion during normal online firefights.

For online matches, a final-kill presentation can use replay/time-scaling presentation without changing authoritative live simulation for active players.

---

# 27. Movement & Shooting

Movement should influence accuracy without making weapons feel unusable.

Possible states:

```text
Standing
Walking
Sprinting
Crouched
Airborne
Sliding / special movement
Vehicle
```

General philosophy:

- Walking: small penalty.
- Crouching: small accuracy benefit for appropriate weapons.
- Sprinting: cannot immediately have precision ADS accuracy; weapon transition remains responsive.
- Airborne: substantial accuracy penalty for conventional precision weapons.

Arcade weapons may intentionally violate these rules.

**Implementation note (2026-11-18): handling per weapon (G2).** Every family carries `handling` (content/weapons/
families.json; a weapon's own overrides it; `gunplayOf(def).handling`): `move`, the running speed holding it (a share
of everyone's: walking and running, never sprinting, which is the same with every weapon so getting about a map does
not depend on what you hold), and `sprintExit`, the ticks from leaving a sprint to the first round. The sim holds the
trigger on the raise timer for that long (Match.applyInputs; client prediction replays it, a correction's replay
included), so a trigger held as you stop fires the moment the gun is up, and the scope waits for it. Values, mild on
purpose (GUNPLAY_DIRECTION: no severe movement penalties, no slow sprint-to-fire):

| Family | move | sprint exit |
|---|---|---|
| pistol | 100 % | 3 ticks (50 ms) |
| machine pistol | 100 % | 4 (67 ms) |
| SMG | 100 % | 5 (83 ms) |
| revolver | 100 % | 6 (100 ms) |
| shotgun | 97 % | 7 (117 ms) |
| rifle | 97 % | 8 (133 ms) |
| battle rifle | 95 % | 9 (150 ms) |
| marksman | 95 % | 10 (167 ms) |
| precision | 93 % | 12 (200 ms) |
| LMG | 90 % | 13 (217 ms; its spin-up follows) |

Weapons without a family: 100 % and 6 ticks (melee at once); rocket launchers (Rocket Launcher, Guided Rocket, Blast
Rockets, Swarm Launcher, Singularity Cannon) 92 % and 12, the Grenade Launcher 95 % and 10, the Railgun 93 % and 12,
the Flamethrower 95 % and 8. The content check holds `move` to 0.85-1.1 and `sprintExit` to 18 ticks at most.

**The trigger and a held sprint (2026-11-18, owner: "gunshots are lagging now… chugging").** The sprint stops while
the trigger is held, so with sprint held every gap between taps sprinted again and every tap waited the exit time (a
rifle's 6-tick click fired nothing). The client's trigger latch (`packages/client/src/game/triggerLatch.ts`) sends the
sprint button only once the trigger has been let go for 0.5 s (a slow gun: its fire interval and 0.25 s), and holds
a pull made while the gun comes up (out of a sprint, or any raise) until it is up. Only the buttons sent change, so the
host and prediction rules above are untouched and it works on every host. `packages/client/test/triggerLatch.test.ts`.

### Slide and peek (owner, 2026-11-18, "a"; built 2026-11-21)

Two movement moves, shared by the host and client prediction (`packages/shared/src/sim/moves.ts`, stepped inside
`stepMovement`), so they are predicted like the rest of movement and need no new message.

**Slide.** Sprint, then crouch (Shift held, then C). The slide starts a little faster than the sprint (×1.1, about
8.6 m/s), keeps that momentum along the way you were running (the legs steer only a quarter of a crouch walk's worth),
slows at 8 m/s² on the flat and ends crouched at a crouch walk: about 0.75 s on the flat, never more than 1.1 s.
Rules:

| Rule | Value |
|---|---|
| Starts from | a sprint the tick before, a fresh crouch, on the ground (not in the air, swimming, on a ladder or under a canopy) |
| Stamina | 0.2 of the bar to start (about a second of sprinting: `SPRINT.drain` is 0.22/s); none comes back while sliding; with less than 0.2, or winded, no slide (a plain crouch) |
| Cooldown | 0.5 s after a slide before another stamina move (no chaining) |
| Slopes | the grade it slides over adds (downhill) or takes (uphill) half of gravity along it, so a downhill slide lasts a little longer, never faster than it started |
| Ends early | letting go of crouch or jumping (you stand, the momentum fades as a knockback does), a wall in the way, leaving the ground (the momentum carries on through the air) |

The momentum is the existing push velocity (`MoveState.vx/vz`, which knockback and jump pads use), slowed by the slide
instead of the ground's quick decay; when the slide ends the push keeps only what is over a crouch walk, so there is no
lurch. Shooting while sliding is allowed (hip fire's moving spread applies; responsiveness over realism).

**Stamina moves.** `STAMINA_MOVES` is the table the bigger moves take stamina from: a cost to start and one cooldown
they share (`MoveState.moveCd`, so a slide can't be chained into a dodge). The dodge-step and combat roll are rows of
it (below).

**Peek (lean).** Held: Q left, E right (owner, 2026-11-23: "Q and E need to be the peeks"; until then ` and Left Alt,
with Q the last weapon and E use). Options → Controls rebinds both, like every key (`game/keyBindings.ts`,
docs/CONTROLS.md); a player who had moved the old lean keys keeps them. Ten ticks to lean all the way (0.17 s), back the same. The upper body rolls
about the hips by up to 0.3 rad (17°) and shifts 12 cm at the hips, so the eye moves about 0.33 m out standing
(0.24 m crouched) and 3 cm down. No stamina. Not while sprinting or sliding, prone, in the air, swimming or seated.
Controller (owner, 2026-11-23): D-pad left / right lean while LT aims (held or toggled), and are the previous / next weapon
otherwise (docs/CONTROLS.md, "Controller"); the pad sets the same lean buttons as the keys.

Never into a wall: a ray from the upright eye stops the lean 0.2 m short of anything to that side, and a wall that
comes closer pulls it in at once.

- **Hit shapes move with it** (`sim/hitbox.ts`, `HitBody.lean`): the head, torso and arms are tested rolled and
  shifted exactly as the eye is; the legs stay. **Lag compensation rewinds the lean** with the rest of the body
  (`Match.recordHistory` keeps it), so a round aimed at a head seen round a corner lands where the shooter saw it.
- **Rounds, throws, melee and sight lines leave the leaned eye** (`Match.eyeOf`, `sim/moves.ts eyePoint`); third-person
  aim works from it too. Bots see a leaning head where it is, and see from their own leaned eye.
- **The camera** moves out with the eye (always: it is where your rounds go) and rolls at most 0.07 rad (4°), eased;
  Options → Camera shake scales that roll (Off: none) and the system's reduce-motion setting removes it. No flash, no
  fade: the slide's camera is the crouch's own eased drop.

**Drawn.** In third person and for everyone else, the body leans (the spine rolls 0.65 rad, more than the hit shapes'
roll because a skinned spine can't shift at the hips; the drawn head lands where the hit head is) and slides (the
crouch pose tipped back 0.42 rad over the feet, the spine bringing the shoulders back onto the aim and the hands placing
the gun on the aim with the tip taken out, `characterAnimator.ts aimFrame`: without that the drawn gun pointed 24° up). The snapshot says
`sd` (sliding) and `ln` (lean steps); docs/MULTIPLAYER_PROTOCOL.md section 26.

**Bots** (docs/BOTS.md, "Slide and peek"): a bot sprinting the last few metres into cover under fire may slide into it
(once per spot, with the stamina for it); a bot peeking round tall cover steps out less and leans the rest of the way.

Tests: `packages/shared/test/slidePeek.test.ts` (momentum, the 0.6-0.9 s slide, stamina and its refusal, no slide in
the air or from a walk, the cooldown, a replay from any tick; the lean both ways, never into a wall; hit shapes and
lag compensation with the lean; a leaning shooter's rounds), `packages/client/test/slidePeekPrediction.test.ts` (no
correction at 100-300 ms), the e2e flow `slidepeek` (a slide and leans in a real match, first and third person,
another body drawn sliding and leaning, and two players on a dedicated server: one sees the other lean and slide).

### Dodge-step and combat roll (owner, 2026-11-18, "a (ensure any of the more substantial moves use stamina too)"; built 2026-11-25)

The second step after slide and peek, on the same footing: `packages/shared/src/sim/moves.ts` (`DODGE`, `ROLL`), stepped
inside `stepMovement`, so the host and client prediction step them alike and they need no message of their own.

**One button, Dodge** (`BUTTON_DODGE`, sent once per press like Use): **V** on the keyboard (rebindable in Options →
Controls; V was the second trigger's alternative key, which now has none: middle mouse stays), **B while aiming** (LT held
or toggled) on a controller, the way the d-pad leans while aiming (B without the aim is the crouch as before), and a
**Dodge** button on touch. Pressed standing or walking it is a **dodge-step**; pressed crouched or sprinting it is a
**combat roll**.

| | Dodge-step | Combat roll |
|---|---|---|
| Starts from | on the ground, standing or walking (not prone, sliding, in the air, swimming, on a ladder or under a canopy) | the same, crouched or sprinting |
| Way | the move keys' way in the view's frame; none held: straight back | the same; none held: straight ahead |
| Burst | 1.5 × running pace (a sprint's 7.8 m/s) held 0.15 s, then it fades as a push does: about 2 m in 0.4 s | 1.15 × running pace (6 m/s) held 0.55 s: about 3.3 m, then the push keeps only what is over a crouch walk |
| Stamina | 0.15 of the bar (less than a slide's 0.2) | 0.3 |
| Cooldown (shared with the slide) | 0.4 s | 0.6 s |
| Body | standing; the legs keep 30 % of their steering | the crouch's height and hit shapes for its time (it goes under what a crouch does); 20 % steering; jump does nothing; ends crouched if crouch is still on, standing otherwise |
| Gun | stays up: fire and aim as normal (hip fire's moving spread applies) | down: no shot, no aim; it comes up after the roll in the weapon's sprint-exit time (`rollRaise`, on the raise timer, as out of a sprint) |
| Ends early | a wall in the way (the push stops dead); off the ground (a jump out of it, a ledge) only 0.35 of the push goes on, so a dodge-jump carries no further than a sprint jump | the same |

No invulnerability: the docs never asked for i-frames, and responsiveness over realism is served by the speed and the
lowered profile (a roll's crouch hit shapes), not by ignoring hits. With less stamina than the move costs, or winded, or in
the cooldown, the press does nothing. No stamina comes back while either lasts. Character stats' stamina stretches the
cost as it stretches a sprint.

**First person** stays comfortable: never a flip. The roll's eye drops to a crouch's height (the stance's own eased drop)
and the gun goes down as out of a sprint; the view banks at most 0.035 rad (a step) or 0.06 rad (a roll) toward a sideways
move, most at its middle, scaled by Options → Camera shake and none with the system's reduce-motion setting
(`session.ts leanView`). No flash, no fade, nothing for Reduce flashing to calm.

**Drawn** (third person and everyone else): a roll is the crouch pose turned a full turn about the body's middle toward
the way it goes, done by 85 % of the roll so a snapshot's lag never leaves it part way round (`characterAnimator.ts`,
`tumble`); a step leans the body into the step (0.16 rad) and lifts it 5 cm at its middle. Your own body under a
first-person camera isn't turned. The snapshot says `dg: [kind, ticks]`; docs/MULTIPLAYER_PROTOCOL.md section 28.

**Bots don't use them** (the simpler of the two choices; a bot's own dodging already strafes under fire). Help: the
Controls page's rows (keys, controller, touch) and a first-time tip once you are hurt and still standing.

Tests: `packages/shared/test/dodgeRoll.test.ts` (each move's distance, time and way, stamina and its refusals, the shared
cooldown both ways, a dodge-jump's length, no lean, the roll's crouch and how it ends, a wall, a replay from any tick; in a
match the roll's lowered gun and the step's raised one, the snapshot), `packages/client/test/dodgeRollPrediction.test.ts`
(no correction at 100-300 ms), `padInput.test.ts` and `inputWheel.test.ts` (B while aiming, V once a press), the e2e flow
`dodgeroll` (both moves in a real match and predicted on the page, the roll's gun, another body drawn rolling;
`DODGEROLL_PICS=<dir>` takes frames of each).

---

# 28. Suppression

Do **not** make conventional suppression a major default mechanic.

Being shot near should not randomly destroy player accuracy.

If suppression exists:

- Primarily audio/visual.
- Bullet snaps.
- Near-miss sounds.
- Small environmental reactions.

Actual aim disruption should be extremely limited or mode-specific.

Player skill should remain in the player's hands.

---

# 29. Camera & Weapon Feedback

Recoil feedback can include:

- Weapon model kick.
- Camera kick.
- Reticle movement.
- Sound impulse.
- Muzzle flash.
- Controller vibration.

Do not make camera shake so strong that the player cannot visually track their own target.

### Split Recoil

Prefer separating:

**Mechanical recoil** — changes actual aim.

**Visual recoil** — weapon/camera animation used for impact.

This lets designers make a gun feel huge without making it mechanically unusable.

---

# 30. Audio

Weapon sound is a core gameplay system.

Every weapon needs layers for:

- Mechanical action.
- Muzzle blast.
- Tail/reverb.
- Distant report.
- Projectile crack where appropriate.
- Impact.
- Reload mechanics.
- Empty click.

Environment should influence weapon tails:

- Small interior.
- Large interior.
- Exterior.
- Tunnel.

The same revolver should sound materially different in a concrete bunker and open desert.

---

# 31. Muzzle & Projectile Readability

Muzzle flashes should be visible but short.

Tracers should help players understand trajectory without turning every automatic weapon into a laser beam.

Recommended configurable tracer intervals:

```text
None
Every shot
Every 2
Every 3
Every 5
Magazine final rounds
Custom
```

Enemy/friendly tracers may use subtle faction readability where appropriate.

---

# 32. Power Weapons

Rare map weapons should be allowed to violate normal balance expectations.

Examples:

- Minigun.
- Experimental beam cannon.
- Heavy launcher.
- Alien weapon.
- One-shot precision cannon.

Balance comes from:

- Spawn location.
- Limited ammunition.
- Respawn timer.
- Handling liability.
- Visibility/noise.

Not every weapon must be equally strong in a vacuum.

This is especially important to the arcade/MapMaker heritage.

---

# 33. Weapon Pickup Philosophy

Map weapons create movement and conflict.

Strong weapons, ammunition, armor, and powerups should create intentional hotspots.

MapMaker should visualize estimated pickup value and distribution so creators can identify accidental imbalance.

---

# 34. Weapon Archetype Matrix

The initial architecture should support at least:

```text
Semi-auto pistol
Heavy revolver
Machine pistol
SMG
Assault rifle
Burst rifle
Battle rifle
LMG
Pump shotgun
Semi-auto shotgun
Lever action
Marksman rifle
Bolt / precision rifle
Anti-material / heavy rifle
Grenade launcher
Rocket launcher
Beam weapon
Plasma weapon
Flamethrower / stream weapon
Bow / crossbow
Thrown weapon
Melee weapon
Novelty / experimental weapon
```

The vertical slice does not need all of them.

Recommended first six remain:

1. Pistol.
2. SMG.
3. Assault rifle.
4. Shotgun.
5. Precision rifle.
6. Rocket/explosive weapon.

Add the heavy revolver early because it is an excellent test of exaggerated weapon identity.

---

# 35. Weapon Data Model

Weapon tuning should be data-driven.

Conceptual schema:

```text
WeaponDefinition

identity
  id
  name
  family
  tags

handling
  equipTime
  adsTime
  sprintExitTime
  movementModifier

fire
  mode
  rpm
  burstCount
  burstDelay
  triggerBehavior

projectile
  projectileType
  velocity
  gravityScale
  drag
  penetration
  ricochet

accuracy
  baseSpread
  movementSpread
  airSpread
  sustainedGrowth
  maxSpread
  recoveryRate

recoil
  initialVertical
  initialHorizontal
  sustainedPattern
  horizontalVariance
  recoveryDelay
  recoveryRate

ammo
  magazineSize
  reserve
  ammoType

reload
  type
  tacticalDuration
  emptyDuration
  interruptStages

 damage
  baseDamage
  headMultiplier
  limbMultiplier
  falloffCurve

feedback
  cameraKick
  visualKick
  muzzleProfile
  audioProfile
  controllerImpulse
```

Do not bury fundamental behavior in weapon-specific code.

As built, `handling.equipTime` is `raiseTicks`, `adsTime` is `accuracy.adsTicks`, and `sprintExitTime` /
`movementModifier` are `handling.sprintExit` / `handling.move` (§27's note).

---

# 36. Fire Modes

Architecture must support:

- Semi-auto.
- Full-auto.
- Burst.
- Charge.
- Hold/release.
- Spin-up.
- Pump/cycle.
- Alternate fire.
- Dual-function trigger.

Alternate fire should be allowed to radically alter behavior.

Example:

> Rifle primary = automatic bullets.  
> Alternate = underbarrel grenade.

Or:

> Energy weapon primary = rapid plasma.  
> Alternate = charged slow projectile.

**Implementation note (2026-11-16): switchable modes.** A weapon lists its modes in `fireModes` (content/weapons; shared
`sim/fireModes.ts` `firingOf`): the first is the weapon's own trigger, a later one overrides the fire interval, the
burst (count, ticks between rounds) and the kick. The player switches with a key (U; B is the quick-message key) and
the mode wanted travels in every input (`PlayerInput.fireMode`), so the host applies it and client prediction replays
it like the rest of the input; bots choose by range (`bots/fireModePick.ts`). Every trigger reads through the same
code, so weapons without a list keep theirs exactly. First user: the Battle Rifle's Single and 3-round Burst
(docs/ARSENAL.md, "The Battle Rifle: fire modes").

---

# 37. Damage Falloff

Avoid identical linear falloff across weapons.

Different profiles:

### SMG
Strong close → rapid falloff.

### Rifle
Stable medium → gradual falloff.

### Revolver
Strong close/medium → moderate falloff.

### Precision Rifle
Minimal falloff within intended map ranges.

### Shotgun
Effective damage loss emerges through both pellet dispersion and per-pellet range tuning.

Players should be able to learn effective ranges visually and experientially.

### Implementation: damage by impact speed and clearer ranges (owner, 2026-11-16)

**Damage by impact speed** (`gunplay.ts` `impactFalloff`, `Match.bulletFalloff`). Bullets fly with drag by family
(share of speed lost a second: pistol 1.5, machine pistol 1.8, SMG 1.5, revolver 0.6, rifle 0.6, LMG 0.6, Battle
Rifle 0.5, marksman 0.45, precision 0.3). Under **Standard and Advanced** ballistics a round's damage (and so its
shove) follows its speed when it strikes over its muzzle speed, on each gun's own curve: the speed its round has at
Standard at the falloff's start is full damage, the speed at its end is the floor, in between the falloff's own shape.
Under the sim's drag, speed falls linearly with distance (v/v0 = 1 − drag (x − 8) / (v0 q), q = 1 − drag/120), so at
Standard **every gun keeps its tuned kill distances exactly**. **Advanced** (0.8× velocity, 1.5× drag) loses speed
and so damage about 1.9 times as fast; **Arcade** keeps the distance falloff. Penetration, water and ricochets take
their own damage share (`scale`) and lower the speed reference with it, so nothing counts twice. Drawn rounds (yours
and others') fly with the same drag.

| Gun | Muzzle (m/s) | Drag | Full damage at or above | Floor at or below | Floor | Advanced: full → floor | Speed at its reach |
|---|---|---|---|---|---|---|---|
| Pistol | 375 | 1.5 | 96 % (18 m) | 85 % (45 m) | 40 % | 13–28 m | 59 % at 110 m |
| Machine Pistol | 360 | 1.8 | 100 % (8 m) | 91 % (25 m) | 35 % | 8–17 m | 74 % at 60 m |
| SMG | 400 | 1.5 | 97 % (15 m) | 90 % (35 m) | 35 % | 12–22 m | 65 % at 100 m |
| Hand Cannon | 300 | 0.6 | 98 % (20 m) | 91 % (55 m) | 40 % | 14–33 m | 79 % at 110 m |
| Heavy Revolver | 300 | 0.6 | 97 % (25 m) | 89 % (65 m) | 40 % | 17–38 m | 79 % at 110 m |
| Assault / Burst Rifle | 820 | 0.6 | 99 % (25 m) | 95 % (70 m) | 60 % | 17–41 m | 64 % at 500 m |
| Battle Rifle | 880 | 0.5 | 98 % (40 m) | 95 % (100 m) | 75 % | 25–57 m | 66 % at 600 m |
| Spin Gun (LMG) | 760 | 0.6 | 98 % (30 m) | 94 % (80 m) | 70 % | 20–46 m | 77 % at 300 m |
| Marksman Rifle | 900 | 0.45 | 97 % (60 m) | 93 % (150 m) | 85 % | 36–84 m | 89 % at 220 m |
| Precision Rifle | 950 | 0.3 | 96 % (150 m) | 91 % (300 m) | 90 % | 84–164 m | 69 % at 1000 m |

Shotguns (hitscan pellets), the Pulse Pistol and other hitscan guns keep the distance falloff under every rule.

**Clearer ranges.** Close-range guns reach less far and fade to a low floor; rifles, the LMG, the Battle Rifle and
the snipers stay long. Each gun's best range is in its weapon file (`notes.range`) and `impactSpeed.test.ts` checks it
against the data and the sim (the stated body shots at the best range, at Standard).

| Gun | Best range (full damage) | Body shots there | Floor (by) | Reach (before) |
|---|---|---|---|---|
| Pistol | 18 m | 5 | 40 % (45 m), was 65 % | 110 m (250) |
| SMG | 15 m | 7 | 35 % (35 m), was 55 % | 100 m (200) |
| Machine Pistol | 8 m | 15 | 35 % (25 m), was 50 % | 60 m (60: already short) |
| Pulse Pistol | 15 m | 5 | 30 % (45 m), was 45 % | 90 m (110) |
| Hand Cannon | 20 m | 2 | 40 % (55 m), was 70 % from 60 m | 110 m (140) |
| Heavy Revolver | 25 m | 2 (to about 50 m; a head shot kills to about 45 m) | 40 % (65 m), was 70 % from 60 m | 110 m (300; owner, 2026-11-16: "short range yes") |
| Assault Rifle | 25 m | 6 | 60 % (70 m) | 500 m |
| Burst Rifle | 25 m | 6 | 60 % (70 m) | 160 m |
| Battle Rifle | 40 m | 4 | 75 % (100 m) | 600 m |
| Spin Gun (LMG) | 30 m | 12 | 70 % (80 m) | 300 m |
| Marksman Rifle | 60 m | 3 | 85 % (150 m) | 220 m |
| Precision Rifle | 150 m | 2 | 90 % (300 m) | 1000 m |
| Shotgun / Sawed-Off / Auto | 8 m | 1 / 1 / 2 blasts | 25 % (28 m) | 40 / 25 / 40 m |

Bots' weapon bands were re-measured (`pnpm gun-report --bands`): the Pistol and Pulse Pistol 45 → 37.5 m, the SMG
27.5 → 22.5 m; the long guns' bands did not move. The Hand Cannon's and the Heavy Revolver's hand-set stand-off is 3–30 m (was 35 and 40); the revolver's measured band stays 0–27.5 m (its two-shot kill holds to about 50 m).

---

# 38. Network Architecture Requirements

The dedicated server remains authoritative for:

- Fire validation.
- Projectile creation.
- Hit validation.
- Damage.
- Penetration outcomes.
- Destruction.
- Kills.

The client should predict presentation aggressively enough that firing never feels delayed by round-trip latency.

### Client immediately predicts

- Muzzle flash.
- Weapon recoil.
- Fire animation.
- Local projectile/tracer presentation.
- Audio.

Server reconciles authoritative results.

### Lag Compensation

Use bounded historical state / rewind for appropriate weapon classes so a player does not need to aim at where an opponent will be **because of network latency in addition to projectile travel**.

Important distinction:

> Players should lead because bullets travel through the world—not because the network feels bad.

Projectile simulation and lag compensation must be designed together.

---

# 39. Browser Performance

Do not create one heavyweight scene object per bullet if automatic weapons and 32-player battles make that expensive.

Projectile simulation should support:

- Pooled representations.
- Server-efficient ballistic integration.
- Client visual tracers separated from authoritative projectile state where appropriate.
- Interest management.
- Simplified simulation for distant/unobservable projectiles where safe.

NPC firing should use the same combat rules where practical but may use optimized simulation paths that preserve player-visible outcomes.

---

# 40. AI Weapon Handling

Bots must obey weapon characteristics.

Do not allow bots to bypass recoil, projectile travel, reloads, or weapon limitations.

Bot skill changes:

- Reaction time.
- Target prediction quality.
- Recoil compensation skill.
- Burst discipline.
- Leading accuracy.
- Drop compensation.
- Weapon-selection intelligence.

A weak bot with a sniper should genuinely struggle with moving long-range targets.

A strong bot should lead well—but not cheat by knowing future player positions.

---

# 41. NPC Combatants

Lower-cost scenario NPCs may simplify some decision-making, but their bullets must still appear consistent with player weapon rules.

NPC archetypes can intentionally have different accuracy behavior:

- Suppressive soldier.
- Marksman.
- Berserker.
- Close-range shotgunner.
- Heavy gunner.

This helps large battles remain readable.

---

# 42. Accessibility

Support:

- Adjustable controller aim assist.
- Toggle/hold ADS.
- Toggle/hold crouch.
- Recoil accessibility options only where they do not compromise competitive integrity.
- Crosshair customization.
- Hitmarker customization.
- Camera shake reduction.
- Muzzle flash reduction.
- Screen-flash reduction.
- Controller vibration strength.
- Color-independent armor/shield indicators.

As built (2026-11-17, Options → Accessibility and the pause menu; client `game/combatPrefs.ts`, `game/rumble.ts`):
**Aim** Hold / Toggle (a toggled aim lets go on a sprint (not with a scope or optic in hand: Shift holds the breath
there), a weapon change, death, a vehicle or leaving play, and stays through a reload; works with every
scope and the Battle Rifle's optic; touch's Aim button always toggles); **Camera shake** Off / Reduced (0.35) / Full
for the view's own movement, every source in `game/cameraShake.ts`: heavy-shot shake, the hit kick (§23), blasts and
crashes, the lean and zipline roll (mechanical recoil stays: it is
where the rounds go, §29; Reduce flashing keeps its calmer kick on top); **Controller vibration** on/off and strength
(10-100 %, 70 % by default) through the Gamepad API's `vibrationActuator` (else `hapticActuators`) for firing (a buzz a round for automatics, a
thump for heavy shots), hits taken and blasts and crashes near you; hidden where the browser can't rumble a
controller. Saved in this browser (`tiletrigger.combat`).

Competitive playlists may standardize mechanics while preserving presentation/accessibility settings.

---

# 43. MapMaker Combat Settings

Creators should be able to modify combat feel without rewriting weapons.

Recommended scenario controls:

```text
LETHALITY
Arcade / Standard / Tactical / Custom

BALLISTICS
Arcade / Standard / Advanced

FRIENDLY FIRE
Off / Reduced / Full

HEADSHOTS
Off / Standard / Enhanced

AMMO
Limited / Standard / Abundant / Infinite

RELOAD
Standard / Instant / Disabled

WEAPON PICKUPS
On / Off

STARTING LOADOUT
Custom

POWER WEAPONS
On / Off

ENVIRONMENT PENETRATION
Off / Standard / Enhanced

DESTRUCTIBLE ENVIRONMENT
Off / Standard / Enhanced

KILLCAM
Off / On / Final Kill Only

AIM ASSIST POLICY
Playlist / Controller Standard / Custom
```

Creators may also globally scale:

- Damage.
- Projectile velocity.
- Gravity.
- Recoil.
- Ammo capacity.
- Reload speed.

Use sensible clamps to avoid broken simulation values unless an explicit experimental mode is enabled.

---

# 44. Training Range

A weapon testing range should be available from the weapon browser/editor.

Include:

- Static targets at marked distances.
- Moving lateral targets.
- Armor targets.
- Penetration materials.
- Destructible objects.
- Recoil wall.
- Damage readout.
- Projectile velocity/drop visualization toggle.

This serves players **and developers**.

**Where it lives (owner, 2026-11-24):** Profile → Favourite loadout → **Test weapons** (the loadout screen), not the map list: a training map (`TRAINING_MAPS`, shared `map/retired.ts`) with no modes, offline, alone, your class and optic picks, no score or clock; Back returns to the loadout (docs/FEATURES.md, "Training maps"). Its boards, walls, racks and range troopers are as before; the armour targets, damage readout and drop view above are still to come (QUEUE, "Gunplay gaps").

Developers should be able to compare two weapon builds rapidly.

---

# 45. Weapon Tuning UI / Debug Tools

Internal tools should visualize:

- Recoil path.
- Spread cone.
- Bullet trajectory.
- Velocity over distance.
- Damage over distance.
- Penetration energy.
- TTK against common health values.
- Reload timeline.
- ADS/equip timing.

Provide side-by-side weapon comparison.

Example:

```text
HEAVY REVOLVER vs SMG

Damage       ██████████   ██
Fire Rate    ██           ██████████
Recoil       ██████████   ███
Capacity     ██           █████████
aVelocity    █████        ██████
Spread       ██           ███████
```

Extreme profiles should be visible immediately.

**Implementation note (2026-11-18): the weapon tuning page.** An internal tool, as above, so a team tool page rather
than an Options screen (players feel weapons in the Training Range, §44): `?mode=weapons` (client
`tools/weaponTuning.ts`, its numbers in `tools/weaponTuningData.ts` from the sim's own functions). Up to three weapons
side by side, with their fire modes: stat bars on one scale across the whole arsenal (damage, fire rate, recoil,
capacity, velocity, spread, move speed, sprint to fire, sights up, draw, reload), the recoil path over up to 30 rounds
with the recovery between them, spread cones at 25 m against a body (hip, sights, running, airborne, after a spray),
damage and time to kill over distance (a crosshair and values on hover), and drop with the holdover angles, all under a
chosen ballistics rule and health. Deep link: `?mode=weapons&w=core.smg,core.revolver&ballistics=advanced&hp=100`.
Not yet shown: penetration energy, the reload timeline, velocity over distance.

**The Weapon Manager (2026-11-22, owner: "manage the weapons we have in game… rename, suggest things, removal,
selecting sound").** The page's Manage tab (`&view=manage`, client `tools/weaponManager.ts`; the comparisons are shared
from `tools/weaponCompare.ts`) lists every weapon and edits its name, hidden state, category, description, sounds,
sets and stats (each in its range, the game's value beside it, the comparisons above drawn for the game's weapon and
the edit side by side) and takes notes. It writes nothing: **Send changes** makes a versioned JSON change set
(`tools/content/weapon-edits-format.mjs`) that `node tools/content/apply-weapon-edits.mjs <file>` checks and writes
into the weapon content data in the repo; a session lands it. Hidden weapons (`"hidden": true`) leave random pickups,
sets, class loadouts, Roulette and MapMaker's palette; placed on a map they still spawn. The flow for the owner, step
by step: docs/FEATURES.md, "Weapon Manager".

---

# 46. Feel Validation

A weapon is not complete because its numbers are balanced.

Every weapon must pass a feel review covering:

### Input
- Does firing happen immediately?
- Does ADS feel immediate?
- Can emergency actions interrupt correctly?

### Identity
- Can testers identify the weapon family blind from handling/audio?
- Does it have an obvious strength?
- Does it have an obvious liability?

### Mastery
- Is recoil learnable?
- Is recovery predictable?
- Is effective range understandable?
- Does burst discipline matter where intended?

### Feedback
- Can the player tell hits from misses?
- Armor from flesh?
- Headshot from body shot?
- Kill from ordinary hit?

### Ballistics
- Does long-range shooting reward lead/drop knowledge?
- Does close-range shooting still feel crisp?

### Animation
- Does animation ever make input feel ignored?

If yes, fix it.

---

# 47. Recommended Default Combat Character

The official default should sit between twitch arena shooter and tactical shooter.

It should **not** become:

- Pure hitscan laser combat.
- Mil-sim realism.
- Extremely spongey hero-shooter combat.
- One-frame tactical death everywhere.

Target:

> **Arcade readability + physical ballistics + exaggerated weapon identity.**

Players can move quickly and fight aggressively, but precision, recoil control, projectile leading, drop compensation, weapon selection, and map knowledge create a substantial skill ceiling.

---

# 48. Additional Systems Worth Supporting

## Chambered Round

Weapons can optionally track a chambered round separately from magazine capacity.

Keep hidden from casual UI unless useful.

## Heat

Supports weapons that overheat rather than conventionally reload.

## Weapon Condition

Architecture may support condition, but **do not use random jams in standard multiplayer**.

Randomly denying a trigger pull is incompatible with the responsiveness goal.

## Charge State

For bows/energy weapons.

## Akimbo / Dual Wield

**Status: steps 1 to 4 built: the data and the rule, play (the match, prediction, the HUD's two counts, the
snapshot's fields), the pair in first person with its sounds, and the pair in third person for everyone else. On in
normal play since step 4:** `AKIMBO_READY` is true, so a person who picks up a second of an eligible gun they hold
makes a pair in any match whose rule allows it (on by default), and Match Setup, a dedicated server's rules and
docs/HOSTING.md offer the switch. Tuning (step 5) waits for the owner to play it.

Owner's decision (2026-11-19): one-handed guns (pistols, machine pistols, small SMGs) and sawn-off or short
shotguns can be paired; melee pairs later; never rifles. A host can turn it off; it is on by default.

Owner's answers on step 3's two questions (2026-11-20): **the same-tick double kick stays as it is** ("1a, let me test
first": both triggers on one tick take both rounds' kick on the one aim, the Sawed-Off pair about 9.6° against 3.4°
for one gun; the owner plays it before anything changes), and **the pair's first-person pose stays** 2 cm wider and
2 cm higher than the one gun ("2a", `PAIR_POSE`).

### The design in brief

- **Making a pair.** Pick up a second of the same gun while you carry one and you hold one in each hand. Only the
  same weapon pairs with itself, and only a weapon marked eligible.
- **Ammunition.** The two guns share the reserve; each has its own magazine.
- **Triggers.** Left mouse fires the gun you already held, as now; right mouse is the second gun's trigger. There
  is no aiming down sights while paired. The fire-mode key puts the second gun away: back to one gun, with its
  sights.
- **Reload.** R reloads the emptier gun first, then the other; the gun that isn't being reloaded still fires.
  (Responsiveness over realism: a reload never takes both triggers away.)
- **The trade.** A pair is volume for precision, never a better gun: a wider cone (a wider pellet pattern for a
  shotgun), more kick, slower reloads and a slower raise, as data per family (below). Weapons keep their identity:
  the numbers multiply what the one gun has.
- **The rule.** `MatchRules.akimbo`, default on ("Dual wielding" in Match Setup, with the weapon rules: "Pick up a
  second of the same small gun to hold one in each hand."; `akimbo` in a dedicated server's RULES, taking effect at
  the next match). Off: a second gun of the same kind is ammunition, as today.

### The trade as data

`content/weapons/families.json`: the top-level `akimbo` block is where every pair starts (everything × 1, the raise
× 1.25), and a family's `akimbo` block is its trade. `cone`, `pattern`, `kick`, `reload` and `raise` multiply the one
gun's aim cone, pellet pattern, recoil, reload time and raise time (each 1 to 3: never better than one gun); `move`
is added to `handling.move` (−0.1 to 0, and the result stays at 0.85 or more: no severe movement penalties).

| Family | Cone × | Pattern × | Kick × | Reload × | Raise × | Move |
|---|---|---|---|---|---|---|
| pistol | 1.5 | 1 | 1.2 | 1.35 | 1.25 | 0 |
| machine_pistol | 1.6 | 1 | 1.25 | 1.35 | 1.25 | 0 |
| smg | 1.7 | 1 | 1.3 | 1.4 | 1.25 | −0.03 |
| shotgun (for the sawed-off) | 1 | 1.15 | 1.4 | 1.5 | 1.25 | 0 |

A weapon is eligible only by its own flag, `"akimbo": true` in `content/weapons/<name>.json` (or an object that
overrides numbers; `"as": "<family>"` names the family to take them from for a weapon that has none). Today:
`core.pistol`, `core.machine_pistol`, `core.sawed_off` and `core.pulse_pistol` (as a pistol). Not the revolver, the
hand cannon, the full-stock SMG, the gilded pistol, the flare gun, the goo gun, the freeze ray, the nailgun, the
LMG, the shotgun or the auto shotgun; adding one is that one line (docs/CONTENT_PIPELINE.md, "Making a weapon
eligible for dual wielding"). The generator refuses the flag on a weapon with an alt-fire, a zoom scope or fire
modes (the pair needs right mouse and the fire-mode key, and can't aim), and on melee until melee pairs exist.

In code: `akimboOf(def)` beside `gunplayOf` (`packages/shared/src/sim/gunplay.ts`) returns the resolved numbers
(base, then family, then the weapon's own) or null for a weapon that can't be paired.

### The steps

1. **Data and the rule (landed).** The trade and the eligible weapons as data, `akimboOf`, `MatchRules.akimbo` from
   Match Setup and a dedicated server's rules to the match and the client. Hidden behind `AKIMBO_READY` (false, in
   `packages/shared/src/sim/rules.ts`): no switch in Match Setup, no `akimbo` rule on a server, nothing in a rules
   summary.
2. **Play (landed, off by default).** The sim and prediction: making a pair on pickup, the second trigger, two
   magazines over one reserve, the staggered reload, the trade applied, the fire-mode key back to one gun, drops and
   bots; the wire for it; the HUD's two magazine counts. "As built" below.
3. **The pair in first person (landed, off by default).** The second gun in your left hand with its arm, each
   gun's own kick, flash, case, muzzle and reload dip, the raise and the putting away, the sounds, Reduce flashing.
   "As built: the pair in first person" below.
4. **Third person, then on (landed).** Everyone else (and you in third person) sees the second gun: the public `dw`
   on a character, its left hand's gun, flash and tracers. Then `AKIMBO_READY` true, which makes pairs in normal
   matches and shows the switch and the server rule (and their row in docs/HOSTING.md). "As built: the pair in third
   person" below.
5. **Tuning and more pairs.** The numbers above played and adjusted; small SMGs and whatever else the owner adds;
   melee pairs.

### As built: play (step 2, 2026-11-19)

In the match (`packages/shared/src/sim/match.ts`), mirrored by client prediction (`game/prediction.ts`); the numbers
come from `akimboOf` through five small helpers in `gunplay.ts` (`akimboCone`, `akimboKick`, `akimboLoader`,
`akimboRaise`, `akimboMove`).

- **On or off.** A match makes pairs only when dual wielding is in play (`akimboReady()` in `rules.ts`: the
  constant `AKIMBO_READY`, true since step 4; tests turn it on with `setAkimboReady`; a match can be told either way with
  `MatchOptions.akimbo`) and its rule allows (`MatchRules.akimbo`). Off, nothing below exists: a second gun is
  ammunition, the second trigger and the fire-mode key do what they did, and no new field is sent.
- **`?akimbo=1`** turns it on for this browser's own matches (Play offline, MapMaker Test, the host's page of Host
  game), where test mode is honoured: a dev server, a test-hooks build, or a page served from this machine
  (`testMode.ts` `allowedHere`). Since step 4 it is on in every match whose rule allows it, so the switch is no longer
  needed to try it.
- **Making a pair.** A person (never a bot) who walks over a pickup of an eligible gun they hold, or takes a drop of
  one, holds a pair. A pickup's second gun has a full magazine and the pickup still gives its ammunition (a pair is
  made even with a full reserve); a drop's second gun has the drop's magazine, its reserve tops yours up and the
  drop is gone. A third gun is ammunition. A loadout never grants a pair. **The Pistol's pickup** (`core.weapon_pistol`, owner, 2026-11-20) lies only where
  a map maker places one in MapMaker (Weapons group): random pickups, the host's mix-up and weapon sets never roll it
  (`rolls: false` in content/pickups.json), so no seeded match rolls differently (placed, it is mixed up like any weapon pickup unless kept
  fixed). Walking over it with the Pistol
  everyone starts with makes the Pistol pair; while dual wielding is off it is the Pistol's ammunition, as any
  same-gun pickup. The Pistol still never drops from a body that started with it.
- **State.** `WeaponState.off` is the second gun: its magazine (and `unchambered`, and `away` when put away) over
  the weapon's one reserve. The second gun has its own cooldown, semi-automatic latch and reload on the player
  (`fireCooldown2`, `semiLatch2`, `reload2`, `reloadTicks2`). **One `GunState` for both**: every round of either gun
  kicks the one aim and grows the one spray, so firing both doubles the climb and the bloom by itself.
- **Triggers.** `BUTTON_FIRE` is the gun you held, `BUTTON_ALT` the second gun, by the same rules (an empty pull
  starts that gun's reload; firing interrupts that gun's reload when a round is ready). Both can fire on one tick.
  The second trigger ends a sprint as the first does (the sprint-exit time on the raise timer). On a zipline one
  hand holds the trolley: the first gun only. The second gun comes out in the pair's raise (the weapon's × `raise`)
  when the pair is made or brought back, without holding up the first gun; switching to a pair takes that raise.
- **No aiming.** With the pair in hand the match drops the aim button: no sights, no aimed walk, no `zm`.
- **One gun again.** The fire-mode key sends `PlayerInput.fireMode` 1 (one gun; the second is put away with its
  magazine) or 0 (the pair); it beats a reload, like a swap. With one gun everything is today's weapon, sights
  included.
- **Reloads.** R asks for both; one hand reloads at a time (`pairReloadTurn`): the one under way goes on, the other
  waits at its start, and of two waiting the emptier gun goes first (the gun you held on a tie). Each is the gun's
  ordinary reload at the pair's pace (`akimboLoader`: every time × `reload`, the stages at the same shares; the
  Sawed-Off shell by shell). A gun that waits or isn't reloading fires, which gives up its turn. Auto-reload is per
  gun. A swap, a sprint, a use or a quick melee stops both.
- **The trade.** Aim cone × `cone` and pellet pattern × `pattern` for every round of a pair; every kick × `kick`
  (the settling is the gun's own); reloads × `reload`; the raise × `raise`; `move` added to the running speed.
- **Switch, drop, death.** Switching away keeps the pair. A death drop is one gun with the first gun's magazine and
  the reserve; a new life has no pair. There is no manual drop in the game.
- **Controls.** While a pair is in hand the client sends the aim button (right mouse, X, a controller's LT, touch's
  Aim) as `BUTTON_ALT`, always held (Aim: Toggle does not latch a trigger), a click of it between two ticks still
  goes out, and touch's Fire pulls both. The trigger latch keeps a pull of either trigger made while the pair comes
  up. The fire-mode key (U) shows "Pair" or "One gun".
- **HUD.** Two magazine counts, "L | R" (the second gun left, the gun you held right), over the one reserve; a gun
  that is reloading shows ↻ in its place; each count turns red when low by itself.
- **Prediction.** The second gun's shots, cooldown, latch and reloads are predicted with the first's. A pair's
  rounds fired in inputs the host has not acknowledged come off the host's magazines on each snapshot, so neither
  count runs back up under latency.
- **The wire.** docs/MULTIPLAYER_PROTOCOL.md section 24: public `dw`, private `ow`, `rl2`, `rd2`, `shot.off`.

**Time to kill, one gun against a pair** (`packages/shared/test/akimbo.test.ts` prints it: a standing target, aimed
at the chest, both triggers pulled whenever their gun is ready, recoil fully pulled back; seconds, 12 runs; in
brackets the share that killed inside 6 s):

| Gun | 5 m one | 5 m pair | 15 m one | 15 m pair | 30 m one | 30 m pair |
|---|---|---|---|---|---|---|
| Pistol | 0.73 | 0.37 | 0.75 | 0.35 | 0.97 | 0.34 |
| Pulse Pistol | 0.67 | 0.33 | 0.67 | 0.29 | 1.00 | 0.49 |
| Machine Pistol | 0.71 | 0.38 | 4.41 (75 %) | none | none | none |
| Sawed-Off | 0.00 | 0.00 | 4.19 (92 %) | 5.73 (67 %) | none | none |

Read with care: both triggers on the same tick put the second round one kick above the first, which at 15 and 30 m
lifts it from the chest to the head, so the semi-automatic pairs look better at range than they are in a hand that
has to aim; the Machine Pistol pair's wider cone and doubled spray take away what little range it had (and with no
recoil control it is slower than one gun even at 5 m: 0.97 against 0.69 s). Up close a pair of pistols is two guns'
worth. Tuning is step 5.

### As built: the pair in first person (step 3, 2026-11-20)

The client only (`game/view.ts`, the numbers and small decisions in `game/pairView.ts`, tested in
`packages/client/test/pairView.test.ts`); nothing in the match, prediction or the wire changed. With no pair in hand
the view does exactly what it did (the second gun's nodes are not even made until the first pair).

- **A mirror, not a second rig.** The second gun hangs under a node on the camera whose X is flipped (`pairRoot`):
  a second copy of the gun's model (the sharper held copy when the first has one), drawn mirrored, so it is the
  first gun's place, kick and reload seen in a mirror. Its arm is your look's first-person arms a second time under
  the same mirror: the character's right arm becomes a left one and holds the gun by the ordinary grip code
  (`CharacterAnimator.gripExternal`, now with `solo`: the shooting hand alone, the support point dropped). No
  per-gun hand numbers. The first gun's own left hand lets go while the second gun is up. **Markings on the left
  gun read mirrored** (so does an ejection port: it faces left, which is where its cases go).
- **Where they sit.** `PAIR_POSE`: each gun a little wider and higher than the one gun's hip place
  (`view.viewOffset`), the left the mirror of the right, so the crosshair and the middle of the screen stay clear and
  the hands on the grips stay above the HUD's corner panels.
- **Each gun by itself.** Its own kick (`kickAmount2`), its own muzzle flash (a second `MuzzleFlashRig`), its own
  spent case (thrown outward: left from the left gun), its own muzzle for tracers and beams
  (`view.localMuzzle(off)`: the session passes `shot.off`; a Pulse Pistol pair's steady beams under Reduce flashing
  are one per gun). The camera's recoil is the one aim's, as in the match.
- **Reloads.** One hand: the gun whose turn it is (`local.pairReloading()`) dips out of view, tipped and rolled
  outward, and comes back (`pairReloadDip`, in and out over ten ticks: the reload itself is the match's). The
  other gun stays up and fires. No magazine hand.
- **Raise and lower.** The second gun comes up from below over the pair's raise (the weapon's raise × the trade's
  `raise`, `stepPairUp`) once its model is in, while the first slides out to the pair's place; a switch to a pair
  brings both up with the weapon's own raise. The fire-mode key (one gun) puts it away in 0.18 s and both hands
  come back onto the first gun; switching to another weapon, a throwable in hand, a seat, death: gone with the gun.
- **Walk, sprint, strikes.** The walk's sideways sway moves both guns the same way on screen (the body's), the
  lift comes half a step apart (the hands in turn); a punch or a kick dips both, each to its own side. There is no
  separate sprint or landing pose for one gun today, so none for a pair.
- **Sound.** No new files: the gun's fire sound and the reload cues, panned by a stereo panner
  (`PlayOptions.pan`, `gunPan`): the second gun 0.35 left, the first 0.35 right while a pair is in hand; one gun
  stays in the middle.
- **Reduce flashing** (docs/LOOK.md): with the setting on a pair shares one flash (`PairFlashGate`): a round's
  flash is drawn only when no flash of either gun was drawn within the gun's own firing interval, so two guns are
  never brighter than one (never two flashes at once, each at `SAFE_MUZZLE`) and never flicker faster than one
  gun's rounds come; both triggers on one tick take turns. The round whose flash is left out still kicks, sounds
  and throws its case. Off, every round of both guns flashes. Its moment in the flicker check: `pair` (e2e
  `flashing`).
- **Full body first person.** Your own character still holds the first gun (its left arm hangs at its side, as with
  a one-handed weapon); the left gun's arm is the mirrored one from the arms-only view.
- **Third person and everyone else:** step 4, below.

### As built: the pair in third person (step 4, 2026-11-20)

The client only (`game/characterAnimator.ts` `holdPair`, `pairPose`, `placePair`; `game/view.ts` `setAvatarPair`,
`remoteFlash`; the numbers in `game/pairView.ts`, tested in `pairView.test.ts`); the wire is step 2's (`dw`,
`shot.off`).

- **Who.** A character whose snapshot says `dw` (another player, or a bot a test pairs), and your own character in
  third person while a pair is in hand (from prediction), holding the first gun already; a capsule stand-in or a
  creature draws one gun. An older host sends no `dw`: one gun, as before.
- **Two real guns, not a mirror.** The second gun is a second copy of the same model in the left hand (in a crowd a
  GPU instance like the first), not mirrored as first person's is: a pair of guns in someone's hands reads as two of
  the same gun, so both throw their cases to the right.
- **The hold.** Each gun in one hand out in front at the aim, at a little under arm's length (`PAIR_HOLD_3P`, shares
  of the arm's reach from each shoulder: 0.86 ahead, 0.2 down, 0.06 in), level with the aim and turned with it
  (pitch and the third-person aim's turn). Both arms are solved onto their grips and the hands closed on them by
  first person's one-gun-a-hand hold (`gripOne`: the hand turned onto the grip, a pistol's knuckles down its raked
  grip, the fingers round it, the thumb along the frame), the left hand worked out in a mirror. Same for every
  family: the Machine Pistol and the Sawed-Off are held by their pistol grip and wrist, stocks free in front.
- **Up, down, reload.** The second gun comes up over 0.3 s once its model is in (others' raise is theirs: the snapshot
  says only that the pair is out) and goes down as fast as first person's when the pair ends, then is gone; a switch
  takes it at once with the first. Your own reload in third person dips the gun whose turn it is (drawn back, lower,
  tipped up and rolled out: `pairHold3p`); others' reloads aren't sent, so theirs aren't drawn (as for one gun).
- **While an action has the hands** (a punch, a throw, a flinch) each gun rides in its hand, as one gun does.
- **Far off.** The same hold at every distance (the near and the low-detail meshes share the skeleton); the coarse
  animation detail's cached arms are not used for a pair (a pair's grip is worked out each evaluation), and both guns
  are drawn between evaluations with the skin (`blendGun`).
- **Flashes, tracers, cases.** Each gun has its own muzzle (`muzzleOf(slot, off)`): a round's tracer, a beam and its
  flash leave the gun that fired it (`shot.off`); a Pulse Pistol pair's steady beams under Reduce flashing are one
  per gun. Your own cases in third person leave the drawn gun that fired (before, they left the hidden first-person
  gun, near the camera). Others' guns throw no cases, as with one gun.
- **Reduce flashing** (docs/LOOK.md): one shared flash per character (`PairFlashGate`), as your own first-person
  pair: never two at once, never more often than one gun's rounds. Others' rounds come a snapshot at a time, so
  both guns' rounds in one message are `together` (`bothGunsFired`) and the flash takes turns between the hands.
  Your own pair asks the gate once a round for first and third person alike. Its moment: `pairtp` (e2e `flashing`).
- **Over the network.** e2e `hostgame` gives the host a pair of machine pistols 3 m in front of the friend (who
  plays over the host's compressed stream) and holds both triggers: the friend sees the second gun up, a flash at
  each gun's own muzzle, the two muzzles apart with the first gun on the host's right, and the second gun gone when
  it is put away.
- **Not done.** Others' reload, raise timing and putting away are not on the wire (step 2 sent only `dw`): their
  reload is not drawn (as for one gun: no one's reload is sent); no third-person sprint pose for a pair (none for one
  gun either).

## Underbarrel Attachments

Architecture should permit alternate projectile emitters.

## Mounted / Vehicle Weapons

Reuse the same projectile, damage, material, feedback, and ammunition systems rather than creating a separate combat stack.

### Implementation note: tanks (2026-11-07)

The Tank's cannon is an ordinary mounted projectile weapon (`core.tank_cannon`, unchanged: 60 on impact, 150 splash
over 6 m) with limited ammunition from the vehicle's data (content/vehicles/tank.json, seat `ammo`: 10 shells, one back
every 15 s, all at an ammo pickup), so a power weapon is balanced by its ammunition (§32). Vehicles name their armour
in data (`armour`): the Tank's hull is the `armor` surface type (the Armor Plate class, §8: rounds stop and may
ricochet, nothing penetrates), takes 0.1 of bullet damage, 1.25 of blasts and none from melee: rockets, grenades and
shells wear it down (about 6 rockets, 5 shells), small arms barely mark it. Its crew is sealed in: no round, blast or
blade from outside reaches them; they die with the tank. Readability (§2.4): a hit on the hull sparks like armour.
Numbers and how to change them: docs/CONTENT_PIPELINE.md, "Tanks and armour".

The turret (owner, 2026-11-11). With a gunner in the cannon seat the turret turns the full circle, at a traverse rate
from the vehicle's data (`turret.traverse`, 1.2 rad/s: a half turn in 2.6 s, faster than the hull pivots, slow enough
to get round behind on foot); the match turns it (`aimYaw`), so every screen draws the same turret. The cannon holds
its shot until the barrel is within 3 degrees of the gunner's aim and fires as it arrives (trigger held): a shell
always goes where its gunner is looking (responsiveness over simulation: no shot off the crosshair), and the
traverse is the cost of a target behind. A driver alone working the cannon keeps 0.6 rad either side of the hull
(`driverArc` on the seat): a crew of one can fight ahead, a crew of two covers every direction. The roof gun is
unchanged.

Balance pass (owner, 2026-11-08: no tank was destroyed in 36 bot-minutes). Rockets hurt vehicles more: a weapon's
`vehicleDamage` (data, content/weapons) multiplies what it does to vehicles only, never to players; the five rocket
weapons (Rocket Launcher, Guided Rocket, Swarm Launcher, Blast Rockets, Mounted Rockets) are 2, so a Rocket Launcher
hit on a tank's side is 400 of its 1200 (3 kill it, 4 at an angle; 6 before), its armour (blasts 1.25) unchanged. A
heavy launcher is the tank's counter (§32: power weapons balanced by placement, ammunition and their counters): bots
without one fetch one when a tank is about, draw one they carry and aim it at the hull. The cannon refills only from
the general Ammo Box (seat `ammo.pickups`; since 2026-11-13 a solid crate, so the tank refills pulled up beside it, a
use of its ten: sim/resupply.ts), and the driver keeps firing it while its seat is empty (owner kept it).

---

# 49. Things We Explicitly Do Not Want

Avoid:

- Random weapon jams in standard modes.
- Long uninterruptible reload animations.
- Long uninterruptible weapon-inspection animations.
- Excessive camera shake.
- Extreme muzzle flash obscuring targets.
- Random recoil so large that mastery becomes impossible.
- Huge invisible accuracy penalties.
- Bullets coming from the center of the screen while visibly contradicting weapon orientation at close range.
- Bots ignoring ballistics.
- Network latency masquerading as projectile skill.
- Identical reload timing across the arsenal.
- Every gun tuned toward the same TTK and effective range.
- Every automatic gun becoming accurate only through arbitrary bloom.
- Excessive aim magnetism.
- Kill UI covering combat.
- Environment effects that make competitive outcomes unreadable.

---

# 50. Implementation Priority

## Phase G0 — Feel Prototype

Build one test room and:

- Pistol.
- Heavy revolver.
- SMG.
- Rifle.

Prove:

- Immediate firing.
- Projectile travel.
- Gravity.
- Leading.
- Recoil/recovery.
- Reload interruption.
- Hit feedback.
- Kill confirmation.

Do **not** build a giant arsenal before these four feel excellent.

## Phase G1 — Material Ballistics

Add:

- Glass.
- Wood.
- Concrete.
- Metal.
- Penetration.
- Ricochet rules.
- Destructible props.

## Phase G2 — Archetype Expansion

Add:

- Shotgun.
- Precision rifle.
- LMG.
- Rocket launcher.
- Burst rifle.
- Lever action.

## Phase G3 — Network Validation

Test:

- 8 players.
- Latency simulation.
- Packet loss.
- Projectile reconciliation.
- Server authority.
- Kill validation.

Then scale toward 16/24/32.

## Phase G4 — AI

Teach bots:

- Weapon selection.
- Leading.
- Recoil control.
- Burst discipline.
- Reload decisions.
- Effective range.

## Phase G5 — Creator Controls

Expose safe combat-rule controls to MapMaker.

**As built (2026-11-28, `packages/shared/src/sim/combatRules.ts`, map format v56).** Six match-wide knobs, never per
weapon, so every gun keeps its identity: **headshots** off (a head hit counts as the body, multiple 1; no headshot mark
in the killfeed), normal (each weapon's `head`), high (its head bonus doubled: 1 + (head − 1) × 2); **ammo** normal,
unlimited (the held gun's reserve stays full) or scarce (half, rounded up, of the spawn reserve and every weapon or
ammo pickup; drops keep what they hold); **reloads** off (the magazine feeds straight from the reserve before and after
every shot, a round chambered, nothing reloads; a melee weapon's barrel still loads); **bullets through walls** off
(§8 penetration skipped; glass still breaks and still costs a little); **damage scale** (everything a player, bot or NPC
deals to a combatant; falls and hazards untouched) and **health scale** (players' and bots' effective health, as
Lethality's: damage they take is divided by it, so the HUD and heals keep their meaning), each 0.5×, 1×, 1.5× or 2×.
A map saves its defaults (`combatRules`, MapMaker's Map properties → Combat rules); the host's Match Setup → Rules
change each (MatchRules, the same keys; kept on map travel); unset plays the map's, else the standard
(`combatRulesOf`). The host's sim reads them once per match (`Match.combat`); the client resolves the same for
prediction (feeding, no reload) and the Practice Target's gun report (its damage comes from the host with the rules in
it; hits to down at the health scale). Bots need nothing of their own: a fed magazine and a full reserve never send
them to reload or to an ammo box. Not yet: rows in the dedicated server's rules list (serverRules.ts).

## Phase G6 — Exotic Arsenal

Only after the conventional gunplay foundation is excellent should production expand aggressively into strange weapons/ammunition.

---

# 51. Initial Benchmark Weapons

Use these as **design poles**, not final balance values.

## Benchmark A — Service Pistol

Purpose: baseline responsiveness.

- Immediate handling.
- Moderate damage.
- Moderate velocity.
- Low recoil.
- Strong first-shot accuracy.
- Fast reload.

If this gun does not feel good, the combat foundation is not ready.

## Benchmark B — Heavy Revolver

Purpose: prove impact and extreme identity.

- Very high per-shot damage.
- Slow cadence.
- Severe recoil.
- Excellent settled accuracy.
- Small capacity.
- Distinct reload rhythm.
- Strong material reaction.

## Benchmark C — SMG

Purpose: prove sustained-fire behavior.

- Very high rate of fire.
- Weak rounds.
- Low initial recoil.
- Rapid spread growth.
- Very fast recovery.
- Excellent mobility.

## Benchmark D — Battle/Assault Rifle

Purpose: prove long-range ballistics.

- High velocity.
- Visible long-range travel/drop.
- Predictable recoil climb.
- Strong medium-range role.

These four weapons should feel **radically different before adding more guns**.

---

# 52. Final Quality Bar

The desired player reaction is not:

> “The weapon stats seem balanced.”

It is:

> “I love shooting this thing.”

A player should be able to develop favorites because of **rhythm, sound, recoil, projectile behavior, reload cadence, handling, visual response, and mastery**, not simply because one weapon has the best DPS.

The system should support an absurd arsenal while retaining one coherent physical language:

> bullets travel, gravity exists, materials matter, recoil can be learned, animation obeys the player, and every trigger pull communicates clearly.

That is the foundation of the project's gunplay.
