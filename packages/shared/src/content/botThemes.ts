/**
 * Bot name themes and the bot-characters setting, without the name lists (botNames.ts has those and loads with
 * the match code; the menu and MapMaker read only this: docs/LOADING.md). Every built-in look names the kind of
 * creature it is (`nameTheme`: presets in looks.ts, content/characters/*.json, NPC_SKIN_THEMES below); a map can
 * keep its random bots to some groups and/or themes (MapDocument.botCast), and the host can change it
 * (MatchRules.botCast).
 */
import { CHARACTER_BRANCHES, CHARACTER_GROUPS, CORE_LOOKS, PICKABLE_LOOKS, RETIRED_LOOKS, pickableLooks, type CharacterGroup, type CharacterLook } from './looks.ts';

/**
 * Every name theme's id and label, by kind of creature. IDs never change (maps and server rules name them); never
 * the same as a CHARACTER_GROUPS id (a bot-characters setting names either). botNames.ts has each one's names.
 */
export const NAME_THEME_INFO: readonly { id: string; label: string }[] = [
  { id: 'soldier', label: 'Soldiers (ranks)' },
  { id: 'monkey', label: 'Monkeys & Apes' },
  { id: 'bear', label: 'Bears' },
  { id: 'wolf', label: 'Wolves & Hyenas' },
  { id: 'dog', label: 'Dogs' },
  { id: 'cat', label: 'Cats' },
  { id: 'raccoon', label: 'Raccoons' },
  { id: 'critter', label: 'Otters, Hares & Critters' },
  { id: 'frog', label: 'Frogs & Swamp Things' },
  { id: 'pirate', label: 'Pirates' },
  { id: 'knight', label: 'Knights & Kings' },
  { id: 'ninja', label: 'Ninjas & Samurai' },
  { id: 'wizard', label: 'Wizards & Witches' },
  { id: 'barbarian', label: 'Barbarians & Warriors' },
  { id: 'undead', label: 'Zombies & Skeletons' },
  { id: 'spooky', label: 'Horrors & Haunts' },
  { id: 'robot', label: 'Robots & Mechs' },
  { id: 'alien', label: 'Aliens & Visitors' },
  { id: 'goblin', label: 'Goblins & Imps' },
  { id: 'cowboy', label: 'Cowboys & Outlaws' },
  { id: 'gangster', label: 'Gangsters & Grifters' },
  { id: 'townsfolk', label: 'Townsfolk' },
  { id: 'myth', label: 'Gods & Legends' },
];

const THEMES_BY_ID = new Map(NAME_THEME_INFO.map((t) => [t.id, t]));
/** A theme's id and label, or undefined. */
export const nameThemeInfo = (id: string | undefined): { id: string; label: string } | undefined => (id ? THEMES_BY_ID.get(id) : undefined);
export const isNameTheme = (x: unknown): x is string => typeof x === 'string' && THEMES_BY_ID.has(x);

/** The theme of a built-in look without one of its own: by what it is (a new soldier skin is a soldier). */
const GROUP_THEMES: Partial<Record<CharacterGroup, string>> = { soldiers: 'soldier', legends: 'knight', folk: 'townsfolk', horror: 'spooky' };

/** The NPC skins' themes (`npc:<role>` looks; sim/npc.ts). */
export const NPC_SKIN_THEMES: Readonly<Record<string, string>> = {
  trooper: 'soldier',
  gunner: 'soldier',
  heavy: 'soldier',
  sniper: 'soldier',
  zombie: 'undead',
  imp: 'goblin',
  puglin: 'goblin',
  cyclops: 'alien',
  oculus: 'alien',
  scolitex: 'alien',
};

let lookById: Map<string, CharacterLook> | undefined; // built on first use (as in serverRules.ts)
/** A built-in look (a retired one gives its replacement), or undefined (a design of yours, an NPC skin, unknown). */
export const builtInLook = (id: string | undefined): CharacterLook | undefined => (id ? (lookById ??= new Map(CORE_LOOKS.map((l) => [l.id, l]))).get(RETIRED_LOOKS[id] ?? id) : undefined);

