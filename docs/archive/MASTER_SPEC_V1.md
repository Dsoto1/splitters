> **ARCHIVED — superseded by [`../MASTER_SPEC_V2.md`](../MASTER_SPEC_V2.md).** Where this file conflicts with the v2 pack, v2 wins. In particular, Godot / PC-first / listen servers / 12–16 players (§header, §12, §18, §19) and the `.cmap` package layout (§10.1) are replaced by the browser + TypeScript + Babylon.js + dedicated-server direction. Sections that v2 does not cover (e.g. movement verbs §5.1, weapon data fields §5.2, pickups §5.4, validation severity classes §9, map versioning fields §10.3, front-end UX §13, challenges §14, accessibility §17, save/profile §20) remain useful reference until the matching v2 supporting docs exist.

# PROJECT TILE TRIGGER — MASTER PRE-PRODUCTION SPEC

> Working title only. An original, PC-first arena FPS and community creation platform inspired by the speed, accessibility, variety, bots, customization, and grid-based MapMaker philosophy of classic console arena shooters—especially the TimeSplitters trilogy.

**Document status:** Pre-production / agent handoff  
**Target engine:** Godot 4.x  
**Primary platform:** Windows PC  
**Secondary targets:** Linux / Steam Deck; controller support; later console feasibility  
**Core principle:** *Build a great game that happens to contain a great level editor—and a great editor that can produce the same game the developers make.*

---

## 1. PRODUCT VISION

### 1.1 Elevator pitch
Tile Trigger is a fast, stylized arena FPS built around instant fun, configurable bots, absurd character variety, highly customizable matches, and a powerful but approachable in-game MapMaker. Players can create, test, share, remix, and play maps without installing external development tools.

### 1.2 Design pillars
1. **Instant Fun** — launch a match with humans and/or bots in seconds.
2. **Creation Without Friction** — MapMaker is understandable in minutes and deep for years.
3. **Bots Are Players** — every major multiplayer mode and community map should work offline with AI.
4. **Ridiculous Variety, Coherent Rules** — characters, eras, weapons, maps, modifiers, and modes can clash aesthetically without breaking gameplay readability.
5. **Local + Online + Offline** — do not make the game dependent on servers to remain useful.
6. **Short Feedback Loop** — Edit → Test → Adjust → Publish should take seconds, not minutes.
7. **Original IP** — reproduce design lessons, not copyrighted TimeSplitters content.

### 1.3 Experience target
A player should be able to:
- launch a bot match in <30 seconds;
- build a basic playable arena in <10 minutes;
- test a map from the editor in <3 seconds on target hardware;
- understand why a bot failed to navigate a custom map;
- host/download/remix community maps with minimal friction;
- play meaningful content without an internet connection.

---

## 2. LEGAL / COMPATIBILITY BOUNDARY

### 2.1 Safe production rule
The shipping project must use:
- original project name and branding;
- original characters and character models;
- original weapon models/names where protected expression is implicated;
- original environment art, textures, sounds, music, UI, icons, dialogue, and writing;
- original recreations of gameplay concepts and generic genre mechanics.

Do **not** make extracted TimeSplitters assets a project dependency.

### 2.2 Legacy map compatibility research
A separate, optional compatibility layer may investigate importing **user-supplied legacy map data** where technically and legally appropriate. The importer should translate abstract information such as:
- tile topology;
- tile orientation;
- floor/elevation;
- spawn locations;
- pickup categories;
- objective markers;
- lighting parameters;
- logic relationships;
- match settings.

Imported references should resolve to **our own equivalent assets**, not bundled copyrighted source assets.

### 2.3 Importer architecture rule
Legacy compatibility must live behind an adapter:

`Legacy Source Data -> Parser -> Neutral Map IR -> Validation -> Tile Trigger Map Format`

Never couple the runtime map format directly to a proprietary source format.

### 2.4 Official levels
Do not ship extracted/reconstructed proprietary official levels without appropriate rights. Original arenas may study high-level design principles—loops, sightlines, verticality, risk/reward, item placement—but should be independently authored.

---

## 3. CORE GAME LOOP

### 3.1 Primary loop
**Choose content → Configure match → Play → Results/rewards → Rematch/change settings/map → Play again**

### 3.2 Creator loop
**Create/open map → place/edit → validate → instant test → return to exact edit state → refine → publish/share → observe ratings/play data → update**

