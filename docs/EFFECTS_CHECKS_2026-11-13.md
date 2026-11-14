# Checks on the week's Binbun effects (2026-11-13)

Findings only: no effect was changed. Loot glows (`game/lootGlow.ts`), the portal swirl and jump-pad lift
(`game/fixtureFx.ts`), status auras (`game/statusFx.ts`), all placed by `game/lastingFx.ts`.

How it was looked at: a `vite preview` build of main cff59ef plus this branch, headless Chromium on SwiftShader
(4 cores, about 1 fps), offline matches with the bots held still, the player moved to each spot, 6 s waited, then a
picture and a count of the effect meshes that were enabled. Nothing here was seen on a real GPU. The pictures were
in the session's scratchpad and are not kept.

## 1. Pantry Raid's mouse-hole portals

- **With the pack's swirl drawn, the hole stops reading as a hole.** The pair colour is dark brown (`#3a2a1a`). The
  swirl comes out as a pale grey-brown smudge with a ragged white edge inside the brown frame, with Reduce flashing
  on and off alike. The painted swirl it replaces (a dark opening with a white spiral) reads clearly as a way
  through, at 5 m and at 16 m.
- Seen on medium at both holes. On low the south hole kept its painted swirl (no place for the effect) and looked
  better for it.
- With Reduce flashing off, the painted spiral shows faintly through the pack swirl while it comes up.
- **Options, for the owner (not done):** (a) leave the pack swirl off a portal whose pair colour is dark (a
  brightness threshold), so it keeps the painted swirl; (b) give the mouse holes a lighter pair colour in MapMaker;
  (c) leave it. Recommended: (a), since it fixes any dark pair on any map.

## 2. Armor and ammo rings on bright floors

Tried on The Spillway's crest (pale concrete in full sun) in a scratch copy with six pickups placed in MapMaker.

- **Confirmed: the armor (blue) and ammo (pale) rings nearly vanish.** With Reduce flashing on they are a thin grey
  line round the pickup's shadow. With it off the turning streaks help a little.
- Health (a green disc) and weapons (a gold disc) read well on the same floor, on and off.
- Rough contrast of the ring's brightest pixels against the floor, from hand-placed sample boxes in the pictures:
  armor about 1.25:1 calm and 1.45:1 moving, ammo 1.15 to 1.4:1 calm and 1.6:1 moving. The green and gold discs
  carry colour as well as brightness, which is why they read.
- On Pantry Raid's dark wood floor the same blue ring is clear.
- **Options (not done):** a filled disc for armor and ammo like health and weapons; a darker rim under the ring; a
  more saturated blue and a tan for ammo. Any of them changes the look, so it is the owner's call.

## 3. `pnpm perf:budget`

Passed (exit 0) on Frost Basin, medium and low.

| | Medium | Low | Limit |
|---|---|---|---|
| Slowest effect start | 3.8 ms (arc) | 1.2 ms (sentry charge) | 40 ms |
| Draw calls, clumped frames | 328 | 147 | 900 |
| Shadow casters | 28 | 0 | 600 |
| Shaders built after the loading gate | 0 | 1 (`default`) | reported |

Its list times the starts of `loot.ammo`, `loot.armor`, `loot.health`, `loot.weapon`, `pad`, `portal`,
`status.burn`, `status.chill`, `status.poison` and `status.slow`: all 0 ms, on both levels. The run drew 0.1 to
1.8 fps here, so the frame times in it say nothing.

## 4. Who gets a place: low and medium graphics

The looping-effect caps are 4 (low), 10 (medium), 16 (high), counted in loops, and one effect uses several.
Measured on Pantry Raid, which asks for 2 portals, 3 pads, up to 8 glows and 2 fire traps at once:

| Standing at | Medium (10 spots) | Low (10 spots) |
|---|---|---|
| A portal's swirl drawn | 10 of 10 | 3 of 10 |
| A pad's lift drawn | 5 of 10 | 1 of 10 |
| The glow of the pickup 3.5 m in front | 3 of 6 | 1 of 6 |
| Nothing drawn at all | 0 | 3 |

- **A burning fire trap never gives its place up.** It is in the first tier ("effects of the moment") although it
  burns all match. On low one fire trap alone often holds all four loops, so portals, pads and glows show their
  plain look for most of the map.
- **Fixtures outrank glows whatever the distance.** A portal within 60 m or a pad within 36 m keeps its place while
  the pickup at your feet goes without: on medium the shotgun and two ammo pickups had no glow from 3.5 m.
- On low, at three spots nothing was live yet no loop was free. What held them was not found.
- An earlier pass, where the test threw the bots off the map so they respawned without end, had their spawn
  shields take every place (first tier, within 70 m). That was the test's doing, but a busy match on a small map
  will do some of the same.
- "High" behaved like medium in this browser; not looked into.
- **Options (not done):** count a permanent fire trap as a fixture; weigh fixtures by distance against a glow within
  a few metres; report loops per effect so the low cap can be judged.

## 5. Status auras in daylight

Three bots 3.5 m away on the sunlit crest (burning, poisoned, slowed), a fourth burning beside them.

- Medium and low both drew all three auras (3 effects; 7 loops free on medium with Reduce flashing on, 1 on low).
- **Burning reads well** in sun on every setting.
- **Poison and goo are faint in daylight with Reduce flashing on**: a light green haze and a trace of pink. With it
  off the green haze is clear; the pink stays faint.
- The fourth character, past the three-aura limit, wears the plain shell: a flat see-through yellow slab the size
  of its box, which looks like a placeholder next to the three auras.
- Chilled and frozen were not staged. Multiplayer was not checked.

## Not done
- The flicker check (`E2E_ONLY=flashing`) was not re-run: nothing was changed.
- No real GPU, no phone.
