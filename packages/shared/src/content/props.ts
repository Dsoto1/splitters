import { CORE_PROPS, PROP_CATEGORIES } from './props.generated.ts';
import { envPropDefinition, isEnvModel } from './environment.ts';

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
  /**
   * Finer collision for set pieces (stairs and ramps as walkable steps,
   * doorways open in the middle, corners and curved railings): boxes
   * [minX, minY, minZ, maxX, maxY, maxZ] in the prop's own space, used instead
   * of the `collision` box for the level's static collision.
   */
  boxes?: readonly (readonly [number, number, number, number, number, number])[];
  /** Can be shot apart: health at scale 1, an explosion when it goes, and the colour of its debris. */
  breakable?: { health: number; blast?: { radius: number; damage: number; edge: number }; debris: string };
  /** Foliage you can hide in (bushes, ferns, tall crops): bots only spot someone inside it up close or when they fire. */
  conceals?: boolean;
  /**
   * A fire prop's open flame (braziers, fire bowls, torches, candles, campfires), drawn with the Flame FX pack
   * (content/vfx.json map.lasting `flame.<fx>`) near the camera: `at` in the prop's own space as drawn (metres at
   * scale 1), `size` the flame's height in metres, `hide` the model's own flame materials, shown only while the
   * pack flame isn't drawn.
   */
  flame?: PropFlame;
}

export interface PropFlame {
  fx: 'brazier' | 'torch' | 'candle' | 'campfire';
  at: readonly [number, number, number];
  size: number;
  hide?: readonly string[];
}

export { CORE_PROPS, PROP_CATEGORIES };

let byId: Map<string, PropDefinition> | undefined; // built on first use (as in serverRules.ts)
/** A catalogue prop, or the PropDefinition view of an environment species (`env.*`, content/environment.ts). */
export const getProp = (id: string): PropDefinition | undefined => (byId ??= new Map(CORE_PROPS.map((p) => [p.id, p]))).get(id) ?? (isEnvModel(id) ? envPropDefinition(id) : undefined);