### 3.3 Long-term loop
- complete challenges and arcade events;
- unlock optional cosmetics/presets/editor decorations;
- build maps;
- curate playlists;
- follow creators;
- remix maps where permission allows;
- create custom rulesets;
- play rotating community collections.

No gameplay-critical unlock should make competitive players statistically stronger.

---

## 4. GAME MODES

### 4.1 Launch baseline
- Deathmatch
- Team Deathmatch
- Elimination
- Team Elimination
- Capture the Objective/Bag
- Zones / Domination
- Infection / Virus
- King / Gladiator
- Thief / Score Carrier
- Shrink-style score-pressure mode
- Assault / Attack-Defend
- Last Stand / survival

### 4.2 Post-baseline candidates
- Escort
- Oddball-style possession
- Bounty
- Gun progression
- Hunter/prey
- Juggernaut
- Race/checkpoints
- Horde
- asymmetric escape
- custom scripted objectives

### 4.3 Ruleset modifiers
Every compatible mode should expose data-driven options such as:
- score limit;
- time limit;
- teams;
- friendly fire;
- respawn delay;
- lives;
- starting weapon;
- weapon set;
- pickup respawn;
- health/armor multiplier;
- movement speed;
- gravity;
- headshots;
- radar;
- powerups;
- bot count/difficulty;
- character restrictions;
- teams auto-balance;
- sudden death;
- damage multiplier.

Use a reusable `MatchRules` resource rather than mode-specific hardcoding.

---

## 5. PLAYER MOVEMENT & COMBAT

### 5.1 Movement goals
Fast, readable, responsive—not a military simulator and not a movement-tech esports shooter.

Baseline verbs:
- walk/run;
- strafe;
- jump;
- crouch;
- optional contextual mantle only if it does not complicate map validation;
- ladders/ramps/elevators where authored;
- no stamina bar for ordinary movement.

### 5.2 Gunplay
Weapons use data-driven definitions containing:
- damage;
- fire rate;
- magazine/ammo pool;
- reload behavior;
- hitscan/projectile;
- spread/recoil;
- range/falloff;
- projectile velocity/gravity;
- splash radius;
- primary/alternate fire;
- AI desirability profile;
- pickup respawn class;
- audiovisual references.

### 5.3 Initial weapon families
- fists/melee novelty;
- pistols;
- revolver/heavy pistol;
- SMG;
- assault rifle;
- shotgun;
- sniper;
- LMG;
- grenade launcher;
- rocket launcher;
- energy weapon;
- flamethrower-like area denial;
- thrown explosives;
- mines;
- novelty projectile weapon;
- throwable environmental/brick-like item.

Aim for **20–30 strong weapons before chasing 50+**.

### 5.4 Pickups
- health small/large;
- armor small/large;
- ammo;
- weapon pickup;
- temporary speed;
- temporary damage;
- cloak/invisibility;
- shield;
- mode-specific objective items.

---

## 6. CHARACTER SYSTEM

### 6.1 Goal
Large memorable roster without requiring every character to be a bespoke gameplay class.

### 6.2 Launch target
30–50 original characters across multiple eras/themes, scalable to 100+.

Suggested families:
- prehistoric;
- ancient;
- medieval;
- age of sail;
- Victorian/industrial;
- early 20th century;
- modern espionage;
- weird science;
- near future;
- far future;
- robots;
- undead/monsters;
- mascots/comedy characters.

### 6.3 Gameplay stats
Keep differences modest and visible. Potential stats:
- movement;
- max health;
- target profile/size;
- handling modifier only if balance survives it.

Provide a **Competitive Equalized** setting that normalizes gameplay stats.

### 6.4 Silhouette rule
A character should be recognizable at gameplay distance by silhouette and dominant shape. Avoid realistic visual noise.

---

## 7. BOTS / AI

### 7.1 Non-negotiable requirement
Bots must work on developer maps and MapMaker maps with no manual waypoint authoring required for ordinary layouts.

### 7.2 Navigation
Preferred architecture:
- map tiles expose navigation surfaces/links;
- editor composes navigation metadata as pieces are placed;
- dynamic validation checks disconnected regions;
- runtime navigation handles doors/elevators where supported;
- optional baked navigation pass on publish;
- fallback recovery when a bot is stuck.

