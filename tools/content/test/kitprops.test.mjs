// The kit-prop generator (tools/content/kitprops.mjs, docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): it builds
// byte-identical output twice and matches what is shipped; every level is within its budget, and from the first
// lighter level on no heavier than the prop an alias replaces; every level of every variant stays inside its family's
// box and level 0 fills it (the box is its collision, unless the family has none: a traffic cone; a part of the dome
// kit, drawn where it stands on its drum, stays inside its box and need not fill it); the dome kit's parts share one
// axis, are hollow and keep their openings open (the closed domes are solid all through instead); variants of a family are different models; the aliases keep the
// retired props' sizes; and nothing in it draws from Math.random.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KINDS, ROOT, budgetProblems, build, load, sizesOf, validate } from '../kitprops.mjs';
import { domeDims } from '../kit/dome.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

describe('kit-prop generator', () => {
  const content = load();
  const { problems, families } = validate(content);
  let first;

  it('the content is valid', () => {
    expect(problems).toEqual([]);
    expect(families.map((f) => f.id).sort()).toEqual(['kit.appliance.freezer_chest', 'kit.appliance.freezer_upright', 'kit.appliance.fridge', 'kit.appliance.stove', 'kit.appliance.washer', 'kit.barrier.concrete', 'kit.bed.bunk', 'kit.bed.double', 'kit.bin.waste', 'kit.bookcase.tall', 'kit.bookcase.wide', 'kit.box.carton', 'kit.cabinet.closet', 'kit.cabinet.kitchen', 'kit.cabinet.media', 'kit.console.panel', 'kit.container.shipping', 'kit.conveyor.belt', 'kit.crate.bin', 'kit.crate.factory', 'kit.crate.factory_long', 'kit.crate.framed', 'kit.crate.wood', 'kit.crate.wood_long', 'kit.dome.arch_2way', 'kit.dome.arch_3way', 'kit.dome.arch_4way', 'kit.dome.cap', 'kit.dome.closed_12', 'kit.dome.closed_8', 'kit.dome.drum_arch', 'kit.dome.drum_solid', 'kit.dome.drum_window', 'kit.dome.hall_12', 'kit.dome.hall_8', 'kit.dome.hall_ruin_12', 'kit.dome.panel_12', 'kit.dome.panel_12_broken', 'kit.dome.panel_12_window', 'kit.dome.panel_4', 'kit.dome.panel_4_broken', 'kit.dome.panel_4_window', 'kit.dome.panel_6', 'kit.dome.panel_6_broken', 'kit.dome.panel_6_window', 'kit.dome.panel_8', 'kit.dome.panel_8_broken', 'kit.dome.panel_8_window', 'kit.dome.ruin_12', 'kit.dome.ruin_8', 'kit.dome.trim_bottom', 'kit.dome.trim_middle', 'kit.dome.trim_top', 'kit.dome.whole_12', 'kit.dome.whole_8', 'kit.door.oak', 'kit.door.oak_ajar', 'kit.door.oak_open', 'kit.drum.steel', 'kit.drum.steel_open', 'kit.fence.board', 'kit.fence.iron', 'kit.fence.iron_broken', 'kit.fence.palisade', 'kit.fence.rail', 'kit.fence.town', 'kit.hopper.round', 'kit.hopper.tall', 'kit.machine.cog', 'kit.machine.heavy', 'kit.machine.lever', 'kit.machine.piston', 'kit.machine.scanner', 'kit.machine.window', 'kit.pipe.coolant', 'kit.pipe.glass', 'kit.pipe.junction', 'kit.pipe.riser', 'kit.pipe.valve', 'kit.seat.bench', 'kit.seat.chair', 'kit.seat.chair_cushion', 'kit.seat.office', 'kit.shelf.end', 'kit.shelf.gondola', 'kit.shelf.gondola_snack', 'kit.shop.bakery_stand', 'kit.shop.bottle_return', 'kit.shop.cart', 'kit.shop.checkout', 'kit.shop.produce_stand', 'kit.sign.cone', 'kit.sign.cone_slim', 'kit.sign.warning', 'kit.sofa.armchair', 'kit.sofa.corner', 'kit.sofa.two_seat', 'kit.stall.counter', 'kit.stall.market', 'kit.table.console', 'kit.table.desk', 'kit.table.desk_hutch', 'kit.table.dining', 'kit.table.round', 'kit.table.workbench', 'kit.tool.anvil', 'kit.wall.stone', 'kit.wall.stone_broken']);
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
          // A part drawn where it stands in a larger build (bounds: "within": the dome kit) need not fill its box.
          if (level === 0 && f.bounds !== 'within') for (const [a, b] of [[lo[0], -w / 2], [lo[2], -d / 2], [hi[0], w / 2], [hi[1], h], [hi[2], d / 2], [lo[1], 0]]) expect(Math.abs(a - b), where).toBeLessThan(0.002);
        });
      }
    }
  });

  it('the dome kit\'s parts share one axis and one drum: placed at one point they make the whole dome', () => {
    const dome = (name) => families.find((f) => f.id === `kit.dome.${name}`);
    const mesh = (f, level = 0) => KINDS[f.generator.kind](f.variants[0].seed, f.size, f.generator, f.variants[0].look, level);
    const parts = families.filter((f) => f.type === 'dome' && f.bounds === 'within');
    expect(parts.map((f) => f.id)).toEqual(families.filter((f) => f.type === 'dome' && !/\.(arch_|whole_|closed_|hall_|ruin_)/.test(f.id)).map((f) => f.id));
    // Parts collide as their own boxes, or (the trims) not at all; none is breakable.
    for (const f of parts) expect(!!mesh(f).boxes?.length, f.id).toBe(f.collide !== 'none');
    // The whole dome's box holds every part where it stands: no part reaches outside the dome it belongs to.
    const [w, h] = dome('whole_8').size;
    for (const f of parts) {
      const [lo, hi] = mesh(f).bounds();
      expect(Math.hypot(Math.max(-lo[0], hi[0]), 0), f.id).toBeLessThanOrEqual(w / 2 + 0.001);
      expect(Math.max(-lo[2], hi[2]), f.id).toBeLessThanOrEqual(w / 2 + 0.001);
      expect(hi[1], f.id).toBeLessThanOrEqual(h + 0.001);
    }
    // A panel of n segments lies within its own sector (360° / n wide, centred on +z), so n of them, each turned
    // 360° / n on, meet edge to edge; MapMaker turns props in 15° steps, and every sector is a multiple of that.
    for (const n of [4, 6, 8, 12]) {
      expect((360 / n) % 15).toBe(0);
      for (const kind of ['', '_window', '_broken']) {
        const m = mesh(dome(`panel_${n}${kind}`));
        for (let i = 0; i < m.P.length; i += 3) expect(Math.abs(Math.atan2(m.P[i], m.P[i + 2])), `panel_${n}${kind}`).toBeLessThanOrEqual(Math.PI / n + 1e-6);
      }
    }
    // The drum's quarters lie within a quarter turn; the panels spring from the drum's top, the cap sits on the crown.
    for (const kind of ['arch', 'window', 'solid']) {
      const m = mesh(dome(`drum_${kind}`));
      for (let i = 0; i < m.P.length; i += 3) expect(Math.abs(Math.atan2(m.P[i], m.P[i + 2])), kind).toBeLessThanOrEqual(Math.PI / 4 + 0.04);
      expect(m.bounds()[1][1]).toBeCloseTo(dome('drum_arch').size[1], 3);
    }
    expect(mesh(dome('panel_8')).bounds()[0][1]).toBeCloseTo(dome('drum_arch').size[1], 3);
    expect(mesh(dome('cap')).bounds()[1][1]).toBeCloseTo(h, 2);
  });

  it('the dome kit is hollow and its openings are open', () => {
    const boxes = (name) => {
      const f = families.find((x) => x.id === `kit.dome.${name}`);
      return KINDS[f.generator.kind](f.variants[0].seed, f.size, f.generator, f.variants[0].look, 0).boxes ?? [];
    };
    /** Whether a player (0.4 m round, as a square) or a shot (r 0) at the point meets a box. */
    const hit = (b, x, y, z, r = 0) => b.some((q) => x > q[0] - r && x < q[3] + r && y > q[1] && y < q[4] && z > q[2] - r && z < q[5] + r);
    const at = (deg, r) => [Math.sin((deg * Math.PI) / 180) * r, Math.cos((deg * Math.PI) / 180) * r];
    for (const name of ['whole_8', 'whole_12', 'hall_8', 'hall_12', 'ruin_8', 'ruin_12', 'hall_ruin_12']) {
      const b = boxes(name);
      const f = families.find((x) => x.id === `kit.dome.${name}`);
      const R = f.size[0] / 2;
      // Room to stand anywhere within 2 m of the axis, and to walk out through the first doorway (bay 0).
      for (const [x, z] of [[0, 0], [1.5, 0], [0, -1.5], [-1.4, 1.4]]) for (const y of [0.05, 0.9, 1.75]) expect(hit(b, x, y, z, 0.4), name).toBe(false);
      const door = 180 / f.generator.bays;
      for (let r = 0; r <= R + 1; r += 0.05) for (const y of [0.05, 0.9, 1.75]) expect(hit(b, ...[at(door, r)[0], y, at(door, r)[1]], 0.4), `${name} doorway at ${r}`).toBe(false);
      // The wall between two doorways is solid, and so is the shell over an unbroken panel (panel 0, on +z).
      const D = domeDims(f.generator);
      expect(hit(b, at(3, D.wallR - D.wallT / 2)[0], 1, at(3, D.wallR - D.wallT / 2)[1]), name).toBe(true);
      expect(hit(b, 0.05, D.drumH + (D.rise - D.shellT / 2) * Math.sin(Math.PI / 4), (D.shellR - D.shellT / 2) * Math.cos(Math.PI / 4)), name).toBe(true);
    }
    // A ruin is open to the sky where its panels are gone (ruin_8: panel 2, at 90°), a whole dome is not.
    const sky = (name) => {
      const f = families.find((x) => x.id === `kit.dome.${name}`);
      const D = domeDims(f.generator);
      const b = boxes(name);
      let open = true;
      for (let y = D.drumH + 0.3; y < f.size[1] + 1; y += 0.05) if (hit(b, D.shellR * 0.55, y, 0)) open = false;
      return open;
    };
    expect(sky('ruin_8')).toBe(true);
    expect(sky('whole_8')).toBe(false);
    // The closed domes (roof domes) are not hollow: solid at the centre and all the way out along every bay and pier,
    // no doorway to walk or shoot into; the same size and looks as the whole dome, in a few boxes that stay inside
    // the visible shape (the drum's within its trims' reach; a shot never stops in thin air over the dome) and close to it.
    for (const n of [8, 12]) {
      const name = `closed_${n}`;
      const f = families.find((x) => x.id === `kit.dome.${name}`);
      const whole = families.find((x) => x.id === `kit.dome.whole_${n}`);
      const b = boxes(name);
      const D = domeDims(f.generator);
      expect(f.size).toEqual(whole.size);
      expect(f.variants.map((v) => [v.index, v.name, v.look])).toEqual(whole.variants.map((v) => [v.index, v.name, v.look]));
      expect(b.length, name).toBeLessThanOrEqual(30);
      expect(hit(b, 0, 1, 0), name).toBe(true);
      for (const y of [0.05, 0.9, 1.75, D.drumH + 1, D.shellTop - 0.05]) expect(hit(b, 0, y, 0), `${name} centre at ${y}`).toBe(true);
      for (let deg = 0; deg < 360; deg += 7.5) {
        for (let r = 0; r <= D.wallR - D.wallT - 0.02; r += 0.05) for (const y of [0.05, 0.9, 1.75]) expect(hit(b, at(deg, r)[0], y, at(deg, r)[1]), `${name} at ${deg}°, ${r}`).toBe(true);
        // (Solid to where the wall's inner face would be, at the least.) A shot stops within 0.22 m of the wall's face,
        // never outside the trims' reach.
        expect(hit(b, at(deg, D.wallR - 0.22)[0], 0.9, at(deg, D.wallR - 0.22)[1]), `${name} at ${deg}°`).toBe(true);
        expect(hit(b, at(deg, D.R)[0], 0.9, at(deg, D.R)[1]), `${name} at ${deg}°`).toBe(false);
        expect(hit(b, at(deg, D.wallR - D.wallT)[0], 0.9, at(deg, D.wallR - D.wallT)[1], 0.4), `${name} at ${deg}°`).toBe(true);
      }
      // Every box is inside the drum's wall or the shell's outside, and the shell has collision close under it.
      for (const q of b) for (const x of [q[0], q[3]]) for (const z of [q[2], q[5]]) {
        const r = Math.hypot(x, z);
        const limit = q[4] <= D.drumH + 1e-6 ? D.R - 0.05 : q[1] >= D.shellTop - 1e-6 ? D.capR : D.shellR * Math.sqrt(Math.max(0, 1 - ((q[4] - D.drumH) / D.rise) ** 2));
        expect(r, name).toBeLessThanOrEqual(limit + 0.001);
      }
      for (let fdeg = 5; fdeg <= 80; fdeg += 5) for (let deg = 0; deg < 360; deg += 15) {
        const fr = (fdeg * Math.PI) / 180;
        const [x, z] = at(deg, (D.shellR - 0.75) * Math.cos(fr));
        expect(hit(b, x, D.drumH + (D.rise - 0.75) * Math.sin(fr), z), `${name} shell at ${fdeg}°, ${deg}°`).toBe(true);
      }
    }
    // The drum's quarters: doorways a player walks through, windows a shot passes (a player does not), a solid wall.
    for (const [kind, walk, shoot] of [['arch', true, true], ['window', false, true], ['solid', false, false]]) {
      const b = boxes(`drum_${kind}`);
      let walked = true;
      let shot = true;
      for (let r = 2.4; r <= 4.6; r += 0.05) {
        const [x, z] = at(22.5, r);
        if (hit(b, x, 0.9, z, 0.4)) walked = false;
        if (hit(b, x, 1.2, z)) shot = false;
      }
      expect([kind, walked, shot]).toEqual([kind, walk, shoot]);
      expect(hit(b, 0, 1, 0, 0.4), kind).toBe(false);
    }
    // A window panel passes a shot through its window; the plain panel stops it.
    const D = domeDims({});
    const f = (25 * Math.PI) / 180;
    const through = (name) => {
      for (let off = -0.3; off <= 0.6; off += 0.02) if (hit(boxes(name), 0, D.drumH + (D.rise - off) * Math.sin(f), (D.shellR - off) * Math.cos(f))) return false;
      return true;
    };
    expect(through('panel_8_window')).toBe(true);
    expect(through('panel_8')).toBe(false);
    // Arch transitions: walk through every open side, a wall in a closed one, the top solid over all of it.
    for (const [name, open] of [['arch_4way', '1111'], ['arch_3way', '1101'], ['arch_2way', '1010']]) {
      const b = boxes(name);
      [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dz], i) => {
        let clear = true;
        for (let r = 0; r <= 5; r += 0.05) for (const y of [0.05, 0.9, 1.75]) for (const s of [-2, 0, 2]) if (hit(b, dx * r + dz * s, y, dz * r + dx * s, 0.4)) clear = false;
        expect(clear, `${name} side ${i}`).toBe(open[i] === '1');
      });
      for (const [x, z] of [[0, 0], [3.9, 3.9], [-3.9, 0], [2, -3]]) expect(hit(b, x, 3.95, z), name).toBe(true);
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
