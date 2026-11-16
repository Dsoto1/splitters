// Flavius Rule's octagon, phase 2 (docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md §3.2, §3.4, §3.7): the Arena
// Corner tiles (`core.arena_corner_ground`, `_mid`, `_upper`, `_attic`, made by tools/content/kit/arenaCorner.mjs) and
// `setpiece.arena_corner`, between straight bay lines of the Arena stands as Flavius Rule builds them. In all four turns:
// bots walk the galleries round the corner from one straight stand to the other, and up each mitre aisle and the centre
// aisle; the rows meet the straight bays' rows flush; nothing is drawn twice. A mirrored corner is a turned one, the
// four stacked tiles overlap nowhere, and the corner keeps to its box and light budgets.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  PhysicsWorld,
  applyCommand,
  boxCorners,
  builtInSetPieces,
  buildMapDecor,
  buildMapGeometry,
  coplanarOverlaps,
  coreCatalog,
  explodeSetPieceCommand,
  initPhysics,
  loadMap,
  mapTerrainMesh,
  navLinks,
  rotateXZ,
  serializeMap,
  tileDiagonalMirror,
  visibleFaces,
  type MapDocument,
  type MapEntity,
  type Rotation,
  type SetPiecePlacement,
  type TilePlacement,
  type Vec3,
  type WorldBox,
} from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const TILES = ['core.arena_corner_ground', 'core.arena_corner_mid', 'core.arena_corner_upper', 'core.arena_corner_attic'] as const;
const library = builtInSetPieces();
const T = Math.tan(Math.PI / 8);
/** The north mitre's x at depth d (the corner as built north-east of the sand, before it is turned). */
const xm = (d: number) => 12 + T * d;
/** The height of an aisle's step at depth d (8 to 48) on its centre line: 16 steps of 0.25 m every 8 m of depth. */
const stepTop = (d: number) => 4 + 0.25 * (Math.floor((d - 8) / 0.5) + 1);

type Placed = Omit<SetPiecePlacement, 'mirror'> & { mirror?: boolean };

/**
 * The corner north-east of the sand with a straight bay line of each stand beside it (the north stand's at x 4..12,
 * the east one's at z 4..12) built as Flavius Rule's are, the fill under their upper tiers, sand to the south-west;
 * all turned `k` quarter turns about the arena's centre.
 */
function standsMap(k: Rotation, corner: Partial<Placed> = {}): MapDocument {
  const turn = (x: number, y: number): [number, number] => rotateXZ(x, y, k);
  const pieces: Placed[] = [];
  const piece = (id: string, name: string, x: number, y: number, z: number, rotation: number) => {
    const [px, py] = turn(x, y);
    pieces.push({ id, piece: name, x: px, y: py, z, rotation: ((rotation + k) % 4) as Rotation });
  };
  // North stand (arena to the south), x cell 1; east stand (arena to the west, turned one quarter), y cell 1.
  for (const [side, rot, at] of [['n', 0, (d: number) => [1, d]], ['e', 1, (d: number) => [d, 1]]] as const) {
    const p = (id: string, name: string, d: number, z: number) => piece(`${side}_${id}`, name, at(d)[0]!, at(d)[1]!, z, rot);
    p('podium', 'setpiece.arena_bay_podium', 4, 0);
    p('tier_a', 'setpiece.arena_bay_tier', 6, 2);
    p('tier_b', 'setpiece.arena_bay_tier', 8, 4);
    p('attic', 'setpiece.arena_attic', 10, 6);
    for (const z of [0, 2, 4]) p(`arcade_${z}`, 'setpiece.arena_arcade', 10, z);
  }
  const [cx, cy] = turn(2, 2);
  pieces.push({ id: 'corner', piece: 'setpiece.arena_corner', x: cx, y: cy, z: 0, rotation: k, ...corner });
  // Sand: the arena's quarter, less the corner cell under the podium.
  const tiles: TilePlacement[] = [];
  for (let x = -1; x <= 3; x++) {
    for (let y = -1; y <= 3; y++) {
      if (x === 3 && y === 3) continue;
      const [tx, ty] = turn(x, y);
      tiles.push({ id: `sand_${x + 1}_${y + 1}`, tile: 'core.yard', x: tx, y: ty, z: 0, rotation: 0 });
    }
  }
  // The stand fill under the upper tiers (blocks, as Flavius Rule has them).
  const blocks: MapEntity[] = [];
  const fill = (id: string, x: number, z: number, sx: number, sy: number, sz: number) => {
    const [px, pz] = rotateXZ(x, z, k);
    blocks.push({ id, kind: 'block', name: 'Stand fill', position: [px, 0, pz], size: k % 2 ? [sz, sy, sx] : [sx, sy, sz], yaw: 0, material: 'core.pbr_limestone', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 } as MapEntity);
  };
  fill('fill_n_low', 8, 52, 8, 8, 16);
  fill('fill_n_high', 8, 68, 8, 16, 16);
  fill('fill_e_low', 52, 8, 16, 8, 8);
  fill('fill_e_high', 68, 8, 16, 16, 8);
  const map = makeMap(tiles, [[-150, 0, -150]]);
  return {
    ...map,
    classicStructure: { ...map.classicStructure, theme: 'core.imperial' },
    entities: [...map.entities, ...blocks],
    setPieces: pieces.map((p) => ({ mirror: false, ...p })),
  };
}

