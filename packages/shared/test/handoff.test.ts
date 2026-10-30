import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, HANDOFF_FOLLOW_SECONDS, HANDOFF_JOIN_SECONDS, MAX_CHECKPOINT_CHARS, handoffKey, initPhysics, keepJoining, parseCheckpoint, parseClientMessage, type JoinTry, type MatchCheckpoint } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

/** A team match the old host ran: the host, two friends (Ann, Bo) and bots, with scores and a clock running. */
function hostMatch() {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3], timeLimitSeconds: 600 }, 5);
  const bots = new BotFiller(match);
  const host = bots.join('Hosty', undefined, 6)!;
  const ann = bots.join('Ann', undefined, 6)!;
  const bo = bots.join('Bo', undefined, 6)!;
  const control = new HostControl(match, bots, 6);
  for (let i = 0; i < 40; i++) match.step();
  ann.kills = 7;
  ann.deaths = 2;
  bo.kills = 3;
  host.kills = 5;
  const keys = new Map([
    [host.slot, 'pk:p_hostkey123'],
    [ann.slot, 'pk:p_annkey1234'],
    [bo.slot, 'sub:bo-account'],
  ]);
  const players = match.checkpointPlayers((c) => (keys.has(c.slot) ? handoffKey(keys.get(c.slot)!) : null), ann.slot);
  const cp: MatchCheckpoint = { v: 1, map: match.map.metadata.id, rules: match.rules, phase: match.phase, timeLeft: match.timeLeftSeconds(), fill: control.fill, skill: bots.skill.id, players, banned: [handoffKey('pk:p_banned1234')], listing: { name: 'Friday' } };
  return { match, host, ann, bo, cp };
}

