# Tile Trigger queue

This is the short list of what is happening and what comes next. Both accounts keep it current.

HANDOFF.md keeps the detail and the history (Landed notes, claims, lock lines). This file is the one the owner reads. The owner set it up on 2026-11-13.

## How to use it

**Lanes**
- **A** is this account's lead session and its helpers: Opus 5.5 at medium effort, never Fable (owner, 2026-11-13).
- **B** is the other account's MapMaker lane, the main session for the week.

**One line per item:** `size · lane · item · branch or plan`.

**Sizes**
| Size | Meaning |
|---|---|
| XS | under an hour |
| S | one small landing |
| M | one landing, real design |
| L | several landings or a plan |

**Rules**
- Bugs and broken gameplay go to the top of "Bugs".
- New ideas go to the end of "Features" or "Parked", unless the owner bumps them (owner rule, 2026-11-08).
- Move an item to "Done" in the same commit that lands it. Keep "Done" to the last week; older items live in HANDOFF and CHANGELOG.
- **Easy-win batches:** a free helper takes 3–5 easy wins and lands them together in one check run.
- Claims and the landing lock still live in HANDOFF. This file only lists.

## In flight
- M · A · Vehicle line-up: Supply Buggy (2 seats, full resupply at its tailgate), Troop Buggy (6), Gun Buggy (3), Armored Rover (7, front gun gone, rear gunner lowered), bots use the Supply Buggy, `buggy` retired on 19 maps · `wip/vehicles-buggy-split` · next to land
- M · A · Ammo Box: map Ammo Boxes become solid resupply crates (10 uses, cook-off); "Ammo Box Kit" throwable · `wip/ammo-box` · after the line-up
- S · A · Effects checks, findings only: Pantry Raid portals, loot rings on bright floors, perf and Low graphics for the new effects, Reduce flashing · `wip/fx-checks` (docs)
- S · B · Parachute, built in code: a round canopy of 16 panels on lines to risers behind the neck (the owner has seen it and keeps it: "Drop the meshy parachute"); now colour variants, one per player by slot · `wip/mapmaker-parachute` · `packages/client/src/game/canopyVisuals.ts`, the canopy lines in `view.ts` · lands after lane A's line-up

## Ready to land
- M · B · Tileset 11, step D: eight set pieces built in MapMaker (porch, bus shelter, parking deck bay, deck ramp, concrete frame of one and two storeys, bandstand, shop unit), with the arched window's neater stones · `wip/mapmaker-urban-setpieces` · built and locally checked

