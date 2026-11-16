import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, loadMap, mapAsPlayed, rulesForMap, type MapDocument } from '../src/index.ts';
import { BotFiller, Match, NavCache, initNavigation, navCache, validateMapNavigation, type NavExport, type PrebuiltNav } from '../src/match.ts';

// MapMaker's navigation check hands its navmesh to the Test's match (docs/PERF_MAPMAKER_TRACE_2026-11-15.md fix 4):
// the match must come out exactly as if it had built its own.

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const raw = (id: string): unknown => JSON.parse(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));

/** The map as MapMaker holds it, and as the Test plays it (loadMap). */
function both(id: string): { edit: MapDocument; played: MapDocument } {
  const edit = loadMap(raw(id), undefined, { forEditing: true });
  const played = loadMap(raw(id));
  if (!edit.ok || !played.ok) throw new Error(`${id} didn't load`);
  return { edit: edit.map, played: played.map };
}

/** What MapMaker's check builds and hands on: the navmesh of the map as played, from the map as made. */
const checkNav = (edit: MapDocument): PrebuiltNav => validateMapNavigation(mapAsPlayed(edit), false, { prebuilt: true }).prebuilt!;

/** A match of `map` with a person and bots, `ticks` run: its snapshots, one a second, as the clients get them. */
function play(map: MapDocument, nav: PrebuiltNav | null, ticks: number): { reused: boolean; navmesh: Uint8Array; snapshots: string[] } {
  const match = new Match(map, rulesForMap(map), 7, { nav });
  try {
    const navmesh = match.nav.export().mesh;
    const filler = new BotFiller(match);
    filler.join('Tester', undefined, 6);
    const snapshots: string[] = [];
    for (let i = 0; i < ticks; i++) {
      match.step();
      if (i % 30 === 29) snapshots.push(JSON.stringify(match.snapshot([])));
    }
    return { reused: match.navReused, navmesh, snapshots };
  } finally {
    match.destroy();
  }
}

describe('the navigation check hands its navmesh to the Test', () => {
  // Iron Maw (990 placements: the base of the owner's Iron Maw Remix) and Pantry Raid (parkour links, set pieces).
  for (const id of ['iron_maw', 'pantry_raid']) {
    it(`${id}: the match takes the check's navmesh and plays exactly as with its own`, { timeout: 240_000 }, () => {
      const { edit, played } = both(id);
      const prebuilt = checkNav(edit);
      // (The check keeps its navmesh in navCache too: the fresh match builds its own.)
      navCache.clear();
      const fresh = play(played, null, 300);
      const handed = play(played, prebuilt, 300);
      expect(fresh.reused).toBe(false);
      expect(handed.reused).toBe(true);
      // The same navmesh, byte for byte (after the match's own marks: openings, lifts), and the same match.
      expect(handed.navmesh.length).toBe(fresh.navmesh.length);
      expect(Buffer.from(handed.navmesh).equals(Buffer.from(fresh.navmesh))).toBe(true);
      expect(handed.snapshots).toEqual(fresh.snapshots);
    });
  }

  it('a navmesh of another map, or of the map before an edit, is not taken', { timeout: 240_000 }, () => {
    const { edit, played } = both('pantry_raid');
    const prebuilt = checkNav(edit);
    // A block moved a metre: the key differs, the match builds its own.
    const block = played.entities.findIndex((e) => e.kind === 'block');
    expect(block).toBeGreaterThanOrEqual(0);
    const moved = { ...played, entities: played.entities.map((e, i) => (i === block ? { ...e, position: [e.position[0] + 1, e.position[1], e.position[2]] as [number, number, number] } : e)) };
    const m = new Match(moved, rulesForMap(moved), 7, { nav: prebuilt });
    expect(m.navReused).toBe(false);
    m.destroy();
    // Other gravity (the rules' own): built again too.
    const low = new Match(played, { ...rulesForMap(played), gravity: 0.5 }, 7, { nav: prebuilt });
    expect(low.navReused).toBe(false);
    low.destroy();
  });
});

describe('navmeshes kept between matches (navCache: Scaling 1)', () => {
  it('the second match of a map takes the first one\'s navmesh, and plays exactly as with a fresh build', { timeout: 240_000 }, () => {
    const { played } = both('iron_maw');
    navCache.clear();
    const hits = navCache.hits;
    const first = play(played, null, 300);
    expect(first.reused).toBe(false);
    const second = play(played, null, 300);
    expect(second.reused).toBe(true);
    expect(navCache.hits).toBe(hits + 1);
    expect(Buffer.from(second.navmesh).equals(Buffer.from(first.navmesh))).toBe(true);
    expect(second.snapshots).toEqual(first.snapshots);
    // Another map, or the same with other gravity, builds its own.
    expect(new Match(played, { ...rulesForMap(played), gravity: 0.5 }, 7).navReused).toBe(false);
  });

  it('keeps the most recently used, within its count and bytes', () => {
    const nav = (bytes: number): NavExport => ({ mesh: new Uint8Array(bytes), spawnSeeds: [], lowSpans: 0, drops: 0, insideSolid: 0, exposed: 0, exposedArea: 0, parkour: [], walkReach: null });
    const c = new NavCache(2, 1000);
    c.put('a', nav(100));
    c.put('b', nav(100));
    expect(c.get('a')).toBeDefined();
    c.put('c', nav(100));
    // b was the least recently used.
    expect([c.get('a'), c.get('b'), c.get('c')].map(Boolean)).toEqual([true, false, true]);
    c.put('d', nav(950));
    expect(c.size).toBe(1);
    expect(c.get('d')).toBeDefined();
    // Too big to keep at all; a detached (transferred) one is gone.
    c.put('e', nav(2000));
    expect(c.get('e')).toBeUndefined();
    const gone = nav(100);
    c.put('f', gone);
    structuredClone(gone.mesh.buffer, { transfer: [gone.mesh.buffer as ArrayBuffer] });
    expect(c.get('f')).toBeUndefined();
  });
});
