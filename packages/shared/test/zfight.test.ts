// Z-fighting (the texture flicker): visibleFaces, the build-time pass that keeps any two drawn faces out of the
// same plane, and the audit over every map in maps/ (coplanar overlaps left: none).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLIVER, axisFaces, boxQuat, buildMapDecor, buildMapGeometry, coplanarIssues, coplanarOverlaps, coplanarSpots, loadMap, quatRotate, visibleFaces, type MapEntity, type RenderFace, type WorldBox } from '../src/index.ts';
import { makeMap } from './helpers.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const ids = readdirSync(MAPS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort();
const drawnBoxes = (id: string): WorldBox[] => {
  const loaded = loadMap(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
  if (!loaded.ok) throw new Error(`${id} failed to load`);
  // What the game draws (session.ts → view.buildMap → MapStyler.build): geometry and trim.
  return [...buildMapGeometry(loaded.map), ...buildMapDecor(loaded.map)];
};

const box = (min: [number, number, number], max: [number, number, number], kind: WorldBox['kind'] = 'wall', extra: Partial<WorldBox> = {}): WorldBox => ({ min, max, kind, sourceId: 't', ...extra });
const area = (f: RenderFace) => {
  const [a, b, , d] = f.corners;
  return Math.hypot(b![0] - a![0], b![1] - a![1], b![2] - a![2]) * Math.hypot(d![0] - a![0], d![1] - a![1], d![2] - a![2]);
};
const facesOf = (faces: RenderFace[], i: number, n: [number, number, number]) => faces.filter((f) => f.box === i && f.normal.every((v, k) => Math.abs(v - n[k]!) < 1e-6));
const total = (faces: RenderFace[]) => faces.reduce((s, f) => s + area(f), 0);

describe('visibleFaces', () => {
  it('draws all six faces of a box on its own', () => {
    const faces = visibleFaces([box([0, 0, 0], [1, 2, 3])]);
    expect(faces).toHaveLength(6);
    expect(total(faces)).toBeCloseTo(2 * (2 + 3 + 6), 6);
  });

  it('draws nothing for props and barriers, or for a box inside another (the shared wall of two rooms)', () => {
    expect(visibleFaces([box([0, 0, 0], [1, 1, 1], 'prop'), box([0, 0, 0], [1, 1, 1], 'barrier')])).toEqual([]);
    const faces = visibleFaces([box([0, 0, 0], [4, 4, 0.25]), box([0, 0, 0], [4, 4, 0.25]), box([1, 0, 0], [2, 4, 0.25])]);
    expect(new Set(faces.map((f) => f.box))).toEqual(new Set([0]));
  });

  it('a floor slab over a wall top wins, and the wall face inside the slab is dropped', () => {
    // Wall up to the next level's floor top (y 4), the slab above (3.5..4) running over it.
    const boxes = [box([0, 0, 0], [8, 4, 0.25], 'wall'), box([0, 3.5, 0], [8, 4, 8], 'floor')];
    const faces = visibleFaces(boxes);
    expect(facesOf(faces, 0, [0, 1, 0])).toEqual([]);
    expect(total(facesOf(faces, 1, [0, 1, 0]))).toBeCloseTo(64, 6);
    // The wall's inner face stops at the slab's underside (plus the 0.5 mm seam).
    const inner = facesOf(faces, 0, [0, 0, 1]);
    expect(Math.max(...inner.flatMap((f) => f.corners.map((c) => c[1])))).toBeCloseTo(3.5005, 6);
    // The wall's outer face wins over the slab's edge (sides: walls over floors).
    expect(total(facesOf(faces, 0, [0, 0, -1]))).toBeCloseTo(32, 6);
    expect(facesOf(faces, 1, [0, 0, -1])).toEqual([]);
  });

  it('trim flush with a wall shows, the wall under it is cut away but for the seam', () => {
    // A frame standing off the wall, running past its end: its face and the wall's share the plane z = 0.25 over 1 m².
    const boxes = [box([0, 0, 0], [8, 4, 0.25], 'wall'), box([7, 1, 0.1], [9, 2, 0.25], 'trim')];
    const faces = visibleFaces(boxes);
    expect(total(facesOf(faces, 1, [0, 0, 1]))).toBeCloseTo(2, 6);
    expect(total(facesOf(faces, 0, [0, 0, 1]))).toBeCloseTo(32 - (1 - 0.0005) * (1 - 0.001), 6);
    expect(coplanarOverlaps(boxes, { faces })).toEqual([]);
    expect(coplanarOverlaps(boxes)).toHaveLength(1);
  });

  it('back-to-back faces are dropped where they touch (a wall standing on a floor)', () => {
    const boxes = [box([0, -0.5, 0], [8, 0, 8], 'floor'), box([0, 0, 0], [8, 4, 0.25], 'wall')];
    const faces = visibleFaces(boxes);
    expect(facesOf(faces, 1, [0, -1, 0])).toEqual([]);
    expect(total(facesOf(faces, 0, [0, 1, 0]))).toBeCloseTo(64 - 2 + 8 * 0.0005, 5);
  });

  it('floors over floors: a style pack piece (own material) wins over the theme floor, then the later box', () => {
    // (Pieces wholly inside the slab draw nothing, as before; these reach out past its edge.)
    const boxes = [box([0, -0.5, 0], [8, 0, 8], 'floor'), box([-1, -0.2, 2], [4, 0, 4], 'floor', { surface: { material: 'core.wood', tint: null } }), box([5, -0.2, 5], [9, 0, 6], 'floor')];
    const faces = visibleFaces(boxes);
    expect(total(facesOf(faces, 1, [0, 1, 0]))).toBeCloseTo(10, 6);
    expect(total(facesOf(faces, 2, [0, 1, 0]))).toBeCloseTo(4, 6);
    // Cuts stop 0.5 mm short wherever their edge crosses the slab's top (not along the slab's own edge).
    expect(total(facesOf(faces, 0, [0, 1, 0]))).toBeCloseTo(64 - (4 - 0.0005) * (2 - 0.001) - (3 - 0.0005) * (1 - 0.001), 6);
    expect(coplanarOverlaps(boxes, { faces })).toEqual([]);
  });

  it('turned boxes are clipped in their own frame, and a quarter turn more is the same frame', () => {
    const yaw = 0.3;
    // Two boxes at the same centre: 8 × 0.25 at `yaw`, and 0.25 × 8 at yaw + 90° (the same box), plus trim turned with them.
    const boxes = [box([-4, 0, -0.125], [4, 4, 0.125], 'wall', { yaw }), box([-0.125, 0, -4], [0.125, 4, 4], 'wall', { yaw: yaw + Math.PI / 2 }), box([-1, 1, 0.1], [1, 2, 0.15], 'trim', { yaw })];
    const faces = visibleFaces(boxes);
    expect(faces.filter((f) => f.box === 1)).toEqual([]);
    expect(coplanarOverlaps(boxes)).not.toEqual([]);
    expect(coplanarOverlaps(boxes, { faces })).toEqual([]);
    // Normals turned with the box; the flat normal is the box's own axis.
    for (const f of faces) expect(f.flatNormal.filter((v) => v !== 0)).toHaveLength(1);
    const q = boxQuat(yaw);
    const front = faces.find((f) => f.box === 0 && f.flatNormal[2] === 1)!;
    expect(front.normal[0]).toBeCloseTo(quatRotate(q, 0, 0, 1)[0], 9);
  });

  it('faces of differently turned boxes in the same plane: the outranked one is cut by the other as a polygon', () => {
    // A floor slab and a block turned 30° on it, tops level (blocks are floors: the later box wins).
    const boxes = [box([0, -0.5, 0], [8, 0, 8], 'floor'), box([2, -0.3, 2], [4, 0, 4], 'floor', { yaw: Math.PI / 6 })];
    expect(coplanarOverlaps(boxes)).toHaveLength(1);
    const faces = visibleFaces(boxes);
    expect(coplanarOverlaps(boxes, { faces })).toEqual([]);
    // The slab's top is cut into convex pieces round the block: 64 m² less the block's 4 m² (plus the seam).
    const slabTop = facesOf(faces, 0, [0, 1, 0]);
    expect(slabTop.length).toBeGreaterThan(1);
    const polyArea = (f: RenderFace) => Math.abs(f.corners.reduce((s, a, i) => { const b = f.corners[(i + 1) % f.corners.length]!; return s + a[0] * b[2] - b[0] * a[2]; }, 0) / 2);
    expect(slabTop.reduce((s, f) => s + polyArea(f), 0)).toBeCloseTo(60, 1);
    // Pieces keep the winding (front face up) and lie in the plane.
    const winding = (cs: readonly (readonly number[])[]) => Math.sign(cs.reduce((s, a, i) => { const b = cs[(i + 1) % cs.length]!; return s + a[0]! * b[2]! - b[0]! * a[2]!; }, 0));
    const up = winding(axisFaces([0, 0, 0], [1, 1, 1])[2]![0]);
    for (const f of slabTop) {
      expect(f.corners.every((c) => c[1] === 0)).toBe(true);
      expect(winding(f.corners)).toBe(up);
    }
    expect(total(facesOf(faces, 1, [0, 1, 0]))).toBeCloseTo(4, 6);
  });
});

/** Every face point that can be seen draws exactly once; points inside another box don't draw (sampled). */
function checkCoverage(boxes: readonly WorldBox[], faces: readonly RenderFace[], samples: number): void {
  const drawn = boxes.map((b, i) => ({ b, i })).filter(({ b }) => b.kind !== 'prop' && b.kind !== 'barrier');
  // Boxes hide each other only within a frame (the same turn, a quarter turn apart, or the same tilt).
  const sameFrame = (a: WorldBox, b: WorldBox) => {
    if (a.pitch || a.roll || b.pitch || b.roll) return (a.yaw ?? 0) === (b.yaw ?? 0) && (a.pitch ?? 0) === (b.pitch ?? 0) && (a.roll ?? 0) === (b.roll ?? 0);
    const d = (((a.yaw ?? 0) - (b.yaw ?? 0)) / (Math.PI / 2)) % 1;
    return Math.min(Math.abs(d), 1 - Math.abs(d)) < 1e-6;
  };
  const local = (b: WorldBox, p: readonly number[]) => {
    const c = [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2);
    const q = boxQuat(b.yaw, b.pitch, b.roll);
    const d = quatRotate({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, p[0]! - c[0]!, p[1]! - c[1]!, p[2]! - c[2]!);
    return d.map((v, k) => v + c[k]!);
  };
  // Distance outside the box (negative inside), in the box's own frame.
  const dist = (b: WorldBox, p: readonly number[]) => {
    const l = local(b, p);
    return Math.max(...[0, 1, 2].map((k) => Math.max(b.min[k]! - l[k]!, l[k]! - b.max[k]!)));
  };
  const byBox = new Map<number, RenderFace[]>();
  for (const f of faces) byBox.set(f.box, [...(byBox.get(f.box) ?? []), f]);
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  let seen = 0;
  for (let s = 0; s < samples; s++) {
    const { b, i } = drawn[Math.floor(rnd() * drawn.length)]!;
    const face = Math.floor(rnd() * 6);
    const axis = face >> 1;
    const l = [0, 1, 2].map((k) => (k === axis ? (face & 1 ? b.min[k]! : b.max[k]!) : b.min[k]! + (b.max[k]! - b.min[k]!) * rnd()));
    if ([0, 1, 2].some((k) => k !== axis && b.max[k]! - b.min[k]! < 0.01)) continue;
    // Back to world.
    const c = [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2);
    const w = quatRotate(boxQuat(b.yaw, b.pitch, b.roll), l[0]! - c[0]!, l[1]! - c[1]!, l[2]! - c[2]!).map((v, k) => v + c[k]!);
    const others = drawn.filter((o) => o.i !== i);
    const near = others.map((o) => dist(o.b, w));
    const hiders = others.filter((o) => sameFrame(o.b, b)).map((o) => dist(o.b, w));
    const covered = (byBox.get(i) ?? []).filter((f) => {
      const fl = f.flat;
      if (f.flatNormal[axis] !== (face & 1 ? -1 : 1)) return false;
      // Inside the (convex) piece, on the face's two in-plane axes.
      const [ua, va] = [0, 1, 2].filter((k) => k !== axis) as [number, number];
      const sides = fl.map((p, j) => {
        const q = fl[(j + 1) % fl.length]!;
        return (q[ua]! - p[ua]!) * (l[va]! - p[va]!) - (q[va]! - p[va]!) * (l[ua]! - p[ua]!);
      });
      return sides.every((x) => x >= -1e-9) || sides.every((x) => x <= 1e-9);
    }).length;
    if (near.every((d) => d > 0.01)) {
      seen++;
      expect(covered, `box ${i} (${b.kind} ${b.sourceId}) face ${face} at ${w.map((v) => v.toFixed(3))}: open to view, drawn ${covered} times`).toBe(1);
    } else if (hiders.some((d) => d < -0.01)) expect(covered, `box ${i} face ${face} at ${w.map((v) => v.toFixed(3))}: inside another box, drawn`).toBe(0);
  }
  expect(seen).toBeGreaterThan(samples / 10);
}

describe('visibleFaces on real maps', () => {
  // Plain tiles, turned (St John's stands at an angle), tilted roofs (Saltmarsh Harbor), the biggest map.
  // Norman Shores takes ~10 s alone and over 20 s on a busy CI runner: a generous timeout.
  it.each(['phase0_arena', 'st_johns', 'saltmarsh_harbor', 'norman_shores'])('%s: every open face point draws once, hidden ones not at all', { timeout: 90_000 }, (id) => {
    const boxes = drawnBoxes(id);
    checkCoverage(boxes, visibleFaces(boxes), 1500);
  });

  it('leaves the boxes as they were (collision and navigation never see this pass)', () => {
    const boxes = drawnBoxes('phase0_arena');
    const before = JSON.stringify(boxes);
    visibleFaces(boxes);
    expect(JSON.stringify(boxes)).toBe(before);
  });
});

// The audit: coplanar overlaps (two faces in the same plane, facing the same way, overlapping by more than a
// SLIVER both ways) in what every map draws. Goal zero, with no allow-list.
describe('z-fighting audit over maps/', () => {
  it.each(ids)('%s draws no coplanar overlaps', (id) => {
    const boxes = drawnBoxes(id);
    const faces = visibleFaces(boxes);
    const left = coplanarOverlaps(boxes, { faces });
    expect(
      left.slice(0, 5).map((o) => `${boxes[o.a]!.kind} ${boxes[o.a]!.sourceId} / ${boxes[o.b]!.kind} ${boxes[o.b]!.sourceId} at ${o.center.map((v) => v.toFixed(2))} (${o.area.toFixed(3)} m²)`),
      `${left.length} coplanar overlaps (thinner than ${SLIVER} m don't count)`,
    ).toEqual([]);
  });
});

// MapMaker's warning: a free block flush with another piece in a different look (one warning for the map).
describe('coplanar spots (MapMaker warning and Overlaps highlight)', () => {
  const block = (id: string, position: [number, number, number], size: [number, number, number], material: string | null): MapEntity => ({ id, kind: 'block', position, size, yaw: 0, material, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
  const withBlocks = (blocks: MapEntity[]) => {
    const map = makeMap([]);
    return { ...map, entities: [...map.entities, ...blocks] };
  };

  it('two blocks with level tops in different materials: one warning naming them, spots to highlight', () => {
    const map = withBlocks([block('b1', [0, 0, 0], [4, 1, 4], 'core.concrete'), block('b2', [2, 0, 0], [4, 1, 2], 'core.sandstone')]);
    const spots = coplanarSpots(map);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every((s) => s.ids.includes('b1') && s.ids.includes('b2'))).toBe(true);
    const issues = coplanarIssues(map, spots);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'warning', code: 'geometry.coplanar', targetId: 'b2' });
    expect(issues[0]!.message).toMatch(/b1 and b2/);
  });

  it('nothing to say when the faces look the same, or nothing lines up', () => {
    expect(coplanarIssues(withBlocks([block('b1', [0, 0, 0], [4, 1, 4], 'core.concrete'), block('b2', [2, 0, 0], [4, 1, 2], 'core.concrete')]))).toEqual([]);
    expect(coplanarIssues(withBlocks([block('b1', [0, 0, 0], [4, 1, 4], 'core.concrete'), block('b2', [2, 0.1, 0], [4, 1.2, 2], 'core.sandstone')]))).toEqual([]);
  });
});
