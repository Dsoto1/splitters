import { claimsOfficial } from './lobby.ts';

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
}
