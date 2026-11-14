# Trigger Map Maker — UI/UX Refactor & Precision Tile Editor

**Status:** Agent implementation specification  
**Reference:** Latest Map Maker mockup (dual-mode minimap, tile-detail editor, contextual inspector).  
**Scope:** Browser-based Babylon.js / TypeScript editor.  
**Priority:** Preserve existing editor behavior and saved maps; ship iteratively.

## 1. Objective

Turn the existing crowded editor into a canvas-first, task-oriented workspace without losing any capabilities. Build a collapsible right-side navigation/inspection system and a 2D precision editor for the contents of selected tiles/rooms. Existing tile assets, game logic, save/load, keyboard bindings, map format, terrain, pathing, scenarios, and play testing must remain functional.

**Do not implement the mockup literally where it contradicts existing features.** Treat it as a layout and interaction reference. Audit current components and data types before coding; adapt names and integration points to the actual repository.

## 2. Information architecture

### Persistent top bar
- Editable map title, Save, Undo/Redo, Map Settings shortcut, workspace switcher, snap setting, and Play Test.
- Keep existing workflows for Build, Props, Game, Logic, Environment, Paths, and Test available. A compact workspace selector or grouped navigation may replace crowded tabs, but none may disappear.
- Map Settings must be reachable in one click from the title area **and** from a left-rail `Map` entry; both open the same settings view.

### Left rail and asset browser
- Left rail: Build, Map, Props, Terrain, Paths, Spawns, Volumes, Factions (adjust to actual available features).
- Selecting a rail item swaps the adjacent contextual panel rather than opening another permanent sidebar.
- Asset browser retains search, categories, favorites, recent items, tile thumbnails, and current selection.
- Collapsible to a narrow rail; optional auto-collapse after choosing an asset, with a user preference and easy reopen affordance.

### Center viewport
- Babylon.js canvas is the primary focus.
- Small contextual tool palette: Select, Place, Erase, Paint, Terrain, and overflow for less-used tools.
- Level selector, snap indicators, transform gizmo, camera/navigation controls stay near relevant interaction points.
- Show concise tool hints on hover or while an operation is active; avoid persistent instructional paragraphs.

### Right dock: three modes
1. **Expanded:** Resizable right dock with top `Minimap | Outliner` tabs and context-sensitive Properties below. The tile detail editor appears under the minimap when a tile is selected and detail mode is entered.
2. **Compact:** Narrow floating or docked minimap only; Properties/Outliner hidden, accessible on demand.
3. **Hidden:** Right dock entirely absent; small edge handle or shortcut restores it. The canvas expands to fill freed space.

Right dock state persists per user/browser preference. **Selection must not force-open a hidden dock.** A nonintrusive selected-object indicator may be shown in the viewport instead.

## 3. Map settings versus object properties

**Map Settings** is a global editor view opened from the left `Map` rail entry or top title shortcut. It includes map name, description, theme, dimensions/bounds, level metadata, recommended/min/max combatants, supported modes, thumbnail/card shot, visibility/metadata, and any existing map-level options. Preserve actual semantics of current fields; do not fabricate unsupported settings. Organize into `General`, `Gameplay`, `Presentation`, and `Advanced` sections if content warrants it.

**Properties Inspector** shows only the currently selected tile/object/component. No selection means a compact empty state, not duplicate map settings. Provide transform, material, object-specific parameters, and parent/instance information where supported.

**Minimap** is a live overhead representation, not the map thumbnail or card shot. The thumbnail remains separately editable in Map Settings.

## 4. Minimap and tile-detail modes

### 4.1 Map View (default)
- Draw the complete playable/editor bounds at the selected level with a clear scale and north orientation.
- Display simplified tiles, structures, doors/windows where scale permits, props/spawns and optional layer toggles.
- Show viewport camera position/direction and selected object/tile outline.
- Click to navigate; double-click a tile to enter Tile Detail; wheel/pinch to zoom; fit-to-map control.
- Avoid full 3D scene rerenders: use lightweight 2D Canvas/SVG/WebGL overlay derived from existing editor geometry and transforms.

