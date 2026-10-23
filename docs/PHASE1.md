# Phase 1 — Vertical Slice

Scope is MASTER_SPEC_V2 §11. It is large, so it is delivered in milestones, each of which leaves the game playable. The first milestone builds the core loop from §17: *open browser → build room → place → Test → fight → return to editor → change → Test again*.

## Rendering engine decision: stay on Babylon.js, WebGPU first

**Decision:** keep Babylon.js. Run on WebGPU where the browser provides a working device and fall back to WebGL2 automatically.

Why:

- **WebGPU is already the default path.** Babylon ships a WebGPU backend with native WGSL shaders. At startup the client renders a few probe frames. If the WebGPU device is lost (bad drivers, software adapters) it switches to WebGL2 on a fresh canvas instead of crashing. `?renderer=webgl2|webgpu` overrides it. The F3 panel shows which one is active.
- **WebGL2 is still required.** WebGPU coverage is good on Chromium browsers and recent Safari, and still uneven elsewhere. A browser FPS cannot drop those players.
- **What WebGPU actually buys an arena FPS:** cheaper draw submission (more props and characters per frame), compute shaders (GPU particles, culling, skinning), and better multithreaded-friendly APIs. The early bottlenecks here are CPU-side simulation and network, not GPU features. So WebGPU is a scaling win later, not a blocker now.
- **Switching engines is cheap if it is ever needed.** Rendering is a thin layer (`client/src/game/view.ts`, `editor/editorView.ts`, `mapMeshes.ts`). Simulation, physics (Rapier), navigation (Recast), networking and the map format are engine-independent shared TypeScript, and the dedicated server never touches the renderer.

Alternatives considered:

| Option | Verdict |
|---|---|
| **Three.js** (WebGPURenderer + TSL) | Viable, with a large community. It is more DIY (no built-in inspector, scene tooling or GUI), so it is a lateral move. |
| **PlayCanvas** | Solid WebGPU support. Its strength is a hosted editor we would not use, since MapMaker is our own editor. |
| **Godot 4 web export** | WebGL2-only on the web today. It also needs a large WASM download and cross-origin-isolation headers for threads. Most importantly, it can't share TypeScript simulation code with the dedicated server, which breaks the "same code for prediction, server and TEST" architecture. |
| **Unity / Unreal** | Unity's WebGPU target is experimental with heavy builds; Unreal has no web target. Neither fits an in-browser editor with instant TEST. |

Rules that keep the WebGPU path healthy:

- Upload textures from raw buffers rather than canvases. A canvas `DynamicTexture` upload killed the device on the software adapter.
- Merge static map geometry (3 draw calls for the whole layout). Use thin instances for repeated props.
- Avoid WebGL-only extensions in custom shaders. Prefer Babylon's node or standard materials until a shader needs to be hand-written in both GLSL and WGSL.

Verification: the cloud container's software WebGPU adapter loses its device on first present (even for a hand-written raw-WebGPU triangle), so only the fallback can be exercised there. That fallback is tested. Check the WebGPU path on real GPUs in Chrome/Edge and Safari.

## Milestones

| # | Milestone | Status |
|---|---|---|
| M1 | MapMaker core loop: Classic Grid building, spawns, undo/redo, levels, validation, save/load, in-browser TEST, offline play | **Done** |
| M1.5 | Map look: material library (~20), per-surface material + tint, Paint tool in MapMaker, map format v2 migration ([`PLAYER_EXPRESSION.md`](PLAYER_EXPRESSION.md) §1) | **Done** |
| M2 | Weapons and items: 6 weapon roles (pistol, automatic, shotgun, precision, explosive, melee), weapon/health/armor pickups, 2 powerups, bot weapon choice and pickup seeking, lag compensation | **Done** |
| M3 | Scenario primitives: doors, buttons, destructibles, trigger volumes, **traps**, WHEN → IF → DO logic (data-only interpreter), objectives, LOGIC/ENTITIES workspaces | **Done** |
| M4 | NPCs: factions model, one enemy faction, one NPC squad archetype, encounter spawners, the co-op scenario | **Done** |
| M5 | Rig standard, first character part library, **Character Designer**, 12 preset characters built with it, character select, looks visible to everyone in multiplayer, Team Deathmatch on factions | **In progress**: rig, modular parts, animation, 14 presets, character select |
| M6 | Multiplayer slice: hosting an editor map on the dedicated server (map transfer), 8-slot proof, staged 16/24/32 load tests, bundle splitting, §11 acceptance pass | |

