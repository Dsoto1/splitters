# Driving physics: vehicles as real bodies (plan and step 1)

Owner, 2026-11-15: "buggys should feel bouncy and light, touchy/sensitive/easy to flip. it should feel rewarding
hitting a jump and coming down with the pull of gravity and inertia/momentum. same for when we ride up steep edges.
the vehicle should form to the terrain better and not flatly drive up, and the wheel grip should not be like
spiderman, let friction fail and they can slide back down naturally." And it must stay smooth in multiplayer.

QUEUE item "Driving physics". This file is the plan for every step, and what step 1 built (the Troop Buggy alone).

## Where we started

- **The chassis was a character controller.** `Match.driveVehicle` moved a probe capsule with Rapier's character
  controller (`PhysicsWorld.moveVehicle`): it climbs any slope up to the players' 50°, steps 0.3 m, snaps to the
  ground, never pitches or rolls, and grips perfectly (the "spiderman" grip). Speed and slide were two numbers along
  the heading; ramps launched it only because the climb's vertical speed was kept.
- **The sprung body was drawn only.** `sim/suspension.ts` cast a ray per wheel and ran springs on a separate body that
  everyone saw (snapshot `ms`), but it never pushed the chassis: a buggy on two wheels was still a level box.
- **Riding wasn't predicted.** The driver's inputs went to the host and the vehicle came back in snapshots, so at
  150 ms the wheel answered 150 ms late (plus the snapshot interval), and the drawn vehicle sat about a metre behind
  the host's at speed (measured below).

## The model (built in step 1: `packages/shared/src/sim/wheelPhysics.ts`)

A rigid body: position, velocity, orientation (a quaternion) and spin, unit mass, the box's inertia (times
`inertia`), its centre of mass `com` metres over its feet. A tick is two substeps over rays cast once.

- **Sprung raycast wheels.** Per wheel a ray along the chassis' own down from above its hub finds the ground and its
  normal. A preloaded spring (`freq`, `damping` from the vehicle's `suspension`; rest is the drawn ride height) and a
  damper push along the chassis' up at the hub, off the centre of mass, so it pitches, rolls, squats, dives and can
  roll over for real. Past the bump stop the wheel becomes a hard contact (below), so a landing thumps instead of
  storing energy and throwing the buggy back up. Ground facing less than 0.35 along the chassis' up (a wall, the
  vehicle on its side) is the hull's business, not a wheel's.
- **Tyres with a friction limit.** At each contact patch, along the ground: drive toward the target speed (with a
  low-speed `launch` boost), brakes, engine braking, the handbrake locking the rear pair; across it: a force killing
  the sideways slip (`corner`, front and rear; the rear looser with speed: `drift`). The total is capped at `grip`
  times that wheel's load; past it the tyre slides, and its force falls toward `slide` of the limit as the slip grows.
  So: a slope steeper than the grip can hold (about 46° at 1.05) slides back down under full throttle, a hard turn
  flat out drifts, a light wheel (over a crest, two on a kerb) has little grip, and the handbrake slides the tail out.
- **Steering.** The front pair to `lock` (less with speed), the rear pair a share the other way at low speed
  (`rearSteer`, gone by top speed), so it turns tight in close quarters and stays steady flat out. Look-to-steer works
  as before (`lookSteer` in mounts.ts, shared by the host and the prediction).
