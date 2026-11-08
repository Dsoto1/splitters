import { Camera } from '@babylonjs/core/Cameras/camera';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import type { Material } from '@babylonjs/core/Materials/material';
import { levelName, planArea, planFileName, planFitAspect, planFrame, planMarkers, planMove, planPan, planScale, planTiles, planToScreen, planZoom, screenToPlan, terrainHeightAt, type MapDocument, type PlanFrame, type PlanMarker, type TerrainData } from '@tiletrigger/shared';
import { itemColor } from '../game/pickupVisuals.ts';
import type { EditorView } from './editorView.ts';

/**
 * The plan view (MapMaker overhaul Phase 3, item 2; K, the top bar's Plan): the level being edited from straight
 * above through an orthographic camera, cut a little above the level's floor so rooms show inside, with the tile
 * outlines and icons for spawns (by team), objectives, flags, hills and pickups drawn over it (the maths: shared
 * editor/planView.ts). Selecting and moving work as in the 3D view (the pointer's ray just points straight down);
 * the wheel zooms about the pointer, a right or middle drag and WASD pan. Export PNG saves the plan (the view and its
 * icons, with a key) through the browser's download. Nothing is stored in the map.
 */
export interface PlanHost {
  view: EditorView;
  /** The document as drawn (set pieces expanded). */
  doc(): MapDocument;
  level(): number;
  ground(): TerrainData | null;
  selected(): ReadonlySet<string>;
  showAll(): boolean;
  setShowAll(on: boolean): void;
  toast(message: string, error?: boolean): void;
  /** The plan went on or off (the top bar's button, the hover). */
  changed(on: boolean): void;
}

/** Where the plan is cut: this far above the level's floor (as an architect's plan, through the walls, under the roof). */
const CUT_ABOVE_FLOOR = 0.6;
/** The camera stands this far above the cut, looking straight down. */
const CAMERA_ABOVE_CUT = 60;
/** Never clipped: terrain stays whole on the plan (a hill above the cut is still ground). */
const NO_CLIP = new Plane(0, 0, 0, -1);

export class PlanView {
  on = false;
  private frame: PlanFrame | null = null;
  private saved: { x: number; y: number; z: number; yaw: number; pitch: number; showAll: boolean } | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private bar: HTMLElement | null = null;
  private drawnKey = '';
  private clipped = new Map<Material, Plane | null | undefined>();
  private clippedFor: unknown = null;

  constructor(private readonly host: PlanHost) {}

  /** The cut's height (world metres): Play from here starts from it in the plan view. */
  get cutY(): number {
    const lh = this.host.doc().classicStructure.levelHeight;
    return this.host.level() * lh + lh * CUT_ABOVE_FLOOR;
  }

  toggle(): void {
    if (this.on) this.exit();
    else this.enter();
  }

  enter(): void {
    if (this.on) return;
    const { view } = this.host;
    const c = view.camera.position;
    this.saved = { x: c.x, y: c.y, z: c.z, yaw: view.yaw, pitch: view.pitch, showAll: this.host.showAll() };
    // The level and those below it: the plan of one level.
    if (this.saved.showAll) this.host.setShowAll(false);
    this.on = true;
    const { w, h } = this.size();
    this.frame = planFrame(planArea(this.host.doc()), w / h);
    view.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    view.yaw = 0;
    view.pitch = -Math.PI / 2;
    view.applyCamera();
    this.buildOverlay();
    this.drawnKey = '';
    this.update();
    this.host.changed(true);
    this.host.toast(`Plan view of ${levelName(this.host.level())}: PgUp / PgDn for another level, K to leave`);
  }

  exit(): void {
    if (!this.on) return;
    const { view } = this.host;
    this.on = false;
    view.camera.mode = Camera.PERSPECTIVE_CAMERA;
    view.scene.clipPlane = null;
    this.unclip();
    const s = this.saved;
    if (s) {
      view.camera.position.set(s.x, s.y, s.z);
      view.yaw = s.yaw;
      view.pitch = s.pitch;
      view.applyCamera();
      if (s.showAll) this.host.setShowAll(true);
    }
    this.saved = null;
    this.overlay?.remove();
    this.bar?.remove();
    this.overlay = this.bar = null;
    this.host.changed(false);
  }

  /** The view's size in CSS pixels (the 3D canvas). */
  private size(): { w: number; h: number; left: number; top: number } {
    const r = this.host.view.scene.getEngine().getRenderingCanvasClientRect();
    return { w: Math.max(1, r?.width ?? window.innerWidth), h: Math.max(1, r?.height ?? window.innerHeight), left: r?.left ?? 0, top: r?.top ?? 0 };
  }