describe('host handoff checkpoints', () => {
  it('keys are hashed (never the key itself), stable, and hashed once only', () => {
    const k = handoffKey('pk:p_annkey1234');
    expect(k).toMatch(/^h:[0-9a-f]{32}$/);
    expect(k).not.toContain('annkey');
    expect(handoffKey('pk:p_annkey1234')).toBe(k);
    expect(handoffKey(k)).toBe(k);
    expect(handoffKey('pk:p_other12345')).not.toBe(k);
  });

  it('encode → decode keeps the match as it stood', () => {
    const { cp, ann } = hostMatch();
    const back = parseCheckpoint(JSON.stringify(cp));
    expect(back).toEqual(JSON.parse(JSON.stringify(cp)));
    expect(back!.players).toHaveLength(6);
    const a = back!.players.find((p) => p.name === 'Ann')!;
    expect(a).toMatchObject({ kind: 'human', succ: 1, k: 7, d: 2, team: ann.faction, alive: true });
    expect(a.p).toHaveLength(3);
    expect(a.w!.length).toBeGreaterThan(0);
    expect(back!.players.filter((p) => p.kind === 'bot').every((p) => !p.key)).toBe(true);
    // The checkpoint's JSON carries no player's key, only their hashes.
    expect(JSON.stringify(cp)).not.toMatch(/p_annkey|bo-account|p_hostkey/);
  });

  it('refuses or bounds what is off', () => {
    const { cp } = hostMatch();
    expect(parseCheckpoint('{')).toBeNull();
    expect(parseCheckpoint({ ...cp, v: 2 })).toBeNull();
    expect(parseCheckpoint({ ...cp, rules: { ...cp.rules, mode: 'core.nonsense' } })).toBeNull();
    expect(parseCheckpoint({ ...cp, players: new Array(200).fill(cp.players[0]) })).toBeNull();
    expect(parseCheckpoint('x'.repeat(MAX_CHECKPOINT_CHARS + 1))).toBeNull();
    const odd = parseCheckpoint({ ...cp, players: [{ ...cp.players[0], name: 'A\u0000b', k: 1e12, hp: -5, key: 'pk:raw', w: [['core.pistol', 1e9, 5], 'junk'] }], banned: ['pk:raw', handoffKey('x')], listing: { name: 'L', id: 'abc123', secret: 'deadbeef' } })!;
    expect(odd.players[0]).toMatchObject({ name: 'Ab', k: 100_000, hp: 0 });
    expect(odd.players[0]!.key).toBeUndefined();
    expect(odd.players[0]!.w).toEqual([['core.pistol', 10_000, 5]]);
    expect(odd.banned).toEqual([handoffKey('x')]);
    // Only the listing's name: never its ID or secret (the successor can't touch the host's listing).
    expect(odd.listing).toEqual({ name: 'L' });
  });

  it('a friend can only answer a standby request with a join code', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'standby', code: 'ABC234' }))).toEqual({ t: 'standby', code: 'ABC234' });
    expect(parseClientMessage(JSON.stringify({ t: 'standby', code: 'abc' }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'standby', code: 'ABCDE1' }))).toBeNull();
  });

  it('the successor restores it: teams, scores, weapons, positions, the clock; the others wait as away players', () => {
    const { cp, ann, bo } = hostMatch();
    const match = new Match(yard(), cp.rules, 9, { startGate: true });
    const bots = new BotFiller(match);
    const me = bots.restore(cp, cp.fill, { name: 'Ann' })!;
    match.resume(cp.phase, cp.timeLeft - 2, cp.teams);
    expect(match.phase).toBe('playing');
    expect(match.timeLeftSeconds()).toBe(cp.timeLeft - 2);
    expect(match.combatants()).toHaveLength(6);
    // The successor plays its own place.
    expect(me).toMatchObject({ kind: 'human', name: 'Ann', kills: 7, deaths: 2, faction: ann.faction });
    expect(me.move.pos.x).toBeCloseTo(ann.move.pos.x, 1);
    expect(me.move.pos.z).toBeCloseTo(ann.move.pos.z, 1);
    expect([...me.weapons.values()].map((w) => w.def.id).sort()).toEqual([...ann.weapons.values()].map((w) => w.def.id).sort());
    // Bo and the old host: bots keep their places, held for their keys (hashed).
    const boHeld = match.combatants().find((c) => c.away?.name === 'Bo')!;
    expect(boHeld).toMatchObject({ kind: 'bot', kills: 3, faction: bo.faction });
    expect(boHeld.away).toMatchObject({ why: 'dropped', key: handoffKey('sub:bo-account') });
    expect(match.combatants().find((c) => c.away?.name === 'Hosty')?.kills).toBe(5);
    // Bo reconnects: the hashed key of their account takes the place back, score and team as they were.
    expect(bots.reclaim('sub:bo-account', 'Bo')).toBeNull();
    const boBack = bots.reclaim(handoffKey('sub:bo-account'), 'Bo')!;
    expect(boBack).toMatchObject({ kind: 'human', name: 'Bo', kills: 3, faction: bo.faction });
    // The teams are still the sizes they were.
    const teams = match.teams!.map((t) => match.combatants().filter((c) => c.faction === t.id).length);
    expect(teams).toEqual([3, 3]);
    // And it plays on.
    for (let i = 0; i < 20; i++) match.step();
    expect(match.phase).toBe('playing');
  });

  it('objective modes get their team scores back', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.elim'], teamSizes: [2, 2] }, 2, {});
    const teams = match.teams!.map((t) => t.id);
    match.resume('playing', 100, [[teams[0]!, 2], [teams[1]!, 1]]);
    expect([...match.teamScores().values()]).toEqual([2, 1]);
  });

  describe('following the successor (keepJoining)', () => {
    // A pretend clock: each try takes `ms` of it, and so does each pause.
    const run = (results: (JoinTry & { ms?: number })[], until: number) => {
      let t = 0;
      const lefts: number[] = [];
      const done = keepJoining(
        async (left) => {
          lefts.push(left);
          const r = results[Math.min(lefts.length - 1, results.length - 1)]!;
          t += r.ms ?? HANDOFF_JOIN_SECONDS * 1000;
          return r;
        },
        { until, now: () => t, sleep: async (ms) => void (t += ms) },
      );
      return done.then((r) => ({ ...r, lefts }));
    };
    const noAnswer = { ok: false, reason: 'no answer within 10 s' };

    it('keeps trying while the successor is busy starting the match, and gets in', async () => {
      // The bug: one 10 s try, then the host-left screen, while the successor held our place for two minutes.
      const r = await run([noAnswer, noAnswer, { ok: false, reason: "found the game but couldn't connect to it" }, { ok: true }], HANDOFF_FOLLOW_SECONDS * 1000);
      expect(r).toMatchObject({ ok: true, tries: 4 });
    });

    it('stops when refused or when the game is gone, and when the time is up', async () => {
      expect(await run([noAnswer, { ok: false, reason: 'You were banned from this game', rejected: true }, { ok: true }], 90_000)).toMatchObject({ ok: false, tries: 2, rejected: true });
      expect(await run([{ ok: false, reason: 'no game open with code ABC234 — check the code' }, { ok: true }], 90_000)).toMatchObject({ ok: false, tries: 1 });
      const late = await run([noAnswer], 35_000);
      expect(late).toMatchObject({ ok: false, tries: 4 });
      expect(late.lefts).toEqual([35_000, 24_000, 13_000, 2_000]);
      // The places a successor keeps (twice AWAY.holdSeconds, 120 s) outlast the following.
      expect(HANDOFF_FOLLOW_SECONDS).toBeLessThan(120);
    });
  });
});
