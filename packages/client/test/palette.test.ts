import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_PROPS, SCENARIO_PALETTE } from '@tiletrigger/shared';
import { matchScore, searchFields } from '../src/editor/paletteSearch.ts';
import { PROP_GROUPS, atlasGroup, pictureKeys, propGroup, scenarioGroup } from '../src/editor/paletteCatalog.ts';
import type { AtlasManifest } from '../src/editor/paletteAtlas.ts';

const rank = (query: string, names: [string, string?, string?][]) =>
  names
    .map(([n, t, p]) => [n, matchScore(query, searchFields(n, t, p))] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => n);

describe('palette search', () => {
  const pieces: [string, string?, string?][] = [
    ['Sandbag Wall', 'Military prop cover', 'Tile Trigger kit pieces'],
    ['Sandbag Corner', 'Military prop cover'],
    ['Wall Lamp', 'light lamp wall sconce'],
    ['Saloon Doors', 'door saloon western frontier'],
    ['Oak Barrel', 'Crates & Barrels prop', 'Mini Dungeon (Kenney)'],
    ['Barrel', 'Crates & Barrels prop', 'Survival Kit (Kenney)'],
    ['Pine Tree', 'Trees nature'],
  ];

  it('ranks name matches above tag matches, exact words first', () => {
    expect(rank('barrel', pieces)).toEqual(['Barrel', 'Oak Barrel']);
    expect(rank('wall', pieces).slice(0, 2)).toEqual(['Wall Lamp', 'Sandbag Wall']);
  });

  it('needs every word to match somewhere: name, tags or pack', () => {
    expect(rank('sandbag corner', pieces)).toEqual(['Sandbag Corner']);
    expect(rank('kenney barrel', pieces)).toEqual(['Barrel', 'Oak Barrel']);
    expect(rank('western', pieces)).toEqual(['Saloon Doors']);
  });

  it('forgives a typo and finds abbreviations', () => {
    expect(rank('sandbg', pieces)).toContain('Sandbag Wall');
    expect(rank('barel', pieces)).toContain('Barrel');
    expect(rank('sbw', pieces)[0]).toBe('Sandbag Wall');
    expect(rank('zzz', pieces)).toEqual([]);
  });
});

describe('palette organisation', () => {
  it('puts every prop in a theme group, Nature or Vehicles', () => {
    expect(CORE_PROPS.filter((p) => propGroup(p) === 'other').map((p) => p.category)).toEqual([]);
    const listed = PROP_GROUPS.flatMap((g) => g.categories as readonly string[]);
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('sorts scenario pieces into tabs', () => {
    expect(scenarioGroup('flag').pane).toBe('entities');
    expect(scenarioGroup('light:candle').pane).toBe('lights');
    expect(scenarioGroup('encounter:vent').pane).toBe('npcs');
    expect(scenarioGroup('door:blast').group).toBe('Doors & Gates');
    expect(scenarioGroup('trap:spikes').group).toBe('Traps & Hazards');
    for (const e of SCENARIO_PALETTE) expect(scenarioGroup(e.key).group).toBeTruthy();
  });

  it('has a picture in the prebuilt atlas for every shipped tile, prop and vehicle', () => {
    const manifest = JSON.parse(readFileSync(new URL('../public/thumbs/palette.json', import.meta.url), 'utf8')) as AtlasManifest;
    const keys = pictureKeys().map((p) => p.key);
    expect(keys.length).toBeGreaterThan(1000);
    expect(keys.filter((k) => !manifest.items[k])).toEqual([]);
    for (const k of keys) expect(manifest.items[k]![0]).toBe(atlasGroup(k));
    expect(Object.keys(manifest.atlases).length).toBeLessThanOrEqual(12);
  });
});
