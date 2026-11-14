# MapMaker UI audit (Phase 0 of `docs/MAPMAKER_UI_SPEC.md`)

Phase 0 of the owner's MapMaker UI spec, 2026-11-14. Docs only: no code changed. It is written for whoever builds
Phases 1–4, so it says where each thing lives today and what each phase has to move, keep or test. Line numbers are
from main at 45ff59c4 and will drift. Files are under `packages/client/src/editor/` unless a path says otherwise.
"Shared" means `packages/shared/src/`.

The lead's notes at the end of the spec are binding where they adjust it: we keep the 7 top tabs, the left rail is
small (Map, the asset browser, collapse), the minimap reuses the plan view's maths, and Tile Detail is scoped to our
data (Phase 4a read-only set-piece insides, 4b overrides optional).

## The five findings that matter most

1. **Map properties is not a panel of its own today.** It is what the Inspector draws when nothing is selected
   (`inspector.ts buildInspector` → the mode's section from `modeInspector.ts`, then `mapProperties.ts
   renderMapProperties`). Phase 1's "inspector shows only the selection" and its "Map settings dialog" are one
   change. Seven e2e flows reach Map properties by pressing Esc and reading the inspector: `editor`, `editortools`,
   `editorenv`, `canyon`, `traffic`, `weaponsets` and `coverage` (§9). Phase 1 needs one test helper that opens Map
   settings, and those flows switched to it in the same landing.
2. **Selection is already one state** (`EditorApp.selection`, a `Selection` of stable ids: shared
   `editor/operations.ts`). It already goes through one setter (`EditorApp.setSelection`) that redraws the 3D
   outlines, the gizmo and ring, the inspector, the tool bar and the outliner. The plan view polls it each frame.
   Phase 2 should wrap this setter, not replace it. There are three side selections to fold in or leave alone: the
   bot-hint pin (`botHintTool.ts`), the path point (`pathTool.ts`) and the route point (`routeTool.ts`). There are two
   writes that skip the setter: `refresh()` drops deleted ids, and `mapSaving.ts` clears the selection on open.
3. **Tiles do not own props.** A prop's position is in world metres, a tile has no child list, and moving a tile
   leaves the props where they are (`moveCommand`). "Props in this room" has to be found by where they stand. Two
   things help: props from Dress room have ids `<dressTag(tile, level)>_<n>`, and movers keep explicit child lists
   (`mover.blocks`, `mover.props`). Doors and windows are edge styles keyed `"dx,dy,dz:N"` in the tile's own frame,
   with nothing to slide along the wall. Door leaves are separate `door` entities. Tile rotation is quarter turns
   only, with no scale, so local ↔ world is a quarter-turn rotation about the tile's anchor cell.
4. **Set-piece children already have ids and a small override layer.** Parts expand to `sp_<placement id>_<part
   index>`, and `SetPiecePlacement.overrides` already holds `roles` and `hide: number[]`, by part index, since v27.
   The inspector already has a "Parts" checklist that hides parts per placement. Phase 4b is therefore a bump that
   adds to this layer, not a new one. Its real problem is that the ids depend on array position: editing a shipped
   definition (`content/setpieces/*.json`) moves the indices. 4b needs a stable `key` per part, a migration from
   index to key, and a format number after the tunnel kit's planned v39.
5. **Tile Detail would miss many maps if it only works on tiles.** 14 of the 89 maps in `maps/` have no tiles at all.
   St. John's has 3,395 entities and 0 tiles, Apex Ring 2,275 and 0, Env Showcase 2,537 and 0. Across all maps there
   are 14,781 blocks and 21,291 props, against 6,683 tile edges. A "room" in those maps is blocks. Phase 4a should
   pick its focus from a tile, a set piece **or** a group (`MapGroup`, v31), with a box region as the fallback.

## 1. Component tree today

The page is static HTML in `packages/client/index.html` (lines 181–391, `<div id="editor">`), plus panels and dialogs
that the editor modules build. `#editor` is `position: fixed; inset: 0`. The Babylon canvas is the full window
behind it, and every panel is an absolutely positioned overlay (`editor.css`: `#ed-palette` left, `--ed-pal-w:
320px`; `#ed-right` right, `--ed-right-w: 268px`; both `top: 48px; bottom: 36px`). **Folding a panel does not resize
the canvas**: it already covers the window. Only the overlay row (`#ed-overlay`), the level strip and the bot-hint
`viewRect` work from the panel widths. Under 900 px wide, `#ed-right` is `display: none`.

`EditorApp` (`editorApp.ts`, about 1,000 lines) is the coordinator. It holds the document (`history.doc`), the
`history`, the `selection`, the `tool`, the `level` and `showAll`, the `snapMode` and the pointer. Each part is a
class that takes the app (overhaul Phase 2 item 5).

| Region | DOM | Built by | What is in it |
|---|---|---|---|
| Top bar | `#ed-top` | `index.html` + `topBar.ts` (`bindUi`, `updateTopBar`, `syncWorkspaceTabs`), `fitTopBar` in `editorParts.ts` (5 compact steps `fit-1..5`) | Quit, brand, **map name** `#ed-name`, dirty dot; New, Open, Save, Export, Import, Publish (owner); Undo/Redo; **status pill** `#ed-status`; **7 mode tabs** `#ed-modes`; Grid, Full grid, Overlaps; **Snap** `#ed-snap`; **Theme** `#ed-theme`; TEST bots `#ed-bots`, skill `#ed-skill`; **Plan** `#ed-plan`; Bot test `#ed-maptest`; ▶ Here; ▶ PLAY TEST |
| Palette (asset browser) | `#ed-palette` | `palette.ts` (`Palette`: quick row, search, folding groups, grid/cards), `paletteBuilder.ts` (fills the panes), `paletteSearch.ts`, `paletteCatalog.ts`, `paletteAtlas.ts`, `propPlaceOptions.ts`, `envTools.ts`, `setPieceTools.ts` (Set pieces pane, My set pieces), `pathTool.ts` (Paths pane), `modeInspector.ts fillTestPane` (Test pane), `terrainTools.ts` + static HTML (Terrain pane), `paintTools.ts` + static HTML (Paint pane), `mapProperties.ts renderSkyPane` (Sky pane) | The mode's row of palette tabs `#ed-pal-tabs` (15 panes; `editorModes.ts` says which mode owns which), search `#ed-search`, grid/card toggle, Style Pack filter `#ed-pack`, ★ Favourites / Recent / This mode only `#ed-pal-quick`, results, then the panes |
| Edge tabs | `#ed-pal-toggle`, `#ed-right-toggle` | `topBar.ts setupSidebars` | Fold the palette (`\`) or the side panel (`Shift+\`), remembered |
| Side panel | `#ed-right` | `panels.ts mountPanels` (folding) | Three folding panels: **Outliner** (`outlinerPanel.ts`, shared `editor/outliner.ts`), **Inspector** `#ed-inspector` (`inspector.ts`, `entityInspector.ts`, `setPieceTools.pieceInspector`, `mapProperties.ts`, `modeInspector.ts`, `groupPanel.ts`, `groundFitPanel.ts`, `tileOptionPanel.ts`, `tunnelPanel.ts`, `inspectorKeep.ts`, `skyWeatherSection.ts`, `cardShot.ts`, `makerThumb.ts`), **Validation** `#ed-issues` (`mapChecks.ts`) |
| Tool bar | `#ed-overlay > #ed-toolbar` | `topBar.ts buildToolbar`, `keyOverlay.mountButton` | Select, Place (shows the last piece), Erase, Paint, Walls, Terrain, Measure │ Rotate, Delete, Keys, Help |
| Tool hint | `#ed-toolhint` | `editorApp.setTool` (one line per tool) | Tool name and what a click, right-click and R do |
| Level strip | `#ed-levels` | `index.html` + `editorApp.renderLevels` | Current level, Show all levels (H), Up/Down, a list of the levels that have content, Reset view (Home) |
| Status bar | `#ed-bottom` | `index.html`, `topBar.updateCounts`, `hover.ts` (`#ed-target`), `budgetBar.ts` (`#ed-budget`, inserted before `#ed-target`), `editorApp.setTool` (`#ed-hint`) | Level and its height, counts (tiles, set pieces, spawns, pickups, scenario objects, NPC squads, rules, collision boxes), the budget pill, the hover target, and a permanent keys line (`#ed-hint`, the "instructional paragraph" the spec wants gone) |
| Viewport overlays | under `#editor` | `planView.ts` (`#ed-plan-overlay` canvas, `#ed-plan-bar`), `rotateRing.ts`, `measureTool.ts`, `noteTool.ts` (`#ed-notes`), `botHintTool.ts` (`#ed-bothints`), `mapTestOverlay.ts`, `makerThumb.ts` / `cardShot.ts` (`#ed-thumb-frame`), hover card `#ed-tip`, `#ed-marquee`, `#ed-toast` | |
| Floating panels | `#ed-logic` | `logicPanel.ts` (L, the Logic tab) | Rules, variables, timers, factions |
| | Bot test | `mapTestPanel.ts` (+ worker) | Heatmaps, spawn exposure |
| Dialogs | `#ed-open-dialog`, `#ed-new-dialog`, `#ed-publish-dialog`, `#ed-sp-save-dialog`, `#ed-quit-dialog` (static); `#ed-keys` (`keyOverlay.ts`), tour (`tour.ts`), `mirrorDialog.ts`, `changeGridDialog.ts`, `templatePicker.ts`, the bot-set editor (from Map properties → Bots), the selection menu `#ed-ctx` (`editorInput.ts`) | |

The mode tabs (`editorModes.ts EDITOR_MODES`) are Build (Tiles, Set pieces, Walls), Props (Props, Lights), Gameplay
(`data-ws="entities"`: Gameplay, NPCs, Vehicles, Objects), Logic (no pane: opens `#ed-logic`), Environment (Paint,
Nature, Terrain, Sky), Paths (Paths) and Test (Test). Picking a tool from another mode's card moves the tabs to that
mode (`setTool` finds the card's pane).

### Where each control the spec moves lives, and which phase moves it

| Control | Lives now | Moves to | Phase |
|---|---|---|---|
| Map name | `#ed-name` (top bar) **and** `#ed-prop-name` (Map properties); both run `setMetadata` | Title stays in the top bar; a click opens Map settings | 1 |
| Map settings | The inspector with nothing selected (Esc) | A Map settings view, opened from the title and from the rail's Map entry | 1 |
| Theme | `#ed-theme` (top bar) **and** Map properties → Theme | Map settings → General only (the top-bar copy goes to overflow or away; say so in CHANGELOG) | 1 |
| Snap | `#ed-snap` (props, spawns, objects: 25 cm / 50 cm / 1 m / off) | Next to the tool bar ("snap indicator near the interaction") | 1 |
| Grid, Full grid, Overlaps | Top-bar toggles | View group or overflow | 1 |
| Plan (K), Bot test | Top bar, also the Test pane | Test tab's tool bar plus overflow; K stays | 1 |
| TEST bots and skill | `#ed-bots`, `#ed-skill` (session-only, **not** map data) | Stay beside PLAY TEST. **Do not** put them in Map settings: they are not saved with the map, unlike Map properties → Bots (`setMapBots`) | 1 |
| Status pill | `#ed-status` (click scrolls to Validation) | Status bar, opening the problems list | 1 |
| Counts, keys line | `#ed-counts`, `#ed-hint` | Short status bar: level · selection · budget · target; keys go to the `?` overlay | 1 |
| Budget pill | `#ed-budget` (in the status bar since 2026-11-08) | Stays | — |
| Palette fold | `#ed-pal-toggle`, `\` | The left rail's collapse | 1 |
| Side panel fold | `#ed-right-toggle`, `Shift+\` (2 states) | Right dock with 3 states | 1 |
| Outliner, Inspector, Validation | Three folding panels in `#ed-right` | Dock: `Minimap │ Outliner` tabs on top, Properties below; Validation goes with the status pill | 1 (tabs), 3 (minimap) |
| Map layers (Tiles, Props, Pickups, Logic & traps, Spawn points) | Map properties → Map layers (`view.hiddenLayers`, editor-only, not stored) | View options / minimap layer toggles, not Map settings | 1 or 3 |
| Dress all bare rooms, Settle all props | Buttons in Map properties | Tools overflow (they are actions, not settings) | 1 |
| Tool bar | `#ed-toolbar`, 7 tools + Rotate, Delete, Keys, Help | Contextual tool bar per tab, with an overflow (§2) | 1 |
| Selection's actions | Inspector buttons (Rotate, Mirror, Duplicate, Mirror…, Delete, Focus), right-click menu `#ed-ctx` | Properties keeps them; numeric transform fields join them | 2 |
| Plan view | `planView.ts` (the main camera turned orthographic) | Stays a view mode; the minimap reuses its maths | 3 |
| Tile walls | Tile inspector → Walls (one select per side, single-cell tiles only) | Tile View, clickable edges | 4a |
| Set-piece Parts checklist | Set-piece inspector (`setPieceTools.ts` ~l. 579, `overrides.hide`) | Tile View read-only parts, then 4b | 4a/4b |

## 2. Tools and shortcuts

Every key is in one table, shared `editor/keymap.ts` (`EDITOR_KEYS`, `EDITOR_KEY_NOTES`). The keydown handler
(`editorInput.ts`) runs `matchEditorKey`, and the `?` overlay (`keyOverlay.ts`) draws `editorKeyGroups()`, so the
overlay can't go stale. `client/test/keymap.test.ts` reads every MapMaker module for hand-matched keys. The spec's
"keep current shortcut mapping" is therefore cheap: **any new key (dock, minimap, tile view) is a row in this table
and a `KeyAction`.**

Columns: **Bar** is the tool bar today. **Proposed** is the spec's contextual tool bar per tab (B = Build, Pr = Props,
G = Gameplay, L = Logic, E = Environment, Pa = Paths, T = Test). "Overflow" means it is reachable from the bar's ⋯ menu
in every tab, and its key works everywhere, as it does today.

| Tool / action | Key | Bar today | Proposed: on the bar in | Notes |
|---|---|---|---|---|
| Select | V | ✓ | all | |
| Place (last piece) | P | ✓ | B Pr G | Shows what it places (`#ed-tb-place-what`) |
| Erase | X | ✓ | B Pr G E Pa | Alt: one piece of a moving build |
| Paint | B | ✓ | E (overflow elsewhere) | Spec lists Paint in the core five; ours is an Environment tool. Q2 |
| Walls & openings | O (again: next style) | ✓ | B | |
| Terrain | T (again: next brush) | ✓ | E | |
| Environment brush | N | — | E | |
| Paths | G | — | Pa | |
| Paths on the track | Shift+G | — | Pa | |
| Measure | U | ✓ | T; overflow | |
| Note pins | J | — | T; overflow | |
| Bot hints | Y | — | G T | Ctrl+Y is redo |
| Logic panel | L | — (it is a tab) | L tab itself | |
| Rotate / finer | R / Shift+R | ✓ (Rotate) | all, with a selection | |
| Delete | Del, Backspace | ✓ | all, with a selection | |
| Mirror / Mirror… | M / Shift+M | — | B; overflow | |
| Duplicate | Ctrl+D | — | overflow | |
| Group / Ungroup | Ctrl+G / Ctrl+Shift+G | — | overflow | |
| Copy / Paste | Ctrl+C / Ctrl+V | — | overflow | |
| Nudge | ↑ ↓ ← → | — | — | Each press is one undo step |
| Selection up/down a level | Shift+PgUp / Shift+PgDn | — | — | |
| Level up/down | PgUp / PgDn | level strip | level strip | |
| Show all levels | H | level strip | level strip | |
| Plan view | K | top bar | T; overflow | |
| Frame selection | F | inspector | Properties | |
| Reset view | Home | level strip | level strip / minimap Fit | |
| Brush size | ] / [ | — | E (with the brush) | |
| Pick up a style | I | — | E (Paint) | |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z, Ctrl+Y | top bar | top bar | |
| Save | Ctrl+S | top bar | top bar | |
| Play test / from here | F5 / Shift+F5 | top bar | top bar; T | Work while typing |
| Palette / side panel | `\` / Shift+`\` | edge tabs | rail collapse / dock | Shift+`\` cycles the dock's 3 states? Q4 |
| Search palette | / | — | rail | |
| Keys overlay | ? | ✓ (Keys) | overflow | |
| Tour | — | ✓ (Help) | overflow | `tour.ts` points at `#ed-palette`, `#ed-test`, `#ed-test-here` and palette cards |
| Fly camera | W A S D, Q E, Shift | — | — | Held keys; Ctrl pauses |
| No snap while placing / measuring | hold Ctrl or Shift / Ctrl or Alt | — | — | |

Free letters for new actions: **C** (unused alone), **Z** (unused alone), and the digits. Q1 asks which keys the dock
and Tile View get.

Mouse: click, Shift+click (add), Alt+click (one part of a build or group), drag (move, or box select on empty
ground), right-click (Select: the selection menu; tools: take back), the ring drag, right-drag look, wheel zoom.

## 3. Map settings: today's fields, grouped as the spec asks

Built by `mapProperties.ts renderMapProperties`, in this order: picture, card shot, notes, name, theme, size, players,
mode, also offered, teams, weapon set, bots, players by mode, time of day and weather, map layers, description, tier,
test map, everything breaks, map ID, the Sky button, blood, physics, dress all, settle all, boundary. Every field
except Map layers is an undoable command (`setMetadata`, `setTheme`, `setTeamSetup`, `setMapBots`, `setBotCast`,
`setWeaponSet`, `setBlood`, `setPhysics`, `setGlass`, `setBounds`, `setTimeOfDay`, `setWeather`). Grouped as below,
nothing is invented.

**General**
- Name (`#ed-prop-name`; also `#ed-name`), Description (textarea, 2,000 chars), Theme (also `#ed-theme`), Size
  (read-only: cells × cells · levels, worked out from what's built).
- Picture (`makerThumb.ts thumbnailSection`: Set/Retake/Clear, with the plan beside it; `metadata.thumbnail` is a
  JPEG of at most `MAX_THUMBNAIL_CHARS`, with `thumbnailCamera`).
- Card shot (`cardShot.ts`: Set card shot…, Preview, Clear; `setCardCameraCommand`).
- Note pins list (`noteTool.section`: go to, delete).

**Gameplay**
- Mode (main mode = `supportedModes[0]`, `withMainMode`). Also offered: Deathmatch, TDM, Co-op (`#ed-prop-also`).
  Drop Race (`#ed-prop-drop-race`, old maps only).
- Teams (only for TDM, KotH, Elimination and Breakthrough): presets, a size per team, + Team / − Team.
- Min players, Max players (`recommendedPlayers`). Players by mode (`metadata.playerCaps`, blank = Auto).
- Weapon set (`#ed-prop-weapons`). Bots (`#ed-bots-sum`, `#ed-bots-edit` → the bot-set editor, `setMapBots`). Bot
  characters (`#ed-cast`, `setBotCast`).
- Everything breaks (`#ed-prop-destruction`). Gravity (`#ed-gravity`), Fall damage (`#ed-fall-damage`), Broken glass
  returns (`#ed-glass-respawn`).
- Boundary: walls style, west/east/south/north edges, height, Fit to map.

**Presentation**
- Time of day and weather (`skyWeatherSection.ts`, `#ed-skyweather`).
- Blood colour and amount.
- "Sky, scenery & border…" (a button to Environment → Sky; the backdrop lives there: `renderSkyPane`).

**Advanced**
- Map ID (`#ed-prop-id`), Tier and quality gates (`#ed-prop-tier`), Test map (`#ed-prop-testonly`).

**Not settings: they move elsewhere in Phase 1**
- Map layers: an editor-only view filter, not stored and not undoable. It goes to view options or the minimap's
  layers.
- Dress all bare rooms and Settle all props on ground: one-off actions. They go to the tool overflow or a "Map
  tools" menu.
- The Gameplay mode's counts and the Paths and Test sections (`modeInspector.ts modeSection`) are drawn above Map
  properties today. With an empty inspector they become the "nothing selected" state for those tabs, which is the
  spec's "compact empty state". Q3.

**Fields that need care**
- **Name and Theme are edited in two places.** The top-bar name field doesn't refresh while it has focus
  (`updateTopBar`). Keep one source.
- **Mode** rewrites `supportedModes` with the main mode first. Further modes are inferred from pieces
  (`playableModes`: flag bases, hills, sectors). "Also offered" lists only three modes. The help line under Mode
  changes with the map's teams.
- **Min/Max players** clamps each to 1–96 but doesn't keep min ≤ max (`setPlayers`).
- **Players by mode**: an empty field shows `autoPlayerCaps`, worked out from size and spawns. Typing sets the mode's
  own cap; Auto clears it.
- **Tier**: "core" is refused while any gate fails, and the gates read `app.issues` (validation). Map settings must
  still have fresh validation when it opens.
- **Map ID** is checked against `^[a-z0-9_]{4,64}$`. It should be set once: Export stamps `metadata.release` from it
  (`topBar.ts`, the Export handler).
- **Picture and card shot frame with the editor camera** over the viewport (`#ed-thumb-frame`; `#ed-levels` is
  hidden while it is open). **A modal Map settings dialog must step aside while framing and come back after.** This
  is the trickiest part of Phase 1.
- **Time of day previews live while the slider is dragged, without an edit**, and commits on release. The dialog
  must leave the 3D view visible for this to make sense, so it should be a dock view or a non-modal panel, not a
  modal over the canvas. Q5.
- **Rebuild cost.** `Inspector.mapPropertiesStand` exists because building Map properties costs 25–50 ms on a big map
  (validation, the file size, the plan). Inside a dialog, build it only while it is open.
- **Teams** shows only for four modes, and `teamSetup` stays in the document when the mode changes.

## 4. Selection

**How it is held.** `EditorApp.selection: Selection = { tiles: string[]; entities: string[]; setPieces?: string[] }`
(shared `editor/operations.ts`). It holds stable ids only, no references. `selCount()` and `selPieces()` read it.

**How it is set.** `EditorApp.setSelection(sel, single = false, keepHint = false)` (`editorApp.ts` ~l. 746):
1. lets go of the bot-hint pin (`hints.deselect()`) unless `keepHint`;
2. widens to whole groups (`withGroups`) unless `single` (Alt);
3. drops locked things (`outliner.selectable`, the padlock);
4. `updateSelectionVisuals()`: the 3D tile and set-piece outlines (`view.setOutlines`), the entity highlights
   (`view.setEntities`), the gizmo (`view.setGizmo`) and the ring (`ring.redraw`);
5. `inspector.renderInspector()`, `topBar.syncToolbar()` (Delete enabled) and `outliner.draw(true)`.

Callers (27 calls): 3D picking (`editorInput.ts` pointerdown: hit → tiles/entities/setPieces, movers whole via
`moverGroupOf`, groups via `groupOf`, Shift adds or takes out), box select (`editorInput.ts`), the outliner
(`outlinerPanel.ts` ~l. 249: selects, changes level, frames), placing (`placing.ts`: selects what was just placed),
duplicate and paste (`selectionEdits.ts`), set-piece tools, the budget pill (selects what a budget counts), and
`mapChecks.ts` (a problem's "select").

**Writes that skip the setter.**
- `refresh()` (`editorApp.ts` ~l. 576): after every document change it filters out ids that no longer exist. This is
  "fall back gracefully" today, but with no fall back to a parent.
- `mapSaving.ts` ~l. 117: open or new sets `emptySelection()`.

**Selections beside the main one.**
- `botHintTool.ts`: `sel` (one hint pin), with its own inspector. `setSelection` lets it go, and picking a hint
  clears the main selection.
- `pathTool.ts`: the path being edited and `selected` (a point index). `routeTool.ts`: the same for routes. Paths and
  roads are not in `Selection`: a click on one with Select opens it in the Paths tool (`editPath`).
- Notes: a note pin opens its own editor and is not a selection.

**Each view today.**
- 3D: outlines and highlights, from `updateSelectionVisuals`.
- Outliner: `draw(true)`. The row is lit from `app.selection`; it is virtualised, so it redraws only the rows in
  view.
- Inspector: rebuilt from `app.selection` (keeping the field being typed in: `inspectorKeep.ts`).
- Group row (`groupPanel.ts`): part of the inspector, from `selectionGroup(doc, sel)`.
- Set piece: selected whole. Any of its parts picks the placement (`hover.ts pickNow`, `expansion.partOf`).
  "Explode to tiles" is the only way to reach parts one by one.
- Plan view: `PlanHost.selected()` is read every frame, and the overlay redraws when the joined id string changes
  (`planView.ts update`). That builds a string of every selected id per frame, which is fine now and worth a
  revision counter later.
- Level changes keep the selection (`setLevel` doesn't touch it). Things on another level stay selected. That is
  predictable but not shown anywhere: the spec asks for "preserve valid selection or clear predictably", so Phase 2
  should decide and show it (Q6).

**What a unified controller replaces, and what it only wraps.**
- *Wraps* (keep): `setSelection`'s rules (groups, locks, movers whole, Alt for one), `Selection` as the stored shape,
  and the view updates.
- *Replaces*: the direct assignments in `refresh()` and `mapSaving.ts`. The plan view's per-frame poll becomes a
  revision counter (`selectionRev`), which the minimap (Phase 3) and Tile View (Phase 4) subscribe to the same way.
- *Adds*: `focus` (the tile, set piece or group Tile View is in), and `child` (an entity, a tile edge `{ tile,
  edgeKey }`, or a set-piece part `sp_<id>_<n>` shown read-only). Breadcrumbs come from these. The bot-hint pin and
  the path point can become `kind`s of the same state later. For Phase 2, leave them as they are and make sure
  `setSelection` keeps clearing them.
- *Hidden dock*: nothing in `setSelection` opens the side panel today, and that must stay true. The edge tab's state
  is separate (`tiletrigger.editor.sidebars`).

**Risks.**
- **Feedback loops**: `outliner.draw(true)` and `inspector.renderInspector()` are called from inside the setter.
  Views must read state, never call `setSelection` while drawing.
- **`renderInspector` is costly on big maps.** Selection changes on St. John's were part of the 50 ms layout the
  MapMaker lane is chasing (QUEUE, `wip/mapmaker-editor-speed-2`). Phase 2 must not add a layout read to the
  selection path. Wait for that branch.
- **Group widening** means the stored selection is wider than what was clicked. Breadcrumbs (`Map > Group > Door 2`)
  need the clicked id as well, or Alt has to be the way in.
- **Locked and hidden** things must stay unpickable from the minimap and Tile View too (`outliner.blocked`,
  `view.outlinerHidden`).
- **Set-piece parts aren't in the document** (they are in the expansion), so `refresh()` would drop a part id at
  once. The child selection has to live beside `Selection`, not in it.

## 5. Undo and history

- **Where commands go.** Every edit is an `EditCommand` (shared `editor/commands.ts`, about 30 kinds plus `batch`),
  run through `EditorApp.run(label, cmd)`. That wraps it in `withGroupsTidied` and calls `history.execute`.
  `EditHistory` keeps whole documents before and after each step (immutable and structure-shared), up to 500 steps.
  `onChange` feeds the budget tracker. `revision` is what `refresh()` watches.
- **How a drag becomes one step.**
  - *Move*: `editorInput.updateDrag` previews only (outlines at a cell offset, entities drawn from
    `applyCommand(viewDoc, …)`), and `endDrag` runs **one** `moveCommand` (tiles, set pieces) or
    `moveEntitiesCommand` (things).
  - *The ring*: `rotateRing.ts` previews with `previewTurn`, commits one `turnByCommand`, and Esc cancels.
  - *Brushes* (paint, walls, erase, scatter): `history.beginStroke()` … `endStroke()`. `execute` merges each command
    into the top entry while the stroke is open.
  - *Terrain*: one `setTerrain` per stroke (`terrainTools.endStroke`).
  - *Path points, notes, hints*: one `setPaths` / `setNotes` / `setBotHints` per drop.
  - *Time of day*: preview while dragging, commit on release.
- **Where it is not one step.** Each arrow-key nudge is its own step, so a held key makes dozens. An inspector number
  is one step per `change`, which is right.
- **Numbers and drags differ today.** The inspector's X/Height/Z (`entityInspector.ts` ~l. 102) build an
  `updateEntities` by hand. A drag uses `moveEntitiesCommand`, which rounds to the millimetre and re-beds a prop
  resting on terrain. So the same move gives a different result depending on how it was made. A whole moving build
  shows the mover's inspector: check whether typing X there moves only the mover and leaves its `blocks` and `props`
  behind. The code suggests it does; Phase 2 should confirm and fix it.
- **The shared transform command (Phase 2).** A shared `editor/transform.ts`, e.g.
  `transformCommand(doc, sel, { move?: [dx, dy, dz] | { set: [x, y, z] }, turn?: radians | { set }, frame: 'world'
  | { tile: id } | { piece: id }, snap })`. It would build on `moveCommand`, `moveEntitiesCommand` and
  `turnByCommand`, so movers, groups, re-bedding, rounding and the layout checks behave the same everywhere. Its
  callers would be the gizmo and ring, the inspector's fields (with Enter/blur to commit and Esc to cancel, which
  `numberInput` doesn't do today), the nudges, and Tile View drags (preview with `applyCommand` on `viewDoc`, then
  one `run` on release, as `endDrag` does now). It stays pure and is tested headless (overhaul rule "one source of
  truth").

## 6. Map data for Tile Detail

**How things are stored** (shared `map/schema.ts`, format v38, `map/mapKeys.ts MAP_FORMAT_VERSION`). Ids are
`StableId` (4–64 of `[A-Za-z0-9_-]`) made by `newId(prefix)` (`tile_…`, `prop_…`; seeded in test mode).

| Thing | Stored as | Addressable today | Notes for Tile View |
|---|---|---|---|
| Tile | `classicStructure.tiles[]`: `{ id, tile, x, y, z, rotation 0-3, surfaces, family, edges, glass, upperFloors, options }` | Yes, by id | Cells from the catalog def turned by `rotation` (`placementCells`). The cell is `cellSize` (8 m) and the level `levelHeight` (4 m). **No scale; quarter turns only** |
| Door / window opening | `tile.edges["dx,dy,dz:N"] = EdgeStyle` (28 styles, `content/edgeStyles.generated.ts`), glass in `tile.glass[key]` | Yes, as (tile id, edge key) | Fixed in the middle of a cell side. The style is changed, never moved. 6,683 set edges across the maps: door 1,240, window 949, windows 372, wide 301… |
| Door leaf | `door` entity (style, startOpen, locked, auto, team), placed in a doorway | Yes, by id | Snaps to doorways when placed. 199 across all maps. The outliner numbers them ("Door 2") |
| Room geometry, walls, floors | The tile definition (catalog `LocalBox`es), and room `options` (layout, floor insert, ceiling, corners, facade), `upperFloors` | No: baked into the tile's boxes | Read-only in Tile View; options stay in the inspector |
| Props, blocks, lights | `entities[]`, `position` in world metres, `yaw` (and a block's roll) | Yes, by id | **No parent tile.** A room's props are found by position (cells from `roomCells`). Dress room's props are `<dressTag(tile, level)>_<n>`. Moving a tile doesn't carry them |
| Moving build | `mover` entity with `blocks: id[]`, `props: id[]` | Yes | The one parent → children link by id in the format |
| Set piece | `setPieces[]`: `{ id, piece, x, y, z, rotation, mirror, pack, overrides: { roles, hide: index[] } }`; definitions in `content/setpieces/*.json` or the map's `setPieceDefs` | The placement by id. Parts are reached only through the expansion | `expandSetPieces` makes parts with ids `sp_<placement>_<index>` (`setPiecePartId`), `partOf` maps each part back to its placement. **Parts aren't in the document**: MapMaker draws the expansion (`viewDoc`) |
| Group | `groups[]` (v31): members by id | Yes | A ready-made "room" for block-built maps |

**What Phase 4a can do with no format change.**
- Focus a tile, a set piece or a group, or as a fallback a box region.
- Draw its plan from the same boxes as the 3D view (`buildMapGeometry` / `mapBoxes()`, filtered to the focus's cells
  and level).
- List and pick its edges (change the style and glass with `setEdge`, which already exists), and pick and move the
  props, blocks and lights standing in it, with local coordinates: local = world − anchor, rotated by −`rotation`
  quarter turns. Set-piece parts are shown read-only, with "Explode to tiles" as the honest way to edit them.

**What Phase 4b (overrides) would need.**
1. **Stable child ids that survive edits to the definition.** Today's index-based `sp_<id>_<n>` and `hide: number[]`
   break if a shipped definition is edited (parts added, removed or reordered). Add an optional `key` per part (for
   example `^[a-z0-9_]{1,32}$`) to the definition schema, filled for every shipped piece by a content tool, and make
   the part id `sp_<placement>_<key>` when a key exists.
2. **The override layer**: `overrides.parts: Record<key, { offset?: [dx, dy, dz], yaw?: number, hide?: true, style?
   }>`, applied in `expandSetPieces` after the mirror and turn, in the piece's own frame, so a mirrored or turned
   placement keeps its tweaks.
3. **A format bump with a migration** (`map/migrate.ts`): `hide: index[]` becomes `parts[key].hide`, through the
   definition the map used. Older maps load unchanged. HANDOFF's rule applies: one bump at a time, claimed. The tunnel
   kit has already planned **v39** (`family` on set pieces), so 4b takes the number after whatever lands first.
4. **Derived data stays in step for free.** Collision, navigation, the flicker clipping and the budgets all read the
   expansion. They follow the overrides with no special case, as long as only `expandSetPieces` applies them. The spec's
   §6 "stale collision" worry is answered by that single point.
5. **Edit this instance vs. edit template.** Instance edits write `overrides`. "Edit template" exists only for a map's
   own `local.*` definitions (`setPieceDefs`). Shipped definitions are content and can't be edited from MapMaker,
   which agrees with "maps are declarative data" and the no-uploads rule.

## 7. Minimap

**What exists.**
- *Plan view* (`planView.ts`, shared `editor/planView.ts`): turns the **main** camera orthographic and straight down,
  with a clip plane at 0.6 of a level above the floor (the terrain's materials are exempt), and draws a 2D canvas over
  the view (tile outlines, markers, a key on export). It is a mode of the one view, not a second picture, so the
  minimap can't reuse its rendering. It can reuse its pure maths: `planArea` (boundary, or what's built plus a
  margin), `planFrame`, `planToScreen` / `screenToPlan`, `planZoom` about the pointer, `planPan`, `planTiles` (the
  level's tiles, and the level below's drawn faint), `planMarkers` (spawns by team, flags, hills, objectives,
  pickups, with yaw and radius) and `PLAN_COLORS`. North (+Z) is up.
- *The game minimap* (`game/minimap.ts`, with `frontend/mapPlan.ts`): `setMap` bakes the whole map once with
  `buildMapGeometry`, at 5 px/m, into a canvas, then an `ImageBitmap`: terrain (`drawTerrainPlan`), ground-floor
  floors, solids, props and walls (only boxes under 1 m), and buried tunnels dashed (`drawBuriedPassages`).
  `update`/`drawWhole` draw it turned to the player's facing, with blips, and redraw only when the key changes.
  **It draws only the ground floor** (`b.max[1] < 1`), so the editor needs a level filter. `frontend/mapPlan.ts
  drawMapPlan` is the same drawing the map cards and Map properties' plan use.

**What the editor minimap can take.**
- *Projection*: `planFrame` over `planArea` with north up, and `planToScreen` for markers. The camera marker is
  `view.camera.position` (x, z) and `view.yaw`. A click calls `screenToPlan` → `view.focus` (or `plan.centre` while
  the plan view is on).
- *Layers*: a base layer (terrain, then the level's floors, solids and walls, filtered by
  `levelHeight * level ≤ y < levelHeight * (level + 1)`), tiles (`planTiles`), markers (`planMarkers`), the selection
  (outline the selected ids), and the camera. The existing Map layers (`view.hiddenLayers`) can be the minimap's layer
  toggles too.
- *Doors and windows*: draw edge styles as short marks on the cell side "where scale permits" (above roughly 3 px/m).

**Cost on dense maps.**
- `buildMapGeometry` of a whole map is the expensive part, and the editor already has it cached once per document
  version (`EditorApp.mapBoxes()`, `boxesFor`). The minimap must take the boxes from there, not build its own.
- One bake per document revision and level, at about 2–3 px/m, is fine for canvas size: St. John's terrain is 161 ×
  121 vertices, about 320 × 240 m, so at 3 px/m that is 960 × 720 px. Rebaking on every edit is not fine: 3,395
  entities, plus whatever it costs to filter the boxes by level.
- Bake after a short idle (as `Inspector.catchUp` does, `CATCH_UP_MS`), and draw the camera, the selection and the
  hover each frame over the cached bitmap. Never rebake during a drag (`app.input.drag`).
- **Measure first**: the bake time on St. John's, The Spillway (2,369 entities) and Sandfall Colosseum (436 tiles,
  181 set pieces), with `PERF_STILL=1` (QUEUE, Tileset 11's repeatable measurement).

## 8. Preferences (browser storage today)

All of these are `localStorage`, wrapped in try/catch, and none of them go in the map.

| Key | What | Where |
|---|---|---|
| `tiletrigger.editor.sidebars` | `{ pal?: bool, right?: bool }`: palette and side panel folded | `topBar.ts setupSidebars` |
| `tiletrigger.editor.panels` | Folded panels: `["outliner" \| "inspector" \| "issues"]` | `panels.ts` |
| `tiletrigger.editor.outliner.<mapId>` | Hidden and locked ids, per map | `outlinerPanel.ts` |
| `tiletrigger.editor.outliner.closed` | Folded outliner headings | `outlinerPanel.ts` |
| `tt.editor.showAllLevels` | "Show all levels" (H) | `showAllSetting.ts` |
| `tt.palette.favs`, `.recent`, `.groups`, `.quick`, `.modeOnly`, `.view` | Favourites, recent, folded palette groups, quick-row tab, This mode only, grid/cards | `palette.ts` |
| `tiletrigger.editor.clipboard` | Copy and paste between maps | `clipboardStore.ts` |
| `tiletrigger.editor.tour` | Tour done or skipped | shared `editor/tour.ts TOUR_STORE_KEY` |
| `cs.editor.autosave`, `cs.editor.drafts`, `cs.setpieces` | Drafts and My set pieces | `storage.ts` (saved maps are in IndexedDB: `localMaps.ts`) |

Not stored: Map layers (`view.hiddenLayers`), snap, the mode tab, the plan view, grid and full grid, TEST bots and
skill.

**Where dock state goes.** One new key, `tiletrigger.editor.dock`: `{ right: 'expanded' | 'compact' | 'hidden',
width: number, tab: 'minimap' | 'outliner', left: 'open' | 'rail', autoCollapse: bool, minimap: { zoom?, layers? } }`,
read and written by a small module like `panels.ts` (parse safely, sorted, defaults on error). Migrate once from
`tiletrigger.editor.sidebars` (`right: true` → `hidden`, `pal: true` → `rail`), then stop writing the old key. Keep
`panels` for the folds inside the dock. Per the spec, nothing goes into `packages/shared/src/sim/**` or the map.

## 9. Smoke-test baseline

The editor flows (`e2e/flowMap.mjs EDITOR_UX_FLOWS` and `editor`) and their check functions in `e2e/run.mjs`:

| Flow | Checks | Phase 1 controls it touches |
|---|---|---|
| `editor` | `editorFlow`, `ziplineChecks`, `dropRouteChecks` | `#ed-name`, `#ed-dirty`, `#ed-open`, `#ed-logic-btn`, `#ed-issues`, **Map properties by Esc**: thumbnail `#ed-thumb-set/-capture/-clear`, plan in `.ed-map-thumbs`, `#ed-cast` |
| `editorux` | `editoruxFlow`, `editorInterfaceChecks`, `editorTourChecks`, `editorInspectorKeepChecks`, `editorPhase1aChecks` | `#ed-modes` (every tab and its panes), `#ed-pal-tabs`, folding `.ed-panel` + `tiletrigger.editor.panels` across a reload, the outliner (`#ed-ol-*`: 4,096 rows, search, select and frame, hide, lock), favourites `#ed-pal-quick`, `#ed-toolbar` and `#ed-tb-select/place/erase/rotate/delete/keys/help`, `#ed-keys`, `#ed-toolhint`, `#ed-budget`, `#ed-target`, `#ed-bottom`, `#ed-level`, `#ed-level-up`, `#ed-mode-section`, `#ed-tp-play/here`, `#ed-test`, `#ed-test-here`, `#ed-maptest`, `#ed-skill`, `#ed-grid`, `#ed-grid-full`, Export and Import |
| `editorpieces` | set pieces (parts 1–5), ground, measure | `#ed-inspector` (set-piece inspector, Parts), `#ed-tb-measure`, `#ed-pack`, `#ed-search` |
| `editortools` | turn, workflow, part B, terrain grid, bot hints, tile options, buried pick | `#ed-plan`, `#ed-new`, `#ed-env-btn`, `#ed-grid`, ▶ Here, PLAY TEST, `#ed-hint`, **Map properties by Esc**: card shot `#ed-card-*` (workflow), notes `#ed-notes-list` (part B), `#ed-prop-*` (measure) |
| `editorenv` | bot test, environment, sky and weather | `#ed-pal-toggle`, `#ed-palette`, `#ed-right`, `#ed-plan`, `#ed-maptest`, **Map properties by Esc**: `#ed-skyweather`, `.ed-tod-preset`, `#ed-weather-*` |

Outside the editor flows, these reach Map properties by Esc too: `canyon` (`#ed-prop-also`), `traffic`
(`#ed-prop-drop-race`), `weaponsets` (`#ed-prop-weapons`) and `coverage` (`#ed-prop-testonly`). `flowMap.mjs` already
runs `canyon`, `traffic` and `weaponsets` for any change under `editor/`. **`coverage` is not mapped from
`editor/`**, so Phase 1 must add it or run it by hand. Unit tests that pin the layout: `client/test/editorModes.test.ts`
(tabs and panes against the table) and `client/test/keymap.test.ts`.

**Gaps Phase 1 must add checks for.** No e2e check touches these today:
- `#ed-status` (the pill and its click), `#ed-snap` (the setting, or placing with it), `#ed-theme` (the top-bar copy),
  `#ed-bots` (TEST bots), `#ed-overlaps`, `#ed-right-toggle` and Shift+`\`, `#ed-showall`, `#ed-level-down`,
  `#ed-reset-view`, `#ed-counts`, `#ed-save` (the button), and Undo/Redo by button.
- `#ed-tb-paint`, `#ed-tb-walls`, `#ed-tb-terrain` as buttons (their keys are used), `#ed-tp-bots`, `#ed-tp-plan`,
  `#ed-tp-problems`.
- In Map properties: Teams (`#ed-team-*`), Boundary (`#ed-bounds-*`), Blood, Gravity, Fall damage, Glass, Tier, Map
  ID, Description, Min/Max players, Players by mode, Map layers, Dress all, Settle all, `#ed-group-row`.

The new checks Phase 1 needs (in a new `editorLayoutChecks`, inside `editorux`, as `editorux` already holds the
interface checks):
1. **Every old action still works from its new place.** Click each relocated control (the list above), assert its
   effect (a toggle's `aria-pressed`, a command's undo label, a dialog opening).
2. **Map settings opens in one click** from the title and from the rail's Map entry, with the same view both times.
   Edit one field from each group and undo each.
3. **The dock's 3 states**: each is kept across a reload. Selecting with the dock hidden leaves it hidden. Selecting
   shows the viewport indicator.
4. **The empty inspector** shows the compact empty state, not map settings.
5. **Framing a picture and a card shot from inside Map settings** still works (§3).
6. **Laptop widths**: 1280 × 720 and 1440 × 900, no clipped top bar (`fitTopBar` steps) and nothing over the canvas
   with the dock hidden. Today's 900 px rule (`#ed-right` gone) needs a decision (Q7).
7. Screenshot baselines: none of the `visual` flow's baselines are of MapMaker today (its `mapmaker` page is a perf
   share), so there is nothing to regenerate.

## 10. Risks and open questions for the owner

**Risks**
- **Two sessions in the editor files.** Phase 1 touches `index.html`, `editor.css`, `topBar.ts`, `inspector.ts`,
  `mapProperties.ts`, `panels.ts` and `editorApp.ts`, which are the files the MapMaker lane's Tileset 11 and speed
  work use. Phase 1 must not start until HANDOFF and QUEUE say who builds it (spec notes, "Coordination").
- **E2E churn.** Eleven flows' selectors move in one landing (§9). Make one helper (`openMapSettings(page)`) and
  switch every flow to it first, as a commit of its own, so a red run points at the layout and not the tests.
- **Performance.** The layout and selection work runs into the 50 ms forced layout the speed branch is chasing. A
  resizable dock adds a `ResizeObserver` and a canvas resize on every drag. Throttle it, and measure with
  `PERF_STILL=1` before and after.
- **Format.** Phase 4b needs a bump that waits on the tunnel kit's v39 and is claimed in HANDOFF.
- **Plan view and the minimap are two overhead views.** Showing both at once (the plan view's clip plane is
  scene-wide) is fine, but the minimap must not draw through the main camera.

**Questions** (recommended option first)

1. **Keys for the new things.** (a) Shift+`\` cycles the right dock expanded → compact → hidden, `\` folds the left
   rail as now, Tab-free; Tile View = double-click or Enter on a selected tile, Esc back; the minimap has no key.
   (b) New letters (C for the dock, Z for Tile View). (c) No keys, buttons only.
2. **Paint on the contextual tool bar.** (a) Paint, Terrain and Environment brush only on Environment's bar, and in
   every tab's overflow. (b) Paint on every tab's bar, as the spec lists it. (c) Keep today's fixed bar of 7 tools in
   every tab.
3. **What the empty inspector shows.** (a) A compact line ("Nothing selected · Map settings…"), plus the mode's own
   section where it has one (Paths list, Test status, Gameplay counts). (b) The line only; the mode sections move into
   the palette panes. (c) Keep Map properties in the empty inspector as well as in the dialog.
4. **Map settings form.** (a) A view in the right dock (wide, scrolling, with the four sections), so the 3D view stays
   live for time-of-day previews and framing. (b) A modal dialog that hides itself while framing. (c) A full-screen
   page.
5. **The top bar's duplicates.** (a) The title opens Map settings; the theme picker and the TEST bots/skill stay on
   the top bar (bots and skill beside PLAY TEST); Grid, Full grid and Overlaps go into a View menu. (b) Remove the
   top-bar theme picker too. (c) Leave the top bar as it is in Phase 1.
6. **Selection when the level changes.** (a) Keep it, and show "2 selected on other levels" in the status bar.
   (b) Clear it on a level change. (c) Keep it silently, as today.
7. **Small windows.** (a) Under 900 px the dock starts compact (minimap only), not gone. (b) Keep today's rule: the
   side panel disappears under 900 px. (c) Hidden under 900 px.
8. **Tile View's focus on maps with no tiles** (St. John's, Apex Ring and 12 others). (a) A tile, a set piece or a
   group can be focused, with a box region as the fallback. (b) Tiles and set pieces only. (c) Tiles only, as the
   spec's wording.
9. **Phase 4b (set-piece overrides).** (a) Leave it parked until Phase 4a is used. Then a stable `key` per part, a
   migration from the index-based `hide`, after v39. (b) Do it with 4a. (c) Never: Explode to tiles is the way to
   edit parts.
10. **Who builds Phase 1.** (a) The MapMaker lane, after Tileset 11 and the speed branch land, with this account
    reviewing. (b) This account, while the MapMaker lane holds off the editor files. (c) Split it: this account does
    Map settings and the dock, the MapMaker lane does the tool bar and status bar, one after the other.

## Baseline screenshots

Taken 2026-11-14 from a local build of main at 45ff59c4 (vite preview, Chromium with SwiftShader, 1440 × 900), in
the session's scratchpad (`mm-audit/`), not committed:

Each is Flatpack Depot (240 tiles, 1,045 entities, imported through Import).
1. `1-build-nothing-selected.png`: the Build tab with nothing selected.
   - The top bar is already squeezed at 1440 px: the name reads "Flatpack De", "Snap 50 c" and "Norm" are cut off,
     and the mode tabs are at their shortest.
   - The tool bar has 11 buttons and the tool hint runs past its row.
   - The level strip lists Level 1–4 with counts.
   - The status bar holds the counts, the budget pill ("Near: Models 79 / 80") and the permanent keys line, cut off at
     the right.
   - The side panel shows the Outliner (Tiles 240, Ground 195) above an Inspector that is Map properties: picture and
     plan, Set thumbnail, Card shot, Notes, Name, Theme.
2. `2-tile-selected.png`: a Room selected (yellow outline, gizmo, rotate ring).
   - The side panel has scrolled as a whole, so the Outliner is off the top.
   - The inspector shows Replace all with a set piece, Type (its select overflows the panel), X, Y, Level, Rotation,
     the quick facings, Walls (one select per side, plus the glass select for the window), and Room options (Layout,
     Floor, Ceiling, Corners, Facade, with a note), then Dress room.
3. `3-map-properties.png`: the Inspector scrolled to Map properties.
   - Picture and plan, Card shot, Notes, Name, Theme.
   - Size "15 × 13 cells · 2 levels" counts tiles only: the level strip shows content up to Level 4.
   - Min and Max players, Mode with its long help text, Also offered, Teams.
4. `4-plan-view.png`: the plan view (K) of the ground level: orthographic, tile grid, team-coloured spawn arrows,
   pickups and objective markers, the plan bar (Plan · Ground, Export PNG, Back to 3D (K)). The palette, tool bar,
   level strip and side panel stay over it, as in 3D.
