import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_RULES, FLAG_DROPPED, FLAG_HOME, TICK_RATE, handoffKey, initPhysics, loadMap, orderSay, parseCheckpoint, readSquad, type MatchCheckpoint } from '../src/index.ts';
import { BotFiller, CtfMode, Match, ctfSquadRoles, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

/**
 * Fireteams follow-ups (docs/FIRETEAMS_PLAN.md, "Follow-ups"): CTF squad roles (the smallest of 3+ squads a side
 * defends its flag, ties to the higher squad id; 2 squads both attack; a person's squad only by default, until they
 * give an order), worked out again as squads change; and host handoff carrying the squad and player points.
 */

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const T = TICK_RATE;
type Kill = (v: Combatant, k: Combatant | null, w: string) => void;

function twinSpires() {
  const r = loadMap(readFileSync(new URL('../../../maps/twin_spires.json', import.meta.url), 'utf8'));
  if (!r.ok) throw new Error('twin_spires failed to load');
  return r.map;
}

function ctfMatch(teams: [number, number], size: number, seed = 2) {
  const match = new Match(twinSpires(), { ...DEFAULT_RULES['core.ctf'], teamSizes: teams, fireteams: size, scoreLimit: 0, timeLimitSeconds: 0 }, seed);
  return match;
}

function play(match: Match): void {
  for (let i = 0; i < T * 10 && match.phase !== 'playing'; i++) match.step();
  for (let i = 0; i < 12; i++) match.step();
}

/** Every bot's role is its squad's by the rule (a person's squad: by default, until they give an order). */
function rolesFollowTheRule(match: Match): void {
  const mode = match.mode as CtfMode;
  const ft = match.fireteams!;
  for (const t of match.teams!) {
    const sq = ft.teamSquads(t.id);
    const want = ctfSquadRoles(sq.map((s) => ({ id: s.id, size: s.members.length })));
    for (const s of sq) {
      expect(mode.squadRole(s.id)).toBe(want.get(s.id));
      for (const m of s.members) {
        const c = match.slots[m]!;
        if (c.kind !== 'bot') continue;
        expect(mode.botPlan.roles.get(m)).toBe(s.human && s.ordered ? 'attack' : want.get(s.id));
      }
    }
  }
}

describe('Fireteams follow-ups: CTF squad roles', () => {
  it('the rule: 3+ squads, the smallest defends (ties to the higher id); 1 or 2 squads all attack', () => {
    const roles = (l: [number, number][]) => Object.fromEntries(ctfSquadRoles(l.map(([id, size]) => ({ id, size }))));
    expect(roles([[1, 5], [2, 5], [3, 4]])).toEqual({ 1: 'attack', 2: 'attack', 3: 'defend' });
    expect(roles([[1, 3], [2, 5], [3, 5], [4, 5]])).toEqual({ 1: 'defend', 2: 'attack', 3: 'attack', 4: 'attack' });
    expect(roles([[1, 4], [2, 4], [3, 4]])).toEqual({ 1: 'attack', 2: 'attack', 3: 'defend' });
    expect(roles([[1, 5], [2, 3], [3, 4], [4, 3]])).toEqual({ 1: 'attack', 2: 'attack', 3: 'attack', 4: 'defend' });
    expect(roles([[1, 5], [2, 2]])).toEqual({ 1: 'attack', 2: 'attack' });
    expect(roles([[7, 1]])).toEqual({ 7: 'attack' });
    expect(roles([])).toEqual({});
  });

  it('in a match: whole squads take the role; worked out again when a squad changes size or a person takes one over', () => {
    const match = ctfMatch([12, 12], 4);
    const filler = new BotFiller(match);
    for (let i = 0; i < 24; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    play(match);
    const ft = match.fireteams!;
    const mode = match.mode as CtfMode;
    rolesFollowTheRule(match);
    const team = match.teams![0]!.id;
    // 3 squads of 4: the highest id defends.
    let sq = ft.teamSquads(team);
    expect(sq.map((s) => s.members.length)).toEqual([4, 4, 4]);
    expect(sq.filter((s) => mode.squadRole(s.id) === 'defend').map((s) => s.id)).toEqual([Math.max(...sq.map((s) => s.id))]);
    // A bot of the first squad leaves: that squad, now the smallest (3), defends at once; the one that did attacks.
    const first = sq[0]!;
    const was = sq.find((s) => mode.squadRole(s.id) === 'defend')!;
    match.remove(first.members.find((m) => m !== first.leader)!);
    for (let i = 0; i < 7; i++) match.step();
    expect(mode.squadRole(first.id)).toBe('defend');
    expect(mode.squadRole(was.id)).toBe('attack');
    rolesFollowTheRule(match);
    // A person joins: they take over the squad with a hole (the defending one); sizes are even again, so the highest id
    // defends (a person's squad has its role only as a default: they lead it).
    const ana = filler.join('Ana', undefined, 24)!;
    for (let i = 0; i < 7; i++) match.step();
    const hers = ft.squadOf(ana.slot)!;
    expect(hers.human).toBe(true);
    sq = ft.teamSquads(ana.faction!);
    rolesFollowTheRule(match);
    // The snapshot carries each squad's role for the squad HUD.
    const views = (match.snapshot([]).fs ?? []).map(readSquad);
    for (const v of views) expect(v.role).toBe(mode.squadRole(v.id));
    expect(views.some((v) => v.role === 'defend')).toBe(true);
  });

  it('with 2 squads a side both attack', () => {
    const match = ctfMatch([8, 8], 4, 3);
    for (let i = 0; i < 16; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    play(match);
    const mode = match.mode as CtfMode;
    for (const t of match.teams!) {
      const sq = match.fireteams!.teamSquads(t.id);
      expect(sq).toHaveLength(2);
      for (const s of sq) {
        expect(mode.squadRole(s.id)).toBe('attack');
        for (const m of s.members) expect(mode.botPlan.roles.get(m)).toBe('attack');
      }
    }
  });

  it('the defending squad holds round its flag base and returns its dropped flag', () => {
    const match = ctfMatch([12, 12], 4, 4);
    for (let i = 0; i < 24; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    play(match);
    const mode = match.mode as CtfMode;
    const ft = match.fireteams!;
    const team = match.teams![0]!.id;
    const def = ft.teamSquads(team).find((s) => mode.squadRole(s.id) === 'defend')!;
    const own = mode.flagOf(team)!;
    // Only this side plays: the other side's bots stand still and hold fire (nothing to fight, nobody at our flag).
    for (const c of match.combatants()) if (c.bot && c.faction !== team) c.bot.think = () => ({ seq: 0, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0 });
    let near = 0;
    let samples = 0;
    let attackersNear = 0;
    let attackerSamples = 0;
    for (let s = 0; s < 40; s++) {
      for (let i = 0; i < T; i++) match.step();
      if (s < 15) continue;
      for (const c of match.combatants()) {
        if (!c.alive || c.faction !== team || c.kind !== 'bot') continue;
        const d = Math.hypot(c.move.pos.x - own.base.x, c.move.pos.z - own.base.z);
        if (def.members.includes(c.slot)) {
          samples++;
          if (d < 20) near++;
        } else {
          attackerSamples++;
          if (d < 20) attackersNear++;
        }
      }
    }
    // The defenders stay by the base (most of the time within 20 m); the attackers are mostly away from it.
    expect(near / samples).toBeGreaterThan(0.75);
    expect(attackersNear / Math.max(1, attackerSamples)).toBeLessThan(0.35);
    // Our flag dropped 12 m off the base: a defender goes and touches it (it goes home).
    const away = { x: own.base.x + 12, y: own.base.y, z: own.base.z };
    const ground = match.nav.closestPoint(away, { x: 4, y: 4, z: 4 }) ?? away;
    Object.assign(own, { state: FLAG_DROPPED, pos: { ...ground }, carrier: null, returnAt: match.tick + T * 300 });
    match.step();
    // Every defender alive heads for it (the mode's goal: our dropped flag), wherever it is; it goes home soon after
    // (whoever is nearest touches it first: anyone within 22 m goes too).
    const botGoal = (c: Combatant) => (match as unknown as { botGoal: (c: Combatant, h: Combatant[], z: boolean, co: boolean) => { pos: { x: number; z: number } } | null }).botGoal(c, [], false, false);
    const alive = def.members.map((m) => match.slots[m]!).filter((c) => c.alive);
    expect(alive.length).toBeGreaterThan(0);
    for (const c of alive) {
      const g = botGoal(c);
      expect(g && Math.hypot(g.pos.x - own.pos.x, g.pos.z - own.pos.z)).toBeLessThan(1);
    }
    let returned = false;
    for (let i = 0; i < T * 30 && !returned; i++) {
      for (const e of match.step()) if (e.e === 'flag' && e.a === 'return' && e.team === team && e.s !== null) returned = true;
    }
    expect(returned).toBe(true);
    expect(own.state).toBe(FLAG_HOME);
  });

  it("a person's squad: the role is its default until they give an order (the smallest, a person's, defends by default)", () => {
    // Three people on one side, each leading a squad of 2 (themselves and a bot): the highest id is smallest by the tie.
    const match = ctfMatch([6, 6], 4, 5);
    const team = match.teams![0]!.id;
    const other = match.teams![1]!.id;
    const people = [0, 1, 2].map((i) => match.addHuman(`p${i}`, undefined, team)!);
    for (let i = 0; i < 3; i++) match.addBot(`a${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, undefined, false, { team });
    for (let i = 0; i < 6; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!, undefined, false, { team: other });
    play(match);
    const ft = match.fireteams!;
    const mode = match.mode as CtfMode;
    const sq = ft.teamSquads(team);
    expect(sq.map((s) => [s.human, s.members.length])).toEqual([[true, 2], [true, 2], [true, 2]]);
    const def = sq.find((s) => mode.squadRole(s.id) === 'defend')!;
    expect(def.id).toBe(Math.max(...sq.map((s) => s.id)));
    const lead = match.slots[def.leader!]!;
    const mate = match.slots[def.members.find((m) => m !== def.leader)!]!;
    // By default its bot plays the defence (the mode's goal: round our flag), not the person's Follow me.
    expect(mode.botPlan.roles.get(mate.slot)).toBe('defend');
    const goal = (match as unknown as { botGoal: (c: Combatant, h: Combatant[], z: boolean, co: boolean) => { pos: { x: number; z: number } } | null }).botGoal(mate, [], false, false);
    const base = mode.flagOf(team)!.base;
    expect(goal && Math.hypot(goal.pos.x - base.x, goal.pos.z - base.z)).toBeLessThan(1);
    rolesFollowTheRule(match);
    // The person gives an order (Follow me): their squad does what they say from now on.
    match.queueInputs(lead.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: orderSay('follow') }]);
    for (let i = 0; i < 7; i++) match.step();
    expect(def.ordered).toBe(true);
    expect(mode.botPlan.roles.get(mate.slot)).toBe('attack');
    expect((match as unknown as { fireteamGoal: (c: Combatant) => object | null }).fireteamGoal(mate)).not.toBeNull();
    rolesFollowTheRule(match);
    // The squad's role itself stays the team's plan (shown on the HUD line).
    expect(readSquad((match.snapshot([]).fs ?? []).find((a) => a[0] === def.id)!).role).toBe('defend');
    void people;
  });

  it('Team Deathmatch gives squads no role', () => {
    const yard = () => {
      const tiles = [];
      for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
      return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
    };
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [12, 12], fireteams: 4, scoreLimit: 0, timeLimitSeconds: 0 }, 1);
    for (let i = 0; i < 24; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
    play(match);
    for (const v of (match.snapshot([]).fs ?? []).map(readSquad)) expect(v.role).toBeNull();
  });
});

describe('Fireteams follow-ups: host handoff carries the squad points', () => {
  const yard = () => {
    const tiles = [];
    for (let x = 0; x < 10; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    return makeMap(tiles, [[0, 0, 4], [70, 0, 4], [10, 0, 10], [60, 0, 10], [4, 0, 16], [66, 0, 16]]);
  };

  it("a successor's squads keep their points, and every player theirs; play adds on from there", () => {
    const rules = { ...DEFAULT_RULES['core.tdm'], teamSizes: [6, 6] as [number, number], fireteams: 4, scoreLimit: 0, timeLimitSeconds: 600 };
    const match = new Match(yard(), rules, 7);
    const bots = new BotFiller(match);
    const host = bots.join('Hosty', undefined, 12)!;
    const ann = bots.join('Ann', undefined, 12)!;
    bots.rebalance(12);
    play(match);
    const ft = match.fireteams!;
    for (const c of match.combatants()) if (c.bot) c.bot.think = () => ({ seq: 0, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0 });
    const kill = (match as unknown as { kill: Kill }).kill.bind(match);
    // A few kills: the host's squad, Ann's and a bot-led one score.
    const foesOf = (c: Combatant) => match.combatants().filter((o) => o.faction && o.faction !== c.faction && o.alive);
    kill(foesOf(host)[0]!, host, 'core.rifle');
    kill(foesOf(ann)[0]!, ann, 'core.rifle');
    kill(foesOf(ann)[0]!, ann, 'core.rifle');
    const botLed = ft.squads.find((s) => !s.human)!;
    const scorer = match.slots[botLed.members[0]!]!;
    kill(foesOf(scorer)[0]!, scorer, 'core.rifle');
    for (let i = 0; i < 6; i++) match.step();
    const byName = (m: Match, n: string) => m.combatants().find((c) => (c.away?.name ?? c.name) === n)!;
    const before = ft.squads.map((s) => ({ names: s.members.map((m) => match.slots[m]!.away?.name ?? match.slots[m]!.name).sort(), points: ft.scores.squad(s.id).points, human: s.human }));
    const playerPts = new Map(match.combatants().map((c) => [c.name, ft.scores.points(c.slot)]));
    expect(before.filter((b) => b.points > 0).length).toBeGreaterThanOrEqual(3);
    // The checkpoint, through JSON as it goes over the wire.
    const keys = new Map([[host.slot, handoffKey('pk:p_hostkey123')], [ann.slot, handoffKey('pk:p_annkey1234')]]);
    const squads = match.checkpointSquads();
    expect(squads?.length).toBe(ft.squads.length);
    const cp0: MatchCheckpoint = { v: 1, map: match.map.metadata.id, rules: match.rules, phase: match.phase, timeLeft: match.timeLeftSeconds(), fill: 12, skill: bots.skill.id, players: match.checkpointPlayers((c) => keys.get(c.slot) ?? null, ann.slot), ...(squads ? { squads } : {}) };
    const cp = parseCheckpoint(JSON.stringify(cp0))!;
    expect(cp.squads).toEqual(cp0.squads);
    expect(cp.players.find((p) => p.name === 'Ann')?.sp?.[0]).toBe(20);
    // Ann's browser carries the match on.
    const next = new Match(yard(), cp.rules, 9);
    const nb = new BotFiller(next);
    const me = nb.restore(cp, cp.fill, { name: 'Ann' })!;
    next.resume(cp.phase, cp.timeLeft, cp.teams);
    for (let i = 0; i < 12; i++) next.step();
    const nft = next.fireteams!;
    // Each squad as it was, with its points (by who is in it); each player's own points.
    for (const b of before) {
      const s = nft.squadOf(byName(next, b.names[0]!).slot)!;
      expect(s.members.map((m) => next.slots[m]!.away?.name ?? next.slots[m]!.name).sort()).toEqual(b.names);
      expect(nft.scores.squad(s.id).points).toBe(b.points);
    }
    for (const [name, pts] of playerPts) expect(nft.scores.points(byName(next, name).slot)).toBe(pts);
    expect(nft.ledBy(me.slot)?.human).toBe(true);
    // Play adds on from there (Ann's squad 20 → 30).
    for (const c of next.combatants()) if (c.bot) c.bot.think = () => ({ seq: 0, forward: 0, right: 0, yaw: c.yaw, pitch: 0, buttons: 0 });
    const hers = nft.squadOf(me.slot)!;
    const was = nft.scores.squad(hers.id).points;
    (next as unknown as { kill: Kill }).kill(next.combatants().find((o) => o.faction && o.faction !== me.faction && o.alive)!, me, 'core.rifle');
    expect(nft.scores.squad(hers.id).points).toBe(was + 10);
    expect(nft.scores.points(me.slot)).toBe(30);
    // The snapshot (the scoreboard) shows the carried points.
    const view = (next.snapshot([]).fs ?? []).map(readSquad).find((v) => v.id === hers.id)!;
    expect(view.points).toBe(was + 10);
  });

  it('a bad squads list in a checkpoint is dropped or bounded, the rest of the checkpoint kept', () => {
    const base = { v: 1, map: 'm', rules: { ...DEFAULT_RULES['core.tdm'] }, phase: 'playing', timeLeft: 10, fill: 4, skill: 'normal', players: [{ name: 'a', kind: 'bot', look: 'core.x', team: 'red', k: 0, d: 0, alive: false }, { name: 'b', kind: 'bot', look: 'core.x', team: 'red', k: 0, d: 0, alive: false, sp: [5, 0, 1, 0, 0] }] };
    const cp = parseCheckpoint({ ...base, squads: [{ m: [0, 0, 9, 1], l: 7, t: [5, 0, 1, 0, 0] }, { m: [1], l: 1, t: [1, 2, 3] }, 'x', { m: [], l: 0, t: [0, 0, 0, 0, 0] }] })!;
    expect(cp).not.toBeNull();
    expect(cp.squads).toEqual([{ m: [0, 1], l: -1, t: [5, 0, 1, 0, 0] }]);
    expect(cp.players[1]!.sp).toEqual([5, 0, 1, 0, 0]);
    expect(parseCheckpoint({ ...base, squads: 'no' })!.squads).toBeUndefined();
    expect(parseCheckpoint({ ...base, players: [{ ...base.players[0]!, sp: [-1, 0, 0, 0, 0] }] })!.players[0]!.sp).toEqual([0, 0, 0, 0, 0]);
  });
});
