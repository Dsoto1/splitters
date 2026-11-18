// The daily flake list (tools/ci/flakes.mjs): reading job logs, counting, the page.
import { describe, expect, it } from 'vitest';
import { failedChecks, flakyFlows, renderFlakes, summarize } from '../flakes.mjs';

const log = (...lines) => lines.map((l) => `2026-11-18T03:02:00.9221546Z ${l}`).join('\n');

describe('job logs', () => {
  it('finds the flows that passed on their retry, with their first failed check', () => {
    const text = log('FLOW sandgate PASS in 43 s', 'RETRY classes (attempt 2) after: x', 'FLOW classes FLAKY in 201 s (2 attempts)', 'FLOW teams FLAKY in 90 s (2 attempts)', 'FLAKY classes: held, a ring fills | the next check');
    expect(flakyFlows(text)).toEqual([
      { name: 'e2e classes', why: 'held, a ring fills' },
      { name: 'e2e teams', why: '' },
    ]);
  });
  it("names a failed job's flows, else its unit tests", () => {
    expect(failedChecks(log('FLOW editor FAIL in 300 s (2 attempts)', 'FLOW menu PASS in 3 s'))).toEqual([{ name: 'e2e editor', why: '' }]);
    const unit = log('\x1b[31m FAIL \x1b[39m packages/shared/test/match.test.ts > match > bots react 120ms', ' FAIL  packages/shared/test/match.test.ts', ' FAIL  tools/ci/test/train.test.mjs > the train');
    expect(failedChecks(unit).map((c) => c.name)).toEqual(['packages/shared/test/match.test.ts > match > bots react', 'tools/ci/test/train.test.mjs > the train']);
    expect(failedChecks(log('error: something else'))).toEqual([]);
  });
});

describe('the list', () => {
  const ev = (name, kind, at, why = '') => ({ name, kind, at, url: `u/${at}`, branch: 'check/x', why });
  it('counts each check by how it flaked, most often first, with its latest sighting', () => {
    const rows = summarize([ev('e2e a', 'retry', '2026-11-17T01:00:00Z', 'old'), ev('e2e b', 'retry', '2026-11-17T02:00:00Z'), ev('e2e a', 're-run', '2026-11-18T01:00:00Z', 'new'), ev('e2e a', 'retry', '2026-11-16T01:00:00Z')]);
    expect(rows.map((r) => [r.name, r.count])).toEqual([['e2e a', 3], ['e2e b', 1]]);
    expect(rows[0].kinds).toEqual({ retry: 2, 're-run': 1 });
    expect(rows[0].last.url).toBe('u/2026-11-18T01:00:00Z');
    expect(rows[0].why).toBe('new');
  });
  it('writes a page lane A can work from, or says nothing is flaky', () => {
    const md = renderFlakes(summarize([ev('e2e a', 'retry', '2026-11-17T01:00:00Z', 'x | y')]), { generated: '2026-11-18 04:00 UTC', days: 7, runs: 12 });
    expect(md).toMatch(/^# Flaky checks/);
    expect(md).toMatch(/\| e2e a \| 1 \| retry 1 \| \[2026-11-17\]\(u\/2026-11-17T01:00:00Z\) check\/x \| x \\\| y \|/);
    expect(renderFlakes([], { generated: 'g', days: 7, runs: 0 })).toMatch(/Nothing flaky/);
  });
});