### 7.3 Bot brain layers
1. **Strategic:** mode objective, team role, score state.
2. **Tactical:** seek enemy, defend, flee, collect health, choose weapon.
3. **Navigation:** path selection and local avoidance.
4. **Combat:** aim, fire, alternate fire, dodge, range management.
5. **Humanization:** reaction delay, imperfect knowledge, aim noise, attention limits.

### 7.4 Personality dimensions
- aggression;
- objective focus;
- self-preservation;
- pickup greed;
- preferred engagement range;
- accuracy;
- reaction speed;
- pursuit persistence;
- teamwork;
- weapon preferences.

Difficulty should adjust several dimensions—not simply enemy health/damage.

### 7.5 Bot debugging overlay
MapMaker test mode must optionally show:
- current path;
- destination;
- perceived enemies;
- current AI state;
- unreachable objective markers;
- navigation gaps;
- stuck counter.

This is essential for community creators.

---

## 8. MAPMAKER — PRODUCT CENTERPIECE

### 8.1 UX philosophy
The editor should feel like a game, not CAD software.

Default layout:
- **Top:** File/Edit/Test/Publish + undo/redo + validation status.
- **Left:** searchable asset/tile browser.
- **Center:** 3D editing viewport.
- **Right:** contextual inspector for selected objects.
- **Bottom:** floor/layer control, budget/status, selection summary, test controls.

### 8.2 Camera controls
PC-first:
- RMB + mouse = orbit/look;
- WASD = fly/pan;
- MMB = pan;
- wheel = zoom;
- F = focus selection;
- top/front/side/isometric quick views;
- floor isolation;
- optional orthographic grid mode.

Controller receives a dedicated scheme rather than emulating mouse input.

### 8.3 Selection
Support:
- click select;
- Ctrl/Shift additive selection;
- drag marquee;
- select all same type;
- invert selection;
- lock/hide;
- group;
- duplicate;
- copy/paste;
- delete;
- rotate;
- move floor;
- replace tile/object type.

### 8.4 Placement model
Use a hybrid system:

**Structural Grid Pieces**
- rooms;
- corridors;
- corners;
- junctions;
- stairs;
- ramps;
- pits;
- bridges;
- vertical connectors;
- doors/gates;
- exterior platforms.

**Free Props**
- crates;
- furniture;
- statues;
- signs;
- foliage;
- cover;
- decorations;
- lights;
- hazards.

Structural pieces guarantee connectivity. Props add expression.

### 8.5 Smart placement
When hovering a structural tile:
- preview valid placement;
- show connection ports;
- snap rotation;
- reject overlap;
- flag inaccessible connectors;
- optionally auto-cap unused doorways/walls.

### 8.6 Themes
A map's structural layout should be separable from its visual theme where feasible.

Example launch themes:
- Egyptian/ancient tomb;
- gothic castle;
- industrial factory;
- research laboratory;
- military compound;
- urban/nightlife;
- western/frontier;
- jungle/ruins;
- space station;
- cyber/future;
- horror/institution;
- clean prototype/dev theme.

Theme switching should preserve topology while replacing compatible surfaces/props.

### 8.7 Entity placement
Creators can place:
- player/team spawns;
- weapons;
- ammo;
- health/armor;
- powerups;
- objective zones;
- objective objects;
- teleporters;
- doors;
- switches;
- turrets;
- hazards;
- lights;
- sounds;
- vehicles later;
- NPC/story actors later.

### 8.8 Logic editor
Provide two layers.

**Simple Logic**
Human-readable recipes:
- When player enters zone → open door.
- When switch activated → spawn enemies.
- When objective collected → enable extraction.
- When all targets destroyed → win.

**Advanced Logic**
Node graph with:
- events;
- conditions;
- variables;
- counters;
- timers;
- comparisons;
- actions;
- gates;
- random selectors;
- sequence;
- message/HUD output.

No arbitrary code execution in downloaded maps.

### 8.9 Undo/redo
Use command-pattern transactions. Every destructive editor action must be undoable unless clearly documented otherwise. Multi-object operations are one history step.

### 8.10 Autosave / recovery
- rolling autosave;
- crash recovery;
- explicit versions;
- local backup history;
- never destroy the only copy of a map during migration.

### 8.11 Instant test
`F5` / prominent **TEST** button:
1. serialize unsaved editor state to temporary package;
2. validate;
3. launch match in-process;
4. ESC/End Test returns to editor;
5. restore camera, selection, active floor, and undo history.

