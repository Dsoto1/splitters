# Ragdolls, debris, blood and hit sounds

All of this is **drawn only**. Each client runs its own small physics world
(`EffectsWorld`, `packages/shared/src/sim/effectsPhysics.ts`, Rapier, the same
engine as the game) holding the level's static shapes and the terrain. Nothing
in it feeds back into the match, so it can't cause desyncs or cheating, and
the server never runs it.

## Ragdolls

When a player or bot dies, their body goes limp, thrown by whatever killed them:

- **Shots** push the body along the shot (harder for big guns; shotgun pellets add up).
- **Melee** knocks it back and up a little.
- **Explosions** throw everyone nearby up and away from the blast, with its force (a big blast harder).
- Otherwise it keeps the speed it was running at.

Every death is physical, cheaply. A body gets one of three tiers
(`ragdollBudget.ts`):

| Tier | When | What |
|---|---|---|
| Full | within 10 m, or in view within 35 m | ten capsules (torso, head, upper and lower arms, thighs, shins) joined at the neck, shoulders, elbows, hips and knees |
| Cheap | in view, further away | three bodies (pelvis, chest, head); the arms and legs hang in the death's limp pose |
| Laid down | out of view | no simulation: the body lies on the ground under where it died, along the hit, in the death's final pose |

- **Budget**: at most 300 ragdoll bodies awake at once (a full ragdoll is 10, a
  cheap one 3). Past it, the farthest ragdoll still moving drops a tier (full
  to cheap with the same motion, cheap to frozen) before a new death is
  lowered; nothing falls back to the canned death animation.
- **Pool**: ragdoll bodies are parked in the effects world and reused (a
  dozen standard bodies are made with the map), so a blast that kills ten
  allocates nothing.
- **Settle and freeze**: after the first tumble (0.9 s) the bodies are damped
  harder; once they rest, or after 4 s (cheap: 2.5 s), the bodies go back to
  the pool and the pose stays as it is: the skeleton and its joints stop
  updating, so a body on the ground costs nothing per frame.
- Creatures (zombies' toads, aliens and the like) keep their own death and
  fall to the ground under gravity.

`view.ragdollStats()` reports bodies by tier, frozen ones and awake physics
bodies. The mass-casualty perf scenario (`PERF_SCENARIOS=mass node
tools/perf/perf96.mjs`, docs/PERF_96.md) kills 20 with one blast in a
24 v 24 and times the frames after it.
(`packages/client/src/game/ragdoll.ts`, `ragdollBudget.ts`)

## Debris

Chunks from broken crates, barrels, glass, walls and props are real little
boxes now: they bounce off the floor and each other, roll down slopes and come
to rest, then shrink away after 6 s. Glass panes (window glass and glass
blocks, see [`BUILDING_KIT.md`](BUILDING_KIT.md#glass-glass-panes)) shatter
into a shower of pale shards sized to the pane, with the CC0 glass-break sound;
bulletproof glass only cracks (a synthesised `glass.crack` tick). A vehicle blowing up throws two dozen
charred and glowing chunks harder and further, alongside its layered fireball,
shockwave ring, sparks and smoke (see [`VEHICLES.md`](VEHICLES.md)); blasts
and crashes near you shake the camera.

## Blood

Light by default: a quick spray of droplets and a puff of mist where a shot or
blade hits, small splats on the floor and on the wall behind the target, and a
small pool under a body. Splats fade after about 9 s (at most 50 at a time,
120 on heavy). (`packages/client/src/game/bloodVisuals.ts`)

**Per map** (MapMaker → Map properties → **Blood**):

| Setting | Values |
|---|---|
| Colour | any colour; quick picks: Red, Alien (green), Oil (black), Ichor (gold), Coolant (blue) |
| Amount | None, Light (default), Heavy |

Stored as `blood: { color, amount }` in the map (format v10; `null` means red
and light).

**Per player**: Pause menu → **Blood** switch, remembered in the browser.
Off hides all blood and the splat sound, whatever the map says.

## Hit sounds

Every hit on a player or bot plays a fleshy impact at the victim:

- `impact.body`: three CC0 recordings (Pound of Flesh, Meat Slap by magnuswaker; Meaty Damage Impact by modusmogulus), layered with
- `impact.thud`: a low Kenney punch for weight;
- `impact.heavy` for big hits (45+ damage per shot: shotgun blasts, rifles, rockets): Gore Impact (magnuswaker) and Headshot (Pablobd);
- `blood.splat` on a kill (gprosser), unless blood is off;
- `ui.hit`: your own hit-confirm tick, synthesised in code (four variants).

One body hit per victim per shot, so a shotgun blast is one meaty thump, not
eight. All recordings are CC0; credits are in each `assets-src/freesound-*/License.txt`.

## Props on slopes

Props no longer float on hillsides:

- **Placing** a prop on the terrain beds it in: its base goes to the lowest
  ground under its footprint (trees use their trunk, not their crown), so no
  corner hangs in the air.
- **Dragging** a prop that sits on the ground keeps it on the ground, up or down hill.
- The **Scatter** brush beds every plant and rock the same way.
- **Rocks, logs, stumps and plants lean** with the slope (up to 25°). Trees,
  buildings, crates and furniture stay upright.
- **Settle on ground** (inspector, with props selected) and **Settle all props
  on ground** (Map properties) fix older maps in one undo step. Props standing
  on floors, blocks or other props stay put.
- The validator warns about props floating more than 20 cm over the terrain
  (`prop.floating`), and map scripts settle props when they save.

(`packages/shared/src/map/settle.ts`)