const played = (doc: MapDocument): MapDocument => {
  const r = loadMap(serializeMap(doc));
  if (!r.ok) throw new Error(r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
  return r.map;
};
const physicsOf = (map: MapDocument) => new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map));
function navOf(map: MapDocument): NavWorld {
  const physics = physicsOf(map);
  return NavWorld.build(buildMapGeometry(map), mapTerrainMesh(map), navLinks(map.entities, physics));
}

/** A point of the corner as built north-east of the sand, turned k quarter turns. */
const at = (k: number, x: number, y: number, z: number): Vec3 => {
  const [rx, rz] = rotateXZ(x, z, k);
  return { x: rx, y, z: rz };
};
/** The point on the north mitre at depth d, and at the diagonal's centre line (u along it, v its depth). */
const onMitre = (k: number, d: number, y: number) => at(k, xm(d), y, 28 + d);
const onDiagonal = (k: number, u: number, v: number, y: number) => at(k, 20 + (u + v) / Math.SQRT2, y, 20 + (v - u) / Math.SQRT2);

const pathLength = (path: readonly Vec3[]) => path.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - path[i]!.x, p.y - path[i]!.y, p.z - path[i]!.z), 0);
/** A bot's path from a to b that reaches b (within a metre), or null. */
function route(nav: NavWorld, a: Vec3, b: Vec3): Vec3[] | null {
  const path = nav.findPath(a, b);
  if (!path?.length) return null;
  const end = path.at(-1)!;
  return Math.hypot(end.x - b.x, end.y - b.y, end.z - b.z) < 1 ? path : null;
}

/** A box's corners, rounded, sorted, with its kind: boxes compare as shapes however they were built. */
const shape = (b: Pick<WorldBox, 'min' | 'max' | 'yaw' | 'pitch' | 'roll' | 'kind'>) =>
  `${b.kind} ${boxCorners(b)
    .map((p) => p.map((v) => (Math.round(v * 1000) / 1000 + 0).toFixed(3)).join(','))
    .sort()
    .join(' ')}`;
const cornerBoxes = (boxes: readonly WorldBox[]) => boxes.filter((b) => b.sourceId.startsWith('sp_corner_'));

// ------------------------------------------------------------------ the pieces

