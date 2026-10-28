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

## After this pass

What changed, by benchmark (all data in `sim/weapons.ts` and the family
defaults in `sim/gunplay.ts`; tests in `packages/shared/test/benchmarks.test.ts`):

- **Shotgun: makes you close in.** The pellet pattern is back: a
  multi-pellet weapon's cone is now the gunplay cone plus its own pellet
  `spread` (`shotCone`, used by the server and client prediction alike;
  fixes the Sawed-Off and Auto Shotgun too). Ten 12-damage pellets in a fixed
  75 mrad pattern: one shot kills out to about 5 m, a few pellets land at
  15 m, a scratch (under 35) at 20 m; falloff 6→22 m to 25 %. Pump a touch
  quicker (0.75 s), equip 0.27 s, both barrels 16 × 12.
- **Heavy Revolver: absurd and punishing.** 90 damage (a head shot kills at
  any range even after falloff; a body shot takes 90 % of a life), knockback
  4 m/s, penetration energy 1800 (through wood that stops a pistol). Five
  rounds, 90 rpm, first kick 120 mrad. Rhythm: a round fired the instant the
  hammer is back goes 22.5 mrad wide (a coin toss on a body at 25 m); wait
  about a second between shots and it is dead on again. Five-round reload
  round by round, 0.3 s + 0.3 s a round.
