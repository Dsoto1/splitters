import type { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';

/**
 * Rooms without their lamps (phones on Low: clusteredLights.ts dropLamps): under a roof, the sky light is raised so
 * interiors aren't left dim. The camera looks up for a roof a few times a second; the light eases over about a
 * second each way, so walking in or out never jumps in brightness (Reduce flashing: no flash, nothing sudden).
 */
export const INDOOR_FILL = {
  /** The sky light under a roof: this much more (1: twice). Flatpack Depot's showroom then reads about as bright as
   *  with its lamps on Medium. */
  boost: 1,
  /** How fast the fill comes and goes (of the whole change a second). */
  rate: 0.9,
  /** How often (s) the camera looks up for a roof. */
  every: 0.25,
} as const;

/** The fill's level (0 out in the open, 1 under a roof) after `dt` seconds toward `covered`. */
export function fillLevel(level: number, covered: boolean, dt: number): number {
  const want = covered ? 1 : 0;
  const step = INDOOR_FILL.rate * Math.max(0, dt);
  return want > level ? Math.min(want, level + step) : Math.max(want, level - step);
}

export class IndoorFill {
  private level = 0;
  private covered = false;
  private lastCheck = -Infinity;
  private lastAt = 0;
  /** The sky light's own intensity (what the map's sky set), and what this last wrote over it. */
  private base = 0;
  private written = -1;

  constructor(
    private readonly hemi: HemisphericLight,
    /** Whether a roof is over the camera now. */
    private readonly roofOver: () => boolean,
  ) {}

  update(now: number): void {
    const dt = this.lastAt ? Math.min(0.25, (now - this.lastAt) / 1000) : 0;
    this.lastAt = now;
    if ((now - this.lastCheck) / 1000 >= INDOOR_FILL.every) {
      this.lastCheck = now;
      this.covered = this.roofOver();
    }
    // The sky changed it (a new map, the time of day): that is the base now.
    if (this.hemi.intensity !== this.written) this.base = this.hemi.intensity;
    this.level = fillLevel(this.level, this.covered, dt);
    this.written = this.base * (1 + INDOOR_FILL.boost * this.level);
    this.hemi.intensity = this.written;
  }

  /** 0 in the open, 1 fully filled (tests). */
  get fill(): number {
    return this.level;
  }
}
