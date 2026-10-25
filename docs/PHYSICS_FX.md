# Ragdolls, debris, blood and hit sounds

All of this is **drawn only**. Each client runs its own small physics world
(`EffectsWorld`, `packages/shared/src/sim/effectsPhysics.ts`, Rapier, the same
engine as the game) holding the level's static shapes and the terrain. Nothing
in it feeds back into the match, so it can't cause desyncs or cheating, and
the server never runs it.

## Ragdolls

When a player or bot dies, their body goes limp: ten capsules (torso, head,
upper and lower arms, thighs and shins) joined at the neck, shoulders,
elbows, hips and knees, thrown by whatever killed them:

- **Shots** push the body along the shot (harder for big guns; shotgun pellets add up).
- **Melee** knocks it back and up a little.
- **Explosions** throw everyone nearby away from the blast.
- Otherwise it keeps the speed it was running at.

The skeleton follows the capsules until the player respawns. At most 12 bodies
tumble at once; older ones freeze where they lie.
(`packages/client/src/game/ragdoll.ts`)

## Debris

Chunks from broken crates, barrels, glass, walls and props are real little
boxes now: they bounce off the floor and each other, roll down slopes and come
to rest, then shrink away after 6 s.

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
