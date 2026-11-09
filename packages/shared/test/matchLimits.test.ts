import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  SCORE_LIMIT_MAX,
  applyParty,
  initPhysics,
  limitsScale,
  niceScore,
  normalizeSetup,
  parseClientMessage,
  PARTY_PRESETS,
  rulesForTravel,
  rulesFromSetup,
  scoreStep,
  setupLimits,
  sizePresets,
  squadRoom,
  suggestedLimits,
  withPending,
  withSetupLimits,
  type GameMode,
  type MapDocument,
  type MatchSetup,
} from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

/** A map like St. John's: made for 8–32, its own layout 12v12, 41 spawn points. */
function campus(): MapDocument {
  const at: [number, number, number][] = Array.from({ length: 41 }, (_, i) => [(i % 8) * 6, 0, Math.floor(i / 8) * 6]);
  const map = makeMap([], at);
  return { ...map, metadata: { ...map.metadata, recommendedPlayers: { min: 8, max: 32 }, supportedModes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim'], playerCaps: { 'core.tdm': { recommended: 24, max: 64 } } }, teamSetup: { sizes: [12, 12] } };
}

/** A co-op mission made for 1–4 (no team layout). */
function mission(): MapDocument {
  const map = makeMap([], [[0, 0, 0], [4, 0, 0], [8, 0, 0], [12, 0, 0]]);
  return { ...map, metadata: { ...map.metadata, recommendedPlayers: { min: 1, max: 4 }, supportedModes: ['core.coop'] } };
}

/** A walled yard with spawn points, for a match that runs. */
function yard(): MapDocument {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const at: [number, number, number][] = Array.from({ length: 8 }, (_, i) => [(i % 6) * 8 + 2, 0, Math.floor(i / 6) * 4 + 2]);
  const map = makeMap(tiles, at);
  return { ...map, metadata: { ...map.metadata, recommendedPlayers: { min: 2, max: 8 }, supportedModes: ['core.tdm', 'core.deathmatch'] } };
}

const setup = (over: Partial<MatchSetup> = {}): MatchSetup => ({ map: 'st_johns', mode: 'core.tdm', bots: 11, skill: 'normal', scoreLimit: 40, minutes: 10, scoreAuto: true, timeAuto: true, ...over });

describe('the suggested score and time per mode (fitted to bot-report scoring rates: docs/BOTS.md, "Score and time")', () => {
  const tdm = (n: number) => suggestedLimits('core.tdm', 2 * n, [n, n]);

  it('Team Deathmatch: a point per player per minute of the time limit, meeting the owner’s anchors', () => {
    const table = (ns: number[]) => ns.map((n) => `${n}v${n} ${tdm(n).scoreLimit}/${tdm(n).minutes}`).join(', ');
    expect(table([1, 2, 4, 6])).toBe('1v1 10/10, 2v2 20/10, 4v4 40/10, 6v6 60/10');
    expect(table([7, 8, 12, 16])).toBe('7v7 110/15, 8v8 120/15, 12v12 180/15, 16v16 240/15');
    expect(table([17, 24, 32, 48])).toBe('17v17 350/20, 24v24 500/20, 32v32 650/20, 48v48 950/20');
    // The owner's anchors (2026-11-06): 4v4 about 40 points in 10 minutes; 24v24 about 500 in 15–20.
    expect(tdm(4)).toEqual({ scoreLimit: 40, minutes: 10 });
    expect(tdm(24)).toEqual({ scoreLimit: 500, minutes: 20 });
    // It only grows with the teams.
    for (let n = 2; n <= 48; n++) expect(tdm(n).scoreLimit).toBeGreaterThanOrEqual(tdm(n - 1).scoreLimit);
    // Uneven or many teams: the largest team leads the score.
    expect(suggestedLimits('core.tdm', 24, [2, 2, 2, 2, 2, 2, 12])).toEqual(tdm(12));
    expect(suggestedLimits('core.tdm', 16, [4, 4, 4, 4])).toEqual(tdm(4));
    // Without the teams, two even ones.
    expect(suggestedLimits('core.tdm', 48)).toEqual(tdm(24));
  });

  it('Deathmatch: the leader’s kills, gently up with the players (12 × √players), 10 minutes', () => {
    expect([1, 2, 4, 8, 12, 16, 32, 48].map((n) => suggestedLimits('core.deathmatch', n).scoreLimit)).toEqual([10, 15, 25, 35, 40, 50, 70, 80]);
    for (const n of [2, 12, 48]) expect(suggestedLimits('core.deathmatch', n).minutes).toBe(10);
  });

  it('Capture the Flag keeps its 3 captures and King of the Hill 12 hill seconds a minute; their time grows with the teams', () => {
    expect([4, 8, 16, 24].map((n) => suggestedLimits('core.ctf', 2 * n, [n, n]))).toEqual([3, 3, 3, 3].map((s, i) => ({ scoreLimit: s, minutes: [10, 15, 15, 20][i] })));
    expect([4, 8, 16, 24].map((n) => suggestedLimits('core.koth', 2 * n, [n, n]))).toEqual([{ scoreLimit: 120, minutes: 10 }, { scoreLimit: 180, minutes: 15 }, { scoreLimit: 180, minutes: 15 }, { scoreLimit: 240, minutes: 20 }]);
  });

  it('rounds, missions, Fort Wars and Disc Arena keep their own score and the usual 10 minutes', () => {
    const own: GameMode[] = ['core.elim', 'core.bomb', 'core.hostage', 'core.coop', 'core.zombies', 'core.forts', 'core.discs'];
    for (const mode of own) {
      expect(limitsScale(mode)).toBe(false);
      for (const n of [8, 48]) expect(suggestedLimits(mode, n, [n / 2, n / 2])).toEqual({ scoreLimit: DEFAULT_RULES[mode].scoreLimit, minutes: 10 });
    }
    expect((['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth'] as GameMode[]).every(limitsScale)).toBe(true);
  });
});

describe('score steps', () => {
  it('step by 5, 10, 50 and 100 as scores grow, and round a worked-out score to its step', () => {
    expect([10, 49, 50, 299, 300, 999, 1000].map(scoreStep)).toEqual([5, 5, 10, 10, 50, 50, 100]);
    expect([43, 96, 168, 256, 480, 1536].map(niceScore)).toEqual([45, 100, 170, 260, 500, 1500]);
    expect(niceScore(1)).toBe(5);
    expect(niceScore(99999)).toBe(SCORE_LIMIT_MAX);
  });
});

describe('the score and time a setup plays: suggested, or the host’s own', () => {
  it('follow the size while they are suggested: a bigger match suggests more, and the rules play it', () => {
    const map = campus();
    const small = setupLimits(setup({ teams: [4, 4] }), map);
    const big = setupLimits(setup({ teams: [24, 24] }), map);
    expect(small).toMatchObject({ ...suggestedLimits('core.tdm', 8, [4, 4]), auto: { score: true, time: true } });
    expect(big.scoreLimit).toBe(suggestedLimits('core.tdm', 48, [24, 24]).scoreLimit);
    expect(big.scoreLimit).toBeGreaterThan(small.scoreLimit * 5);
    expect(big.minutes).toBeGreaterThan(small.minutes);
    expect(rulesFromSetup(setup({ teams: [24, 24] }), map).rules).toMatchObject({ scoreLimit: big.scoreLimit, timeLimitSeconds: big.minutes * 60 });
  });

  it('set by hand they stay (Custom) whatever the size, each on its own', () => {
    const map = campus();
    const custom = setup({ teams: [24, 24], scoreLimit: 75, scoreAuto: false });
    const l = setupLimits(custom, map);
    expect(l).toMatchObject({ scoreLimit: 75, minutes: suggestedLimits('core.tdm', 48, [24, 24]).minutes, auto: { score: false, time: true } });
    expect(setupLimits({ ...custom, teams: [4, 4] }, map).scoreLimit).toBe(75);
    expect(rulesFromSetup(custom, map).rules.scoreLimit).toBe(75);
    // Back to suggested: both follow the size again.
    expect(setupLimits({ ...custom, scoreAuto: true, timeAuto: true }, map).scoreLimit).toBe(suggestedLimits('core.tdm', 48, [24, 24]).scoreLimit);
    // A time of your own (∞ too) stays the same way.
    expect(rulesFromSetup(setup({ teams: [24, 24], minutes: 0, timeAuto: false }), map).rules.timeLimitSeconds).toBe(0);
  });

  it('a setup built without the marks (in code, a console) plays its own score and time, as before', () => {
    const plain: MatchSetup = { map: 'st_johns', mode: 'core.tdm', bots: 3, skill: 'normal', scoreLimit: 40, minutes: 10, teams: [24, 24] };
    expect(rulesFromSetup(plain, campus()).rules).toMatchObject({ scoreLimit: 40, timeLimitSeconds: 600 });
  });

  it('suggests for what plays here: a setup saved on a computer at 24v24 suggests for 8v8 on a phone', () => {
    const map = campus();
    const s = setup({ teams: [24, 24] });
    expect(setupLimits(s, map, 16)).toMatchObject(suggestedLimits('core.tdm', 16, [8, 8]));
    expect(rulesFromSetup(s, map, 16).rules.scoreLimit).toBe(suggestedLimits('core.tdm', 16, [8, 8]).scoreLimit);
  });

  it('saved setups keep working: an explicit score or time stays; the old defaults follow the size', () => {
    const old = (over: Record<string, unknown>) => normalizeSetup({ map: 'st_johns', mode: 'core.tdm', bots: 3, skill: 'normal', scoreLimit: 40, minutes: 10, teams: [24, 24], ...over })!;
    // From before suggestions: 40 and 10 minutes were where every setup started, so they follow; anything else was chosen.
    expect(old({})).toMatchObject({ scoreAuto: true, timeAuto: true });
    expect(old({ scoreLimit: 75 })).toMatchObject({ scoreAuto: false, timeAuto: true });
    expect(old({ minutes: 25 })).toMatchObject({ scoreAuto: true, timeAuto: false });
    expect(old({ mode: 'core.ctf', scoreLimit: 3 })).toMatchObject({ scoreAuto: true });
    expect(old({ mode: 'core.ctf', scoreLimit: 5 })).toMatchObject({ scoreAuto: false });
    expect(rulesFromSetup(old({ scoreLimit: 75 }), campus()).rules.scoreLimit).toBe(75);
    // Saved by this version: the marks are kept as saved (a hand-set 40 stays 40 at 24v24).
    expect(old({ scoreAuto: false })).toMatchObject({ scoreLimit: 40, scoreAuto: false });
    expect(rulesFromSetup(old({ scoreAuto: false }), campus()).rules.scoreLimit).toBe(40);
    expect(old({ scoreLimit: 500, scoreAuto: true, timeAuto: false, minutes: 30 })).toMatchObject({ scoreAuto: true, timeAuto: false, minutes: 30 });
    // A mode the map can't play falls back: a score for it means nothing there.
    expect(normalizeSetup({ map: 'st_johns', mode: 'core.race', bots: 3, skill: 'normal', scoreLimit: 9, minutes: 10, scoreAuto: false }, ['core.tdm'])).toMatchObject({ mode: 'core.tdm', scoreAuto: true });
    // Big scores are kept (the old cap was 1,000).
    expect(old({ scoreLimit: 1500, scoreAuto: false }).scoreLimit).toBe(1500);
  });

  it('stores what it plays, for saving (the rest of the setup untouched)', () => {
    const map = campus();
    const s = setup({ teams: [24, 24] });
    const saved = withSetupLimits(s, map);
    expect(saved).toMatchObject({ ...s, scoreLimit: suggestedLimits('core.tdm', 48, [24, 24]).scoreLimit, minutes: suggestedLimits('core.tdm', 48, [24, 24]).minutes });
    expect(withSetupLimits(saved, map)).toBe(saved);
  });

  it('a party preset that changes the mode puts the score back on the suggestion (a score for another mode means nothing)', () => {
    const map = campus();
    const lunar = PARTY_PRESETS.find((p) => p.id === 'lunar_roulette')!;
    const s = applyParty(lunar, setup({ mode: 'core.ctf', scoreLimit: 5, scoreAuto: false, minutes: 30, timeAuto: false, teams: [2, 2] }), map, ['core.tdm', 'core.ctf', 'core.roulette'], { deviceMax: 48 })!;
    expect(s).toMatchObject({ mode: 'core.roulette', scoreAuto: true, minutes: 30, timeAuto: false });
    expect(setupLimits(s, map).scoreLimit).toBe(suggestedLimits('core.roulette', s.bots + 1).scoreLimit);
  });
});

describe('co-op size presets stop at the map’s size', () => {
  const values = (ps: { value: string }[]) => ps.map((p) => p.value).join(' ');

  it('no squad beyond the map’s team layout or its recommended most', () => {
    // St. John's layout is 12v12: 24 in all. (Before: Big squad 24, Max 48.)
    const zombies = sizePresets('core.zombies', campus(), { deviceMax: 48 });
    expect(zombies.map((p) => p.label).join()).toBe("Solo,Duo,Map's pick,Max");
    expect(values(zombies)).toBe('you alone you + 1 squad of 12 squad of 24');
    // A mission made for 1–4: the Arcade starts it with 4, and nothing beyond.
    const coop = sizePresets('core.coop', mission(), { deviceMax: 48, pickPlayers: 4 });
    expect(values(coop)).toBe('you alone you + 1 squad of 4');
    expect(Math.max(...coop.map((p) => p.players!))).toBe(4);
    // A phone's limit still comes first.
    expect(squadRoom(campus(), 16)).toBe(16);
    expect(sizePresets('core.zombies', campus(), { deviceMax: 16, device: 'this phone' }).find((p) => p.id === 'max')).toMatchObject({ players: 16, tip: 'The most this phone runs: 16.' });
  });
});

describe('Save for next match', () => {
  const start = (mode: GameMode = 'core.tdm') => {
    const map = yard();
    const { rules, fill } = rulesFromSetup(setup({ map: 'yard', mode, teams: [2, 2], scoreAuto: false, timeAuto: false }), map);
    const match = new Match(map, rules, 5);
    match.addHuman('You');
    const bots = new BotFiller(match);
    bots.rebalance(fill);
    return { match, bots, control: new HostControl(match, bots, fill) };
  };

  it('keeps changed rules for the next match: this one carries on, the next round plays them', () => {
    const { match, control } = start();
    let told = 0;
    control.onNextRules = () => told++;
    expect(control.apply({ c: 'rules', rules: { scoreLimit: 60, timeLimitSeconds: 900 } }).notice).toBe('Host changed the rules for the next match');
    expect(match.rules).toMatchObject({ scoreLimit: 40, timeLimitSeconds: 600 });
    expect(control.state().pending).toEqual({ scoreLimit: 60, timeLimitSeconds: 900 });
    expect(control.nextRules()).toMatchObject({ scoreLimit: 60, timeLimitSeconds: 900 });
    // The match ends (score, time or the host): after the scoreboard the next one starts with them.
    expect(match.endMatch()).toBe(true);
    while (match.phase === 'intermission') match.step();
    expect(match.phase).toBe('playing');
    expect(match.rules).toMatchObject({ scoreLimit: 60, timeLimitSeconds: 900 });
    expect(control.state().pending).toEqual({});
    expect(match.timeLeftSeconds()).toBe(900);
    // The host is told once, to send everyone the rules in play (HUDs) and its panel the settings.
    expect(told).toBe(1);
  });

  it('Restart match plays them at once (Apply & restart); a rule set back to what plays cancels it', () => {
    const { match, control } = start();
    control.apply({ c: 'rules', rules: { scoreLimit: 60, friendlyFire: 'half' } });
    control.apply({ c: 'rules', rules: { scoreLimit: 40 } });
    expect(control.state().pending).toEqual({ friendlyFire: 'half' });
    control.apply({ c: 'restart' });
    expect(match.rules).toMatchObject({ scoreLimit: 40, friendlyFire: 'half' });
    expect(control.state().pending).toEqual({});
    // Friendly fire back off at the next match: the rule goes (off is the default).
    control.apply({ c: 'rules', rules: { friendlyFire: 'off' } });
    control.apply({ c: 'restart' });
    expect(match.rules.friendlyFire).toBeUndefined();
  });

  it('a map change and the rotation take the saved rules along (withPending)', () => {
    const { match, control } = start();
    control.apply({ c: 'rules', rules: { scoreLimit: 70, respawnDelayTicks: 300 } });
    const next = rulesForTravel(control.nextRules(), yard(), control.fill, 'core.tdm', 2);
    expect(next.rules).toMatchObject({ scoreLimit: 70, respawnDelayTicks: 300 });
    expect(withPending(match.rules, null)).toBe(match.rules);
    expect(withPending({ ...match.rules, friendlyFire: 'on' }, { friendlyFire: 'off' }).friendlyFire).toBeUndefined();
  });

  it('scores past the old cap of 1,000 get through, up to SCORE_LIMIT_MAX', () => {
    const { control } = start();
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { scoreLimit: 1500 } } }))).toEqual({ t: 'host', cmd: { c: 'rules', rules: { scoreLimit: 1500 } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { scoreLimit: SCORE_LIMIT_MAX + 1 } } }))).toBeNull();
    control.apply({ c: 'rules', rules: { scoreLimit: 1500 } });
    expect(control.state().pending).toEqual({ scoreLimit: 1500 });
  });
});

describe('a map change to another mode', () => {
  it('suggests that mode’s score and time for the players, instead of its standard ones', () => {
    const map = campus();
    const tdm = rulesForTravel({ ...DEFAULT_RULES['core.deathmatch'], scoreLimit: 30 }, map, 48, 'core.tdm');
    expect(tdm.fill).toBe(48);
    expect(tdm.rules).toMatchObject({ scoreLimit: suggestedLimits('core.tdm', 48, [24, 24]).scoreLimit, timeLimitSeconds: suggestedLimits('core.tdm', 48, [24, 24]).minutes * 60 });
    // The same mode keeps the host's own.
    expect(rulesForTravel({ ...DEFAULT_RULES['core.tdm'], scoreLimit: 75, timeLimitSeconds: 1200 }, map, 48, 'core.tdm').rules).toMatchObject({ scoreLimit: 75, timeLimitSeconds: 1200 });
    // Rounds modes keep their own.
    expect(rulesForTravel(DEFAULT_RULES['core.tdm'], map, 48, 'core.elim').rules.scoreLimit).toBe(DEFAULT_RULES['core.elim'].scoreLimit);
  });
});
