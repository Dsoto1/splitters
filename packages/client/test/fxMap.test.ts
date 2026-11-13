import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CORE_WEAPONS, SURFACE_TYPE_IDS, WEAPONS_BY_SLOT, entityMaterial, guessSurface, type MapDocument, type MapEntity, type WorldBox } from '@tiletrigger/shared';
import { arcFx, explosionFor, farFxSize, gameplayFx, impactSoundId, impactStyle, lastingFx, mappedEffects, mappedPacks, muzzleEffectFor, surfaceIndex, surfaceOfBox, weaponImpact } from '../src/game/fxMap.ts';
import { portName } from '../src/game/godotVfx.ts';
import { GameplayFxWatch, type WatchedPose } from '../src/game/gameplayFxWatch.ts';

const shipped = (pack: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(`../public/vfx/${pack}.json`, import.meta.url), 'utf8')).effects;
const lookup = (id: string) => CORE_WEAPONS[id];

describe('fx map (content/vfx.json map)', () => {
  it('names only effects that ship', () => {
    const packs = Object.fromEntries(mappedPacks().map((p) => [p, shipped(p)]));
    for (const r of mappedEffects()) expect(packs[r.pack]?.[r.effect], `${r.pack}/${r.effect}`).toBeTruthy();
    const flashes = shipped('muzzle_flash');
    for (const w of WEAPONS_BY_SLOT) {
      const fx = muzzleEffectFor(w);
      if (fx) expect(flashes[fx.id], `${w.id}: ${fx.id}`).toBeTruthy();
    }
  });

  it('draws every part of every mapped effect: each shader its parts use is ported (godotVfx.ts PORTS)', () => {
    const missing = new Set<string>();
    for (const r of mappedEffects()) {
      const fx = shipped(r.pack)[r.effect] as { set?: string; nodes: { type: string; name: string; material_override?: { shader?: { shader?: string } } }[] };
      for (const n of fx.nodes) {
        // A part the map leaves out (`skip`) is never drawn: a portal's stencil window has no port.
        if (r.skip?.includes(n.name)) continue;
        const shader = n.material_override?.shader?.shader;
        if ((n.type === 'GPUParticles3D' || n.type === 'MeshInstance3D') && shader && !portName(fx.set, shader)) missing.add(`${r.pack}/${r.effect}/${n.name}: ${fx.set}/${shader}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('plays lightning by its source and lasting effects by key', () => {
    expect(arcFx('default')?.zap.pack).toBe('electric_fx');
    expect(arcFx('mount')?.zap.effect).not.toBe(arcFx('default')?.zap.effect);
    // A bolt fitted to the game's 0.1-0.15 s between arcs plays faster than the pack's 0.6 s.
    for (const s of ['default', 'mount', 'fence'] as const) expect(arcFx(s)!.speed).toBeGreaterThanOrEqual(2);
    expect(lastingFx('charge.sentry_arc')?.effect).toMatch(/ball/);
    expect(lastingFx('nothing.here')).toBeNull();
  });

  it('gives each weapon class its muzzle flash, and none to melee or the railgun', () => {
    expect(muzzleEffectFor(CORE_WEAPONS['core.railgun']!)).toBeNull();
    const shotgun = Object.values(CORE_WEAPONS).find((w) => w.family === 'shotgun' && !w.view.muzzle);
    if (shotgun) expect(muzzleEffectFor(shotgun)?.id).toMatch(/wide_flash/);
    const melee = Object.values(CORE_WEAPONS).find((w) => w.kind === 'melee');
    if (melee) expect(muzzleEffectFor(melee)).toBeNull();
  });

  it('reads surfaces from names and level boxes', () => {
    expect(guessSurface('prop.shipping_container_red')).toBe('metal');
    expect(guessSurface('prop.crate_large')).toBe('wood');
    expect(guessSurface('prop.sandbag_wall')).toBe('dirt');
    expect(guessSurface('core.corridor_clear core.prototype')).toBe('concrete');
    const box = (sourceId: string, extra: Partial<WorldBox> = {}): WorldBox => ({ min: [0, 0, 0], max: [1, 1, 1], kind: 'prop', sourceId, ...extra });
    const index = new Map([['p1', 'metal' as const]]);
    expect(surfaceOfBox(undefined, index)).toBe('dirt');
    expect(surfaceOfBox(box('p1'), index)).toBe('metal');
    expect(surfaceOfBox(box('nope'), index)).toBe('concrete');
    expect(surfaceOfBox(box('p1', { surface: { material: 'core.wood_planks', tint: null } }), index)).toBe('wood');
    expect(impactStyle('metal').sparks).toBeGreaterThan(impactStyle('wood').sparks);
  });

  it('draws every surface type, and unset surfaces as before (stone dust, metal sparks, wood dust)', () => {
    for (const t of SURFACE_TYPE_IDS) expect(impactStyle(t), t).toBeTruthy();
    // What content/vfx.json map.impacts stone/metal/wood/dirt drew before the surface types.
    expect(impactStyle('concrete')).toMatchObject({ sparks: 2, dust: '#a39d92', dustSize: 1, chips: 0, hole: true, accent: null });
    expect(impactStyle('metal')).toMatchObject({ sparks: 8, dust: '#8e8a84', dustSize: 0.5, hole: true, accent: { pack: 'hit_fx', effect: 'vfx_strike_01' } });
    expect(impactStyle('wood')).toMatchObject({ sparks: 0, dust: '#8a6a45', dustSize: 0.9 });
    expect(impactStyle('dirt')).toMatchObject({ sparks: 0, dust: '#7d6a52', dustSize: 1.4, chips: 0 });
  });

  it('picks wood effects and sound for a tree trunk, the same surface the server shoots (not stone dust)', () => {
    const doc = { entities: [{ id: 't1', kind: 'prop', model: 'prop.oak', position: [0, 0, 0], yaw: 0 }, { id: 'b1', kind: 'prop', model: 'prop.bush_large', position: [0, 0, 0], yaw: 0 }, { id: 'r1', kind: 'prop', model: 'prop.nt_boulder', position: [0, 0, 0], yaw: 0 }, { id: 'c1', kind: 'prop', model: 'prop.shipping_container_red', position: [0, 0, 0], yaw: 0 }], classicStructure: { theme: 'core.prototype', tiles: [] } } as unknown as Pick<MapDocument, 'entities' | 'classicStructure'>;
    const index = surfaceIndex(doc);
    const box = (sourceId: string): WorldBox => ({ min: [0, 0, 0], max: [1, 1, 1], kind: 'prop', sourceId });
    const trunk = surfaceOfBox(box('t1'), index);
    expect(trunk).toBe('bark');
    expect(entityMaterial(doc.entities[0] as MapEntity)).toBe('heavy_wood');
    const style = impactStyle(trunk);
    expect(style.chips).toBeGreaterThan(0);
    expect(style.sparks).toBe(0);
    expect(style.dust).not.toBe(impactStyle('stone').dust);
    expect(impactSoundId(style.sound)).toBe('impact.wood');
    // A bush: leaves, no hole, a soft sound; a boulder: rock dust and grit; a container: metal sparks and ring.
    expect(surfaceOfBox(box('b1'), index)).toBe('foliage');
    expect(impactStyle('foliage')).toMatchObject({ hole: false, sound: 'soft' });
    expect(surfaceOfBox(box('r1'), index)).toBe('rock');
    expect(impactSoundId(impactStyle('rock').sound)).toBe('impact.world');
    expect(surfaceOfBox(box('c1'), index)).toBe('metal');
    expect(impactSoundId(impactStyle('metal').sound)).toBe('impact.metal');
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

describe('farFxSize (bursts seen from afar)', () => {
  it('keeps a burst as big on screen as 3 m off, up to 4 times', () => {
    expect(farFxSize(0)).toBe(1);
    expect(farFxSize(3)).toBe(1);
    // An armour pickup 7 m off (owner, 2026-11-08: a speck): 2.33 times its size, the same on screen as 3 m off.
    expect(farFxSize(7)).toBeCloseTo(7 / 3);
    expect(farFxSize(40)).toBe(4);
  });
});
