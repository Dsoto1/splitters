import type { ValidationIssue } from './validate.ts';
import { RaceSettings, type MapDocument, type MapEntity, type MapPath, type MountEntity, type PathUse, type Track } from './schema.ts';
import { terrainHeightAt, type TerrainData } from './terrain.ts';
import { hypot } from '../math.ts';

/**
 * Path curves and race tracks. Every path (schema.ts MapPath: roads, the
 * race track, AI routes) is a Catmull-Rom curve through its ordered points,
 * open or closed (a loop wraps from the last point back to the first). The
 * race track is the map's path used as a race. Every derived piece lives
 * here as pure functions of the map, so the simulation, the client's road
 * mesh, MapMaker's preview and the validator all agree:
 *
 * - the centre line (samples with tangent and distance along),
 * - checkpoints (gates across the road, in order; gate 0 is the start line,
 *   which is also the finish line of a circuit),
 * - the start grid (two abreast behind the start line),
 * - "on the road" lookups (vehicles grip better there).
 */

/** One point on the centre line: position, unit tangent (x/z) and distance along the road. */
export interface TrackSample {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  s: number;
}

/** A checkpoint: a line across the road at `s`, `half` metres either side of the centre. */
export interface TrackGate {
  index: number;
  s: number;
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  half: number;
}

/** A place on the start grid: where a vehicle stands and which way it faces. */
export interface GridSlot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Metres between centre-line samples. */
const STEP = 2;
/** Roughly how far apart checkpoints are. */
const GATE_SPACING = 40;
/** Extra reach either side of the road edge that still counts as passing a gate. */
const GATE_MARGIN = 4;
/** Grid rows are this far apart; the front row this far behind the line. */
const GRID_ROW = 7;
const GRID_FRONT = 6;
/** Bucket size for the road lookup grid. */
const CELL = 8;

/**
 * How the centre line is drawn through the points. The race track keeps the
 * defaults (uniform Catmull-Rom every 2 m, what its races were tuned on);
 * paths use the centripetal curve, which never overshoots or loops when the
 * points are unevenly spaced or turn sharply, sampled more finely.
 */
export interface CurveShape {
  step?: number;
  centripetal?: boolean;
}

/** Centripetal Catmull-Rom (Barry and Goldman) between p1 and p2 at u in [0, 1]. */
function centripetal(p0: readonly number[], p1: readonly number[], p2: readonly number[], p3: readonly number[], u: number): [number, number, number] {
  const knot = (a: readonly number[], b: readonly number[]) => Math.max(1e-3, Math.sqrt(hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!)));
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a1 = ((t1 - t) / (t1 - t0)) * p0[k]! + ((t - t0) / (t1 - t0)) * p1[k]!;
    const a2 = ((t2 - t) / (t2 - t1)) * p1[k]! + ((t - t1) / (t2 - t1)) * p2[k]!;
    const a3 = ((t3 - t) / (t3 - t2)) * p2[k]! + ((t - t2) / (t3 - t2)) * p3[k]!;
    const b1 = ((t2 - t) / (t2 - t0)) * a1 + ((t - t0) / (t2 - t0)) * a2;
    const b2 = ((t3 - t) / (t3 - t1)) * a2 + ((t - t1) / (t3 - t1)) * a3;
    out[k] = ((t2 - t) / (t2 - t1)) * b1 + ((t - t1) / (t2 - t1)) * b2;
  }
  return out;
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** A track's geometry, built once per map (cheap: a few hundred samples). */
export class TrackGeometry {
  readonly samples: TrackSample[];
  readonly length: number;
  readonly loop: boolean;
  readonly width: number;
  readonly gates: TrackGate[];
  /** Distance along the road of the start line (0 on a circuit; past the grid on a point-to-point run). */
  readonly start: number;
  private readonly buckets = new Map<string, number[]>();

