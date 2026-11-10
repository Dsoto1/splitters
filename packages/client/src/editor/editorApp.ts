import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  EditHistory,
  playFromHereSpot,
  blockBoxes,
  propBoxes,
  BOT_CAST_CHOICES,
  BOT_CAST_MAX,
  CHARACTER_GROUPS,
  botCastLabel,
  castLooks,
  validBotCast,
  mapWeaponSet,
  weaponSetList,
  getWeaponSet,
  terrainUnderFloors,
  withPathsLaid,
  addSpawnCommand,
  buildMapGeometry,
  tileGhostCheck,
  checkNote,
  entityGhostNote,
  ghostRefuses,
  zoneNote as zoneGhostNote,
  type GhostNote,
  type GhostEntityKind,
  type PlacementCheck,
  BudgetTracker,
  budgetCulprits,
  FLY_KEYS,
  FLY_PAUSE_KEYS,
  FREE_PLACE_KEYS,
  FREE_MEASURE_KEYS,
  matchEditorKey,
  type KeyAction,
  BUILD_LEVELS,
  buildZone,
  levelName,
  placeTileCommand,
  setUpperFloorsCommand,
  upperFloorLevels,
  coreCatalog,
  isTileOptionTwin,
  deleteCommand,
  duplicateCommand,
  emptySelection,
  loadMap,
  moveCommand,
  moveEntitiesCommand,
  settlePropsCommand,
  replacePropsCommand,
  type ReplaceSize,
  settledPropY,
  newId,
  newMapDocument,
  normalizeYaw,
  paintCommand,
  resolveSurface,
  faceSlot,
  rotateCommand,
  yawStep,
  setThemeCommand,
  coreMaterials,
  coreThemes,
  CORE_ITEMS,
  WEAPON_CATEGORIES,
  WEAPON_CATEGORY_LABELS,
  categoryItems,
  isWeaponCategory,
  itemCategory,
  DESTRUCTIBLE_MODELS,
  DESTRUCTIBLE_SPECS,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  rosterSize,
  SQUAD_ORDERS,
  ENCOUNTER_ENTRANCES,
  type EncounterEntrance,
  mapFactions,
  mapTeams,
  botSetLabel,
  mapBotSet,
  type MapBotSet,
  playableModes,
  setupFamily,
  mapPlayerCaps,
  autoPlayerCaps,
  isTeamMode,
  MODE_LABELS,
  hasRemovedMode,
  withMainMode,
  SCENARIO_PALETTE,
  STYLE_PACKS,
  getStylePack,
  stylePackHas,
  type StylePack,
  DOOR_STYLES,
  DOOR_STYLE_LABELS,
  LADDER_STYLES,
  LADDER_STYLE_LABELS,
  type LadderStyle,
  type DoorStyle,
  TRAP_ACTIVATIONS,
  TRAP_KINDS,
  TRAP_SPECS,
  entityLabel,
  BREAKTHROUGH_MAX_SECTORS,
  BREAKTHROUGH_OBJECTIVES,
  BREAKTHROUGH_OBJECTIVE_LABELS,
  sectorOrders,
  type ObjectiveEntity,
  newScenarioEntities,
  MOVER_MODES,
  type MoverMode,
  snapToDoorway,
  snapsToDoorway,
  getItem,
  SURFACE_SLOTS,
  SURFACE_SLOT_LABELS,
  TINT_SWATCHES,
  tileAt,
  updateTileCommand,
  validateMap,
  coplanarIssues,
  coplanarSpots,
  type CoplanarSpot,
  type EditCommand,
  type MapDocument,
  type TilePlacement,
  type MapEntity,
  type ScenarioPaletteKey,
  type PaintScope,
  type SurfaceSlot,
  type SurfaceStyle,
  type WorldBox,
  type Rotation,
  type Selection,
  type TileDefinition,
  type ValidationIssue,
  type Vec3,
  type BotHintKind,
  EDGE_STYLES,
  EDGE_STYLE_LABELS,
  CEILINGS,
  CEILING_LABELS,
  CORNERS,
  CORNER_LABELS,
  FACADES,
  FACADE_LABELS,
  FLOOR_INSERTS,
  FLOOR_INSERT_LABELS,
  ROOM_LAYOUTS,
  ROOM_LAYOUT_LABELS,
  type RoomOptions,
  DRESS_DENSITIES,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  buildOccupancy,
  dressRoom,
  dressSpace,
  guessRoomType,
  modelBudget,
  roomCells,
  seededRandom,
  type DressDensity,
  type RoomType,
  SIDES,
  TILE_CATEGORIES,
  edgeChoiceAt,
  edgeSegments,
  edgeTargetAt,
  setEdgeCommand,
  setEdgeGlassCommand,
  applyCommand,
  edgeGlassAt,
  GLASS_EDGES,
  GLASS_KINDS,
  GLASS_KIND_LABELS,
  type GlassKind,
  type EdgeStyle,
  type EdgeTarget,
  CORE_PROPS,
  type PropDefinition,
  PROP_CATEGORIES,
  getProp,
  placementCells,
  TERRAIN_BRUSHES,
  BLOCK_BEHAVIOURS,
  LIQUIDS,
  LIQUID_SPECS,
  ENV_SPECIES,
  getEnvSpecies,
  BACKDROP_GROUNDS,
  SCENERY_IDS,
  SCENERY_LABELS,
  SKIES,
  SKY_IDS,
  resolveBackdrop,
  BORDER_LABELS,
  BORDER_SIDES,
  BORDER_STYLES,
  ELECTRIC_FENCE,
  borderRect,
  hasBorder,
  type BorderStyle,
  type Backdrop,
  BLOOD_AMOUNTS,
  DEFAULT_BLOOD,
  type BloodSettings,
  type MapPhysics,
  type BackdropGround,
  type SceneryId,
  type SkyId,
  FOLIAGE_LEVELS,
  TERRAIN_MATERIALS,
  TERRAIN_MATERIAL_LABELS,
  TERRAIN_SURFACES,
  terrainMaterialFor,
  applyBrush,
  initPhysics,
  mapPads,
  padLandings,
  fitBounds,
  CORE_WEAPONS,
  MOUNT_DEFS,
  MOUNT_MODELS,
  type MountModel,
  MOUNT_SKINS,
  FLOAT,
  MOUNT_SKIN_LABELS,
  type MountSkin,
  AIRDROP_MODES,
  AIR_CRAFTS,
  AIR_CRAFT_LABELS,
  type AirCraft,
  type AirdropMode,
  MAX_TEAMS,
  PLAYER,
  TEAM_PRESETS,
  teamLayoutLabel,
  type BoundaryStyle,
  newTerrain,
  terrainSpacingFor,
  paintSlopes,
  blockBox,
  boxFootprint,
  smoothTerrain,
  terrainHoldMask,
  terrainHeightAt,
  terrainRaycast,
  type TerrainBrush,
  type TerrainData,
  type TerrainMaterial,
  NPC_PALETTE,
  placeNpcCommand,
  type LightFixture,
  isRetiredMap,
  moverGroupOf,
  withMoverGroups,
  withGroups,
  withGroupsTidied,
  withCopiedGroups,
  groupCommand,
  ungroupCommand,
  groupOf,
  groupName,
  selectionGroup,
  flipCommand,
  selectionMiddle,
  copySelection,
  pasteCommand,
  pasteNote,
  cutGroundToFloorsCommand,
  clipboardCount,
  addSetPieceDefCommand,
  replaceTilesWithSetPieceCommand,
  builtInSetPieces,
  checkSetPieceDefinition,
  checkSetPiecePlacement,
  envModelFile,
  expandSetPieces,
  explodeSetPieceCommand,
  mirrorSetPieceCommand,
  piecesFor,
  placeSetPieceCommand,
  placementPack,
  setPieceFootprint,
  setPieceFromSelection,
  setPieceMirrorRefusal,
  setPieceParts,
  setPiecePortStates,
  updateSetPieceCommand,
  SET_PIECE_MATERIAL_ROLES,
  type SetPieceDefinition,
  type SetPieceLibrary,
  type SetPiecePlacement,
  type SetPieceRole,
  type SetPieceExpansion,
  propDrop,
  ringStep,
  setFacingCommand,
  snapMeasurePoint,
  turnByCommand,
  turnLabel,
  type MeasurePoint,
  surfaceHit,
} from '@tiletrigger/shared';
import { MAP_INDEX, isBuiltInMap, loadBuiltInMap } from '../mapIndex.ts';
import { EditorView, type PieceOutline, type TraceImage } from './editorView.ts';
import { LIQUID_LOOKS } from '../game/scenarioVisuals.ts';
import {
  clearDraft,
  deleteFromLibrary,
  deleteSetPiece,
  exportMap,
  exportSetPiece,
  importMapFile,
  importSetPieceFile,
  inLibrary,
  listDrafts,
  listLibrary,
  listSetPieces,
  openFromLibrary,
  saveSetPiece,
  saveToLibrary,
  writeDraft,
} from './storage.ts';
import { tileIcon } from './tileIcon.ts';
import { raycastBoxes, type BoxHit } from './raycast.ts';
import { BudgetBar } from './budgetBar.ts';
import { KeyOverlay } from './keyOverlay.ts';
import { MeasureTool } from './measureTool.ts';
import { MapTestPanel } from './mapTestPanel.ts';
import { RotateRing } from './rotateRing.ts';
import { quickFacings } from './quickFacings.ts';
import { isRetiredTile, replaceTilePanel } from './retiredTiles.ts';
import { tileOptionPanel } from './tileOptionPanel.ts';
import { PropPlaceOptions } from './propPlaceOptions.ts';
import { SurfaceBoxes } from './surfaceBoxes.ts';
import { testMode } from '../testMode.ts';
import { materialThumbnail } from '../materials/patterns.ts';
import { itemColor } from '../game/pickupVisuals.ts';
import { LogicPanel } from './logicPanel.ts';
import { removedModesRow } from './removedModes.ts';
import { PathTool, pathLabel, type PathKind } from './pathTool.ts';
import { EnvTools } from './envTools.ts';
import { RouteTool } from './routeTool.ts';
import { ModelThumbnails } from '../frontend/modelThumbs.ts';
import { Palette } from './palette.ts';
import { PaletteAtlas } from './paletteAtlas.ts';
import {
  GROUND_COVER_IDS,
  NATURE_PROP_CATEGORIES,
  PROP_GROUPS,
  REPLACEMENTS,
  RETIRED_PROPS,
  propGroup,
  scenarioGroup,
  setPieceFamilyLabel,
  setPieceFamilyOrder,
  setPieceSuitsStylePack,
  stylePackRoles,
} from './paletteCatalog.ts';
import { envRendererOn } from '../environment/envFlag.ts';
import { thumbnailSection, type ThumbHost } from './makerThumb.ts';
import { PlanView } from './planView.ts';
import { cardShotSection, type CardShotHost } from './cardShot.ts';
import { skyWeatherSection, type SkyWeatherHost } from './skyWeatherSection.ts';
import { NoteTool } from './noteTool.ts';
import { BotHintTool } from './botHintTool.ts';
import { groupSection, type GroupHost } from './groupPanel.ts';
import { rebuildKeepingEdit } from './inspectorKeep.ts';
import { openMirrorDialog } from './mirrorDialog.ts';
import { openChangeGridDialog } from './changeGridDialog.ts';
import { readClipboard, writeClipboard } from './clipboardStore.ts';
import { templatePicker } from './templatePicker.ts';
import { libraryThumb } from './libraryThumbs.ts';
import { isOwner, openPublishDialog } from './ownerPublish.ts';
import { DEFAULT_HEIGHT_GRID_SMOOTHING, HEIGHT_GRID_SMOOTHING, MAX_HEIGHT_GRID_BYTES, parseAsciiGrid, terrainFromHeightGrid } from './heightGrid.ts';
import { publishedMaps } from '../publishedMaps.ts';
import { botManager } from '../frontend/botManager.ts';
import { BOT_SET_PRESETS } from '../playlists.ts';
import { $, isTyping, button, h2, text, small, row, numberInput, escapeHtml } from './editorDom.ts';
import { SHIPPED_IDS, itemIcon, CARD_HIDDEN_KINDS, STARTER_TERRAIN, NEW_MAP_SIZES, mainGround, fitTopBar, starterMap, PIECE_PART_KINDS, ROLE_LABELS, rolesUsed, SCENARIO_ICONS, PLACING, toolKey, TOOL_ICONS, npcIcon, pickRadius, FLY_SPEED, LOOK_SENSITIVITY, snap, dressable, dressTag, edgeIcon, addedEntities, type Tool, type Hit, type DragState } from './editorParts.ts';
import { TerrainTools } from './terrainTools.ts';
import { SetPieceTools } from './setPieceTools.ts';
import { PaletteBuilder } from './paletteBuilder.ts';
import { TopBar } from './topBar.ts';
import { MapProperties } from './mapProperties.ts';
import { EntityInspector } from './entityInspector.ts';
import { Inspector } from './inspector.ts';
import { MapChecks } from './mapChecks.ts';
import { MapSaving } from './mapSaving.ts';
import { PaintTools } from './paintTools.ts';
import { Placing } from './placing.ts';
import { SelectionEdits } from './selectionEdits.ts';
import { Hover } from './hover.ts';
import { EditorInput } from './editorInput.ts';

