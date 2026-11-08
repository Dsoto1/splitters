import { beforeAll, describe, expect, it } from 'vitest';
import {
  CORE_BOT_PROFILES,
  DEFAULT_RULES,
  Fireteams,
  SAY_HOLD,
  TICK_RATE,
  checkOrder,
  initPhysics,
  memberGoal,
  orderFromSay,
  orderSay,
  rulesFromSetup,
  setVariant,
  variantStates,
  type GameEvent,
  type OrderContext,
  type SquadRosterEntry,
  type Vec3,
} from '../src/index.ts';
import { OPT_COVER, OPT_GOAL, OPT_NOISE, OPTIONS, bestChoice, scoreChoices, type ChoiceInput } from '../src/bots/choices.ts';
import { BotFiller, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const at = (x: number, z = 0): Vec3 => ({ x, y: 0, z });
const bot = (slot: number, team = 'a', lead = slot): SquadRosterEntry => ({ slot, team, human: false, lead, pos: at(slot) });
const person = (slot: number, team = 'a'): SquadRosterEntry => ({ slot, team, human: true, lead: 0, pos: at(slot) });

/** Every person leads their own squad, nobody else's; no squad is over size; every member is in one squad. */
function wellFormed(ft: Fireteams, roster: readonly SquadRosterEntry[]): void {
  const seen = new Set<number>();
  for (const s of ft.squads) {
    expect(s.members.length).toBeLessThanOrEqual(ft.size);
    expect(s.members).toContain(s.leader);
    const people = s.members.filter((m) => roster.find((r) => r.slot === m)?.human);
    expect(people.length).toBeLessThanOrEqual(1);
    if (people.length) expect(s.leader).toBe(people[0]);
    expect(s.human).toBe(people.length === 1);
    for (const m of s.members) {
      expect(seen.has(m)).toBe(false);
      seen.add(m);
      expect(roster.find((r) => r.slot === m)?.team).toBe(s.team);
    }
  }
  expect(seen.size).toBe(roster.filter((r) => r.team !== null).length);
}

describe('Fireteams: squad assignment', () => {
  it('a person leads a full squad; bot-led squads of the same size fill the team, as even as can be', () => {
    const ft = new Fireteams(5);
    const roster = [person(0), ...Array.from({ length: 11 }, (_, i) => bot(i + 1)), person(20, 'b'), ...Array.from({ length: 11 }, (_, i) => bot(i + 21, 'b'))];
    const notes = ft.sync(roster, 0);
    wellFormed(ft, roster);
    for (const team of ['a', 'b']) {
      const sq = ft.teamSquads(team);
      expect(sq[0]!.human).toBe(true);
      expect(sq.map((s) => s.members.length)).toEqual([5, 4, 3]);
      // Bot leaders: the best leader of the squad.
      for (const s of sq.slice(1)) expect(s.leader).toBe(Math.max(...s.members));
    }
    expect(notes.filter((n) => n.a === 'lead' && n.human)).toHaveLength(2);
    // Deterministic: the same roster, the same squads.
    const again = new Fireteams(5);
    again.sync(roster, 0);
    expect(again.squads.map((s) => s.members)).toEqual(ft.squads.map((s) => s.members));
  });

  it('a person joining takes over a bot-led squad (its leader steps down to member); leaving, a bot leads it', () => {
    const ft = new Fireteams(5);
    let roster = [person(0), ...Array.from({ length: 14 }, (_, i) => bot(i + 1))];
    ft.sync(roster, 0);
    const before = ft.teamSquads('a').map((s) => [...s.members]);
    expect(before.map((m) => m.length)).toEqual([5, 5, 5]);
    // A friend joins: the bot that made room for them (the match removes one) was in the second squad.
    const removed = before[1]!.find((m) => m !== ft.teamSquads('a')[1]!.leader)!;
    const target = ft.teamSquads('a')[1]!;
    const oldLeader = target.leader!;
    roster = [...roster.filter((r) => r.slot !== removed), person(30)];
    const notes = ft.sync(roster, 60);
    wellFormed(ft, roster);
    const mine = ft.squadOf(30)!;
    expect(mine).toBe(target);
    expect(mine.leader).toBe(30);
    expect(mine.members).toContain(oldLeader);
    expect(mine.members.length).toBe(5);
    expect(notes).toContainEqual(expect.objectContaining({ a: 'lead', slot: 30, human: true, from: oldLeader }));
    // The first person leaves: their squad's best bot leads it now.
    const first = ft.squadOf(0)!;
    roster = roster.filter((r) => r.slot !== 0);
    ft.sync(roster, 120);
    wellFormed(ft, roster);
    expect(first.human).toBe(false);
    expect(first.leader).toBe(Math.max(...first.members));
    // And the fresh bot that takes their place joins the squad with the hole.
    roster = [...roster, bot(40)];
    ft.sync(roster, 180);
    wellFormed(ft, roster);
    expect(ft.squadOf(40)).toBe(first);
  });

  it("a person's squad fills from a bot-led one when the bot that made room was in theirs", () => {
    const ft = new Fireteams(4);
    let roster = [person(0), ...Array.from({ length: 7 }, (_, i) => bot(i + 1))];
    ft.sync(roster, 0);
    const mine = ft.squadOf(0)!;
    const gone = mine.members.find((m) => m !== 0)!;
    roster = [...roster.filter((r) => r.slot !== gone), person(9)];
    ft.sync(roster, 1);
    wellFormed(ft, roster);
    // 2 people and 6 bots: two full squads of 4.
    expect([ft.squadOf(0)!.members.length, ft.squadOf(9)!.members.length]).toEqual([4, 4]);
  });

  it('more people than full squads (a small team): everyone leads their own, the bots spread among them', () => {
    const ft = new Fireteams(6);
    const roster = [person(0), person(1), person(2), bot(3), bot(4)];
    ft.sync(roster, 0);
    wellFormed(ft, roster);
    expect(ft.squads.filter((s) => s.human)).toHaveLength(3);
  });

  it('back from being away (played by a bot meanwhile): they lead their squad again', () => {
    const ft = new Fireteams(5);
    const roster = [person(0), bot(1), bot(2), bot(3), bot(4)];
    ft.sync(roster, 0);
    const s = ft.squadOf(0)!;
    ft.sync([{ ...roster[0]!, human: false }, ...roster.slice(1)], 1);
    expect(s.human).toBe(false);
    expect(ft.squadOf(0)).toBe(s);
    ft.sync(roster, 2);
    expect(s.leader).toBe(0);
    expect(s.human).toBe(true);
  });
});

describe('Fireteams: orders', () => {
  const ctx = (o: Partial<OrderContext> = {}): OrderContext => ({ leads: true, alive: true, pos: at(1), aim: at(30), aimEnemy: null, ping: null, objective: null, ...o });

  it('say codes round-trip, and nothing else reads as an order', () => {
    for (const k of ['follow', 'hold', 'go', 'attack', 'defend', 'regroup'] as const) expect(orderFromSay(orderSay(k))).toBe(k);
    for (const say of [undefined, 1, 7, 100, 101, 109, 116, 180, 200]) expect(orderFromSay(say)).toBeNull();
  });

  it('checked: only a living leader; Go there by a fresh ping, else the aim; Attack that an enemy; Defend an objective', () => {
    expect(checkOrder('hold', ctx({ leads: false }))).toEqual({ ok: false, why: 'notLeader' });
    expect(checkOrder('follow', ctx({ alive: false }))).toEqual({ ok: false, why: 'down' });
    expect(checkOrder('hold', ctx())).toEqual({ ok: true, pos: at(1), target: null });
    expect(checkOrder('go', ctx({ ping: { pos: at(50), target: null, age: 3 } }))).toEqual({ ok: true, pos: at(50), target: null });
    // A stale ping: where they aim.
    expect(checkOrder('go', ctx({ ping: { pos: at(50), target: null, age: 30 } }))).toEqual({ ok: true, pos: at(30), target: null });
    expect(checkOrder('go', ctx({ aim: null }))).toEqual({ ok: false, why: 'noPoint' });
    expect(checkOrder('attack', ctx())).toEqual({ ok: false, why: 'noEnemy' });
    expect(checkOrder('attack', ctx({ aimEnemy: 7 }))).toEqual({ ok: true, pos: null, target: 7 });
    expect(checkOrder('attack', ctx({ ping: { pos: at(50), target: 9, age: 2 } }))).toEqual({ ok: true, pos: null, target: 9 });
    expect(checkOrder('defend', ctx())).toEqual({ ok: false, why: 'noObjective' });
    expect(checkOrder('defend', ctx({ objective: at(80) }))).toEqual({ ok: true, pos: at(80), target: null });
  });

  it("each order as a member's goal: a person's order is `order`, keeping with a bot leader `squad`; the leader down, they hold", () => {
    const ft = new Fireteams(5);
    ft.sync([person(0), bot(1), bot(2), bot(3), bot(4), bot(5, 'a', 99), bot(6), bot(7)], 0);
    const s = ft.squadOf(0)!;
    const bots = ft.squadOf(5)!;
    expect(memberGoal(s, 0, at(0), null)).toBeNull();
    expect(memberGoal(s, 1, at(0), null)).toMatchObject({ pos: at(0), order: true });
    expect(memberGoal(bots, 6, at(5), null)).toMatchObject({ pos: at(5), squad: true });
    expect(memberGoal(bots, 6, at(5), null)?.order).toBeUndefined();
    ft.order(s, 'hold', at(10), null, 1);
    expect(memberGoal(s, 1, at(0), null)).toMatchObject({ pos: at(10), radius: 4, order: true });
    ft.order(s, 'attack', null, 33, 2);
    expect(memberGoal(s, 1, at(0), at(70))).toMatchObject({ pos: at(70), push: true, order: true });
    // Follow me, then the leader goes down: each member holds where it stood; back, they form up (Regroup).
    ft.order(s, 'follow', null, null, 3);
    const pos = new Map<number, { alive: boolean; pos: Vec3 }>([0, 1, 2, 3, 4].map((m) => [m, { alive: true, pos: at(m * 10) }]));
    const world = { member: (m: number) => pos.get(m) ?? null, target: () => null };
    pos.get(0)!.alive = false;
    ft.step(10, world);
    expect(memberGoal(s, 2, null, null)).toMatchObject({ pos: at(20), radius: 6 });
    pos.get(0)!.alive = true;
    const back = ft.step(20, world);
    expect(s.order.kind).toBe('regroup');
    expect(back).toContainEqual(expect.objectContaining({ a: 'order' }));
    // A place order stays in force through the leader's death and return.
    ft.order(s, 'defend', at(90), null, 30);
    pos.get(0)!.alive = false;
    ft.step(40, world);
    expect(memberGoal(s, 2, null, null)).toMatchObject({ pos: at(90) });
    pos.get(0)!.alive = true;
    ft.step(50, world);
    expect(s.order.kind).toBe('defend');
  });

  it('an order is carried out when half the squad is there (measured), and Regroup turns back into Follow me', () => {
    const ft = new Fireteams(5);
    ft.sync([person(0), bot(1), bot(2), bot(3), bot(4)], 0);
    const s = ft.squadOf(0)!;
    const pos = new Map<number, { alive: boolean; pos: Vec3 }>([0, 1, 2, 3, 4].map((m) => [m, { alive: true, pos: at(m * 20) }]));
    const world = { member: (m: number) => pos.get(m) ?? null, target: () => null };
    ft.order(s, 'go', at(100), null, 0);
    ft.step(6, world);
    expect(ft.orders.at(-1)!.done).toBeNull();
    pos.get(3)!.pos = at(99);
    pos.get(4)!.pos = at(101);
    ft.step(12, world);
    expect(ft.orders.at(-1)).toMatchObject({ kind: 'go', tick: 0, done: 12 });
    ft.order(s, 'regroup', null, null, 20);
    for (const m of [1, 2]) pos.get(m)!.pos = at(3);
    ft.step(26, world);
    expect(s.order.kind).toBe('follow');
  });
});

describe('Fireteams: the order in the scored choice', () => {
  const sc = new Float32Array(OPTIONS);
  const input = (goal: ChoiceInput['goal'], o: Partial<ChoiceInput> = {}): ChoiceInput => ({ me: at(0), goal, profile: CORE_BOT_PROFILES[0]!, hurt: false, lowAmmo: false, cover: false, retreating: false, pickup: -Infinity, post: -Infinity, lost: null, noise: null, posted: false, ...o });
  const pick = (i: ChoiceInput) => {
    scoreChoices(i, sc);
    return bestChoice(sc, -1, !!i.goal);
  };

  it("a person's order outweighs noises and chases (near or far) but not keeping up a fight from cover", () => {
    const order = { pos: at(5), radius: 4, order: true };
    expect(pick(input(order, { noise: { pos: at(40), age: 0 } }))).toBe(OPT_GOAL);
    expect(pick(input(order, { noise: { pos: at(5), age: 0 } }))).toBe(OPT_GOAL);
    expect(pick(input(order, { lost: { pos: at(30), age: 0 } }))).toBe(OPT_GOAL);
    expect(pick(input(order, { cover: true }))).toBe(OPT_COVER);
  });

  it("a bot-led squad's member keeps with its leader, but turns to a noise close by (and the mode's goal weighs less than its squad)", () => {
    const squad = { pos: at(5), radius: 5, squad: true };
    expect(pick(input(squad, { noise: { pos: at(40), age: 0 } }))).toBe(OPT_GOAL);
    expect(pick(input(squad, { noise: { pos: at(8), age: 0 } }))).toBe(OPT_NOISE);
    scoreChoices(input(squad), sc);
    const squadScore = sc[OPT_GOAL]!;
    scoreChoices(input({ pos: at(5), radius: 5, push: true }), sc);
    expect(squadScore).toBeGreaterThan(sc[OPT_GOAL]!);
  });
});

// ---------------------------------------------------------------- in a match

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 10; x++) for (let y = 0; y < 3; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [70, 0, 4], [10, 0, 10], [60, 0, 10], [4, 0, 16], [66, 0, 16]]);
};
const kill = (m: Match, victim: Combatant) => (m as unknown as { kill: (v: Combatant, k: Combatant | null, w: string) => void }).kill(victim, null, 'core.rifle');
const say = (m: Match, c: Combatant, s: number, seq: number, yaw = 0, pitch = 0) => m.queueInputs(c.slot, [{ seq, forward: 0, right: 0, yaw, pitch, buttons: 0, say: s }]);
const place = (c: Combatant, p: Vec3) => (c.move = { pos: { ...p }, velY: 0, grounded: true });

