import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAP_CATEGORIES,
  MAP_CATEGORY_IDS,
  MAP_FORMAT_VERSION,
  MAP_INSPIRATIONS,
  MapDocument as MapSchema,
  categoryCounts,
  categoryLine,
  inMapCategory,
  isListedMap,
  isMapCategoryTag,
  isRetiredMap,
  mapTagLabel,
  migrateMapDocument,
  normalizeMapCategories,
} from '../src/index.ts';

const MAPS = new URL('../../../maps/', import.meta.url);
const read = (id: string) => JSON.parse(readFileSync(new URL(`${id}.json`, MAPS), 'utf8'));
const ids = readdirSync(MAPS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const steps = JSON.parse(readFileSync(new URL('../../../docs/map-briefs/categories/steps.json', import.meta.url), 'utf8')) as {
  maps: Record<string, { category: string; tag: string }[]>;
};
const key = (p: { category: string; tag: string }) => `${p.category}:${p.tag}`;

// Map format v50 (QUEUE "Match Setup redesign", the owner's six categories of 2026-11-23).
describe('map categories: the definitions', () => {
  it("are the owner's six, Custom last and never in a file", () => {
    expect(MAP_CATEGORIES.map((c) => c.id)).toEqual(['temporal', 'dimensional', 'environmental', 'fictional', 'anomalous', 'custom']);
    expect(MAP_CATEGORY_IDS).not.toContain('custom');
    expect(isMapCategoryTag('custom', 'mine')).toBe(false);
  });
  it("hold the owner's sub-tags", () => {
    const tags = (id: string) => MAP_CATEGORIES.find((c) => c.id === id)!.tags.map(([, l]) => l);
    expect(tags('temporal')).toEqual(['Prehistoric', 'Ancient', 'Medieval', 'Industrial', 'Modern', 'Future']);
    expect(tags('environmental')).toEqual(expect.arrayContaining(['Urban', 'Desert', 'Forest', 'Industrial', 'Coastal', 'Underground', 'Space']));
    for (const c of MAP_CATEGORIES) expect(new Set(c.tags.map(([t]) => t)).size).toBe(c.tags.length);
  });
  it('know their tags and labels', () => {
    expect(isMapCategoryTag('temporal', 'medieval')).toBe(true);
    expect(isMapCategoryTag('temporal', 'urban')).toBe(false);
    expect(isMapCategoryTag('nonsense', 'urban')).toBe(false);
    expect(mapTagLabel('fictional', 'classic')).toBe('Classic remake');
    expect(mapTagLabel('temporal', 'unknown')).toBe('unknown');
  });
  it('normalise a list: known pairs, no repeats, in the definitions order', () => {
    expect(
      normalizeMapCategories([
        { category: 'environmental', tag: 'urban' },
        { category: 'temporal', tag: 'modern' },
        { category: 'environmental', tag: 'urban' },
        { category: 'temporal', tag: 'bogus' },
        { category: 'custom', tag: 'mine' },
        { category: 'environmental', tag: 'desert' },
      ]),
    ).toEqual([
      { category: 'temporal', tag: 'modern' },
      { category: 'environmental', tag: 'urban' },
      { category: 'environmental', tag: 'desert' },
    ]);
    expect(normalizeMapCategories(undefined)).toEqual([]);
  });
});

describe('map categories: the filter', () => {
  const town = { categories: [{ category: 'temporal', tag: 'medieval' }, { category: 'environmental', tag: 'urban' }] };
  const beach = { categories: [{ category: 'temporal', tag: 'modern' }, { category: 'environmental', tag: 'coastal' }] };
  const mine = { own: true };
  const community = { community: true, categories: [{ category: 'temporal', tag: 'modern' }] };
  it('All dimensions holds every map', () => {
    for (const m of [town, beach, mine, community]) expect(inMapCategory(m, null)).toBe(true);
  });
  it('a category holds the maps with any of its tags; a tag only those with it', () => {
    expect(inMapCategory(town, { category: 'temporal' })).toBe(true);
    expect(inMapCategory(town, { category: 'fictional' })).toBe(false);
    expect(inMapCategory(town, { category: 'temporal', tag: 'medieval' })).toBe(true);
    expect(inMapCategory(beach, { category: 'temporal', tag: 'medieval' })).toBe(false);
    expect(inMapCategory(beach, { category: 'environmental', tag: 'coastal' })).toBe(true);
    // A tag of the same name under another category doesn't count (Industrial is a period and a place).
    expect(inMapCategory({ categories: [{ category: 'environmental', tag: 'industrial' }] }, { category: 'temporal', tag: 'industrial' })).toBe(false);
  });
  it('Custom is worked out: your own maps and community maps, never tags', () => {
    expect(inMapCategory(mine, { category: 'custom' })).toBe(true);
    expect(inMapCategory(community, { category: 'custom' })).toBe(true);
    expect(inMapCategory(town, { category: 'custom' })).toBe(false);
    expect(inMapCategory(mine, { category: 'custom', tag: 'community' })).toBe(false);
    expect(inMapCategory(community, { category: 'custom', tag: 'community' })).toBe(true);
    expect(inMapCategory(mine, { category: 'custom', tag: 'mine' })).toBe(true);
  });
  it('counts each tab and tag', () => {
    const n = categoryCounts([town, beach, mine, community]);
    expect(n.get('temporal')).toBe(3);
    expect(n.get('temporal:modern')).toBe(2);
    expect(n.get('environmental:urban')).toBe(1);
    expect(n.get('custom')).toBe(2);
    expect(n.get('custom:mine')).toBe(1);
    expect(n.get('fictional')).toBeUndefined();
  });
  it('says a map\'s line: its first tags, or "Community map"', () => {
    expect(categoryLine(town)).toBe('Medieval · Urban');
    expect(categoryLine(community)).toBe('Community map');
    expect(categoryLine(mine)).toBe('My map');
  });
});

describe('map categories: the format (v50)', () => {
  const doc = () => read('canyon');
  it('a map may carry categories; an unknown tag of a known category is kept', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(50);
    const m = { ...doc(), formatVersion: MAP_FORMAT_VERSION };
    const ok = MapSchema.safeParse({ ...m, metadata: { ...m.metadata, categories: [{ category: 'temporal', tag: 'modern' }, { category: 'anomalous', tag: 'someday' }] } });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.metadata.categories).toHaveLength(2);
  });
  it('Custom, an unknown category or a bad tag is refused', () => {
    const m = { ...doc(), formatVersion: MAP_FORMAT_VERSION };
    for (const bad of [{ category: 'custom', tag: 'mine' }, { category: 'mood', tag: 'calm' }, { category: 'temporal', tag: 'Not A Tag' }]) {
      expect(MapSchema.safeParse({ ...m, metadata: { ...m.metadata, categories: [bad] } }).success).toBe(false);
    }
  });
  it('a v49 map migrates to v50 as it is', () => {
    const v49 = { ...doc(), formatVersion: 49 };
    delete v49.metadata.categories;
    const { doc: up } = migrateMapDocument(JSON.parse(JSON.stringify(v49)));
    expect(up).toEqual({ ...JSON.parse(JSON.stringify(v49)), formatVersion: MAP_FORMAT_VERSION });
  });
});

