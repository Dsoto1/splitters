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

_(The owner's text was cut off at "Do not create"; the rest of this rule is pending.)_
