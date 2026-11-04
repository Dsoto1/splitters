// CI's e2e shards: the flows a change needs, packed by measured duration (e2e/timings.json, refreshed from CI's
// own timings: tools/ci/timings.mjs) into as few shards as finish about together within TARGET_SHARD_S, longest
// first, each to the shard with the least work so far (LPT). At most MAX_SHARDS runners.
import { readFileSync } from 'node:fs';

/** A flow with no measurement yet counts as this long (seconds). */
export const UNKNOWN_FLOW_S = 60;
/** At most this many e2e runners at once (the repo is public: Actions minutes are free, 20 jobs run at a time). */
export const MAX_SHARDS = 16;
/** A shard's work (seconds of flows, its runner's start-up included) the plan aims at: about 5 minutes. */
export const TARGET_SHARD_S = 300;
/** One map of the browser tour, played and opened in MapMaker, when `timings.perMap` has no measurement (seconds). */
export const PER_MAP_S = 60;

export function loadTimings(url = new URL('./timings.json', import.meta.url)) {
  try {
    return JSON.parse(readFileSync(url, 'utf8'));
  } catch {
    return { startup: 15, flows: {} };
  }
}

/** Seconds a flow takes (its measurement, or the unknown default). */
export const durationOf = (timings, flow) => timings.flows?.[flow] ?? UNKNOWN_FLOW_S;

/** The timings with the 'maps' flow touring only `maps` (E2E_MAPS): about perMap a map, plus MapMaker's start. */
export function withNamedMaps(timings, maps) {
  if (!maps?.length) return timings;
  return { ...timings, flows: { ...timings.flows, maps: Math.round((timings.perMap ?? PER_MAP_S) * maps.length + 20) } };
}

/** How many shards a set of flows wants at least: enough for TARGET_SHARD_S each, at most MAX_SHARDS, at least 1. */
export function shardCount(flows, timings, max = MAX_SHARDS) {
  const total = flows.reduce((s, f) => s + durationOf(timings, f), 0);
  return Math.max(1, Math.min(max, flows.length, Math.ceil(total / TARGET_SHARD_S)));
}

/**
 * Longest-processing-time-first: flows sorted by duration (ties by name, so the plan is stable),
 * each to the shard with the least so far. Returns [{ flows, seconds }] in shard order; within a
 * shard, flows keep the runner's own order (the order of `order`, default the input order).
 */
export function assignShards(flows, timings, n, order = flows) {
  const shards = Array.from({ length: Math.max(1, n) }, () => ({ flows: [], seconds: timings.startup ?? 0 }));
  const sorted = [...new Set(flows)].sort((a, b) => durationOf(timings, b) - durationOf(timings, a) || a.localeCompare(b));
  for (const f of sorted) {
    let best = shards[0];
    for (const s of shards) if (s.seconds < best.seconds) best = s;
    best.flows.push(f);
    best.seconds += durationOf(timings, f);
  }
  const rank = new Map(order.map((f, i) => [f, i]));
  for (const s of shards) s.flows.sort((a, b) => (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9));
  return shards.filter((s) => s.flows.length);
}

/**
 * The plan: the fewest shards (from shardCount up to `max`) whose longest shard is within the target, or within the
 * longest single flow plus start-up when one flow is longer than that (more runners wouldn't finish sooner).
 * Returns assignShards' shards.
 */
export function planShards(flows, timings, { max = MAX_SHARDS, target = TARGET_SHARD_S, order = flows } = {}) {
  const unique = [...new Set(flows)];
  if (!unique.length) return [];
  const longest = Math.max(...unique.map((f) => durationOf(timings, f))) + (timings.startup ?? 0);
  const goal = Math.max(target, longest);
  const most = Math.max(1, Math.min(max, unique.length));
  const total = unique.reduce((sum, f) => sum + durationOf(timings, f), 0);
  let shards = [];
  for (let n = Math.max(1, Math.min(most, Math.ceil(total / goal))); n <= most; n++) {
    shards = assignShards(unique, timings, n, order);
    if (Math.max(...shards.map((s) => s.seconds)) <= goal) break;
  }
  return shards;
}
