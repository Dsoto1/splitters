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

## Still-camera baseline (the one to compare against)

Taken on 2026-11-14 from a build of main at `7129e8f` (Tileset 11's set pieces landed; none of these four maps places an urban piece), with `PERF_STILL=1 node tools/perf/client-perf.mjs riot_junction neon_spire ironworks frost_basin` at medium and at low (`PERF_GRAPHICS=low`), **each run twice**, in headless Chromium on the software renderer of the same 4-core container while another job used it.

**How:** `docs/PERF_TOOLS.md`, "A map's render counts, repeatably". In short: the deterministic match with every other player taken out and effects left out, the game's own camera held at four viewpoints worked out from the map file (two overviews from opposite corners, two at eye height: from the spawn nearest the middle and from the one farthest from it), each read once its counts stop changing. The two tables above stay as the record of why this was needed; **do not compare a still-camera run against them** (no bots here, and other views).

**Medium graphics** (one value: both runs read the same; two: run 1 / run 2)

| Map | View | Draw calls | Meshes drawn | All meshes | Triangles drawn (M) | Shadow casters | Materials |
|---|---|---|---|---|---|---|---|
| riot_junction | overview SW | 577 / 575 | 1419 | 2404 / 2408 | 1.290 / 1.281 | 322 / 312 | 590 |
| riot_junction | overview NE | 568 | 1425 | 2398 | 1.304 | 88 | 590 |
| riot_junction | eye, middle spawn | 380 | 547 | 2453 | 0.849 | 333 / 335 | 596 |
| riot_junction | eye, far spawn | 565 | 1402 | 2444 | 1.380 | 123 | 596 |
| riot_junction | **mean of 4** | 523 / 522 | 1198 | 2425 / 2426 | 1.206 / 1.204 | 217 / 215 | 593 |
| neon_spire | overview SW | 393 / 394 | 614 | 1222 / 1273 | 0.321 | 346 / 350 | 501 / 556 |
| neon_spire | overview NE | 390 / 392 | 604 | 1228 / 1244 | 0.325 | 344 / 347 | 501 / 556 |
| neon_spire | eye, middle spawn | 154 / 155 | 148 / 149 | 1237 / 1253 | 0.198 | 380 | 501 / 556 |
| neon_spire | eye, far spawn | 377 | 556 | 1237 / 1253 | 0.326 | 367 | 501 / 556 |
| neon_spire | **mean of 4** | 329 / 330 | 481 | 1231 / 1256 | 0.292 / 0.293 | 359 / 361 | 501 / 556 |
| ironworks | overview SW | 135 | 230 | 943 | 0.201 | 300 | 333 |
| ironworks | overview NE | 160 | 249 | 943 | 0.185 | 295 | 333 |
| ironworks | eye, middle spawn | 128 | 198 | 946 | 0.170 | 299 | 333 |
| ironworks | eye, far spawn | 136 | 232 | 949 | 0.199 | 296 | 333 |
| ironworks | **mean of 4** | 140 | 227 | 945 | 0.189 | 298 | 333 |
| frost_basin | overview SW | 200 | 300 | 988 | 0.692 | 36 / 41 | 479 |
| frost_basin | overview NE | 201 | 301 / 300 | 988 | 0.763 | 21 / 19 | 479 |
| frost_basin | eye, middle spawn | 163 / 158 | 144 | 995 | 0.480 | 294 / 283 | 479 |
| frost_basin | eye, far spawn | 220 / 218 | 298 | 995 | 0.813 / 0.812 | 29 / 26 | 479 |
| frost_basin | **mean of 4** | 196 / 194 | 261 | 992 | 0.687 | 95 / 92 | 479 |

Rows that did not settle in time: 0.

**Low graphics** (one value: both runs read the same; two: run 1 / run 2)

| Map | View | Draw calls | Meshes drawn | All meshes | Triangles drawn (M) | Shadow casters | Materials |
|---|---|---|---|---|---|---|---|
| riot_junction | overview SW | 525 | 1419 | 2305 / 2303 | 1.135 | 0 | 586 |
| riot_junction | overview NE | 512 | 1425 | 2301 | 1.140 | 0 | 586 |
| riot_junction | eye, middle spawn | 303 | 548 | 2316 | 0.554 | 0 | 589 |
| riot_junction | eye, far spawn | 497 | 1402 | 2311 | 1.148 | 0 | 589 |
| riot_junction | **mean of 4** | 459 | 1199 | 2308 | 0.994 | 0 | 588 |
| neon_spire | overview SW | 344 | 614 | 1194 | 0.277 | 0 | 498 |
| neon_spire | overview NE | 343 | 604 | 1200 | 0.268 | 0 | 498 |
| neon_spire | eye, middle spawn | 96 | 148 | 1200 | 0.118 | 0 | 498 |
| neon_spire | eye, far spawn | 321 / 322 | 555 / 556 | 1200 | 0.259 | 0 | 498 |
| neon_spire | **mean of 4** | 276 | 480 / 481 | 1199 | 0.231 | 0 | 498 |
| ironworks | overview SW | 130 | 230 | 927 | 0.105 | 0 | 331 |
| ironworks | overview NE | 138 | 231 | 927 | 0.110 | 0 | 331 |
| ironworks | eye, middle spawn | 115 | 190 | 930 | 0.088 | 0 | 331 |
| ironworks | eye, far spawn | 132 | 232 | 933 | 0.106 | 0 | 331 |
| ironworks | **mean of 4** | 129 | 221 | 929 | 0.102 | 0 | 331 |
| frost_basin | overview SW | 189 | 297 | 793 | 0.592 | 0 | 467 |
| frost_basin | overview NE | 184 / 185 | 296 / 297 | 793 | 0.591 | 0 | 467 |
| frost_basin | eye, middle spawn | 130 | 141 | 783 | 0.348 | 0 | 470 |
| frost_basin | eye, far spawn | 190 | 295 | 783 | 0.574 | 0 | 470 |
| frost_basin | **mean of 4** | 173 / 174 | 257 / 258 | 788 | 0.526 | 0 | 469 |

Rows that did not settle in time: 0.

**How well the two runs agree** (16 view rows a setting; every row settled in both runs):

| Count | Low graphics | Medium graphics |
|---|---|---|
| Draw calls | the same on 14 rows; the other 2 differ by 1 (0.5%) | the same on 10 rows; the other 6 differ by 1 to 5 (worst 3.1%: frost_basin, eye at the middle spawn, 163 and 158) |
| Meshes drawn | the same on 14; 2 differ by 1 | the same on 14; 2 differ by 1 |
| Triangles drawn | the same on all 16 | the same on 14; worst 0.7% (riot_junction, overview SW) |
| Shadow casters | none at low | the same on 8; the rest differ by 2 to 11 casters (worst 12%: frost_basin, overview SW, 36 and 41) |
| All meshes in the scene | the same on 15; 1 differs by 2 | the same on 11; worst 4% (neon_spire: 1222 and 1273) |
| Materials in the scene | the same on all 16 | the same on 12; neon_spire reads 501 and 556 |

Each map's mean of four views agrees within 1% on draw calls (medium: 523 and 522, 329 and 330, 140 and 140, 196 and 194) and within 0.4% on triangles. The live sampling above moved by 20 to 50% on the same maps.

**What still varies, and why.**
- **Shadow casters, and a few draw calls with them (medium only).** The shadow pass draws its static casters only on the frames its cache refreshes and the moving ones on every frame (`atmosphere.ts`, `shadowCache.ts`), so frames at one view differ, and a row reads its middle frame. Which frames fall in the window differs between runs. This is read from the code, not traced frame by frame. Low graphics has no shadows and repeats to a draw call.
- **All meshes and materials (neon_spire at medium).** These count everything in the scene, drawn or not. The likely cause is how many bots' characters and looks were built before they were taken out, which depends on how fast the page loaded; it is not established. They do not change what is drawn (meshes drawn and triangles agree).
- **A model that arrives late.** In an earlier pair of runs, taken under heavier load before the tool waited for a view's models, one view read 13% fewer triangles on the same draw calls (neon_spire, eye at the middle spawn: 0.118 M and 0.102 M at low). The tool now gives each view up to 20 s for its models and textures first; with that the pair above agrees. On a machine slow enough to pass 20 s it could happen again: a row whose triangles moved with no change in draw calls is that.

**Using it.** Run both builds on the same machine. A difference under about 3% in draw calls, or under 1% in meshes drawn or triangles, is nothing; shadow casters are a rough count. A change that adds content to a view shows as more meshes drawn and triangles on that view's row.

**Not in these numbers:** players, bodies, gunfire and effects (flames and particles are left out; `PERF_STILL_FX=1` keeps them at the price of a few percent of noise), frame rate, memory, load time, and a real graphics card or a phone.
