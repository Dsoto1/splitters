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
  /** Box select (Select tool, drag on empty ground): the rectangle on screen. */
  private marquee: { x0: number; y0: number; x1: number; y1: number; add: boolean; moved: boolean } | null = null;
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
  private readonly measure: MeasureTool;
  /** The top bar's Bot test (overhaul Phase 4): a bot test run's heatmaps and spawn exposure, in a worker. */
  readonly mapTest: MapTestPanel;
  /** Environment Phase 3: the Environment group, its brush and the collision preview (envTools.ts). */
  readonly env: EnvTools;
  /** Note pins (J; noteTool.ts): notes for the map's makers, drawn over the view. */
  readonly notes: NoteTool;
  /** Bot hints (Y; botHintTool.ts, MapMaker overhaul Phase 4 item 3): drawn over the view, edited in the inspector. */
  readonly hints: BotHintTool;
  private lastHint: BotHintKind = 'choke';
  /** The prop tool's placing options: Randomise. */
  readonly propOpts: PropPlaceOptions;
  /** What props and the measure tool land on, per document version and view. */
  readonly surfaces = new SurfaceBoxes();
  /** The rotate ring on the selection gizmo: drag to turn (MapMaker overhaul Phase 3 item 9). */
  private readonly ring: RotateRing;
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
  private pointerAt: { x: number; y: number } | null = null;
  /** Pointer ray, for picking what is under the cursor. */
  ray: { origin: Vec3; dir: Vec3 } | null = null;
  selection: Selection = emptySelection();
  hoverPoint: Vec3 | null = null;
  /** The hover point is on the terrain (nearer than the level plane). */
  hoverOnTerrain = false;
  hoverCell: [number, number, number] | null = null;
  private drag: DragState | null = null;
  looking: { x: number; y: number; moved: boolean; travel: number; button: number } | null = null;
  keys = new Set<string>();
  issues: ValidationIssue[] = [];
  private renderedRevision = -1;
  private renderedLevel = -1;
  private renderedShowAll = false;
  private toastTimer?: number;
  private active = false;
  /** Boxes currently shown (respecting floor isolation), for surface picking. */
  visibleBoxes: WorldBox[] = [];
  hoverFace: BoxHit | null = null;
  /** Paint tool: the terrain under the pointer when it, not a surface, is what a click paints. */
  paintGround: Vec3 | null = null;
  /** The boxes Paint and Walls can point at: everything drawn but the invisible barriers (map edge, ground fence). */
  private paintable: { from: WorldBox[]; boxes: WorldBox[]; tiles: WorldBox[] } = { from: [], boxes: [], tiles: [] };

  constructor(readonly host: EditorHost) {
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
        this.updatePointer(x, y);
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
        this.updatePointer(x, y);
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
        this.updateHover();
      },
    });
    this.propOpts = new PropPlaceOptions(testMode()?.seed ?? Math.floor(Math.random() * 2 ** 31), () => this.updateHover());
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
    this.bindInput();
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
    this.drag = null;
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
      this.updateHover();
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
    this.updateHover();
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
  private selectedPieceOutlines(): PieceOutline[] {
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
    this.updateHover();
  }

  /** Levels with something on them: tiles occupying them and entities standing on them. */
  private levelContents(): Map<number, number> {
    const counts = new Map<number, number>();
    const bump = (l: number) => counts.set(l, (counts.get(l) ?? 0) + 1);
    for (const t of this.doc.classicStructure.tiles) for (const l of new Set((placementCells(t) ?? [[0, 0, t.z]]).map((c) => c[2]))) bump(l);
    for (const e of this.doc.entities) if (!this.onTerrain(e)) bump(this.entityLevel(e));
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

  /** The level an entity stands on (things a little below a floor, like props bedded into ground, count as on it). */
  private entityLevel(e: MapEntity): number {
    return Math.floor((e.position[1] + 0.5) / this.doc.classicStructure.levelHeight);
  }

  /** Standing on the terrain rather than a floor: reachable from any level. */
  private onTerrain(e: MapEntity): boolean {
    const t = this.shownGround;
    if (!t) return false;
    const y = terrainHeightAt(t, e.position[0], e.position[2]);
    return y !== null && Math.abs(e.position[1] - y) < 1;
  }

  /** Whether the pointer may act on this entity from the current level. */
  private reachable(e: MapEntity): boolean {
    if (this.showAll || this.onTerrain(e)) return true;
    const h = this.doc.classicStructure.levelHeight;
    const bottom = e.position[1];
    const top = bottom + ('size' in e && Array.isArray(e.size) ? e.size[1] : e.kind === 'prop' ? (getProp(e.model)?.size[1] ?? 1) * e.scale : 2);
    return top >= this.level * h - 0.5 && bottom < (this.level + 1) * h - 0.1;
  }

  /**
   * Right-click, one rule for every tool: it takes back what that tool does, where you click.
   * Paint resets the surface, Walls resets the wall, Scatter clears its plants, Road and Paths remove
   * a point or path, and a placing tool removes a thing of its own kind (Erase removes anything).
   * With Select it opens the selection menu.
   */
  private secondaryClick(x: number, y: number, alt: boolean): void {
    const tool = this.tool;
    switch (tool.kind) {
      case 'select':
        return this.openContextMenu(x, y);
      case 'paint':
        return this.paint.paintAtHover(true);
      case 'edge':
        return this.paint.edgeAtHover('auto');
      case 'envbrush':
        return this.hoverPoint ? this.env.dab(this.hoverPoint.x, this.hoverPoint.z, true) : undefined;
      case 'path':
        return this.paths.erase(this.hoverPoint);
      case 'route':
        return this.routes.erase(this.hoverPoint);
      case 'measure':
        this.measure.back();
        return this.updateHover();
      case 'terrain':
        return this.toast('Terrain: Shift-drag does the opposite (lower, or raise)');
      case 'erase':
      case 'note':
      case 'bothint':
        return;
    }
    const hit = this.pick();
    const e = hit?.kind === 'entity' ? this.doc.entities.find((x) => x.id === hit.id) : undefined;
    const mine =
      !!hit &&
      (tool.kind === 'tile'
        ? hit.kind === 'tile'
        : tool.kind === 'setpiece'
          ? hit.kind === 'setpiece'
          : tool.kind === 'spawn' || tool.kind === 'pickup' || tool.kind === 'prop' || tool.kind === 'mount'
            ? e?.kind === tool.kind
            : hit.kind === 'entity');
    if (!hit) return this.toast(`Nothing to remove here on ${levelName(this.level)}`, true);
    if (!mine) return this.toast(`Right-click removes what this tool places; ${this.targetName(hit)} is something else (Erase, X, removes anything)`, true);
    this.placing.eraseAtHover(alt);
  }

  /** The selection menu (right-click with Select): picks what is under the pointer first if it isn't selected. */
  private openContextMenu(x: number, y: number): void {
    const hit = this.pick();
    if (hit) {
      const ids = (hit.kind === 'entity' && moverGroupOf(this.doc, hit.id)) || [hit.id];
      const now = hit.kind === 'tile' ? this.selection.tiles : hit.kind === 'setpiece' ? this.selPieces() : this.selection.entities;
      if (!ids.every((id) => now.includes(id))) this.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: ids });
    }
    const has = this.selCount() > 0;
    const pieces = this.selPieces();
    document.getElementById('ed-ctx')?.remove();
    const menu = document.createElement('div');
    menu.id = 'ed-ctx';
    menu.className = 'ed-ctx';
    menu.setAttribute('role', 'menu');
    const item = (label: string, keys: string, run: () => void, enabled = has) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.disabled = !enabled;
      b.innerHTML = `<span>${escapeHtml(label)}</span><kbd>${escapeHtml(keys)}</kbd>`;
      b.addEventListener('click', () => {
        close();
        run();
      });
      menu.append(b);
    };
    const close = () => {
      menu.remove();
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('keydown', onKey, true);
    };
    const outside = (ev: PointerEvent) => {
      if (!menu.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        close();
      }
    };
    item('Rotate', 'R', () => this.edits.rotate());
    item('Rotate a little', 'Shift+R', () => this.edits.rotate(true));
    item(pieces.length && pieces.length === this.selCount() ? 'Mirror' : 'Flip east ↔ west', 'M', () => this.edits.mirror());
    item('Mirror…', 'Shift+M', () => this.edits.mirrorDialog(), true);
    item('Duplicate', 'Ctrl+D', () => this.edits.duplicate());
    item('Copy', 'Ctrl+C', () => this.edits.copy());
    item('Paste here', 'Ctrl+V', () => this.edits.paste(), !!readClipboard());
    const grouped = selectionGroup(this.doc, this.selection);
    item('Group', 'Ctrl+G', () => this.edits.group(), this.selCount() > 1 && !grouped);
    item(grouped ? `Ungroup “${groupName(grouped)}”` : 'Ungroup', 'Ctrl+Shift+G', () => this.edits.ungroup(), this.selCount() > 0 && [...this.selection.tiles, ...this.selection.entities, ...pieces].some((id) => groupOf(this.doc, id)));
    item('Focus', 'F', () => this.focusSelection());
    item('Delete', 'Del', () => this.edits.deleteSelection());
    if (pieces.length === 1 && this.selCount() === 1) item('Explode to tiles', '', () => this.pieces.explode(pieces[0]!));
    item('Save as set piece…', '', () => this.pieces.saveSelectionDialog());
    if (this.doc.terrain) item('Cut ground to floors', '', () => this.edits.cutGround());
    item('Select none', 'Esc', () => this.setSelection(emptySelection()));
    $('editor').append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', onKey, true);
    (menu.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.focus();
  }

  /** A drag with Paint, Walls, Scatter or Erase: what it last touched, so each surface, wall or thing is done once. */
  private brush: { invert: boolean; alt: boolean; key: string | null; at: { x: number; z: number } | null } | null = null;

  /** Apply the brush tool under the pointer if it has moved onto something new (always on the first press). */
  private brushAtHover(first: boolean): void {
    const b = this.brush;
    const tool = this.tool;
    if (!b) return;
    if (tool.kind === 'paint' && this.paintGround && !this.hoverFace) {
      const p = this.paintGround;
      if (b.at && Math.hypot(p.x - b.at.x, p.z - b.at.z) < this.terrain.brushRadius * 0.5) return;
      b.at = { x: p.x, z: p.z };
      b.key = null;
      if (!b.invert) this.paint.paintGroundAtHover();
      return;
    }
    if (tool.kind === 'paint') {
      const t = this.paint.paintTarget();
      const key = t ? `${t.tile.id}:${t.slot}` : null;
      if (!key || key === b.key) return;
      b.key = key;
      return this.paint.paintAtHover(b.invert);
    }
    if (tool.kind === 'edge') {
      const key = this.paint.hoverEdge ? JSON.stringify(this.paint.hoverEdge) : null;
      if (!key || key === b.key) return;
      b.key = key;
      return this.paint.edgeAtHover(b.invert ? 'auto' : tool.style);
    }
    if (tool.kind === 'envbrush') return this.env.drag(this.hoverPoint, b.invert || b.alt, first);
    if (tool.kind === 'erase') {
      const hit = this.pick();
      if (!hit && !first) return;
      if (hit && hit.id === b.key) return;
      b.key = hit?.id ?? null;
      this.placing.eraseAtHover(b.alt);
    }
  }

  /** Display name of a pick target. */
  targetName(hit: Hit): string {
    if (hit.kind === 'setpiece') {
      const p = this.placementOf(hit.id);
      return (p && this.pieceDef(p.piece)?.displayName) ?? 'set piece';
    }
    if (hit.kind === 'tile') {
      const t = this.doc.classicStructure.tiles.find((x) => x.id === hit.id);
      return coreCatalog.get(t?.tile ?? '')?.displayName ?? 'tile';
    }
    const e = this.doc.entities.find((x) => x.id === hit.id);
    if (!e) return 'item';
    return e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (getItem(e.item)?.displayName ?? 'pickup') : entityLabel(this.doc, e);
  }

  /**
   * What is under the cursor, for Select and Erase. The nearest thing the
   * pointer ray actually hits wins: an entity's drawn model, a free block or
   * water, or a tile's walls and floors. Tiles must be on the current level;
   * entities on it, or standing on the terrain (any level). Failing a hit, an
   * entity near the pointer, then the tile in the hovered cell.
   */
  pick(): Hit | null {
    // The map as drawn: a set piece's parts (tiles and entities of the expansion) pick their placement, as one.
    const view = this.viewDoc;
    const partOf = this.expansion.partOf;
    const whole = (h: { kind: 'tile' | 'entity'; id: string }): Hit => {
      const placement = partOf.get(h.id);
      return placement ? { kind: 'setpiece', id: placement } : { kind: h.kind, id: h.id };
    };
    const byId = new Map(view.entities.map((e) => [e.id, e]));
    const ok = (e: MapEntity | undefined): e is MapEntity => !!e && this.reachable(e) && this.view.entityShown(e.id);
    const tilesHere = new Set(view.classicStructure.tiles.filter((t) => (placementCells(t) ?? []).some((c) => c[2] === this.level)).map((t) => t.id));
    let best: { kind: 'tile' | 'entity'; id: string; d: number } | null = null;
    const ray = this.ray;
    if (ray) {
      const ent = this.view.pickEntities(ray.origin, ray.dir).find((h) => ok(byId.get(h.id)));
      if (ent) best = { kind: 'entity', id: ent.id, d: ent.distance };
      const boxes = this.visibleBoxes.filter((b) => b.kind !== 'barrier' && (tilesHere.has(b.sourceId) || ok(byId.get(b.sourceId))));
      const hit = raycastBoxes(ray.origin, ray.dir, boxes);
      // A model a hair behind the box it stands in still counts (crates in a doorway, props on a floor).
      if (hit && (!best || hit.distance < best.d - 0.05)) best = { kind: tilesHere.has(hit.box.sourceId) ? 'tile' : 'entity', id: hit.box.sourceId, d: hit.distance };
    }
    if (best?.kind === 'entity') return whole(best);
    const p = this.hoverPoint;
    if (p) {
      let near: { id: string; d: number } | null = null;
      for (const e of view.entities) {
        if (!ok(e)) continue;
        const d = Math.hypot(e.position[0] - p.x, e.position[2] - p.z);
        if (d < pickRadius(e) && (!near || d < near.d)) near = { id: e.id, d };
      }
      // Flat markers (zones, squads, pads) on the floor under the pointer win over the floor itself.
      if (near && (!best || best.kind === 'tile')) return whole({ kind: 'entity', id: near.id });
    }
    if (best) return whole(best);
    const cell = this.hoverCell;
    if (!cell) return null;
    const tile = tileAt(view, cell[0], cell[1], this.level);
    if (tile) return whole({ kind: 'tile', id: tile.id });
    // A cell a set piece claims (its footprint holds every level of it), even where none of its parts stands.
    const held = this.expansion.footprints;
    for (const [id, cells] of held) if (cells.some((c) => c[0] === cell[0] && c[1] === cell[1] && c[2] === this.level)) return { kind: 'setpiece', id };
    return null;
  }

  /** Home: the starting overview of the level being edited. */
  private resetView(): void {
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

  // ---------------------------------------------------------------- hover / drag

  private updatePointer(clientX: number, clientY: number): void {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    this.ray = this.view.pointerRay(clientX, clientY);
    this.pointerAt = { x: clientX, y: clientY };
    this.hoverPoint = this.view.pickPlane(clientX, clientY, this.level * levelHeight);
    // The ground as shown (kept under the floors), not the document's own: under a floor that stands on a hill, the
    // ground as made is inside the floor, out of sight.
    const t = this.shownGround;
    this.terrain.terrainHover = null;
    this.hoverOnTerrain = false;
    let ground: { at: Vec3; distance: number } | null = null;
    if (t) {
      const ray = this.view.pointerRay(clientX, clientY);
      const hit = ray ? terrainRaycast(t, ray.origin, ray.dir) : null;
      if (hit && ray) ground = { at: hit, distance: Math.hypot(hit.x - ray.origin.x, hit.y - ray.origin.y, hit.z - ray.origin.z) };
      if (hit && this.tool.kind === 'terrain') this.terrain.terrainHover = hit;
      // Spawns, pickups and props stand on the ground where it is nearer than the level plane.
      // (Tiles and set pieces go on the grid: the level being edited, not the ground.)
      if (hit && ray && this.tool.kind !== 'tile' && this.tool.kind !== 'setpiece' && this.tool.kind !== 'terrain') {
        const dist = (p: Vec3) => Math.hypot(p.x - ray.origin.x, p.y - ray.origin.y, p.z - ray.origin.z);
        if (!this.hoverPoint || dist(hit) < dist(this.hoverPoint)) {
          this.hoverPoint = hit;
          this.hoverOnTerrain = true;
        }
      }
    }
    this.hoverCell = this.hoverPoint ? [Math.round(this.hoverPoint.x / cellSize), Math.round(this.hoverPoint.z / cellSize), this.level] : null;
    if (this.tool.kind === 'path') this.paths.hover(this.hoverPoint);
    if (this.tool.kind === 'measure') this.measure.setHover(this.placing.measurePointAtHover());
    this.paintGround = null;
    if (this.tool.kind === 'paint' || this.tool.kind === 'edge') {
      const ray = this.view.pointerRay(clientX, clientY);
      // Only what is drawn: the invisible walls round the map (60 m high) would catch the ray first from far out.
      if (this.paintable.from !== this.visibleBoxes) {
        const boxes = this.visibleBoxes.filter((b) => b.kind !== 'barrier');
        const tiles = new Set(this.doc.classicStructure.tiles.map((t) => t.id));
        this.paintable = { from: this.visibleBoxes, boxes, tiles: boxes.filter((b) => tiles.has(b.sourceId)) };
      }
      // Paint paints tiles' surfaces (a rock or crate in the way is not one: the ground under it is what it paints).
      const face = ray ? raycastBoxes(ray.origin, ray.dir, this.tool.kind === 'paint' ? this.paintable.tiles : this.paintable.boxes) : null;
      // The ground in front of a surface hides it; with nothing nearer, the ground is what Paint paints.
      this.hoverFace = face && (!ground || face.distance < ground.distance) ? face : null;
      if (this.tool.kind === 'paint' && !this.hoverFace && ground) this.paintGround = ground.at;
    } else this.hoverFace = null;
    this.paint.hoverEdge = null;
    if (this.tool.kind === 'edge' && this.hoverFace) {
      const ray = this.view.pointerRay(clientX, clientY)!;
      const d = this.hoverFace.distance;
      const point: [number, number, number] = [ray.origin.x + ray.dir.x * d, ray.origin.y + ray.dir.y * d, ray.origin.z + ray.dir.z * d];
      this.paint.hoverEdge = edgeTargetAt(this.doc, point, this.hoverFace.normal);
    }
    this.updateHover();
  }

  updateHover(): void {
    this.updateHoverTarget();
    this.updateHoverCard();
  }

  /**
   * Hover card next to the pointer (reference board): the piece about to be
   * placed, or what Select / Erase would act on, with its size, theme and connectors.
   */
  private updateHoverCard(): void {
    const tip = $('ed-tip');
    const at = this.pointerAt;
    const lines: string[] = [];
    /** Lines in red (why it can't be placed) or amber (a warning), by index in `lines`. */
    const marks = new Map<number, 'bad' | 'warn' | 'note'>();
    let title = '';
    let tone = '';
    const themeName = coreThemes.get(this.doc.classicStructure.theme)?.displayName ?? this.doc.classicStructure.theme;
    const tileLines = (def: TileDefinition, rotation: number) => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return [`Size: ${span(0)} × ${span(1)} × ${span(2)}`, `Theme: ${themeName}`, `Connectors: ${def.ports.length}`, `Rotation: ${rotation * 90}°`];
    };
    if (at && !this.drag && !this.looking) {
      const g = this.pieceHover;
      if (this.tool.kind === 'setpiece' && this.hoverCell && g) {
        // The set piece about to be placed: what it is, how it's turned and themed, and whether it fits (and why not).
        title = g.def.displayName;
        tone = g.ok ? 'place' : 'bad';
        lines.push(...this.pieces.pieceLines(g.def, g.placement), `${levelName(this.level)} · cell ${this.hoverCell[0]}, ${this.hoverCell[1]}`);
        // The ghost says why (ghostWhy.ts): a few words here, the whole reason on the status line.
        if (!g.ok) marks.set(lines.push(`✗ ${g.short}`) - 1, 'bad');
        else if (g.blocked) marks.set(lines.push(`⚠ ${g.blocked} of its ports face${g.blocked === 1 ? 's' : ''} a wall (red): open the wall there, or place it elsewhere`) - 1, 'warn');
        else {
          const zone = this.hoverPoint && zoneGhostNote(this.doc, g.placement.x * this.doc.classicStructure.cellSize, g.placement.y * this.doc.classicStructure.cellSize);
          if (zone) marks.set(lines.push(`ℹ ${zone.text}`) - 1, 'note');
          lines.push('Click to place');
        }
      } else if (this.tool.kind === 'tile' && this.hoverCell) {
        const def = coreCatalog.get(this.tool.tile);
        if (def) {
          title = def.displayName;
          lines.push(...tileLines(def, this.rotation), `${levelName(this.level)} · cell ${this.hoverCell[0]}, ${this.hoverCell[1]}`);
          const check = this.tileGhost(this.tool.tile, [this.hoverCell[0], this.hoverCell[1], this.level]);
          const why = checkNote(check) ?? zoneGhostNote(this.doc, this.hoverCell[0] * this.doc.classicStructure.cellSize, this.hoverCell[1] * this.doc.classicStructure.cellSize);
          if (why) marks.set(lines.push(`${why.tone === 'bad' ? '✗' : 'ℹ'} ${why.text}`) - 1, why.tone === 'bad' ? 'bad' : 'note');
          tone = check.ok ? 'place' : 'bad';
        }
      } else if (this.entityGhost()) {
        // Spawns, pickups, props, vehicles, NPCs and objects: shown only when there is something to say.
        const g = this.entityGhost()!;
        title = g.title;
        tone = g.note.tone === 'note' ? 'place' : g.note.tone;
        marks.set(lines.push(`${g.note.tone === 'bad' ? '✗' : g.note.tone === 'warn' ? '⚠' : 'ℹ'} ${g.note.text}`) - 1, g.note.tone);
        lines.push(g.note.tone === 'bad' ? "Can't be placed here" : 'Click to place');
      } else if (this.tool.kind === 'select' || this.tool.kind === 'erase') {
        const hit = this.pick();
        if (hit) {
          title = this.targetName(hit);
          tone = this.tool.kind === 'erase' ? 'erase' : 'pick';
          const placement = hit.kind === 'setpiece' ? this.placementOf(hit.id) : undefined;
          const def = placement && this.pieceDef(placement.piece);
          if (placement && def) lines.push('Set piece (selects as one)', ...this.pieces.pieceLines(def, placement));
          else if (hit.kind === 'tile') {
            const t = this.doc.classicStructure.tiles.find((x) => x.id === hit.id);
            const def = t && coreCatalog.get(t.tile);
            if (t && def) lines.push(...tileLines(def, t.rotation), levelName(t.z));
          } else {
            const e = this.doc.entities.find((x) => x.id === hit.id);
            if (e?.kind === 'encounter') lines.push(`${rosterSize(e.roster)} NPCs · ${mapFactions(this.doc).find((f) => f.id === e.faction)?.name ?? e.faction}`, `Order: ${e.order}`);
            else if (e?.kind === 'prop') lines.push(`Prop · scale ${e.scale}×`, (getProp(e.model)?.size ?? [1, 1, 1]).map((v) => (v * e.scale).toFixed(1)).join(' × ') + ' m');
            if (e) lines.push(`Height ${e.position[1].toFixed(1)} m`);
          }
          lines.push(this.tool.kind === 'erase' ? 'Click to erase' : 'Click to select');
        }
      }
    }
    tip.hidden = !title;
    if (!title || !at) return;
    tip.className = `tone-${tone}`;
    tip.innerHTML = `<b>${escapeHtml(title)}</b>${lines.map((l, i) => `<span${marks.has(i) ? ` class="${marks.get(i)}"` : ''}>${escapeHtml(l)}</span>`).join('')}`;
    // Beside the pointer, kept inside the window.
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const viewRight = $('ed-right').offsetParent ? $('ed-right').getBoundingClientRect().left : window.innerWidth;
    tip.style.left = `${at.x + 18 + w > viewRight - 8 ? Math.max(0, at.x - 18 - w) : at.x + 18}px`;
    tip.style.top = `${Math.min(window.innerHeight - h - 44, at.y + 18)}px`;
  }

  private updateHoverTarget(): void {
    // Placing tools show what they'd put down, see-through, before you click (first: every other tool hides them).
    // One ghost for every kind that has a model: where it would land, facing the way it would face.
    const t = this.tool;
    const ghost: { kind: 'prop' | 'mount' | 'spawn' | 'pickup'; model: string; at: [number, number, number] | null; yaw: number; scale?: number; variant?: number } | null =
      this.looking ? null
      : t.kind === 'prop' ? { kind: 'prop', model: t.model, ...this.placing.propPlacement(t.model) }
      : t.kind === 'mount' ? { kind: 'mount', model: t.model, at: this.placing.placeSpot(), yaw: this.propYaw }
      : t.kind === 'spawn' ? { kind: 'spawn', model: 'spawn', at: this.placing.placeSpot(), yaw: this.spawnYaw }
      : t.kind === 'pickup' ? { kind: 'pickup', model: t.item, at: this.placing.placeSpot(), yaw: 0 }
      : null;
    // Red where the click is refused (over nothing, outside the boundary: ghostWhy.ts).
    const refused = !this.looking && ghostRefuses(this.entityGhost()?.note);
    this.view.setPropGhost(ghost?.model ?? null, ghost?.at ?? null, ghost?.yaw ?? 0, ghost?.kind ?? 'prop', ghost?.scale !== undefined ? { scale: ghost.scale, ...(ghost.variant !== undefined ? { variant: ghost.variant } : {}) } : undefined, refused);
    const objects = this.looking ? null : this.placing.objectGhost();
    this.view.setEntityGhost(this.doc, objects?.key ?? null, objects?.entities ?? [], refused);
    this.pieces.updatePieceGhost();
    if (this.tool.kind === 'select' || this.tool.kind === 'erase') {
      // Select: the rotate ring round the selection lights under the pointer (and, held, turns it).
      const onRing = this.tool.kind === 'select' && !this.drag && !this.looking && !this.marquee && (!!this.ring.drag || this.ring.hover(this.pointerAt));
      if (onRing) {
        this.view.setPickHighlight(this.doc, null, 'pick', this.history.revision);
        $('ed-target').textContent = this.ring.drag ? `Turning ${turnLabel(this.ring.drag.turn)} · Shift: finer · Esc cancels` : 'Drag the ring to turn the selection (Shift: a finer step)';
        this.view.setFaceHighlight(null, null);
        this.view.setHoverCell(this.doc, null);
        this.view.setGhost(this.doc, null, null, 0, true);
        return;
      }
      if (this.tool.kind === 'erase' || this.drag || this.looking || this.marquee) this.ring.hover(null);
      const target = this.drag || this.looking || this.marquee ? null : this.pick();
      const cells = target?.kind === 'setpiece' ? (this.expansion.footprints.get(target.id) ?? []) : [];
      this.view.setPickHighlight(this.doc, target, this.tool.kind === 'erase' ? 'erase' : 'pick', this.history.revision, cells);
      $('ed-target').textContent = target ? `${this.tool.kind === 'erase' ? 'Erase' : 'Select'}: ${this.targetName(target)}` : this.placing.zoneNote();
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    this.view.setPickHighlight(this.doc, null, 'pick', 0);
    if (this.tool.kind === 'measure') {
      $('ed-target').textContent = this.measure.summary();
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'envbrush') {
      const p = this.hoverPoint;
      const env = this.tool.kind === 'envbrush';
      this.view.setBrushRing(p ? this.shownGround : null, p?.x ?? 0, p?.z ?? 0, this.terrain.brushRadius, env && this.env.mode === 'erase' ? '#ff7a4d' : '#6fdc6a');
      $('ed-target').textContent = !p ? '' : this.env.hoverLabel();
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'terrain') {
      const h = this.terrain.terrainHover;
      const t = this.shownGround;
      const colors: Record<TerrainBrush, string> = { raise: '#ffd34d', lower: '#ff7a4d', smooth: '#7fd8ff', flatten: '#c7a6ff', roughen: '#b8e07a', paint: '#ffffff', foliage: '#6fdc6a' };
      this.view.setBrushRing(h ? t : null, h?.x ?? 0, h?.z ?? 0, this.terrain.brushRadius, colors[this.terrain.terrainBrush]);
      $('ed-target').textContent = !t ? 'No terrain yet: create one in the Terrain tab' : h ? `${this.terrain.terrainBrush === 'paint' ? `Paint ${TERRAIN_MATERIAL_LABELS[this.terrain.terrainMaterial]}` : this.terrain.terrainBrush === 'foliage' ? `Plants: ${FOLIAGE_LEVELS[this.terrain.foliageLevel]}` : this.terrain.terrainBrush} · height ${h.y.toFixed(1)} m · radius ${this.terrain.brushRadius} m` : '';
      this.view.setFaceHighlight(null, null);
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    if (this.tool.kind === 'edge') {
      const e = this.paint.hoverEdge;
      if (e) {
        const { cellSize, levelHeight } = this.doc.classicStructure;
        const [gx, gy, gz] = e.cell;
        const [dx, dz] = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] }[e.side] as [number, number];
        const h = cellSize / 2;
        const cx = gx * cellSize + dx * (h - 0.25);
        const cz = gy * cellSize + dz * (h - 0.25);
        const box = { min: [cx - (dx ? 0.25 : h), gz * levelHeight, cz - (dz ? 0.25 : h)], max: [cx + (dx ? 0.25 : h), (gz + 1) * levelHeight, cz + (dz ? 0.25 : h)], kind: 'wall', sourceId: '' } as WorldBox;
        this.view.setFaceHighlight(box, [-dx, 0, -dz]);
        const tileName = coreCatalog.get(tileAt(this.doc, gx, gy, gz)?.tile ?? '')?.displayName ?? '';
        const sideName = { N: 'North', E: 'East', S: 'South', W: 'West' }[e.side];
        $('ed-target').textContent = `${sideName} side · ${tileName} · now ${EDGE_STYLE_LABELS[edgeChoiceAt(this.doc, e)]} → ${EDGE_STYLE_LABELS[this.tool.style]}`;
      } else {
        this.view.setFaceHighlight(null, null);
        $('ed-target').textContent = '';
      }
      this.view.setHoverCell(this.doc, null);
      this.view.setGhost(this.doc, null, null, 0, true);
      return;
    }
    // Paint lights only a surface it can paint (a tile's), never a prop or block it would leave as it is.
    const face = this.tool.kind === 'paint' && !this.paint.paintTarget() ? null : this.hoverFace;
    this.view.setFaceHighlight(face?.box ?? null, face?.localNormal ?? null);
    if (this.tool.kind === 'paint') {
      const target = this.paint.paintTarget();
      const g = this.paintGround;
      // On the ground: the ring it paints, as the Terrain tab's Paint brush shows it.
      this.view.setBrushRing(g ? this.shownGround : null, g?.x ?? 0, g?.z ?? 0, this.terrain.brushRadius, '#ffb03b');
      $('ed-target').textContent = target
        ? `${SURFACE_SLOT_LABELS[target.slot]} · ${coreCatalog.get(target.tile.tile)?.displayName ?? target.tile.tile} · ${resolveSurface(this.doc, target.tile, target.slot).material.displayName}`
        : g
          ? `Ground · paint ${TERRAIN_MATERIAL_LABELS[this.paint.groundPaint]}${TERRAIN_SURFACES[this.paint.groundPaint] === this.paint.paintStyle.material || !terrainMaterialFor(this.paint.paintStyle.material) ? '' : ` (${coreMaterials.get(this.paint.paintStyle.material)?.displayName ?? 'swatch'})`} · radius ${this.terrain.brushRadius} m`
          : '';
    } else if (this.tool.kind === 'path') {
      const over = this.paths.hovering;
      $('ed-target').textContent = this.paths.dragging ? 'Moving the point' : over === 'point' ? (this.paths.joining ? 'Click to join the ends (a loop) · drag to move this point' : 'Drag to move this point · right-click removes it') : over === 'path' ? 'Click to edit this path · Shift-click puts a point here' : '';
    } else if (this.tool.kind === 'setpiece' && this.pieceHover) {
      const g = this.pieceHover;
      $('ed-target').textContent = `${g.def.displayName}: ${g.ok ? (g.blocked ? `fits; ${g.blocked} port${g.blocked === 1 ? '' : 's'} face${g.blocked === 1 ? 's' : ''} a wall` : 'fits here') : `can't go here: ${g.reason}`}`;
    } else if (refused) {
      const g = this.entityGhost()!;
      $('ed-target').textContent = `${g.title} can't be placed here: ${g.note.text.charAt(0).toLowerCase()}${g.note.text.slice(1)}`;
    } else $('ed-target').textContent = this.placing.zoneNote();
    const cell = this.hoverCell ? ([this.hoverCell[0], this.hoverCell[1], this.level] as [number, number, number]) : null;
    this.view.setHoverCell(this.doc, this.tool.kind === 'tile' || this.tool.kind === 'setpiece' || this.tool.kind === 'spawn' || this.tool.kind === 'pickup' || this.tool.kind === 'scenario' || this.tool.kind === 'npc' ? cell : null);
    if (this.tool.kind === 'tile' && cell) {
      const check = this.tileGhost(this.tool.tile, cell);
      // The whole reason on the status line (the note beside the pointer has it in a few words).
      if (!check.ok) $('ed-target').textContent = check.reason.charAt(0).toUpperCase() + check.reason.slice(1);
      this.view.setGhost(this.doc, this.tool.tile, cell, this.rotation, check.ok);
    } else {
      this.view.setGhost(this.doc, null, null, 0, true);
    }
  }

  /**
   * Whether the tile tool's ghost fits, and why not (ghostWhy.ts): worked out once per tile, cell, turn and document
   * version, so moving within a cell costs nothing.
   */
  private tileGhost(tile: string, cell: [number, number, number]): PlacementCheck {
    const at = `${tile}:${cell.join(',')}:${this.rotation}:${this.history.revision}`;
    if (this.tileGhostAt?.at !== at) this.tileGhostAt = { at, check: tileGhostCheck(this.doc, tile, cell[0], cell[1], cell[2], this.rotation) };
    return this.tileGhostAt.check;
  }
  private tileGhostAt: { at: string; check: PlacementCheck } | null = null;

  /**
   * The note beside the pointer for the entity tools (spawns, pickups, props, vehicles, NPCs, objects): nothing under
   * it, outside the boundary, the scenery zone (ghostWhy.ts). Once per spot and document version.
   */
  entityGhost(): { title: string; note: GhostNote } | null {
    const t = this.tool;
    let kind: GhostEntityKind;
    let at: [number, number, number] | null;
    let title: string;
    let model = '';
    if (t.kind === 'spawn') [kind, at, title] = ['spawn', this.placing.placeSpot(), 'Spawn point'];
    else if (t.kind === 'pickup') [kind, at, title] = ['pickup', this.placing.placeSpot(), getItem(t.item)?.displayName ?? 'Pickup'];
    else if (t.kind === 'prop') [kind, at, title, model] = ['prop', this.placing.propSpot(t.model), getProp(t.model)?.displayName ?? 'Prop', t.model];
    else if (t.kind === 'mount') [kind, at, title] = ['mount', this.placing.placeSpot(), MOUNT_DEFS[t.model].displayName];
    else if (t.kind === 'npc') [kind, at, title] = ['npc', this.placing.placeSpot(), NPC_PALETTE.find((x) => x.key === t.key)?.label ?? 'NPC'];
    else if (t.kind === 'scenario') [kind, at, title] = [t.key.startsWith('spawn:') ? 'spawn' : 'object', this.placing.scenarioSpot(t.key)?.p ?? null, SCENARIO_PALETTE.find((x) => x.key === t.key)?.label ?? 'Object'];
    else return null;
    if (!at) return null;
    const key = `${t.kind}:${title}:${at.join(',')}:${this.history.revision}:${this.level}:${this.showAll}`;
    if (this.entityGhostAt?.key !== key) {
      // What it would stand on: the map as drawn with its blocks and solid props (surfaceBoxes), the ground as shown, liquids.
      const liquids = this.viewDoc.entities.filter((e) => e.kind === 'water');
      const note = entityGhostNote(this.doc, kind, at, { boxes: this.placing.surfaceBoxes(), terrain: this.shownGround, liquids }, model);
      this.entityGhostAt = { key, value: note && { title, note } };
    }
    return this.entityGhostAt.value;
  }
  private entityGhostAt: { key: string; value: { title: string; note: GhostNote } | null } | null = null;

  private updateDrag(): void {
    const d = this.drag;
    if (!d || !this.hoverPoint || !this.hoverCell) return;
    const cellOffset: [number, number] = [this.hoverCell[0] - d.startCell[0], this.hoverCell[1] - d.startCell[1]];
    const freeOffset: [number, number] = [snap(this.hoverPoint.x - d.startPoint.x, this.snapStep(0.5)), snap(this.hoverPoint.z - d.startPoint.z, this.snapStep(0.5))];
    d.cellOffset = cellOffset;
    d.freeOffset = freeOffset;
    // Tiles and set pieces move cell by cell (their outlines show where they'd land, red where they can't).
    const byCell = this.selection.tiles.length > 0 || this.selPieces().length > 0;
    if (byCell) {
      const preview = moveCommand(this.doc, this.selection, cellOffset[0], cellOffset[1], 0);
      this.view.setOutlines(this.doc, this.selection.tiles, [cellOffset[0], cellOffset[1], 0], 'error' in preview, this.selectedPieceOutlines());
    }
    // Things follow the pointer as you drag (with tiles, cell by cell), so every kind previews where it lands.
    if (this.selection.entities.length) {
      const cs = this.doc.classicStructure.cellSize;
      const [ex, ez] = byCell ? [cellOffset[0] * cs, cellOffset[1] * cs] : freeOffset;
      const moved = applyCommand(this.viewDoc, moveEntitiesCommand(this.viewDoc, this.selection.entities, ex, 0, ez));
      this.view.setEntities(moved, this.level, this.showAll, new Set(this.selection.entities));
    }
  }

  private endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.moved) return;
    if (this.selection.tiles.length || this.selPieces().length) {
      const [dx, dy] = d.cellOffset;
      if (dx || dy) this.run('Move', moveCommand(this.doc, this.selection, dx, dy, 0));
    } else {
      const [dx, dz] = d.freeOffset;
      if (dx || dz) this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx, 0, dz));
    }
    this.updateSelectionVisuals();
  }

  /** The box select's rectangle on screen (hidden while there is none, or it is still a click). */
  private drawMarquee(): void {
    const el = $('ed-marquee');
    const m = this.marquee;
    el.hidden = !m?.moved;
    if (!m?.moved) return;
    const r = $('editor').getBoundingClientRect();
    el.style.left = `${Math.min(m.x0, m.x1) - r.left}px`;
    el.style.top = `${Math.min(m.y0, m.y1) - r.top}px`;
    el.style.width = `${Math.abs(m.x1 - m.x0)}px`;
    el.style.height = `${Math.abs(m.y1 - m.y0)}px`;
  }

  /**
   * Box select (Select tool, drag on empty ground): everything whose middle is inside the box on screen, on the level
   * being edited: tiles, set pieces (whole) and things (a moving build whole). Shift adds to the selection. A click
   * that didn't drag selects nothing.
   */
  private endMarquee(): void {
    const m = this.marquee!;
    this.marquee = null;
    this.drawMarquee();
    if (!m.moved) {
      if (!m.add) this.setSelection(emptySelection());
      return;
    }
    const [x0, x1] = [Math.min(m.x0, m.x1), Math.max(m.x0, m.x1)];
    const [y0, y1] = [Math.min(m.y0, m.y1), Math.max(m.y0, m.y1)];
    const inside = (p: Vec3) => {
      const s = this.view.projectInView(p);
      return !!s && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
    };
    const { cellSize, levelHeight } = this.doc.classicStructure;
    /** The middle of the cells on this level, a metre up. */
    const middle = (cells: readonly (readonly number[])[]): Vec3 | null => {
      const here = cells.filter((c) => c[2] === this.level);
      if (!here.length) return null;
      return { x: (here.reduce((s, c) => s + c[0]!, 0) / here.length) * cellSize, y: this.level * levelHeight + 1, z: (here.reduce((s, c) => s + c[1]!, 0) / here.length) * cellSize };
    };
    const tiles = this.doc.classicStructure.tiles.filter((t) => ((c) => !!c && inside(c))(middle(placementCells(t) ?? []))).map((t) => t.id);
    const pieces = [...this.expansion.footprints].filter(([, cells]) => ((c) => !!c && inside(c))(middle(cells))).map(([id]) => id);
    const things = this.doc.entities.filter((e) => this.reachable(e) && this.view.entityShown(e.id) && inside({ x: e.position[0], y: e.position[1] + 0.5, z: e.position[2] }));
    const entities = withMoverGroups(this.doc, things.map((e) => e.id));
    const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
    const setPieces = m.add ? union(this.selPieces(), pieces) : pieces;
    this.setSelection({ tiles: m.add ? union(this.selection.tiles, tiles) : tiles, entities: m.add ? union(this.selection.entities, entities) : entities, ...(setPieces.length ? { setPieces } : {}) });
    const n = this.selCount();
    this.toast(n ? `${n} selected · Save as set piece… (inspector) makes a piece of them` : `Nothing in the box on ${levelName(this.level)}`);
  }

  // ---------------------------------------------------------------- input

  private bindInput(): void {
    const canvas = () => this.host.canvas;
    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.looking) {
        const dx = e.movementX;
        const dy = e.movementY;
        // A right-click that wobbles a few pixels is still a click (secondaryClick), not a look.
        this.looking.travel += Math.abs(dx) + Math.abs(dy);
        if (this.looking.travel > 6) this.looking.moved = true;
        // The plan view: a drag pans (the ground follows the pointer).
        if (this.plan.on) this.plan.pan(dx, dy);
        else if (this.looking.button === 2) this.view.look(dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
        else this.view.fly(0, -dx * 0.05, dy * 0.05);
        return;
      }
      if (this.ring.drag) {
        this.updatePointer(e.clientX, e.clientY);
        this.ring.move({ x: e.clientX, y: e.clientY }, e.shiftKey);
        return this.updateHover();
      }
      if (this.marquee) {
        const m = this.marquee;
        m.x1 = e.clientX;
        m.y1 = e.clientY;
        if (Math.hypot(m.x1 - m.x0, m.y1 - m.y0) > 4) m.moved = true;
        this.drawMarquee();
        return;
      }
      if (e.target !== canvas() && !this.drag) {
        // Off the view (over a panel): no hover card.
        if (this.pointerAt) {
          this.pointerAt = null;
          $('ed-tip').hidden = true;
        }
        return;
      }
      this.updatePointer(e.clientX, e.clientY);
      if (this.paths.dragging) this.paths.pointerMove(this.hoverPoint);
      if (this.routes.dragging) this.routes.pointerMove(this.hoverPoint);
      if (this.brush && e.buttons & 1) this.brushAtHover(false);
      if (this.drag) {
        if (Math.hypot(e.clientX - this.drag.pointerX, e.clientY - this.drag.pointerY) > 4) this.drag.moved = true;
        if (this.drag.moved) this.updateDrag();
      }
    });
    window.addEventListener('pointerdown', (e) => {
      if (!this.active || e.target !== canvas()) return;
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.updatePointer(e.clientX, e.clientY);
      if (e.button === 2 || e.button === 1) {
        this.looking = { x: e.clientX, y: e.clientY, moved: false, travel: 0, button: e.button };
        canvas().setPointerCapture(e.pointerId);
        return;
      }
      if (e.button !== 0) return;
      if (this.tool.kind === 'paint' && e.altKey) return this.paint.pickStyleAtHover();
      if (this.tool.kind === 'terrain') return this.terrain.startStroke(e.shiftKey);
      // Paint, Walls, Scatter and Erase paint as you drag (one undo step); Shift does the opposite.
      if (this.tool.kind === 'paint' || this.tool.kind === 'edge' || this.tool.kind === 'envbrush' || this.tool.kind === 'erase') {
        this.history.beginStroke();
        this.brush = { invert: e.shiftKey, alt: e.altKey, key: null, at: null };
        this.brushAtHover(true);
        return;
      }
      if (this.tool.kind === 'path') return this.paths.pointerDown(this.hoverPoint, e.shiftKey);
      if (this.tool.kind === 'route') return this.routes.pointerDown(this.hoverPoint, e.shiftKey);
      if (this.tool.kind === 'measure') {
        if (this.measure.hover) this.measure.click(this.measure.hover);
        return this.updateHover();
      }
      if (this.tool.kind === 'note') return this.notes.place(this.hoverPoint);
      if (this.tool.kind === 'bothint') return this.hints.place(this.placing.hintPointAtHover());
      if (this.tool.kind !== 'select') return this.placing.placeAtHover();
      // The rotate ring round the selection: a drag turns it.
      if (this.ring.begin({ x: e.clientX, y: e.clientY })) {
        canvas().setPointerCapture(e.pointerId);
        return this.updateHover();
      }
      const hit = this.pick();
      if (!hit) {
        // Empty ground: drag a box to select what's in it (Shift adds to the selection); a plain click selects nothing.
        this.marquee = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, add: e.shiftKey, moved: false };
        return;
      }
      const key = hit.kind === 'tile' ? 'tiles' : hit.kind === 'setpiece' ? 'setPieces' : 'entities';
      // A moving build (a mover and every block and prop it carries) is picked whole; Alt-click picks one part.
      // A set piece is picked whole too: any of its parts selects the placement.
      const ids = (hit.kind === 'entity' && !e.altKey && moverGroupOf(this.doc, hit.id)) || [hit.id];
      const now = this.selection[key] ?? [];
      const already = ids.every((id) => now.includes(id));
      // A group is picked whole too (Alt-click: one of it); Shift+click on a selected group's member takes the group out.
      const inGroup = !e.altKey && groupOf(this.doc, hit.id);
      if (e.shiftKey) {
        if (already && inGroup) {
          const out = new Set(inGroup.members);
          const keep = (list: readonly string[]) => list.filter((id) => !out.has(id));
          const pieces = keep(this.selPieces());
          this.setSelection({ tiles: keep(this.selection.tiles), entities: keep(this.selection.entities), ...(pieces.length ? { setPieces: pieces } : {}) }, true);
          return;
        }
        const next = { ...this.selection, [key]: already ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])] };
        this.setSelection(next, e.altKey);
        return;
      }
      if (!already) this.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : hit.kind === 'setpiece' ? { tiles: [], entities: [], setPieces: [hit.id] } : { tiles: [], entities: ids }, e.altKey);
      if (this.hoverPoint && this.hoverCell) {
        this.drag = { startCell: [this.hoverCell[0], this.hoverCell[1]], startPoint: { ...this.hoverPoint }, pointerX: e.clientX, pointerY: e.clientY, moved: false, cellOffset: [0, 0], freeOffset: [0, 0] };
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.active) return;
      if (this.looking && (e.button === 2 || e.button === 1)) {
        const wasClick = !this.looking.moved && e.button === 2;
        this.looking = null;
        if (wasClick) {
          this.updatePointer(e.clientX, e.clientY);
          this.secondaryClick(e.clientX, e.clientY, e.altKey);
        }
        return;
      }
      if (e.button === 0) {
        if (this.ring.drag) {
          this.ring.end();
          return this.updateHover();
        }
        if (this.brush) {
          this.brush = null;
          this.history.endStroke();
          this.env.strokeEnd();
        }
        if (this.marquee) this.endMarquee();
        this.terrain.endStroke();
        this.endDrag();
        this.paths.pointerUp();
        this.routes.pointerUp();
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.active || e.target !== canvas()) return;
        e.preventDefault();
        // Mouse wheels send big steps, touchpads many small ones: move by how far it scrolled.
        const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        if (this.plan.on) this.plan.zoom(px * (e.shiftKey ? 3 : 1), e.clientX, e.clientY);
        else this.view.dolly(Math.max(-3, Math.min(3, -px * 0.03)) * (e.shiftKey ? 3 : 1));
        this.updatePointer(e.clientX, e.clientY);
      },
      { passive: false },
    );
    window.addEventListener('contextmenu', (e) => {
      if (this.active && e.target === canvas()) e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.ring.cancel();
      this.keys.clear();
      this.looking = null;
      this.marquee = null;
      this.drawMarquee();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Every key comes from the one key table (keymap.ts): it finds the binding, `keyActions` runs it. The `?` overlay
    // lists the same table.
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const b = matchEditorKey(e);
      if (b?.always) {
        e.preventDefault();
        this.keyActions[b.action](e);
        return;
      }
      if (isTyping() || document.querySelector('#editor dialog[open]')) return;
      this.keys.add(e.code);
      if (!b) return;
      this.keyActions[b.action](e);
      e.preventDefault();
    });
  }

  /** What each key in the table does (one handler per action: a Record, so none is left out). */
  private readonly keyActions: Record<KeyAction, (e: KeyboardEvent) => void> = {
    test: () => this.test(),
    // MapMaker overhaul Phase 3 items 1 and 2.
    playFromHere: () => this.playFromHere(),
    planView: () => this.plan.toggle(),
    undo: () => this.undo(),
    redo: () => this.redo(),
    save: () => this.saving.save(),
    duplicate: () => this.edits.duplicate(),
    togglePalette: () => this.topBar.toggleSidebar('pal'),
    toggleSidePanel: () => this.topBar.toggleSidebar('right'),
    rotate: () => this.edits.rotate(false),
    rotateFine: () => this.edits.rotate(true),
    mirror: () => this.edits.mirror(),
    // MapMaker overhaul Phase 3 part B: Mirror…, groups, copy and paste, note pins.
    mirrorDialog: () => this.edits.mirrorDialog(),
    group: () => this.edits.group(),
    ungroup: () => this.edits.ungroup(),
    copy: () => this.edits.copy(),
    paste: () => this.edits.paste(),
    notes: () => this.setTool({ kind: 'note' }),
    // MapMaker overhaul Phase 4 item 3: bot hints (the last kind picked).
    botHints: () => this.setTool({ kind: 'bothint', hint: this.lastHint }),
    focus: () => this.focusSelection(),
    resetView: () => this.resetView(),
    logic: () => this.logic.toggle(),
    paint: () => this.setTool({ kind: 'paint' }),
    terrain: () => {
      const i = this.tool.kind === 'terrain' ? (TERRAIN_BRUSHES.indexOf(this.terrain.terrainBrush) + 1) % TERRAIN_BRUSHES.length : TERRAIN_BRUSHES.indexOf(this.terrain.terrainBrush);
      this.terrain.setTerrainBrush(TERRAIN_BRUSHES[i]!);
    },
    walls: () => this.paint.wallsTool(this.tool.kind === 'edge'),
    erase: () => this.setTool({ kind: 'erase' }),
    // U: the measure tool (MapMaker overhaul Phase 1 item 3).
    measure: () => this.setTool({ kind: 'measure' }),
    // G: Paths (Shift+G: Paths on the track, NPC traffic), N: the Environment brush (the Scatter Brush sets it replaced are retired).
    paths: () => this.setTool({ kind: 'path' }),
    raceTrack: () => {
      this.paths.preset('race');
      this.setTool({ kind: 'path' });
    },
    envBrush: () => this.setTool({ kind: 'envbrush' }),
    place: () => this.placeTool(),
    pickStyle: () => {
      if (this.tool.kind === 'paint') this.paint.pickStyleAtHover();
    },
    select: () => this.selectTool(),
    escape: () => {
      // Esc drops a turn by the ring mid-drag (nothing turns).
      if (this.ring.cancel()) return this.updateHover();
      // Esc clears a measurement first (the measure tool stays in hand).
      if (this.measure.clear() && this.tool.kind === 'measure') return this.updateHover();
      // Esc drops a jump link half placed, else lets the selected bot hint go.
      if (this.hints.escape()) return this.updateHover();
      this.selectTool();
    },
    showAll: () => this.setShowAll(!this.showAll),
    search: () => {
      $<HTMLInputElement>('ed-search').focus();
      $<HTMLInputElement>('ed-search').select();
    },
    keys: () => this.keyOverlay.open(),
    delete: () => {
      if (this.tool.kind === 'path' && this.paths.deleteSelected()) return;
      if (this.tool.kind === 'route' && this.routes.deleteSelected()) return;
      if (!this.selCount() && this.hints.deleteSelected()) return;
      this.edits.deleteSelection();
    },
    // One meaning per key: PgUp/PgDn change the level (Shift: move the selection a level), [ ] the brush size.
    levelUp: () => this.setLevel(this.level + 1),
    levelDown: () => this.setLevel(this.level - 1),
    liftSelection: () => this.edits.nudge(0, 0, 1),
    lowerSelection: () => this.edits.nudge(0, 0, -1),
    brushBigger: () => {
      if (this.tool.kind === 'terrain' || this.tool.kind === 'envbrush') this.terrain.setBrushRadius(this.terrain.brushRadius + 2);
    },
    brushSmaller: () => {
      if (this.tool.kind === 'terrain' || this.tool.kind === 'envbrush') this.terrain.setBrushRadius(this.terrain.brushRadius - 2);
    },
    nudgeNorth: () => this.edits.nudge(0, 1, 0),
    nudgeSouth: () => this.edits.nudge(0, -1, 0),
    nudgeWest: () => this.edits.nudge(-1, 0, 0),
    nudgeEast: () => this.edits.nudge(1, 0, 0),
  };

  /** V (and Esc, once nothing else wants it): the Select tool; with Select in hand, select none. */
  private selectTool(): void {
    if (this.tool.kind === 'select') this.setSelection(emptySelection());
    this.setTool({ kind: 'select' });
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
   * What a set piece's palette picture is drawn from: the piece alone on an empty map, in its first look (the theme that
   * look is for), unturned; its props as models (tools/content/palette-items.ts hashes the same inputs).
   */
  setPieceThumbDoc(def: SetPieceDefinition): { doc: MapDocument; models: { file: string; position: [number, number, number]; yaw: number; scale: number }[] } {
    const pack = def.packs[0] ? this.setPieceLib.packs.get(def.packs[0]) : undefined;
    const theme = pack?.themes[0] ?? this.doc.classicStructure.theme;
    const placement: SetPiecePlacement = { id: 'thumb', piece: def.id, x: 0, y: 0, z: 0, rotation: 0, mirror: false, ...(pack ? { pack: pack.id } : {}) };
    const { tiles, entities } = setPieceParts(placement, def, theme, this.setPieceLib);
    const base = newMapDocument('thumb');
    const doc: MapDocument = { ...base, terrain: null, classicStructure: { ...base.classicStructure, theme, tiles }, entities: entities.filter((e) => e.kind === 'block') };
    const models = entities.flatMap((e) => {
      if (e.kind !== 'prop') return [];
      const file = envModelFile(e.model, e.variant) ?? getProp(e.model)?.file;
      return file ? [{ file, position: e.position, yaw: e.yaw, scale: e.scale }] : [];
    });
    return { doc, models };
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
