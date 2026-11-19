// Out of the play area (Atomic Court, 2026-11-19: one player crawled out under the perimeter fence, then half his
// team spawned beside him out there and couldn't get back in): a see-through edge with nothing built beyond it stops
// every body, squad spawns refuse a teammate outside the play area, and nobody stays outside it.
import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_CROUCH, BUTTON_PRONE, DEFAULT_RULES, buildMapGeometry, initPhysics, loadMap, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, OUT_OF_BOUNDS, initNavigation, type Combatant } from '../src/match.ts';
import { TICK_RATE } from '../src/sim/constants.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/**
 * Atomic Court in small: a 24 × 24 m yard (cells 0..2: x and z from -4 to 20) fenced all round on flat terrain, its
 * boundary 4 m outside the fence (the ground between is walkable navmesh nothing routes back from), unless `bounds`.
 */
const fencedYard = (bounds?: MapDocument['bounds']): MapDocument => {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 3; y++) {
      const edges: Record<string, 'fence'> = {};
      if (x === 0) edges['0,0,0:W'] = 'fence';
      if (x === 2) edges['0,0,0:E'] = 'fence';
      if (y === 0) edges['0,0,0:S'] = 'fence';
      if (y === 2) edges['0,0,0:N'] = 'fence';
      tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0, edges });
    }
  const doc = makeMap(tiles, [[0, 0, 0], [16, 0, 16], [16, 0, 0], [0, 0, 16]]);
  const n = 25;
  doc.terrain = { origin: [-24, -24], spacing: 3, cols: n, rows: n, baseY: 0, heights: new Array(n * n).fill(0), materials: new Array((n - 1) * (n - 1)).fill(0), boundary: true, foliage: [] } as unknown as MapDocument['terrain'];
  doc.bounds = bounds ?? { min: [-8, -8], max: [24, 24], style: 'invisible', height: 8 };
  const loaded = loadMap(JSON.stringify(doc));
  if (!loaded.ok) throw new Error(loaded.issues.map((i) => i.message).join('; '));
  return loaded.map;
};
const put = (c: Combatant, x: number, z: number) => (c.move = { pos: { x, y: 0.05, z }, velY: 0, grounded: true });
/** Inside the fence line (x and z from -4 to 20). */
const inside = (p: { x: number; z: number }) => p.x > -4 && p.x < 20 && p.z > -4 && p.z < 20;

