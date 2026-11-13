# Tileset 11: performance baseline before any building

Taken on 2026-11-13 from a build of main at `6dcff3d` (after the tunnel kit, before any urban piece), as the owner's guide asks (section 4, "baseline performance metrics before edits"; the plan's decision 7a).

**How:** `pnpm build`, then `tools/perf/client-perf.mjs` with `PERF_BOTS=32 PERF_SECONDS=8`, Team Deathmatch, at medium and low graphics, in headless Chromium on the software renderer (SwiftShader) of a 4-core cloud container, while another job was using the machine.

**How to read it (corrected after the second run below):** these are samples of a live 8-second bot match from wherever the camera's player happens to be, so draw calls, meshes drawn, triangles and shadow casters **move a lot from run to run on an unchanged map** (see the second table: Riot Junction's draw calls at low graphics read 344 and then 164). A single run per map cannot show that a change cost nothing or something; it shows the order of magnitude. To compare properly, fix the view (a still camera, no bots) or average several runs. **The frame rates do not predict play:** the software renderer runs at about one frame a second. Load is seconds to a playable scene on this machine. No memory figure was taken (the script does not report one).

| Map | Graphics | Draw calls | Active / all meshes | Triangles drawn | Lights | Shadow casters | Materials | Load (s) |
|---|---|---|---|---|---|---|---|---|
| riot_junction | medium | 544 | 776 / 4462 | 1.24 M | 3 (+128 clustered) | 259 | 875 | 5.6 |
| neon_spire | medium | 384 | 340 / 2671 | 0.37 M | 3 (+72 clustered) | 487 | 760 | 5.2 |
| ironworks | medium | 248 | 287 / 2874 | 0.50 M | 2 (+0 clustered) | 378 | 619 | 5.2 |
| frost_basin | medium | 238 | 230 / 1342 | 0.61 M | 3 (+3 clustered) | 66 | 693 | 4.7 |
| riot_junction | low | 344 | 628 / 4296 | 0.76 M | 3 (+128 clustered) | 0 | 872 | 4.9 |
| neon_spire | low | 260 | 380 / 2273 | 0.30 M | 3 (+72 clustered) | 0 | 807 | 4.1 |
| ironworks | low | 163 | 240 / 2690 | 0.23 M | 2 (+0 clustered) | 0 | 620 | 4.3 |
| frost_basin | low | 221 | 253 / 1143 | 0.44 M | 3 (+3 clustered) | 0 | 764 | 4.0 |

**The build itself:** 2,556.6 kB of script, 729.3 kB gzip (`tools/ci/bundle-budget.mjs`; the budget is 2,800 kB and 800 kB gzip); the built site is 414 MB with all models, textures and sounds.

**Not taken:** frame rate, memory and load time on a real graphics card or a phone; a 64 or 96 player run.

## The same table after Tileset 11's first build

Taken on 2026-11-13 from a build of `wip/mapmaker-urban-1` just before it landed (Style Pack 14, map format v38; no map uses the new pieces, so none of these four maps changed). Same command, same machine, one run.

| Map | Graphics | Draw calls | Active / all meshes | Triangles drawn | Lights | Shadow casters | Materials | Load (s) |
|---|---|---|---|---|---|---|---|---|
| riot_junction | medium | 425 | 667 / 4360 | 0.97 M | 3 (+128 clustered) | 209 | 799 | 4.0 |
| neon_spire | medium | 392 | 375 / 2411 | 0.45 M | 3 (+72 clustered) | 539 | 826 | 4.4 |
| ironworks | medium | 220 | 274 / 2771 | 0.33 M | 2 (+0 clustered) | 339 | 591 | 4.4 |
| frost_basin | medium | 299 | 297 / 1379 | 0.68 M | 3 (+3 clustered) | 83 | 779 | 4.2 |
| riot_junction | low | 164 | 259 / 4273 | 0.36 M | 3 (+128 clustered) | 0 | 872 | 4.0 |
| neon_spire | low | 234 | 348 / 2486 | 0.32 M | 3 (+72 clustered) | 0 | 859 | 4.4 |
| ironworks | low | 160 | 238 / 2459 | 0.21 M | 2 (+0 clustered) | 0 | 558 | 4.2 |
| frost_basin | low | 220 | 257 / 1130 | 0.46 M | 3 (+3 clustered) | 0 | 704 | 4.0 |

**What it shows:** the differences from the first table go both ways (Riot Junction and Ironworks lower, Neon Spire and Frost Basin higher at medium) on maps that did not change, which is the sampling noise described above, not an effect of Tileset 11. Load times are 4.0 to 4.4 s against 4.0 to 5.6 s before. **It does not establish** that the pack costs nothing; it could not, with one run each. What is known from the build itself: the script bundle is unchanged at 729.3 kB gzip, and no playable map places a new piece.

**Before the next comparison:** make the measurement repeatable first (a fixed camera and no bots, or the mean of several runs).