export interface TestRequest {
  map: MapDocument;
  botFill: number;
  difficulty: 'easy' | 'normal' | 'hard';
  /** Play from here: you start at this spot (feet), facing this way, not at a spawn point. */
  startAt?: { pos: [number, number, number]; yaw: number; pitch: number };
}

export interface EditorHost {
  engine: AbstractEngine;
  canvas: HTMLCanvasElement;
  startTest(req: TestRequest): void;
  goHome(): void;
}

/**
 * MapMaker controller: owns the edit history, tools, selection and the
 * editor UI. Every document change goes through EditHistory, so it is
 * undoable, kept as a draft while unsaved, and revalidated. MapMaker always
 * opens on a blank starter map (startFresh); saved maps, drafts and
 * templates are loaded on purpose from Open….
 */
export class EditorApp {
  /** MapMaker's input: the pointer on the view (pick, drag, box select, brushes, fly-look), right-click and its menu, and the keys through the key table (keymap.ts) (editorInput.ts). */
  readonly input: EditorInput;
  /** What's under the pointer: the pointer's ray onto the level, the ground and surfaces, picking, the hover card and status line, and the placing ghosts with why one is refused (hover.ts). */
  readonly hover: Hover;
  /** Edits to the selection: turn, nudge, delete, duplicate, group and ungroup, copy and paste, mirror and flip, cut the ground to the floors and settle props on the ground (selectionEdits.ts). */
  readonly edits: SelectionEdits;
  /** Placing and erasing: where each kind of thing lands under the pointer (snapped, on the ground, in a doorway, on a surface), what the placing tools' ghosts show, and Erase (placing.ts). */
  readonly placing: Placing;
  /** The Paint and Walls tools: painting surfaces and the ground, building a cell side as a wall, door or window with its glass, and picking a style up (paintTools.ts). */
  readonly paint: PaintTools;
  /** Saving and loading the map: drafts kept while unsaved, Save, Quit, New, Open… and replacing the document being edited (mapSaving.ts). */
  readonly saving: MapSaving;
  /** The map's checks: validation, navigation and the bots' own spots worked out a moment after each edit, coplanar overlaps, and the issues list and status pill (mapChecks.ts). */
  readonly checks: MapChecks;
  /** The side panel's inspector: what's selected (a tile, a set piece, an entity, a moving build, several things) or Map properties with nothing selected; the tile's walls, room options, upper floors, dressing and surfaces (inspector.ts). */
  readonly inspector: Inspector;
  /** The inspector for one entity: spawns, pickups, props, doors, lights, movers, triggers, traps, NPC squads, vehicles, objectives and the rest (entityInspector.ts). */
  readonly entityPane: EntityInspector;
  /** Map properties, the inspector with nothing selected: name, theme, players, modes, teams, weapons, bots, time and weather, layers, blood, physics, the boundary, and Environment → Sky's backdrop (mapProperties.ts). */
  readonly mapProps: MapProperties;
  /** The top bar and the tool bar: file buttons, workspace tabs, levels, grid, overlaps, snap, theme, the counts line, and folding the side panels (topBar.ts). */
  readonly topBar: TopBar;
  /** The palette's contents: every tab's cards (tiles, walls, gameplay, pickups, props, vehicles, paint, NPCs, paths, real places), the Style Pack picker and the palette's pictures (paletteBuilder.ts). */
  readonly palettes: PaletteBuilder;
  /** Set pieces: placing them (the ghost, its ports, the look), the Set pieces palette and the player's own pieces, saving a selection as a piece, exploding one and the set piece inspector (setPieceTools.ts). */
  readonly pieces: SetPieceTools;
  /** The Terrain tool: its brush, live sculpting strokes, whole-map smoothing, the trace image and the Terrain palette (terrainTools.ts). */
  readonly terrain: TerrainTools;
  readonly view: EditorView;
  readonly history: EditHistory;
  tool: Tool = { kind: 'select' };
  rotation: Rotation = 0;
  /** The shipped set pieces and role packs. MapMaker's document keeps placements; it draws them expanded (viewDoc). */
  readonly setPieceLib: SetPieceLibrary = builtInSetPieces();
  /** The set piece tool: mirrored (M), and the look it places in (a role pack id; '' the map theme's). */
  pieceMirror = false;
  /** What the set piece tool's ghost shows now: the placement it would make, whether it fits (and why not), its ports. */
  pieceHover: { def: SetPieceDefinition; placement: SetPiecePlacement; ok: boolean; reason: string; short: string; blocked: number } | null = null;
  /** Facing for the next prop placed. */
  propYaw = 0;
  readonly thumbs: ModelThumbnails;
  /** The palette's prebuilt pictures (public/thumbs) and its behaviour (groups, search, favourites, keys). */
  readonly paletteAtlas = new PaletteAtlas();
  palette!: Palette;
  showPane: (pane: string) => void = () => {};
  /** Palette workspace: build, entities or environment. */
  paletteWs = 'build';
  spawnYaw = 0;
  scenarioYaw = 0;
  readonly logic: LogicPanel;
  /** The Road tool (roads, the track for NPC traffic, routes). */
  readonly paths: PathTool;
  /** Mover and plane routes, drawn on the map with the Paths tool's hands. */
  readonly routes: RouteTool;
  /** The live budget bar and its counters (MapMaker overhaul Phase 1 item 2). */
  private readonly budgets: BudgetTracker;
  private readonly budgetBar: BudgetBar;
  /** The measure tool (U): its points and labels, editor-only. */
  readonly measure: MeasureTool;
  /** The top bar's Bot test (overhaul Phase 4): a bot test run's heatmaps and spawn exposure, in a worker. */
  readonly mapTest: MapTestPanel;
  /** Environment Phase 3: the Environment group, its brush and the collision preview (envTools.ts). */
  readonly env: EnvTools;
  /** Note pins (J; noteTool.ts): notes for the map's makers, drawn over the view. */
  readonly notes: NoteTool;
  /** Bot hints (Y; botHintTool.ts, MapMaker overhaul Phase 4 item 3): drawn over the view, edited in the inspector. */
  readonly hints: BotHintTool;
  lastHint: BotHintKind = 'choke';
  /** The prop tool's placing options: Randomise. */
  readonly propOpts: PropPlaceOptions;
  /** What props and the measure tool land on, per document version and view. */
  readonly surfaces = new SurfaceBoxes();
  /** The rotate ring on the selection gizmo: drag to turn (MapMaker overhaul Phase 3 item 9). */
  readonly ring: RotateRing;
  /** The plan view (K): the level from straight above (MapMaker overhaul Phase 3 item 2). */
  readonly plan: PlanView;
  level = 0;
  showAll = false;
  /** The last placing tool, so the toolbar's Place button can pick it up again. */
  private lastPlace: Tool | null = null;
  /** Top bar Snap: 'normal' keeps each tool's own step (50 cm, props 25 cm). */
  snapMode: 'fine' | 'normal' | 'coarse' | 'off' = 'normal';
  snapStep(normal: number): number {
    if (this.freePlacing()) return 0.01;
    return { fine: 0.25, normal, coarse: 1, off: 0.01 }[this.snapMode];
  }

