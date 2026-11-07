// Count Bonesworth's gun vanished from his hands after the scope (owner, 2026-11-07, St. John's): the gun's sharper
// held copy (Medium and High) came in while the gun was put away (scoped: the view's root off) and took "off" from the
// old copy's isEnabled(), which asks its parents. It must take the old copy's own switch (game/viewmodelSwap.ts).
import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { takeOverViewmodel } from '../src/game/viewmodelSwap.ts';

describe('the sharper copy of the gun in your hands', () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const viewRoot = new TransformNode('viewRoot', scene);
    const old = new TransformNode('view_core.marksman', scene);
    old.parent = viewRoot;
    return { viewRoot, old, copy: new TransformNode('view_core.marksman_held', scene) };
  };

  it('comes in while scoped (the view put away) and shows when the scope comes down', () => {
    const { viewRoot, old, copy } = setup();
    // Scoped (or third person): the view's root is off; the gun itself is still the one in your hands.
    viewRoot.setEnabled(false);
    expect(old.isEnabled()).toBe(false);
    takeOverViewmodel(old, copy);
    expect(copy.parent).toBe(viewRoot);
    // Scope down: the view comes back, and the gun with it.
    viewRoot.setEnabled(true);
    expect(copy.isEnabled()).toBe(true);
  });

  it('comes in for a gun not in your hands (kept for switching back) and stays put away', () => {
    const { viewRoot, old, copy } = setup();
    old.setEnabled(false);
    takeOverViewmodel(old, copy);
    expect(copy.isEnabled()).toBe(false);
    viewRoot.setEnabled(false);
    viewRoot.setEnabled(true);
    expect(copy.isEnabled()).toBe(false);
  });
});
