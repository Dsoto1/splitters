import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { setGlow } from '../src/game/glow.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** A PBR material counting the walks through the scene's meshes a change makes Babylon do. */
function material(): { mat: PBRMaterial; walks: () => number } {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const mat = new PBRMaterial('body', scene);
  let walks = 0;
  const m = mat as unknown as { _markAllSubMeshesAsDirty: (f: unknown) => void };
  const orig = m._markAllSubMeshesAsDirty.bind(mat);
  m._markAllSubMeshesAsDirty = (f) => {
    walks++;
    orig(f);
  };
  return { mat, walks: () => walks };
}

describe('setGlow', () => {
  it('walks the scene once per material, then changes the glow in place', () => {
    const { mat, walks } = material();
    // The spawn shimmer easing in and out in tenths.
    for (let k = 1; k <= 10; k++) setGlow(mat, new Color3(0.05 * k, 0.08 * k, 0.12 * k));
    for (let k = 9; k >= 0; k--) setGlow(mat, new Color3(0.05 * k, 0.08 * k, 0.12 * k));
    expect(walks()).toBe(1);
    expect(mat.emissiveColor.equals(Color3.Black())).toBe(true);
    // What the material draws with (the uniform's source) is that colour.
    setGlow(mat, new Color3(0.2, 0.3, 0.4));
    expect((mat as unknown as { _emissiveColor: Color3 })._emissiveColor.equals(new Color3(0.2, 0.3, 0.4))).toBe(true);
    expect(walks()).toBe(1);
  });

  it('never changes a colour it was handed (it keeps its own copy)', () => {
    const { mat } = material();
    const given = new Color3(0.5, 0.5, 0.5);
    setGlow(mat, given);
    setGlow(mat, new Color3(0.1, 0.1, 0.1));
    expect(given.equals(new Color3(0.5, 0.5, 0.5))).toBe(true);
    // An unchanged glow sets nothing.
    const before = mat.emissiveColor;
    setGlow(mat, new Color3(0.1, 0.1, 0.1));
    expect(mat.emissiveColor).toBe(before);
  });
});
