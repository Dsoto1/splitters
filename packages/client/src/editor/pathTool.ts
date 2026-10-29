import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MapPath as PathSchema, PATH_LOOKS, PATH_STYLES, newId, pathGeometry, trackPointAt, type EditCommand, type MapDocument, type MapPath, type PathStyle, type TerrainData, type Vec3 } from '@tiletrigger/shared';
import { pathLift, pathSurfaceY } from '../pathMeshes.ts';

/** What the path tool needs from MapMaker. */
export interface PathToolHost {
  doc(): MapDocument;
  run(label: string, cmd: EditCommand): boolean;
  toast(text: string, bad?: boolean): void;
  scene: Scene;
  /** The ground as drawn (paths laid in), or null without terrain: handles and lines sit on the road drawn on it. */
  ground(): TerrainData | null;
  /** Screen position of a world point (null behind the camera) and of the pointer: handles are grabbed by how near they look. */
  screen(p: Vec3): { x: number; y: number } | null;
  pointer(): { x: number; y: number } | null;
}

/** A handle is grabbed within this many pixels of where it is drawn, or this many metres of its point (close up). */
const GRAB_PX = 18;
const GRAB_M = 1;
/** Handle sizes (m): the edited path's, other paths'. */
const HANDLE = 1;
const HANDLE_OTHER = 0.7;

/**
 * MapMaker's Paths tool: roads, streets, trails and walkways (map/paths.ts),
 * any number of them, each in a style and width. The same hands as the race
 * Road tool: click to add a point after the selected one (the first two
 * clicks start a path), drag a point to move it, Shift-click a path to put a
 * point in it, right-click or Delete removes one (a path's last two points
 * remove the path). Clicking another path's point picks that path. The pane
 * lists the paths and sets the selected one's style, width, loop and whether
 * it is laid into the ground (levelled, its edges blended and the ground
 * painted, worked out on load, so the ground follows a path you move). Every
 * change is one undo step (`setPaths`).
 */
export class PathTool {
  /** The path being edited (its id) and its selected point (-1 none). */
  current: string | null = null;
  selected = -1;
  /** Style and width the next new path takes (the pane's choice). */
  private style: PathStyle = 'dirt';
  private width = 3;
  /** The first click of a new path. */
  private pending: [number, number, number] | null = null;
  private drag: { id: string; index: number; moved: boolean; at: [number, number, number] } | null = null;
  /** The handle, or else the path, under the pointer (index -1: the path's ribbon; null: neither). */
  private hovered: { id: string; index: number } | null = null;
  private markers: Mesh[] = [];
  private lines: LinesMesh[] = [];
  private active = false;
  /** The pane last rendered, redrawn when a click picks another path. */
  private pane: HTMLElement | null = null;
  private readonly mats: Record<'point' | 'other' | 'sel' | 'hover', StandardMaterial>;

  constructor(private readonly host: PathToolHost) {
    const mat = (name: string, hex: string) => {
      const m = new StandardMaterial(name, host.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.6);
      m.specularColor = Color3.Black();
      return m;
    };
    this.mats = { point: mat('pathPoint', '#5fd0ff'), other: mat('pathOther', '#6f8797'), sel: mat('pathSel', '#ff7a2a'), hover: mat('pathHover', '#fff27a') };
  }

  private get paths(): MapPath[] {
    return this.host.doc().paths ?? [];
  }

  private get path(): MapPath | undefined {
    return this.paths.find((p) => p.id === this.current);
  }

  setActive(on: boolean): void {
    this.active = on;
    if (!on) {
      this.pending = null;
      this.drag = null;
      this.hovered = null;
    }
    this.drawMarkers();
  }

  get dragging(): boolean {
    return !!this.drag;
  }

  private commit(label: string, after: MapPath[]): boolean {
    for (const p of after) {
      const ok = PathSchema.safeParse(p);
      if (!ok.success) {
        this.host.toast(`Can't ${label.toLowerCase()}: ${ok.error.issues[0]?.message ?? 'invalid path'}`, true);
        return false;
      }
    }
    const before = this.host.doc().paths ?? null;
    return this.host.run(label, { kind: 'setPaths', before, after: after.length ? after : null });
  }

  private replace(p: MapPath): MapPath[] {
    return this.paths.map((q) => (q.id === p.id ? p : q));
  }

  /** Where a path's point is drawn: a ball of `size` sitting on the road surface over it. */
  private handleAt(path: MapPath, q: readonly number[], size: number): Vec3 {
    const g = pathGeometry(path);
    const curveY = g.nearest(q[0]!, q[2]!, 4)?.sample.y ?? q[1]!;
    return { x: q[0]!, y: pathSurfaceY(this.host.ground(), curveY, q[0]!, q[2]!) + pathLift(path) + size * 0.3, z: q[2]! };
  }

