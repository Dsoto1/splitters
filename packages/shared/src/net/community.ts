/**
 * Community maps (docs/COMMUNITY_MAPS.md): players share maps by hosting them; the hub counts plays per map version and
 * promotes a map that clears the thresholds to Community Picks, keeping its file. What the hub, the host and the
 * browser share: the word filter for player-written text, the play report a host sends, the promotion thresholds and
 * the counting rules' constants. Maps stay declarative data: nothing here runs anything from one.
 */

// ---------------------------------------------------------------- the word filter

/**
 * Words no player-written text may hold (map name, description, sign and message text, a listing's name). Kept short
 * and general: whole words for the short ones (so "Scunthorpe" or "class" pass), anywhere for the long ones, after the
 * text is folded (case, accents, look-alike digits and symbols, spaces and repeats between letters). The hub adds the
 * owner's own (COMMUNITY_BLOCKED_WORDS).
 */
const WHOLE_WORDS = ['ass', 'arse', 'cum', 'fag', 'fags', 'jap', 'kike', 'kikes', 'spic', 'spics', 'tit', 'tits', 'twat', 'coon', 'coons', 'chink', 'chinks', 'gook', 'gooks', 'nazi', 'nazis', 'rape', 'raped', 'rapist', 'slut', 'sluts', 'whore', 'whores', 'cunt', 'cunts', 'dick', 'dicks', 'cock', 'cocks', 'porn', 'piss', 'wank', 'wanker', 'retard', 'retards', 'tranny', 'dyke', 'dykes', 'kkk'];
const ANYWHERE = ['fuck', 'motherf', 'shit', 'bitch', 'bastard', 'nigger', 'nigga', 'faggot', 'pedo', 'paedo', 'hitler', 'asshole', 'dickhead', 'pussy', 'blowjob', 'handjob', 'dildo', 'penis', 'vagina', 'boob', 'hentai', 'nsfw'];
/** Phrases: their words in a row (spaced or run together). */
const PHRASES = ['sieg heil', 'heil hitler', 'white power', 'kill yourself', 'kys'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e', '+': 't' };

/** Lower case, no accents, look-alikes as letters; words kept apart by single spaces. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$!|€+9]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

const squeeze = (s: string) => s.replace(/(.)\1+/g, '$1');

/**
 * The word a text is turned down for, or null. `extra`: more words (the hub's COMMUNITY_BLOCKED_WORDS): each is matched
 * whole when 4 letters or fewer, anywhere when longer.
 */
export function blockedWord(text: string, extra: readonly string[] = []): string | null {
  if (!text) return null;
  const folded = fold(text);
  // Letters spaced out ("f u c k"): runs of one-letter words joined up.
  const spaced = folded.replace(/\b([a-z]) (?=[a-z]\b)/g, '$1');
  const words = [...new Set([...folded.split(' '), ...spaced.split(' ')])].filter(Boolean);
  const squeezed = words.map(squeeze);
  const extraWords = extra.map((w) => fold(w).replace(/ /g, '')).filter(Boolean);
  const whole = [...WHOLE_WORDS, ...extraWords.filter((w) => w.length <= 4)];
  const anywhere = [...ANYWHERE, ...extraWords.filter((w) => w.length > 4)];
  for (const w of whole) if (words.includes(w) || squeezed.includes(squeeze(w))) return w;
  // Anywhere in a word (not across words: "Scunthorpe Docks" isn't "pedo").
  for (const w of anywhere) if (words.some((x) => x.includes(w)) || (squeeze(w).length >= 4 && squeezed.some((x) => x.includes(squeeze(w))))) return w;
  const run = ` ${folded} `;
  for (const p of PHRASES) if (run.includes(` ${p} `) || words.includes(p.replace(/ /g, ''))) return p;
  return null;
}

/** Keys of a map file whose strings players write (everything else is an ID, a number or a content reference). */
const TEXT_KEYS = new Set(['name', 'text', 'label', 'description', 'author', 'title', 'message', 'note']);

/** Every player-written string in a map file (as JSON data: map name, description, signs, messages, objectives…). */
export function mapTexts(map: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key: string | null, depth: number) => {
    if (depth > 12 || out.length > 5000) return;
    if (typeof v === 'string') {
      if (key && TEXT_KEYS.has(key) && v.trim()) out.push(v);
      return;
    }
    if (Array.isArray(v)) for (const x of v) walk(x, key, depth + 1);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (k !== 'thumbnail' && k !== 'release') walk(x, k, depth + 1);
  };
  walk(map, null, 0);
  return out;
}

/** The first blocked word in a map's own text, with the text it is in, or null. */
export function mapTextProblem(map: unknown, extra: readonly string[] = []): { word: string; text: string } | null {
  for (const text of mapTexts(map)) {
    const word = blockedWord(text, extra);
    if (word) return { word, text };
  }
  return null;
}

