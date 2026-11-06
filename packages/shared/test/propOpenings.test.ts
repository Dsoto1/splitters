// Props whose collision filled their openings (owner's bug, 2026-11-06: rounds stopped in the air inside arches,
// windows and holes; puffs in the air beside trees): voxel collision (tools/content/voxel-collision.mjs), trunk columns
// on the real trunk, shell boxes of one height. fixtures/prop-openings.json lists every prop whose collision changed
// (tools/content/prop-openings.mjs --fixture <git ref before>), with straight lines through what its old collision
// filled and points of its model; then the same props in play: shots, walking, bots' paths and cover.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_PROPS, getProp } from '../src/content/props.ts';
import { PhysicsWorld, ScenarioBodies, buildMapGeometry, emptyInput, initPhysics, propBoxes, stepMovement, type MapDocument, type MapEntity, type MoveState, type Vec3 } from '../src/index.ts';
import { NavWorld, initNavigation } from '../src/match.ts';
import { findCover } from '../src/bots/cover.ts';
import { propMaterial } from '../src/sim/gunplay.ts';
import { makeMap, propManifest } from './helpers.ts';

type Box6 = readonly [number, number, number, number, number, number];
interface Changed {
  from: string;
  to: string;
  boxes: [number, number];
  before: Box6[];
  probes: [number, number, number, number, number, number, number][];
  solid: [number, number, number][];
}
const fixture = JSON.parse(readFileSync(new URL('./fixtures/prop-openings.json', import.meta.url), 'utf8')) as { changed: Record<string, Changed>; unchanged: Record<string, string> };

beforeAll(async () => {
  await Promise.all([initPhysics(), initNavigation()]);
});

/** A prop's collision as the game builds it (map/geometry.ts propBoxes), standing at the origin unturned. */
function boxesOf(id: string): Box6[] {
  const def = getProp(id)!;
  const map = makeMap([]);
  map.entities = [{ id: 'p', kind: 'prop', model: id, position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null }];
  return def.collision ? [...propBoxes(map), ...propBoxes(map, true)].map((b) => [b.min[0], b.min[1], b.min[2], b.max[0], b.max[1], b.max[2]] as const) : [];
}

/** Does the segment o + t·d (0 < t < len) pass through any of the boxes' insides? */
function blocks(boxes: readonly Box6[], o: readonly number[], d: readonly number[], len: number): boolean {
  return boxes.some((b) => {
    let t0 = 0;
    let t1 = len;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]!) < 1e-9) {
        if (o[k]! <= b[k]! || o[k]! >= b[k + 3]!) return false;
      } else {
        const a = (b[k]! - o[k]!) / d[k]!;
        const c = (b[k + 3]! - o[k]!) / d[k]!;
        t0 = Math.max(t0, Math.min(a, c));
        t1 = Math.min(t1, Math.max(a, c));
      }
    }
    return t0 < t1;
  });
}

const digest = (id: string) => {
  const def = getProp(id)!;
  return createHash('sha256').update(JSON.stringify({ collision: def.collision ?? null, boxes: def.boxes ?? null })).digest('hex').slice(0, 12);
};

