import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ASSIST_SECONDS,
  CORE_BOT_PROFILES,
  DEFAULT_RULES,
  FIRETEAMS_SIDE_MIN,
  PARTY_PRESETS,
  SQUAD_POINTS,
  SquadScores,
  TICK_RATE,
  applyParty,
  awardText,
  fireteamPartySize,
  initPhysics,
  loadMap,
  mapPickTeams,
  partyMapMove,
  partyOn,
  readSquad,
  rulesFromSetup,
  type GameEvent,
  type MapDocument,
  type MatchSetup,
  type PartyMapCandidate,
} from '../src/index.ts';
import { BotFiller, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const T = TICK_RATE;

describe('Fireteams Part 3: squad scores', () => {
  it('a kill is 10 to the killer and their squad; hurting the victim within 10 s is an assist (5); later hits are not', () => {
    const s = new SquadScores();
    const squadOf = (slot: number) => (slot < 10 ? 1 : 2);
    s.hurt(1, 20, 0);
    s.hurt(2, 20, 5 * T);
    s.hurt(3, 20, 0);
    s.kill(3, 20, (ASSIST_SECONDS + 1) * T, T, squadOf);
    // Slot 3 killed (no assist for it too), slot 2 hurt them 6 s before (an assist), slot 1 11 s before (none).
    expect(s.player(3)).toMatchObject({ kills: 1, assists: 0, points: SQUAD_POINTS.kill });
    expect(s.player(2)).toMatchObject({ kills: 0, assists: 1, points: SQUAD_POINTS.assist });
    expect(s.points(1)).toBe(0);
    expect(s.squad(1)).toMatchObject({ kills: 1, assists: 1, points: 15 });
    expect(s.squad(2).points).toBe(0);
    // The victim's hits are forgotten with the kill: the next one has no assists from before.
    s.kill(3, 20, 12 * T, T, squadOf);
    expect(s.player(2).assists).toBe(1);
  });

  it('a death that scores nothing (a fall, a team kill, an NPC) earns nobody anything', () => {
    const s = new SquadScores();
    s.hurt(1, 20, 0);
    s.kill(null, 20, T, T, () => 1);
    expect(s.points(1)).toBe(0);
    expect(s.squad(1).points).toBe(0);
  });

  it('objective plays as the match counts them (30 each, the new ones only; a returning player keeps theirs) and hill seconds (1 each)', () => {
    const s = new SquadScores();
    s.objectives(4, 0, 1);
    s.objectives(4, 1, 1);
    s.objectives(4, 1, 1);
    s.objectives(4, 3, 1);
    expect(s.player(4)).toMatchObject({ objectives: 3, points: 3 * SQUAD_POINTS.objective });
    // First seen with plays already counted (back from spectating): nothing new.
    s.objectives(5, 2, 1);
    expect(s.points(5)).toBe(0);
    s.hill(5, 2);
    s.hill(5, 2);
    expect(s.player(5)).toMatchObject({ hill: 2, points: 2 });
    expect(s.squad(1).points).toBe(90);
    expect(s.squad(2).points).toBe(2);
    // A member moving squads: their points stay with the squad they earned them in.
    s.objectives(4, 4, 2);
    expect(s.squad(1).points).toBe(90);
    expect(s.squad(2).points).toBe(32);
    s.reset();
    expect(s.squad(1).points).toBe(0);
    expect(s.points(4)).toBe(0);
  });

  it('the awards: Best Squad (most points, ties to the lower id) and every squad MVP (ties to the lower slot); nobody with no points', () => {
    const s = new SquadScores();
    const squads = [
      { id: 1, leader: 0, members: [0, 1, 2] },
      { id: 2, leader: 5, members: [5, 6, 7] },
      { id: 3, leader: 9, members: [9] },
    ];
    const squadOf = (slot: number) => squads.find((q) => q.members.includes(slot))!.id;
    s.kill(1, 30, 0, T, squadOf);
    s.kill(2, 31, 0, T, squadOf);
    s.kill(6, 32, 0, T, squadOf);
    s.kill(7, 33, 0, T, squadOf);
    const here = new Set([0, 1, 2, 5, 6, 7, 9]);
    const aw = s.awards(squads, here);
    // Squads 1 and 2 have 20 each: the lower id; its leader names it. Ties in a squad: the lower slot.
    expect(aw).toEqual([
      ['bestsquad', 0, 20, 1],
      ['squadmvp', 1, 10, 1],
      ['squadmvp', 6, 10, 2],
    ]);
    // A member who left isn't an MVP; a squad whose leader left is named by its first member still here.
    s.kill(1, 34, 0, T, squadOf);
    const left = s.awards(squads, new Set([2, 5, 6, 7]));
    expect(left[0]).toEqual(['bestsquad', 2, 30, 1]);
    expect(left).toContainEqual(['squadmvp', 6, 10, 2]);
    expect(left).toContainEqual(['squadmvp', 2, 10, 1]);
    expect(left.some((a) => a[0] === 'squadmvp' && a[1] === 1)).toBe(false);
    expect(awardText(['bestsquad', 0, 20, 1], () => 'Rex')).toEqual({ title: 'Best Squad', line: "Rex's squad: 20 points" });
    expect(awardText(['squadmvp', 1, 10, 1], () => 'Ava')).toEqual({ title: 'Squad MVP', line: 'Ava: 10 points' });
  });
});

// ---------------------------------------------------------------- in a match

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 10; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [70, 0, 4], [10, 0, 10], [60, 0, 10], [4, 0, 16], [66, 0, 16]]);
};
type Kill = (v: Combatant, k: Combatant | null, w: string) => void;
type Damage = (v: Combatant, amount: number, a: Combatant | null, w: string) => void;

