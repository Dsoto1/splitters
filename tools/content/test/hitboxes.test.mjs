// Measured hit shapes against the models themselves (tools/content/hitboxes.mjs, packages/shared/src/sim/hitbox.ts):
// the head sphere is where the drawn head is (a short, a tall and a hunched look), zones come from the shape a ray
// meets, and the audit: every look's shapes match its posed model's bounds within a tolerance.
import { describe, expect, it } from 'vitest';
import { MEASURED_HITBOXES } from '../../../packages/shared/src/content/hitboxes.generated.ts';
import { BODY_SIZES } from '../../../packages/shared/src/sim/constants.ts';
import { lookHitbox, rayBody, lastHit } from '../../../packages/shared/src/sim/hitbox.ts';
import { hitZone } from '../../../packages/shared/src/sim/weapons.ts';
import { getLook } from '../../../packages/shared/src/content/looks.ts';
import { outsideShapes, pointsOf, subjects } from '../hitboxes.mjs';

const subjectList = await subjects();
const subject = (key) => subjectList.find((s) => s.key === key);

/** The middle of a cloud of points. */
const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length, a[2] + p[2] / pts.length], [0, 0, 0]);

/** A body standing at `feet`, facing `yaw`, at its size class's scale: body-frame points (right, up, forward) to the world. */
function placed(look, feet, yaw) {
  const { box, scale } = lookHitbox(look);
  const k = scale * BODY_SIZES[getLook(look).size ?? 'standard'].scale;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const world = ([x, y, z]) => ({ x: feet.x + (x * cos + z * sin) * k, y: feet.y + y * k, z: feet.z + (-x * sin + z * cos) * k });
  return { body: { feet, yaw, stance: 0, scale: k, box }, world, k };
}

/** A ray from `from` through `to` (unit direction). */
function ray(from, to) {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const l = Math.hypot(d.x, d.y, d.z);
  return { o: from, d: { x: d.x / l, y: d.y / l, z: d.z / l } };
}

describe('head spheres where the heads are drawn', () => {
  // A small look (1.40 m), a large one (2.12 m) and hunched ones (heads low and ahead of the feet).
  for (const look of ['core.biscuit', 'core.abe', 'core.hyena', 'core.croakley']) {
    it(`${look}: a shot at its drawn head is a head shot, from the front and either side`, async () => {
      const { reg } = await pointsOf(subject(look));
      const head = centroid(reg.head);
      const top = Math.max(...reg.head.map((p) => p[1]));
      const feet = { x: 4, y: 1, z: -3 };
      const yaw = 0.7;
      const { body, world } = placed(look, feet, yaw);
      const at = world(head);
      // (From behind, a hunched back stands in front of the head.)
      for (const turn of [0, Math.PI / 2, -Math.PI / 2]) {
        // From 6 m away, level with the head, round the body.
        const from = { x: at.x + Math.sin(yaw + turn) * 6, y: at.y, z: at.z + Math.cos(yaw + turn) * 6 };
        const { o, d } = ray(from, at);
        const t = rayBody(o, d, body);
        expect(t, `${look} turn ${turn}`).not.toBeNull();
        expect(lastHit.zone, `${look} turn ${turn}`).toBe(1);
      }
      // Over the top of the drawn head (5 cm above it) nothing is hit.
      const over = world([head[0], top + 0.05 / body.scale, head[2]]);
      const { o, d } = ray({ x: over.x + 6, y: over.y, z: over.z }, over);
      expect(rayBody(o, d, body)).toBeNull();
    });
  }

  it('a small look: its shoulders are body, where the old fixed 0.32 m head band called them head', async () => {
    const look = 'core.sprout';
    const { reg } = await pointsOf(subject(look));
    const headLow = Math.min(...reg.head.map((p) => p[1]));
    // The top of the torso (shoulder line), just below the head.
    const shoulder = reg.torso.filter((p) => p[1] < headLow && p[1] > headLow - 0.12);
    const s = centroid(shoulder);
    const feet = { x: 0, y: 0, z: 0 };
    const { body, world, k } = placed(look, feet, 0);
    const at = world(s);
    const { o, d } = ray({ x: at.x, y: at.y, z: at.z + 6 }, at);
    expect(rayBody(o, d, body)).not.toBeNull();
    expect(lastHit.zone).toBe(0);
    // The old bands on a 1.40 m body: anything in the top 0.32 m was a head shot.
    expect(hitZone(feet, at.y, 1.8 * k)).toBe(1);
  });
});

