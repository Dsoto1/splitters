// The environment generator (tools/content/environment.mjs, docs/PROCEDURAL_ENVIRONMENT_AUDIT.md §10): it matches
// what is shipped and builds byte-identical output twice; every level of detail is within its budget; collision
// shapes sit inside the visual bounds; the cliff's seam vertices line up across panels and variants; the leaf cards
// cover enough of their rectangles; and nothing in it draws from Math.random.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ROOT, budgetProblems, build, load, validate } from '../environment.mjs';
import { cliffMesh } from '../env/rock.mjs';

/** Environment Phase 4, more variety (2026-11-17): species added through the existing generators. */
const PHASE4 = [
  'env.broadleaf.birch', 'env.broadleaf.olive', 'env.conifer.mountain_pine', 'env.conifer.larch', 'env.conifer.cypress',
  'env.shrub.juniper', 'env.shrub.sagebrush', 'env.grass.tall', 'env.grass.tussock', 'env.flower.alpine', 'env.flower.desert',
  'env.cactus.barrel', 'env.succulent.agave', 'env.rock.boulder_shard', 'env.rock.sandstone', 'env.cliff.sandstone', 'env.cliff.crag',
];
/** Environment Phase 5, the jungle set. */
const PHASE5 = ['env.broadleaf.jungle', 'env.fern.tree_fern', 'env.shrub.elephant_ear'];
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