describe('Fireteams Part 3 in a match', () => {
  it('kills and assists go to the squads; the snapshot carries squad and player points; the end of the match gives the squad awards', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [6, 6], fireteams: 4, scoreLimit: 0, timeLimitSeconds: 0, friendlyFire: 'on' }, 3);
    const filler = new BotFiller(match);
    const me = filler.join('me', undefined, 12)!;
    for (let i = 0; i < 11; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    for (let i = 0; i < T * 10 && match.phase !== 'playing'; i++) match.step();
    for (let i = 0; i < 10; i++) match.step();
    const ft = match.fireteams!;
    const kill = (match as unknown as { kill: Kill }).kill.bind(match);
    const damage = (match as unknown as { damage: Damage }).damage.bind(match);
    // Bots hold still and never hurt anyone: only the test's hits count.
    for (const c of match.combatants()) if (c.bot) c.bot.think = () => ({ seq: 0, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0 });
    ft.scores.reset();
    const mine = ft.squadOf(me.slot)!;
    const mate = match.slots[mine.members.find((m) => m !== me.slot)!]!;
    const foes = match.combatants().filter((c) => c.faction !== me.faction);
    // A mate hurts an enemy, you down it: your kill, their assist, 15 to your squad.
    damage(foes[0]!, 10, mate, 'core.rifle');
    kill(foes[0]!, me, 'core.rifle');
    expect(ft.scores.player(me.slot)).toMatchObject({ kills: 1, points: 10 });
    expect(ft.scores.player(mate.slot)).toMatchObject({ assists: 1, points: 5 });
    expect(ft.scores.squad(mine.id).points).toBe(15);
    // A team kill earns nothing.
    const other = match.combatants().find((c) => c.faction === me.faction && !mine.members.includes(c.slot))!;
    kill(other, me, 'core.rifle');
    expect(ft.scores.points(me.slot)).toBe(10);
    // An enemy squad's kill of yours.
    kill(mate, foes[1]!, 'core.rifle');
    const theirs = ft.squadOf(foes[1]!.slot)!;
    expect(ft.scores.squad(theirs.id).points).toBe(10);
    // The snapshot: each squad's points, each player's.
    const snap = match.snapshot([]);
    const views = (snap.fs ?? []).map(readSquad);
    expect(views.find((v) => v.id === mine.id)).toMatchObject({ points: 15, members: mine.members });
    expect(snap.score.find((e) => e.s === me.slot)?.p).toBe(10);
    expect(snap.score.find((e) => e.s === other.slot)?.p).toBeUndefined();
    // The end: Best Squad (yours, 15) and an MVP for each squad that scored.
    const events: GameEvent[] = [];
    match.endMatch();
    events.push(...match.step());
    const aw = events.find((e): e is Extract<GameEvent, { e: 'awards' }> => e.e === 'awards')?.aw ?? [];
    expect(aw).toContainEqual(['bestsquad', me.slot, 15, mine.id]);
    expect(aw).toContainEqual(['squadmvp', me.slot, 10, mine.id]);
    expect(aw).toContainEqual(['squadmvp', foes[1]!.slot, 10, theirs.id]);
    expect(aw.filter((a) => a[0] === 'squadmvp')).toHaveLength(2);
  });

  it('without Fireteams nothing changes: no squad awards, no points in the score', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3], scoreLimit: 0, timeLimitSeconds: 0 }, 1);
    for (let i = 0; i < 6; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    for (let i = 0; i < T * 10 && match.phase !== 'playing'; i++) match.step();
    const [a, b] = [match.combatants().find((c) => c.faction === 'red') ?? match.combatants()[0]!, match.combatants().find((c) => c.faction !== match.combatants()[0]!.faction)!];
    (match as unknown as { kill: Kill }).kill(b, a, 'core.rifle');
    const snap = match.snapshot([]);
    expect(snap.fs).toBeUndefined();
    expect(snap.score.every((e) => e.p === undefined)).toBe(true);
    match.endMatch();
    const aw = match.step().find((e): e is Extract<GameEvent, { e: 'awards' }> => e.e === 'awards')?.aw ?? [];
    expect(aw.some((x) => x[0] === 'bestsquad' || x[0] === 'squadmvp')).toBe(false);
  });

  it('King of the Hill: a second on the hill your team alone holds is a point to you and your squad', () => {
    const map = yard();
    map.entities.push({ id: 'hill1', kind: 'hill', position: [35, 0, 10], radius: 6 } as unknown as MapDocument['entities'][number]);
    map.metadata.supportedModes = ['core.koth'];
    const match = new Match(map, { ...DEFAULT_RULES['core.koth'], teamSizes: [4, 4], fireteams: 4, scoreLimit: 0, timeLimitSeconds: 0 }, 2);
    for (let i = 0; i < 8; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    for (let i = 0; i < T * 10 && match.phase !== 'playing'; i++) match.step();
    match.step();
    const ft = match.fireteams!;
    for (const c of match.combatants()) if (c.bot) c.bot.think = () => ({ seq: 0, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0 });
    const team = match.combatants()[0]!.faction!;
    const on = match.combatants().find((c) => c.faction === team)!;
    for (const c of match.combatants()) c.move = { pos: c === on ? { x: 35, y: 0, z: 10 } : { x: c.faction === team ? 5 : 65, y: 0, z: 4 }, velY: 0, grounded: true };
    ft.scores.reset();
    for (let i = 0; i < T * 3; i++) {
      on.move.pos = { x: 35, y: 0, z: 10 };
      match.step();
    }
    const hill = ft.scores.player(on.slot).hill;
    expect(hill).toBeGreaterThanOrEqual(2);
    expect(hill).toBeLessThanOrEqual(3);
    expect(ft.scores.squad(ft.squadOf(on.slot)!.id).points).toBe(hill);
  });
});

