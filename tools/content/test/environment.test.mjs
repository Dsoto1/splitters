// The environment generator (tools/content/environment.mjs, docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): it builds
// byte-identical output twice and matches what is shipped; every level of detail is within its budget; collision
// shapes sit inside the visual bounds; the cliff's seam vertices line up across panels and variants; the leaf cards
// cover enough of their rectangles; and nothing in it draws from Math.random.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ROOT, budgetProblems, build, load, validate } from '../environment.mjs';
import { cliffMesh } from '../env/rock.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

describe('environment generator', () => {
  const content = load();
  const { problems, species } = validate(content);
  let first;

  it('the content is valid', () => {
    expect(problems).toEqual([]);
    expect(species.map((s) => s.id).sort()).toEqual(['env.broadleaf.oak', 'env.cliff.face', 'env.conifer.pine_tall', 'env.grass.clump', 'env.rock.boulder_angular', 'env.shrub.broadleaf']);
  });

  it('builds byte-identical output twice, the same as is shipped and locked', async () => {
    first = await build(content, species);
    const second = await build(content, species);
    expect([...second.files.keys()]).toEqual([...first.files.keys()]);
    for (const [file, buf] of first.files) expect(sha(second.files.get(file)), file).toBe(sha(buf));
    expect(second.lock).toBe(first.lock);
    expect(second.shared).toBe(first.shared);
    for (const [file, buf] of first.files) expect(sha(readFileSync(join(ROOT, 'packages/client/public', file))), `${file} is out of date (run node tools/content/environment.mjs)`).toBe(sha(buf));
    expect(readFileSync(join(ROOT, 'content/environment.lock.json'), 'utf8')).toBe(first.lock);
    expect(readFileSync(join(ROOT, 'packages/shared/src/content/environment.generated.ts'), 'utf8')).toBe(first.shared);
    expect(readFileSync(join(ROOT, 'packages/client/src/content/environment.generated.ts'), 'utf8')).toBe(first.client);
  }, 60000);

  it('every level of detail is within its budget and every file within its byte budget', async () => {
    first ??= await build(content, species);
    expect(budgetProblems(content, first)).toEqual([]);
    // The plan's targets: oak 2,800 / 900 / 250, pine 2,400 / 800 / 220, shrub 400 / 120, grass 24–36, boulder 700 / 220 / 60, cliff 2,000 / 600 / 150.
    const tris = Object.fromEntries(first.clientSpecies.map((s) => [s.id, s.triangles]));
    expect(tris['env.grass.clump'][0]).toBeGreaterThanOrEqual(24);
    expect(tris['env.grass.clump'][0]).toBeLessThanOrEqual(36);
    expect(tris['env.broadleaf.oak'][0]).toBeLessThanOrEqual(2800);
    expect(tris['env.conifer.pine_tall'][0]).toBeLessThanOrEqual(2400);
    expect(tris['env.shrub.broadleaf'][0]).toBeLessThanOrEqual(400);
    expect(tris['env.rock.boulder_angular'][0]).toBeLessThanOrEqual(700);
    // Every level is lighter than the one before.
    for (const s of first.clientSpecies) for (let i = 1; i < s.triangles.length; i++) expect(s.triangles[i], s.id).toBeLessThan(s.triangles[i - 1]);
  }, 60000);

  it('the leaf atlas cards cover at least 55 % of their rectangles (alpha-tested pixels, not empty overdraw)', async () => {
    first ??= await build(content, species);
    for (const [k, c] of Object.entries(first.atlas.cards)) expect(c.coverage, k).toBeGreaterThanOrEqual(0.55);
  }, 60000);

  it('cliff panels butt seamlessly: the left edge of one is the right edge of the next, in every variant and level', () => {
    const cliff = species.find((s) => s.id === 'env.cliff.face');
    const g = cliff.generator;
    for (const lod of cliff.lods) {
      const edges = cliff.variants.map((v) => {
        const m = cliffMesh(g.familySeed, g.seed, g, lod, v.look).rock;
        const left = [];
        const right = [];
        for (let i = 0; i < m.vertexCount; i++) {
          const [x, y, z] = [m.P[i * 3], m.P[i * 3 + 1], m.P[i * 3 + 2]];
          // Front-face vertices on the two edges (the side walls have the same x but face sideways).
          if (Math.abs(m.N[i * 3]) > 0.99) continue;
          if (Math.abs(x + g.width / 2) < 1e-9) left.push([y, z, ...m.N.slice(i * 3, i * 3 + 3)]);
          if (Math.abs(x - g.width / 2) < 1e-9) right.push([y, z, ...m.N.slice(i * 3, i * 3 + 3)]);
        }
        const key = (l) => l.map((p) => p.map((v) => v.toFixed(5)).join(',')).sort();
        return { left: key(left), right: key(right) };
      });
      for (const e of edges) {
        expect(e.left.length, `lod ${lod.nx}`).toBeGreaterThan(lod.ny);
        expect(e.left, 'left edge = right edge (same height, depth and normal)').toEqual(e.right);
      }
      expect(edges[1].left).toEqual(edges[0].left);
    }
  });

  it('never uses Math.random (only the seeded generator, tools/content/env/rng.mjs)', () => {
    const dir = join(ROOT, 'tools/content/env');
    for (const f of [...readdirSync(dir).map((n) => join(dir, n)), join(ROOT, 'tools/content/environment.mjs')]) {
      const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
      expect(/Math\.random/.test(code), f).toBe(false);
    }
  });
});
