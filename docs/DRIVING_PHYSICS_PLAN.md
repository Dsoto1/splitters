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
- **Flips and self-righting.** Tipped past about 63° with fewer than two wheels down and nearly stopped for
  `rightAfter` seconds (1.2 with a driver, 4 empty), it rolls itself back onto its wheels over about a second (a spin
  toward upright and a little lift). Riders stay in.
- **What the rest of the match sees.** `pos` is the body's origin (the feet), `yaw` its heading, `speed` and `slide`
  its velocity along and across the heading, `airborne` no wheel and no hull touching; the hit box turns with the body
  (`setBoxTransform`), seats too (riders sit in a rolled buggy where it is drawn). Crashes, running people over,
  pushes, hard-landing damage and the wedge watch work as before. `MountDef.vehicle.rigid` (content JSON) holds the
  numbers and `on`; `MatchOptions.drive` ('classic' / 'rigid'; the page's `?drive=`) overrides `on` for a match.

### The Troop Buggy's numbers (`content/vehicles/troop_buggy.json`)

| | |
|---|---|
| Springs | 1.5 Hz, damping 0.32, 0.20 m travel, bump stop at 0.16 m (as before) |
| Centre of mass | 0.85 m over the feet (box 1.6 m tall, hubs 0.42 m) |
| Inertia | 0.8 of its box's |
| Tyres | grip 1.05 × load, 0.75 kept sliding, cornering 9 /s front, 8 /s rear (rear 33 % looser at top speed: `drift` 0.55) |
| Steering | lock 0.6 rad (was drawn 0.5), 70 % less at top speed; rear steer 0.6 of the front's at a standstill |
| Engine | 18 m/s, accel 10 m/s² with a 1.7× launch at a standstill, reverse 7 m/s (as before) |
| Air | levelling 5 rad/s² per rad, air pitch 10 and roll 6 rad/s² |
| Righting | 1.2 s tipped with a driver, 4 s empty |

Measured in `packages/shared/test/drivePhysics.test.ts` (DRIVE_TRACE writes the traces):
- Flat out off a 1 m kicker at 18 m/s: 27 ticks in the air, 1.78 m up, 9 m out, lands on its front wheels then the
  rear, springs 0.13 m in, keeps 16 m/s.
- Full lock: 1.0 rad/s at 6 m/s (radius 6 m), 1.3-1.7 at 10 m/s (drifting 2 m/s sideways), a steady powerslide at top
  speed. The classic drive turned 1.7 rad/s at 6 m/s (radius 3.5 m) by turning the heading directly.
- Climbs a 25° slope from a short run-up; on 50° it slides back to the foot with the throttle held.
- A kicker under the left wheels at 18 m/s rolls it onto its side (roll > 0.5 rad, often all the way); it rights
  itself; dropped on its roof it lands there and is back on four wheels within 5 s.
- Deterministic: the same inputs give the same states and snapshots.

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
  everything the old way; `?drive=rigid` turns rigid driving on for a vehicle whose `rigid.on` is false.

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
