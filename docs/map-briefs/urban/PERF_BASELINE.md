# Tileset 11: performance baseline before any building

Taken on 2026-11-13 from a build of main at `6dcff3d` (after the tunnel kit, before any urban piece), as the owner's guide asks (section 4, "baseline performance metrics before edits"; the plan's decision 7a).

**How:** `pnpm build`, then `tools/perf/client-perf.mjs` with `PERF_BOTS=32 PERF_SECONDS=8`, Team Deathmatch, at medium and low graphics, in headless Chromium on the software renderer (SwiftShader) of a 4-core cloud container, while another job was using the machine.

**How to read it:** draw calls, meshes, triangles, shadow casters and materials are properties of the scene and compare cleanly before and after. **The frame rates do not predict play:** the software renderer runs at about one frame a second. Load is seconds to a playable scene on this machine. No memory figure was taken (the script does not report one).

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

To compare after a change: the same command on the same maps, and the same table.