- **The hull.** Its eight corners (the underside at the model's ride height) are contact points when it leans, flies
  or touched last tick: hard contacts solved as impulses (three passes; no spring, so nothing bounces back), pushing
  out at most 2.5 m/s, with friction. It lands on its nose, tips onto its side, slides on its roof. A capsule high in
  the hull is swept through the world each tick (`PhysicsWorld.sweepChassis`, its own character controller with no
  steps, snapping or slope rules) so it never passes through walls; speed into what it meets is lost.
- **Air.** Gravity (the players' 20 m/s²) and momentum. In the air the spin it left the lip with dies away and the
  nose follows half its arc (`airLevel`), rolls ease level, so a jump taken straight lands nearly flat. Air control
  (`airPitch`, `airRoll`) works on what changed since take-off: the throttle and steering held over the lip are
  neutral, so holding W through a jump doesn't dive the nose; pressing W noses down, S (or letting go of W) lifts it,
  A/D roll.
- **Flips and righting (owner's answer 2b).** Tipped past about 63° with fewer than two wheels down, nearly stopped
  and resting on something (`tippedOver`), the driver rolls it back onto its wheels with **jump** (Space: the
  handbrake, which does nothing on its side; Use stays "get out"), after `rightAfter[0]` (0.3 s) at rest; the HUD's
  use prompt shows "Space Flip back" instead of the camera hint while it can. Empty, it rights itself after
  `rightAfter[1]` (4 s), so nobody finds a buggy on its roof. Righting is a spin toward upright and a little lift over
  about a second; riders stay in.
- **What the rest of the match sees.** `pos` is the body's origin (the feet), `yaw` its heading, `speed` and `slide`
  its velocity along and across the heading, `airborne` no wheel and no hull touching; the hit box turns with the body
  (`setBoxTransform`), seats too (riders sit in a rolled buggy where it is drawn). Crashes, running people over,
  pushes, hard-landing damage and the wedge watch work as before. `MountDef.vehicle.rigid` (content JSON) holds the
  numbers and `on`; `MatchOptions.drive` ('classic' / 'rigid'; the page's `?drive=`) overrides `on` for a match.

### The Troop Buggy's numbers (`content/vehicles/troop_buggy.json`)

| | |
|---|---|
| Springs | 1.4 Hz, damping 0.28 (step 1: 1.5 Hz, 0.32), 0.20 m travel, bump stop at 0.16 m |
| Centre of mass | 0.85 m over the feet (box 1.6 m tall, hubs 0.42 m) |
| Inertia | 0.7 of its box's (step 1: 0.8) |
| Gravity | 0.85 of the players' 20 m/s² (step 1: 1) |
| Tyres | grip 1.05 × load, 0.75 kept sliding, cornering 9 /s front, 8 /s rear (rear 33 % looser at top speed: `drift` 0.55) |
| Steering | lock 0.6 rad (was drawn 0.5), 70 % less at top speed; rear steer 0.6 of the front's at a standstill |
| Engine | 18 m/s, accel 10 m/s² with a 2× launch at a standstill (step 1: 1.7×), reverse 7 m/s |
| Air | levelling 4 rad/s² per rad, air pitch 12 and roll 8 rad/s² (step 1: 5, 10, 6) |
| Righting | jump, once it has rested 0.3 s tipped (a driver); on its own after 4 s (empty) |

Measured in `packages/shared/test/drivePhysics.test.ts` (DRIVE_TRACE writes the traces):
- Flat out off a 1 m kicker at 18 m/s: 27 ticks in the air, 1.78 m up, 9 m out, lands on its front wheels then the
  rear, springs 0.13 m in, keeps 16 m/s.
- Full lock: 1.0 rad/s at 6 m/s (radius 6 m), 1.3-1.7 at 10 m/s (drifting 2 m/s sideways), a steady powerslide at top
  speed. The classic drive turned 1.7 rad/s at 6 m/s (radius 3.5 m) by turning the heading directly.
- Climbs a 25° slope from a short run-up; on 50° it slides back to the foot with the throttle held.
- A kicker under the left wheels at 18 m/s rolls it onto its side (roll > 0.5 rad, often all the way); it rights
  stays on its roof until the driver presses jump, then is back on four wheels within 2.5 s; empty, within 8 s.
- Deterministic: the same inputs give the same states and snapshots.

## After the owner's first drive (2026-11-15, `wip/drive-physics-2`)

The owner drove it on Rockfall Canyon: "bots are not shooting at me and i cant drive up stairs ... i should be able to go
further up a steep climb if i have enough speed right? ... also feel like its really heavy and hard to hit jumps on
uneven terrain". Also: "they didn't see me until i shot at them".

- **Bots:** they knew of a vehicle only by sight (in their 110° view, or within 6 m): gunfire was a noise to them, an
  engine wasn't, so a buggy behind or beside them went unnoticed until its driver fired. Not the rigid buggy (the
  same with the classic one, measured on the old code too). A driven vehicle is now heard (`Match.noteCombat`): an
  engine noise twice a second at 2 m/s and up, out to 15 m + 1.5 m per m/s (at most 40 m), the driver as its source.
  `packages/shared/test/botsHearVehicles.test.ts`: a bot walking away 22 m off fired 0 rounds before, now turns and
  fights (both drives). A player on foot behind a bot is still unseen until heard or seen, as before.
- **Steep climbs and momentum.** The rigid step lost most of its speed where the ground turned up: the hull's sweep
  capsule (out to the tyres' ends) and the underside's corners (at the box's ends, 0.24 m up) met the foot of a slope
  or a stair before the tyres did, and stopped it flat. Now the capsule ends short of the axles, the underside's
  corners sit at the axles at hub height (where the tyres are), a corner on something lower than the tyre's top pushes
  up and back like a tyre's round front (and anything taller is a wall), and a knock on the wheels keeps 92 % of the
  speed along the heading (of the speed the tick started with). Grip failing only stops the wheels driving; the body
  keeps its momentum.
  Up a 50° slab, throttle held, by entry speed (`drivePhysics.test.ts`, "momentum"; the slab's top is 12.3 m up):

  | Entry speed | Step 1 | Now |
  |---|---|---|
  | 6 m/s | 2.95 m | 5.71 m |
  | 12 m/s | 5.84 m | 11.65 m |
  | 18 m/s | 8.14 m | over the top (12.1 m) |

  It still slides back down from where its speed runs out (grip 1.05: about 46°).
- **Stairs.** A raycast wheel can't see a step until its hub is over it. Each wheel casts a second ray under the
  tyre's front (three quarters of its radius ahead, the way it rolls); a step up of up to 0.32 m onto level ground is
  lifted onto as the tyre's front reaches it (the classic drive's step-up), the tyre grips along the line from the
  nosing to its hub, and taller things only meet its round front. Walls stay walls: the hull's sweep treats anything
  steeper than 60° as a wall (at 90° it had slid up a pushing hull), and a ray that starts inside something is no
  ground. The kit's stairs (core.stairs: 16 steps of 0.25 m by 0.5 m) at a crawl (throttle 0.35): up 4 m in about
  7 s on the flight; at 0.8 throttle in about a second; a steeper flight (0.2 m by 0.35 m) at speed too; a 1.2 m wall
  flat out stops it. Cost: 4 more rays a tick while it rolls (8 wheel rays), and one more per underside corner that
  touches something.
- **Stuck sweeps.** A hull capsule that started inside something (put there, or squeezed in) was held there for good,
  wheels spinning at 18 m/s and not moving; now it moves as asked and the corners push it out.
- **Lighter** (the owner's brief: "bouncy and light, touchy"): gravity 0.85 of the players' on the vehicle, springs
  1.4 Hz with damping 0.28 (more rebound), inertia 0.7 of the box's, launch 2×, air pitch 12 and roll 8 rad/s² with
  levelling 4. Measured (`drivingFeel.test.ts` on Rockfall Canyon, and the yard's 1 m kicker):

  | | Step 1 | Now |
  |---|---|---|
  | 1 m kicker at 18 m/s: air time, peak | 26 ticks, 1.78 m | 33 ticks, 1.87 m |
  | Canyon floor, roughest clear 40 m line (3.3 m of ups and downs): mean, slowest | 17.6, 16.8 m/s | 17.6, 16.9 m/s |
  | Canyon floor, biggest clear crest (0.6 m): mean, slowest, air | 14.3, 7.6 m/s, none | 17.1, 11.0 m/s, 1 tick |

  The canyon's clear floor has no big crests; lower damping and inertia made it wheelie off landings (pitch past
  1 rad), so the springs stay a little firmer than first tried (0.22 damping, 0.6 inertia).
- **Lag** (the harness, after all of the above): at 100 and 150 ms with jitter the prediction stays within 2 mm of
  the host, no corrections; with 2 % loss 4 corrections, the worst 24 cm (faded); Canyon 6, the worst 5 cm.

## Driving physics 3: the owner's second drive (2026-11-16, `wip/drive-physics-3`, `wip/drive-physics-3b`)

Owner: "It still feels chunky, we seem to get snagged on invisible elements that cause the buggy to stutter or act like
it hit something. hitting rocks is clunky and landing jumps dont feel good, they feel.. programmed. We need physics and
gravity to determine the movement and landings, and it seems like there is something preventing that."

### A first: bots and drivers, bots and bars (its own landing, `wip/drive-physics-3`)

- **Drivers:** the Troop Buggy's collision box is 1.6 m tall over an open tube frame; a seated rider's feet are on the
  cushion 0.8 m up, so their chest (about 1.5 m) was inside the box. A round aimed at a driver's middle stopped in the
  box and hurt the buggy; only head shots got through. Riders of a vehicle that is not sealed are exposed now: a shot
  into its box goes on to a rider inside it (`Match.openHull`; the vehicle isn't hurt by that round). Bots with only a
  rifle also counted any enemy vehicle as out of their reach ("outgunned": they took cover, often against the buggy,
  or went off for a launcher); now only a sealed one (the Tank). Rockfall Canyon, four bots round a stopped driven
  buggy, 15 s, normal bots: rounds on the driver 15 of 107 (51 into the buggy) before, 25 of 98 after; on foot at the
  same place 35 of 81. A player aiming at a driver's chest: 0 of 8 hits before, all after.
- **Bars and fences:** a bot sees someone by one sight line from eye to eye, and bars, a barred gate's bars and a
  fence's posts and rails were solid to it (the tall fence's middle rail is at eye height): a third of the lines across
  bars and two in five across the fence were blocked, and a blocked line stays blocked while both stand still. Its
  "would my round get there" check stopped on a bar too. Those pieces are lattices now (`edgeLattice`, physics
  `GROUP_LATTICE`): solid to bodies and to the rounds that strike them, never to sight lines, left out of a bot's own
  check. Also the kit Iron Fence and the chain-link fences and gate (props whose collision is a box). Sight lines
  across them, 100 sampled: bars 79 → 100, barred gate 93 → 100, fence 61 → 100, chain-link 82 → 100, iron fence
  98 → 100. Other fence props (the Kenney and Loafbrr fences, the dungeon arch bars) are solid boxes to everyone: a
  content flag for them is a follow-up.

### B: what makes it stutter (the diagnosis)

`test/driveSnags.test.ts` (DRIVE_TRACE) drives the buggy with an autopilot round each map's open places for four
minutes, and over 24 clear 40 m lines each (the bumpiest open ground, nothing at hull height, the same start every
run), with a trace of what acted on the body each tick (`wheelPhysics.ts` `rigidTrace`). A *sharp* tick changes the
speed by 1 m/s (60 m/s², three times what the engine or brakes do) or the spin by 1.5 rad/s in one tick. Each is put
down to a visible obstacle (the sweep or a hull corner against a wall, a rock, a prop, sideways on) or to the
mechanisms that acted.

| Rockfall Canyon, free drive (741 m) | a km |
|---|---|
| All sharp ticks | 431 |
| A visible obstacle hit (walls, rocks, structures) | 213 |
| **Without a visible cause**, by mechanism (a tick can have several): | 218 |
| — the bump stop (a wheel's 0.16 m of spring runs out: a hard stop) | 147 |
| — a hull corner (the underside's, at hub height inside the tyres) on terrain or a floor slab's edge | 97 |
| — the tyre's front ray (incl. the step-up snap) | 66 |
| — grip cut / the hull sweep / the 92 % speed keep / a rolled-up corner | 38 / 38 / 30 / 20 |

The Coverage Test (2.7 km, flat ground and built pieces): 20 sharp ticks a km, 8 of them visible obstacles; the rest
bump stops (11), the step-up (10), the speed keep (6). Landings on the canyon (35): a hull corner decided 22 of
them, a bump stop 19, the air levelling acted before 4.

**The "invisible elements"**, in order:
1. **The bump stop.** A wheel has 0.16 m of spring before a hard, instant stop (an impulse: no compliance). On the
   canyon's ground it bottoms out on most dips and every landing: the single biggest source of stutter.
2. **The hull's underside corners.** They sit at the axles at hub height, inside the tyres (so a tyre's round front
   climbs a step), and are hard contacts with friction 0.55: where a tyre's spring runs out on a bump they touch
   instead, scrub speed and kick the spin. On the canyon they also catch the vertical sides of floor slabs where a tile
   floor meets the terrain (73 contacts), and the top corners the underside of bridges (66).
3. **Terrain triangle edges, through the step-up.** The tyre's front ray took the bend between two terrain facets at
   different heights for a stair step and lifted the tyre up to 0.32 m in a tick. **Fixed** (`wip/drive-physics-3b`):
   the step-up is for steps (boxes), never the terrain. Clear canyon lines: 69 → 43 sharp ticks a km (step-up snaps
   15 → 2 a km, bump stops 55 → 31); the Coverage Test's lines unchanged (130 a km: its ramps and kerbs are boxes).
4. **Not the cause:** the hull capsule (the sweep) only 3 a km against the ground from below; props whose collision
   is bigger than their mesh weren't found (the props hit fill their meshes); "speed set from outside the step" (the
   Match) never happened.
5. **"Programmed" landings and rock hits:** the air levelling (half way to the arc in flight), the 92 % speed keep
   through knocks and the rolled-up corners (a 1.2 m rock box is driven over: `strip-rock.png`) are scripted on top of
   the body, as the owner felt.

### B: real rigid-body physics, evaluated

`test/rapierVehicleEval.test.ts` and `driveStrips.test.ts` (DRIVE_TRACE): the Troop Buggy as a Rapier dynamic body on
`DynamicRayCastVehicleController` (Rapier 0.21, already a dependency), in a small world of its own.
- **Deterministic on one machine:** two runs with the same inputs, 900 of 900 ticks identical.
- **Replay from a sent state** (position, rotation and velocities written into the body, then stepped, as the
  prediction replays): after 6 ticks p50 0, p95 0.75 cm, worst 8.5 cm; after 9 ticks p95 1.2 cm, worst 11 cm. Rapier's
  contact caches aren't in that state, so contacts replay a little differently (our model: 2 mm worst). A correction
  of that size fades in a tenth of a second.
- **Cost:** about 0.3 ms a vehicle step in that small world (our model: 0.08-0.26 ms a whole match step). Against a
  map's static colliders the broad phase costs more; in a world of its own per vehicle it holds only the colliders
  round it.
- **Landings and rock hits by the solver:** frame strips, side on, every third tick (`strip-landing.png`,
  `strip-rock.png` in the helper's scratchpad): ours lands, rebounds into a wheelie and climbs a 1.2 m rock box; the
  Rapier body lands on its springs and stops dead against the rock, rocking back. Untuned (its engine and springs are
  first guesses), so it shows the kind of motion, not the feel.

### B: the plan

It is bigger than one landing. Steps, each checked and driven:
1. **Now (landed with this):** the step-up never on terrain. The trace and the diagnosis drives stay (DRIVE_TRACE).
   Lag harness after it: 100 and 150 ms with jitter, worst 2.2 and 2.3 mm, no corrections; 2 % loss 4 corrections, the
   worst 24 cm; Canyon 6, the worst 15 cm (as before).
2. **The body in Rapier** (`?drive=rapier`, the current way stays selectable): a dynamic body (the buggy's mass,
   inertia and centre of mass) on our own sprung raycast wheels and tyres (they are what the owner's answers tuned:
   grip 1.05, 46°, rear steer) applying forces and impulses, with Rapier resolving the hull's contacts (a convex hull or
   a few boxes of the real body, not the 1.6 m box). Gone: the bump stop impulse (a progressive bump rubber instead),
   the underside corners, the sweep, the 92 % keep, the air levelling. Air control stays as small torques from W/S/A/D
   (answer 3a). A per-vehicle world holding the static colliders within 30 m (rebuilt as it moves), stepped once per
   driver input as now.
3. **Prediction:** the driver's client steps the same world; the private state gains nothing new (the body's state is
   what `vp` carries). The lag harness and the canyon run judge it, as before; the target is no worse than now at 100
   and 150 ms with jitter (a few cm worst) and with 2 % loss.
4. **Measure** on the clear lines and the free drive: fewer sharp ticks a km than now, landings decided by contacts
   (no levelling); then the default, after the owner drives it.

### Owner questions (driving physics 3)

1. **The body: who solves it?**
   a) Rapier dynamic body, our wheels and tyres as forces, Rapier for the hull's contacts **(recommended)**: the owner's
      tuning stays, the contacts become real.
   b) Rapier's own `DynamicRayCastVehicleController` (wheels too): least code, but its tyre model replaces the tuned
      grip, slopes and drift (they'd be tuned again).
   c) Keep our own solver and only take out the bump stop and the corners (smaller, but still scripted).
2. **Arcade help in the air.**
   a) W/S/A/D air control as small torques only; no levelling **(recommended)**: a jump lands how it was taken.
   b) Also a gentle self-levelling torque (much weaker than now).
   c) None at all.
