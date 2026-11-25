// Colour vision (game/colourVision.ts, teamColours.ts, teamSymbols.ts, colourSim.ts; docs/LOOK.md, "Colour vision"): the safe team
// colours stay apart under simulated colour vision, the setting is saved and applied to a match's teams, and every
// team's symbol is in the kill feed's names and the scoreboard's model.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TEAMS, type Faction } from '@tiletrigger/shared';
import { deltaE2000, hexRgb, seenDelta, simulate, type Deficiency } from '../src/game/colourSim.ts';
import { colourVision, loadColourVision, resetColourVisionCache, saveColourVision } from '../src/game/colourVision.ts';
import { TEAM_SAFE_COLOURS, teamColourFor, visionTeams } from '../src/game/teamColours.ts';
import { TEAM_SYMBOLS, teamSymbol, teamSymbolSvg } from '../src/game/teamSymbols.ts';
import { Hud } from '../src/game/hud.ts';

const store = new Map<string, string>();
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  store.clear();
  resetColourVisionCache();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
  resetColourVisionCache();
});

/** The smallest CIEDE2000 between any two of the first `n` colours, seen with any of `kinds`. */
function minGap(pal: readonly string[], n: number, kinds: readonly (Deficiency | null)[]): number {
  let min = Infinity;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (const k of kinds) min = Math.min(min, seenDelta(pal[i]!, pal[j]!, k));
  return min;
}