/** A look's name theme: its own, else its group's; an NPC skin's; null for a design of yours or anything unknown. */
export function lookTheme(id: string | undefined): string | null {
  if (id?.startsWith('npc:')) return NPC_SKIN_THEMES[id.slice(4)] ?? null;
  const l = builtInLook(id);
  if (!l) return null;
  return themeOf(l);
}
/** A built-in look's name theme: its own, else its group's. */
const themeOf = (l: Pick<CharacterLook, 'nameTheme' | 'group'>): string | null => (l.nameTheme && THEMES_BY_ID.has(l.nameTheme) ? l.nameTheme : undefined) ?? (l.group ? GROUP_THEMES[l.group] : undefined) ?? null;

// ---------------------------------------------------------------- bot characters (which looks random bots wear)

/**
 * Which looks random bots wear: character groups (CHARACTER_GROUPS ids), Soldiers & Spies' branches (CHARACTER_BRANCHES:
 * `army`, `agency`) and/or name themes (NAME_THEME_INFO ids). A look is in when its group, its branch or its theme is
 * listed. Empty: every look (all).
 */
export type BotCast = readonly string[];
/** Most entries in a bot-characters setting. */
export const BOT_CAST_MAX = 8;

const isGroupId = (x: string) => CHARACTER_GROUPS.some((g) => g.id === x);
const isBranchId = (x: string) => CHARACTER_BRANCHES.some((b) => b.id === x);
/**
 * Retired cast ids and what they read as now (saved setups, maps, server rules; 2026-11-17): Agents & Spies is
 * Soldiers & Spies' Agency (the same characters as before), Creatures is in Horrors & Creatures.
 */
export const CAST_ID_ALIASES: Readonly<Record<string, string>> = { agents: 'agency', creatures: 'horror' };
/** A cast id as it reads now (a retired one's replacement). */
export const currentCastId = (x: string): string => CAST_ID_ALIASES[x] ?? x;
/** A choice that picks characters by what they are (a group or a branch), not by their names' theme. */
export const isCharacterCastId = (x: string): boolean => isGroupId(x) || isBranchId(x);
/** A known cast id, a retired one included (it reads as its replacement). */
export const isCastId = (x: unknown): x is string => typeof x === 'string' && (isCharacterCastId(currentCastId(x)) || THEMES_BY_ID.has(x));

/** A bot-characters setting made valid: known ids only (retired ones as their replacement), each once, at most BOT_CAST_MAX. Not a list: empty (all). */
export function validBotCast(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (!isCastId(x)) continue;
    const id = currentCastId(x);
    if (!out.includes(id) && out.length < BOT_CAST_MAX) out.push(id);
  }
  return foldBotCast(out);
}

/** Whether a look (group, branch, theme) answers a cast id. */
const castHas = (x: string, l: Pick<CharacterLook, 'group' | 'branch'> | undefined, theme: string | null): boolean => {
  const id = currentCastId(x);
  return id === (l?.group ?? null) || id === (l?.branch ?? null) || x === theme;
};

/** Whether a look is in a bot-characters setting (empty: every look is). */
export function castAllows(cast: BotCast | undefined, look: string): boolean {
  if (!cast?.length) return true;
  const l = builtInLook(look);
  const theme = lookTheme(look);
  return cast.some((x) => castHas(x, l, theme));
}

/** The looks random bots wear under a bot-characters setting, in roster order; every look when none fits. */
export function castLooks(cast: BotCast | undefined): readonly CharacterLook[] {
  return castLooksFrom(PICKABLE_LOOKS, cast);
}

/** castLooks over a roster: its core tier only (an experimental character is never a random bot's), every core look when none fits. */
export function castLooksFrom(roster: readonly CharacterLook[], cast: BotCast | undefined): readonly CharacterLook[] {
  const pool = pickableLooks(roster);
  if (!cast?.length) return pool;
  const out = pool.filter((l) => cast.some((x) => castHas(x, l, themeOf(l))));
  return out.length ? out : pool;
}

// ---------------------------------------------------------------- bot types (Match Setup's tick-boxes)

/**
 * The bot types Match Setup, the pause menu's Host tab and MapMaker tick (owner, 2026-11-19: "isolate the selection
 * of the bot types"): the character groups, Soldiers & Spies as its two branches. IDs are cast ids (CHARACTER_GROUPS,
 * CHARACTER_BRANCHES), so a setting made of them plays as before.
 */