describe('the Arena Corner tiles', () => {
  it('are four tiles of the Vertical palette, each its own mirror image across the diagonal, stacked by the set piece on levels 0, 2, 4 and 6', () => {
    for (const id of TILES) {
      const def = coreCatalog.get(id)!;
      expect(def, id).toBeDefined();
      expect(def.category).toBe('Vertical');
      expect(tileDiagonalMirror(def), id).toBe(true);
      expect(new Set(def.cells.map((c) => c[2]))).toEqual(new Set([0, 1]));
    }
    const piece = library.pieces.get('setpiece.arena_corner')!;
    expect(piece.parts.filter((p) => p.kind === 'tile').map((p) => [p.kind === 'tile' && p.tile, p.z])).toEqual(TILES.map((t, i) => [t, i * 2]));
    expect(piece.mirror).toBe('free');
  });

  it('a whole corner collides as well under 2,700 boxes and brings at most 18 lights', () => {
    const map = played(standsMap(0));
    const counts = TILES.map((t, i) => cornerBoxes(buildMapGeometry(map)).filter((b) => b.sourceId === `sp_corner_${i}`).length);
    const trim = TILES.map((t, i) => cornerBoxes(buildMapDecor(map)).filter((b) => b.sourceId === `sp_corner_${i}`).length);
    const lights = map.entities.filter((e) => e.kind === 'light' && e.id.startsWith('sp_corner_')).length;
    console.log(`arena corner: collision ${counts.join(' + ')} = ${counts.reduce((a, b) => a + b, 0)}; trim ${trim.join(' + ')}; lights ${lights}`);
    expect(counts.reduce((a, b) => a + b, 0)).toBeLessThan(2000);
    expect(lights).toBeGreaterThan(0);
    expect(lights).toBeLessThanOrEqual(18);
  });
});

// ------------------------------------------------------------------ in all four turns

