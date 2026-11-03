/**
 * Bot name themes and the bot-characters setting, without the name lists (botNames.ts has those and loads with
 * the match code; the menu and MapMaker read only this: docs/LOADING.md). Every built-in look names the kind of
 * creature it is (`nameTheme`: presets in looks.ts, content/characters/*.json, NPC_SKIN_THEMES below); a map can
 * keep its random bots to some groups and/or themes (MapDocument.botCast), and the host can change it
 * (MatchRules.botCast).
 */
import { CHARACTER_GROUPS, CORE_LOOKS, RETIRED_LOOKS, type CharacterGroup, type CharacterLook } from './looks.ts';

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
  return (l.nameTheme && THEMES_BY_ID.has(l.nameTheme) ? l.nameTheme : undefined) ?? (l.group ? GROUP_THEMES[l.group] : undefined) ?? null;
}

// ---------------------------------------------------------------- bot characters (which looks random bots wear)

/**
 * Which looks random bots wear: character groups (CHARACTER_GROUPS ids) and/or name themes (NAME_THEME_INFO ids). A
 * look is in when its group or its theme is listed. Empty: every look (all).
 */
export type BotCast = readonly string[];
/** Most entries in a bot-characters setting. */
export const BOT_CAST_MAX = 8;

const isGroupId = (x: string) => CHARACTER_GROUPS.some((g) => g.id === x);
export const isCastId = (x: unknown): x is string => typeof x === 'string' && (isGroupId(x) || THEMES_BY_ID.has(x));

/** A bot-characters setting made valid: known ids only, each once, at most BOT_CAST_MAX. Not a list: empty (all). */
export function validBotCast(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) if (isCastId(x) && !out.includes(x) && out.length < BOT_CAST_MAX) out.push(x);
  return out;
}

/** Whether a look is in a bot-characters setting (empty: every look is). */
export function castAllows(cast: BotCast | undefined, look: string): boolean {
  if (!cast?.length) return true;
  const l = builtInLook(look);
  const group = l?.group ?? null;
  const theme = lookTheme(look);
  return cast.some((x) => x === group || x === theme);
}

/** The looks random bots wear under a bot-characters setting, in roster order; every look when none fits. */
export function castLooks(cast: BotCast | undefined): readonly CharacterLook[] {
  if (!cast?.length) return CORE_LOOKS;
  const out = CORE_LOOKS.filter((l) => castAllows(cast, l.id));
  return out.length ? out : CORE_LOOKS;
}

/** The choices a menu offers, groups first: { id, label }. */
export const BOT_CAST_CHOICES: readonly { id: string; label: string }[] = [...CHARACTER_GROUPS.map((g) => ({ id: g.id, label: g.label })), ...NAME_THEME_INFO.map((t) => ({ id: t.id, label: t.label }))];

/** "Soldiers", "Pirates + Knights & Kings", or "All characters". */
export function botCastLabel(cast: BotCast | undefined): string {
  if (!cast?.length) return 'All characters';
  return cast.map((x) => BOT_CAST_CHOICES.find((c) => c.id === x)?.label ?? x).join(' + ');
}

