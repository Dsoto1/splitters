# The Spillway rebuild: the MapMaker driver (work in progress; this folder does not land)

Kept on the `wip/mapmaker-spillway-2` branch only, so the work survives a lost container; it is removed before the
map lands (CLAUDE.md, "Maps": no map build scripts in the repo). Scratch Playwright scripts that work the real
MapMaker of a `vite preview` build as a person does (copy them to `e2e/` as `.<name>-local.mjs` to run them; they
import each other by those names):

- `spill-lib`: open and import, export, the overhead camera, inspector rows, placing with a tool.
- `spill-shape`: the designed ground (a height function: the gorge, benches, river, knolls, the lake's bend).
- `spill-a0`: the old map's contents deleted, a new 320 m terrain.
- `spill-a1`: the Flatten brush dabbed at typed heights where the ground is off the design (run coarse, then fine).
- `spill-a1b`: the playable boundary out to the new ground.
- `spill-a3`: Smooth all, the paint (river gravel and mud, yard dirt, lake-shore moss, rock on steep faces), the
  water, the dam's three blocks and the intake towers.
- `spill-fix`: flatten a stray spike. `views`: pictures from given cameras.

State (2026-11-11): `maps/the_spillway.json` is the checkpoint after `spill-a3` and one spike fix: terrain, water and
the dam only. No spawns yet, so it does not validate or play; the owner has the checkpoint pictures.
