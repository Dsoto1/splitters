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
- L · B · Tileset 11, first build (Urban & Civilian pack 14, shopfront and arched-window walls, map format v38) · `wip/mapmaker-urban-1`

## Ready to land
- (none)

## Bugs
- S · A · Gun Buggy and Troop Buggy tires stand 0.3–0.4 m outside their collision boxes.
- S · A · The Spillway: bots snag on the long stair's landings (stuck recoveries about 70–88 a match).
- S · A · Heavy MG sits at upper-belly height on drawn characters and hides the ground about 6° under the crosshair.
- XS · A · Low graphics: a patch of painted ground cells beside a path end on St. John's (ground paint, not the path fix).
- ? · A · Unconfirmed: the player's own third-person body drawn in first person after a teleport. Check a normal portal and respawn first.
- ? · A · Unconfirmed: a large flat blue shape seen twice in software pictures (tunnels, The Spillway's long stair).

## Easy wins
- S · A+B · Pickup guns drawn 1.3–1.5x so they read at a distance (`pickupVisuals.ts`, beside the loot glows; agree first).
- XS · A · Vehicle palette pictures without tires.
- S · A · Steampunk Warrior's fingers.
- S · A · Flavius Rule's corners.
- S · A · Loot-ring and effect tweaks, from the effects-check findings once the owner picks.
- S · A · Mobile audit: Options in one column on phones (proposal 7).
- S · A · Mobile audit: Match Setup on phones, sticky header and bigger steppers (proposal 11).
- XS · A · Mobile audit: finer, lower-contrast terrazzo (proposal 9).

## Features
- L · A · Tunnel kit steps 5–8: brick sewer and mine families, lit chamber, "Close open ends", `family` on set pieces (needs map format v39); then road (7 m bore), caves and transitions · `docs/map-briefs/tunnels/PLAN_2026-11-13.md`
- L · A · St. John's step 2: Smythe Hall (corner piece, side entry, about 1,150 props, perf run), then the chapel's spiral stair and our own crest.
- L · B · St. John's performance (owner's recording: about 25 fps on an M1 Pro; characters 13.6 ms a frame).
- L · B · Tileset 11, later phases · `docs/map-briefs/urban/URBAN_PLAN.md`
- L · B · Kit-prop generators, further parts.
- M · B · Player profiles.
- M · B · Quality tiers (core and experimental, quality gates).
- M · B · Rockfall Canyon refresh.
- L · B · Desert City dome kit; remaining style packs.
- L · B · Destructible environment: audit what breaks today, then per-piece destruction on one opt-in map.
- L · B · Map pass, one map at a time (like-for-like swaps only on the tuned arenas).
- M · A · Mobile audit: map cards on phones and "Pick a map" in Quick Play (proposal 2).
- M · A · Mobile audit: touch layout options: button size, opacity, left-handed, aim hold or toggle (proposal 3).
- M · A · Mobile audit: Character Select phone layout (proposal 4).
- M · A · Material surface types: 0 of 150 materials set `surface`, so footsteps and impacts can't tell metal from wood (owner: end of queue).

## Waiting on the owner
- A hover model for the Hauler (Ironclad Vanguard became the Troop Truck; the Sky Cruiser is the only unused hover model).
- Open questions in `docs/MAPMAKER_EDITING_REPORT_2026-11-13.md`.
- The effects-check proposals, once `wip/fx-checks` reports.

## Parked
- L · A · A full weapon release: Stormvolt Blaster plus any other new guns (new weapon types are paused by the owner).
- S · A · Sound pass 2 (paused by the owner).
- ? · A · Packed inputs to cut upload bandwidth.

## Done (last week)
- 2026-11-13 · A · Paths draw under the roads they join (60d9abd3).
- 2026-11-13 · A · The Spillway: crest openings closed, wing wall, hillside stair legs, east end raised to the crest (023edfa4). No gatehouses.
- 2026-11-13 · A · MapMaker editing: two to three times quicker edits, select a path or road, fit the ground to a build (7bb706a8).
- 2026-11-13 · A · Tunnel kit step 4 (73f17583).
- 2026-11-13 · B · Process proposals 2–4, Tileset 11 audit and plan, The Spillway spawns, parapets and stair legs, Binbun FX status auras, portals, pads and loot glows.
- 2026-11-11 · A · Troop Truck; 6-seat Buggy; vehicle re-skins; sheep fix; flare gun and airstrike flare; dynamite, holy bomb, sandbags, sheep.