  /** One placement rule for every kind: hold Ctrl (or Shift) to place without snapping. */
  freePlacing(): boolean {
    return FREE_PLACE_KEYS.some((k) => this.keys.has(k));
  }
  /** Last pointer position over the view, for the hover card. */
  pointerAt: { x: number; y: number } | null = null;
  /** Pointer ray, for picking what is under the cursor. */
  ray: { origin: Vec3; dir: Vec3 } | null = null;
  selection: Selection = emptySelection();
  hoverPoint: Vec3 | null = null;
  /** The hover point is on the terrain (nearer than the level plane). */
  hoverOnTerrain = false;
  hoverCell: [number, number, number] | null = null;
  looking: { x: number; y: number; moved: boolean; travel: number; button: number } | null = null;
  keys = new Set<string>();
  issues: ValidationIssue[] = [];
  private renderedRevision = -1;
  private renderedLevel = -1;
  private renderedShowAll = false;
  private toastTimer?: number;
  active = false;
  /** Boxes currently shown (respecting floor isolation), for surface picking. */
  visibleBoxes: WorldBox[] = [];
  hoverFace: BoxHit | null = null;
  /** Paint tool: the terrain under the pointer when it, not a surface, is what a click paints. */
  paintGround: Vec3 | null = null;

  constructor(readonly host: EditorHost) {
    this.input = new EditorInput(this);
    this.hover = new Hover(this);
    this.edits = new SelectionEdits(this);
    this.placing = new Placing(this);
    this.paint = new PaintTools(this);
    this.saving = new MapSaving(this);
    this.checks = new MapChecks(this);
    this.inspector = new Inspector(this);
    this.entityPane = new EntityInspector(this);
    this.mapProps = new MapProperties(this);
    this.topBar = new TopBar(this);
    this.palettes = new PaletteBuilder(this);
    this.pieces = new SetPieceTools(this);
    this.terrain = new TerrainTools(this);
    this.view = new EditorView(host.engine);
    this.thumbs = new ModelThumbnails(host.engine);
    this.paths = new PathTool({
      doc: () => this.doc,
      run: (label, cmd) => this.run(label, cmd),
      toast: (t, bad) => this.toast(t, bad),
      scene: this.view.scene,
      ground: () => this.view.ground,
      screen: (p) => this.view.projectInView(p),
      pointer: () => this.pointerAt,
    });
    this.routes = new RouteTool({ doc: () => this.doc, run: (label, cmd) => this.run(label, cmd), toast: (t, bad) => this.toast(t, bad), scene: this.view.scene });
    this.measure = new MeasureTool({ scene: this.view.scene, project: (p) => this.view.projectInView(p), overlay: $('editor'), world: () => ({ boxes: this.placing.surfaceBoxes(), ground: this.shownGround }) });
    this.mapTest = new MapTestPanel({ doc: () => this.doc, played: () => {
        const r = loadMap(this.doc);
        return r.ok ? r.map : this.doc;
      }, errors: () => this.checks.allIssues().filter((i) => i.severity === 'error').length, issuesChanged: () => this.checks.renderIssues(), toast: (t, bad) => this.toast(t, bad), root: $('editor'), overlay: { scene: this.view.scene, project: (p) => this.view.projectInView(p), overlay: $('editor') } });
    this.env = new EnvTools({
      doc: () => this.doc,
      run: (label, cmd) => this.run(label, cmd),
      ground: () => this.shownGround,
      floorY: () => this.level * this.doc.classicStructure.levelHeight,
      scene: () => this.view.scene,
      budgets: () => this.budgets.counts,
      radius: () => this.terrain.brushRadius,
      setRadius: (r) => this.terrain.setBrushRadius(r),
      toast: (t, bad) => this.toast(t, bad),
      useBrush: () => this.setTool({ kind: 'envbrush' }),
      group: (c, id, title, opts) => this.palette.group(c, id, title, opts),
      heading: (g, t) => this.palette.heading(g, t),
      propCard: (g, def, tags, picture) => this.palettes.propButton(g, def, tags, picture),
      register: (el, key, name, tags) => this.palette.register(el, { key, name, tags }),
    });
    this.notes = new NoteTool({
      doc: () => this.doc,
      run: (label, cmd) => this.run(label, cmd),
      toast: (t, bad) => this.toast(t, bad),
      project: (p) => this.view.projectInView(p),
      pointAt: (x, y) => {
        this.hover.updatePointer(x, y);
        return this.hoverPoint;
      },
      focus: (p) => (this.plan.on ? this.plan.centre(p.x, p.z) : this.view.focus(p)),
      tool: () => this.tool.kind === 'note',
      pickTool: () => this.setTool({ kind: 'note' }),
      shown: (y) => this.showAll || y < (this.level + 1) * this.doc.classicStructure.levelHeight - 0.01,
      overlay: $('editor'),
    });
    this.hints = new BotHintTool({
      doc: () => this.doc,
      run: (label, cmd) => this.run(label, cmd),
      toast: (t, bad) => this.toast(t, bad),
      project: (p) => this.view.projectInView(p),
      pointAt: (x, y) => {
        this.hover.updatePointer(x, y);
        return this.placing.hintPointAtHover();
      },
      focus: (p) => (this.plan.on ? this.plan.centre(p.x, p.z) : this.view.focus(p)),
      tool: () => (this.tool.kind === 'bothint' ? this.tool.hint : null),
      pickTool: (hint) => this.setTool({ kind: 'bothint', hint }),
      shown: (y) => this.showAll || y < (this.level + 1) * this.doc.classicStructure.levelHeight - 0.01,
      lookYaw: () => this.view.yaw,
      viewRect: () => {
        // Between the palette, the top bar and the right panel (each counts only while it is shown).
        const box = (id: string) => {
          const r = document.getElementById(id)?.getBoundingClientRect();
          return r && r.width > 0 && r.height > 0 ? r : null;
        };
        const pal = box('ed-palette');
        const top = box('ed-top');
        const right = box('ed-right');
        return { left: pal?.right ?? 0, top: top?.bottom ?? 0, right: right?.left ?? innerWidth, bottom: innerHeight };
      },
      teams: () => mapTeams(this.doc),
      picked: () => {
        if (this.hints.selected() && this.selCount()) this.setSelection(emptySelection(), true, true);
        this.inspector.renderInspector();
      },
      wantComputed: () => this.checks.validate(),
      overlay: $('editor'),
    });
    this.ring = new RotateRing(
      {
        center: () => (this.selCount() ? this.selectionCenter() : null),
        radius: () => this.ringRadius(),
        step: (fine) => ringStep(this.doc, this.selection, fine),
        project: (p) => this.view.projectInView(p),
        onPlane: (y) => (this.pointerAt ? this.view.pickPlane(this.pointerAt.x, this.pointerAt.y, y) : null),
        preview: (turn) => this.previewTurn(turn),
        commit: (turn) => this.run(`Turn ${turnLabel(turn)}`, turnByCommand(this.doc, this.selection, turn, coreCatalog, this.placeLib)),
        draw: (r) => this.view.setRing(r ? this.selectionCenter() : null, r),
      },
      $('editor'),
    );
    this.plan = new PlanView({
      view: this.view,
      doc: () => this.viewDoc,
      level: () => this.level,
      ground: () => this.shownGround,
      selected: () => new Set([...this.selection.tiles, ...this.selection.entities, ...this.selPieces()]),
      showAll: () => this.showAll,
      setShowAll: (on) => this.setShowAll(on, true),
      toast: (t, bad) => this.toast(t, bad),
      changed: (on) => {
        const b = $('ed-plan');
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        this.hover.updateHover();
      },
    });
    this.propOpts = new PropPlaceOptions(testMode()?.seed ?? Math.floor(Math.random() * 2 ** 31), () => this.hover.updateHover());
    // The top bar steps through its compact layouts until it fits, whenever its width or contents change.
    const top = $('ed-top');
    new ResizeObserver(() => fitTopBar(top)).observe(top);
    new MutationObserver(() => fitTopBar(top)).observe($('ed-status'), { childList: true, characterData: true, subtree: true });
    void document.fonts?.ready.then(() => fitTopBar(top));
    this.history = new EditHistory(starterMap(STARTER_TERRAIN, 'grass'));
    // The live budget bar: counters kept from each edit (budgetCounters.ts), drawn when the document changes.
    this.budgets = new BudgetTracker(this.history.doc, this.setPieceLib);
    this.history.onChange = (c) => (c.reset ? this.budgets.reset(c.reset) : this.budgets.apply(c.command, c.doc));
    this.budgetBar = new BudgetBar($('ed-bottom'), (id, row) => {
      const ids = budgetCulprits(this.doc, id);
      if (!ids.length) return this.toast(`Nothing to select for ${row.label.toLowerCase()}${this.doc.setPieces?.length ? ' (set pieces count as their parts: select the set pieces themselves)' : ''}`, true);
      this.setTool({ kind: 'select' });
      this.setSelection({ tiles: [], entities: ids });
      this.toast(`Selected ${ids.length} counted as ${row.label.toLowerCase()} (${row.what})`);
    }, $('ed-target'));
    this.logic = new LogicPanel({
      doc: () => this.doc,
      commit: (label, after) => this.run(label, { kind: 'setLogic', before: this.doc.logic, after }),
      commitFactions: (label, after) => this.run(label, { kind: 'setFactions', before: this.doc.factions, after }),
      focusEntity: (id) => this.focusEntity(id),
      openChanged: () => this.topBar.syncWorkspaceTabs(),
    });
    this.palettes.buildPalette();
    this.topBar.bindUi();
    this.input.bindInput();
    this.view.focus({ x: 0, y: 0, z: 0 });
    $('ed-reset-view').addEventListener('click', () => this.resetView());
    // Closing the tab mid-edit: keep the pending draft.
    window.addEventListener('pagehide', () => this.saving.autosaveTimer !== undefined && this.saving.flushDraft());
  }

