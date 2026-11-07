import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/**
 * A first-person gun's sharper copy (view.held, docs/ARSENAL.md "Texture tiers") takes over from the copy in your
 * hands: it hangs where the old one did and is switched on or off as the old one was, by the old one's OWN switch.
 *
 * Not by `old.isEnabled()`, which asks its parents too: the sharper copy is fetched while you play, and when it came
 * in while the gun was put away for the moment (scoped, third person: the view's root is switched off, not the
 * gun), it took "off" and kept it, so the gun stayed invisible in your hands when the scope came down (owner,
 * 2026-11-07: "the weapon disappears in his hands (happened after using sniper on roof at st. johns)").
 */
export function takeOverViewmodel(old: TransformNode, copy: TransformNode): void {
  copy.parent = old.parent;
  copy.setEnabled(old.isEnabled(false));
}
