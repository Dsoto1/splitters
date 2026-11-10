import { beforeAll, describe, expect, it } from 'vitest';
import {
  BOT_CAST_CHOICES,
  BOT_NAME_MAX,
  CHARACTER_GROUPS,
  CORE_LOOKS,
  DEFAULT_RULES,
  NPC_LOOKS,
  SERVER_RULES,
  applyCommand,
  botCastLabel,
  castAllows,
  castLooks,
  encodeLook,
  initPhysics,
  lookGroup,
  lookTheme,
  parseClientMessage,
  rulesFromSetup,
  rulesForTravel,
  validBotCast,
  validateBotSet,
  validateMap,
  type MapDocument,
} from '../src/index.ts';
import { BOT_NAMES, BOT_THEME_MIN, NAME_THEMES, botNameFor } from '../src/content/botNames.ts';
import { NAME_THEME_INFO } from '../src/content/botThemes.ts';
import { MAX_PLAYER_SLOTS } from '../src/sim/constants.ts';
import { BotFiller, HostControl, Match, initNavigation, type Combatant } from '../src/match.ts';
// @ts-expect-error: a plain .mjs tool without types
import { NAME_THEMES as MANIFEST_THEMES, readManifests } from '../../../tools/content/character-manifests.mjs';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = (cast?: string[]): MapDocument => {
  const tiles = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  const map = makeMap(tiles, [[0, 0, 4], [50, 0, 4], [10, 0, 10], [40, 0, 10]]);
  return cast ? { ...map, botCast: cast } : map;
};
const botsOf = (m: Match): Combatant[] => m.combatants().filter((c) => c.kind === 'bot');
const soldierLooks = CORE_LOOKS.filter((l) => l.group === 'soldiers').map((l) => l.id);

