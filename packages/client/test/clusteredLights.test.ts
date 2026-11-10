import { describe, expect, it } from 'vitest';
import { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';
import { MOBILE_LIGHTS_PER_LAYER, installPhoneLightMasks } from '../src/game/clusteredLights.ts';

/** Engines as Babylon's batch sizing reads them: WebGL 2 with float blending, a phone or not, or WebGPU. */
const engine = (o: { mobile?: boolean; webgpu?: boolean; version?: number; float?: boolean } = {}) => ({
  isWebGPU: !!o.webgpu,
  version: o.version ?? 2,
  hostInformation: { isMobile: !!o.mobile },
  _caps: { texelFetch: true, colorBufferFloat: o.float ?? true, blendFloat: o.float ?? true, shaderFloatPrecision: 23 },
});
type Sizer = { _GetEngineBatchSize(e: ReturnType<typeof engine>): number };

describe('map lights on phones', () => {
  it("a phone's tile mask holds one light per layer, so a tile can't lose a lamp to a less precise float target", () => {
    const real = ClusteredLightContainer as unknown as Sizer;
    const babylon = real._GetEngineBatchSize.bind(real);
    // Babylon's own sizes first: 8 lights a layer on a phone, the float precision on a desktop.
    expect(babylon(engine({ mobile: true }))).toBe(8);
    expect(babylon(engine())).toBe(23);
    // The same class with the phone rule on (a copy, so the real class is left for the other tests).
    const copy: Sizer = { _GetEngineBatchSize: babylon };
    installPhoneLightMasks(copy);
    expect(copy._GetEngineBatchSize(engine({ mobile: true }))).toBe(MOBILE_LIGHTS_PER_LAYER);
    expect(MOBILE_LIGHTS_PER_LAYER).toBe(1);
    // Desktops and WebGPU keep Babylon's batches; no float blending still means no clustered lights.
    expect(copy._GetEngineBatchSize(engine())).toBe(23);
    expect(copy._GetEngineBatchSize(engine({ mobile: true, webgpu: true }))).toBe(32);
    expect(copy._GetEngineBatchSize(engine({ mobile: true, float: false }))).toBe(0);
  });

  it('installs on the class the game makes its containers from', () => {
    installPhoneLightMasks();
    installPhoneLightMasks();
    const real = ClusteredLightContainer as unknown as Sizer;
    expect(real._GetEngineBatchSize(engine({ mobile: true }))).toBe(1);
    expect(real._GetEngineBatchSize(engine())).toBe(23);
  });
});