## M1 — what exists

**MapMaker** (`client/src/editor/`, model in `shared/src/editor/`):

- 11 Classic Grid pieces: room, pillar room, corridor, corner, T-junction, dead end, crossroads, column room, low-cover room, dais room, stairs. Palette thumbnails are generated from the real tile geometry.
- Tools: Select, tile placement with a live green/red ghost, spawn placement. R rotates (ghost, selection or spawn facing). Right-click erases. Overlapping placements are refused with a reason.
- Selection: click, Shift-add, drag-move (tiles snap to cells, spawns to 0.5 m), arrow-key nudge, Shift+PgUp/PgDn to move between levels, Ctrl+D duplicate, Delete, F focus.
- Inspector: replace tile type (checked for fit), edit position, level and spawn facing, plus map name, description and recommended players.
- Levels: PgUp/PgDn (or `[` `]`) changes the active floor. Floors above are hidden unless "Show all levels" (H) is on.
- Undo/redo for every change, including renames and inspector edits. Multi-object operations are one step. History keeps exact documents, so undo restores item order.
- Validation panel: schema/semantic checks plus navmesh reachability between spawns, recomputed after each change. Clicking an issue selects and frames the object. The top-bar pill summarises status. TEST is blocked while errors exist.
- Persistence: rolling autosave (restored on reload), a local map library (Save / Open), Export/Import of `.cmap.json` files, and the Phase 0 Arena as a remixable template (keeps `parentId` lineage).

**TEST** (F5 or ▶ TEST): the current, unsaved document runs as an in-browser `Match` behind `LocalTransport`. This is the same simulation and protocol as the dedicated server, with a chosen bot count and skill. The second Esc (or F5, or "Back to MapMaker") returns to the editor with camera, selection, level and history untouched. Startup measured at 150–220 ms in the container, against a 1–3 s target.

**Shell:** a main menu with MapMaker, offline play vs bots (same local transport), and online play. One Babylon engine is shared across modes.

**Tests:** 41 unit/integration tests, plus `pnpm e2e` (Playwright). The e2e suite builds a map with mouse input, drag-moves, undoes and redoes, runs TEST and returns, saves, reloads, reopens from the library, and runs two online clients against the dedicated server.

## M1.5 — what exists

- **Material library:** 25 hand-made materials in 9 categories (prototype, stone, brick, wood, metal, tile, fabric, tech, paint). Each is a pattern drawn by our own code (bricks, blocks, planks, tiles, checker, plates, grate, panels, stripes, hex, marble, weave, noise, grid, plain) with colours, repeat scale, gloss and optional glow. No external or generated images. The same pixels feed GPU textures and palette thumbnails.
- **Themes as default palettes:** Prototype, Desert Tomb, Factory, Research Lab, Gothic Manor (map inspector). Each sets the default material/tint per slot and the sky colour. Painted surfaces keep their own style when the theme changes.
- **Paint tool (B):** four slots per tile (floor, walls, pillars/cover/steps, underside = the ceiling seen from below). Pick a material and tint (30 swatches, or any colour), then click a surface. "Apply to" sets the scope: this surface, same piece type, whole level, or whole map. Each stroke is one undo step. Right-click resets to the theme, and Alt-click or I picks a style. The hovered surface is highlighted and named in the footer.
- **Tile inspector:** material and tint per slot, with "Theme" to clear an override.
- **Rendering:** faces sharing a material and tint merge into one mesh, so draw calls scale with distinct looks, not tile count. The same styler draws the editor, TEST and online matches.
- **Map format v2:** `tiles[].surfaces` per-slot overrides. v1 files (and old autosaves) migrate automatically; a v1 fixture is tested. Validation rejects unknown materials/themes and malformed tints.
- **Tests:** paint scopes, no-op repaints, clearing, theme changes and full undo in unit tests. e2e paints a wall, paints every floor in one stroke, undoes it, and checks the painted map survives reload.