describe('environment generator', () => {
  const content = load();
  const { problems, species } = validate(content);
  let first;

  it('the content is valid', () => {
    expect(problems).toEqual([]);
    expect(species.map((s) => s.id).sort()).toEqual(['env.broadleaf.acacia', 'env.broadleaf.maple', 'env.broadleaf.oak', 'env.cactus.saguaro', 'env.cliff.face', 'env.conifer.pine_tall', 'env.conifer.spruce', 'env.deadwood.log', 'env.fern.bracken', 'env.flower.meadow', 'env.grass.clump', 'env.hedge.privet', 'env.hedge.yew', 'env.palm.coconut', 'env.palm.leaning', 'env.rock.boulder_angular', 'env.rock.boulder_round', 'env.rock.outcrop', 'env.rock.pebbles', 'env.rock.slab', 'env.shrub.broadleaf', 'env.shrub.laurel', 'env.water.eelgrass', ...PHASE4, ...PHASE5].sort());
  });

  // The two builds are two tests: one test under one budget for both, a busy machine took 64 s against its 60.
  it('builds the same as is shipped and locked', async () => {
    first = await build(content, species);
    for (const [file, buf] of first.files) expect(sha(readFileSync(join(ROOT, 'packages/client/public', file))), `${file} is out of date (run node tools/content/environment.mjs)`).toBe(sha(buf));
    expect(readFileSync(join(ROOT, 'content/environment.lock.json'), 'utf8')).toBe(first.lock);
    expect(readFileSync(join(ROOT, 'packages/shared/src/content/environment.generated.ts'), 'utf8')).toBe(first.shared);
    expect(readFileSync(join(ROOT, 'packages/client/src/content/environment.generated.ts'), 'utf8')).toBe(first.client);
  }, 60000);

  it('builds byte-identical output twice', async () => {
    first ??= await build(content, species);
    const second = await build(content, species);
    expect([...second.files.keys()]).toEqual([...first.files.keys()]);
    for (const [file, buf] of first.files) expect(sha(second.files.get(file)), file).toBe(sha(buf));
    expect(second.lock).toBe(first.lock);
    expect(second.shared).toBe(first.shared);
    expect(second.client).toBe(first.client);
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
    // The round boulder, the slab and the outcrop (three masses in one) keep to the boulder's targets; the fallen log is lighter.
    for (const id of ['env.rock.boulder_round', 'env.rock.slab', 'env.rock.outcrop']) expect(tris[id][0], id).toBeLessThanOrEqual(760);
    expect(tris['env.deadwood.log'][0]).toBeLessThanOrEqual(460);
    // The plants brush's flowers and fern: no heavier than the Kenney pieces they replace (76 and 32-44 triangles).
    expect(tris['env.flower.meadow'][0]).toBeLessThanOrEqual(40);
    expect(tris['env.fern.bracken'][0]).toBeLessThanOrEqual(64);
    // Pebbles and eelgrass: light enough to grow by the thousand (Kenney's stones 16, the Meshy eelgrass 751).
    expect(tris['env.rock.pebbles'][0]).toBeLessThanOrEqual(64);
    expect(tris['env.water.eelgrass'][0]).toBeLessThanOrEqual(64);
    // Phase 4: the new ground cover grows by the thousand like the clump (<= 64); the new bushes are no heavier than the
    // laurel, the new trees than the oak and the cypress (a packed column) within the tree budget.
    for (const id of ['env.grass.tall', 'env.grass.tussock', 'env.flower.alpine', 'env.flower.desert', 'env.succulent.agave']) expect(tris[id].length === 1 && tris[id][0] <= 64, id).toBe(true);
    for (const id of ['env.shrub.juniper', 'env.shrub.sagebrush']) expect(tris[id][0], id).toBeLessThanOrEqual(500);
    for (const id of ['env.broadleaf.birch', 'env.broadleaf.olive', 'env.conifer.mountain_pine', 'env.conifer.larch']) expect(tris[id][0], id).toBeLessThanOrEqual(2800);
    // Every new species has the levels of detail and far stand-in (the crossed cards) of its kind (a new kind: of its category).
    const render = Object.fromEntries(first.clientSpecies.map((s) => [s.id, s]));
    for (const id of PHASE4) {
      const s = species.find((x) => x.id === id);
      const kin = species.find((x) => x.generator.kind === s.generator.kind && !PHASE4.includes(x.id)) ?? species.find((x) => x.category === s.category && !PHASE4.includes(x.id));
      expect(!!s.impostor, id).toBe(!!kin.impostor);
      expect(render[id].lods.length, id).toBe(render[kin.id].lods.length);
    }
    // Every level is lighter than the one before.
    for (const s of first.clientSpecies) for (let i = 1; i < s.triangles.length; i++) expect(s.triangles[i], s.id).toBeLessThan(s.triangles[i - 1]);
  }, 60000);

  it('Phase 5, the jungle set: the tree fern wears fern fronds, the jungle tree hangs lianas, the elephant ear is vertex colour only', async () => {
    first ??= await build(content, species);
    const tris = Object.fromEntries(first.clientSpecies.map((s) => [s.id, s.triangles]));
    const g = (id) => species.find((s) => s.id === id).generator;
    // The jungle tree without its lianas is lighter: they are drawn (bark ropes and leaf cards), at every level.
    const jungle = species.find((s) => s.id === 'env.broadleaf.jungle');
    const bare = await build(content, [{ ...jungle, generator: { ...jungle.generator, vines: undefined } }]);
    tris['env.broadleaf.jungle'].slice(0, 3).forEach((t, i) => expect(t, `level ${i}`).toBeGreaterThan(bare.clientSpecies[0].triangles[i]));
    expect(g('env.fern.tree_fern').frondCards).toEqual(['fern.0']);
    expect(first.files.has('env/shrub.elephant_ear.green.glb')).toBe(true);
    expect(tris['env.shrub.elephant_ear'].length).toBe(3);
  }, 120000);

  it('the leaf atlas cards cover at least 55 % of their rectangles (alpha-tested pixels, not empty overdraw)', async () => {
    first ??= await build(content, species);
    for (const [k, c] of Object.entries(first.atlas.cards)) expect(c.coverage, k).toBeGreaterThanOrEqual(0.55);
  }, 60000);

  it('cliff panels butt seamlessly: the left edge of one is the right edge of the next, in every family, variant and level', () => {
    const cliffs = species.filter((s) => s.category === 'cliff');
    expect(cliffs.map((s) => s.id).sort()).toEqual(['env.cliff.crag', 'env.cliff.face', 'env.cliff.sandstone']);
    // Each cliff species is its own family (its own edge profile and ledges).
    expect(new Set(cliffs.map((s) => s.generator.familySeed)).size).toBe(cliffs.length);
    for (const cliff of cliffs) {
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
