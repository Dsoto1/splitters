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

  it('zoom steps and scope feel are checked: the first step is the gun\'s own zoom, the model\'s tube has one', async () => {
    const good = await buildOptics();
    expect(good.weapons['core.marksman'].steps).toEqual([1, 0.45]);
    expect(good.weapons['core.sniper'].steps).toBeUndefined();
    expect(good.kinds.sniper.steps).toEqual([1, 0.45]);
    expect(opticsSource(good)).toContain('export const SCOPE_FEEL = { sway: 0.0035, swayHeld: 0.12, swaySpent: 2.2, settle: 0.15, breathSeconds: 3.5, recoverSeconds: 4, readyAt: 0.5 } as const;');
    const file = readOpticsFile();
    file.weapons['core.sniper'].steps = [0.8, 0.45];
    file.weapons['core.railgun'].steps = [1, 0.5, 0.6];
    file.weapons['core.battle_rifle'].steps = [1, 0.5];
    file.weapons['core.pistol'].steps = [1];
    file.kinds.irons.steps = [1];
    file.feel.breathSeconds = 0;
    delete file.feel.sway;
    const { problems } = await buildOptics(file);
    expect(problems.some((p) => /core\.sniper: `steps` are its zoom steps/.test(p))).toBe(true);
    expect(problems.some((p) => /core\.railgun: `steps` are its zoom steps/.test(p))).toBe(true);
    expect(problems.some((p) => /core\.battle_rifle: the model's own tube has one zoom/.test(p))).toBe(true);
    expect(problems.some((p) => /core\.pistol: only a magnified optic has zoom steps/.test(p))).toBe(true);
    expect(problems.some((p) => /kind irons: only a magnified optic has zoom steps/.test(p))).toBe(true);
    expect(problems.some((p) => /feel\.breathSeconds must be a number from 0\.5 to 30/.test(p))).toBe(true);
    expect(problems.some((p) => /feel\.sway must be a number/.test(p))).toBe(true);
  });

  it('the 2x optic is a magnifying tube built in code: its zoom is its `power`, its reticle the HUD\'s, one zoom', async () => {
    const good = await buildOptics();
    expect(good.kinds.x2).toMatchObject({ housing: 'magtube', power: 2, reticle: 'chevron', steps: [1] });
    expect(good.weapons['core.rifle'].allowed).toContain('x2');
    // Snipers and guns with a zoom of their own keep that optic only.
    for (const id of ['core.sniper', 'core.railgun', 'core.marksman', 'core.battle_rifle']) expect(good.weapons[id].allowed).toHaveLength(1);
    const file = readOpticsFile();
    file.kinds.x2 = { ...file.kinds.x2, power: 9, steps: [1, 0.5], mark: { dot: 0.004 } };
    const { problems } = await buildOptics(file);
    expect(problems.some((p) => /kind x2: a magnified optic built in code gives `power`/.test(p))).toBe(true);
    expect(problems.some((p) => /kind x2: a magnified optic built in code has one zoom/.test(p))).toBe(true);
    expect(problems.some((p) => /kind x2: a magnified optic built in code draws the HUD's reticle/.test(p))).toBe(true);
  });

  it('every built housing a gun may carry stands on one mount, and must clear the gun there', async () => {
    const file = readOpticsFile();
    // The Burst Rifle's front sight stands in a red dot's window wherever one is mounted.
    file.weapons['core.burst_rifle'].allowed = ['irons', 'x2', 'reddot'];
    const { problems, weapons } = await buildOptics(file);
    expect(problems.some((p) => /core\.burst_rifle: the gun stands in a reddot's window at its mount/.test(p))).toBe(true);
    // The gun behind a housing counts too: the Amarillo's rear block stands in a holographic sight's window.
    file.weapons['core.amarillo'] = { default: 'irons', allowed: ['irons', 'holo', 'x2'] };
    const behind = await buildOptics(file);
    expect(behind.problems.some((p) => /core\.amarillo: the gun behind a holo stands in its window/.test(p))).toBe(true);
    // And as it is, the 2x optic's mount is the one the table keeps.
    expect((await buildOptics()).weapons['core.burst_rifle'].mount).toEqual(weapons['core.burst_rifle'].mount);
  });
});
