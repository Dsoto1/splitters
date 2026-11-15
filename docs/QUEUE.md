# Tile Trigger queue

This is the short list of what is happening and what comes next. Both accounts keep it current.

HANDOFF.md keeps the detail and the history (Landed notes, claims, lock lines). This file is the one the owner reads. The owner set it up on 2026-11-13.

## How to use it

**Lanes**
- **A** is the lead session of the owner's first account and its helpers: Opus 5.5 at medium effort, never Fable (owner, 2026-11-13).
- **B** is the owner's second account: the MapMaker lane. Its main session ("Splitters FABLE 5.2") is paused from 2026-11-14; **lane B's splitters22** (Opus 5.5, medium) leads lane B and resumes its work (owner, 2026-11-14).
- **Both accounts have a session called "splitters22".** Always write "lane A's splitters22" or "lane B's splitters22".

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
- L · B (lane B's splitters22) · Flavius Rule's corners as a near-regular octagon (owner, 2026-11-14: angled sides about as long as the straight ones, "1 b"; the MapMaker lane builds it, "2 a"): new 45° stand pieces at every tier with stairs, gates and nav; the corner courts, towers and hypogeum stairs rebuilt; a plan first. MapMaker job on `maps/sandfall_colosseum.json`. · plan written: `docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md`; the owner's answers: all recs (lane B's splitters22). Phase 1 landed 2026-11-14 (the `turned`/`wallRun` parts, plain arch collision, oriented doors); phase 2 landed 2026-11-15 (the Arena Corner tiles and set piece); phase 3 next: gate, stair well, tower.


