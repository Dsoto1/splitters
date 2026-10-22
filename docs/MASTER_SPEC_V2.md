# PROJECT CHRONOSPLIT — MASTER PRE-PRODUCTION SPEC v2

> **AUTHORITATIVE SOURCE OF TRUTH.** If any supporting document conflicts with this file, this file wins until the supporting document is revised.

**Status:** Pre-production / implementation handoff  
**Working title:** Project ChronoSplit (temporary)  
**Primary platform:** Modern desktop web browser  
**Client stack direction:** TypeScript + Babylon.js; WebGPU where available, WebGL2 fallback  
**Server direction:** Dedicated authoritative headless game servers; server runtime must not depend on browser rendering  
**Secondary feasibility:** installable desktop wrapper/native packaging may be evaluated later  
**Core promise:** Create, test, publish, share, and immediately play arcade FPS arenas and scripted scenarios from a browser.

---

## 1. PRODUCT DEFINITION

ChronoSplit is an original arcade FPS and community creation platform inspired by the accessibility, speed, bots, genre collision, customization, and grid-based creation philosophy of classic console arena shooters. It is **not a remake** and must not depend on copyrighted source assets.

The same runtime systems power developer-made and user-made content. MapMaker is not a reduced mod tool; it is the creation surface for the game itself.

### Design pillars
1. **Instant arcade fun** — fast movement, readable weapons, short setup time.
2. **MapMaker first** — a basic arena should be buildable in minutes.
3. **Depth without mandatory complexity** — simple maps require no scripting; advanced creators can build co-op missions and campaigns.
4. **Bots matter** — full player bots can fill multiplayer slots; scenario NPCs can populate larger battles.
5. **Browser-native sharing** — Publish -> URL -> Play is a defining experience.
6. **Ridiculous original variety** — large roster, many eras/genres, strong silhouettes, humor, horror, sci-fi, history, and absurdity without copying existing characters.
7. **Scalable battle composition** — PvP, PvE, co-op, PvPvE, asymmetric factions, and mixtures of humans/bots/NPCs.
8. **Compatibility-conscious architecture** — preserve a classic grid representation so user-supplied legacy MapMaker data can be investigated later without constraining modern tools.

---

## 2. SCOPE LANGUAGE: TARGETS VS MILESTONES

Documents MUST distinguish these terms:

- **Architectural requirement:** systems may not hard-code assumptions that prevent the target later.
- **Validated target:** performance/scale goal that must be proven by load testing before being promised publicly.
- **Vertical-slice requirement:** functionality required for the first complete playable proof.
- **Long-term aspiration:** content scale or feature depth that is not a launch promise.

Example: **32 player slots is an architectural requirement and validated target, not a requirement that the first prototype host 32 real users.**

---

## 3. PLATFORM AND ARCHITECTURE

### 3.1 Browser first
The primary experience runs in a desktop browser with no editor installation. Target Chrome/Edge/Firefox/Safari compatibility as practical; establish an explicit supported-browser matrix during implementation.

### 3.2 Client responsibilities
- rendering and animation;
- input;
- audio;
- HUD/UI;
- MapMaker UX;
- client prediction and interpolation;
- local presentation effects;
- asset streaming/caching;
- creator previews.

### 3.3 Dedicated server responsibilities
- authoritative match state;
- player movement validation;
- damage/hit resolution policy;
- weapons/projectiles requiring authority;
- pickups;
- objectives;
- factions;
- triggers/variables/sequences;
- player bots and NPC decision state;
- spawn/reinforcement director;
- anti-cheat-relevant validation;
- replication/interest management.

Do not make a player's browser the authoritative host for production online matches.

### 3.4 Networking scale
**Architectural maximum:** 32 active player slots. A slot can contain a human or a full Player Bot.

**Validated scaling path:** 8 -> 16 -> 24 -> 32 player slots.

**Scenario NPC target:** scale separately from player slots. Long-term target is approximately 64 active NPC combatants on suitable hardware, subject to measurement. Maps may define much larger reinforcement pools while limiting simultaneously active NPCs.

Never encode `16` as a structural maximum in teams, scoreboards, spawn systems, serialization, mode rules, or replication.

---

## 4. COMBATANT MODEL

### Humans
Network-connected players occupying player slots.

### Player Bots
Full replacements for humans. They occupy player slots, use normal weapons/pickups/objectives, and should be able to play standard competitive modes.

