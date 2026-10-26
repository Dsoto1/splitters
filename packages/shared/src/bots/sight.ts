import type { Vec3 } from '../math.ts';
import type { PhysicsWorld } from '../sim/physics.ts';
import { simProfile } from '../sim/profile.ts';

/** How long (ticks) a sight line between two actors' eyes is reused. */
export const SIGHT_TTL_TICKS = 6;
/** ...as long as neither eye has moved further than this (m) since it was cast. */
const SIGHT_SLACK = 0.6;

interface SightEntry {
  tick: number;
  /** Eyes of the lower and the higher actor ID when it was cast. */
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  ok: boolean;
}

/**
 * Line of sight between actors, shared by every bot in a match. Sight is
 * symmetric (A sees B's eye exactly when B sees A's), so a pair cast by one
 * bot answers the other too, and a result is reused for a few ticks while
 * both eyes stay put. In a big clumped fight each bot can see dozens of
 * enemies, and their perception runs a few ticks apart: this roughly halves
 * the rays. Deterministic: entries depend only on the simulation's state and
 * the order bots think in.
 */
export class SightCache {
  private readonly entries = new Map<number, SightEntry>();
  private sweepTick = 0;
  /** The level's shape the entries were cast in (PhysicsWorld.structureVersion). */
  private version = 0;
  hits = 0;
  misses = 0;

  constructor(private readonly physics: PhysicsWorld) {
    this.version = physics.structureVersion;
  }

  /** Can actor `a` (eye `ea`) see actor `b` (eye `eb`) at `tick`? */
  lineOfSight(tick: number, a: number, ea: Vec3, b: number, eb: Vec3): boolean {
    if (this.physics.structureVersion !== this.version) {
      // A door opened or closed, something broke or was built: every sight line may have changed.
      this.entries.clear();
      this.version = this.physics.structureVersion;
    }
    const lo = a < b;
    const key = lo ? a * 2097152 + b : b * 2097152 + a;
    const p = lo ? ea : eb;
    const q = lo ? eb : ea;
    let e = this.entries.get(key);
    if (e && tick - e.tick <= SIGHT_TTL_TICKS && near(e.ax, e.ay, e.az, p) && near(e.bx, e.by, e.bz, q)) {
      this.hits++;
      if (simProfile.on) simProfile.count('losShared');
      return e.ok;
    }
    this.misses++;
    const ok = this.physics.lineOfSight(p, q);
    if (!e) this.entries.set(key, (e = { tick, ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, ok }));
    e.tick = tick;
    e.ax = p.x;
    e.ay = p.y;
    e.az = p.z;
    e.bx = q.x;
    e.by = q.y;
    e.bz = q.z;
    e.ok = ok;
    // Drop old pairs now and then (actors die, leave, or stop looking at each other).
    if (tick - this.sweepTick > 120) {
      this.sweepTick = tick;
      for (const [k, v] of this.entries) if (tick - v.tick > SIGHT_TTL_TICKS) this.entries.delete(k);
    }
    return ok;
  }

  /** Forget everything (the level changed: a door, a wall broken, rebuilt forts). */
  clear(): void {
    this.entries.clear();
  }
}

function near(x: number, y: number, z: number, p: Vec3): boolean {
  const dx = x - p.x;
  const dy = y - p.y;
  const dz = z - p.z;
  return dx * dx + dy * dy + dz * dz <= SIGHT_SLACK * SIGHT_SLACK;
}
