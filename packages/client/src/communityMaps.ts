import type { CommunityPick, CommunityStatus, MapDocument, PlayReport, PromotionThresholds } from '@tiletrigger/shared';
import { accessToken } from './account.ts';
import { hubApi } from './publishedMaps.ts';

/**
 * Community maps on the hub (docs/COMMUNITY_MAPS.md; the hub's side is packages/server/src/community.ts): the Community
 * Picks, reporting a map, your own maps there (withdraw), the host's end-of-match report with the one-time file the hub
 * may ask for, and the owner's summary and actions. Nothing here runs anything from a map: maps are data, checked as
 * they load.
 */

const hexOf = (hash: string) => hash.replace(/^sha256:/, '');

async function call(path: string, init: RequestInit = {}, signedIn = true): Promise<Response> {
  const url = hubApi(`community/${path}`);
  if (!url) throw new Error('no hub set (Online → Game browser)');
  const token = accessToken();
  if (signedIn && !token) throw new Error('sign in first (main menu → Profile → Sign in)');
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...(signedIn && token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `the hub answered ${res.status}`);
  return res;
}

let picks: Promise<CommunityPick[]> | undefined;

/** The Community Picks (asked once per page; none when there's no hub or it doesn't answer quickly). */
export function communityPicks(): Promise<CommunityPick[]> {
  picks ??= hubApi('community/picks')
    ? call('picks', {}, false)
        .then((r) => r.json() as Promise<{ picks: CommunityPick[] }>)
        .then((d) => (Array.isArray(d.picks) ? d.picks : []))
        .catch(() => [])
    : Promise.resolve([]);
  return picks;
}

/** A Community Pick's map file (JSON text), as the hub keeps it. */
export async function pickMapText(contentHash: string): Promise<string> {
  return (await call(`picks/${hexOf(contentHash)}`, {}, false)).text();
}

/** Report a community map (signed in; once per account). */
export async function reportCommunityMap(contentHash: string): Promise<{ reports: number; hidden: boolean }> {
  return (await call(`maps/${hexOf(contentHash)}/report`, { method: 'POST' })).json() as Promise<{ reports: number; hidden: boolean }>;
}

/** One map version's numbers, as the hub shows it to its creator and the owner. */
export interface CommunityRow {
  contentHash: string;
  mapId: string;
  name: string;
  creator: string;
  withdrawn: boolean;
  status: CommunityStatus;
  reason?: string;
  players: number;
  earlyQuits: number;
  hosts: number;
  days: number;
  reports: number;
  minutes: number;
  matches: number;
  lastAt: number;
  pickedAt?: number;
  missing: string[];
}

/** Your maps on the hub (you listed them first, signed in), with each version's numbers. */
export async function myCommunityMaps(): Promise<{ mapId: string; withdrawn: boolean; versions: CommunityRow[] }[]> {
  return ((await (await call('mine')).json()) as { maps: { mapId: string; withdrawn: boolean; versions: CommunityRow[] }[] }).maps;
}

/** Withdraw one of your maps (every version): no longer listed, out of the Community Picks. */
export async function withdrawCommunityMap(mapId: string): Promise<void> {
  await call(`withdraw/${encodeURIComponent(mapId)}`, { method: 'POST' });
}

export interface CommunitySummary {
  since: number;
  days: number;
  thresholds: PromotionThresholds;
  totals: { versions: number; picks: number; official: number; hidden: number; active: number };
  newPicks: CommunityRow[];
  hidden: CommunityRow[];
  failed: CommunityRow[];
  wanted: CommunityRow[];
  mostPlayed: CommunityRow[];
}

/** The owner's weekly summary (403 for anyone else). */
export async function communitySummary(days = 7): Promise<CommunitySummary> {
  return (await call(`summary?days=${days}`)).json() as Promise<CommunitySummary>;
}

/** The owner: make a pick Official (published, publish.ts), take a map down, or let a hidden one back. */
export async function ownerCommunityAction(contentHash: string, action: 'official' | 'takedown' | 'restore'): Promise<void> {
  await call(`maps/${hexOf(contentHash)}/${action}`, { method: 'POST' });
}

/**
 * The host's end-of-match report (signed in): the signed-in players and how long each played. If the hub answers that
 * it wants the map's file (the version just cleared the thresholds), it is sent once, gzipped. `keepalive`: the page is
 * closing (no file then: it is asked for again at the next match).
 */
export async function sendPlayReport(report: PlayReport, map: () => string, keepalive = false): Promise<{ counted: number; wantFile: boolean } | null> {
  if (!accessToken() || !report.players.length) return null;
  try {
    const res = await call('plays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report), keepalive });
    const r = (await res.json()) as { counted: number; wantFile: boolean };
    if (r.wantFile && !keepalive) await sendMapFile(report.contentHash, map());
    return r;
  } catch {
    return null;
  }
}

async function sendMapFile(contentHash: string, text: string): Promise<void> {
  const gz = typeof CompressionStream !== 'undefined';
  const data: BodyInit = gz ? await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob() : text;
  await call(`maps/${hexOf(contentHash)}/file`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) }, body: data }, false).catch(() => undefined);
}

/** Serialized for the hub (the map as the host plays it). */
export type MapText = (map: MapDocument) => string;