  /** Each frame in the plan view: the camera on the frame, the cut, and the icons redrawn when anything they show changed. */
  update(): void {
    if (!this.on || !this.frame) return;
    const { view } = this.host;
    const { w, h } = this.size();
    if (Math.abs(this.frame.halfW / this.frame.halfH - w / h) > 1e-6) this.frame = planFitAspect(this.frame, w / h);
    const f = this.frame;
    const cut = this.cutY;
    const cam = view.camera;
    cam.position.set(f.cx, cut + CAMERA_ABOVE_CUT, f.cz);
    cam.orthoLeft = -f.halfW;
    cam.orthoRight = f.halfW;
    cam.orthoTop = f.halfH;
    cam.orthoBottom = -f.halfH;
    if (view.scene.clipPlane?.d !== -cut) view.scene.clipPlane = new Plane(0, 1, 0, -cut);
    const doc = this.host.doc();
    if (this.clippedFor !== doc) this.keepTerrainWhole(doc);
    const sel = [...this.host.selected()].join(',');
    const key = `${f.cx},${f.cz},${f.halfH},${w},${h},${this.host.level()},${sel}`;
    if (key === this.drawnKey && this.drawnDoc === doc) return;
    this.drawnKey = key;
    this.drawnDoc = doc;
    this.drawOverlay();
  }

  private drawnDoc: MapDocument | null = null;

  /** The terrain's materials aren't cut (hills above the cut are still the ground). Once per document version. */
  private keepTerrainWhole(doc: MapDocument): void {
    this.clippedFor = doc;
    for (const m of this.host.view.scene.meshes) {
      if (!m.name.includes('_terrain_') || !m.material || this.clipped.has(m.material)) continue;
      this.clipped.set(m.material, m.material.clipPlane);
      m.material.clipPlane = NO_CLIP;
    }
  }

  private unclip(): void {
    for (const [m, was] of this.clipped) m.clipPlane = was ?? null;
    this.clipped.clear();
    this.clippedFor = null;
  }

  /** Wheel: zoom about the pointer (`delta` > 0: out). */
  zoom(delta: number, clientX: number, clientY: number): void {
    if (!this.frame) return;
    const { w, h, left, top } = this.size();
    const at = screenToPlan(this.frame, w, h, clientX - left, clientY - top);
    this.frame = planZoom(this.frame, Math.exp(Math.max(-0.5, Math.min(0.5, delta * 0.002))), at);
  }

  /** A drag of (dx, dy) pixels: the ground follows the pointer. */
  pan(dx: number, dy: number): void {
    if (!this.frame) return;
    const { w, h } = this.size();
    this.frame = planPan(this.frame, w, h, dx, dy);
  }

  /** WASD: move by metres (north up). */
  move(east: number, north: number): void {
    if (this.frame) this.frame = planMove(this.frame, east, north);
  }

  /** Home: the whole area again. F: centre on a point. */
  fit(): void {
    const { w, h } = this.size();
    this.frame = planFrame(planArea(this.host.doc()), w / h);
  }

  centre(x: number, z: number): void {
    if (this.frame) this.frame = { ...this.frame, cx: x, cz: z };
  }

  // ---------- drawing ----------

  private buildOverlay(): void {
    const editor = document.getElementById('editor') ?? document.body;
    const c = document.createElement('canvas');
    c.id = 'ed-plan-overlay';
    // First in the editor: its panels draw over it.
    editor.prepend(c);
    this.overlay = c;
    const bar = document.createElement('div');
    bar.id = 'ed-plan-bar';
    const title = document.createElement('b');
    title.id = 'ed-plan-title';
    const png = document.createElement('button');
    png.id = 'ed-plan-export';
    png.textContent = 'Export PNG';
    png.title = 'Save this plan as a picture (the view and its icons, with a key)';
    png.addEventListener('click', () => void this.exportPng());
    const close = document.createElement('button');
    close.id = 'ed-plan-close';
    close.textContent = 'Back to 3D (K)';
    close.addEventListener('click', () => this.exit());
    bar.append(title, png, close);
    editor.append(bar);
    this.bar = bar;
  }

  private markers(): PlanMarker[] {
    const g = this.host.ground();
    return planMarkers(this.host.doc(), this.host.level(), g ? (x, z) => terrainHeightAt(g, x, z) : undefined);
  }

