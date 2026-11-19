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
| Iron sights (`irons`) | none: the front sight is the aim | Pistol, Heavy Revolver, Hand Cannon, Pulse Pistol, Machine Pistol, SMG, Nailgun, Shotgun, Auto Shotgun, Freeze Ray, Goo Gun, Assault Rifle, Burst Rifle | 1.52× |
| Red dot (`reddot`) | a dot on its glass | Laser Rifle, Bubble Blaster, Sawed-Off | 1.52× |
| Holographic (`holo`) | a ring with four ticks and a dot, on its glass | Arc Caster, Flak Cannon, Disc Launcher, Arena Disc, Plasma Rifle (its model's own sight box) | 1.52× |
| 2-3× optic (`scope`) | a chevron with holdover ticks | Battle Rifle (3.5×, the model's tube), Marksman Rifle (2.19×, the scope overlay) | as before |
| Sniper scope (`sniper`) | a fine crosshair with holdover marks | Sniper Rifle (3.95×, 8.9× on the wheel), Railgun (3.13×) | as before |
| none | the HUD's aim dot, as before | the Rocket Launcher, Guided Rocket, Blast Rockets, Grenade Launcher, Swarm Launcher, Oil Slicker, Flamethrower, Spin Gun, Singularity Cannon, Flare Gun, Gilded Pistol, Spear | 1.52× |

- **The table** is `content/optics.json`: `kinds` (reticle, housing, aimed field of view: `adsFov` for 1× sights, a
  `mag` range for magnified ones, the glass's size and the mark's) and `weapons` (`default` and `allowed`: the loadout's
  choice comes later; today every gun shows its default), `none` with reasons. `tools/content/optics.mjs` (run by
  `pnpm content:rebuild`, checked by `pnpm content:check`) checks it and writes
  `packages/shared/src/content/optics.generated.ts`, loaded with the match's view, not the menu. A zoom stays in the
  weapon file (`view.zoomFov`, `view.optic.mag`); the tool only checks it lies inside its kind's range.
- **Housings** for the red dot (a tube) and the holographic sight (a hooded frame) are built in code
  (`game/opticHousing.ts`: a few boxes and a tube in one mesh, no outside models) and stand on the gun's top at the
  **mount** the tool measures from the model: the rearmost flat stretch of the top from the hand forward that the rest of
  the gun does not stand in front of, sized to the gun's length (0.85-1.2); a `mount` or, for a model with an open sight
  of its own (the Plasma Rifle), a `window` can be set by hand with its reason. They are on your own gun, in third person
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
  drawn larger about the view axis as it comes up (`optics.ts` `pictureScale`: its window's half-height brought to 0.2
  of the screen's, at most 3×), the frame the Battle Rifle's optic uses: only x and y scale, every depth stays, nothing
  nears the near plane. Long guns' iron sights get it gently (`ironsPicture`: the rear sight as large as at 0.36 m, at
  most 1.6×: the Assault Rifle, SMG and shotguns 1.6×, the Burst Rifle 1.26×; handguns unchanged). Points on the axis
  stay on it, so the sights stay on the aim. The gun's bob and kick are drawn that much smaller, so they move the
  picture as far as before; the hands keep their own size.
- **The audit**: the sight sheet shows every weapon that aims with its optic (scopes with their own view and marks) and
  `__sights.audit()` adds the reticle's distance from the aim: a glass's mark found on the drawn frame (the pixels it
  changes when switched off), a HUD reticle's origin as laid out. All measured 0.00° (glass marks at most 0.01°).
  `packages/client/test/optics.test.ts` names every gun's optic and zoom and holds the rest (a weapon without an entry
  fails with what to do); `tools/content/test/optics.test.mjs` covers the tool.

**Adding a gun or changing its optic.** Give it an entry in `content/optics.json` (`weapons`, or `none` with a reason),
run `node tools/content/optics.mjs` (`--report` prints the table and mounts), look at it on the sight sheet, then name
it in `optics.test.ts`. A new kind: add it to `kinds`; a new housing shape or mark needs its builder or shader branch
in `opticHousing.ts`.

**What part 3 needs** (scope feel):

- **Scope feel exists in part**: sway with a Shift breath-hold on its own meter (session.ts `updateScopeSway`,
  `hud.setBreath`: 3.5 s to hold, not yet on stamina), a second zoom on the wheel (`zoomLevel`, ×0.45), a 0.16 s
  `scope-in` fade. Missing: the edge darkening as it comes up, stamina, the glint (a new bright moment: it needs its
  moment in the `flashing` flow and a calm form under Reduce flashing).
- **The Marksman and Sniper scopes are still the full-screen overlay** with the gun hidden; their models carry scope
  tubes that the Battle Rifle's frame (`opticView.ts`) could look through instead.

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
**Aim** Hold / Toggle (a toggled aim lets go on a weapon change, death, a vehicle or leaving play; works with every
scope and the Battle Rifle's optic; touch's Aim button always toggles); **Camera shake** Off / Reduced (0.35) / Full
for the view's own movement: heavy-shot shake, the hit kick (§23), blasts and crashes (mechanical recoil stays: it is
where the rounds go, §29; Reduce flashing keeps its calmer kick on top); **Controller vibration** on/off and strength
(10-100 %, 70 % by default) through the Gamepad API's `vibrationActuator` for firing (a buzz a round for automatics, a
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

Worth supporting architecturally even if not initial-slice functionality.

Dual weapons may:

- Fire independently.
- Reload independently.
- Trade ADS precision for volume.

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
