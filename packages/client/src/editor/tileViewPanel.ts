import {
  blockBoxes,
  EDGE_STYLE_LABELS,
  EDGE_STYLES,
  edgeChoiceAt,
  edgeGlassAt,
  entityLabel,
  GLASS_EDGES,
  GLASS_KIND_LABELS,
  GLASS_KINDS,
  levelName,
  planFrame,
  planPan,
  planScale,
  planToScreen,
  planZoom,
  propBoxes,
  screenToPlan,
  selectionOf,
  setPieceFootprint,
  withMoverGroups,
  type EdgeStyle,
  type GlassKind,
  type MapDocument,
  type PlanFrame,
  type Selection,
} from '@tiletrigger/shared';
import { fillBox } from '../frontend/mapPlan.ts';
import { DEFAULT_TILE_SNAP, TILE_SNAP_STEPS } from './dockPrefs.ts';
import type { EditorApp } from './editorApp.ts';
import { numberInput } from './editorDom.ts';
import { boxLevel } from './minimapModel.ts';
import {
  breadcrumbs,
  buildFocus,
  dragMove,
  edgeClass,
  edgeName,
  focusChildren,
  focusEdges,
  localDirToWorld,
  localFacingDeg,
  toLocal,
  toWorld,
  tileViewPick,
  worldFacingDeg,
  type FocusChild,
  type FocusEdge,
  type FocusRef,
  type TileFocus,
  type TileViewReader,
} from './tileViewModel.ts';
import './tileView.css';

/** The selection's colour (the view's cyan, spec §8) and the focus's outline. */
const SEL = '#00d1ff';
const PARENT = '#ffffff';
const EDGE_COLOURS = { door: '#5ad17a', window: '#6fc3ff', wall: '#d7dfeb', open: 'rgba(160, 172, 196, 0.6)' } as const;
/** A click picks within this many pixels. */
const PICK_PX = 10;
/** R turns a picked thing by this much (degrees; the Facing field types any angle). */
const TURN_DEG = 15;

interface Drag {
  id: number;
  kind: 'child' | 'pan';
  x: number;
  y: number;
  moved: boolean;
  /** A thing being dragged: its id and where it started (world x, z), and where the pointer started (world). */
  child?: string;
  from?: [number, number];
  start?: { x: number; z: number };
  /** The move it would make now (world metres), previewed until the drag is let go. */
  delta?: [number, number, number];
  frame?: PlanFrame;
}

/**
 * MapMaker's Tile View (MapMaker UI spec Phase 4a, §4.2 and §4.3; the lead's note 3 and owner answers 1 and 8): the
 * focused tile, set piece, group or area from straight above, in the right dock in the Minimap's place. Opened by
 * Enter or a double-click on a selection (the view or the minimap) or the minimap's Tile view button; Esc or "← Map"
 * goes back to the minimap.
 *
 * - The plan: the level as MapMaker draws it (its cached boxes), the focus bright and the rest dimmed, its outline in
 *   white (the parent) and what is picked in it in cyan (the child), with breadcrumbs: Map › Small Room › Crate 2.
 * - Things standing in it (props, blocks, lights, doors…): click to pick, drag to move on the snap step (1 / 5 / 10 /
 *   50 cm; Ctrl or Shift held: free, to the millimetre), the arrow keys nudge a step, R turns 15° (Shift+R back), and
 *   X / Z / Height / Facing below it, in Local (tile-relative: turned with the tile) or World coordinates.
 * - Cell sides (doors and windows are edge styles): click one to change its style and glass; never dragged.
 * - A set piece's insides are generated: shown, picked and named, but read-only, with the honest way to edit them.
 *
 * Every change goes through the commands the rest of MapMaker uses (the shared transform command, setEdge), so the 3D
 * view, collision and the checks follow, and one drag is one undo step. Nothing here is stored in the map: the snap
 * and the frame are kept in this browser (dockPrefs.ts). Nothing runs while it can't be seen; drawn only when the
 * document, selection, level, pointer or frame changed.
 */
export class TileViewPanel {
  readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly crumbs: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly readout: HTMLElement;
  private readonly levelChip: HTMLElement;
  private readonly snapSelect: HTMLSelectElement;
  private readonly frameButtons: { local: HTMLButtonElement; world: HTMLButtonElement };
  private visible = false;
  private w = 0;
  private h = 0;
  /** What is open (null: closed). */
  ref: FocusRef | null = null;
  focus: TileFocus | null = null;
  private built: { doc: MapDocument; view: MapDocument; level: number; children: FocusChild[]; edges: FocusEdge[] } | null = null;
  /** The view of the plan (null: fitted to the focus on the next draw). */
  private view: PlanFrame | null = null;
  private drawnKey = '';
  private drag: Drag | null = null;
  private hover: { x: number; z: number } | null = null;
  /** A cell side picked (doors and windows), or a set piece's part picked (read-only). */
  edge: FocusEdge | null = null;
  part: { id: string; piece: string } | null = null;
  /** The thing picked in Tile View (its fields below the plan). */
  childId: string | null = null;
  private detailKey = '';

