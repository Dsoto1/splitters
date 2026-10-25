# PROJECT TILE TRIGGER — MAPMAKER & SCENARIO SPEC v1

**Authority:** Supporting spec; `MASTER_SPEC_V2.md` wins on conflict.

## Mission
One browser editor must serve both a ten-minute deathmatch arena and a deep co-op scenario. Complexity is progressive, not mandatory.

## Workspaces
**BUILD | GAMEPLAY | ENTITIES | LOGIC | WORLD | TEST**

### BUILD
Classic Grid, Advanced Modular, optional Terrain, Freeform Props. Classic tiles retain grid X/Y/Z, rotation, family, theme/substitution and connection metadata for future compatibility work.

### GAMEPLAY
Player/team spawns, weapons, pickups, powerups, mode settings, scoring, lives/respawns, recommended player count and match modifiers.

### ENTITIES
NPCs, encounter spawners, squads, doors, destructibles, buttons, turrets, objective objects, checkpoints, trigger volumes, audio/world-state actors.

### LOGIC
Progressive complexity:
1. Templates.
2. WHEN -> IF -> DO forms.
3. Later visual graph over the same serialized model.

Initial events: match start, interact/press, enter/exit volume, damaged/destroyed, character/squad/encounter killed, item collected, objective state, timer, variable threshold.

Initial conditions: faction/team, variable comparisons, item/state possession, player-count/percentage in zone, objective state.

Initial actions: open/close/lock/unlock, enable/disable, spawn/start encounter, set/add variable, objective start/complete/fail, timer start/stop, message/audio cue, faction relationship, checkpoint, victory/failure.

### WORLD
Lighting/environment/theme, terrain, ambience, weather later, visual dressing, performance budget.

### TEST
One click enters playable runtime using the unsaved working map snapshot. Returning to edit preserves selection/history where practical. Test presets: Solo, Fill with Player Bots, Co-op Test, Team Test, NPC Load Test.

## Mouse-first interaction
Left click place/select; drag paint or marquee by tool context; right click erase/context; R rotate; Ctrl/Cmd+C/V duplicate/copy/paste; Ctrl/Cmd+Z/Y undo/redo; Shift additive selection; snapping controls; searchable palette; inspector; favorites/recent assets.

## Scenario primitives
### Factions
Arbitrary faction IDs with Ally/Neutral/Enemy relationships. Competitive Team A/B is a presentation layer, not the underlying data model.

### Encounters
Spawner defines roster/composition, active cap, reinforcement pool, spawn regions, orders, scaling, target/objective and stop conditions.

### Squads
Group high-level orders: FOLLOW, HOLD, ATTACK, DEFEND, MOVE/ROUTE. Individual NPCs handle local movement/combat.

### Objectives
Reach, interact, collect, kill/assassinate, destroy, defend, survive timer, escort, capture/hold, extraction, custom state-driven objective.

### Sequences
Named ordered action lists with waits, reusable from multiple events.

### Variables
Boolean, integer/float counter, simple enum/reference. No arbitrary creator code in initial release.

## Destruction
Destructible entities expose health, damage-type acceptance/resistance, states, debris/presentation policy, and Destroyed event. A door can therefore require explosives and trigger alarms/reinforcements when breached.

## 32-player-aware triggers
Zone triggers support Any Player, Specific Faction, N Players, Percentage of living faction, All living players, NPC/object entry. This prevents one rushing co-op player from unintentionally advancing a 32-player scenario unless the creator wants that.

## Validation
Show actionable errors/warnings for missing spawns, overlapping/unsafe spawns, disconnected critical navigation, unreachable objectives, broken references, impossible conditions, missing encounter spawn regions, faction loops, excessive active NPC estimates, asset/dependency failures, and mode incompatibility.

## Capacity analysis
Map metadata includes creator-selected and analyzer-suggested min/max players. Later analysis can estimate spawn density, traversal distances, item density, objective congestion and 32-player suitability.

## Legacy-aware editing
Classic Grid data remains separable from modern additions. A future imported map can be opened in compatibility mode or copied into Remaster mode where terrain/props/logic/32-player extensions become available.

## Vertical-slice acceptance scenario
Creator builds a small facility, places team spawns and six weapon types, adds a locked/destructible door and button, places an enemy encounter, creates an objective, wires at least one WHEN/IF/DO chain, tests it with bots/NPCs, returns to editor, changes it, undo/redoes, saves, reloads and replays.
