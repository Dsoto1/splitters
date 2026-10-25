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
| Trapdoor | trapdoor | Swings down on its hinge almost at once (0.15 s). With *Set off by: logic only* it waits for a rule's **destroy** action, for traps you spring from a button or zone. |

Broken, crumbled and dropped blocks come back after *Back after* seconds
(8 s by default; untick *Comes back* to make it permanent), but never on top of
someone. Players learn them by their rim: **amber** crumbles, **red** drops,
**grey** breaks. In logic, a block falling or breaking fires **destroyed**
like any other breakable.

Breakable, crumbling and trapdoor blocks are part of the bots' navmesh while
they stand, so bots will cross a crumbling bridge (and sometimes fall).

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
m.water([x, y, z], [width, depth, length], 'lava');
m.pickup('jetpack', [x, y, z]);
```
