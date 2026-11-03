import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CORE_PROPS, type Vec3 } from '@tiletrigger/shared';
import type { LastingFx, LastingPlace } from '../src/game/lastingFx.ts';
import { lastingFx } from '../src/game/fxMap.ts';
import { PropFlames } from '../src/game/propFlames.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

/** A stand-in LastingFx: records what is wanted, and draws what `drawnIds` holds. */
function fakeLasting() {
  const wants = new Map<string, { key: string; at: Vec3; place: LastingPlace }>();
  const drawnIds = new Set<string>();
  const lasting = {
    want: (id: string, key: string, at: Vec3, place: LastingPlace = {}) => void wants.set(id, { key, at, place }),
    drawn: (id: string) => drawnIds.has(id),
  } as unknown as LastingFx;
  return { lasting, wants, drawnIds };
}

/** A brazier: a root at `at` with a bowl and its flame (material `fire`). */
function brazier(scene: Scene, at: [number, number, number], scale = 1) {
  const root = new TransformNode('brazier', scene);
  root.position.set(...at);
  root.scaling.setAll(scale);
  const bowl = CreateBox('bowl', { size: 1 }, scene);
  bowl.material = new StandardMaterial('bronze', scene);
  const fire = CreateBox('fire', { size: 0.5 }, scene);
  fire.material = new StandardMaterial('fire', scene);
  bowl.parent = fire.parent = root;
  return { root, fire, bowl };
}

function setup() {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

describe('fire props (propFlames.ts)', () => {
  it('asks for each flame at its flame point, sized by the prop, and hides the model flame only while drawn', () => {
    const scene = setup();
    const { lasting, wants, drawnIds } = fakeLasting();
    const flames = new PropFlames(lasting, true);
    const b = brazier(scene, [10, 2, 5], 2);
    flames.add('p1', b.root, { fx: 'brazier', at: [0, 1.2, 0.1], size: 0.6, hide: ['fire'] }, 2, false);
    flames.want({ x: 0, y: 0, z: 0 });
    const w = wants.get('prop:p1')!;
    expect(w.key).toBe('flame.brazier');
    expect(w.at.x).toBeCloseTo(10);
    expect(w.at.y).toBeCloseTo(2 + 2.4);
    expect(w.at.z).toBeCloseTo(5.2);
    expect(w.place.size).toBeCloseTo(1.2);
    flames.show();
    expect(b.fire.isEnabled(false)).toBe(true);
    drawnIds.add('prop:p1');
    flames.show();
    expect(b.fire.isEnabled(false)).toBe(false);
    expect(b.bowl.isEnabled(false)).toBe(true);
    // Past the lasting cap or out of range: the model's own flame is back.
    drawnIds.clear();
    flames.show();
    expect(b.fire.isEnabled(false)).toBe(true);
  });

  it('asks for nothing far off, for broken props, or on low graphics', () => {
    const scene = setup();
    const far = fakeLasting();
    const flames = new PropFlames(far.lasting, true);
    const a = brazier(scene, [200, 0, 0]);
    const broken = brazier(scene, [1, 0, 0]);
    broken.root.setEnabled(false);
    flames.add('far', a.root, { fx: 'torch', at: [0, 1, 0], size: 0.3 }, 1, false);
    flames.add('broken', broken.root, { fx: 'torch', at: [0, 1, 0], size: 0.3 }, 1, false);
    flames.want({ x: 0, y: 0, z: 0 });
    expect(far.wants.size).toBe(0);
    const low = fakeLasting();
    const off = new PropFlames(low.lasting, false);
    const c = brazier(scene, [1, 0, 0]);
    off.add('near', c.root, { fx: 'torch', at: [0, 1, 0], size: 0.3, hide: ['fire'] }, 1, false);
    off.want({ x: 0, y: 0, z: 0 });
    off.show();
    expect(low.wants.size).toBe(0);
    expect(c.fire.isEnabled(false)).toBe(true);
  });

  it('every fire prop names a flame effect that exists, and its flame stands inside the prop', () => {
    const fire = CORE_PROPS.filter((p) => p.flame);
    expect(fire.length).toBeGreaterThan(10);
    for (const p of fire) {
      const f = p.flame!;
      const ref = lastingFx(`flame.${f.fx}`);
      expect(ref, p.id).not.toBeNull();
      expect(ref!.decor, p.id).toBe(true);
      expect(f.at[1], p.id).toBeGreaterThanOrEqual(0);
      expect(f.at[1], p.id).toBeLessThanOrEqual(p.size[1]);
      expect(Math.abs(f.at[0]), p.id).toBeLessThanOrEqual(p.size[0] / 2 + 0.01);
      expect(Math.abs(f.at[2]), p.id).toBeLessThanOrEqual(p.size[2] / 2 + 0.01);
    }
  });
});
