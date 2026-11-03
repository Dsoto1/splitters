// CI's "already green?" by code (tools/ci/greenTree.mjs): docs-only differences skip, any code difference runs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { differingPaths, findGreenTwin, sameCode } from '../greenTree.mjs';

describe('sameCode (the decision)', () => {
  it('no difference, or docs only: the same code', () => {
    expect(sameCode([])).toBe(true);
    expect(sameCode(['HANDOFF.md', 'CHANGELOG.md', 'CLAUDE.md', 'docs/HOSTING.md', 'docs/screenshots/a.png', 'packages/client/README.md', 'LICENSE'])).toBe(true);
  });

  it.each([
    ['a code file', ['docs/HOSTING.md', 'packages/client/src/game/view.ts']],
    ['a map', ['maps/canyon.json']],
    ['content', ['content/props.json']],
    ['the workflow', ['.github/workflows/ci.yml']],
    ['a nested markdown file the build might read', ['packages/client/src/notes.md']],
    ['an ignore file', ['.gitignore']],
  ])('anything else differs (%s): not the same', (_, paths) => {
    expect(sameCode(paths)).toBe(false);
  });
});

describe('findGreenTwin (real commits)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tt-green-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  const write = (p, text) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), text);
  };
  const commit = (msg) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  write('packages/client/src/a.ts', 'export const a = 1;\n');
  write('maps/m.json', '{}\n');
  write('HANDOFF.md', '# notes\n');
  const green = commit('green');
  const reset = () => git('checkout', '-q', '--detach', green);

  it('a docs-only difference skips', () => {
    reset();
    write('HANDOFF.md', '# notes\nmore\n');
    write('docs/NEW.md', 'new doc\n');
    const sha = commit('docs');
    expect(findGreenTwin(sha, [green], { cwd: dir })).toEqual({ sha: green, docs: ['HANDOFF.md', 'docs/NEW.md'] });
  });

  it('a one-line code difference runs', () => {
    reset();
    write('packages/client/src/a.ts', 'export const a = 2;\n');
    write('HANDOFF.md', '# notes\nmore\n');
    const sha = commit('code');
    expect(differingPaths(green, sha, dir)).toEqual(['HANDOFF.md', 'packages/client/src/a.ts']);
    expect(findGreenTwin(sha, [green], { cwd: dir })).toBeNull();
  });

  it('a new file runs', () => {
    reset();
    write('packages/client/src/b.ts', 'export const b = 1;\n');
    expect(findGreenTwin(commit('new file'), [green], { cwd: dir })).toBeNull();
  });

  it('a deleted file runs', () => {
    reset();
    unlinkSync(join(dir, 'maps/m.json'));
    expect(findGreenTwin(commit('deleted file'), [green], { cwd: dir })).toBeNull();
  });

  it('a rename runs, even into docs/', () => {
    reset();
    write('docs/a.ts', 'export const a = 1;\n');
    unlinkSync(join(dir, 'packages/client/src/a.ts'));
    expect(findGreenTwin(commit('rename'), [green], { cwd: dir })).toBeNull();
  });

  it('picks a matching green commit among others; unknown commits are passed over', () => {
    reset();
    write('packages/client/src/a.ts', 'export const a = 3;\n');
    const other = commit('other green');
    reset();
    write('CHANGELOG.md', '# changes\n');
    const sha = commit('docs again');
    expect(findGreenTwin(sha, ['0'.repeat(40), other, green], { cwd: dir })?.sha).toBe(green);
    expect(findGreenTwin(sha, ['0'.repeat(40), other], { cwd: dir })).toBeNull();
  });
});