  /**
   * Entering MapMaker from the menu: a blank starter map, like New. Unsaved
   * work from before stays in Open… as a draft rather than being restored.
   */
  startFresh(): void {
    if (this.saving.autosaveTimer !== undefined) this.saving.flushDraft();
    this.saving.replaceDocument(starterMap(STARTER_TERRAIN, 'grass'));
    const drafts = listDrafts().length;
    this.toast(drafts ? `New blank map · ${drafts} unsaved draft${drafts > 1 ? 's' : ''} in Open…` : 'New blank map · Open… loads a saved map or template');
  }

  get doc(): MapDocument {
    return this.history.doc;
  }

  // ---------------------------------------------------------------- set pieces: the document as drawn

  /** The document's set pieces expanded into their parts (pure, cached per document version: map/setPieces.ts). */
  get expansion(): SetPieceExpansion {
    return expandSetPieces(this.doc, this.setPieceLib);
  }

  /** The document as MapMaker draws, picks and checks it: its set pieces expanded (the document keeps the placements). */
  get viewDoc(): MapDocument {
    return this.expansion.map;
  }

  /** The map's collision boxes as played (set pieces expanded), worked out once per document version. */
  private boxesFor: { doc: MapDocument; boxes: WorldBox[] } | null = null;

  mapBoxes(): WorldBox[] {
    const doc = this.viewDoc;
    if (this.boxesFor?.doc !== doc) this.boxesFor = { doc, boxes: buildMapGeometry(doc) };
    return this.boxesFor.boxes;
  }

