import { CORE_PROPS, PROP_CATEGORIES } from './props.generated.ts';

export type PropCategory = (typeof PROP_CATEGORIES)[number];

/**
 * A placeable prop: a decorative or cover model from a CC0 pack (see
 * content/props.json). Sizes are in metres after normalisation: the model is
 * centred on its footprint and stands on y = 0, facing +Z before its yaw.
 */
export interface PropDefinition {
  id: string;
  /** Built model, relative to the client's public folder. */
  file: string;
  displayName: string;
  category: string;
  /** Bounds [width (x), height, depth (z)]. */
  size: readonly [number, number, number];
  /** Collision box [x, height, z] centred on the footprint, or null to walk through. */
  collision: readonly [number, number, number] | null;
}

export { CORE_PROPS, PROP_CATEGORIES };

const byId = new Map(CORE_PROPS.map((p) => [p.id, p]));
export const getProp = (id: string): PropDefinition | undefined => byId.get(id);
