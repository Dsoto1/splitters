// Voxel collision (collide "voxel"), trunk columns (collide "trunk") and the openings audit (tools/content/voxel-collision.mjs)
// on models built here from boxes: openings stay open, the solid stays covered, the result is the same every time.
import { describe, expect, it } from 'vitest';
import { filledOpenings, trunkBoxes, voxelBoxes, voxelCollision, voxelise } from '../voxel-collision.mjs';

/** A closed box's 12 triangles (`bottom: false` leaves out its floor, as a wall standing on the ground often does). */
function box(x0, y0, z0, x1, y1, z1, { bottom = true } = {}) {
  const v = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [
    [0, 2, 6, 4],
    [1, 5, 7, 3],
    [2, 3, 7, 6],
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    ...(bottom ? [[0, 4, 5, 1]] : []),
  ];
  return quads.flatMap(([a, b, c, d]) => [
    [v(a), v(b), v(c)],
    [v(a), v(c), v(d)],
  ]);
}

const inside = (boxes, [x, y, z], e = 1e-6) => boxes.some((b) => x > b[0] + e && x < b[3] - e && y > b[1] + e && y < b[4] - e && z > b[2] + e && z < b[5] - e);
const near = (boxes, [x, y, z], e) => boxes.some((b) => x >= b[0] - e && x <= b[3] + e && y >= b[1] - e && y <= b[4] + e && z >= b[2] - e && z <= b[5] + e);

/** An archway 4 m wide and 4 m tall: two 0.8 m pillars and a 1 m lintel, 0.6 m deep (the opening 2.4 × 3 m). */
const archway = () => [...box(-2, 0, -0.3, -1.2, 4, 0.3, { bottom: false }), ...box(1.2, 0, -0.3, 2, 4, 0.3, { bottom: false }), ...box(-1.2, 3, -0.3, 1.2, 4, 0.3)];

describe('voxel collision', () => {
  it('keeps an archway open and its pillars and lintel solid', () => {
    const boxes = voxelBoxes(archway());
    // The opening: nothing, from the floor to just under the lintel, across its whole width.
    for (const x of [-1.1, 0, 1.1]) for (const y of [0.05, 1.5, 2.9]) expect(inside(boxes, [x, y, 0]), `${x}, ${y}`).toBe(false);
    // The pillars and the lintel, through and through (a wall with no floor face is solid inside).
    for (const p of [[-1.6, 2, 0], [1.6, 0.1, 0.25], [0, 3.5, 0], [0, 3.95, -0.25], [-1.25, 3.05, 0]]) expect(inside(boxes, p), p.join(', ')).toBe(true);
    // Faces on the model: nothing reaches more than 2 cm past it.
    for (const b of boxes) {
      expect(b[0]).toBeGreaterThanOrEqual(-2.02);
      expect(b[3]).toBeLessThanOrEqual(2.02);
      expect(b[2]).toBeGreaterThanOrEqual(-0.32);
      expect(b[5]).toBeLessThanOrEqual(0.32);
      expect(b[4]).toBeLessThanOrEqual(4.02);
      // Over the opening, nothing comes down past the lintel's underside.
      if (b[0] > -1.15 && b[3] < 1.15) expect(b[1]).toBeGreaterThanOrEqual(2.98);
    }
    expect(boxes.length).toBeLessThanOrEqual(6);
  });

  it('is the same every time, whatever order the triangles come in', () => {
    const tris = archway();
    const shuffled = [...tris].reverse().map((t) => [t[1], t[2], t[0]]);
    expect(voxelBoxes(shuffled)).toEqual(voxelBoxes(tris));
    expect(voxelBoxes(tris)).toEqual(voxelBoxes(tris));
  });

  it('leaves the space under a table open and gives a single plane a thickness', () => {
    const legs = [-0.7, 0.6].flatMap((x) => [-0.4, 0.3].flatMap((z) => box(x, 0, z, x + 0.1, 0.72, z + 0.1)));
    const table = [...legs, ...box(-0.75, 0.72, -0.45, 0.75, 0.76, 0.45)];
    const boxes = voxelBoxes(table);
    expect(inside(boxes, [0, 0.35, 0])).toBe(false);
    expect(inside(boxes, [0, 0.74, 0])).toBe(true);
    expect(inside(boxes, [-0.65, 0.3, -0.35])).toBe(true);
    // A kit wall with one face (no thickness of its own) stands minThickness thick round it.
    const plane = [
      [[-1, 0, 0], [1, 0, 0], [1, 2, 0]],
      [[-1, 0, 0], [1, 2, 0], [-1, 2, 0]],
    ];
    const wall = voxelBoxes(plane, { minThickness: 0.2 });
    expect(wall.length).toBe(1);
    expect(wall[0][5] - wall[0][2]).toBeCloseTo(0.2, 3);
    expect(inside(wall, [0, 1, 0])).toBe(true);
  });

  it('never fills a niche you can see into, only hidden pockets and the relief next to the model', () => {
    // A block with a 1 m niche cut into its front (open toward -z): a big merge budget still leaves the niche open.
    const block = [...box(-1.5, 0, 0, 1.5, 3, 1.5), ...box(-1.5, 0, -1, -0.5, 3, 0), ...box(0.5, 0, -1, 1.5, 3, 0), ...box(-0.5, 2, -1, 0.5, 3, 0)];
    const boxes = voxelBoxes(block, { air: 10 });
    expect(inside(boxes, [0, 1, -0.5])).toBe(false);
    expect(inside(boxes, [0, 1, 0.5])).toBe(true);
  });

  it('keeps to its box budget, coarsening the cubes, and leaves the openings open', () => {
    // A lattice of thin posts with gaps a 0.5 m square fits in.
    const lattice = [];
    for (let i = 0; i < 6; i++) lattice.push(...box(-3 + i, 0, -0.05, -2.9 + i, 3, 0.05));
    lattice.push(...box(-3, 2.9, -0.05, 2.1, 3, 0.05));
    const fit = voxelCollision(lattice, { budget: 10 });
    expect(fit.boxes.length).toBeLessThanOrEqual(10);
    expect(fit.openings).toEqual([]);
    expect(filledOpenings(lattice, fit.boxes)).toEqual([]);
  });

  it('marks what a closed model holds as solid and what reaches outside as open', () => {
    const g = voxelise([...box(0, 0, 0, 1, 1, 1), ...box(2, 0, 0, 3, 1, 1)], 0.25);
    const at = (x, y, z) => g.solid[(Math.floor((y - g.y0) / g.cell) * g.nz + Math.floor((z - g.z0) / g.cell)) * g.nx + Math.floor((x - g.x0) / g.cell)];
    expect(at(0.5, 0.5, 0.5)).toBe(1);
    expect(at(1.5, 0.5, 0.5)).toBe(0);
  });
});

