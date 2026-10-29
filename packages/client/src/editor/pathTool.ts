import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateDashedLines, CreateLineSystem, CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import {
  DEFAULT_RACE,
  MapPath as PathSchema,
  PATH_LOOKS,
  PATH_STYLES,
  RACE_VEHICLES,
  newId,
  pathGeometry,
  pathUses,
  racePath,
  trackPointAt,
  type EditCommand,
  type MapDocument,
  type MapPath,
  type PathStyle,
  type PathUse,
  type RaceSettings,
  type TerrainData,
  type Vec3,
} from '@tiletrigger/shared';
import { pathArrows, pathLift, pathLine, pathSurfaceY } from '../pathMeshes.ts';

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

/** What a new path is drawn as (the pane's choice, or the palette card / Shift+G that opened the tool). */
export type PathKind = 'road' | 'race' | 'route';
const KIND_LABELS: Record<PathKind, string> = { road: 'Road, street or trail', race: 'Race track', route: 'Route (AI guide line)' };
/** A new path of each kind: its uses, style, width, and whether it starts closed (a race is a circuit at once). */
const KIND_DEFAULTS: Record<PathKind, { uses: PathUse[]; style: PathStyle; width: number; closed: boolean; lay: boolean }> = {
  road: { uses: ['road'], style: 'dirt', width: 3, closed: false, lay: true },
  race: { uses: ['road', 'race'], style: 'asphalt', width: 12, closed: true, lay: true },
  route: { uses: ['route'], style: 'dirt', width: 3, closed: false, lay: false },
};
const USE_LABELS: Record<PathUse, [string, string]> = {
  road: ['Road (drawn)', 'Drawn in the game in its style; laid into the ground if you like'],
  race: ['Race track', 'Race mode races it: checkpoints along it in point order, laps on a loop, one run on an open path. One race track per map'],
  route: ['Route (AI guide)', 'An invisible line for the AI: bots driving vehicles follow it, and NPC squads told to patrol it walk it. Shown dashed here, never drawn in the game'],
};
const VEHICLE_LABELS: Record<(typeof RACE_VEHICLES)[number], string> = { kart: 'Go-Kart', speeder: 'Speeder', buggy: 'Buggy' };

/** A short name for a path (the pane's list, the encounter inspector's route picker). */
export function pathLabel(p: MapPath, i: number): string {
  const what = p.uses.map((u) => (u === 'road' ? PATH_LOOKS[p.style].label : u === 'race' ? 'Race track' : 'Route')).join(' + ');
  return `${i + 1}. ${what} · ${p.closed ? 'loop' : 'open'} · ${Math.round(pathGeometry(p).length)} m`;
}

/**
 * MapMaker's Paths tool: one tool for every path (schema.ts MapPath) a map
 * has: roads, streets, trails and walkways, the race track, and routes for
 * the AI. Click to add a point after the selected one (the first two clicks
 * start a path), drag a point to move it, Shift-click a path to put a point
 * in it, right-click or Delete removes one (a path's last two points remove
 * the path). Clicking another path's point or ribbon picks that path.
 * Clicking the first point while the last is selected (or the last while
 * the first is) joins the ends into a loop; the pane's Close loop / Open and
 * Reverse direction do the same by button. The pane lists the paths and sets
 * the selected one's uses (road, race track, route) and their settings.
 * Every change is one undo step (`setPaths`). Lines show which way each
 * path runs (arrows); routes are dashed (they are never drawn in the game).
 */
export class PathTool {
  /** The path being edited (its id) and its selected point (-1 none). */
  current: string | null = null;
  selected = -1;
  /** What the next new path is, and its style and width (the pane's choice). */
  private kind: PathKind = 'road';
  private style: PathStyle = 'dirt';
  private width = 3;
  /** The first click of a new path. */
  private pending: [number, number, number] | null = null;
  private drag: { id: string; index: number; moved: boolean; at: [number, number, number]; join: boolean } | null = null;
  /** The handle, or else the path, under the pointer (index -1: the path's ribbon; null: neither). */
  private hovered: { id: string; index: number } | null = null;
  private markers: Mesh[] = [];
  private lines: LinesMesh[] = [];
  private active = false;
  /** The pane last rendered, redrawn when a click picks another path. */
  private pane: HTMLElement | null = null;
  private readonly mats: Record<'point' | 'other' | 'sel' | 'hover' | 'start', StandardMaterial>;