  /**
   * The point under the pointer: its path and index. A handle counts within
   * a few pixels of where it is drawn (easy to grab at any zoom) or a metre
   * of its point; the nearest wins, the edited path's on a tie.
   */
  private pointAt(p: Vec3): { id: string; index: number } | null {
    let best: { id: string; index: number } | null = null;
    let bestD = Infinity;
    const ptr = this.host.pointer();
    const order = [...this.paths].sort((a, b) => Number(b.id === this.current) - Number(a.id === this.current));
    for (const path of order) {
      const size = path.id === this.current ? HANDLE : HANDLE_OTHER;
      path.points.forEach((q, i) => {
        const world = Math.hypot(q[0] - p.x, q[2] - p.z);
        const at = ptr ? this.host.screen(this.handleAt(path, q, size)) : null;
        const px = at && ptr ? Math.hypot(at.x - ptr.x, at.y - ptr.y) : Infinity;
        if (px > GRAB_PX && world > GRAB_M) return;
        // Pixels decide between handles; a metre off counts as the full grab distance.
        const d = Math.min(px, (world / GRAB_M) * GRAB_PX);
        if (d < bestD) {
          bestD = d;
          best = { id: path.id, index: i };
        }
      });
    }
    return best;
  }

  /** The path whose ribbon is under (x, z) (the edited path first), or null. */
  private pathAt(p: Vec3): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const path of this.paths) {
      if (path.points.length < 2) continue;
      const near = pathGeometry(path).nearest(p.x, p.z, path.width / 2 + 2);
      const d = near ? Math.abs(near.lateral) - path.width / 2 : Infinity;
      if (d > 0.5) continue;
      const score = d - (path.id === this.current ? 0.25 : 0);
      if (score < bestD) {
        bestD = score;
        best = path.id;
      }
    }
    return best;
  }

  /** The pointer moved (not dragging): light the handle, or else the path, under it. */
  hover(p: Vec3 | null): void {
    if (!this.active || this.drag) return;
    const point = p ? this.pointAt(p) : null;
    const path = !point && p ? this.pathAt(p) : null;
    // Another path's ribbon lights up (a click picks it); the edited one's needs no telling.
    const next = point ?? (path && path !== this.current ? { id: path, index: -1 } : null);
    if (next?.id === this.hovered?.id && next?.index === this.hovered?.index) return;
    this.hovered = next;
    this.drawMarkers();
  }

  /** What the pointer is over: a point, a path's ribbon, or nothing. */
  get hovering(): 'point' | 'path' | null {
    return !this.hovered ? null : this.hovered.index >= 0 ? 'point' : 'path';
  }

  /** Edit path `id` (its point `index` selected, -1 none) and show it in the pane. */
  private pick(id: string, index: number): void {
    const changed = id !== this.current;
    this.current = id;
    this.selected = index;
    this.pending = null;
    if (changed && this.pane) this.renderPane(this.pane);
  }

  /** Start the next path with the next click (the pane's "New path"). */
  startNew(): void {
    this.current = null;
    this.selected = -1;
    this.pending = null;
    this.drawMarkers();
  }

  pointerDown(p: Vec3 | null, shift: boolean): void {
    if (!p) return;
    const doc = this.host.doc();
    const at = trackPointAt(doc.terrain, p.x, p.y, p.z);
    const hit = this.pointAt(p);
    if (hit) {
      this.pick(hit.id, hit.index);
      this.drag = { ...hit, moved: false, at: this.path!.points[hit.index]! };
      this.hovered = hit;
      this.drawMarkers();
      return;
    }
    // A click on another path's ribbon picks that path (Shift-click still puts a point in the edited one).
    const other = shift ? null : this.pathAt(p);
    if (other && other !== this.current) {
      this.pick(other, -1);
      this.drawMarkers();
      return;
    }
    const path = this.path;
    if (!path) {
      if (!this.pending) {
        this.pending = at;
        this.drawMarkers();
        return;
      }
      const made = PathSchema.parse({ id: newId('path'), style: this.style, width: this.width, points: [this.pending, at] });
      this.pending = null;
      if (this.commit('Draw path', [...this.paths, made])) {
        this.current = made.id;
        this.selected = 1;
      }
      return;
    }
    let index = this.selected >= 0 && this.selected < path.points.length ? this.selected + 1 : path.points.length;
    // Shift-click on the path: a point in the stretch under the pointer.
    if (shift) {
      const g = pathGeometry(path);
      const near = g.nearest(p.x, p.z, Math.max(3, path.width));
      if (near) {
        const cps = path.points.map((q) => g.nearest(q[0], q[2], 5)?.sample.s ?? 0);
        index = cps.findIndex((cs, i) => i > 0 && cs > near.sample.s);
        if (index < 0) index = path.points.length;
      }
    }
    const points = [...path.points.slice(0, index), at, ...path.points.slice(index)];
    if (this.commit('Add path point', this.replace({ ...path, points }))) this.selected = index;
  }

  pointerMove(p: Vec3 | null): void {
    const d = this.drag;
    if (!d || !p) return;
    const at = trackPointAt(this.host.doc().terrain, p.x, p.y, p.z);
    if (Math.hypot(at[0] - d.at[0], at[2] - d.at[2]) > 0.1) d.moved = true;
    d.at = at;
    this.drawMarkers();
  }

  pointerUp(): void {
    const d = this.drag;
    this.drag = null;
    const path = this.paths.find((q) => q.id === d?.id);
    if (!d || !d.moved || !path) {
      this.drawMarkers();
      return;
    }
    this.commit('Move path point', this.replace({ ...path, points: path.points.map((q, i) => (i === d.index ? d.at : q)) }));
  }

  /** Right-click: remove the point under the pointer. */
  erase(p: Vec3 | null): void {
    if (!p) return;
    const hit = this.pointAt(p);
    if (hit) {
      this.pick(hit.id, hit.index);
      this.remove(hit.index);
    }
  }

  deleteSelected(): boolean {
    if (this.selected < 0 || !this.path) return false;
    this.remove(this.selected);
    return true;
  }

  private remove(i: number): void {
    const path = this.path;
    if (!path) return;
    if (path.points.length <= 2) {
      if (this.commit('Remove path', this.paths.filter((q) => q.id !== path.id))) this.startNew();
      return;
    }
    if (this.commit('Delete path point', this.replace({ ...path, points: path.points.filter((_, k) => k !== i) }))) this.selected = Math.min(i, path.points.length - 2);
  }

  /** After every document change: keep the selection valid, redraw. */
  refresh(): void {
    const path = this.path;
    if (!path) {
      if (this.current) this.startNew();
    } else if (this.selected >= path.points.length) this.selected = path.points.length - 1;
    this.drawMarkers();
  }

  /**
   * Handles and centre lines, drawn over everything (rendering group 1) so a
   * bump in the ground never hides them: each point a ball sitting on the
   * road over it, the edited path's bigger, its selected point orange and
   * the one under the pointer yellow; each path's line follows its curve
   * (the middle of the ribbon), the edited path's bright, a hovered one
   * lighter. While a point is dragged the line shows where the road will go.
   */
  private drawMarkers(): void {
    for (const m of this.markers) m.dispose();
    for (const l of this.lines) l.dispose();
    this.markers = [];
    this.lines = [];
    if (!this.active) return;
    const ground = this.host.ground();
    const ball = (name: string, at: Vec3, size: number, mat: StandardMaterial) => {
      const s = CreateSphere(name, { diameter: size, segments: 8 }, this.host.scene);
      s.position.set(at.x, at.y, at.z);
      s.material = mat;
      s.isPickable = false;
      s.renderingGroupId = 1;
      this.markers.push(s);
    };
    for (const path of this.paths) {
      const mine = path.id === this.current;
      const dragged = this.drag && this.drag.id === path.id && this.drag.moved ? this.drag : null;
      // The path as it will be once the drag ends.
      const shown = dragged ? { ...path, points: path.points.map((q, i) => (i === dragged.index ? dragged.at : q)) } : path;
      const g = pathGeometry(shown);
      const lift = pathLift(path) + 0.05;
      const line = g.samples.map((q) => new Vector3(q.x, pathSurfaceY(ground, q.y, q.x, q.z) + lift, q.z));
      if (g.loop && line.length) line.push(line[0]!.clone());
      const hoverPath = this.hovered?.id === path.id && this.hovered.index < 0;
      const l = CreateLines(`pathPoly_${path.id}`, { points: line }, this.host.scene);
      l.color = Color3.FromHexString(mine ? '#5fd0ff' : hoverPath ? '#d6f4ff' : '#8aa2b2');
      l.isPickable = false;
      l.renderingGroupId = 1;
      this.lines.push(l);
      const size = mine ? HANDLE : HANDLE_OTHER;
      shown.points.forEach((q, i) => {
        const hot = this.hovered?.id === path.id && this.hovered.index === i;
        const sel = mine && i === this.selected;
        const mat = hot ? this.mats.hover : sel ? this.mats.sel : mine ? this.mats.point : this.mats.other;
        const d = hot || sel ? size * 1.25 : size;
        ball(`pathPt${i}`, this.handleAt(shown, q, d), d, mat);
      });
    }
    if (this.pending) {
      const q = this.pending;
      const y = pathSurfaceY(ground, q[1], q[0], q[2]) + 0.05 + HANDLE * 0.3;
      ball('pathPending', { x: q[0], y, z: q[2] }, HANDLE * 1.25, this.mats.sel);
    }
  }

  /** The Paths pane: the list, a new path, and the selected one's settings. */
  renderPane(el: HTMLElement): void {
    this.pane = el;
    el.replaceChildren();
    const path = this.path;
    const note = document.createElement('p');
    note.className = 'ed-note';
    note.textContent = path
      ? 'Click to add a point after the selected one (orange) · drag a point to move it · Shift-click the path to add a point there · right-click or Del removes one · click another path to edit it.'
      : 'Click the ground twice to start a path, then keep clicking to draw it. Roads, streets, trails, walkways: as many as you like.';
    el.append(note);
    const row = (label: string, control: HTMLElement) => {
      const l = document.createElement('label');
      l.className = 'stack';
      l.append(label, control);
      el.append(l);
    };
    const styleSelect = (value: PathStyle, onChange: (v: PathStyle) => void) => {
      const s = document.createElement('select');
      s.id = 'ed-path-style';
      for (const st of PATH_STYLES) s.append(new Option(PATH_LOOKS[st].label, st, st === value, st === value));
      s.addEventListener('change', () => onChange(s.value as PathStyle));
      return s;
    };
    const widthInput = (value: number, onChange: (v: number) => void) => {
      const i = document.createElement('input');
      i.type = 'number';
      i.id = 'ed-path-width';
      i.min = '0.5';
      i.max = '20';
      i.step = '0.5';
      i.value = String(value);
      i.addEventListener('change', () => {
        const v = Math.round(Number(i.value) * 2) / 2;
        if (Number.isFinite(v)) onChange(Math.max(0.5, Math.min(20, v)));
      });
      return i;
    };
    if (this.paths.length) {
      const list = document.createElement('select');
      list.id = 'ed-path-list';
      list.size = Math.min(6, this.paths.length + 1);
      list.append(new Option('＋ New path (click the ground)', '', !path, !path));
      this.paths.forEach((p, i) => {
        const g = pathGeometry(p);
        list.append(new Option(`${i + 1}. ${PATH_LOOKS[p.style].label} · ${p.width} m · ${Math.round(g.length)} m long`, p.id, p.id === this.current, p.id === this.current));
      });
      list.addEventListener('change', () => {
        if (!list.value) this.startNew();
        else {
          this.current = list.value;
          this.selected = -1;
          this.drawMarkers();
        }
        this.renderPane(el);
      });
      row('Paths', list);
    }
    if (!path) {
      // Settings for the next new path.
      row('Style', styleSelect(this.style, (v) => (this.style = v)));
      row('Width (m)', widthInput(this.width, (v) => (this.width = v)));
      return;
    }
    const set = (label: string, patch: Partial<MapPath>) => this.commit(label, this.replace({ ...path, ...patch }));
    row('Style', styleSelect(path.style, (v) => ((this.style = v), set('Path style', { style: v }))));
    row('Width (m)', widthInput(path.width, (v) => ((this.width = v), set('Path width', { width: v }))));
    const check = (id: string, label: string, title: string, value: boolean, onChange: (v: boolean) => void) => {
      const l = document.createElement('label');
      l.className = 'check';
      l.title = title;
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.id = id;
      i.checked = value;
      i.addEventListener('change', () => onChange(i.checked));
      l.append(i, ` ${label}`);
      el.append(l);
    };
    check('ed-path-loop', 'Loop (closes back on itself)', 'Join the last point back to the first', path.loop, (v) => set(v ? 'Make a loop' : 'Open the loop', { loop: v }));
    check('ed-path-lay', 'Lay into the ground', 'Level the ground under the path, blend its edges and paint it (worked out when the map loads, so the ground follows the path when you move it)', path.lay, (v) => set(v ? 'Lay path into the ground' : 'Lay path on top', { lay: v }));
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
    btn('ed-path-reverse', 'Reverse', 'Run the path the other way (the order new points go in)', () => set('Reverse path', { points: [...path.points].reverse() }));
    btn('ed-path-remove', 'Remove path', 'Delete this path (undo brings it back)', () => {
      if (this.commit('Remove path', this.paths.filter((q) => q.id !== path.id))) this.startNew();
    });
    el.append(buttons);
  }
}
