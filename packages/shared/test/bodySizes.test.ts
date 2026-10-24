import { beforeAll, describe, expect, it } from 'vitest';
import { BODY_SIZES, DEFAULT_DEATHMATCH_RULES, PhysicsWorld, bodySizeOf, buildMapGeometry, decodeLook, emptyInput, encodeLook, getLook, initPhysics, stepMovement, type MoveState } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const room = () => makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]);

describe('character sizes', () => {
  it('custom looks carry their size in the ID; standard IDs are unchanged', () => {
    const base = getLook('core.ranger');
    const small = encodeLook({ ...base, size: 'small' });
    expect(small.endsWith('-s')).toBe(true);
    expect(decodeLook(small)?.size).toBe('small');
    expect(encodeLook(base).endsWith('-s')).toBe(false);
    expect(bodySizeOf('core.bulwark')).toBe('large');
    expect(bodySizeOf('core.sprout')).toBe('small');
    expect(bodySizeOf('core.ranger')).toBe('standard');
  });

  it('a small character walks under a 1.6 m ceiling that stops a standard one', () => {
    // A low slab over the north half of the room, 1.6 m up.
    const physics = new PhysicsWorld([...buildMapGeometry(room()), { min: [-4, 1.6, 1], max: [4, 2, 4], kind: 'floor', sourceId: 'slab' }]);
    const walk = (scale: number) => {
      const c = physics.createPlayerCollider();
      let s: MoveState = { pos: { x: 0.3, y: 0, z: -2 }, velY: 0, grounded: true };
      for (let t = 0; t < 120; t++) s = stepMovement(physics, c, s, { ...emptyInput(t), forward: 1 }, 1, undefined, 1, { scale });
      physics.removeCollider(c);
      return s.pos.z;
    };
    expect(walk(1)).toBeLessThan(1);
    expect(walk(BODY_SIZES.small.scale)).toBeGreaterThan(2.5);
  });

  it('large characters have more health and move slower; the match setting can make everyone standard', () => {
    const on = new Match(room(), DEFAULT_DEATHMATCH_RULES);
    const big = on.addHuman('big', 'core.bulwark')!;
    const small = on.addHuman('small', 'core.sprout')!;
    expect(big.maxHealth).toBe(BODY_SIZES.large.health);
    expect(big.speedMul).toBeLessThan(1);
    expect(small.size).toBe(BODY_SIZES.small.scale);
    expect(small.maxHealth).toBe(BODY_SIZES.small.health);
    const off = new Match(room(), { ...DEFAULT_DEATHMATCH_RULES, bodySizes: false });
    const same = off.addHuman('big', 'core.bulwark')!;
    expect(same.size).toBe(1);
    expect(same.maxHealth).toBe(100);
  });
});