describe('props whose collision filled their openings (fixture)', () => {
  const modes = new Map(propManifest().props.map((p) => [`prop.${p.id}`, (p.collide as string | undefined) ?? 'box']));

  it('lists every prop whose collision changed, and every voxel prop', () => {
    expect(Object.keys(fixture.changed).length).toBeGreaterThan(150);
    for (const [id, c] of Object.entries(fixture.changed)) {
      expect(getProp(id), id).toBeDefined();
      expect(modes.get(id), id).toBe(c.to);
    }
    const voxel = [...modes].filter(([, m]) => m === 'voxel').map(([id]) => id);
    expect(voxel.filter((id) => !fixture.changed[id]), 'voxel props missing from fixtures/prop-openings.json').toEqual([]);
    // The owner's screenshots: the ruins' arches, windows and holes, and the giant root on Fernwood Moon.
    for (const id of ['prop.rn_arch_round', 'prop.rn_arch_gothic', 'prop.rn_wall_hole', 'prop.rn_wall_broken', 'prop.rn_wall_arch_ivy', 'prop.dg_arch', 'prop.jg_giant_root']) expect(fixture.changed[id]?.to, id).toBe('voxel');
    // Trees whose column stood beside the trunk (Fernwood Moon's broadleaf trees and pines).
    for (const id of ['prop.nt_common_tree', 'prop.nt_birch', 'prop.nt_pine_tall', 'prop.nt_willow', 'prop.nc_streetlight', 'prop.flag']) expect(fixture.changed[id]?.to, id).toBe('trunk');
  });

  it("lets straight lines through what each one's old collision filled", () => {
    let n = 0;
    for (const [id, c] of Object.entries(fixture.changed)) {
      const now = boxesOf(id);
      for (const [ox, oy, oz, dx, dy, dz, len] of c.probes) {
        expect(blocks(c.before, [ox, oy, oz], [dx, dy, dz], len), `${id}: the old collision blocked ${ox}, ${oy}, ${oz}`).toBe(true);
        expect(blocks(now, [ox, oy, oz], [dx, dy, dz], len), `${id}: the line at ${ox}, ${oy}, ${oz} along ${dx}, ${dy}, ${dz} is open now`).toBe(false);
        n++;
      }
    }
    expect(n).toBeGreaterThan(300);
  });

  it('still collides with the solid parts of each model', () => {
    for (const [id, c] of Object.entries(fixture.changed)) {
      const now = boxesOf(id);
      for (const [x, y, z] of c.solid) {
        const held = now.some((b) => x >= b[0] - 0.03 && x <= b[3] + 0.03 && y >= b[1] - 0.03 && y <= b[4] + 0.03 && z >= b[2] - 0.03 && z <= b[5] + 0.03);
        expect(held, `${id}: its model at ${x}, ${y}, ${z} is inside its collision`).toBe(true);
      }
    }
  });

  it('leaves every other prop as it was', () => {
    const moved = Object.entries(fixture.unchanged).filter(([id, d]) => getProp(id) && digest(id) !== d).map(([id]) => id);
    expect(moved, 'collision changed: list it in fixtures/prop-openings.json (node tools/content/prop-openings.mjs --fixture <git ref before>)').toEqual([]);
    expect(Object.keys(fixture.unchanged).length + Object.keys(fixture.changed).length).toBeLessThanOrEqual(CORE_PROPS.length);
  });
});

/**
 * A room (8 m, walls at ±3.5 m) split across the middle (z = 0) by `prop` and two blocks either side of it, so the
 * only way from the south half to the north half is through the prop's opening.
 */