// ---------------------------------------------------------------- the party preset

const suite = (id: string): MapDocument => {
  const r = loadMap(readFileSync(new URL(`../../../maps/${id}.json`, import.meta.url), 'utf8'));
  if (!r.ok) throw new Error(`${id} failed to load`);
  return r.map;
};

describe('Fireteams Part 3: the party preset', () => {
  const preset = PARTY_PRESETS.find((p) => p.id === 'fireteams')!;
  const base: MatchSetup = { map: 'sandgate', mode: 'core.deathmatch', bots: 11, skill: 'normal', scoreLimit: 30, minutes: 10, spears: true };

  it('squad sizes for the teams: 4 up to 14 a side, 5 up to 17, 6 from 18', () => {
    expect([8, 12, 14, 15, 17, 18, 24, 48].map(fireteamPartySize)).toEqual([4, 4, 4, 5, 5, 6, 6, 6]);
  });

  it('one click: Team Deathmatch, Fireteams on (other variants off), the map’s own teams and squads to fit them', () => {
    const map = suite('sandgate');
    const out = applyParty(preset, base, map, ['core.tdm', 'core.deathmatch', 'core.ctf'], { deviceMax: 64 })!;
    expect(out.mode).toBe('core.tdm');
    expect(out.fireteams).toBe(true);
    expect(out.spears).toBeUndefined();
    expect(out.teams).toEqual(mapPickTeams(map, 'core.tdm', 64));
    expect(out.squadSize).toBe(fireteamPartySize(Math.max(...out.teams!)));
    expect(partyOn(preset, out, map, ['core.tdm', 'core.deathmatch'])).toBe(true);
    const { rules } = rulesFromSetup(out, map);
    expect(rules.fireteams).toBe(4);
    expect(rules.mode).toBe('core.tdm');
    // Squads of 5 (the standard) are left out of the setup, as the size picker leaves them.
    const big = suite('riot_junction');
    const wide = applyParty(preset, base, big, ['core.tdm'], { deviceMax: 32 })!;
    expect(wide.teams).toEqual([16, 16]);
    expect(wide.squadSize).toBeUndefined();
    expect(rulesFromSetup(wide, big).rules.fireteams).toBe(5);
  });

  it('its map: this one when it plays Team Deathmatch with room for squads, else the first of its maps here that fits the device', () => {
    const maps: PartyMapCandidate[] = [
      { key: 'eagle_spires', modes: ['core.tdm', 'core.ctf'], recommendedMax: 24, official: true },
      { key: 'riot_junction', modes: ['core.tdm'], recommendedMax: 32, official: true },
      { key: 'sandgate', modes: ['core.tdm', 'core.deathmatch'], recommendedMax: 16, official: true },
      { key: 'canyon', modes: ['core.tdm'], recommendedMax: 16, official: false },
    ];
    const sandgate = suite('sandgate');
    expect(Math.min(...mapPickTeams(sandgate, 'core.tdm', 64))).toBeGreaterThanOrEqual(FIRETEAMS_SIDE_MIN);
    expect(partyMapMove(preset, sandgate, ['core.tdm'], 64, maps)).toBeNull();
    // A map without Team Deathmatch, or whose teams are too small for squads: moves.
    expect(partyMapMove(preset, sandgate, ['core.deathmatch'], 64, maps)).toBe('eagle_spires');
    const small = { ...yard(), metadata: { ...yard().metadata, recommendedPlayers: { min: 2, max: 6 } } };
    expect(preset.suits!(small, ['core.tdm'], 64)).toMatch(/too small/);
    expect(partyMapMove(preset, small, ['core.tdm'], 64, maps)).toBe('eagle_spires');
    // A phone that runs 16: the first that fits it.
    expect(partyMapMove(preset, small, ['core.tdm'], 16, maps)).toBe('sandgate');
    // A player's own map is never picked; none here: it stays.
    expect(partyMapMove(preset, small, ['core.tdm'], 16, maps.filter((m) => m.key === 'canyon'))).toBeNull();
    // The other presets keep to the map they're on.
    expect(partyMapMove(PARTY_PRESETS.find((p) => p.id === 'spear_fight')!, small, ['core.tdm'], 64, maps)).toBeNull();
  });
});
