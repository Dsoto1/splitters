import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RACE_VEHICLES, TRACK_SURFACES, Track as TrackSchema, conformTerrainToTrack, trackGeometry, trackPointAt, type EditCommand, type MapDocument, type Track, type Vec3 } from '@tiletrigger/shared';

/** What the road tool needs from MapMaker. */
export interface RoadToolHost {
  doc(): MapDocument;
  run(label: string, cmd: EditCommand): boolean;
  toast(text: string, bad?: boolean): void;
  scene: Scene;
}

/** How close (m) a click must be to a road point to grab it. */
const GRAB = 3;

const VEHICLE_LABELS: Record<(typeof RACE_VEHICLES)[number], string> = { kart: 'Go-Kart', speeder: 'Speeder', buggy: 'Buggy' };

/**
 * MapMaker's Road tool (race tracks): click to add road points (after the
 * selected one, so you can extend either end or the middle), drag a point to
 * move it, Shift-click a stretch of road to put a point in it, right-click or
 * Delete to remove one. The pane sets width, laps, circuit or point to point,
 * the start grid, vehicle, combat, surface and curbs, and lays the road into
 * the terrain. Every change is one undo step (setTrack); the road itself is
 * drawn by EditorView with the game's own road meshes.
 */
export class RoadTool {
  /** Selected point (new points go after it); -1 none. */
  selected = -1;
  /** The first click of a new track (a track needs two points before it exists). */
  private pending: [number, number, number] | null = null;
  private drag: { index: number; moved: boolean; at: [number, number, number] } | null = null;
  private markers: Mesh[] = [];
  private lines: LinesMesh | null = null;
  private active = false;
  private readonly mats: Record<'point' | 'start' | 'sel', StandardMaterial>;

  constructor(private readonly host: RoadToolHost) {
    const mat = (name: string, hex: string) => {
      const m = new StandardMaterial(name, host.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.6);
      m.specularColor = Color3.Black();
      return m;
    };
    this.mats = { point: mat('roadPoint', '#ffd34d'), start: mat('roadStart', '#3fd26b'), sel: mat('roadSel', '#ff7a2a') };
  }

  private get track(): Track | null {
    return this.host.doc().track;
  }

  setActive(on: boolean): void {
    this.active = on;
    if (!on) {
      this.pending = null;
      this.drag = null;
    }
    this.drawMarkers();
  }

  get dragging(): boolean {
    return !!this.drag;
  }

  private commit(label: string, after: Track | null): boolean {
    if (after) {
      const ok = TrackSchema.safeParse(after);
      if (!ok.success) {
        this.host.toast(`Can't ${label.toLowerCase()}: ${ok.error.issues[0]?.message ?? 'invalid track'}`, true);
        return false;
      }
    }
    return this.host.run(label, { kind: 'setTrack', before: this.track, after });
  }

