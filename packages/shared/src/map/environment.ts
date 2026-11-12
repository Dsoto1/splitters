/**
 * Environment species in a map (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §9.4): each solid `env.*` placement's collision
 * shapes in world space, from its species variant's shapes (content/environment.ts) moved by the placement's
 * position, yaw and scale. Drawn tilt (plants on slopes) is never applied: collision stays upright. The same code
 * runs on the dedicated host, a browser host and every client's prediction, from the map alone (no model files).
 */
import { envVariant, getEnvSpecies, isEnvModel, type EnvBlocks, type EnvShape, type EnvSpeciesData } from '../content/environment.ts';
import type { SurfaceTypeId } from '../sim/surfaceTypes.ts';
import { isBreakableProp, yawXZ } from './geometry.ts';
import type { MapDocument, PropEntity } from './schema.ts';

type V3 = [number, number, number];

interface ShapeBase {
  /** The placement it comes from (editor focus, impact surface lookups). */
  readonly sourceId: string;
  readonly blocks: EnvBlocks;
  readonly surface: SurfaceTypeId;
  /** Whether it is a navigation obstacle (its species' nav is not 'none' and it stops movement). */
  readonly nav: boolean;
}

/** A collision shape in world space. Hulls are convex point clouds (flat xyz); meshes are triangle lists. */
export type EnvWorldShape =
  | (ShapeBase & { readonly kind: 'capsule'; readonly a: V3; readonly b: V3; readonly r: number })
  | (ShapeBase & { readonly kind: 'hull'; readonly points: readonly number[] })
  | (ShapeBase & { readonly kind: 'mesh'; readonly positions: readonly number[]; readonly indices: readonly number[] });

/**
 * The environment placements of a map that collide: solid, an env species, not riding a mover. A log given its own
 * health (geometry.ts `isBreakableProp`) is not static: the scenario owns its colliders (ask for those with `breakable`).
 */
export function environmentPlacements(map: MapDocument, breakable = false): { e: PropEntity; species: EnvSpeciesData }[] {
  const carried = new Set(map.entities.flatMap((e) => (e.kind === 'mover' ? (e.props ?? []) : [])));
  const out: { e: PropEntity; species: EnvSpeciesData }[] = [];
  for (const e of map.entities) {
    if (e.kind !== 'prop' || !isEnvModel(e.model) || !e.solid || carried.has(e.id) || isBreakableProp(e) !== breakable) continue;
    const species = getEnvSpecies(e.model);
    if (species) out.push({ e, species });
  }
  return out;
}

/** Every static environment collision shape of a map, in world space (`breakable`: those of its breakable logs instead). */
export function environmentShapes(map: MapDocument, breakable = false): EnvWorldShape[] {
  return environmentPlacements(map, breakable).flatMap(({ e, species }) => placementShapes(e, species));
}

/** One placement's collision shapes in world space. */
export function placementShapes(e: PropEntity, species: EnvSpeciesData): EnvWorldShape[] {
  const v = envVariant(species, e.variant);
  const [px, py, pz] = e.position;
  const s = e.scale;
  const at = (x: number, y: number, z: number): V3 => {
    const [rx, rz] = yawXZ(x * s, z * s, e.yaw);
    return [px + rx, py + y * s, pz + rz];
  };
  return v.shapes.map((sh) => placeShape(sh, at, s, e.id, species.nav !== 'none'));
}

function placeShape(sh: EnvShape, at: (x: number, y: number, z: number) => V3, s: number, sourceId: string, navOk: boolean): EnvWorldShape {
  const base = { sourceId, blocks: sh.blocks, surface: sh.surface, nav: navOk && sh.blocks === 'all' };
  switch (sh.kind) {
    case 'capsule':
      return { ...base, kind: 'capsule', a: at(...sh.a), b: at(...sh.b), r: sh.r * s };
    case 'hull':
      return { ...base, kind: 'hull', points: sh.points.flatMap((p) => at(...p)) };
    case 'box': {
      // A turned box as the hull of its corners.
      const pts: number[] = [];
      const cx = (sh.min[0] + sh.max[0]) / 2;
      const cz = (sh.min[2] + sh.max[2]) / 2;
      for (const x of [sh.min[0], sh.max[0]])
        for (const y of [sh.min[1], sh.max[1]])
          for (const z of [sh.min[2], sh.max[2]]) {
            const [rx, rz] = yawXZ(x - cx, z - cz, sh.yaw ?? 0);
            pts.push(...at(cx + rx, y, cz + rz));
          }
      return { ...base, kind: 'hull', points: pts };
    }
    case 'mesh': {
      const positions: number[] = [];
      for (let i = 0; i < sh.positions.length; i += 3) positions.push(...at(sh.positions[i]!, sh.positions[i + 1]!, sh.positions[i + 2]!));
      return { ...base, kind: 'mesh', positions, indices: [...sh.indices] };
    }
  }
}