## M2 — what exists

**Weapons** (`shared/src/sim/weapons.ts`, data-driven):

| Slot | Weapon | Model | Role |
|---|---|---|---|
| 1 | Knife | Quaternius bayonet | Melee, 55 dmg, three-ray fan |
| 2 | Pistol | Quaternius Pistol_1 | Spawn weapon, 12-round magazine |
| 3 | Assault Rifle | Quaternius AssaultRifle_1 | Automatic |
| 4 | Shotgun | Quaternius Shotgun_1 | 8 pellets × 9 dmg |
| 5 | Sniper Rifle | Quaternius SniperRifle_1 | 75 dmg, scope zoom (RMB) |
| 6 | Grenade Launcher | Kenney blaster-h (recoloured) + grenade | Lobbed projectile, 4.5 m splash, 60 % self-damage, no splash through walls |

- **Inventory:** each weapon has a magazine, reserve, reload and raise time. Players spawn with knife + pistol. Empty magazines reload on fire or with R. Switching uses 1–6, the mouse wheel or Q (last weapon). New guns auto-switch when picked up.
- **Items** (`sim/items.ts`): small/large health, small/large armor (absorbs ⅔ of damage), ammo box, the four weapon pickups, Speed Boost (×1.35 for 15 s) and Double Damage (15 s), each with a default respawn time.
- **Map format v3:** a `pickup` entity (item + optional respawn override). v2 maps migrate (fixture tested). The validator flags unknown items and suggests adding health. The Phase 0 arena now has 13 pickups.
- **Lag compensation:** inputs carry the server tick the player was looking at. Hitscan and melee from humans are resolved against recorded positions at that tick, rewinding at most 18 ticks (300 ms). Bots and projectiles use the present.
- **Bots:** they pick the best owned weapon for the distance (each weapon's desirability and range band, adjusted for personality, avoiding splash damage up close). They reload when empty or safe, lead lobbed grenades for drop, and detour for pickups by need × item greed ÷ distance. Retreating bots head for health.
- **Client:** first-person weapon models with bob, recoil, raise/reload motion and muzzle flash. Remote players hold their current weapon, and powerups glow on them. Pickups spin and bob, and hide while respawning. Grenades are drawn smoothly between snapshots, with explosion effects, scope overlay and zoom sensitivity. The HUD shows ammo, armor, weapon bar, powerup timers, pickup messages and kill-feed weapon names.
- **Prediction:** movement, including speed boosts, stays exact. A test shows exactly one correction, when the server reports the pickup; the boost and its expiry then predict exactly. Weapon state is predicted cosmetically (instant tracers and kick); the server stays authoritative.
- **MapMaker:** a palette entry per item, placement and erasing, and an inspector (item type, respawn override, position). Placed pickups are drawn with the same visuals as in game.
- **Content pipeline in use:** `pnpm content:build` converts the selected Quaternius OBJ files with our own OBJ→glTF converter, bakes and normalises the Kenney GLBs, recolours Kenney's palette texture, enforces budgets and writes `content/provenance.json`. `pnpm content:check` runs in CI. The asset viewer (`?mode=assets`) shows every model with its licence.
- **Measured:** the 32-bot bench averages 0.79 ms per tick, 2.4 ms p99.

### Known M2 gaps

- **Audio:** the first audio pass has landed (see [`AUDIO.md`](AUDIO.md)). Gunshots are synthesised in-house as placeholders until recorded CC0 gunshots are imported.
- **Placeholder models.** Viewmodels are bare guns, with no hands or arms until the character rig lands in M5. Remote players are still capsules holding a gun.
- **Projectiles are not lag-compensated** (standard for slow projectiles), and pickups are not predicted client-side.
- **Bot stuck recoveries rose** with pickup detours (~88 per minute across 32 bots in the bench, up from ~50). Tuning goes with the nav-debug overlay work.
- **Recoil and spread** are fixed values per weapon. There is no recoil pattern or movement inaccuracy yet. Balance numbers are first-pass.

## M5 — what exists so far

- **Rig standard and parts:** one 65-joint skeleton for two body types. Every character in the free CC0 Quaternius packs is used: base bodies, the Ranger and Peasant outfits as mixable parts, six hairstyles, colourways, both mannequins and 20 animation clips. They're prepared by `tools/content/prepare-characters.mjs` and checked by `content:check` against `content/characters.lock.json`. Details in [`CHARACTERS.md`](CHARACTERS.md).
- **In game:** players, Player Bots and NPCs are animated characters instead of capsules. Animation covers:
  - locomotion matched to speed, including backpedalling and strafing;
  - aim pitch on the spine, with the weapon in the hand;
  - shot, melee and reload one-shots on the upper body;
  - death, and a dance at intermission.
- **Looks:** fourteen presets mixing parts, colourways, skin and hair tints. The main menu has a **Character** picker; the choice is sent to the server and shown to everyone through the roster. Bots get a spread of looks.
- **Viewer:** `?mode=characters` shows every look and NPC with motion and weapon controls.

## M4 — what exists

The creator guide is the "NPCs, factions and co-op" section of [`SCENARIO.md`](SCENARIO.md).

- **Map format v5:**
  - a `factions` list (an empty list means the default enemy faction, *Syndicate*);
  - the `encounter` entity;
  - the co-op mode in `supportedModes`.
  - v4 maps migrate (fixture tested).
- **Factions:** any number of creator factions with ally / neutral / enemy relations to the players and to each other. Each faction is allied with itself and an enemy of everyone else unless told otherwise. Deathmatch players fight everyone.
- **NPC combatants:**
  - They don't use player slots; actor IDs start at 100.
  - One squad archetype with three roles: Trooper (rifle, 70 HP), Gunner (shotgun, 90 HP) and Heavy (grenade launcher, 160 HP, slower).
  - They reuse the Player Bot brain with an NPC profile (worse aim, slower reactions, skill per encounter) and never run out of ammo.
  - Dormant NPCs (no enemy within 70 m and nothing sighted) skip thinking.
- **Encounters and squads:**
  - Settings: first-wave roster, max alive, a reinforcement pool trickled in every N seconds, extra reinforcements per extra player (co-op scaling), and a spawn radius.
  - Spawns avoid enemies and crowding.
  - Squad orders: hold, attack (hunt), defend a target, patrol to a target, follow the players.
  - Squadmates share sightings.
- **Combat rules:**
  - No friendly fire: shots, grenades and splash pass through or ignore allies. Hazards and your own grenades still hurt.
  - Only players score; deaths to NPCs count as deaths. NPC weapons deal 55 % damage to players (`NPC_DAMAGE_TO_PLAYERS`), so squads are dangerous in numbers rather than one-shot killers.
  - Lag compensation covers NPCs.
- **Co-op mode:**
  - Every player and Player Bot is on the players faction, with no score or time limit.
  - Bots hunt the mission's NPCs (or stay with a human).
  - Logic ends the round with **players win** / **players lose**, shown as "Mission complete" / "Mission failed".
- **Logic:**
  - events: Encounter cleared, An NPC dies;
  - condition: NPCs alive in (compare);
  - actions: Start encounter, Stop reinforcements, Order squad to …
- **Network:** NPCs travel as compact 11-number tuples (`snapshot.np`) and share player interpolation on the client.
- **Client:** NPCs are capsules in their faction colour with a helmet, shoulder pads, a red visor and their weapon. Heavies are bigger. They appear in the kill feed by faction and role ("Syndicate Heavy").
- **MapMaker:**
  - an **NPC Squad** tool (the spawn area, a flag and figures in the faction colour);
  - a full encounter inspector;
  - a **Mode** setting (Deathmatch / Co-op mission);
  - a **Factions** section in the Logic panel;
  - three new templates: Ambush, Clear the squad, Co-op win when all squads are cleared.
  - Validation flags unknown factions, empty squads, defend/patrol orders without a target, and co-op maps with no enemies.
- **Demo:** *Outpost Siege* (`maps/m4_outpost.json`; main menu → "Play Outpost Siege", or a MapMaker template). You take the courtyard with a militia escort, open the gate, hold the uplink for 60 s against waves from two sides, then fight to evac. The team shares 15 lives. A test plays it through to victory, and another runs 3 Player Bots + NPCs on it until the courtyard falls.
- **Measured** (`pnpm bench 32 15 -- --npcs=N`): 32 bots alone 0.8–1.1 ms per tick; 32 bots + 32 NPCs 2.8 ms (p99 6.5); 32 bots + 64 NPCs 4.2 ms (p99 9.3), against a 16.7 ms budget.

### Known M4 gaps

- NPCs are full-rate in snapshots (about 40 bytes each at 30 Hz). Interest management (distance/visibility-based rates) is next before larger NPC counts online.
- No cover-seeking, grenades thrown by hand, or medic/sergeant roles yet; the squad is one archetype with three weapons.
- Players can't give squad orders yet (CHARACTERS_BOTS_V2 §16); logic can.
- NPCs use the animated mannequin in faction colours until faction outfits exist (M5).
- Team Deathmatch on factions is scheduled with M5.

## M3 — what exists

Details and the creator guide are in [`SCENARIO.md`](SCENARIO.md).

- **Map format v4:** five new entity kinds (door, button, destructible, zone, trap), optional entity names, and a `logic` block (variables, timers, objectives, rules). v3 maps migrate with empty logic (fixture tested).
- **Scenario objects:** sliding double doors (auto, manual with E, locked); wall buttons with a custom prompt, single use and cooldown; crates, explosive barrels (chain reactions) and breakable walls (optionally explosives-only); trigger zones (any player / N players / everyone).
- **Traps:** spike floor, flame jet, crusher, proximity mine, laser fence. Each can be always on, on a cycle (with an offset so rows ripple), stepped on (with a warning), or fired by logic. Damage is configurable, and kills show in the feed ("was crushed").
- **Logic:** WHEN → IF → DO rules interpreted by the server (`sim/scenario.ts`); there is no creator code. 13 events, 5 condition types, 18 actions, including `wait` sequences, objectives, timers, variables, messages, sound cues and ending the round. Runaway chains are cut off at depth 8.
- **Networking:** scenario state replicates as deltas with a keyframe every 2 s, and a full copy on join. Door and crate colliders are mirrored in client prediction.
- **Bots:** they treat locked or manual doors and intact breakable walls as walls when planning, and wait at the edge of active traps. Mines stay hidden from them.
- **Client:** procedural models for every object, animated from replicated state; objectives list, HUD marker, timers, creator messages and the "E" prompt; 17 new sounds (Kenney CC0 + synthesised flame, beep and alarm).
- **MapMaker:** a Scenario & Traps palette (doors and lasers snap into doorways), per-kind inspector fields, a rules list per object with "Add rule for this", and the **Logic panel** (L) with objectives, variables, timers, rule forms and six quick templates. Every logic edit is one undo step. Validation flags broken references, buttons that do nothing, locked doors nothing opens, traps nothing fires, and objectives nothing completes.
- **Demo:** *The Vault* (`maps/m3_vault.json`, main menu → "Play The Vault", or a MapMaker template). A test plays it through to a win.
- **Measured:** the 32-bot bench is unchanged (0.82 ms per tick); a 6-bot, 60 s Vault match runs in the test suite.

### Known M3 gaps

- No visual graph editor yet; rules are forms (MASTER_SPEC's "Expert" layer comes later over the same data).
- Bots don't press buttons or pursue objectives; that comes with NPC/co-op work in M4.
- Doors and traps aren't lag-compensated, and the client doesn't predict door motion (it follows the server).
- Zones are axis-aligned boxes; no faction filters until M4 adds factions.

## Known M1 gaps

- No marquee selection or copy/paste between maps yet (duplicate covers in-map copies).
- Validation reports navmesh *reachability* but there is no visual navmesh/bot-path debug overlay in TEST yet (spec v1 §7.5). That is planned with M2's bot work.
- Rebuilding meshes on every edit is fine at slice scale. Large maps will need per-tile chunks.
- Map storage is browser-local (plus file export). Cloud storage arrives with accounts in Phase 5.
- The leftover "WebGPU context restoration failed" console error after a fallback is Babylon noise from the abandoned engine. It is harmless.
