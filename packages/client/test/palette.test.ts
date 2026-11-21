import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_PROPS, DEFAULT_METAL, GROUND_MATERIALS, SCENARIO_PALETTE, STYLE_PACKS, coreCatalog, groundThemes, coreMaterials, coreThemes, getStylePack } from '@tiletrigger/shared';
import { matchScore, searchFields } from '../src/editor/paletteSearch.ts';
import { PROP_GROUPS, atlasGroup, pictureKeys, propGroup, rankedOrder, scenarioGroup, themeGroundOrder, themePaintList, themeRank, themeStylePacks } from '../src/editor/paletteCatalog.ts';
import { atlasManifest, type AtlasIndex } from '../src/editor/paletteAtlas.ts';

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

  it('has a picture in the prebuilt atlas for every shipped tile, prop and vehicle, one atlas per content pack', () => {
    const index = JSON.parse(readFileSync(new URL('../public/thumbs/palette.json', import.meta.url), 'utf8')) as AtlasIndex;
    expect(index.version).toBe(2);
    const manifest = atlasManifest(index);
    // Each prop's content pack is the file it is listed in: content/props/<pack>.json.
    const dir = new URL('../../../content/props/', import.meta.url);
    const packOf = new Map<string, string>();
    for (const f of readdirSync(dir)) for (const p of (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { props: { id: string }[] }).props) packOf.set(`prop:prop.${p.id}`, f.slice(0, -5));
    const keys = pictureKeys().map((p) => p.key);
    expect(keys.length).toBeGreaterThan(1000);
    expect(keys.filter((k) => !manifest.items[k])).toEqual([]);
    for (const k of keys) expect(manifest.items[k]![0]).toBe(atlasGroup(k, packOf.get(k)));
    expect(manifest.items['tile:core.room']![0]).toBe('tiles-core');
    expect(index.atlases[manifest.items['prop:prop.barrel']![0]]!.pack).toBe('Survival Kit (Kenney)');
  });
});

describe("the palette follows the map's themes (painting Phase 3)", () => {
  const ids = (packs: { id: string }[]) => packs.map((p) => p.id);

  it("finds the packs that use a theme, the theme's own pack first", () => {
    // Desert City is the Desert pack's own theme; core.desert is also listed by Frontier and Imperial.
    expect(ids(themeStylePacks('core.desert_city'))).toEqual(['desert']);
    expect(ids(themeStylePacks('core.desert'))).toEqual(['frontier', 'imperial', 'desert']);
    // core.city: Urban's own (first), then Suburban and Harbor, which also list it, in pack order.
    expect(ids(themeStylePacks('core.city'))).toEqual(['urban', 'suburban', 'harbor']);
    // A theme no pack uses (the new map's Prototype): none, so nothing moves.
    expect(themeStylePacks('core.prototype')).toEqual([]);
    for (const p of STYLE_PACKS) expect(themeStylePacks(p.themes[0]!)[0]!.id).toBe(p.id);
  });

  it("This map's themes puts the theme's packs' tiles and props first, each part in the catalogue's order; All keeps the catalogue's order", () => {
    const packs = themeStylePacks('core.military');
    const tools = coreCatalog.all().map((d) => `tile:${d.id}`);
    const ordered = rankedOrder(tools, (t) => themeRank(t, packs));
    const lead = ordered.filter((t) => themeRank(t, packs) === 0);
    expect(lead.length).toBeGreaterThan(10);
    expect(ordered.slice(0, lead.length)).toEqual(tools.filter((t) => lead.includes(t)));
    expect(ordered.slice(lead.length)).toEqual(tools.filter((t) => !lead.includes(t)));
    expect(lead).toContain('tile:military.barracks');
    expect(ordered.indexOf('tile:military.barracks')).toBeLessThan(ordered.indexOf('tile:core.corridor'));
    // Military's sandbags lead its props; the wild-west props (Frontier's) come after.
    const props = CORE_PROPS.map((p) => `prop:${p.id}`);
    const byTheme = rankedOrder(props, (t) => themeRank(t, packs));
    expect(byTheme.indexOf('prop:prop.sandbag_wall')).toBeLessThan(byTheme.indexOf(props.find((t) => themeRank(t, packs) === 1)!));
    // Walls, spawns and the modes' pieces go with every pack; a theme with no pack moves nothing.
    expect(themeRank('edge:window', packs)).toBe(0);
    expect(themeRank('scenario:flag', packs)).toBe(0);
    expect(rankedOrder(tools, (t) => themeRank(t, []))).toEqual(tools);
    // Set pieces by the looks they suit.
    expect(themeRank('setpiece:setpiece.x', packs, () => false)).toBe(1);
    expect(themeRank('setpiece:setpiece.x', packs, (p) => p.id === 'military')).toBe(0);
  });

  it("Structure paint's list: the theme's slot materials, then its packs' materials, then Recent, none twice", () => {
    const known = (id: string) => !!coreMaterials.get(id);
    const theme = coreThemes.get('core.industrial')!;
    const packs = themeStylePacks('core.industrial');
    const pack = getStylePack('industrial')!;
    const slots = [...new Set([theme.slots.floor, theme.slots.walls, theme.slots.solids, theme.slots.underside, theme.slots.trim].map((s) => s.material).concat(theme.slots.metal?.material ?? DEFAULT_METAL))];
    const list = themePaintList(theme, packs, ['core.checker', slots[0]!, 'core.red_brick', 'core.nope'], known);
    expect(list.theme).toEqual(slots.filter(known));
    expect(list.packs).toEqual(pack.materials.filter((m) => known(m) && !slots.includes(m)));
    expect(list.recent).toEqual(['core.checker', 'core.red_brick'].filter((m) => known(m) && !slots.includes(m) && !pack.materials.includes(m)));
    const all = [...list.theme, ...list.packs, ...list.recent];
    expect(new Set(all).size).toBe(all.length);
    // A theme no pack uses still lists its own materials; Recent is capped.
    const proto = themePaintList(coreThemes.get('core.prototype')!, [], coreMaterials.all().map((m) => m.id), known, 8);
    expect(proto.theme).toContain(coreThemes.get('core.prototype')!.slots.walls.material);
    expect(proto.packs).toEqual([]);
    expect(proto.recent.length).toBe(8);
  });

  it("Ground paint's list: the Ground theme's grounds first, then the grounds the map painted, then the rest", () => {
    const quarry = groundThemes.get('ground.quarry')!;
    // Base (0) cells, two painted Packed Snow, one painted Gravel (the theme lists it already).
    const terrain = { groundTheme: 'ground.quarry', grounds: ['core.packed_snow', 'core.pbr_gravel', 'core.lake_ice'], materials: [0, 0, 1, 1, 2, 0] };
    const { order, lead } = themeGroundOrder(GROUND_MATERIALS, terrain);
    expect(order.slice(0, quarry.grounds.length)).toEqual([...quarry.grounds]);
    expect(order[quarry.grounds.length]).toBe('core.packed_snow');
    // Lake Ice is in the list but no cell uses it: it stays with the rest.
    expect(lead).toBe(quarry.grounds.length + 1);
    expect(order.slice(lead)).toEqual(GROUND_MATERIALS.filter((g) => !order.slice(0, lead).includes(g)));
    expect(new Set(order).size).toBe(GROUND_MATERIALS.length);
    // No terrain: every ground in its own order, nothing leads.
    expect(themeGroundOrder(GROUND_MATERIALS, null)).toEqual({ order: [...GROUND_MATERIALS], lead: 0 });
  });
});
