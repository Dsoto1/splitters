// The site package CI publishes and the Lightsail box installs (tools/ci/client-release.sh package).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const root = new URL('../../../', import.meta.url).pathname;
const script = join(root, 'tools/ci/client-release.sh');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
const tmp = mkdtempSync(join(tmpdir(), 'tt-release-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fakeDist(dir, touch = 0) {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<script type="module" src="/assets/index-abc.js"></script>');
  writeFileSync(join(dir, 'assets', 'index-abc.js'), 'console.log(1)');
  writeFileSync(join(dir, 'assets', 'b.txt'), 'b');
  // Files written at another time, in another order: the package must not change.
  if (touch) execFileSync('touch', ['-d', '2001-01-01', join(dir, 'assets', 'b.txt'), join(dir, 'index.html')]);
}

const pack = (dist, out) => execFileSync('bash', [script, 'package', dist, out], { cwd: root, env: { ...process.env, SHA: sha, VITE_HUB: 'self' } }).toString();

describe('client release package', () => {
  const one = join(tmp, 'one');
  const two = join(tmp, 'two');
  fakeDist(join(tmp, 'dist1'));
  fakeDist(join(tmp, 'dist2'), 1);
  pack(join(tmp, 'dist1'), one);
  pack(join(tmp, 'dist2'), two);
  const name = `tiletrigger-client-${sha}`;

  it('is reproducible: same files, same bytes', () => {
    expect(readFileSync(join(one, `${name}.tar.gz`)).equals(readFileSync(join(two, `${name}.tar.gz`)))).toBe(true);
  });

  it('lists its checksums in sha256sum format, and they match', () => {
    const sums = readFileSync(join(one, `${name}.sha256`), 'utf8').trim().split('\n');
    expect(sums.map((l) => l.replace(/^[0-9a-f]{64} {2}/, ''))).toEqual([`${name}.tar.gz`, `${name}.json`]);
    expect(() => execFileSync('sha256sum', ['--strict', '-c', `${name}.sha256`], { cwd: one, stdio: 'pipe' })).not.toThrow();
  });

  it('describes the build: commit, version, hub, tarball hash', () => {
    const build = JSON.parse(readFileSync(join(one, `${name}.json`), 'utf8'));
    const version = JSON.parse(readFileSync(join(root, 'packages/client/package.json'), 'utf8')).version;
    expect(build).toMatchObject({ name: 'tiletrigger-client', sha, version, hub: 'self', tarball: `${name}.tar.gz`, files: 3 });
    expect(build.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('holds only plain files and folders, owned by root, with relative paths', () => {
    const list = execFileSync('tar', ['-tvzf', join(one, `${name}.tar.gz`)]).toString().trim().split('\n');
    for (const line of list) {
      expect(line[0]).toMatch(/[-d]/);
      expect(line).toMatch(/ 0\/0 /);
      expect(line).toMatch(/ \.\/\S*$/);
    }
  });
});
