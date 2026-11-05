import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { selectLiveCandidates } from '../src/game/meshSelection.ts';

describe('active-mesh candidates', () => {
  it('are the switched-on meshes, less frozen ones no camera draws', () => {
    const scene = new Scene(new NullEngine());
    const on = new Mesh('on', scene);
    const off = new Mesh('off', scene);
    off.setEnabled(false);
    const parent = new TransformNode('parent', scene);
    const underOff = new Mesh('underOff', scene);
    underOff.parent = parent;
    parent.setEnabled(false);
    const proxy = new Mesh('proxy', scene);
    proxy.layerMask = 0;
    proxy.freezeWorldMatrix();
    const moving = new Mesh('movingHidden', scene);
    moving.layerMask = 0;
    selectLiveCandidates(scene);
    const names = () => {
      const c = scene.getActiveMeshCandidates();
      return c.data.slice(0, c.length).map((m) => m.name);
    };
    expect(names()).toEqual(['on', 'movingHidden']);
    // Worked out once a frame: a change shows on the next frame.
    off.setEnabled(true);
    parent.setEnabled(true);
    (scene as unknown as { _frameId: number })._frameId++;
    expect(names()).toEqual(['on', 'off', 'underOff', 'movingHidden']);
    scene.dispose();
  });
});
