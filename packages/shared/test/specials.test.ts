import { beforeAll, describe, expect, it } from 'vitest';
import { BUTTON_FIRE, BUTTON_THROW, DEFAULT_DEATHMATCH_RULES, getWeapon, initPhysics, weaponCode, type GameEvent, type ThrowableKind } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const rules = { ...DEFAULT_DEATHMATCH_RULES, respawnDelayTicks: 100_000 };
/** A 40 × 16 m walled yard. */
const yard = () => {
  const tiles = [];
  for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4]]);
};
type Proj = { spec: { visual: string }; pos: { x: number; y: number; z: number }; walking?: boolean };
const projectiles = (m: Match) => (m as unknown as { projectiles: Proj[] }).projectiles;

function setup(kind?: ThrowableKind) {
  const match = new Match(yard(), rules);
  const me = match.addHuman('me')!;
  for (let i = 0; i < 3; i++) match.step();
  me.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
  if (kind) me.throwable = { kind, count: 1 };
  let seq = 0;
  const input = (c: Combatant, yaw: number, pitch: number, buttons = 0) => match.queueInputs(c.slot, [{ seq: ++seq, forward: 0, right: 0, yaw, pitch, buttons }]);
  return { match, me, input };
}

describe('Worms-style specials and the guided rocket', () => {
  it('a cluster bomb bursts into bomblets', () => {
    const { match, me, input } = setup('cluster');
    input(me, Math.PI / 2, 0.3, BUTTON_THROW);
    let most = 0;
    for (let t = 0; t < 200; t++) {
      match.step();
      most = Math.max(most, projectiles(match).filter((p) => p.spec.visual === 'bomblet').length);
    }
    expect(most).toBe(6);
  });

  it('an airstrike flare calls in a line of bombs from above', () => {
    const { match, me, input } = setup('airstrike');
    input(me, Math.PI / 2, 0.2, BUTTON_THROW);
    const events: GameEvent[] = [];
    let bombs = 0;
    for (let t = 0; t < 400; t++) {
      events.push(...match.step());
      bombs = Math.max(bombs, projectiles(match).filter((p) => p.spec.visual === 'bomb').length);
    }
    expect(bombs).toBe(5);
    expect(events.filter((e) => e.e === 'explode').length).toBeGreaterThanOrEqual(5);
  });

  it('a sheep lands, walks off along the ground, then goes off', () => {
    const { match, me, input } = setup('sheep');
    input(me, Math.PI / 2, 0.2, BUTTON_THROW);
    let walked = 0;
    let startX: number | null = null;
    const events: GameEvent[] = [];
    for (let t = 0; t < 600; t++) {
      events.push(...match.step());
      const s = projectiles(match).find((p) => p.spec.visual === 'sheep');
      if (s?.walking) {
        startX ??= s.pos.x;
        walked = Math.max(walked, s.pos.x - startX);
      }
    }
    expect(walked).toBeGreaterThan(3);
    expect(events.some((e) => e.e === 'explode')).toBe(true);
  });

  it('a guided rocket follows the crosshair', () => {
    const { match, me, input } = setup();
    const def = getWeapon('core.guided');
    me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: 0 });
    me.current = weaponCode(def);
    me.raiseTicks = 0;
    // Fire east down the yard, then aim across it (north): the rocket turns to follow.
    input(me, Math.PI / 2, 0, BUTTON_FIRE);
    match.step();
    let seen = false;
    let north = 0;
    for (let t = 0; t < 40; t++) {
      input(me, 0.25, 0);
      match.step();
      const r = projectiles(match).find((p) => p.spec.visual === 'rocket');
      if (r) {
        seen = true;
        north = Math.max(north, r.pos.z);
      }
    }
    expect(seen).toBe(true);
    expect(north).toBeGreaterThan(5); // swung north of the line it was fired along (z = 4)
  });
});