### NPC Combatants
Scenario population that does **not** consume player slots. NPCs can be allies, enemies, civilians, creatures, bosses, squad members, etc. They may use cheaper decision-making/replication/animation policies.

### Example supported composition
- 16 humans/bots Red + 16 humans/bots Blue;
- plus 20 Red NPC soldiers + 20 Blue NPC soldiers;
- or 1–32 co-op players against scenario NPCs;
- or 8v8v8v8;
- or asymmetric PvPvE.

Actual simultaneous NPC limits are performance budgets, not guarantees.

---

## 5. MAPMAKER IS THE CREATION PRODUCT

Do not split MapMaker and Scenario Maker into separate applications. MapMaker exposes increasing depth through major workspaces:

**BUILD | GAMEPLAY | ENTITIES | LOGIC | WORLD | TEST**

A casual creator can use only BUILD/GAMEPLAY. Scenario creators can add entities, factions, objectives, encounters, and logic.

### 5.1 Construction layers
1. **Classic Grid** — room/corridor/prefab structural tiles with X/Y/Z grid coordinates and rotation. This is the compatibility foundation.
2. **Advanced Modular** — floors, walls, platforms, stairs, ramps, catwalks, windows, doors, bridges, etc.; grid snapping remains available.
3. **Terrain** — optional sculpt/paint system: raise/lower, flatten, smooth, ramp, materials, vegetation/water as performance permits.
4. **Freeform Dressing** — props/scenery with move/rotate/scale and optional snapping.

Classic construction must remain useful even after advanced tools exist.

### 5.2 Mouse-first UX
Required fundamentals: click/drag placement, marquee/multi-select, copy/paste/duplicate, undo/redo, keyboard rotation, snapping, searchable palette, layers/categories, inspector, contextual properties, and near-instant Test mode.

### 5.3 Map validation
Validation should report spawn safety, missing objectives, unreachable critical spaces, disconnected navigation, faction problems, excessive budgets, missing dependencies, and recommended player capacity.

---

## 6. LEGACY COMPATIBILITY

The runtime map format must retain neutral structural concepts needed for future import research:

`tile family + grid X/Y/Z + rotation + theme/substitution + placed gameplay entities + settings/logic`

Future pipeline:

`User-supplied legacy data -> parser -> neutral import IR -> substitution/mapping -> validation -> ChronoSplit map`

Do not bundle extracted proprietary assets. Use original equivalent geometry/materials. Import R&D occurs after the creator/runtime foundations are stable.

Imported maps should eventually support two concepts:
- **Classic/Compatibility view:** preserve translated layout and constraints.
- **Remaster copy:** retain the legacy layout but permit modern terrain, props, logic, player counts, NPCs, etc.

---

## 7. SCENARIO LOGIC — CORE ARCHITECTURE

Scenario logic is a core requirement even though the first implementation is deliberately small.

### 7.1 Mental model
**WHEN -> IF (optional) -> DO**

Examples:
- WHEN Door destroyed -> DO Start alarm + Spawn encounter.
- WHEN Boss killed -> DO Unlock exit + Complete objective.
- WHEN Button pressed IF Power==ON -> DO Open hangar.
- WHEN Team enters zone -> DO Start defense timer.

### 7.2 Event sources
Doors, destructibles, buttons, trigger volumes, players, NPCs, squads, encounters, objectives, timers, pickups, score/state, and global scenario events.

### 7.3 Actions
Enable/disable/open/lock/destroy, spawn/despawn, start/stop encounter, set/add variable, objective changes, faction changes, messages/audio, lighting/world-state changes, timers, checkpoints, victory/failure.

### 7.4 Variables and conditions
Support booleans, numbers/counters, simple references/enums, AND/OR conditions, comparisons, and reusable sequences. Avoid arbitrary executable user code in initial community content.

### 7.5 Complexity tiers
- **Quick:** templates such as Locked Door + Key, Ambush, Wave Defense, Extraction, Boss Fight.
- **Advanced:** form-based WHEN/IF/DO editing.
- **Expert (later):** visual graph over the same underlying logic model.

---

## 8. FACTIONS, ENCOUNTERS, AND LARGE BATTLES

Do not hard-code Team A vs Team B. Scenario content uses factions and relationships. Competitive modes can present simpler team abstractions on top.

