# Flavius Rule: memory and frame time, 2026-11-16

A helper of lane B's splitters22, on `wip/flavius-memory`. It follows the owner's three recordings of 2026-11-16 (QUEUE
Bugs, "Memory and frame time on Flavius Rule": M1 Pro, 65 players, about 39 fps, a heap of 1.9 GB at the start that
swings from 1.2 to 2.9 GB). The texture climb in those recordings was the character leak (`wip/char-leak`, landed).
This round covers HANDOFF item 4's other three parts: what the heap holds, animation by distance, and the garbage.

**How it was measured.** Offline Team Deathmatch on Flavius Rule (`sandfall_colosseum`) with 64 bots (60 to 64
characters drawn), Medium graphics, headless Chromium on SwiftShader at 480x270, on a shared 4-core box. A new probe,
`tools/perf/match-profile.mjs`, runs the steps one after another in a single page:

- **Live heap by allocation site.** V8's sampling heap profiler runs from page load to the end of a 60 s warm-up and
  keeps only live objects.
- **Census.** The distances of the characters in view, sampled four times a second for 30 s. From them,
  `tools/perf/anim-census.mjs` counts the character evaluations a second the animation LOD would make at 39 and 60 fps.
  It counts with the game's own `animLod.ts`, so nothing is timed.
- **Frame split, CPU profile and allocation profile**, 30 s each.
- **Heap after a full collection**, with the engine's counts and the CPU-side geometry the engine keeps.

Every saving has its own `?perfoff=` switch, so "before" is the same build with all six switches off and "after" is the
same build with them on.

SwiftShader draws a frame in 1.4 to 4 s here, so frame rate and per-frame times mean nothing in these runs (a 30 s window
holds 11 to 19 frames). These results rest on the heap, the allocation rate, the census and GC time.

## What the heap holds (before)

After a full collection the heap was **1.06 to 1.11 GB**, measured on four separate loads of the match. The owner's
fresh tab read 1.9 GB; that build and the GPU differ from these runs, so compare the shares, not the totals.

The sampled live set covers about 0.73 GB of it. By owner:

| What | MB | How it was found |
|---|---|---|
| **Babylon's per-vertex picking points on character meshes.** Every clone of a skinned mesh refreshes its bounds through the skeleton, and that refresh also builds one `Vector3` per vertex, the cache Babylon's CPU picking and collisions read. Every body part of every body carries one, and so do the character files' own meshes. Bodies are never picked that way. | **about 190** | live samples in `_getData` under `refreshBoundingInfo`: 110 MB from body instancing, 82 MB from the glTF loader |
| **The merged level's vertex data**, kept as plain number arrays (8 bytes a coordinate) | **about 110** | the geometry walk: `map_merged_*` 4 x 27-28 MB |
| **The shadow proxies' triangles**, kept in the page after upload as plain number arrays | **about 85-95** | the geometry walk: `shadowProxy_*` 4 x 21 MB; the heap is 94 MB smaller with only this saving on |
| Characters' structure: bones, nodes, matrices, observables, 4,800 animation groups for 129 skeletons | about 60-80 | live samples: `Bone`, `TransformNode`, `Matrix`, `Node`, `Observable` under body instancing and the loader |
| Prop fixtures, the level's merge, shaders' source (`ProcessIncludes`), effects physics | about 60 | live samples: `mergeFixtures`, `mergeGeometry`, `ProcessIncludes`, `EffectsWorld` |
| The rest: map props, nav and physics glue, the HUD, code | the remainder | |

The first three are copies that nothing reads, or copies kept in a format twice the size it needs, and together they
were **about 40 % of the heap**. Off the script heap there was also 108 MB of typed vertex data, 23 MB of indices and
45 MB of texture buffers. The GPU textures (1.35 GB estimated, flat) are on the graphics card, not in the heap.

## The fixes, before and after

The same build each time, switches off and then on. There are two such pairs, run at different times on the same box:
the unminified build with five switches (`aurashare` came later), and the production build with all six.