describe('colour-vision simulation', () => {
  it('keeps greys grey and loses the red-green axis for red-green vision', () => {
    for (const k of ['protan', 'deutan', 'tritan'] as const) {
      for (const v of [0, 128, 255]) for (const c of simulate([v, v, v], k)) expect(Math.abs(c - v)).toBeLessThan(2);
    }
    // A red and a green of about the same lightness: far apart normally, close for a deuteranope.
    expect(seenDelta('#d04a3a', '#5cc77a', null)).toBeGreaterThan(50);
    expect(seenDelta('#d04a3a', '#5cc77a', 'deutan')).toBeLessThan(20);
    // Blue and yellow fold together for a tritanope much more than for anyone else.
    expect(seenDelta('#3a8fe2', '#5ab05a', 'tritan')).toBeLessThan(seenDelta('#3a8fe2', '#5ab05a', 'deutan'));
  });

  it('measures CIEDE2000 like the reference pairs', () => {
    // Sharma, Wu & Dalal (2005) give ΔE00 for Lab pairs; checked here through sRGB: same colour 0, black and white 100.
    expect(deltaE2000([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(deltaE2000([0, 0, 0], [255, 255, 255])).toBeCloseTo(100, 0);
    expect(hexRgb('#ff8000')).toEqual([255, 128, 0]);
  });
});

describe('safe team colours', () => {
  it('keeps the two-team pair far apart under the simulations they are for, and for everyone else', () => {
    // Past 40 is a clear gap (the map's red and green a deuteranope saw: 16).
    expect(minGap(TEAM_SAFE_COLOURS.redgreen, 2, [null, 'protan', 'deutan'])).toBeGreaterThan(50);
    expect(minGap(TEAM_SAFE_COLOURS.tritan, 2, [null, 'tritan'])).toBeGreaterThan(60);
    // Both stay apart whatever someone's colour vision is.
    expect(minGap(TEAM_SAFE_COLOURS.redgreen, 2, ['tritan'])).toBeGreaterThan(40);
    expect(minGap(TEAM_SAFE_COLOURS.tritan, 2, ['protan', 'deutan'])).toBeGreaterThan(25);
  });

  it('keeps up to four teams apart, and eight with the symbols to help', () => {
    expect(minGap(TEAM_SAFE_COLOURS.redgreen, 4, [null, 'protan', 'deutan'])).toBeGreaterThan(20);
    expect(minGap(TEAM_SAFE_COLOURS.tritan, 4, [null, 'tritan'])).toBeGreaterThan(20);
    expect(minGap(TEAM_SAFE_COLOURS.redgreen, 8, [null, 'protan', 'deutan'])).toBeGreaterThan(12);
    expect(minGap(TEAM_SAFE_COLOURS.tritan, 8, [null, 'tritan'])).toBeGreaterThan(12);
    for (const pal of Object.values(TEAM_SAFE_COLOURS)) expect(new Set(pal).size).toBe(8);
  });
});

describe('the Colour vision setting', () => {
  it('is Default until chosen, and a choice is saved', () => {
    expect(colourVision()).toBe('default');
    saveColourVision('redgreen');
    expect(colourVision()).toBe('redgreen');
    expect(store.get('tiletrigger.colourVision')).toBe('redgreen');
    resetColourVisionCache();
    expect(loadColourVision()).toBe('redgreen');
    store.set('tiletrigger.colourVision', 'nonsense');
    resetColourVisionCache();
    expect(colourVision()).toBe('default');
  });

  it('gives a match its teams in the safe colours, in order, and leaves them alone with Default', () => {
    const teams: Faction[] = [{ id: 'red', name: 'Red', color: '#d04a3a', relations: {} }, { id: 'green', name: 'Green', color: '#5cc77a', relations: {} }, ...DEFAULT_TEAMS.slice(2, 4)];
    expect(visionTeams(teams, 'default')).toBe(teams);
    const rg = visionTeams(teams, 'redgreen');
    expect(rg.map((t) => t.color)).toEqual(TEAM_SAFE_COLOURS.redgreen.slice(0, 4));
    expect(rg.map((t) => t.id)).toEqual(teams.map((t) => t.id));
    expect(visionTeams(teams, 'tritan')[1]!.color).toBe(TEAM_SAFE_COLOURS.tritan[1]);
    // The saved setting is what a match reads.
    saveColourVision('tritan');
    expect(visionTeams(teams)[0]!.color).toBe(TEAM_SAFE_COLOURS.tritan[0]);
    expect(teamColourFor(9, '#123456', 'default')).toBe('#123456');
    expect(teamColourFor(9, '#123456', 'redgreen')).toBe(TEAM_SAFE_COLOURS.redgreen[1]);
  });
});

describe('team symbols', () => {
  it('gives each of eight teams its own symbol, none of them the leaders\' ★ or ◆', () => {
    expect(new Set(TEAM_SYMBOLS).size).toBe(8);
    expect(TEAM_SYMBOLS).not.toContain('★');
    expect(TEAM_SYMBOLS).not.toContain('◆');
    expect(teamSymbol(0)).toBe('▲');
    expect(teamSymbol(1)).toBe('●');
    expect(teamSymbolSvg(-1)).toBe('');
    expect(teamSymbolSvg(2, '#ff0000')).toContain('data-sym="■"');
    expect(teamSymbolSvg(2, '#ff0000')).toContain('fill="#ff0000"');
  });

  /** A Hud's scoring and naming parts without its page (its constructor builds the HUD's DOM). */
  function hudWith(teams: readonly Faction[] | null): Hud {
    const hud = Object.create(Hud.prototype) as Hud;
    const fill = (o: object) => Object.assign(hud, o);
    fill({
      roster: new Map([
        [0, { slot: 0, name: 'Ada', team: teams?.[0]?.id, bot: false, look: '' }],
        [1, { slot: 1, name: 'Bea', team: teams?.[1]?.id, bot: true, look: '' }],
      ]),
      teams,
      self: 0,
      partyColor: '#3ad1ff',
      classes: new Map(),
      pings: new Map(),
      alive: new Map(),
      leaders: new Set(),
      squadsRaw: null,
      honours: { mvp: new Map(), best: null },
      switchTeam: { can: false, pending: -1 },
      modeScores: null,
      objLabel: '',
      coop: false,
      nextMap: '',
      onlineNote: '',
      mapName: 'Test',
      modeLabel: { textContent: 'Team Deathmatch' },
      timer: { textContent: '' },
      rankCache: new Map(),
      ranks: null,
      rankPoints: () => 0,
    });
    return hud;
  }

  it('puts the team symbol in the kill feed names and the scoreboard model', () => {
    const teams = visionTeams(DEFAULT_TEAMS.slice(0, 2), 'redgreen');
    const hud = hudWith(teams);
    const feedName = (hud as unknown as { feedName(slot: number | null): string }).feedName.bind(hud);
    expect(feedName(0)).toContain('data-sym="▲"');
    expect(feedName(1)).toContain('data-sym="●"');
    expect(feedName(null)).not.toContain('tsym');
    const board = hud.boardData([{ s: 0, k: 3, d: 1 }, { s: 1, k: 1, d: 3 }] as never, 0, false);
    expect(board.kind).toBe('teams');
    expect(board.groups.map((g) => [g.sym, g.color])).toEqual([[0, TEAM_SAFE_COLOURS.redgreen[0]], [1, TEAM_SAFE_COLOURS.redgreen[1]]]);
    expect(board.groups[0]!.rows.map((r) => r.sym)).toEqual([0]);
    expect(board.groups[1]!.rows.map((r) => [r.sym, r.color])).toEqual([[1, TEAM_SAFE_COLOURS.redgreen[1]]]);
  });

  it('leaves free-for-all names without a team symbol', () => {
    const hud = hudWith(null);
    const feedName = (hud as unknown as { feedName(slot: number | null): string }).feedName.bind(hud);
    expect(feedName(0)).not.toContain('tsym');
    const board = hud.boardData([{ s: 0, k: 3, d: 1 }] as never, 0, false);
    expect(board.groups[0]!.rows[0]!.sym).toBe(-1);
  });
});
