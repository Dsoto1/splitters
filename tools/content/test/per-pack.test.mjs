// Prop packs one file each (props-manifest.mjs) and lock files in the stable format (lockfile.mjs).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPropManifest } from '../props-manifest.mjs';
import { formatLock, readLock } from '../lockfile.mjs';

const pack = (title) => ({ title, creator: 'Us', license: 'Owned', licenseFile: 'x/License.txt' });
function packsDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'props-'));
  mkdirSync(join(dir, 'props'));
  for (const [id, data] of Object.entries(files)) writeFileSync(join(dir, 'props', `${id}.json`), JSON.stringify(data));
  writeFileSync(join(dir, 'props.json'), JSON.stringify({ budgets: { maxTriangles: 1 } }));
  return [join(dir, 'props'), join(dir, 'props.json')];
}

describe('prop packs', () => {
  it('orders props by order, then pack id, then place in the file; a prop with an order starts a run there', () => {
    const [dir, settings] = packsDir({
      b: { pack: pack('B'), order: 10, props: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3', order: 30 }, { id: 'b4' }] },
      a: { pack: pack('A'), order: 20, props: [{ id: 'a1' }] },
      c: { pack: pack('C'), order: 20, props: [{ id: 'c1' }] },
    });
    const m = loadPropManifest(dir, settings);
    expect(m.props.map((p) => p.id)).toEqual(['b1', 'b2', 'a1', 'c1', 'b3', 'b4']);
    expect(m.props[0]).toEqual({ id: 'b1', pack: 'b' });
    expect(m.props[4]).toEqual({ id: 'b3', pack: 'b' });
    expect(Object.keys(m.packs).sort()).toEqual(['a', 'b', 'c']);
    expect(m.budgets).toEqual({ maxTriangles: 1 });
  });

  it('refuses a prop in two packs, a prop naming its pack, and orders going down', () => {
    expect(() => loadPropManifest(...packsDir({ a: { pack: pack('A'), order: 1, props: [{ id: 'x' }] }, b: { pack: pack('B'), order: 2, props: [{ id: 'x' }] } }))).toThrow(/both/);
    expect(() => loadPropManifest(...packsDir({ a: { pack: pack('A'), order: 1, props: [{ id: 'x', pack: 'a' }] } }))).toThrow(/names a pack/);
    expect(() => loadPropManifest(...packsDir({ a: { pack: pack('A'), order: 5, props: [{ id: 'x' }, { id: 'y', order: 4 }] } }))).toThrow(/only go up/);
  });

  it('keeps the props of the real packs in the order the prop table lists them', () => {
    const generated = readFileSync(new URL('../../../packages/shared/src/content/props.generated.ts', import.meta.url), 'utf8');
    const ids = [...generated.matchAll(/^ {2}\{id: 'prop\.([^']+)'/gm)].map((x) => x[1]);
    expect(loadPropManifest().props.map((p) => p.id)).toEqual(ids);
  });
});

describe('lock files', () => {
  const a = { file: 'props/a.glb', sha256: '1' };
  const b = { file: 'props/b.glb', sha256: '2' };
  const c = { file: 'props/c.glb', sha256: '3' };

  it('writes entries sorted by file, one a line', () => {
    expect(formatLock({ $comment: 'x', files: [c, a] })).toBe(`{\n  "$comment": "x",\n  "files": [\n    ${JSON.stringify(a)},\n    ${JSON.stringify(c)}\n  ]\n}\n`);
  });

  it('settles a merge conflict by keeping both sides', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lock-'));
    const ours = formatLock({ $comment: 'x', files: [a, b] }).split('\n');
    const theirs = formatLock({ $comment: 'x', files: [a, c] }).split('\n');
    // a is the same on both sides; the next line differs.
    const text = [...ours.slice(0, 4), '<<<<<<< HEAD', ours[4], '=======', theirs[4], '>>>>>>> other', ...ours.slice(5)].join('\n');
    writeFileSync(join(dir, 'x.lock.json'), text);
    expect(readLock(join(dir, 'x.lock.json'))).toEqual({ $comment: 'x', files: [a, b, c] });
  });
});
