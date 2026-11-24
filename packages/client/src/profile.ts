import { keysShape, readVouched, opticShape, cleanEmblemCode, emptyCareer, isRegion, isTitleId, readCareer, readPublicCard, regionForTimeZone, type Profile, type PublicCard, type Region, type VouchReport } from '@tiletrigger/shared';
import { accessToken, currentAccount } from './account.ts';
import { hubApi } from './publishedMaps.ts';

/**
 * Your profile (shared/net/profile.ts): signed in, a username (your name in
 * every match, shown as a verified account) and a region, kept on the hub
 * (packages/server/src/profiles.ts). Signed out, the region alone, kept in
 * this browser. The name and email of your Google account are never shown.
 */
const REGION_KEY = 'tiletrigger.region';
let cache: { sub: string; profile: Profile } | null = null;

/** A profile as the hub sent it, filled in (an older hub sends no favourite class or career). */
function readProfile(v: unknown): Profile {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Partial<Record<keyof Profile, unknown>>;
  return {
    username: typeof o.username === 'string' ? o.username : null,
    region: isRegion(o.region) ? o.region : null,
    favClass: typeof o.favClass === 'string' ? o.favClass : null,
    career: readCareer(o.career) ?? emptyCareer(),
    emblem: cleanEmblemCode(o.emblem),
    title: isTitleId(o.title) ? o.title : null,
    vouched: readVouched(o.vouched),
    optics: opticShape(o.optics, true) ?? {},
    keys: keysShape(o.keys) ?? {},
    // (Checked by the hub; each reader checks its own value: captionPrefs.ts parseCaptionMode.)
    prefs: o.prefs && typeof o.prefs === 'object' ? (o.prefs as Record<string, string>) : {},
  };
}

/** The signed-in profile with a new career (careerStats.ts, after the hub added a match). */
export function setCachedCareer(career: Profile['career']): void {
  if (cache && cache.sub === currentAccount()?.sub) cache = { sub: cache.sub, profile: { ...cache.profile, career } };
}

export async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const url = hubApi(path);
  const token = accessToken();
  if (!url) throw new Error('no hub: profiles need the game server');
  if (!token) throw new Error('sign in first');
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `the server answered ${res.status}`);
  return res;
}

/** The signed-in player's profile (asked once per page), or null when signed out or it can't be reached. */
export async function loadProfile(): Promise<Profile | null> {
  const who = currentAccount();
  if (!who) return null;
  if (cache?.sub === who.sub) return cache.profile;
  try {
    const profile = readProfile(await (await call('profile')).json());
    cache = { sub: who.sub, profile };
    return profile;
  } catch {
    return null;
  }
}

/** The profile as last loaded (null: signed out, or not loaded yet). */
export function cachedProfile(): Profile | null {
  const who = currentAccount();
  return cache && who && cache.sub === who.sub ? cache.profile : null;
}

/**
 * A host's end-of-match standings for the signed-in friends in its match (Phase 4; shared net/vouch.ts): the hub adds
 * each line to that player's host-counted record. Best effort: an older hub (404), offline, signed out: nothing.
 */
export function sendVouch(report: VouchReport): void {
  if (!report.lines.length || !currentAccount()) return;
  void call('profile/vouch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report), keepalive: true }).catch(() => undefined);
}

export async function saveProfile(patch: { username?: string; region?: Region; favClass?: string | null; emblem?: string | null; title?: string | null; optics?: Record<string, string>; keys?: Record<string, string>; prefs?: Record<string, string> }): Promise<Profile> {
  const who = currentAccount();
  const res = await call('profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  const profile = readProfile(await res.json());
  if (who) cache = { sub: who.sub, profile };
  if (patch.region) saveLocalRegion(patch.region);
  return profile;
}

/** Whether this account could take `name` ({ ok } or { ok: false, problem }). */
export async function checkUsername(name: string): Promise<{ ok: boolean; problem?: string }> {
  return (await (await call(`profile/check?name=${encodeURIComponent(name)}`)).json()) as { ok: boolean; problem?: string };
}

function saveLocalRegion(r: Region): void {
  try {
    localStorage.setItem(REGION_KEY, r);
  } catch {
    // This page only.
  }
}

/** Your region: your profile's, else the one picked in this browser, else a guess from your time zone. */
export function myRegion(): Region {
  const fromProfile = cachedProfile()?.region;
  if (fromProfile) return fromProfile;
  try {
    const saved = localStorage.getItem(REGION_KEY);
    if (isRegion(saved)) return saved;
  } catch {
    // Storage blocked: guess.
  }
  try {
    return regionForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
  } catch {
    return 'na-east';
  }
}

/** Set the region: on your profile when signed in, and in this browser either way. */
export async function setRegion(r: Region): Promise<void> {
  saveLocalRegion(r);
  if (currentAccount()) await saveProfile({ region: r });
}

/** Other players' cards (GET profile/card?u=, no sign-in needed), asked once per name a page; a few minutes at most. */
const cards = new Map<string, { at: number; card: Promise<PublicCard | null> }>();
const CARD_FRESH_MS = 5 * 60_000;

/**
 * A signed-in player's public card from the hub (docs/PLAYER_PROFILES_PLAN.md, Phase 2), or null: no hub, a hub
 * without cards (an older one answers 404), no such player, offline. The scoreboard's card then shows what the match
 * knows of them.
 */
export function loadCard(username: string): Promise<PublicCard | null> {
  const key = username.toLowerCase();
  const had = cards.get(key);
  if (had && performance.now() - had.at < CARD_FRESH_MS) return had.card;
  const url = hubApi(`profile/card?u=${encodeURIComponent(username)}`);
  const card = url
    ? fetch(url, { signal: AbortSignal.timeout(15_000) })
        .then(async (r) => (r.ok ? readPublicCard(await r.json()) : null))
        .catch(() => null)
    : Promise.resolve(null);
  cards.set(key, { at: performance.now(), card });
  // A card that couldn't be had is asked again next time (the hub may be back).
  void card.then((c) => c === null && cards.get(key)?.card === card && cards.delete(key));
  if (cards.size > 200) cards.delete(cards.keys().next().value!);
  return card;
}
