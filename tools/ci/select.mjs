// What a change needs from CI: the e2e flows and unit-test packages mapped (e2e/flowMap.mjs)
// from the files changed since the merge base with origin/main, and the e2e shards for them.
//
//   node tools/ci/select.mjs                  print the plan for this branch (committed + uncommitted changes)
//   node tools/ci/select.mjs --run            run the mapped e2e flows locally (pnpm e2e:changed); needs `pnpm build`
//   node tools/ci/select.mjs --run --all      … even when the change needs the full suite (otherwise a smoke set)
//   node tools/ci/select.mjs --github         CI: committed changes only, outputs to $GITHUB_OUTPUT, plan to the job summary
//   options: --base <ref> (default origin/main), --full (everything), --tour (the browser map tour too: nightly, v* tags,
//            Run workflow), --files a,b (instead of git)
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readdirSync } from 'node:fs';
import { FLOWS, selectForPaths, unitJobs, unitTestPaths } from '../../e2e/flowMap.mjs';
import { loadTimings, planShards, withNamedMaps } from '../../e2e/shards.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ROOT = new URL('../../', import.meta.url);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Flows a local run uses when the change needs everything (CI runs the rest on the check branch). */
export const SMOKE = ['editor', 'offline', 'online', 'maps'];

function changedFiles(base, withWorktree) {
  let mergeBase;
  try {
    mergeBase = git('merge-base', 'HEAD', base);
  } catch {
    return null; // No common history (shallow clone, unknown base): the caller runs everything.
  }
  const files = new Set(git('diff', '--name-only', `${mergeBase}`, 'HEAD').split('\n').filter(Boolean));
  if (withWorktree) {
    for (const f of git('diff', '--name-only', 'HEAD').split('\n')) if (f) files.add(f);
    for (const f of git('ls-files', '--others', '--exclude-standard').split('\n')) if (f) files.add(f);
  }
  return [...files].sort();
}

const mapIds = readdirSync(new URL('maps/', ROOT)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const base = opt('--base') ?? 'origin/main';
const files = opt('--files') !== undefined ? opt('--files').split(',').filter(Boolean) : flag('--full') ? null : changedFiles(base, !flag('--github'));
const tour = flag('--tour');
const sel = files === null ? { ...selectForPaths(['package.json'], mapIds, { tour }), reasons: [flag('--full') ? 'asked for the full suite' : `no merge base with ${base}: everything`] } : selectForPaths(files, mapIds, { tour });
const timings = withNamedMaps(loadTimings(), sel.maps);
const shards = planShards(sel.flows, timings, { order: FLOWS });
const matrix = shards.map((s, i) => ({ index: i + 1, of: shards.length, flows: s.flows.join(','), seconds: Math.round(s.seconds), maps: s.flows.includes('maps') ? sel.maps.join(',') : '' }));
const units = unitJobs(sel.unit);

const lines = [
  `Changed files: ${files === null ? '(not compared)' : files.length}`,
  `Full suite: ${sel.full ? 'yes' : 'no'}${sel.reasons.length ? ` (${sel.reasons.slice(0, 5).join('; ')}${sel.reasons.length > 5 ? '; …' : ''})` : ''}`,
  `Unit tests: ${sel.unit === 'all' ? 'all' : sel.unit.length ? sel.unit.join(', ') : 'none'}${units.length ? ` (${units.length} jobs)` : ''}`,
  `E2E flows (${sel.flows.length}): ${sel.flows.join(', ') || 'none'}${sel.maps.length ? ` (map tour of ${sel.maps.join(', ')} only)` : ''}`,
  `Browser map tour: ${tour ? 'yes (all parts)' : sel.maps.length ? `the changed maps (${sel.maps.join(', ')})` : 'no (nightly, v* tags and Run workflow)'}`,
  `Perf budget check: ${sel.perf ? 'yes' : 'no'}`,
  ...matrix.map((s) => `  shard ${s.index}/${s.of} (~${Math.round(s.seconds / 60)} min): ${s.flows}`),
];
console.log(lines.join('\n'));

if (flag('--github')) {
  const out = process.env.GITHUB_OUTPUT;
  const kv = {
    full: String(sel.full),
    e2e: String(sel.flows.length > 0),
    flows: sel.flows.join(','),
    shards: JSON.stringify(matrix),
    // 'all', 'none', or the vitest paths to run.
    unit: sel.unit === 'all' ? 'all' : sel.unit.length ? unitTestPaths(sel.unit).join(' ') : 'none',
    // The unit-test jobs' matrix: [{ name, args }] (vitest arguments).
    unit_jobs: JSON.stringify(units),
    perf: String(sel.perf),
    docs_only: String(sel.docsOnly),
  };
  if (out) appendFileSync(out, Object.entries(kv).map(([k, v]) => `${k}=${v}\n`).join(''));
  else console.log(kv);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### CI plan\n\n${lines.map((l) => `- ${l.trim()}`).join('\n')}\n`);
}

if (flag('--run')) {
  let flows = sel.flows;
  if (sel.full && !flag('--all')) {
    console.log(`\nThis change needs the full suite: CI runs it on the check branch. Running the smoke set here (${SMOKE.join(', ')}); --all runs everything.`);
    flows = SMOKE;
  }
  if (!flows.length) {
    console.log('\nNo e2e flows map to these changes.');
    process.exit(0);
  }
  const r = spawnSync('node', ['e2e/run.mjs'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, E2E_ONLY: flows.join(','), ...(sel.maps.length ? { E2E_MAPS: sel.maps.join(',') } : {}) } });
  process.exit(r.status ?? 1);
}
