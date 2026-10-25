# MapMaker Modular Structure & Detail System

**Project:** Browser-first arcade FPS / MapMaker platform  
**Document Type:** Implementation handoff / design specification  
**Status:** Proposed source specification for structural MapMaker expansion  
**Primary Goal:** Preserve the speed and simplicity of classic tile-based map construction while dramatically increasing visual variety, adaptability, and scenario capability through parametric tiles, reusable detail systems, and terrain integration.

---

## 1. Executive Summary

The current MapMaker already has the correct foundational idea: **grid-based structural tiles placed above an editable terrain layer**. The next step should NOT be to create hundreds of increasingly specific prefab room tiles.

Instead, build a relatively small library of **universal structural primitives** and multiply their usefulness through configurable layers:

1. Structure / footprint
2. Wall configuration
3. Interior layout
4. Floor insert
5. Ceiling configuration
6. Corner treatment
7. Theme / material set
8. Condition / damage state
9. Detail sockets
10. Decals
11. Scatter dressing
12. Props / macro props
13. Terrain transition pieces
14. Gameplay / logic attachments

The design philosophy is:

> **Keep placement simple; make placed tiles deep.**

A new user should still be able to choose `Room`, click the grid, and immediately have a usable themed room. An advanced creator can select that same room and customize individual walls, floor, ceiling, details, condition, theme mixing, gameplay hooks, and dressing.

This produces far more variety than a giant prefab catalog while remaining compatible with the original grid-based MapMaker philosophy and future legacy-map recreation/import work.

---

# 2. Non-Negotiable Design Principles

## 2.1 Tile placement remains the fastest workflow

The default loop remains:

`Choose Tile -> Place -> Rotate -> Continue`

Do not require creators to manually construct every wall, floor, and ceiling to make a basic map.

## 2.2 Complexity is progressive

Casual users interact with presets.

Advanced users can expose the underlying configuration.

Example:

```text
ROOM
Theme: Forest Camp
Preset: Standard Room

[Advanced ▼]
```

Advanced expands wall-by-wall controls, layout, ceiling, condition, detail density, etc.

## 2.3 Structure and appearance are separate

A room's gameplay footprint must not be permanently tied to one visual style.

The same structural tile should be capable of appearing as:

- military bunker
- Roman chamber
- Gothic room
- sci-fi module
- frontier building
- jungle ruin
- suburban interior
- neon city structure

## 2.4 Themes are mixable

Theme packs must never become isolated ecosystems.

Creators may combine architecture, materials, props, details, lighting, terrain, and gameplay assets from different packs.

The editor may display a visual-cohesion warning but must not prohibit mixing.

## 2.5 Terrain and tiles are complementary

Terrain is not a replacement for structural tiles. Tiles are not a replacement for terrain.

The system should support:

- pure interior maps
- tile-built cities
- terrain-heavy wilderness maps
- structures embedded into terrain
- hybrid maps

## 2.6 Preserve deterministic structural data

Grid position, tile footprint, elevation, rotation, connections, and structural identity should remain explicit data.

This is important for:

- navigation generation
- networking
- map validation
- bot reasoning
- performance analysis
- legacy recreation/import
- remaster workflows

---

# 3. Structural Tile Taxonomy

Target approximately **35-50 universal structural pieces** before expanding into highly specialized prefabs.

## 3.1 Basic Rooms

Recommended footprints:

- 1x1 Room
- 1x2 Room
- 2x2 Room
- 2x3 Room
- 3x3 Room
- Long Room
- Wide Room
- Great Hall
- Tall Room
- Atrium
- Plaza / Courtyard

Existing specialized rooms such as `Room (Pillars)` should eventually become configurations of a generic room rather than unique structural assets where practical.

## 3.2 Corridors

- Narrow Straight
- Standard Straight
- Wide Straight
- L-Corner
- T-Junction
- Four-Way Junction
- Short Connector
- Long Connector
- Offset Corridor
- Raised Corridor
- Sunken Corridor
- Covered Exterior Walkway

## 3.3 Transitions

- Single Door Transition
- Double Door Transition
- Wide Opening
- Archway
- Bulkhead
- Gate
- Broken Wall Opening
- Cave Mouth
- Tunnel Portal
- Vent Opening
- Sewer Opening

Transitions are important for hiding visual seams between style packs.

