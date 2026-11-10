import { horizontalDistance, type Vec3 } from '../math.ts';
import { hintAt, hintTo, mapBotHints } from '../map/botHints.ts';
import type { BotHint, MapDocument } from '../map/schema.ts';
import type { Raycast, VantageSpot } from './vantage.ts';

/**
 * Bots read the map's bot hints (BOT_AI_PLAN.md Phase D item 5; docs/BOTS.md, "Bot hints (map data)"): the spots
 * MapMaker's Bot hints tool marks are extra candidates on top of what bots work out themselves, never instead of it.
 * A map with no hints plays exactly as before. Read once per match (or per side), never per tick.
 *
 * - **sniper, camp**: vantage spots of their own (`hintSpots`), worth more than computed ones close by (which they
 *   replace), for their team only when they have one;
 * - **staging**: a side's group gathers at the staging hint by its corridor instead of the computed spot
 *   (teamBrain.ts `stageOn`, `stageHint`);
 * - **choke**: angles a bot holding a spot near one watches (BotBrain's scan, `chokesNear`);
 * - **jump**: parkour candidates (nav/parkour.ts), played through the movement code like the computed ones (`hintJumps`).
 */

/** A hint as bots use it: where, the way it faces (null: none), and its radius. */
export interface HintSpot {
  pos: Vec3;
  yaw: number | null;
  radius: number;
  id: string;
}

/** The hints a side's bots use (its own and every side's), by kind. */
export interface SideHints {
  chokes: readonly HintSpot[];
  staging: readonly HintSpot[];
}

const spot = (h: BotHint): HintSpot => ({ pos: hintAt(h), yaw: h.yaw ?? null, radius: h.radius, id: h.id });

/** A side's hints (team-less hints are every side's). */
export function sideHints(hints: readonly BotHint[], side: string | null): SideHints {
  const mine = hints.filter((h) => !h.team || h.team === side);
  return { chokes: mine.filter((h) => h.kind === 'choke').map(spot), staging: mine.filter((h) => h.kind === 'staging').map(spot) };
}

/** Hinted vantage spots: worth this much (computed ones score about 1-3: a hint is the map maker's word). */
const SNIPER_HINT_SCORE = 2.6;
const CAMP_HINT_SCORE = 2.2;
/** Computed spots of the same kind this close (m) to a hinted one give way to it. */
const HINT_REPLACES = 8;
const EYE = 1.5;
const FAR = 90;

/**
 * Vantage spots from the map's sniper and camp hints (their team kept: only that side's bots take them). A hint's
 * facing is the way to watch; without one, the most open of eight directions (eight rays, once per match).
 */
export function hintSpots(hints: readonly BotHint[], raycast: Raycast): VantageSpot[] {
  const out: VantageSpot[] = [];
  for (const h of hints) {
    if (h.kind !== 'sniper' && h.kind !== 'camp') continue;
    const p = hintAt(h);
    const eye = { x: p.x, y: p.y + EYE, z: p.z };
    const reachAt = (a: number) => raycast(eye, { x: Math.sin(a), y: 0, z: Math.cos(a) }, FAR) ?? FAR;
    let yaw = h.yaw ?? 0;
    let reach = 0;
    if (h.yaw === undefined || h.yaw === null) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const r = reachAt(a);
        if (r > reach) {
          reach = r;
          yaw = a;
        }
      }
    } else reach = reachAt(yaw);
    out.push({ pos: p, kind: h.kind, yaw, reach, height: 0, score: h.kind === 'sniper' ? SNIPER_HINT_SCORE : CAMP_HINT_SCORE, hint: h.id, ...(h.team ? { team: h.team } : {}) });
  }
  return out;
}

/** The computed spots with the hinted ones added (computed spots of a kind close to a hint of that kind give way). */
export function withHintSpots(computed: readonly VantageSpot[], hinted: readonly VantageSpot[]): VantageSpot[] {
  if (!hinted.length) return computed as VantageSpot[];
  const kept = computed.filter((s) => !hinted.some((h) => h.kind === s.kind && horizontalDistance(h.pos, s.pos) < HINT_REPLACES && Math.abs(h.pos.y - s.pos.y) < 3));
  return [...kept, ...hinted];
}

/** A staging hint counts for a corridor when it is this close (m) to the route, and this close to the computed spot. */
const STAGE_OFF_ROUTE = 14;
const STAGE_FROM_COMPUTED = 40;

/**
 * The staging hint a group on route `line` gathers at instead of `computed` (teamBrain.ts stagePoint): the hint
 * nearest the computed spot, within STAGE_FROM_COMPUTED of it and STAGE_OFF_ROUTE of the route, not nearer the route's
 * goal than the computed spot is by more than its radius (the gathering stays out of the fight). Null: none.
 */
export function stageHint(line: readonly Vec3[], computed: Vec3, staging: readonly HintSpot[]): Vec3 | null {
  if (!staging.length || !line.length) return null;
  const goal = line[line.length - 1]!;
  let best: HintSpot | null = null;
  let bestD = STAGE_FROM_COMPUTED;
  for (const h of staging) {
    const d = horizontalDistance(h.pos, computed);
    if (d >= bestD) continue;
    if (horizontalDistance(h.pos, goal) < horizontalDistance(computed, goal) - h.radius) continue;
    let off = Infinity;
    for (const p of line) off = Math.min(off, horizontalDistance(p, h.pos));
    if (off > STAGE_OFF_ROUTE) continue;
    best = h;
    bestD = d;
  }
  return best ? { ...best.pos } : null;
}

/** Chokepoints within `range` m of `at` (a bot holding a spot near one watches it). */
export function chokesNear(chokes: readonly HintSpot[], at: Vec3, range: number): HintSpot[] {
  const out: HintSpot[] = [];
  for (const c of chokes) if (horizontalDistance(c.pos, at) <= range + c.radius && Math.abs(c.pos.y - at.y) < 6) out.push(c);
  return out;
}

/** The map's jump links as parkour candidates (nav/parkour.ts): start and landing. Every side's (the navmesh is shared). */
export function hintJumps(map: Pick<MapDocument, 'botHints'>): { start: Vec3; end: Vec3 }[] {
  return mapBotHints(map, 'jump').flatMap((h) => {
    const to = hintTo(h);
    return to ? [{ start: hintAt(h), end: to }] : [];
  });
}
