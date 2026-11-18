import { blockBoxes, levelName, placementCells, planMarkers, propBoxes, planPan, planScale, planTiles, planToScreen, screenToPlan, setPieceFootprint, terrainHeightAt, type MapDocument, type PlanArea, type PlanFrame, type PlanMarker, type TerrainData } from '@tiletrigger/shared';
import { buriedTiles, drawBuriedPassages, drawTerrainPlan, fillBox } from '../frontend/mapPlan.ts';
import { itemColor } from '../game/pickupVisuals.ts';
import type { EditorApp } from './editorApp.ts';
import { bakeDelay, bakeScale, boxLevel, minimapArea, pictureArea, cameraMarker, clampMinimapZoom, horizontalHalfFov, minimapFrame, minimapPick, selectionMarks, type MinimapReader, type SelectionMark } from './minimapModel.ts';
import { mergeSelections } from './outlinerPanel.ts';
import { focusRefAt, focusRefFor } from './tileViewModel.ts';
import { planKeyAction } from './planKeys.ts';
import { drawIcon } from './planView.ts';
import './minimap.css';

/** The selection's colour on the minimap: the view's own cyan (spec §8). */
const SEL = '#00d1ff';
/** At most this often while only the camera moves (ms): the picture is a copy and a few marks, but not every frame. */
const CAMERA_REDRAW_MS = 50;

/** The level's picture, made once per document version, level and layer filter (never per frame or pointer move). */
interface Bake {
  canvas: HTMLCanvasElement;
  /** What the picture covers: the framed area with room round it (a wide minimap shows more than the area). */
  area: PlanArea;
  /** What the minimap frames at zoom 1 (minimapArea). */
  fit: PlanArea;
  /** Pixels per metre. */
  scale: number;
  doc: MapDocument;
  level: number;
  layers: string;
  markers: PlanMarker[];
  id: number;
}

/**
 * MapMaker's live minimap (MapMaker UI spec Phase 3, §4.1): the level being edited from above, in the dock's Minimap
 * tab (expanded) or its compact card. It shows the level's floors, walls, blocks and props over the ground, the tile
 * outlines (the level below faint), spawns, flags, hills, objectives and pickups, the camera and what it sees, and the
 * selection (the shared one: `EditorApp.selection`, redrawn on `selectionRev`), dashed where it is on another level.
 *
 * A click on a thing selects it through `setSelection` (Shift adds, Alt picks one part, as in the outliner) and frames
 * it; a click on open ground moves the camera there. The wheel and its +/− zoom about the pointer, a drag pans once
 * zoomed, ⌂ fits the level again. The zoom is this browser's (dockPrefs.ts), never the map's.
 *
 * Cost (docs/PERF_MAPMAKER_TRACE_2026-11-15.md, fix 6): nothing runs on an edit's path. Each frame it compares a few
 * numbers; the level's picture is made again only after edits pause (`bakeDelay`: 350 ms, at most 1.5 s into a run of
 * edits, never during a drag) and only while the minimap can be seen, from the boxes MapMaker already has
 * (`EditorApp.mapBoxes`), with the ground drawn once per ground. The canvas is redrawn when the selection, the picture
 * or the frame change, and at most 20 times a second while only the camera moves. Its size comes from a size watcher,
 * so it reads nothing from the page while drawing.
 */
export class MinimapPanel {
  readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly levelChip: HTMLElement;
  private visible = false;
  private w = 0;
  private h = 0;
  private bake: Bake | null = null;
  private bakes = 0;
  /** The last picture's time (ms), for the e2e and perf checks. */
  bakeMs = 0;
  private ground: { terrain: TerrainData; area: PlanArea; scale: number; canvas: HTMLCanvasElement } | null = null;
  private pending: { timer: number; doc: MapDocument; firstAt: number } | null = null;
  private zoom = 1;
  /** Where a drag or a wheel left the centre (zoomed in); null: the camera. */
  private panned: { x: number; z: number } | null = null;
  private frameNow: PlanFrame | null = null;
  private drawnKey = '';
  private drawnSel = '';
  private lastDraw = 0;
  private marks: { rev: number; doc: MapDocument; level: number; list: SelectionMark[] } | null = null;
  private pieceCellsFor: { doc: MapDocument; cells: Map<string, readonly (readonly [number, number, number])[] | null> } | null = null;
  private zoomSave = 0;
  private zoomRead = false;
  private drag: { x: number; y: number; frame: PlanFrame; moved: boolean; id: number } | null = null;