## Ready to land
- M · B (lane B's splitters22) · MapMaker UI spec Phase 1: built, green on `check/mapmaker-ui-1` at 72ee2ac2 (run 43608912572, full suite). **Reviewed by lane A's lead 2026-11-15: approved, land it** (merges cleanly with main at 901c19f3; main has moved since 72ee2ac2, so merge main and re-check before the fast-forward). Read: dockPrefs (safe parse, legacy carry-over, clamps), popupMenu (ARIA menu, outside-click listener added on open and removed on close), the map settings field ids (only Dress all, Settle all and the layers heading moved out, as the spec says), the as-built list; `docs/MAPMAKER_UI_SPEC.md` "As built" under Phase 1 lists every change and where each control went. The owner's answers: as built (recs, 2026-11-14).

## Bugs
- S · B · MapMaker: typing X or Z in the inspector skips the drag's millimetre rounding and terrain re-settle, and probably moves a mover without its parts (UI audit; fold into UI Phase 2's shared transform command).
- XS · B · MapMaker: the top bar is cut off at 1440 px (map name, Snap, bot skill truncated) (UI audit; UI Phase 1 fixes it).
- S · A · The Hollow Pilgrim (`meshy_hollowpilgrim`): its support hand stays about 11 cm short of a rifle's handguard (25 cm on the shotgun; its arms are short and `hold.forward` is at its −0.15 limit) and its sleeves stretch (grip audit 9). Needs a wider `hold` range or a skin fix from the download.
- ? · A · Unconfirmed: the player's own third-person body drawn in first person after a teleport. Tried 2026-11-14 (`wip/mobile-bugs-1114`, SwiftShader): not reproduced. A picture tool's teleport (the sim moving you, once a second, on Flatpack Depot, The Spillway, Training Range) drew only your arms or your full-body legs; on Pantry Raid your own body sat 0.13-0.15 m from the camera as it should. Not finished: an ordinary portal (the mouse hole didn't take a teleported-in player) and a respawn; the machine drew about a frame a minute.
- ? · A · Unconfirmed: a large flat blue shape seen twice in software pictures (tunnels, The Spillway's long stair). Not seen in this batch's SwiftShader pictures (The Spillway's crest, Flatpack Depot, Training Range, Pantry Raid); the long stair and the tunnels were not visited (2026-11-14, `wip/mobile-bugs-1114`).

- S · A · Hitches: a character body's disposal costs about 28 ms when it goes (St. John's recording of 2026-11-14); reuse bodies or spread the disposal over frames. Next for lane A after the flaky tests (owner, 2026-11-15).
- S · A · Sky Cruiser as a new vehicle (owner, 2026-11-15: "just add sky cruiser as a vehicle in the game, available in mapmaker like others. no need to add to map yet"): `Meshy_AI_Sky_Cruiser_1108121108_texture.glb` (owner's Drive, Meshy Community CC0, batch of 2026-11-08); a flying craft with seats and guns fitted to the model, on the MapMaker palette and `maps/test_coverage.json` only (through MapMaker); provenance. Next free helper with the hitches fix.
- S · A · St. John's halls in Roman Rubblework (owner, 2026-11-15: "roman rubblework, show me pictures first"): the `collegiate_stone` facade's skin (`core.cobble` today, geometry.ts) tried as `core.pbr_opus_incertum`, blended: continuous across pieces and corners, colour tuned to the pale trim, stones at life size. Pictures first (the hall, the drill field, a corner and a window close up; before and after), owner picks, then it lands. After Smythe Hall lands.
- M · A · Main scene drawing on St. John's: about 10 ms a frame and nearly unchanged after draws fell 58 % (owner's 11-15 recording, `docs/PERF_STJOHNS_2026-11-14.md`); find what it spends (per-mesh CPU, material updates, GPU fill at 1920x1080@2) and cut it. After the hitches fix (owner, 2026-11-15).

## Easy wins
- S · B · MapMaker: the selection Mirror (Shift+M) learns diagonal symmetry, so an exploded Arena Corner mirrors like the set piece (owner 4a, 2026-11-14; after MapMaker UI Phase 1 frees `editor/mirror.ts`).
- XS · B · MapMaker: `updateVisibleFaces` cuts a turned box's face into slightly different pieces than a full pass (a few mm² on faces of hundreds of m²); `facesUpdate.test.ts` now compares drawn area. Make the incremental cut match exactly, then tighten the test back.

- XS · B · Tests: octagonKit's every-map doors test is one test over all maps and nears its timeout under load (as terrainFloors did); make it one test per map (flaky-tests helper, 2026-11-15). Also near their timeouts at load 16-25, CPU-bound: botRoles route variety, botai strafing aim, debrisGround, zipStream, server.test's first CTF test with four suites at once.

## Features
- M · ? · MapMaker UI spec Phases 2 and 3: synced selection and numeric transforms; live minimap.
- M–L · ? · MapMaker UI spec Phase 4a: tile view (cell edges, props with fine snap, local/world). Phase 4b set-piece overrides: optional, L.
- L · A · Tunnel kit steps 5–8: brick sewer and mine families, lit chamber, "Close open ends", `family` on set pieces (needs map format v39); then road (7 m bore), caves and transitions · `docs/map-briefs/tunnels/PLAN_2026-11-13.md`
- L · A · St. John's step 2: Smythe Hall (corner piece, side entry, about 1,150 props, perf run), then the chapel's spiral stair and our own crest.
- S · B · See Tileset 11's new pieces in the game: the four materials on real surfaces, the door and awning looks, the street pieces and fences (only the two wall styles have been through a browser). Needs a scratch map; the owner said no demo map yet.
- M · B · Player profiles.
- M · B · Map pass, like-for-like swaps only (owner: the tuned arenas are left alone; Qasr Medina stays as it is). Sandgate is done; no other map with as clear a swap has been found yet.
- M · A · Mobile audit: map cards on phones and "Pick a map" in Quick Play (proposal 2).
- M · A · Mobile audit: touch layout options: button size, opacity, left-handed, aim hold or toggle (proposal 3).
- M · A · Mobile audit: Character Select phone layout (proposal 4).
- M · A · Material surface types: 0 of 150 materials set `surface`, so footsteps and impacts can't tell metal from wood (owner: end of queue).
- L · A · Driving physics (owner, 2026-11-15): vehicles as real bodies with sprung raycast wheels and tyre grip that can fail. Buggies light, bouncy and easy to flip; jumps land with weight and momentum; the body follows the ground on steep edges and slides back when grip runs out. Multiplayer smooth: the driver's vehicle predicted on their own machine and reconciled, others interpolated. Step 1: a plan plus the Buggy alone, judged offline and at 100–150 ms simulated lag; then the rest of the vehicles, bots, maps. Today the chassis moves like a character controller (`PhysicsWorld.moveVehicle`), with a drawn-only sprung body (`sim/suspension.ts`). After the hitches fix (owner: "finish hitches fix").

## Waiting on the owner
- A new recording on a real GPU: St. John's in a match (to measure render cost step 1, the draws, landed 2026-11-14) and MapMaker after an edit on a big map (`docs/MAPMAKER_EDITING_REPORT_2026-11-13.md` question 5; questions 1–4 were answered 2026-11-13).
- Lane B: the destructible environment's later steps (batching breakable props while intact; breakable building walls). Step 1 is on main (props and blocks on an opt-in map, Breakyard); what comes next is undecided.
- Lane B: Tileset 11's gable ceiling (owner: later) and a demo map for pack 14 (owner: not yet).

## Known issues and loose ends (found in HANDOFF, 2026-11-15)
- ? · A · Mobile: the dark wall block on the owner's Galaxy S25+ (docs/MOBILE_AUDIT.md); if it still shows on Medium, the one-lamp-per-layer mode becomes Medium's default (owner said yes; confirm the reading).
- ? · ? · Iron Coast's coast-border canopy has a dark lip.
- ? · ? · Sandsweep plays weak as a battle map.
- XS · ? · Dead race-track settings left in map files.
- S · A · Gunplay gaps from the audit (docs/GUNPLAY_AUDIT.md appendix A): no multi-client latency/loss test (G3); bots pick weapons by a hand-set range (G4); Training Range lacks a damage readout on hit, dummies that don't shoot back, armoured targets, a trajectory view.
- ? · A · The owner's playtest checklist (artifact 5LRzv2dDfPVrp4TU2d3rwW): no answers yet.
- ? · A · Roster Board renames: apply the owner's edits in one batch when the owner has made them.

## Parked
- L · A · A full weapon release: Stormvolt Blaster plus any other new guns (new weapon types are paused by the owner).
- S · A · Sound pass 2 (paused by the owner).
- ? · A · Packed inputs to cut upload bandwidth.

## Done (last week)
- 2026-11-15 · A · Flaky tests made sturdy by cause: a kicked player is told why on a slow link, a busy host recognises signed-in players, damage numbers drawn at least once on a slow page, Hyena Warrior no longer wakes crouched; server tests wait on conditions, the bench reads CPU time, tests that outgrew one budget split; the Imp grip and arsenal checks wait on the host (HANDOFF Landed note).
- 2026-11-15 · A · Mobile easy wins and lane A bugs (`wip/mobile-bugs-1114`): Options in one column on phones (chips, one-line rows, descriptions behind an (i)); Match Setup's fixed header names the mode, 40 px steppers; finer, softer terrazzo (1.25 m, contrast 0.55); status auras: a steady glowing outline instead of the see-through slab past the three nearest, and kept under poison and goo for daylight; no square of path ground past an open path's end (St. John's on Low); the twelve characters of 2026-11-14 to core (owner); Sun Warrior's grip (fingers re-fitted, hands on the gun; grip audit 10 → 0) and The Hollow Pilgrim's shooting hand (11 → 9; its support hand stays about 11 cm short: arm reach). The match-start 185 ms frame was already done (e361f045).
- 2026-11-14 · A · St. John's render cost, step 1: draw calls on High about 1,490 to 550 on St. John's (Norman Shores 2,210 to 1,060, Backwoods 1,690 to 850, Capitol Mall 970 to 530), looks unchanged: the sun shafts draw only what can hide the sun, far trees and props batch over wider squares, cascades cull batches, doors and paths merged (fb595302).
- 2026-11-14 · A · Twelve new characters from the owner's Drive (Meshy Community CC0, Experimental until the owner looks them over), Azure Sentinel and Spud Marshal recoloured, The Hollow Pilgrim glides; Coffee Brown recorded as Meshy, owned.
- 2026-11-14 · A · The match-start animation spike: one torso measurement a frame (it skinned the torso on the CPU, 10-33 ms a character, all at once as a crowd settled into its aim), and a crowd coming into view posed over its band's frames (never-posed characters hidden until their first pose); in a crowd-into-view repro max animated a frame 38-47 → 13-15, charAnim 195-333 → 39-52 ms (e361f045).
- 2026-11-14 · A · The owner's St. John's match recording read: about 34 fps (25 on 11-10), characters 5.5 ms (13.6), hitches 28 in 164 s (546 in 204 s); rendering is now about 21 of 29 ms and the draw count (1,519) hasn't moved (`docs/PERF_STJOHNS_2026-11-14.md`).
- 2026-11-14 · A · Effects-check fixes: Pantry Raid's mouse holes walkable and painted (portal Swirl option), loot rings outlined, Low's lasting places by view, the lootlight and fixtures checks, pickup guns 1.4x (ec003538).
- 2026-11-14 · A · Easy wins batch 1: the Heavy MG Turret at 2.1x (a hip carry: the ground shows under the crosshair), vehicle palette pictures with their tires, Steampunk Warrior's hands, The Spillway's long stair cheeks (bots' stuck recoveries about 80 to 50 a match); the buggy tires were already inside their boxes (fitted 2026-11-11, measured as drawn). Flavius Rule's corners moved to Features (not an easy win).
- 2026-11-14 · B · Twelve new characters from the owner's Drive (Meshy Community CC0, Experimental until the owner looks them over); the Vortex Grenade is now the Gravity Grenade.
- 2026-11-14 · A · Ammo Box: solid resupply crates with cook-off, the Ammo Box Kit throwable, tanks refill beside a crate.
- 2026-11-13 · A · MapMaker Fit ground, the owner's answers: lone platforms stand on the ground, props on moved ground re-bedded in the same undo (fcbd08e0).
- 2026-11-13 · A · Vehicle line-up: Supply, Troop and Gun Buggy, Armored Rover 7 places, bots resupply at a Supply Buggy, `buggy` retired on 19 maps.
- 2026-11-13 · A · Paths draw under the roads they join (60d9abd3).
- 2026-11-13 · A · The Spillway: crest openings closed, wing wall, hillside stair legs, east end raised to the crest (023edfa4). No gatehouses.
- 2026-11-13 · A · MapMaker editing: two to three times quicker edits, select a path or road, fit the ground to a build (7bb706a8).
- 2026-11-13 · A · Tunnel kit step 4 (73f17583).
- 2026-11-14 · B · MapMaker speed, part 2: the prop inspector's two long lists fill when opened (selecting a prop costs less than half the page work), and the route tool keeps its markers (d84124a).
- 2026-11-14 · B · Tileset 11: fire escape and scaffold bay tiles, a bus stop sign, the bandstand rebuilt, the "Town pieces" tab; a repeatable performance measurement (`PERF_STILL=1`, two runs agree) with a new baseline (78a0b5f).
- 2026-11-14 · B · MapMaker speed from the owner's trace: the Paths tool about 20 times quicker to drag and hover, Map properties no longer rebuilt on every edit, the hover pick halved (c929d7e). Two of the five fixes only moved a layout.
- 2026-11-13 · B · A new parachute built in code (round canopy, lines to risers behind the neck, eight colour schemes by player; the Meshy model dropped); Tileset 11's eight urban set pieces built in MapMaker; the arched window's neater stones (train 5, 87ca152).
- 2026-11-13 · B · The owner's trace of 2026-11-13 read: it is MapMaker, 45.5 fps overall, 22.8 fps in the Paths tool; findings and five ranked fixes in `docs/PERF_STJOHNS_2026-11-13.md`.
- 2026-11-13 · B · Tileset 11, first build: Style Pack 14 "Urban & Civilian" (existing pieces by reference, no demo map), shopfront and arched-window wall styles, four materials, painted doors, awning, street pieces and chain-link fences; map format v38 (8000df5).
- 2026-11-13 · B · Process proposals 2–4, Tileset 11 audit and plan, The Spillway spawns, parapets and stair legs, Binbun FX status auras, portals, pads and loot glows.
- 2026-11-12 · B · Style Pack 13 Industrial Factory with Ironworks; Orbital Station's research tiles; kit props parts 10 and 11 (the last Kenney pieces on the list); the Desert City dome kit with closed domes; Sandgate's roof domes and card picture (the map pass's first map).
- 2026-11-11 · B · Quality tiers for maps and characters; Rockfall Canyon refresh with generated rocks and a fallen log; destruction step 1 with Breakyard; The Spillway rebuilt; kit props parts 4 to 9.
- 2026-11-11 · A · Troop Truck; 6-seat Buggy; vehicle re-skins; sheep fix; flare gun and airstrike flare; dynamite, holy bomb, sandbags, sheep.