3. **Rocks and walls.**
   a) Real contacts: a rock taller than the tyre's reach stops or launches it; low ones it climbs **(recommended)**
   b) Keep some help rolling over rocks up to the hub's height.
4. **Prediction error we accept** (now: 2 mm at 100-150 ms; Rapier replays: up to about 10 cm in contacts, faded in
   0.1 s).
   a) Up to about 10 cm, faded **(recommended)**
   b) It must stay at today's few millimetres (then 1c)
5. **Rolling out.**
   a) `?drive=rapier` for the owner to try against the current drive, the default after the owner drives it
      **(recommended)**
   b) Straight to the default once the measurements hold

## Driving physics 4: as built (2026-11-16, `wip/drive-physics-4`)

The owner's answers to the Rapier plan (QUEUE's driving line, 2026-11-16): **1a** the body a Rapier rigid body with our
springs and tyres as forces, **2a** air control only, **3a** rock and wall hits from real contacts, **4a** prediction up
to about 10 cm, faded, **5b** straight to the default. Built for the Troop Buggy (the only rigid vehicle); the other
wheeled vehicles stay classic until step 2 of "Later steps".

- **The body in Rapier** (`PhysicsWorld.createChassisBody` / `solveChassis`, `wheelPhysics.ts` `ChassisWorld.solve`):
  a dynamic body in the match's own physics world with unit mass, the buggy's inertia and centre of mass (as our
  forces are accelerations), and a rounded convex hull of the real body instead of the 1.6 m box (`hullOf`): the belly
  between the axles at hub height (a flat plate at the model's 0.24 m ride height hung it up on every stair top and
  crest), a ring at the tyres' middle height out to their fronts and backs (the nose rises at about 47° from the axles,
  so a slope's foot meets the tyres first), the roll cage's top; rounded 8 cm so it slides off seams; friction 0.2 and
  no bounce (the lower of its and the world's). It meets what bodies meet (static geometry, other vehicles' boxes,
  fields, glass, lattices), never players, shots-only shapes, its own box (a contact hook) or another hull; no query
  sees it.