describe('bot name themes: the lists', () => {
  it(`every list has at least ${BOT_THEME_MIN} names, each unique, short enough, without digits`, () => {
    for (const t of NAME_THEMES) {
      expect(t.names.length, t.id).toBeGreaterThanOrEqual(BOT_THEME_MIN);
      expect(new Set(t.names.map((n) => n.toLowerCase())).size, t.id).toBe(t.names.length);
      for (const n of t.names) {
        expect(n.length, `${t.id}: ${n}`).toBeLessThanOrEqual(BOT_NAME_MAX);
        expect(n.trim(), `${t.id}: ${n}`).toBe(n);
        expect(/\d/.test(n), `${t.id}: ${n}`).toBe(false);
        expect(/^[A-Za-z][A-Za-z .'-]*$/.test(n), `${t.id}: ${n}`).toBe(true);
      }
    }
    expect(new Set(NAME_THEMES.map((t) => t.id)).size).toBe(NAME_THEMES.length);
    expect(NAME_THEMES.length).toBeGreaterThanOrEqual(20);
  });

  it('soldiers are a rank and a surname', () => {
    const soldier = NAME_THEMES.find((t) => t.id === 'soldier')!;
    for (const n of soldier.names) expect(n, n).toMatch(/^(Pvt|Pfc|Cpl|Sgt|SSgt|Lt|Capt|Maj|Col)\. [A-Z][a-z]+$/);
    // Every surname comes once before any comes back.
    const surnames = soldier.names.slice(0, 100).map((n) => n.split(' ')[1]);
    expect(new Set(surnames).size).toBe(100);
  });

  it('theme ids never clash with group ids; the manifest checker knows the same themes', () => {
    for (const t of NAME_THEMES) expect(CHARACTER_GROUPS.some((g) => g.id === t.id), t.id).toBe(false);
    expect(MANIFEST_THEMES).toEqual(NAME_THEMES.map((t) => t.id));
    expect(BOT_CAST_CHOICES).toHaveLength(CHARACTER_GROUPS.length + NAME_THEMES.length);
    // The menu's ids and labels (botThemes.ts) and the lists (botNames.ts) name the same themes, each with its names.
    expect(NAME_THEMES.map((t) => t.id)).toEqual(NAME_THEME_INFO.map((t) => t.id));
  });

  it('every look on the roster and every NPC skin has a theme; every theme has someone', () => {
    const missing = [...CORE_LOOKS.map((l) => l.id), ...NPC_LOOKS.map((l) => l.id)].filter((id) => !lookTheme(id));
    expect(missing).toEqual([]);
    const used = new Set(CORE_LOOKS.map((l) => lookTheme(l.id)));
    for (const t of NAME_THEMES) expect(used.has(t.id), t.id).toBe(true);
    // Whole-body characters declare theirs in the manifest (a new soldier skin: "nameTheme": "soldier").
    for (const m of readManifests() as { look?: string; nameTheme?: string; status?: string }[]) if (m.look && !m.status) expect(m.nameTheme, m.look).toBeTruthy();
  });

  it('sorts what each character is called after', () => {
    expect(lookTheme('core.scamp')).toBe('monkey');
    expect(lookTheme('core.bigbab')).toBe('monkey');
    expect(lookTheme('core.barnacle')).toBe('pirate');
    expect(lookTheme('core.knight')).toBe('knight');
    expect(lookTheme('core.grunt68')).toBe('soldier');
    expect(lookTheme('core.shambler')).toBe('undead');
    expect(lookTheme('npc:trooper')).toBe('soldier');
    // A retired look: its replacement's; a design of yours: none.
    expect(lookTheme('core.warden')).toBe('soldier');
    expect(lookTheme(encodeLook({ body: 'male', parts: ['ranger_torso_m', 'ranger_legs_m', 'ranger_feet_m', 'ranger_arms_m'], hair: [], colorways: [], skin: null, hairColor: null }))).toBeNull();
  });
});

describe('bot names: what a bot is called', () => {
  const none = () => false;
  it("a character's first bot takes the character's own name, the next its theme's", () => {
    expect(botNameFor('core.scamp', none)).toBe('Scamp');
    const taken = new Set(['scamp']);
    expect(botNameFor('core.scamp', (n) => taken.has(n.toLowerCase()))).toBe(NAME_THEMES.find((t) => t.id === 'monkey')!.names[0]);
    expect(botNameFor('core.grunt68', (n) => n === "Grunt '68")).toMatch(/^(Pvt|Pfc|Cpl|Sgt|SSgt|Lt|Capt|Maj|Col)\. /);
  });

  it('falls back to the general list: a design of yours, a theme run out; then numbered', () => {
    const mine = encodeLook({ body: 'female', parts: ['peasant_torso_f', 'peasant_arms_f', 'peasant_legs_f', 'peasant_feet_f'], hair: [], colorways: [], skin: null, hairColor: null });
    expect(botNameFor(mine, () => false)).toBe(BOT_NAMES[0]);
    const monkeys = new Set(['scamp', ...NAME_THEMES.find((t) => t.id === 'monkey')!.names.map((n) => n.toLowerCase())]);
    expect(botNameFor('core.scamp', (n) => monkeys.has(n.toLowerCase()))).toBe(BOT_NAMES[0]);
    const all = new Set(BOT_NAMES.map((n) => n.toLowerCase()));
    expect(botNameFor(mine, (n) => all.has(n.toLowerCase()))).toBe(`${BOT_NAMES[0]} 2`);
  });

  it('random bots in a match: named for their looks, every name unique', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.deathmatch'] }, 1);
    const bots = new BotFiller(match);
    bots.join('Scamp', 'core.ranger', 40);
    const list = botsOf(match);
    expect(list).toHaveLength(39);
    const names = match.combatants().map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const c of list) {
      const own = CORE_LOOKS.find((l) => l.id === c.look)!.name;
      const theme = NAME_THEMES.find((t) => t.id === lookTheme(c.look));
      expect(c.name === own || !!theme?.names.includes(c.name), `${c.look}: ${c.name}`).toBe(true);
    }
    // The player called Scamp keeps it: the Scamp bot takes a monkey name.
    const scamp = list.find((c) => c.look === 'core.scamp');
    if (scamp) expect(scamp.name).not.toBe('Scamp');
  });

  it('Roulette: bots take general names (every life wears another look, so no name is after one)', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.roulette'] }, 1);
    const bots = new BotFiller(match);
    bots.join('Player', 'core.ranger', 40);
    const list = botsOf(match);
    expect(list.length).toBeGreaterThan(30);
    const names = match.combatants().map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const c of list) expect(BOT_NAMES.some((n) => c.name === n || c.name.startsWith(`${n} `)), c.name).toBe(true);
  });
});

