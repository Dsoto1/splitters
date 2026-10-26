import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_DEATHMATCH_RULES, getWeapon, initPhysics, isMapId, loadMap, parsePlaylist, playlistNext, validateMap, weaponCode, type GameEvent, type MapDocument } from '../src/index.ts';
import { Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const mapsDir = new URL('../../../maps/', import.meta.url);
const suite = new Set(readdirSync(mapsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));

const withNextMap = (next: string): MapDocument => {
  const map = makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }], [[0, 0, 0], [2, 0, 2]]);
  map.logic.rules.push({ id: 'go_on', name: 'Go on', enabled: true, once: true, when: { event: 'match_start', target: null }, if: [], do: [{ type: 'next_map', target: null, value: 0, text: next, state: '' }] });
  return map;
};

describe('scenario chains', () => {
  it('the shipped playlists are valid and only use maps of our suite', () => {
    const dir = new URL('playlists/', mapsDir);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const p = parsePlaylist(JSON.parse(readFileSync(new URL(f, dir), 'utf8')), suite);
      expect(p, f).not.toBeNull();
      for (const m of p!.maps) {
        const loaded = loadMap(readFileSync(new URL(`${m.map}.json`, mapsDir), 'utf8'));
        expect(loaded.ok, m.map).toBe(true);
        if (loaded.ok) expect(loaded.map.metadata.supportedModes, m.map).toContain('core.coop');
      }
    }
  });

  it('playlists step through their maps, loop if asked, and refuse maps outside the suite', () => {
    const p = parsePlaylist({ format: 'tiletrigger.playlist', id: 'two', name: 'Two', maps: [{ map: 'm4_outpost' }, { map: 'creature_lab' }] }, suite)!;
    expect(p.carry).toEqual({ score: true, loadout: true });
    expect(playlistNext(p, 0)).toBe(1);
    expect(playlistNext(p, 1)).toBeNull();
    expect(playlistNext({ ...p, loop: true }, 1)).toBe(0);
    expect(parsePlaylist({ ...p, maps: [{ map: 'somebody_elses_map' }] }, suite)).toBeNull();
    expect(parsePlaylist({ ...p, maps: [{ map: '../secrets' }] })).toBeNull();
    expect(isMapId('creature_lab')).toBe(true);
    expect(isMapId('../x')).toBe(false);
  });

  it('the "Next map" logic action wins the match and names the map to load', () => {
    const map = withNextMap('creature_lab');
    expect(validateMap(map).filter((i) => i.code === 'logic.next_map')).toEqual([]);
    const match = new Match(map, DEFAULT_DEATHMATCH_RULES, 1);
    match.addHuman('me');
    const events: GameEvent[] = [];
    for (let i = 0; i < 10; i++) events.push(...match.step());
    expect(events.find((e) => e.e === 'round_end')).toMatchObject({ outcome: 'victory', next: 'creature_lab' });
    expect(match.nextMap).toBe('creature_lab');
    // A bad ID is flagged in MapMaker and ignored in play.
    const bad = withNextMap('Not A Map!');
    expect(validateMap(bad).some((i) => i.code === 'logic.next_map')).toBe(true);
    const m2 = new Match(bad, DEFAULT_DEATHMATCH_RULES, 1);
    m2.addHuman('me');
    const ev2: GameEvent[] = [];
    for (let i = 0; i < 10; i++) ev2.push(...m2.step());
    expect(ev2.some((e) => e.e === 'round_end')).toBe(false);
  });

  it('a player carries their score and weapons into the next map', () => {
    const a = new Match(withNextMap('creature_lab'), DEFAULT_DEATHMATCH_RULES, 1);
    const me = a.addHuman('me')!;
    me.kills = 7;
    const rocket = getWeapon('core.rockets');
    me.weapons.set(weaponCode(rocket), { def: rocket, mag: 1, reserve: 3, alt: 0 });
    const carry = a.carryOf(me);
    const b = new Match(makeMap([{ id: 'room', tile: 'core.room', x: 0, y: 0, z: 0, rotation: 0 }]), DEFAULT_DEATHMATCH_RULES, 2);
    const again = b.addHuman('me')!;
    b.applyCarry(again, { ...carry, weapons: [...carry.weapons!, ['core.not_a_gun', 1, 1]] });
    expect(again.kills).toBe(7);
    expect(again.weapons.get(weaponCode(rocket))).toMatchObject({ mag: 1, reserve: 3 });
  });
});
