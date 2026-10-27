# Set pieces: blocks, liquids and the jetpack

## Free blocks (Entities tab)

A block is a box of any size, at any height, in any library material. It
needs no grid tile under it, so it makes sky platforms, stepping stones,
ledges, bridges, pillars and whole floating islands. The inspector sets its
size, material, turn and **behaviour**:

| Palette entry | Behaviour | What it does |
|---|---|---|
| Sky Block | solid | Plain level geometry: drawn with the level, walkable by bots. |
| Breakable Block | breakable | Shoot or blow it apart (health in the inspector). |
| Crumbling Floor | crumble | Shakes when someone stands on it, then gives way after *Delay* (0.8 s by default). |
| Trapdoor | trapdoor | Swings down on its hinge almost at once (0.15 s). With *Set off by: logic only* it waits for a rule's **Drop / crumble block** (or **Destroy object**) action, for traps you spring from a button or zone. |

Broken, crumbled and dropped blocks come back after *Back after* seconds
(8 s by default; untick *Comes back* to make it permanent), but never on top of
someone. Players learn them by their rim: **amber** crumbles, **red** drops,
**grey** breaks. In logic, a block falling or breaking fires **destroyed**
like any other breakable.

Breakable, crumbling and trapdoor blocks are part of the bots' navmesh while
they stand, so bots will cross a crumbling bridge (and sometimes fall).

Any block can be a logic target (v20): **Drop / crumble block**, **Rebuild
block**, Enable/Disable, and the condition "Block is present/gone". A solid
block can **start hidden** and appear when a rule rebuilds it. Navigation and
the validator see blocks in their idle state (see SCENARIO.md, *Reachability*).

### Pitched blocks (v20)

*Pitch* tilts a block about its own X axis (its far, +Z end rises for
positive values) and *Roll* about its own Z axis (+X side rises), each up to
±45°, about the block's centre and before its turn. Ramps, sloping roofs,
toppled wrecks, hedgehogs. Collision (server and prediction), the level mesh,
navigation and MapMaker all use the same rotation (`boxQuat` in
`map/geometry.ts`). Players and bots walk up slopes of 50° or less, so every
pitched block is walkable unless it is too narrow; set a ramp's centre half its
rise up so its ends meet the floors.

### Movers (v20)

Palette **Lift**, **Sliding Wall** and **Drawbridge** place a block and a mover
carrying it: a 3 m platform riding one storey up and back, a wall sliding 4 m
and back, an 8 m deck hinged at the marker that starts raised and comes down
when logic sends it. Tick more blocks in the mover's *Carries* list to move
them together (a train car, a moving room). See SCENARIO.md, *Movers*.

### Force fields, low gravity and lit signs (Style Packs)

Three more pieces came with the Orbital Station and Neon Megacity Style
Packs (BUILDING_KIT.md, *Style Packs*). All are optional fields, so older
maps load unchanged:

- **Force field** (block `field: true`; palette *Force Field*): a solid block
  that stops players and vehicles but not shots, grenades or sight, drawn as
  a humming sheet of light between two emitter posts. Logic switches it
  (Drop block / Disable off, Rebuild block / Enable on); it can start hidden.
  Shots cannot hurt it.
- **Low-gravity zone** (zone `gravity`, × the map's gravity, 0.1–3; palette
  *Low-Gravity Zone*): movement inside falls at that fraction, predicted on
  the client exactly like the server; pad flights through it carry further
  and bots are told so. Where zones overlap the weakest gravity wins.
- **Neon signs and holographic billboards** (light `fixture: 'sign' |
  'billboard'` with `text` and `size`): lights, so every light action works on
  them.

The Packs also add two mover presets, **Tower Elevator** (three storeys up)
and **Sky Tram** (a car with a roof on posts, 24 m along its facing).
### Style Pack movers and doors

**Steam Train** and **Mine Cart** (Style Packs, see BUILDING_KIT.md) are
movers whose blocks are hidden inside models that ride along
(`MoverEntity.props`): a locomotive and two flatbeds running 60 m and back
at 8 m/s, a mine cart running 12 m and back at 3 m/s. Stand on a carried
block to ride. Movers set to **4 m/s or more** run over whoever their blocks
sweep into (`Movers.strike`, the "was run over" kill), so stay off the line
or ride on top. Doors take a look (*Blast*, *Saloon*, *Vault*); **Alarm Light**,
**Destructible Barrier** and **Breakable Planks** are presets of lights and
blocks.

### Portals, portcullises and lift cages (Style Packs 03 and 09)

- **Portal Pair** (entity `portal`, two sharing a `pair`): walk, fall, fly or
  shoot into the front of one and come out of the front of the other, moving
  the same way relative to it (speed kept, turned by the difference in their
  facings). Put one at the end of a dead-end tunnel and the other somewhere
  far away for a shortcut (Sandfall Colosseum's hypogeum to the forum,
  Pharaoh's Reach's burial chamber to the top of the pyramid); leave room to
  stand in front of both. Logic switches them (Enable / Disable); bots take
  them. See BUILDING_KIT.md, *Portals*.
- **Portcullis** (door look) and **Portcullis Gate** (a grille on a trigger
  mover): gladiator gates worked from a winch or a rule.
- **Lift Cage**: a cage rising from the hypogeum through an Arena Hatch, its
  sand roof closing the hole while it is down.

```ts
m.add({ kind: 'portal', id: 'portal_a', position: [x, y, z], yaw: Math.PI / 2, size: [2.4, 3.2], pair: 'hypogeum', startEnabled: true });
m.add({ kind: 'portal', id: 'portal_b', position: [x2, y2, z2], yaw: 0, size: [2.4, 3.2], pair: 'hypogeum', startEnabled: true });
```

