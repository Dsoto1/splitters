import { describe, expect, it } from 'vitest';
import { lookSets, MAX_SHARED_LOOKS, sameShape, speciesOfFile, type LookLevel } from '../src/environment/envLooks.ts';

const level = (shape: number, colour: number, extra: Partial<LookLevel['parts'][number]> = {}): LookLevel => ({
  crossed: false,
  parts: [
    {
      material: 'env.leaf',
      texture: null,
      sideOrientation: 0,
      wind: [0, shape],
      data: { positions: [0, 0, shape], indices: [0, 1, 2], normals: [0, 1, 0], uvs: [0, 0], colors: [colour, colour, colour, 1] },
      ...extra,
    },
  ],
});

describe('shared looks (environment Phase 5)', () => {
  it('looks of one shape share; colours may differ', () => {
    expect(sameShape(level(1, 0.2), level(1, 0.8))).toBe(true);
  });

  it('another shape, a stand-in, a picture of its own or no colours do not share', () => {
    expect(sameShape(level(1, 0.2), level(2, 0.2))).toBe(false);
    expect(sameShape({ ...level(1, 0.2), crossed: true }, level(1, 0.2))).toBe(false);
    expect(sameShape(level(1, 0.2, { texture: {} }), level(1, 0.2))).toBe(false);
    expect(sameShape(level(1, 0.2, { material: 'env.bark' }), level(1, 0.2))).toBe(false);
    const bare = level(1, 0.2);
    expect(sameShape({ ...bare, parts: [{ ...bare.parts[0]!, data: { ...bare.parts[0]!.data, colors: null } }] }, level(1, 0.2))).toBe(false);
  });

  it('sorts a species’ looks into sets of one shape, the first the base, at most four a set', () => {
    const levels: Record<string, LookLevel | undefined> = {
      'env/conifer.pine.summer.glb': level(1, 0.1),
      'env/conifer.pine.snow.glb': level(2, 0.9),
      'env/conifer.pine.autumn.glb': level(1, 0.5),
      'env/conifer.pine.short.glb': undefined,
    };
    expect(lookSets(Object.keys(levels), (f) => levels[f])).toEqual([['env/conifer.pine.summer.glb', 'env/conifer.pine.autumn.glb'], ['env/conifer.pine.snow.glb']]);
    const many = Array.from({ length: 6 }, (_, i) => `env/grass.clump.v${i}.glb`);
    const sets = lookSets(many, () => level(1, 0.3));
    expect(sets.map((s) => s.length)).toEqual([MAX_SHARED_LOOKS, 2]);
  });

  it('names the species of a look’s file', () => {
    expect(speciesOfFile('env/conifer.spruce.snow.glb')).toBe('conifer.spruce');
  });
});