export const BOT_TYPES = [
  { id: 'army', label: 'Soldiers' },
  { id: 'agency', label: 'Spies' },
  { id: 'folk', label: 'Everyday Folk' },
  { id: 'space', label: 'Outer Space' },
  { id: 'legends', label: 'Legends' },
  { id: 'pirates', label: 'Pirates' },
  { id: 'animals', label: 'Animalia' },
  { id: 'toys', label: 'Toys' },
  { id: 'holiday', label: 'Holiday' },
  { id: 'machines', label: 'Machines' },
  { id: 'horror', label: 'Horrors' },
] as const;
export type BotTypeId = (typeof BOT_TYPES)[number]['id'];
const TYPE_IDS: readonly BotTypeId[] = BOT_TYPES.map((t) => t.id);

/**
 * The old "Named as" sets and the bot type each folds into (saved setups, links, server rules and maps that named
 * one keep loading: owner, 2026-11-19, "the Named as sets fold into the groups"). By what the name theme is, not by
 * which groups happen to hold a look with it.
 */
export const THEME_BOT_TYPES: Readonly<Record<string, BotTypeId>> = {
  soldier: 'army',
  monkey: 'animals',
  bear: 'animals',
  wolf: 'animals',
  dog: 'animals',
  cat: 'animals',
  raccoon: 'animals',
  critter: 'animals',
  frog: 'animals',
  pirate: 'legends',
  knight: 'legends',
  ninja: 'legends',
  wizard: 'legends',
  barbarian: 'legends',
  myth: 'legends',
  undead: 'horror',
  spooky: 'horror',
  goblin: 'horror',
  robot: 'machines',
  alien: 'space',
  cowboy: 'folk',
  gangster: 'folk',
  townsfolk: 'folk',
};

/** The bot types a bot-characters setting covers, in BOT_TYPES order (a group, a branch or a retired set folded in); every type for all (empty, absent or nothing known). */
export function botTypesOf(cast: BotCast | undefined): BotTypeId[] {
  const on = new Set<BotTypeId>();
  for (const raw of cast ?? []) {
    if (typeof raw !== 'string') continue;
    const id = currentCastId(raw);
    if (id === 'soldiers') on.add('army').add('agency');
    else if ((TYPE_IDS as readonly string[]).includes(id)) on.add(id as BotTypeId);
    else if (THEME_BOT_TYPES[raw]) on.add(THEME_BOT_TYPES[raw]!);
  }
  return on.size ? TYPE_IDS.filter((t) => on.has(t)) : [...TYPE_IDS];
}

/** A bot-characters setting for some bot types: empty for every type (all), Soldiers and Spies together as `soldiers`. */
export function castOfTypes(types: Iterable<string>): string[] {
  const on = new Set(types);
  const picked = TYPE_IDS.filter((t) => on.has(t));
  if (!picked.length || picked.length === TYPE_IDS.length) return [];
  const both = on.has('army') && on.has('agency');
  return picked.flatMap((t) => (t === 'army' ? [both ? 'soldiers' : 'army'] : t === 'agency' && both ? [] : [t]));
}

/** A bot-characters setting as bot types (the old sets folded in, retired ids as their replacement); empty for all. */
export const foldBotCast = (cast: BotCast | undefined): string[] => castOfTypes(botTypesOf(cast));

/** The choices a server rule takes: every type, Soldiers & Spies both; the old sets read as their type (THEME_BOT_TYPES). */
export const BOT_CAST_CHOICES: readonly { id: string; label: string }[] = [{ id: 'soldiers', label: 'Soldiers & Spies' }, ...BOT_TYPES];

/** "Soldiers & Spies", "Legends + Animalia", or "All characters". */
export function botCastLabel(cast: BotCast | undefined): string {
  const types = botTypesOf(cast);
  if (types.length === TYPE_IDS.length) return 'All characters';
  const both = types.includes('army') && types.includes('agency');
  return types.flatMap((t) => (t === 'army' && both ? ['Soldiers & Spies'] : t === 'agency' && both ? [] : [BOT_TYPES.find((b) => b.id === t)!.label])).join(' + ');
}
