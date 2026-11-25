import { readCareer, type Career } from './career.ts';
import { readVouched, type Vouched } from './vouch.ts';
import { cleanEmblemCode } from '../content/emblems.ts';
import { isTitleId } from '../content/titles.ts';
import { claimsOfficial } from './lobby.ts';
import type { CampaignProgress } from '../campaign/progress.ts';

/**
 * Player profiles (the hub's /api/v1/profile, packages/server/src/profiles.ts):
 * a signed-in player picks a username, unique in Tile Trigger, and a region.
 * The name from their Google account is never shown; their username is their
 * name in every match, marked as a verified account (the hub signs it into the
 * account ticket a host checks). Guests still play under any name they type,
 * marked as guests.
 */

/** Regions, roughly by where people are (the game browser shows games in yours first). */
export const REGIONS = [
  { id: 'na-west', label: 'North America West' },
  { id: 'na-east', label: 'North America East' },
  { id: 'sa', label: 'South America' },
  { id: 'eu', label: 'Europe' },
  { id: 'africa', label: 'Africa' },
  { id: 'me', label: 'Middle East' },
  { id: 'asia-south', label: 'South Asia' },
  { id: 'asia-east', label: 'East Asia' },
  { id: 'oceania', label: 'Oceania' },
] as const;
export type Region = (typeof REGIONS)[number]['id'];

export const isRegion = (v: unknown): v is Region => typeof v === 'string' && REGIONS.some((r) => r.id === v);
export const regionLabel = (id: string | null | undefined): string => REGIONS.find((r) => r.id === id)?.label ?? 'Unknown region';

const WEST = /^America\/(Los_Angeles|Vancouver|Tijuana|Phoenix|Denver|Boise|Edmonton|Anchorage|Juneau|Sitka|Yakutat|Nome|Whitehorse|Dawson|Hermosillo|Mazatlan|Chihuahua)|^Pacific\/Honolulu|^US\/(Pacific|Mountain|Arizona|Alaska|Hawaii)/;
const SOUTH = /^America\/(Sao_Paulo|Argentina|Buenos_Aires|Santiago|Bogota|Lima|Caracas|Montevideo|Asuncion|La_Paz|Guayaquil|Recife|Fortaleza|Bahia|Belem|Manaus|Cuiaba|Porto_Velho|Rio_Branco|Paramaribo|Cayenne|Guyana|Punta_Arenas)/;
const MIDDLE_EAST = /^Asia\/(Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat|Baghdad|Tehran|Jerusalem|Tel_Aviv|Amman|Beirut|Damascus|Aden|Nicosia)/;
const SOUTH_ASIA = /^Asia\/(Kolkata|Calcutta|Karachi|Dhaka|Colombo|Kathmandu|Thimphu|Kabul)|^Indian\/Maldives/;

