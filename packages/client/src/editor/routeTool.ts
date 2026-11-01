import type { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { dropArea, type EditCommand, type MapDocument, type MapEntity, type Vec3 } from '@tiletrigger/shared';

/** What the route tool needs from MapMaker. */
export interface RouteToolHost {
  doc(): MapDocument;
  run(label: string, cmd: EditCommand): boolean;
  toast(text: string, bad?: boolean): void;
  scene: Scene;
}

type Mover = Extract<MapEntity, { kind: 'mover' }>;
type Plane = Extract<MapEntity, { kind: 'airplane' }>;

/** How close (m, across the ground) a click must be to a point to grab it. */
const GRAB = 2;
const r2 = (v: number) => Math.round(v * 100) / 100 + 0;

/**
 * Drawing a mover's or a transport plane's route on the map, with the same hands as Paths and the
 * race Road: click adds a point after the selected one, drag a point to move it, Shift-click a
 * stretch puts a point in it, right-click or Delete removes one. Points stay what the map stores:
 * offsets from the marker (a mover's keep their height; a plane's fly at its altitude). Each change
 * is one undo step (updateEntities).
 */
export class RouteTool {
  /** The mover or plane whose route is drawn. */
  entityId: string | null = null;
  selected = -1;
  private drag: { index: number; moved: boolean; at: Vec3 } | null = null;
  private markers: Mesh[] = [];
  private lines: LinesMesh[] = [];
  private active = false;
  private readonly mats: Record<'point' | 'sel', StandardMaterial>;

  constructor(private readonly host: RouteToolHost) {
    const mat = (name: string, hex: string) => {
      const m = new StandardMaterial(name, host.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.6);
      m.specularColor = Color3.Black();
      return m;
    };
    this.mats = { point: mat('routePoint', '#7dffb0'), sel: mat('routeSel', '#ff7a2a') };
  }

  private get entity(): Mover | Plane | null {
    const e = this.host.doc().entities.find((x) => x.id === this.entityId);
    return e && (e.kind === 'mover' || e.kind === 'airplane') ? e : null;
  }

  /** The route in world space (a plane's at its altitude). */
  private world(e: Mover | Plane): Vec3[] {
    const [ox, oy, oz] = e.position;
    return e.kind === 'mover' ? e.points.map(([x, y, z]) => ({ x: ox + x, y: oy + y, z: oz + z })) : e.route.map(([x, z]) => ({ x: ox + x, y: oy + e.altitude, z: oz + z }));
  }

  get label(): string {
    const e = this.entity;
    return e?.kind === 'airplane' ? (e.craft === 'dropship' ? 'dropship route' : 'plane route') : 'mover route';
  }

  /** Edit this entity's route (a mover or a plane), or nothing. */
  edit(id: string | null): void {
    this.entityId = id;
    this.selected = -1;
    this.drag = null;
    this.draw();
  }

  setActive(on: boolean): void {
    this.active = on;
    if (!on) this.drag = null;
    this.draw();
  }

  get dragging(): boolean {
    return !!this.drag;
  }

  /** Commit new world-space points (and the mover's hinge angles kept in step). */
  private commit(label: string, pts: Vec3[], angles?: number[]): boolean {
    const e = this.entity;
    if (!e) return false;
    const [ox, oy, oz] = e.position;
    const max = e.kind === 'mover' ? 16 : 32;
    if (pts.length < 2) return (this.host.toast(`A ${this.label} needs at least two points`, true), false);
    if (pts.length > max) return (this.host.toast(`A ${this.label} has at most ${max} points`, true), false);
    const after: MapEntity =
      e.kind === 'mover'
        ? { ...e, points: pts.map((p) => [r2(p.x - ox), r2(p.y - oy), r2(p.z - oz)] as [number, number, number]), ...(e.angles ? { angles: angles ?? e.angles } : {}) }
        : { ...e, route: pts.map((p) => [r2(Math.max(-2000, Math.min(2000, p.x - ox))), r2(Math.max(-2000, Math.min(2000, p.z - oz)))] as [number, number]) };
    return this.host.run(label, { kind: 'updateEntities', before: [e], after: [after] });
  }

  private pointAt(p: Vec3): number {
    const e = this.entity;
    if (!e) return -1;
    let best = -1;
    let bestD = GRAB;
    this.world(e).forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Where a click on the ground puts a point: a mover's at the height of the point it follows, a plane's at its altitude. */
  private place(e: Mover | Plane, p: Vec3, after: number): Vec3 {
    const pts = this.world(e);
    const y = e.kind === 'airplane' ? e.position[1] + e.altitude : (pts[Math.max(0, Math.min(pts.length - 1, after))]?.y ?? p.y);
    return { x: p.x, y, z: p.z };
  }

  pointerDown(p: Vec3 | null, shift: boolean): void {
    const e = this.entity;
    if (!p) return;
    if (!e) return this.host.toast('Select a mover, transport plane or dropship, then "Draw route"', true);
    const hit = this.pointAt(p);
    if (hit >= 0) {
      this.selected = hit;
      this.drag = { index: hit, moved: false, at: this.world(e)[hit]! };
      this.draw();
      return;
    }
    const pts = this.world(e);
    let index = this.selected >= 0 && this.selected < pts.length ? this.selected + 1 : pts.length;
    // Shift-click: into the stretch nearest the pointer.
    if (shift) {
      let best = Infinity;
      const loop = e.kind === 'airplane' ? e.closed : e.mode === 'loop';
      for (let i = 0; i < pts.length - (loop ? 0 : 1); i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
        const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
        if (d < best) {
          best = d;
          index = i + 1;
        }
      }
    }
    const at = this.place(e, p, index - 1);
    const next = [...pts.slice(0, index), at, ...pts.slice(index)];
    const angles = e.kind === 'mover' && e.angles ? [...e.angles.slice(0, index), e.angles[index - 1] ?? 0, ...e.angles.slice(index)] : undefined;
    if (this.commit(`Add ${this.label} point`, next, angles)) this.selected = index;
  }

  pointerMove(p: Vec3 | null): void {
    const d = this.drag;
    const e = this.entity;
    if (!d || !p || !e) return;
    const at = { x: p.x, y: d.at.y, z: p.z };
    if (Math.hypot(at.x - d.at.x, at.z - d.at.z) > 0.1) d.moved = true;
    d.at = at;
    this.draw();
  }

  pointerUp(): void {
    const d = this.drag;
    const e = this.entity;
    this.drag = null;
    if (!d || !d.moved || !e) return this.draw();
    this.commit(`Move ${this.label} point`, this.world(e).map((q, i) => (i === d.index ? d.at : q)));
  }

  /** Right-click: remove the point under the pointer. */
  erase(p: Vec3 | null): void {
    if (!p) return;
    const i = this.pointAt(p);
    if (i >= 0) this.remove(i);
  }

  deleteSelected(): boolean {
    if (this.selected < 0 || !this.entity) return false;
    this.remove(this.selected);
    return true;
  }

  private remove(i: number): void {
    const e = this.entity;
    if (!e) return;
    const angles = e.kind === 'mover' && e.angles ? e.angles.filter((_, k) => k !== i) : undefined;
    const pts = this.world(e).filter((_, k) => k !== i);
    if (this.commit(`Delete ${this.label} point`, pts, angles)) this.selected = Math.min(i, pts.length - 1);
  }

  /** After every document change: keep the selection valid, redraw. */
  refresh(): void {
    const e = this.entity;
    if (!e) this.entityId = null;
    else if (this.selected >= this.world(e).length) this.selected = this.world(e).length - 1;
    this.draw();
  }

  private draw(): void {
    for (const m of this.markers) m.dispose();
    for (const l of this.lines) l.dispose();
    this.markers = [];
    this.lines = [];
    const e = this.entity;
    if (!this.active || !e) return;
    const pts = this.world(e).map((q, i) => (this.drag && this.drag.index === i ? this.drag.at : q));
    pts.forEach((q, i) => {
      const s = CreateSphere(`routePt${i}`, { diameter: e.kind === 'airplane' ? 3 : 0.8, segments: 6 }, this.host.scene);
      s.position.set(q.x, q.y + 0.4, q.z);
      s.material = i === this.selected ? this.mats.sel : this.mats.point;
      s.isPickable = false;
      this.markers.push(s);
    });
    const line = pts.map((q) => new Vector3(q.x, q.y + 0.4, q.z));
    if ((e.kind === 'airplane' ? e.closed : e.mode === 'loop') && line.length >= 3) line.push(line[0]!.clone());
    if (e.kind === 'airplane') {
      // A drop route: green where it flies over the play area (riders may jump), grey outside it.
      const area = dropArea(this.host.doc());
      const inside = (v: Vector3) => !area || (v.x >= area.x0 && v.x <= area.x1 && v.z >= area.z0 && v.z <= area.z1);
      const dense: Vector3[] = [];
      for (let i = 0; i + 1 < line.length; i++) {
        const [a, b] = [line[i]!, line[i + 1]!];
        const n = Math.max(1, Math.ceil(Vector3.Distance(a, b) / 4));
        for (let k = 0; k < n; k++) dense.push(Vector3.Lerp(a, b, k / n));
      }
      if (line.length) dense.push(line[line.length - 1]!.clone());
      const green = new Color4(0.49, 1, 0.69, 1);
      const grey = new Color4(0.55, 0.58, 0.62, 1);
      const l = CreateLines('routePoly', { points: dense, colors: dense.map((v) => (inside(v) ? green : grey)) }, this.host.scene);
      l.isPickable = false;
      this.lines.push(l);
      return;
    }
    const l = CreateLines('routePoly', { points: line }, this.host.scene);
    l.color = Color3.FromHexString('#7dffb0');
    l.isPickable = false;
    this.lines.push(l);
  }
}
