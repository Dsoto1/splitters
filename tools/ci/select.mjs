// What a change needs from CI: the e2e flows and unit-test packages mapped (e2e/flowMap.mjs)
// from the files changed since the merge base with origin/main, and the e2e shards for them.
//
//   node tools/ci/select.mjs                  print the plan for this branch (committed + uncommitted changes)
//   node tools/ci/select.mjs --run            run the mapped e2e flows locally (pnpm e2e:changed); needs `pnpm build`
//   node tools/ci/select.mjs --run --all      … even when the change needs the full suite (otherwise a smoke set)
//   node tools/ci/select.mjs --github         CI: committed changes only, outputs to $GITHUB_OUTPUT, plan to the job summary
//   options: --base <ref> (default origin/main), --full (everything), --files a,b (instead of git)
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readdirSync } from 'node:fs';
import { FLOWS, selectForPaths, unitTestPaths } from '../../e2e/flowMap.mjs';
import { assignShards, loadTimings, shardCount } from '../../e2e/shards.mjs';

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
const sel = files === null ? { ...selectForPaths([], mapIds), full: true, flows: [...FLOWS], unit: 'all', docsOnly: false, perf: true, reasons: [flag('--full') ? 'asked for the full suite' : `no merge base with ${base}: everything`] } : selectForPaths(files, mapIds);
const timings = loadTimings();
const shards = sel.flows.length ? assignShards(sel.flows, timings, shardCount(sel.flows, timings), FLOWS) : [];
const matrix = shards.map((s, i) => ({ index: i + 1, of: shards.length, flows: s.flows.join(','), seconds: Math.round(s.seconds) }));

const lines = [
  `Changed files: ${files === null ? '(not compared)' : files.length}`,
  `Full suite: ${sel.full ? 'yes' : 'no'}${sel.reasons.length ? ` (${sel.reasons.slice(0, 5).join('; ')}${sel.reasons.length > 5 ? '; …' : ''})` : ''}`,
  `Unit tests: ${sel.unit === 'all' ? 'all' : sel.unit.length ? sel.unit.join(', ') : 'none'}`,
  `E2E flows (${sel.flows.length}): ${sel.flows.join(', ') || 'none'}`,
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
  const r = spawnSync('node', ['e2e/run.mjs'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, E2E_ONLY: flows.join(',') } });
  process.exit(r.status ?? 1);
}
