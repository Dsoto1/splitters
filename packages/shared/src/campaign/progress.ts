import { stageKey, type CampaignData, type CampaignSector, type Convergence } from './campaign.ts';

/**
 * A player's campaign progress (docs/CAMPAIGN.md; GDD §11): plain lists of ids, so the device's copy and the
 * profile's (the hub's) merge by union, whichever saw a win first. Kept apart from any match: a win is an explicit
 * completion event (recordWin), and replaying one changes nothing (idempotent).
 */
export interface CampaignProgress {
  /** Stages won: `<sector or convergence id>/<map id>` (stageKey). */
  maps: string[];
  /** Sectors repaired (their last map won). */
  sectors: string[];
  /** Convergence zones discovered (both their sectors repaired). */
  convergences: string[];
  /** Characters unlocked by the campaign (look ids). */
  characters: string[];
}

export const emptyProgress = (): CampaignProgress => ({ maps: [], sectors: [], convergences: [], characters: [] });

const LIST_MAX = 400;
const ITEM = /^[a-z][a-z0-9_.]{0,47}(\/[a-z][a-z0-9_]{0,47})?$/;
const FIELDS = ['maps', 'sectors', 'convergences', 'characters'] as const;

const tidy = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

/** Progress as saved or sent, checked: each list at most LIST_MAX short ids; null when it isn't progress. */
export function progressShape(raw: unknown): CampaignProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out = emptyProgress();
  for (const f of FIELDS) {
    const v = o[f] ?? [];
    if (!Array.isArray(v)) return null;
    out[f] = tidy(v.filter((x): x is string => typeof x === 'string' && ITEM.test(x)).slice(0, LIST_MAX));
  }
  return out;
}

/** Two copies of progress as one: everything either has (union). */
export function mergeProgress(a: CampaignProgress, b: CampaignProgress): CampaignProgress {
  const out = emptyProgress();
  for (const f of FIELDS) out[f] = tidy([...a[f], ...b[f]]).slice(0, LIST_MAX);
  return out;
}

export const sameProgress = (a: CampaignProgress, b: CampaignProgress): boolean => FIELDS.every((f) => a[f].join() === b[f].join());

/** What a completion event changed (all empty when it was already done). */
export interface CampaignEvents {
  completed: string[];
  unlocked: string[];
  repaired: string[];
  discovered: string[];
}

/**
 * Everything that follows from the stages won: each won map's unlock, a sector repaired once its last map is won and
 * its rewards, a convergence discovered once both its sectors are repaired, its rewards once every map of it is won.
 * Run after any change and after a merge, so a copy is never half-done. Pure; returns the events it added.
 */
export function settleProgress(p: CampaignProgress, data: CampaignData): { progress: CampaignProgress; events: CampaignEvents } {
  const maps = new Set(p.maps);
  const sectors = new Set(p.sectors);
  const conv = new Set(p.convergences);
  const chars = new Set(p.characters);
  const events: CampaignEvents = { completed: [], unlocked: [], repaired: [], discovered: [] };
  const grant = (id: string) => !chars.has(id) && (chars.add(id), events.unlocked.push(id));
  for (const s of data.sectors) {
    for (const m of s.maps) if (maps.has(stageKey(s.id, m.map))) grant(m.unlock);
    if (s.maps.every((m) => maps.has(stageKey(s.id, m.map))) && !sectors.has(s.id)) {
      sectors.add(s.id);
      events.repaired.push(s.id);
    }
    if (sectors.has(s.id)) s.rewards.forEach(grant);
  }
  for (const c of data.convergences) {
    if (!conv.has(c.id) && c.sectors.every((id) => sectors.has(id))) {
      conv.add(c.id);
      events.discovered.push(c.id);
    }
    if (conv.has(c.id) && c.maps.every((m) => maps.has(stageKey(c.id, m)))) c.rewards.forEach(grant);
  }
  return { progress: { maps: tidy(maps), sectors: tidy(sectors), convergences: tidy(conv), characters: tidy(chars) }, events };
}

/** Where a stage stands: won, the one to play next, or locked behind the one before it. */
export type StageState = 'done' | 'next' | 'locked';

