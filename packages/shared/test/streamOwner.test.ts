import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, PROJECTILE_VISUALS, initPhysics, type MapDocument } from '../src/index.ts';
import { Match, initNavigation, type Combatant } from '../src/match.ts';
import { getWeapon } from '../src/sim/weapons.ts';
import { makeMap } from './helpers.ts';

/**
 * A stream's shots name their shooter in the snapshot (shared STREAM_VISUALS), so clients draw them leaving the
 * shooter's muzzle (client game/streamBlend.ts); other projectiles stay as they were on the wire.
 */
beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

function yard(): MapDocument {
  const tiles: MapDocument['classicStructure']['tiles'] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 });
  return makeMap(tiles, [[4, 0, 4]]);
}

interface Internals {
  fireNow(shooter: Combatant, def: ReturnType<typeof getWeapon>, viewTick: number): void;
  spawnProjectile(owner: number, spec: NonNullable<ReturnType<typeof getWeapon>['projectile']>, weapon: string, pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): void;
}

function ready(): { match: Match; me: Combatant } {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [1, 1], scoreLimit: 0 }, 3);
  const me = match.addHuman('me')!;
  for (let i = 0; i < 5; i++) match.step();
  return { match, me };
}

describe('stream projectiles in the snapshot', () => {
  it('carry the shooter for the flamethrower, not for a grenade a projectile spawns', () => {
    const { match, me } = ready();
    (match as unknown as Internals).fireNow(me, { ...getWeapon('core.flamethrower'), alt: undefined }, 0);
    const launcher = getWeapon('core.launcher');
    (match as unknown as Internals).spawnProjectile(me.slot, launcher.projectile!, launcher.id, { x: 4, y: 2, z: 4 }, { x: 1, y: 0, z: 0 });
    const pr = match.snapshot([]).pr;
    const flame = pr.filter((p) => PROJECTILE_VISUALS[p[4]] === 'flame');
    const other = pr.filter((p) => PROJECTILE_VISUALS[p[4]] !== 'flame');
    expect(flame.length).toBeGreaterThan(0);
    expect(other.length).toBe(1);
    for (const p of flame) expect(p[5]).toBe(me.slot);
    for (const p of other) expect(p.length).toBe(5);
  });

  // Owner, 2026-11-24 (fix batch 11-25): every projectile gun's shot leaves its barrel, like the X-42's bolts.
  it.each([
    ['core.crossbow', 'arrow'], ['core.nailgun', 'nail'], ['core.hornet', 'stinger'], ['core.flak', 'shard'],
    ['core.singularity', 'vortex'], ['core.heart_taser', 'slime'], ['core.rockets', 'rocket'], ['core.launcher', 'grenade'],
    ['core.disc_launcher', 'disc'], ['core.swarm', 'swarm'], ['core.flare_gun', 'flare'],
  ] as const)('carry the shooter for %s (%s), every pellet', (id, look) => {
    const { match, me } = ready();
    (match as unknown as Internals).fireNow(me, { ...getWeapon(id), alt: undefined }, 0);
    const shots = match.snapshot([]).pr.filter((p) => PROJECTILE_VISUALS[p[4]] === look);
    expect(shots.length).toBe(Math.max(1, getWeapon(id).pellets));
    for (const p of shots) expect(p[5]).toBe(me.slot);
  });

  it('stop naming the shooter once a shot is half a second old', () => {
    const { match, me } = ready();
    (match as unknown as Internals).fireNow(me, { ...getWeapon('core.rockets'), alt: undefined }, 0);
    for (let i = 0; i < 40; i++) match.step();
    const rockets = match.snapshot([]).pr.filter((p) => PROJECTILE_VISUALS[p[4]] === 'rocket');
    for (const p of rockets) expect(p.length).toBe(5);
  });

  it("carry the shooter for the Blaster X-42's bolts (they leave the gun's muzzle, not the eye)", () => {
    const { match, me } = ready();
    (match as unknown as Internals).fireNow(me, { ...getWeapon('core.blaster_x42'), alt: undefined }, 0);
    const bolts = match.snapshot([]).pr.filter((p) => PROJECTILE_VISUALS[p[4]] === 'blasterBolt');
    expect(bolts.length).toBe(1);
    expect(bolts[0]![5]).toBe(me.slot);
  });
});
