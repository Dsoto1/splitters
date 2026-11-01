import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CORE_WEAPONS, WEAPONS_BY_SLOT, type WorldBox } from '@tiletrigger/shared';
import { explosionFor, gameplayFx, impactStyle, mappedEffects, muzzleEffectFor, surfaceOfBox, surfaceOfName, weaponImpact } from '../src/game/fxMap.ts';
import { GameplayFxWatch, type WatchedPose } from '../src/game/gameplayFxWatch.ts';

const shipped = (pack: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(`../public/vfx/${pack}.json`, import.meta.url), 'utf8')).effects;
const lookup = (id: string) => CORE_WEAPONS[id];

describe('fx map (content/vfx.json map)', () => {
  it('names only effects that ship', () => {
    const packs = { hit_fx: shipped('hit_fx'), explosion_fx: shipped('explosion_fx') };
    for (const r of mappedEffects()) expect(packs[r.pack][r.effect], `${r.pack}/${r.effect}`).toBeTruthy();
    const flashes = shipped('muzzle_flash');
    for (const w of WEAPONS_BY_SLOT) {
      const fx = muzzleEffectFor(w);
      if (fx) expect(flashes[fx.id], `${w.id}: ${fx.id}`).toBeTruthy();
    }
  });

  it('gives each weapon class its muzzle flash, and none to melee or the railgun', () => {
    expect(muzzleEffectFor(CORE_WEAPONS['core.railgun']!)).toBeNull();
    const shotgun = Object.values(CORE_WEAPONS).find((w) => w.family === 'shotgun' && !w.view.muzzle);
    if (shotgun) expect(muzzleEffectFor(shotgun)?.id).toMatch(/wide_flash/);
    const melee = Object.values(CORE_WEAPONS).find((w) => w.kind === 'melee');
    if (melee) expect(muzzleEffectFor(melee)).toBeNull();
  });

  it('reads surfaces from names and level boxes', () => {
    expect(surfaceOfName('prop.shipping_container_red')).toBe('metal');
    expect(surfaceOfName('prop.crate_large')).toBe('wood');
    expect(surfaceOfName('prop.sandbag_wall')).toBe('dirt');
    expect(surfaceOfName('core.corridor_clear core.prototype')).toBe('stone');
    const box = (sourceId: string, extra: Partial<WorldBox> = {}): WorldBox => ({ min: [0, 0, 0], max: [1, 1, 1], kind: 'prop', sourceId, ...extra });
    const index = new Map([['p1', 'metal' as const]]);
    expect(surfaceOfBox(undefined, index)).toBe('dirt');
    expect(surfaceOfBox(box('p1'), index)).toBe('metal');
    expect(surfaceOfBox(box('nope'), index)).toBe('stone');
    expect(surfaceOfBox(box('p1', { surface: { material: 'core.wood_planks', tint: null } }), index)).toBe('wood');
    expect(impactStyle('metal').sparks).toBeGreaterThan(impactStyle('wood').sparks);
  });

  it('picks explosions by weapon, projectile, kind and air', () => {
    expect(explosionFor('core.barrel', null, lookup).effect).toBe('vfx_burst_explosion_03');
    expect(explosionFor('core.trap_mine', null, lookup).effect).toBe('vfx_ground_explosion_02');
    expect(explosionFor(undefined, 'vehicle', lookup).effect).toBe('vfx_ground_explosion_04');
    const rocket = Object.values(CORE_WEAPONS).find((w) => w.projectile?.visual === 'rocket' && w.id !== 'core.tank_cannon')!;
    expect(explosionFor(rocket.id, null, lookup).effect).toBe('vfx_ground_explosion_03');
    expect(explosionFor(rocket.id, 'air', lookup).effect).toBe('vfx_air_explosion_01');
    // A burst stays a burst in the air.
    expect(explosionFor('core.barrel', 'air', lookup).effect).toBe('vfx_burst_explosion_03');
    expect(explosionFor(undefined, null, lookup).effect).toBe('vfx_ground_explosion_01');
  });

  it('has impacts for the railgun and moments of play', () => {
    expect(weaponImpact(CORE_WEAPONS['core.railgun'])?.effect).toBe('vfx_big_impact_01');
    expect(weaponImpact(WEAPONS_BY_SLOT.find((w) => w.family === 'rifle'))).toBeNull();
    for (const k of ['pickup.health', 'pickup.ammo', 'spawn', 'portal', 'pad', 'trap.shock', 'trap.spikes', 'zipline']) expect(gameplayFx(k), k).toBeTruthy();
  });
});

describe('GameplayFxWatch', () => {
  const pose = (p: Partial<WatchedPose>): WatchedPose => ({ slot: 1, x: 0, y: 0, z: 0, alive: true, grounded: true, ...p });
  const pads = [{ pos: { x: 10, y: 0, z: 0 }, vy: 14, vx: 0, vz: 0 }];
  const portals = [{ i: 0, id: 'a', pair: 'x', pos: { x: 20, y: 0, z: 0 }, yaw: 0, nx: 0, nz: 1, width: 2, height: 3, link: 1 }];

  it('sees spawns, pads, portals and ziplines', () => {
    const got: string[] = [];
    const w = new GameplayFxWatch(pads, portals, (k) => got.push(k));
    w.update([pose({ alive: false })], 0);
    w.update([pose({})], 16);
    expect(got).toEqual(['spawn']);
    w.update([pose({ x: 10 })], 32);
    w.update([pose({ x: 10, y: 0.3, grounded: false })], 48);
    expect(got).toEqual(['spawn', 'pad']);
    w.update([pose({ x: 20 })], 64);
    w.update([pose({ x: 60 })], 80);
    expect(got).toEqual(['spawn', 'pad', 'portal', 'portal']);
    w.update([pose({ x: 60, zip: 0 })], 96);
    expect(got.at(-1)).toBe('zipline');
    // Running past without a pad or portal: nothing.
    w.update([pose({ x: 64 })], 112);
    expect(got).toHaveLength(5);
  });
});