  /**
   * The ground as MapMaker shows it and the pointer meets it: the document's own ground (which MapMaker changes only
   * by sculpting) with the paths laid in and kept under every floor (EditorView.setMap, as loading plays it), or a
   * brush stroke's while one is dragged.
   */
  get shownGround(): TerrainData | null {
    return this.terrain.stroke?.shown ?? this.view.ground;
  }

  /** `terrain` as it would be shown: kept under the map's floors, with the paths laid in first unless `laid` is false (a brush's live preview). */
  groundShownFor(terrain: TerrainData, laid = true): TerrainData {
    const doc = { ...this.viewDoc, terrain };
    return terrainUnderFloors(laid ? withPathsLaid(doc) : doc, this.mapBoxes())!;
  }

  get placeLib(): SetPieceLibrary {
    if (!this.pieces.myPieces.size) return this.setPieceLib;
    if (this.pieces.placeLibCache?.rev !== this.pieces.myPiecesRev) this.pieces.placeLibCache = { rev: this.pieces.myPiecesRev, lib: { pieces: new Map([...this.setPieceLib.pieces, ...this.pieces.myPieces]), packs: this.setPieceLib.packs } };
    return this.pieces.placeLibCache.lib;
  }

  /** A set piece's definition: shipped, the map's own, or the player's. */
  pieceDef(id: string): SetPieceDefinition | undefined {
    return piecesFor(this.doc, this.setPieceLib).get(id) ?? this.pieces.myPieces.get(id);
  }

  placementOf(id: string): SetPiecePlacement | undefined {
    return this.doc.setPieces?.find((p) => p.id === id);
  }

  selPieces(): string[] {
    return this.selection.setPieces ?? [];
  }

  /** Everything selected: tiles, entities and set pieces. */
  selCount(): number {
    return this.selection.tiles.length + this.selection.entities.length + this.selPieces().length;
  }

  show(): void {
    this.active = true;
    $('editor').hidden = false;
    this.refresh(true);
    // The owner (signed in, and listed on the hub) edits our maps as they are and publishes them.
    void isOwner().then((owner) => this.setOwner(owner));
  }

  /** Show or hide the owner's tools: Publish, and Terrain → Real places (height grid files, trace image). */
  setOwner(owner: boolean): void {
    this.owner = owner;
    $('ed-publish').hidden = !owner;
    for (const el of document.querySelectorAll<HTMLElement>('.ed-owner-only')) el.hidden = !owner;
    if (!owner) this.terrain.setTrace(null);
  }

  /** Signed in as an owner of the game (ownerPublish.ts): official maps open as they are, and Publish shows. */
  owner = false;

  hide(): void {
    this.active = false;
    this.keys.clear();
    this.input.drag = null;
    this.looking = null;
    $('editor').hidden = true;
  }

  // ---------------------------------------------------------------- frame

  frame(dt: number): void {
    if (!this.active) return;
    const typing = isTyping();
    // The fly camera's held keys come from the key table (keymap.ts), as the `?` overlay lists them.
    if (!typing && !FLY_PAUSE_KEYS.some((c) => this.keys.has(c))) {
      const k = (c: string) => (this.keys.has(c) ? 1 : 0);
      const speed = FLY_SPEED * (this.keys.has(FLY_KEYS.fast) ? 3 : 1) * dt;
      const f = k(FLY_KEYS.forward) - k(FLY_KEYS.back);
      const r = k(FLY_KEYS.right) - k(FLY_KEYS.left);
      const u = k(FLY_KEYS.up) - k(FLY_KEYS.down);
      if (this.plan.on) (f || r) && this.plan.move(r * speed, f * speed);
      else if (f || r || u) this.view.fly(f * speed, r * speed, u * speed);
    }
    if (this.terrain.stroke) this.terrain.strokeStep(dt);
    this.refresh(false);
    this.measure.frame();
    this.mapTest.frame();
    this.notes.frame();
    this.hints.frame();
    this.plan.update();
    this.view.render();
  }

