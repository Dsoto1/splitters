import { addMatch, careerRankPoints, cleanEmblemCode, emptyCareer, hasTitle, readCareer, type Career, type MatchSummary } from '@tiletrigger/shared';
import { currentAccount } from './account.ts';
import { myOptics, onOpticsChange, replaceMyOptics } from './opticPrefs.ts';
import { cachedProfile, call, loadProfile, saveProfile, setCachedCareer } from './profile.ts';

/**
 * Career stats and the favourite class (docs/PLAYER_PROFILES_PLAN.md, Phase 1; shared/net/career.ts).
 * - A guest's career lives in this browser (`tiletrigger.career`).
 * - Signed in, it lives on the hub with the profile: each match is sent there (POST /api/v1/profile/match). One the
 *   hub can't take now (offline, an older hub) waits in this browser (`tiletrigger.career.pending`, by account, at
 *   most PENDING_MAX) and goes with the next sign-in or match.
 * - The first time an account with no matches signs in here, this browser's guest career moves onto it, once.
 * The favourite class is kept here for everyone and on the profile when signed in.
 */
const CAREER_KEY = 'tiletrigger.career';
const PENDING_KEY = 'tiletrigger.career.pending';
const FAV_CLASS_KEY = 'tiletrigger.favClass';
const EMBLEM_KEY = 'tiletrigger.emblem';
const TITLE_KEY = 'tiletrigger.title';
export const PENDING_MAX = 20;

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown): void {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Storage blocked: this page only.
  }
}

/** This browser's (guest) career. */
export const localCareer = (): Career => readCareer(read(CAREER_KEY)) ?? emptyCareer();

/** Your career and where it's kept: on your account (signed in, once the profile is loaded), else in this browser. */
export function myCareer(): { career: Career; where: 'account' | 'browser' } {
  const p = currentAccount() ? cachedProfile() : null;
  if (!p) return { career: localCareer(), where: 'browser' };
  // Matches still waiting for the hub count already (the hub adds them when it can).
  return { career: pendingFor(currentAccount()!.sub).reduce((c, m) => addMatch(c, m), p.career), where: 'account' };
}

/**
 * Your career with its Phase 3 detail (modes, guns, history). Signed in, the hub keeps them; a hub from before them
 * keeps only the totals, so then the detail comes from this browser's copy of the matches played here signed in
 * (`tiletrigger.career.mirror`, by account) and `local` says so.
 */
export function myCareerDetail(): { career: Career; where: 'account' | 'browser'; local: boolean } {
  const mine = myCareer();
  if (mine.where === 'browser' || mine.career.history.length) return { ...mine, local: false };
  const m = mirrorFor(currentAccount()!.sub);
  return m.matches ? { career: { ...mine.career, modes: m.modes, weaponRounds: m.weaponRounds, history: m.history }, where: 'account', local: true } : { ...mine, local: false };
}

const MIRROR_KEY = 'tiletrigger.career.mirror';
function mirrorFor(sub: string): Career {
  const v = read(MIRROR_KEY) as { sub?: unknown; career?: unknown } | null;
  return (v?.sub === sub ? readCareer(v.career) : null) ?? emptyCareer();
}

type Pending = { sub: string; matches: MatchSummary[] };
function pendingFor(sub: string): MatchSummary[] {
  const p = read(PENDING_KEY) as Pending | null;
  return p && p.sub === sub && Array.isArray(p.matches) ? p.matches.slice(0, PENDING_MAX) : [];
}
function setPending(sub: string, matches: MatchSummary[]): void {
  write(PENDING_KEY, matches.length ? ({ sub, matches: matches.slice(-PENDING_MAX) } satisfies Pending) : null);
}

async function post(path: string, body: unknown): Promise<Career> {
  const res = await call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return readCareer(((await res.json()) as { career?: unknown }).career) ?? emptyCareer();
}

/** Whether the hub refused the summary itself (it will never take it: drop it) rather than being unreachable or busy. */
const refused = (e: unknown): boolean => /range|short|unknown|bad|more than|must be|send a/.test((e as Error)?.message ?? '');

let sending: Promise<void> | null = null;
/** Send the matches waiting for this account, oldest first; stops at the first that can't go now. */
function sendPending(sub: string): Promise<void> {
  sending ??= (async () => {
    try {
      let left = pendingFor(sub);
      while (left.length && currentAccount()?.sub === sub) {
        try {
          setCachedCareer(await post('profile/match', left[0]));
        } catch (e) {
          if (!refused(e)) break;
        }
        left = left.slice(1);
        setPending(sub, left);
      }
    } finally {
      sending = null;
    }
  })();
  return sending;
}