  constructor(private readonly app: EditorApp, private readonly prefs: { snapCm(): number; setSnapCm(cm: number): void; frame(): 'local' | 'world'; setFrame(f: 'local' | 'world'): void; changed(open: boolean): void }) {
    this.root = document.createElement('div');
    this.root.className = 'ed-tileview';
    this.root.id = 'ed-tileview';
    const head = document.createElement('div');
    head.className = 'ed-tv-head';
    const back = document.createElement('button');
    back.type = 'button';
    back.id = 'ed-tv-back';
    back.textContent = '← Map';
    back.title = 'Back to the minimap (Esc)';
    back.addEventListener('click', () => this.close());
    this.crumbs = document.createElement('nav');
    this.crumbs.className = 'ed-tv-crumbs';
    this.crumbs.id = 'ed-tv-crumbs';
    this.crumbs.setAttribute('aria-label', 'Tile View: where you are');
    head.append(back, this.crumbs);

    const bar = document.createElement('div');
    bar.className = 'ed-tv-bar';
    this.snapSelect = document.createElement('select');
    this.snapSelect.id = 'ed-tv-snap';
    this.snapSelect.title = 'Snap step for dragging and the arrow keys (hold Ctrl or Shift: free)';
    this.snapSelect.setAttribute('aria-label', 'Tile View snap step');
    for (const cm of TILE_SNAP_STEPS) this.snapSelect.append(new Option(`${cm} cm`, String(cm)));
    this.snapSelect.addEventListener('change', () => {
      this.prefs.setSnapCm(Number(this.snapSelect.value));
      this.drawnKey = '';
    });
    const seg = document.createElement('span');
    seg.className = 'ed-tv-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Coordinates');
    const frameBtn = (f: 'local' | 'world', text: string, title: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = `ed-tv-${f}`;
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', () => this.setFrame(f));
      return b;
    };
    this.frameButtons = {
      local: frameBtn('local', 'Local', "Tile-relative: from the tile's anchor cell, turned with it"),
      world: frameBtn('world', 'World', 'Map coordinates (metres), north up'),
    };
    seg.append(this.frameButtons.local, this.frameButtons.world);
    const fit = document.createElement('button');
    fit.type = 'button';
    fit.id = 'ed-tv-fit';
    fit.textContent = '⌂';
    fit.title = 'Fit the tile';
    fit.setAttribute('aria-label', 'Fit the tile');
    fit.addEventListener('click', () => this.fit());
    bar.append(this.snapSelect, seg, fit);

    const wrap = document.createElement('div');
    wrap.className = 'ed-tv-canvas';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ed-tv-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', 'Tile View: click a thing to pick it, drag to move it; arrow keys nudge, R turns; click a wall side to change it; Esc goes back');
    this.canvas.title = 'Click to pick · drag to move (Ctrl/Shift: free) · arrows nudge · R turns · wheel zooms · drag empty space to pan · Esc: back';
    this.levelChip = document.createElement('span');
    this.levelChip.className = 'ed-minimap-level';
    this.readout = document.createElement('span');
    this.readout.className = 'ed-tv-readout';
    this.readout.id = 'ed-tv-readout';
    wrap.append(this.canvas, this.levelChip, this.readout);