## 3.4 Vertical Structures

- Straight Stairs Up
- Straight Stairs Down
- Wide Stairs
- Switchback Stairs
- Spiral / Compact Stair Module
- Ramp
- Ladder Shaft
- Elevator Shaft
- Drop Shaft
- Vertical Atrium
- Balcony
- Mezzanine
- Catwalk

## 3.5 Elevation / Interior Variation

- Raised Room
- Sunken Room
- Split-Level Room
- Central Dais
- Perimeter Ledge
- Raised Center
- Sunken Center
- Interior Pit
- Interior Channel

Prefer implementing many of these as **floor/layout variants** rather than unique geometry when possible.

## 3.6 Exterior Structural Pieces

- Street Straight
- Street Corner
- T Intersection
- Cross Intersection
- Alley
- Yard
- Courtyard
- Plaza
- Bridge
- Dock
- Exterior Stair
- Rooftop Platform

## 3.7 Negative-Space Structures

These are essential and should be treated as first-class pieces:

- Pit
- Hole
- Chasm
- Open Shaft
- Collapsed Floor
- Cliff Edge
- Trench
- Drainage Channel
- Water Channel
- Void Opening
- Drop

Good maps are defined by empty space as much as occupied space.

## 3.8 Large / Macro Structures

Use sparingly but provide a few high-value pieces:

- Warehouse shell
- Hangar
- Arena
- Tower
- Large bunker
- Large cave chamber
- Multi-story building shell

These should still expose configurable connection points.

---

# 4. Parametric Tile System

The key architectural change is to stop treating every visible variation as a separate tile.

A structural tile should contain configurable sub-systems.

Conceptually:

```text
TileInstance
  structuralDefinition
  footprint
  gridPosition
  elevation
  rotation
  heightProfile
  wallSegments[]
  floorConfiguration
  ceilingConfiguration
  cornerConfiguration
  interiorLayout
  styleConfiguration
  condition
  detailConfiguration
  decalConfiguration
  scatterConfiguration
  gameplayAttachments[]
```

---

# 5. Wall Configuration System

Each compatible wall segment should be independently configurable.

Recommended wall types:

- Solid
- Door
- Wide Door
- Double Door
- Arch
- Window
- Large Window
- Half Wall
- Railing
- Open
- Broken
- Collapsed
- Bars
- Fence
- Shutter
- Force Field
- Destructible Wall

Example:

```text
ROOM 3x3

North: Large Window
South: Wide Door
East: Solid
West: Broken
```

This dramatically reduces the need for separate room prefabs.

### Connection validation

The editor should automatically detect incompatible connections.

Example:

- Room A East = Door
- Room B West = Solid

Display a warning or offer to synchronize the connection.

Recommended UX:

`Synchronize connected walls automatically: ON` by default.

---

# 6. Interior Layout System

Separate interior cover/detail geometry from the room shell.

Initial layout presets:

- Empty
- Central Pillar
- Four Pillars
- Column Rows
- Low Cover
- High Cover
- Central Platform
- Perimeter Platform
- Dais
- Raised Ledge
- Sunken Center
- Pit
- Broken / Rubble
- Symmetrical Arena
- Randomized Cover

A room may expose compatible layout sockets so themes can replace the visual treatment without changing gameplay footprint.

Example:

`Four Pillars` in Imperial Arena = marble columns.

`Four Pillars` in Orbital Station = structural reactor supports.

`Four Pillars` in Forest Camp = timber posts.

---

# 7. Floor Insert System

Recommended inserts:

- Standard Floor
- Raised Center
- Sunken Center
- Shallow Pit
- Deep Pit
- Water
- Lava / Hazard
- Drainage Channel
- Grate
- Glass
- Trapdoor
- Destructible Floor
- Dirt / Terrain Exposure
- Conveyor

Floor inserts should carry gameplay metadata where appropriate.

Example:

```text
FloorInsert: Water
movementModifier: 0.8
supportsSwimming: true
```

Do not hard-code gameplay effects solely from visuals; themes may visually skin the same gameplay archetype.

---

# 8. Ceiling System

Ceilings are important for first-person visual variety and vertical gameplay.

Recommended types:

- Flat
- Low
- Standard
- High
- Huge
- Vaulted
- Beamed
- Industrial
- Glass
- Skylight
- Open Sky
- Partially Collapsed
- Catwalk Ceiling