### 4.2 Tile Detail View
- When a room/tile is selected, provide an explicit `Tile View` toggle, with double-click as a shortcut.
- Show a top-down orthographic floor plan of the selected tile/room, including boundary, wall segments, door/window openings, and contained props/generated objects.
- Distinguish parent tile selection from child-object selection via outline color/weight and breadcrumbs: `Map > Room 1 > Door 2`.
- Click a child to select it; drag to move; rotate using handle or keyboard; use exact numeric position/rotation inputs in Properties.
- Snap modes: grid, wall segment, edge, anchor; adjustable steps 1/5/10/50 cm (or existing engine units with displayed conversion). Modifier key may temporarily bypass snapping.
- Support switching between **Local (tile-relative)** and **World** coordinates. Local-to-world conversions must respect parent rotation/scale.
- Support pan, zoom, fit tile, reset view, escape/back to Map View. Display the active level and parent tile name.
- Changes update the 3D viewport immediately and enter the existing undo/redo history as meaningful transactions (one drag = one undo step).

### 4.3 Editing generated content safely
- Audit whether doors, windows, furniture, or other internals are independently addressable or baked into a tile mesh.
- For independently addressable children, edit existing child transforms and properties.
- For generated/baked content, **do not pretend each item is independently editable**. Introduce stable child identifiers and an instance-override layer only where the generator can deterministically regenerate the same children.
- Differentiate `Edit this instance` from `Edit template` explicitly. Default to instance edits; template edits must be intentional and must warn about global effects.
- If an asset cannot support fine-grain editing, show read-only geometry and a clear explanation, rather than destructive mesh splitting.

## 5. Unified selection model

Create or adapt a single editor selection state that all views consume:

```ts
type EditorSelection = {
  mapId: string;
  levelId: string;
  tileId?: string;
  objectId?: string;
  childId?: string;
  kind: 'tile' | 'object' | 'generated-child' | 'spawn' | 'volume' | 'none';
};
```

This is an **illustrative interface**, not a mandated replacement for existing types. Resolve stable IDs from the current map data model and avoid storing duplicate mutable copies of geometry.

Selection sources: 3D picking, minimap, tile detail, and outliner. All must dispatch to the same selection controller/store. The 3D outline, minimap marker, outliner row, breadcrumbs, and inspector update together. When a selected object is deleted, clear or fall back to the parent selection gracefully. Switching levels must preserve valid selection or clear it predictably. Avoid feedback loops by treating selection as state rather than rebroadcasting selection events between views.

## 6. Data, persistence, and compatibility

- First inventory existing map serialization, object IDs, tile generators, coordinate systems, layers, prefab/template references, undo/redo, multiplayer/editing assumptions, and browser persistence.
- Keep existing map JSON compatible. If instance overrides require a schema extension, make it additive and versioned, with migration/default handling for older maps.
- Store editor-only preferences (dock state, minimap zoom, active panel, favorite tools) separately from gameplay map content.
- Do not put editor-only UI state into the shared gameplay simulation package.
- Preserve deterministic generation: overrides must target stable generated-child IDs, not fragile array positions.
- Keep render and collision data in sync when an opening or prop changes. Validate that edits to doors/windows do not leave stale collision, occlusion, nav/pathing, or spawn constraints.
- Respect existing in-house asset-only policy; no new user-upload pipeline is implied.

## 7. Suggested component boundaries

```text
MapMakerShell
  TopBar / WorkspaceSwitcher / MapSettingsDialog
  LeftRail / AssetBrowser
  ViewportHost / ContextToolPalette / LevelControls
  RightDock
    MinimapCanvas (MapView)
    TileDetailCanvas (TileView)
    OutlinerTree
    SelectionInspector
  StatusBar
EditorSelectionController
EditorTransformController
EditorHistoryAdapter
MinimapProjectionAdapter
TileChildAdapter / InstanceOverrideAdapter
```

Keep Babylon scene interactions in adapters/controllers; do not embed map mutation logic in React/UI components (or equivalent current framework). Reuse existing editor state and commands where possible. Use a shared transform command pipeline for gizmo, inspector numeric fields, and 2D tile-detail drags.

## 8. Interaction and accessibility details