describe('openings audit', () => {
  it('finds the opening a box fills and none that voxel collision fills', () => {
    const tris = archway();
    const filled = filledOpenings(tris, [[-2, 0, -0.3, 2, 4, 0.3]]);
    expect(filled.length).toBe(1);
    expect(filled[0].axis).toBe('z');
    expect(filled[0].size[0]).toBeCloseTo(2.4, 1);
    expect(filled[0].size[1]).toBeCloseTo(3, 1);
    expect(filledOpenings(tris, voxelBoxes(tris))).toEqual([]);
  });

  it('tells slack round the outline from an opening', () => {
    // An L: a post and an arm over to one side. Its box holds air under the arm, open to the side: slack, no opening.
    const ell = [...box(-1, 0, -0.1, -0.8, 3, 0.1), ...box(-0.8, 2.6, -0.1, 1, 3, 0.1)];
    const bounds = [[-1, 0, -0.1, 1, 3, 0.1]];
    expect(filledOpenings(ell, bounds)).toEqual([]);
    const loose = filledOpenings(ell, bounds, { slack: true });
    expect(loose.length).toBe(1);
    expect(loose[0].slack).toBe(true);
  });
});

describe('trunk columns', () => {
  /** A 0.3 m trunk standing at (x, z), 4 m tall, under a crown 3 m across off to one side. */
  const tree = (x, z) => [...box(x - 0.15, 0, z - 0.15, x + 0.15, 4, z + 0.15), ...box(x - 0.5, 3.5, z - 0.5, x + 2.5, 5.5, z + 1.5)];

  it('stand on the trunk, not in the middle of the footprint, and keep to its thickness', () => {
    // Centred on its footprint (3 × 2 m) as the build does: the trunk ends up 1 m off the middle in x, 0.5 m in z.
    const boxes = trunkBoxes(tree(-1, -0.5), [3, 5.5, 2]);
    expect(boxes).not.toBeNull();
    const base = boxes[0];
    expect((base[0] + base[3]) / 2).toBeCloseTo(-1, 2);
    expect((base[2] + base[5]) / 2).toBeCloseTo(-0.5, 2);
    // As thick as the trunk with its margin (0.3 + 2 × 0.03), never the plain 0.5 m.
    expect(base[3] - base[0]).toBeCloseTo(0.36, 2);
    expect(base[1]).toBe(0);
    // Up through the crown that closes round it, no further.
    expect(Math.max(...boxes.map((b) => b[4]))).toBeLessThanOrEqual(5.5);
    expect(Math.max(...boxes.map((b) => b[4]))).toBeGreaterThanOrEqual(4);
  });

  it('keep the plain column when the trunk is in the middle and as thick as the column', () => {
    const tris = box(-0.25, 0, -0.25, 0.25, 6, 0.25);
    expect(trunkBoxes(tris, [0.5, 6, 0.5])).toBeNull();
  });
});