Height should be a structural parameter where feasible:

`Low / Standard / Tall / Huge`

Bots/navigation/projectiles must use actual collision height rather than assuming a universal room height.

---

# 9. Corner Treatments

Recommended treatments:

- Square
- Chamfered
- Rounded
- Structural Post
- Column
- Buttress
- Broken
- Open

Corner treatment is a cheap way to significantly alter silhouette.

Examples:

- square -> military
- chamfered -> sci-fi
- column -> ancient
- rounded -> laboratory
- broken -> ruins

---

# 10. Detail Socket System

This should be a major system rather than manually placing every decorative object.

Tiles define semantic attachment points such as:

- wall_upper
- wall_center
- wall_lower
- wall_corner
- floor_edge
- floor_center
- ceiling_center
- ceiling_edge
- doorway_side
- window_side
- exterior_wall

Theme/detail sets populate those sockets.

## Example: Forest Camp

Possible socket objects:

- timber braces
- rope
- shelves
- lanterns
- tools
- moss
- hanging supplies

## Example: Orbital Station

Same semantic sockets can produce:

- conduit
- vents
- screens
- warning panels
- pipes
- utility lights

## Example: Imperial Arena

- torches
- banners
- shields
- reliefs
- cracks
- statues

### Detail Density

Expose:

- None
- Sparse
- Normal
- Dense

Also provide:

`Randomize Details`

Randomization should be seeded and deterministic so published maps render consistently across clients.

---

# 11. Condition / Damage States

Where supported, tiles and structural elements should expose:

- Pristine
- Worn
- Damaged
- Ruined
- Overgrown

Condition may affect:

- material variants
- damaged meshes
- missing pieces
- debris sockets
- decals
- vegetation
- lighting

Avoid changing collision/gameplay geometry silently when switching condition. If a condition changes traversal, it must be explicit and validated.

### Runtime state changes

Scenario logic may optionally transition between compatible states.

Example:

```text
WHEN Generator Explodes
DO Set Room_12 Condition = Damaged
DO Enable Debris_12
DO Disable LightGroup_A
```

---

# 12. Decal System

Decals are one of the cheapest tools for hiding repeated modular assets.

Initial categories:

- Dirt
- Mud
- Blood
- Burn
- Bullet Damage
- Cracks
- Moss
- Rust
- Water Leaks
- Graffiti
- Posters
- Warning Markings
- Numbers
- Arrows
- Faction Symbols
- Road Markings
- Paint Wear

Support manual placement plus optional procedural theme dressing.

Use batching/atlas strategies to avoid excessive draw calls.

---

# 13. Scatter System

Creators should be able to paint lightweight environmental dressing over an area.

Examples:

### Forest
- grass
- sticks
- stones
- leaves
- small plants

### Urban
- garbage
- paper
- cans
- rubble

### Roman
- pottery fragments
- stone chips
- weeds

### Sci-Fi
- cables
- panels
- mechanical debris

### Frontier
- bottles
- planks
- tumbleweeds
- small rocks

Controls:

```text
Scatter Set
Density
Scale Variation
Rotation Variation
Seed
Exclusion Radius
Regenerate
```

Scatter should not block critical navigation unless explicitly configured as gameplay geometry.

Use instancing aggressively.

---

# 14. Macro Props

Props should include both decorative items and gameplay-shaping objects.

High-value macro props:

- Cargo container
- Large statue
- Giant tree
- Rock formation
- Fountain
- Market stall
- Vehicle wreck
- Large machinery
- Tank / vehicle shell
- Crane
- Billboard
- Collapsed wall
- Large pipe
- Generator
- Silo
- Watchtower
- Large shelving
- Fountain / monument

These allow creators to break up large spaces without requiring additional structural tiles.

---

# 15. Terrain Transition Kit

This is especially important because the editor already supports terrain beneath structural tiles.

Required transition pieces:

- Foundation
- Raised foundation
- Retaining wall
- Cliff doorway
- Bunker entrance
- Cave entrance
- Tunnel portal
- Building steps
- Ramp to terrain
- Bridge abutment
- Drainage outlet
- Dock edge
- Beach landing
- Rock-integrated wall
- Terrain-to-floor trim
- Terrain retaining slope

Goal:

> Structures should look embedded into the environment rather than dropped onto a heightfield.