- **SMG: steady, then wild.** First five rounds at the 6 mrad base with
  3 mrad kicks (a quarter of the pistol's), then the climb builds to 11 mrad a
  round and the cone opens to 39 mrad by round 10 and 90 by round 20. Let go
  and even a 20-round spray is forgotten in half a second.
- **Precision Rifle: patience and holdover.** Still the fastest round (least
  lead: 1 m on a runner at 200 m) but heavy: 950 m/s with 2.5 × gravity, so
  2 cm of drop at 50 m, 12 cm at 100 m, 50 cm at 200 m. 80 damage (body
  shot plus any other hit kills; head ×3 kills). A scoped shot taken the
  moment the bolt closes is 3 mrad off (more than a head at 100 m); wait
  about 0.8 s and it is exact. The no-scope cone drops to 30 mrad: a hip shot
  across a room works, past that it is a guess.
- **Rocket Launcher: prediction.** Same slow 30 m/s rocket (lead a runner
  3.5 m at 20 m), 5 m blast, 40 direct + 120 splash (a direct hit kills),
  self-damage up to ×0.75. A rocket every 1.5 s with the trigger held (was
  2.4 s), equip 0.53 s (was 0.7).
- **Assault Rifle:** equip 0.33 s; otherwise the reference it was.
- **Service Pistol:** unchanged handling; less movement penalty.
- **Moving and shooting (everyone in a family):** full-speed movement adds
  pistol 6 (was 12), revolver 12 (20), SMG 4 (6), rifle 8 (16), sniper 30
  (40), shotgun 6 (10) mrad. Every sidearm, SMG and rifle shot fired on the
  run stays on a body at 25 m. Airborne cones for pistol (20) and rifle (35)
  eased a little too.
- **Water soaks up bullets** (G1 material work the arena needed): a bullet's
  path under water or swamp costs it energy (400 a metre), slowing it and
  weakening it; a metre stops a pistol round, a rifle round comes out at two
  thirds. Server only (client tracers stay cosmetic).

| | Pistol | Revolver | SMG | Rifle | Shotgun | Sniper | Rockets |
|---|---|---|---|---|---|---|---|
| Rate | 360 rpm | **90 rpm** | 900 rpm | 600 rpm | **80 rpm** | 48 rpm | **1 per 1.5 s** |
| Magazine | 12 | **5** | 32 | 30 | 6 | 5 | 1 |
| Damage | 24 | **90** | 11 | 18 | **10 × 12** | **80** | **40** + 120 |
| Body shots to kill | 5 | 2 | 10 | 6 | **1 up close** | 2 | 1 |
| Equip | 0.15 s | 0.27 s | 0.2 s | **0.33 s** | **0.27 s** | 0.5 s | **0.53 s** |
| Hip cone still / running | 2 / **8** | 0.5 / **12.5** | 6 / **10** | 1.5 / **9.5** | **75 pattern** / +6 | **30** / **60** | 0 |
| Spray cone round 10 / 20 | n/a | n/a | **39 / 90** | 10 / 22 | n/a | n/a | n/a |
| Second shot at full rate | 2 | **22.5** | n/a | n/a | n/a | **3 (ADS)** | n/a |
| First kick | 12 | **120** | **3** | 10 | 60 | 70 | none |
| Velocity | 375 | 300 | 400 | 820 | hitscan | **950** | 30 |
| Drop at 50 / 100 / 200 m | 6 / 30 / 129 cm | 10 / 46 / 201 | 5 / 26 / 113 | 1 / 6 / 27 | n/a | **2 / 12 / 50** | n/a |
| Falloff | 18→45 m to 65 % | 25→60 m to 70 % | 12→35 m to 55 % | 30→80 m to 75 % | **6→22 m to 25 %** | 150→300 m to 90 % | self ×**0.75** |

Unchanged and already within the doc: trigger latency (same input), sprint
to fire (0 ms), no aim flinch, no suppression blur, no movement inertia,
scope-only sway (3.5 mrad), every reload interruptible.

## Gunplay test arena

`maps/training_range.json`, built by
`maps/training_range.json` from kit tiles, library
materials, existing props, destructibles, movers and an encounter (nothing
new). Deathmatch, 1-8 players; the firing line is x 0, downrange is +x.

| Band (z) | What | Tests |
|---|---|---|
| +38 | Boards on concrete towers: 25 m (3 m up), 50 m (6 m), 100 m (10 m), 150 m (14 m) | elevated shots, drop on an incline |
| +31 | Boards driving toward you and away: 15 ↔ 75 m at running pace, 100 ↔ 180 m sprinting | approaching / receding targets, falloff as range changes |
| +22 | Boards sliding 8 m side to side at sprinting pace (7.8 m/s) at 25, 50, 100, 200 m | lead |
| +12 | The same at walking pace (3.9 m/s, aim-walk) at 25, 50, 100 m | lead |
| 0 | Long ballistic lane: static boards at 5, 10, 25, 50, 100, 200 m, a sign over each; hazard-striped floor markers at those distances run across the whole range | drop, travel, falloff, first-shot accuracy |
| -8 to -34 | Penetration walls at 15 m with a board behind each: glass (a breakable glass pane: the round goes through at 80 % and shatters it), drywall, planks, heavy wood (0.4 m), sheet metal, steel plate, brick, concrete, dirt (0.6 m packed sand), a 1 m water tank between breakable glass panes you can see the water through, and bulletproof glass (stops every round, cracks where each strikes). Shot-out glass is back after 4 s | material penetration |
| -38 | Concrete recoil wall (8 × 5 m) at 20 m; destructibles row (crate, barrel, window, boards, breakable wall, gas cylinder, generator) at 28-44 m | recoil patterns, environmental damage |
| -48 to -64 | Medium combat lane, walled, 0-70 m: sandbags, a concrete block, crates and barriers every 15 m; three range troopers (easy, their rounds do no damage) patrol it between 42 and 14 m, strafe, take cover and respawn | moving bots, medium-range fights |
| x -36 to -20 | Close duel room (Large Room kit tile, four columns, low cover) behind the firing line, with a shotgun and revolver inside | point-blank duels |

The seven benchmark guns (and the Marksman, Burst Rifle and Spin Gun for
comparison) lie at the firing line with typed ammo. Spawns are along the
firing line plus two at the far end, so lobby bots spread out as live
targets. The troopers only wake when someone is within 70 m (anywhere at the
south end of the firing line); killing them counts toward the score limit
like any kill.

### Out of scope (left for later passes)

- Per-weapon movement speed (spec §27 `movementModifier`, G2): everyone runs
  at the same pace whatever they carry, which suits arcade play for now.
- Auto-reload when a magazine runs dry: reloads still start on the next
  trigger pull (or R), as before; the rocket cycle was fixed by tuning.
- Client tracers do not know about water; the authoritative impact does.
- Weapons outside the seven (Hand Cannon, Marksman, LMG, launcher variants)
  only got the family changes (movement spread, shotgun pattern fix).
