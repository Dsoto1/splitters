import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OPTICS_TS, buildOptics, fitMount, magOf, opticsSource, readOpticsFile } from '../optics.mjs';
import { readWeapons } from '../sight-fit.mjs';

/** A box as triangles: [x0, x1], [y0, y1], [z0, z1] (metres; +Z the barrel, +Y up). */
function box([x0, x1], [y0, y1], [z0, z1]) {
  const p = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  return quads.flatMap(([a, b, c, d]) => [[p(a), p(b), p(c)], [p(a), p(c), p(d)]]);
}
const GLASS = { rise: 0.034, half: [0.017, 0.017], length: 0.058 };
const HOLD = { grip: [0, 0, -0.1], muzzle: [0, 0.03, 0.375], glass: GLASS };

describe('optics by gun: the table and the mounts', () => {
  it('a housing stands on the rearmost flat stretch of the top, from the hand forward, sized to the gun', () => {
    // A 0.75 m gun with a flat top at 0.05.
    const m = fitMount(box([-0.02, 0.02], [0, 0.05], [-0.375, 0.375]), HOLD);
    expect(m.scale).toBe(1);
    expect(m.blocked).toBeUndefined();
    expect(m.at[1]).toBeCloseTo(0.05, 3);
    expect(m.at[2]).toBeCloseTo(-0.1, 2);
    // A shorter gun carries a smaller housing, within limits.
    expect(fitMount(box([-0.02, 0.02], [0, 0.05], [-0.2, 0.2]), { ...HOLD, muzzle: [0, 0.03, 0.2] }).scale).toBe(0.85);
  });

  it('it moves forward onto a higher part of the gun that would stand in its window', () => {
    // The top steps up 4 cm from z = 0.05: a housing behind the step would look at it.
    const m = fitMount([...box([-0.02, 0.02], [0, 0.05], [-0.375, 0.375]), ...box([-0.02, 0.02], [0.05, 0.09], [0.05, 0.375])], HOLD);
    expect(m.blocked).toBeUndefined();
    expect(m.at[1]).toBeCloseTo(0.09, 3);
    expect(m.at[2]).toBeGreaterThan(0.05);
  });

  it('the table is up to date and the data has no problems', async () => {
    const result = await buildOptics();
    expect(result.problems).toEqual([]);
    expect(opticsSource(result)).toBe(readFileSync(OPTICS_TS, 'utf8'));
  });

  it('a new weapon without an entry fails with a message that says what to do', async () => {
    const file = readOpticsFile();
    delete file.weapons['core.pistol'];
    const { problems } = await buildOptics(file);
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/^core\.pistol \(Pistol\) has no optic: give it one in content\/optics\.json/);
    expect(problems[0]).toContain('sight sheet');
  });

  it('a zoom outside its kind, a missing sight fit and a stray entry are named', async () => {
    const file = readOpticsFile();
    file.weapons['core.marksman'] = { default: 'sniper', allowed: ['sniper'] };
    file.weapons['core.lmg'] = { default: 'irons', allowed: ['irons'] };
    delete file.none['core.lmg'];
    file.none['core.knife'] = 'a knife has no sights at all';
    const { problems } = await buildOptics(file);
    expect(problems.some((p) => /core\.marksman: its zoom \(2\.19x\) is outside a sniper's/.test(p))).toBe(true);
    expect(problems.some((p) => /core\.lmg: iron sights need a sight fit/.test(p))).toBe(true);
    expect(problems.some((p) => /core\.knife needs no entry/.test(p))).toBe(true);
  });

  it('a scope\'s zoom is the weapon file\'s own', async () => {
    const { weapons } = await buildOptics();
    for (const w of readWeapons()) {
      if (w.view?.zoomFov) expect(weapons[w.id].mag).toBeCloseTo(magOf(w.view.zoomFov), 2);
      if (w.view?.optic) expect(weapons[w.id].mag).toBe(w.view.optic.mag);
    }
  });
});
