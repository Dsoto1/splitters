import { isPartyTag, newPartyTag } from '@tiletrigger/shared';

/**
 * This tab's party (shared net/party.ts): its own tag, or the one in the invite link it followed. Kept for the
 * tab (sessionStorage), so it lasts through map changes, rejoins and reloads, and a new tab starts a party of its own.
 * Every hello carries it; your invite links carry it on, so whoever follows one plays on your side.
 */
const PARTY_KEY = 'tiletrigger.party';
/** The last friend's game this browser joined (Online → Join a friend's game offers it again). */
const LAST_KEY = 'tiletrigger.lastJoin';
/** …for this long (a friend's game is an evening's, not a week's). */
const LAST_FOR_MS = 6 * 3600_000;
let memo: string | undefined;

export function myParty(): string {
  if (memo) return memo;
  try {
    const have = sessionStorage.getItem(PARTY_KEY);
    if (isPartyTag(have)) return (memo = have);
    const made = newPartyTag();
    sessionStorage.setItem(PARTY_KEY, made);
    return (memo = made);
  } catch {
    return (memo ??= newPartyTag());
  }
}

/** Follow an invite link's party (a bad tag is ignored). */
export function joinParty(tag: string | null | undefined): void {
  if (!isPartyTag(tag)) return;
  memo = tag;
  try {
    sessionStorage.setItem(PARTY_KEY, tag);
  } catch {
    // Storage blocked: this page only.
  }
}

/** The join code and party of an invite link or a typed code ("K7QX4M", "https://…/?join=K7QX4M&party=…"), or null. */
export function parseInvite(text: string): { code: string; party?: string } | null {
  const t = text.trim();
  const fromLink = /[?&]join=([A-Za-z0-9]{6})(?:&|$|#)/.exec(t);
  const code = (fromLink?.[1] ?? (/^[A-Za-z0-9 -]{6,8}$/.test(t) ? t.replace(/[^A-Za-z0-9]/g, '') : '')).toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  const party = /[?&]party=([A-Za-z0-9]+)/.exec(t)?.[1];
  return { code, ...(isPartyTag(party) ? { party } : {}) };
}

/** The friend's game this browser last joined (code, and whose it was), while it's recent. */
export function lastJoin(): { code: string; host: string; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as { code?: unknown; host?: unknown; at?: unknown } | null;
    if (!v || typeof v.code !== 'string' || !/^[A-Z0-9]{6}$/.test(v.code) || typeof v.at !== 'number' || Date.now() - v.at > LAST_FOR_MS) return null;
    return { code: v.code, host: typeof v.host === 'string' ? v.host.slice(0, 40) : '', at: v.at };
  } catch {
    return null;
  }
}

export function rememberJoin(code: string, host: string): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ code, host: host.slice(0, 40), at: Date.now() }));
  } catch {
    // Storage blocked: nothing to offer next time.
  }
}
