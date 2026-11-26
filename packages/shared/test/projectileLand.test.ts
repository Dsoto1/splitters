import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, PROJECTILE_VISUALS, initPhysics, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { getWeapon } from '../src/sim/weapons.ts';
import { makeMap } from './helpers.ts';

/**
 * A projectile with no blast of its own sends a `land` event where it lands (owner, 2026-11-25: the Blaster X-42's
 * bolts left no impact), so every client draws its impact; a blast sends `explode` as before and no `land`.
 */
beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

function yard(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 });
  return makeMap(tiles, [[4, 0, 4]]);
}

interface Internals {
  spawnProjectile(owner: number, spec: NonNullable<ReturnType<typeof getWeapon>['projectile']>, weapon: string, pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): void;
}

function ready(): { match: Match; me: Combatant } {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [1, 1], scoreLimit: 0 }, 3);
  const me = match.addHuman('me')!;
  for (let i = 0; i < 5; i++) match.step();
  return { match, me };
}

/** Fire `id`'s projectile straight down at the yard's floor from 3 m up, away from everyone; the events till it lands. */
function downward(id: string): GameEvent[] {
  const { match, me } = ready();
  const w = getWeapon(id);
  const spec = w.projectile ?? w.alt!.projectile!;
  (match as unknown as Internals).spawnProjectile(me.slot, spec, w.id, { x: me.move.pos.x + 6, y: me.move.pos.y + 3, z: me.move.pos.z + 6 }, { x: 0, y: -Math.max(20, spec.speed), z: 0 });
  const ev: GameEvent[] = [];
  for (let i = 0; i < 20; i++) ev.push(...match.step());
  return ev;
}

describe('a projectile with no blast lands with a `land` event', () => {
  it("the Blaster X-42's bolt: once, on the floor, with its look and weapon", () => {
    const lands = downward('core.blaster_x42').filter((e) => e.e === 'land');
    expect(lands).toHaveLength(1);
    const l = lands[0]!;
    if (l.e !== 'land') throw new Error('not a land');
    expect(PROJECTILE_VISUALS[l.v]).toBe('blasterBolt');
    expect(l.w).toBe('core.blaster_x42');
    expect(l.hit).toBeNull();
    expect(l.b).toBeUndefined();
    // On the floor (the yard's ground), from above it.
    expect(l.from[1]).toBeGreaterThan(l.to[1]);
  });

  it.each(['core.nailgun', 'core.crossbow', 'core.hornet', 'core.flak'])('%s lands with one too', (id) => {
    expect(downward(id).some((e) => e.e === 'land')).toBe(true);
  });

  it('a blast sends `explode` and no `land`', () => {
    const ev = downward('core.launcher');
    expect(ev.some((e) => e.e === 'explode')).toBe(true);
    expect(ev.some((e) => e.e === 'land')).toBe(false);
  });
});