  /** Bring meshes and panels up to date with the document and view settings. */
  refresh(force: boolean): void {
    const rev = this.history.revision;
    const docChanged = force || rev !== this.renderedRevision;
    const viewChanged = this.level !== this.renderedLevel || this.showAll !== this.renderedShowAll;
    if (docChanged || viewChanged) {
      // Set pieces drawn as their parts (the document keeps the placements).
      this.visibleBoxes = this.view.setMap(this.viewDoc, this.level, this.showAll, this.mapBoxes());
      this.renderedLevel = this.level;
      this.renderedShowAll = this.showAll;
      this.updateSelectionVisuals();
      this.topBar.updateCounts();
      this.renderLevels();
    }
    if (docChanged) {
      this.renderedRevision = rev;
      const pieces = this.selPieces().filter((id) => !!this.placementOf(id));
      this.selection = {
        tiles: this.selection.tiles.filter((id) => this.doc.classicStructure.tiles.some((t) => t.id === id)),
        entities: this.selection.entities.filter((id) => this.doc.entities.some((e) => e.id === id)),
        ...(pieces.length ? { setPieces: pieces } : {}),
      };
      this.pieces.renderMyPieces();
      this.updateSelectionVisuals();
      this.topBar.syncToolbar();
      this.checks.validate();
      this.budgetBar.update(this.budgets.counts);
      this.inspector.renderInspector();
      this.topBar.updateTopBar();
      this.hover.updateHover();
      this.logic.render();
      this.terrain.syncTerrainUi();
      this.paths.refresh();
      this.routes.refresh();
      this.paths.renderPane($('ed-paths'));
      this.env.refresh();
      this.env.updateStatus();
      if (!force) this.saving.scheduleAutosave();
    }
  }

  // ---------------------------------------------------------------- editing

  run(label: string, cmd: EditCommand | { error: string }): boolean {
    if ('error' in cmd) {
      this.toast(`Can't ${label.toLowerCase()}: ${cmd.error}`, true);
      return false;
    }
    try {
      // The document keeps its own ground: MapMaker draws it kept under the floors (EditorView.setMap), as loading
      // plays it, so a floor an edit moves or deletes gives the ground under it back.
      // Groups stay tidy: members an edit removes leave their group in the same undo step (groups.ts).
      this.history.execute(label, withGroupsTidied(this.doc, cmd));
      return true;
    } catch (e) {
      this.toast(`Can't ${label.toLowerCase()}: ${(e as Error).message}`, true);
      return false;
    }
  }

  undo(): void {
    const label = this.history.undo();
    this.toast(label ? `Undo: ${label}` : 'Nothing to undo');
  }

  redo(): void {
    const label = this.history.redo();
    this.toast(label ? `Redo: ${label}` : 'Nothing to redo');
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    if (tool.kind === 'setpiece') {
      // A piece that can't be mirrored is placed unmirrored (M says why).
      const def = this.pieceDef(tool.piece);
      if (this.pieceMirror && def && setPieceMirrorRefusal(def)) this.pieceMirror = false;
    }
    this.pieces.renderPieceInfo();
    if (PLACING.has(tool.kind)) this.lastPlace = tool;
    if (tool.kind === 'edge') this.paint.edgeStyle = tool.style;
    const pane: Partial<Record<Tool['kind'], string>> = { paint: 'paint', edge: 'advanced', terrain: 'terrain', envbrush: 'plants' };
    this.paths.setActive(tool.kind === 'path');
    this.routes.setActive(tool.kind === 'route');
    this.measure.setActive(tool.kind === 'measure');
    this.hints.setActive(tool.kind === 'bothint');
    if (tool.kind === 'bothint') this.lastHint = tool.hint;
    // The pane holding the tool's card (props sit in Props, Nature or Vehicles; scenario pieces in several tabs).
    const card = document.querySelector<HTMLElement>(`#ed-palette .ed-pane [data-tool="${CSS.escape(toolKey(tool))}"]`);
    const at = card?.closest<HTMLElement>('.ed-pane')?.dataset.pane ?? pane[tool.kind];
    if (at) this.showPane(at);
    if (tool.kind === 'prop') this.propOpts.mount(card?.closest('.ed-pane') ?? null);
    if (tool.kind !== 'terrain') {
      this.terrain.terrainHover = null;
      this.view.setBrushRing(null, 0, 0, 0);
    }
    if (tool.kind !== 'paint' && tool.kind !== 'edge') this.hoverFace = null;
    if (tool.kind !== 'edge') this.paint.hoverEdge = null;
    for (const b of document.querySelectorAll<HTMLElement>('[data-tool]')) {
      const t = b.dataset.tool;
      b.classList.toggle(
        'active',
        (tool.kind === 'tile' && t === `tile:${tool.tile}`) ||
          (tool.kind === 'setpiece' && t === `setpiece:${tool.piece}`) ||
          (tool.kind === 'pickup' && t === `pickup:${tool.item}`) ||
          (tool.kind === 'scenario' && t === `scenario:${tool.key}`) ||
          (tool.kind === 'edge' && t === `edge:${tool.style}`) ||
          (tool.kind === 'prop' && t === `prop:${tool.model}`) ||
          (tool.kind === 'mount' && t === `mount:${tool.model}`) ||
          (tool.kind === 'terrain' && t === `terrain:${this.terrain.terrainBrush}`) ||
          (tool.kind === 'npc' && t === `npc:${tool.key}`) ||
          (tool.kind === 'bothint' && t === `bothint:${tool.hint}`) ||
          (t === 'place' && PLACING.has(tool.kind)) ||
          t === tool.kind,
      );
    }
    this.palette?.syncActive();
    $('ed-tb-place-what').textContent = this.lastPlace ? this.toolName(this.lastPlace) : '';
    const hints: Record<Tool['kind'], [string, string]> = {
      // One line per tool, in the same order: left-click · right-click (takes back what the tool does) · R · modifiers.
      select: ['Select', 'Click picks · right-click: menu · drag moves · R turns (Shift+R a little), or drag the ring round it · Shift+click adds · Alt+click one piece of a build · Del deletes'],
      erase: ['Erase', 'Click or drag deletes what is outlined in red (a whole moving build; Alt: one piece) · Ctrl+Z brings it back'],
      tile: ['Place', 'Click places the green piece · right-click removes a tile · R turns it 90° · PgUp/PgDn level'],
      setpiece: ['Place', 'Click places the set piece where it shows green (red says why not) · right-click removes a set piece · R turns it 90° · M mirrors it · PgUp/PgDn level'],
      spawn: ['Place', 'Click places a player spawn · right-click removes a spawn · R turns it 45° (Shift+R 15°)'],
      pickup: ['Place', 'Click places the pickup · right-click removes a pickup'],
      scenario: ['Place', 'Click places it (doors, walls and lasers snap to doorways) · right-click removes an object · R turns it 90° (Shift+R 15°) · L opens Logic'],
      npc: ['Place', 'Click drops the NPCs here · right-click removes them · R turns them 90° (Shift+R 15°) · soldiers, faction and orders in the inspector'],
      paint: ['Paint', 'Click or drag paints surfaces and the ground (terrain) · right-click (Shift+drag) resets them to the theme · Alt+click or I picks a style up'],
      edge: ['Walls', 'Click or drag along wall and floor edges to build them this way · right-click (Shift+drag) resets them · O cycles the style'],
      prop: ['Place', 'Click places the prop on what is under the pointer: a tabletop, a roof, the ground (Ctrl: no snap) · right-click removes a prop · R turns it 15° (Shift+R 5°) · Randomise in the Props tab'],
      mount: ['Place', 'Click places it · right-click removes a vehicle · R turns it 15° (Shift+R 5°) · players get in and out with E'],
      terrain: ['Terrain', 'Hold to sculpt or paint · Shift: the opposite (lower / raise) · [ ] brush size · T cycles brushes'],
      envbrush: ['Environment brush', 'Click or drag paints the mix (one stroke, one undo step) · right-click or Shift+drag erases · [ ] brush size · settings in the Nature tab'],
      path: ['Paths', 'Click adds a point after the selected one (two clicks start a path) · click the first point with the last selected to join the ends · right-click or Del removes one · drag a point to move it · Shift+click a path inserts one · click another path to edit it'],
      route: ['Route', 'Click adds a point after the selected one · right-click or Del removes one · drag a point to move it · Shift+click a stretch inserts one · Esc when done'],
      note: ['Note pins', 'Click the map to pin a note for its makers (shown in MapMaker only, never in play) · click a pin to edit or delete it · drag a pin to move it · Map properties lists every note'],
      bothint: ['Bot hints', "Click the map to mark a spot for bots (a jump link: its start, then its landing) · it faces the way you look · click a pin to edit it in the inspector · drag a pin to move it · R turns the selected one · Del deletes · What bots know shows bots' own spots"],
      measure: ['Measure', "Click two points: distance, height and slope · a third click chains a path with its total · snaps to the grid, surfaces and objects' tops (Ctrl or Alt: no snap) · right-click takes a point back · Esc clears"],
    };
    // A zipline's ends go where you click (the Route tool's hands, two points only).
    if (tool.kind === 'route' && this.routes.label === 'zipline end') hints.route = ['Zipline ends', 'Click the ground or a platform to put the far end there (click the start first to move that) · drag either end · Esc when done'];
    const [name, hint] = hints[tool.kind];
    const what = PLACING.has(tool.kind) ? `: ${this.toolName(tool)}` : tool.kind === 'edge' ? `: ${EDGE_STYLE_LABELS[tool.style]}` : '';
    const hintEl = $('ed-toolhint');
    hintEl.className = `tool-${tool.kind === 'erase' ? 'erase' : PLACING.has(tool.kind) ? 'place' : 'other'}`;
    hintEl.innerHTML = `<b>${escapeHtml(name + what)}</b> ${escapeHtml(hint)}`;
    $('ed-hint').textContent = 'Right-drag look · WASD/QE fly · wheel zoom · V select · P place · X erase · B paint · O walls · T terrain · N plants · G paths · U measure · Esc: Select tool · ? every key';
    this.hover.updateHover();
  }

