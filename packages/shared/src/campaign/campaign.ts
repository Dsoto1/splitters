/**
 * The story campaign's content model (docs/CAMPAIGN.md; design docs/CAMPAIGN_GDD.md §11, decisions
 * docs/STORY_CAMPAIGN.md). The data itself is content/campaign.json: sectors of 3 maps and convergence zones, by
 * stable id. This module only describes and checks it; it knows nothing of combat, bots or rendering (GDD §16): maps
 * and characters are referenced by their canonical ids, never copied.
 */

export type SectorClass = 'historical' | 'modern' | 'future' | 'unclassified';
export const SECTOR_CLASSES: readonly SectorClass[] = ['historical', 'modern', 'future', 'unclassified'];
export const SECTOR_CLASS_LABELS: Record<SectorClass, string> = { historical: 'Historical', modern: 'Modern', future: 'Future', unclassified: 'Unclassified' };

/**
 * The roster the player picks: never more than 14 (owner, 2026-11-25). The battle itself isn't capped at 14: a map
 * adds local allies and enemy bots on top (up to 32 v 32, or 14 v 50), scaled down to what the device runs.
 */
export const CAMPAIGN_PICKED_MAX = 14;
/** The usual expedition: 8-10 Chrono Crew picked (owner, 2026-11-25); a map may ask for fewer or more, up to 14. */
export const EXPEDITION_CREW_MIN = 8;
export const EXPEDITION_CREW_MAX = 10;
/** The most bots a campaign map may ask for on either side (64 v 64 at most; the device scales it down). */
export const CAMPAIGN_SIDE_LIMIT = 64;
/** A standard sector's length (GDD §3.2): the default, not a rule. A Wars sector has one map per war (owner, 2026-11-25). */
export const SECTOR_MAPS = 3;

/**
 * One map's match (owner, 2026-11-25: each campaign map has its own mode and size, so a sector can mix close fights
 * with big battles). Every field is optional: absent, the mode is Team Deathmatch and the size the map's own.
 */
export interface StageMatch {
  /** The game mode (a GameMode id the map plays). */
  mode?: string;
  /** How many the player picks for this map (at most 14); absent, the sector's expedition crew. */
  picked?: number;
  /** Local allies added to the player's side (from the sector's allies). */
  allies?: number;
  /** Enemy bots. */
  enemies?: number;
  /** Enemy reinforcement waves after the first (0: none). */
  waves?: number;
}

export interface SectorMap extends StageMatch {
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
  /** In play order, one or more (usually 3; a Wars sector one per war); the last is the boss map. Each opens once the one before is won. */
  maps: SectorMap[];
  boss: { character: string; companions: string[] };
  /** Unlocked when the sector is repaired (its last map won): the boss or its companions. */
  rewards: string[];
  /** The crew the player picks (usually 8-10, at most 14) and the sector's local allies (the looks a map's `allies` draw from). */
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
  /** A map a campaign may send you to (a suite map, listed), and `mode` one it plays (absent: Team Deathmatch or Deathmatch). */
  map(id: string, mode?: string): string | null;
  /** A character a campaign may unlock or field (`npc`: a boss may be an NPC-only look; an unlock never). */
  character(id: string, use: 'unlock' | 'ally' | 'boss'): string | null;
}

/**
 * Everything wrong with the data, as lines for a person (empty: it's good). Checks the shape, ids unique and stable
 * in form, one or more maps a sector each with one unlock, references resolve, each map's match (mode, at most 14
 * picked, allies, enemies, waves), a convergence's two sectors exist and differ, and no character is unlocked by two
 * places. The battle's size isn't capped at 14: only the picked roster is.
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
  const mapRef = (m: unknown, where: string, mode?: string) => {
    if (typeof m !== 'string') return void out.push(`${where}: a map id`);
    const why = refs?.map(m, mode);
    if (why) out.push(`${where}: ${m}: ${why}`);
  };
  const count = (v: unknown, where: string, min: number, max: number) => {
    if (v !== undefined && (!Number.isInteger(v) || (v as number) < min || (v as number) > max)) out.push(`${where}: a whole number ${min}-${max}`);
  };
  const match = (m: Partial<StageMatch> | undefined, where: string) => {
    if (m?.mode !== undefined && (typeof m.mode !== 'string' || !/^[a-z]+\.[a-z0-9_]+$/.test(m.mode))) out.push(`${where}.mode: a game mode id`);
    count(m?.picked, `${where}.picked`, 1, CAMPAIGN_PICKED_MAX);
    count(m?.allies, `${where}.allies`, 0, CAMPAIGN_SIDE_LIMIT);
    count(m?.enemies, `${where}.enemies`, 1, CAMPAIGN_SIDE_LIMIT);
    count(m?.waves, `${where}.waves`, 0, 20);
  };
  d.sectors.forEach((s, i) => {
    const at = `sectors[${i}]${typeof s?.id === 'string' ? ` (${s.id})` : ''}`;
    id(s?.id, at);
    text(s?.name, `${at}.name`);
    text(s?.period, `${at}.period`);
    text(s?.description, `${at}.description`);
    if (!SECTOR_CLASSES.includes(s?.classification)) out.push(`${at}.classification: one of ${SECTOR_CLASSES.join(', ')}`);
    if (!Array.isArray(s?.maps) || !s.maps.length) out.push(`${at}.maps: one or more`);
    const seen = new Set<string>();
    (Array.isArray(s?.maps) ? s.maps : []).forEach((m, j) => {
      mapRef(m?.map, `${at}.maps[${j}]`, typeof m?.mode === 'string' ? m.mode : undefined);
      match(m, `${at}.maps[${j}]`);
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
    if (!ex || !Number.isInteger(ex.crew) || ex.crew < 1 || ex.crew > CAMPAIGN_PICKED_MAX) out.push(`${at}.expedition.crew: 1-${CAMPAIGN_PICKED_MAX} (the roster the player picks)`);
    if (!Array.isArray(ex?.allies)) out.push(`${at}.expedition.allies: an array`);
    else {
      if (new Set(ex.allies).size !== ex.allies.length) out.push(`${at}.expedition.allies: an ally twice`);
      for (const a of ex.allies) {
        const why = refs?.character(a, 'ally');
        if (why) out.push(`${at}.expedition.allies: ${a}: ${why}`);
      }
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
