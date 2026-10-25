import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, DEFAULT_DEATHMATCH_RULES, JET, MAP_BUDGETS, PLAYER, TICK_RATE, buildMapGeometry, initPhysics, validateMap, type MapDocument, type MapEntity, type PlayerInput } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };

/** An open yard 40 × 32 m (x -4..36, z -4..28) with walls round it, plus the given entities. */
function yard(extra: MapEntity[]): MapDocument {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 0]]);
  return { ...map, entities: [...map.entities, ...extra] };
}

const block = (id: string, behaviour: 'solid' | 'crumble' | 'trapdoor' | 'breakable', at: [number, number, number], over: Partial<Extract<MapEntity, { kind: 'block' }>> = {}): MapEntity => ({
  id,
  kind: 'block',
  position: at,
  yaw: 0,
  size: [4, 0.5, 4],
  material: null,
  tint: null,
  behaviour,
  trigger: 'step',
  delaySeconds: 0.5,
  respawnSeconds: 3,
  health: 50,
  ...over,
});

class Driver {
  seq = new Map<number, number>();
  constructor(readonly match: Match) {}
  input(c: Combatant, i: Partial<PlayerInput>): void {
    const seq = (this.seq.get(c.slot) ?? 0) + 1;
    this.seq.set(c.slot, seq);
    this.match.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw: c.yaw, pitch: c.pitch, buttons: 0, ...i }]);
  }
  run(n: number, each: () => void = () => {}): void {
    for (let i = 0; i < n; i++) {
      each();
      this.match.step();
    }
  }
}

const place = (c: Combatant, x: number, y: number, z: number) => (c.move = { pos: { x, y, z }, velY: 0, grounded: false });
const blockAlive = (m: Match, id: string) => m.scenario.destructibleAlive(id);

