/**
 * The story campaign's content model (docs/CAMPAIGN.md; design docs/CAMPAIGN_GDD.md §11, decisions
 * docs/STORY_CAMPAIGN.md). The data itself is content/campaign.json: sectors of 3 maps and convergence zones, by
 * stable id. This module only describes and checks it; it knows nothing of combat, bots or rendering (GDD §16): maps
 * and characters are referenced by their canonical ids, never copied.
 */

export type SectorClass = 'historical' | 'modern' | 'future' | 'unclassified';
export const SECTOR_CLASSES: readonly SectorClass[] = ['historical', 'modern', 'future', 'unclassified'];
export const SECTOR_CLASS_LABELS: Record<SectorClass, string> = { historical: 'Historical', modern: 'Modern', future: 'Future', unclassified: 'Unclassified' };

/** Never more than 14 a side (owner, 2026-11-25). */
export const CAMPAIGN_SIDE_MAX = 14;
/** The Chrono Crew members the player picks for an expedition (owner, 2026-11-25: 8-10). */
export const EXPEDITION_CREW_MIN = 8;
export const EXPEDITION_CREW_MAX = 10;
/** A standard sector's length (GDD §3.2: the default, not a hard limit; a later sector may say otherwise through data). */
export const SECTOR_MAPS = 3;

export interface SectorMap {
  /** A suite map's key (maps/<map>.json). */
  map: string;
  /** The one character a win on this map unlocks (owner, 2026-11-25: about 3 a sector, one a map). */
  unlock: string;
}

export interface CampaignSector {
  id: string;
  name: string;
  /** A placeholder the owner hasn't named or placed yet. */
  provisional?: boolean;
  classification: SectorClass;
  /** The period or theme, as the card shows it ("Mesoamerica"). */
  period: string;
  description: string;
  /** In play order; the last is the boss map. */
  maps: SectorMap[];
  boss: { character: string; companions: string[] };
  /** Unlocked when the sector is repaired (its last map won): the boss or its companions. */
  rewards: string[];
  /** Crew picked by the player (8-10) and the sector's local allies, at most 14 a side together. */
  expedition: { crew: number; allies: string[] };
}

export interface Convergence {
  id: string;
  name: string;
  provisional?: boolean;
  description: string;
  /** Both repaired discovers it; until then it is completely hidden (no card, no placeholder). */
  sectors: [string, string];
  maps: string[];
  /** Unlocked when every one of its maps is won. */
  rewards: string[];
}

export interface CampaignData {
  sectors: CampaignSector[];
  convergences: Convergence[];
}

/** A campaign stage: a map within its sector or convergence (the same map may serve two). Saved progress uses these keys. */
export const stageKey = (owner: string, map: string): string => `${owner}/${map}`;

const ID = /^[a-z][a-z0-9_]{0,31}$/;

/** What the checks need to know about the rest of the game. Each returns why the id doesn't do, or null when it does. */
export interface CampaignRefs {
  /** A map a campaign may send you to (a suite map, listed, playing a mode Story launches). */
  map(id: string): string | null;
  /** A character a campaign may unlock or field (`npc`: a boss may be an NPC-only look; an unlock never). */
  character(id: string, use: 'unlock' | 'ally' | 'boss'): string | null;
}

/**
 * Everything wrong with the data, as lines for a person (empty: it's good). Checks the shape, ids unique and stable
 * in form, 3 maps a sector each with one unlock, references resolve, crew 8-10 and crew plus allies at most 14, a
 * convergence's two sectors exist and differ, and no character is unlocked by two places.
 */
