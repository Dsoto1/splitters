/**
 * The camera kick for the player who is hit (owner, 2026-11-16: "punchier please"; docs/GUNPLAY_SPEC.md §23 and §29).
 *
 * A small jolt of the view, presentation only (split recoil, §29: it never moves the aim the server shoots along):
 * the head knocked back (the view tips up) and turned a little away from the side the round came from, by the
 * weapon's stopping power (a shotgun blast or a sniper round most, an SMG round barely), then it settles in about a
 * third of a second. Rounds landing close together add up to a cap, so sustained fire never shakes the view off a
 * target (docs/GUNPLAY_DIRECTION.md: no excessive flinch).
 *
 * Camera shake (Options → Accessibility, combatPrefs.ts): Reduced keeps about a third of it, Off none.
 *
 * Reduce flashing (docs/LOOK.md): no snap. The kick is a little over half the size and eases in over 90 ms instead
 * of 35 ms, and settles more slowly: a steady nudge, never a rapid jolt.
 */
export const HIT_KICK = {
  /** Radians of upward kick for a full hit at stopping power 1 (about 1.3 degrees), plus a floor for any hit. */
  perPower: 0.022,
  base: 0.002,
  /** The most the kicks of several rounds add up to (radians, about 1.8 degrees). */
  max: 0.032,
  /** Sideways share of the upward kick (away from the round). */
  side: 0.5,
  /** Seconds to the peak, and the settle's time constant. */
  rise: 0.035,
  settle: 0.1,
  /** Reduce flashing: size, rise and settle. */
  calmScale: 0.55,
  calmRise: 0.09,
  calmSettle: 0.16,
  /** Gone after this long (s). */
  seconds: 0.6,
} as const;

export interface HitKick {
  /** Peak kick (radians): up, and sideways (+ turns the view right). */
  pitch: number;
  yaw: number;
  /** When it started (s). */
  t0: number;
  calm: boolean;
}

/** How far into its shape a kick is at `t` seconds after it started (0..1). */
export function kickEnvelope(t: number, calm: boolean): number {
  if (t < 0 || t >= HIT_KICK.seconds) return 0;
  const rise = calm ? HIT_KICK.calmRise : HIT_KICK.rise;
  const settle = calm ? HIT_KICK.calmSettle : HIT_KICK.settle;
  if (t < rise) {
    const u = t / rise;
    // Calm: smoothstep, no corner at the start.
    return calm ? u * u * (3 - 2 * u) : u;
  }
  return Math.exp(-(t - rise) / settle);
}

/** The kick's offset now (radians). */
export function kickAt(k: HitKick | null, now: number): { pitch: number; yaw: number } {
  if (!k) return { pitch: 0, yaw: 0 };
  const e = kickEnvelope(now - k.t0, k.calm);
  return { pitch: k.pitch * e, yaw: k.yaw * e };
}

/**
 * A hit lands: `power` is its weapon's stopping power times the share of a full shot it carried (a shotgun pellet
 * 1/pellets), `side` where the round came from (-1 left of the view .. 1 right). Returns the new kick, starting now
 * from what is left of the last one plus this hit, within the cap. `amount` scales the kick and its cap (Camera shake).
 */
export function addKick(prev: HitKick | null, now: number, power: number, side: number, calm: boolean, amount = 1): HitKick {
  const left = kickAt(prev, now);
  // `amount`: the Camera shake setting's share (combatPrefs.ts), on top of Reduce flashing's calmer shape.
  const scale = (calm ? HIT_KICK.calmScale : 1) * Math.max(0, amount);
  const max = HIT_KICK.max * scale;
  const up = (HIT_KICK.base + HIT_KICK.perPower * Math.max(0, power)) * scale;
  const pitch = Math.min(max, left.pitch + up);
  const s = Math.max(-1, Math.min(1, side));
  const yaw = Math.max(-max * HIT_KICK.side, Math.min(max * HIT_KICK.side, left.yaw - s * up * HIT_KICK.side));
  return { pitch, yaw, t0: now, calm };
}