- Right dock: visible expand/collapse affordance, keyboard shortcut, resizable width with sane min/max, persisted state, no canvas obstruction when hidden.
- Left asset browser: collapse/reopen with visible affordance; do not auto-collapse mid-drag or unexpectedly on keyboard navigation.
- Selection: consistent cyan highlight, distinct hovered vs selected state, keyboard focus indicators, and accessible tooltips.
- Input fields: commit on Enter/blur; Escape cancels; validate ranges; display units; prevent keyboard shortcuts while typing.
- Dragging: preview transforms, commit once, allow cancel; no accidental parent movement while child is selected.
- Support high-DPI and browser resizing; keep usable at common laptop resolutions. Do not rely on hover alone for essential controls.
- Keep current shortcut mapping unless deliberate remapping is documented; expose shortcut help in an overlay.

## 9. Performance constraints

- Avoid regenerating the entire minimap on every pointer movement; update changed geometry incrementally or throttle projections.
- Use simplified shapes for distant/minuscule objects; level-aware culling and optional visibility layers.
- Reuse cached bounds/footprints, spatial indexes, and scene selection data when available.
- Keep tile-detail picking efficient even for large rooms; do not create a second heavy Babylon scene unless measurement proves necessary.
- Profile dense maps and high object counts before finalizing. Preserve game rendering FPS and input responsiveness while the editor dock is open.

## 10. Phased delivery plan

### Phase 0 — Audit and baseline
Document current component tree, editor tools, map schema, selection and undo pipelines, thumbnail flow, and keyboard shortcuts. Capture screenshots and smoke tests for existing editor workflows.

### Phase 1 — Layout refactor
Introduce left rail, contextual asset panel, top workspace organization, and collapsible/resizable right dock. Preserve all existing tools, even if temporarily placed under an overflow menu. Add Map Settings access from both top bar and left rail.

### Phase 2 — Unified selection + Outliner/Inspector
Implement selection controller and synchronized highlight across 3D viewport, outliner, and inspector. Add reliable object-focused properties and transform commands.

### Phase 3 — Live minimap
Implement level-aware overhead projection, camera marker, selection highlighting, navigation, fit/zoom/pan, and layer toggles. Keep the minimap independently usable in compact mode.

### Phase 4 — Tile Detail precision editor
Implement tile focus, child picking, move/rotate/snap, numeric transforms, local/world coordinates, history integration, and immediate 3D updates. Gate generated-child overrides behind verified generator support.

### Phase 5 — Hardening and polish
Test existing saved maps, serialization/migrations, collision/pathing updates, browser resizing, large-map performance, keyboard accessibility, and user preference persistence. Remove redundant instructional chrome.

## 11. Acceptance criteria

- [ ] All current editor workspaces and tools remain accessible and functionally intact.
- [ ] Map Settings opens in one click from both the title area and left `Map` navigation.
- [ ] The right dock supports expanded, minimap-only, and hidden states; state persists.
- [ ] Hidden right dock stays hidden when selecting objects, and canvas gains width.
- [ ] Minimap shows current level, tile footprints, selected object, and camera marker.
- [ ] Selection is synchronized among 3D viewport, minimap, outliner, and properties.
- [ ] Double-clicking a tile opens a zoomable 2D Tile Detail view.
- [ ] Editable child doors/windows/props can be selected and moved precisely with snapping.
- [ ] Parent transforms and local/world coordinates behave correctly under rotation.
- [ ] Every edit supports undo/redo; one drag equals one history entry.
- [ ] Unsupported generated internals are clearly identified rather than silently corrupted.
- [ ] Old maps open/save without losing objects or gameplay configuration.
- [ ] Collision and relevant derived systems update after geometry changes.
- [ ] UI is responsive and remains usable at laptop resolutions.
- [ ] No user asset-upload feature or unnecessary new backend infrastructure is introduced.

## 12. Agent execution instructions

1. **Inspect before modifying.** Identify existing modules, types, and commands; present a brief audit and any compatibility risks.
2. **Implement incrementally.** Favor reusable components and adapters over replacing established editor systems.
3. **Preserve behavior.** For every relocated control, verify that its old action still works.
4. **Test with representative maps.** Include empty, medium, dense, multilevel, and generated-room maps.
5. **Report clearly.** For each phase, provide changed files, user-visible behavior, tests performed, limitations, and next steps.
6. **Do not claim support for generated-object editing until the underlying tile data actually permits it.**

