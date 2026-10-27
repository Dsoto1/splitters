# Gunplay direction (owner's addendum)

`docs/GUNPLAY_SPEC.md` (the owner's `GUNPLAY_BALLISTICS_WEAPON_FEEL.md`) stays the authoritative
technical design for weapons, ballistics, recoil, damage, animation priority, TTK, ammunition,
environmental interaction and related systems. This addendum sets the experience those systems
are tuned for. Read both before changing any weapon or its feel.

## Experiential target

The primary experiential reference is the fast, responsive, playful gunplay of TimeSplitters and
classic arena shooters.

We are **not** reproducing TimeSplitters' weapon statistics, recoil, animations, sounds, assets,
code or individual weapon implementations. We **are** capturing what made that combat fun:

- Immediate trigger response
- Fast and responsive player control
- Strong hip-fire viability
- Shooting while moving
- Useful strafing
- Fast weapon switching
- Minimal animation lockout
- Clear weapon identities
- Exaggerated differences between weapons
- Strong pickups worth fighting over
- Readable combat despite chaos
- Satisfying hit and kill feedback
- Easy to understand, difficult to master
- Maps where movement and weapon placement matter
- Weapons that feel like fun gameplay tools rather than realistic simulations

## Our evolution of that formula

Not a recreation of an old arena shooter. Our combat adds:

- Physical bullet velocity
- Long-range target leading
- Bullet drop
- Material penetration
- Ricochets where appropriate
- Different ammunition/environment interactions
- Predictable recoil patterns and recovery
- Modern latency compensation
- Modern input responsiveness
- Subtle controller aim assistance
- Improved animation interruption
- Stronger hit/kill feedback
- Large-scale combat involving players, bots, NPCs and vehicles

**Classic arcade FPS responsiveness + physical ballistic depth + modern polish.**

## Priority rules

When implementation decisions conflict:

1. Responsiveness > realism
2. Player control > animation
3. Readability > visual spectacle
4. Weapon personality > statistical balance
5. Fun > simulation

Animation should never unnecessarily prevent a vital action. A player should spend their time
moving, aiming, shooting, dodging, switching weapons, chasing pickups and reading the
battlefield, not waiting for animations.

## Weapon personality rule

Do not create a large collection of statistically similar firearms. Every weapon should answer
"Why would I want to pick this up?" within seconds of using it. Push differences aggressively.

- A **heavy revolver** should feel almost absurdly powerful for a handgun, but punish misses
  through recoil, capacity and firing rhythm.
- An **SMG** should initially feel extremely controllable, then become increasingly inaccurate
  during sustained fire.
- A **shotgun** should make the player want to close distance.
- A **precision rifle** should reward patience, prediction and long-range ballistic skill.
- A **rocket launcher** should reward predicting where an opponent *will* be rather than simply
  aiming at where they are.

If two weapons feel too similar: make them more different.

## Arena philosophy

Weapons, ammunition, health, armor and powerups placed in maps are part of the strategy. Not every
weapon must be equally powerful. Power can instead be balanced through:

- Pickup location
- Respawn timing
- Ammo availability
- Range
- Handling difficulty
- Projectile speed
- Reload rhythm
- Self-damage
- Risk required to obtain it

Players should gradually learn maps through their resource locations and movement routes.

## Do not accidentally make

Do not let the project drift into:

- Modern military-simulator gunplay
- Mandatory ADS
- Excessive weapon sway
- Severe movement penalties
- Excessive inertia
- Long uninterruptible reloads
- Long equip animations
- Slow sprint-to-fire behaviour
- Suppression blur
- Excessive flinch
- Generic weapons differentiated by tiny percentage changes

Also do not assume "classic arena shooter" means copying Quake movement, extreme bunny hopping,
universal instant-hit weapons, rocket jumping or enormous health pools. This game should develop
its own identity.

## Implementation strategy

Before expanding the weapon roster, create and polish these benchmark weapons:

1. Service Pistol
2. Heavy Revolver
3. SMG
4. Assault Rifle
5. Shotgun
6. Precision Rifle
7. Rocket Launcher

They deliberately occupy different parts of the combat spectrum. Do not prioritise weapon quantity
until these weapons show that the underlying combat system is excellent.

## Gunplay test arena

A permanent internal test map for combat tuning, with:

- Stationary targets; walking and sprinting lateral targets; approaching/receding targets;
  elevated targets
- Distance markers at 5, 10, 25, 50, 100 and 200 m
- A recoil-testing wall
- Penetration-testing walls: wood, glass, metal, concrete, dirt, water
- Destructible objects
- Moving bots
- A close-range duel room, a medium-range combat lane and a long-range ballistic lane

Use it to tune weapons systematically. The gunplay foundation is successful when the seven
benchmark weapons are immediately distinguishable, responsive and enjoyable without needing a
stat screen to explain their differences.

## North star

On picking up the game a player should think: "This is fast, responsive and fun." After playing
longer they should discover: "There is actually a lot of skill here." That combination is the
target.