/** 2D convex hull (monotone chain) of points [x, z], counter-clockwise. */
function hull2(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Triangles navigation builds round (NavWorld.build `extra`): each movement-blocking shape of a species that is a
 * nav obstacle. Capsules and hulls become their footprint (2D hull) raised from their lowest to their highest
 * point, a conservative prism; meshes (cliffs) go in as they are. Shots-only shapes (limbs overhead) and plants are
 * left out, so bots never route round foliage.
 */
export function environmentNavTriangles(shapes: readonly EnvWorldShape[]): { positions: Float32Array; indices: Uint32Array } | null {
  const P: number[] = [];
  const I: number[] = [];
  for (const sh of shapes) {
    if (!sh.nav) continue;
    if (sh.kind === 'mesh') {
      const o = P.length / 3;
      P.push(...sh.positions);
      for (const i of sh.indices) I.push(i + o);
      continue;
    }
    let foot: [number, number][];
    let y0: number;
    let y1: number;
    if (sh.kind === 'capsule') {
      foot = [];
      for (const c of [sh.a, sh.b]) for (let k = 0; k < 8; k++) foot.push([c[0] + Math.cos((k * Math.PI) / 4) * sh.r, c[2] + Math.sin((k * Math.PI) / 4) * sh.r]);
      y0 = Math.min(sh.a[1], sh.b[1]) - sh.r;
      y1 = Math.max(sh.a[1], sh.b[1]) + sh.r;
    } else {
      foot = [];
      y0 = Infinity;
      y1 = -Infinity;
      for (let i = 0; i < sh.points.length; i += 3) {
        foot.push([sh.points[i]!, sh.points[i + 2]!]);
        y0 = Math.min(y0, sh.points[i + 1]!);
        y1 = Math.max(y1, sh.points[i + 1]!);
      }
    }
    const ring = hull2(foot);
    const o = P.length / 3;
    for (const [x, z] of ring) P.push(x, y0, z, x, y1, z);
    const n = ring.length;
    for (let k = 0; k < n; k++) {
      const a = o + k * 2;
      const b = o + ((k + 1) % n) * 2;
      I.push(a, b, b + 1, a, b + 1, a + 1);
    }
    // The top, a fan (so a boulder's top is a surface navigation can see).
    for (let k = 1; k + 1 < n; k++) I.push(o + 1, o + (k + 1) * 2 + 1, o + k * 2 + 1);
  }
  return P.length ? { positions: new Float32Array(P), indices: new Uint32Array(I) } : null;
}

/** Join triangle soups (terrain + environment) for NavWorld.build's `extra`. */
export function joinTriangles(...parts: ({ positions: Float32Array; indices: Uint32Array } | null)[]): { positions: Float32Array; indices: Uint32Array } | null {
  const list = parts.filter((p): p is { positions: Float32Array; indices: Uint32Array } => !!p);
  if (list.length <= 1) return list[0] ?? null;
  const positions = new Float32Array(list.reduce((n, p) => n + p.positions.length, 0));
  const indices = new Uint32Array(list.reduce((n, p) => n + p.indices.length, 0));
  let po = 0;
  let io = 0;
  for (const p of list) {
    positions.set(p.positions, po);
    for (let i = 0; i < p.indices.length; i++) indices[io + i] = p.indices[i]! + po / 3;
    po += p.positions.length;
    io += p.indices.length;
  }
  return { positions, indices };
}

/** A stable digest of a shape list (the same map gives the same colliders on every host and client). */
export function environmentShapesHash(shapes: readonly EnvWorldShape[]): string {
  let h = 0x811c9dc5;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  const r = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);
  for (const sh of shapes) {
    mix(`${sh.kind}|${sh.sourceId}|${sh.blocks}|${sh.surface}|`);
    const nums = sh.kind === 'capsule' ? [...sh.a, ...sh.b, sh.r] : sh.kind === 'hull' ? sh.points : [...sh.positions, ...sh.indices];
    for (const v of nums) mix(`${r(v)},`);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