### Explicit non-goals
No new asset marketplace, no arbitrary external asset uploads, no wholesale Babylon engine rewrite, no replacement of the shared gameplay simulation, and no mandatory redesign of every editor workspace in the first phase.

---

## Lead session's notes (owner-approved, 2026-11-14)

The owner supplied this spec and a mock-up image. The image is a reference only and is not committed, like other owner reference sheets. These notes fit the spec to what MapMaker already has.

**Already there (reuse, don't rebuild):**
- the 7 workspace tabs (`editorModes.ts`);
- the outliner (`outlinerPanel.ts`), the inspector, `pickableSelection`, and the group row;
- the plan view (`planView.ts`), an overhead camera that works level by level;
- the game's 2D minimap drawing (`game/minimap.ts`), which already draws tunnels dashed;
- the budget pill, the level strip, snap, the rotate ring, and quick facings;
- one drag = one undo step.

**Adjustments to the spec:**
1. **Keep the 7 top tabs.** The left rail stays small: Map (settings), the asset browser, and collapse. Spawns, Volumes and Factions stay inside Game. The mock-up's rail and tabs overlap (Build in both; Terrain and Env are the same), so don't build both.
2. **Phase 3 minimap.** Reuse the plan view's projection and the game minimap's drawing. No second Babylon scene.
3. **Phase 4 Tile Detail**, scoped to our data:
   - Doors and windows are cell edge styles, not movable children. In tile view they are clickable edges you can change, not drag.
   - Props inside a room are already independent entities. They get precise move/rotate, fine snap (1/5/10 cm) and local/world coordinates.
   - Set-piece insides are generated. Show them read-only, as **Phase 4a**. Per-instance overrides with stable child ids and an additive map format bump are a separate, optional **Phase 4b**.
4. **Order:**

   | Phase | Content | Size |
   |---|---|---|
   | 0 | Audit | S |
   | 1 | Map settings dialog, an inspector that shows only the selection, the right dock with three states, a contextual tool bar with overflow, a short status bar | M |
   | 2 | Synced selection and numeric transforms | M |
   | 3 | Minimap | M |
   | 4a | Tile view | M–L |
   | 4b | Overrides (optional) | L |

**Coordination:**
- This account's lane does Phase 0 now. The audit is docs only.
- Phase 1 and later touch the same editor files as the MapMaker lane's Tileset 11 work. Agree who builds each phase in HANDOFF and `docs/QUEUE.md` before code starts, and never have two sessions in `packages/client/src/editor/**` at once.

## Owner's answers to the Phase 0 audit (2026-11-14: "all recs")

These are the recommended options from `docs/MAPMAKER_UI_AUDIT.md` §10. They are binding for Phases 1–4.

1. **Keys**
   - Shift+\ cycles the right dock: expanded, compact (minimap only), hidden.
   - Double-click or Enter on a selection opens Tile View.
   - The minimap gets no key of its own.
2. **Tool bar**
   - Paint, Terrain and the Environment brush sit on the Environment tab's tool bar only.
   - Every tab's overflow menu lists them too.
3. **Empty inspector**
   - With nothing selected, it shows one line, "Nothing selected · Map settings…".
   - Below that, the tab's own section, where the tab has one.
4. **Map settings placement**
   - Map settings opens in the right dock, not as a modal dialog. This replaces the spec's "dialog".
   - The 3D view stays live, for time-of-day previews and for framing the card shot.
5. **Top bar**
   - The title opens Map settings.
   - The theme picker and the test-match bot count and skill stay on the bar (the bot count and skill are not saved with the map).
   - Grid, full grid and overlaps go into a View menu.
6. **Level changes:** keep the selection and show "N selected on other levels".
7. **Narrow windows:** under 900 px wide, the right dock starts compact instead of disappearing.
8. **Tile View focus:** it can focus a tile, a set piece or a group, with a box region as the fallback. 14 of 89 maps have no tiles.
9. **Phase 4b:** parked until 4a is in use. After that come stable part keys and the index-to-key migration, using the map format number after the tunnel kit's v39.
10. **Who builds Phase 1**
    - The MapMaker lane builds it, after Tileset 11 and its editor-speed branch land.
    - This account reviews.
    - Phase 1 starts by giving the 11 flows that reach map settings through Esc an `openMapSettings` helper.
    - Phase 1 also adds `coverage` to the editor's flow mapping.