function splitRoom(model: string, opts: { scale?: number; half?: number } = {}): MapDocument {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, -2.5], [0, 0, 2.5]]);
  const half = opts.half ?? ((getProp(model)!.size[0] * (opts.scale ?? 1)) / 2 - 0.05);
  const block = (id: string, x0: number, x1: number): MapEntity => ({ id, kind: 'block', position: [(x0 + x1) / 2, 0, 0], size: [x1 - x0, 4, 0.6], yaw: 0, material: null, tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
  map.entities.push({ id: 'piece', kind: 'prop', model, position: [0, 0, 0], yaw: 0, scale: opts.scale ?? 1, solid: true, tint: null }, block('west', -3.6, -half), block('east', half, 3.6));
  return map;
}

/** Walk north (+z) for four seconds from `from`. */
function walkNorth(physics: PhysicsWorld, from: Vec3): MoveState {
  const collider = physics.createPlayerCollider();
  let s: MoveState = { pos: { ...from }, velY: 0, grounded: true };
  for (let i = 0; i < 240; i++) s = stepMovement(physics, collider, s, { ...emptyInput(i), forward: 1, yaw: 0 });
  physics.removeCollider(collider);
  return s;
}

describe('openings in play', () => {
  it('shots go through the round arch and still stop on its stone, of the same material', () => {
    const map = splitRoom('prop.rn_arch_round');
    const physics = new PhysicsWorld(buildMapGeometry(map));
    // Straight through the middle at chest height: nothing until the room's far wall (3.5 m on).
    const through = physics.raycastHit({ x: 0, y: 1.4, z: -3 }, { x: 0, y: 0, z: 1 }, 10);
    expect(through!.dist).toBeGreaterThan(6);
    // High in the opening, under the curve.
    expect(physics.raycastHit({ x: 0.6, y: 3.3, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!.dist).toBeGreaterThan(6);
    // Into a pillar: it stops on the stone's face (the arch is 0.7 m deep, round 0), and the stone is the arch.
    const def = getProp('prop.rn_arch_round')!;
    const pillar = physics.raycastHit({ x: def.size[0] / 2 - 0.3, y: 1.4, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!;
    expect(pillar.dist).toBeGreaterThan(3 - def.size[2] / 2 - 0.05);
    expect(pillar.dist).toBeLessThan(3 - def.size[2] / 2 + 0.25);
    const box = physics.boxAt(pillar.handle)!;
    expect(box.kind).toBe('prop');
    expect(box.sourceId).toBe('piece');
    // What a round hits is the prop's material (gunplay.ts propMaterial), whatever its boxes: unchanged.
    expect(propMaterial('prop.rn_arch_round')).toBe('concrete');
    // Penetration reads how thick the stone is (match.ts exitPoint): the pillar's depth, as it was.
    const start = { x: def.size[0] / 2 - 0.3, y: 1.4, z: 1.2 - def.size[2] / 2 + 0.01 };
    const back = physics.raycastHit(start, { x: 0, y: 0, z: -1 }, 1.2)!;
    expect(1.2 - back.dist).toBeGreaterThan(def.size[2] - 0.12);
  });

  it('shots go through the holed wall and the ivy arch wall, and the solid parts stop them', () => {
    for (const [model, hole] of [
      ['prop.rn_wall_hole', { x: -0.07, y: 2 }],
      ['prop.rn_wall_arch_ivy', { x: 0, y: 1.75 }],
      ['prop.rn_wall_broken', { x: -1.37, y: 3.0 }],
    ] as const) {
      const map = splitRoom(model);
      const physics = new PhysicsWorld(buildMapGeometry(map));
      expect(physics.raycastHit({ x: hole.x, y: hole.y, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!.dist, model).toBeGreaterThan(6);
      const wall = physics.raycastHit({ x: 1.7, y: 0.6, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!;
      expect(wall.dist, model).toBeLessThan(3.2);
      expect(physics.boxAt(wall.handle)?.sourceId, model).toBe('piece');
    }
  });

  it('players walk through the arches and doorways, and not through the walls', () => {
    for (const model of ['prop.rn_arch_round', 'prop.rn_arch_gothic', 'prop.dg_arch', 'prop.rn_wall_arch_ivy', 'prop.sf_doorway_a']) {
      const physics = new PhysicsWorld(buildMapGeometry(splitRoom(model)));
      const end = walkNorth(physics, { x: 0, y: 0, z: -2.5 });
      expect(end.pos.z, `${model}: through`).toBeGreaterThan(2);
    }
    // A plain wall in the same place stops them.
    const physics = new PhysicsWorld(buildMapGeometry(splitRoom('prop.rn_wall')));
    expect(walkNorth(physics, { x: 0, y: 0, z: -2.5 }).pos.z).toBeLessThan(0);
  });

  it("bots' navigation goes through the newly open passages", () => {
    for (const model of ['prop.rn_arch_round', 'prop.rn_arch_gothic', 'prop.dg_arch', 'prop.rn_wall_arch_ivy']) {
      const map = splitRoom(model);
      const nav = NavWorld.build([...buildMapGeometry(map), ...propBoxes(map, true)]);
      const path = nav.findPath({ x: 0, y: 0, z: -2.5 }, { x: 0, y: 0, z: 2.5 });
      expect(path, model).not.toBeNull();
      expect(path!.at(-1)!.z, model).toBeGreaterThan(2);
      nav.destroy();
    }
    const wall = splitRoom('prop.rn_wall');
    const nav = NavWorld.build([...buildMapGeometry(wall), ...propBoxes(wall, true)]);
    const blocked = nav.findPath({ x: 0, y: 0, z: -2.5 }, { x: 0, y: 0, z: 2.5 });
    expect(blocked === null || blocked.at(-1)!.z < 0).toBe(true);
    nav.destroy();
  });

  it('shots and crouching players go under the giant root at the size Fernwood Moon places it', () => {
    const map = splitRoom('prop.jg_giant_root', { scale: 1.6 });
    const physics = new PhysicsWorld(buildMapGeometry(map));
    expect(physics.raycastHit({ x: 0, y: 0.8, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!.dist).toBeGreaterThan(6);
    // Its ends are root: a shot low into one stops there.
    const end = getProp('prop.jg_giant_root')!.size[0] * 0.8 - 0.25;
    expect(physics.raycastHit({ x: end, y: 0.3, z: -3 }, { x: 0, y: 0, z: 1 }, 10)!.dist).toBeLessThan(3.2);
  });

  it('cover still works: the wall beside a hole hides a crouched bot, the hole does not', () => {
    const map = splitRoom('prop.rn_wall_hole');
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const threat = { x: 0, y: 1.6, z: 3 };
    // Crouched behind the solid part of the wall: hidden. In line with the hole: seen.
    expect(physics.lineOfSight({ x: 1.8, y: 0.92, z: -0.8 }, threat)).toBe(false);
    expect(physics.lineOfSight({ x: -0.1, y: 2, z: -0.8 }, { x: -0.1, y: 2, z: 3 })).toBe(true);
    const nav = NavWorld.build([...buildMapGeometry(map), ...propBoxes(map, true)]);
    let seed = 7;
    const spot = findCover({ physics, nav, from: { x: 0.5, y: 0, z: -2 }, threat, radius: 5, preferred: 4, rng: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });
    expect(spot).not.toBeNull();
    // Wherever it is, a crouched eye there is hidden from the threat.
    expect(physics.lineOfSight({ x: spot!.pos.x, y: spot!.pos.y + 0.92, z: spot!.pos.z }, threat)).toBe(false);
    nav.destroy();
  });

  it('trunk columns stand on the trunk: a shot beside a broadleaf tree passes, one at its trunk stops', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    map.entities.push({ id: 'tree', kind: 'prop', model: 'prop.nt_common_tree', position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null });
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const def = getProp('prop.nt_common_tree')!;
    const trunk = def.boxes![0]!;
    const tz = (trunk[2] + trunk[5]) / 2;
    // The old column stood in the footprint's middle (z = 0), half a metre off the trunk: rounds there pass now.
    expect(Math.abs(tz)).toBeGreaterThan(0.4);
    expect(physics.raycastHit({ x: -3, y: 1, z: 0.1 }, { x: 1, y: 0, z: 0 }, 6)?.dist ?? 99).toBeGreaterThan(5);
    const hit = physics.raycastHit({ x: -3, y: 1, z: tz }, { x: 1, y: 0, z: 0 }, 6)!;
    expect(hit.dist).toBeLessThan(3.1);
    expect(physics.boxAt(hit.handle)?.sourceId).toBe('tree');
  });

  it('breakable props with openings collide as their boxes (a tent you can see into), every box the tent', () => {
    const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    map.entities.push({ id: 'tent', kind: 'prop', model: 'prop.tent_canvas', position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null });
    const tent = map.entities.length - 1;
    const physics = new PhysicsWorld(buildMapGeometry(map));
    const bodies = new ScenarioBodies(physics, map);
    const def = getProp('prop.tent_canvas')!;
    expect(def.breakable).toBeDefined();
    expect(def.boxes!.length).toBeGreaterThan(1);
    // Each box collides, and is the tent (shots damage it wherever they land): down onto each box's top.
    for (const [x0, , z0, x1, y1, z1] of def.boxes!) {
      const hit = physics.raycastHit({ x: (x0 + x1) / 2, y: 3.9, z: (z0 + z1) / 2 }, { x: 0, y: -1, z: 0 }, 4);
      expect(hit, `box at ${x0}, ${z0}`).not.toBeNull();
      expect(bodies.entityAt(hit!.handle)).toBe(tent);
      expect(3.9 - hit!.dist).toBeGreaterThan(y1 - 0.02);
    }
    // The lines through the tent the fixture keeps open are open in play too: nothing of the tent's on them.
    for (const [ox, oy, oz, dx, dy, dz, len] of fixture.changed['prop.tent_canvas']!.probes) {
      const hit = physics.raycastHit({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz }, len);
      expect(hit === null || bodies.entityAt(hit.handle) !== tent).toBe(true);
    }
  });
});