describe('zones come from the shape a ray meets', () => {
  it('head sphere: head; torso and arms: body; thighs and shins: legs, standing, crouching and prone', () => {
    for (const look of ['core.ranger', 'core.abe', 'core.biscuit']) {
      const { box } = lookHitbox(look);
      for (const [stance, s] of [[0, box.stand], [1, box.crouch ?? box.stand], [2, box.prone ?? box.stand]]) {
        const body = { feet: { x: 0, y: 0, z: 0 }, yaw: 0, stance, scale: 1, box };
        const shoot = (p) => {
          // From straight above (prone bodies lie flat) or from in front.
          const from = stance === 2 ? { x: p[0], y: p[1] + 5, z: p[2] } : { x: p[0], y: p[1], z: p[2] + 6 };
          const { o, d } = ray(from, { x: p[0], y: p[1], z: p[2] });
          return rayBody(o, d, body) === null ? null : lastHit.zone;
        };
        expect(shoot([s.head.x, s.head.y, s.head.z]), `${look} ${stance} head`).toBe(1);
        const mid = [s.torso.x, (s.torso.a[0] + s.torso.b[0]) / 2, (s.torso.a[1] + s.torso.b[1]) / 2];
        // Arms held in front can be met first: either way the torso's zone is body.
        expect(shoot(mid), `${look} ${stance} torso`).toBe(0);
        for (const l of s.legs) {
          const p = [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2, (l.a[2] + l.b[2]) / 2];
          const z = shoot(p);
          // A leg seen from in front may be behind an arm or the torso's skirt: never a head.
          expect(z, `${look} ${stance} leg`).not.toBe(1);
        }
      }
    }
  });

  it('every stance has shapes for every look on the roster', () => {
    for (const [key, box] of Object.entries(MEASURED_HITBOXES)) {
      expect(box.stand.head ?? box.stand.torso, key).toBeTruthy();
      if (!box.creature) {
        expect(box.crouch, key).not.toBeNull();
        expect(box.prone, key).not.toBeNull();
      }
    }
  });
});

describe('hitbox audit: shapes match each model (posed as the game draws it standing)', () => {
  // Tolerances (m at a 1.8 m body): the shapes' top and bottom against the model's (1st and 99th percentile of its
  // vertices), the head sphere's centre against the drawn head's middle, and the share of the model's vertices
  // inside the shapes (with 4 cm of slack: ears, horns, brims, fingers and hems stick out).
  const TOP = 0.1;
  // A pointed hat's tip or a horn may stand over the head sphere by this much.
  const TOP_SHORT = 0.12;
  const BOTTOM = 0.12;
  const HEAD = 0.1;
  const COVER = 0.85;
  const CREATURE_COVER = 0.7;
  it('every look and creature', { timeout: 240_000 }, async () => {
    const bad = [];
    const report = [];
    for (const sub of subjectList) {
      const box = MEASURED_HITBOXES[sub.key];
      if (!box) {
        bad.push(`${sub.key}: no shapes`);
        continue;
      }
      const { reg } = await pointsOf(sub);
      const all = [...reg.head, ...reg.torso, ...reg.thigh, ...reg.shin, ...reg.arm];
      const s = box.stand;
      // The model's top and bottom: each part's own 99th / 1st percentile (a head is a small share of a body's vertices).
      const pct = (list, p) => {
        const ys = list.map((v) => v[1]).sort((a, b) => a - b);
        return ys[Math.min(ys.length - 1, Math.floor(ys.length * p))];
      };
      const parts = Object.values(reg).filter((l) => l.length >= 8);
      const lo = Math.max(0, Math.min(...parts.map((l) => pct(l, 0.01))));
      const hi = Math.max(...parts.map((l) => pct(l, 0.99)));
      let top = -Infinity;
      let bottom = Infinity;
      const span = (y, r) => {
        top = Math.max(top, y + r);
        bottom = Math.min(bottom, y - r);
      };
      if (s.head) span(s.head.y, s.head.r);
      if (s.torso) {
        span(s.torso.a[0], s.torso.r);
        span(s.torso.b[0], s.torso.r);
      }
      for (const l of [...s.legs, ...s.arms]) {
        span(l.a[1], l.r);
        span(l.b[1], l.r);
      }
      const inside = all.filter((p) => outsideShapes(p, { head: s.head ?? null, torso: s.torso ? { ...s.torso, a: [...s.torso.a], b: [...s.torso.b] } : null, legs: s.legs, arms: s.arms }) <= 0.04).length / all.length;
      const headOff = s.head && reg.head.length ? Math.hypot(...centroid(reg.head).map((v, i) => v - [s.head.x, s.head.y, s.head.z][i])) : 0;
      const line = `${sub.key}: top ${(top - hi).toFixed(2)} bottom ${(bottom - lo).toFixed(2)} head ${headOff.toFixed(2)} inside ${(inside * 100).toFixed(0)}%`;
      report.push(line);
      // Below the ground nothing can be hit: shapes reaching under the feet are not counted.
      bottom = Math.max(bottom, Math.min(lo, 0));
      // Creatures (aliens with spines and tentacles) are held to a looser cover.
      if (top - hi > TOP || hi - top > TOP_SHORT || bottom - lo > BOTTOM || headOff > HEAD || inside < (sub.creature ? CREATURE_COVER : COVER)) bad.push(line);
    }
    if (process.env.HITBOX_AUDIT) console.log(report.join('\n'));
    expect(bad).toEqual([]);
  });
});