  constructor(private readonly host: PathToolHost) {
    const mat = (name: string, hex: string) => {
      const m = new StandardMaterial(name, host.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.6);
      m.specularColor = Color3.Black();
      return m;
    };
    this.mats = { point: mat('pathPoint', '#5fd0ff'), other: mat('pathOther', '#6f8797'), sel: mat('pathSel', '#ff7a2a'), hover: mat('pathHover', '#fff27a'), start: mat('pathStart', '#3fd26b') };
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

  /** The next new path is a road, the race track or a route (palette cards, Shift+G); edits the race track if there is one. */
  preset(kind: PathKind): void {
    this.kind = kind;
    this.style = KIND_DEFAULTS[kind].style;
    this.width = KIND_DEFAULTS[kind].width;
    const race = kind === 'race' ? racePath(this.host.doc()) : null;
    if (race) {
      this.current = race.id;
      this.selected = -1;
    } else if (this.path && !this.path.uses.includes(kind)) this.startNew();
    this.pending = null;
    if (this.pane) this.renderPane(this.pane);
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

  /** The path whose ribbon is under (x, z) (the edited path first), or null. Routes are picked within a couple of metres of their line. */
  private pathAt(p: Vec3): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const path of this.paths) {
      if (path.points.length < 2) continue;
      const half = pathUses(path, 'road') ? path.width / 2 : 1.5;
      const near = pathGeometry(path).nearest(p.x, p.z, half + 2);
      const d = near ? Math.abs(near.lateral) - half : Infinity;
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

  /** Would a click on the hovered point join the edited path's ends (its first point with the last selected, or the other way)? */
  get joining(): boolean {
    const path = this.path;
    const h = this.hovered;
    return !!path && !!h && h.id === path.id && this.canJoin(path, h.index);
  }

  private canJoin(path: MapPath, index: number): boolean {
    const last = path.points.length - 1;
    return !path.closed && path.points.length >= 3 && ((index === 0 && this.selected === last) || (index === last && this.selected === 0));
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

  /** Edit this path (the encounter inspector's "Edit route"). */
  edit(id: string): void {
    if (!this.paths.some((p) => p.id === id)) return;
    this.pick(id, -1);
    if (this.pane) this.renderPane(this.pane);
    this.drawMarkers();
  }

  pointerDown(p: Vec3 | null, shift: boolean): void {
    if (!p) return;
    const doc = this.host.doc();
    const at = trackPointAt(doc.terrain, p.x, p.y, p.z);
    const hit = this.pointAt(p);
    if (hit) {
      // Its first point with the last selected (or the reverse): a click (no drag) joins the ends.
      const mine = this.path;
      const join = !!mine && hit.id === mine.id && this.canJoin(mine, hit.index);
      this.pick(hit.id, hit.index);
      this.drag = { ...hit, moved: false, at: this.path!.points[hit.index]!, join };
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
      const made = this.newPath([this.pending, at]);
      this.pending = null;
      // One race track per map: a new one takes over from the old.
      const rest = made.uses.includes('race') ? this.paths.map((q) => (pathUses(q, 'race') ? { ...q, uses: q.uses.filter((u) => u !== 'race') } : q)).filter((q) => q.uses.length) : this.paths;
      if (this.commit(made.uses.includes('race') ? 'Lay race track' : made.uses.includes('route') ? 'Draw route' : 'Draw path', [...rest, made])) {
        this.current = made.id;
        this.selected = 1;
        if (this.pane) this.renderPane(this.pane);
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

  /** A new path of the pane's kind through these points. */
  private newPath(points: [number, number, number][]): MapPath {
    const k = KIND_DEFAULTS[this.kind];
    const id = newId(this.kind === 'race' ? 'race' : this.kind === 'route' ? 'route' : 'path');
    return PathSchema.parse({ id, points, uses: k.uses, style: this.style, width: this.width, closed: k.closed, lay: k.lay, ...(this.kind === 'race' ? { race: { ...DEFAULT_RACE } } : {}) });
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
    if (!d || !path) return this.drawMarkers();
    if (!d.moved) {
      if (d.join && this.setClosed(path, true)) this.host.toast('Ends joined: the path is a loop');
      return this.drawMarkers();
    }
    this.commit('Move path point', this.replace({ ...path, points: path.points.map((q, i) => (i === d.index ? d.at : q)) }));
  }

  /**
   * Join the ends (a loop), or open the loop: between the selected point and
   * the next one when a point is selected (the selected point becomes the
   * last), else between the last point and the first.
   */
  private setClosed(path: MapPath, closed: boolean): boolean {
    if (closed) {
      if (path.points.length < 3) {
        this.host.toast('A loop needs at least 3 points', true);
        return false;
      }
      return this.commit('Join path ends', this.replace({ ...path, closed: true }));
    }
    const i = this.selected;
    const points = i >= 0 && i < path.points.length - 1 ? [...path.points.slice(i + 1), ...path.points.slice(0, i + 1)] : path.points;
    if (!this.commit('Open path loop', this.replace({ ...path, closed: false, points }))) return false;
    if (i >= 0) this.selected = points.length - 1;
    return true;
  }

  /** Run the other way: a loop keeps its first point (the start line) and goes round the other way. */
  private reverse(path: MapPath): boolean {
    const points = path.closed ? [path.points[0]!, ...path.points.slice(1).reverse()] : [...path.points].reverse();
    return this.commit('Reverse path direction', this.replace({ ...path, points }));
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
    // A loop of three loses a point: it can't stay a loop.
    const closed = path.closed && path.points.length > 3;
    if (this.commit('Delete path point', this.replace({ ...path, closed, points: path.points.filter((_, k) => k !== i) }))) this.selected = Math.min(i, path.points.length - 2);
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
   * road over it, the edited path's bigger, its selected point orange, its
   * first point green (where it starts: a race's start line) and the one
   * under the pointer yellow; each path's line follows its curve (the middle
   * of the ribbon), the edited path's bright, a hovered one lighter, dashed
   * for a path that isn't drawn in the game (a route), with arrows the way
   * the path runs. While a point is dragged the line shows where it will go.
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
      const line = pathLine(shown, ground, 0.05);
      const hoverPath = this.hovered?.id === path.id && this.hovered.index < 0;
      const color = Color3.FromHexString(mine ? '#5fd0ff' : hoverPath ? '#d6f4ff' : '#8aa2b2');
      const l = pathUses(path, 'road')
        ? CreateLines(`pathPoly_${path.id}`, { points: line }, this.host.scene)
        : CreateDashedLines(`pathPoly_${path.id}`, { points: line, dashSize: 3, gapSize: 2, dashNb: Math.max(8, Math.round(pathGeometry(shown).length / 2)) }, this.host.scene);
      const arrows = CreateLineSystem(`pathArrows_${path.id}`, { lines: pathArrows(shown, ground, 0.06, mine ? 1.4 : 1) }, this.host.scene);
      for (const m of [l, arrows]) {
        m.color = color;
        m.isPickable = false;
        m.renderingGroupId = 1;
        this.lines.push(m);
      }
      const size = mine ? HANDLE : HANDLE_OTHER;
      shown.points.forEach((q, i) => {
        const hot = this.hovered?.id === path.id && this.hovered.index === i;
        const sel = mine && i === this.selected;
        const mat = hot ? this.mats.hover : sel ? this.mats.sel : mine && i === 0 ? this.mats.start : mine ? this.mats.point : this.mats.other;
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

  /** The Paths pane: the list, a new path, and the selected one's uses and settings. */
  renderPane(el: HTMLElement): void {
    this.pane = el;
    el.replaceChildren();
    const path = this.path;
    const note = document.createElement('p');
    note.className = 'ed-note';
    note.textContent = path
      ? 'Click to add a point after the selected one (orange) · drag a point to move it · Shift-click the path to add a point there · right-click or Del removes one · click the first point (green) with the last selected to join the ends · click another path to edit it.'
      : 'Click the ground twice to start a path, then keep clicking to draw it: roads, streets and trails, the race track, and routes for the AI (vehicles follow them, patrols walk them).';
    el.append(note);
    const row = (label: string, control: HTMLElement) => {
      const l = document.createElement('label');
      l.className = 'stack';
      l.append(label, control);
      el.append(l);
      return l;
    };
    const select = (id: string, options: readonly (readonly [string, string])[], value: string, onChange: (v: string) => void) => {
      const s = document.createElement('select');
      s.id = id;
      for (const [v, label] of options) s.append(new Option(label, v, v === value, v === value));
      s.addEventListener('change', () => onChange(s.value));
      return s;
    };
    const styles = PATH_STYLES.map((st) => [st, PATH_LOOKS[st].label] as const);
    const num = (id: string, value: number | undefined, min: number, max: number, step: number, onChange: (v: number | undefined) => void, blank = false) => {
      const i = document.createElement('input');
      i.type = 'number';
      i.id = id;
      i.min = String(min);
      i.max = String(max);
      i.step = String(step);
      i.value = value === undefined ? '' : String(value);
      if (blank) i.placeholder = 'none';
      i.addEventListener('change', () => {
        if (blank && i.value.trim() === '') return onChange(undefined);
        const v = Math.round(Number(i.value) / step) * step;
        if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
      });
      return i;
    };
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
    const heading = (text: string) => {
      const h = document.createElement('div');
      h.className = 'ed-note';
      h.style.fontWeight = '600';
      h.textContent = text;
      el.append(h);
    };
    const buttons = (list: [string, string, string, () => void][]) => {
      const box = document.createElement('div');
      box.className = 'ed-row-buttons';
      for (const [id, label, title, onClick] of list) {
        const b = document.createElement('button');
        b.id = id;
        b.textContent = label;
        b.title = title;
        b.addEventListener('click', onClick);
        box.append(b);
      }
      el.append(box);
    };
    if (this.paths.length) {
      const list = document.createElement('select');
      list.id = 'ed-path-list';
      list.size = Math.min(6, this.paths.length + 1);
      list.append(new Option('＋ New path (click the ground)', '', !path, !path));
      this.paths.forEach((p, i) => list.append(new Option(pathLabel(p, i), p.id, p.id === this.current, p.id === this.current)));
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
      row('New path is a', select('ed-path-kind', (Object.keys(KIND_LABELS) as PathKind[]).map((k) => [k, KIND_LABELS[k]] as const), this.kind, (v) => this.preset(v as PathKind)));
      if (this.kind !== 'route') row('Style', select('ed-path-style', styles, this.style, (v) => (this.style = v as PathStyle)));
      row('Width (m)', num('ed-path-width', this.width, 0.5, 30, 0.5, (v) => (this.width = v ?? this.width)));
      return;
    }
    const set = (label: string, patch: Partial<MapPath>) => this.commit(label, this.replace({ ...path, ...patch }));
    const g = pathGeometry(path);
    const race = pathUses(path, 'race');
    const info = document.createElement('div');
    info.className = 'ed-note';
    info.id = 'ed-path-info';
    info.textContent = `${path.points.length} points · ${Math.round(g.length)} m · ${path.closed ? 'a loop' : 'open (two ends)'}${race ? ` · ${g.gates.length} checkpoints` : ''}${path.oneWay ? ' · one-way' : ''}`;
    el.append(info);
    // Uses: one path can be several things at once.
    heading('Used as');
    for (const use of ['road', 'race', 'route'] as const) {
      const [label, title] = USE_LABELS[use];
      check(`ed-path-use-${use}`, label, title, pathUses(path, use), (on) => {
        const uses = on ? [...path.uses, use] : path.uses.filter((u) => u !== use);
        if (!uses.length) {
          this.host.toast('A path needs at least one use: remove it instead', true);
          return this.renderPane(el);
        }
        const patch: Partial<MapPath> = { uses: PATH_USE_ORDER.filter((u) => uses.includes(u)) };
        // A race track is at least 5 m wide; a new one starts with the default settings.
        if (on && use === 'race') {
          if (path.width < 5) patch.width = 8;
          patch.race = path.race ?? { ...DEFAULT_RACE };
        }
        const what = on ? `Use path as ${use === 'race' ? 'the race track' : `a ${use}`}` : `Path no longer a ${use === 'race' ? 'race track' : use}`;
        // One race track per map: this one takes over.
        const others = on && use === 'race' ? this.paths.filter((q) => q.id !== path.id && pathUses(q, 'race')) : [];
        const after = this.paths.map((q) => (q.id === path.id ? { ...q, ...patch } : others.includes(q) ? { ...q, uses: q.uses.filter((u) => u !== 'race') } : q)).filter((q) => q.uses.length);
        if (this.commit(what, after) && others.length) this.host.toast('This path is the race track now (one per map)');
      });
    }
    buttons([
      [
        'ed-path-close',
        path.closed ? 'Open' : 'Close loop',
        path.closed ? 'Open the loop after the selected point (or between the last point and the first)' : 'Join the last point back to the first (or click the first point with the last selected)',
        () => this.setClosed(path, !path.closed),
      ],
      ['ed-path-reverse', 'Reverse direction', 'Run the path the other way: the race direction, one-way traffic and the order new points go in (a loop keeps its start)', () => this.reverse(path)],
      ['ed-path-remove', 'Remove path', 'Delete this path (undo brings it back)', () => {
        if (this.commit('Remove path', this.paths.filter((q) => q.id !== path.id))) this.startNew();
      }],
    ]);
    row('Width (m)', num('ed-path-width', path.width, 0.5, 30, 0.5, (v) => v !== undefined && ((this.width = v), set('Path width', { width: v }))));
    check('ed-path-oneway', 'One-way (in the arrows’ direction)', 'Traffic only the way the arrows point: driving bots never take it the other way, and patrols never turn back on it', !!path.oneWay, (v) => set(v ? 'Make path one-way' : 'Make path two-way', { oneWay: v || undefined }));
    row('Speed limit (m/s, for driving bots)', num('ed-path-speed', path.speed, 2, 80, 1, (v) => set('Path speed limit', { speed: v }), true));
    if (pathUses(path, 'road')) {
      heading('Road');
      row('Style', select('ed-path-style', styles, path.style, (v) => ((this.style = v as PathStyle), set('Path style', { style: v as PathStyle }))));
      check('ed-path-lay', 'Lay into the ground', 'Level the ground under the path, blend its edges and paint it (worked out when the map loads, so the ground follows the path when you move it). Off: the path keeps its own height, like a raised track', path.lay, (v) => set(v ? 'Lay path into the ground' : 'Lay path on top', { lay: v }));
    }
    if (race) this.racePane(el, path, set, row, num, check, select, buttons);
    if (pathUses(path, 'route')) {
      heading('Route');
      const patrol = path.patrol ?? '';
      row(
        'NPC patrols walk it',
        select('ed-path-patrol', [['', path.closed ? 'Round and round (a loop)' : 'There and back (open)'], ['loop', 'Round and round'], ['back_and_forth', 'There and back']], patrol, (v) => set('Patrol style', { patrol: v ? (v as MapPath['patrol']) : undefined })),
      );
      const note2 = document.createElement('p');
      note2.className = 'ed-note';
      note2.textContent = 'Give an NPC squad the patrol order and pick this route in its inspector. Bots driving vehicles follow routes and roads heading their way.';
      el.append(note2);
    }
  }

  /** The race track's settings (the path's `race`) and its start line and pit lane. */
  private racePane(
    el: HTMLElement,
    path: MapPath,
    set: (label: string, patch: Partial<MapPath>) => boolean,
    row: (label: string, control: HTMLElement) => HTMLElement,
    num: (id: string, value: number | undefined, min: number, max: number, step: number, onChange: (v: number | undefined) => void) => HTMLInputElement,
    check: (id: string, label: string, title: string, value: boolean, onChange: (v: boolean) => void) => void,
    select: (id: string, options: readonly (readonly [string, string])[], value: string, onChange: (v: string) => void) => HTMLSelectElement,
    buttons: (list: [string, string, string, () => void][]) => void,
  ): void {
    const r: RaceSettings = { ...DEFAULT_RACE, ...path.race };
    const setRace = (label: string, patch: Partial<RaceSettings>) => set(label, { race: { ...r, ...patch } });
    const h = document.createElement('div');
    h.className = 'ed-note';
    h.style.fontWeight = '600';
    h.textContent = racePath(this.host.doc())?.id === path.id ? 'Race track (the green point is the start line)' : 'Race track (not raced: another path is the race track)';
    el.append(h);
    const vehicles = RACE_VEHICLES.map((v) => [v, VEHICLE_LABELS[v]] as const);
    if (path.closed) row('Laps', num('ed-path-laps', r.laps, 1, 20, 1, (v) => v !== undefined && setRace('Laps', { laps: v })));
    else {
      const p = document.createElement('p');
      p.className = 'ed-note';
      p.textContent = 'Point to point: one run from the first point to the last. Close the loop for laps.';
      el.append(p);
    }
    row('Start grid places', num('ed-path-grid', r.grid, 2, 16, 1, (v) => v !== undefined && setRace('Start grid', { grid: v })));
    row('Vehicle', select('ed-path-vehicle', vehicles, r.vehicle, (v) => setRace('Race vehicle', { vehicle: v as RaceSettings['vehicle'] })));
    check('ed-path-curbs', 'Red and white curbs', 'Curbs along both edges of the race road', r.curbs, (v) => setRace('Curbs', { curbs: v }));
    check('ed-path-combat', 'Combat race (weapons, vehicle guns and sentries live)', 'Arcade can change it per match', r.combat, (v) => setRace('Combat race', { combat: v }));
    row('Ambient cars (lap the track in every mode)', num('ed-path-ambient', r.ambient, 0, 12, 1, (v) => v !== undefined && setRace('Ambient cars', { ambient: v })));
    if (r.ambient) row('Ambient car', select('ed-path-ambient-vehicle', vehicles, r.ambientVehicle, (v) => setRace('Ambient car', { ambientVehicle: v as RaceSettings['vehicle'] })));
    buttons([
      ['ed-path-start', 'Start here', 'Move the start line (and the grid behind it) to the selected point', () => {
        const i = this.selected;
        if (i <= 0) return this.host.toast('Select a point first (click it)');
        if (!path.closed) return this.host.toast('A point-to-point track starts at its first point: reverse it to start from the other end', true);
        if (set('Move the start', { points: [...path.points.slice(i), ...path.points.slice(0, i)] })) this.selected = 0;
      }],
      ['ed-path-pit', 'Pit lane here', 'Wrecked ambient cars come back just off the road beside the selected point (lined up behind it)', () => {
        const p = path.points[this.selected];
        const near = p && pathGeometry(path).nearest(p[0], p[2], 20);
        if (!p || !near) return this.host.toast('Select a point first (click it)');
        const off = path.width / 2 + 8;
        const rd = (v: number) => Math.round(v * 100) / 100;
        setRace('Pit lane', { pit: [rd(near.sample.x + near.sample.dz * off), rd(near.sample.y), rd(near.sample.z - near.sample.dx * off)] });
      }],
    ]);
  }
}

/** Uses in their usual order (so a path's list reads the same however it was ticked). */
const PATH_USE_ORDER: readonly PathUse[] = ['road', 'race', 'route'];
