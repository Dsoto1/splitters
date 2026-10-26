import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_BOT_PROFILES,
  PhysicsWorld,
  TICK_RATE,
  applyPortals,
  blockBoxes,
  buildMapGeometry,
  initPhysics,
  mapPortals,
  mapTerrainMesh,
  navLinks,
  newScenarioEntities,
  portalSegment,
  portalCarry,
  propBoxes,
  validateMap,
  type MapDocument,
  type MapEntity,
  type MoveState,
} from '../src/index.ts';
import { Match, NavWorld, initNavigation, validateNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';
import { act, codes, loaded, rule, start } from './kit20.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const W = -Math.PI / 2;
const E = Math.PI / 2;
const portal = (id: string, pair: string, position: [number, number, number], yaw: number, extra: Partial<Extract<MapEntity, { kind: 'portal' }>> = {}): Extract<MapEntity, { kind: 'portal' }> => ({ id, kind: 'portal', position, yaw, size: [2.4, 3.2], pair, startEnabled: true, ...extra });

/**
 * Two closed rooms 8 m apart (a solid cell between them), joined only by a
 * portal pair: one against the first room's east wall facing west, the other
 * against the second room's west wall facing east.
 */
function rooms(entities: MapEntity[] = [], spawns: [number, number, number][] = [[-2, 0, 0], [18, 0, 0]]): MapDocument {
  const map = makeMap(
    [
      { id: 'room_a', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 },
      { id: 'room_b', tile: 'core.room', x: 2, y: 0, z: 0, rotation: 0 },
    ],
    spawns,
  );
  map.entities.push(portal('portal_a', 'a', [3.6, 0, 0], W), portal('portal_b', 'a', [12.4, 0, 0], E), ...entities);
  return map;
}

describe('portals', () => {
  it('turns position and velocity by the difference in facings, keeping speed', () => {
    // A faces +Z at the origin; B faces +X 20 m away. Flying into A (moving -Z) comes out of B moving +X.
    const portals = mapPortals([portal('pa', 'p', [0, 0, 0], 0), portal('pb', 'p', [20, 2, 0], E)]);
    expect(portals.map((p) => p.link)).toEqual([1, 0]);
    const before: MoveState = { pos: { x: 0.5, y: 0.5, z: 1 }, velY: 1.5, grounded: false, vx: 0, vz: -6 };
    const after: MoveState = { ...before, pos: { x: 0.5, y: 0.6, z: 0.4 } };
    const through = applyPortals(portals, before, after)!;
    expect(through).not.toBeNull();
    // Facing +Z, then +X: a quarter turn the other way (yaw +π/2 plus the half turn).
    expect(Math.cos(through.turn)).toBeCloseTo(0, 6);
    expect(Math.sin(through.turn)).toBeCloseTo(-1, 6);
    const s = through.state;
    expect(s.vx!).toBeCloseTo(6, 2);
    expect(s.vz!).toBeCloseTo(0, 2);
    expect(Math.hypot(s.vx!, s.vz!)).toBeCloseTo(6, 2);
    expect(s.velY).toBe(1.5);
    // Out in front of B, at the same height above it, mirrored across.
    expect(s.pos.x).toBeGreaterThan(20.6);
    expect(s.pos.y).toBeCloseTo(2.6, 2);
    expect(Math.abs(s.pos.z)).toBeCloseTo(0.5, 2);
    // A yaw looking into A (-Z, yaw π) looks out of B (+X, yaw π/2).
    const yaw = Math.PI + through.turn;
    expect(Math.sin(yaw)).toBeCloseTo(1, 6);
    // Moving away from a portal, beside it, behind it or above its top: nothing.
    expect(applyPortals(portals, after, before)).toBeNull();
    expect(applyPortals(portals, { ...before, pos: { x: 3, y: 0, z: 1 } }, { ...after, pos: { x: 3, y: 0, z: 0.4 } })).toBeNull();
    expect(applyPortals(portals, { ...before, pos: { x: 0, y: 0, z: -1 } }, { ...after, pos: { x: 0, y: 0, z: -0.4 } })).toBeNull();
    expect(applyPortals(portals, { ...before, pos: { x: 0, y: 3, z: 1 } }, { ...after, pos: { x: 0, y: 3, z: 0.4 } })).toBeNull();
    // Switched off: nothing.
    expect(applyPortals(portals, before, after, () => false)).toBeNull();
  });

  it('a player walking into a portal comes out of the other room, facing out of it', () => {
    const d = start(rooms());
    d.place(1, 0, 0, E);
    d.run(TICK_RATE * 2, { forward: 1, yaw: E });
    expect(d.me.move.pos.x).toBeGreaterThan(12.5);
    // The server turned the body: walking east into a west-facing portal, then out of an east-facing one, keeps going east.
    expect(Math.sin(d.me.yaw)).toBeCloseTo(1, 3);
  });

  it('projectiles go through and keep their speed', () => {
    const portals = mapPortals([portal('pa', 'p', [0, 0, 0], 0), portal('pb', 'p', [20, 0, 0], E)]);
    const gate = portalSegment(portals, { x: 0, y: 1.5, z: 1 }, { x: 0, y: 1.5, z: -1 })!;
    expect(gate.t).toBeGreaterThan(0.4);
    const out = portalCarry(gate.a, gate.b, { x: 0, y: 1.5, z: 0 }, { x: 0, y: -1, z: -60 });
    expect(out.vel.x).toBeCloseTo(60, 3);
    expect(out.vel.y).toBe(-1);
    expect(out.pos.x).toBeGreaterThan(20);
  });

  it('logic switches a portal off and on, and a pair works only while both are on', () => {
    const map = rooms([{ id: 'button_off', kind: 'button', position: [-3, 0, -3], yaw: 0, label: 'Shut', once: false, cooldownSeconds: 0.5, startEnabled: true }]);
    map.logic.rules.push(rule({ when: { event: 'button_pressed', target: 'button_off' }, do: [act('disable', { target: 'portal_b' })] }));
    const d = start(map);
    const scenario = d.match.scenario;
    const ia = d.match.map.entities.findIndex((e) => e.id === 'portal_a');
    expect(scenario.portalOn(ia)).toBe(true);
    expect(scenario.isEnabled('portal_b')).toBe(true);
    // Press the button, then walk into portal A: it no longer leads anywhere.
    d.place(-3, 0, -2.2, Math.PI);
    d.run(3, { buttons: 16, yaw: Math.PI, pitch: -0.5 });
    expect(scenario.isEnabled('portal_b')).toBe(false);
    expect(scenario.portalViews().every((v) => !v.on)).toBe(true);
    d.place(1, 0, 0, E);
    d.run(TICK_RATE * 2, { forward: 1, yaw: E });
    expect(d.me.move.pos.x).toBeLessThan(4);
    // Replicated: the portal's state goes out in the scenario snapshot.
    const ib = d.match.map.entities.findIndex((e) => e.id === 'portal_b');
    expect(scenario.fullState().es!.find(([i]) => i === ib)).toEqual([ib, 0, 0]);
  });

  it('bots path through a portal pair (a navmesh link each way) and take it', () => {
    const doc = loaded(rooms([{ id: 'gun_1', kind: 'pickup', position: [18, 0, 2], item: 'core.weapon_shotgun', respawnSeconds: null }]));
    const geometry = buildMapGeometry(doc);
    const physics = new PhysicsWorld(geometry, mapTerrainMesh(doc));
    const walls = [...geometry, ...propBoxes(doc, true), ...blockBoxes(doc, true)];
    const withLinks = NavWorld.build(walls, mapTerrainMesh(doc), navLinks(doc.entities, physics));
    const without = NavWorld.build(walls, mapTerrainMesh(doc), []);
    expect(without.findPath({ x: -2, y: 0, z: 0 }, { x: 18, y: 0, z: 2 })).toBeNull();
    expect(withLinks.findPath({ x: -2, y: 0, z: 0 }, { x: 18, y: 0, z: 2 })).not.toBeNull();
    expect(withLinks.findPath({ x: 18, y: 0, z: 2 }, { x: -2, y: 0, z: 0 })).not.toBeNull();
    expect(validateNavigation(doc, withLinks).map((i) => i.code)).toEqual([]);
    withLinks.destroy();
    without.destroy();
    physics.free();
    // A bot in the first room goes for the gun in the second, through the portals.
    const match = new Match(doc, undefined, 7);
    const bot = match.addBot('b', { ...CORE_BOT_PROFILES[0]!, exploration: 100 })!;
    bot.move = { pos: { x: -2, y: 0, z: 1 }, velY: 0, grounded: true };
    let maxX = -Infinity;
    for (let t = 0; t < TICK_RATE * 20 && maxX < 13; t++) {
      match.step();
      if (bot.alive) maxX = Math.max(maxX, bot.move.pos.x);
    }
    expect(maxX).toBeGreaterThan(13);
  });

  it('the Portal Pair tool places two linked portals that validate, and the validator checks pairs', () => {
    const base = makeMap([{ id: 'room_a', tile: 'core.room_large', x: 0, y: 0, z: 0, rotation: 0 }]);
    const placed = newScenarioEntities('portal', [0, 0, -2], 0, base);
    expect(placed).toHaveLength(2);
    const [a, b] = placed as Extract<MapEntity, { kind: 'portal' }>[];
    expect(a!.pair).toBe(b!.pair);
    expect(Math.abs(Math.cos(a!.yaw - b!.yaw) + 1)).toBeLessThan(1e-9);
    const ok = { ...base, entities: [...base.entities, ...placed] };
    expect(codes(validateMap(ok)).filter((c) => c.startsWith('portal'))).toEqual([]);
    // A lone portal, a crowded pair, and one that starts off with nothing to switch it on.
    expect(codes(validateMap({ ...base, entities: [...base.entities, a!] }))).toContain('portal.unpaired');
    expect(validateMap({ ...ok, entities: [...ok.entities, { ...b!, id: 'portal_x', position: [6, 0, 6] }] }).map((i) => i.code)).toContain('portal.pair_crowded');
    expect(codes(validateMap({ ...ok, entities: [...base.entities, a!, { ...b!, startEnabled: false }] }))).toContain('portal.never_opens');
  });
});