Target transition: 1–3 seconds.

---

## 9. MAP VALIDATION

### 9.1 Validation classes
**Errors** prevent publishing or a selected mode from launching.
**Warnings** allow play but identify likely problems.
**Suggestions** are quality hints.

### 9.2 Examples
Errors:
- no spawn points;
- overlapping structural tiles;
- objective missing required endpoint;
- team mode missing team spawn;
- logic references deleted entity.

Warnings:
- spawn visible from opposing spawn;
- isolated navigable island;
- pickup inside geometry;
- bot cannot reach objective;
- no health pickups;
- severe team spawn imbalance.

Suggestions:
- long sightline lacks cover;
- high-value weapon has no contest route;
- excessive travel distance between action zones.

Clicking an issue focuses the offending object.

---

## 10. MAP FILE FORMAT

### 10.1 Principle
Maps are **data**, not executable scripts.

Suggested package:

```
MyMap.cmap/
  manifest.json
  layout.json
  entities.json
  logic.json
  lighting.json
  thumbnail.webp
  nav.cache          # generated, disposable
```

Can later zip/package as a single distributable file.

### 10.2 Stable IDs
Every placeable item uses a stable GUID plus catalog ID. Never persist raw scene-tree paths as authoritative references.

### 10.3 Versioning
Include:
- format version;
- game version;
- required content packs;
- author ID;
- parent/remix ID;
- creation/update timestamp;
- supported modes;
- minimum player count;
- recommended player count.

Implement migrations from day one.

---

## 11. COMMUNITY / SHARING

### 11.1 Map browser
Filters:
- newest;
- trending;
- highest rated;
- most played;
- friends/following;
- mode;
- player count;
- theme;
- tags;
- bots supported;
- remixable;
- verified/featured.

### 11.2 Map card
Show:
- thumbnail;
- title;
- creator;
- supported modes;
- players;
- rating;
- plays;
- update date;
- dependencies;
- bot compatibility;
- remix permission.

### 11.3 Remixing
Creator selects:
- no remix;
- remix with attribution;
- unrestricted remix within platform.

A remix maintains parent lineage.

### 11.4 Safety
Downloaded maps cannot execute arbitrary GDScript/native code. User-generated text/images require moderation/reporting strategy if public uploads permit them.

---

## 12. MULTIPLAYER

### 12.1 Required play configurations
- solo vs bots;
- local split-screen (target 2–4 if performance/UI permits);
- LAN;
- private online lobby;
- public online lobby;
- mixed humans + bots.

### 12.2 Networking model
Start with host-authoritative listen servers for practical scope. Architect gameplay so dedicated servers can be added later.

Server/host owns:
- damage;
- pickups;
- scoring;
- match state;
- objective state;
- bot authority;
- spawn decisions.

Clients predict local movement and interpolate remote actors.

### 12.3 Map transfer
On lobby join:
1. compare map/content hash;
2. download approved package if missing;
3. verify checksum/version/dependencies;
4. cache locally;
5. load when all clients ready.

### 12.4 Host migration
Desirable, not MVP. Do not let it block first playable multiplayer.

---

## 13. FRONT-END UX

### 13.1 Main navigation
- Play
- MapMaker
- Community
- Challenges
- Collection
- Options

### 13.2 Play
- Quick Match
- Custom Match
- Online
- LAN
- Split Screen
- Training

### 13.3 Custom match principle
Configuration should happen on **one readable screen**, not through ten modal pages.

Recommended layout:
- left = map;
- center = players/teams/bots;
- right = mode/rules;
- bottom = weapon/powerup preset + Start.

Presets can be saved and shared.

---

## 14. CHALLENGES / ARCADE CONTENT

### 14.1 Purpose
Teach systems, provide solo progression, showcase unusual rules, and give players ideas for custom matches.

Challenge categories:
- weapon mastery;
- survival;
- objective speedrun;
- accuracy;
- defense;
- movement;
- novelty/comedy;
- bot gauntlet;
- puzzle/logic maps.

### 14.2 Medal model
Bronze / Silver / Gold / Platinum thresholds.

Rewards should primarily unlock:
- characters/cosmetics;
- editor props/themes;
- presets;
- badges;
- novelty options.

---

## 15. ART DIRECTION

