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
- **Joint limits** (`ragdollJoints.ts`): every joint is limited like a body's:
  knees and elbows are hinges that fold one way only (never past straight),
  hips swing forward far and back a little, shoulders cover the arm's
  reach, the neck nods and turns but never round, and nothing twists far.
  The joints' frames are made from where the joints are at the moment of
  death (body up, right, forward; each limb's direction; the elbow's and
  knee's own bend), never from the bones' axes, so the same limits hold for
  the modular rig and every whole-body Meshy rig, small or large, a rig that
  folds two joints into one place, or one that calls its left side right.
  Each range is widened to take the pose at death, so nothing snaps.
  Before 2026-11-02 the joints were free balls: bodies came to rest folded
  with knees and elbows bent backwards and limbs twisted round.
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

## Pack effects (Binbun VFX)

Also drawn only. The owner's Binbun packs are Godot 4 projects; `tools/content/prepare-vfx.mjs` writes each pack
named in `content/vfx.json` (`packs.<id>.dir`, `.file`) as JSON (only the effects `map` names; pictures they sample
as small WebPs), and `game/godotVfx.ts` plays them: a small GPUParticles3D simulator plus each pack shader rewritten
in GLSL (`PORTS`, keyed `<PackDir>/<shader>` where two packs' shaders share a name). Rebuild one pack with
`ONLY=<file> node tools/content/prepare-vfx.mjs --downloads /home/user/fx-packs/links-full` (the links point at
the extracted zips in `/home/user/fx-packs/`); `node tools/content/vfx-map.mjs` after editing the map.

- **One-shots** (`GodotVfx.play`): impacts, explosions, lightning bolts (`map.arcs`: each jump a pack zap whose
  tube is stretched to the jump and played 2.5-4x faster to fit 0.1-0.15 s between arcs), moments of play.
- **Lasting effects** (`map.lasting`, `game/lastingFx.ts`): owners ask every frame for an effect at a spot under
  an id (a fire on a burning patch, a vehicle, a flare, a flame trap; the Arc Turret's charge ball; a toxic cloud;
  wreck smoke). The nearest within 70 m are drawn, as many as the graphics quality allows (low 4, medium 10,
  high 16; low also thins their particles), started once and moved; the rest keep their plain look (`drawn(id)`).
- One-shots are capped too (low 6 / medium 12 / high 16 at once, minor ones 3 / 7 / 10), and every mapped effect
  is built while the map loads (`warm`), so the first one mid-fight costs no build.
- `pnpm perf:budget` times starting each kind (`arc`, `arc sentry`, `lasting <key>`) against the 40 ms budget.
