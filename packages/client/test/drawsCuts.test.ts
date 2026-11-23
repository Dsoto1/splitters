import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { GodotVfx } from '../src/game/godotVfx.ts';
import { instanceRigidParts, instancesHash, mergeRigidParts } from '../src/game/scenarioVisuals.ts';
import { stillable } from '../src/game/shadowCache.ts';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { readyOncePerRender } from '../src/game/clusteredLights.ts';
import { keepStillCasterBounds, STILL_BOUNDS_FRAMES } from '../src/game/shadowBounds.ts';
import type { ClusteredLightContainer } from '@babylonjs/core/Lights/Clustered/clusteredLightContainer';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});

function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

/** World-space corners of every drawn mesh (an instance draws its source's vertices under its own matrix), by material. */
function corners(meshes: readonly AbstractMesh[]): string[] {
  const out: string[] = [];
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    const pos = m.getVerticesData('position')!;
    for (let i = 0; i < pos.length; i += 3) {
      const p = Vector3.TransformCoordinates(new Vector3(pos[i], pos[i + 1], pos[i + 2]), m.getWorldMatrix());
      out.push(`${m.material?.name}:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
    }
  }
  return out.sort();
}

/** An oak-style door as scenarioVisuals builds it: a frame on the root, planks and a strap on a hinge, its own lamp. */
function door(s: Scene, name: string, at: Vector3, turn: number, mats: { oak: StandardMaterial; dark: StandardMaterial; iron: StandardMaterial }) {
  const root = new TransformNode(name, s);
  root.position.copyFrom(at);
  root.rotation.y = turn;
  const hinge = new TransformNode(`${name}_hinge`, s);
  hinge.parent = root;
  hinge.position.set(0.8, 0, 0);
  const box = (n: string, parent: TransformNode, size: [number, number, number], pos: [number, number, number], mat: StandardMaterial) => {
    const b = CreateBox(`${name}_${n}`, { width: size[0], height: size[1], depth: size[2] }, s);
    b.parent = parent;
    b.position.set(...pos);
    b.material = mat;
  };
  for (const side of [-1, 1]) box(`post${side}`, root, [0.25, 2.4, 0.4], [side * 0.9, 1.2, 0], mats.dark);
  for (let k = 0; k < 6; k++) box(`plank${k}`, hinge, [0.25, 2.2, 0.12], [-0.15 - k * 0.27, 1.1, 0], k % 2 ? mats.oak : mats.dark);
  box('strap', hinge, [1.3, 0.12, 0.15], [-0.7, 1, 0], mats.iron);
  const lamp = CreateSphere(`${name}_lamp`, { diameter: 0.2, segments: 4 }, s);
  lamp.parent = root;
  lamp.position.y = 2.6;
  lamp.material = new StandardMaterial(`${name}_lampMat`, s);
  return { root, hinge };
}

describe('fewer draws (docs/PERF_DRAWS_2026-11-23.md)', () => {
  it("draws doors' merged parts as instances of one source per shape and material, where they were, and they still swing", () => {
    const s = scene();
    const mats = { oak: new StandardMaterial('oak', s), dark: new StandardMaterial('dark', s), iron: new StandardMaterial('iron', s) };
    const doors = [door(s, 'a', new Vector3(4, 0, 2), 0.3, mats), door(s, 'b', new Vector3(-7, 1, 9), 2.1, mats), door(s, 'c', new Vector3(20, 0, -3), -1, mats)];
    for (const d of doors) mergeRigidParts(d.root);
    const drawn = () => doors.flatMap((d) => d.root.getChildMeshes(false));
    const before = corners(drawn());
    // Merged: frame (dark), leaf dark, leaf oak, strap (iron) and the lamp a door.
    expect(drawn().length).toBe(15);
    const sources = instanceRigidParts(doors.map((d) => d.root), s);
    // One source per part shape and material; the lamps (each its own material) stay meshes.
    expect(sources.length).toBe(4);
    const after = drawn();
    expect(after.length).toBe(15);
    expect(after.filter((m) => m.isAnInstance).length).toBe(12);
    expect(after.filter((m) => !m.isAnInstance).map((m) => m.name).sort()).toEqual(['a_lamp', 'b_lamp', 'c_lamp']);
    expect(corners(after)).toEqual(before);
    for (const src of sources) expect(src.getBoundingInfo().boundingBox.maximumWorld.y).toBeLessThan(-9000);
    // A swing still swings the leaf's instances with the hinge.
    const d = doors[1]!;
    d.hinge.rotation.y = 1.2;
    const leaf = d.hinge.getChildMeshes(false);
    expect(leaf.length).toBe(3);
    const hingeWorld = d.hinge.computeWorldMatrix(true);
    for (const m of leaf) {
      const local = Matrix.Compose(m.scaling, Quaternion.FromEulerVector(m.rotation), m.position);
      expect(m.computeWorldMatrix(true).equalsWithEpsilon(local.multiply(hingeWorld), 1e-6)).toBe(true);
    }
    // The static shadow cache may keep a source while none of its copies moves: its hash says when one does.
    for (const src of sources) expect(stillable(src)).toBe(true);
    const plankSrc = sources.find((m) => (m.metadata as { instancesVersion?: () => number }).instancesVersion && m.instances.some((i) => i.parent === d.hinge))!;
    const version = (plankSrc.metadata as { instancesVersion: () => number }).instancesVersion;
    const still = version();
    expect(version()).toBe(still);
    d.hinge.rotation.y = 0.4;
    for (const i of plankSrc.instances) i.computeWorldMatrix(true);
    expect(version()).not.toBe(still);
    const moved = version();
    plankSrc.instances[0]!.isVisible = false;
    expect(version()).not.toBe(moved);
    expect(instancesHash([] as InstancedMesh[])).toBe(17);
    // A plain instance source (no hash) is never cached: one draw stands for every copy.
    const plain = CreateBox('plain', { size: 1 }, s);
    plain.createInstance('plain_1');
    expect(stillable(plain)).toBe(false);
    // A lone door has nothing to share.
    const lone = door(s, 'z', new Vector3(0, 0, 0), 0, { oak: new StandardMaterial('o2', s), dark: new StandardMaterial('d2', s), iron: new StandardMaterial('i2', s) });
    mergeRigidParts(lone.root);
    expect(instanceRigidParts([lone.root], s)).toEqual([]);
  });

  it("answers the clustered lights' readiness once per render, the full check again on the next", () => {
    let calls = 0;
    let ready = false;
    let renderId = 1;
    const c = { _isReady: () => (calls++, ready) } as unknown as ClusteredLightContainer;
    readyOncePerRender(c, { getRenderId: () => renderId } as unknown as Scene);
    const ask = () => (c as unknown as { _isReady: () => boolean })._isReady();
    // Not ready: every ask checks.
    expect(ask()).toBe(false);
    expect(ask()).toBe(false);
    expect(calls).toBe(2);
    ready = true;
    expect(ask()).toBe(true);
    for (let i = 0; i < 50; i++) expect(ask()).toBe(true);
    expect(calls).toBe(3);
    // The next render checks once more, and a no is never kept.
    renderId++;
    ready = false;
    expect(ask()).toBe(false);
    expect(ask()).toBe(false);
    expect(calls).toBe(5);
  });

  it("keeps the still casters' box and adds the moving ones every frame: the box Babylon works out", () => {
    const s = scene();
    const list: AbstractMesh[] = [];
    for (let i = 0; i < 20; i++) {
      const b = CreateBox(`still${i}`, { size: 1 + i * 0.1 }, s);
      b.position.set(i * 7 - 60, i % 3, (i * 13) % 40);
      b.computeWorldMatrix(true);
      b.freezeWorldMatrix();
      list.push(b);
    }
    const runner = CreateBox('runner', { size: 1.8 }, s);
    list.push(runner);
    const babylon = () => {
      const min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      const max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
      for (const m of list) {
        m.computeWorldMatrix(true);
        min.minimizeInPlace(m.getBoundingInfo().boundingBox.minimumWorld);
        max.maximizeInPlace(m.getBoundingInfo().boundingBox.maximumWorld);
      }
      return [min, max];
    };
    let frame = 0;
    const fakeScene = { getFrameId: () => frame } as unknown as Scene;
    const g = {
      _shadowMap: { renderList: list },
      _scbiMin: new Vector3(),
      _scbiMax: new Vector3(),
      _shadowCastersBoundingInfo: new BoundingInfo(Vector3.Zero(), Vector3.Zero()),
      _computeShadowCastersBoundingInfo: () => {},
    };
    keepStillCasterBounds(g, fakeScene);
    for (const [x, z] of [[0, 0], [300, -5], [-500, 40], [10, 900]] as const) {
      frame++;
      runner.position.set(x, 4, z);
      runner.computeWorldMatrix(true);
      g._computeShadowCastersBoundingInfo();
      const [min, max] = babylon() as [Vector3, Vector3];
      expect(g._scbiMin.equalsWithEpsilon(min, 1e-6)).toBe(true);
      expect(g._scbiMax.equalsWithEpsilon(max, 1e-6)).toBe(true);
    }
    // A caster added to the list: the still box is worked out again at once.
    const far = CreateBox('far', { size: 1 }, s);
    far.position.set(0, 50, -800);
    far.computeWorldMatrix(true);
    far.freezeWorldMatrix();
    list.push(far);
    frame++;
    g._computeShadowCastersBoundingInfo();
    expect(g._scbiMin.z).toBeLessThan(-799);
    expect(g._scbiMax.y).toBeGreaterThan(50);
    expect(STILL_BOUNDS_FRAMES).toBeGreaterThan(0);
    expect(far instanceof Mesh).toBe(true);
  });

  it("sets the effects' sun and sky on a material only when they changed, the time and the eye every frame", () => {
    const s = scene();
    const fx = new GodotVfx(s);
    const inner = fx as unknown as { materials: Map<string, ShaderMaterial>; playing: unknown[] };
    const a = new ShaderMaterial('a', s, { vertex: 'x', fragment: 'x' }, { uniforms: ['u_time', 'u_sunDir', 'u_sunColor', 'u_ambient', 'eye'] });
    inner.materials.set('a', a);
    // update() does nothing with nothing playing: one stand-in effect that ends at once.
    const sets: string[] = [];
    for (const k of ['setColor3', 'setVector3', 'setFloat'] as const) {
      const f = a[k].bind(a) as (n: string, v: unknown) => ShaderMaterial;
      (a as unknown as Record<string, unknown>)[k] = (n: string, v: unknown) => (sets.push(n), f(n, v));
    }
    const frame = () => {
      sets.length = 0;
      inner.playing = [{ t: 0, age: 0, speed: 1, pieces: [], loop: false, emitters: new Map(), life: 0, level: 1, want: 1, stopAt: null, nodes: [], meshes: [], dispose: () => {} }];
      try {
        fx.update(16);
      } catch {
        // The stand-in effect may not run through; the materials were set before it.
      }
      return [...sets].sort();
    };
    expect(frame()).toEqual(['eye', 'u_ambient', 'u_sunColor', 'u_sunDir', 'u_time']);
    expect(frame()).toEqual(['eye', 'u_time']);
    fx.setLight(new Vector3(0.2, -1, 0.1), new Color3(1, 0.5, 0.4), new Color3(0.3, 0.3, 0.4));
    expect(frame()).toEqual(['eye', 'u_ambient', 'u_sunColor', 'u_sunDir', 'u_time']);
    expect(frame()).toEqual(['eye', 'u_time']);
    // A material made later gets them at once.
    const b = new ShaderMaterial('b', s, { vertex: 'x', fragment: 'x' }, { uniforms: ['u_sunDir'] });
    inner.materials.set('b', b);
    let bSun = 0;
    const setV = b.setVector3.bind(b);
    b.setVector3 = (n, v) => (n === 'u_sunDir' && bSun++, setV(n, v));
    frame();
    frame();
    expect(bSun).toBe(1);
  });
});
