import { describe, expect, it } from 'vitest';
import { EMBLEM_COLORS, EMBLEM_COLOR_NAMES, EMBLEM_CUTS, EMBLEM_IDS, EMBLEM_SHAPES, TITLES, cleanEmblemCode, earnedTitles, emblemCode, emptyCareer, hasTitle, parseClientMessage, readEmblem, readPublicCard, titleName } from '../src/index.ts';

describe('emblems (player profiles, Phase 2)', () => {
  it('are our own shapes in the box, each with a label and a colour', () => {
    expect(EMBLEM_IDS.length).toBeGreaterThanOrEqual(12);
    expect(EMBLEM_COLORS.length).toBe(EMBLEM_COLOR_NAMES.length);
    for (const id of EMBLEM_IDS) {
      expect(EMBLEM_SHAPES[id].length).toBeGreaterThan(0);
      for (const p of [...EMBLEM_SHAPES[id], ...EMBLEM_CUTS[id]]) {
        expect(p.length).toBeGreaterThanOrEqual(3);
        for (const [x, y] of p) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('travel as "<id>.<colour>" and refuse anything else', () => {
    expect(readEmblem('bolt.3')).toEqual({ id: 'bolt', color: 3 });
    expect(emblemCode({ id: 'star', color: 11 })).toBe('star.11');
    for (const bad of ['bolt', 'bolt.12', 'unicorn.1', 'bolt.-1', 'constructor.1', '<svg>.1', 3, null, 'x'.repeat(40)]) expect(readEmblem(bad)).toBeNull();
    expect(cleanEmblemCode('bolt.03')).toBe('bolt.3');
  });

  it('ride in a hello only when they are ours', () => {
    const hello = (extra: object) => parseClientMessage(JSON.stringify({ t: 'hello', protocol: 5, name: 'A', ...extra }));
    expect(hello({ em: 'moon.2', tt: 'recruit' })).toMatchObject({ em: 'moon.2', tt: 'recruit' });
    const bad = hello({ em: 'http://x/y.png', tt: 'emperor' }) as Record<string, unknown>;
    expect(bad.em).toBeUndefined();
    expect(bad.tt).toBeUndefined();
  });
});

describe('titles', () => {
  it('are earned from the career', () => {
    const c = emptyCareer();
    expect(earnedTitles(c)).toEqual([]);
    const one = { ...c, matches: 1, seconds: 60 };
    expect(earnedTitles(one)).toEqual(['recruit']);
    const sharp = { ...c, matches: 50, shots: 1000, hits: 420, kills: 200, deaths: 80, bestStreak: 11, seconds: 3600 };
    expect(hasTitle(sharp, 'marksman')).toBe(true);
    expect(hasTitle(sharp, 'unstoppable')).toBe(true);
    expect(hasTitle({ ...sharp, hits: 390 }, 'marksman')).toBe(false);
    expect(hasTitle({ ...c, weaponKills: { 'core.rifle': 250 } }, 'specialist')).toBe(true);
    expect(titleName('veteran')).toBe('Veteran');
    expect(titleName('nope')).toBe('');
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
  });

  it('a public card reads back with public fields only', () => {
    const card = readPublicCard({ username: 'Toshi_92', emblem: 'bolt.1', title: 'recruit', favClass: 'medic', career: { matches: 2, kills: 5 }, sub: 'secret', region: 'eu' });
    expect(card).toMatchObject({ username: 'Toshi_92', emblem: 'bolt.1', title: 'recruit', favClass: 'medic', career: { matches: 2, kills: 5 } });
    expect(card).not.toHaveProperty('sub');
    expect(readPublicCard({ username: 'ab', career: {} })).toBeNull();
    expect(readPublicCard({ error: 'no such player' })).toBeNull();
  });
});
