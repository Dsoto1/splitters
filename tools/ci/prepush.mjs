// `pnpm prepush`: the checks to run before pushing a merge candidate to a check/ branch, on the commit that will be
// pushed. It refuses unless origin/main (fetched just now) is already merged into HEAD and the working tree is clean:
// checks that passed before the merge say nothing about what main gained meanwhile. (The third vehicles batch,
// 2026-11-12, took three check pushes: both failures were checks landed on main after the branch was last tested;
// after the merge only the typecheck and the content check had been run.)
//
//   node tools/ci/prepush.mjs [--e2e] [--no-fetch]
//
// Runs, stopping at the first failure: the typecheck, the content check, `pnpm test:changed` (against origin/main).
// Then prints CI's plan for the change (`pnpm ci:plan`: the flows to run); with --e2e it runs them (`pnpm e2e:changed`,
// after `pnpm build`). Ends with the commit the result is for. Tested in tools/ci/test/prepush.test.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Why the checks can't run yet (null: they can). `dirty`: `git status --porcelain` lines, untracked files left out. */
export function prepushRefusal({ mainInHead, mainSha, dirty }) {
  if (!mainInHead) return `origin/main (${mainSha.slice(0, 8)}) is not in this commit: merge it first (git merge origin/main), then run this again. Checks on the commit before the merge don't count.`;
  if (dirty.length) return `uncommitted changes (${dirty.slice(0, 3).join(', ')}${dirty.length > 3 ? `, and ${dirty.length - 3} more` : ''}): commit them first. The checks are for the commit that is pushed.`;
  return null;
}

/** The steps, in order: [what it is, the command]. */
export function prepushSteps({ e2e }) {
  const steps = [
    ['typecheck', ['pnpm', 'typecheck']],
    ['content check', ['pnpm', 'content:check']],
    ['unit tests for the change', ['pnpm', 'test:changed']],
    ["CI's plan for the change", ['pnpm', 'ci:plan']],
  ];
  if (e2e) steps.push(['build', ['pnpm', 'build']], ['browser flows for the change', ['pnpm', 'e2e:changed']]);
  return steps;
}

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function main(argv) {
  const e2e = argv.includes('--e2e');
  if (!argv.includes('--no-fetch')) git(['fetch', '--quiet', 'origin', 'main']);
  const mainSha = git(['rev-parse', 'origin/main']);
  const mainInHead = spawnSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: ROOT }).status === 0;
  const dirty = git(['status', '--porcelain', '--untracked-files=no']).split('\n').filter(Boolean).map((l) => l.slice(3));
  const no = prepushRefusal({ mainInHead, mainSha, dirty });
  if (no) {
    console.error(`prepush: ${no}`);
    return 1;
  }
  const head = git(['rev-parse', 'HEAD']);
  for (const [what, cmd] of prepushSteps({ e2e })) {
    console.log(`\nprepush: ${what} (${cmd.join(' ')})`);
    const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`\nprepush: ${what} failed on ${head.slice(0, 8)}. Not ready to push.`);
      return r.status ?? 1;
    }
  }
  // The checks took a while: say so if the commit or main moved under them.
  const now = git(['rev-parse', 'HEAD']);
  if (now !== head) console.error(`prepush: HEAD moved while the checks ran (${head.slice(0, 8)} → ${now.slice(0, 8)}): run it again.`);
  console.log(`\nprepush: passed on ${head.slice(0, 8)} (with origin/main ${mainSha.slice(0, 8)} merged)${e2e ? '' : "; the flows in the plan above weren't run (--e2e runs them)"}.`);
  return now === head ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
