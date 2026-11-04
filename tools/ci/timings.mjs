// The per-flow duration table CI's e2e shards are packed by (e2e/timings.json, e2e/shards.mjs), refreshed from
// CI's own measurements (e2e/run.mjs writes them to E2E_TIMINGS_OUT and prints an `E2E_TIMINGS {…}` log line).
//
//   node tools/ci/timings.mjs merge [--base <table>] [--out <table>] <timing json files or folders>
//
// --base: the table to start from (default e2e/timings.json); --out: where to write (default the base). CI's
// timings job merges every e2e shard's measurements into the table its plan used and uploads the result as the
// `e2e-timings` artifact; the next run's plan job starts from the newest such artifact (ci.yml). To commit a
// refreshed table: download that artifact (`gh run download <run id> -n e2e-timings`) over e2e/timings.json.
// Each flow's new time is the mean of its old one and the latest measurement (one slow runner doesn't swing the plan).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Merge measurements ({ flows, perMap? } objects) into a table; returns the new table and a line per change. */
export function mergeTimings(table, measurements, today = new Date().toISOString().slice(0, 10)) {
  const out = { ...table, flows: { ...table.flows } };
  const lines = [];
  const measured = {};
  const perMap = [];
  for (const m of measurements) {
    for (const [flow, s] of Object.entries(m.flows ?? {})) if (Number.isFinite(s) && s > 0) measured[flow] = s;
    if (Number.isFinite(m.perMap) && m.perMap > 0) perMap.push(m.perMap);
  }
  for (const [flow, s] of Object.entries(measured)) {
    const old = out.flows[flow];
    out.flows[flow] = Math.round(old ? (old + s) / 2 : s);
    lines.push(`${flow}: ${old ?? '-'} → ${out.flows[flow]} s (measured ${s})`);
  }
  if (perMap.length) {
    const s = perMap.reduce((a, b) => a + b, 0) / perMap.length;
    const old = out.perMap;
    out.perMap = Math.round(old ? (old + s) / 2 : s);
    lines.push(`perMap: ${old ?? '-'} → ${out.perMap} s (measured ${Math.round(s)})`);
  }
  if (lines.length) out.source = `merged from CI measurements, ${today}`;
  return { table: out, lines };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const base = opt('--base') ?? fileURLToPath(new URL('../../e2e/timings.json', import.meta.url));
  const outPath = opt('--out') ?? base;
  const [cmd, ...paths] = args;
  if (cmd !== 'merge' || !paths.length) {
    console.log('usage: node tools/ci/timings.mjs merge [--base table] [--out table] <timing json files or folders>');
    process.exit(1);
  }
  const files = paths.flatMap(function walk(p) {
    return statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : p.endsWith('.json') ? [p] : [];
  });
  const measurements = [];
  for (const f of files) {
    try {
      measurements.push(JSON.parse(readFileSync(f, 'utf8')));
    } catch {
      console.log(`skipped ${f} (not JSON)`);
    }
  }
  const { table, lines } = mergeTimings(JSON.parse(readFileSync(base, 'utf8')), measurements);
  for (const l of lines) console.log(l);
  writeFileSync(outPath, `${JSON.stringify(table, null, 2)}\n`);
}
