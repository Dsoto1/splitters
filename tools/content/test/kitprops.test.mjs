// The kit-prop generator (tools/content/kitprops.mjs, docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): it builds
// byte-identical output twice and matches what is shipped; every level is within its budget, and from the first
// lighter level on no heavier than the prop an alias replaces; every level of every variant stays inside its family's
// box and level 0 fills it (the box is its collision, unless the family has none: a traffic cone); variants of a family are different models; the aliases keep the
// retired props' sizes; and nothing in it draws from Math.random.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KINDS, ROOT, budgetProblems, build, load, sizesOf, validate } from '../kitprops.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

describe('kit-prop generator', () => {
  const content = load();
  const { problems, families } = validate(content);
  let first;

  it('the content is valid', () => {
    expect(problems).toEqual([]);
    expect(families.map((f) => f.id).sort()).toEqual(['kit.appliance.freezer_chest', 'kit.appliance.freezer_upright', 'kit.appliance.fridge', 'kit.appliance.stove', 'kit.appliance.washer', 'kit.barrier.concrete', 'kit.bed.bunk', 'kit.bed.double', 'kit.bin.waste', 'kit.bookcase.tall', 'kit.bookcase.wide', 'kit.box.carton', 'kit.cabinet.kitchen', 'kit.cabinet.media', 'kit.console.panel', 'kit.container.shipping', 'kit.conveyor.belt', 'kit.crate.bin', 'kit.crate.factory', 'kit.crate.factory_long', 'kit.crate.framed', 'kit.crate.wood', 'kit.crate.wood_long', 'kit.drum.steel', 'kit.drum.steel_open', 'kit.fence.board', 'kit.fence.iron', 'kit.fence.iron_broken', 'kit.fence.palisade', 'kit.fence.rail', 'kit.fence.town', 'kit.hopper.round', 'kit.hopper.tall', 'kit.machine.cog', 'kit.machine.heavy', 'kit.machine.lever', 'kit.machine.piston', 'kit.machine.scanner', 'kit.machine.window', 'kit.pipe.coolant', 'kit.pipe.glass', 'kit.pipe.junction', 'kit.pipe.riser', 'kit.pipe.valve', 'kit.seat.bench', 'kit.seat.chair', 'kit.seat.chair_cushion', 'kit.seat.office', 'kit.shelf.end', 'kit.shelf.gondola', 'kit.shelf.gondola_snack', 'kit.shop.bakery_stand', 'kit.shop.bottle_return', 'kit.shop.cart', 'kit.shop.checkout', 'kit.shop.produce_stand', 'kit.sign.cone', 'kit.sign.cone_slim', 'kit.sign.warning', 'kit.sofa.armchair', 'kit.sofa.corner', 'kit.sofa.two_seat', 'kit.stall.counter', 'kit.stall.market', 'kit.table.console', 'kit.table.desk', 'kit.table.dining', 'kit.table.round', 'kit.table.workbench', 'kit.tool.anvil', 'kit.wall.stone', 'kit.wall.stone_broken']);
  });

  it('builds byte-identical output twice, the same as is shipped and locked', async () => {
    first = await build(content, families);
    const second = await build(content, families);
    expect([...second.files.keys()]).toEqual([...first.files.keys()]);
    for (const [file, buf] of first.files) expect(sha(second.files.get(file)), file).toBe(sha(buf));
    expect(second.lock).toBe(first.lock);
    expect(second.shared).toBe(first.shared);
    for (const [file, buf] of first.files) expect(sha(readFileSync(join(ROOT, 'packages/client/public', file))), `${file} is out of date (run node tools/content/kitprops.mjs)`).toBe(sha(buf));
    expect(readFileSync(join(ROOT, 'content/kitprops.lock.json'), 'utf8')).toBe(first.lock);
    expect(readFileSync(join(ROOT, 'packages/shared/src/content/kitProps.generated.ts'), 'utf8')).toBe(first.shared);
  }, 60000);

  it('keeps every budget: per level, per file, against the props it replaces, and the aliases keep their sizes', async () => {
    first ??= await build(content, families);
    expect(budgetProblems(content, first)).toEqual([]);
    for (const r of first.render) for (let i = 1; i < r.triangles.length; i++) expect(r.triangles[i], r.id).toBeLessThan(r.triangles[i - 1]);
  }, 60000);

  it('every level of every variant stays inside its family\'s box, and level 0 fills it', () => {
    for (const f of families) {
      const [w, h, d] = f.size;
      for (const v of f.variants) {
        const g = { ...f.generator, ...(v.set ?? {}) };
        f.lods.forEach((_, level) => {
          const [lo, hi] = KINDS[g.kind](v.seed, f.size, g, v.look, level).bounds();
          const where = `${f.id}#${v.name} level ${level}`;
          expect(lo[0], where).toBeGreaterThanOrEqual(-w / 2 - 0.001);
          expect(lo[1], where).toBeGreaterThanOrEqual(-0.001);
          expect(lo[2], where).toBeGreaterThanOrEqual(-d / 2 - 0.001);
          expect(hi[0], where).toBeLessThanOrEqual(w / 2 + 0.001);
          expect(hi[1], where).toBeLessThanOrEqual(h + 0.001);
          expect(hi[2], where).toBeLessThanOrEqual(d / 2 + 0.001);
          if (level === 0) for (const [a, b] of [[lo[0], -w / 2], [lo[2], -d / 2], [hi[0], w / 2], [hi[1], h], [hi[2], d / 2], [lo[1], 0]]) expect(Math.abs(a - b), where).toBeLessThan(0.002);
        });
      }
    }
  });

  it('a family\'s variants are different models (structure or look), each seed its own', async () => {
    first ??= await build(content, families);
    for (const r of first.render) expect(new Set(r.variants.map((v) => sha(first.files.get(v.file)))).size, r.id).toBe(r.variants.length);
    const seeds = families.flatMap((f) => f.variants.map((v) => v.seed));
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('each alias\'s family has the retired prop\'s size', () => {
    const sizes = sizesOf();
    for (const [from, a] of Object.entries(content.manifest.aliases)) {
      const f = families.find((x) => x.id === a.model);
      expect(f.size.map((s) => Math.round(s * a.scale * 1000) / 1000), from).toEqual(sizes.get(from));
    }
  });

  it('never uses Math.random (seeded streams only)', () => {
    const dir = join(ROOT, 'tools/content/kit');
    for (const f of [...readdirSync(dir).map((x) => join(dir, x)), join(ROOT, 'tools/content/kitprops.mjs')]) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Math\.random/);
  });
});