describe.each([0, 1, 2, 3] as Rotation[])('the corner between straight stands, turned %i', (k) => {
  const map = played(standsMap(k));

  it('bots walk each gallery (levels 0, 2 and 4) from the north stand round the corner to the east stand, staying in it', () => {
    const nav = navOf(map);
    for (const [y, d] of [[0, 12], [8, 28], [16, 44]] as const) {
      const from = at(k, 8, y, 28 + d);
      const to = at(k, 28 + d, y, 8);
      const path = route(nav, from, to);
      expect(path, `gallery at ${y} m`).not.toBeNull();
      for (const p of path!) expect(p.y, `the gallery at ${y} m: ${JSON.stringify(p)}`).toBeLessThan(y + 1);
      // Through the diagonal: the path crosses its centre line (x = z before the turn) in the gallery's depth.
      const back = path!.map((p) => rotateXZ(p.x, p.z, (4 - k) % 4));
      expect(back.some(([x, z], i) => i > 0 && Math.sign(x - z) !== Math.sign(back[i - 1]![0] - back[i - 1]![1]) && Math.abs((x + z) / 2 - 20 - (d / Math.SQRT2)) < 8)).toBe(true);
      expect(pathLength(path!)).toBeLessThan(Math.hypot(to.x - from.x, to.z - from.z) * 1.6);
    }
    nav.destroy();
  });

  it('bots climb each mitre aisle and the centre aisle from the podium walkway to the attic, and through the vomitorium into the top gallery', () => {
    const nav = navOf(map);
    // The mitre aisles run from the podium's top walkway (depth 8, 4 m) to the attic (depth 48, 24 m); the centre aisle
    // to the vomitorium's mouth (depth 32, 16 m), and on from the top gallery's roof (depth 40) to the attic.
    const MITRE = [12.25, 20.25, 28.25, 36.25, 44.25];
    for (const [name, foot, up, depths] of [
      ['north mitre', onMitre(k, 7.4, 4), (d: number) => onMitre(k, d, stepTop(d)), MITRE],
      ['east mitre', at(k, 28 + 7.4, 4, xm(7.4)), (d: number) => at(k, 28 + d, stepTop(d), xm(d)), MITRE],
      ['centre', onDiagonal(k, 0, 7.4, 4), (d: number) => onDiagonal(k, 0, d, stepTop(d)), [12.25, 20.25, 28.25, 31.75]],
    ] as const) {
      for (const d of depths) {
        const to = up(d);
        const path = route(nav, foot, to);
        expect(path, `${name} aisle to depth ${d}`).not.toBeNull();
        // Straight up the aisle, not round by another one.
        const climb = Math.hypot(to.x - foot.x, to.y - foot.y, to.z - foot.z);
        expect(pathLength(path!), `${name} aisle to depth ${d}`).toBeLessThan(climb * 1.35 + 2);
      }
    }
    // Up to the attic walk, and out of the top gallery through the vomitorium onto the seats.
    expect(route(nav, onMitre(k, 7.4, 4), onMitre(k, 51, 24)), 'the attic').not.toBeNull();
    expect(route(nav, onDiagonal(k, 0, 44, 16), onDiagonal(k, 0, 33, 16)), 'the vomitorium').not.toBeNull();
    expect(route(nav, onDiagonal(k, 0, 7.4, 4), onDiagonal(k, 0, 44, 16)), 'up the centre aisle and through the vomitorium into the top gallery').not.toBeNull();
    expect(route(nav, onDiagonal(k, 0, 51, 24), onDiagonal(k, 0, 44.25, stepTop(44.25))), 'the centre aisle over the top gallery, from the attic').not.toBeNull();
    nav.destroy();
  });

  it('bots climb each gallery stair (phase 5) from the ground gallery into the middle gallery and back down, either side of the diagonal', () => {
    const nav = navOf(map);
    for (const s of [-1, 1]) {
      const side = s < 0 ? 'west' : 'east';
      // From the ground gallery behind the stair's arch to the middle gallery over it: through the arch, up the flight
      // along the depth to the landing, up the flight along the gallery and out of the hole in its floor.
      const ground = onDiagonal(k, 10 * s, 12, 0);
      const mid = onDiagonal(k, 10 * s, 29, 8);
      const up = route(nav, ground, mid);
      expect(up, `up the ${side} stair`).not.toBeNull();
      // By its own stair (the other one, or round by the straight stands, is twice as far), under the seats.
      expect(pathLength(up!), `up the ${side} stair`).toBeLessThan(40);
      for (const p of up!) expect(p.y, `up the ${side} stair: ${JSON.stringify(p)}`).toBeLessThan(8.6);
      const down = route(nav, mid, ground);
      expect(down, `down the ${side} stair`).not.toBeNull();
      expect(pathLength(down!), `down the ${side} stair`).toBeLessThan(40);
      // The parapet: a fall into the hole from the gallery beside it is blocked.
      const physics = physicsOf(map);
      // (Toward the sand, -v: (-1, -1) / √2 before the turn.)
      const [dx, dz] = rotateXZ(-Math.SQRT1_2, -Math.SQRT1_2, k);
      expect(physics.raycastHit(onDiagonal(k, 9 * s, 28, 8.5), { x: dx, y: 0, z: dz }, 3), `the ${side} parapet`).not.toBeNull();
    }
    nav.destroy();
  });

  it("the rows, walkways and floors meet the straight bays' flush on both sides", () => {
    const physics = physicsOf(map);
    const top = (x: number, z: number) => {
      const p = at(k, x, 40, z);
      const hit = physics.raycastHit(p, { x: 0, y: -1, z: 0 }, 50);
      return hit ? 40 - hit.dist : null;
    };
    let n = 0;
    for (let d = 0.05; d < 55.4; d += 0.1) {
      // Skip the row edges themselves (a step's riser).
      const f = d % 0.5;
      if (f < 0.04 || f > 0.46) continue;
      const z = 28 + d;
      expect(top(12.08, z), `north side, depth ${d.toFixed(2)}`).toBeCloseTo(top(11.92, z)!, 3);
      expect(top(z, 12.08), `east side, depth ${d.toFixed(2)}`).toBeCloseTo(top(z, 11.92)!, 3);
      n++;
    }
    expect(n).toBeGreaterThan(300);
  });

  it('no coplanar faces left drawn twice, in the corner or where it meets the straight bays', () => {
    const boxes = [...buildMapGeometry(map), ...buildMapDecor(map)];
    const left = coplanarOverlaps(boxes, { faces: visibleFaces(boxes) });
    expect(left.slice(0, 5).map((o) => `${boxes[o.a]!.kind} ${boxes[o.a]!.sourceId} / ${boxes[o.b]!.kind} ${boxes[o.b]!.sourceId} at ${o.center.map((v) => v.toFixed(2))} (${o.area.toFixed(3)} m²)`)).toEqual([]);
  });
});

// ------------------------------------------------------------------ mirror, overlap, explode

