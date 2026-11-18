import { describe, expect, it } from 'vitest';
import { applyCommand, newMapDocument, seasonCommand, seasonVariant, type MapDocument, type PropEntity } from '../src/index.ts';

const prop = (id: string, model: string, variant?: number): PropEntity => ({ id, kind: 'prop', model, position: [0, 0, 0], yaw: 0, scale: 1, solid: true, tint: null, ...(variant !== undefined ? { variant } : {}) }) as PropEntity;

describe('a season across the whole map (environment Phase 5)', () => {
  it('picks each species’ look for the season, evergreens and species without one staying green', () => {
    expect(seasonVariant('env.broadleaf.oak', undefined, 'autumn')).toBe(1);
    expect(seasonVariant('env.conifer.pine_tall', undefined, 'autumn')).toBeUndefined();
    expect(seasonVariant('env.conifer.pine_tall', undefined, 'snow')).toBe(1);
    // Ground cover dries in autumn when it has no autumn look; trees do not.
    expect(seasonVariant('env.grass.clump', undefined, 'autumn')).toBe(1);
    expect(seasonVariant('env.palm.coconut', undefined, 'autumn')).toBeUndefined();
    expect(seasonVariant('env.palm.coconut', undefined, 'dry')).toBe(1);
    expect(seasonVariant('env.grass.tussock', undefined, 'dry')).toBe(1); // straw
    // From one season to another, and back to summer.
    expect(seasonVariant('env.conifer.pine_tall', 1, 'autumn')).toBeUndefined();
    expect(seasonVariant('env.broadleaf.oak', 1, 'summer')).toBeUndefined();
  });

  it('leaves looks chosen on purpose alone (moss, flower colours, the alpine spruce)', () => {
    expect(seasonVariant('env.rock.boulder_angular', 1, 'snow')).toBe(1);
    expect(seasonVariant('env.flower.meadow', 3, 'dry')).toBe(3);
    expect(seasonVariant('env.conifer.spruce', 2, 'snow')).toBe(2);
    expect(seasonVariant('env.conifer.spruce', 2, 'summer')).toBe(2);
    expect(seasonVariant('prop.crate_small', 4, 'snow')).toBe(4);
  });

  it('is one edit, undone as one, and changes nothing but looks', () => {
    const doc: MapDocument = { ...newMapDocument('Seasons'), entities: [prop('a', 'env.broadleaf.oak'), prop('b', 'env.conifer.pine_tall'), prop('c', 'env.rock.boulder_angular', 1), prop('d', 'env.grass.clump')] };
    const cmd = seasonCommand(doc, 'autumn')!;
    expect(cmd.before.map((e) => e.id)).toEqual(['a', 'd']);
    const autumn = applyCommand(doc, cmd);
    expect(autumn.entities.map((e) => (e as PropEntity).variant)).toEqual([1, undefined, 1, 1]);
    expect(seasonCommand(autumn, 'autumn')).toBeNull();
    const summer = applyCommand(autumn, seasonCommand(autumn, 'summer')!);
    expect(summer.entities).toEqual(doc.entities);
  });
});
