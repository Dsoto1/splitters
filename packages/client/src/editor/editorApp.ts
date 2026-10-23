import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  EditHistory,
  addSpawnCommand,
  buildMapGeometry,
  checkPlacement,
  coreCatalog,
  deleteCommand,
  duplicateCommand,
  emptySelection,
  loadMap,
  moveCommand,
  moveEntitiesCommand,
  newId,
  newMapDocument,
  normalizeYaw,
  paintCommand,
  resolveSurface,
  faceSlot,
  rotateCommand,
  setThemeCommand,
  coreMaterials,
  coreThemes,
  CORE_ITEMS,
  DESTRUCTIBLE_MODELS,
  DESTRUCTIBLE_SPECS,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  SQUAD_ORDERS,
  mapFactions,
  mapTeams,
  SCENARIO_PALETTE,
  TRAP_ACTIVATIONS,
  TRAP_KINDS,
  TRAP_SPECS,
  entityLabel,
  newScenarioEntity,
  snapToDoorway,
  snapsToDoorway,
  getItem,
  SURFACE_SLOTS,
  SURFACE_SLOT_LABELS,
  TINT_SWATCHES,
  tileAt,
  updateTileCommand,
  validateMap,
  type EditCommand,
  type MapDocument,
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
  EDGE_STYLES,
  EDGE_STYLE_LABELS,
  SIDES,
  TILE_CATEGORIES,
  edgeChoiceAt,
  edgeSegments,
  edgeTargetAt,
  setEdgeCommand,
  type EdgeStyle,
  type EdgeTarget,
} from '@chronosplit/shared';
import arenaTemplate from '../../../../maps/phase0_arena.json';
import vaultTemplate from '../../../../maps/m3_vault.json';
import outpostTemplate from '../../../../maps/m4_outpost.json';
import sandgateTemplate from '../../../../maps/sandgate.json';
import { EditorView } from './editorView.ts';
import { deleteFromLibrary, exportMap, importMapFile, listLibrary, openFromLibrary, readAutosave, saveToLibrary, writeAutosave } from './storage.ts';
import { tileIcon } from './tileIcon.ts';
import { raycastBoxes, type BoxHit } from './raycast.ts';
import { materialThumbnail } from '../materials/patterns.ts';
import { itemColor } from '../game/pickupVisuals.ts';
import { LogicPanel } from './logicPanel.ts';