| | Before (switches off) | After (on) |
|---|---|---|
| Heap after a full collection | 1,114 MB / 1,059 MB | **653 MB / 651 MB (-41 % / -38 %)** |
| Number-array vertex data | 230 MB | **20-24 MB** |
| Typed vertex data (off the script heap) | 108-115 MB | 166-171 MB (the level's data as 32-bit floats) |
| Sampled live set | 726 / 794 MB | 291 / 281 MB |
| GC time (CPU profile, ms a second) | 43 / 40 | **16 / 7.8** (noisy; same direction in both pairs) |

The fixes, each behind its own switch:

1. **`bodypoints`** (`content/pointCache.ts`, `content/characters.ts`). A body's files are cloned without the picking
   points: the clone's bounds refresh asks for `updatePositionsArray: false`, so the bounds come out the same and the
   cache is never built. The character files' own meshes have theirs dropped once loaded. This saves **about 190 MB** of
   live objects. It also removes about 40 % of a body build's garbage: in the allocation profile, `_getData`'s
   1.1 MB a second in body instancing is gone. Bodies keep `isPickable` off, and a pick that ever wants the points
   rebuilds them from the geometry (tested).
2. **`proxydata`** (`game/shadowProxy.ts`). The shadow proxies keep no copy of their triangles once uploaded
   (`Geometry.clearCachedData`; bounds and counts are kept). A rebuild starts again from the sources. **-94 MB.** One
   catch: if the WebGL context is lost and restored, Babylon recreates these buffers empty, so the static shadows would
   be missing until the next rebuild.
3. **`leveldata`** (`levelMerge.ts`). The merged level's positions, normals and UVs are kept as `Float32Array`, with
   16-bit indices where they fit. That is half the size and outside the script heap: **-110 MB of heap, +55 MB of
   typed data**. The shadow proxies and other readers still read them.

## Animation by distance (`animcrowd`)

The round-4 bands (`animLod.ts`) give every character in view a rate by its own size on screen, however many characters
are in view. In an arena much of the match is in sight at once.

The new rule only applies in a crowd (more than 24 players in the match and more than 8 characters in view). The
nearest 8 keep their bands. The others step one rung down the rate ladder (every frame, 30, 20, 15, 10, 5 Hz), and from
the 24th nearest, two rungs. Each slowed character is smoothed between evaluations and keeps its band's own after-clip
detail. Anyone nearer than about 8 m is never slowed. The rule makes no garbage, because its steps are made once.

Character evaluations a second, from the census of each run (the same samples counted both ways):

| Run (characters in view on average) | Bands alone at 39 fps | With the crowd rule | At 60 fps |
|---|---|---|---|
| unminified, before (17.6) | 155 | **120 (-23 %)** | 234 → 181 |
| unminified, after (25.7) | 383 | **309 (-19 %)** | 585 → 472 |
| production, before (11.2) | 100 | **76 (-24 %)** | 151 → 114 |
| production, after (11.0) | 173 | **151 (-13 %)** | 266 → 230 |

Clip evaluation and the after-clip aim were 4.9 to 7.3 ms a frame in the owner's traces. If that time scales with
evaluations, the rule saves roughly 1 to 1.5 ms a frame in a crowd. The saving is smallest when the crowd is near
(nothing within 8 m is slowed) and largest when the stands are full in front of you.

## The garbage (`netgarbage`, `aurashare`)

In these runs the steady garbage was 5 to 10 MB a second. Body builds (one per respawn that finds no kept body of
its look) and snapshot handling made most of it, and the rest were per-frame allocations in Babylon's animation and
material code. The largest items, from the allocation profile before the fixes:

| Allocator | MB a second | |
|---|---|---|
| Body instancing (Babylon bounds refresh through the skeleton) | 2.9 | `bodypoints` removes the per-vertex points (1.1). The skinned bounds (`ApplySkeleton`, 0.8) stay. |
| Snapshot messages from the match worker (structured clone) | 1.2 | the message format; not changed here |
| `Interpolator.push` | 0.8 | **`netgarbage`**: snapshots are filed in place, without a two-element array per player and per projectile (-0.2 to -0.3) |
| The status aura's cylinder and sphere, built afresh for every new avatar (spawn protection is a status) | 0.37 | **`aurashare`**: the shapes are made once a scene and shared; drops out of the profile |
| Babylon's clip evaluation (`_setValue`, `_interpolate`) and shader defines, inside `scene.render` | 0.5 at under 1 fps | grows with frame rate; the crowd rule cuts the clip part |

The total allocation rate moves with how many bodies a run happens to build, so compare the items, not the totals.

## Left for later

- **Body builds per death.** With 64 players and a pool of 16 kept bodies (`BODY_POOL_TOTAL`), most respawns build a
  new body while the old one still lies as a corpse: 10-25 ms and several MB of garbage per death. A bigger pool
  would mean fewer builds and more memory (see the question in the report).
- **The snapshot message format.** Structured-cloned objects come to 1.2 MB a second at 64 players; a binary snapshot
  would remove most of it.
- **Frame time on a real GPU.** The owner's next recording on Flavius Rule shows what the smaller heap does to the
  swings and to GC pauses. The F3 overlay's `memory` line and the recording's `heapMB` column read it.
- **The probe.** `tools/perf/match-profile.mjs` (`PROF_*` settings at its top); `PROF_DIST=dist-prof` serves an
  unminified build (`vite build --minify false --outDir dist-prof`) so profiles name functions. A full heap snapshot of
  a 1 GB heap ran the renderer out of memory on this box, which is why it samples instead.
