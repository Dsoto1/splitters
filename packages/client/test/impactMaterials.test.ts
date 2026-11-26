/**
 * Impact effects by material (QUEUE Features, GUNPLAY_GAPS G1; 2026-11-26): a round into a wall shows its surface (the
 * hole tinted and sized by holeLook, chips shaped by the type's debris, sparks thinned under Reduce flashing) and the
 * effect records are reused, so automatic fire into a wall makes no new objects once warm.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { ImpactVisuals, calmSparks } from '../src/game/impactVisuals.ts';
import { impactStyle } from '../src/game/fxMap.ts';
import { holeLook } from '../src/game/propHoles.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});
const noop2d = (): unknown => new Proxy(() => noop2d(), { get: (_t, k) => (k === 'then' ? undefined : noop2d()), set: () => true });
(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas ??= class {
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext(): unknown {
    return noop2d();
  }
};
function fx(): ImpactVisuals {
  const engine = new NullEngine();
  engines.push(engine);
  return new ImpactVisuals(new Scene(engine), () => null);
}
const at = { x: 0, y: 1, z: 0 };
const f32 = (t: readonly number[]) => t.map((x) => Math.fround(x));
const wall = { x: -1, y: 0, z: 0 };

describe('impact effects by material', () => {
  it('tints and sizes each level hole for its surface', () => {
    const v = fx();
    v.wallImpact(at, wall, 1, impactStyle('wood'));
    expect(v.holeTint()).toEqual(f32(holeLook('wood').tint));
    v.wallImpact(at, wall, 1, impactStyle('ice'));
    expect(v.holeTint()).toEqual(f32(holeLook('ice').tint));
    expect(v.holeTint(1)).toEqual(f32(holeLook('wood').tint));
    v.wallImpact(at, wall, 1, { sparks: 1, dust: null, dustSize: 0 });
    expect(v.holeTint()).toEqual([1, 1, 1]);
    expect(v.holesInLevel).toBe(3);
    v.dispose();
  });

  it('shapes chips by debris: long splinters on wood, flat slow leaves, chunky grit on brick', () => {
    const v = fx();
    v.wallImpact(at, wall, 1, impactStyle('wood'));
    const wood = v.chipShapes();
    expect(wood.length).toBeGreaterThan(0);
    for (const c of wood) expect(c.x).toBeGreaterThan(c.y * 2.5);
    v.update(5);
    v.wallImpact(at, wall, 1, impactStyle('foliage'));
    for (const c of v.chipShapes()) {
      expect(c.y).toBeLessThan(c.x / 3);
      expect(c.fall).toBeLessThan(5);
    }
    v.update(5);
    v.wallImpact(at, wall, 1, impactStyle('brick'));
    for (const c of v.chipShapes()) expect(c.y).toBeGreaterThan(c.x);
    v.dispose();
  });

  it('throws sparks off metal, none off wood, glass or ice; a third of them under Reduce flashing', () => {
    const v = fx();
    v.wallImpact(at, wall, 1, impactStyle('metal'));
    const full = v.live.sparks;
    expect(full).toBe(impactStyle('metal').sparks);
    v.update(5);
    v.wallImpact(at, wall, 1, { ...impactStyle('metal'), calm: true });
    expect(v.live.sparks).toBe(calmSparks(full));
    expect(v.live.sparks).toBeLessThan(full / 2);
    v.update(5);
    for (const s of ['wood', 'glass', 'ice', 'dirt'] as const) v.wallImpact(at, wall, 1, impactStyle(s));
    expect(v.live.sparks).toBe(0);
    expect(calmSparks(0)).toBe(0);
    expect(calmSparks(1)).toBe(1);
    v.dispose();
  });

  it('a pane that stops a round throws pale shards, not hot sparks', () => {
    const v = fx();
    v.glassChips(at, wall, 4);
    expect(v.live).toMatchObject({ sparks: 0, chips: 4, dust: 0 });
    v.dispose();
  });

  it('reuses its records: a long burst into a wall makes no new ones once warm', () => {
    const v = fx();
    const burst = () => {
      for (let i = 0; i < 20; i++) v.wallImpact(at, wall, 1, impactStyle('metal'));
      v.update(5);
    };
    burst();
    const spare = v.live.spare;
    expect(spare).toBeGreaterThan(0);
    burst();
    expect(v.live.spare).toBe(spare);
    expect(v.live).toMatchObject({ sparks: 0, chips: 0, dust: 0 });
    v.dispose();
  });
});