function fireteamMatch(seed = 1, size = 5, teams: [number, number] = [6, 6]) {
  const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: teams, fireteams: size, scoreLimit: 0, timeLimitSeconds: 0 }, seed);
  const filler = new BotFiller(match);
  const me = filler.join('me', undefined, teams[0] + teams[1])!;
  for (let i = 0; i < teams[0] + teams[1] - 1; i++) match.addBot(`b${i}`, CORE_BOT_PROFILES[i % CORE_BOT_PROFILES.length]!);
  return { match, filler, me };
}

/** Step until the match is in play (every body spawned). */
function play(match: Match, events: GameEvent[] = []): void {
  for (let i = 0; i < TICK_RATE * 10 && match.phase !== 'playing'; i++) events.push(...match.step());
  for (let i = 0; i < 10; i++) events.push(...match.step());
}

describe('Fireteams in a match', () => {
  it('Match setup: a variant of every team mode, squad size 4-6 (5 standard), into the rules', () => {
    const map = { ...yard(), metadata: { ...yard().metadata, supportedModes: ['core.tdm' as const, 'core.deathmatch' as const] } };
    const base = { map: 'test_map', mode: 'core.tdm' as const, bots: 11, skill: 'normal' as const, scoreLimit: 50, minutes: 10 };
    expect(variantStates(base, map, ['core.tdm']).some((v) => v.variant.id === 'fireteams')).toBe(true);
    expect(variantStates({ ...base, mode: 'core.deathmatch' }, map, ['core.deathmatch']).some((v) => v.variant.id === 'fireteams')).toBe(false);
    const on = setVariant(base, 'fireteams', true);
    expect(rulesFromSetup(on, map).rules.fireteams).toBe(5);
    expect(rulesFromSetup({ ...on, squadSize: 6 }, map).rules.fireteams).toBe(6);
    expect(rulesFromSetup({ ...on, squadSize: 9 }, map).rules.fireteams).toBe(5);
    const off = setVariant({ ...on, squadSize: 4 }, 'fireteams', false);
    expect(off.fireteams).toBeUndefined();
    expect(off.squadSize).toBeUndefined();
    expect(rulesFromSetup(off, map).rules.fireteams).toBeUndefined();
  });

  it('you lead a squad; Hold here from the wheel: checked, answered by a callout, and the squad holds there', () => {
    const { match, me } = fireteamMatch(2);
    const events: GameEvent[] = [];
    play(match, events);
    const ft = match.fireteams!;
    const mine = ft.squadOf(me.slot)!;
    expect(mine.leader).toBe(me.slot);
    expect(mine.members).toHaveLength(5);
    expect(events).toContainEqual(expect.objectContaining({ e: 'squad', a: 'lead', s: me.slot, h: 1 }));
    place(me, at(35, 10));
    events.length = 0;
    say(match, me, orderSay('hold'), 1);
    events.push(...match.step());
    expect(mine.order).toMatchObject({ kind: 'hold', pos: { x: 35, z: 10 } });
    expect(events).toContainEqual(expect.objectContaining({ e: 'squad', a: 'order', s: me.slot, k: 1, team: me.faction }));
    const ack = events.find((e) => e.e === 'squad' && e.a === 'ack');
    expect(ack && mine.members.includes((ack as { s: number }).s)).toBe(true);
    // The quick message "Hold here!" (B, 7) orders the squad too.
    place(me, at(30, 12));
    match.step();
    match.step();
    say(match, me, SAY_HOLD, 2);
    for (let i = 0; i < TICK_RATE; i++) match.step();
    expect(mine.order.pos).toMatchObject({ x: 30, z: 12 });
    // Nobody else's order is taken (a bot can't order; an order from a member of no squad is refused).
    const other = ft.teamSquads(me.faction!).find((s) => !s.human)!;
    expect(other.order.kind).toBe('follow');
  });

  it('Go there needs a point; a refused order tells the leader why', () => {
    const { match, me } = fireteamMatch(3);
    play(match);
    const events: GameEvent[] = [];
    // Looking straight up at an open sky: nothing to go to.
    say(match, me, orderSay('go'), 1, 0, 1.5);
    events.push(...match.step());
    expect(events).toContainEqual(expect.objectContaining({ e: 'squad', a: 'deny', s: me.slot }));
    expect(match.fireteams!.squadOf(me.slot)!.order.kind).toBe('follow');
    // Team Deathmatch has no objective to defend.
    events.length = 0;
    for (let i = 0; i < 30; i++) match.step();
    say(match, me, orderSay('defend'), 2);
    events.push(...match.step());
    expect(events).toContainEqual(expect.objectContaining({ e: 'squad', a: 'deny', s: me.slot, n: 4 }));
  });

  it('squadmates respawn beside their leader when it is safe there, else at a spawn point', () => {
    const { match, me } = fireteamMatch(4);
    play(match);
    const mine = match.fireteams!.squadOf(me.slot)!;
    const mate = match.slots[mine.members.find((m) => m !== me.slot)!]!;
    const foes = match.combatants().filter((c) => c.faction !== me.faction);
    const respawn = () => {
      place(mate, at(70, 20));
      kill(match, mate);
      for (let i = 0; i < TICK_RATE * 15 && !mate.alive; i++) {
        place(me, at(10, 12));
        me.hurtAt = -Infinity;
        match.step();
      }
      return mate.alive ? Math.hypot(mate.move.pos.x - 10, mate.move.pos.z - 12) : Infinity;
    };
    // Enemies far off (and out of the way): beside the leader.
    for (const f of foes) place(f, at(78, 0));
    expect(respawn()).toBeLessThan(2.5);
    // An enemy right by the leader: not there.
    for (const f of foes) if (f.alive) place(f, at(14, 12));
    const d = respawn();
    expect(d).toBeGreaterThan(5);
  });

  it('a friend joining mid-match takes over a bot-led squad: its leader steps down, nobody respawns', () => {
    const { match, filler } = fireteamMatch(5, 4, [8, 8]);
    play(match);
    const ft = match.fireteams!;
    const spawns = new Map(match.combatants().map((c) => [c.slot, c.spawns ?? 0]));
    const ana = filler.join('Ana', undefined, 16)!;
    for (let i = 0; i < 3; i++) match.step();
    const hers = ft.squadOf(ana.slot)!;
    expect(hers.leader).toBe(ana.slot);
    expect(hers.human).toBe(true);
    expect(hers.members.length).toBeGreaterThanOrEqual(3);
    for (const m of hers.members) if (m !== ana.slot) expect(match.slots[m]!.spawns ?? 0).toBe(spawns.get(m));
    for (const s of ft.squads) expect(s.members.filter((m) => match.slots[m]?.kind === 'human').length).toBeLessThanOrEqual(1);
    // She leaves: a bot leads her squad.
    filler.leave(ana.slot, 16);
    for (let i = 0; i < 3; i++) match.step();
    expect(hers.human).toBe(false);
    expect(match.slots[hers.leader!]?.kind).toBe('bot');
  });

  it("the squad's bots go where their order sends them (Hold here: within a few metres of it)", () => {
    const { match, me } = fireteamMatch(6);
    play(match);
    const mine = match.fireteams!.squadOf(me.slot)!;
    // Enemies out of the way, so nothing draws the squad off.
    for (const c of match.combatants()) if (c.faction !== me.faction) match.remove(c.slot);
    place(me, at(40, 12));
    say(match, me, orderSay('hold'), 1);
    match.step();
    place(me, at(4, 4));
    for (let i = 0; i < TICK_RATE * 20; i++) {
      me.move.pos.x = 4;
      me.move.pos.z = 4;
      match.step();
    }
    const near = mine.members.filter((m) => m !== me.slot).map((m) => Math.hypot(match.slots[m]!.move.pos.x - 40, match.slots[m]!.move.pos.z - 12));
    for (const d of near) expect(d).toBeLessThan(8);
    expect(match.fireteams!.orders.at(-1)!.done).not.toBeNull();
  });
});
