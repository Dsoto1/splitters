import { describe, expect, it } from 'vitest';
import {
  CORE_LOOKS,
  MAP_FORMAT_VERSION,
  MapEntity,
  NPC_KEPT_LOOKS,
  RETIRED_LOOKS,
  SCENARIO_PALETTE,
  getLook,
  migrateMapDocument,
  newScenarioEntities,
  vacantCollectionPlaces,
} from '../src/index.ts';

// MapMaker's Figure (map format v53): a roster character standing on the map in a pose. Retired characters are removed
// (owner, 2026-11-26), so a Figure wears roster looks only; an old id in RETIRED_LOOKS draws as its mapping.
describe('the Figure\'s looks', () => {
  it('a retired id is a mapping only, to a roster look', () => {
    for (const [from, to] of Object.entries(RETIRED_LOOKS)) {
      expect(CORE_LOOKS.some((l) => l.id === from), from).toBe(false);
      // (Linktifa stays drawable as the Designer's base: NPC_KEPT_LOOKS.)
      if (!NPC_KEPT_LOOKS.has(from)) expect(getLook(from).id, from).toBe(getLook(to).id);
    }
    expect(getLook('core.rhinojuggernaut').id).toBe('core.gorillag');
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
    expect(MapEntity.parse({ id: 'fig1', kind: 'figure', position: [0, 0, 0], look: 'core.croakley', pose: 'dance' })).toMatchObject({ look: 'core.croakley', pose: 'dance', yaw: 0 });
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

describe('the Chrono Crew\'s 14th place (owner, 2026-11-25)', () => {
  it('waits for the Inquisitor: an Unknown place until the story unlocks him', () => {
    expect(vacantCollectionPlaces('chrono', [])).toEqual(['core.bossinquisitor']);
    expect(vacantCollectionPlaces('chrono', ['core.bossinquisitor'])).toEqual([]);
    expect(vacantCollectionPlaces('space', [])).toEqual([]);
    expect(CORE_LOOKS.filter((l) => l.collection === 'chrono').length + vacantCollectionPlaces('chrono', []).length).toBe(14);
  });
});