/** A first guess at the player's region from their time zone (they can change it). */
export function regionForTimeZone(tz: string): Region {
  if (WEST.test(tz)) return 'na-west';
  if (SOUTH.test(tz)) return 'sa';
  if (/^(America|US|Canada)\//.test(tz)) return 'na-east';
  if (/^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Madeira|Faroe)/.test(tz)) return 'eu';
  if (/^Africa\//.test(tz)) return 'africa';
  if (MIDDLE_EAST.test(tz)) return 'me';
  if (SOUTH_ASIA.test(tz)) return 'asia-south';
  if (/^(Australia|Pacific)\//.test(tz)) return 'oceania';
  if (/^Asia\//.test(tz)) return 'asia-east';
  return 'na-east';
}

/** Names a username may not use (any case): the game's and the platform's own, and staff-like words. */
const RESERVED = /^(admin|administrator|mod|moderator|staff|support|system|server|host|owner|dev|developer|guest|player|bot|null|undefined|everyone|here)\d*$/;

/**
 * Why `name` can't be a username, or null when it can: 3–16 characters of
 * letters, digits, _ - and . (starting with a letter or digit), not a
 * reserved word, not claiming to be official.
 */
export function usernameProblem(name: string): string | null {
  if (name.length < 3) return 'at least 3 characters';
  if (name.length > 16) return 'at most 16 characters';
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name)) return 'letters, numbers, _ - and . only, starting with a letter or number';
  if (RESERVED.test(name.toLowerCase())) return 'that name is reserved';
  if (claimsOfficial(name)) return "names can't claim to be official or ToshiroPlay";
  return null;
}

/** The form usernames are compared in: they are unique whatever the case. */
export const usernameKey = (name: string): string => name.toLowerCase();

export interface Profile {
  /** Null until the player picks one. */
  username: string | null;
  region: Region | null;
  /** Your favourite class (a ClassId): picked for you when you join a match with classes (docs/PLAYER_PROFILES_PLAN.md). */
  favClass: string | null;
  /** Career stats (net/career.ts), summed match by match. */
  career: Career;
  /** Your emblem (content/emblems.ts: "<id>.<colour>"), or null for none. */
  emblem: string | null;
  /** The title you wear (content/titles.ts: one your career has earned), or null. */
  title: string | null;
  /** Phase 4: what other people's hosts counted for you (net/vouch.ts). */
  vouched: Vouched;
  /** Your optic pick per gun (weapon ID → optic kind, only guns not on their default; sim/opticChoice.ts): kept with the account so every browser you sign in on uses them. */
  optics: Record<string, string>;
  /** Your key bindings (client game/keyBindings.ts: action → "key,alt", only actions changed from the defaults): kept with the account so every browser you sign in on uses them. An older hub sends none. */
  keys: Record<string, string>;
  /** Small settings kept with the account (option → value, e.g. `captions: 'dir'`: client game/captionPrefs.ts): every browser you sign in on uses them. An older hub sends none. */
  prefs: Record<string, string>;
  /** Story campaign progress (campaign/progress.ts): the hub merges what a browser sends with what it has (union), so no device's wins are lost. An older hub sends none. */
  campaign: CampaignProgress;
}

/** A profile's key bindings, checked: at most 128 actions, each "key,alt" of short letter-and-digit codes; null when it isn't a map. */
export function keysShape(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 128)) if (/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(k) && typeof v === 'string' && /^[A-Za-z0-9]{0,24},[A-Za-z0-9]{0,24}$/.test(v)) out[k] = v;
  return out;
}

/** A profile's settings, checked: at most 32, each a short lower-case name and a short word; null when it isn't a map. */
export function prefsShape(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 32)) if (/^[a-z][A-Za-z0-9]{0,31}$/.test(k) && typeof v === 'string' && /^[a-z0-9-]{0,16}$/.test(v)) out[k] = v;
  return out;
}

/**
 * What anyone may see of a signed-in player (GET /api/v1/profile/card?u=<username>; docs/PLAYER_PROFILES_PLAN.md,
 * Phase 2): another player's card, opened from the scoreboard. Public fields only: no account id, no region.
 */
export interface PublicCard {
  username: string;
  emblem: string | null;
  title: string | null;
  favClass: string | null;
  career: Career;
  /** Phase 4: what other people's hosts counted (an older hub sends none: empty). */
  vouched: Vouched;
}

/** A card as the hub sent it, or null when it isn't one (an older hub, anything else). */
export function readPublicCard(v: unknown): PublicCard | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.username !== 'string' || usernameProblem(o.username)) return null;
  const career = readCareer(o.career);
  if (!career) return null;
  return { username: o.username, emblem: cleanEmblemCode(o.emblem), title: isTitleId(o.title) ? o.title : null, favClass: isFavClassId(o.favClass) ? o.favClass : null, career, vouched: readVouched(o.vouched) };
}

/** A class id as a profile keeps it (the class list itself is content: sim/classes.ts checks it is one). */
export const isFavClassId = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9_]{0,23}$/.test(v);