Terrain transitions should support automatic edge detection where feasible.

---

# 16. Theme Architecture

Do not implement `Theme` as one monolithic dropdown internally.

A theme preset can set several independent channels:

```text
STYLE PRESET: Forest Camp

Architecture: Forest Camp
Materials: Forest Camp
Detail Set: Forest Camp
Props: Forest Camp
Lighting: Forest Camp
Vegetation: Forest Camp
Audio: Forest Camp
```

Basic mode exposes only the preset.

Advanced mode allows independent override:

```text
Architecture: Military Compound
Materials: Jungle Ruins
Detail Set: Secret Laboratory
Props: Military Compound
Condition: Abandoned
Lighting: Storm
Vegetation: Heavy
```

This enables combinations such as:

- abandoned jungle laboratory
- Gothic space station
- Roman cyberpunk arena
- military compound buried beneath Victorian streets
- frontier settlement invaded by alien technology

---

# 17. Initial Foundation Theme Packs

Prioritize diversity over quantity.

Recommended first eight:

1. Military Compound
2. Frontier Dust
3. Imperial Arena
4. Orbital Station
5. Gothic Estate
6. Jungle Ruins
7. Neon Megacity
8. Suburban Chaos

These collectively provide:

- modern
- industrial
- historical
- ancient
- horror
- sci-fi
- wilderness
- residential
- urban
- exterior
- interior
- underground
- vertical

Every theme should implement as much of the shared structural vocabulary as practical instead of inventing a completely separate tile system.

---

# 18. Connector System

Connections between styles deserve dedicated assets.

Recommended connector archetypes:

- Door Frame
- Arch
- Bulkhead
- Tunnel Mouth
- Cave Mouth
- Gate
- Bridge Connector
- Vent
- Pipe
- Sewer Opening
- Elevator
- Ladder
- Teleporter
- Broken Wall Transition
- Stairwell

Example environmental storytelling transition:

`Gothic Library -> Hidden Bookshelf -> Concrete Stairwell -> Blast Door -> Secret Laboratory`

This allows mixed-theme maps to look intentional.

---

# 19. Smart Presets

Presets keep the system approachable.

Examples:

- Standard Room
- Cover Room
- Arena Room
- Sniper Room
- Defensive Room
- Ruined Room
- Storage Room
- Boss Room
- Ambush Room
- Courtyard
- Bunker Interior
- Residential Interior

A preset configures the parametric systems but does not create a separate underlying tile type.

Users can apply a preset and then customize it.

---

# 20. Randomization

Provide controlled procedural variation without turning MapMaker into a procedural generator.

Useful commands:

- Randomize Details
- Randomize Props
- Randomize Decals
- Randomize Scatter
- Randomize Material Variation
- Randomize Room Dressing

All randomization must be deterministic once accepted.

Store the resulting seed/configuration in map data.

Provide Undo immediately after randomization.

---

# 21. Theme-Aware Auto Dressing

Optional auto-dressing can make beginner maps look much better.

Example workflow:

1. Creator builds a graybox map.
2. Chooses `Imperial Arena`.
3. Editor applies compatible materials.
4. Detail sockets receive banners/torches/stone trim.
5. Scatter adds limited debris/weeds.
6. Lighting preset changes.
7. Creator can manually override anything.

Important:

Auto dressing must never move spawns, pickups, objectives, logic objects, or gameplay-critical collision.

---

# 22. Gameplay Metadata on Structural Pieces

Structural assets should expose semantic metadata rather than forcing AI to infer everything from meshes.

Examples:

```text
walkable
cover_low
cover_high
climbable
vaultable
jump_gap
ledge
ladder
water
hazard
vehicle_accessible
large_vehicle_accessible
npc_spawn_valid
player_spawn_valid
objective_valid
```

This improves:

- bot navigation
- map analysis
- spawn validation
- performance
- scenario creation

---

# 23. Navigation Integration

MapMaker should regenerate or incrementally update navigation when structural changes occur.

Validation should identify:

- inaccessible rooms
- disconnected spawn regions
- unreachable pickups
- unreachable objectives
- one-way accidental drops
- insufficient vertical clearance
- blocked doors
- NPCs unable to reach scenario targets

Advanced visualization:

```text
NAVIGATION VIEW
Green = reachable
Yellow = conditional
Red = unreachable
Blue = special traversal
```

