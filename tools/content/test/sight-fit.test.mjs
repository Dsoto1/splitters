import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCKING, PLAIN_OVER, SIGHT_FIT_TS, aimDepth, angleTo, builtInExclusion, eyeOn, firstHit, fitAll, fitSights, flagsOf, sightFitSource } from '../sight-fit.mjs';

/** A box as triangles: [x0, x1], [y0, y1], [z0, z1] (metres; +Z the barrel, +Y up). */
function box([x0, x1], [y0, y1], [z0, z1]) {
  const p = (i) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  return quads.flatMap(([a, b, c, d]) => [[p(a), p(b), p(c)], [p(a), p(c), p(d)]]);
}
/** A plain gun body 0.6 m long with its top at 0.05, a front post 2 mm wide to 0.062, and `rear` parts on top. */
const gun = (...rear) => [...box([-0.02, 0.02], [0, 0.05], [-0.3, 0.3]), ...box([-0.001, 0.001], [0.05, 0.062], [0.25, 0.252]), ...rear.flat()];
const HOLD = { grip: [0, 0, -0.15], muzzle: [0, 0.03, 0.3] };
const near = (a, b, tol = 0.0006) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('sight fit: finding a gun\'s sights on its model', () => {
  it('a plain rear sight and a front post: the eye looks a little over the rear sight at the post\'s top', () => {
    const fit = fitSights(gun(box([-0.006, 0.006], [0.05, 0.06], [-0.2, -0.19])), HOLD);
    expect(fit.kind).toBe('post');
    near(fit.front[1], 0.062);
    near(fit.front[2], 0.251, 0.002);
    near(fit.rear[1], 0.06 + PLAIN_OVER);
    expect(fit.rear[2]).toBeGreaterThan(-0.201);
    expect(fit.rear[2]).toBeLessThan(-0.189);
  });

  it('a notch: the eye looks over the ears\' top, through the notch\'s own middle, at the post\'s rear edge', () => {
    // Ears to 0.06 either side of a 3 mm notch whose floor is at 0.057, set 1 mm to the right of the centre plane.
    const ears = [box([-0.006, -0.0005], [0.05, 0.06], [-0.2, -0.198]), box([0.0025, 0.007], [0.05, 0.06], [-0.2, -0.198]), box([-0.0005, 0.0025], [0.05, 0.057], [-0.2, -0.198])];
    const fit = fitSights(gun(...ears), HOLD);
    expect(fit.kind).toBe('notch');
    near(fit.rear[1], 0.06);
    near(fit.rear[0], 0.001);
    near(fit.gap, 0.003);
    near(fit.front[1], 0.062);
    near(fit.front[2], 0.25, 0.001);
  });

  it('an aperture: the eye looks through the middle of the ring\'s hole', () => {
    // A plate 12 mm wide to 0.07 with a 3 mm square hole from 0.058 to 0.061.
    const ring = [box([-0.006, -0.0015], [0.05, 0.07], [-0.2, -0.198]), box([0.0015, 0.006], [0.05, 0.07], [-0.2, -0.198]), box([-0.0015, 0.0015], [0.05, 0.058], [-0.2, -0.198]), box([-0.0015, 0.0015], [0.061, 0.07], [-0.2, -0.198])];
    const fit = fitSights(gun(...ring), HOLD);
    expect(fit.kind).toBe('aperture');
    near(fit.rear[0], 0);
    near(fit.rear[1], 0.0595);
    near(fit.front[1], 0.062);
  });

  it('a ring the front sight cannot be seen through is not an aperture', () => {
    // The same plate, its hole far below the line to the post's top: the gun's body is behind it.
    const ring = [box([-0.006, -0.0015], [0.05, 0.07], [-0.2, -0.198]), box([0.0015, 0.006], [0.05, 0.07], [-0.2, -0.198]), box([-0.0015, 0.0015], [0.05, 0.064], [-0.2, -0.198]), box([-0.0015, 0.0015], [0.067, 0.07], [-0.2, -0.198])];
    const blocked = [...ring, box([-0.01, 0.01], [0.05, 0.069], [0, 0.01])];
    expect(fitSights(gun(...blocked), HOLD).kind).not.toBe('aperture');
  });

  it('a front sight only is a bead; nothing proud at the front is no sights at all', () => {
    const bead = fitSights(gun(), HOLD);
    expect(bead.kind).toBe('bead');
    near(bead.front[1], 0.062);
    const plain = fitSights(box([-0.02, 0.02], [0, 0.05], [-0.3, 0.3]), HOLD);
    expect(plain.kind).toBe('top');
    const w = { view: { hold: { style: 'long', grip: [0, 0, -0.15] } } };
    expect(flagsOf({ ...plain, clear: true }, w, 0.6)).toContain('no-sights');
    expect(BLOCKING).toContain('no-sights');
  });

  it('sights off the middle of the model are found on the barrel\'s own plane', () => {
    // The whole gun 5 mm to the left, a wide lump on its right side (a charging handle) pulling the bounds over.
    const moved = gun(box([-0.006, 0.006], [0.05, 0.06], [-0.2, -0.19])).map((t) => t.map(([x, y, z]) => [x - 0.005, y, z]));
    const fit = fitSights([...moved, ...box([0.015, 0.04], [0.02, 0.03], [-0.05, 0])], HOLD);
    near(fit.front[0], -0.005);
    near(fit.front[1], 0.062);
  });

  it('the eye sits on the sight line at the depth the gun aimed at before, and the line is clear', () => {
    const tris = gun(box([-0.006, 0.006], [0.05, 0.06], [-0.2, -0.19]));
    const fit = fitSights(tris, HOLD);
    const depth = aimDepth(0.55, -0.3);
    expect(depth).toBe(0.55);
    expect(aimDepth(0.4, -0.3)).toBe(0.5);
    const eye = eyeOn(fit.rear, fit.front, depth);
    expect(eye[2]).toBe(-0.55);
    const axis = [fit.front[0] - eye[0], fit.front[1] - eye[1], fit.front[2] - eye[2]];
    expect(angleTo(eye, axis, fit.rear)).toBeLessThan(1e-6);
    expect(firstHit(tris, [eye[0], eye[1] + 0.0003, eye[2]], [fit.front[0], fit.front[1] + 0.0003, fit.front[2]])).toBeNull();
    // Through the rear sight instead: blocked, a third of the way along.
    const hit = firstHit(tris, [0, 0.055, -0.55], [0, 0.055, 0.5]);
    expect(hit).toBeGreaterThan(0.3);
    expect(hit).toBeLessThan(0.36);
  });
});

