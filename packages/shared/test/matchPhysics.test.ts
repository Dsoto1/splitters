import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_JUMP, DEFAULT_DEATHMATCH_RULES, DEFAULT_RULES, initPhysics } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
const room = () => makeMap([{ id: 'room', tile: 'core.yard', x: 0, y: 0, z: 0, rotation: 0 }], [[4, 0, 4]]);

function jumpApex(gravity: number | undefined, mapGravity?: number): number {
  const map = room();
  if (mapGravity) map.physics = { gravity: mapGravity, fallDamage: false };
  const match = new Match(map, { ...DEFAULT_DEATHMATCH_RULES, ...(gravity ? { gravity } : {}) });
  const me = match.addHuman('me')!;
  let seq = 0;
  for (let i = 0; i < 30; i++) {
    match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
    match.step();
  }
  const ground = me.move.pos.y;
  let top = 0;
  for (let t = 0; t < 120; t++) {
    match.queueInputs(me.slot, [{ seq: ++seq, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: t === 0 ? BUTTON_JUMP : 0 }]);
    match.step();
    top = Math.max(top, me.move.pos.y - ground);
  }
  return top;
}

describe('match physics settings', () => {
  it('gravity: low jumps higher, heavy lower; the map sets it, the match overrides', () => {
    const normal = jumpApex(undefined);
    expect(jumpApex(0.5)).toBeGreaterThan(normal * 1.6);
    expect(jumpApex(2)).toBeLessThan(normal * 0.7);
    expect(jumpApex(undefined, 0.5)).toBeGreaterThan(normal * 1.6);
    expect(jumpApex(1, 0.5)).toBeCloseTo(normal, 2);
  });

  it('fall damage: off by default; on, a long drop hurts and a short one does not', () => {
    const drop = (fallDamage: boolean | undefined, height: number) => {
      const match = new Match(room(), { ...DEFAULT_DEATHMATCH_RULES, ...(fallDamage !== undefined ? { fallDamage } : {}) });
      const me = match.addHuman('me')!;
      for (let i = 0; i < 30; i++) match.step();
      me.move = { pos: { x: 1.2, y: height, z: 1.2 }, velY: 0, grounded: false };
      for (let i = 0; i < 150; i++) {
        match.queueInputs(me.slot, [{ seq: i + 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0 }]);
        match.step();
      }
      return me.alive ? me.health : 0;
    };
    expect(drop(undefined, 12)).toBe(100);
    expect(drop(true, 3)).toBe(100);
    expect(drop(true, 10)).toBeLessThan(70);
    expect(drop(true, 20)).toBe(0);
  });

  it('friendly fire: off by default; half and full hurt teammates; a team kill earns nothing and never costs a kill', () => {
    for (const ff of [undefined, 'half', 'on'] as const) {
      const match = new Match(room(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2], ...(ff ? { friendlyFire: ff } : {}) });
      const a = match.addHuman('a')!;
      const others = [0, 1, 2].map((i) => match.addHuman(`p${i}`)!);
      const mate = others.find((o) => o.faction === a.faction)!;
      for (let i = 0; i < 5; i++) match.step();
      const hurt = (match as unknown as { damage: (v: Combatant, n: number, k: Combatant, w: string) => void }).damage.bind(match);
      hurt(mate, 40, a, 'core.rifle');
      expect(mate.health).toBe(ff === undefined ? 100 : ff === 'half' ? 80 : 60);
      if (ff === 'on') {
        hurt(mate, 100, a, 'core.rifle');
        expect(mate.alive).toBe(false);
        expect(a.kills).toBe(0);
      }
    }
  });
});