  /** What a placing tool puts down, for the toolbar and hints. */
  toolName(tool: Tool): string {
    switch (tool.kind) {
      case 'tile':
        return coreCatalog.get(tool.tile)?.displayName ?? tool.tile;
      case 'setpiece':
        return this.pieceDef(tool.piece)?.displayName ?? tool.piece;
      case 'spawn':
        return 'Player Spawn';
      case 'pickup':
        return getItem(tool.item)?.displayName ?? 'Pickup';
      case 'scenario':
        return SCENARIO_PALETTE.find((x) => x.key === tool.key)?.label ?? 'Object';
      case 'prop':
        return getProp(tool.model)?.displayName ?? 'Prop';
      case 'mount':
        return MOUNT_DEFS[tool.model].displayName;
      case 'npc':
        return NPC_PALETTE.find((x) => x.key === tool.key)?.label ?? 'NPC';
      default:
        return '';
    }
  }

  /** Select: anything in a group brings its whole group (groups.ts), unless `single` (Alt-click: just that one). */
  setSelection(sel: Selection, single = false, keepHint = false): void {
    if (!keepHint) this.hints.deselect();
    this.selection = single ? sel : withGroups(this.doc, sel);
    this.updateSelectionVisuals();
    this.inspector.renderInspector();
    this.topBar.syncToolbar();
  }

  updateSelectionVisuals(offset?: [number, number, number], bad = false): void {
    this.view.setOutlines(this.doc, this.selection.tiles, offset, bad, this.selectedPieceOutlines());
    this.view.setEntities(this.viewDoc, this.level, this.showAll, new Set(this.selection.entities));
    this.view.setGizmo(offset ? null : this.selectionCenter());
    if (offset) this.view.setRing(null, null);
    else this.ring.redraw();
  }

  /** The rotate ring's radius: clear of what is selected (its cells, the props' size), never under 2.2 m. */
  private ringRadius(): number {
    const c = this.selectionCenter();
    if (!c) return 2.2;
    const { cellSize } = this.doc.classicStructure;
    let r = 0;
    const reach = (x: number, z: number, half: number) => (r = Math.max(r, Math.hypot(x - c.x, z - c.z) + half));
    const tiles = new Set(this.selection.tiles);
    const ents = new Set(this.selection.entities);
    for (const t of this.doc.classicStructure.tiles) if (tiles.has(t.id)) reach(t.x * cellSize, t.y * cellSize, cellSize * 0.71);
    for (const e of this.doc.entities) {
      if (!ents.has(e.id)) continue;
      const size = e.kind === 'prop' ? (getProp(e.model)?.size ?? [1, 1, 1]).map((v) => v * e.scale) : 'size' in e && Array.isArray(e.size) ? e.size : [1, 1, 1];
      reach(e.position[0], e.position[2], Math.hypot(size[0]!, size[2]!) / 2);
    }
    for (const id of this.selPieces()) {
      const p = this.placementOf(id);
      const def = p && this.pieceDef(p.piece);
      if (p && def) for (const cell of setPieceFootprint(p, def)) reach(cell[0] * cellSize, cell[1] * cellSize, cellSize * 0.71);
    }
    return Math.max(2.2, r + 0.6);
  }

  /** The rotate ring's drag: the selection shown turned by `turn` (tiles and set pieces outlined where they'd land, red where they can't), or as it is. */
  private previewTurn(turn: number | null): void {
    if (turn === null) {
      this.view.setOutlines(this.doc, this.selection.tiles, undefined, false, this.selectedPieceOutlines());
      this.view.setEntities(this.viewDoc, this.level, this.showAll, new Set(this.selection.entities));
      return;
    }
    const cmd = turnByCommand(this.doc, this.selection, turn, coreCatalog, this.placeLib);
    if ('error' in cmd) {
      this.view.setOutlines(this.doc, this.selection.tiles, undefined, true, this.selectedPieceOutlines());
      return;
    }
    const after = applyCommand(this.doc, cmd);
    const pieces = this.selPieces().flatMap((id) => {
      const p = (after.setPieces ?? []).find((x) => x.id === id);
      const o = p && this.pieces.pieceOutline(p);
      return o ? [o] : [];
    });
    this.view.setOutlines(after, this.selection.tiles, undefined, false, pieces);
    const ents = cmd.kind === 'batch' ? cmd.commands.find((c) => c.kind === 'updateEntities') : cmd.kind === 'updateEntities' ? cmd : undefined;
    if (ents && this.selection.entities.length) this.view.setEntities(applyCommand(this.viewDoc, ents), this.level, this.showAll, new Set(this.selection.entities));
  }

  /** The selected set pieces' footprints and ports (a port facing a wall flagged). */
  selectedPieceOutlines(): PieceOutline[] {
    return this.selPieces().flatMap((id) => {
      const p = this.placementOf(id);
      const o = p && this.pieces.pieceOutline(p);
      return o ? [o] : [];
    });
  }

  setLevel(level: number, quiet = false): void {
    const next = Math.max(-16, Math.min(16, level));
    if (next === this.level) {
      if (!quiet && next !== level) this.toast(`${levelName(next)} is the build limit: levels go ${BUILD_LEVELS.max} up and ${-BUILD_LEVELS.min} down`);
      return;
    }
    this.level = next;
    if (!quiet) this.toast(`Now editing ${levelName(next)} (${next * this.doc.classicStructure.levelHeight} m)`);
    this.renderLevels();
    this.hover.updateHover();
  }

