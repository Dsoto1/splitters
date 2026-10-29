import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOT_NAME_MAX, BOT_SET_MAX, DEFAULT_RULES, botSetFromText, botSetToText, initPhysics, parseBotSetPreset, parseClientMessage, presetBotSet, validateBotSet, type BotSet, type GameMode } from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation, type Combatant } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const mapsDir = new URL('../../../maps/', import.meta.url);

const yard = () => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
};

const setup = (mode: GameMode, fill: number, botSet: BotSet | null, teamSizes?: number[]) => {
  const match = new Match(yard(), { ...DEFAULT_RULES[mode], ...(teamSizes ? { teamSizes } : {}) }, 3);
  const bots = new BotFiller(match, undefined, { botSet });
  const me = bots.join('Host', undefined, fill)!;
  const control = new HostControl(match, bots, fill);
  return { match, bots, me, control };
};
const botsOf = (m: Match): Combatant[] => m.combatants().filter((c) => c.kind === 'bot');
const set = (entries: BotSet['entries'], fill: BotSet['fill'] = 'random', name = 'Test'): BotSet => validateBotSet({ name, entries, fill })!.set;

describe('bot sets: the data', () => {
  it('validates: names cleaned, capped and unique; unknown looks, skills, styles and teams back to the default', () => {
    const v = validateBotSet({
      name: '  My <b>set</b>\u0007 ',
      fill: 'only',
      entries: [
        { name: '  Sir   Clank\n', look: 'core.knight', skill: 'hard', style: 'tactical', team: 1, squad: ' Red <one> ' },
        { name: 'Sir Clank', look: 'core.nope', skill: 'godlike', style: 'zany', team: 12 },
        { name: 'x'.repeat(50), look: 'random', skill: 'default', team: 'auto' },
        { name: '' },
        { look: 'npc:zombie' },
      ],
    })!;
    expect(v.set.name).toBe('My bset/b');
    expect(v.set.fill).toBe('only');
    expect(v.set.entries[0]).toEqual({ name: 'Sir Clank', look: 'core.knight', skill: 'hard', style: 'tactical', team: 1, squad: 'Red one' });
    expect(v.set.entries[1]).toEqual({ name: 'Sir Clank 2' });
    expect(v.set.entries[2]!.name).toHaveLength(BOT_NAME_MAX);
    expect(v.set.entries[2]).toEqual({ name: 'x'.repeat(BOT_NAME_MAX) });
    expect(v.set.entries[3]).toEqual({ name: 'Bot 4' });
    expect(v.set.entries[4]).toEqual({ name: 'Bot 5', look: 'npc:zombie' });
    expect(v.fixes).toEqual(expect.arrayContaining([expect.stringContaining('unknown look'), expect.stringContaining('unknown skill'), expect.stringContaining('unknown style'), expect.stringContaining('no such team')]));
    expect(validateBotSet({ entries: Array.from({ length: BOT_SET_MAX + 5 }, (_, i) => ({ name: `B${i}` })) })!.set.entries).toHaveLength(BOT_SET_MAX);
    expect(validateBotSet('nope')).toBeNull();
    expect(validateBotSet({ entries: 'nope' })).toBeNull();
    expect(validateBotSet({})!.set).toEqual({ name: 'Custom bots', entries: [], fill: 'random' });
  });

  it('round-trips through its text form (console, launcher, BOTSET)', () => {
    const s = set([{ name: 'Sir Clank', look: 'core.knight', skill: 'hard', team: 0, squad: 'Vanguard' }, { name: 'Zorp', look: 'core.visitor', style: 'arena' }, { name: 'Plain' }], 'only', 'Duel');
    const text = botSetToText(s);
    expect(text).toBe('only\nSir Clank, core.knight, hard, -, 1, Vanguard\nZorp, core.visitor, -, arena\nPlain');
    expect(botSetFromText(text, 'Duel').set).toEqual(s);
    // Looks by name, teams from 1, ";" between bots.
    expect(botSetFromText('Ace, Iron Knight, easy, -, 2; Bo, zombie').set.entries).toEqual([{ name: 'Ace', look: 'core.knight', skill: 'easy', team: 1 }, { name: 'Bo', look: 'npc:zombie' }]);
  });

  it('the built-in presets (maps/botsets) are valid, named after their files, and play as sets', () => {
    const dir = new URL('botsets/', mapsDir);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const p = parseBotSetPreset(JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
      expect(p, f).not.toBeNull();
      expect(`${p!.id}.json`).toBe(f);
      const s = presetBotSet(p!);
      // Validation changes nothing in a preset: what the file says is what plays.
      expect(validateBotSet(s)!.fixes, f).toEqual([]);
      expect(s.entries.map((e) => e.name)).toEqual(p!.entries.map((e) => e.name));
    }
    expect(parseBotSetPreset({ format: 'tiletrigger.botset', id: 'x_y', name: 'X', entries: [{ name: 'A', look: 'core.nope' }] })).toBeNull();
  });

  it('a host command carries the set, made valid; not a set is refused', () => {
    const cmd = (c: unknown) => parseClientMessage(JSON.stringify({ t: 'host', cmd: c }));
    expect(cmd({ c: 'bots', botSet: { name: 'A', entries: [{ name: 'Ann<>', look: 'bad' }], fill: 'only' } })).toEqual({ t: 'host', cmd: { c: 'bots', botSet: { name: 'A', entries: [{ name: 'Ann' }], fill: 'only' } } });
    expect(cmd({ c: 'bots', botSet: null })).toEqual({ t: 'host', cmd: { c: 'bots', botSet: null } });
    expect(cmd({ c: 'bots', fill: 4 })).toEqual({ t: 'host', cmd: { c: 'bots', fill: 4 } });
    expect(cmd({ c: 'bots', botSet: [1, 2] })).toBeNull();
    expect(cmd({ c: 'bots', botSet: { entries: 7 } })).toBeNull();
  });
});