  private drawOverlay(): void {
    const c = this.overlay;
    if (!c || !this.frame) return;
    const { w, h, left, top } = this.size();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    Object.assign(c.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    this.paint(g, w, h, 1);
    const t = document.getElementById('ed-plan-title');
    if (t) t.textContent = `Plan · ${levelName(this.host.level())}`;
  }

  /** Draw the outlines, icons, scale bar and north arrow on a w × h plan (`u`: the size of a CSS pixel). */
  private paint(g: CanvasRenderingContext2D, w: number, h: number, u: number): void {
    const f = this.frame!;
    const doc = this.host.doc();
    const P = (x: number, z: number) => planToScreen(f, w, h, x, z);
    const s = planScale(f, h);
    const sel = this.host.selected();
    // Tile outlines: this level's bright, the level below's faint and dashed.
    for (const t of planTiles(doc, this.host.level())) {
      const a = P(t.x0, t.z1);
      const b = P(t.x1, t.z0);
      g.save();
      g.lineWidth = (t.current ? 2 : 1) * u;
      // White, not the level grid's cyan: the tiles stand out from the grid lines.
      g.strokeStyle = sel.has(t.id) ? '#ffb03b' : t.current ? 'rgba(255, 255, 255, 0.95)' : 'rgba(200, 210, 230, 0.45)';
      if (!t.current) g.setLineDash([4 * u, 4 * u]);
      g.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      g.restore();
    }
    const r = Math.max(6, Math.min(14, s * 0.6)) * u;
    for (const m of this.markers()) {
      const p = P(m.x, m.z);
      if (p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) continue;
      g.save();
      if (m.radius > 0) {
        g.beginPath();
        g.arc(p.x, p.y, m.radius * s, 0, Math.PI * 2);
        g.setLineDash([5 * u, 4 * u]);
        g.lineWidth = 1.5 * u;
        g.strokeStyle = m.color;
        g.globalAlpha = 0.8;
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }
      const color = m.kind === 'pickup' ? itemColor(this.pickupItem(m.id) ?? '') || m.color : m.color;
      drawIcon(g, m, p.x, p.y, r, color, u);
      if (sel.has(m.id)) {
        g.beginPath();
        g.arc(p.x, p.y, r * 1.35, 0, Math.PI * 2);
        g.lineWidth = 2 * u;
        g.strokeStyle = '#ffb03b';
        g.stroke();
      }
      g.restore();
    }
    // Scale bar (a round length about a sixth of the view) and the north arrow.
    const want = (w / 6) / s;
    const len = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((v) => v >= want) ?? 1000;
    const x0 = 16 * u;
    const y0 = h - 20 * u;
    g.fillStyle = 'rgba(8, 12, 22, 0.7)';
    g.fillRect(x0 - 6 * u, y0 - 18 * u, len * s + 12 * u + 40 * u, 26 * u);
    g.strokeStyle = '#e8f0ff';
    g.lineWidth = 2 * u;
    g.beginPath();
    g.moveTo(x0, y0 - 5 * u);
    g.lineTo(x0, y0);
    g.lineTo(x0 + len * s, y0);
    g.lineTo(x0 + len * s, y0 - 5 * u);
    g.stroke();
    g.fillStyle = '#e8f0ff';
    g.font = `${11 * u}px system-ui, sans-serif`;
    g.textBaseline = 'alphabetic';
    g.fillText(`${len} m`, x0 + len * s + 6 * u, y0);
    const nx = w - 26 * u;
    const ny = h - 30 * u;
    g.beginPath();
    g.moveTo(nx, ny - 12 * u);
    g.lineTo(nx + 7 * u, ny + 8 * u);
    g.lineTo(nx, ny + 4 * u);
    g.lineTo(nx - 7 * u, ny + 8 * u);
    g.closePath();
    g.fill();
    g.textAlign = 'center';
    g.fillText('N', nx, ny - 15 * u);
    g.textAlign = 'left';
  }

  private pickupItem(id: string): string | undefined {
    const e = this.host.doc().entities.find((x) => x.id === id);
    return e?.kind === 'pickup' ? e.item : undefined;
  }

  /** Export PNG: the next frame drawn without the editing aids, the icons over it, a title and a key below. */
  async exportPng(): Promise<void> {
    if (!this.frame) return;
    const shot = await grabFrame(this.host.view);
    if (!shot) return this.host.toast("Couldn't capture the plan: try again", true);
    const { w, h } = this.size();
    const k = shot.width / w;
    const keyH = Math.round(54 * k);
    const out = document.createElement('canvas');
    out.width = shot.width;
    out.height = shot.height + keyH;
    const g = out.getContext('2d');
    if (!g) return;
    g.drawImage(shot, 0, 0);
    g.save();
    g.scale(k, k);
    this.paint(g, w, h, 1);
    g.restore();
    // The key: the map, the level, and what each icon is.
    g.fillStyle = '#0d1322';
    g.fillRect(0, shot.height, out.width, keyH);
    g.fillStyle = '#e8f0ff';
    g.font = `bold ${Math.round(15 * k)}px system-ui, sans-serif`;
    g.textBaseline = 'middle';
    const doc = this.host.doc();
    const y = shot.height + keyH / 2;
    g.fillText(`${doc.metadata.name} · ${levelName(this.host.level())} plan`, 14 * k, y);
    const kinds: [PlanMarker['kind'], string, string][] = [
      ['spawn', 'Spawn (team colour)', '#4fb3ff'],
      ['flag', 'Flag', '#ff5a4f'],
      ['hill', 'Hill', '#ffd34d'],
      ['objective', 'Objective', '#ff8a3a'],
      ['pickup', 'Pickup (item colour)', '#58d68d'],
    ];
    g.font = `${Math.round(12 * k)}px system-ui, sans-serif`;
    let x = out.width - 14 * k;
    for (const [kind, label, color] of [...kinds].reverse()) {
      const tw = g.measureText(label).width;
      x -= tw;
      g.fillStyle = '#c8d4ea';
      g.fillText(label, x, y);
      x -= 16 * k;
      drawIcon(g, { kind, yaw: 0, label: kind === 'objective' ? 'A' : '' }, x, y, 7 * k, color, k);
      x -= 22 * k;
    }
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) return this.host.toast("Couldn't save the plan picture", true);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = planFileName(doc.metadata.name, this.host.level());
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.host.toast(`Plan saved as ${a.download}`);
  }
}

