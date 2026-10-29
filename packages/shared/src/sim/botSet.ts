import { z } from 'zod';
import { BOT_STYLES, type BotStyle } from '../bots/profile.ts';
import { CORE_LOOKS } from '../content/looks.ts';
import { MAX_PLAYER_SLOTS } from './constants.ts';
import { MAP_ID_RE } from './playlist.ts';
import { MAX_TEAMS, NPC_LOOKS } from './npc.ts';

/**
 * Bot sets: the host's own Player Bots (Play → Match setup → Bots, the pause
 * menu's Bots… window, a dedicated host's BOTSET). A set is a named list of
 * bots, each with a name and optionally a look, skill, style, team and squad;
 * absent fields mean "the match's default" (look: spread over the roster as
 * before; team: wherever the match needs one). BotFiller takes the entries in
 * order when it adds bots (per team in team modes), then fills the rest with
 * its usual random bots, unless the set says "only these bots".
 *
 * Bots in the same squad (same label, same side) stick together: the first of
 * them alive leads, the others follow its goals (Match.squadGoal).
 *
 * Presets are data: maps/botsets/*.json. Everything here comes from untrusted
 * places (a friend's host command, a config file, a saved set), so it is all
 * checked by validateBotSet and capped.
 */

/** Most bots a set can name (a full dedicated match). */
export const BOT_SET_MAX = MAX_PLAYER_SLOTS;
/** Longest bot name, squad label and set name. */
export const BOT_NAME_MAX = 20;
export const BOT_SQUAD_MAX = 16;
export const BOT_SET_NAME_MAX = 40;

export const BOT_SKILLS = ['easy', 'normal', 'hard'] as const;
export type BotEntrySkill = (typeof BOT_SKILLS)[number];

export interface BotEntry {
  name: string;
  /** A built-in look (CORE_LOOKS or an NPC skin); absent: the match picks one ("random"). */
  look?: string;
  /** Absent: the match's bot skill. */
  skill?: BotEntrySkill;
  /** Absent: the match's bot style. */
  style?: BotStyle;
  /** Team by order from 0 (team modes); absent: wherever the match needs a player. */
  team?: number;
  /** Bots with the same label on the same side stick together. */
  squad?: string;
}

export interface BotSet {
  name: string;
  entries: BotEntry[];
  /** random: these bots first, then the usual random bots up to the player count; only: just these bots. */
  fill: 'random' | 'only';
}

/** Looks a bot may wear: the preset characters and the NPC skins. */
export const BOT_LOOKS: readonly { id: string; name: string }[] = [...CORE_LOOKS.map((l) => ({ id: l.id, name: l.name })), ...NPC_LOOKS.map((l) => ({ id: l.id, name: l.name }))];
const LOOK_IDS = new Set(BOT_LOOKS.map((l) => l.id));
export const isBotLook = (id: unknown): id is string => typeof id === 'string' && LOOK_IDS.has(id);
/** A look's display name ("Iron Knight"), or "Random". */
export const botLookName = (id: string | undefined): string => (id ? (BOT_LOOKS.find((l) => l.id === id)?.name ?? id) : 'Random');

/** A name with control characters and angle brackets stripped, spaces collapsed, at most `max` characters. */
export function cleanLabel(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** An empty set (the default: every bot random, as before). */
export const emptyBotSet = (): BotSet => ({ name: 'Custom bots', entries: [], fill: 'random' });

/**
 * A bot set from anywhere (a host command, a config file, a preset, a save),
 * made valid: names cleaned and capped (empty ones numbered, repeats made
 * unique), unknown looks, skills, styles and teams back to the default,
 * at most BOT_SET_MAX bots. `fixes` says what was changed. Null when it isn't
 * a set at all.
 */
export function validateBotSet(raw: unknown): { set: BotSet; fixes: string[] } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.entries !== undefined && !Array.isArray(o.entries)) return null;
  const fixes: string[] = [];
  const list = (o.entries as unknown[] | undefined) ?? [];
  if (list.length > BOT_SET_MAX) fixes.push(`At most ${BOT_SET_MAX} bots: the rest were left out`);
  const used = new Set<string>();
  const entries: BotEntry[] = [];
  for (const item of list.slice(0, BOT_SET_MAX)) {
    const e = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    let name = cleanLabel(e.name, BOT_NAME_MAX) || `Bot ${entries.length + 1}`;
    // Names tell bots apart (a renamed set keeps each bot by name): repeats get a number.
    if (used.has(name.toLowerCase())) {
      let n = 2;
      while (used.has(`${name.slice(0, BOT_NAME_MAX - 3)} ${n}`.toLowerCase())) n++;
      name = `${name.slice(0, BOT_NAME_MAX - 3)} ${n}`;
    }
    used.add(name.toLowerCase());
    const out: BotEntry = { name };
    if (e.look !== undefined && e.look !== 'random' && e.look !== '') {
      if (isBotLook(e.look)) out.look = e.look;
      else fixes.push(`${name}: unknown look, random instead`);
    }
    if (e.skill !== undefined && e.skill !== 'default' && e.skill !== '') {
      if ((BOT_SKILLS as readonly unknown[]).includes(e.skill)) out.skill = e.skill as BotEntrySkill;
      else fixes.push(`${name}: unknown skill, the match's instead`);
    }
    if (e.style !== undefined && e.style !== 'default' && e.style !== '') {
      if ((BOT_STYLES as readonly unknown[]).includes(e.style)) out.style = e.style as BotStyle;
      else fixes.push(`${name}: unknown style, the match's instead`);
    }
    if (e.team !== undefined && e.team !== null && e.team !== 'auto' && e.team !== '') {
      if (typeof e.team === 'number' && Number.isInteger(e.team) && e.team >= 0 && e.team < MAX_TEAMS) out.team = e.team;
      else fixes.push(`${name}: no such team, auto instead`);
    }
    const squad = cleanLabel(e.squad, BOT_SQUAD_MAX);
    if (squad) out.squad = squad;
    entries.push(out);
  }
  const fill = o.fill === 'only' ? 'only' : 'random';
  return { set: { name: cleanLabel(o.name, BOT_SET_NAME_MAX) || 'Custom bots', entries, fill }, fixes };
}