  constructor(private readonly app: EditorApp, private readonly prefs: { zoom(): number; setZoom(z: number): void }) {
    this.root = document.createElement('div');
    this.root.className = 'ed-minimap';
    this.root.id = 'ed-minimap';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ed-minimap-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute('aria-label', 'Minimap of the level being edited: click a thing to select it, open ground to move the camera there; the wheel or + and − zoom, the arrow keys pan, Home fits, Enter opens Tile View');
    this.levelChip = document.createElement('span');
    this.levelChip.className = 'ed-minimap-level';
    const tools = document.createElement('div');
    tools.className = 'ed-minimap-tools';
    const button = (id: string, text: string, title: string, act: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = id;
      b.textContent = text;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', act);
      return b;
    };
    tools.append(
      button('ed-minimap-in', '+', 'Zoom the minimap in', () => this.zoomBy(1.5)),
      button('ed-minimap-out', '−', 'Zoom the minimap out', () => this.zoomBy(1 / 1.5)),
      button('ed-minimap-fit', '⌂', 'Fit the minimap to the level', () => this.fit()),
      button('ed-minimap-tile', '⊞', 'Tile View: the selection from above (Enter, or double-click)', () => this.app.openTileView()),
    );
    this.root.append(this.canvas, this.levelChip, tools);
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

  /** With the minimap focused (UI Phase 5, planKeys.ts): + / − zoom, the arrows pan, Home fits, Enter opens Tile View. */
  private mountKeys(): void {
    this.canvas.addEventListener('keydown', (e) => {
      const act = planKeyAction(e, 'minimap');
      if (!act || !this.frameNow) return;
      e.preventDefault();
      e.stopPropagation();
      if (act.kind === 'zoom') this.zoomBy(act.k);
      else if (act.kind === 'fit') this.fit();
      else if (act.kind === 'tileView') this.app.openTileView();
      else if (act.kind === 'pan') {
        // Zoomed out the whole level shows: zoom in a step first, so the arrows always move something.
        if (this.zoom <= 1) this.setZoom(1.5);
        const f = this.frameNow;
        this.panned = { x: f.cx + act.dx * 2 * f.halfW, z: f.cz - act.dy * 2 * f.halfH };
        this.drawnKey = '';
      }
    });
  }

  /** Shown in `slot` (the expanded dock's Minimap tab or the compact card), or hidden (null): nothing runs while hidden. */
  show(slot: HTMLElement | null): void {
    // The kept zoom, read once the dock has read its preferences.
    if (slot && !this.zoomRead) {
      this.zoomRead = true;
      this.zoom = clampMinimapZoom(this.prefs.zoom());
    }
    this.visible = !!slot;
    if (slot && this.root.parentElement !== slot) slot.append(this.root);
    this.drawnKey = '';
    if (!slot && this.pending) {
      clearTimeout(this.pending.timer);
      this.pending = null;
    }
  }

  get shown(): boolean {
    return this.visible;
  }

  /** For the checks: what it shows and what it cost. */
  state(): { visible: boolean; bakes: number; bakeMs: number; level: number | null; zoom: number; frame: PlanFrame | null; w: number; h: number; marks: SelectionMark[] } {
    return { visible: this.visible, bakes: this.bakes, bakeMs: this.bakeMs, level: this.bake?.level ?? null, zoom: this.zoom, frame: this.frameNow, w: this.w, h: this.h, marks: this.marks?.list ?? [] };
  }

  /** A world point's place on the page (for the checks' clicks), or null while hidden. */
  clientPoint(x: number, z: number): { x: number; y: number } | null {
    if (!this.visible || !this.frameNow) return null;
    const r = this.canvas.getBoundingClientRect();
    const p = planToScreen(this.frameNow, this.w, this.h, x, z);
    return { x: r.left + p.x, y: r.top + p.y };
  }

  private layersKey(): string {
    const hidden = this.app.view.hiddenLayers;
    return hidden.size ? [...hidden].sort().join(',') : '';
  }

  /** Each frame: a few numbers compared; a new picture scheduled when the map, level or layers changed; redrawn when what it shows moved. */
  frame(): void {
    if (!this.visible || this.w < 8 || this.h < 8) return;
    const doc = this.app.viewDoc;
    const level = this.app.level;
    const layers = this.layersKey();
    const b = this.bake;
    const stale = !b || b.doc !== doc || b.level !== level || b.layers !== layers;
    if (stale && (!this.pending || this.pending.doc !== doc)) {
      // A new level, layer filter or map: at once. An edit: once the edits pause (fix 6: nothing on the edit's path).
      const edited = !!b && b.level === level && b.layers === layers && b.doc.metadata.id === doc.metadata.id;
      const firstAt = this.pending?.firstAt ?? performance.now();
      const wait = bakeDelay({ edited, firstEditAgo: performance.now() - firstAt, dragging: !!this.app.input.drag });
      if (this.pending) clearTimeout(this.pending.timer);
      this.pending = null;
      if (wait === 0 && !edited) this.makeBake();
      else if (wait !== null) this.pending = { timer: window.setTimeout(() => this.firePending(), wait), doc, firstAt };
    }
    this.draw();
  }

  private firePending(): void {
    const p = this.pending;
    this.pending = null;
    if (!p || !this.visible) return;
    // Still dragging: the next frame schedules it again once the drag is let go.
    if (this.app.input.drag) return;
    this.makeBake();
    this.draw();
  }

  private reader(): MinimapReader {
    const app = this.app;
    const doc = app.doc;
    if (this.pieceCellsFor?.doc !== doc) this.pieceCellsFor = { doc, cells: new Map() };
    const cache = this.pieceCellsFor.cells;
    return {
      tileCells: (t) => placementCells(t),
      pieceCells: (id) => {
        if (cache.has(id)) return cache.get(id)!;
        const p = app.placementOf(id);
        const def = p && app.pieceDef(p.piece);
        const cells = p && def ? setPieceFootprint(p, def) : null;
        cache.set(id, cells);
        return cells;
      },
      entityLevel: (e) => (app.hover.onTerrain(e) ? null : app.hover.entityLevel(e)),
    };
  }

  /** The ground's picture: once per ground (sculpting makes a new one), area and scale. */
  private groundCanvas(terrain: TerrainData, area: PlanArea, scale: number, W: number, H: number): HTMLCanvasElement {
    const g0 = this.ground;
    if (g0 && g0.terrain === terrain && g0.scale === scale && g0.area.x0 === area.x0 && g0.area.z0 === area.z0 && g0.area.x1 === area.x1 && g0.area.z1 === area.z1) return g0.canvas;
    const c = g0?.canvas ?? document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    drawTerrainPlan(g, terrain, (x) => (x - area.x0) * scale, (z) => (area.z1 - z) * scale, scale);
    this.ground = { terrain, area, scale, canvas: c };
    return c;
  }

  /** The level's picture: the ground, then this level's floors, water, blocks and props, walls, and the tile outlines. */
  private makeBake(): void {
    const t0 = performance.now();
    const app = this.app;
    const doc = app.viewDoc;
    const level = app.level;
    const layers = this.layersKey();
    const fit = minimapArea(doc);
    const area = pictureArea(fit);
    const scale = bakeScale(area);
    const W = Math.max(1, Math.ceil((area.x1 - area.x0) * scale));
    const H = Math.max(1, Math.ceil((area.z1 - area.z0) * scale));
    const canvas = this.bake?.canvas ?? document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;
    const px = (x: number) => (x - area.x0) * scale;
    const py = (z: number) => (area.z1 - z) * scale;
    g.fillStyle = '#0d1322';
    g.fillRect(0, 0, W, H);
    const terrain = app.shownGround ?? doc.terrain;
    if (terrain) {
      // The ground on every level, fainter off the ground level: where a floor stands over it.
      g.globalAlpha = level === 0 ? 0.8 : 0.35;
      g.drawImage(this.groundCanvas(terrain, area, scale, W, H), 0, 0);
      g.globalAlpha = 1;
    }
    const hidden = app.view.hiddenLayers;
    const lh = doc.classicStructure.levelHeight;
    const tileIds = hidden.has('tile') ? new Set(doc.classicStructure.tiles.map((t) => t.id)) : null;
    const buried = level === 0 ? buriedTiles(doc) : null;
    const partOf = app.expansion.partOf;
    const shown = (id: string) => !(tileIds?.has(id) || buried?.has(id) || app.view.outlinerHidden(id) || app.view.outlinerHidden(partOf.get(id) ?? ''));
    const floors = [];
    const solids = [];
    const walls = [];
    // The level as played (MapMaker's cached boxes), and the breakable props and moving or hidden blocks the match
    // owns (they stand there too until broken or moved).
    for (const b of [...app.mapBoxes(), ...propBoxes(doc, true), ...blockBoxes(doc, true)]) {
      if (b.kind === 'barrier' || b.kind === 'trim' || boxLevel(b, lh) !== level || !shown(b.sourceId)) continue;
      if (b.kind === 'floor') floors.push(b);
      else if (b.kind === 'wall') walls.push(b);
      else if (b.kind !== 'prop' || !hidden.has('prop')) solids.push(b);
    }
    g.fillStyle = '#26365a';
    for (const b of floors) fillBox(g, b, px, py);
    for (const e of doc.entities) {
      if (e.kind !== 'water' || Math.floor((e.position[1] + e.size[1] / 2 + 0.5) / lh) !== level) continue;
      g.fillStyle = e.liquid === 'water' ? 'rgba(52, 130, 220, 0.55)' : 'rgba(120, 200, 80, 0.5)';
      g.fillRect(px(e.position[0] - e.size[0] / 2), py(e.position[2] + e.size[2] / 2), e.size[0] * scale, e.size[2] * scale);
    }
    for (const b of solids) {
      g.fillStyle = b.kind === 'prop' ? '#6a5434' : '#8a6a3f';
      fillBox(g, b, px, py);
    }
    g.fillStyle = '#b4c8e6';
    for (const b of walls) fillBox(g, b, px, py);
    if (level === 0) drawBuriedPassages(g, doc, px, py, Math.max(1, scale * 0.3));
    if (!hidden.has('tile')) {
      g.lineWidth = 1;
      for (const t of planTiles(doc, level)) {
        if (!shown(t.id) && !buried?.has(t.id)) continue;
        g.strokeStyle = t.current ? 'rgba(255, 255, 255, 0.55)' : 'rgba(200, 210, 230, 0.25)';
        g.strokeRect(px(t.x0) + 0.5, py(t.z1) + 0.5, (t.x1 - t.x0) * scale - 1, (t.z1 - t.z0) * scale - 1);
      }
    }
    const ground = app.shownGround;
    const items = new Map<string, string>();
    for (const e of doc.entities) if (e.kind === 'pickup') items.set(e.id, e.item);
    const markers = planMarkers(doc, level, ground ? (x, z) => terrainHeightAt(ground, x, z) : undefined)
      .filter((m) => !(m.kind === 'spawn' ? hidden.has('spawn') : m.kind === 'pickup' ? hidden.has('pickup') : hidden.has('logic')) && !app.view.outlinerHidden(m.id))
      // A pickup in its item's colour (as the plan view), worked out here rather than per draw.
      .map((m) => (m.kind === 'pickup' ? { ...m, color: itemColor(items.get(m.id) ?? '') || m.color } : m));
    this.bake = { canvas, area, fit, scale, doc, level, layers, markers, id: ++this.bakes };
    if (this.levelChip.textContent !== levelName(level)) this.levelChip.textContent = levelName(level);
    this.drawnKey = '';
    this.bakeMs = performance.now() - t0;
  }

  /** The canvas drawn again when what it shows changed (the camera at most every 50 ms). */
  private draw(): void {
    const b = this.bake;
    if (!b || this.w < 8 || this.h < 8) return;
    const { w, h } = this;
    const app = this.app;
    const cam = app.view.camera.position;
    const yaw = app.plan.on ? 0 : app.view.yaw;
    const f = minimapFrame(b.fit, w, h, this.zoom, this.zoom > 1 ? (this.panned ?? { x: cam.x, z: cam.z }) : null);
    const s = planScale(f, h);
    // (The selection's marks follow an edit at once; the picture under them a moment after the edits pause.)
    const selKey = `${b.id}|${app.selectionRev}|${app.history.revision}|${w}x${h}|${f.cx.toFixed(2)},${f.cz.toFixed(2)},${f.halfH.toFixed(3)}`;
    const key = `${selKey}|${Math.round(cam.x * s)},${Math.round(cam.z * s)},${Math.round(yaw * 30)}`;
    if (key === this.drawnKey) return;
    const now = performance.now();
    // Only the camera moved: at most every 50 ms (the rest at once).
    if (selKey === this.drawnSel && now - this.lastDraw < CAMERA_REDRAW_MS) return;
    this.drawnKey = key;
    this.drawnSel = selKey;
    this.lastDraw = now;
    this.frameNow = f;
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
    // The picture: the frame's rectangle of it, scaled to the canvas.
    const sx = (f.cx - f.halfW - b.area.x0) * b.scale;
    const sy = (b.area.z1 - (f.cz + f.halfH)) * b.scale;
    const sw = 2 * f.halfW * b.scale;
    const sh = 2 * f.halfH * b.scale;
    const dx = Math.max(0, -sx) * (w / sw);
    const dy = Math.max(0, -sy) * (h / sh);
    const cx0 = Math.max(0, sx);
    const cy0 = Math.max(0, sy);
    const cx1 = Math.min(b.canvas.width, sx + sw);
    const cy1 = Math.min(b.canvas.height, sy + sh);
    if (cx1 > cx0 && cy1 > cy0) {
      g.imageSmoothingEnabled = s < b.scale;
      g.drawImage(b.canvas, cx0, cy0, cx1 - cx0, cy1 - cy0, dx, dy, (cx1 - cx0) * (w / sw), (cy1 - cy0) * (h / sh));
    }
    const P = (x: number, z: number) => planToScreen(f, w, h, x, z);
    // Markers: spawns by team, flags, hills, objectives, pickups.
    const r = Math.max(3.5, Math.min(7, s * 0.6));
    for (const m of b.markers) {
      const p = P(m.x, m.z);
      if (p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) continue;
      if (m.radius > 0) {
        g.beginPath();
        g.arc(p.x, p.y, m.radius * s, 0, Math.PI * 2);
        g.lineWidth = 1;
        g.strokeStyle = m.color;
        g.globalAlpha = 0.7;
        g.stroke();
        g.globalAlpha = 1;
      }
      drawIcon(g, m, p.x, p.y, r, m.color, 0.7);
    }
    this.drawSelection(g, P, r);
    this.drawCamera(g, f, w, h, cam.x, cam.z, yaw);
    this.drawCompass(g, w, h, s);
  }

  /** The selection: cyan outlines (a ring for a thing), dashed where it is only on another level. */
  private drawSelection(g: CanvasRenderingContext2D, P: (x: number, z: number) => { x: number; y: number }, r: number): void {
    const app = this.app;
    const m0 = this.marks;
    if (!m0 || m0.rev !== app.selectionRev || m0.doc !== app.doc || m0.level !== app.level) {
      this.marks = { rev: app.selectionRev, doc: app.doc, level: app.level, list: app.selCount() ? selectionMarks(app.doc, app.selection, app.level, this.reader()) : [] };
    }
    for (const m of this.marks!.list) {
      g.save();
      if (!m.current) g.setLineDash([3, 3]);
      const a = P(m.x0, m.z1);
      const b = P(m.x1, m.z0);
      const ring = m.kind === 'entity';
      for (const [width, color] of [[4, 'rgba(5, 8, 16, 0.85)'], [2, SEL]] as const) {
        g.lineWidth = width;
        g.strokeStyle = color;
        g.globalAlpha = m.current ? 1 : 0.7;
        g.beginPath();
        if (ring) g.arc(a.x, a.y, r * 1.5, 0, Math.PI * 2);
        else g.rect(a.x, a.y, Math.max(3, b.x - a.x), Math.max(3, b.y - a.y));
        g.stroke();
      }
      g.restore();
    }
  }

  /** The camera: a dot, a short arrow the way it looks and the wedge it sees. */
  private drawCamera(g: CanvasRenderingContext2D, f: PlanFrame, w: number, h: number, x: number, z: number, yaw: number): void {
    const view = this.app.view;
    const engine = view.scene.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const m = cameraMarker(f, w, h, { x, z, yaw }, horizontalHalfFov(view.camera.fov, aspect), Math.min(w, h) * 0.22);
    g.save();
    g.beginPath();
    g.moveTo(m.x, m.y);
    g.lineTo(m.left.x, m.left.y);
    g.lineTo(m.right.x, m.right.y);
    g.closePath();
    g.fillStyle = 'rgba(255, 214, 102, 0.18)';
    g.fill();
    g.strokeStyle = 'rgba(255, 214, 102, 0.75)';
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.arc(m.x, m.y, 4, 0, Math.PI * 2);
    g.fillStyle = '#ffd666';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(5, 8, 16, 0.9)';
    g.stroke();
    g.beginPath();
    g.moveTo(m.x + m.dx * 4, m.y + m.dy * 4);
    g.lineTo(m.x + m.dx * 10, m.y + m.dy * 10);
    g.strokeStyle = '#ffd666';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  }

  /** North (up) and a scale bar of a round length. */
  private drawCompass(g: CanvasRenderingContext2D, w: number, h: number, s: number): void {
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
    const len = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((v) => v >= want) ?? 1000;
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
    g.fillText(`${len} m`, x0 + len * s + 4, y0);
    g.restore();
  }

  // ---------- zoom, pan, click ----------

  private setZoom(z: number, at?: { x: number; z: number }, sx?: number, sy?: number): void {
    const before = this.frameNow;
    this.zoom = clampMinimapZoom(z);
    if (this.zoom <= 1) this.panned = null;
    else if (before && at && sx !== undefined && sy !== undefined && this.bake) {
      // About the pointer: the point under it stays there.
      const f = minimapFrame(this.bake.fit, this.w, this.h, this.zoom, { x: before.cx, z: before.cz });
      const after = screenToPlan(f, this.w, this.h, sx, sy);
      this.panned = { x: f.cx + (at.x - after.x), z: f.cz + (at.z - after.z) };
    }
    this.drawnKey = '';
    clearTimeout(this.zoomSave);
    this.zoomSave = window.setTimeout(() => this.prefs.setZoom(this.zoom), 300);
  }

  private zoomBy(k: number): void {
    this.setZoom(this.zoom * k);
  }

  /** ⌂: the whole level again. */
  fit(): void {
    this.panned = null;
    this.setZoom(1);
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private mountPointer(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.frameNow || (e.button !== 0 && e.button !== 1)) return;
      const p = this.local(e);
      this.drag = { x: p.x, y: p.y, frame: this.frameNow, moved: false, id: e.pointerId };
      c.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const p = this.local(e);
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 4) return;
      d.moved = true;
      if (this.zoom <= 1) return;
      const f = planPan(d.frame, this.w, this.h, p.x - d.x, p.y - d.y);
      this.panned = { x: f.cx, z: f.cz };
      this.drawnKey = '';
    });
    const end = (e: PointerEvent, click: boolean) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (click && !d.moved && e.button === 0) this.click(e);
    };
    c.addEventListener('pointerup', (e) => end(e, true));
    c.addEventListener('pointercancel', (e) => end(e, false));
    c.addEventListener(
      'wheel',
      (e) => {
        if (!this.frameNow) return;
        e.preventDefault();
        const p = this.local(e);
        const at = screenToPlan(this.frameNow, this.w, this.h, p.x, p.y);
        this.setZoom(this.zoom * Math.exp(Math.max(-0.5, Math.min(0.5, -e.deltaY * 0.002))), at, p.x, p.y);
      },
      { passive: false },
    );
    // Double-click: Tile View on the tile or set piece there (else the selection the first click made, else that cell).
    c.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const f = this.frameNow;
      if (!f) return;
      const p = this.local(e);
      const at = screenToPlan(f, this.w, this.h, p.x, p.y);
      const app = this.app;
      const ref = app.selCount() ? focusRefFor(app.doc, app.selection) : null;
      const here = focusRefAt(app.doc, app.level, at.x, at.z, this.reader());
      app.openTileView(here.kind === 'region' && ref ? ref : here);
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** A click: the thing there selected (as a click in the outliner: Shift adds, Alt one part) and framed, or the camera sent to open ground. */
  private click(e: PointerEvent): void {
    const f = this.frameNow;
    if (!f) return;
    const app = this.app;
    const p = this.local(e);
    const at = screenToPlan(f, this.w, this.h, p.x, p.y);
    const s = planScale(f, this.h);
    const blocked = app.outliner.blocked;
    const sel = minimapPick(app.doc, app.level, at.x, at.z, 8 / s, this.reader(), {
      hiddenLayers: app.view.hiddenLayers,
      skip: (id) => (blocked.size > 0 && blocked.has(id)) || app.view.outlinerHidden(id),
    });
    if (sel) {
      app.setTool({ kind: 'select' });
      app.setSelection(e.shiftKey ? mergeSelections(app.selection, sel) : sel, e.altKey);
      app.focusSelection();
      return;
    }
    const y = app.level * app.doc.classicStructure.levelHeight;
    if (app.plan.on) app.plan.centre(at.x, at.z);
    else app.view.focus({ x: at.x, y, z: at.z });
    // Zoomed in: the minimap follows the camera again.
    this.panned = null;
    this.drawnKey = '';
  }
}