  /** Index of the road point near (x, z), or -1. */
  private pointAt(p: Vec3): number {
    const pts = this.track?.points ?? [];
    let best = -1;
    let bestD = GRAB;
    pts.forEach((q, i) => {
      const d = Math.hypot(q[0] - p.x, q[2] - p.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  pointerDown(p: Vec3 | null, shift: boolean): void {
    if (!p) return;
    const doc = this.host.doc();
    const at = trackPointAt(doc.terrain, p.x, p.y, p.z);
    const t = this.track;
    const hit = this.pointAt(p);
    if (hit >= 0) {
      this.selected = hit;
      this.drag = { index: hit, moved: false, at: t!.points[hit]! };
      this.drawMarkers();
      return;
    }
    if (!t) {
      if (!this.pending) {
        this.pending = at;
        this.drawMarkers();
        return;
      }
      const track = TrackSchema.parse({ points: [this.pending, at] });
      this.pending = null;
      if (this.commit('Lay road', track)) this.selected = 1;
      return;
    }
    let index = this.selected >= 0 && this.selected < t.points.length ? this.selected + 1 : t.points.length;
    // Shift-click on the road: a point in the stretch under the pointer.
    if (shift) {
      const g = trackGeometry(doc);
      const near = g?.nearest(p.x, p.z, t.width);
      if (near) {
        const cps = t.points.map((q) => g!.nearest(q[0], q[2], 5)?.sample.s ?? 0);
        const s = near.sample.s;
        index = cps.findIndex((cs, i) => i > 0 && cs > s);
        if (index < 0) index = t.points.length;
      }
    }
    const points = [...t.points.slice(0, index), at, ...t.points.slice(index)];
    if (this.commit('Add road point', { ...t, points })) this.selected = index;
  }

  /** Dragging a point: it follows the pointer (shown live); committed on release. */
  pointerMove(p: Vec3 | null): void {
    const d = this.drag;
    if (!d || !p) return;
    const at = trackPointAt(this.host.doc().terrain, p.x, p.y, p.z);
    if (Math.hypot(at[0] - d.at[0], at[2] - d.at[2]) > 0.2) d.moved = true;
    d.at = at;
    this.drawMarkers();
  }

  pointerUp(): void {
    const d = this.drag;
    this.drag = null;
    const t = this.track;
    if (!d || !d.moved || !t) return this.drawMarkers();
    this.commit('Move road point', { ...t, points: t.points.map((q, i) => (i === d.index ? d.at : q)) });
  }

  /** Right-click: remove the point under the pointer. */
  erase(p: Vec3 | null): void {
    if (!p) return;
    const i = this.pointAt(p);
    if (i >= 0) this.remove(i);
  }

  deleteSelected(): boolean {
    if (this.selected < 0 || !this.track) return false;
    this.remove(this.selected);
    return true;
  }

  private remove(i: number): void {
    const t = this.track;
    if (!t) return;
    if (t.points.length <= 2) {
      if (this.commit('Remove road', null)) this.selected = -1;
      return;
    }
    if (this.commit('Delete road point', { ...t, points: t.points.filter((_, k) => k !== i) })) this.selected = Math.min(i, t.points.length - 2);
  }

  /** Called after every document change: keep the selection valid, redraw the points. */
  refresh(): void {
    const n = this.track?.points.length ?? 0;
    if (this.selected >= n) this.selected = n - 1;
    this.drawMarkers();
  }

  private drawMarkers(): void {
    for (const m of this.markers) m.dispose();
    this.markers = [];
    this.lines?.dispose();
    this.lines = null;
    if (!this.active) return;
    const pts = (this.track?.points ?? []).map((q, i) => (this.drag && this.drag.index === i ? this.drag.at : q));
    if (this.pending) pts.push(this.pending);
    pts.forEach((q, i) => {
      const s = CreateSphere(`roadPt${i}`, { diameter: i === 0 ? 1.6 : 1.1, segments: 8 }, this.host.scene);
      s.position.set(q[0], q[1] + 1, q[2]);
      s.material = i === this.selected ? this.mats.sel : i === 0 ? this.mats.start : this.mats.point;
      s.isPickable = false;
      this.markers.push(s);
    });
    if (pts.length >= 2) {
      const line = pts.map((q) => new Vector3(q[0], q[1] + 1, q[2]));
      if (this.track?.loop && pts.length >= 3) line.push(line[0]!.clone());
      this.lines = CreateLines('roadPoly', { points: line }, this.host.scene);
      this.lines.color = Color3.FromHexString('#ffd34d');
      this.lines.isPickable = false;
    }
  }

  /** The Road pane: settings for the whole track and its actions. */
  renderPane(el: HTMLElement): void {
    el.replaceChildren();
    const doc = this.host.doc();
    const t = doc.track;
    const note = document.createElement('p');
    note.className = 'ed-note';
    note.textContent = t
      ? 'Click to add a road point after the selected one (orange) · drag a point to move it · Shift-click the road to add a point there · right-click or Del removes one. The green point is the start line; the grid lines up behind it.'
      : 'Click the ground twice to lay a road, then keep clicking to draw it. A circuit closes on its own; Race mode uses it (Map properties → Mode).';
    el.append(note);
    if (!t) return;
    const g = trackGeometry(doc);
    const info = document.createElement('div');
    info.className = 'ed-note';
    info.id = 'ed-road-info';
    info.textContent = `${t.points.length} points · ${Math.round(g?.length ?? 0)} m · ${g?.gates.length ?? 0} checkpoints`;
    el.append(info);
    const set = (label: string, patch: Partial<Track>) => this.commit(label, { ...t, ...patch });
    const field = (label: string, control: HTMLElement) => {
      const l = document.createElement('label');
      l.className = 'stack';
      l.append(label, control);
      el.append(l);
    };
    const num = (id: string, value: number, min: number, max: number, onChange: (v: number) => void) => {
      const i = document.createElement('input');
      i.type = 'number';
      i.id = id;
      i.min = String(min);
      i.max = String(max);
      i.value = String(value);
      i.addEventListener('change', () => {
        const v = Math.round(Number(i.value));
        if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
      });
      return i;
    };
    const check = (id: string, label: string, value: boolean, onChange: (v: boolean) => void) => {
      const l = document.createElement('label');
      l.className = 'check';
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.id = id;
      i.checked = value;
      i.addEventListener('change', () => onChange(i.checked));
      l.append(i, ` ${label}`);
      el.append(l);
    };
    const pick = (id: string, options: readonly (readonly [string, string])[], value: string, onChange: (v: string) => void) => {
      const s = document.createElement('select');
      s.id = id;
      for (const [v, label] of options) s.append(new Option(label, v, v === value, v === value));
      s.addEventListener('change', () => onChange(s.value));
      return s;
    };
    field('Width (m)', num('ed-road-width', t.width, 5, 30, (v) => set('Road width', { width: v })));
    check('ed-road-loop', 'Circuit (closed loop)', t.loop, (v) => set(v ? 'Make a circuit' : 'Make point to point', { loop: v }));
    if (t.loop) field('Laps', num('ed-road-laps', t.laps, 1, 20, (v) => set('Laps', { laps: v })));
    field('Start grid places', num('ed-road-grid', t.grid, 2, 16, (v) => set('Start grid', { grid: v })));
    field('Vehicle', pick('ed-road-vehicle', RACE_VEHICLES.map((v) => [v, VEHICLE_LABELS[v]] as const), t.vehicle, (v) => set('Race vehicle', { vehicle: v as Track['vehicle'] })));
    field('Surface', pick('ed-road-surface', TRACK_SURFACES.map((v) => [v, v === 'asphalt' ? 'Asphalt' : 'Dirt'] as const), t.surface, (v) => set('Road surface', { surface: v as Track['surface'] })));
    check('ed-road-curbs', 'Red and white curbs', t.curbs, (v) => set('Curbs', { curbs: v }));
    check('ed-road-combat', 'Combat race (weapons, vehicle guns and sentries live)', t.combat, (v) => set('Combat race', { combat: v }));
    field('Ambient cars (lap the track in every mode)', num('ed-road-ambient', t.ambient, 0, 12, (v) => set('Ambient cars', { ambient: v })));
    if (t.ambient) field('Ambient car', pick('ed-road-ambient-vehicle', RACE_VEHICLES.map((v) => [v, VEHICLE_LABELS[v]] as const), t.ambientVehicle, (v) => set('Ambient car', { ambientVehicle: v as Track['vehicle'] })));
    const buttons = document.createElement('div');
    buttons.className = 'ed-row-buttons';
    const btn = (id: string, label: string, title: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.id = id;
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', onClick);
      buttons.append(b);
    };
    btn('ed-road-start', 'Start here', 'Move the start line (and the grid behind it) to the selected point', () => {
      const i = this.selected;
      if (i <= 0) return this.host.toast('Select a road point first (click it)');
      if (!t.loop) return this.host.toast('A point-to-point road starts at its first point: reverse it to start from the other end', true);
      if (this.commit('Move the start', { ...t, points: [...t.points.slice(i), ...t.points.slice(0, i)] })) this.selected = 0;
    });
    btn('ed-road-reverse', 'Reverse', 'Race the other way round', () => {
      const points = t.loop ? [t.points[0]!, ...t.points.slice(1).reverse()] : [...t.points].reverse();
      this.commit('Reverse the road', { ...t, points });
    });
    btn('ed-road-terrain', 'Lay into terrain', 'Flatten the ground under the road and blend the shoulders into the hills (one undo step)', () => {
      if (!doc.terrain) return this.host.toast('No terrain to lay the road into', true);
      this.host.run('Lay road into terrain', { kind: 'setTerrain', before: doc.terrain, after: conformTerrainToTrack(doc.terrain, t) });
    });
    btn('ed-road-pit', 'Pit lane here', 'Wrecked ambient cars come back just off the road beside the selected point (lined up behind it)', () => {
      const p = t.points[this.selected];
      const geo = trackGeometry(doc);
      const near = p && geo?.nearest(p[0], p[2], 20);
      if (!p || !near) return this.host.toast('Select a road point first (click it)');
      const off = t.width / 2 + 8;
      const r = (v: number) => Math.round(v * 100) / 100;
      set('Pit lane', { pit: [r(near.sample.x + near.sample.dz * off), r(near.sample.y), r(near.sample.z - near.sample.dx * off)] });
    });
    btn('ed-road-remove', 'Remove road', 'Delete the whole track', () => {
      if (this.commit('Remove road', null)) this.host.toast('Race track removed · Ctrl+Z brings it back');
    });
    el.append(buttons);
  }
}
