/**
 * Dual wielding in first person (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield", step 3): the numbers and the small
 * decisions the view makes for a pair, kept free of the scene so they can be tested.
 *
 * The second gun is the first one seen in a mirror: it hangs under a node on the camera whose X is flipped
 * (`MIRROR_X`), with its own arm (the same character's right arm, mirrored into a left one) gripping it by the
 * ordinary grip code. So everything the left gun does is worked out as if it were a right-hand gun and comes out
 * mirrored; only motions that belong to the body (the walk's sideways sway) are flipped back first.
 */

/** The mirror the second gun and its arm hang under: camera space with X flipped. */
export const MIRROR_X = -1;

/** A camera-space point as it is drawn under the mirror, and back (the mirror is its own inverse). */
export const mirrored = <T extends { x: number }>(p: T): T => ({ ...p, x: p.x * MIRROR_X });

/**
 * Where a pair's guns sit from the single gun's hip place (m, camera space): a little further out, so the middle of
 * the screen (the crosshair and what you shoot at) stays clear between them, and a little higher, so the hands on the
 * grips stay in view above the HUD's corner panels (lower, they sat behind the health and ammunition panels).
 */
export const PAIR_POSE = { wider: 0.02, higher: 0.02, nearer: 0 } as const;

/** The right gun's hip place in a pair, `amount` (0..1) of the way from the single gun's `offset` (view.viewOffset). */
export function pairPlace(offset: readonly [number, number, number], amount: number): { x: number; y: number; z: number } {
  return { x: offset[0] + PAIR_POSE.wider * amount, y: offset[1] + PAIR_POSE.higher * amount, z: offset[2] - PAIR_POSE.nearer * amount };
}

/** How far (m) a gun of a pair drops below its place while it is away (not yet raised, or put away), out of view. */
export const PAIR_AWAY_DROP = 0.42;
/** Seconds the second gun takes to go down when the pair ends (the fire-mode key): quicker than it came up. */
export const PAIR_LOWER_SECONDS = 0.18;

/**
 * The second gun's rise (0 away .. 1 up) a frame on: up over the pair's raise (`raiseSeconds`: the weapon's raise ×
 * the trade's `raise`), down over PAIR_LOWER_SECONDS.
 */
export function stepPairUp(up: number, on: boolean, dt: number, raiseSeconds: number): number {
  if (on) return Math.min(1, up + dt / Math.max(0.05, raiseSeconds));
  return Math.max(0, up - dt / PAIR_LOWER_SECONDS);
}

/** 0..1 eased (slow out of the hand's rest, slow into place). */
export const easeUp = (t: number): number => t * t * (3 - 2 * t);

/**
 * A reload with one hand: the gun being reloaded goes down out of view, tipped muzzle-up and rolled outward, and
 * comes back (`amount` 0..1: how far into the dip). No magazine hand: the other hand has its own gun.
 */
export function pairReloadDip(amount: number): { drop: number; pitch: number; roll: number } {
  const a = easeUp(Math.max(0, Math.min(1, amount)));
  return { drop: a * 0.34, pitch: a * 0.7, roll: a * 0.35 };
}

/** How far into its reload dip a gun is, from its reload's ticks left and its length: in over `edge` ticks, out over the last `edge`. */
export function reloadDipAmount(ticksLeft: number, total: number, edge = 10): number {
  if (ticksLeft <= 0) return 0;
  return Math.max(0, Math.min(1, ticksLeft / edge, (total - ticksLeft) / edge));
}

/** Which gun of a pair a shot left: the second gun's is the left one. */
export const shotGun = (shot: { off?: boolean }, paired: boolean): 'left' | 'right' => (paired && shot.off ? 'left' : 'right');

/** The sideways throw of a spent case (1 to the right, -1 to the left): each gun throws away from the other. */
export const casingSide = (gun: 'left' | 'right'): 1 | -1 => (gun === 'left' ? -1 : 1);

/**
 * Stereo place (-1 left .. 1 right) of your own gun's sounds: a pair's are spread a little to the hand that made
 * them, one gun's stay in the middle as ever.
 */
export const PAIR_PAN = 0.35;
export function gunPan(paired: boolean, gun: 'left' | 'right'): number {
  if (!paired) return 0;
  return gun === 'left' ? -PAIR_PAN : PAIR_PAN;
}

