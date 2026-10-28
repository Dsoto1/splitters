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

### Kit v20 (lights, blocks, movers, team filters)
Lights, free blocks and movers are logic targets: lights switch, recolour, flash and blink (alarms, trap tells, a cinema dimming); blocks drop, crumble, vanish and come back (trapdoors sprung from a lever, floors that collapse on cue, bridges that extend); movers (lifts, sliding walls, train cars, drawbridges) run on a loop or when logic sends them and carry whoever stands on them. Buttons, doors and zones take a team filter. Free blocks tilt (pitch and roll up to ±45°: ramps, roofs, wrecks) and liquids take a colour. MapMaker: Scenario palette **Lift**, **Sliding Wall**, **Drawbridge** (a mover and its block in one step), the mover inspector (mode, speed, turn speed, wait, points with hinge angles, carried blocks), block pitch/roll and *Starts hidden*, light *Starts off*/*Blinks*, liquid *Colour*, *Team only* on buttons/doors/zones, and a colour picker for "Set light colour". Details in [`SCENARIO.md`](SCENARIO.md) and [`SET_PIECES.md`](SET_PIECES.md).

### Style Packs (Set 1)
The palette's **Style Pack** picker (under the search box) narrows the tiles, props, gameplay pieces, vehicles and pickups to one pack, offers its theme (**Use theme**) and, while a pack is picked, gives its gameplay pieces tooltips saying what they are for there (01 Military Compound, 02 Frontier Dust, 03 Imperial Arena, 04 Orbital Station, 05 Gothic Estate, 06 Jungle Ruins, 07 Neon Megacity, 08 Suburban Chaos, 09 Sands of Egypt; see [`BUILDING_KIT.md`](BUILDING_KIT.md)). New pieces: **Force Field** (blocks players, not shots; logic switches it), **Low-Gravity Zone** (the zone inspector's *Gravity*), **Tower Elevator**, **Sky Tram**, **Neon Sign** and **Holo Billboard** (light fixtures with words; logic-controlled like any light), **Portcullis**, **Portcullis Gate**, **Lift Cage**, **Brazier** and **Portal Pair**.

### Portals
The **Portal Pair** tool places two linked portals (one pair ID, a pair of colours); move and turn each end where it should be. Walk, fly or shoot into one and you come out of the other moving the same way relative to it, facing out. Portals are logic targets like other toggleables: *Enable* and *Disable* switch one (a pair works only while both are on; the *Is enabled* condition tests it), so a lever, a zone or a timer can seal a shortcut for a while. Bots path through open pairs. The validator flags an unpaired portal, a crowded pair, a portal that starts off with nothing to switch it on, and ground in front of an end that nobody can stand on.

## Destruction
Destructible entities expose health, damage-type acceptance/resistance, states, debris/presentation policy, and Destroyed event. A door can therefore require explosives and trigger alarms/reinforcements when breached.

## 32-player-aware triggers
Zone triggers support Any Player, Specific Faction (the zone's *Team only*, v20), N Players, Percentage of living faction, All living players, NPC/object entry. This prevents one rushing co-op player from unintentionally advancing a 32-player scenario unless the creator wants that.

## Road tool (race tracks)

Entities → **Road**. A map has one track (map format v18, `map.track`):
ordered road points, a width, circuit or point to point, laps, start-grid
places, the race vehicle, combat on or off, surface (asphalt or dirt),
curbs, and optional ambient cars with a pit lane.

- **Draw.** Click the ground twice to lay a road, then keep clicking: each
  click adds a point after the selected (orange) one, so you can extend
  either end or the middle. Shift-click a stretch of road to add a point
  there. Drag a point to move it. Right-click a point (or select it and
  press Del) to delete it; deleting below two points removes the road.
  Points sit on the ground where you click. Every change is one undo step.
- **Preview.** The road is drawn as in the game (ribbon on the ground,
  edge and centre lines, curbs, the chequered line and an arch over every
  checkpoint), with the road points and their polyline shown while the tool
  is active. The green point is the start line; the grid lines up behind it.
- **Pane.** Width, circuit, laps, grid places, vehicle, surface, curbs,
  combat race, ambient cars and their vehicle. **Start here** moves the
  start line to the selected point; **Reverse** races the other way;
  **Lay into terrain** flattens the ground under the road and blends the
  shoulders (one undo step); **Pit lane here** puts the ambient cars' pit
  beside the selected point; **Remove road** deletes the track.
- **Mode.** Map properties → Mode → Race makes TEST a race. Any map with a
  track also offers Race in the Arcade.
- **Validation.** Race listed without a track, a circuit with fewer than 3
  points and road points outside the boundary are errors. Road off the
  terrain, under 80 m, fewer grid places than players, a grid longer than
  the road holds, checkpoints not on drivable ground or not reachable from
  the one before (navmesh), and grid places off it are warnings.
- See `maps/sandsweep.json` for a finished track.

## Validation
Show actionable errors/warnings for missing spawns, overlapping/unsafe spawns, disconnected critical navigation, unreachable objectives, broken references, impossible conditions, missing encounter spawn regions, faction loops, excessive active NPC estimates, asset/dependency failures, and mode incompatibility.

## Capacity analysis
Map metadata includes creator-selected and analyzer-suggested min/max players. Later analysis can estimate spawn density, traversal distances, item density, objective congestion and 32-player suitability.

## Legacy-aware editing
Classic Grid data remains separable from modern additions. A future imported map can be opened in compatibility mode or copied into Remaster mode where terrain/props/logic/32-player extensions become available.

## Vertical-slice acceptance scenario
Creator builds a small facility, places team spawns and six weapon types, adds a locked/destructible door and button, places an enemy encounter, creates an objective, wires at least one WHEN/IF/DO chain, tests it with bots/NPCs, returns to editor, changes it, undo/redoes, saves, reloads and replays.