### 15.1 Style
Stylized, expressive, slightly exaggerated 3D with strong silhouettes and modern PBR lighting. Avoid photorealism.

### 15.2 Cross-era cohesion
Use shared rules for:
- proportions;
- edge softness;
- material response;
- saturation/value range;
- weapon readability;
- environmental scale;
- lighting contrast.

This lets Egyptian tombs, space stations, gothic castles, and comedy characters coexist.

### 15.3 Performance
Environment kits should be modular, instancing-friendly, and LOD-ready. Community maps need predictable performance budgets.

---

## 16. AUDIO

- punchy, readable weapons;
- distinct pickup cues;
- announcer optional;
- footsteps by material;
- positional objective cues;
- theme ambience;
- music playlists by environment/match mood;
- creator-placed ambience volumes;
- audio accessibility controls.

Do not use original TimeSplitters audio without rights.

---

## 17. ACCESSIBILITY / INPUT

Required early, not post-launch:
- full key rebinding;
- controller remapping;
- mouse sensitivity + raw input option;
- FOV slider;
- subtitle controls;
- colorblind-friendly team/objective palettes;
- reduced camera shake;
- hit marker controls;
- hold/toggle aim/crouch options;
- UI scale;
- text scale;
- crosshair presets;
- photosensitivity-conscious effects options.

MapMaker must be completely usable by mouse/keyboard.

---

## 18. TECHNICAL ARCHITECTURE — GODOT

### 18.1 Major systems

```
/core
  Game.gd
  SaveService.gd
  ContentRegistry.gd
  EventBus.gd

/gameplay
  player/
  weapons/
  pickups/
  objectives/
  modes/
  bots/

/maps
  runtime/
  format/
  validation/
  navigation/
  legacy_import/

/editor
  viewport/
  commands/
  catalog/
  inspector/
  logic/
  test_session/

/network
  lobby/
  replication/
  map_transfer/

/community
  browser/
  publishing/
  cache/

/ui
  shell/
  match_setup/
  hud/
  results/
```

### 18.2 Data-driven content
Use Godot Resources or equivalent data definitions for:
- weapons;
- pickups;
- characters;
- modes;
- tiles;
- props;
- themes;
- bot profiles;
- challenge definitions.

Game logic should refer to stable content IDs.

### 18.3 Separation
Editor and runtime must share the same map serializer and content registry. Do not create separate representations that drift apart.

---

## 19. PERFORMANCE TARGETS

Initial PC target:
- 60 FPS at 1080p on modest gaming hardware;
- 12–16 active combatants baseline;
- scalable to larger counts after profiling;
- community-map budgets enforced/communicated;
- fast map load and editor test transitions.

Editor budget meter should estimate:
- structural complexity;
- props;
- lights/shadows;
- dynamic entities;
- AI/nav complexity;
- particles;
- memory.

Use soft warnings before hard limits whenever possible.

---

## 20. SAVE / PROFILE

Persist locally:
- options;
- unlocks;
- challenge medals;
- favorite maps;
- local maps;
- editor preferences;
- saved rulesets;
- bot presets.

Cloud sync is additive, not required for basic functionality.

---

## 21. DEVELOPMENT PHASES

### Phase 0 — Proofs
Build throwaway/isolated proofs for:
- FPS controller + weapon;
- modular tile snapping;
- composed navigation;
- bot traversing arbitrary tile layout;
- serialize/load map;
- editor selection/undo;
- in-process test transition.

**Gate:** do not scale content until these work together.

### Phase 1 — Vertical Slice
Deliver:
- 1 visual theme;
- ~20 structural pieces;
- 10 props;
- 4 weapons;
- health/armor/ammo;
- Deathmatch + Team Deathmatch;
- 8 bots;
- mouse-first MapMaker;
- save/load;
- validation;
- instant test.

This slice proves the product.

### Phase 2 — Arena Core
Add:
- 3–4 themes;
- 15–20 weapons;
- 20+ characters;
- 6+ modes;
- improved bot personalities;
- LAN/online lobby;
- map transfer;
- split-screen feasibility pass.

### Phase 3 — Creator Platform
Add:
- logic editor;
- advanced objectives;
- community browser;
- publish/update/remix;
- ratings/reporting;
- creator analytics;
- advanced validation.

### Phase 4 — Content / Progression
Add:
- challenges;
- arcade leagues/playlists;
- 30–50 characters;
- 20–30 weapons;
- curated maps;
- unlocks;
- polish/accessibility.