describe('bot characters: soldiers only', () => {
  it(`${MAX_PLAYER_SLOTS} bots on a soldiers-only map: all soldiers, ${MAX_PLAYER_SLOTS} unique soldier names`, () => {
    const match = new Match(yard(['soldiers']), { ...DEFAULT_RULES['core.tdm'], teamSizes: [MAX_PLAYER_SLOTS / 2, MAX_PLAYER_SLOTS / 2] }, 1);
    const bots = new BotFiller(match);
    bots.rebalance(MAX_PLAYER_SLOTS);
    const list = botsOf(match);
    expect(list).toHaveLength(MAX_PLAYER_SLOTS);
    for (const c of list) expect(soldierLooks, c.look).toContain(c.look);
    expect(new Set(list.map((c) => c.look)).size).toBe(soldierLooks.length);
    expect(new Set(list.map((c) => c.name)).size).toBe(MAX_PLAYER_SLOTS);
    const own = new Set(CORE_LOOKS.filter((l) => l.group === 'soldiers').map((l) => l.name));
    for (const c of list) expect(own.has(c.name) || /^(Pvt|Pfc|Cpl|Sgt|SSgt|Lt|Capt|Maj|Col)\. [A-Z][a-z]+$/.test(c.name), c.name).toBe(true);
  });

  it('a theme works too, and the host overrides the map (all, another, the map again) mid-match', () => {
    const match = new Match(yard(['soldiers']), { ...DEFAULT_RULES['core.deathmatch'] }, 1);
    const bots = new BotFiller(match);
    bots.join('Host', undefined, 12);
    const control = new HostControl(match, bots, 12);
    expect(control.state().cast).toBeNull();
    expect(control.state().mapCast).toEqual(['soldiers']);
    const r = control.apply({ c: 'bots', cast: ['pirate', 'monkey'] });
    expect(r.notice).toMatch(/pirates \+ monkeys/i);
    for (const c of botsOf(match)) expect(['pirate', 'monkey']).toContain(lookTheme(c.look));
    expect(new Set(match.combatants().map((c) => c.name)).size).toBe(12);
    expect(botsOf(match).map((c) => c.name)).toEqual(expect.arrayContaining(['Scamp', "Cap'n Rusty Barnacle"]));
    expect(control.state().cast).toEqual(['pirate', 'monkey']);
    // All: nobody has to change (every look is allowed).
    const before = botsOf(match).map((c) => `${c.name}/${c.look}`);
    control.apply({ c: 'bots', cast: [] });
    expect(botsOf(match).map((c) => `${c.name}/${c.look}`)).toEqual(before);
    // The map's own again: soldiers.
    control.apply({ c: 'bots', cast: null });
    for (const c of botsOf(match)) expect(soldierLooks).toContain(c.look);
  });

  it("the host's bot set keeps its own names and looks", () => {
    const set = validateBotSet({ name: 'Cast', entries: [{ name: 'Sir Clank', look: 'core.knight' }, { name: 'Zorp', look: 'core.visitor' }] })!.set;
    const match = new Match(yard(['soldiers']), { ...DEFAULT_RULES['core.deathmatch'] }, 1);
    const bots = new BotFiller(match, undefined, { botSet: set });
    bots.rebalance(8);
    const list = botsOf(match);
    expect(list.find((c) => c.name === 'Sir Clank')?.look).toBe('core.knight');
    expect(list.find((c) => c.name === 'Zorp')?.look).toBe('core.visitor');
    for (const c of list.filter((x) => !x.botSet)) expect(soldierLooks).toContain(c.look);
  });

  it('settings: validated, kept on a map change, from match setup, server rules, the wire', () => {
    expect(validBotCast(['soldiers', 'nope', 'pirate', 'soldiers', 7])).toEqual(['soldiers', 'pirate']);
    expect(validBotCast('soldiers')).toEqual([]);
    expect(castLooks(['nope']).length).toBe(CORE_LOOKS.length);
    expect(castAllows(['soldiers'], 'core.astronaut')).toBe(true);
    expect(castAllows(['soldiers'], 'core.scamp')).toBe(false);
    expect(castAllows(['monkey'], 'core.bigbab')).toBe(true);
    expect(castAllows([], 'core.scamp')).toBe(true);
    expect(botCastLabel(undefined)).toBe('All characters');
    expect(botCastLabel(['soldiers'])).toBe('Soldiers');
    // Match setup: absent the map's, [] all.
    const map = yard(['soldiers']);
    const base = { map: map.metadata.id, mode: 'core.deathmatch' as const, bots: 4, skill: 'normal' as const, scoreLimit: 20, minutes: 10 };
    expect(rulesFromSetup(base, map).rules.botCast).toBeUndefined();
    expect(rulesFromSetup({ ...base, botCast: [] }, map).rules.botCast).toEqual([]);
    expect(rulesFromSetup({ ...base, botCast: ['pirate', 'bogus'] }, map).rules.botCast).toEqual(['pirate']);
    expect(rulesForTravel({ ...DEFAULT_RULES['core.deathmatch'], botCast: ['pirate'] }, yard(), 8).rules.botCast).toEqual(['pirate']);
    // Server rules: "cast" words.
    const spec = SERVER_RULES.find((s) => s.key === 'cast')!;
    const r = { ...DEFAULT_RULES['core.deathmatch'] };
    expect(spec.read(r)).toBe('map');
    spec.write(r, 'soldiers');
    expect(r.botCast).toEqual(['soldiers']);
    expect(spec.read(r)).toBe('soldiers');
    spec.write(r, 'all');
    expect(r.botCast).toEqual([]);
    spec.write(r, 'map');
    expect(r.botCast).toBeUndefined();
    // The wire: lists kept to known ids, null the map's, anything else refused.
    const host = (cast: unknown) => parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'bots', cast } }));
    expect(host(['soldiers', 'x'])).toMatchObject({ cmd: { c: 'bots', cast: ['soldiers'] } });
    expect(host(null)).toMatchObject({ cmd: { c: 'bots', cast: null } });
    expect(host('soldiers')).toBeNull();
  });

  it('MapMaker: the setting is one undo step, flagged when it names something unknown', () => {
    const map = yard();
    const next = applyCommand(map, { kind: 'setBotCast', before: null, after: ['soldiers'] });
    expect(next.botCast).toEqual(['soldiers']);
    expect('botCast' in applyCommand(next, { kind: 'setBotCast', before: ['soldiers'], after: null })).toBe(false);
    expect(validateMap({ ...map, botCast: ['soldiers', 'dinosaurs'] }).some((i) => i.code === 'bots.cast_unknown')).toBe(true);
    expect(validateMap({ ...map, botCast: ['soldiers'] }).some((i) => i.code === 'bots.cast_unknown')).toBe(false);
    expect(lookGroup('core.astronaut')).toBe('soldiers');
  });
});