/** One plan icon at (x, y), `r` across its middle. */
function drawIcon(g: CanvasRenderingContext2D, m: Pick<PlanMarker, 'kind' | 'yaw' | 'label'>, x: number, y: number, r: number, color: string, u: number): void {
  g.save();
  g.translate(x, y);
  g.lineWidth = 1.5 * u;
  g.strokeStyle = 'rgba(8, 12, 22, 0.9)';
  g.fillStyle = color;
  switch (m.kind) {
    case 'spawn':
      // An arrow the way the spawn faces (yaw 0 = north = up on the plan).
      g.rotate(m.yaw);
      g.beginPath();
      g.moveTo(0, -r);
      g.lineTo(r * 0.75, r * 0.7);
      g.lineTo(0, r * 0.3);
      g.lineTo(-r * 0.75, r * 0.7);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'flag':
      g.beginPath();
      g.moveTo(-r * 0.5, r);
      g.lineTo(-r * 0.5, -r);
      g.lineTo(r * 0.8, -r * 0.5);
      g.lineTo(-r * 0.5, 0);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'hill':
      g.beginPath();
      g.moveTo(-r, r * 0.6);
      g.lineTo(0, -r * 0.7);
      g.lineTo(r, r * 0.6);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    case 'objective':
      g.beginPath();
      g.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
      g.fill();
      g.stroke();
      if (m.label) {
        g.fillStyle = '#0d1322';
        g.font = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(m.label, 0, r * 0.05);
      }
      break;
    case 'pickup':
      g.beginPath();
      g.moveTo(0, -r * 0.75);
      g.lineTo(r * 0.75, 0);
      g.lineTo(0, r * 0.75);
      g.lineTo(-r * 0.75, 0);
      g.closePath();
      g.fill();
      g.stroke();
      break;
  }
  g.restore();
}

/**
 * The next frame the scene draws without the editing aids (grid, ghosts, gizmo, markers), copied into a canvas.
 * Read at the end of a frame the scene rendered in, before the browser clears the drawing buffer (as makerThumb.ts).
 */
export function grabFrame(view: EditorView): Promise<HTMLCanvasElement | null> {
  const engine = view.scene.getEngine();
  const canvas = engine.getRenderingCanvas();
  if (!canvas) return Promise.resolve(null);
  view.photoMode(true);
  return new Promise((resolve) => {
    let rendered = false;
    const after = view.scene.onAfterRenderObservable.add(() => (rendered = true));
    const done = (v: HTMLCanvasElement | null) => {
      clearTimeout(timer);
      view.scene.onAfterRenderObservable.remove(after);
      engine.onEndFrameObservable.remove(end);
      view.photoMode(false);
      resolve(v);
    };
    const end = engine.onEndFrameObservable.add(() => {
      if (!rendered) return;
      try {
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        out.getContext('2d')!.drawImage(canvas, 0, 0);
        done(out);
      } catch {
        done(null);
      }
    });
    const timer = window.setTimeout(() => done(null), 5000);
  });
}