## Bugs
- S · A · Gun Buggy and Troop Buggy tires stand 0.3–0.4 m outside their collision boxes.
- S · A · The Spillway: bots snag on the long stair's landings (stuck recoveries about 70–88 a match).
- S · A · Heavy MG sits at upper-belly height on drawn characters and hides the ground about 6° under the crosshair.
- XS · A · Low graphics: a patch of painted ground cells beside a path end on St. John's (ground paint, not the path fix).
- ? · A · Unconfirmed: the player's own third-person body drawn in first person after a teleport. Check a normal portal and respawn first.
- ? · A · Unconfirmed: a large flat blue shape seen twice in software pictures (tunnels, The Spillway's long stair).

## Easy wins
- S · A+B · Pickup guns drawn 1.3–1.5x so they read at a distance (`pickupVisuals.ts`, beside the loot glows). Lane B agrees (2026-11-13): the glow's ring is sized to the pickup's footprint in `game/lootGlow.ts`, so check a bigger gun still sits inside it.
- XS · A · Vehicle palette pictures without tires.
- S · A · Steampunk Warrior's fingers.
- S · A · Flavius Rule's corners.
- S · A · Loot-ring and effect tweaks, from the effects-check findings once the owner picks.
- S · A · Mobile audit: Options in one column on phones (proposal 7).
- S · A · Mobile audit: Match Setup on phones, sticky header and bigger steppers (proposal 11).
- XS · A · Mobile audit: finer, lower-contrast terrazzo (proposal 9).
- S · ? · MapMaker speed, from the owner's trace of 2026-11-13 (`docs/PERF_STJOHNS_2026-11-13.md`; the trace is of MapMaker on a big map, not of a match): (1) the Paths tool's markers freeze 110–640 ms a redraw: one shared line material and redraw only the changed path (`pathTool.ts`); (2) Map properties rebuilt on every edit (`inspector.ts`, XS); (3) a forced layout in `pickPlane` on every drag edit: cache the canvas rectangle (`editorView.ts`, XS); (4) the outliner redrawn whole on selection (`outlinerPanel.ts`); (5) a cheaper hover pick (`hover.ts`, `editorView.ts`, M). No lane yet: these are the files lane A's MapMaker editing helper worked in.

## Features
- L · A · Tunnel kit steps 5–8: brick sewer and mine families, lit chamber, "Close open ends", `family` on set pieces (needs map format v39); then road (7 m bore), caves and transitions · `docs/map-briefs/tunnels/PLAN_2026-11-13.md`
- L · A · St. John's step 2: Smythe Hall (corner piece, side entry, about 1,150 props, perf run), then the chapel's spiral stair and our own crest.
- M · B · Tileset 11, step E: two tiles, a fire escape and a scaffold bay (data tiles first) · `docs/map-briefs/urban/URBAN_PLAN.md`
- S · B · A repeatable performance measurement (a fixed camera with no bots, or the mean of several runs): one run of `tools/perf/client-perf.mjs` swings by half on an unchanged map · `docs/map-briefs/urban/PERF_BASELINE.md`. Do it before the first map uses urban pieces.
- S · B · See Tileset 11's new pieces in the game: the four materials on real surfaces, the door and awning looks, the street pieces and fences (only the two wall styles have been through a browser). Needs a scratch map; the owner said no demo map yet.
- M · B · Player profiles.
- M · B · Map pass, like-for-like swaps only (owner: the tuned arenas are left alone; Qasr Medina stays as it is). Sandgate is done; no other map with as clear a swap has been found yet.
- M · A · Mobile audit: map cards on phones and "Pick a map" in Quick Play (proposal 2).
- M · A · Mobile audit: touch layout options: button size, opacity, left-handed, aim hold or toggle (proposal 3).
- M · A · Mobile audit: Character Select phone layout (proposal 4).
- M · A · Material surface types: 0 of 150 materials set `surface`, so footsteps and impacts can't tell metal from wood (owner: end of queue).
- M · ? · New characters: several T-pose models in the Drive (owner, 2026-11-13: Meshy Community, CC0). Intake through the character pipeline, recorded as community CC0, Experimental until looked over. Not started; no lane yet (lane A did the last ten).

## Waiting on the owner
- St. John's performance in a match: the 2026-11-13 trace turned out to be MapMaker, so whether the character work helped since 2026-11-10 is still unmeasured. Needs a recording of a match on St. John's (Settings → Record performance, or a Chrome trace while playing).
- A hover model for the Hauler (Ironclad Vanguard became the Troop Truck; the Sky Cruiser is the only unused hover model).
- Open questions in `docs/MAPMAKER_EDITING_REPORT_2026-11-13.md`.
- The effects-check proposals, once `wip/fx-checks` reports.
- Lane B: the destructible environment's later steps (batching breakable props while intact; breakable building walls). Step 1 is on main (props and blocks on an opt-in map, Breakyard); what comes next is undecided.
- Lane B: Tileset 11's gable ceiling (owner: later) and a demo map for pack 14 (owner: not yet).

## Parked
- L · A · A full weapon release: Stormvolt Blaster plus any other new guns (new weapon types are paused by the owner).
- S · A · Sound pass 2 (paused by the owner).
- ? · A · Packed inputs to cut upload bandwidth.

## Done (last week)
- 2026-11-13 · A · Paths draw under the roads they join (60d9abd3).
- 2026-11-13 · A · The Spillway: crest openings closed, wing wall, hillside stair legs, east end raised to the crest (023edfa4). No gatehouses.
- 2026-11-13 · A · MapMaker editing: two to three times quicker edits, select a path or road, fit the ground to a build (7bb706a8).
- 2026-11-13 · A · Tunnel kit step 4 (73f17583).
- 2026-11-13 · B · The owner's trace of 2026-11-13 read: it is MapMaker, 45.5 fps overall, 22.8 fps in the Paths tool; findings and five ranked fixes in `docs/PERF_STJOHNS_2026-11-13.md`.
- 2026-11-13 · B · Tileset 11, first build: Style Pack 14 "Urban & Civilian" (existing pieces by reference, no demo map), shopfront and arched-window wall styles, four materials, painted doors, awning, street pieces and chain-link fences; map format v38 (8000df5).
- 2026-11-13 · B · Process proposals 2–4, Tileset 11 audit and plan, The Spillway spawns, parapets and stair legs, Binbun FX status auras, portals, pads and loot glows.
- 2026-11-12 · B · Style Pack 13 Industrial Factory with Ironworks; Orbital Station's research tiles; kit props parts 10 and 11 (the last Kenney pieces on the list); the Desert City dome kit with closed domes; Sandgate's roof domes and card picture (the map pass's first map).
- 2026-11-11 · B · Quality tiers for maps and characters; Rockfall Canyon refresh with generated rocks and a fallen log; destruction step 1 with Breakyard; The Spillway rebuilt; kit props parts 4 to 9.
- 2026-11-11 · A · Troop Truck; 6-seat Buggy; vehicle re-skins; sheep fix; flare gun and airstrike flare; dynamite, holy bomb, sandbags, sheep.
