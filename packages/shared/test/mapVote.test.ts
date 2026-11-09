import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MapRotation, MapVote, TICK_RATE, VOTE_RESULT_SECONDS, VOTE_SECONDS, initPhysics, isPartyTag, newPartyTag, parseClientMessage, parseVoteState, pickVoteOptions, tallyVotes, type VoteCandidate } from '../src/index.ts';
import { BotFiller, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

/** A seeded random source, so the shuffled suite repeats. */
const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const c = (map: string, max = 16, mode: VoteCandidate['mode'] = 'core.deathmatch'): VoteCandidate => ({ map, name: map.toUpperCase(), mode, max });

describe('map vote: the ballot', () => {
  it('starts with the rotation, then fills from the suite, never the map just played', () => {
    const opts = pickVoteOptions({ rotation: [c('b'), c('c')], suite: [c('a'), c('d'), c('e')], current: 'a', people: 2, random: seeded(1) });
    expect(opts.map((o) => o.map).slice(0, 2)).toEqual(['b', 'c']);
    expect(opts).toHaveLength(3);
    expect(opts.map((o) => o.map)).not.toContain('a');
  });

  it('leaves out maps too small for the people in the match (their player cap for the mode)', () => {
    const opts = pickVoteOptions({ rotation: [c('tiny', 4)], suite: [c('big', 32), c('mid', 12), c('small', 6)], current: 'x', people: 8, random: seeded(2) });
    expect(opts.map((o) => o.map).sort()).toEqual(['big', 'mid']);
  });

  it('two or three maps, no vote with fewer than two that fit; the map just played only when nothing else fits', () => {
    expect(pickVoteOptions({ rotation: [], suite: [c('a'), c('b'), c('c'), c('d')], current: 'a', people: 1, random: seeded(3) })).toHaveLength(3);
    expect(pickVoteOptions({ rotation: [], suite: [c('a'), c('b')], current: 'a', people: 1 }).map((o) => o.map)).toEqual(['b', 'a']);
    expect(pickVoteOptions({ rotation: [], suite: [c('a'), c('b', 2)], current: 'a', people: 3 })).toEqual([]);
    expect(pickVoteOptions({ rotation: [], suite: [], current: 'a', people: 1 })).toEqual([]);
  });

  it('a different few from the suite each time (seeded here), each map once', () => {
    const suite = 'abcdefghij'.split('').map((m) => c(m));
    const a = pickVoteOptions({ rotation: [], suite, current: 'z', people: 1, random: seeded(4) }).map((o) => o.map);
    const b = pickVoteOptions({ rotation: [], suite, current: 'z', people: 1, random: seeded(99) }).map((o) => o.map);
    expect(new Set(a).size).toBe(3);
    expect(a).not.toEqual(b);
  });
});

describe('map vote: the tally', () => {
  const votes = (pairs: [number, number][]) => new Map(pairs);
  it('the most votes wins', () => {
    expect(tallyVotes(votes([[1, 2], [2, 2], [3, 0]]), 3)).toEqual({ winner: 2, counts: [1, 0, 2], by: 'votes' });
  });
  it("a tie goes to the host's vote when it is among the tied maps", () => {
    expect(tallyVotes(votes([[0, 1], [5, 2]]), 3, 5)).toMatchObject({ winner: 2, by: 'host' });
    expect(tallyVotes(votes([[0, 1], [5, 2]]), 3, 0)).toMatchObject({ winner: 1, by: 'host' });
  });
  it('else to the first tied map in ballot order (the rotation’s next first): a dedicated server, or the host voted elsewhere', () => {
    expect(tallyVotes(votes([[0, 2], [1, 1]]), 3, null)).toMatchObject({ winner: 1, by: 'order' });
    expect(tallyVotes(votes([[0, 2], [1, 1], [2, 2], [3, 1], [9, 0]]), 3, 9)).toMatchObject({ winner: 1, by: 'order' });
  });
  it('nobody voted: the first map (the rotation goes on as without a vote)', () => {
    expect(tallyVotes(new Map(), 3, 4)).toEqual({ winner: 0, counts: [0, 0, 0], by: 'none' });
  });
});

describe('map vote: one vote, ticked by its host', () => {
  const options = [
    { map: 'a', name: 'A', mode: 'core.deathmatch' as const },
    { map: 'b', name: 'B', mode: 'core.deathmatch' as const },
  ];
  it('takes votes until it closes, a later vote replacing an earlier one; then the winner', () => {
    const v = new MapVote(options, 100, 7);
    expect(v.cast(1, 0)).toBe(true);
    expect(v.cast(1, 1)).toBe(true);
    expect(v.cast(2, 0)).toBe(true);
    expect(v.cast(3, 5)).toBe(false);
    expect(v.state(40)).toMatchObject({ n: [1, 1], left: Math.ceil(60 / TICK_RATE) });
    expect(v.tick(99)).toBe(false);
    // Host 7 votes for B at the last moment: the tie is theirs to break.
    v.cast(7, 1);
    expect(v.forget(2)).toBe(true);
    v.cast(2, 0);
    expect(v.tick(100)).toBe(true);
    expect(v.winner?.map).toBe('b');
    expect(v.state(100)).toMatchObject({ w: 1, by: 'votes', left: 0 });
    // Closed: no more votes.
    expect(v.cast(8, 0)).toBe(false);
  });
  it('a scoreboard held longer (a host, a test) keeps the vote open until just before it ends', () => {
    const v = new MapVote(options, 100, null);
    expect(v.tick(100, 1000)).toBe(false);
    expect(v.closeAt).toBe(1000 - (VOTE_RESULT_SECONDS + 1) * TICK_RATE);
    expect(v.tick(v.closeAt, 1000)).toBe(true);
  });
  it('let go of again (a shorter hold), it closes as planned', () => {
    const v = new MapVote(options, 100, null);
    expect(v.tick(50, 1000)).toBe(false);
    expect(v.tick(200, 300)).toBe(true);
    expect(v.planned).toBe(100);
  });
  it('carried over by a successor host (handoff): the same votes on new slots; a closed one keeps its winner untallied', () => {
    const open = MapVote.resumed(options, 50, 3, [[3, 0], [9, 1], [4, 1], [5, 7]]);
    expect(open.closed).toBe(false);
    expect(open.ballots().sort()).toEqual([[3, 0], [4, 1], [9, 1]]);
    expect(open.state(20)).toMatchObject({ n: [1, 2], left: Math.ceil(30 / TICK_RATE) });
    expect(open.cast(9, 0)).toBe(true);
    expect(open.tick(50)).toBe(true);
    // 2-1 to A now; the successor (3) voted A.
    expect(open.winner?.map).toBe('a');
    // The old host broke a 1-1 tie for B: the successor (who voted A) doesn't decide it again.
    const won = MapVote.resumed(options, 0, 3, [[3, 0], [4, 1]], { w: 1, by: 'host' });
    expect(won.closed).toBe(true);
    expect(won.winner?.map).toBe('b');
    expect(won.state(0)).toMatchObject({ w: 1, by: 'host', n: [1, 1], left: 0 });
    expect(won.cast(5, 0)).toBe(false);
  });
  it('lasts the vote and the winner’s moment', () => {
    expect(MapVote.ticks()).toBe((VOTE_SECONDS + VOTE_RESULT_SECONDS) * TICK_RATE);
  });
  it('a vote state from the wire is checked', () => {
    const v = new MapVote(options, 10, null);
    v.tick(10);
    expect(parseVoteState(JSON.parse(JSON.stringify(v.state(10))))).toEqual(v.state(10));
    expect(parseVoteState({ o: [options[0]], n: [0] })).toBeNull();
    expect(parseVoteState({ o: options, n: [1], left: 3 })).toBeNull();
    expect(parseVoteState({ o: options, n: [1, 2], left: 3, w: 9 })).toEqual({ o: options, n: [1, 2], left: 3 });
  });
  it('players send a vote (an index), anything else is dropped', () => {
    expect(parseClientMessage('{"t":"vote","i":2}')).toEqual({ t: 'vote', i: 2 });
    expect(parseClientMessage('{"t":"vote","i":-1}')).toBeNull();
    expect(parseClientMessage('{"t":"vote","i":"x"}')).toBeNull();
    expect(parseClientMessage('{"t":"host","cmd":{"c":"rotation","vote":false}}')).toEqual({ t: 'host', cmd: { c: 'rotation', vote: false } });
  });
});

describe('map rotation and the vote', () => {
  const e = (map: string) => ({ map, mode: 'core.deathmatch' as const });
  it('a vote that picks a rotation map moves the rotation there; it carries on after it', () => {
    const r = new MapRotation([e('a'), e('b'), e('c'), e('d')]);
    r.advance();
    expect(r.upcomingEntries().map((x) => x.map)).toEqual(['b', 'c', 'd', 'a']);
    expect(r.moveTo(e('c'))).toBe(true);
    expect(r.current).toBe(2);
    expect(r.peek()?.entry.map).toBe('d');
    // Behind us this time round: from it, next time round.
    expect(r.moveTo(e('a'))).toBe(true);
    expect(r.peek()?.entry.map).toBe('b');
    expect(r.moveTo(e('zz'))).toBe(false);
  });
});

describe('parties', () => {
  beforeAll(() => Promise.all([initPhysics(), initNavigation()]));
  const yard = () => {
    const tiles = [];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
    return makeMap(tiles, [[0, 0, 4], [30, 0, 4], [10, 0, 10], [20, 0, 10]]);
  };

  it('tags are short and random; hello carries a good one only', () => {
    const t = newPartyTag();
    expect(isPartyTag(t)).toBe(true);
    expect(newPartyTag()).not.toBe(t);
    expect(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 5, name: 'A', party: t }))).toMatchObject({ party: t });
    expect(parseClientMessage(JSON.stringify({ t: 'hello', protocol: 5, name: 'A', party: '<b>' }))).not.toHaveProperty('party');
  });

  it('team modes: a party joins on one team, taking bots’ places there; the roster says who is in it', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [4, 4] });
    const bots = new BotFiller(match);
    bots.rebalance(8);
    const host = bots.join('Host', undefined, 8, 'PARTY01')!;
    const friends = ['Ann', 'Bo', 'Cy'].map((n) => bots.join(n, undefined, 8, 'PARTY01')!);
    const stranger = bots.join('Dee', undefined, 8, 'OTHER01')!;
    expect(friends.every((f) => f.faction === host.faction)).toBe(true);
    // The team is all people now: the stranger is on the other one; bots keep both teams at 4.
    expect(stranger.faction).not.toBe(host.faction);
    const sizes = new Map<string, number>();
    for (const x of match.combatants()) sizes.set(x.faction!, (sizes.get(x.faction!) ?? 0) + 1);
    expect([...sizes.values()]).toEqual([4, 4]);
    expect(match.roster().filter((r) => r.py === 'PARTY01').map((r) => r.name).sort()).toEqual(['Ann', 'Bo', 'Cy', 'Host']);
    expect(match.roster().find((r) => r.bot)?.py).toBeUndefined();
  });

  it('the party carries over to the next map: rejoining there, the members end up together again', () => {
    const one = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3] });
    const b1 = new BotFiller(one);
    b1.rebalance(6);
    // A stranger first: balanced join puts the party's first member on the other team, then the rest follow it.
    b1.join('Dee', undefined, 6, 'OTHER01');
    const first = b1.join('Host', undefined, 6, 'PARTY01')!;
    const ann = b1.join('Ann', undefined, 6, 'PARTY01')!;
    expect(ann.faction).toBe(first.faction);
    // Travel: everyone rejoins the next match (people only, in the order they come back), with the tag they had.
    const people = one.combatants().filter((x) => x.kind === 'human').map((x) => ({ name: x.name, party: x.party }));
    const two = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [3, 3] });
    const b2 = new BotFiller(two);
    b2.rebalance(6);
    for (const p of [...people].reverse()) b2.join(p.name, undefined, 6, p.party);
    const by = (n: string) => two.combatants().find((x) => x.name === n)!;
    expect(by('Host').faction).toBe(by('Ann').faction);
    expect(two.combatants().filter((x) => x.kind === 'human')).toHaveLength(3);
    expect(two.combatants()).toHaveLength(6);
  });

  it('a spectating member keeps the party; a leaver’s place goes to a bot without it', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.tdm'], teamSizes: [2, 2] });
    const bots = new BotFiller(match);
    bots.rebalance(4);
    const a = bots.join('Ann', undefined, 4, 'PARTY01')!;
    expect(bots.spectate(a.slot, 4)).toBe(true);
    expect(match.roster().find((r) => r.slot === a.slot)?.py).toBe('PARTY01');
    const back = bots.rejoin(a.slot, 4)!;
    expect(back.party).toBe('PARTY01');
    bots.leave(back.slot, 4);
    expect(match.combatants().some((x) => x.party)).toBe(false);
  });

  it('the scoreboard is held for the vote: the intermission never ends sooner than asked, and a longer hold stays', () => {
    const match = new Match(yard(), DEFAULT_RULES['core.deathmatch']);
    expect(match.intermissionEnds).toBeNull();
    match.holdIntermission(10_000);
    expect(match.intermissionEnds).toBeNull();
    match.endMatch();
    const end = match.intermissionEnds!;
    match.holdIntermission(match.tick + MapVote.ticks());
    expect(match.intermissionEnds).toBe(Math.max(end, match.tick + MapVote.ticks()));
    match.holdIntermission(match.tick + 1);
    expect(match.intermissionEnds).toBe(Math.max(end, match.tick + MapVote.ticks()));
  });
});
