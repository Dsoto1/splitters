import { describe, expect, it } from 'vitest';
import {
  CORE_LOOKS,
  FIGURE_LOOK_CHOICES,
  MAP_FORMAT_VERSION,
  MapEntity,
  PICKABLE_LOOKS,
  RETIRED_FIGURE_LOOKS,
  SCENARIO_PALETTE,
  figureLook,
  getLook,
  isBotLook,
  migrateMapDocument,
  newScenarioEntities,
  validLookId,
} from '../src/index.ts';

// Characters retired to MapMaker and the Figure that wears them (owner, 2026-11-25: "All replacements can be retired to
// the mapmaker for use in other creations such as scenarios"; map format v53).
describe('characters retired to MapMaker', () => {
  const ids = RETIRED_FIGURE_LOOKS.map((l) => l.id);

  it('keeps the replaced characters\' old models, each under its own id', () => {
    for (const id of ['core.cyberlion_classic', 'core.lionsuit_classic', 'core.croakley_classic', 'core.elephantwarrior_classic', 'core.hyena_classic', 'core.greyfang_classic', 'core.gorillag_classic', 'core.boxduck_classic', 'core.boglurker_classic']) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('are on no roster: not Character Select\'s, a bot\'s, a random or a saved pick', () => {
    for (const id of ids) {
      expect(CORE_LOOKS.some((l) => l.id === id)).toBe(false);
      expect(PICKABLE_LOOKS.some((l) => l.id === id)).toBe(false);
      expect(isBotLook(id)).toBe(false);
      expect(getLook(id).id).not.toBe(id);
      expect(validLookId(id)).not.toBe(id);
    }
  });

  it('a Figure wears them, and anyone on the roster', () => {
    for (const id of ids) expect(figureLook(id).id).toBe(id);
    expect(figureLook('core.cyberlion').id).toBe('core.cyberlion');
    expect(figureLook('core.nobody').id).toBe(getLook('core.nobody').id);
    const { roster, retired } = FIGURE_LOOK_CHOICES();
    expect(retired.length).toBe(ids.length);
    expect(roster).toBe(CORE_LOOKS);
  });
});

describe('the Figure (map format v53)', () => {
  it('is a palette entry that places one figure, standing, facing the way it was placed', () => {
    expect(SCENARIO_PALETTE.some((p) => p.key === 'figure')).toBe(true);
    const [e] = newScenarioEntities('figure', [1, 0, 2], 0.5);
    expect(e).toMatchObject({ kind: 'figure', position: [1, 0, 2], yaw: 0.5, look: 'core.dale', pose: 'stand' });
    expect(MapEntity.parse(e)).toMatchObject({ kind: 'figure' });
  });

  it('takes any look and a pose; the pose must be one of the four', () => {
    expect(MapEntity.parse({ id: 'fig1', kind: 'figure', position: [0, 0, 0], look: 'core.croakley_classic', pose: 'dance' })).toMatchObject({ look: 'core.croakley_classic', pose: 'dance', yaw: 0 });
    expect(MapEntity.parse({ id: 'fig2', kind: 'figure', position: [0, 0, 0] })).toMatchObject({ look: 'core.dale', pose: 'stand' });
    expect(() => MapEntity.parse({ id: 'fig3', kind: 'figure', position: [0, 0, 0], pose: 'fly' })).toThrow();
  });

  it('a v51 map comes up to v53 unchanged', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(53);
    const v51 = { format: 'tiletrigger.map', formatVersion: 51, entities: [{ id: 'a', kind: 'hostage', position: [0, 0, 0] }] };
    const { doc } = migrateMapDocument(JSON.parse(JSON.stringify(v51)));
    expect((doc as { formatVersion: number }).formatVersion).toBe(MAP_FORMAT_VERSION);
    expect((doc as { entities: unknown[] }).entities).toEqual(v51.entities);
  });
});