Do not make nav visualization part of the default beginner UI.

---

# 24. Spawn and Capacity Analysis

Because maps may support up to 32 player slots plus NPC combatants, MapMaker should evaluate spatial suitability.

Display:

```text
MAP CAPACITY
Recommended Players: 8-16
Spawn Points: 20
32-Player Suitability: Poor
NPC Navigation: Good
Vehicle Suitability: None
```

Analysis may consider:

- spawn count
- spawn separation
- map walkable area
- average travel distance
- chokepoints
- verticality
- objective spacing
- pickup density

This is guidance, not a hard restriction.

---

# 25. Performance Budgeting

Browser-first development requires visible creator budgets.

Track at minimum:

- structural tile count
- rendered instances
- unique materials
- dynamic lights
- shadow-casting lights
- decal count
- physics objects
- destructible objects
- NPC maximum active count
- player slots
- scripted logic objects
- particle emitters
- terrain complexity
- estimated draw calls
- estimated memory footprint

Display a simple beginner-facing rating:

```text
MAP PERFORMANCE
Excellent / Good / Heavy / Extreme
```

Advanced users can inspect details.

Do not block publishing solely because a map is heavy unless it exceeds hard technical limits.

---

# 26. Rendering / Asset Efficiency

Recommended technical strategies:

- instanced meshes for repeated structural assets
- texture atlases where appropriate
- trim sheets for architecture
- shared material families
- mesh LODs
- impostors where useful
- occlusion / room visibility systems
- baked/static lighting options where appropriate
- limited dynamic shadow casters
- decal batching
- scatter instancing
- distance-based detail reduction

Theme variants should reuse geometry whenever possible.

Example:

One wall geometry may support multiple theme material sets and detail socket populations rather than requiring eight unique wall meshes.

---

# 27. Room / Portal Metadata

Because the maps are tile based, use structural connectivity to help multiple systems.

Track logical rooms/zones and their connections.

Useful for:

- visibility culling
- network interest management
- sound propagation
- bot planning
- encounter spawning
- minimap generation
- performance optimization

A door/arch/tunnel between spaces becomes a logical portal.

This can be generated automatically from structural connectivity with manual override.

---

# 28. Destruction Rules

Destructibility must be explicit.

Do not make every wall destructible by default.

Recommended states:

```text
Indestructible
Damageable
Breakable
Explosive Only
Scripted Destruction
```

Destructible structural elements need:

- intact collision
- destroyed collision
- navigation update strategy
- debris strategy
- replication behavior
- trigger events

Example event:

```text
WHEN Wall_27 Destroyed
DO Enable Route_B
DO Spawn Encounter_3
DO Set Objective "Breach Complete"
```

---

# 29. Logic Attachment Points

Any structural object capable of interaction should expose events.

Examples:

### Door
- Opened
- Closed
- Locked
- Unlocked
- Damaged
- Destroyed

### Destructible Wall
- Damaged
- Destroyed

### Floor Trap
- Activated
- Reset

### Elevator
- Called
- Arrived
- Disabled

### Room / Zone
- Player Entered
- Team Entered
- All Players Entered
- NPC Entered
- Cleared

This connects structural MapMaker directly to Scenario logic without requiring separate bespoke objects for every event.

---

# 30. Legacy / Classic Compatibility

Preserve a `Classic Grid` construction layer.

Legacy-compatible structural data should remain distinct from advanced additions.

Conceptually:

```text
Map
  classicStructure[]
  advancedStructure[]
  terrain
  props[]
  gameplay[]
  logic[]
  presentation[]
```

This allows future workflows such as:

`Legacy Map -> Recreated Classic Layout -> Optional Remaster`

Do not make actual legacy-file importing a requirement for the current structural-system milestone.

The requirement now is simply:

> Do not design the map format in a way that makes deterministic grid-based recreation impossible later.

---

# 31. Copy / Paste / Multi-Select

Parametric depth makes editing tools increasingly important.

Required:

- multi-select
- box select
- duplicate
- copy/paste
- rotate selection
- move selection
- mirror selection
- delete selection
- group
- save as prefab

Advanced:

- replace theme on selection
- replace material on selection
- replace wall type on selection
- randomize selected details
- change condition on selection

---

# 32. Creator Prefabs

