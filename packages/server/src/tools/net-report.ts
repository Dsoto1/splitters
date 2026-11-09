import { writeFileSync } from 'node:fs';
import { initPhysics } from '@tiletrigger/shared';
import { initNavigation } from '@tiletrigger/shared/match';
import { runNetLab, type NetCondition, type NetLabResult } from './netLab.ts';

/**
 * Network check (docs/GUNPLAY_AUDIT.md, "G3: the network check"): a real host and N players over links with latency,
 * jitter and loss (netLab.ts), one run per condition, and a table of hit registration, lag-compensation error, time
 * to the hit marker, rubber-banding and bandwidth.
 *
 * Usage (from the repo root):
 *   pnpm net-report                                   (the standard conditions, 30 s each, 8 players)
 *   pnpm net-report --conditions=100/20/2,150/30/5    (round trip ms / jitter ms / loss %)
 *   pnpm net-report --seconds=10 --clients=4 --weapon=core.pistol --json=out.json
 *   pnpm net-report --smoke                           (one 100/20/2 run, 8 s, 4 players; exits 1 on a failed check)
 */
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k!, v ?? 'true'] as const;
  }),
);
const smoke = args.has('smoke');
export const STANDARD_CONDITIONS = '0/0/0,50/10/1,100/20/2,150/30/3,150/30/5,250/30/2';
const conditions: NetCondition[] = (args.get('conditions') ?? (smoke ? '100/20/2' : STANDARD_CONDITIONS)).split(',').map((c) => {
  const [rtt, jitter, loss] = c.split('/').map(Number);
  return { rttMs: rtt ?? 0, jitterMs: jitter ?? 0, loss: (loss ?? 0) / 100 };
});
const seconds = Number(args.get('seconds') ?? (smoke ? 8 : 30));
const clients = Number(args.get('clients') ?? (smoke ? 4 : 8));
const weapon = args.get('weapon') ?? 'core.rifle';

await Promise.all([initPhysics(), initNavigation()]);
const results: NetLabResult[] = [];
for (const [i, condition] of conditions.entries()) {
  const r = await runNetLab({ condition, clients, seconds, weapon, seed: 1 + i });
  results.push(r);
  console.error(`${condition.rttMs}/${condition.jitterMs}/${condition.loss * 100}: done`);
}

const pctOf = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : '–');
console.log(`Net check: ${clients} players, ${seconds} s a condition, ${weapon}\n`);
console.log('| Round trip / jitter / loss | Ping p50 / p95 | Screen hits | Confirmed | Missed: dead / clamped / other | Phantom hits | Lag-comp error p50 / p95 / max | Hit marker p50 / p95 | Corrections /min, p95 / max | Down / up KB/s | Snapshot gap p95 / max | Unfired, dropped inputs | Kills /min |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const c = r.condition;
  console.log(
    `| ${c.rttMs} ms / ${c.jitterMs} ms / ${c.loss * 100} % | ${r.rtt.p50} / ${r.rtt.p95} ms | ${r.screenHits} of ${r.shots} | ${r.confirmed} (${pctOf(r.confirmed, r.screenHits)}) | ${r.missDead} / ${r.missClamped} / ${r.missOther} | ${r.phantomHits} | ${r.lagCompCm.p50} / ${r.lagCompCm.p95} / ${r.lagCompCm.max} cm | ${r.confirmMs.p50} / ${r.confirmMs.p95} ms | ${r.correctionsPerMin}, ${r.correctionCm.p95} / ${r.correctionCm.max} cm | ${r.downKBps} / ${r.upKBps} | ${r.snapshotGapMs.p95} / ${r.snapshotGapMs.max} ms | ${r.unfired}, ${r.droppedInputs} | ${r.killsPerMin} |`,
  );
}
const json = args.get('json');
if (json) writeFileSync(json, JSON.stringify({ generated: new Date().toISOString(), clients, seconds, weapon, results }, null, 2) + '\n');
if (smoke) {
  // The smoke check: players connected, rounds were fired and judged, and the host agreed with the screen.
  const r = results[0]!;
  const fails: string[] = [];
  if (r.shots < 20) fails.push(`only ${r.shots} shots`);
  if (r.screenHits < 10) fails.push(`only ${r.screenHits} screen hits`);
  if (r.confirmed / Math.max(1, r.screenHits - r.missDead) < 0.9) fails.push(`registration ${pctOf(r.confirmed, r.screenHits)}`);
  if (r.unfired > r.shots * 0.02) fails.push(`${r.unfired} rounds the host never fired`);
  if (fails.length) {
    console.error(`net-report smoke FAILED: ${fails.join('; ')}`);
    process.exit(1);
  }
  console.error('net-report smoke OK');
}
process.exit(0);
