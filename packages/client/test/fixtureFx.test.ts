import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIXTURE_FX, PAD_FX_RANGE, PORTAL_FX_RANGE, PORTAL_GATE, fixtureLevel, portalCover, portalFit } from '../src/game/fixtureFx.ts';
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
