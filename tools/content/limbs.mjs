// Limb measures for the limb audit (tools/content/limb-audit.mjs, docs/CHARACTER_LIMBS.md): how far a posed
// character's knees and ankles bow, and which way its elbows point, from its joints' world positions and its drawn
// skin (client tools/limbProbe.ts). World metres, y up; every angle in degrees.
//
// The body's frame: across (from the left hip to the right, level), up, and forward (up × across, turned to the way
// the feet point). For each side, "out" is away from the body's middle.
//   kneeBow    in the front view, the knee's angle off the hip-to-ankle line, + outward (bow legs), − inward (knock knees)
//   shinOut    in the front view, the shin's lean off straight down, + its ankle further out than its knee
//   kneePoint  seen from above, the way the bent knee points: 0 straight ahead, + out, − in (null when the leg is
//              nearly straight: under BEND_MIN the hip-knee-ankle plane isn't defined)
//   footYaw    seen from above, the foot (ankle to ball) off straight ahead, + toes out
//   footRoll   the sole's tilt across (its drawn skin's lowest points), + inner edge up (standing on the outer edge:
//              the ankle bowed out)
//   skinBow    in the front view, the drawn shin's lean (its skin's upper half to lower half) minus the joints' shin,
//              + the drawn shin leans further out than its bones
//   elbow      the elbow's direction off the shoulder-to-hand line, round that line: 0 straight down, 90 straight out,
//              180 straight up, − inward (toward the chest)

/** Under this knee bend (degrees) the leg plane, and so kneePoint, isn't defined. */
export const BEND_MIN = 4;
/** An elbow is wrong when it points more than this up from straight out (degrees), or in by more than ELBOW_IN. */
export const ELBOW_UP = 100;
export const ELBOW_IN = -10;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const neg = (a) => [-a[0], -a[1], -a[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const deg = (r) => (r * 180) / Math.PI;
const round = (v) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const UP = [0, 1, 0];

/** The body's frame from its joints: across (left hip to right, level), up, forward (toward the toes). */
export function bodyFrame(j) {
  const a = sub(j.thigh_r, j.thigh_l);
  const across = unit([a[0], 0, a[2]]);
  let forward = cross(UP, across);
  const toes = [j.ball_l && j.foot_l ? sub(j.ball_l, j.foot_l) : [0, 0, 0], j.ball_r && j.foot_r ? sub(j.ball_r, j.foot_r) : [0, 0, 0]];
  if (dot(forward, toes[0]) + dot(forward, toes[1]) < 0) forward = neg(forward);
  return { across, up: UP, forward };
}

/** In the front view (out and up), a vector's lean off straight down, + outward. */
const frontLean = (v, out) => deg(Math.atan2(dot(v, out), -dot(v, UP)));

/** One leg's measures (side 'l' or 'r'); `skin` is limbProbe's samples, optional. */
export function legMeasures(j, side, frame = bodyFrame(j), skin = {}) {
  const out = side === 'r' ? frame.across : neg(frame.across);
  const hip = j[`thigh_${side}`];
  const knee = j[`calf_${side}`];
  const ankle = j[`foot_${side}`];
  const ball = j[`ball_${side}`];
  const thigh = sub(knee, hip);
  const shin = sub(ankle, knee);
  const shinOut = frontLean(shin, out);
  const kneeBow = frontLean(thigh, out) - shinOut;
  const bend = deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(thigh), unit(shin))))));
  let kneePoint = null;
  if (bend >= BEND_MIN) {
    // The knee off the hip-to-ankle line, seen from above.
    const line = unit(sub(ankle, hip));
    const k = sub(thigh, scale(line, dot(thigh, line)));
    kneePoint = deg(Math.atan2(dot(k, out), dot(k, frame.forward)));
  }
  const toe = ball ? sub(ball, ankle) : null;
  const footYaw = toe ? deg(Math.atan2(dot(toe, out), dot(toe, frame.forward))) : null;
  let footRoll = null;
  const sole = skin[`foot_${side}`];
  if (sole) {
    // The sole's two side ends: the outer one is further out.
    const [inner, outer] = dot(sub(sole.soleRight, sole.soleLeft), out) > 0 ? [sole.soleLeft, sole.soleRight] : [sole.soleRight, sole.soleLeft];
    const width = Math.abs(dot(sub(outer, inner), out));
    if (width > 1e-4) footRoll = deg(Math.atan2(inner[1] - outer[1], width));
  }
  const calf = skin[`calf_${side}`];
  const skinBow = calf ? frontLean(sub(calf.lower, calf.upper), out) - shinOut : null;
  return { kneeBow: round(kneeBow), shinOut: round(shinOut), bend: round(bend), kneePoint: round(kneePoint), footYaw: round(footYaw), footRoll: round(footRoll), skinBow: round(skinBow) };
}

