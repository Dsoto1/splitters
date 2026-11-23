// Building trim you can stand against (owner, 2026-11-19, St. John's: "same with some of the building trim"). A Style
// Pack facade's pieces were all drawn-only trim, so players walked through the Collegiate buttresses and plinths; the
// ones that stand at least FACADE_COVER_PROUD out past the cladding and FACADE_COVER_HEIGHT tall now collide (map/
// geometry.ts packFacadeBoxes), as collision only (never drawn twice). Thin dressing and the cladding stay walk-through,
// but what stands over the roofline (a parapet's coping, merlons, pinnacles) collides too, proud or not.
import { beforeAll, describe, expect, it } from 'vitest';
import { FACADE_COVER_HEIGHT, FACADE_COVER_PROUD, PhysicsWorld, buildMapDecor, buildMapGeometry, initPhysics, isDrawnBox, type Facade, type MapDocument, type Vec3 } from '../src/index.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => initPhysics());

const room = (facade: Facade): MapDocument => makeMap([{ id: 'hall', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0, options: { facade, ceiling: 'roof' } }], [[0, 0, 0]]);
const cover = (map: MapDocument) => buildMapGeometry(map).filter((b) => b.kind === 'prop' && b.sourceId === 'hall');

/** From 12 m out on each side toward the wall, at `u` along it and height `y`: how far the ray goes. */
function reach(physics: PhysicsWorld, side: number, u: number, y: number): number {
  const [ox, oz, dx, dz, ux, uz] = ([[0, -12, 0, 1, 1, 0], [12, 0, -1, 0, 0, 1], [0, 12, 0, -1, -1, 0], [-12, 0, 1, 0, 0, -1]] as const)[side]!;
  const from: Vec3 = { x: ox + ux * u, y, z: oz + uz * u };
  return physics.raycastWorld(from, { x: dx, y: 0, z: dz }, 20) ?? 20;
}

describe('facade trim deep enough to stand against collides', () => {
  it('Collegiate stone: the buttresses and the plinth stop rounds and bodies on every side; the cladding does not', () => {
    const map = room('collegiate_stone');
    const physics = new PhysicsWorld(buildMapGeometry(map), null);
    for (let side = 0; side < 4; side++) {
      const wall = reach(physics, side, 0, 1.2);
      // A buttress at each end of the wall, 0.55 m proud of the 0.14 m cladding: 0.69 m before the wall.
      for (const u of [-3.55, 3.55]) expect(wall - reach(physics, side, u, 1.2), `side ${side} buttress at ${u}`).toBeCloseTo(0.69, 2);
      // The plinth (0.6 m tall, 0.1 m proud of the cladding).
      expect(wall - reach(physics, side, 0, 0.3), `side ${side} plinth`).toBeCloseTo(0.24, 2);
    }
  });

  it('only deep, tall pieces below the roofline collide: collision only, the same boxes the decor draws', () => {
    for (const facade of ['collegiate_stone', 'collegiate_red', 'gothic_stone', 'roman', 'egyptian', 'temple', 'manor_brick', 'clapboard', 'adobe'] as const) {
      const map = room(facade);
      const boxes = cover(map);
      const decor = buildMapDecor(map);
      const key = (b: { min: number[]; max: number[] }) => [...b.min, ...b.max].map((v) => v.toFixed(4)).join(',');
      const drawn = new Set(decor.map(key));
      for (const b of boxes) {
        expect(isDrawnBox(b), facade).toBe(false);
        expect(b.surface, facade).toBeDefined();
        expect(drawn.has(key(b)), `${facade}: a drawn piece`).toBe(true);
        expect(b.max[1] - b.min[1], facade).toBeGreaterThanOrEqual(FACADE_COVER_HEIGHT - 1e-6);
        // Under the roofline, or a roofline piece (starts within a hand of the top and ends over it).
        const roofline = b.max[1] > 4 + 1e-6;
        if (roofline) expect(b.min[1], `${facade}: roofline piece`).toBeGreaterThanOrEqual(4 - 0.12 - 1e-6);
        // Proud of the room's 8 m square by more than the cladding (0.08-0.16 m) and the proud margin.
        const out = Math.max(-4 - b.min[0], b.max[0] - 4, -4 - b.min[2], b.max[2] - 4);
        if (!roofline) expect(out, facade).toBeGreaterThanOrEqual(FACADE_COVER_PROUD + 0.08 - 1e-6);
      }
      if ((['collegiate_stone', 'collegiate_red', 'gothic_stone', 'roman', 'temple'] as readonly Facade[]).includes(facade)) expect(boxes.length, facade).toBeGreaterThan(0);
      // Clapboard's corner boards (4 cm), adobe's cladding: nothing to stand against below the roofline (adobe's stepped parapet is above it).
      if (facade === 'clapboard' || facade === 'adobe') expect(boxes.filter((b) => b.max[1] <= 4 + 1e-6), facade).toHaveLength(0);
    }
  });

  it('Collegiate stone: the parapet stops rounds and a prone body on the roof edge, but not through a gap between merlons', () => {
    const map = room('collegiate_stone');
    const boxes = buildMapGeometry(map);
    const physics = new PhysicsWorld(boxes, null);
    // Merlons: over the coping (4.0-4.3 m), 4.3-4.75 m, 0.6 m wide every 1.2 m along the wall.
    const merlons = buildMapDecor(map).filter((b) => b.kind === 'trim' && Math.abs(b.min[1] - 4.3) < 1e-3 && Math.abs(b.max[1] - 4.75) < 1e-3 && b.min[2] < -3.5 && b.max[0] - b.min[0] < 0.7);
    expect(merlons.length).toBeGreaterThan(2);
    const m = merlons[0]!;
    const xm = (m.min[0] + m.max[0]) / 2;
    const xg = (m.max[0] + merlons.map((b) => b.min[0]).filter((x) => x > m.max[0]).sort((a, b) => a - b)[0]!) / 2;
    const dist = (x: number, y: number, fromInside: boolean) => physics.raycastWorld({ x, y, z: fromInside ? 0 : -12 }, { x: 0, y: 0, z: fromInside ? -1 : 1 }, 20);
    // Prone eye height over the roof (4 m): a merlon is hit from both sides, a gap is not (the wall below stops at the roof).
    expect(dist(xm, 4.42, false), 'from outside').not.toBeNull();
    expect(dist(xm, 4.42, true), 'from inside').not.toBeNull();
    expect(dist(xg, 4.42, false), 'gap').toBeNull();
    // A prone player (0.8 m sphere) walking out over the wall top is stopped by the merlon and by the coping's step.
    const c = physics.createPlayerCollider();
    let pos = { x: xm, y: 4, z: -2 };
    for (let i = 0; i < 60; i++) pos = physics.moveCharacter(c, pos, { x: 0, y: -0.05, z: -0.1 }, 0.8, 0.4).feet;
    expect(pos.z, 'prone, stopped by the merlon').toBeGreaterThan(-4.1);
  });
});
