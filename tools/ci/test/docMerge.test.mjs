// Trains resolve HANDOFF/QUEUE-only conflicts (tools/ci/docMerge.mjs): a simple union of added lines, else stop.
import { describe, expect, it } from 'vitest';
import { DOC_FILES, mergeDoc, resolveHunk, resolveMerged } from '../docMerge.mjs';

const doc = (...lines) => `${lines.join('\n')}\n`;

describe('one hunk', () => {
  it("keeps the candidate's side and adds the branch's new lines after it", () => {
    expect(resolveHunk({ ours: ['- a', '- main'], base: ['- a'], theirs: ['- a', '- branch'] })).toEqual(['- a', '- main', '- branch']);
    expect(resolveHunk({ ours: ['x'], base: [], theirs: ['y', 'z'] })).toEqual(['x', 'y', 'z']);
  });
  it("doesn't repeat a line the candidate already has", () => {
    expect(resolveHunk({ ours: ['- a', '- same'], base: ['- a'], theirs: ['- a', '- same', '- new'] })).toEqual(['- a', '- same', '- new']);
  });
  it('is not a simple union when the branch changed or removed a base line', () => {
    expect(resolveHunk({ ours: ['- a', '- main'], base: ['- a'], theirs: ['- a (done)'] })).toBeNull();
    expect(resolveHunk({ ours: ['- a', '- main'], base: ['- a', '- b'], theirs: ['- a'] })).toBeNull();
  });
  it('stops on a hunk it cannot parse', () => {
    expect(resolveMerged(`x\n${'<'.repeat(13)} candidate\na\n`)).toBeNull();
  });
});

describe('a whole file (git merge-file)', () => {
  const base = doc('# Queue', '', '## Ready to land', '- `wip/a` · 1111111 · 1000001', '', '## Done', '- old');
  it('both sides added to the same list: the candidate first, then the branch', () => {
    const ours = doc('# Queue', '', '## Ready to land', '- `wip/a` · 1111111 · 1000001', '- `wip/b` · 2222222 · 1000002', '', '## Done', '- old');
    const theirs = doc('# Queue', '', '## Ready to land', '- `wip/a` · 1111111 · 1000001', '- `wip/c` · 3333333 · 1000003', '', '## Done', '- old', '- c done');
    expect(mergeDoc({ ours, base, theirs })).toBe(doc('# Queue', '', '## Ready to land', '- `wip/a` · 1111111 · 1000001', '- `wip/b` · 2222222 · 1000002', '- `wip/c` · 3333333 · 1000003', '', '## Done', '- old', '- c done'));
  });
  it("the branch edited a line the candidate also changed: unresolved (null)", () => {
    const ours = doc('# Queue', '', '## Ready to land', '- `wip/a` · 1111111 · 1000001 (in train)', '', '## Done', '- old');
    const theirs = doc('# Queue', '', '## Ready to land', '- `wip/a` · 9999999 · 1000009', '', '## Done', '- old');
    expect(mergeDoc({ ours, base, theirs })).toBeNull();
  });
  it('no conflict: the plain merge', () => {
    const ours = base.replace('# Queue', '# Queue!');
    const theirs = base.replace('- old', '- old\n- new');
    expect(mergeDoc({ ours, base, theirs })).toBe(ours.replace('- old', '- old\n- new'));
  });
  it('covers only the shared notes', () => {
    expect(DOC_FILES).toEqual(['HANDOFF.md', 'docs/QUEUE.md']);
  });
});
