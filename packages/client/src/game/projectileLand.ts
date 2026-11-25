// How a projectile with no blast of its own lands (protocol `land`; owner, 2026-11-25: the Blaster X-42's bolts left no
// impact). Each look its own: the X-42's bolt a small orange energy splash and a scorch on a surface, a hit puff on a
// body; a nail, shard, disc, arrow, stinger or spear lands as a round does on that surface (its sparks, splinters or
// dust, a hole where it bites), smaller or bigger by its weight; the healing slime a green splat, the freeze blast a
// puff of frost. Under Reduce flashing (docs/LOOK.md) the glowing splash is a steady, dimmer, slower puff that is not
// lit, with fewer sparks: no flash.
import type { ProjectileVisual } from '@tiletrigger/shared';

export interface LandGlow {
  /** Puff colour. */
  hex: string;
  /** Size (m) it grows to, seconds it lasts, rise (m/s). */
  size: number;
  life: number;
  rise: number;
  /** Lit (emissive): never under Reduce flashing. */
  glow: boolean;
}

export interface LandStyle {
  /**
   * On a surface: `round` lands as a round would (the surface type's sparks, chips, dust and hole) at that strength;
   * otherwise its own: `glow` (the splash), `sparks`, and a `scorch` (a burn mark that stays, the hole decal at this
   * size) or none.
   */
  surface: { round: number } | { glow: LandGlow | null; sparks: number; scorch: number };
  /** On a body: `blood` at that strength (0: none) and a puff. */
  body: { blood: number; glow: LandGlow | null };
}

/** The style for a look; `calm`: Reduce flashing is on. Null: the look draws nothing of its own when it lands. */
export function landStyle(look: ProjectileVisual | undefined, calm: boolean): LandStyle | null {
  switch (look) {
    case 'blasterBolt': {
      // Orange like its bolt (view.tracer #ff8a1e). Calm: unlit, half as bright, eased out over twice as long.
      const splash: LandGlow = calm ? { hex: '#c4702e', size: 0.32, life: 0.55, rise: 0.05, glow: false } : { hex: '#ff8a2a', size: 0.4, life: 0.26, rise: 0.1, glow: true };
      return {
        surface: { glow: splash, sparks: calm ? 2 : 6, scorch: 2.2 },
        body: { blood: 0.4, glow: calm ? { ...splash, size: 0.26 } : { ...splash, size: 0.3 } },
      };
    }
    case 'nail':
      return { surface: { round: 0.7 }, body: { blood: 0.8, glow: null } };
    case 'shard':
      return { surface: { round: 0.6 }, body: { blood: 0.7, glow: null } };
    case 'disc':
      return { surface: { glow: null, sparks: calm ? 3 : 6, scorch: 0 }, body: { blood: 0.9, glow: null } };
    case 'arrow':
      return { surface: { round: 0.9 }, body: { blood: 1.1, glow: null } };
    case 'stinger':
      return { surface: { round: 0.5 }, body: { blood: 0.6, glow: { hex: '#d8d24a', size: 0.18, life: 0.3, rise: 0.05, glow: false } } };
    case 'spear':
      return { surface: { round: 1.3 }, body: { blood: 1.4, glow: null } };
    case 'slime': {
      const splat: LandGlow = { hex: '#68d87a', size: 0.35, life: 0.45, rise: 0.05, glow: false };
      return { surface: { glow: splat, sparks: 0, scorch: 0 }, body: { blood: 0, glow: splat } };
    }
    case 'frost': {
      // The Freeze Ray's freeze blast on a wall or a body: a cold puff of frost (the ice itself comes as `ice`).
      const frost: LandGlow = { hex: '#cfeaff', size: 0.55, life: 0.6, rise: 0.04, glow: false };
      return { surface: { glow: frost, sparks: 0, scorch: 0 }, body: { blood: 0, glow: frost } };
    }
    default:
      return null;
  }
}
