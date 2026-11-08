import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MapRotation, autoPlayerCaps, capsLine, loadMap, mapPlayerCaps, rulesForTravel, setupFit, type MapDocument } from '../src/index.ts';
import { readFileSync } from 'node:fs';
import { makeMap } from './helpers.ts';

const real = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(id);
  return r.map;
};

/** An open square `side` metres across with `n` shared spawn points round it (and `teamed` more for two teams). */
function square(side: number, n: number, teamed = 0, max = 16): MapDocument {
  const at: [number, number, number][] = Array.from({ length: n }, (_, i) => [Math.cos((i / n) * 6.283) * side * 0.5, 0, Math.sin((i / n) * 6.283) * side * 0.5]);
  const map = makeMap([], at);
  const extra = Array.from({ length: teamed }, (_, i) => ({ id: `t${i}`, kind: 'spawn' as const, position: [i % 2 ? side / 2 : -side / 2, 0, (i - teamed / 2) * 2] as [number, number, number], yaw: 0, faction: i % 2 ? 'b' : 'a' }));
  return { ...map, entities: [...map.entities, ...extra] as MapDocument['entities'], metadata: { ...map.metadata, recommendedPlayers: { min: 2, max }, supportedModes: ['core.deathmatch', 'core.tdm'] } };
}

describe('player caps by mode', () => {
  it('the automatic caps: recommended from the map’s most and its spawns, the most from spawns × 3, area and 3 × recommended', () => {
    // 60 m square, 12 spawns: free-for-all 12 recommended; the most 36 (spawns 36, area 3600/80 = 45, 3 × 12 = 36).
    expect(autoPlayerCaps(square(60, 12), 'core.deathmatch')).toEqual({ recommended: 12, max: 36 });
    // Few spawns: recommended as far as they go (a spawn each), and at least 2.
    expect(autoPlayerCaps(square(60, 6), 'core.deathmatch')).toEqual({ recommended: 6, max: 18 });
    // A small room: floor space limits the most (20 m: 400 m², 5 players), never below the recommended.
    const room = autoPlayerCaps(square(20, 16, 0, 8), 'core.deathmatch');
    expect(room).toEqual({ recommended: 8, max: 8 });
    // Teams: the map's recommended most (its team layout when it has one), the most even.
    const t = autoPlayerCaps(square(80, 12, 8), 'core.tdm');
    expect(t.recommended).toBe(16);
    expect(t.max % 2).toBe(0);
    expect(t.max).toBeGreaterThanOrEqual(t.recommended);
    expect(t.max).toBeLessThanOrEqual(t.recommended * 3);
  });

  it('a mode’s own caps from MapMaker win; the rest stay automatic', () => {
    const base = square(60, 12);
    const map = { ...base, metadata: { ...base.metadata, playerCaps: { 'core.deathmatch': { recommended: 10, max: 20 } } } };
    expect(mapPlayerCaps(map, 'core.deathmatch')).toEqual({ recommended: 10, max: 20, auto: false });
    expect(mapPlayerCaps(map, 'core.tdm').auto).toBe(true);
    // A most under the recommended is lifted to it.
    const odd = { ...base, metadata: { ...base.metadata, playerCaps: { 'core.deathmatch': { recommended: 12, max: 6 } } } };
    expect(mapPlayerCaps(odd, 'core.deathmatch')).toEqual({ recommended: 6, max: 6, auto: false });
    expect(capsLine({ recommended: 16, max: 48 })).toBe('16 best · up to 48');
  });

  it('the suite’s defaults: Sandgate 16 / 48 both ways, Citadel 12 / 36', () => {
    expect(mapPlayerCaps(real('sandgate'), 'core.deathmatch')).toMatchObject({ recommended: 16, max: 48 });
    expect(mapPlayerCaps(real('sandgate'), 'core.tdm')).toMatchObject({ recommended: 16, max: 48 });
    expect(mapPlayerCaps(real('citadel'), 'core.deathmatch')).toMatchObject({ recommended: 12, max: 36 });
  });

  it('Match Setup’s fit check shows them; over the most is a problem with a fix', () => {
    const map = square(60, 12);
    const ok = setupFit({ mode: 'core.deathmatch', bots: 9 } as never, map, { deviceMax: 64 });
    expect(ok.items.find((i) => i.topic === 'caps')?.level).toBe('ok');
    const busy = setupFit({ mode: 'core.deathmatch', bots: 40 } as never, map, { deviceMax: 64 });
    const item = busy.items.find((i) => i.topic === 'caps')!;
    expect(item.level).toBe('problem');
    expect(item.fix?.players).toBe(12);
  });

  it('a map change keeps the fill within the map’s most; the rotation passes maps too small for the people in it', () => {
    const small = square(20, 16, 0, 8);
    const next = rulesForTravel(DEFAULT_RULES['core.deathmatch'], small, 30, 'core.deathmatch');
    expect(next.fill).toBe(8);
    const team = rulesForTravel(DEFAULT_RULES['core.tdm'], square(80, 12, 8), 200, 'core.tdm');
    expect(team.fill).toBeLessThanOrEqual(mapPlayerCaps(square(80, 12, 8), 'core.tdm').max);
    const rot = new MapRotation([{ map: 'a', mode: 'core.deathmatch' }, { map: 'b', mode: 'core.deathmatch' }, { map: 'c', mode: 'core.deathmatch' }]);
    const most: Record<string, number> = { a: 8, b: 4, c: 24 };
    rot.advance();
    // Next is b (4 at most) with 10 people: on to c.
    expect(rot.peekFitting((e) => most[e.map]! >= 10)?.entry.map).toBe('c');
    // Nothing fits: the next one as it comes.
    expect(rot.peekFitting(() => false)).not.toBeNull();
  });
});