/** A match ended (game/careerTally.ts made the summary): onto your account's career, else this browser's. */
export function recordMatch(m: MatchSummary): void {
  const who = currentAccount();
  if (!who) return write(CAREER_KEY, addMatch(localCareer(), m));
  write(MIRROR_KEY, { sub: who.sub, career: addMatch(mirrorFor(who.sub), m) });
  setPending(who.sub, [...pendingFor(who.sub), m]);
  void sendPending(who.sub);
}

/**
 * After sign-in (the menu calls it once the profile has loaded): move this browser's guest career onto an account
 * that has none yet, then send any matches waiting for it.
 */
export async function syncCareer(): Promise<void> {
  const who = currentAccount();
  if (!who) return;
  const p = cachedProfile() ?? (await loadProfile());
  if (!p) return;
  const guest = localCareer();
  if (p.career.matches === 0 && guest.matches > 0) {
    try {
      setCachedCareer(await post('profile/career', guest));
      write(CAREER_KEY, null);
    } catch {
      // Not now (an older hub, offline): the guest career stays here and tries again next time.
    }
  }
  await sendPending(who.sub);
  syncOptics();
}

/**
 * Optic picks on the account (owner, 2026-11-22, "3a"): signed in, your account's picks are yours in this browser; an
 * account with none takes this browser's. Every change after that is saved on the account too (an older hub keeps
 * them in the browser only).
 */
export function syncOptics(): void {
  const who = currentAccount();
  const p = who ? cachedProfile() : null;
  if (!p) return;
  if (Object.keys(p.optics).length) replaceMyOptics(p.optics, true);
  else if (Object.keys(myOptics()).length) void saveProfile({ optics: myOptics() }).catch(() => undefined);
  stopOpticSave ??= onOpticsChange((op) => {
    if (currentAccount()) void saveProfile({ optics: { ...op } }).catch(() => undefined);
  });
}
let stopOpticSave: (() => void) | null = null;

/** Your career's rank points (shared content/ranks.ts: Options → Ranks & badges), sent as you join so others see your rank. */
export const myRankPoints = (): number => careerRankPoints(myCareer().career);

/** Your favourite class (a ClassId): your profile's when signed in, else this browser's; null for none. */
export function myFavClass(): string | null {
  const fromProfile = currentAccount() ? cachedProfile()?.favClass : null;
  if (fromProfile) return fromProfile;
  const v = read(FAV_CLASS_KEY);
  return typeof v === 'string' ? v : null;
}

/** Set (or clear) the favourite class: here, and on your profile when signed in. */
export async function setFavClass(id: string | null): Promise<void> {
  write(FAV_CLASS_KEY, id);
  if (currentAccount()) await saveProfile({ favClass: id });
}

/**
 * Your emblem (shared content/emblems.ts, "<id>.<colour>"; Phase 2): your profile's when signed in and the hub keeps
 * one, else this browser's; null for none. Sent as you join, so everyone's scoreboard and kill feed show it.
 */
export function myEmblem(): string | null {
  const fromProfile = currentAccount() ? cachedProfile()?.emblem : null;
  return fromProfile ?? cleanEmblemCode(read(EMBLEM_KEY));
}

/** Set (or clear) your emblem: here, and on your profile when signed in (an older hub keeps it here only). */
export async function setEmblem(code: string | null): Promise<void> {
  write(EMBLEM_KEY, cleanEmblemCode(code));
  if (currentAccount()) await saveProfile({ emblem: cleanEmblemCode(code) });
}

/** Your title (shared content/titles.ts): one your career has earned, your profile's when signed in, else this browser's. */
export function myTitle(): string | null {
  const fromProfile = currentAccount() ? cachedProfile()?.title : null;
  const v = fromProfile ?? read(TITLE_KEY);
  return typeof v === 'string' && hasTitle(myCareer().career, v) ? v : null;
}

/** Wear a title (or none): only one your career has earned. */
export async function setTitle(id: string | null): Promise<void> {
  if (id !== null && !hasTitle(myCareer().career, id)) throw new Error('not earned yet');
  write(TITLE_KEY, id);
  if (currentAccount()) await saveProfile({ title: id });
}

/** Your emblem and title as a hello carries them (`em`, `tt`): only the ones you have. */
export function emblemAndTitle(): { em?: string; tt?: string } {
  const em = myEmblem();
  const tt = myTitle();
  return { ...(em ? { em } : {}), ...(tt ? { tt } : {}) };
}