  constructor(
    readonly track: Track,
    shape: CurveShape = {},
  ) {
    this.loop = track.loop && track.points.length >= 3;
    this.width = track.width;
    this.samples = centreLine(track, this.loop, shape);
    const last = this.samples[this.samples.length - 1]!;
    this.length = this.loop ? last.s + hypot(this.samples[0]!.x - last.x, this.samples[0]!.z - last.z) : last.s;
    const depth = GRID_FRONT + Math.ceil(track.grid / 2) * GRID_ROW + 4;
    this.start = this.loop ? 0 : Math.min(depth, this.length * 0.4);
    this.gates = this.buildGates();
    this.samples.forEach((p, i) => {
      // Each sample is listed in every bucket its stretch of road (half a width either side) touches.
      const r = this.width / 2 + STEP;
      for (let cx = Math.floor((p.x - r) / CELL); cx <= Math.floor((p.x + r) / CELL); cx++) {
        for (let cz = Math.floor((p.z - r) / CELL); cz <= Math.floor((p.z + r) / CELL); cz++) {
          const k = `${cx},${cz}`;
          let list = this.buckets.get(k);
          if (!list) this.buckets.set(k, (list = []));
          list.push(i);
        }
      }
    });
  }

  /** The point `s` metres along the centre line (wrapping on a circuit). */
  at(s: number): TrackSample {
    const n = this.samples.length;
    if (this.loop) s = ((s % this.length) + this.length) % this.length;
    else s = Math.max(0, Math.min(this.length, s));
    // Binary search for the sample at or before s.
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.samples[mid]!.s <= s) lo = mid;
      else hi = mid - 1;
    }
    const a = this.samples[lo]!;
    const b = lo + 1 < n ? this.samples[lo + 1]! : this.loop ? { ...this.samples[0]!, s: this.length } : a;
    const span = b.s - a.s;
    const t = span > 1e-6 ? (s - a.s) / span : 0;
    const dx = a.dx + (b.dx - a.dx) * t;
    const dz = a.dz + (b.dz - a.dz) * t;
    const l = hypot(dx, dz) || 1;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, dx: dx / l, dz: dz / l, s };
  }

  /**
   * The nearest centre-line point to (x, z): its sample, how far off the
   * centre (signed: + is right of the direction of travel) and the distance
   * along. Null when nowhere near the road (beyond `reach` metres).
   */
  nearest(x: number, z: number, reach = 60): { sample: TrackSample; index: number; lateral: number; dist: number } | null {
    let best = -1;
    let bestD = reach * reach;
    // On the road the point's bucket holds the answer; further out, every sample is checked.
    const local = this.buckets.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    const sure = (this.width / 2 + STEP) ** 2;
    const scan = (i: number) => {
      const p = this.samples[i]!;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    if (local) for (const i of local) scan(i);
    if (best < 0 || bestD > sure) for (let i = 0; i < this.samples.length; i++) scan(i);
    if (best < 0) return null;
    const p = this.samples[best]!;
    const lateral = (x - p.x) * p.dz - (z - p.z) * p.dx;
    return { sample: p, index: best, lateral, dist: Math.sqrt(bestD) };
  }

  /** Is (x, z) on the road surface (within its width, roughly at its height)? */
  onRoad(x: number, y: number, z: number): boolean {
    // Nowhere near any stretch of road: no bucket here.
    if (!this.buckets.has(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`)) return false;
    const near = this.nearest(x, z, this.width);
    return !!near && Math.abs(near.lateral) <= this.width / 2 + 0.5 && Math.abs(near.sample.y - y) < 4;
  }

  /** Signed distance of a point past a gate's line (+ is beyond it, the way the race goes) and how far off its centre. */
  gateSide(g: TrackGate, x: number, z: number): { along: number; lateral: number } {
    return { along: (x - g.x) * g.dx + (z - g.z) * g.dz, lateral: (x - g.x) * g.dz - (z - g.z) * g.dx };
  }

  /** Did moving from `a` to `b` cross gate `g` forwards, within its width? */
  crossed(g: TrackGate, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
    const before = this.gateSide(g, a.x, a.z);
    const after = this.gateSide(g, b.x, b.z);
    if (!(before.along < 0 && after.along >= 0)) return false;
    // Where the move meets the line.
    const t = before.along / (before.along - after.along);
    const lateral = before.lateral + (after.lateral - before.lateral) * t;
    return Math.abs(lateral) <= g.half + GATE_MARGIN && Math.abs((a.y + (b.y - a.y) * t) - g.y) < 8;
  }

  /** Start grid: `count` places two abreast behind the start line, facing down the road. */
  grid(count = this.track.grid): GridSlot[] {
    const out: GridSlot[] = [];
    const side = Math.min(this.width * 0.25, 3.2);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const p = this.at(this.start - (GRID_FRONT + row * GRID_ROW + col * (GRID_ROW / 2)));
      const off = col ? side : -side;
      const r = (v: number) => Math.round(v * 100) / 100;
      out.push({ x: r(p.x + p.dz * off), y: r(p.y), z: r(p.z - p.dx * off), yaw: r(Math.atan2(p.dx, p.dz)) });
    }
    return out;
  }

  private buildGates(): TrackGate[] {
    const half = this.width / 2;
    const gate = (index: number, s: number): TrackGate => {
      const p = this.at(s);
      return { index, s, x: p.x, y: p.y, z: p.z, dx: p.dx, dz: p.dz, half };
    };
    if (this.loop) {
      const n = Math.max(4, Math.round(this.length / GATE_SPACING));
      return Array.from({ length: n }, (_, k) => gate(k, (k * this.length) / n));
    }
    const finish = Math.max(this.start + 1, this.length - 2);
    const n = Math.max(2, Math.round((finish - this.start) / GATE_SPACING) + 1);
    return Array.from({ length: n }, (_, k) => gate(k, this.start + ((finish - this.start) * k) / (n - 1)));
  }
}

/** Centre-line samples: Catmull-Rom through the control points, heights eased along the road. */
function centreLine(track: Track, loop: boolean, shape: CurveShape): TrackSample[] {
  const step = shape.step ?? STEP;
  // Repeated points would make zero-length spans.
  const pts = track.points.filter((p, i, a) => i === 0 || hypot(p[0] - a[i - 1]![0], p[2] - a[i - 1]![2]) > 0.05);
  if (loop && pts.length > 2 && hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![2] - pts[pts.length - 1]![2]) < 0.05) pts.pop();
  if (pts.length < 2) {
    const p = pts[0] ?? [0, 0, 0];
    pts.push([p[0], p[1], p[2] + 1]);
  }
  const n = pts.length;
  const get = (i: number): readonly number[] => {
    if (loop) return pts[((i % n) + n) % n]!;
    if (shape.centripetal && (i < 0 || i >= n)) {
      // Past an open end: mirror the next point through the end one, so the curve leaves the end straight.
      const [e, f] = i < 0 ? [pts[0]!, pts[1]!] : [pts[n - 1]!, pts[n - 2]!];
      return [2 * e[0] - f[0], 2 * e[1] - f[1], 2 * e[2] - f[2]];
    }
    return pts[Math.max(0, Math.min(n - 1, i))]!;
  };
  const raw: { x: number; y: number; z: number }[] = [];
  const spans = loop ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const steps = Math.max(1, Math.ceil(hypot(p2[0]! - p1[0]!, p2[2]! - p1[2]!) / step));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      if (shape.centripetal) {
        const [x, y, z] = centripetal(p0, p1, p2, p3, t);
        raw.push({ x, y, z });
      } else raw.push({ x: catmull(p0[0]!, p1[0]!, p2[0]!, p3[0]!, t), y: catmull(p0[1]!, p1[1]!, p2[1]!, p3[1]!, t), z: catmull(p0[2]!, p1[2]!, p2[2]!, p3[2]!, t) });
    }
  }
  if (!loop) {
    const e = pts[n - 1]!;
    raw.push({ x: e[0], y: e[1], z: e[2] });
  }
  // Ease heights along the road (a moving average over ~12 m), so a bumpy line of clicks gives a smooth road.
  const m = raw.length;
  const ease = Math.max(1, Math.round((3 * STEP) / step));
  const ys = raw.map((_, i) => {
    let sum = 0;
    let w = 0;
    for (let k = -ease; k <= ease; k++) {
      const j = i + k;
      const q = loop ? raw[((j % m) + m) % m] : raw[j];
      if (!q) continue;
      const wk = ease + 1 - Math.abs(k);
      sum += q.y * wk;
      w += wk;
    }
    return sum / w;
  });
  const out: TrackSample[] = [];
  let s = 0;
  for (let i = 0; i < m; i++) {
    const p = raw[i]!;
    if (i > 0) s += hypot(p.x - raw[i - 1]!.x, p.z - raw[i - 1]!.z);
    const prev = loop ? raw[(i - 1 + m) % m]! : raw[Math.max(0, i - 1)]!;
    const next = loop ? raw[(i + 1) % m]! : raw[Math.min(m - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const l = hypot(dx, dz) || 1;
    out.push({ x: p.x, y: ys[i]!, z: p.z, dx: dx / l, dz: dz / l, s });
  }
  return out;
}

/** A race path's settings when it has none of its own. */
export const DEFAULT_RACE: RaceSettings = RaceSettings.parse({});

/** How a smooth path's centre line is drawn through its points (see CurveShape). */
const SMOOTH_CURVE = { step: 1, centripetal: true } as const;

/** A path as the curve code reads it: its points, width and loop, with its race settings (the defaults when it has none). */
export function pathTrack(p: MapPath): Track {
  return { ...DEFAULT_RACE, ...p.race, points: p.points, width: p.width, loop: p.closed, surface: p.style === 'dirt' ? 'dirt' : 'asphalt' };
}

const geometry = new WeakMap<MapPath, TrackGeometry>();
/** A path's centre line (cached per path object): the classic race curve, or the smooth one. */
export function pathGeometry(p: MapPath): TrackGeometry {
  let g = geometry.get(p);
  if (!g) geometry.set(p, (g = new TrackGeometry(pathTrack(p), p.curve === 'classic' ? {} : SMOOTH_CURVE)));
  return g;
}

/** Does the path have this use? */
export const pathUses = (p: MapPath, use: PathUse): boolean => p.uses.includes(use);

/** The map's race track: its first path used as a race (null: none). */
export function racePath(map: { paths?: readonly MapPath[] | undefined }): MapPath | null {
  return map.paths?.find((p) => pathUses(p, 'race') && p.points.length >= 2) ?? null;
}

/** The race track's settings and points (track.ts's shape), or null when the map has none. */
export function raceTrack(map: { paths?: readonly MapPath[] | undefined }): Track | null {
  const p = racePath(map);
  return p ? pathGeometry(p).track : null;
}

/**
 * A race road path from a track's points and settings: the classic curve, not laid on load
 * (what migration makes of a v22 `track`; tests and tools build race maps with it).
 */
export function racePathFromTrack(t: Track, id = 'race_track'): MapPath {
  const { points, width, loop, surface, ...race } = t;
  return { id, points, closed: loop, uses: ['road', 'race'], width, style: surface === 'dirt' ? 'dirt' : 'asphalt', lay: false, curve: 'classic', race };
}

/** The map's race track geometry (cached per path object), or null when it has none. */
export function trackGeometry(map: { paths?: readonly MapPath[] | undefined }): TrackGeometry | null {
  const p = racePath(map);
  return p ? pathGeometry(p) : null;
}

/** Prefix of the start-grid vehicles a race adds to the map (see raceGridEntities). */
export const RACE_GRID_PREFIX = 'race_grid_';

/**
 * Race mode: the vehicles on the start grid, as mount entities appended after
 * the map's own (the match and every client add the same ones, so mount
 * indices agree). `vehicle` overrides the track's own choice (Arcade).
 */
export function raceGridEntities(map: MapDocument, vehicle?: string): MountEntity[] {
  const g = trackGeometry(map);
  if (!g) return [];
  const model = (vehicle ?? g.track.vehicle) as MountEntity['model'];
  return g.grid().map((p, i) => ({ id: `${RACE_GRID_PREFIX}${String(i).padStart(2, '0')}`, kind: 'mount', model, position: [p.x, p.y, p.z], yaw: p.yaw, faction: null, respawnSeconds: null }));
}

/** Prefix of the ambient cars a track adds to the map (see ambientCarEntities). */
export const AMBIENT_CAR_PREFIX = 'ambient_car_';

/**
 * The track's ambient cars (any mode): where each starts out on the road
 * (spread round the lap, alternating lanes) and its place in the pit lane,
 * where it comes back after a wreck.
 */
export function ambientCarEntities(map: MapDocument): { entity: MountEntity; pit: [number, number, number]; pitYaw: number }[] {
  const g = trackGeometry(map);
  const t = g?.track;
  if (!g || !t || !t.ambient) return [];
  const r = (v: number) => Math.round(v * 100) / 100;
  const line = g.at(g.start);
  const pitYaw = Math.atan2(line.dx, line.dz);
  const pit = t.pit ?? [line.x + line.dz * (g.width / 2 + 8), line.y, line.z - line.dx * (g.width / 2 + 8)];
  const span = g.loop ? g.length : g.length - g.start;
  return Array.from({ length: t.ambient }, (_, i) => {
    // Out on the road, clear of the start grid.
    const p = g.at(g.start + span * (0.2 + (0.6 * (i + 0.5)) / t.ambient));
    const off = (i % 2 ? 1 : -1) * Math.min(3, g.width / 4);
    const entity: MountEntity = { id: `${AMBIENT_CAR_PREFIX}${String(i).padStart(2, '0')}`, kind: 'mount', model: t.ambientVehicle, position: [r(p.x + p.dz * off), r(p.y), r(p.z - p.dx * off)], yaw: r(Math.atan2(p.dx, p.dz)), faction: null, respawnSeconds: null };
    return { entity, pit: [r(pit[0] - line.dx * 6 * i), r(pit[1]), r(pit[2] - line.dz * 6 * i)], pitYaw: r(pitYaw) };
  });
}

/**
 * The map as a match plays it: the start-grid vehicles in a race, then the
 * track's ambient cars (any mode), after the map's own entities. The match
 * builds its mounts in the same order, so mount indices agree.
 */
export function withTrackVehicles(map: MapDocument, rules: { mode: string; raceVehicle?: string }): MapDocument {
  if (!racePath(map) || map.entities.some((e) => e.id.startsWith(RACE_GRID_PREFIX) || e.id.startsWith(AMBIENT_CAR_PREFIX))) return map;
  const grid = rules.mode === 'core.race' ? raceGridEntities(map, rules.raceVehicle) : [];
  const ambient = ambientCarEntities(map).map((c) => c.entity);
  if (!grid.length && !ambient.length) return map;
  return { ...map, entities: [...map.entities, ...(grid as MapEntity[]), ...(ambient as MapEntity[])] };
}

/** Road height at a point for drawing: on the ground where there is terrain at about the road's height, else the centre line's. */
export function roadSurfaceY(terrain: TerrainData | null, x: number, z: number, lineY: number): number {
  const h = terrain ? terrainHeightAt(terrain, x, z) : null;
  return h !== null && Math.abs(h - lineY) < 3 ? h : lineY;
}

/**
 * The road as strips to draw: per centre-line sample, `cols + 1` points
 * across from the left edge to the right (x, y, z), following the ground.
 * Also used for the curbs (a narrow strip just outside each edge).
 */
export function roadStrip(map: MapDocument, from: number, to: number, cols: number, lift = 0.06): { rows: number[][]; s: number[] } {
  const g = trackGeometry(map);
  if (!g) return { rows: [], s: [] };
  const rows: number[][] = [];
  const s: number[] = [];
  const ring = g.loop ? [...g.samples, g.samples[0]!] : g.samples;
  ring.forEach((p, i) => {
    const row: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const off = from + ((to - from) * c) / cols;
      const x = p.x + p.dz * off;
      const z = p.z - p.dx * off;
      row.push(x, roadSurfaceY(map.terrain, x, z, p.y) + lift, z);
    }
    rows.push(row);
    s.push(i === ring.length - 1 && g.loop ? g.length : p.s);
  });
  return { rows, s };
}

/** Ease a new control point's height onto the ground under it (MapMaker places points where you click). */
export function trackPointAt(terrain: TerrainData | null, x: number, y: number, z: number): [number, number, number] {
  const r = (v: number) => Math.round(v * 100) / 100;
  const h = terrain ? terrainHeightAt(terrain, x, z) : null;
  return [r(x), r(h ?? y), r(z)];
}

/**
 * Creator-facing checks on the track (navigation reachability is checked in
 * nav/, which needs Recast): enough control points, inside the boundary and
 * on the terrain, long enough to race, a grid for the players, and Race mode
 * listed only with a track. Also the paths' own checks: one race track, and
 * routes NPC squads walk exist.
 */
export function validateTrack(map: MapDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const paths = map.paths ?? [];
  const ids = new Set<string>();
  for (const p of paths) {
    if (ids.has(p.id)) issues.push({ severity: 'error', code: 'path.duplicate', message: `two paths share the id "${p.id}"` });
    ids.add(p.id);
  }
  const races = paths.filter((p) => pathUses(p, 'race'));
  if (races.length > 1) issues.push({ severity: 'warning', code: 'track.many', message: `${races.length} paths are race tracks: races use the first one` });
  const t = raceTrack(map);
  if (!t) {
    if (map.metadata.supportedModes.includes('core.race')) issues.push({ severity: 'error', code: 'race.no_track', message: 'Race is listed but the map has no track: draw a path with the Paths tool (G) and tick Race track' });
    return issues;
  }
  if (t.width < 5) issues.push({ severity: 'error', code: 'track.width', message: `the race track is ${t.width} m wide: races need 5 m or more` });
  if (t.loop && t.points.length < 3) issues.push({ severity: 'error', code: 'track.points', message: 'a circuit needs at least 3 road points' });
  if (map.bounds) {
    const { min, max } = map.bounds;
    t.points.forEach((p, i) => {
      if (p[0] < min[0] || p[0] > max[0] || p[2] < min[1] || p[2] > max[1]) issues.push({ severity: 'error', code: 'track.outside', message: `road point ${i + 1} is outside the map boundary` });
    });
  }
  const g = trackGeometry(map);
  if (!g) return issues;
  if (map.terrain) {
    const off = g.samples.filter((p) => terrainHeightAt(map.terrain!, p.x, p.z) === null).length;
    if (off) issues.push({ severity: 'warning', code: 'track.off_terrain', message: `${Math.round((off * g.length) / g.samples.length)} m of road runs off the terrain` });
  }
  if (g.length < 80) issues.push({ severity: 'warning', code: 'track.short', message: `the road is only ${Math.round(g.length)} m long: races need 80 m or more` });
  // Only races put everyone on the grid; a track that just carries ambient traffic can have any player count.
  if (map.metadata.supportedModes.includes('core.race') && t.grid < map.metadata.recommendedPlayers.max) {
    issues.push({ severity: 'warning', code: 'track.grid', message: `the start grid has ${t.grid} places for up to ${map.metadata.recommendedPlayers.max} players` });
  }
  // A grid longer than the road behind the start line would wrap round into the last corner.
  if (g.loop && GRID_FRONT + Math.ceil(t.grid / 2) * GRID_ROW > g.length * 0.4) issues.push({ severity: 'warning', code: 'track.grid_long', message: 'the start grid is longer than the road can hold: fewer places or a longer track' });
  return issues;
}