/** One arm's elbow direction (side 'l' or 'r'): degrees round the shoulder-to-hand line from straight down, + out. */
export function elbowMeasure(j, side, frame = bodyFrame(j)) {
  const out = side === 'r' ? frame.across : neg(frame.across);
  const s = j[`upperarm_${side}`];
  const e = j[`lowerarm_${side}`];
  const h = j[`hand_${side}`];
  const d = unit(sub(h, s));
  const se = sub(e, s);
  const b = sub(se, scale(d, dot(se, d)));
  if (len(b) < 1e-4) return { elbow: null, bend: 0 };
  const bu = unit(b);
  const bend = deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(se), unit(sub(h, e)))))));
  return { elbow: round(deg(Math.atan2(dot(bu, out), -dot(bu, UP)))), bend: round(bend), forward: round(dot(bu, frame.forward)) };
}

/** Whether an elbow direction is wrong: up, or in toward the chest. */
export const elbowWrong = (a) => a !== null && (a > ELBOW_UP || a < ELBOW_IN);

/** A posed character's measures: both legs and both elbows, and its scores (worst leg value, worst elbow excess). */
export function limbMeasures({ joints, skin = {} }) {
  const frame = bodyFrame(joints);
  const legs = { l: legMeasures(joints, 'l', frame, skin), r: legMeasures(joints, 'r', frame, skin) };
  const arms = { l: elbowMeasure(joints, 'l', frame), r: elbowMeasure(joints, 'r', frame) };
  const legScore = Math.max(
    ...['l', 'r'].flatMap((s) => {
      const m = legs[s];
      return [Math.abs(m.kneeBow ?? 0), Math.abs(m.shinOut ?? 0), Math.abs(m.footRoll ?? 0), Math.abs(m.skinBow ?? 0), Math.abs(m.kneePoint ?? 0) / 3];
    }),
  );
  const excess = (a) => (a === null ? 0 : a > ELBOW_UP ? a - ELBOW_UP : a < ELBOW_IN ? ELBOW_IN - a : 0);
  const elbowScore = Math.max(excess(arms.l.elbow), excess(arms.r.elbow));
  return { legs, arms, legScore: round(legScore), elbowScore: round(elbowScore) };
}

const median = (xs) => {
  const s = xs.filter((x) => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};
/** The measures a character's legs are ranked by: how far each is from the roster's median (the shared clips' own pose). */
const LEG_KEYS = [
  ['kneeBow', 1],
  ['shinOut', 1],
  ['kneePoint', 1 / 3],
  ['footYaw', 1 / 3],
  ['footRoll', 1],
  ['skinBow', 1],
];

/**
 * Rows ({ legs, arms, elbowScore, ... } from limbMeasures) ranked worst first. Every pickable body plays the same
 * clips on joints at the rig's rest rotations, so their joints' pose is nearly the same; what sets one apart is how far
 * it is from the roster's median: `score.legs` is the largest such distance (knee points and foot yaw a third), with
 * `score.worst` naming it. Elbows past the wrong line come first.
 */
export function rankLimbs(rows) {
  const med = {};
  for (const [k] of LEG_KEYS) for (const s of ['l', 'r']) med[`${k}_${s}`] = median(rows.map((r) => r.legs[s][k]));
  for (const r of rows) {
    let legs = 0;
    let worst = '';
    for (const [k, w] of LEG_KEYS)
      for (const s of ['l', 'r']) {
        const v = r.legs[s][k];
        if (v === null) continue;
        const d = Math.abs(v - med[`${k}_${s}`]) * w;
        if (d > legs) ((legs = d), (worst = `${k} ${s.toUpperCase()}`));
      }
    r.score = { legs: round(legs), worst };
  }
  return [...rows].sort((a, b) => b.elbowScore - a.elbowScore || b.score.legs - a.score.legs);
}

/** The audit's table (markdown), worst first, with the roster's medians on top. */
export function limbTable(rows) {
  const ranked = rankLimbs(rows);
  const f = (v) => (v === null || v === undefined ? '–' : String(v));
  const pair = (r, k) => `${f(r.legs.l[k])} / ${f(r.legs.r[k])}`;
  const med = (k, s) => median(rows.map((r) => r.legs[s][k]));
  const medArm = (s) => median(rows.map((r) => r.arms[s].elbow));
  return [
    '| # | Look | Legs (off median) | worst | Elbows | knee bow L/R | shin out L/R | knee points L/R | foot yaw L/R | sole roll L/R | skin bow L/R | elbow L/R |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    `| | **roster median** (${rows.length}) | | | | ${med('kneeBow', 'l')} / ${med('kneeBow', 'r')} | ${med('shinOut', 'l')} / ${med('shinOut', 'r')} | ${med('kneePoint', 'l')} / ${med('kneePoint', 'r')} | ${med('footYaw', 'l')} / ${med('footYaw', 'r')} | ${med('footRoll', 'l')} / ${med('footRoll', 'r')} | ${med('skinBow', 'l')} / ${med('skinBow', 'r')} | ${medArm('l')} / ${medArm('r')} |`,
    ...ranked.map((r, i) => `| ${i + 1} | ${r.name} (\`${r.id}\`) | ${r.score.legs} | ${r.score.worst} | ${r.elbowScore} | ${pair(r, 'kneeBow')} | ${pair(r, 'shinOut')} | ${pair(r, 'kneePoint')} | ${pair(r, 'footYaw')} | ${pair(r, 'footRoll')} | ${pair(r, 'skinBow')} | ${f(r.arms.l.elbow)} / ${f(r.arms.r.elbow)} |`),
  ].join('\n');
}