- **Deterministic, host-authoritative, fixed steps.** The body is switched off except during its own step and on
  afresh each step, so no contact cache carries over: a step depends only on the state and the world (the same seed
  and inputs give the same snapshots: `drivePhysics.test.ts`), and the driver's prediction replays the host's steps.
  Each step runs Rapier's pipeline directly with `dt` = a substep (1/120 s) and 8 solver iterations (4 left the
  client's replays up to 27 cm off in a wedge; 8: under 1 cm). Rapier steps on the tick's last substep and on every
  substep while the hull touches something; the other substep is integrated by the step itself (half the cost).
- **Our wheels and tyres as forces**, as tuned (grip 1.05, the 46° slope, rear steer, drift, launch): the springs push
  the body, the tyres grip and slide, the step-up onto stairs stays (a tyre lifting onto a step pushes at most 6× its
  share of the weight, so a stair's top doesn't kick the tail up). **Gone:** the hard bump stop (now a progressive bump
  rubber past 0.16 m: 8× the spring's stiffness growing with depth, damped, giving back a fifth as it extends, a
  wheel's push capped at 8× its share of the weight; what it can't take, the hull's contact with the ground takes), the
  hull's corner rays, the capsule sweep, the 92 % speed keep, the air levelling and the arcade spin damping in the air.
  Air control (W/S, A/D on what changed since take-off) and righting (jump, after 0.3 s; empty, 4 s) stay.
- **The old way behind a switch:** `?drive=own` (MatchOptions.drive `'own'`) drives the rigid buggy with driving physics
  3's own hull contacts and sweep, for comparison; `?drive=classic` as before. The driver's prediction follows whatever
  the host runs (`vp`'s last number, 1 for the Rapier body).

**Measured** (`drivePhysics.test.ts`, its DRIVE_TRACE probes, `driveSnags.test.ts` with DRIVE_MODE=own for before,
`drivePerf.test.ts`, `vehiclePrediction.test.ts`):

| | Driving physics 3 (`own`) | Driving physics 4 |
|---|---|---|
| Sharp ticks a km, clear lines: Rockfall Canyon / Coverage Test | 43 / 130 | 31 / 81 |
| Sharp ticks a km, free drive (3 min): Rockfall Canyon / Coverage Test | 218 / 26 | 97 / 11 |
| ... of them a visible obstacle (canyon) | 84 | 25 |
| Up a 50° slab at 6 / 12 / 18 m/s (top 12.3 m) | 5.7 / 11.7 / over | 7.4 / 9.9 / 11.5 m |
| The kit's stairs at 0.35 / 0.8 throttle; the steeper flight | up in 7 s / 1 s; up | up in 9.7 s / 4.2 s; up |
| Lag harness worst error, no loss: 0 / 100 / 150 ms (jitter) / Canyon 150 ms | 2 / 6 / 8 / 14 cm | 0.01 / 0.02 / 0.03 / 0.3 cm |
| Lag harness, 150 ms with 2 % loss: worst | 24 cm | 20 cm (a lost input's stall, as before) |
| Whole match step, 8 driven buggies on Norman Shores (this box) | 0.8-0.9 ms | 2.0-2.4 ms (classic 2.2-2.4) |

- **Snag cases** (`drivePhysics.test.ts`, "driving physics 4: the snags"): a seam between two floor slabs 1 cm apart at
  8 m/s (where driving physics 2's sweep froze on the coverage map) gives no sharp tick and keeps 7+ m/s; a 15 cm kerb at
  8 and 16 m/s keeps 80 % of the speed with at most two sharp ticks; a 1.2 m rock box at 12 m/s stops it (never climbed);
  a jump flies with no torque but the drag (no levelling), and a 9 m drop lands on the springs and the hull and ends on
  four wheels; the 25° climb, the 50° slide-back, the kerb roll and the flip back (jump; empty on its own) as before.
- **What the sharp ticks are now:** on the canyon's clear lines the hull touching from below on crests (21 a km) and
  the bump rubber; on its free drive the hull from below and the rubber (35 a km each) and visible obstacles (25). The
  invisible snags of driving physics 3 (the bump stop's impulse, the corners at hub height, the sweep, the speed keep)
  are gone. Landings (canyon, 22): the rubber in 15, the hull's contact in 13.
- **Feel, honestly:** a jump lands how it was taken (off the 1 m kicker it leaves nose-down, as the rear wheels push
  last, and lands on its front wheels; S lifts the nose). Flat out into a 50° slope's foot the nose meets the face: a
  real hit, so 18 m/s carries little further than 12 m/s (driving physics 3's speed keep carried it over the top).
  Driving off a 4 m ledge without air control can nose it over onto its roof (the stairs test checks it upright a
  second after the top, on a 30 m landing).
- **Cost:** a hull step is about 0.1 ms on a big map (most of it Rapier's narrow phase against the terrain's mesh);
  with Rapier on one substep of two, about 0.15-0.2 ms a buggy a tick. The driver's client pays the same per predicted
  tick plus its replays. A per-vehicle small world (the plan's first idea) wouldn't help the terrain's share.
- **Parked buggies stay put** (found through a train, 2026-11-17: `botCtf.test.ts`'s Diamond Park seed went without a
  capture). A parked, empty buggy was stepped at each of its sleep's looks (every half second) and crept about a
  millimetre a minute, under both solvers; its box moving moved every bot's sight line and shot past it, so any change
  to how it settles sent a whole match another way (no bot ever boarded Diamond Park's buggies). Asleep, it now stays
  exactly where it settled while the ground under its wheels holds (four hub rays at each look) and nothing set it
  moving; falling asleep stops it. Diamond Park CTF seeds 1-6, captures in 5 minutes: 1 1 1 4 0 1 (main: 0 2 1 2 1 1).
- **Pictures** (DSF 2, chase camera, time frozen, `?sim=main&vehiclepredict=0`): a jump and its landing and a hit on a
  rock at 15 m/s on Rockfall Canyon (the helper's scratchpad `shots-drive4/`: `jump-00..15.png`, `wall-00..11.png`).

## Netcode

- **Host-authoritative, as now.** The host (a browser, the dedicated server) runs the rigid step; nothing new on AWS.
- **The driver predicts their own vehicle** (`packages/client/src/game/vehiclePrediction.ts`): each input steps it at
  once, through the same `stepRigid` against the prediction physics (the map, terrain, environment shapes and the
  other mounts' boxes, as for walking). The driver's private state carries the vehicle's whole state, `vp` (21
  numbers, rounded: position, quaternion, velocity, spin, steering, timers; about 200 bytes before deflate, the driver
  only). On each snapshot the prediction takes the host's state after the last input it has seen and steps the
  unacknowledged inputs again on top (as `LocalPlayer.reconcile` does for walking); the difference to what was drawn
  joins a correction that fades in a tenth of a second (snapping only past 6 m). Drawn between its last two ticks.
- **The host steps a driven rigid vehicle once per driver input** (`Match.driveRigid`: inputs queued in
  `applyInputs`), as players move once per input, so a jittery link that bunches inputs (0, 2, 1 a tick) runs exactly
  the steps the driver predicted. A tick with none waits, up to 12 ticks (200 ms: a lost packet's resend), then goes
  on with the last controls. An empty or bot-driven vehicle steps once a tick.
- **Everyone else's vehicles** are drawn from snapshots as before (`mt` pose, `ms` pitch, roll, steering, springs),
  eased; `ms`'s pitch and roll now carry the whole tilt (upside down included: roll ±π, eased the short way round).
  Snapshot size unchanged. Step 2 moves them to the interpolator (render a snapshot interval behind, as remote
  players), so a fast one doesn't carry a 100 ms extrapolation.
- **Off switches.** `?vehiclepredict=0` draws your vehicle from snapshots (to compare); `?drive=classic` drives
  everything the old way; `?drive=rigid` turns rigid driving on for a vehicle whose `rigid.on` is false; `?drive=own`
  drives it rigid with driving physics 3's own hull solver instead of the Rapier body (driving physics 4).

### Judged: the lag harness (`packages/client/test/vehiclePrediction.test.ts`)

A host Match and a client (prediction physics, MountState, VehiclePrediction) over a simulated link: each input and
snapshot delayed by half the round trip plus seeded jitter; loss as netLab's LossyLink does it (a lost packet a round
trip and three packet gaps later, holding the ones behind). The course: flat out over the kicker, a slalom, the kerb,
a handbrake turn (600 ticks); and 900 ticks weaving on Rockfall Canyon. "Error" is the predicted position after an
input against the host's after the same input; "behind" is how far the snapshot pose is behind the host when it
arrives (what you'd see without prediction).

| Link | Error p50 / p95 / worst | Corrections (worst) | Biggest drawn step | Behind without prediction (p50 / worst) |
|---|---|---|---|---|
| 0 ms | 0 / 0 / 2 cm | 8 (2 cm) | 1.3 cm | 0 |
| 100 ms, 10 ms jitter | 0 / 0.2 cm / 6 cm | 13 (6 cm) | 6 cm | 0.72 m / 0.96 m |
| 150 ms, 20 ms jitter | 0 / 0.4 cm / 8 cm | 17 (8 cm) | 7.5 cm | 1.08 m / 1.8 m |
| 150 ms, 20 ms jitter, 2 % loss | 0 / 22 cm / 24 cm | 7 (24 cm) | 8.5 cm | 1.04 m / 5.0 m |
| Canyon, 150 ms, 20 ms jitter | 0 / 0.2 cm / 14 cm | 10 (14 cm) | 1.5 cm | 0.29 m / 1.8 m |

Before the per-input stepping the 150 ms run had 133 corrections up to 0.36 m (the host stepping once a tick on
bunched inputs). The remaining corrections are a lost packet's stall (the host went on without the input) and other
mounts' boxes, which the client has where the last snapshot put them.

## Cost

Host, per rigid vehicle per tick: 4 wheel rays, 8 hull rays only while it leans, flies or touches with its hull, one
capsule sweep, two substeps of maths (the classic: one capsule move and 4 suspension rays). A parked empty one sleeps
(a look every half second). The driver's client runs the same per predicted tick, plus the replay of unacknowledged
inputs per snapshot (about 6-9 at 100-150 ms: 30 Hz × 9 steps). Measured on this box: see "Measured cost" below.
No AWS cost: it runs on the hosting player's machine.

## Later steps

2. **The other wheeled vehicles** (Gun Buggy, Supply Buggy, Troop Truck six-wheeled, Armored Rover): their numbers
   (heavier, lower centres of mass, stiffer, grippier: the truck and rover hard to flip), each turned on after the
   owner drives it. Remote vehicles through the interpolator. Skid marks and tyre sounds from `sliding` (no flashes).
3. **Bots.** `bots/vehicles.ts` drives by target speed and heading; with grip that fails it needs to brake before
   corners (a speed for the curvature from `grip`), ease off when `slide` grows, back out when nosed into a wall (a
   rigid buggy doesn't turn in place), take ramps square, and wait for self-righting. Bot-report numbers before and
   after (routes finished, time stuck, flips).
4. **Maps.** Through MapMaker only: check each official map's routes for the buggy (slopes past 40° it used to climb,
   kerbs that now flip it); jump ramps and berms as palette pieces if the owner wants them. No hand edits.
5. **The tank and hovercraft.** The tank on tracks (two long contact strips, skid steering) can share the body;
   hovercraft and flyers keep their own models (a hover pad is a spring without tyre grip: step 5 if wanted).
6. **Polish:** suspension and engine sounds from load and slip, cockpit camera tilt from the real body (still damped
   and capped as now, Reduce flashing unaffected), a flip button if the owner wants control over self-righting.

## Owner questions

**Owner's answers, 2026-11-15** (via lane A's lead): 1a, 2b, 3a, 4a ("for now"), 5a, 6a. So: flips as they are;
righting only on the driver's key (jump; empty ones still right themselves after 4 s); air control as built; the
6 m turn stays for now; 46° grip; the Troop Buggy alone first, the owner drives it, then the rest one by one.

1. **How easy to flip?** Step 1 rolls the Troop Buggy onto its side off a kerb under one side at full speed, and
   rarely in a flat-out turn on level ground.
   a) As it is (kerbs, side slopes and bad landings flip it; flat turns don't) **(recommended)**
   b) Easier: flat-out hard turns can roll it too (centre of mass higher)
   c) Harder: only crashes and big landings flip it
2. **Self-righting.**
   a) On its own after 1.2 s tipped, with you still in it **(recommended)**
   b) Only when you press a key (Use or jump)
   c) Never: get out and push it (it rights itself when empty after 4 s)
3. **Air control.**
   a) What changed since take-off: W noses down, S lifts, A/D roll; holding W over the lip is neutral **(recommended)**
   b) None: the jump flies as it left the ramp
   c) Plain W/S pitch in the air (holding W through a jump dives the nose)
4. **Turning.** The rigid buggy turns a 6 m circle at walking pace where the classic turned 3.5 m.
   a) Keep the real geometry with the rear-steer help (6 m) **(recommended)**
   b) Tighter, Warthog-like: more rear steer (about 4.5 m)
   c) As tight as the classic (a turning aid on top of the tyres)
5. **Slopes.** Grip holds it on up to about 46°; past that it slides back.
   a) 46° (grip 1.05) **(recommended)**
   b) 40° (grip 0.85: more sliding, slopes on maps matter more)
   c) 55° (grip 1.4: closer to the old climbing)
6. **Rolling out.** Before the other vehicles: the Troop Buggy alone in a playtest first, or straight to all wheeled ones?
   a) The Troop Buggy alone, the owner drives it, then the rest one by one **(recommended)**
   b) All the wheeled vehicles in step 2 at once

## Measured cost

`drivePhysics.test.ts` "cost" (DRIVE_TRACE; one driven Troop Buggy on the test yard, a whole match step, three passes,
this box at load 5): classic 0.11-0.34 ms a tick, rigid 0.08-0.26 ms; within the noise of each other. The lag harness
replays its inputs per snapshot on top (6-9 steps at 100-150 ms) without showing in its run time (600 ticks with
three links in about 0.3 s each).

**The owner's answers on driving physics 4 (2026-11-17, "1a 2a 3a"):** keep the real nose hit at the foot of a steep face (no help up it); jumps land as they are taken, air control only (no levelling); a buggy that lands on its roof off a high ledge is fine, jump flips it back. All as built.