// ---------------------------------------------------------------- play statistics and promotion

/** A player who left within this many minutes of joining quit early. */
export const EARLY_QUIT_MINUTES = 2;
/** A host's matches count at most once in this long. */
export const HOST_MATCH_INTERVAL_MINUTES = 60;
/** The most players one report may name (a full match: 48 v 48). */
export const MAX_REPORTED_PLAYERS = 96;

/** One signed-in player in a host's end-of-match report: their account and how long they played. */
export interface PlayReportPlayer {
  /** The Cognito account (sub), as the player's account ticket proved it to the host. */
  sub: string;
  minutes: number;
  /** Left within EARLY_QUIT_MINUTES of joining. */
  early: boolean;
}

/** What a host sends the hub when a match on a community map ends (POST /api/v1/community/plays, signed in). */
export interface PlayReport {
  /** The listing's join code: the hub counts only accounts it gave a ticket for this code. */
  code: string;
  contentHash: string;
  players: PlayReportPlayer[];
}

/** Starting values (docs/COMMUNITY_MAPS.md, "Promotion thresholds"); the hub's COMMUNITY_THRESHOLDS changes any. */
export interface PromotionThresholds {
  /** Distinct counted players. */
  players: number;
  /** Different hosts whose matches counted. */
  hosts: number;
  /** Different days (UTC) with counted plays. */
  days: number;
  /** Early quits per counted player, under this. */
  earlyQuitRate: number;
  /** Reports per 100 counted players, under this. */
  reportsPer100: number;
  /** Auto-hide: a map hides once it has this many reports (not yet looked at by the owner)… */
  hideReports: number;
  /** …and they are at least this many per 100 counted players. */
  hidePer100: number;
}

export const DEFAULT_THRESHOLDS: PromotionThresholds = { players: 25, hosts: 5, days: 3, earlyQuitRate: 0.3, reportsPer100: 3, hideReports: 5, hidePer100: 10 };

/** Thresholds from untrusted JSON (the hub's config), over the defaults: unknown or bad values are left at the default. */
export function parseThresholds(v: unknown, base: PromotionThresholds = DEFAULT_THRESHOLDS): PromotionThresholds {
  const out = { ...base };
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(base) as (keyof PromotionThresholds)[]) {
    const x = (v as Record<string, unknown>)[k];
    if (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1e6) out[k] = x;
  }
  return out;
}

/** A map version's numbers, as the hub keeps them. */
export interface PlayTally {
  players: number;
  earlyQuits: number;
  hosts: number;
  days: number;
  reports: number;
  /** Reports the owner has already looked at (restored the map after): only newer ones can hide it again. */
  reviewedReports?: number;
}

/** What a tally still lacks for Community Pick (empty: it clears every threshold). */
export function missingForPick(t: PlayTally, th: PromotionThresholds = DEFAULT_THRESHOLDS): string[] {
  const out: string[] = [];
  if (t.players < th.players) out.push(`${t.players}/${th.players} players`);
  if (t.hosts < th.hosts) out.push(`${t.hosts}/${th.hosts} hosts`);
  if (t.days < th.days) out.push(`${t.days}/${th.days} days`);
  const quit = t.players ? t.earlyQuits / t.players : 0;
  if (t.players && quit >= th.earlyQuitRate) out.push(`early quits ${Math.round(quit * 100)}% (under ${Math.round(th.earlyQuitRate * 100)}%)`);
  const per100 = t.players ? (t.reports * 100) / t.players : t.reports ? Infinity : 0;
  if (per100 >= th.reportsPer100) out.push(`${per100 === Infinity ? t.reports : per100.toFixed(1)} reports per 100 players (under ${th.reportsPer100})`);
  return out;
}

/** Whether a map's reports hide it until the owner looks (auto-hide). */
export function reportsHide(t: PlayTally, th: PromotionThresholds = DEFAULT_THRESHOLDS): boolean {
  const fresh = t.reports - (t.reviewedReports ?? 0);
  return fresh >= th.hideReports && fresh * 100 >= th.hidePer100 * Math.max(1, t.players);
}

/** A Community Pick as the hub lists it (GET /api/v1/community/picks). */
export interface CommunityPick {
  /** The content hash ("sha256:<hex>"): the file is GET /api/v1/community/picks/<hex>. */
  contentHash: string;
  mapId: string;
  versionId: string;
  name: string;
  description: string;
  /** The creator's username (their sign-in), or "" when the hub doesn't know one. */
  creator: string;
  modes: string[];
  recommendedPlayers: { min: number; max: number };
  players: number;
  pickedAt: number;
}

/** A map version's state on the hub. */
export type CommunityStatus = 'open' | 'wanted' | 'pick' | 'failed' | 'hidden' | 'removed' | 'official' | 'withdrawn';