## Liquids (Entities tab)

Water, Lava, Acid and Swamp are boxes of liquid; *Height* is the floor and
*Height + Depth* the surface. Sink them into a pit, a hole in a block island or
a dip in the terrain.

| Liquid | Effect |
|---|---|
| Water | Wading slows you a little; deeper than 1 m you swim: you sink slowly, hold jump to rise, and near the surface jump hops you out. More than 15 s with your head under and you start drowning (10 a second). The view goes blue and hazy under the surface. |
| Swamp | Like water, but much slower. |
| Acid | Hurts 15 a second while you stand in it. |
| Lava | Hurts 45 a second; glows. |

Swimming is predicted on the client like walking, so it feels the same online.

*Colour* (v20) overrides a liquid's colour (green acid, murky sewer water,
black tar); it changes only the look, never the effect.

### How liquids look (`client/src/game/waterVisuals.ts`)

On medium and high graphics, water and swamp (tinted or not) use one small
shader:

- **Waves**: two scrolling normal maps (a tileable wave texture made in code,
  no files), flattening out with distance so far water doesn't shimmer.
- **Reflection and refraction**: a Fresnel blend of the reflection over the
  see-through water behind it (alpha blending is the refraction: no distortion
  pass). Face on you look into the water; at a grazing angle it is a mirror.
- **Depth colour**: clear in the shallows, dark and opaque in the deep. The
  depth under each vertex is baked when the map loads from the terrain and the
  level boxes under the surface (no extra render pass). On high the scene's
  camera-space depth (the depth renderer the height fog uses) refines it per
  pixel, so players, props and pillars standing in the water get it too.
- **Foam**: soft, broken-up foam where the water is shallow: the shore, and on
  high anything standing in it.
- **Sun glint**: a sharp sparkle and a softer sheen along the sun's reflection.

| Graphics | Reflection | Depth |
|---|---|---|
| High | a planar mirror (`MirrorTexture`, 40 % of screen resolution) of the sky and the big static meshes (level, terrain, border, backdrop) for the biggest body of water; other bodies reflect the sky picture | baked + scene depth |
| Medium | the map's sky picture, sampled along the reflected ray (shares the sky's texture; no render target) | baked |
| Low | the old scrolling ripple material | none |

Lava and acid get a flowing emissive version of the same shader: two layers of
noise drifting against each other, a dark crust over glowing seams that pulse,
brighter along the bank. They keep their glowing volume for side views.

**Splashes and ripples**: a player, NPC or projectile going in throws up
droplets and a ring (and a synthesised splash, `water.splash`); wading or
swimming at the surface leaves rings behind; a shot hitting the surface makes a
small splash. Rings and droplets are each one thin-instanced mesh (one draw
call each), recycled. Under the surface the view keeps its tinted haze (scene
fog, which the shader applies too), and the surface seen from below is a
rippling ceiling in the water's own colour, brighter straight up where the sky
shows through.

**Volume**: every liquid keeps its see-through volume box for side views (the
Training Range's tank behind glass, a pool's wall); for water and swamp it has
no top, so the surface shader alone colours the water seen from above. Same two
draw calls per body as the old material (surface and volume).

**Cost** (measured with SwiftShader in headless Chromium, so frame times are
relative): see the table in the change notes below.

## Jetpack (pickup)

`core.jetpack` straps a jetpack on: hold jump in the air to fly. A full tank
lasts 4 s of thrust and refills in 6 s while you aren't thrusting; the HUD
shows a fuel gauge and other players see the flame. You lose it when you die.
It respawns 45 s after it's taken.

## Sky Islands

The showcase map for all of this (`maps/sky_islands.json`, built by
`packages/server/src/tools/maps/sky_islands.ts`): five grassy islands made of
blocks floating over snowy peaks, crumbling stepping-stone bridges, one plank
bridge that holds, a swimming pond sunk into the centre island, a lava pit
under four trapdoors guarding the railgun, breakable cover, two jetpacks, and
a jump pad up to a sky platform with double damage.

## Map scripts

```ts
m.block([x, y, z], [width, thickness, depth], 'crumble', { material: 'pbr_castle_stone', delay: 0.9, respawn: 6 });
m.block([x, y, z], [2, 0.4, 6], 'solid', { pitch: 0.35 }); // a 20° ramp (radians)
m.block([x, y, z], [3, 0.3, 4], 'trapdoor', { trigger: 'logic', id: 'trapdoor_1' }); // sprung by a rule's block_drop
m.water([x, y, z], [width, depth, length], 'water', '#3a4a2a'); // murky sewer water
m.light([x, y, z], { fixture: 'bulb', color: '#ff3020', id: 'lamp_alarm', blink: 3 });
m.block([x, y, z], [3, 0.3, 3], 'solid', { id: 'lift_1' });
m.mover('mover_lift', [x, y, z], ['lift_1'], [[0, 0, 0], [0, 4, 0]], { speed: 2, wait: 2 });
m.field([x, y, z], 3, 3, { yaw: Math.PI / 2, id: 'field_lab', hidden: true }); // a force field across a doorway, raised by logic
m.gravityZone([x, y, z], [15, 8, 15], 0.35); // a third of normal gravity
m.light([x, y, z], { fixture: 'sign', text: 'NOODLES', color: '#ff4fd8', id: 'sign_1' }); // a neon sign logic can switch
m.mover('train', [x, y, z], ['train_cab', 'train_deck'], [[0, 0, 0], [120, 0, 0]], { speed: 9, props: ['train_loco', 'train_flatbed'] }); // models ride along (not solid)
m.pickup('jetpack', [x, y, z]);
```
