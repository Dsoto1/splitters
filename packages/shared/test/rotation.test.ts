import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MapRotation, ROTATION_MAX, isRetiredMap, loadMap, nextMapLine, parseClientMessage, parseRotationItem, parseRotationPreset, playableModes, rotationItem, validateRotation, type GameMode, type RotationEntry, type RotationLookup } from '../src/index.ts';

const mapsDir = new URL('../../../maps/', import.meta.url);
const suite = new Set(readdirSync(mapsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));

/** A tiny suite: names and playable modes. */
const MAPS: Record<string, { name: string; modes: GameMode[] }> = {
  frost_basin: { name: 'Frost Basin', modes: ['core.tdm', 'core.deathmatch', 'core.elim', 'core.zombies'] },
  diamond_park: { name: 'Diamond Park', modes: ['core.tdm', 'core.ctf', 'core.koth'] },
  atomic_court: { name: 'Atomic Court', modes: ['core.deathmatch', 'core.tdm'] },
  clockwork: { name: 'Clockwork', modes: ['core.deathmatch'] },
};
const lookup: RotationLookup = (id) => MAPS[id] ?? null;
const e = (map: string, mode: GameMode): RotationEntry => ({ map, mode });
/** A seeded random source, so shuffles repeat. */
const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

describe('map rotation', () => {
  it('plays the entries in order after each match and wraps round at the end', () => {
    const r = new MapRotation([e('frost_basin', 'core.tdm'), e('diamond_park', 'core.ctf'), e('atomic_court', 'core.deathmatch')]);
    expect(r.current).toBeNull();
    expect(r.peek()?.entry).toEqual(e('frost_basin', 'core.tdm'));
    expect(r.advance()).toEqual(e('frost_basin', 'core.tdm'));
    expect(r.advance()).toEqual(e('diamond_park', 'core.ctf'));
    expect(r.current).toBe(1);
    expect(r.advance()).toEqual(e('atomic_court', 'core.deathmatch'));
    // Round again.
    expect(r.peek()?.index).toBe(0);
    expect(r.advance()).toEqual(e('frost_basin', 'core.tdm'));
    expect(r.state((id) => MAPS[id]!.name)).toMatchObject({ next: 1, current: 0, shuffle: false, entries: [{ name: 'Frost Basin' }, { name: 'Diamond Park' }, { name: 'Atomic Court' }] });
  });

  it('an empty rotation has no next map (the match replays, as before)', () => {
    const r = new MapRotation();
    expect(r.empty).toBe(true);
    expect(r.peek()).toBeNull();
    expect(r.advance()).toBeNull();
    expect(r.state((id) => id)).toEqual({ entries: [], shuffle: false, next: null, current: null });
  });

  it('skip moves on now; a one-map rotation plays that map every time', () => {
    const r = new MapRotation([e('clockwork', 'core.deathmatch')]);
    expect(r.advance()).toEqual(e('clockwork', 'core.deathmatch'));
    expect(r.advance()).toEqual(e('clockwork', 'core.deathmatch'));
    const two = new MapRotation([e('clockwork', 'core.deathmatch'), e('atomic_court', 'core.tdm')]);
    two.advance();
    // "Skip to next" is an advance mid-match: the one after the current.
    expect(two.advance()).toEqual(e('atomic_court', 'core.tdm'));
  });

  it('editing the list keeps the map playing now, so the next is the one after it', () => {
    const r = new MapRotation([e('frost_basin', 'core.tdm'), e('diamond_park', 'core.ctf'), e('atomic_court', 'core.tdm')]);
    r.advance(); // Frost Basin plays.
    // Moved down, with a map added in front: still current, and the next is what follows it now.
    r.set([e('clockwork', 'core.deathmatch'), e('diamond_park', 'core.ctf'), e('frost_basin', 'core.tdm'), e('atomic_court', 'core.tdm')]);
    expect(r.current).toBe(2);
    expect(r.peek()?.entry).toEqual(e('atomic_court', 'core.tdm'));
    // Removed: start from the top.
    r.set([e('diamond_park', 'core.ctf'), e('atomic_court', 'core.tdm')]);
    expect(r.current).toBeNull();
    expect(r.peek()?.entry).toEqual(e('diamond_park', 'core.ctf'));
    // Set while a map of its own plays that is in the list: it carries on from there.
    const fresh = new MapRotation();
    fresh.set([e('frost_basin', 'core.tdm'), e('diamond_park', 'core.ctf')], e('frost_basin', 'core.tdm'));
    expect(fresh.peek()?.entry).toEqual(e('diamond_park', 'core.ctf'));
  });

  it('shuffle plays every entry once per round, in a new order each round, never the same map twice in a row', () => {
    const list = Object.keys(MAPS).map((map) => e(map, MAPS[map]!.modes[0]!));
    const r = new MapRotation(list, { shuffle: true }, seeded(7));
    const played: string[] = [];
    for (let i = 0; i < list.length * 6; i++) {
      // What peek says is what comes.
      const want = r.peek()!.entry;
      const got = r.advance()!;
      expect(got).toEqual(want);
      played.push(got.map);
    }
    const rounds = Array.from({ length: 6 }, (_, i) => played.slice(i * list.length, (i + 1) * list.length));
    for (const round of rounds) expect([...round].sort()).toEqual(Object.keys(MAPS).sort());
    for (let i = 1; i < played.length; i++) expect(played[i]).not.toBe(played[i - 1]);
    expect(new Set(rounds.map((x) => x.join())).size).toBeGreaterThan(1);
    // Turning it off keeps the current map; the next is the listed one after it.
    const now = r.current!;
    r.setShuffle(false);
    expect(r.current).toBe(now);
    expect(r.peek()?.index).toBe((now + 1) % list.length);
  });

  it('drops unknown maps and modes a map cannot play, each with a reason, and holds at most 20', () => {
    const v = validateRotation(['frost_basin:tdm', 'diamond_park:core.ctf', 'clockwork:ctf', 'somebody_elses_map:tdm', '../secrets', 'atomic_court', 'frost_basin:nonsense', { map: 'diamond_park', mode: 'core.koth' }], lookup);
    expect(v.entries).toEqual([e('frost_basin', 'core.tdm'), e('diamond_park', 'core.ctf'), e('atomic_court', 'core.deathmatch'), e('diamond_park', 'core.koth')]);
    expect(v.dropped).toHaveLength(4);
    expect(v.dropped.join('\n')).toMatch(/Clockwork can't play Capture the Flag/);
    expect(v.dropped.join('\n')).toMatch(/somebody_elses_map is not one of our maps/);
    expect(v.dropped.join('\n')).toMatch(/not a map ID/);
    expect(v.dropped.join('\n')).toMatch(/not a mode/);
    const many = validateRotation(Array.from({ length: 25 }, () => 'clockwork'), lookup);
    expect(many.entries).toHaveLength(ROTATION_MAX);
    expect(many.dropped).toHaveLength(5);
    expect(validateRotation('frost_basin', lookup).entries).toEqual([]);
    expect(parseRotationItem('frost_basin:tdm')).toEqual({ map: 'frost_basin', mode: 'core.tdm' });
    expect(rotationItem(e('frost_basin', 'core.tdm'))).toBe('frost_basin:tdm');
    expect(nextMapLine('Diamond Park', 'core.ctf')).toBe('Next map: Diamond Park (Capture the Flag)');
  });

  it('host commands for the rotation are checked for shape (the host checks the maps)', () => {
    const cmd = (c: unknown) => parseClientMessage(JSON.stringify({ t: 'host', cmd: c }));
    expect(cmd({ c: 'rotation', entries: [{ map: 'frost_basin', mode: 'core.tdm' }], shuffle: true })).toEqual({ t: 'host', cmd: { c: 'rotation', entries: [{ map: 'frost_basin', mode: 'core.tdm' }], shuffle: true } });
    expect(cmd({ c: 'rotation', shuffle: false })).toEqual({ t: 'host', cmd: { c: 'rotation', shuffle: false } });
    expect(cmd({ c: 'skip' })).toEqual({ t: 'host', cmd: { c: 'skip' } });
    expect(cmd({ c: 'rotation', entries: [{ map: '../x', mode: 'core.tdm' }] })).toBeNull();
    expect(cmd({ c: 'rotation', entries: [{ map: 'frost_basin', mode: 'core.nope' }] })).toBeNull();
    expect(cmd({ c: 'rotation', entries: Array.from({ length: 21 }, () => ({ map: 'frost_basin', mode: 'core.tdm' })) })).toBeNull();
    expect(cmd({ c: 'rotation', shuffle: 'yes' })).toBeNull();
  });

  it('the built-in presets (maps/rotations) are valid: maps of our suite, not retired, each in a mode it plays', () => {
    const dir = new URL('rotations/', mapsDir);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    const families = new Set<string>();
    for (const f of files) {
      const p = parseRotationPreset(JSON.parse(readFileSync(new URL(f, dir), 'utf8')), suite);
      expect(p, f).not.toBeNull();
      expect(`${p!.id}.json`).toBe(f);
      families.add(p!.family);
      for (const m of p!.maps) {
        expect(isRetiredMap(m.map), `${f}: ${m.map}`).toBe(false);
        const loaded = loadMap(readFileSync(new URL(`${m.map}.json`, mapsDir), 'utf8'));
        expect(loaded.ok, m.map).toBe(true);
        if (loaded.ok) expect(playableModes(loaded.map), `${f}: ${m.map} in ${m.mode}`).toContain(m.mode);
      }
    }
    expect([...families].sort()).toEqual(expect.arrayContaining(['ffa', 'objective', 'teams']));
  });
});