  /** Levels with something on them: tiles occupying them and entities standing on them. */
  private levelContents(): Map<number, number> {
    const counts = new Map<number, number>();
    const bump = (l: number) => counts.set(l, (counts.get(l) ?? 0) + 1);
    for (const t of this.doc.classicStructure.tiles) for (const l of new Set((placementCells(t) ?? [[0, 0, t.z]]).map((c) => c[2]))) bump(l);
    for (const e of this.doc.entities) if (!this.hover.onTerrain(e)) bump(this.hover.entityLevel(e));
    for (const p of this.doc.setPieces ?? []) {
      const def = this.pieceDef(p.piece);
      for (const l of new Set(def ? setPieceFootprint(p, def).map((c) => c[2]) : [p.z])) bump(l);
    }
    return counts;
  }

  /** The level strip: every level in use plus the ones either side of the current one, top first. */
  private renderLevels(): void {
    const counts = this.levelContents();
    const used = [...counts.keys(), this.level - 1, this.level, this.level + 1, 0];
    const hi = Math.min(16, Math.max(...used));
    const lo = Math.max(-16, Math.min(...used));
    const list = $('ed-level-list');
    list.replaceChildren();
    for (let l = hi; l >= lo; l--) {
      const b = document.createElement('button');
      b.className = `lv-btn${l === this.level ? ' on' : ''}${counts.has(l) ? ' used' : ''}`;
      b.dataset.level = String(l);
      b.title = `${levelName(l)}: ${l * this.doc.classicStructure.levelHeight} m · ${counts.get(l) ?? 0} things on it`;
      b.innerHTML = `<span>${escapeHtml(levelName(l))}</span><small>${counts.get(l) ?? ''}</small>`;
      b.addEventListener('click', () => this.setLevel(l));
      list.append(b);
    }
    $('ed-level').textContent = levelName(this.level);
    $<HTMLButtonElement>('ed-level-up').disabled = this.level >= 16;
    $<HTMLButtonElement>('ed-level-down').disabled = this.level <= -16;
    $('ed-level-name-bottom').textContent = `${levelName(this.level)} · ${this.level * this.doc.classicStructure.levelHeight} m`;
  }

  /** Home: the starting overview of the level being edited. */
  resetView(): void {
    if (this.plan.on) return this.plan.fit();
    this.view.resetView({ x: 0, y: this.level * this.doc.classicStructure.levelHeight, z: 0 });
    this.toast('View reset (Home)');
  }

  focusSelection(): void {
    const target = this.selectionCenter();
    if (target && this.plan.on) this.plan.centre(target.x, target.z);
    else if (target) this.view.focus(target);
  }

  private selectionCenter(): Vec3 | null {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    const pts: Vec3[] = [];
    for (const t of this.doc.classicStructure.tiles) if (this.selection.tiles.includes(t.id)) pts.push({ x: t.x * cellSize, y: t.z * levelHeight, z: t.y * cellSize });
    for (const e of this.doc.entities) if (this.selection.entities.includes(e.id)) pts.push({ x: e.position[0], y: e.position[1], z: e.position[2] });
    // A set piece: the middle of its footprint, on its lowest level.
    for (const id of this.selPieces()) {
      const p = this.placementOf(id);
      const def = p && this.pieceDef(p.piece);
      if (!p || !def) continue;
      const cells = setPieceFootprint(p, def);
      const n = cells.length;
      pts.push({ x: (cells.reduce((s, c) => s + c[0], 0) / n) * cellSize, y: Math.min(...cells.map((c) => c[2])) * levelHeight, z: (cells.reduce((s, c) => s + c[1], 0) / n) * cellSize });
    }
    if (!pts.length) return null;
    const n = pts.length;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n, z: pts.reduce((s, p) => s + p.z, 0) / n };
  }

  private focusEntity(id: string): void {
    this.checks.focusIssue({ severity: 'suggestion', code: 'focus', message: '', targetId: id });
  }

  /** The `?` overlay: every key in the table, grouped (keyOverlay.ts). */
  readonly keyOverlay = new KeyOverlay($('editor'));

  /** Pick the last placed piece up again, or point at the palette. */
  placeTool(): void {
    if (this.lastPlace) return this.setTool(this.lastPlace);
    this.showPane('tiles');
    this.toast('Pick a piece, prop, item or NPC from the palette on the left to place it');
  }

  setShowAll(on: boolean, quiet = false): void {
    this.showAll = on;
    $<HTMLInputElement>('ed-showall').checked = on;
    if (!quiet) this.toast(on ? 'Showing every level (the others ghosted)' : `Showing ${levelName(this.level)} and below`);
  }

  /**
   * Play from here (MapMaker overhaul Phase 3 item 1; Shift+F5, the top bar's ▶ Here): a test match with you standing
   * on the nearest walkable ground below the camera, facing where it looks (shared editor/playFromHere.ts). Refused,
   * with the reason, where there's nowhere to stand. Back in MapMaker the view, selection and undo are as they were.
   */
  playFromHere(): void {
    const p = this.view.camera.position;
    // The plan view's camera is high above: start from its cut, on the level shown.
    const c = this.plan.on ? { x: p.x, y: this.plan.cutY, z: p.z } : p;
    const doc = this.viewDoc;
    const boxes = [...this.mapBoxes(), ...blockBoxes(doc), ...blockBoxes(doc, true), ...propBoxes(doc), ...propBoxes(doc, true)];
    // The plan view looks straight down: you start looking ahead.
    const pitch = this.plan.on ? 0 : this.view.pitch;
    const spot = playFromHereSpot({ camera: { x: c.x, y: c.y, z: c.z }, yaw: this.view.yaw, pitch, boxes, ground: this.shownGround, bounds: this.doc.bounds });
    if (!spot.ok) return this.toast(`Can't play from here: ${spot.reason}`, true);
    this.test({ pos: spot.position, yaw: spot.yaw, pitch: spot.pitch });
  }

  test(startAt?: TestRequest['startAt']): void {
    const errors = this.checks.allIssues().filter((i) => i.severity === 'error');
    if (errors.length) {
      this.toast(`Fix ${errors.length} error${errors.length > 1 ? 's' : ''} before testing: ${errors[0]!.message}`, true);
      return;
    }
    const botCount = Number($<HTMLSelectElement>('ed-bots').value);
    const difficulty = $<HTMLSelectElement>('ed-skill').value as TestRequest['difficulty'];
    // Team maps fill every team to its size; otherwise the bots chosen in the top bar.
    const main = this.doc.metadata.supportedModes[0] ?? '';
    const teams = isTeamMode(main) ? (main === 'core.ctf' ? (this.doc.teamSetup?.sizes.slice(0, 2) ?? [4, 4]) : this.doc.teamSetup?.sizes) : undefined;
    const fill = teams ? Math.min(32, teams.reduce((a, b) => a + b, 0)) : botCount + 1;
    // As played: paths laid into the ground, terrain under the floors (what loadMap gives every match).
    const played = loadMap(this.doc);
    this.host.startTest({ map: played.ok ? played.map : this.doc, botFill: fill, difficulty, ...(startAt ? { startAt } : {}) });
  }

  toast(message: string, error = false): void {
    const el = $('ed-toast');
    el.textContent = message;
    el.classList.toggle('err', error);
    el.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('on'), error ? 3500 : 2000);
  }
}