Support relationships such as Ally/Neutral/Enemy and configurable participation in objectives/scoring.

### Encounter spawners
Creators define composition, active limits, reinforcement pools, spawn regions, difficulty/player-count scaling, orders, targets, and stop conditions rather than hand-placing every reinforcement.

### Squads
NPCs may share high-level orders while retaining individual combat behavior. Initial order vocabulary should remain small: FOLLOW, HOLD, ATTACK, DEFEND, MOVE/ROUTE.

### Battle director
Long-term deterministic director chooses safe/logical reinforcement locations using spawn rules, objectives, population, and relevance. It is not generative AI.

---

## 9. GAME MODES

The framework must support competitive and scenario-driven modes using shared primitives.

Initial vertical slice:
- Deathmatch;
- Team Deathmatch;
- one scripted co-op scenario.

Long-term families include elimination, capture/return objective, zones/control, infection/virus, thief/score-carrier, gladiator/leader, assault, escort, defense, survival/waves, extraction, asymmetric battles, custom modifiers, and campaigns.

Modes must support bots unless their design explicitly makes that impossible.

---

## 10. CHARACTERS AND ORIGINALITY

Never begin production with “make our version of [existing character].” Reuse design principles—silhouette diversity, genre collision, comedy, readability—not protected expression.

### Vertical slice roster
**12 characters**, chosen to prove body/rig/material/animation diversity and bot personality differences. Suggested coverage:
- standard human;
- large human;
- small human;
- lanky human;
- armored/mechanical;
- robot;
- undead;
- creature;
- unusual silhouette/body family;
- serious archetypes and absurd archetypes.

The exact twelve are art-direction decisions.

### Content targets
- Vertical slice: 12.
- Early production: expand only after pipeline validation.
- Long-term aspiration: 300+ memorable original characters; 300–500 is a content-library aspiration, not a launch commitment.

Characters may be reused as avatars, Player Bots, NPCs, allies/enemies, objective characters, or boss variants where appropriate.

Difficulty and personality must be separate: a poor-aiming coward and a poor-aiming berserker should not behave identically.

---

## 11. VERTICAL SLICE — AUTHORITATIVE SCOPE

The first complete slice proves the product in miniature. It is not a content launch.

### Content
- 1 visual/environment theme;
- ~15–20 useful Classic/Advanced structural pieces;
- small prop set;
- 12 characters;
- 6 weapons covering pistol/automatic/shotgun/precision/explosive/melee roles;
- 2 pickups/powerups beyond ordinary ammo/health as appropriate;
- 1 enemy faction;
- 1 basic NPC squad archetype.

### Modes/content
- Deathmatch;
- Team Deathmatch;
- one short co-op scenario with a beginning, objective chain, encounter, and ending.

### Creator proof
The player must be able to:
1. open MapMaker in browser;
2. create a small multi-room/multi-level arena;
3. place spawns, weapons, pickups;
4. place a door/button/destructible;
5. place an NPC encounter;
6. create at least one WHEN/IF/DO relationship;
7. create an objective;
8. press TEST without an export/build step;
9. fight bots/NPCs;
10. return to edit state;
11. undo/redo and save;
12. reload the map and replay it.

### Multiplayer proof
Initial functional target: **8 player slots** on a dedicated authoritative server, including mixed humans/Player Bots. Architecture must already use 32-capable identifiers/collections/protocol assumptions.

After correctness, run staged load tests at 16, 24, and 32. Do not block the slice's creative loop on proving 32 real users.

### NPC proof
Start small (e.g. 8–16 active NPCs) and establish profiling. Scale toward 32/64 only after AI, animation, rendering, and replication budgets are measured.

---

## 12. PERFORMANCE PRINCIPLES

Browser constraints are product constraints.

Use:
- asset streaming and caching;
- instancing where appropriate;
- LOD/impostor policies;
- animation sharing/culling;
- occlusion/frustum culling;
- interest-managed network replication;
- staggered AI perception/tactical updates;
- squad-level high-level decisions;
- dormant NPC/spawner states;
- explicit creator budgets and warnings.

A map may define hundreds of reinforcement tickets without simulating hundreds of active characters.

Performance UI should explain what is expensive instead of exposing only a generic red meter.

---

## 13. COMMUNITY AND PUBLISHING

Long-term defining loop:

**Build -> Test -> Publish -> Share URL -> Play -> Remix**