/** The maps of a sector or convergence in order, each with its state (a won map stays replayable). */
export function stageStates(owner: CampaignSector | Convergence, p: CampaignProgress): { map: string; state: StageState }[] {
  const ids = (owner.maps as (string | { map: string })[]).map((m) => (typeof m === 'string' ? m : m.map));
  let open = true;
  return ids.map((map) => {
    if (p.maps.includes(stageKey(owner.id, map))) return { map, state: 'done' as const };
    const state: StageState = open ? 'next' : 'locked';
    open = false;
    return { map, state };
  });
}

/** A sector's status on its card (GDD §9.2). */
export type SectorStatus = 'available' | 'in-progress' | 'repaired';
export const SECTOR_STATUS_LABELS: Record<SectorStatus, string> = { available: 'Available', 'in-progress': 'In Progress', repaired: 'Repaired' };

export function sectorStatus(s: CampaignSector, p: CampaignProgress): SectorStatus {
  if (p.sectors.includes(s.id)) return 'repaired';
  return s.maps.some((m) => p.maps.includes(stageKey(s.id, m.map))) ? 'in-progress' : 'available';
}

/** The sectors the database shows: every sector today (all are discovered from the start; GDD §2.3 allows hiding some later). */
export const discoveredSectors = (data: CampaignData): CampaignSector[] => data.sectors;

/** The convergences the database shows: only the discovered (an undiscovered one has no card, name or hint: GDD §9.4). */
export const discoveredConvergences = (data: CampaignData, p: CampaignProgress): Convergence[] => data.convergences.filter((c) => p.convergences.includes(c.id));

/**
 * The completion event: a win on `map` in sector or convergence `owner` (a Story match). Counts only when that stage
 * is open (the one before it won; a convergence only once discovered); a win on a stage already won changes nothing.
 * Returns the new progress and what changed.
 */
export function recordWin(p: CampaignProgress, data: CampaignData, owner: string, map: string): { progress: CampaignProgress; events: CampaignEvents } {
  const none = { progress: p, events: { completed: [], unlocked: [], repaired: [], discovered: [] } };
  const settled = settleProgress(p, data).progress;
  const where = data.sectors.find((s) => s.id === owner) ?? data.convergences.find((c) => c.id === owner);
  if (!where) return none;
  if ('sectors' in where && !settled.convergences.includes(where.id)) return none;
  const stage = stageStates(where, settled).find((s) => s.map === map);
  if (!stage || stage.state !== 'next') return { progress: settled, events: none.events };
  const key = stageKey(owner, map);
  const out = settleProgress({ ...settled, maps: tidy([...settled.maps, key]) }, data);
  out.events.completed.push(key);
  return out;
}

/**
 * Map locks (owner, 2026-11-25: real progression, "we don't give it all at once"): a sector's first map is open; its
 * 2nd and 3rd are locked for hosting (Match Setup, Quick Play) until won in Story. Joining a match someone else hosts
 * on a locked map is never blocked. A map that opens a sector anywhere, or was won in any sector, is open. Returns
 * the lock (the sector, the map before it in that sector, and whether that one is won), or null when the map is open.
 */
export function mapLock(data: CampaignData, p: Pick<CampaignProgress, 'maps'>, map: string): { sector: CampaignSector; previous: string; previousWon: boolean } | null {
  let lock: { sector: CampaignSector; previous: string; previousWon: boolean } | null = null;
  for (const s of data.sectors) {
    const i = s.maps.findIndex((m) => m.map === map);
    if (i < 0) continue;
    if (i === 0 || p.maps.includes(stageKey(s.id, map))) return null;
    const previous = s.maps[i - 1]!.map;
    lock ??= { sector: s, previous, previousWon: p.maps.includes(stageKey(s.id, previous)) };
  }
  return lock;
}

/**
 * A sector row's convergence tiles (owner, 2026-11-25): one per convergence the sector belongs to, each `unknown`
 * (no name, no partner: "the database can't see that logged event yet") until discovered; a sector in none still
 * shows one Unknown tile, so a tile never gives a pairing away.
 */
export function convergenceTiles(data: CampaignData, p: Pick<CampaignProgress, 'convergences'>, sectorId: string): ({ known: Convergence } | { unknown: true })[] {
  const mine = data.convergences.filter((c) => c.sectors.includes(sectorId));
  const tiles = mine.map((c) => (p.convergences.includes(c.id) ? { known: c } : { unknown: true as const }));
  return tiles.length ? tiles : [{ unknown: true }];
}
