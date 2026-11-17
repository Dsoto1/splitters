import { afterEach, describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Vec3 } from '@tiletrigger/shared';
import { following } from '../src/game/muzzleAnchor.ts';
import { SteadyArcs } from '../src/game/steadyArcs.ts';
import { createBeam, layBeam } from '../src/game/arsenalVisuals.ts';

const engines: NullEngine[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.dispose();
});
function scene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

/**
 * A gun on a player who strafes at 7 m/s, turns and jumps, 60 frames a second: where its muzzle is at frame `f`.
 * (The hand-held gun sits 0.3 m right of and 0.5 m ahead of the eye, turning with the view.)
 */
function muzzleAt(f: number): Vec3 {
  const t = f / 60;
  const yaw = Math.sin(t * 2.4) * 0.6;
  const eye = { x: 7 * t * (Math.floor(t / 0.66) % 2 ? -1 : 1), y: 1.6 + Math.max(0, Math.sin(t * 5)) * 0.9, z: 0 };
  return { x: eye.x + Math.cos(yaw) * 0.3 + Math.sin(yaw) * 0.5, y: eye.y - 0.2, z: eye.z - Math.sin(yaw) * 0.3 + Math.cos(yaw) * 0.5 };
}
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('effects that leave a muzzle stay on it', () => {
  it('following: the anchor each time, the last point it gave while the gun is gone, else where it began', () => {
    const from = { x: 1, y: 2, z: 3 };
    expect(following(from)()).toEqual(from);
    let at: Vec3 | null = { x: 5, y: 5, z: 5 };
    const start = following(from, () => at);
    expect(start()).toEqual({ x: 5, y: 5, z: 5 });
    at = null;
    expect(start()).toEqual({ x: 5, y: 5, z: 5 });
    expect(following(from, () => null)()).toEqual(from);
  });

  it("a steady beam (Reduce flashing: freeze ray, lasers) starts on the muzzle every frame while you strafe, turn and jump; only its far end glides", () => {
    const arcs = new SteadyArcs(scene());
    const target = { x: 0, y: 1.2, z: 30 };
    let f = 0;
    const worst = { anchored: 0, unanchored: 0 };
    for (; f < 120; f++) {
      const now = f * (1000 / 60);
      // A shot every 3 ticks (the freeze ray), each from the muzzle where it was fired.
      if (f % 3 === 0) {
        arcs.hit('anchored', [muzzleAt(f), target], '#bff0ff', now, () => muzzleAt(f));
        arcs.hit('unanchored', [muzzleAt(f), target], '#bff0ff', now);
      }
      arcs.update(now);
      if (f < 10) continue;
      worst.anchored = Math.max(worst.anchored, dist(arcs.start('anchored')!, muzzleAt(f)));
      worst.unanchored = Math.max(worst.unanchored, dist(arcs.start('unanchored')!, muzzleAt(f)));
    }
    // Before (no anchor, as all beams were): the start glided up to tens of centimetres behind the gun.
    expect(worst.unanchored).toBeGreaterThan(0.15);
    expect(worst.anchored).toBeLessThan(1e-6);
  });

  it('a one-shot beam (a laser, the railgun) laid from the muzzle each frame keeps its start there and its end on the hit', () => {
    const s = scene();
    const beam = createBeam(s, '#ff3b4a', 0.04);
    const to = { x: 2, y: 1, z: 25 };
    for (let f = 0; f < 45; f++) {
      layBeam(beam, muzzleAt(f), to);
      beam.computeWorldMatrix(true);
      const m = beam.getWorldMatrix();
      const a = Vector3.TransformCoordinates(new Vector3(0, -0.5, 0), m);
      const b = Vector3.TransformCoordinates(new Vector3(0, 0.5, 0), m);
      expect(dist(a, muzzleAt(f))).toBeLessThan(1e-4);
      expect(dist(b, to)).toBeLessThan(1e-4);
    }
  });
});