### Phase 5 — Legacy Compatibility R&D
Only after native format is stable:
- research user-supplied legacy map representation;
- build parser(s) separately;
- map legacy IDs to neutral semantic IDs;
- conversion report;
- unresolved-item UI;
- never block core product on this feature.

---

## 22. VERTICAL SLICE ACCEPTANCE TEST

A build passes the first major milestone when a new tester can:
1. launch MapMaker;
2. create a two-floor map using mouse/keyboard;
3. place eight spawns, weapons, health, and armor;
4. see validation feedback;
5. press Test;
6. play Deathmatch against seven bots;
7. return to editor;
8. move a room/pickup;
9. undo the change;
10. save the map;
11. close/reopen the game;
12. reload and successfully replay it.

If this is not delightful, **do not solve the problem by adding more content.** Fix the loop.

---

## 23. AGENT IMPLEMENTATION RULES

1. Prefer small composable systems over monolithic managers.
2. No hardcoded content catalogs in gameplay code.
3. Stable IDs for content and map entities.
4. Every editor mutation uses undoable commands.
5. Every map-format change includes migration strategy.
6. Validate untrusted community map data before instantiation.
7. Never allow downloaded maps to execute arbitrary code.
8. Bots and objectives must be tested on user-created layouts.
9. Profile before optimizing, but design community systems with budgets from the beginning.
10. Keep editor workflows keyboard/mouse-first while maintaining controller support for play.
11. Add automated tests for serialization, migration, rules/scoring, and validation.
12. Treat warnings/errors as actionable UI, not console-only developer messages.
13. Do not use copyrighted TimeSplitters assets, names, music, source code, or ripped content in production.
14. Compatibility experiments stay modular and optional.

---

## 24. RECOMMENDED REPOSITORY DOCUMENT SET

The master spec should be accompanied by:

- `GAME_DESIGN.md` — moment-to-moment game, modes, progression.
- `MAPMAKER.md` — full editor interaction/UX specification.
- `MAP_FORMAT.md` — schemas, IDs, migrations, package security.
- `BOTS_AI.md` — perception, decisions, navigation, personalities, debugging.
- `WEAPONS_ITEMS.md` — weapon taxonomy and data schema.
- `GAMEMODES.md` — rules and objective interfaces.
- `MULTIPLAYER.md` — authority, replication, lobby, map transfer.
- `CHARACTER_ART.md` — roster and visual language.
- `ENVIRONMENT_ART.md` — themes, modular kits, performance constraints.
- `UI_UX.md` — shell, match setup, HUD, MapMaker design language.
- `COMMUNITY.md` — publishing, discovery, remixing, moderation.
- `LEGACY_COMPATIBILITY.md` — research boundary and importer architecture.
- `ASSET_SOURCES.md` — licenses and approved third-party/free sources.
- `TECH_SPEC.md` — Godot architecture and engineering standards.
- `ROADMAP.md` — milestones, dependencies, acceptance criteria.

---

## 25. FIRST BACKLOG — DO THIS BEFORE CONTENT PRODUCTION

**P0**
- Create Godot project/repository structure.
- Implement FPS controller test room.
- Implement one hitscan weapon.
- Implement one bot with navigation and combat.
- Define `TileDefinition`, `MapDocument`, `MapEntity`, `ContentID`.
- Build 6 graybox structural tiles.
- Build snapping/rotation.
- Save/load JSON map.
- Generate/compose bot navigation.
- Implement editor camera + click selection.
- Implement command-based place/delete/move/rotate + undo/redo.
- Implement spawn/pickup entities.
- Implement Deathmatch scoring.
- Implement Test/Return-to-Editor loop.

**P1**
- Inspector.
- asset browser/search.
- marquee/multi-select.
- copy/paste/duplicate.
- validation panel.
- floor isolation.
- TDM.
- bot personalities.
- map thumbnail generation.
- crash recovery/autosave.

**P2**
- second theme;
- objective framework;
- Capture mode;
- Zones;
- Infection;
- multiplayer prototype;
- package hashing/transfer.

---

## 26. NORTH STAR

The project succeeds when players say:

> “I had an idea for a ridiculous FPS match, built it in ten minutes, filled it with bots, and my friends were playing it with me a few minutes later.”

Every major feature should reinforce that sentence.