/** Small palette icon for a pickup item, coloured by item type. */
function itemIcon(itemId: string): string {
  const c = itemColor(itemId);
  return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="15" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-width="3"/><circle cx="28" cy="28" r="6" fill="${c}"/></svg>`;
}

export interface TestRequest {
  map: MapDocument;
  botFill: number;
  difficulty: 'easy' | 'normal' | 'hard';
}

export interface EditorHost {
  engine: AbstractEngine;
  canvas: HTMLCanvasElement;
  startTest(req: TestRequest): void;
  goHome(): void;
}

type Tool = { kind: 'select' } | { kind: 'tile'; tile: string } | { kind: 'spawn' } | { kind: 'pickup'; item: string } | { kind: 'scenario'; key: ScenarioPaletteKey } | { kind: 'paint' } | { kind: 'edge'; style: EdgeStyle };

/** Palette icons for scenario objects (simple SVG glyphs). */
const SCENARIO_ICONS: Record<ScenarioPaletteKey, string> = {
  door: '<rect x="12" y="10" width="15" height="38" fill="#6f7884"/><rect x="29" y="10" width="15" height="38" fill="#6f7884"/><rect x="12" y="28" width="32" height="4" fill="#e3b021"/><circle cx="28" cy="6" r="3" fill="#3fd26b"/>',
  door_locked: '<rect x="12" y="10" width="15" height="38" fill="#6f7884"/><rect x="29" y="10" width="15" height="38" fill="#6f7884"/><rect x="12" y="28" width="32" height="4" fill="#e3b021"/><circle cx="28" cy="6" r="3" fill="#e0412f"/><rect x="23" y="34" width="10" height="9" rx="1" fill="#e0412f"/><path d="M25 34v-3a3 3 0 0 1 6 0v3" stroke="#e0412f" stroke-width="2" fill="none"/>',
  button: '<rect x="24" y="24" width="8" height="26" fill="#3a3f48"/><rect x="17" y="12" width="22" height="16" rx="2" fill="#c9ccd2"/><circle cx="28" cy="20" r="5" fill="#3fd26b"/>',
  crate: '<rect x="12" y="14" width="32" height="32" fill="#9a6b3d"/><path d="M12 14L44 46M12 18h32M12 42h32" stroke="#6e4a28" stroke-width="3"/>',
  barrel: '<rect x="16" y="10" width="24" height="38" rx="5" fill="#c23b2a"/><rect x="16" y="16" width="24" height="4" fill="#f2c14e"/><rect x="16" y="38" width="24" height="4" fill="#f2c14e"/>',
  wall: '<rect x="8" y="10" width="40" height="38" fill="#9b9a94"/><path d="M18 14l6 12-4 8 8 10M36 18l-5 9 6 7" stroke="#44433f" stroke-width="2" fill="none"/>',
  zone: '<rect x="10" y="12" width="36" height="34" fill="#36d6ff" fill-opacity=".18" stroke="#36d6ff" stroke-width="2" stroke-dasharray="4 3"/>',
  'trap:spikes': '<rect x="8" y="42" width="40" height="5" fill="#3d4249"/><path d="M11 42l4-16 4 16M21 42l4-16 4 16M31 42l4-16 4 16M41 42l3-12 3 12" fill="#b9bec6"/>',
  'trap:flames': '<rect x="6" y="24" width="10" height="12" fill="#3a3f48"/><path d="M16 30c8-10 18-8 32-4-12 2-16 8-32 4z" fill="#ff8a2a"/><path d="M16 30c6-5 12-4 22-2-8 1-12 4-22 2z" fill="#ffe08a"/>',
  'trap:crusher': '<rect x="10" y="8" width="36" height="12" fill="#5e636b"/><rect x="8" y="6" width="3" height="42" fill="#4b525c"/><rect x="45" y="6" width="3" height="42" fill="#4b525c"/><path d="M28 24v12m-5-5l5 5 5-5" stroke="#e3b021" stroke-width="3" fill="none"/><rect x="10" y="46" width="36" height="3" fill="#e3b021"/>',
  'trap:mine': '<ellipse cx="28" cy="38" rx="14" ry="5" fill="#3b4033"/><circle cx="28" cy="34" r="3" fill="#ff2a2a"/>',
  encounter: '<ellipse cx="28" cy="44" rx="20" ry="6" fill="#d04a3a" fill-opacity=".25" stroke="#d04a3a" stroke-width="2"/><rect x="26" y="6" width="2.5" height="36" fill="#3a3f48"/><rect x="28.5" y="6" width="12" height="8" fill="#d04a3a"/><circle cx="17" cy="30" r="5" fill="#d04a3a"/><rect x="13" y="34" width="8" height="10" rx="3" fill="#d04a3a"/><circle cx="38" cy="30" r="5" fill="#d04a3a"/><rect x="34" y="34" width="8" height="10" rx="3" fill="#d04a3a"/>',
  'trap:laser': '<rect x="8" y="10" width="4" height="38" fill="#2a2d33"/><rect x="44" y="10" width="4" height="38" fill="#2a2d33"/><path d="M12 18h32M12 26h32M12 34h32M12 42h32" stroke="#ff2040" stroke-width="2"/>',
};

/** How close (m) a click must be to an entity's position to select it. */
function pickRadius(e: MapEntity): number {
  switch (e.kind) {
    case 'door':
      return 1.6;
    case 'zone':
      return Math.max(0.9, Math.min(e.size[0], e.size[2]) / 2);
    case 'trap':
      return e.trap === 'mine' ? 0.7 : 1.5;
    case 'destructible':
      return e.model === 'wall' ? 1.5 : 0.9;
    case 'encounter':
      return Math.max(1.2, Math.min(3, e.radius));
    default:
      return 0.9;
  }
}

interface DragState {
  startCell: [number, number];
  startPoint: Vec3;
  pointerX: number;
  pointerY: number;
  moved: boolean;
  /** Tiles move by whole cells; entity-only selections move freely (0.5 m snap). */
  cellOffset: [number, number];
  freeOffset: [number, number];
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const FLY_SPEED = 18;
const LOOK_SENSITIVITY = 0.004;
const snap = (v: number, step: number) => Math.round(v / step) * step;

/**
 * MapMaker controller: owns the edit history, tools, selection and the
 * editor UI. Every document change goes through EditHistory, so it is
 * undoable, autosaved and revalidated.
 */
export class EditorApp {
  readonly view: EditorView;
  readonly history: EditHistory;
  private tool: Tool = { kind: 'select' };
  private rotation: Rotation = 0;
  private spawnYaw = 0;
  private scenarioYaw = 0;
  readonly logic: LogicPanel;
  private level = 0;
  private showAll = false;
  private selection: Selection = emptySelection();
  private hoverPoint: Vec3 | null = null;
  private hoverCell: [number, number, number] | null = null;
  private drag: DragState | null = null;
  private looking: { x: number; y: number; moved: boolean; button: number } | null = null;
  private keys = new Set<string>();
  private issues: ValidationIssue[] = [];
  private navIssues: ValidationIssue[] = [];
  private renderedRevision = -1;
  private renderedLevel = -1;
  private renderedShowAll = false;
  private savedRevision = 0;
  private autosaveTimer?: number;
  private navTimer?: number;
  private navToken = 0;
  private toastTimer?: number;
  private active = false;
  /** Boxes currently shown (respecting floor isolation), for surface picking. */
  private visibleBoxes: WorldBox[] = [];
  private hoverFace: BoxHit | null = null;
  /** Cell side under the pointer for the wall tool. */
  private hoverEdge: EdgeTarget | null = null;
  private paintStyle: SurfaceStyle = { material: 'core.red_brick', tint: null };
  private paintScope: PaintScope = 'surface';

  constructor(private readonly host: EditorHost) {
    this.view = new EditorView(host.engine);
    const restored = readAutosave();
    this.history = new EditHistory(restored?.map ?? newMapDocument('Untitled Map'));
    this.logic = new LogicPanel({
      doc: () => this.doc,
      commit: (label, after) => this.run(label, { kind: 'setLogic', before: this.doc.logic, after }),
      commitFactions: (label, after) => this.run(label, { kind: 'setFactions', before: this.doc.factions, after }),
      focusEntity: (id) => this.focusEntity(id),
    });
    this.buildPalette();
    this.bindUi();
    this.bindInput();
    this.view.focus({ x: 0, y: 0, z: 0 });
    if (restored) this.toast(`Restored your last session (${new Date(restored.savedAt).toLocaleString()})`);
  }

  get doc(): MapDocument {
    return this.history.doc;
  }

  show(): void {
    this.active = true;
    $('editor').hidden = false;
    this.refresh(true);
  }

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
    if (!typing && !this.keys.has('ControlLeft') && !this.keys.has('ControlRight') && !this.keys.has('MetaLeft')) {
      const k = (c: string) => (this.keys.has(c) ? 1 : 0);
      const speed = FLY_SPEED * (this.keys.has('ShiftLeft') ? 3 : 1) * dt;
      const f = k('KeyW') - k('KeyS');
      const r = k('KeyD') - k('KeyA');
      const u = k('KeyE') - k('KeyQ');
      if (f || r || u) this.view.fly(f * speed, r * speed, u * speed);
    }
    this.refresh(false);
    this.view.render();
  }

  /** Bring meshes and panels up to date with the document and view settings. */
  private refresh(force: boolean): void {
    const rev = this.history.revision;
    const docChanged = force || rev !== this.renderedRevision;
    const viewChanged = this.level !== this.renderedLevel || this.showAll !== this.renderedShowAll;
    if (docChanged || viewChanged) {
      this.visibleBoxes = this.view.setMap(this.doc, this.level, this.showAll);
      this.renderedLevel = this.level;
      this.renderedShowAll = this.showAll;
      this.updateSelectionVisuals();
      this.updateCounts();
      $('ed-level').textContent = String(this.level);
    }
    if (docChanged) {
      this.renderedRevision = rev;
      this.selection = {
        tiles: this.selection.tiles.filter((id) => this.doc.classicStructure.tiles.some((t) => t.id === id)),
        entities: this.selection.entities.filter((id) => this.doc.entities.some((e) => e.id === id)),
      };
      this.updateSelectionVisuals();
      this.validate();
      this.renderInspector();
      this.updateTopBar();
      this.updateHover();
      this.logic.render();
      if (!force) this.scheduleAutosave();
    }
  }

  // ---------------------------------------------------------------- editing

  private run(label: string, cmd: EditCommand | { error: string }): boolean {
    if ('error' in cmd) {
      this.toast(`Can't ${label.toLowerCase()}: ${cmd.error}`, true);
      return false;
    }
    try {
      this.history.execute(label, cmd);
      return true;
    } catch (e) {
      this.toast(`Can't ${label.toLowerCase()}: ${(e as Error).message}`, true);
      return false;
    }
  }

  private undo(): void {
    const label = this.history.undo();
    this.toast(label ? `Undo: ${label}` : 'Nothing to undo');
  }

  private redo(): void {
    const label = this.history.redo();
    this.toast(label ? `Redo: ${label}` : 'Nothing to redo');
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    if (tool.kind !== 'paint' && tool.kind !== 'edge') this.hoverFace = null;
    if (tool.kind !== 'edge') this.hoverEdge = null;
    for (const b of document.querySelectorAll<HTMLElement>('[data-tool]')) {
      const t = b.dataset.tool;
      b.classList.toggle(
        'active',
        (tool.kind === 'tile' && t === `tile:${tool.tile}`) || (tool.kind === 'pickup' && t === `pickup:${tool.item}`) || (tool.kind === 'scenario' && t === `scenario:${tool.key}`) || (tool.kind === 'edge' && t === `edge:${tool.style}`) || t === tool.kind,
      );
    }
    const hints: Record<Tool['kind'], string> = {
      select: 'Click select · Shift add · Drag move · Del delete · Ctrl+D duplicate · R rotate · F focus',
      tile: 'Click place · R rotate · Right-click erase · PgUp/PgDn level · Esc select tool',
      spawn: 'Click place spawn · R turn 45° · Right-click erase · Esc select tool',
      pickup: 'Click place pickup · Right-click erase · Esc select tool',
      scenario: 'Click place · Doors, walls and lasers snap to doorways · R turn 90° · Right-click erase · L logic',
      paint: 'Click a surface to paint · Right-click resets to theme · Alt-click or I picks a style',
      edge: 'Click a wall or floor edge to build it this way · Right-click resets to auto · O cycles the style',
    };
    $('ed-hint').textContent = `${hints[tool.kind]} · RMB look · WASD/QE fly`;
    this.updateHover();
  }

  private setSelection(sel: Selection): void {
    this.selection = sel;
    this.updateSelectionVisuals();
    this.renderInspector();
  }

  private updateSelectionVisuals(offset?: [number, number, number], bad = false): void {
    this.view.setOutlines(this.doc, this.selection.tiles, offset, bad);
    this.view.setEntities(this.doc, this.level, this.showAll, new Set(this.selection.entities));
  }

  private setLevel(level: number): void {
    this.level = Math.max(-16, Math.min(16, level));
    this.updateHover();
  }

  private placeAtHover(): void {
    if (this.tool.kind === 'tile' && this.hoverCell) {
      const [x, y, z] = this.hoverCell;
      const placement = { id: newId('tile'), tile: this.tool.tile, x, y, z, rotation: this.rotation };
      const check = checkPlacement(this.doc, [placement]);
      if (!check.ok) return this.toast(`Can't place: ${check.reason}`, true);
      const name = coreCatalog.get(this.tool.tile)?.displayName ?? this.tool.tile;
      this.run(`Place ${name}`, { kind: 'addTiles', tiles: [placement] });
    } else if (this.tool.kind === 'spawn' && this.hoverPoint) {
      const p: [number, number, number] = [snap(this.hoverPoint.x, 0.5), this.level * this.doc.classicStructure.levelHeight, snap(this.hoverPoint.z, 0.5)];
      const { command, id } = addSpawnCommand(p, this.spawnYaw);
      if (this.run('Place spawn', command)) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'pickup' && this.hoverPoint) {
      const p: [number, number, number] = [snap(this.hoverPoint.x, 0.5), this.level * this.doc.classicStructure.levelHeight, snap(this.hoverPoint.z, 0.5)];
      const id = newId('pickup');
      const name = getItem(this.tool.item)?.displayName ?? 'pickup';
      if (this.run(`Place ${name}`, { kind: 'addEntities', entities: [{ id, kind: 'pickup', position: p, item: this.tool.item, respawnSeconds: null }] })) this.setSelection({ tiles: [], entities: [id] });
    } else if (this.tool.kind === 'scenario' && this.hoverPoint) {
      const y = this.level * this.doc.classicStructure.levelHeight;
      let p: [number, number, number] = [snap(this.hoverPoint.x, 0.5), y, snap(this.hoverPoint.z, 0.5)];
      let yaw = this.scenarioYaw;
      if (snapsToDoorway(this.tool.key)) {
        const d = snapToDoorway(this.hoverPoint.x, this.hoverPoint.z, this.doc.classicStructure.cellSize);
        p = [d.x, y, d.z];
        yaw = d.yaw;
      }
      const entity = newScenarioEntity(this.tool.key, p, yaw);
      const label = SCENARIO_PALETTE.find((x) => x.key === (this.tool as { key: string }).key)?.label ?? 'object';
      if (this.run(`Place ${label}`, { kind: 'addEntities', entities: [entity] })) this.setSelection({ tiles: [], entities: [entity.id] });
    }
  }

  private eraseAtHover(): void {
    const hit = this.pick();
    if (!hit) return;
    const sel = hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : { tiles: [], entities: [hit.id] };
    this.run(hit.kind === 'tile' ? 'Erase tile' : `Erase ${this.doc.entities.find((e) => e.id === hit.id)?.kind ?? 'item'}`, deleteCommand(this.doc, sel));
  }

  /** Tile and surface slot under the cursor in paint mode. */
  private paintTarget(): { tile: MapDocument['classicStructure']['tiles'][number]; slot: SurfaceSlot } | null {
    const hit = this.hoverFace;
    if (!hit) return null;
    const tile = this.doc.classicStructure.tiles.find((t) => t.id === hit.box.sourceId);
    return tile ? { tile, slot: faceSlot(hit.box, hit.normal) } : null;
  }

  private paintAtHover(clear: boolean): void {
    const target = this.paintTarget();
    if (!target) return;
    const scopeLabel: Record<PaintScope, string> = { surface: '', sameType: ' (all of this piece)', level: ' (whole level)', all: ' (whole map)' };
    const label = `${clear ? 'Reset' : 'Paint'} ${SURFACE_SLOT_LABELS[target.slot].toLowerCase()}${scopeLabel[this.paintScope]}`;
    this.run(label, paintCommand(this.doc, target.tile.id, target.slot, clear ? null : this.paintStyle, this.paintScope));
  }

  /** Wall tool: build the hovered cell side in the given style. */
  private edgeAtHover(style: EdgeStyle): void {
    const target = this.hoverEdge;
    if (!target) return;
    const cmd = setEdgeCommand(this.doc, target, style);
    if ('error' in cmd) return this.toast(cmd.error, true);
    this.run(style === 'auto' ? 'Reset wall' : `Wall: ${EDGE_STYLE_LABELS[style]}`, cmd);
  }

  /** Eyedropper: copy the hovered surface's effective style into the brush. */
  private pickStyleAtHover(): void {
    const target = this.paintTarget();
    if (!target) return;
    const s = resolveSurface(this.doc, target.tile, target.slot);
    this.paintStyle = { material: s.material.id, tint: s.tint };
    this.syncPaintUi();
    this.toast(`Picked ${s.material.displayName}${s.tint ? ` tinted ${s.tint}` : ''}`);
  }

  /** What is under the cursor at the active level: spawns win over tiles. */
  private pick(): { kind: 'tile' | 'entity'; id: string } | null {
    const p = this.hoverPoint;
    if (!p) return null;
    const { levelHeight } = this.doc.classicStructure;
    let best: { id: string; d: number } | null = null;
    for (const e of this.doc.entities) {
      if (Math.floor((e.position[1] + 0.01) / levelHeight) !== this.level) continue;
      const d = Math.hypot(e.position[0] - p.x, e.position[2] - p.z);
      if (d < pickRadius(e) && (!best || d < best.d)) best = { id: e.id, d };
    }
    if (best) return { kind: 'entity', id: best.id };
    const cell = this.hoverCell;
    const tile = cell && tileAt(this.doc, cell[0], cell[1], cell[2]);
    return tile ? { kind: 'tile', id: tile.id } : null;
  }

  private rotate(): void {
    if (this.tool.kind === 'tile') {
      this.rotation = ((this.rotation + 1) % 4) as Rotation;
      this.updateHover();
    } else if (this.tool.kind === 'spawn') {
      this.spawnYaw = normalizeYaw(this.spawnYaw + Math.PI / 4);
    } else if (this.tool.kind === 'scenario') {
      this.scenarioYaw = normalizeYaw(this.scenarioYaw + Math.PI / 2);
      this.toast(`Facing ${Math.round((this.scenarioYaw * 180) / Math.PI)}°`);
    } else if (this.selection.tiles.length || this.selection.entities.length) {
      this.run('Rotate', rotateCommand(this.doc, this.selection));
    }
  }

  private nudge(dx: number, dy: number, dz: number): void {
    if (!this.selection.tiles.length && !this.selection.entities.length) return;
    if (this.selection.tiles.length || dz !== 0) {
      this.run('Move', moveCommand(this.doc, this.selection, dx, dy, dz));
      if (dz) this.setLevel(this.level + dz);
    } else {
      this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx * 0.5, 0, dy * 0.5));
    }
  }

  private deleteSelection(): void {
    if (!this.selection.tiles.length && !this.selection.entities.length) return;
    const n = this.selection.tiles.length + this.selection.entities.length;
    if (this.run(n > 1 ? `Delete ${n} items` : 'Delete', deleteCommand(this.doc, this.selection))) this.setSelection(emptySelection());
  }

  private duplicate(): void {
    const r = duplicateCommand(this.doc, this.selection);
    if ('error' in r) return this.toast(`Can't duplicate: ${r.error}`, true);
    if (this.run('Duplicate', r.command)) this.setSelection(r.selection);
  }

  private focusSelection(): void {
    const target = this.selectionCenter();
    if (target) this.view.focus(target);
  }

  private selectionCenter(): Vec3 | null {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    const pts: Vec3[] = [];
    for (const t of this.doc.classicStructure.tiles) if (this.selection.tiles.includes(t.id)) pts.push({ x: t.x * cellSize, y: t.z * levelHeight, z: t.y * cellSize });
    for (const e of this.doc.entities) if (this.selection.entities.includes(e.id)) pts.push({ x: e.position[0], y: e.position[1], z: e.position[2] });
    if (!pts.length) return null;
    const n = pts.length;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n, z: pts.reduce((s, p) => s + p.z, 0) / n };
  }

  private focusEntity(id: string): void {
    this.focusIssue({ severity: 'suggestion', code: 'focus', message: '', targetId: id });
  }

  /** Select and frame the object a validation issue points at (or open the logic item). */
  private focusIssue(issue: ValidationIssue): void {
    if (!issue.targetId) return;
    const tile = this.doc.classicStructure.tiles.find((t) => t.id === issue.targetId);
    const entity = this.doc.entities.find((e) => e.id === issue.targetId);
    const { logic } = this.doc;
    if (!tile && !entity && [...logic.rules, ...logic.objectives, ...logic.variables, ...logic.timers].some((x) => x.id === issue.targetId)) {
      this.logic.open(issue.targetId);
      return;
    }
    if (tile) {
      this.setLevel(tile.z);
      this.setSelection({ tiles: [tile.id], entities: [] });
    } else if (entity) {
      this.setLevel(Math.floor((entity.position[1] + 0.01) / this.doc.classicStructure.levelHeight));
      this.setSelection({ tiles: [], entities: [entity.id] });
    } else return;
    this.setTool({ kind: 'select' });
    this.focusSelection();
  }

  // ---------------------------------------------------------------- hover / drag

  private updatePointer(clientX: number, clientY: number): void {
    const { cellSize, levelHeight } = this.doc.classicStructure;
    this.hoverPoint = this.view.pickPlane(clientX, clientY, this.level * levelHeight);
    this.hoverCell = this.hoverPoint ? [Math.round(this.hoverPoint.x / cellSize), Math.round(this.hoverPoint.z / cellSize), this.level] : null;
    if (this.tool.kind === 'paint' || this.tool.kind === 'edge') {
      const ray = this.view.pointerRay(clientX, clientY);
      this.hoverFace = ray ? raycastBoxes(ray.origin, ray.dir, this.visibleBoxes) : null;
    } else this.hoverFace = null;
    this.hoverEdge = null;
    if (this.tool.kind === 'edge' && this.hoverFace) {
      const ray = this.view.pointerRay(clientX, clientY)!;
      const d = this.hoverFace.distance;
      const point: [number, number, number] = [ray.origin.x + ray.dir.x * d, ray.origin.y + ray.dir.y * d, ray.origin.z + ray.dir.z * d];
      this.hoverEdge = edgeTargetAt(this.doc, point, this.hoverFace.normal);
    }
    this.updateHover();
  }

  private updateHover(): void {
    if (this.tool.kind === 'edge') {
      const e = this.hoverEdge;
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
    this.view.setFaceHighlight(this.hoverFace?.box ?? null, this.hoverFace?.normal ?? null);
    if (this.tool.kind === 'paint') {
      const target = this.paintTarget();
      $('ed-target').textContent = target ? `${SURFACE_SLOT_LABELS[target.slot]} · ${coreCatalog.get(target.tile.tile)?.displayName ?? target.tile.tile} · ${resolveSurface(this.doc, target.tile, target.slot).material.displayName}` : '';
    } else $('ed-target').textContent = '';
    const cell = this.hoverCell ? ([this.hoverCell[0], this.hoverCell[1], this.level] as [number, number, number]) : null;
    this.view.setHoverCell(this.doc, this.tool.kind === 'tile' || this.tool.kind === 'spawn' || this.tool.kind === 'pickup' || this.tool.kind === 'scenario' ? cell : null);
    if (this.tool.kind === 'tile' && cell) {
      const ok = checkPlacement(this.doc, [{ id: '__ghost', tile: this.tool.tile, x: cell[0], y: cell[1], z: cell[2], rotation: this.rotation }]).ok;
      this.view.setGhost(this.doc, this.tool.tile, cell, this.rotation, ok);
    } else {
      this.view.setGhost(this.doc, null, null, 0, true);
    }
  }

  private updateDrag(): void {
    const d = this.drag;
    if (!d || !this.hoverPoint || !this.hoverCell) return;
    const cellOffset: [number, number] = [this.hoverCell[0] - d.startCell[0], this.hoverCell[1] - d.startCell[1]];
    const freeOffset: [number, number] = [snap(this.hoverPoint.x - d.startPoint.x, 0.5), snap(this.hoverPoint.z - d.startPoint.z, 0.5)];
    d.cellOffset = cellOffset;
    d.freeOffset = freeOffset;
    if (this.selection.tiles.length) {
      const preview = moveCommand(this.doc, this.selection, cellOffset[0], cellOffset[1], 0);
      this.view.setOutlines(this.doc, this.selection.tiles, [cellOffset[0], cellOffset[1], 0], 'error' in preview);
    }
  }

  private endDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.moved) return;
    if (this.selection.tiles.length) {
      const [dx, dy] = d.cellOffset;
      if (dx || dy) this.run('Move', moveCommand(this.doc, this.selection, dx, dy, 0));
    } else {
      const [dx, dz] = d.freeOffset;
      if (dx || dz) this.run('Move', moveEntitiesCommand(this.doc, this.selection.entities, dx, 0, dz));
    }
    this.updateSelectionVisuals();
  }

  // ---------------------------------------------------------------- input

  private bindInput(): void {
    const canvas = () => this.host.canvas;
    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.looking) {
        const dx = e.movementX;
        const dy = e.movementY;
        if (Math.abs(dx) + Math.abs(dy) > 0) this.looking.moved = true;
        if (this.looking.button === 2) this.view.look(dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
        else this.view.fly(0, -dx * 0.05, dy * 0.05);
        return;
      }
      if (e.target !== canvas() && !this.drag) return;
      this.updatePointer(e.clientX, e.clientY);
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
        this.looking = { x: e.clientX, y: e.clientY, moved: false, button: e.button };
        canvas().setPointerCapture(e.pointerId);
        return;
      }
      if (e.button !== 0) return;
      if (this.tool.kind === 'paint') return e.altKey ? this.pickStyleAtHover() : this.paintAtHover(false);
      if (this.tool.kind === 'edge') return this.edgeAtHover(this.tool.style);
      if (this.tool.kind !== 'select') return this.placeAtHover();
      const hit = this.pick();
      if (!hit) {
        if (!e.shiftKey) this.setSelection(emptySelection());
        return;
      }
      const key = hit.kind === 'tile' ? 'tiles' : 'entities';
      const already = this.selection[key].includes(hit.id);
      if (e.shiftKey) {
        const next = { ...this.selection, [key]: already ? this.selection[key].filter((id) => id !== hit.id) : [...this.selection[key], hit.id] };
        this.setSelection(next);
        return;
      }
      if (!already) this.setSelection(hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : { tiles: [], entities: [hit.id] });
      if (this.hoverPoint && this.hoverCell) {
        this.drag = { startCell: [this.hoverCell[0], this.hoverCell[1]], startPoint: { ...this.hoverPoint }, pointerX: e.clientX, pointerY: e.clientY, moved: false, cellOffset: [0, 0], freeOffset: [0, 0] };
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.active) return;
      if (this.looking && (e.button === 2 || e.button === 1)) {
        const wasClick = !this.looking.moved && e.button === 2;
        this.looking = null;
        if (wasClick && this.tool.kind === 'paint') {
          this.updatePointer(e.clientX, e.clientY);
          this.paintAtHover(true);
        } else if (wasClick && this.tool.kind === 'edge') {
          this.updatePointer(e.clientX, e.clientY);
          this.edgeAtHover('auto');
        } else if (wasClick && this.tool.kind !== 'select') {
          this.updatePointer(e.clientX, e.clientY);
          this.eraseAtHover();
        }
        return;
      }
      if (e.button === 0) this.endDrag();
    });
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.active || e.target !== canvas()) return;
        e.preventDefault();
        this.view.dolly(-Math.sign(e.deltaY) * 3 * (e.shiftKey ? 3 : 1));
        this.updatePointer(e.clientX, e.clientY);
      },
      { passive: false },
    );
    window.addEventListener('contextmenu', (e) => {
      if (this.active && e.target === canvas()) e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.looking = null;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'F5') {
        e.preventDefault();
        this.test();
        return;
      }
      if (isTyping()) return;
      this.keys.add(e.code);
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = e.code;
        if (k === 'KeyZ' && e.shiftKey) this.redo();
        else if (k === 'KeyZ') this.undo();
        else if (k === 'KeyY') this.redo();
        else if (k === 'KeyS') this.save();
        else if (k === 'KeyD') this.duplicate();
        else return;
        e.preventDefault();
        return;
      }
      switch (e.code) {
        case 'KeyR':
          this.rotate();
          break;
        case 'KeyF':
          this.focusSelection();
          break;
        case 'KeyL':
          this.logic.toggle();
          break;
        case 'KeyB':
          this.setTool({ kind: 'paint' });
          break;
        case 'KeyO': {
          // Wall tool; pressed again, cycle through the styles.
          const styles = EDGE_STYLES.filter((x) => x !== 'auto');
          const next = this.tool.kind === 'edge' ? styles[(styles.indexOf(this.tool.style as (typeof styles)[number]) + 1) % styles.length]! : 'window';
          this.setTool({ kind: 'edge', style: next });
          break;
        }
        case 'KeyI':
          if (this.tool.kind === 'paint') this.pickStyleAtHover();
          break;
        case 'KeyV':
        case 'Escape':
          if (this.tool.kind === 'select') this.setSelection(emptySelection());
          this.setTool({ kind: 'select' });
          break;
        case 'KeyH':
          this.showAll = !this.showAll;
          $<HTMLInputElement>('ed-showall').checked = this.showAll;
          break;
        case 'Delete':
        case 'Backspace':
          this.deleteSelection();
          break;
        case 'PageUp':
        case 'BracketRight':
          if (e.shiftKey) this.nudge(0, 0, 1);
          else this.setLevel(this.level + 1);
          break;
        case 'PageDown':
        case 'BracketLeft':
          if (e.shiftKey) this.nudge(0, 0, -1);
          else this.setLevel(this.level - 1);
          break;
        case 'ArrowUp':
          this.nudge(0, 1, 0);
          break;
        case 'ArrowDown':
          this.nudge(0, -1, 0);
          break;
        case 'ArrowLeft':
          this.nudge(-1, 0, 0);
          break;
        case 'ArrowRight':
          this.nudge(1, 0, 0);
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  }

  // ---------------------------------------------------------------- UI

  private buildPalette(): void {
    const tools = $('ed-tools');
    const selectBtn = button('Select (V)', () => this.setTool({ kind: 'select' }));
    selectBtn.dataset.tool = 'select';
    const paintBtn = button('Paint (B)', () => this.setTool({ kind: 'paint' }));
    paintBtn.dataset.tool = 'paint';
    tools.append(selectBtn, paintBtn);
    this.buildPaintPalette();

    const tiles = $('ed-tiles');
    for (const category of TILE_CATEGORIES) {
      const head = document.createElement('div');
      head.className = 'tile-cat';
      head.textContent = category;
      tiles.append(head, ...coreCatalog.all().filter((d) => d.category === category).map((d) => this.paletteButton(d)));
    }
    const edges = $('ed-edges');
    for (const style of EDGE_STYLES) {
      const b = document.createElement('button');
      b.className = 'tile-btn edge-btn';
      b.dataset.tool = `edge:${style}`;
      b.dataset.search = `${EDGE_STYLE_LABELS[style]} wall side opening`.toLowerCase();
      b.innerHTML = `${edgeIcon(style)}${escapeHtml(EDGE_STYLE_LABELS[style])}`;
      b.title = style === 'auto' ? 'Back to the automatic wall or doorway' : `Build a side as: ${EDGE_STYLE_LABELS[style]}`;
      b.addEventListener('click', () => this.setTool({ kind: 'edge', style }));
      edges.append(b);
    }
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'tile-btn';
    spawnBtn.dataset.tool = 'spawn';
    spawnBtn.dataset.search = 'spawn player start';
    spawnBtn.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="30" r="12" fill="#4fb3ff"/><rect x="22" y="14" width="12" height="6" rx="2" fill="#1c1f26"/></svg>Player Spawn`;
    spawnBtn.addEventListener('click', () => this.setTool({ kind: 'spawn' }));
    $('ed-entities').append(spawnBtn);
    for (const entry of SCENARIO_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `scenario:${entry.key}`;
      b.dataset.search = `${entry.label} ${entry.search}`.toLowerCase();
      b.innerHTML = `<svg viewBox="0 0 56 56">${SCENARIO_ICONS[entry.key]}</svg>${escapeHtml(entry.label)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'scenario', key: entry.key }));
      $('ed-scenario').append(b);
    }
    for (const item of CORE_ITEMS) {
      const b = document.createElement('button');
      b.className = 'tile-btn';
      b.dataset.tool = `pickup:${item.id}`;
      b.dataset.search = `${item.displayName} ${item.id} pickup ${item.effect.kind}`.toLowerCase();
      b.innerHTML = `${itemIcon(item.id)}${escapeHtml(item.displayName)}`;
      b.addEventListener('click', () => this.setTool({ kind: 'pickup', item: item.id }));
      $('ed-entities').append(b);
    }

    $<HTMLInputElement>('ed-search').addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      for (const b of document.querySelectorAll<HTMLElement>('#ed-palette .tile-btn, #ed-palette .mat-btn')) b.hidden = !!q && !(b.dataset.search ?? '').includes(q);
    });
    this.setTool({ kind: 'select' });
  }

  private buildPaintPalette(): void {
    const mats = $('ed-materials');
    let category = '';
    for (const def of coreMaterials.all()) {
      if (def.category !== category) {
        category = def.category;
        const h = document.createElement('div');
        h.className = 'mat-cat';
        h.textContent = category;
        mats.append(h);
      }
      const b = document.createElement('button');
      b.className = 'mat-btn';
      b.dataset.material = def.id;
      b.dataset.search = `${def.displayName} ${def.category} ${def.id}`.toLowerCase();
      b.title = def.displayName;
      b.innerHTML = `<img alt="" src="${materialThumbnail(def)}"><span>${def.displayName}</span>`;
      b.addEventListener('click', () => {
        this.paintStyle = { ...this.paintStyle, material: def.id };
        this.setTool({ kind: 'paint' });
        this.syncPaintUi();
      });
      mats.append(b);
    }
    const tints = $('ed-tints');
    const none = document.createElement('button');
    none.className = 'swatch none';
    none.title = 'No tint';
    none.dataset.tint = '';
    tints.append(none);
    for (const t of TINT_SWATCHES) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = t;
      b.title = t;
      b.dataset.tint = t;
      tints.append(b);
    }
    tints.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).dataset.tint;
      if (t === undefined) return;
      this.paintStyle = { ...this.paintStyle, tint: t || null };
      this.setTool({ kind: 'paint' });
      this.syncPaintUi();
    });
    $<HTMLInputElement>('ed-tint-custom').addEventListener('input', (e) => {
      this.paintStyle = { ...this.paintStyle, tint: (e.target as HTMLInputElement).value.toLowerCase() };
      this.setTool({ kind: 'paint' });
      this.syncPaintUi();
    });
    $<HTMLSelectElement>('ed-scope').addEventListener('change', (e) => (this.paintScope = (e.target as HTMLSelectElement).value as PaintScope));
    this.syncPaintUi();
  }

  /** Reflect the current brush in the palette. */
  private syncPaintUi(): void {
    for (const b of document.querySelectorAll<HTMLElement>('.mat-btn')) b.classList.toggle('active', b.dataset.material === this.paintStyle.material);
    for (const b of document.querySelectorAll<HTMLElement>('#ed-tints .swatch')) b.classList.toggle('active', (b.dataset.tint || null) === (this.paintStyle.tint ?? null));
    const def = coreMaterials.get(this.paintStyle.material);
    const brush = $<HTMLImageElement>('ed-brush');
    if (def) brush.src = materialThumbnail(def, this.paintStyle.tint ?? null, 40);
    $('ed-brush-label').textContent = `${def?.displayName ?? this.paintStyle.material}${this.paintStyle.tint ? ` · ${this.paintStyle.tint}` : ''}`;
    if (this.paintStyle.tint) $<HTMLInputElement>('ed-tint-custom').value = this.paintStyle.tint;
  }

  private paletteButton(def: TileDefinition): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'tile-btn';
    b.dataset.tool = `tile:${def.id}`;
    b.dataset.search = `${def.displayName} ${def.id} ${def.category} ${def.blurb ?? ''}`.toLowerCase();
    b.innerHTML = `${tileIcon(def)}${def.displayName}`;
    const size = (() => {
      const span = (i: 0 | 1 | 2) => Math.max(...def.cells.map((c) => c[i])) - Math.min(...def.cells.map((c) => c[i])) + 1;
      return `${span(0)} × ${span(1)} × ${span(2)}`;
    })();
    b.title = `${def.displayName}\n${def.blurb ?? ''}\nSize ${size} cells · ${def.ports.length} connectors`.trim();
    b.addEventListener('click', () => this.setTool({ kind: 'tile', tile: def.id }));
    return b;
  }

  private bindUi(): void {
    $('ed-home').addEventListener('click', () => this.host.goHome());
    $('ed-undo').addEventListener('click', () => this.undo());
    $('ed-redo').addEventListener('click', () => this.redo());
    $('ed-save').addEventListener('click', () => this.save());
    $('ed-export').addEventListener('click', () => exportMap(this.doc));
    $('ed-new').addEventListener('click', () => {
      if (this.isDirty() && !confirm('Discard unsaved changes and start a new map?')) return;
      this.replaceDocument(newMapDocument('Untitled Map'));
    });
    $('ed-open').addEventListener('click', () => this.openDialog());
    $('ed-import').addEventListener('click', () => $('ed-import-file').click());
    $<HTMLInputElement>('ed-import-file').addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (!file) return;
      const r = await importMapFile(file);
      if (!('map' in r)) return this.toast(`Import failed: ${r.issues[0]?.message ?? 'unknown error'}`, true);
      this.replaceDocument(r.map);
      this.toast(`Imported ${r.map.metadata.name}`);
    });
    $('ed-test').addEventListener('click', () => this.test());
    $('ed-logic-btn').addEventListener('click', () => this.logic.toggle());
    $('ed-build-btn').addEventListener('click', () => this.logic.close());
    $('ed-status').addEventListener('click', () => $('ed-issues').scrollIntoView({ behavior: 'smooth' }));
    $('ed-level-up').addEventListener('click', () => this.setLevel(this.level + 1));
    $('ed-level-down').addEventListener('click', () => this.setLevel(this.level - 1));
    $<HTMLInputElement>('ed-showall').addEventListener('change', (e) => (this.showAll = (e.target as HTMLInputElement).checked));

    const name = $<HTMLInputElement>('ed-name');
    name.addEventListener('change', () => {
      const v = name.value.trim().slice(0, 80) || 'Untitled Map';
      if (v !== this.doc.metadata.name) this.run('Rename map', { kind: 'setMetadata', before: { name: this.doc.metadata.name }, after: { name: v } });
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });

    const bots = $<HTMLSelectElement>('ed-bots');
    for (let i = 0; i <= 15; i++) bots.append(new Option(String(i), String(i), i === 3, i === 3));
  }

  private updateTopBar(): void {
    const name = $<HTMLInputElement>('ed-name');
    if (document.activeElement !== name) name.value = this.doc.metadata.name;
    $('ed-dirty').classList.toggle('on', this.isDirty());
    $<HTMLButtonElement>('ed-undo').disabled = !this.history.canUndo;
    $<HTMLButtonElement>('ed-redo').disabled = !this.history.canRedo;
    $('ed-undo').title = this.history.undoLabel ? `Undo ${this.history.undoLabel} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    $('ed-redo').title = this.history.redoLabel ? `Redo ${this.history.redoLabel} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
  }

  private updateCounts(): void {
    const tiles = this.doc.classicStructure.tiles.length;
    const spawns = this.doc.entities.filter((e) => e.kind === 'spawn').length;
    const pickups = this.doc.entities.filter((e) => e.kind === 'pickup').length;
    const npcs = this.doc.entities.filter((e) => e.kind === 'encounter').length;
    const scenario = this.doc.entities.length - spawns - pickups - npcs;
    const rules = this.doc.logic.rules.length;
    const boxes = buildMapGeometry(this.doc).length;
    $('ed-counts').textContent = `${tiles} tiles · ${spawns} spawns · ${pickups} pickups · ${scenario} scenario objects · ${npcs} NPC squads · ${rules} rules · ${boxes} collision boxes`;
  }

  private renderInspector(): void {
    const el = $('ed-inspector');
    el.replaceChildren();
    const { tiles, entities } = this.selection;
    const doc = this.doc;
    if (tiles.length + entities.length === 0) {
      el.append(h2('Map'));
      const desc = document.createElement('textarea');
      desc.rows = 3;
      desc.value = doc.metadata.description;
      desc.placeholder = 'Description';
      desc.addEventListener('change', () => this.run('Edit description', { kind: 'setMetadata', before: { description: doc.metadata.description }, after: { description: desc.value.slice(0, 2000) } }));
      el.append(desc);
      const rp = doc.metadata.recommendedPlayers;
      const setPlayers = (min: number, max: number) =>
        this.run('Set player count', { kind: 'setMetadata', before: { recommendedPlayers: rp }, after: { recommendedPlayers: { min: Math.max(1, Math.min(32, min)), max: Math.max(1, Math.min(32, max)) } } });
      el.append(row('Min players', numberInput(rp.min, 1, (v) => setPlayers(v, rp.max))), row('Max players', numberInput(rp.max, 1, (v) => setPlayers(rp.min, v))));
      const mode = document.createElement('select');
      const current = doc.metadata.supportedModes[0] ?? 'core.deathmatch';
      for (const [id, label] of [['core.deathmatch', 'Deathmatch'], ['core.tdm', 'Team Deathmatch'], ['core.coop', 'Co-op mission']] as const) mode.append(new Option(label, id, false, id === current));
      mode.addEventListener('change', () => this.run('Change mode', { kind: 'setMetadata', before: { supportedModes: doc.metadata.supportedModes }, after: { supportedModes: [mode.value] } }));
      const teams = mapTeams(doc);
      const help: Record<string, string> = {
        'core.coop': 'Co-op: all players (and bots) team up against the NPC squads. Logic ends the mission with "players win" or "players lose".',
        'core.tdm': `Team Deathmatch: ${teams[0].name} against ${teams[1].name} (the first two factions, if the map names them). Give spawns a team in their inspector.`,
        'core.deathmatch': 'Deathmatch: everyone for themselves. NPC squads fight everyone.',
      };
      el.append(row('Mode', mode), small(help[mode.value] ?? ''));
      const theme = document.createElement('select');
      for (const t of coreThemes.all()) theme.append(new Option(t.displayName, t.id, false, t.id === doc.classicStructure.theme));
      theme.addEventListener('change', () => this.run('Change theme', setThemeCommand(this.doc, theme.value)));
      el.append(row('Theme', theme), small('The theme is the default look; painted surfaces keep their own style.'));
      return;
    }
    if (tiles.length === 1 && entities.length === 0) {
      const t = doc.classicStructure.tiles.find((x) => x.id === tiles[0])!;
      el.append(h2(coreCatalog.get(t.tile)?.displayName ?? t.tile));
      const type = document.createElement('select');
      for (const def of coreCatalog.all()) type.append(new Option(def.displayName, def.id, false, def.id === t.tile));
      type.addEventListener('change', () => this.run('Replace tile', updateTileCommand(doc, t, { ...t, tile: type.value })));
      const set = (patch: Partial<typeof t>) => this.run('Edit tile', updateTileCommand(doc, t, { ...t, ...patch }));
      el.append(
        row('Type', type),
        row('X', numberInput(t.x, 1, (v) => set({ x: v }))),
        row('Y', numberInput(t.y, 1, (v) => set({ y: v }))),
        row('Level', numberInput(t.z, 1, (v) => set({ z: v }))),
        row('Rotation', text(`${t.rotation * 90}°`)),
      );
      const def = coreCatalog.get(t.tile);
      const wallsHead = document.createElement('h3');
      wallsHead.textContent = 'Walls';
      el.append(wallsHead);
      if (def && def.cells.length === 1) {
        for (const side of SIDES) {
          const target = { cell: [t.x, t.y, t.z] as [number, number, number], side };
          const sel = document.createElement('select');
          const now = edgeChoiceAt(doc, target);
          for (const style of EDGE_STYLES) sel.append(new Option(EDGE_STYLE_LABELS[style], style, false, style === now));
          sel.addEventListener('change', () => {
            const cmd = setEdgeCommand(this.doc, target, sel.value as EdgeStyle);
            if ('error' in cmd) this.toast(cmd.error, true);
            else this.run(`Wall: ${EDGE_STYLE_LABELS[sel.value as EdgeStyle]}`, cmd);
          });
          el.append(row({ N: 'North', E: 'East', S: 'South', W: 'West' }[side], sel));
        }
      } else el.append(small('Use the Walls & Openings tool (O) to change any side of this piece.'));
      const h3 = document.createElement('h3');
      h3.textContent = 'Surfaces';
      el.append(h3);
      for (const slot of SURFACE_SLOTS) el.append(this.surfaceRow(t, slot));
      el.append(small(`ID ${t.id}`));
    } else if (entities.length === 1 && tiles.length === 0) {
      this.entityInspector(el, doc.entities.find((x) => x.id === entities[0])!);
    } else {
      el.append(h2(`${tiles.length + entities.length} selected`));
      el.append(text(`${tiles.length} tiles, ${entities.length} entities`));
    }
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.append(button('Rotate (R)', () => this.run('Rotate', rotateCommand(this.doc, this.selection))), button('Duplicate', () => this.duplicate()), button('Delete', () => this.deleteSelection()), button('Focus (F)', () => this.focusSelection()));
    el.append(buttons);
  }

  /** Inspector fields for one entity: position, facing and its kind's settings. */
  private entityInspector(el: HTMLElement, e: MapEntity): void {
    const doc = this.doc;
    const update = (label: string, patch: Partial<MapEntity>) => this.run(label, { kind: 'updateEntities', before: [e], after: [{ ...e, ...patch } as MapEntity] });
    el.append(h2(e.kind === 'spawn' ? 'Player Spawn' : e.kind === 'pickup' ? (getItem(e.item)?.displayName ?? e.item) : entityLabel(doc, e)));
    if (e.kind !== 'spawn' && e.kind !== 'pickup') {
      const name = document.createElement('input');
      name.type = 'text';
      name.value = e.name ?? '';
      name.placeholder = entityLabel(doc, { ...e, name: undefined });
      name.maxLength = 40;
      name.addEventListener('change', () => update('Rename', { name: name.value.trim() || undefined }));
      el.append(row('Name', name));
    }
    const setPos = (i: number, v: number) => {
      const position = [...e.position] as [number, number, number];
      position[i] = v;
      update(`Move ${e.kind}`, { position });
    };
    el.append(
      row('X', numberInput(e.position[0], 0.5, (v) => setPos(0, v))),
      row('Height', numberInput(e.position[1], 0.25, (v) => setPos(1, v))),
      row('Z', numberInput(e.position[2], 0.5, (v) => setPos(2, v))),
    );
    if ('yaw' in e) el.append(row('Facing °', numberInput(Math.round((e.yaw * 180) / Math.PI), e.kind === 'spawn' ? 15 : 90, (deg) => update('Turn', { yaw: normalizeYaw((deg * Math.PI) / 180) }))));

    const toggle = (label: string, value: boolean, patch: (v: boolean) => Partial<MapEntity>) => {
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = value;
      c.addEventListener('change', () => update(`Set ${label.toLowerCase()}`, patch(c.checked)));
      el.append(row(label, c));
    };
    const choose = (label: string, options: readonly (readonly [string, string])[], value: string, patch: (v: string) => Partial<MapEntity>) => {
      const sel = document.createElement('select');
      for (const [v, l] of options) sel.append(new Option(l, v, false, v === value));
      sel.addEventListener('change', () => update(`Set ${label.toLowerCase()}`, patch(sel.value)));
      el.append(row(label, sel));
    };
    const number = (label: string, value: number, step: number, patch: (v: number) => Partial<MapEntity>) => el.append(row(label, numberInput(value, step, (v) => update(`Set ${label.toLowerCase()}`, patch(v)))));
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    switch (e.kind) {
      case 'pickup': {
        choose('Item', CORE_ITEMS.map((it) => [it.id, it.displayName] as const), e.item, (v) => ({ item: v }));
        const def = getItem(e.item)?.respawnSeconds ?? 0;
        number('Respawn (s)', e.respawnSeconds ?? def, 5, (v) => ({ respawnSeconds: v === def ? null : clamp(v, 1, 600) }));
        el.append(small(e.respawnSeconds === null ? `Item default (${def}s)` : 'Custom respawn time'));
        break;
      }
      case 'door':
        toggle('Opens by itself', e.auto, (v) => ({ auto: v }));
        toggle('Locked', e.locked, (v) => ({ locked: v }));
        toggle('Starts open', e.startOpen, (v) => ({ startOpen: v }));
        el.append(small(e.auto ? 'Slides open when a player comes close (unless locked).' : 'Players press E to open it, or logic opens it.'));
        break;
      case 'button':
        {
          const label = document.createElement('input');
          label.type = 'text';
          label.value = e.label;
          label.maxLength = 40;
          label.addEventListener('change', () => update('Set prompt', { label: label.value.trim() || 'Press' }));
          el.append(row('Prompt', label));
        }
        toggle('Single use', e.once, (v) => ({ once: v }));
        number('Cooldown (s)', e.cooldownSeconds, 0.5, (v) => ({ cooldownSeconds: clamp(v, 0.2, 60) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        break;
      case 'destructible': {
        const spec = DESTRUCTIBLE_SPECS[e.model];
        choose('Model', DESTRUCTIBLE_MODELS.map((m) => [m, DESTRUCTIBLE_SPECS[m].label] as const), e.model, (v) => ({ model: v as typeof e.model, health: null }));
        number('Health', e.health ?? spec.health, 10, (v) => ({ health: v === spec.health ? null : clamp(v, 1, 5000) }));
        toggle('Explosives only', e.explosiveOnly, (v) => ({ explosiveOnly: v }));
        if (spec.blast) el.append(small('Explodes when destroyed.'));
        break;
      }
      case 'zone':
        number('Width (X)', e.size[0], 0.5, (v) => ({ size: [clamp(v, 0.5, 64), e.size[1], e.size[2]] }));
        number('Height', e.size[1], 0.5, (v) => ({ size: [e.size[0], clamp(v, 0.5, 32), e.size[2]] }));
        number('Depth (Z)', e.size[2], 0.5, (v) => ({ size: [e.size[0], e.size[1], clamp(v, 0.5, 64)] }));
        choose('Fires when', [['any', 'any player enters'], ['count', 'enough players are in'], ['all', 'every living player is in']], e.who, (v) => ({ who: v as typeof e.who }));
        if (e.who === 'count') number('Players needed', e.count, 1, (v) => ({ count: clamp(Math.round(v), 1, 32) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        break;
      case 'trap': {
        const spec = TRAP_SPECS[e.trap];
        choose('Trap', TRAP_KINDS.map((k) => [k, TRAP_SPECS[k].label] as const), e.trap, (v) => {
          const d = TRAP_SPECS[v as typeof e.trap].defaults;
          return { trap: v as typeof e.trap, activation: d.activation, onSeconds: d.onSeconds, offSeconds: d.offSeconds, damage: null };
        });
        const labels: Record<(typeof TRAP_ACTIVATIONS)[number], string> = { always: 'always on', cycle: 'on a cycle', proximity: 'when stepped on', logic: 'only from logic' };
        if (e.trap !== 'mine') choose('Fires', TRAP_ACTIVATIONS.map((a) => [a, labels[a]] as const), e.activation, (v) => ({ activation: v as typeof e.activation }));
        if (e.activation !== 'always' || e.trap === 'mine') number(e.trap === 'mine' ? 'Rearm (s)' : 'Off (s)', e.offSeconds, 0.5, (v) => ({ offSeconds: clamp(v, 0.2, 600) }));
        if (e.trap !== 'mine' && e.activation !== 'always') number('On (s)', e.onSeconds, 0.5, (v) => ({ onSeconds: clamp(v, 0.2, 60) }));
        if (e.activation === 'cycle' && e.trap !== 'mine') number('Offset (s)', e.offsetSeconds, 0.25, (v) => ({ offsetSeconds: clamp(v, 0, 60) }));
        number('Damage', e.damage ?? spec.blast?.damage ?? spec.damage, 5, (v) => ({ damage: v === (spec.blast?.damage ?? spec.damage) ? null : clamp(v, 1, 1000) }));
        toggle('Starts enabled', e.startEnabled, (v) => ({ startEnabled: v }));
        break;
      }
      case 'encounter': {
        const factions = mapFactions(doc);
        choose('Faction', factions.map((f) => [f.id, f.name] as const), e.faction, (v) => ({ faction: v }));
        for (const role of NPC_ROLES) number(`${NPC_ROLE_SPECS[role].label}s`, e.roster[role], 1, (v) => ({ roster: { ...e.roster, [role]: clamp(Math.round(v), 0, 16) } }));
        number('Max alive', e.activeCap, 1, (v) => ({ activeCap: clamp(Math.round(v), 1, 32) }));
        number('Reinforcements', e.reinforcements, 1, (v) => ({ reinforcements: clamp(Math.round(v), 0, 500) }));
        number('+ per extra player', e.perPlayer, 1, (v) => ({ perPlayer: clamp(Math.round(v), 0, 16) }));
        number('Reinforce every (s)', e.respawnSeconds, 1, (v) => ({ respawnSeconds: clamp(v, 0.5, 120) }));
        number('Spawn radius (m)', e.radius, 0.5, (v) => ({ radius: clamp(v, 1, 16) }));
        const orderLabels: Record<(typeof SQUAD_ORDERS)[number], string> = { hold: 'hold here', attack: 'hunt the enemy', defend: 'defend the target', patrol: 'patrol to the target and back', follow: 'follow the players (allies)' };
        choose('Order', SQUAD_ORDERS.map((o) => [o, orderLabels[o]] as const), e.order, (v) => ({ order: v as typeof e.order }));
        if (e.order === 'defend' || e.order === 'patrol') {
          choose('Target', [['', '— choose —'] as const, ...doc.entities.filter((o) => o.id !== e.id && o.kind !== 'spawn').map((o) => [o.id, entityLabel(doc, o)] as const)], e.orderTarget ?? '', (v) => ({ orderTarget: v || null }));
        }
        choose('Skill', [['easy', 'easy'], ['normal', 'normal'], ['hard', 'hard']], e.difficulty, (v) => ({ difficulty: v as typeof e.difficulty }));
        toggle('Active at start', e.startActive, (v) => ({ startActive: v }));
        el.append(small(`${e.roster.trooper + e.roster.gunner + e.roster.heavy} in the first wave, then ${e.reinforcements} reinforcements (+${e.perPlayer} per extra player). Factions are edited in the Logic panel (L).`));
        break;
      }
      case 'spawn': {
        const teams = mapTeams(doc);
        choose('Team', [['', 'Any (shared)'] as const, ...teams.map((t) => [t.id, t.name] as const)], e.faction ?? '', (v) => ({ faction: v || null }));
        el.append(small(doc.metadata.supportedModes[0] === 'core.tdm' ? 'In Team Deathmatch a team spawns on its own points; shared points are used when a team has none.' : 'Teams only matter in Team Deathmatch.'));
        break;
      }
    }

    // Rules that mention this entity, and a shortcut to add one.
    if (e.kind !== 'spawn') {
      const rules = doc.logic.rules.filter((r) => r.when.target === e.id || r.if.some((c) => c.target === e.id) || r.do.some((a) => a.target === e.id));
      const h3 = document.createElement('h3');
      h3.textContent = 'Logic';
      el.append(h3);
      for (const r of rules) {
        const b = button(`⚙ ${r.name || r.id}`, () => this.logic.open(r.id));
        b.className = 'rule-link';
        el.append(b);
      }
      if (!rules.length) el.append(small('No rules use this yet.'));
      el.append(button('+ Add rule for this', () => this.logic.addRuleFor(e)));
    }
    el.append(small(`ID ${e.id}`));
  }

  /** One surface slot in the tile inspector: material (or theme default) and tint. */
  private surfaceRow(t: MapDocument['classicStructure']['tiles'][number], slot: SurfaceSlot): HTMLElement {
    const current = t.surfaces?.[slot];
    const mat = document.createElement('select');
    mat.append(new Option(`Theme (${resolveSurface({ ...this.doc }, undefined, slot).material.displayName})`, '', false, !current));
    for (const def of coreMaterials.all()) mat.append(new Option(def.displayName, def.id, false, current?.material === def.id));
    const tint = document.createElement('input');
    tint.type = 'color';
    tint.value = current?.tint ?? '#ffffff';
    tint.disabled = !current;
    tint.title = 'Tint';
    const apply = (style: SurfaceStyle | null) => this.run(`Paint ${SURFACE_SLOT_LABELS[slot].toLowerCase()}`, paintCommand(this.doc, t.id, slot, style));
    mat.addEventListener('change', () => apply(mat.value ? { material: mat.value, tint: current?.tint ?? null } : null));
    tint.addEventListener('change', () => current && apply({ material: current.material, tint: tint.value.toLowerCase() }));
    const wrap = document.createElement('div');
    wrap.className = 'surface-row';
    wrap.append(text(SURFACE_SLOT_LABELS[slot]), mat, tint);
    return wrap;
  }

  // ---------------------------------------------------------------- validation

  private validate(): void {
    this.issues = validateMap(this.doc);
    this.renderIssues();
    clearTimeout(this.navTimer);
    const token = ++this.navToken;
    const doc = this.doc;
    if (this.issues.some((i) => i.severity === 'error')) {
      this.navIssues = [];
      this.renderIssues();
      return;
    }
    this.navTimer = window.setTimeout(async () => {
      const { NavWorld, initNavigation, validateNavigation } = await import('@chronosplit/shared/match');
      await initNavigation();
      if (token !== this.navToken) return;
      try {
        const nav = NavWorld.build(buildMapGeometry(doc));
        this.navIssues = validateNavigation(doc, nav);
        nav.destroy();
      } catch (e) {
        this.navIssues = [{ severity: 'warning', code: 'nav.failed', message: `navigation could not be generated: ${(e as Error).message}` }];
      }
      this.renderIssues();
    }, 400);
  }

  private allIssues(): ValidationIssue[] {
    const order = { error: 0, warning: 1, suggestion: 2 } as const;
    return [...this.issues, ...this.navIssues].sort((a, b) => order[a.severity] - order[b.severity]);
  }

  private renderIssues(): void {
    const issues = this.allIssues();
    const list = $('ed-issues');
    list.replaceChildren();
    if (!issues.length) {
      const li = document.createElement('li');
      li.className = 'none';
      li.textContent = 'No problems found. Ready to test.';
      list.append(li);
    }
    for (const issue of issues) {
      const li = document.createElement('li');
      li.className = issue.severity;
      li.textContent = issue.message;
      li.title = issue.code;
      li.addEventListener('click', () => this.focusIssue(issue));
      list.append(li);
    }
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const pill = $('ed-status');
    pill.className = `pill ${errors ? 'err' : warnings ? 'warn' : 'ok'}`;
    pill.textContent = errors ? `${errors} error${errors > 1 ? 's' : ''}` : warnings ? `${warnings} warning${warnings > 1 ? 's' : ''}` : '✓ Ready';
  }

  // ---------------------------------------------------------------- persistence / test

  private isDirty(): boolean {
    return this.history.revision !== this.savedRevision;
  }

  private scheduleAutosave(): void {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => writeAutosave(this.doc), 400);
  }

  private save(): void {
    const stored = saveToLibrary(this.doc);
    if (!stored) return this.toast('Could not save to browser storage — use Export to keep a copy', true);
    this.savedRevision = this.history.revision;
    this.updateTopBar();
    this.toast(`Saved "${stored.metadata.name}"`);
  }

  private replaceDocument(doc: MapDocument): void {
    this.history.reset(doc);
    this.savedRevision = this.history.revision;
    this.selection = emptySelection();
    this.setLevel(0);
    this.view.focus({ x: 0, y: 0, z: 0 });
    this.refresh(true);
    writeAutosave(doc);
  }

  private openDialog(): void {
    const dialog = $<HTMLDialogElement>('ed-open-dialog');
    const list = $('ed-library');
    list.replaceChildren();
    const add = (label: string, sub: string, open: () => void, remove?: () => void) => {
      const li = document.createElement('li');
      const b = button('', () => {
        if (this.isDirty() && !confirm('Discard unsaved changes?')) return;
        dialog.close();
        open();
      });
      b.innerHTML = `${escapeHtml(label)}<br><small>${escapeHtml(sub)}</small>`;
      li.append(b);
      if (remove) li.append(button('Delete', () => confirm(`Delete "${label}" from this browser?`) && (remove(), this.openDialog())));
      list.append(li);
    };
    add('Phase 0 Arena', 'Template', () => {
      const r = loadMap(arenaTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Arena Remix', parentId: r.map.metadata.id } });
    });
    add('The Vault', 'Template · scenario with doors, traps and logic', () => {
      const r = loadMap(vaultTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Vault Remix', parentId: r.map.metadata.id } });
    });
    add('Outpost Siege', 'Template · co-op mission with NPC squads and factions', () => {
      const r = loadMap(outpostTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Outpost Remix', parentId: r.map.metadata.id } });
    });
    add('Sandgate', 'Template · desert town for Team Deathmatch, with open courtyards', () => {
      const r = loadMap(sandgateTemplate);
      if (r.ok) this.replaceDocument({ ...r.map, metadata: { ...r.map.metadata, id: newId('map'), name: 'Sandgate Remix', parentId: r.map.metadata.id } });
    });
    for (const entry of listLibrary()) {
      add(entry.name, `Saved ${new Date(entry.updatedAt).toLocaleString()}`, () => {
        const r = openFromLibrary(entry.id);
        if ('map' in r) {
          this.replaceDocument(r.map);
          this.toast(`Opened "${r.map.metadata.name}"`);
        } else this.toast(`Could not open: ${r.issues[0]?.message}`, true);
      }, () => deleteFromLibrary(entry.id));
    }
    dialog.showModal();
  }

  test(): void {
    const errors = this.allIssues().filter((i) => i.severity === 'error');
    if (errors.length) {
      this.toast(`Fix ${errors.length} error${errors.length > 1 ? 's' : ''} before testing: ${errors[0]!.message}`, true);
      return;
    }
    const botCount = Number($<HTMLSelectElement>('ed-bots').value);
    const difficulty = $<HTMLSelectElement>('ed-skill').value as TestRequest['difficulty'];
    this.host.startTest({ map: this.doc, botFill: botCount + 1, difficulty });
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

// ---------------------------------------------------------------- tiny DOM helpers

function isTyping(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') && (el as HTMLInputElement).type !== 'checkbox';
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function h2(t: string): HTMLElement {
  const e = document.createElement('h2');
  e.textContent = t;
  return e;
}

function text(t: string): HTMLElement {
  const e = document.createElement('span');
  e.textContent = t;
  return e;
}

function small(t: string): HTMLElement {
  const e = document.createElement('small');
  e.style.color = 'var(--muted)';
  e.textContent = t;
  return e;
}

function row(label: string, control: HTMLElement): HTMLElement {
  const r = document.createElement('div');
  r.className = 'row';
  r.append(text(label), control);
  return r;
}

function numberInput(value: number, step: number, onCommit: (v: number) => void): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'number';
  i.step = String(step);
  i.value = String(value);
  i.addEventListener('change', () => {
    const v = Number(i.value);
    if (Number.isFinite(v)) onCommit(v);
  });
  return i;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Front-view thumbnail of an edge style, drawn from the same wall pieces the map builds. */
function edgeIcon(style: EdgeStyle): string {
  if (style === 'auto') return '<svg viewBox="0 0 56 56"><rect x="4" y="14" width="48" height="30" fill="none" stroke="#8ea2c0" stroke-dasharray="3 3"/><text x="28" y="34" text-anchor="middle" font-size="12" fill="#8ea2c0">AUTO</text></svg>';
  const pieces = style === 'open' ? [] : edgeSegments(style, 4, 4);
  const rects = pieces.map(([u0, u1, y0, y1, t]) => `<rect x="${(4 + (u0 + 4) * 6).toFixed(1)}" y="${(48 - y1 * 8.5).toFixed(1)}" width="${((u1 - u0) * 6).toFixed(1)}" height="${((y1 - y0) * 8.5).toFixed(1)}" fill="${t < 0.3 ? '#8ea2c0' : '#d9d6cf'}"/>`);
  return `<svg viewBox="0 0 56 56" aria-hidden="true"><rect x="4" y="48" width="48" height="3" fill="#5b616b"/>${rects.join('')}</svg>`;
}
