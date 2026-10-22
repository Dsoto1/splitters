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
  rotateCommand,
  tileAt,
  updateTileCommand,
  validateMap,
  type EditCommand,
  type MapDocument,
  type Rotation,
  type Selection,
  type TileDefinition,
  type ValidationIssue,
  type Vec3,
} from '@chronosplit/shared';
import arenaTemplate from '../../../../maps/phase0_arena.json';
import { EditorView } from './editorView.ts';
import { deleteFromLibrary, exportMap, importMapFile, listLibrary, openFromLibrary, readAutosave, saveToLibrary, writeAutosave } from './storage.ts';
import { tileIcon } from './tileIcon.ts';

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

type Tool = { kind: 'select' } | { kind: 'tile'; tile: string } | { kind: 'spawn' };

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

  constructor(private readonly host: EditorHost) {
    this.view = new EditorView(host.engine);
    const restored = readAutosave();
    this.history = new EditHistory(restored?.map ?? newMapDocument('Untitled Map'));
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
      this.view.setMap(this.doc, this.level, this.showAll);
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
    for (const b of document.querySelectorAll<HTMLElement>('[data-tool]')) {
      const t = b.dataset.tool;
      b.classList.toggle('active', (tool.kind === 'tile' && t === `tile:${tool.tile}`) || t === tool.kind);
    }
    const hints: Record<Tool['kind'], string> = {
      select: 'Click select · Shift add · Drag move · Del delete · Ctrl+D duplicate · R rotate · F focus',
      tile: 'Click place · R rotate · Right-click erase · PgUp/PgDn level · Esc select tool',
      spawn: 'Click place spawn · R turn 45° · Right-click erase · Esc select tool',
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
    this.view.setSpawns(this.doc, this.level, this.showAll, new Set(this.selection.entities));
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
    }
  }

  private eraseAtHover(): void {
    const hit = this.pick();
    if (!hit) return;
    const sel = hit.kind === 'tile' ? { tiles: [hit.id], entities: [] } : { tiles: [], entities: [hit.id] };
    this.run(hit.kind === 'tile' ? 'Erase tile' : 'Erase spawn', deleteCommand(this.doc, sel));
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
      if (d < 0.9 && (!best || d < best.d)) best = { id: e.id, d };
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

  /** Select and frame the object a validation issue points at. */
  private focusIssue(issue: ValidationIssue): void {
    if (!issue.targetId) return;
    const tile = this.doc.classicStructure.tiles.find((t) => t.id === issue.targetId);
    const entity = this.doc.entities.find((e) => e.id === issue.targetId);
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
    this.updateHover();
  }

  private updateHover(): void {
    const cell = this.hoverCell ? ([this.hoverCell[0], this.hoverCell[1], this.level] as [number, number, number]) : null;
    this.view.setHoverCell(this.doc, this.tool.kind === 'select' ? null : cell);
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
        if (wasClick && this.tool.kind !== 'select') {
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
    tools.append(selectBtn);

    const tiles = $('ed-tiles');
    for (const def of coreCatalog.all()) tiles.append(this.paletteButton(def));
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'tile-btn';
    spawnBtn.dataset.tool = 'spawn';
    spawnBtn.dataset.search = 'spawn player start';
    spawnBtn.innerHTML = `<svg viewBox="0 0 56 56"><circle cx="28" cy="30" r="12" fill="#4fb3ff"/><rect x="22" y="14" width="12" height="6" rx="2" fill="#1c1f26"/></svg>Player Spawn`;
    spawnBtn.addEventListener('click', () => this.setTool({ kind: 'spawn' }));
    $('ed-entities').append(spawnBtn);

    $<HTMLInputElement>('ed-search').addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      for (const b of document.querySelectorAll<HTMLElement>('#ed-palette .tile-btn')) b.hidden = !!q && !(b.dataset.search ?? '').includes(q);
    });
    this.setTool({ kind: 'select' });
  }

  private paletteButton(def: TileDefinition): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = 'tile-btn';
    b.dataset.tool = `tile:${def.id}`;
    b.dataset.search = `${def.displayName} ${def.id}`.toLowerCase();
    b.innerHTML = `${tileIcon(def)}${def.displayName}`;
    b.title = def.displayName;
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
    const boxes = buildMapGeometry(this.doc).length;
    $('ed-counts').textContent = `${tiles} tiles · ${spawns} spawns · ${boxes} collision boxes`;
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
        small(`ID ${t.id}`),
      );
    } else if (entities.length === 1 && tiles.length === 0) {
      const e = doc.entities.find((x) => x.id === entities[0])!;
      el.append(h2('Player Spawn'));
      const setPos = (i: number, v: number) => {
        const position = [...e.position] as [number, number, number];
        position[i] = v;
        this.run('Move spawn', { kind: 'updateEntities', before: [e], after: [{ ...e, position }] });
      };
      el.append(
        row('X', numberInput(e.position[0], 0.5, (v) => setPos(0, v))),
        row('Height', numberInput(e.position[1], 0.25, (v) => setPos(1, v))),
        row('Z', numberInput(e.position[2], 0.5, (v) => setPos(2, v))),
        row(
          'Facing',
          numberInput(Math.round((e.yaw * 180) / Math.PI), 15, (deg) => this.run('Turn spawn', { kind: 'updateEntities', before: [e], after: [{ ...e, yaw: normalizeYaw((deg * Math.PI) / 180) }] })),
        ),
        small(`ID ${e.id}`),
      );
    } else {
      el.append(h2(`${tiles.length + entities.length} selected`));
      el.append(text(`${tiles.length} tiles, ${entities.length} spawns`));
    }
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    buttons.append(button('Rotate (R)', () => this.run('Rotate', rotateCommand(this.doc, this.selection))), button('Duplicate', () => this.duplicate()), button('Delete', () => this.deleteSelection()), button('Focus (F)', () => this.focusSelection()));
    el.append(buttons);
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
