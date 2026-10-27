// Refresh e2e/timings.json (what CI's shards are balanced by) from CI's measurements.
//   gh run download <run id> -p 'e2e-timings-*' -D /tmp/timings
//   node tools/ci/timings.mjs merge /tmp/timings      (files or folders of the JSON e2e/run.mjs writes to E2E_TIMINGS_OUT)
// Each flow's new time is the mean of its old one and the latest measurement (one slow runner doesn't swing the plan).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [cmd, ...paths] = process.argv.slice(2);
if (cmd !== 'merge' || !paths.length) {
  console.log('usage: node tools/ci/timings.mjs merge <timing json files or folders>');
  process.exit(1);
}
const files = paths.flatMap(function walk(p) {
  return statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : p.endsWith('.json') ? [p] : [];
});
const target = new URL('../../e2e/timings.json', import.meta.url);
const timings = JSON.parse(readFileSync(target, 'utf8'));
const measured = {};
for (const f of files) for (const [flow, s] of Object.entries(JSON.parse(readFileSync(f, 'utf8')).flows ?? {})) measured[flow] = s;
for (const [flow, s] of Object.entries(measured)) {
  const old = timings.flows[flow];
  timings.flows[flow] = Math.round(old ? (old + s) / 2 : s);
  console.log(`${flow}: ${old ?? '-'} → ${timings.flows[flow]} s (measured ${s})`);
}
timings.source = `merged from CI measurements, ${new Date().toISOString().slice(0, 10)}`;
writeFileSync(target, `${JSON.stringify(timings, null, 2)}\n`);