Community maps require versioned dependencies, validation, moderation/reporting strategy, thumbnails/metadata, player-count recommendations, mode compatibility, and attribution/remix lineage.

Community services are not required for the earliest local vertical slice, but map serialization must be designed for portable/versioned content from the beginning.

---

## 14. DEVELOPMENT PHASES

### Phase 0 — Technical proofs
- browser FPS movement/rendering;
- authoritative dedicated server;
- two network clients;
- one weapon/damage loop;
- one Player Bot;
- minimal map serialization;
- performance instrumentation.

### Phase 1 — Vertical slice
Implement Section 11 exactly. Focus on Edit -> Test -> Play -> Edit and one complete competitive/co-op proof.

### Phase 2 — Creator foundation
- robust Classic Grid;
- advanced modular construction;
- terrain prototype then production decision;
- freeform props;
- navigation generation/validation;
- WHEN/IF/DO expansion;
- factions, encounters, objectives, templates;
- creator budgets.

### Phase 3 — Multiplayer scale
- staged 8/16/24/32 validation;
- replication/interest management;
- reconnect/join-in-progress;
- matchmaking/session services as selected;
- bot fill;
- spectator architecture.

### Phase 4 — Scenario scale
- NPC squads;
- reinforcement pools;
- battle director;
- bosses;
- checkpoints/revive/shared lives options;
- co-op scaling;
- advanced scenario logic;
- campaign/map chaining.

### Phase 5 — Community platform
- accounts/profile identity as required;
- publish/download/cache;
- community browser;
- shareable links;
- ratings/favorites/reporting;
- remix/fork lineage;
- version/dependency management.

### Phase 6 — Content expansion
- additional themes;
- roster expansion;
- weapon/powerup library;
- modes/challenges;
- developer scenarios/campaign content;
- voice/unlock progression.

### Phase 7 — Legacy compatibility R&D
- lawful user-supplied source-data research;
- parser/adapters;
- mapping/substitution tables;
- compatibility reports;
- Classic vs Remaster workflows.

---

## 15. NON-NEGOTIABLE ENGINEERING RULES

1. Master Spec v2 wins over conflicting supporting docs.
2. Browser is the primary platform; do not design around a native-only API without an abstraction/fallback.
3. Production online play is dedicated-server authoritative.
4. Player-slot structures support 32 even while early tests expose fewer slots.
5. NPCs are separate from player slots.
6. MapMaker and runtime share map/gameplay systems.
7. Classic Grid remains a first-class construction layer.
8. Scenario logic uses safe data-driven primitives; no arbitrary community script execution in initial releases.
9. Content systems are data-driven and versioned.
10. Characters/assets are original; legacy imports substitute our assets.
11. Measure before promising 32+64 concurrency.
12. Do not let long-term roster/content goals block the vertical slice.
13. Test maps must launch without a packaging/export workflow.
14. Human-readable debugging/validation is part of creator UX.
15. Every major system must be usable by developer-made and user-made content unless explicitly documented otherwise.

---

## 16. REQUIRED SUPPORTING DOCUMENTS

The implementation pack should contain:
- `MASTER_SPEC_V2.md` — authoritative product/scope decisions.
- `CHARACTERS_BOTS_V2.md` — roster, rigs, personality, Player Bots, NPC reuse.
- `MAPMAKER_SCENARIO.md` — construction, terrain, entities, logic, objectives, validation, test flow.
- `TECH_ARCHITECTURE.md` — browser client, server, serialization, simulation, performance, security boundaries.
- `MULTIPLAYER_AI_SCALE.md` — 32-slot architecture, replication, interest management, Player Bots, NPC/squad scaling, load tests.

Later: `WEAPONS_ITEMS.md`, `GAMEMODES.md`, `UI_UX.md`, `ART_BIBLE.md`, `ASSET_SOURCES.md`, `COMMUNITY_PLATFORM.md`, `LEGACY_COMPATIBILITY.md`, and `ROADMAP.md`.

---

## 17. FIRST IMPLEMENTATION QUESTION

Before large-scale content production, the team must prove this loop:

> **Open browser -> build room -> place gun/enemy/door -> attach trigger/objective -> Test -> fight -> return to editor -> change -> Test again.**

If that loop is not fast, understandable, and fun, adding hundreds of characters or 32-player matchmaking does not solve the product problem.