describe('the set piece mirrored, stacked and exploded', () => {
  it('mirrored, it is the same corner turned: the same boxes, trim and lights', () => {
    for (const r of [0, 1, 2, 3] as Rotation[]) {
      // Mirrored (east and west swapped over its footprint, cells 0..8) it is the corner turned three more quarters,
      // its anchor at the far end of its first row.
      const [dx, dy] = rotateXZ(8, 0, r);
      const one = (p: Partial<SetPiecePlacement>) => {
        const map = makeMap([], [[-150, 0, -150]]);
        return played({ ...map, setPieces: [{ id: 'corner', piece: 'setpiece.arena_corner', x: 0, y: 0, z: 0, rotation: r, mirror: false, ...p }] });
      };
      const mirrored = one({ mirror: true });
      const turned = one({ x: dx, y: dy, rotation: ((r + 3) % 4) as Rotation });
      expect(buildMapGeometry(mirrored).map(shape).sort()).toEqual(buildMapGeometry(turned).map(shape).sort());
      expect(buildMapDecor(mirrored).map(shape).sort()).toEqual(buildMapDecor(turned).map(shape).sort());
      const lights = (m: MapDocument) =>
        m.entities
          .filter((e) => e.kind === 'light')
          .map((e) => e.position.map((v) => v.toFixed(2)).join(','))
          .sort();
      expect(lights(mirrored)).toEqual(lights(turned));
    }
  });

  it('the four stacked tiles overlap nowhere', () => {
    const boxes = buildMapGeometry(played(standsMap(0)));
    const byTile = TILES.map((_, i) => boxes.filter((b) => b.sourceId === `sp_corner_${i}`));
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 4; j++) {
        const clash = byTile[i]!.flatMap((a) => byTile[j]!.filter((b) => overlaps(a, b)).map((b) => `${shape(a)} / ${shape(b)}`));
        expect(clash.slice(0, 3), `${TILES[i]} and ${TILES[j]}`).toEqual([]);
      }
    }
  });

  it('explodes into its four tiles and its lights, building the same as the set piece', () => {
    const doc = standsMap(1);
    const r = explodeSetPieceCommand(doc, 'corner');
    if ('error' in r) throw new Error(r.error);
    const exploded = played(applyCommand(doc, r.command));
    const asPlayed = played(doc);
    expect(exploded.classicStructure.tiles.filter((t) => t.tile.startsWith('core.arena_corner_')).length).toBe(4);
    expect(buildMapGeometry(exploded).map(shape).sort()).toEqual(buildMapGeometry(asPlayed).map(shape).sort());
  });
});

// ------------------------------------------------------------------ oriented boxes

/** The axes of a box in the world (its own x, y and z) and its centre, from its corners. */
function frame(b: WorldBox): { c: number[]; axes: number[][]; half: number[] } {
  const p = boxCorners(b);
  // Corner i: bit0 max x, bit1 max y, bit2 max z.
  const c = [0, 1, 2].map((k) => p.reduce((s, q) => s + q[k]!, 0) / 8);
  const edge = (i: number) => [0, 1, 2].map((k) => p[i]![k]! - p[0]![k]!);
  const axes: number[][] = [];
  const half: number[] = [];
  for (const i of [1, 2, 4]) {
    const e = edge(i);
    const len = Math.hypot(e[0]!, e[1]!, e[2]!);
    axes.push(e.map((v) => v / (len || 1)));
    half.push(len / 2);
  }
  return { c, axes, half };
}
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
/** Whether two boxes' insides overlap by more than 2 mm (separating axes). */
function overlaps(a: WorldBox, b: WorldBox): boolean {
  const A = frame(a);
  const B = frame(b);
  const d = [0, 1, 2].map((k) => B.c[k]! - A.c[k]!);
  const axes = [...A.axes, ...B.axes];
  for (const u of A.axes) for (const v of B.axes) {
    const w = cross(u, v);
    const n = Math.hypot(w[0]!, w[1]!, w[2]!);
    if (n > 1e-6) axes.push(w.map((x) => x / n));
  }
  for (const n of axes) {
    const ra = A.axes.reduce((s, ax, i) => s + A.half[i]! * Math.abs(dot(ax, n)), 0);
    const rb = B.axes.reduce((s, ax, i) => s + B.half[i]! * Math.abs(dot(ax, n)), 0);
    if (Math.abs(dot(d, n)) >= ra + rb - 0.002) return false;
  }
  return true;
}

