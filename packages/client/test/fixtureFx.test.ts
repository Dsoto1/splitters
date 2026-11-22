import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIXTURE_FX, PAD_FX_RANGE, PAD_MOTION, PORTAL_FX_RANGE, PORTAL_GATE, fixtureLevel, padChevrons, padRings, portalCover, portalFit } from '../src/game/fixtureFx.ts';
import { lastingFx } from '../src/game/fxMap.ts';
import { SAFE_LIGHT } from '../src/game/reduceFlashing.ts';

const shipped = (pack: string): Record<string, { nodes: { name: string; mesh?: { size?: { '@Vector2': number[] } } }[] }> => JSON.parse(readFileSync(new URL(`../public/vfx/${pack}.json`, import.meta.url), 'utf8')).effects;

describe("portals' and jump pads' pack effects (fixtureFx.ts)", () => {
  it('maps both as fixtures (before decoration), from the packs bought for them', () => {
    expect(lastingFx('portal')).toMatchObject({ pack: 'portal_fx', fixture: true });
    expect(lastingFx('pad')).toMatchObject({ pack: 'magic_area_fx', fixture: true });
    expect(lastingFx('portal')?.decor).toBeUndefined();
    expect(lastingFx('pad')?.decor).toBeUndefined();
    // The stencil window and the particles are not ported: left out, never drawn wrong.
    expect(lastingFx('portal')?.skip).toEqual(expect.arrayContaining(['StencilMesh', 'GPUParticles3D']));
    expect(PORTAL_FX_RANGE).toBeLessThanOrEqual(70);
    expect(PAD_FX_RANGE).toBeLessThan(PORTAL_FX_RANGE);
  });

  it("fits the pack's gate to a portal's frame: the quads it names, at the size the pack made them", () => {
    const ref = lastingFx('portal')!;
    const fx = shipped(ref.pack)[ref.effect]!;
    for (const part of PORTAL_GATE.parts) expect(fx.nodes.some((n) => n.name === part), part).toBe(true);
    expect(fx.nodes.find((n) => n.name === 'PortalMesh')?.mesh?.size?.['@Vector2']).toEqual([PORTAL_GATE.width, PORTAL_GATE.height]);
    // The map's scale is per metre of width; the default 2.4 x 3.2 portal is a little squatter than the gate.
    expect(ref.scale * PORTAL_GATE.width).toBeCloseTo(1, 5);
    const fit = portalFit(2.4, 3.2);
    expect(fit.size).toBe(2.4);
    expect(fit.stretch * PORTAL_GATE.height * (2.4 / PORTAL_GATE.width)).toBeCloseTo(3.2, 5);
    expect(portalFit(PORTAL_GATE.width, PORTAL_GATE.height).stretch).toBeCloseTo(1, 5);
  });

  it('eases in while drawn and is nothing while not, never past its strength', () => {
    for (const kind of ['portal', 'pad'] as const) {
      let level = 0;
      for (let i = 0; i < 20; i++) level = fixtureLevel(kind, level, true, 1 / 60, false);
      expect(level, kind).toBeGreaterThan(0.2);
      expect(level, kind).toBeLessThan(FIXTURE_FX[kind].level);
      for (let i = 0; i < 120; i++) level = fixtureLevel(kind, level, true, 1 / 60, false);
      expect(level, kind).toBe(FIXTURE_FX[kind].level);
      expect(fixtureLevel(kind, level, false, 1 / 60, false), kind).toBe(0);
    }
  });

  it('with Reduce flashing on is dimmer and comes up slower than a light may change', () => {
    for (const kind of ['portal', 'pad'] as const) {
      const f = FIXTURE_FX[kind];
      expect(f.calmLevel, kind).toBeLessThan(f.level);
      expect(f.calmRise, kind).toBeLessThan(f.rise);
      expect(f.calmRise, kind).toBeLessThan(SAFE_LIGHT.rate);
      // No frame brightens it by more than a twentieth of full.
      expect(fixtureLevel(kind, 0, true, 1 / 60, true), kind).toBeLessThan(0.05);
      let level = 0;
      for (let i = 0; i < 600; i++) level = fixtureLevel(kind, level, true, 1 / 60, true);
      expect(level, kind).toBe(f.calmLevel);
      // Switching the setting on brings a full one down gradually too.
      expect(fixtureLevel(kind, f.level, true, 1 / 60, true), kind).toBeGreaterThan(f.calmLevel);
    }
  });

  it("hands a portal's painted swirl over to the pack's as it comes up", () => {
    expect(portalCover(0, false)).toBe(0);
    expect(portalCover(FIXTURE_FX.portal.level / 2, false)).toBeCloseTo(0.5, 5);
    expect(portalCover(FIXTURE_FX.portal.level, false)).toBe(1);
    expect(portalCover(FIXTURE_FX.portal.calmLevel, true)).toBe(1);
    expect(portalCover(FIXTURE_FX.portal.level, true)).toBe(1);
  });
});

describe('a jump pad that looks like it moves (padChevrons, padRings)', () => {
  it('glides its chevrons forward over the plate and grows each in and away, in loops over a second long', () => {
    expect(Math.min(PAD_MOTION.period, PAD_MOTION.calmPeriod, PAD_MOTION.ringPeriod, PAD_MOTION.calmRingPeriod)).toBeGreaterThan(1);
    for (const calm of [false, true]) {
      const period = calm ? PAD_MOTION.calmPeriod : PAD_MOTION.period;
      const a = padChevrons(0.1, calm);
      const b = padChevrons(0.2, calm);
      expect(a).toHaveLength(PAD_MOTION.chevrons);
      // Forward (+Z, the way the pad throws you) between two moments, within the plate.
      a.forEach((c, k) => {
        expect(c.z).toBeGreaterThanOrEqual(PAD_MOTION.from);
        expect(c.z).toBeLessThanOrEqual(PAD_MOTION.to);
        if (b[k]!.z > c.z) expect(b[k]!.z - c.z).toBeCloseTo(((PAD_MOTION.to - PAD_MOTION.from) * 0.1) / period, 5);
      });
      // A loop later it is back where it was; at the ends of the plate it is nothing (no pop in or out).
      padChevrons(0.1 + period, calm).forEach((c, k) => expect(c.z).toBeCloseTo(a[k]!.z, 5));
      expect(padChevrons(0, calm)[0]!.s).toBeCloseTo(0, 5);
      expect(Math.max(...padChevrons(period / 2, calm).map((c) => c.s))).toBeCloseTo(1, 5);
    }
  });

  it('raises its rings up the lift, narrowing, gone at the top', () => {
    for (const calm of [false, true]) {
      const period = calm ? PAD_MOTION.calmRingPeriod : PAD_MOTION.ringPeriod;
      const low = padRings(0.05 * period, calm)[0]!;
      const high = padRings(0.9 * period, calm)[0]!;
      expect(high.y).toBeGreaterThan(low.y);
      expect(high.r).toBeLessThan(low.r);
      expect(padRings(0, calm)[0]!.s).toBeCloseTo(0, 5);
      expect(padRings(0.999 * period, calm)[0]!.s).toBeLessThan(0.01);
      for (const r of padRings(0.3, calm)) {
        expect(r.y).toBeGreaterThanOrEqual(PAD_MOTION.ringFrom);
        expect(r.y).toBeLessThanOrEqual(PAD_MOTION.ringTo);
      }
    }
  });
});