Creators should eventually be able to select multiple objects and save them as reusable prefabs.

Example:

```text
"Security Checkpoint"
- 2 wall pieces
- security door
- desk
- scanner
- 2 lights
- trigger
```

Prefabs should reference underlying assets rather than bake them into inaccessible geometry.

This provides enormous creator productivity without requiring the official asset library to contain every possible structure.

---

# 33. Search / Asset Browser Metadata

As the library grows, every asset needs tags.

Example tags:

```text
structure
room
wall
cover
ancient
military
sci-fi
interior
exterior
industrial
large
vehicle-compatible
destructible
interactive
```

Search should work across tile names, theme, category, tags, and gameplay role.

Favorites and recently used assets should be supported.

---

# 34. Recommended Inspector UX

Selecting a room could expose:

```text
ROOM
--------------------------------
SIZE
3 x 3

HEIGHT
Standard

LAYOUT
Four Pillars

WALLS
North   Window
South   Wide Door
East    Solid
West    Broken

FLOOR
Sunken Center

CEILING
Beamed

CORNERS
Structural Posts

STYLE
Forest Camp

CONDITION
Worn

DETAIL DENSITY
Normal

SCATTER
Light

[ RANDOMIZE DETAILS ]

ADVANCED
> Materials
> Socket Overrides
> Decals
> Gameplay Metadata
> Logic
```

The inspector should remain compact enough for the existing right-side property panel.

Use collapsible sections rather than a giant form.

---

# 35. Beginner vs Advanced Workflow

## Beginner

```text
Choose Room
Place Room
Choose Theme
Play
```

## Intermediate

```text
Place Room
Choose Layout
Change Door
Add Props
Add Pickups
Play
```

## Advanced

```text
Configure individual walls
Mix themes
Configure floor/ceiling
Override sockets
Add destruction
Add triggers
Tune navigation
Add custom dressing
```

Never force Advanced workflow onto Beginner creators.

---

# 36. Suggested Implementation Order

## Phase A — Structural Foundation

Implement/refactor:

- universal tile definition
- footprint/grid data
- rotation/elevation
- room/corridor/vertical taxonomy
- structural connections
- multi-select
- copy/paste
- undo/redo reliability

Do this before adding large amounts of content.

## Phase B — Parametric Rooms

Implement:

- configurable wall segments
- interior layout presets
- floor inserts
- ceiling types/heights
- corner treatments

Prove with one theme first.

## Phase C — Theme Separation

Split:

- architecture
- materials
- detail sets
- lighting
- vegetation

Implement preset + Advanced override workflow.

## Phase D — Detail Multipliers

Implement:

- detail sockets
- decals
- scatter
- macro props
- seeded randomization

This is likely the largest visual-quality jump per unit of work.

## Phase E — Terrain Integration

Implement:

- terrain transition pieces
- foundations
- cliff/cave interfaces
- ramps
- retaining walls
- terrain-aware dressing

## Phase F — Gameplay Semantics

Implement:

- cover metadata
- traversal metadata
- spawn validity
- navigation validation
- capacity analysis
- room/portal metadata

## Phase G — Destruction + Logic

Implement:

- structural damage states
- destructible variants
- runtime state transitions
- structural trigger events
- navigation changes after destruction

## Phase H — Performance Tooling

Implement:

- creator budget meter
- instancing metrics
- light/shadow counts
- NPC/player estimates
- publish warnings

---

# 37. Highest-Value Near-Term Additions

If development time is limited, prioritize these in order:

1. **Configurable wall segments**
2. **Interior layout presets**
3. **Detail sockets + theme auto-dressing**
4. **Condition states**
5. **Decals**
6. **Terrain transition pieces**
7. **Scatter painting**
8. **Ceiling height/type**
9. **Floor inserts**
10. **Corner treatments**
11. **Macro props**
12. **Theme channel overrides**

These additions multiply existing assets rather than requiring large new libraries.

---

# 38. Anti-Patterns / Things to Avoid

## Do not create a unique tile for every combination

Avoid:

```text
Roman Room Pillars
Roman Room Low Cover
Roman Room Raised
Roman Room Damaged
Roman Room Damaged Pillars
Roman Room Overgrown Pillars
...
```

Prefer:

```text
Room
+ Roman Style
+ Four Pillars Layout
+ Damaged Condition
+ Heavy Vegetation
```