describe('bot sets in a match (BotFiller)', () => {
  it('free-for-all: the set first, in order, with its looks and skills; random bots fill the rest', () => {
    const s = set([{ name: 'Sir Clank', look: 'core.knight', skill: 'hard', style: 'tactical' }, { name: 'Zorp', look: 'core.visitor', skill: 'easy' }]);
    const { match, control } = setup('core.deathmatch', 5, s);
    const bots = botsOf(match);
    expect(bots).toHaveLength(4);
    const clank = bots.find((b) => b.name === 'Sir Clank')!;
    expect(clank.look).toBe('core.knight');
    expect(clank.bot!.difficulty.id).toBe('hard');
    expect(clank.bot!.profile.tags).toContain('TACTICAL');
    expect(bots.find((b) => b.name === 'Zorp')!.bot!.difficulty.id).toBe('easy');
    // The match's skill changes the others, not bots with their own.
    control.apply({ c: 'bots', skill: 'easy' });
    expect(botsOf(match).find((b) => b.name === 'Sir Clank')!.bot!.difficulty.id).toBe('hard');
    expect(botsOf(match).filter((b) => !b.botSet).every((b) => b.bot!.difficulty.id === 'easy')).toBe(true);
    expect(control.state().botSet).toEqual(s);
  });

  it('"only these bots" keeps the match to the set', () => {
    const { match } = setup('core.deathmatch', 8, set([{ name: 'A' }, { name: 'B' }], 'only'));
    expect(botsOf(match).map((b) => b.name).sort()).toEqual(['A', 'B']);
  });

  it('team modes: each team takes its own bots, unteamed ones go where needed', () => {
    const s = set([{ name: 'Red1', team: 0 }, { name: 'Blue1', team: 1 }, { name: 'Blue2', team: 1 }, { name: 'Any' }, { name: 'Red2', team: 0 }], 'only');
    const { match } = setup('core.tdm', 6, s, [3, 3]);
    const [a, b] = match.teams!.map((t) => t.id);
    expect(botsOf(match).find((c) => c.name === 'Red1')!.faction).toBe(a);
    expect(botsOf(match).find((c) => c.name === 'Red2')!.faction).toBe(a);
    expect(botsOf(match).find((c) => c.name === 'Blue1')!.faction).toBe(b);
    expect(botsOf(match).find((c) => c.name === 'Blue2')!.faction).toBe(b);
    expect(botsOf(match)).toHaveLength(5);
  });

  it('kept bots keep who they are across rebalances: random bots give way first, then the set from its end', () => {
    const s = set([{ name: 'Keep1', look: 'core.knight' }, { name: 'Keep2', look: 'core.nova' }, { name: 'Keep3' }]);
    const { match, bots, control } = setup('core.deathmatch', 7, s);
    expect(botsOf(match)).toHaveLength(6);
    // The random bots score best: they still give way first.
    for (const b of botsOf(match)) b.kills = b.botSet ? 0 : 10;
    control.apply({ c: 'bots', fill: 4 });
    expect(botsOf(match).map((b) => b.name).sort()).toEqual(['Keep1', 'Keep2', 'Keep3']);
    control.apply({ c: 'bots', fill: 3 });
    expect(botsOf(match).map((b) => b.name).sort()).toEqual(['Keep1', 'Keep2']);
    const slot = botsOf(match).find((b) => b.name === 'Keep1')!.slot;
    // A player joining takes a bot's place (the last of the set), and Keep3 comes back when they leave.
    const guest = bots.join('Guest', undefined, 3)!;
    expect(botsOf(match).map((b) => b.name)).toEqual(['Keep1']);
    bots.leave(guest.slot, 3);
    control.apply({ c: 'bots', fill: 5 });
    expect(botsOf(match)).toHaveLength(4);
    expect(botsOf(match).map((b) => b.name)).toEqual(expect.arrayContaining(['Keep1', 'Keep2', 'Keep3']));
    const keep1 = match.slots[slot]!;
    expect(keep1.name).toBe('Keep1');
    expect(keep1.look).toBe('core.knight');
  });

  it('a new set mid-match: kept bots change in place, the rest are swapped in a bot at a time', () => {
    const { match, bots, control } = setup('core.deathmatch', 6, null);
    const before = botsOf(match).map((b) => b.slot);
    expect(before).toHaveLength(5);
    const r = control.apply({ c: 'bots', botSet: set([{ name: 'Ace', look: 'core.knight', skill: 'hard' }, { name: 'Bo' }, { name: 'Cy' }], 'only', 'Trio') });
    expect(r.notice).toBe('Host set the bots to Trio: 3 bots only');
    // Nothing swapped yet: one bot at a time.
    expect(bots.settling).toBe(true);
    let steps = 0;
    while (bots.settling && steps < 50) {
      const n = botsOf(match).length;
      bots.stage(control.fill);
      expect(Math.abs(botsOf(match).length - n)).toBeLessThanOrEqual(1);
      steps++;
    }
    expect(bots.settling).toBe(false);
    expect(botsOf(match).map((b) => b.name).sort()).toEqual(['Ace', 'Bo', 'Cy']);
    const ace = botsOf(match).find((b) => b.name === 'Ace')!;
    expect(ace.look).toBe('core.knight');
    expect(ace.bot!.difficulty.id).toBe('hard');
    // Rename and relook in place (same position in the list): the same bot, not a new one.
    control.apply({ c: 'bots', botSet: set([{ name: 'Ace of Spades', look: 'core.nova' }, { name: 'Bo' }, { name: 'Cy' }], 'only', 'Trio') });
    const same = match.slots[ace.slot]!;
    expect(same.name).toBe('Ace of Spades');
    expect(same.look).toBe('core.nova');
    expect(same.bot!.difficulty.id).toBe('normal');
    // Back to random bots: the set's bots play on under random names, and the fill is kept.
    control.apply({ c: 'bots', botSet: null });
    while (bots.settling) bots.stage(control.fill);
    expect(botsOf(match)).toHaveLength(5);
    expect(botsOf(match).some((b) => b.botSet)).toBe(false);
    expect(control.state().botSet).toBeNull();
  });

  it('squads: followers go to their leader, and take its goal once with it', () => {
    const s = set([{ name: 'Lead', team: 0, squad: 'Red' }, { name: 'Follow', team: 0, squad: 'red' }, { name: 'Solo', team: 0 }], 'only');
    const { match } = setup('core.tdm', 8, s, [4, 4]);
    const lead = botsOf(match).find((b) => b.name === 'Lead')!;
    const follow = botsOf(match).find((b) => b.name === 'Follow')!;
    const solo = botsOf(match).find((b) => b.name === 'Solo');
    expect(follow.faction).toBe(lead.faction);
    const goal = (c: Combatant) => (match as unknown as { squadGoal(c: Combatant): { pos: { x: number; z: number }; radius: number } | null | undefined }).squadGoal(c);
    expect(goal(lead)).toBeUndefined();
    if (solo) expect(goal(solo)).toBeUndefined();
    lead.move.pos = { x: 40, y: lead.move.pos.y, z: 10 };
    follow.move.pos = { x: 0, y: follow.move.pos.y, z: 4 };
    expect(goal(follow)).toMatchObject({ pos: { x: 40, z: 10 }, radius: 5 });
    follow.move.pos = { x: 36, y: follow.move.pos.y, z: 10 };
    expect(goal(follow)).toMatchObject({ radius: 6 });
    // The leader goes down: the next of the squad alive leads.
    lead.alive = false;
    (match as unknown as { squadLeads: null }).squadLeads = null;
    expect(goal(follow)).toBeUndefined();
  });

  it('a set survives a map change (a new BotFiller takes it)', () => {
    const s = set([{ name: 'Ace', look: 'core.knight' }]);
    const { bots } = setup('core.deathmatch', 3, s);
    const match2 = new Match(yard(), DEFAULT_RULES['core.deathmatch'], 4);
    const next = new BotFiller(match2, bots.skill, { botSet: bots.botSet });
    next.rebalance(3);
    expect(botsOf(match2).map((b) => b.name)).toContain('Ace');
  });
});
