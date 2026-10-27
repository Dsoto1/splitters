# Gunplay feel audit (against GUNPLAY_DIRECTION.md)

An audit of the arsenal against the owner's direction doc
([GUNPLAY_DIRECTION.md](GUNPLAY_DIRECTION.md)): its priority rules
(responsiveness > realism, player control > animation, readability >
spectacle, personality > balance, fun > simulation) and its "Do not
accidentally make" list. The technical design stays
[GUNPLAY_SPEC.md](GUNPLAY_SPEC.md); the system-by-system status is
[GUNPLAY_GAPS.md](GUNPLAY_GAPS.md). Done October 2026.

Numbers are at 60 ticks a second (1 tick = 16.7 ms); angles are cone
half-angles in milliradians (1 mrad = 1 cm at 10 m, 10 cm at 100 m). A body
is 0.8 m wide, a head about 0.3 m. Running is 5.2 m/s. All of it comes from
the weapon data (`sim/weapons.ts`) through the gunplay model
(`sim/gunplay.ts`), which the server, client prediction and bots share.

## The benchmark seven

The direction doc's benchmark weapons map onto existing definitions; no new
weapons were added.

| Benchmark | Weapon | Why this one |
|---|---|---|
| Service Pistol | `core.pistol` (Pistol) | spec §51 benchmark A already |
| Heavy Revolver | `core.revolver` (Heavy Revolver) | spec §51 benchmark B already; the Hand Cannon stays an exotic sidearm |
| SMG | `core.smg` (Submachine Gun) | benchmark C already; the Machine Pistol is the sidearm spray |
| Assault Rifle | `core.rifle` (Assault Rifle) | benchmark D already |
| Shotgun | `core.shotgun` (Shotgun) | the pump gun; Sawed-Off and Auto Shotgun are variants |
| Precision Rifle | `core.sniper` (Sniper Rifle) | the only `precision` family weapon; the Marksman and Railgun are other poles |
| Rocket Launcher | `core.rockets` (Rocket Launcher) | the plain rocket; Blast Rockets (class variant), Guided and Swarm are variants |

## Do-not-make checklist

| Direction doc risk | What the code does | Verdict |
|---|---|---|
| Trigger latency | A press fires in the same input it arrives in (no wind-up on the seven); the first 8 m of a bullet are a ray in that tick; client prediction draws muzzle, tracer and recoil at once. Worst case one input (≤ 17 ms). | OK |
| Sprint-to-fire delay | Holding fire ends a sprint in the same input, and nothing in the trigger checks sprint: **0 ms**. A sprinting player also breaks a reload (§16). | OK |
| Mandatory ADS | Every gun can fire from the hip during the sights' blend. Hip cones settled: pistol 2, revolver 0.5, SMG 6, rifle 1.5 mrad. The sniper adds a flat **50 mrad** no-scope cone (50 cm at 10 m): from the hip it was a lottery even across a room. | Sniper too ADS-bound |
| Severe movement penalties | Full-speed movement adds pistol 12, revolver 20, SMG 6, rifle 16, sniper 40, shotgun 10 mrad. The rifle on the move was a 44 cm cone at 25 m, about a coin toss on a body: strafing duels punished the arcade style the doc asks for. Aiming walks at 75 %; no per-weapon move speed. | Too severe (rifle, pistol, revolver) |
| Excessive inertia | Movement has no acceleration curve: wish velocity applies at once. | OK |
| Long equip animations | Knife 0.17 s, pistol 0.15, SMG 0.2, revolver 0.27, shotgun 0.33, rifle 0.37, sniper 0.5, grenade launcher 0.63, **rockets 0.7**, LMG 0.8 s. | Rockets slow (meant), but 0.7 s plus the reload below adds up |
| Long uninterruptible reloads | All reloads are staged and interruptible: fire with a round ready, swap, sprint, use. Shotguns and the revolver load round by round. Pistol 0.83/1.1 s, SMG 0.9/1.2, rifle 1.4/1.8, sniper 1.5/1.83, rockets 1.42 s. | OK, except the rocket cycle |
| Rocket cycle | One-round magazine, 60-tick cooldown after the shot and the reload only starts on the next trigger pull: **2.4 s between rockets**. | Too slow |
| Excessive sway | Only scoped weapons sway (client): a figure of eight of 3.5 mrad, steadied to 0.4 mrad by holding breath (3.5 s). No hip or ADS sway on iron sights. | OK |
| Excessive flinch | Being hit never moves your aim. The revolver and Hand Cannon push the victim's body (2.5-3 m/s), not their view. | OK |
| Suppression blur | None; near misses only make bots take cover. | OK |
| Generic weapons by tiny % changes | See below: the seven were apart on rate and damage, but the shotgun had lost its pattern, the SMG bloom was mild, the sniper barely dropped and the revolver punished nothing but recoil. | Needs exaggerating |