describe('sight fit: every weapon', () => {
  it('weapons that never aim down sights in the hand need no entry', () => {
    expect(builtInExclusion({ slot: 0, kind: 'hitscan', view: { model: 'a.glb' } })).toMatch(/mounted/);
    expect(builtInExclusion({ slot: 1, kind: 'melee', view: { model: 'a.glb' } })).toMatch(/melee/);
    expect(builtInExclusion({ slot: 5, kind: 'hitscan', view: { model: 'a.glb', zoomFov: 0.4 } })).toMatch(/scope/);
    expect(builtInExclusion({ slot: 3, kind: 'hitscan', view: { model: 'a.glb', optic: {} } })).toMatch(/optic/);
    expect(builtInExclusion({ slot: 3, kind: 'hitscan', view: { model: 'a.glb' } })).toBeNull();
  });

  it('the shipped table is what the models and content/sight-fit.json give, with nothing left to decide', async () => {
    const result = await fitAll();
    expect(result.problems, 'a weapon needs a fit, a correction or an exclusion with its reason (docs/GUNPLAY_SPEC.md §15)').toEqual([]);
    expect(sightFitSource(result), 'run node tools/content/sight-fit.mjs').toBe(readFileSync(SIGHT_FIT_TS, 'utf8'));
    for (const [id, fit] of Object.entries(result.fits)) {
      expect(fit.flags.filter((f) => BLOCKING.includes(f)), id).toEqual([]);
      expect(fit.clear, id).toBe(true);
      // A fit moves the aim onto the sights: before it they were off by more than the tolerance on every gun.
      expect(fit.before, id).toBeGreaterThan(0.3);
    }
  });
});
