/**
 * Every death is physical, cheaply (docs/PHYSICS_FX.md, "Ragdolls"). A body
 * that dies gets one of three tiers:
 *
 * - `full`: ten capsules (torso, head, upper and lower arms, thighs, shins), near you, or in view and big on screen
 *   (at least `fullScreen` of the view's height: about 34 m off with the usual field of view, further through a scope);
 * - `cheap`: three bodies (pelvis, chest, head) with the limbs hanging in a limp pose, for small bodies in view;
 * - `posed`: no simulation: laid on the ground along the hit (out of view).
 *
 * Instead of a ragdoll count there is a budget of awake physics bodies: past
 * it the farthest ragdoll still moving drops a tier (full to cheap, cheap to
 * frozen) to make room, and only when every moving one is closer does the new
 * death itself take a lower tier. Nothing falls back to a canned death.
 */
export type RagdollTier = 'full' | 'cheap' | 'posed';

/** Physics bodies a ragdoll of each tier keeps awake. */
export const TIER_BODIES: Record<RagdollTier, number> = { full: 10, cheap: 3, posed: 0 };

export const RAGDOLL_BUDGET = {
  /** Awake ragdoll bodies at once. */
  awakeBodies: 300,
  /** Always a full ragdoll this close (m), in view or not (you might turn round). */
  near: 10,
  /** In view: full up to here (m), cheap beyond (when the body's size on screen isn't known). */
  fullInView: 35,
  /** In view: full while the body stands at least this share of the view's height (a 1.8 m body), cheap below. */
  fullScreen: 0.033,
  /**
   * A ragdoll stops simulating (frozen into a static pose) as soon as it comes to rest, or once it has had this long
   * (s) and is moving slower than `stillSpeed` (m/s, its torso): a body still rolling down a long hill carries on
   * (owner, 3 Nov: one stopped halfway down), up to `maxSeconds` at most.
   */
  fullSeconds: 3,
  cheapSeconds: 2,
  stillSpeed: 0.6,
  maxSeconds: 15,
  /**
   * Landed and lying still (torso slower than `restSpeed`, on the ground) for this long (s): frozen at once, whatever
   * its time (a body that has landed doesn't wait out the clock; round 3 of docs/PERF_96.md).
   */
  restSeconds: 0.35,
  restSpeed: 0.3,
  /** Fresh deaths whose bodies start in one frame at most (nearest and biggest on screen first; the rest wait a frame). */
  startsPerFrame: 6,
} as const;

/**
 * The tier a fresh death gets from where it is (before the budget). `screen`: the body's height as a share of the
 * view's (its distance and the field of view); without it, distance alone decides.
 */
export function tierFor(dist: number, inView: boolean, screen?: number): RagdollTier {
  if (dist <= RAGDOLL_BUDGET.near) return 'full';
  if (!inView) return 'posed';
  if (screen !== undefined) return screen >= RAGDOLL_BUDGET.fullScreen ? 'full' : 'cheap';
  return dist <= RAGDOLL_BUDGET.fullInView ? 'full' : 'cheap';
}

/** A standing body's height (1.8 m) as a share of the view's height, `dist` metres off with vertical field of view `fov`. */
export function screenShare(dist: number, fov: number): number {
  return 1.8 / (2 * Math.max(0.1, dist) * Math.tan(fov / 2));
}

const lower = (t: RagdollTier): RagdollTier => (t === 'full' ? 'cheap' : 'posed');

/** A ragdoll still moving, as the budget sees it. */
export interface MovingRagdoll {
  tier: RagdollTier;
  dist: number;
}

/**
 * Fit a new death into the budget. Returns the tier it gets and the moving
 * ragdolls to drop a tier (indices into `moving`, each dropped one tier, in
 * order), farthest first. Ragdolls farther than the new body make room before
 * the new body itself is lowered.
 */
export function fitBudget(want: RagdollTier, dist: number, moving: readonly MovingRagdoll[], budget: number = RAGDOLL_BUDGET.awakeBodies): { tier: RagdollTier; drop: number[] } {
  let awake = moving.reduce((n, r) => n + TIER_BODIES[r.tier], 0);
  const tiers = moving.map((r) => r.tier);
  const drop: number[] = [];
  let tier = want;
  const order = moving.map((r, i) => ({ i, dist: r.dist })).sort((a, b) => b.dist - a.dist);
  while (awake + TIER_BODIES[tier] > budget && tier !== 'posed') {
    // The farthest moving ragdoll beyond this one gives up a tier; when none is farther, this one does.
    const far = order.find((o) => tiers[o.i] !== 'posed' && o.dist > dist);
    if (far) {
      const from = tiers[far.i]!;
      tiers[far.i] = lower(from);
      awake -= TIER_BODIES[from] - TIER_BODIES[tiers[far.i]!];
      drop.push(far.i);
    } else tier = lower(tier);
  }
  return { tier, drop };
}
