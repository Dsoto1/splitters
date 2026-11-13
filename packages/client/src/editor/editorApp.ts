import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  applyCommand,
  blockBoxes,
  budgetCulprits,
  BudgetTracker,
  BUILD_LEVELS,
  buildMapGeometry,
  builtInSetPieces,
  coreCatalog,
  EDGE_STYLE_LABELS,
  EditHistory,
  emptySelection,
  expandSetPieces,
  FLY_KEYS,
  FLY_PAUSE_KEYS,
  FREE_PLACE_KEYS,
  getItem,
  getProp,
  isTeamMode,
  levelName,
  loadMap,
  mapTeams,
  MOUNT_DEFS,
  NPC_PALETTE,
  piecesFor,
  placementCells,
  playFromHereSpot,
  propBoxes,
  ringStep,
  SCENARIO_PALETTE,
  setPieceFootprint,
  setPieceMirrorRefusal,
  terrainUnderFloors,
  turnByCommand,
  turnLabel,
  withGroups,
  withGroupsTidied,
  withPathsLaid,
  type BotHintKind,
  type EdgeStyle,
  type EdgeTarget,
  type EditCommand,
  type GlassKind,
  type MapDocument,
  type PlacementCheck,
  type Rotation,
  type Selection,
  type SetPieceDefinition,
  type SetPieceExpansion,
  type SetPieceLibrary,
  type SetPiecePlacement,
  type TerrainData,
  type ValidationIssue,
  type Vec3,
  type WorldBox
} from '@tiletrigger/shared';
import { ModelThumbnails } from '../frontend/modelThumbs.ts';
import { testMode } from '../testMode.ts';
import { BotHintTool } from './botHintTool.ts';
import { BudgetBar } from './budgetBar.ts';
import { $, escapeHtml, isTyping } from './editorDom.ts';
import { rememberShowAll } from './showAllSetting.ts';
import { EditorInput } from './editorInput.ts';
import { fitTopBar, FLY_SPEED, PLACING, STARTER_TERRAIN, starterMap, toolKey, type Hit, type Tool } from './editorParts.ts';
import { EditorView, type PieceOutline } from './editorView.ts';
import { EntityInspector } from './entityInspector.ts';
import { EnvTools } from './envTools.ts';
import { Hover } from './hover.ts';
import { Inspector } from './inspector.ts';
import { KeyOverlay } from './keyOverlay.ts';
import { LogicPanel } from './logicPanel.ts';
import { MapChecks } from './mapChecks.ts';
import { MapProperties } from './mapProperties.ts';
import { MapSaving } from './mapSaving.ts';
import { OutlinerPanel } from './outlinerPanel.ts';
import { mountPanels } from './panels.ts';
import { MapTestPanel } from './mapTestPanel.ts';
import { MeasureTool } from './measureTool.ts';
import { NoteTool } from './noteTool.ts';
import { isOwner } from './ownerPublish.ts';
import { PaintTools } from './paintTools.ts';
import { Palette } from './palette.ts';
import { PaletteAtlas } from './paletteAtlas.ts';
import { PaletteBuilder } from './paletteBuilder.ts';
import { PathTool } from './pathTool.ts';
import { Placing } from './placing.ts';
import { PlanView } from './planView.ts';
import { PropPlaceOptions } from './propPlaceOptions.ts';
import { type BoxHit } from './raycast.ts';
import { RotateRing } from './rotateRing.ts';
import { RouteTool } from './routeTool.ts';
import { SelectionEdits } from './selectionEdits.ts';
import { SetPieceTools } from './setPieceTools.ts';
import {
  listDrafts
} from './storage.ts';
import { SurfaceBoxes } from './surfaceBoxes.ts';
import { TerrainTools } from './terrainTools.ts';
import { TopBar } from './topBar.ts';
import { EditorTour } from './tour.ts';

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
  // ---------------------------------------------------------------- MapMaker's parts (each its own module)

  /** The pointer on the view, right-click and the keys (editorInput.ts). */
  readonly input: EditorInput;
  /** What's under the pointer: picking, the hover card, the placing ghosts (hover.ts). */
  readonly hover: Hover;
  /** Placing and erasing (placing.ts). */
  readonly placing: Placing;
  /** Edits to the selection: turn, delete, duplicate, group, copy and paste, mirror (selectionEdits.ts). */
  readonly edits: SelectionEdits;
  /** The Paint and Walls tools (paintTools.ts). */
  readonly paint: PaintTools;
  /** The Terrain tool (terrainTools.ts). */
  readonly terrain: TerrainTools;
  /** Set pieces: placing, the palette, the player's own, the inspector (setPieceTools.ts). */
  readonly pieces: SetPieceTools;
  /** The palette's contents and pictures (paletteBuilder.ts). */
  readonly palettes: PaletteBuilder;
  /** The inspector (inspector.ts); one entity's (entityInspector.ts); Map properties (mapProperties.ts). */
  readonly inspector: Inspector;
  readonly entityPane: EntityInspector;
  readonly mapProps: MapProperties;
  /** The top bar and the tool bar (topBar.ts). */
  readonly topBar: TopBar;
  /** Validation, navigation, overlaps and the issues list (mapChecks.ts). */
  readonly checks: MapChecks;
  /** Drafts, Save, Quit, New and Open… (mapSaving.ts). */
  readonly saving: MapSaving;
  /** Everything in the map in one list; hide and lock, editor-only (outlinerPanel.ts). */
  readonly outliner: OutlinerPanel;

  // ---------------------------------------------------------------- the editor's state

  readonly view: EditorView;
  readonly history: EditHistory;
  tool: Tool = { kind: 'select' };
  rotation: Rotation = 0;
  /** The shipped set pieces and role packs. MapMaker's document keeps placements; it draws them expanded (viewDoc). */
  readonly setPieceLib: SetPieceLibrary = builtInSetPieces();
  /** The set piece tool: mirrored (M); its look is SetPieceTools.pieceLook. */
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
  /** The first-time tour (MapMaker overhaul Phase 6; tour.ts). */
  readonly tour: EditorTour;
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
  /** The map's own issues as last worked out (MapChecks: a moment after each edit, in a worker). */
  issuesNow: ValidationIssue[] = [];

  /** The map's own issues, up to date with the document (worked out on the spot if an edit has not been checked yet). */
  get issues(): ValidationIssue[] {
    this.checks.settle();
    return this.issuesNow;
  }

  set issues(v: ValidationIssue[]) {
    this.issuesNow = v;
  }

  private renderedRevision = -1;
  private renderedLevel = -1;
  private renderedShowAll = false;
  private renderedFlags = -1;
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
    this.placing = new Placing(this);
    this.edits = new SelectionEdits(this);
    this.paint = new PaintTools(this);
    this.terrain = new TerrainTools(this);
    this.pieces = new SetPieceTools(this);
    this.palettes = new PaletteBuilder(this);
    this.inspector = new Inspector(this);
    this.entityPane = new EntityInspector(this);
    this.mapProps = new MapProperties(this);
    this.topBar = new TopBar(this);
    this.checks = new MapChecks(this);
    this.saving = new MapSaving(this);
    this.outliner = new OutlinerPanel(this, $('ed-outliner'));
    // The side panel's Outliner, Inspector and Validation fold from their headings, as each person left them.
    this.outliner.open = mountPanels($('ed-right'), (id, open) => id === 'outliner' && this.outliner.setOpen(open)).isOpen('outliner');
    this.view = new EditorView(host.engine);
    this.view.outlinerHidden = (id) => this.outliner.hidden.size > 0 && (this.outliner.hidden.has(id) || this.outliner.hidden.has(this.expansion.partOf.get(id) ?? ''));
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
    this.tour = new EditorTour(this);
    this.keyOverlay.onTour = () => this.tour.start();
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
    this.tour.maybeStart();
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
    // The outliner's hide and lock are per map: read the map's before drawing it.
    if (docChanged) this.outliner.update();
    const viewChanged = this.level !== this.renderedLevel || this.showAll !== this.renderedShowAll || this.outliner.flagsRev !== this.renderedFlags;
    if (docChanged || viewChanged) {
      // Set pieces drawn as their parts (the document keeps the placements); what the outliner hides left out.
      this.visibleBoxes = this.view.setMap(this.outliner.shown(this.viewDoc), this.level, this.showAll, this.mapBoxes());
      this.renderedLevel = this.level;
      this.renderedShowAll = this.showAll;
      this.renderedFlags = this.outliner.flagsRev;
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
    // Locked things (the outliner's padlock, editor-only) can't be selected.
    this.selection = this.outliner.selectable(single ? sel : withGroups(this.doc, sel));
    this.updateSelectionVisuals();
    this.inspector.renderInspector();
    this.topBar.syncToolbar();
    this.outliner.draw(true);
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

  /** Show all levels (the level list's button, H). `quiet`: a tool's own switch (the plan view, a card shot), not the user's: no toast, not remembered. */
  setShowAll(on: boolean, quiet = false): void {
    this.showAll = on;
    $('ed-showall').setAttribute('aria-pressed', String(on));
    if (!quiet) rememberShowAll(on);
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
    this.tour.note({ kind: 'test' });
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

  // ---------------------------------------------------------------- the test surface
  // `window.__editor` (main.ts) is what the e2e flows and tools/content/build-palette-atlas.mjs drive and read; these
  // reach the parts that moved into their own modules.

  get stroke(): TerrainTools['stroke'] {
    return this.terrain.stroke;
  }

  setBrushRadius(r: number): void {
    this.terrain.setBrushRadius(r);
  }

  thumbFor(key: string, size?: number): Promise<string> | null {
    return this.palettes.thumbFor(key, size);
  }

  setEdge(target: EdgeTarget, style: EdgeStyle, glass: GlassKind | null): void {
    this.paint.setEdge(target, style, glass);
  }

  pick(): Hit | null {
    return this.hover.pick();
  }

  tileGhost(tile: string, cell: [number, number, number]): PlacementCheck {
    return this.hover.tileGhost(tile, cell);
  }

  get tileGhostAt(): Hover['tileGhostAt'] {
    return this.hover.tileGhostAt;
  }

  allIssues(): ValidationIssue[] {
    return this.checks.allIssues();
  }
}
