import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAP_CATEGORIES,
  MAP_CATEGORY_IDS,
  MAP_FORMAT_VERSION,
  MapDocument as MapSchema,
  categoryCounts,
  categoryFromV50Tags,
  categoryLine,
  inMapCategory,
  isListedMap,
  isMapCategoryId,
  loadMap,
  mapTabOf,
  migrateMapDocument,
} from '../src/index.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const read = (id: string) => JSON.parse(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
const ids = readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const steps = JSON.parse(readFileSync(new URL('../../../docs/map-briefs/categories/steps.json', import.meta.url), 'utf8')) as { maps: Record<string, string> };
/** A map as the game opens it (a v50 file comes up to v51: its tags become one category). */
const opened = (id: string) => {
  const r = loadMap(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'), undefined, { forEditing: true, openWithErrors: true });
  if (!r.ok) throw new Error(`${id} does not open`);
  return r.map;
};

// Map format v51 (owner, 2026-11-24, QUEUE "Match Setup: one tab per map").
describe('map categories: the definitions', () => {
  it("are the owner's five tabs, Custom last and never in a file", () => {
    expect(MAP_CATEGORIES.map((c) => c.label)).toEqual(['Modern', 'Historic', 'Future & Space', 'Weird', 'Custom']);
    expect(MAP_CATEGORY_IDS).toEqual(['modern', 'historic', 'future', 'weird']);
    expect(isMapCategoryId('custom')).toBe(false);
    expect(isMapCategoryId('weird')).toBe(true);
  });
});

describe('map categories: one tab a map', () => {
  const town = { category: 'historic' };
  const plain = {};
  const mine = { own: true, category: 'weird' };
  const community = { community: true, category: 'modern' };
  it('All maps holds every map; a tab only its own', () => {
    for (const m of [town, plain, mine, community]) expect(inMapCategory(m, null)).toBe(true);
    expect(inMapCategory(town, 'historic')).toBe(true);
    expect(inMapCategory(town, 'modern')).toBe(false);
    // No pick: Modern.
    expect(mapTabOf(plain)).toBe('modern');
    expect(mapTabOf({ category: 'nonsense' })).toBe('modern');
  });
  it('Custom is worked out: your own maps and community maps, whatever their pick', () => {
    expect(mapTabOf(mine)).toBe('custom');
    expect(mapTabOf(community)).toBe('custom');
    expect(inMapCategory(mine, 'weird')).toBe(false);
  });
  it('the counts add up to the number of maps', () => {
    const list = [town, plain, mine, community, { category: 'future' }];
    const n = categoryCounts(list);
    expect(Object.fromEntries(n)).toEqual({ modern: 1, historic: 1, future: 1, weird: 0, custom: 2 });
    expect([...n.values()].reduce((a, b) => a + b, 0)).toBe(list.length);
  });
  it('says a map\'s line: its tab, or "Community map"', () => {
    expect(categoryLine(town)).toBe('Historic');
    expect(categoryLine(community)).toBe('Community map');
    expect(categoryLine(mine)).toBe('My map');
  });
});

describe('map categories: the format (v51)', () => {
  const doc = () => read('canyon');
  it('a map may carry one known category; Custom or an unknown one is refused', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(51);
    const m = migrateMapDocument(doc()).doc as ReturnType<typeof doc>;
    expect(MapSchema.safeParse({ ...m, metadata: { ...m.metadata, category: 'weird' } }).success).toBe(true);
    for (const bad of ['custom', 'temporal', 'Weird']) expect(MapSchema.safeParse({ ...m, metadata: { ...m.metadata, category: bad } }).success).toBe(false);
  });
  it("v50's tags become one pick (the lead's first assignment)", () => {
    const t = (...p: string[]) => p.map((s) => ({ category: s.split(':')[0]!, tag: s.split(':')[1]! }));
    expect(categoryFromV50Tags(t('temporal:modern', 'anomalous:experimental', 'temporal:future'))).toBe('weird');
    expect(categoryFromV50Tags(t('dimensional:alternate', 'temporal:medieval'))).toBe('weird');
    expect(categoryFromV50Tags(t('temporal:future', 'environmental:urban'))).toBe('future');
    expect(categoryFromV50Tags(t('environmental:space'))).toBe('future');
    expect(categoryFromV50Tags(t('temporal:medieval', 'environmental:urban'))).toBe('historic');
    // Industrial the place is not the industrial era; modern beside a period keeps it Modern, unless it is prehistoric.
    expect(categoryFromV50Tags(t('temporal:modern', 'environmental:industrial'))).toBe('modern');
    expect(categoryFromV50Tags(t('temporal:ancient', 'temporal:modern'))).toBe('modern');
    expect(categoryFromV50Tags(t('temporal:prehistoric', 'temporal:modern'))).toBe('historic');
    expect(categoryFromV50Tags([])).toBeUndefined();
  });
  it('a v50 map migrates to v51: its pairs go, its pick comes', () => {
    const v50 = { ...doc(), formatVersion: 50 };
    v50.metadata.categories = [{ category: 'temporal', tag: 'medieval' }];
    const { doc: up } = migrateMapDocument(JSON.parse(JSON.stringify(v50)));
    const md = (up as { metadata: Record<string, unknown> }).metadata;
    expect(md.categories).toBeUndefined();
    expect(md.category).toBe('historic');
    delete v50.metadata.categories;
    const { doc: none } = migrateMapDocument(JSON.parse(JSON.stringify(v50)));
    expect((none as { metadata: Record<string, unknown> }).metadata.category).toBeUndefined();
  });
});

describe("map categories: the maps' own (docs/map-briefs/categories/steps.json)", () => {
  it('every map is in the step list, with a known pick', () => {
    expect(ids.filter((id) => !(id in steps.maps))).toEqual([]);
    for (const [id, c] of Object.entries(steps.maps)) expect(isMapCategoryId(c), id).toBe(true);
  });
  it('each map opens in the step list\'s category', () => {
    const wrong = ids.filter((id) => (opened(id).metadata.category ?? 'modern') !== steps.maps[id]);
    expect(wrong).toEqual([]);
  });
  it("Match Setup's listed maps split Weird 11, Future & Space 4, Historic 16, Modern 36 (the lead's count, 2026-11-24)", () => {
    const listed = ids.filter((id) => isListedMap({ key: id }) && !opened(id).metadata.testOnly);
    const n = categoryCounts(listed.map((id) => ({ category: opened(id).metadata.category })));
    expect(Object.fromEntries(n)).toEqual({ modern: 36, historic: 16, future: 4, weird: 11, custom: 0 });
  });
});

describe('map categories: what Match Setup lists', () => {
  it('never a retired or a training map, on any tab or count', () => {
    expect(isListedMap({ key: 'training_range' })).toBe(false);
    expect(isListedMap({ key: 'citadel' })).toBe(false);
    expect(isListedMap({ key: 'sandgate' })).toBe(true);
    expect(isListedMap({ key: 'st_johns' })).toBe(true);
    // A player's own or a community map is theirs, whatever its id.
    expect(isListedMap({ key: 'training_range', own: true })).toBe(true);
    expect(isListedMap({ key: 'citadel', community: true })).toBe(true);
  });
});