## Benchmark numbers before this pass

| | Pistol | Revolver | SMG | Rifle | Shotgun | Sniper | Rockets |
|---|---|---|---|---|---|---|---|
| Rate | 360 rpm semi | 106 rpm semi | 900 rpm | 600 rpm | 72 rpm | 48 rpm | 1 per 2.4 s |
| Magazine | 12 | 6 | 32 | 30 | 6 | 5 | 1 |
| Damage | 24 | 70 | 11 | 18 | 8 × 9 | 75 (head ×3) | 30 hit + 120 splash |
| Body shots to kill / time | 5 / 0.67 s | 2 / 0.57 s | 10 / 0.6 s | 6 / 0.5 s | 2 / 0.83 s | 2 / 1.25 s | 1 |
| Equip | 0.15 s | 0.27 s | 0.2 s | 0.37 s | 0.33 s | 0.5 s | 0.7 s |
| Reload (tactical / empty) | 0.83 / 1.1 s | 0.3 + 0.27 s a round | 0.9 / 1.2 s | 1.4 / 1.8 s | 0.23 + 0.3 s a shell | 1.5 / 1.83 s | 1.42 s |
| Hip cone still / running | 2 / 14 | 0.5 / 20.5 | 6 / 12 | 1.5 / 17.5 | **0 / 10** | 50 / 90 | 0 |
| Cone at round 10 / 20 of a spray | n/a | n/a | 33 / 60 | 10 / 22 | n/a | n/a | n/a |
| Second shot at full rate | 2 | 12.5 | n/a | n/a | n/a | 0 (ADS) | n/a |
| First kick | 12 | 100 | 4 | 10 | 60 | 70 | none |
| Velocity | 375 m/s | 300 | 400 | 820 | hitscan | 1000 | 30 |
| Drop at 50 / 100 / 200 m | 6 / 30 / 129 cm | 10 / 46 / 201 | 5 / 26 / 113 | 1 / 6 / 27 | n/a | **1 / 4 / 18** | n/a |
| Runner lead at 50 / 100 / 200 m | 0.6 / 1.3 / 2.7 m | 0.7 / 1.6 / 3.3 | 0.6 / 1.2 / 2.5 | 0.3 / 0.6 / 1.2 | n/a | 0.2 / 0.5 / 1.0 | 1.7 m at 10 m, 4.3 at 25 |
| Falloff | 18→45 m to 65 % | 25→60 m to 70 % | 12→35 m to 55 % | 30→80 m to 75 % | 8→25 m to 30 % | 150→300 m to 90 % | splash 5 m, 120→20, self ×0.6 |

## Findings

1. **The shotgun had no pattern (bug).** Its family accuracy has a base
   cone of 0 and the gunplay spread replaced the weapon's own pellet spread
   (`spread: 0.085`), so all eight pellets of a standing shot flew down one
   line: a 72-damage slug out to 45 m (21 damage past 25 m by falloff). Client
   prediction drew it the same way. The Sawed-Off and Auto Shotgun had the
   same fault. The shotgun never made you close in.
2. **Moving and shooting cost too much** for the rifle (16 mrad), revolver
   (20) and pistol (12); the sniper's 40 is its liability but stacks with
   the no-scope cone.
3. **The sniper's no-scope cone (50 mrad) made ADS mandatory** even at
   point-blank range.
4. **The precision rifle barely dropped** (18 cm at 200 m): nothing to learn
   in a 200 m lane; leading was the rifle's job too.
5. **The revolver punished only by recoil.** Its second shot at full rate
   was barely less accurate (12.5 mrad) and six rounds forgave misses.
6. **The SMG bloomed only mildly** (round 10: 33 mrad) and its climb was
   flat after round 5.
7. **The rocket launcher was slow to bring back** (2.4 s a rocket, 0.7 s
   equip), though its 30 m/s rocket rightly asks you to predict.
8. Equip times, reload interrupts, sprint-to-fire, flinch, sway, inertia and
   suppression are all within the direction doc already.