describe('sky blocks and platforms that give way', () => {
  it('a solid sky block is level geometry you can stand on, at any height', () => {
    const map = yard([block('sky_1', 'solid', [12, 6, 12], { material: 'core.pbr_concrete' })]);
    expect(validateMap(map).filter((i) => i.severity === 'error')).toEqual([]);
    const box = buildMapGeometry(map).find((b) => b.sourceId === 'sky_1');
    expect(box?.surface?.material).toBe('core.pbr_concrete');
    const match = new Match(map, rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 12, 7, 12);
    d.run(60, () => d.input(a, {}));
    expect(a.move.pos.y).toBeCloseTo(6.5, 1);
  });

  it('a crumbling floor gives way after you stand on it, then comes back', () => {
    const match = new Match(yard([block('crumble_1', 'crumble', [12, 3, 12])]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 12, 3.6, 12);
    d.run(Math.round(0.3 * TICK_RATE), () => d.input(a, {}));
    expect(blockAlive(match, 'crumble_1')).toBe(true);
    expect(a.move.pos.y).toBeGreaterThan(3.3);
    d.run(Math.round(0.6 * TICK_RATE), () => d.input(a, {}));
    expect(blockAlive(match, 'crumble_1')).toBe(false);
    d.run(Math.round(1.2 * TICK_RATE), () => d.input(a, {}));
    expect(a.move.pos.y).toBeLessThan(0.5);
    // It comes back once nobody is in the way.
    place(a, 30, 0, 24);
    d.run(Math.round(3.2 * TICK_RATE), () => d.input(a, {}));
    expect(blockAlive(match, 'crumble_1')).toBe(true);
  });

  it('a logic-only trapdoor ignores people standing on it; a breakable block can be shot apart but a crumbling one cannot', () => {
    const map = yard([block('trap_door_1', 'trapdoor', [12, 3, 12], { trigger: 'logic' }), block('break_1', 'breakable', [24, 0, 12], { size: [2, 2, 2], health: 40 }), block('crumble_2', 'crumble', [24, 0, 20], { size: [2, 2, 2] })]);
    const match = new Match(map, rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 12, 3.6, 12);
    d.run(TICK_RATE, () => d.input(a, {}));
    expect(blockAlive(match, 'trap_door_1')).toBe(true);
    const sc = match.scenario as unknown as { destructibles: Map<number, { id: string }>; damageDestructible(d: unknown, n: number, ex: boolean, by: null): void };
    const find = (id: string) => [...sc.destructibles.values()].find((x) => x.id === id)!;
    sc.damageDestructible(find('break_1'), 100, false, null);
    sc.damageDestructible(find('crumble_2'), 1000, true, null);
    expect(blockAlive(match, 'break_1')).toBe(false);
    expect(blockAlive(match, 'crumble_2')).toBe(true);
  });
});

describe('water, lava and swimming', () => {
  const pool = (liquid: 'water' | 'lava' | 'swamp'): MapEntity => ({ id: `pool_${liquid}`, kind: 'water', position: [16, 0, 12], size: [12, 3, 12], liquid });

  it('in deep water you sink slowly and holding jump swims you up and out', () => {
    const match = new Match(yard([pool('water')]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 16, 1.2, 12);
    d.run(20, () => d.input(a, {}));
    expect(a.move.swim).toBe(true);
    // Sinking is gentle (falling in air would have dropped you to the floor by now).
    expect(a.move.pos.y).toBeGreaterThan(0.5);
    const before = a.move.pos.y;
    d.run(40, () => d.input(a, { buttons: BUTTON_JUMP }));
    expect(a.move.pos.y).toBeGreaterThan(before + 0.8);
  });

  it('lava hurts while you stand in it; swamp slows you down', () => {
    const lava = new Match(yard([pool('lava')]), rules);
    const d = new Driver(lava);
    const a = lava.addHuman('a')!;
    d.run(2);
    place(a, 16, 0, 12);
    d.run(TICK_RATE, () => d.input(a, {}));
    expect(a.health).toBeLessThan(PLAYER.maxHealth - 30);

    const swamp = new Match(yard([pool('swamp')]), rules);
    const s = new Driver(swamp);
    const b = swamp.addHuman('b')!;
    s.run(2);
    place(b, 12, 0, 12);
    const x0 = b.move.pos.x;
    s.run(30, () => s.input(b, { forward: 1, yaw: Math.PI / 2 }));
    const swampRun = b.move.pos.x - x0;
    place(b, 2, 0, 24);
    s.run(30, () => s.input(b, { forward: 1, yaw: Math.PI / 2 }));
    expect(swampRun).toBeLessThan((b.move.pos.x - 2) * 0.8);
  });
});

describe('jetpack', () => {
  it('a jetpack pickup lets you fly while jump is held; fuel runs out and recharges', () => {
    const match = new Match(yard([{ id: 'jet_pickup', kind: 'pickup', position: [8, 0, 8], item: 'core.jetpack', respawnSeconds: null }]), rules);
    const d = new Driver(match);
    const a = match.addHuman('a')!;
    d.run(2);
    place(a, 8, 0, 8);
    d.run(5, () => d.input(a, {}));
    expect(a.jetFuel).toBe(JET.max);
    let top = 0;
    d.run(Math.round(2 * TICK_RATE), () => {
      d.input(a, { buttons: BUTTON_JUMP });
      top = Math.max(top, a.move.pos.y);
    });
    // A plain jump peaks near 1.2 m; two seconds of thrust go far higher.
    expect(top).toBeGreaterThan(5);
    expect(a.jetFuel!).toBeLessThan(JET.max);
    d.run(Math.round(5 * TICK_RATE), () => d.input(a, { buttons: BUTTON_JUMP }));
    expect(a.jetFuel!).toBeLessThanOrEqual(JET.burn);
    d.run(Math.round(3 * TICK_RATE), () => d.input(a, {}));
    expect(a.jetFuel!).toBeGreaterThan(JET.max / 2);
  });
});

describe('map budgets', () => {
  it('warns (but still loads) when a map goes over a budget', () => {
    const many: MapEntity[] = Array.from({ length: MAP_BUDGETS.dynamicBlocks + 1 }, (_, i) => block(`crumble_${i}`, 'crumble', [i % 30, 0, Math.floor(i / 30) * 4]));
    const issues = validateMap(yard(many));
    expect(issues.some((i) => i.code === 'budget.dynamic_blocks' && i.severity === 'warning')).toBe(true);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(validateMap(yard([])).some((i) => i.code.startsWith('budget.'))).toBe(false);
  });
});