describe('a see-through edge with nothing beyond it', () => {
  it('gets a body-only box along it (shots and sight pass), and an inner fence does not', () => {
    const map = fencedYard();
    // A fence inside the yard too (between two of its cells): nothing to close there.
    map.classicStructure.tiles.find((t) => t.id === 'y0_0')!.edges = { '0,0,0:W': 'fence', '0,0,0:S': 'fence', '0,0,0:E': 'fence' };
    const boxes = buildMapGeometry(map);
    const shut = boxes.filter((b) => b.bodyOnly);
    // 3 cells a side, 4 sides; not the inner one.
    expect(shut).toHaveLength(12);
    expect(shut.some((b) => b.min[0] > 3 && b.max[0] < 5)).toBe(false);
    expect(shut.every((b) => b.kind === 'barrier' && b.max[1] - b.min[1] >= 2.9)).toBe(true);
  });

  it('nobody crawls, crouches or walks out between its posts, whatever their size', () => {
    const match = new Match(fencedYard(), DEFAULT_RULES['core.deathmatch']);
    const me = match.addHuman('me')!;
    for (let i = 0; i < 5; i++) match.step();
    let seq = 1;
    // A tiny roulette roll on a small look (0.65 × 0.78), a small look, a standard one.
    for (const size of [0.5, 0.78, 1]) {
      me.size = size;
      for (const buttons of [BUTTON_PRONE, BUTTON_CROUCH, 0]) {
        for (const [x, z, yaw] of [[-3, 6.5, -Math.PI / 2], [19, 9.5, Math.PI / 2], [3.5, -3, Math.PI], [11.5, 19, 0]] as const) {
          put(me, x, z);
          me.outsideTicks = 0;
          for (let i = 0; i < 150; i++) {
            match.queueInputs(me.slot, [{ seq: seq++, forward: 1, right: 0, yaw, pitch: 0, buttons }]);
            match.step();
          }
          expect(inside(me.move.pos), `${size} ${buttons} from (${x}, ${z}) got to (${me.move.pos.x.toFixed(2)}, ${me.move.pos.z.toFixed(2)})`).toBe(true);
        }
      }
    }
    // Shots and sight still pass between its slats.
    const physics = (match as unknown as { physics: { lineOfSight: (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => boolean } }).physics;
    expect(physics.lineOfSight({ x: -2, y: 1, z: 6.5 }, { x: -7, y: 1, z: 6.5 })).toBe(true);
    match.destroy();
  });
});

describe('outside the play area', () => {
  it('the ground behind the fence is not in play', () => {
    const match = new Match(fencedYard(), DEFAULT_RULES['core.deathmatch']);
    expect(match.inPlay({ x: 8, y: 0, z: 8 })).toBe(true);
    expect(match.inPlay({ x: -7, y: 0, z: 8 })).toBe(false);
    match.destroy();
  });

  it('a squad never spawns beside a teammate outside it', () => {
    const match = new Match(fencedYard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 1], respawnDelayTicks: 1 });
    const a = match.addHuman('a')!;
    const b = match.addHuman('b')!;
    const c = match.addHuman('c')!;
    const foe = match.addHuman('foe')!;
    for (let i = 0; i < 5; i++) match.step();
    const mates = [a, b, c].filter((x) => x.faction === a.faction);
    expect(mates.length).toBeGreaterThanOrEqual(2);
    const [out, other] = mates as [Combatant, Combatant];
    const beside = (m: Combatant) => (match as unknown as { besideMate: (m: Combatant) => { pos: { x: number; z: number } } | null }).besideMate(m);
    // Inside: a spot beside them. Outside: none.
    put(out, 8, 8);
    expect(beside(out)).not.toBeNull();
    put(out, -7, 8);
    expect(beside(out)).toBeNull();
    // Over many respawns (squad spawn is a 70% draw each), the teammate is never put out there.
    for (let k = 0; k < 20; k++) {
      put(out, -7, 8);
      out.outsideTicks = 0;
      (match as unknown as { kill: (v: Combatant, k: Combatant | null, w: string) => void }).kill(other, foe.faction === other.faction ? null : foe, 'core.rifle');
      for (let i = 0; i < 10 && !other.alive; i++) match.step();
      expect(other.alive).toBe(true);
      expect(inside(other.move.pos), `respawned at (${other.move.pos.x.toFixed(1)}, ${other.move.pos.z.toFixed(1)})`).toBe(true);
    }
    match.destroy();
  });

  it('someone outside it is told, calmly, then put back inside as they are (no death)', () => {
    const match = new Match(fencedYard(), DEFAULT_RULES['core.deathmatch']);
    const me = match.addHuman('me')!;
    for (let i = 0; i < 5; i++) match.step();
    me.health = 60;
    put(me, -7, 8);
    const events: GameEvent[] = [];
    for (let i = 0; i < (OUT_OF_BOUNDS.back + 1) * TICK_RATE; i++) {
      // Standing still out there (grounded).
      events.push(...match.step());
    }
    const msgs = events.filter((e): e is Extract<GameEvent, { e: 'msg' }> => e.e === 'msg' && e.s === me.slot).map((e) => e.text);
    expect(msgs[0]).toMatch(/Outside the play area/);
    expect(msgs).toContain('Returned to the play area');
    expect(events.some((e) => e.e === 'kill' && e.victim === me.slot)).toBe(false);
    expect(me.alive).toBe(true);
    expect(me.health).toBe(60);
    expect(inside(me.move.pos)).toBe(true);
    expect(match.inPlay(me.move.pos)).toBe(true);
    match.destroy();
  });

  it("a spawn on an island of its own doesn't make the rest of the map outside (MapMaker's blank starter: one room on open terrain)", () => {
    const doc = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);
    const n = 49;
    doc.terrain = { origin: [-48, -48], spacing: 2, cols: n, rows: n, baseY: -0.15, heights: new Array(n * n).fill(0), materials: new Array((n - 1) * (n - 1)).fill(0), boundary: true, foliage: [] } as unknown as MapDocument['terrain'];
    const loaded = loadMap(JSON.stringify(doc));
    if (!loaded.ok) throw new Error('starter');
    const match = new Match(loaded.map, DEFAULT_RULES['core.deathmatch']);
    const me = match.addHuman('me')!;
    for (let i = 0; i < 5; i++) match.step();
    expect(match.inPlay({ x: 24, y: -0.15, z: -10 })).toBe(true);
    put(me, 24, -10);
    const events: GameEvent[] = [];
    for (let i = 0; i < (OUT_OF_BOUNDS.back + 1) * TICK_RATE; i++) events.push(...match.step());
    expect(events.some((e) => e.e === 'msg' && e.s === me.slot)).toBe(false);
    expect(Math.hypot(me.move.pos.x - 24, me.move.pos.z + 10)).toBeLessThan(0.5);
    match.destroy();
  });

  it('past the map boundary counts as outside too, and inside play nobody is moved', () => {
    const match = new Match(fencedYard({ min: [-4, -4], max: [20, 20], style: 'invisible', height: 8 }), DEFAULT_RULES['core.deathmatch']);
    const me = match.addHuman('me')!;
    for (let i = 0; i < 5; i++) match.step();
    expect(match.inPlay({ x: -6, y: 0, z: 8 })).toBe(false);
    put(me, 8, 8);
    const events: GameEvent[] = [];
    for (let i = 0; i < (OUT_OF_BOUNDS.back + 1) * TICK_RATE; i++) events.push(...match.step());
    expect(events.some((e) => e.e === 'msg' && e.s === me.slot)).toBe(false);
    expect(Math.hypot(me.move.pos.x - 8, me.move.pos.z - 8)).toBeLessThan(0.5);
    match.destroy();
  });
});
