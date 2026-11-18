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

**As built (lane B's splitters22, `wip/mapmaker-ui-1`, 2026-11-14).** The how-to is `docs/BUILDING_KIT.md`, "MapMaker's
layout". Files are under `packages/client/src/editor/`.

- **Map settings in the right dock** (`mapSettingsView.ts`; the fields stay in `mapProperties.ts`). The title in the
  top bar (`#ed-title`, it replaced the inline name field), the rail's Map and the inspector's "Map settings…" open the
  same view. × closes it, and so does selecting something. It is built only while open, keeping the "left standing"
  rule that Map properties had in the inspector. The fields are grouped **General** (name, theme, description, size,
  picture, card shot, notes), **Gameplay** (mode, also offered, teams, players, weapon set, bots and characters,
  players by mode, everything breaks, gravity and falls, boundary), **Presentation** (time and weather, blood, the Sky
  button) and **Advanced** (map ID, tier, test map). Nothing new was invented, and every field is still an undoable
  command. Two kinds of item were moved out because they are not settings: Map layers went to View, and Dress all /
  Settle all went to the tool bar's ⋯ menu.
- **Inspector (now "Properties")** shows only the selection. With nothing selected it shows one line, "Nothing selected
  · Map settings…", then the tab's own section (`modeInspector.ts`). It is left standing while nothing it shows
  changes.
- **Right dock** (`rightDock.ts`, pure state in `dockPrefs.ts`):
  - expanded / compact / hidden, cycled by Shift+\ (the existing `toggleSidePanel` key; its words in `keymap.ts`) and
    by the dock's ▭ and › buttons and its edge tab;
  - kept in `tiletrigger.editor.dock`, carried over once from `tiletrigger.editor.sidebars`;
  - width can be dragged on the inner edge, or set with the arrow keys on that edge (220–520 px, at most 45 % of the
    window), and is kept;
  - starts compact under 900 px (the old rule removed the dock under 1,100 px);
  - compact is a card holding a minimap placeholder until Phase 3;
  - selecting never opens it. Map settings and the problems pill do open it.
  - The Outliner draws only while it can be seen.
- **Left rail** (`leftRail.ts`): Map, Assets, and fold (`\`). It takes its 44 px from the palette's width, not the
  view's.
- **Tool bar** (`toolBar.ts`, table in `toolBarTools.ts`): each tab has its own tools.
  - Paint, Terrain and the Environment brush are on Environment's bar only. Bot test and Plan are on Test's bar.
  - Every tab has a ⋯ menu listing all 24 tools and actions.
  - It is built once; changing tab only shows and hides buttons.
  - The tool in hand stays on the bar, drawn dashed when it belongs to another tab.
- **Top bar:** title, file buttons, Undo/Redo, the 7 tabs, **View ▾** (`viewMenu.ts`: Grid, Full grid, Overlaps, Plan
  view, the map layers), Snap, theme, TEST bots and skill, ▶ Here, ▶ PLAY TEST.
  - The problems pill moved to the status bar, and Bot test to the Test bar.
  - The fit steps now only tighten until fit-3; from fit-4 things go, and fit-6/7 cover under 1,000 px.
  - At 1440 px and at 1280 px nothing is cut off.
- **Status bar** (`statusBar.ts`): level · selection ("N selected · M on other levels": the owner's answer 6) ·
  short counts · budget · hover target · problems pill. The keys line is gone; the same keys are in the `?` list.
- **Menus** (`popupMenu.ts`): WAI-ARIA menu buttons with the arrow keys, Home/End and Esc. Checkbox items stay open.
  Nothing in them runs per frame.
- **Not done (later phases):** the minimap (the compact card is a placeholder), Minimap/Outliner tabs in the dock,
  unified selection, numeric transforms, Tile View.
- **Tests:**
  - unit `client/test/editorLayout.test.ts`;
  - e2e: `openMapSettings` and `viewItem` helpers in `e2e/run.mjs`, and `editorLayoutChecks` in `editorux`;
  - `coverage` is now in the editor's flow mapping.

### Phase 2 — Unified selection + Outliner/Inspector
Implement selection controller and synchronized highlight across 3D viewport, outliner, and inspector. Add reliable object-focused properties and transform commands.

**Phase 2: as built (a helper of lane B's splitters22, `wip/mapmaker-ui-2`, 2026-11-16; no map format change).** The audit's
§4–5 plan, kept to its scope. Files under `packages/client/src/editor/` unless shared.

- **One selection** (shared `editor/selectionState.ts`): `EditorApp.selection` is read-only now; every write goes through
  `setSelection` (or `adoptSelection` where the panels are redrawn straight after: an edit's prune in `refresh`, opening a
  map in `mapSaving.ts`). `selectionRev` counts changes; the plan view redraws on it instead of joining every id each
  frame. Rules, pure and tested: `wholeSelection` (groups **and moving builds** whole wherever the pick came from: the
  view, the outliner, a problem's select, the budget pill; Alt keeps one; locks left out), `pruneSelection` (ids an edit
  removed dropped, the same object when none went; a stale pick selects only what is there), `sameSelection`.
- **Views in step**: a pick in the outliner selects in the view and the inspector (as before), the outliner passes Alt
  through, and a pick anywhere else scrolls the outliner to the row (`OutlinerPanel.reveal`, also when its search is
  cleared). It reads nothing from the page on the selection path: the row's place comes from the rows and the scroll and
  height last seen (scroll events, the size watcher), and only an out-of-view row scrolls, at the next frame. A level
  change keeps the selection (status bar, Phase 1). The bot-hint pin, path point and route point are left as they are;
  `setSelection` still lets the pin go.
- **The shared transform command** (shared `editor/transform.ts`, `transformCommand(doc, sel, t)`; `EditorApp.transform`):
  `{ by: { cells } | { metres } }`, `{ set: { id, axis, value } }`, `{ turn }`, `{ face: { id, deg } }`. Tiles and set
  pieces by whole cells through the layout check (`moveCommand`), things through `moveEntitiesCommand` (millimetres,
  re-bedding on the terrain), turns through `turnByCommand`; one command, one undo step. Callers: the drag's release (and
  its red preview, now with the same set-piece library), the arrow-key nudges, the rotate ring, the quick facings, and
  the inspector's X / Height / Z, Facing (things) and X / Y / Level (tiles, set pieces), ids `ed-insp-x|y|z|facing`.
  Behaviour change: things carried by a tile drag are re-bedded on the terrain like a drag of things alone.
- **The QUEUE bug, confirmed then fixed**: on the base build the e2e check typed X = 10.123456 and kept it unrounded, left
  a crate on a 1-in-10 slope 1 m into the ground (5.82 where a nudge gives 6.82), and moved a mover without its lift and
  barrel. All three now behave like the nudge.
- **Number fields** (`editorDom.numberInput`): Enter/Tab/blur commit, Esc puts the value back without an edit, an
  empty or unreadable value is put back, an unchanged value commits nothing.
- **Not done (later phases):** breadcrumbs, `focus`/`child` selection (Tile View, Phase 4), the minimap (Phase 3).
- **Tests:** shared `test/transform.test.ts` (rounding, re-bedding, a mover with its parts, Facing on a build, cells and
  the layout check, undo as one step each, the selection rules); e2e `editorTransformChecks` (`editortools`) and
  `editorSelectionSyncChecks` (`editorux`). No baseline moved.

### Phase 3 — Live minimap
Implement level-aware overhead projection, camera marker, selection highlighting, navigation, fit/zoom/pan, and layer toggles. Keep the minimap independently usable in compact mode.

**Phase 3: as built (a helper of lane B's splitters22, `wip/mapmaker-ui-3`, 2026-11-16; no map format change).** The
audit's §7 plan. Files under `packages/client/src/editor/`: `minimapModel.ts` (the maths, pure), `minimapPanel.ts` (the
drawing and the pointer), `minimap.css`, and the dock (`rightDock.ts`, `dockPrefs.ts`, the page's dock in `index.html`).

- **Where it shows:** the expanded dock's top panel is now **Minimap | Outliner** (WAI-ARIA tabs: a click, or the arrow
  keys, Home and End), Properties below as before; the compact card is the minimap (the Phase 1 placeholder is gone).
  The panel's fold (▾) folds both. The expanded dock opens on the **Outliner** until you pick the Minimap (owner
  question 1); the choice and the minimap's zoom are kept in `tiletrigger.editor.dock` (`tab`, `minimapZoom`), never
  in the map. A hidden dock, a folded panel, Map settings or the Outliner tab: none of the minimap runs.
- **What it shows**, north up, over the level being edited (the level strip's level; its name in a chip):
  - the ground (its paint colours, lighter on high ground; fainter off the ground level), then that level's floors,
    water, blocks and props (breakable props and moving or hidden blocks included), walls, the tile outlines (the
    level below faint), buried tunnels dashed on the ground level;
  - spawns by team, flags, hills, objectives and pickups (the plan view's icons, `planMarkers`);
  - the camera: a dot, a short arrow and the wedge it sees (the view's field of view and shape);
  - the selection, from the shared state (`EditorApp.selection`, redrawn on `selectionRev`): cyan outlines round
    tiles and set pieces, a ring round a thing; dashed where it is only on another level (things on the open ground
    count on every level);
  - a scale bar and N. The View menu's Map layers and the outliner's hide apply to it as to the view.
- **Framing:** the playable boundary, else everything built and placed (props too), with room round it for a dock of
  another shape. The wheel and + / − zoom (up to 16×) about the pointer; zoomed in, it follows the camera, a drag pans
  it, ⌂ fits the level again.
- **Clicks** (the spec's "click to navigate", and a selection source as §5 asks): a click on a thing selects it through
  `setSelection` and frames it, exactly as a click on its outliner row (Shift adds, Alt one part of a group or moving
  build; locked and hidden things can't be picked; the nearest thing within 8 px, else the set piece, else the tile
  with a cell there on that level). A click on open ground moves the camera there, keeping the selection. Double-click
  is kept for Tile View (Phase 4a); the minimap has no key (owner answer 1).
- **Cost** (`docs/PERF_MAPMAKER_TRACE_2026-11-15.md`, fix 6: nothing on the edit's path). The minimap is not called from
  `refresh`. Each frame it compares a few numbers. Its picture of the level is made again only when the document,
  level or layers changed: a new level or map at once, an edit once the edits pause (350 ms, at most 1.5 s into a run
  of edits, never during a drag; `bakeDelay`), and only while it can be seen. It is drawn from the boxes MapMaker
  already holds (`EditorApp.mapBoxes`), at about 3 px a metre (at most 1,600 px), with the ground drawn once per ground.
  The canvas is a copy of that picture plus the icons, the selection and the camera, drawn when the selection, the
  picture or the frame change, and at most 20 times a second while only the camera moves. Its size comes from a size
  watcher: it reads nothing from the page while drawing.
- **Measured** (`tools/perf/editor-edit.mjs "St. John's"`, software rendering on a loaded 4-core box, so the totals
  swing ±30 % run to run; `EDIT_DOCK=minimap` shows the Minimap tab): an edit's own `refresh` is unchanged (move a
  block 1 m: 426 ms on main, 397 ms here with the Outliner tab, 327 ms with the Minimap tab; undo 261 / 267 / 295 ms;
  the minimap is not in it). The minimap's picture, once per edit after the pause: 18-29 ms on St. John's (2,670
  things, 19,481 ground points); its per-frame check: about 0.2 ms. Opening Flavius Rule: 36 ms, its level 1: 10 ms.
- **Not done:** Tile View (Phase 4a, double-click); layer toggles of its own (it follows View → Map layers); doors and
  windows as edge marks; the plan view's frame drawn on it.
- **Tests:** unit `client/test/minimap.test.ts` (frame and zoom, the camera's marker, the selection's marks, picks,
  levels, when the picture is made again, the kept tab and zoom); e2e `editorMinimapChecks` in `editorux` (the tabs,
  a click selects and syncs the view, inspector and outliner, a selection made elsewhere shows without a new picture,
  open ground moves the camera, levels, an edit makes no picture on its own path, the zoom stays out of the map, the
  compact card, a hidden dock runs nothing). The `mapmaker.png` baseline still passes (1.3 % of pixels, the tab
  heading); not regenerated.

### Phase 4 — Tile Detail precision editor
Implement tile focus, child picking, move/rotate/snap, numeric transforms, local/world coordinates, history integration, and immediate 3D updates. Gate generated-child overrides behind verified generator support.

**Phase 4a: as built (a helper of lane B's splitters22, `wip/mapmaker-ui-4`, 2026-11-17; no map format change).** The
lead's note 3 and owner answers 1 and 8. Phase 4b (set-piece overrides) is **not built**: owner answer 9 parks it until
4a is in use. Files under `packages/client/src/editor/`: `tileViewModel.ts` (the maths, pure), `tileViewPanel.ts` (the
drawing, pointer and keys), `tileView.css`; wired in `rightDock.ts`, `dockPrefs.ts`, `editorApp.ts` (`openTileView`),
`editorInput.ts` (Enter, double-click, Esc), `minimapPanel.ts` (double-click, ⊞) and shared `editor/keymap.ts`.

- **Opening it** (owner answer 1): **Enter** on a selection (only with nothing else focused, so Enter on a button stays
  the button's), a **double-click** with Select in the view or on the minimap (the tile or set piece there), or the
  minimap's **⊞**. It is an asked-for action, so it expands the dock and shows the Minimap tab; selecting alone still
  never opens a hidden dock. **Esc** (in the plan or the view) lets the picked thing go and selects the focus, then goes
  back to the minimap; **← Map** and the breadcrumbs' "Map" too.
- **Where it shows** (a choice the spec left open, taken as recommended): in the expanded dock **in the minimap's
  place** (the spec says "under the minimap"; the dock is too short for both and Properties), with Properties below.
  A compact or hidden dock shows the minimap card or nothing, and Tile View runs nothing while unseen.
- **The focus** (owner answer 8): a tile, a set piece or a group (what the selection is: a whole group first, then its
  tile or set piece), else an **area**: the cells round the things selected; on the minimap, the cell clicked. The level
  shown is the one being edited if the focus has cells there, else its lowest (MapMaker's level follows it).
- **The plan** (north up, like the minimap; recommendation, owner question 2): the level drawn from MapMaker's cached
  boxes, the focus bright and the rest dimmed, its outline white (the parent) or cyan (selected), a grid on the snap
  step from the frame's origin, the local axes (x red, z green) at the anchor, a scale bar and N, the pointer's place in
  the chosen coordinates. Wheel zoom about the pointer, drag empty space (or right/middle drag) to pan, ⌂ fits.
  Breadcrumbs: **Map › Shop › Prop 1** (the focus's crumb selects it).
- **Children** (the audit's §6): things standing in it on that level (props, blocks, lights, door leaves, logic…): a
  click picks one and selects it everywhere (`setSelection`, single, so a group's member can be picked; a moving build
  whole); a **drag** previews in the plan and commits **one** shared transform (`{ by: { metres } }`) on release, on
  the snap step **1 / 5 / 10 / 50 cm** (Ctrl, Shift or Meta held: free, to the millimetre); the **arrow keys** nudge a
  step along the frame's axes (Shift: 1 cm), **R** turns 15° (Shift+R back), each one undo step. The fields under the
  plan: **X, Z, Height, Facing**, in **Local** (tile-relative: from the anchor cell's middle, turned by the tile's
  quarter turns; a group's or area's from its south-west corner, unturned: recommendation, owner question 3) or
  **World**. Typed values go through the same command (X/Z as a move, Height as `set`, Facing as `face`). The snap and
  the frame are kept in `tiletrigger.editor.dock` (`tileSnap`, `tileFrame`; defaults 10 cm and Local not written),
  never in the map. The numbers are in Tile View, not in Properties (which keeps its world X / Height / Z: owner
  question 6).
- **Cell sides** (lead's note 3: doors and windows are edge styles): every outer side of the focus's tiles, coloured by
  what is built (door-like green, window blue, wall grey, open dashed). A click picks one (its tile becomes the
  selection), and Style and Glass change it through `setEdge`, as the Walls tool and the inspector do. This also
  reaches multi-cell tiles' sides, which the inspector's Walls rows leave to the Walls tool.
- **Generated content** (§4.3): a set piece's parts are drawn hollow and dashed, can be picked (named "… (part)"), and
  say they are made by the set piece, pointing to Properties' Parts and Explode to tiles; a drag on one moves nothing.
  A set piece's tile sides aren't listed. Nothing pretends to be editable.
- **Kept the same:** no map format change; collision, the minimap and checks follow every edit because Tile View only
  makes the existing commands; locked and hidden things can't be picked; the shipped maps are untouched.
- **Not done:** Phase 4b; a rotate handle in the plan (R and the Facing field instead); dragging a door leaf along its
  wall (it is a thing, moved like any other); snap to wall segment, edge or anchor (the grid snap only).
- **Tests:** unit `client/test/tileView.test.ts` (local/world under every turn, a turned tile carrying its thing's local
  place and facing, the snap, a drag as one command and one undo, the focus kinds and how a selection or point picks
  them, children and parts by level, cell sides and a style change, picks, breadcrumbs, the kept prefs); e2e
  `editorTileViewChecks` in `editortools` (kept out of `editorux`, already about 20 minutes on CI; Enter, the dock, breadcrumbs, click, drag on the turned tile's snap as one undo,
  arrow and R, Local and World fields, a side made a door, Esc twice, a double-click on the minimap's set piece and its
  read-only part, nothing in the map, compact) and `editorTileViewMoveChecks` (a moving build picked
  whole, dragged as one step, a local Facing in a room turned 180°).

**Owner questions on Phase 4a** (recommended first; built as recommended):
1. Where Tile View shows: (a) in the expanded dock in the minimap's place, Properties below; (b) under the minimap as
   the spec says (both smaller); (c) a third dock tab.
2. The plan's orientation: (a) north up like the minimap, with the tile's local axes drawn; (b) turned so the tile's
   own north is up.
3. A group's or area's local origin: (a) its south-west corner; (b) its middle.
4. R in Tile View: (a) 15° (Shift+R back), the Facing field for any angle; (b) MapMaker's own R step for that kind.
5. Phase 4b (set-piece overrides): (a) still parked until 4a is in use (owner answer 9); (b) start it next.
6. Local numbers: (a) only in Tile View, Properties keeps world X / Height / Z; (b) Local fields in Properties too while
   Tile View is open.

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

## Owner's answers on Phase 1 as built (2026-11-14: "Recs")
1a: between 900 and 1,100 px the right dock starts expanded. 2a: the left rail's 44 px comes from the palette. 3a: the map is renamed in Map settings (the title opens them); no inline rename. 4a: Dress all and Settle all stay in the ⋯ menu only.

**The owner's answers on Phase 3 (2026-11-16, "1a 2a 3a"):** the dock opens on the Outliner tab; a click on a thing in the minimap selects and frames it, like the Outliner; the minimap follows View → Map layers (no toggles of its own). All as built.
