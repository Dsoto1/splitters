/**
 * Environment species in play (docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10 tests): the authoritative simulation's
 * colliders from map/environment.ts. Ballistic and non-ballistic hitscan and a projectile stop at an oak's trunk
 * (bark: heavy wood); a shot through the crown passes; a thick limb stops shots but not movement; boulders and
 * cliffs shoot as stone; the shrub conceals as bushes do; bots route round trunks, boulders and cliffs but not
 * grass; and the same map gives the same colliders on every path (host, browser host, client prediction).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BUTTON_FIRE,
  DEFAULT_DEATHMATCH_RULES,
  ENV_SPECIES,
  PLAYER,
  PhysicsWorld,
  SURFACE_TYPES,
  buildMapGeometry,
  envVariant,
  environmentNavTriangles,
  environmentShapes,
  environmentShapesHash,
  getEnvSpecies,
  getWeapon,
  initPhysics,
  loadMap,
  lookAngles,
  mapTerrainMesh,
  propBoxes,
  weaponCode,
  type MapDocument,
  type MapEntity,
  type MatchRules,
  type PlayerInput,
  type Vec3,
} from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

const rules: MatchRules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** A flat 6 × 5 cell platform (48 × 40 m) with the given props. */
function arena(props: Partial<MapEntity & { variant?: number }>[]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 6; x++) for (let y = -2; y <= 2; y++) tiles.push({ id: `p_${x}_${y}`, tile: 'core.platform', x, y, z: 0, rotation: 0 as const });
  const base = makeMap(tiles, [[0, 0, 0]]);
  const entities = props.map((p, i) => ({ id: `env_${i}`, kind: 'prop', position: [6, 0, 0], yaw: 0, scale: 1, solid: true, tint: null, ...p }) as unknown as MapEntity);
  return { ...base, entities: [...base.entities, ...entities] } as MapDocument;
}

/** Fire `weapon` from (0, eye, 0) at a target standing at x = `at`: the target's damage after the round lands. */
function shoot(map: MapDocument, weapon: string, at: number, aimY = 1.1, ticks = 6): number {
  const match = new Match(map, rules);
  const a = match.addHuman('a')!;
  const b = match.addHuman('b')!;
  a.move = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: true };
  b.move = { pos: { x: at, y: 0, z: 0 }, velY: 0, grounded: true };
  const def = getWeapon(weapon);
  a.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
  a.current = weaponCode(def);
  a.raiseTicks = 0;
  a.fireCooldown = 0;
  const eye = { x: 0, y: PLAYER.eyeHeight, z: 0 };
  let seq = 0;
  const input = (i: Partial<PlayerInput>) => match.queueInputs(a.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: a.yaw, pitch: a.pitch, buttons: 0, ...i }]);
  input({ ...lookAngles(eye, { x: at, y: aimY, z: 0 }), buttons: BUTTON_FIRE });
  match.step();
  for (let i = 0; i < ticks; i++) match.step();
  return 100 - b.health;
}

const physicsOf = (map: MapDocument) => new PhysicsWorld(buildMapGeometry(map), mapTerrainMesh(map), environmentShapes(map));
const dirTo = (a: Vec3, b: Vec3): [Vec3, number] => {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const l = Math.hypot(d.x, d.y, d.z);
  return [{ x: d.x / l, y: d.y / l, z: d.z / l }, l];
};