## Do not tie gameplay behavior to visual theme

A sci-fi door and Roman gate can share the same gameplay archetype.

## Do not allow decorative randomization to alter competitive geometry

Random props must not unexpectedly block doors, sightlines, objectives, or spawns unless explicitly configured as gameplay objects.

## Do not let theme packs duplicate core logic

Themes provide assets/configuration, not parallel gameplay implementations.

## Do not sacrifice fast placement

The editor should not become Blender or Unreal Editor.

MapMaker's strength is immediacy.

---

# 39. Example: One Tile, Many Maps

Base structure:

`3x3 Room`

### Military Bunker

```text
Walls: Solid / Blast Door
Layout: Low Cover
Ceiling: Low Industrial
Corners: Square
Style: Military
Condition: Worn
```

### Roman Temple Chamber

```text
Walls: Arches
Layout: Four Pillars
Ceiling: Tall / Open
Corners: Columns
Style: Imperial
Condition: Pristine
```

### Jungle Ruin

```text
Walls: Broken
Layout: Central Platform
Ceiling: Open Sky
Corners: Broken
Style: Imperial
Materials: Jungle Ruins
Condition: Overgrown
Vegetation: Heavy
```

### Space Laboratory

```text
Walls: Window / Force Field / Door
Layout: Empty
Floor: Glass Insert
Ceiling: High Industrial
Corners: Chamfered
Style: Orbital Station
```

### Haunted House

```text
Walls: Door / Window
Layout: Interior Furniture
Ceiling: Beamed
Corners: Square
Style: Gothic Estate
Condition: Worn
```

One structural definition supports all five.

---

# 40. Example Map Data Concept

Illustrative only; exact implementation is up to engineering.

```json
{
  "id": "tile_102",
  "definition": "room_3x3",
  "grid": { "x": 12, "y": 8, "level": 0 },
  "rotation": 90,
  "height": "standard",
  "walls": {
    "north": "large_window",
    "south": "wide_door",
    "east": "solid",
    "west": "broken"
  },
  "layout": "four_pillars",
  "floor": "sunken_center",
  "ceiling": "beamed",
  "corners": "structural_posts",
  "style": {
    "preset": "forest_camp",
    "architecture": "forest_camp",
    "materials": "forest_camp",
    "details": "forest_camp"
  },
  "condition": "worn",
  "detailDensity": "normal",
  "detailSeed": 48192,
  "scatter": {
    "set": "forest_debris",
    "density": "light",
    "seed": 19211
  }
}
```

The important requirement is **data-driven configuration**, not this exact schema.

---

# 41. Acceptance Criteria

The system is successful when all of the following are true:

### Ease of Use

- A new creator can place a playable room with one click.
- Theme defaults make it visually acceptable without manual dressing.
- Advanced controls are optional.

### Variety

- The same structural room can visibly/functionally support many configurations.
- Two maps using the same theme do not automatically look identical.
- Mixed themes work without obvious broken seams.

### Gameplay

- Bots understand structural traversal.
- Spawns/objectives can be validated.
- Multi-level maps remain navigable.
- Structural destruction updates gameplay correctly.

### Performance

- Repeated assets use efficient rendering paths.
- Decorative systems have predictable budgets.
- Large maps provide creator-facing performance feedback.

### Extensibility

- New themes can skin existing structural definitions.
- New layout/floor/wall archetypes can be added without rewriting old themes.
- Future legacy-map recreation remains possible.

---

# 42. Final Direction

The MapMaker should not win through having the largest raw tile count.

It should win because a small, understandable library can produce an enormous number of maps.

The desired model is:

```text
~40-50 STRUCTURAL PIECES
        x
WALL CONFIGURATIONS
        x
INTERIOR LAYOUTS
        x
FLOOR INSERTS
        x
CEILING OPTIONS
        x
CORNER TREATMENTS
        x
THEMES
        x
CONDITION STATES
        x
DETAIL SOCKETS
        x
DECALS
        x
SCATTER
        x
PROPS
```

Not every mathematical combination must be supported. The principle is **combinatorial authoring**.

The player-facing promise should remain simple:

> **Place tiles quickly. Make them yours when you want to.**

This preserves the accessibility and speed of classic grid MapMaker systems while giving modern creators enough depth to produce maps that no longer look like obvious collections of repeated prefab rooms.