/**
 * Reduce flashing with a pair (docs/LOOK.md): two guns may not be brighter than one, nor flicker faster than one.
 * So with the setting on, the pair shares one flash: a round's flash is drawn only when no flash of either gun was
 * drawn within the gun's own firing interval (so never two at once, and never more often than one gun fires).
 * Both triggers on the same tick take turns, so neither hand looks dead. The kick, the case and the sound of the
 * round whose flash is left out still happen. With the setting off every round flashes, as one gun's do.
 */
export class PairFlashGate {
  private lastTick = -Infinity;
  private lastGun: 'left' | 'right' | null = null;
  /** Both guns fired on this tick: whose flash was chosen (null: neither, the shared flash was inside its interval). */
  private pick: { tick: number; gun: 'left' | 'right' | null } | null = null;

  /**
   * Whether the round `gun` fired on `tick` draws its flash. `interval`: the weapon's ticks between rounds.
   * `calm`: Reduce flashing is on. `together`: the other gun fired on this tick too. A single gun (not `paired`)
   * always flashes: its own rate is the limit.
   */
  allow(o: { tick: number; gun: 'left' | 'right'; interval: number; paired: boolean; calm: boolean; together?: boolean }): boolean {
    if (!o.paired || !o.calm) {
      this.lastTick = o.tick;
      this.lastGun = o.gun;
      return true;
    }
    // (A tick counter that started again, a new match: nothing is held against it.)
    if (o.tick < this.lastTick) this.reset();
    if (o.together) {
      if (this.pick?.tick !== o.tick) {
        const free = o.tick - this.lastTick >= Math.max(1, o.interval);
        this.pick = { tick: o.tick, gun: free ? (this.lastGun === 'right' ? 'left' : 'right') : null };
        if (free) this.take(o.tick, this.pick.gun!);
      }
      return this.pick.gun === o.gun;
    }
    if (o.tick - this.lastTick < Math.max(1, o.interval)) return false;
    this.take(o.tick, o.gun);
    return true;
  }

  private take(tick: number, gun: 'left' | 'right'): void {
    this.lastTick = tick;
    this.lastGun = gun;
  }

  reset(): void {
    this.lastTick = -Infinity;
    this.lastGun = null;
    this.pick = null;
  }
}

/**
 * Third person (step 4): where each gun of a pair is held, from its own shoulder in the aim's frame, as shares of the
 * arm's reach (so a long-armed body holds them as far out as a short one, for its size): ahead along the aim, down,
 * and out to the gun's own side (negative: in toward the middle). Each gun is held in one hand at a little under
 * arm's length, the two about shoulder width apart and level with the aim, under the line of the eyes.
 */
export const PAIR_HOLD_3P = { ahead: 0.86, down: 0.2, out: -0.06 } as const;

/**
 * A gun of a pair held in third person, `dip` (0..1) of the way into its lowered place (the second gun before it is
 * up, or a gun being reloaded): drawn back toward the chest and lower, its muzzle tipped up (`pitch`, radians) and
 * rolled outward (`roll`), as the first-person dip does (pairReloadDip).
 */
export function pairHold3p(dip: number): { ahead: number; down: number; out: number; pitch: number; roll: number } {
  const a = easeUp(Math.max(0, Math.min(1, dip)));
  return { ahead: PAIR_HOLD_3P.ahead - a * 0.3, down: PAIR_HOLD_3P.down + a * 0.32, out: PAIR_HOLD_3P.out + a * 0.04, pitch: a * 0.7, roll: a * 0.35 };
}

/**
 * The shooters in a message's events whose pair's two guns both fired in it (a `shot` with `off` and one without):
 * other players' rounds come a snapshot at a time, so their two guns' rounds of a tick (or two) arrive together, and
 * their shared flash under Reduce flashing must take turns between the guns, as yours does (PairFlashGate `together`),
 * or the gun listed first would take every flash.
 */
export function bothGunsFired(events: readonly { e: string }[]): Set<number> {
  const first = new Set<number>();
  const second = new Set<number>();
  for (const ev of events) {
    if (ev.e !== 'shot') continue;
    const shot = ev as { e: 'shot'; s: number; off?: 1 };
    (shot.off ? second : first).add(shot.s);
  }
  const both = new Set<number>();
  for (const s of second) if (first.has(s)) both.add(s);
  return both;
}
