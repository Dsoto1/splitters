// CI's e2e shards: flows assigned greedily by measured duration (e2e/timings.json),
// longest first, each to the shard with the least work so far.
import { readFileSync } from 'node:fs';

/** A flow with no measurement yet counts as this long (seconds). */
export const UNKNOWN_FLOW_S = 60;
/** At most this many shards; fewer when the selected flows are short (each shard pays ~1 min of setup). */
export const MAX_SHARDS = 8;
/** Aim for shards of about this much work (seconds) when there's little to run. */
export const TARGET_SHARD_S = 420;

export function loadTimings(url = new URL('./timings.json', import.meta.url)) {
  try {
    return JSON.parse(readFileSync(url, 'utf8'));
  } catch {
    return { startup: 15, flows: {} };
  }
}

/** Seconds a flow takes (its measurement, or the unknown default). */
export const durationOf = (timings, flow) => timings.flows?.[flow] ?? UNKNOWN_FLOW_S;

/** How many shards a set of flows wants: enough for TARGET_SHARD_S each, at most MAX_SHARDS, at least 1. */
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
