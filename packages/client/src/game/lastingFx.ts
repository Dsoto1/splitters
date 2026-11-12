import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec3 } from '@tiletrigger/shared';
import type { GodotVfx, VfxHandle } from './godotVfx.ts';
import { lastingFx } from './fxMap.ts';

/** How a lasting effect is placed this frame. */
export interface LastingPlace {
  /** Times the map's scale (content/vfx.json map.lasting). */
  size?: number;
  /** Strength 0..1 (fading in or out with what it shows). */
  level?: number;
  /** Turned so its up follows this. */
  up?: Vec3;
  /** Held still, without its particles (Reduce flashing's steady glow; GodotVfx `steady`). Changing it starts the effect again. */
  steady?: boolean;
}

interface Want {
  id: string;
  key: string;
  at: Vec3;
  place: LastingPlace;
  seen: number;
}

/**
 * A request not repeated for this long is dropped (owners that update at snapshot rate, not every frame), unless it
 * was made since the last update: on a page drawing fewer than three frames a second, an owner that asks after the
 * frame's update (pickups) was dropped and started again every frame, its effect never past fading in.
 */
const KEEP_MS = 300;
/** Lasting effects further than this from the camera aren't drawn (their plain look stands in). */
const RANGE = 70;
/** Pickup glows count as this much further off when places are handed out. */
const LOOT_FAR = 2.5;
/** Pickup glows take at most this share of the lasting effects the graphics quality allows (low 2, medium 5, high 8). */
const LOOT_SHARE = 0.5;

/**
 * Lasting pack effects for things that burn, glow or crackle while they last (content/vfx.json map.lasting):
 * owners ask every frame (`want`) for an effect at a spot, by an id of their own; `update` draws the nearest of
 * them, as many as the graphics quality lets GodotVfx run at once, and stops the rest (their owners' plain look
 * stands in: `drawn` says which). Pooled by id: an effect is started once and moved, not remade each frame.
 */
export class LastingFx {
  private readonly wants = new Map<string, Want>();
  private readonly live = new Map<string, { h: VfxHandle; fx: string; steady: boolean }>();

  /** When `update` last ran (ms). */
  private updated = 0;

  constructor(private readonly vfx: GodotVfx) {}

  /** Ask for the effect `key` (`fire.zone` …) under `id` (one per thing) at `at` this frame. */
  want(id: string, key: string, at: Vec3, place: LastingPlace = {}): void {
    const w = this.wants.get(id);
    if (w) {
      w.key = key;
      w.at = at;
      w.place = place;
      w.seen = performance.now();
    } else this.wants.set(id, { id, key, at, place, seen: performance.now() });
  }

  /** Whether `id`'s effect is drawn now (else its owner's plain look should show). */
  drawn(id: string): boolean {
    const l = this.live.get(id);
    return !!l && !l.h.done;
  }

  /** Draw the nearest wanted effects, stop the rest. */
  update(cam: Vec3): void {
    const now = performance.now();
    for (const [id, w] of this.wants) if (now - w.seen > KEEP_MS && w.seen < this.updated) this.wants.delete(id);
    this.updated = now;
    // Nearest first; the far ones and the ones no longer wanted give their places up first.
    const order = [...this.wants.values()]
      .map((w) => ({ w, d: Math.hypot(w.at.x - cam.x, w.at.y - cam.y, w.at.z - cam.z) }))
      .filter((x) => x.d <= RANGE)
      // Hazards (fire, charge, gas) before decoration (a pickup's glow): a glow counts as LOOT_FAR times as far off,
      // and a decor effect (a fire prop's flame) comes after all of them, nearest first among its own.
      .map((x) => ({ ...x, d: x.w.key.startsWith('loot.') ? x.d * LOOT_FAR : x.d, decor: !!lastingFx(x.w.key)?.decor }))
      .sort((a, b) => Number(a.decor) - Number(b.decor) || a.d - b.d);
    const room = this.vfx.loopRoom + this.live.size;
    // Pickup glows take at most LOOT_SHARE of the places, however many pickups are near.
    const lootRoom = Math.floor(room * LOOT_SHARE);
    const keep = new Set<Want>();
    let loot = 0;
    for (const { w } of order) {
      if (keep.size >= room) break;
      if (w.key.startsWith('loot.') && loot++ >= lootRoom) continue;
      keep.add(w);
    }
    for (const [id, l] of this.live) {
      const w = this.wants.get(id);
      if (!w || !keep.has(w) || l.h.done || l.fx !== w.key || l.steady !== !!w.place.steady) {
        l.h.stop();
        this.live.delete(id);
      }
    }
    for (const { w } of order) {
      if (!keep.has(w)) continue;
      const ref = lastingFx(w.key);
      if (!ref) continue;
      const at = new Vector3(w.at.x, w.at.y, w.at.z);
      const place = { scale: ref.scale * (w.place.size ?? 1), ...(w.place.up ? { up: new Vector3(w.place.up.x, w.place.up.y, w.place.up.z) } : {}) };
      const tint = ref.tint ? { tint: ref.tint } : {};
      const id = w.id;
      let l = this.live.get(id);
      if (!l) {
        const steady = !!w.place.steady;
        const h = this.vfx.start(ref.pack, ref.effect, at, { ...place, ...tint, ...(ref.skip ? { skip: ref.skip } : {}), ...(steady ? { steady } : {}) });
        if (!h) continue;
        this.live.set(id, (l = { h, fx: w.key, steady }));
      } else l.h.move(at, place);
      l.h.setLevel(w.place.level ?? 1);
    }
  }

  /** How many are drawn (tests and the performance report). */
  get count(): number {
    return this.live.size;
  }

  dispose(): void {
    for (const l of this.live.values()) l.h.stop();
    this.live.clear();
    this.wants.clear();
  }
}
