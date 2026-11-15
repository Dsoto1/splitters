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
- L · B (lane B's splitters22) · Flavius Rule's corners as a near-regular octagon (owner, 2026-11-14: angled sides about as long as the straight ones, "1 b"; the MapMaker lane builds it, "2 a"): new 45° stand pieces at every tier with stairs, gates and nav; the corner courts, towers and hypogeum stairs rebuilt; a plan first. MapMaker job on `maps/sandfall_colosseum.json`. · plan written: `docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md`; the owner's answers: all recs (lane B's splitters22). Phase 1 landed 2026-11-14 (the `turned`/`wallRun` parts, plain arch collision, oriented doors); phase 2 landed 2026-11-15 (the Arena Corner tiles and set piece); phase 3 landed 2026-11-15 (gate corner, stair wells, 45° gatehouse tower); phase 4 in progress: Flavius Rule rebuilt in MapMaker (`wip/flavius-octagon-4`; the owner's phase-3 answers: recs).


## Ready to land
- (none)

## Bugs
- M · B · MapMaker painting made clear (owner, 2026-11-15, bumped to the top of lane B: "I shouldn't have multiple locations to design and need more intuitive way to understand layers and hierarchy of the painting tool/textures and warning if I'm about to change my entire map theme"). Found by lane A's lead: (1) **Paint on bare ground swaps the material silently**: terrain takes only its ground layers, so `terrainMaterialFor` picks the nearest (Marble Checker's grey-brown → Gravel), with no message (paintTools.ts `groundPaint`); the owner painted Marble Checker on an Industrial Factory map and got gravel. (2) **The theme select changes every unpainted surface at once**, no warning or preview (mapProperties.ts `ed-prop-theme` → `setThemeCommand`; painted surfaces are kept; undo works). (3) **Set pieces are themed in another place** (Properties: Look, Materials per role, Explode); the Paint tool does not paint them; players cannot make a look of their own. Proposal, one design: Paint names what is under the cursor and where its look comes from (Terrain ground / Floor / Wall / Trim / Roof / Set piece part; the chain theme → look → your paint), offers only what that layer can take (ground layers on terrain, or a clear "the ground takes ground layers: nearest is Gravel" before painting), paints set-piece parts as a per-placement override without exploding, lets players save their own looks; the theme select asks first ("312 surfaces follow the theme and will change; 48 you painted stay", with "Keep the current look", which pins today's materials). A plan to the owner first.
  - **Owner's direction (2026-11-15): two painters, never mixed.** "We should have a wall painter and a terrain painter so we don't paint the ground with wood… easy way to tell the maker I don't want this painted on structures and conversely… my grass painted on the walls." So: a **Structure painter** (walls, floors, trim, roofs of tiles, blocks and set pieces; building materials only; it never touches the ground; a click on bare ground does nothing and says so) and a **Ground painter** (terrain only, ground types only; it never touches a structure, and strokes pass under buildings without painting them). Two tools with their own key and their own material list, or one Paint tool with a clear Structures / Ground switch that filters the list and the target; no silent substitution (Marble Checker never becomes Gravel).
  - **Owner's direction (2026-11-15): two base settings, edits always on top.** Map settings get a **Structure theme** (the tileset's look: what every wall, floor, trim and roof is until painted) and a **Ground theme** (the terrain's base ground layers and how they blend), as the head start. They are always the lowest layer; set pieces' looks sit above them, and every edit the player makes (the two painters, per-piece materials) overrides and is never undone by changing a base theme. The layers (base theme → set piece look → your paint) shown where you paint, and changing a base theme says what will change first.
  - Also (owner, 2026-11-15): "sometimes I'm able to select the wall, other times not, and it only paints on ground; other times I have to choose via theme for set pieces (which should be customizable)". Found: Paint paints only faces of grid tiles (`paintTarget`: the hovered box's `sourceId` must be a tile in `classicStructure.tiles`); a free block's wall, a set piece's part (`sp_…`) or a prop is not paintable and nothing happens, and wherever the hover pick finds no face at all (a thin wall's edge, past it) the stroke paints the ground (`brushAtHover`: `paintGround && !hoverFace`). Every surface the player can see should be paintable, with the cursor saying what it will paint before the click.
  - Also (owner, 2026-11-15): "by seeing a theme set, auto organize or bring forward the sets that work best in that theme". Today the palette's Style Pack picker (`ed-pack`, paletteBuilder.ts `buildPackPicker`) narrows pieces only when picked by hand, and its "Use theme" button is a second place that changes the whole map's theme without warning. Make the palette follow the map's theme by default: the theme's packs, set pieces, looks and materials first (paint list too), the rest one click away under "All" (the mock-up's item 3); "Use theme" goes through the same warning.
  - **Plan written (2026-11-15, lane B's splitters22): `docs/MAPMAKER_PAINTING_PLAN.md`**, 5 phases, 8 questions; waiting on the owner's answers.
- S · B · MapMaker: typing X or Z in the inspector skips the drag's millimetre rounding and terrain re-settle, and probably moves a mover without its parts (UI audit; fold into UI Phase 2's shared transform command).
- S · A · The Hollow Pilgrim (`meshy_hollowpilgrim`): its support hand stays about 11 cm short of a rifle's handguard (25 cm on the shotgun; its arms are short and `hold.forward` is at its −0.15 limit) and its sleeves stretch (grip audit 9). Needs a wider `hold` range or a skin fix from the download.
- ? · A · Unconfirmed: a large flat blue shape seen twice in software pictures (tunnels, The Spillway's long stair). Not seen in this batch's SwiftShader pictures (The Spillway's crest, Flatpack Depot, Training Range, Pantry Raid); the long stair and the tunnels were not visited (2026-11-14, `wip/mobile-bugs-1114`).


## Easy wins

- XS · B · Tests near their timeouts at load 16-25, CPU-bound (flaky-tests helper, 2026-11-15): botRoles route variety, botai strafing aim, debrisGround, zipStream, server.test's first CTF test with four suites at once.

## Features
- M · ? · MapMaker UI spec Phases 2 and 3: synced selection and numeric transforms; live minimap.
- M–L · ? · MapMaker UI spec Phase 4a: tile view (cell edges, props with fine snap, local/world). Phase 4b set-piece overrides: optional, L.
- L · A · Tunnel kit steps 5–8: brick sewer and mine families, lit chamber, "Close open ends", `family` on set pieces (needs map format v39); then road (7 m bore), caves and transitions · `docs/map-briefs/tunnels/PLAN_2026-11-13.md`
- M · A · St. John's: the chapel's spiral stair and our own crest (after step 2, Smythe Hall).
- S · B · See Tileset 11's new pieces in the game: the four materials on real surfaces, the door and awning looks, the street pieces and fences (only the two wall styles have been through a browser). Needs a scratch map; the owner said no demo map yet.
- M · B · Player profiles.
- M · B · Map pass, like-for-like swaps only (owner: the tuned arenas are left alone; Qasr Medina stays as it is). Sandgate is done; no other map with as clear a swap has been found yet.
- M · A · Mobile audit: map cards on phones and "Pick a map" in Quick Play (proposal 2).
- M · A · Mobile audit: touch layout options: button size, opacity, left-handed, aim hold or toggle (proposal 3).
- M · A · Mobile audit: Character Select phone layout (proposal 4).
- M · A · Material surface types: 0 of 150 materials set `surface`, so footsteps and impacts can't tell metal from wood (owner: end of queue).
- M · A · Hold to resupply and heal, and a clearer low-health warning (owner, 2026-11-15: "for resupplying during a match… a certain time they hold E, not instant. same for healing. also need more helpful indicators to show I'm really hurting and need health"). Resupply sources (`sim/resupply.ts`: the Supply Buggy, the Ammo Box) and healing (medkits/health pickups that heal on use, `sim/items.ts`) take a hold of E with a progress ring, cancelled by moving away, firing or taking a hit (times to tune, e.g. about 1.5 s resupply, 2–3 s heal); bots wait it out too. Low health: a steady warning that grows as health falls (edge darkening and desaturation, a slow heartbeat sound, the health bar pulsing at most once a second at low contrast), within Reduce flashing (no red flash; passes the `flashing` flow), and a hint where the nearest health is. A short design with the numbers first.
- L · A · Driving physics (owner, 2026-11-15): vehicles as real bodies with sprung raycast wheels and tyre grip that can fail. Buggies light, bouncy and easy to flip; jumps land with weight and momentum; the body follows the ground on steep edges and slides back when grip runs out. Multiplayer smooth: the driver's vehicle predicted on their own machine and reconciled, others interpolated. Step 1: a plan plus the Buggy alone, judged offline and at 100–150 ms simulated lag; then the rest of the vehicles, bots, maps. Today the chassis moves like a character controller (`PhysicsWorld.moveVehicle`), with a drawn-only sprung body (`sim/suspension.ts`). After the hitches fix (owner: "finish hitches fix").

## Waiting on the owner
- The scaling study's seven questions (region streaming, foliage, interiors, bot navigation; `docs/SCALING_STUDY_2026-11-15.md`, recommended picks marked).
- A recording on a real GPU of MapMaker after an edit on a big map (`docs/MAPMAKER_EDITING_REPORT_2026-11-13.md` question 5). The St. John's match recording came in 2026-11-15 (read in `docs/PERF_STJOHNS_2026-11-14.md`); the next one after the main-scene work.
- Lane B: the destructible environment's later steps (batching breakable props while intact; breakable building walls). Step 1 is on main (props and blocks on an opt-in map, Breakyard); what comes next is undecided.
- Lane B: Tileset 11's gable ceiling (owner: later) and a demo map for pack 14 (owner: not yet).

## Known issues and loose ends (found in HANDOFF, 2026-11-15)
- ? · A · Mobile: the dark wall block on the owner's Galaxy S25+ (docs/MOBILE_AUDIT.md); if it still shows on Medium, the one-lamp-per-layer mode becomes Medium's default (owner said yes; confirm the reading).
- ? · ? · Iron Coast's coast-border canopy has a dark lip.
- ? · ? · Sandsweep plays weak as a battle map.
- S · A · Gunplay gaps from the audit (docs/GUNPLAY_AUDIT.md appendix A): no multi-client latency/loss test (G3); bots pick weapons by a hand-set range (G4); Training Range lacks a damage readout on hit, dummies that don't shoot back, armoured targets, a trajectory view.
- ? · A · The owner's playtest checklist (artifact 5LRzv2dDfPVrp4TU2d3rwW): no answers yet.
- ? · A · Roster Board renames: apply the owner's edits in one batch when the owner has made them.

## Parked
- L · A · A full weapon release: Stormvolt Blaster plus any other new guns (new weapon types are paused by the owner).
- S · A · Sound pass 2 (paused by the owner).
- ? · A · Packed inputs to cut upload bandwidth.

## Done (last week)
- 2026-11-15 · A · Main scene drawing on St. John's, step 1 (`wip/render-scene-2`): what renderScene spends read from GL call counts and a CPU profile (`docs/PERF_STJOHNS_2026-11-14.md`, "Main scene drawing"); redundant uniform and draw-buffer calls dropped (`src/glStateCache.ts`): main pass 3,992 → 2,206 GL calls a frame at the middle spawn (5,174 → 2,714 far spawn), shadows -21-24 %, looks the same; scenario visuals' per-frame walk and the per-body torso measure gone (GC). The owner's next recording says whether renderScene moved.
- 2026-11-15 · A · St. John's halls in Roman Rubblework (owner: "I already like the roman rubble"): Smythe Hall's outside walls and corner tower in a new material, Collegiate Rubble (Roman Rubblework's photo, tint #c8cad2), its stones running on unbroken round corners and buttresses (`wrap`) and lifted a little in shade (`shadeLift` 0.12); shoots as stone like the blocks it replaced; draws unchanged.
- 2026-11-15 · A · Closed, not reproduced: the player's own body in first person after a teleport (the owner: "portals work fine"; a helper's software teleports on four maps showed only arms, 2026-11-14). Reopen if it is seen again.
- 2026-11-15 · A · Sky Cruiser: already the Gunship's model since 2026-11-12, so no new vehicle (owner: "Ur recs 1"); MapMaker's vehicle search reads descriptions, and "Sky Cruiser" finds the Gunship.
- 2026-11-15 · B · MapMaker UI Phase 1: Map settings in the right dock, an inspector for the selection only, a 3-state dock (Shift+\), a tool bar per tab with a ⋯ menu of every tool, a View menu, a short status bar; the top bar fits at 1440 px.
- 2026-11-15 · A · Hitches (`wip/hitches-1115`): a going character body is hidden at once and put away over the next frames (1.5 ms a frame): St. John's here, the worst frame of body work in play 15 → 5-7 ms, a new round's 32 bodies 32-52 ms in one frame → 5-7 ms; the recording's other hitches listed with their causes in `docs/PERF_STJOHNS_2026-11-14.md`.
- 2026-11-15 · A · Dead race-track settings: map format v39 drops a track's `laps`, `grid`, `vehicle` and `combat`; MapMaker no longer writes them; shipped maps load the same otherwise (no map file edited).
- 2026-11-15 · A · Flaky tests made sturdy by cause: a kicked player is told why on a slow link, a busy host recognises signed-in players, damage numbers drawn at least once on a slow page, Hyena Warrior no longer wakes crouched; server tests wait on conditions, the bench reads CPU time, tests that outgrew one budget split; the Imp grip and arsenal checks wait on the host (HANDOFF Landed note).
- 2026-11-15 · A · Mobile easy wins and lane A bugs (`wip/mobile-bugs-1114`): Options in one column on phones (chips, one-line rows, descriptions behind an (i)); Match Setup's fixed header names the mode, 40 px steppers; finer, softer terrazzo (1.25 m, contrast 0.55); status auras: a steady glowing outline instead of the see-through slab past the three nearest, and kept under poison and goo for daylight; no square of path ground past an open path's end (St. John's on Low); the twelve characters of 2026-11-14 to core (owner); Sun Warrior's grip (fingers re-fitted, hands on the gun; grip audit 10 → 0) and The Hollow Pilgrim's shooting hand (11 → 9; its support hand stays about 11 cm short: arm reach). The match-start 185 ms frame was already done (e361f045).
- 2026-11-14 · A · St. John's step 2: Smythe Hall rebuilt in MapMaker from dorm bays (two floors, the L on the grid), with five new pieces: Dorm Corner Bay, Dorm Entry Bay, Stair End Bay (arched door / upper door), Square Corner Tower; props indoors out of the sun's shadow pass on every map (the caster rise brought back: St. John's middle-spawn view 390 → 387 casters); perf before/after in `docs/map-briefs/st_johns/PLAN_2026-11-12.md` 4b.
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