export function campaignProblems(raw: unknown, refs?: CampaignRefs): string[] {
  const out: string[] = [];
  const d = raw as Partial<CampaignData> | null;
  if (!d || typeof d !== 'object' || !Array.isArray(d.sectors) || !Array.isArray(d.convergences)) return ['campaign: needs sectors and convergences (arrays)'];
  const ids = new Set<string>();
  const unlockedBy = new Map<string, string>();
  const unlock = (who: unknown, where: string) => {
    if (typeof who !== 'string') return void out.push(`${where}: a character id`);
    const prev = unlockedBy.get(who);
    if (prev) out.push(`${where}: ${who} is already unlocked by ${prev}`);
    else unlockedBy.set(who, where);
    const why = refs?.character(who, 'unlock');
    if (why) out.push(`${where}: ${who}: ${why}`);
  };
  const id = (v: unknown, where: string) => {
    if (typeof v !== 'string' || !ID.test(v)) return void out.push(`${where}: id must be lower-case letters, digits and _ (got ${JSON.stringify(v)})`);
    if (ids.has(v)) out.push(`${where}: id ${v} is used twice`);
    ids.add(v);
  };
  const text = (v: unknown, where: string) => {
    if (typeof v !== 'string' || !v.trim()) out.push(`${where}: needs text`);
  };
  const mapRef = (m: unknown, where: string) => {
    if (typeof m !== 'string') return void out.push(`${where}: a map id`);
    const why = refs?.map(m);
    if (why) out.push(`${where}: ${m}: ${why}`);
  };
  d.sectors.forEach((s, i) => {
    const at = `sectors[${i}]${typeof s?.id === 'string' ? ` (${s.id})` : ''}`;
    id(s?.id, at);
    text(s?.name, `${at}.name`);
    text(s?.period, `${at}.period`);
    text(s?.description, `${at}.description`);
    if (!SECTOR_CLASSES.includes(s?.classification)) out.push(`${at}.classification: one of ${SECTOR_CLASSES.join(', ')}`);
    if (!Array.isArray(s?.maps) || s.maps.length !== SECTOR_MAPS) out.push(`${at}.maps: exactly ${SECTOR_MAPS}`);
    const seen = new Set<string>();
    (Array.isArray(s?.maps) ? s.maps : []).forEach((m, j) => {
      mapRef(m?.map, `${at}.maps[${j}]`);
      if (seen.has(m?.map)) out.push(`${at}.maps[${j}]: ${m?.map} twice in one sector`);
      seen.add(m?.map);
      unlock(m?.unlock, `${at}.maps[${j}].unlock`);
    });
    const boss = s?.boss;
    if (typeof boss?.character !== 'string') out.push(`${at}.boss.character: a character id`);
    else {
      const why = refs?.character(boss.character, 'boss');
      if (why) out.push(`${at}.boss.character: ${boss.character}: ${why}`);
    }
    for (const c of Array.isArray(boss?.companions) ? boss.companions : []) {
      const why = refs?.character(c, 'boss');
      if (why) out.push(`${at}.boss.companions: ${c}: ${why}`);
    }
    if (!Array.isArray(boss?.companions)) out.push(`${at}.boss.companions: an array`);
    if (!Array.isArray(s?.rewards)) out.push(`${at}.rewards: an array`);
    else s.rewards.forEach((r, j) => unlock(r, `${at}.rewards[${j}]`));
    const ex = s?.expedition;
    if (!ex || !Number.isInteger(ex.crew) || ex.crew < EXPEDITION_CREW_MIN || ex.crew > EXPEDITION_CREW_MAX) out.push(`${at}.expedition.crew: ${EXPEDITION_CREW_MIN}-${EXPEDITION_CREW_MAX}`);
    if (!Array.isArray(ex?.allies)) out.push(`${at}.expedition.allies: an array`);
    else {
      if (new Set(ex.allies).size !== ex.allies.length) out.push(`${at}.expedition.allies: an ally twice`);
      for (const a of ex.allies) {
        const why = refs?.character(a, 'ally');
        if (why) out.push(`${at}.expedition.allies: ${a}: ${why}`);
      }
      if (Number.isInteger(ex.crew) && ex.crew + ex.allies.length > CAMPAIGN_SIDE_MAX) out.push(`${at}.expedition: crew ${ex.crew} + ${ex.allies.length} allies is over ${CAMPAIGN_SIDE_MAX} a side`);
    }
  });
  const sectorIds = new Set(d.sectors.map((s) => s?.id));
  const pairs = new Set<string>();
  d.convergences.forEach((c, i) => {
    const at = `convergences[${i}]${typeof c?.id === 'string' ? ` (${c.id})` : ''}`;
    id(c?.id, at);
    text(c?.name, `${at}.name`);
    text(c?.description, `${at}.description`);
    if (!Array.isArray(c?.sectors) || c.sectors.length !== 2) out.push(`${at}.sectors: exactly two prerequisite sectors`);
    else {
      for (const s of c.sectors) if (!sectorIds.has(s)) out.push(`${at}.sectors: ${s} isn't a sector`);
      if (c.sectors[0] === c.sectors[1]) out.push(`${at}.sectors: two different sectors`);
      const pair = [...c.sectors].sort().join('+');
      if (pairs.has(pair)) out.push(`${at}.sectors: another convergence already joins ${pair}`);
      pairs.add(pair);
    }
    if (!Array.isArray(c?.maps) || !c.maps.length) out.push(`${at}.maps: at least one`);
    else c.maps.forEach((m, j) => mapRef(m, `${at}.maps[${j}]`));
    if (!Array.isArray(c?.rewards)) out.push(`${at}.rewards: an array`);
    else c.rewards.forEach((r, j) => unlock(r, `${at}.rewards[${j}]`));
  });
  return out;
}

/** The data, checked for shape (no references: the game's own test does those); throws with the problems. */
export function readCampaign(raw: unknown): CampaignData {
  const why = campaignProblems(raw);
  if (why.length) throw new Error(`campaign data: ${why.join('; ')}`);
  const d = raw as CampaignData;
  return { sectors: d.sectors, convergences: d.convergences };
}
