import { isRegion, regionForTimeZone, type Profile, type Region } from '@tiletrigger/shared';
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

async function call(path: string, init: RequestInit = {}): Promise<Response> {
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
    const profile = (await (await call('profile')).json()) as Profile;
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

export async function saveProfile(patch: { username?: string; region?: Region }): Promise<Profile> {
  const who = currentAccount();
  const res = await call('profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  const profile = (await res.json()) as Profile;
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
