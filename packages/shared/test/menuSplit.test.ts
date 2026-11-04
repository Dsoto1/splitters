import { describe, expect, it } from 'vitest';
import { CEILINGS, CORE_TILES, DEFAULT_RACE, EDGE_STYLES, MAP_FORMAT_VERSION, NPC_ROLES, RaceSettings, SIDES, coreCatalog } from '../src/index.ts';
import * as keys from '../src/map/mapKeys.ts';
import * as options from '../src/map/tileOptions.ts';

// The menu's first download reads these light modules instead of the tables and schemas (docs/LOADING.md).
describe('menu split', () => {
  it('DEFAULT_RACE is RaceSettings’ defaults', () => {
    expect(DEFAULT_RACE).toEqual(RaceSettings.parse({}));
  });

  it('the barrel still exports the moved constants and the tables', () => {
    expect(SIDES).toBe(options.SIDES);
    expect(EDGE_STYLES).toBe(options.EDGE_STYLES);
    expect(CEILINGS).toBe(options.CEILINGS);
    expect(NPC_ROLES).toBe(keys.NPC_ROLES);
    expect(MAP_FORMAT_VERSION).toBe(keys.MAP_FORMAT_VERSION);
    expect(coreCatalog.all().length).toBe(CORE_TILES.length);
  });
});
