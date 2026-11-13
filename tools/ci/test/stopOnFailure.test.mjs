import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../stop-on-failure.sh', import.meta.url));

/** Runs the script inside a pretend CI run whose `gh` reports `failed` as a failed job ('' for none). */
function run(failed, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'stop-on-failure-'));
  // The real call filters with --jq: the stand-in prints what that filter would (failed jobs' names).
  writeFileSync(join(dir, 'gh'), `#!/usr/bin/env bash\nprintf '%s' "${failed}"\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  const marker = join(dir, 'ran');
  const r = spawnSync('bash', [script, 'bash', '-c', `echo ran > "${marker}"; exit \${EXIT:-0}`], {
    env: { PATH: `${dir}:${process.env.PATH}`, GITHUB_RUN_ID: '1', GITHUB_REPOSITORY: 'o/r', GH_TOKEN: 'x', STOP_POLL_S: '1', ...env },
    encoding: 'utf8',
  });
  let ran = false;
  try {
    ran = readFileSync(marker, 'utf8').trim() === 'ran';
  } catch {}
  return { status: r.status, ran, out: r.stdout };
}

describe('tools/ci/stop-on-failure.sh', () => {
  it('does not start a step once another job of the run has failed', () => {
    const r = run('unit (1/3)');
    expect(r).toMatchObject({ status: 1, ran: false });
    expect(r.out).toMatch(/another job of this run failed \(unit \(1\/3\)\): not starting/);
  });
  it('runs the step when nothing has failed, with its own exit status', () => {
    expect(run('')).toMatchObject({ status: 0, ran: true });
    expect(run('', { EXIT: '3' })).toMatchObject({ status: 3, ran: true });
  });
  it('STOP_ON_FAILURE=off (a check branch\'s unit and e2e shards) runs the step whatever else failed, and still fails by its own result', () => {
    expect(run('unit (1/3)', { STOP_ON_FAILURE: 'off' })).toMatchObject({ status: 0, ran: true });
    expect(run('unit (1/3)', { STOP_ON_FAILURE: 'off', EXIT: '1' })).toMatchObject({ status: 1, ran: true });
  });
});

describe('ci.yml: a check branch reports every failure in one run', () => {
  const ci = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  /** A job's text: from its `  name:` line to the next job's. */
  const job = (name) => new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [\\w-]+:\\n|(?![\\s\\S]))`, 'm').exec(ci)[1];
  const OFF_ON_CHECK = "STOP_ON_FAILURE: ${{ startsWith(github.ref, 'refs/heads/check/') && 'off' || 'on' }}";
  it('the unit and e2e shards turn the stop off on check/ branches only', () => {
    for (const name of ['unit', 'e2e']) {
      const text = job(name);
      expect(text.match(/stop-on-failure\.sh/g)?.length, name).toBe(1);
      expect(text, name).toContain(OFF_ON_CHECK);
      expect(text, name).toMatch(/fail-fast: false/);
    }
  });
  it('perf and the bots check stop as before, everywhere', () => {
    for (const name of ['perf', 'bots']) {
      const text = job(name);
      expect(text, name).toMatch(/stop-on-failure\.sh/);
      expect(text, name).not.toMatch(/STOP_ON_FAILURE/);
    }
  });
  it('a new push to a check branch still cancels its older run', () => {
    expect(ci).toContain("cancel-in-progress: ${{ github.event_name == 'push' && startsWith(github.ref, 'refs/heads/check/') }}");
  });
});