    this.detail = document.createElement('div');
    this.detail.className = 'ed-tv-detail';
    this.detail.id = 'ed-tv-detail';
    this.root.append(head, bar, wrap, this.detail);
    new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      this.w = Math.round(r.width);
      this.h = Math.round(r.height);
      this.drawnKey = '';
    }).observe(this.canvas);
    this.mountPointer();
    this.mountKeys();
  }

  get isOpen(): boolean {
    return this.ref !== null;
  }

  get shown(): boolean {
    return this.visible;
  }

  /** Shown in `slot` (the dock's Minimap place while Tile View is open), or hidden: nothing runs while hidden. */
  show(slot: HTMLElement | null): void {
    this.visible = !!slot && this.isOpen;
    if (slot && this.root.parentElement !== slot) slot.append(this.root);
    this.drawnKey = '';
    this.detailKey = '';
  }

  private reader(): TileViewReader {
    const app = this.app;
    return {
      pieceCells: (id) => {
        const p = app.placementOf(id);
        const def = p && app.pieceDef(p.piece);
        return p && def ? setPieceFootprint(p, def) : null;
      },
      pieceName: (id) => {
        const p = app.placementOf(id);
        return (p && app.pieceDef(p.piece)?.displayName) ?? p?.piece ?? 'Set piece';
      },
      entityLevel: (e) => (app.hover.onTerrain(e) ? null : app.hover.entityLevel(e)),
    };
  }

  /** Open Tile View on `ref` (the dock shows it in the Minimap's place). False when there is nothing to show. */
  open(ref: FocusRef): boolean {
    const f = buildFocus(this.app.doc, ref, this.app.level, this.reader());
    if (!f) return false;
    this.ref = ref;
    this.focus = f;
    this.built = null;
    this.view = null;
    this.edge = null;
    this.part = null;
    this.childId = null;
    this.drawnKey = '';
    this.detailKey = '';
    if (f.level !== this.app.level) this.app.setLevel(f.level, true);
    this.prefs.changed(true);
    this.syncControls();
    return true;
  }

  /** Back to the minimap. */
  close(): void {
    if (!this.ref) return;
    this.ref = null;
    this.focus = null;
    this.built = null;
    this.drag = null;
    this.edge = null;
    this.part = null;
    this.childId = null;
    this.prefs.changed(false);
  }

  private snapM(): number {
    return (this.prefs.snapCm() || DEFAULT_TILE_SNAP) / 100;
  }

  private setFrame(f: 'local' | 'world'): void {
    this.prefs.setFrame(f);
    this.syncControls();
    this.drawnKey = '';
    this.detailKey = '';
  }

  private syncControls(): void {
    this.snapSelect.value = String(this.prefs.snapCm() || DEFAULT_TILE_SNAP);
    const fr = this.prefs.frame();
    for (const k of ['local', 'world'] as const) this.frameButtons[k].setAttribute('aria-pressed', String(fr === k));
  }

  /** For the checks: what it shows. */
  state(): { open: boolean; visible: boolean; focus: TileFocus | null; children: number; parts: number; edges: number; child: string | null; edge: string | null; part: string | null; crumbs: string[]; frame: PlanFrame | null; w: number; h: number } {
    return {
      open: this.isOpen,
      visible: this.visible,
      focus: this.focus,
      children: this.built?.children.filter((c) => !c.partOf).length ?? 0,
      parts: this.built?.children.filter((c) => c.partOf).length ?? 0,
      edges: this.built?.edges.length ?? 0,
      child: this.childId,
      edge: this.edge ? edgeName(this.edge.target) : null,
      part: this.part?.id ?? null,
      crumbs: [...this.crumbs.querySelectorAll('span')].map((s) => s.textContent ?? ''),
      frame: this.view,
      w: this.w,
      h: this.h,
    };
  }

  /** A world point's place on the page (for the checks' clicks), or null while hidden. */
  clientPoint(x: number, z: number): { x: number; y: number } | null {
    if (!this.visible || !this.view) return null;
    const r = this.canvas.getBoundingClientRect();
    const p = planToScreen(this.view, this.w, this.h, x, z);
    return { x: r.left + p.x, y: r.top + p.y };
  }

  /** The focus and its children again when the map, the drawn map or the level changed. */
  private rebuild(): boolean {
    const app = this.app;
    const doc = app.doc;
    const view = app.viewDoc;
    const b = this.built;
    if (b && b.doc === doc && b.view === view && b.level === app.level) return true;
    if (b && b.doc.metadata.id !== doc.metadata.id) {
      // Another map opened.
      this.close();
      return false;
    }
    const f = this.ref && buildFocus(doc, this.ref, app.level, this.reader());
    if (!f) {
      app.toast('Tile View closed: what it showed is no longer in the map');
      this.close();
      return false;
    }
    const moved = !this.focus || this.focus.rect.x0 !== f.rect.x0 || this.focus.rect.z0 !== f.rect.z0 || this.focus.level !== f.level;
    this.focus = f;
    const children = focusChildren(doc, view, f, this.reader(), app.expansion.partOf);
    const edges = focusEdges(doc, f);
    this.built = { doc, view, level: app.level, children, edges };
    if (this.edge) this.edge = edges.find((e) => e.target.side === this.edge!.target.side && e.target.cell.every((v, i) => v === this.edge!.target.cell[i])) ?? null;
    if (this.part && !children.some((c) => c.id === this.part!.id)) this.part = null;
    if (moved && b?.level === app.level && b.doc.metadata.id === doc.metadata.id) {
      // The tile moved (an undo, a drag in the view): the plan follows it.
      this.view = null;
    }
    this.detailKey = '';
    return true;
  }

  /** The thing picked in Tile View: the one selected thing standing in the focus. */
  private syncChild(): void {
    const sel = this.app.selection;
    const kids = this.built?.children ?? [];
    if (this.childId && !(sel.entities.includes(this.childId) && kids.some((c) => c.id === this.childId))) this.childId = null;
    if (!this.childId && sel.entities.length >= 1 && !sel.tiles.length && !(sel.setPieces?.length)) {
      const first = sel.entities[0]!;
      if (kids.some((c) => c.id === first && !c.partOf) && withMoverGroups(this.app.doc, [first]).length === sel.entities.length) this.childId = first;
    }
    if (this.childId) {
      this.edge = null;
      this.part = null;
    }
  }

  /** Each frame: a few numbers compared; drawn when something it shows changed. */
  frame(): void {
    if (!this.visible || !this.ref || this.w < 8 || this.h < 8) return;
    if (!this.rebuild()) return;
    this.syncChild();
    const f = this.focus!;
    if (!this.view) this.view = this.fitFrame(f);
    const d = this.drag;
    const key = `${this.app.history.revision}|${this.app.selectionRev}|${this.app.level}|${this.w}x${this.h}|${this.view.cx},${this.view.cz},${this.view.halfH}|${this.hover ? `${this.hover.x.toFixed(2)},${this.hover.z.toFixed(2)}` : ''}|${d?.delta?.join(',') ?? ''}|${this.edge ? edgeName(this.edge.target) : ''}|${this.part?.id ?? ''}|${this.childId ?? ''}|${this.prefs.frame()}|${this.prefs.snapCm()}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.draw();
    }
    const dk = `${this.app.history.revision}|${this.app.selectionRev}|${this.childId ?? ''}|${this.edge ? edgeName(this.edge.target) : ''}|${this.part?.id ?? ''}|${this.prefs.frame()}|${f.level}`;
    if (dk !== this.detailKey && !this.detail.contains(document.activeElement)) {
      this.detailKey = dk;
      this.renderCrumbs();
      this.renderDetail();
    }
  }

  private fitFrame(f: TileFocus): PlanFrame {
    return planFrame(f.rect, Math.max(1, this.w) / Math.max(1, this.h), 1.5);
  }

  fit(): void {
    if (this.focus) this.view = this.fitFrame(this.focus);
    this.drawnKey = '';
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    const app = this.app;
    const f = this.focus!;
    const v = this.view!;
    const { w, h } = this;
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0a0f1c';
    g.fillRect(0, 0, w, h);
    const s = planScale(v, h);
    const P = (x: number, z: number) => planToScreen(v, w, h, x, z);
    const px = (x: number) => P(x, 0).x;
    const py = (z: number) => P(0, z).y;
    const x0 = v.cx - v.halfW;
    const x1 = v.cx + v.halfW;
    const z0 = v.cz - v.halfH;
    const z1 = v.cz + v.halfH;
    const doc = app.viewDoc;
    const lh = doc.classicStructure.levelHeight;
    const cell = doc.classicStructure.cellSize;
    const level = f.level;
    // The level as MapMaker draws it, in view (its cached boxes, and the breakable props and moving blocks).
    const floors = [];
    const solids = [];
    const walls = [];
    for (const b of [...app.mapBoxes(), ...propBoxes(doc, true), ...blockBoxes(doc, true)]) {
      if (b.kind === 'barrier' || boxLevel(b, lh) !== level) continue;
      if (b.max[0] < x0 || b.min[0] > x1 || b.max[2] < z0 || b.min[2] > z1) continue;
      if (app.view.outlinerHidden(b.sourceId)) continue;
      if (b.kind === 'floor') floors.push(b);
      else if (b.kind === 'wall' || b.kind === 'trim') walls.push(b);
      else solids.push(b);
    }
    g.fillStyle = '#26365a';
    for (const b of floors) fillBox(g, b, px, py);
    for (const b of solids) {
      g.fillStyle = b.kind === 'prop' ? '#6a5434' : '#8a6a3f';
      fillBox(g, b, px, py);
    }
    g.fillStyle = '#b4c8e6';
    for (const b of walls) fillBox(g, b, px, py);
    // The snap grid inside the focus, from the frame's origin (local: the anchor; world: 0), where it isn't too fine.
    const step = this.snapM();
    const gridStep = step * s >= 8 ? step : s >= 8 ? 1 : 0;
    const fr = this.prefs.frame();
    const origin = fr === 'local' ? f.anchor : { x: 0, z: 0 };
    g.save();
    this.focusPath(g, f, P, cell);
    g.clip();
    if (gridStep) {
      g.strokeStyle = 'rgba(200, 220, 255, 0.10)';
      g.lineWidth = 1;
      g.beginPath();
      const r = f.rect;
      for (let x = origin.x + Math.ceil((r.x0 - origin.x) / gridStep) * gridStep; x <= r.x1 + 1e-6; x += gridStep) {
        const p = Math.round(px(x)) + 0.5;
        g.moveTo(p, py(r.z1));
        g.lineTo(p, py(r.z0));
      }
      for (let z = origin.z + Math.ceil((r.z0 - origin.z) / gridStep) * gridStep; z <= r.z1 + 1e-6; z += gridStep) {
        const p = Math.round(py(z)) + 0.5;
        g.moveTo(px(r.x0), p);
        g.lineTo(px(r.x1), p);
      }
      g.stroke();
    }
    g.restore();
    // Everything outside the focus dimmed; its outline in white (the parent).
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    this.focusPath(g, f, P, cell, false);
    g.fillStyle = 'rgba(5, 8, 16, 0.62)';
    g.fill('evenodd');
    g.restore();
    const parentSelected = this.parentSelected();
    g.save();
    g.lineWidth = parentSelected ? 3 : 2;
    g.strokeStyle = parentSelected ? SEL : PARENT;
    g.globalAlpha = 0.9;
    this.focusOutline(g, f, P, cell);
    g.restore();
    // Cell sides: doors, windows, walls, open.
    const edges = this.built?.edges ?? [];
    for (const e of edges) {
      const a = P(e.a[0], e.a[1]);
      const b = P(e.b[0], e.b[1]);
      const cls = edgeClass(e.style);
      const picked = this.edge === e;
      g.save();
      if (cls === 'open') g.setLineDash([4, 4]);
      for (const [lw, col] of picked ? ([[8, 'rgba(5, 8, 16, 0.9)'], [5, SEL]] as const) : ([[4, EDGE_COLOURS[cls]]] as const)) {
        g.lineWidth = lw;
        g.strokeStyle = col;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      g.restore();
    }
    // Local axes at the anchor: x (east in the tile's own frame) and z (its north).
    if (fr === 'local') this.drawAxes(g, f, P, s);
    // The things in it: the map's own solid, a set piece's parts hollow (read-only).
    const d = this.drag;
    const r = Math.max(3.5, Math.min(7, s * 0.25));
    for (const k of this.built?.children ?? []) {
      let { x, z } = k;
      const moving = d?.kind === 'child' && d.delta && (d.child === k.id || this.app.selection.entities.includes(k.id));
      if (moving) {
        // The ghost where it was, the thing where it would land.
        const o = P(x, z);
        g.beginPath();
        g.arc(o.x, o.y, r, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        g.setLineDash([2, 2]);
        g.stroke();
        g.setLineDash([]);
        x += d.delta![0];
        z += d.delta![2];
      }
      const p = P(x, z);
      if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue;
      const part = !!k.partOf;
      const selected = !part && (this.childId === k.id || this.app.selection.entities.includes(k.id));
      const picked = this.part?.id === k.id;
      g.save();
      if (k.half && k.half[0] * s > 4) {
        g.translate(p.x, p.y);
        g.rotate(k.yaw ?? 0);
        g.fillStyle = part ? 'rgba(150, 160, 180, 0.22)' : 'rgba(255, 196, 120, 0.28)';
        g.strokeStyle = part ? 'rgba(170, 180, 200, 0.7)' : '#ffc478';
        g.lineWidth = 1;
        if (part) g.setLineDash([3, 2]);
        g.fillRect(-k.half[0] * s, -k.half[1] * s, k.half[0] * 2 * s, k.half[1] * 2 * s);
        g.strokeRect(-k.half[0] * s, -k.half[1] * s, k.half[0] * 2 * s, k.half[1] * 2 * s);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (part) {
        g.setLineDash([2, 2]);
        g.strokeStyle = 'rgba(180, 190, 210, 0.8)';
        g.lineWidth = 1.5;
        g.stroke();
      } else {
        g.fillStyle = '#ffc478';
        g.fill();
        g.strokeStyle = 'rgba(5, 8, 16, 0.9)';
        g.lineWidth = 1.5;
        g.stroke();
      }
      g.setLineDash([]);
      if (k.yaw !== null) {
        // Its facing (yaw 0 is north, up the plan; a positive turn is east).
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x + Math.sin(k.yaw) * r * 2.2, p.y - Math.cos(k.yaw) * r * 2.2);
        g.strokeStyle = part ? 'rgba(180, 190, 210, 0.8)' : '#ffc478';
        g.lineWidth = 1.5;
        g.stroke();
      }
      if (selected || picked) {
        for (const [lw, col] of [[4, 'rgba(5, 8, 16, 0.85)'], [2, picked ? '#ffd666' : SEL]] as const) {
          g.beginPath();
          g.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2);
          g.lineWidth = lw;
          g.strokeStyle = col;
          g.stroke();
        }
      }
      g.restore();
    }
    this.drawScale(g, w, h, s);
    if (this.levelChip.textContent !== levelName(level)) this.levelChip.textContent = levelName(level);
    this.renderReadout();
  }

  /** The focus's cells (or rectangle) as a path. */
  private focusPath(g: CanvasRenderingContext2D, f: TileFocus, P: (x: number, z: number) => { x: number; y: number }, cell: number, begin = true): void {
    if (begin) g.beginPath();
    const rects = f.kind === 'tile' || f.kind === 'setpiece' ? f.cells.map(([x, y]) => ({ x0: x * cell - cell / 2, z0: y * cell - cell / 2, x1: x * cell + cell / 2, z1: y * cell + cell / 2 })) : [f.rect];
    for (const r of rects) {
      const a = P(r.x0, r.z1);
      const b = P(r.x1, r.z0);
      g.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
  }

  /** The focus's outer outline: each cell side with no focus cell beyond it (a rectangle for a group or area). */
  private focusOutline(g: CanvasRenderingContext2D, f: TileFocus, P: (x: number, z: number) => { x: number; y: number }, cell: number): void {
    g.beginPath();
    if (f.kind === 'tile' || f.kind === 'setpiece') {
      const has = new Set(f.cells.map(([x, y]) => `${x},${y}`));
      const h = cell / 2;
      for (const [x, y] of f.cells) {
        const cx = x * cell;
        const cz = y * cell;
        const sides: [number, number, [number, number], [number, number]][] = [
          [0, 1, [cx - h, cz + h], [cx + h, cz + h]],
          [1, 0, [cx + h, cz - h], [cx + h, cz + h]],
          [0, -1, [cx - h, cz - h], [cx + h, cz - h]],
          [-1, 0, [cx - h, cz - h], [cx - h, cz + h]],
        ];
        for (const [dx, dy, a, b] of sides) {
          if (has.has(`${x + dx},${y + dy}`)) continue;
          const pa = P(a[0], a[1]);
          const pb = P(b[0], b[1]);
          g.moveTo(pa.x, pa.y);
          g.lineTo(pb.x, pb.y);
        }
      }
    } else {
      const a = P(f.rect.x0, f.rect.z1);
      const b = P(f.rect.x1, f.rect.z0);
      g.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    g.stroke();
  }

  private drawAxes(g: CanvasRenderingContext2D, f: TileFocus, P: (x: number, z: number) => { x: number; y: number }, s: number): void {
    const o = P(f.anchor.x, f.anchor.z);
    const len = Math.max(18, Math.min(40, s * 2));
    g.save();
    g.font = '600 9px system-ui, sans-serif';
    for (const [dx, dz, col, label] of [[1, 0, '#ff7a7a', 'x'], [0, 1, '#7aff9a', 'z']] as const) {
      const [wx, wz] = localDirToWorld(f, dx, dz);
      const tip = { x: o.x + wx * len, y: o.y - wz * len };
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(o.x, o.y);
      g.lineTo(tip.x, tip.y);
      g.stroke();
      g.fillText(label, tip.x + 3, tip.y + 3);
    }
    g.beginPath();
    g.arc(o.x, o.y, 2.5, 0, Math.PI * 2);
    g.fillStyle = '#ffffff';
    g.fill();
    g.restore();
  }

  private drawScale(g: CanvasRenderingContext2D, w: number, h: number, s: number): void {
    g.save();
    g.fillStyle = '#e8f0ff';
    g.strokeStyle = '#e8f0ff';
    g.font = '600 9px system-ui, sans-serif';
    g.textAlign = 'center';
    const nx = w - 10;
    const ny = 22;
    g.beginPath();
    g.moveTo(nx, ny - 7);
    g.lineTo(nx + 4, ny + 4);
    g.lineTo(nx, ny + 2);
    g.lineTo(nx - 4, ny + 4);
    g.closePath();
    g.fill();
    g.fillText('N', nx, ny - 9);
    const want = w / 5 / s;
    const len = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100].find((v) => v >= want) ?? 100;
    const x0 = 6;
    const y0 = h - 6;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0, y0 - 3);
    g.lineTo(x0, y0);
    g.lineTo(x0 + len * s, y0);
    g.lineTo(x0 + len * s, y0 - 3);
    g.stroke();
    g.textAlign = 'left';
    g.fillText(len < 1 ? `${Math.round(len * 100)} cm` : `${len} m`, x0 + len * s + 4, y0);
    g.restore();
  }

  private renderReadout(): void {
    const f = this.focus;
    const at = this.hover;
    let t = '';
    if (f && at) {
      const local = this.prefs.frame() === 'local';
      const [x, z] = local ? toLocal(f, at.x, at.z) : [at.x, at.z];
      t = `${local ? 'Local' : 'World'} ${x.toFixed(2)}, ${z.toFixed(2)} m`;
    }
    const d = this.drag;
    if (d?.kind === 'child' && d.delta) t = `Move ${d.delta[0].toFixed(2)}, ${d.delta[2].toFixed(2)} m`;
    if (this.readout.textContent !== t) this.readout.textContent = t;
  }

  // ---------------------------------------------------------------- the parent, the child, breadcrumbs, fields

  /** The focus itself as a selection (a click on empty space in it). */
  private parentSelection(): Selection {
    const f = this.focus;
    if (!f?.id) return { tiles: [], entities: [] };
    if (f.kind === 'tile') return { tiles: [f.id], entities: [] };
    if (f.kind === 'setpiece') return { tiles: [], entities: [], setPieces: [f.id] };
    const g = (this.app.doc.groups ?? []).find((x) => x.id === f.id);
    return g ? selectionOf(this.app.doc, g.members) : { tiles: [], entities: [] };
  }

  private parentSelected(): boolean {
    const f = this.focus;
    const sel = this.app.selection;
    if (!f?.id || this.childId || this.edge || this.part) return false;
    if (f.kind === 'tile') return sel.tiles.length === 1 && sel.tiles[0] === f.id && !sel.entities.length;
    if (f.kind === 'setpiece') return (sel.setPieces ?? []).length === 1 && sel.setPieces![0] === f.id && !sel.tiles.length && !sel.entities.length;
    const want = this.parentSelection();
    const n = (x: Selection) => x.tiles.length + x.entities.length + (x.setPieces?.length ?? 0);
    return n(want) > 0 && n(want) === n(sel);
  }

  private childName(): string | null {
    if (this.childId) {
      const e = this.app.doc.entities.find((x) => x.id === this.childId);
      return e ? entityLabel(this.app.doc, e) : null;
    }
    if (this.edge) return edgeName(this.edge.target);
    if (this.part) {
      const e = this.app.viewDoc.entities.find((x) => x.id === this.part!.id);
      return e ? `${entityLabel(this.app.viewDoc, e)} (part)` : 'Part';
    }
    return null;
  }

  private renderCrumbs(): void {
    const f = this.focus;
    if (!f) return;
    const list = breadcrumbs(f, this.childName());
    this.crumbs.replaceChildren();
    list.forEach((label, i) => {
      if (i) this.crumbs.append(Object.assign(document.createElement('i'), { textContent: '›', ariaHidden: 'true' }));
      const span = document.createElement('span');
      span.textContent = label;
      if (i === list.length - 1) span.setAttribute('aria-current', 'location');
      if (i === 0) {
        span.className = 'ed-tv-crumb-link';
        span.title = 'Back to the minimap';
        span.addEventListener('click', () => this.close());
      } else if (i === 1 && list.length > 2) {
        span.className = 'ed-tv-crumb-link';
        span.title = `Select ${f.name}`;
        span.addEventListener('click', () => this.selectParent());
      }
      this.crumbs.append(span);
    });
  }

  private selectParent(): void {
    this.edge = null;
    this.part = null;
    this.childId = null;
    this.app.setTool({ kind: 'select' });
    this.app.setSelection(this.parentSelection());
    this.drawnKey = '';
    this.detailKey = '';
  }

  /** The fields under the plan: the picked thing's X / Z / Height / Facing, a side's style and glass, or a part's note. */
  private renderDetail(): void {
    const el = this.detail;
    el.replaceChildren();
    const f = this.focus;
    if (!f) return;
    const app = this.app;
    const local = this.prefs.frame() === 'local';
    const line = (text: string, cls = 'ed-tv-note') => el.append(Object.assign(document.createElement('p'), { className: cls, textContent: text }));
    const field = (label: string, input: HTMLElement, unit = '') => {
      const l = document.createElement('label');
      l.className = 'ed-tv-field';
      l.append(Object.assign(document.createElement('span'), { textContent: label }), input);
      if (unit) l.append(Object.assign(document.createElement('small'), { textContent: unit }));
      return l;
    };
    if (this.childId) {
      const e = app.doc.entities.find((x) => x.id === this.childId);
      if (!e) return;
      const [wx, wy, wz] = e.position;
      const [lx, lz] = local ? toLocal(f, wx, wz) : [wx, wz];
      const grid = document.createElement('div');
      grid.className = 'ed-tv-fields';
      const moveTo = (nx: number, nz: number) => {
        const [tx, tz] = local ? toWorld(f, nx, nz) : [nx, nz];
        const d: [number, number, number] = [Math.round((tx - wx) * 1000) / 1000, 0, Math.round((tz - wz) * 1000) / 1000];
        if (d[0] || d[2]) app.transform('Move', { by: { metres: d } });
      };
      const x = numberInput(lx, 0.01, (v) => moveTo(v, lz));
      x.id = 'ed-tv-x';
      const z = numberInput(lz, 0.01, (v) => moveTo(lx, v));
      z.id = 'ed-tv-z';
      const y = numberInput(Math.round(wy * 1000) / 1000, 0.01, (v) => app.transform('Move', { set: { id: e.id, axis: 1, value: v } }));
      y.id = 'ed-tv-y';
      grid.append(field(local ? 'X (local)' : 'X', x, 'm'), field(local ? 'Z (local)' : 'Z', z, 'm'), field('Height', y, 'm'));
      if ('yaw' in e && typeof e.yaw === 'number') {
        const deg = local ? localFacingDeg(f, e.yaw) : localFacingDeg({ rotation: 0 }, e.yaw);
        // (To a tenth of a degree: a turn by R is stored to the millimetre-radian.)
        const face = numberInput(Math.round(deg * 10) / 10, 1, (v) => app.transform('Turn', { face: { id: e.id, deg: local ? worldFacingDeg(f, v) : v } }));
        face.id = 'ed-tv-facing';
        grid.append(field(local ? 'Facing (local)' : 'Facing', face, '°'));
      }
      el.append(grid);
      if (local && f.rotation) line(`The tile is turned ${f.rotation * 90}°: local X and Z turn with it.`);
      return;
    }
    if (this.edge) {
      const target = this.edge.target;
      const doc = app.doc;
      const now = edgeChoiceAt(doc, target);
      const sel = document.createElement('select');
      sel.id = 'ed-tv-edge-style';
      for (const style of EDGE_STYLES) sel.append(new Option(EDGE_STYLE_LABELS[style], style, false, style === now));
      const glass = document.createElement('select');
      glass.id = 'ed-tv-edge-glass';
      glass.title = 'Glass in this window';
      glass.append(new Option('No glass', ''), ...GLASS_KINDS.map((k) => new Option(GLASS_KIND_LABELS[k], k)));
      glass.value = edgeGlassAt(doc, target) ?? '';
      glass.hidden = !GLASS_EDGES.has(now as never);
      const apply = () => app.setEdge(target, sel.value as EdgeStyle, (glass.value || null) as GlassKind | null);
      sel.addEventListener('change', () => {
        if (GLASS_EDGES.has(sel.value as never) && !edgeGlassAt(app.doc, target)) glass.value = app.paint.edgeGlass ?? '';
        apply();
      });
      glass.addEventListener('change', apply);
      const grid = document.createElement('div');
      grid.className = 'ed-tv-fields';
      const glassField = field('Glass', glass);
      glassField.hidden = glass.hidden;
      sel.addEventListener('change', () => (glassField.hidden = !GLASS_EDGES.has(sel.value as never)));
      grid.append(field('Style', sel), glassField);
      el.append(grid);
      line('Doors and windows are how a cell side is built: change the style here (Automatic: as the tiles meet). Door leaves are things of their own.');
      return;
    }
    if (this.part) {
      line(`Part of ${this.reader().pieceName(this.part.piece)}: made by the set piece, so it can't be moved or changed one by one here. Edit the set piece's Parts in Properties, or Explode to tiles to edit everything in it.`, 'ed-tv-note ed-tv-readonly');
      return;
    }
    const n = this.built?.children.filter((c) => !c.partOf).length ?? 0;
    const parts = this.built?.children.filter((c) => c.partOf).length ?? 0;
    const sides = this.built?.edges.length ?? 0;
    const bits = [`${n} thing${n === 1 ? '' : 's'}`, ...(sides ? [`${sides} wall side${sides === 1 ? '' : 's'}`] : []), ...(parts ? [`${parts} set-piece part${parts === 1 ? '' : 's'} (read-only)`] : [])];
    line(`${f.name} · ${levelName(f.level)} · ${bits.join(' · ')}. Click a thing or a wall side to pick it.`);
    if (f.kind === 'setpiece') line("A set piece's insides are generated: shown here read-only.", 'ed-tv-note ed-tv-readonly');
  }

  // ---------------------------------------------------------------- pointer and keys

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private world(e: { clientX: number; clientY: number }): { x: number; z: number } | null {
    if (!this.view) return null;
    const p = this.local(e);
    return screenToPlan(this.view, this.w, this.h, p.x, p.y);
  }

  private pickAt(at: { x: number; z: number }): ReturnType<typeof tileViewPick> {
    const blocked = this.app.outliner.blocked;
    const skip = (id: string) => (blocked.size > 0 && blocked.has(id)) || this.app.view.outlinerHidden(id);
    const reach = PICK_PX / planScale(this.view!, this.h);
    return tileViewPick(this.built?.children ?? [], this.built?.edges ?? [], at.x, at.z, reach, skip);
  }

  /** Pick one thing in the focus: it alone (a group stays apart: you are inside it), a moving build whole. */
  pickChild(id: string): void {
    const app = this.app;
    this.edge = null;
    this.part = null;
    this.childId = id;
    app.setTool({ kind: 'select' });
    app.setSelection({ tiles: [], entities: withMoverGroups(app.doc, [id]) }, true);
    this.drawnKey = '';
    this.detailKey = '';
  }

  private mountPointer(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.view || !this.focus || (e.button !== 0 && e.button !== 1 && e.button !== 2)) return;
      c.focus({ preventScroll: true });
      const p = this.local(e);
      const at = screenToPlan(this.view, this.w, this.h, p.x, p.y);
      const base = { id: e.pointerId, x: p.x, y: p.y, moved: false, frame: this.view };
      c.setPointerCapture(e.pointerId);
      e.preventDefault();
      if (e.button !== 0) {
        this.drag = { ...base, kind: 'pan' };
        return;
      }
      const hit = this.pickAt(at);
      if (hit?.kind === 'child' && !hit.part) {
        const k = this.built!.children.find((x) => x.id === hit.id)!;
        if (this.childId !== hit.id || !this.app.selection.entities.includes(hit.id)) this.pickChild(hit.id);
        this.drag = { ...base, kind: 'child', child: hit.id, from: [k.x, k.z], start: at };
        return;
      }
      this.drag = { ...base, kind: 'pan' };
      if (hit?.kind === 'child' && hit.part) {
        this.childId = null;
        this.edge = null;
        this.part = { id: hit.id, piece: hit.part };
      } else if (hit?.kind === 'edge') {
        this.childId = null;
        this.part = null;
        this.edge = hit.edge;
        // The side's tile is the parent of what is picked (the inspector shows it).
        const want = { tiles: [hit.edge.tileId], entities: [] };
        this.app.setTool({ kind: 'select' });
        this.app.setSelection(want, true);
      } else (this.drag as Drag & { emptyClick?: boolean }).emptyClick = true;
      this.drawnKey = '';
      this.detailKey = '';
    });
    c.addEventListener('pointermove', (e) => {
      const at = this.world(e);
      this.hover = at;
      const d = this.drag;
      if (!d || d.id !== e.pointerId || !at) return;
      const p = this.local(e);
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 4) return;
      d.moved = true;
      if (d.kind === 'pan') {
        const f = planPan(d.frame!, this.w, this.h, p.x - d.x, p.y - d.y);
        this.view = f;
        return;
      }
      const free = e.ctrlKey || e.shiftKey || e.metaKey;
      d.delta = dragMove(this.focus!, d.from!, [at.x - d.start!.x, at.z - d.start!.z], this.snapM(), this.prefs.frame(), free);
    });
    const end = (e: PointerEvent, commit: boolean) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      this.drawnKey = '';
      if (d.kind === 'child' && commit && d.moved && d.delta && (d.delta[0] || d.delta[2])) {
        // One drag, one command, one undo step (the shared transform command, as a drag in the view).
        this.app.transform('Move', { by: { metres: d.delta } });
        return;
      }
      if (commit && !d.moved && (d as Drag & { emptyClick?: boolean }).emptyClick) this.selectParent();
    };
    c.addEventListener('pointerup', (e) => end(e, true));
    c.addEventListener('pointercancel', (e) => end(e, false));
    c.addEventListener('pointerleave', () => {
      this.hover = null;
    });
    c.addEventListener(
      'wheel',
      (e) => {
        if (!this.view) return;
        e.preventDefault();
        const at = this.world(e);
        if (!at) return;
        const k = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.002)));
        const f = planZoom(this.view, k, at);
        // Tile View zooms from a whole building down to a few centimetres: the plan's limits are for a level.
        this.view = f;
      },
      { passive: false },
    );
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('dblclick', (e) => e.preventDefault());
  }

  /** With the plan focused: arrows nudge the picked thing a snap step (Shift or Ctrl: 1 cm), R turns it, Esc steps back. */
  private mountKeys(): void {
    this.canvas.addEventListener('keydown', (e) => {
      const app = this.app;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.escape();
        return;
      }
      const dirs: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const dir = dirs[e.key];
      if (dir && this.childId && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey || e.ctrlKey || e.metaKey ? 0.01 : this.snapM();
        const [dx, dz] = this.prefs.frame() === 'local' && this.focus ? localDirToWorld(this.focus, dir[0], dir[1]) : dir;
        app.transform('Nudge', { by: { metres: [Math.round(dx * step * 1000) / 1000, 0, Math.round(dz * step * 1000) / 1000] } });
        return;
      }
      if ((e.code === 'KeyR') && this.childId && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        app.transform('Turn', { turn: ((e.shiftKey ? -TURN_DEG : TURN_DEG) * Math.PI) / 180 });
      }
    });
  }

  /** Esc: a drag dropped, else the picked thing or side let go (the focus selected), else back to the minimap. */
  escape(): boolean {
    if (!this.isOpen) return false;
    if (this.drag) {
      this.drag = null;
      this.drawnKey = '';
      return true;
    }
    if (this.childId || this.edge || this.part) {
      this.selectParent();
      return true;
    }
    this.close();
    return true;
  }
}
