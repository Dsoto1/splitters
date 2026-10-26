import { beforeAll, describe, expect, it } from 'vitest';
import { CORE_BOT_PROFILES, DEFAULT_RULES, SAY_FOLLOW, initPhysics, type GameEvent } from '../src/index.ts';
import { BotFiller, LEADER_BOUNTY, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};
const kill = (m: Match, victim: Combatant, killer: Combatant) => (m as unknown as { kill: (v: Combatant, k: Combatant, w: string) => void }).kill(victim, killer, 'core.rifle');

describe('team leaders', () => {
  it('the first person on a team leads it (a bot leads a team without one), and a person joining takes over from a bot leader', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3], leaders: true }, 2);
    const filler = new BotFiller(match);
    const me = filler.join('me', undefined, 6)!;
    const events: GameEvent[] = match.step();
    const [a, b] = match.leaders();
    const mine = match.teams![0]!.id === me.faction ? a : b;
    const theirs = mine === a ? b : a;
    expect(mine).toBe(me.slot);
    expect(match.isLeader(me)).toBe(true);
    expect(match.slots[theirs!]?.kind).toBe('bot');
    expect(events.filter((e) => e.e === 'leader' && e.a === 'lead')).toHaveLength(2);
    expect(match.snapshot([]).ld).toEqual(match.leaders());
    // A friend joins the other team: they lead it now.
    const ana = filler.join('Ana', undefined, 6)!;
    expect(ana.faction).not.toBe(me.faction);
    match.step();
    expect(match.isLeader(ana)).toBe(true);
    // Leaving hands the job on.
    filler.leave(me.slot, 6);
    match.step();
    expect(match.leaders().every((s) => s >= 0)).toBe(true);
  });

  it("the leader's Follow me! reaches every bot on the team; anyone else's only the bots nearby", () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3], leaders: true }, 3);
    const me = match.addHuman('me')!;
    const mates = [0, 1, 2, 3, 4].map((i) => match.addBot(`b${i}`, CORE_BOT_PROFILES[1]!)!).filter((b) => b.faction === me.faction);
    for (const b of match.combatants()) if (b.faction !== me.faction) match.remove(b.slot);
    for (let i = 0; i < 5; i++) match.step();
    expect(match.isLeader(me)).toBe(true);
    me.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
    for (const b of mates) b.move = { pos: { x: 55, y: 0, z: 10 }, velY: 0, grounded: true };
    match.queueInputs(me.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: SAY_FOLLOW }]);
    match.step();
    for (const b of mates) expect(b.order?.kind).toBe('follow');

    // Without leaders, the same far-off order reaches nobody.
    const plain = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3] }, 3);
    const p = plain.addHuman('me')!;
    const far = [0, 1, 2, 3, 4].map((i) => plain.addBot(`b${i}`, CORE_BOT_PROFILES[1]!)!).filter((b) => b.faction === p.faction);
    for (let i = 0; i < 5; i++) plain.step();
    p.move = { pos: { x: 0, y: 0, z: 4 }, velY: 0, grounded: true };
    for (const b of far) b.move = { pos: { x: 55, y: 0, z: 10 }, velY: 0, grounded: true };
    plain.queueInputs(p.slot, [{ seq: 1, forward: 0, right: 0, yaw: 0, pitch: 0, buttons: 0, say: SAY_FOLLOW }]);
    plain.step();
    for (const b of far) expect(b.order).toBeUndefined();
  });

  it('Leader variant: downing the enemy leader scores extra for your team', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2], leaders: 'vip', scoreLimit: 0 }, 4);
    const me = match.addHuman('me')!;
    const foe = match.addHuman('foe')!;
    expect(foe.faction).not.toBe(me.faction);
    match.step();
    expect(match.isLeader(foe)).toBe(true);
    kill(match, foe, me);
    const ev = match.step().find((e) => e.e === 'leader' && e.a === 'down');
    expect(ev).toMatchObject({ s: foe.slot, team: foe.faction, n: LEADER_BOUNTY });
    expect(match.teamScores().get(me.faction!)).toBe(1 + LEADER_BOUNTY);
    // Plain leaders: a kill is a kill.
    const plain = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2], leaders: true, scoreLimit: 0 }, 4);
    const a = plain.addHuman('a')!;
    const b = plain.addHuman('b')!;
    plain.step();
    kill(plain, b, a);
    expect(plain.teamScores().get(a.faction!)).toBe(1);
  });
});
