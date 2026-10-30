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
