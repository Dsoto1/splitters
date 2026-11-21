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

## Body pool (2026-11-17)

The owner's answer to the body-builds question ("recs"): keep about 32 spare bodies in big matches, measured first. A
helper of lane B's splitters22, on `wip/farlooks-bodypool`. `game/bodyPool.ts`: a match keeps 16 bodies in all, as
before, until more than 32 other players are drawn; then one for every two players, up to 32 (two a look, as before).
`?perfoff=bodypool` keeps 16 in every match. The probe counts the pool (`window.__bodyPool`: bodies built for an avatar,
taken from the pool, put in it, thrown out when it was full) over its measured steps, and `PROF_POOL=<n>` sets the size
for a comparison.

Flavius Rule, 64 bots, the production build, `PROF_STEPS=alloc,heap PROF_WARM=60 PROF_SECONDS=150` (one load each, the
same build; the window is the allocation profile's 150-190 s):

| Pool in all | Bodies built | Taken from the pool | Thrown out (pool full) | Built a minute | Respawns reusing a body | Heap after a collection | Allocation |
|---|---|---|---|---|---|---|---|
| 16 (`?perfoff=bodypool`) | 61 | 32 | 34 | **24** | 34 % | 635 MB | 5.5 MB/s |
| 24 (`PROF_POOL=24`) | 43 | 25 | 21 | 13 | 37 % | 646 MB | 4.8 MB/s |
| **32** (the rule) | 33 | 34 | 12 | **13** | **51 %** | 648 MB | 5.3 MB/s |

32 roughly halves the body builds a minute (each 10-25 ms after a frame and several MB of garbage) for about 13 MB
more heap after a collection: the character files' structure is shared, so a kept body costs well under 1 MB here.
24 cut the builds nearly as much in this run but reused fewer (its run was longer and slower; the counts swing with
how the match goes), and threw out a body every nine seconds. The rest of the respawns still build: a bot's own body
is still a corpse when it respawns (corpses stay up to 32, sinking after some seconds), and with about 60 looks in
play two bodies a look are not always that look's. The allocation rate moves with how many bodies a run builds and
with the match; compare the build counts, not the totals.

## Snapshot format (2026-11-19)

The last leftover: the match worker's snapshots, structured-cloned into new objects on the page 30 times a second
(`?perfoff=snapbin` is that). Lane F, on `wip/fable-snapshot-binary`. The format, its versioning and its fallbacks
are in docs/MULTIPLAYER_PROTOCOL.md, section 22.

**Measured first: where a snapshot crosses a boundary, and what it costs there.**

| Boundary | Form before | Cost at 64 players (Flavius Rule, Team Deathmatch) |
|---|---|---|
| Match worker → its own page (offline, MapMaker TEST, the host's own view) | objects, structured clone | 14.1 KB a message; **55 KB of new objects a snapshot on the page, 1.2-1.6 MB a second** |
| Host → a friend (browser host, Host Service, dedicated server) | delta JSON (`net/interest.ts`), deflated | 4.3 KB of text, **580 B on the wire, 17 KB a second** |
| Hub | never sees gameplay messages | none |

So the garbage is the local boundary's, and the network already sends a thirtieth of the clone's size. The binary
message deflated on a friend's link would be 1,077 B a snapshot (it has no deltas; floats compress badly): worse
than what is sent today. The binary format is therefore used between the worker and its page only, and networked
play is unchanged.

**What changed.** The worker writes the snapshot into a pooled `ArrayBuffer` and transfers it (no copy); the page
reads it into a ring of reused player objects and rows, keeps the lists that didn't change, and hands the buffer
back. Nothing is rounded: every number is the sim's own.

**Before and after**, `pnpm --filter @tiletrigger/server snapshot-bench` (new; the same 900 snapshots of a 64-bot
match both ways, V8's own structured-clone serialiser for "before", on the shared 4-core box):

| | Objects (structured clone) | Binary |
|---|---|---|
| Message size | 14,062 B (as JSON text: 12,236 B) | 8,822 B |
| Writing it, in the worker | median 0.054 ms, p95 0.083 ms | median 0.023 ms, p95 0.029 ms |
| Reading it, on the page | median 0.087 ms, p95 0.119 ms | median 0.008 ms, p95 0.020 ms |
| New objects on the page, a snapshot | 55 KB | 4.5 KB |
| ... a second (30 snapshots) | **1.58 MB** | **0.13 MB (-92 %)** |

What is left on the page is the message object itself, the views of the buffer, private state and events (parsed
afresh, on purpose) and a score or pickup list when it changes. Read into new objects instead of the ring, the same
messages make 38 KB a snapshot, so most of the saving is the reuse. With vehicles moving (the coverage map, 24
bots, Capture the Flag) it is 31 KB a snapshot before and 12 KB after: moving vehicles' rows and the mode's state
are new each time.

**In the game**, the probe as above (`PROF_STEPS=alloc PROF_WARM=60 PROF_SECONDS=40`, the production build, Flavius
Rule, 64 bots, one load each; "before" is the same build with `PROF_QUERY=perfoff=snapbin`):

| Allocator | Before | After |
|---|---|---|
| The worker's message handler (the structured clone) | 0.77 MB/s | 0.008 MB/s |
| The binary reader (`read`, `readRows`, `parse`, `intern`) | none | 0.023 MB/s |
| **Snapshot messages in all** | **0.77 MB/s** | **0.03 MB/s** |

(0.77 here against the 1.2 of the earlier runs: the heap profiler samples, and the object sizes differ a little
between V8's serialiser in Node and the page's.) The totals of the two loads were 8.6 and 4.2 MB a second, but they
moved with the match, as before: the "before" load built more bodies, the "after" load delivered more snapshots
unmerged, which shows as more in `Interpolator.push` (0.11 and 0.32 MB a second; on identical snapshots the bench
finds its allocation the same for cloned and binary-read ones, 21.3 KB a push). Compare the items.

**Bundle.** The reader and writer are in the match's chunk and the worker's, not in the menu's first JS (2,651.7 kB
with this change; budget 2,800).

**Not measured:** frame time and GC pauses on a real GPU (SwiftShader here), and Safari or Firefox (the bench is
V8's, the probe Chromium's).

## Left for later

- **Body builds per death.** Done 2026-11-17 ("Body pool" above): up to 32 kept bodies in a big match, half the builds.
- **The snapshot message format.** Done 2026-11-19 ("Snapshot format" below): binary messages from the match worker,
  read into reused objects; the item drops from 0.8-1.2 MB a second to about 0.03.
- **Frame time on a real GPU.** The owner's next recording on Flavius Rule shows what the smaller heap does to the
  swings and to GC pauses. The F3 overlay's `memory` line and the recording's `heapMB` column read it.
- **The probe.** `tools/perf/match-profile.mjs` (`PROF_*` settings at its top); `PROF_DIST=dist-prof` serves an
  unminified build (`vite build --minify false --outDir dist-prof`) so profiles name functions. A full heap snapshot of
  a 1 GB heap ran the renderer out of memory on this box, which is why it samples instead.