describe("map categories: the maps' own (docs/map-briefs/categories/steps.json)", () => {
  it('every map is in the step list', () => {
    expect(ids.filter((id) => !(id in steps.maps))).toEqual([]);
  });
  it('the step list names known tags only, and every map has at least one', () => {
    for (const [id, list] of Object.entries(steps.maps)) {
      expect(list.length, id).toBeGreaterThan(0);
      for (const p of list) expect(isMapCategoryTag(p.category, p.tag), `${id} ${key(p)}`).toBe(true);
    }
  });
  it("each map's file carries the step list's tags (ticked in MapMaker)", () => {
    const wrong = Object.entries(steps.maps)
      .filter(([id, list]) => (read(id).metadata.categories ?? []).map(key).sort().join() !== list.map(key).sort().join())
      .map(([id]) => id);
    expect(wrong).toEqual([]);
  });
  it('the film and fiction maps and the maps inspired by other games are Fictional', () => {
    const fictional = (id: string) => (steps.maps[id] ?? []).some((p) => p.category === 'fictional');
    // Real places and events (a look-alike of a real place, the D-Day landings) are not fiction.
    const real = new Set(['capitol_mall', 'norman_shores', 'shingle_point']);
    expect(Object.keys(MAP_INSPIRATIONS).filter((id) => !real.has(id) && ids.includes(id) && !fictional(id))).toEqual([]);
    // 21 game-based maps on the roster (owner, 2026-11-23), retired ones aside.
    const games = Object.entries(steps.maps).filter(([id, l]) => !isRetiredMap(id) && l.some((p) => key(p) === 'fictional:classic'));
    expect(games).toHaveLength(21);
  });
});

describe('map categories: what Match Setup lists', () => {
  it('never a retired or a training map, on any tab, category or count', () => {
    expect(isListedMap({ key: 'training_range' })).toBe(false);
    expect(isListedMap({ key: 'citadel' })).toBe(false);
    expect(isListedMap({ key: 'sandgate' })).toBe(true);
    expect(isListedMap({ key: 'st_johns' })).toBe(true);
    // A player's own or a community map is theirs, whatever its id.
    expect(isListedMap({ key: 'training_range', own: true })).toBe(true);
    expect(isListedMap({ key: 'citadel', community: true })).toBe(true);
    const shipped = ids.map((id) => ({ key: id, categories: read(id).metadata.categories as { category: string; tag: string }[] | undefined }));
    const listed = shipped.filter(isListedMap);
    expect(listed.map((m) => m.key)).not.toContain('training_range');
    expect(listed.map((m) => m.key)).not.toContain('citadel');
    // The Training Range is tagged Anomalous, but Anomalous counts and shows only listed maps.
    const anomalous = (l: typeof shipped) => l.filter((m) => inMapCategory(m, { category: 'anomalous' })).map((m) => m.key);
    expect(anomalous(shipped)).toContain('training_range');
    expect(anomalous(listed)).not.toContain('training_range');
    expect(categoryCounts(listed).get('anomalous')).toBe(anomalous(listed).length);
  });
});