/** Whether a set changes anything (an empty set that fills randomly plays like no set). */
export const botSetInUse = (set: BotSet | null | undefined): set is BotSet => !!set && (set.entries.length > 0 || set.fill === 'only');

/** Two sets that play the same (what Apply would change). */
export const sameBotSet = (a: BotSet | null | undefined, b: BotSet | null | undefined): boolean => JSON.stringify(botSetInUse(a) ? a : null) === JSON.stringify(botSetInUse(b) ? b : null);

/** "Knights vs Space Crew: 12 bots" / "Random bots". */
export function botSetLabel(set: BotSet | null | undefined): string {
  if (!set?.entries.length) return set?.fill === 'only' ? 'No bots' : 'Random bots';
  const n = set.entries.length;
  return `${set.name}: ${n} bot${n === 1 ? '' : 's'}${set.fill === 'only' ? ' only' : ' + random'}`;
}

// ---------------------------------------------------------------- text form (console, launcher, BOTSET)

/**
 * A set as text, one bot a line: "Name, look, skill, style, team, squad"
 * (look by ID or name; team from 1; blank or - for the default). A first line
 * "only" keeps the match to these bots.
 */
export function botSetToText(set: BotSet): string {
  const lines = set.entries.map((e) => {
    const cells = [e.name, e.look ?? '-', e.skill ?? '-', e.style ?? '-', e.team !== undefined ? String(e.team + 1) : '-', e.squad ?? '-'];
    while (cells.length > 1 && cells[cells.length - 1] === '-') cells.pop();
    return cells.join(', ');
  });
  return [...(set.fill === 'only' ? ['only'] : []), ...lines].join('\n');
}

/** The text form back to a set (then validated); lines may also be separated by ";". */
export function botSetFromText(text: string, name = 'Custom bots'): { set: BotSet; fixes: string[] } {
  let fill: BotSet['fill'] = 'random';
  const entries: Record<string, unknown>[] = [];
  const lookByName = (s: string) => BOT_LOOKS.find((l) => l.id === s || l.name.toLowerCase() === s.toLowerCase() || l.id === `core.${s.toLowerCase()}` || l.id === `npc:${s.toLowerCase()}`)?.id ?? s;
  for (const raw of text.split(/[\n;]/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^(only|random)$/i.test(line)) {
      fill = line.toLowerCase() as BotSet['fill'];
      continue;
    }
    const [n, look, skill, style, team, squad] = line.split(',').map((c) => c.trim());
    const dash = (v: string | undefined) => (v === undefined || v === '' || v === '-' ? undefined : v);
    const t = dash(team);
    entries.push({
      name: n,
      look: dash(look) === undefined || dash(look)!.toLowerCase() === 'random' ? undefined : lookByName(look!),
      skill: dash(skill)?.toLowerCase(),
      style: dash(style)?.toLowerCase(),
      team: t === undefined || t.toLowerCase() === 'auto' ? undefined : /^\d+$/.test(t) ? Number(t) - 1 : t,
      squad: dash(squad),
    });
  }
  return validateBotSet({ name, entries, fill })!;
}

// ---------------------------------------------------------------- presets (maps/botsets/*.json)

export const BotSetPreset = z.object({
  format: z.literal('tiletrigger.botset'),
  id: z.string().regex(MAP_ID_RE),
  name: z.string().min(1).max(BOT_SET_NAME_MAX),
  description: z.string().max(400).default(''),
  fill: z.enum(['random', 'only']).default('random'),
  entries: z
    .array(
      z.object({
        name: z.string().min(1).max(BOT_NAME_MAX),
        look: z.string().optional(),
        skill: z.enum(BOT_SKILLS).optional(),
        style: z.enum(['mixed', 'arena', 'tactical']).optional(),
        team: z.number().int().min(0).max(MAX_TEAMS - 1).optional(),
        squad: z.string().max(BOT_SQUAD_MAX).optional(),
      }),
    )
    .min(1)
    .max(BOT_SET_MAX),
});
export type BotSetPreset = z.infer<typeof BotSetPreset>;

/** A preset from untrusted JSON (every look must be a bot look), or null. */
export function parseBotSetPreset(json: unknown): BotSetPreset | null {
  const r = BotSetPreset.safeParse(json);
  if (!r.success) return null;
  if (r.data.entries.some((e) => e.look !== undefined && !isBotLook(e.look))) return null;
  return r.data;
}

/** A map's own bots (MapDocument.bots) as the set it plays, or null when it has none that change anything. */
export function mapBotSet(map: { bots?: unknown }): BotSet | null {
  if (!map.bots) return null;
  const v = validateBotSet(map.bots)?.set ?? null;
  return botSetInUse(v) ? v : null;
}

/** A preset as the set it plays. */
export const presetBotSet = (p: BotSetPreset): BotSet => validateBotSet({ name: p.name, entries: p.entries, fill: p.fill })!.set;
