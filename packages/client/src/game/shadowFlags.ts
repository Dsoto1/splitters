import type { Node } from '@babylonjs/core/node';

/**
 * Mark a node whose meshes are small and cast only within SMALL_CASTER_REACH of the camera (atmosphere.ts): pickups
 * and held guns, whose shadow is a speck past a few metres (a crowd's guns were a fifth of the shadow pass's draws).
 * Kept apart from Atmosphere so the pickups' and weapons' modules don't pull the shadow code in with them.
 */
export function castSmall(node: Node): void {
  node.metadata = { ...(node.metadata as object | null), smallCasters: true };
}

/** Whether a node or one above it was marked with castSmall. */
export function underSmall(n: Node | null): boolean {
  for (; n; n = n.parent) if ((n.metadata as { smallCasters?: boolean } | null)?.smallCasters) return true;
  return false;
}