describe('environment collision', () => {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

  const oak = getEnvSpecies('env.broadleaf.oak')!;
  const oakShapes = envVariant(oak, 0).shapes;
  const trunk = oakShapes.find((s) => s.blocks === 'all' && s.kind === 'capsule')!;
  // The highest-reaching limb (its outer end well clear of the trunk).
  const limb = oakShapes.filter((s) => s.blocks === 'shots' && s.kind === 'capsule').sort((p, q) => (q.kind === 'capsule' ? q.b[1] : 0) - (p.kind === 'capsule' ? p.b[1] : 0))[0]!;
  // Place the oak so its trunk's base sits at x = 6 on the line of fire.
  const oakAt = (variant = 0) => arena([{ model: 'env.broadleaf.oak', position: [6 - (trunk.kind === 'capsule' ? trunk.a[0] : 0), 0, -(trunk.kind === 'capsule' ? trunk.a[2] : 0)], variant }]);

  it('the oak\'s trunk is bark: heavy wood, full cover', () => {
    expect(trunk.surface).toBe('bark');
    expect(SURFACE_TYPES.bark.ballistic).toBe('heavy_wood');
  });

  it('a ballistic round, a beam (non-ballistic hitscan) and a rocket all stop at the trunk; with nothing there each one lands', () => {
    const open = arena([]);
    expect(shoot(open, 'core.rifle', 10)).toBeGreaterThan(0);
    expect(shoot(oakAt(), 'core.rifle', 10)).toBe(0);
    expect(shoot(oakAt(1), 'core.rifle', 10)).toBe(0); // the autumn variant shares the shapes
    expect(shoot(open, 'core.laser_rifle', 10)).toBeGreaterThan(0);
    expect(shoot(oakAt(), 'core.laser_rifle', 10)).toBe(0);
    // The rocket bursts on the trunk, 10 m short of the target (its splash reaches 4.2 m).
    expect(shoot(arena([]), 'core.blast_rockets', 16, 1.1, 60)).toBeGreaterThan(0);
    expect(shoot(arena([{ model: 'env.broadleaf.oak', position: [6, 0, 0] }]), 'core.blast_rockets', 16, 1.1, 60)).toBe(0);
  });

  it('rays: hitscan and projectile queries stop at the trunk with its surface; a shot through the crown passes', () => {
    const map = arena([{ model: 'env.broadleaf.oak', position: [6, 0, 0] }]);
    const physics = physicsOf(map);
    expect(physics.environmentColliders).toBe(oakShapes.length);
    const from = { x: 0, y: 1.2, z: 0 };
    const [d, l] = dirTo(from, { x: 12, y: 1.2, z: 0 });
    const hit = physics.raycastHit(from, d, l);
    expect(hit).not.toBeNull();
    expect(hit!.dist).toBeGreaterThan(5);
    expect(hit!.dist).toBeLessThan(6.2);
    expect(physics.shapeAt(hit!.handle)).toEqual({ sourceId: 'env_0', surface: 'bark' });
    expect(physics.raycastNormal(from, d, l)?.handle).toBe(hit!.handle);
    expect(physics.lineOfSight(from, { x: 12, y: 1.2, z: 0 })).toBe(false);
    // High through the crown, above every limb shape: leaves never stop a round.
    const top = Math.max(...oakShapes.flatMap((s) => (s.kind === 'capsule' ? [s.a[1] + s.r, s.b[1] + s.r] : [])));
    const high = { x: 0, y: top + 0.6, z: 0 };
    const [dh, lh] = dirTo(high, { x: 12, y: top + 0.6, z: 0 });
    expect(top + 0.6).toBeLessThan(oak.variants[0]!.size[1]);
    expect(physics.raycastHit(high, dh, lh)).toBeNull();
    expect(physics.lineOfSight(high, { x: 12, y: top + 0.6, z: 0 })).toBe(true);
  });

  it('a thick limb stops shots and sight but never movement', () => {
    expect(limb).toBeDefined();
    if (limb.kind !== 'capsule') throw new Error('limb is a capsule');
    const map = arena([{ model: 'env.broadleaf.oak', position: [6, 0, 0] }]);
    const physics = physicsOf(map);
    // Out along the limb, clear of the trunk.
    const at = (k: number) => limb.a[k]! + (limb.b[k]! - limb.a[k]!) * 0.9;
    const mid = { x: 6 + at(0), y: at(1), z: at(2) };
    // From the side, level with the limb's middle, past the trunk.
    const from = { x: mid.x, y: mid.y, z: mid.z - 6 };
    const [d, l] = dirTo(from, mid);
    const hit = physics.raycastHit(from, d, l + 1);
    expect(hit, 'a shot at the limb').not.toBeNull();
    expect(physics.shapeAt(hit!.handle)?.surface).toBe('bark');
    expect(physics.lineOfSight(from, { x: mid.x, y: mid.y, z: mid.z + 3 })).toBe(false);
    // A body there: nothing in its way (limbs are not in movement's queries).
    expect(physics.headroom({ x: mid.x, y: mid.y - 0.45, z: mid.z }, 0.9, 0.3)).toBe(true);
    expect(physics.boxClear(mid, { x: 0.1, y: 0.1, z: 0.1 })).toBe(true);
  });

  it('boulders and cliffs are stone; a boulder stops a rifle at chest height', () => {
    expect(SURFACE_TYPES[getEnvSpecies('env.rock.boulder_angular')!.surface].ballistic).toBe('stone');
    expect(SURFACE_TYPES[getEnvSpecies('env.cliff.face')!.surface].ballistic).toBe('stone');
    expect(shoot(arena([{ model: 'env.rock.boulder_angular', position: [6, 0, 0] }]), 'core.rifle', 10, 0.9)).toBe(0);
    // A cliff turned across the line of fire.
    expect(shoot(arena([{ model: 'env.cliff.face', position: [6, 0, 0], yaw: Math.PI / 2 }]), 'core.rifle', 12)).toBe(0);
    const physics = physicsOf(arena([{ model: 'env.rock.boulder_angular', position: [6, 0, 0] }]));
    const [d] = dirTo({ x: 0, y: 0.6, z: 0 }, { x: 6, y: 0.6, z: 0 });
    expect(physics.shapeAt(physics.raycastHit({ x: 0, y: 0.6, z: 0 }, d, 10)!.handle)?.surface).toBe('rock');
  });

  it('a shrub conceals as a bush does (cylinder from its bounds), and stops nothing', () => {
    const shrub = getEnvSpecies('env.shrub.broadleaf')!;
    const map = arena([{ model: 'env.shrub.broadleaf', position: [6, 0, 0], scale: 1.2 }]);
    const match = new Match(map, rules);
    const hides = (match as unknown as { hides: { x: number; z: number; r: number; y0: number; y1: number }[] }).hides;
    const [w, h, d] = shrub.variants[0]!.size;
    // The bush rule: half the smaller footprint side, the full height, scaled with the placement.
    expect(hides).toEqual([{ x: 6, z: 0, r: (Math.min(w, d) / 2) * 1.2, y0: -0.3, y1: h * 1.2 }]);
    expect(shoot(map, 'core.rifle', 10)).toBeGreaterThan(0);
  });

  it('bots route round a trunk, a boulder and a cliff, and straight through grass and a shrub', () => {
    const from = { x: 8, y: 0, z: 0 };
    const to = { x: 32, y: 0, z: 0 };
    const route = (props: Partial<MapEntity & { variant?: number }>[]) => {
      const match = new Match(arena(props), rules);
      const a = match.nav.closestPoint(from)!;
      const b = match.nav.closestPoint(to)!;
      return match.nav.findPath(a, b)!;
    };
    // How close a route comes to the line x = 20 near z = 0 (where the obstacle stands): its z where it crosses.
    const crossing = (path: Vec3[]) => {
      for (let i = 0; i + 1 < path.length; i++) {
        const p = path[i]!;
        const q = path[i + 1]!;
        if ((p.x - 20) * (q.x - 20) <= 0 && p.x !== q.x) return Math.abs(p.z + ((q.z - p.z) * (20 - p.x)) / (q.x - p.x));
      }
      return 0;
    };
    expect(crossing(route([]))).toBeLessThan(0.3);
    expect(crossing(route([{ model: 'env.grass.clump', position: [20, 0, 0] }]))).toBeLessThan(0.3);
    expect(crossing(route([{ model: 'env.shrub.broadleaf', position: [20, 0, 0] }]))).toBeLessThan(0.3);
    expect(crossing(route([{ model: 'env.broadleaf.oak', position: [20, 0, 0] }]))).toBeGreaterThan(0.5);
    expect(crossing(route([{ model: 'env.conifer.pine_tall', position: [20, 0, 0] }]))).toBeGreaterThan(0.4);
    expect(crossing(route([{ model: 'env.rock.boulder_angular', position: [20, 0, 0] }]))).toBeGreaterThan(1);
    expect(crossing(route([{ model: 'env.cliff.face', position: [20, 0, 0], yaw: Math.PI / 2 }]))).toBeGreaterThan(4);
    // Nothing but the movement-blocking shapes of nav obstacles reaches navigation.
    const shapes = environmentShapes(arena(ENV_SPECIES.map((s, i) => ({ model: s.id, position: [8 + i * 6, 0, 0] }))));
    expect(shapes.filter((s) => s.nav).every((s) => s.blocks === 'all')).toBe(true);
    const at = (id: string) => `env_${ENV_SPECIES.findIndex((s) => s.id === id)}`;
    const soft = [at('env.grass.clump'), at('env.shrub.broadleaf'), at('env.shrub.laurel')];
    expect(environmentNavTriangles(shapes.filter((s) => soft.includes(s.sourceId)))).toBeNull();
    // Environment Phase 2: palms, the saguaro and the hedges are routed round; the laurel bush isn't.
    expect(crossing(route([{ model: 'env.shrub.laurel', position: [20, 0, 0] }]))).toBeLessThan(0.3);
    expect(crossing(route([{ model: 'env.palm.coconut', position: [20, 0, 0] }]))).toBeGreaterThan(0.4);
    expect(crossing(route([{ model: 'env.cactus.saguaro', position: [20, 0, 0] }]))).toBeGreaterThan(0.4);
    expect(crossing(route([{ model: 'env.hedge.privet', position: [20, 0, 0] }]))).toBeGreaterThan(2);
  });

  it('a non-solid placement and the legacy props are untouched: env props add no boxes, solid: false adds no shapes', () => {
    const map = arena([{ model: 'env.broadleaf.oak', position: [6, 0, 0], solid: false }, { model: 'env.rock.boulder_angular', position: [12, 0, 0] }]);
    expect(environmentShapes(map).map((s) => s.sourceId)).toEqual(['env_1']);
    expect(propBoxes(map)).toEqual([]);
  });

  it('the same map gives the same colliders on every path (loaded twice, as a host and as a client would)', () => {
    const doc = arena(ENV_SPECIES.map((s, i) => ({ model: s.id, position: [8 + i * 6, 0, i % 2 ? 3 : -3], yaw: i * 0.7, scale: 0.8 + i * 0.1, variant: i % 2 })));
    const json = JSON.stringify(doc);
    const host = loadMap(json);
    const client = loadMap(json);
    expect(host.ok && client.ok).toBe(true);
    if (!host.ok || !client.ok) return;
    const a = environmentShapes(host.map);
    const b = environmentShapes(client.map);
    expect(environmentShapesHash(a)).toBe(environmentShapesHash(b));
    expect(a).toEqual(b);
    // Rapier gets the same colliders from both.
    const pa = physicsOf(host.map);
    const pb = physicsOf(client.map);
    const dump = (p: PhysicsWorld) => {
      const out: string[] = [];
      p.world.forEachCollider((c) => {
        const t = c.translation();
        const r = c.rotation();
        out.push([c.shape.type, t.x, t.y, t.z, r.x, r.y, r.z, r.w].map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(','));
      });
      return out.sort();
    };
    expect(dump(pa)).toEqual(dump(pb));
    expect(pa.environmentColliders).toBe(a.length);
    // A turned placement turns its shapes like its model (yaw like a mesh's rotation.y: local +Z goes to (sin, cos)).
    const turned = environmentShapes(arena([{ model: 'env.rock.boulder_angular', position: [10, 0, 0], yaw: Math.PI / 2 }]))[0]!;
    const local = envVariant(getEnvSpecies('env.rock.boulder_angular')!, 0).shapes[0]!;
    if (turned.kind !== 'hull' || local.kind !== 'hull') throw new Error('hulls');
    expect(turned.points[0]).toBeCloseTo(10 + local.points[0]![2], 5);
    expect(turned.points[2]).toBeCloseTo(-local.points[0]![0], 5);
  });
});
