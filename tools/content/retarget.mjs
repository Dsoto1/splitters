// Clip retargeting: animation clips authored on a Meshy / Mixamo-named skeleton (a rigged Meshy "All Animations"
// download: `mixamorig:Hips`, `mixamorig:LeftArm`, ...) turned into clips on the game's own rig (rig.glb's joints,
// UE names), so every character built on that rig can play them: the Meshy characters (prepare-meshy-characters.mjs
// keeps the rig's joint orientations and moves only the joints' places) and the in-house rigged ones alike.
//
// Per frame and joint (all rotations world, quaternions [x, y, z, w], `qmul(a, b)` applies b then a):
//
//   rig(t) = src(t) · srcRest⁻¹ · repose⁻¹ · rigRest
//
// `src(t)` is the source joint's world rotation in the clip and `srcRest` at rest; `repose` is the turn that takes
// the source's rest pose (Meshy rigs stand in an A-pose, arms down and legs apart) to the rig's T-pose, worked out
// bone by bone exactly as prepare-meshy-characters.mjs re-poses the mesh (each listed bone turned onto the rig's
// direction, children carried along). So the clip's motion is applied to the rig's T-pose as it was to the source's
// rest pose: on the very character the clip came from, every vertex moves as it did in the download.
// Then each rig joint's local rotation is its world rotation under its rig parent's. The hips keep their height
// changes and sway, scaled from the source's legs to the rig's; their travel across the ground (root motion) is
// stripped, the clip plays in place and the game moves the body. Each clip's natural ground speed (m/s at the
// rig's size) is measured from its planted foot, so the game can play it at the speed that keeps the feet still.

/** Mixamo's joint names as Meshy's: Mixamo counts the spine up from the hips (Spine, Spine1, Spine2), Meshy down from the chest. */
const MIXAMO = { Spine: 'Spine02', Spine1: 'Spine01', Spine2: 'Spine', Neck: 'neck', HeadTop_End: 'head_end' };
export const meshyName = (name) => {
  const m = /^mixamorig\d*:(.+)$/.exec(name);
  return m ? (MIXAMO[m[1]] ?? m[1]) : name;
};

/** Each rig joint a clip drives, and the source joint (Meshy's name) it takes its motion from. Fingers are left to the game's grip. */
export const RIG_FROM_MESHY = {
  pelvis: 'Hips',
  spine_01: 'Spine02',
  spine_02: 'Spine01',
  spine_03: 'Spine',
  neck_01: 'neck',
  Head: 'Head',
  ...Object.fromEntries(
    ['l', 'r'].flatMap((s) => {
      const S = s === 'l' ? 'Left' : 'Right';
      return [
        [`clavicle_${s}`, `${S}Shoulder`],
        [`upperarm_${s}`, `${S}Arm`],
        [`lowerarm_${s}`, `${S}ForeArm`],
        [`hand_${s}`, `${S}Hand`],
        [`thigh_${s}`, `${S}UpLeg`],
        [`calf_${s}`, `${S}Leg`],
        [`foot_${s}`, `${S}Foot`],
        [`ball_${s}`, `${S}ToeBase`],
      ];
    }),
  ),
};

/** The bones turned from the source's rest pose to the rig's: [source joint, its child, rig joint, rig child] (prepare-meshy-characters.mjs REPOSE, feet included). */
export const REPOSE_BONES = ['l', 'r'].flatMap((s) => {
  const S = s === 'l' ? 'Left' : 'Right';
  return [
    [`${S}Arm`, `${S}ForeArm`, `upperarm_${s}`, `lowerarm_${s}`],
    [`${S}ForeArm`, `${S}Hand`, `lowerarm_${s}`, `hand_${s}`],
    [`${S}UpLeg`, `${S}Leg`, `thigh_${s}`, `calf_${s}`],
    [`${S}Leg`, `${S}Foot`, `calf_${s}`, `foot_${s}`],
    [`${S}Foot`, `${S}ToeBase`, `foot_${s}`, `ball_${s}`],
  ];
});

// ---------------------------------------------------------------- vector maths

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
export const qrot = (q, v) => {
  const t = scale(cross(q, v), 2);
  return add(add(v, scale(t, q[3])), cross(q, t));
};
/** The shortest rotation taking direction a onto direction b. */
export function qFromTo(a, b) {
  a = norm(a);
  b = norm(b);
  const d = dot(a, b);
  if (d < -0.9999) {
    const axis = norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
    return [...axis, 0];
  }
  const c = cross(a, b);
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(...q);
  return q.map((x) => x / l);
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) {
    const q = a.map((x, i) => x + (s * b[i] - x) * t);
    const l = Math.hypot(...q);
    return q.map((x) => x / l);
  }
  const th = Math.acos(d);
  const k0 = Math.sin((1 - t) * th) / Math.sin(th);
  const k1 = (s * Math.sin(t * th)) / Math.sin(th);
  return a.map((x, i) => x * k0 + b[i] * k1);
}
/** Angle (radians) between two rotations. */
export const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

// ---------------------------------------------------------------- skeletons and poses

/**
 * A skeleton: `names`, `parent` (index, -1 at the top) and each joint's rest `local` { t, q, s } (s uniform).
 * `world(skel, local)` is every joint's world { t, q, s } for a pose given as local transforms (parents first is not required).
 */
export function world(skel, local) {
  const out = new Array(skel.names.length);
  const visit = (i) => {
    if (out[i]) return out[i];
    const l = local[i];
    const p = skel.parent[i] >= 0 ? visit(skel.parent[i]) : { t: [0, 0, 0], q: [0, 0, 0, 1], s: 1 };
    out[i] = { t: add(p.t, qrot(p.q, scale(l.t, p.s))), q: qmul(p.q, l.q), s: p.s * (l.s ?? 1) };
    return out[i];
  };
  for (let i = 0; i < out.length; i++) visit(i);
  return out;
}

/**
 * The world turn that takes each source joint from its rest pose to the rig's stance (by Meshy name), as
 * prepare-meshy-characters.mjs re-poses a mesh: parents first, each joint takes its parent's turn, and the
 * bones in `bones` are then turned so they point the way the rig's do.
 */
export function reposeTurns(src, srcRest, rigWorldByName, bones = REPOSE_BONES) {
  const index = new Map(src.names.map((n, i) => [n, i]));
  const rot = new Array(src.names.length);
  const visit = (i) => {
    if (rot[i]) return rot[i];
    rot[i] = src.parent[i] >= 0 ? visit(src.parent[i]) : [0, 0, 0, 1];
    const rule = bones.find((b) => b[0] === src.names[i]);
    const child = rule && index.get(rule[1]);
    const [ra, rb] = rule ? [rigWorldByName.get(rule[2]), rigWorldByName.get(rule[3])] : [];
    if (child !== undefined && ra && rb) {
      const now = qrot(rot[i], sub(srcRest[child].t, srcRest[i].t));
      rot[i] = qmul(qFromTo(now, sub(rb.t, ra.t)), rot[i]);
    }
    return rot[i];
  };
  for (let i = 0; i < src.names.length; i++) visit(i);
  return new Map(src.names.map((n, i) => [n, rot[i]]));
}

/**
 * One retargeted frame: each rig joint in `map` (rig name → source name) gets its local rotation, from the source's
 * world pose this frame (`srcNow`, by source name), the source's rest (`srcRest`), the re-pose turns and the rig's
 * rest world pose (`rigRest`, by rig name; `rigParent`: rig name → its parent's rig name).
 */
export function retargetFrame(srcNow, srcRest, turns, rigRest, rigParent, map = RIG_FROM_MESHY) {
  const rigWorld = new Map();
  for (const [rig, from] of Object.entries(map)) {
    const now = srcNow.get(from);
    const rest = srcRest.get(from);
    if (!now || !rest || !rigRest.has(rig)) continue;
    rigWorld.set(rig, qmul(qmul(qmul(now.q, qinv(rest.q)), qinv(turns.get(from) ?? [0, 0, 0, 1])), rigRest.get(rig).q));
  }
  const local = new Map();
  for (const [rig, q] of rigWorld) {
    const parent = rigParent.get(rig);
    const pq = parent ? (rigWorld.get(parent) ?? rigRest.get(parent)?.q ?? [0, 0, 0, 1]) : [0, 0, 0, 1];
    local.set(rig, qmul(qinv(pq), q));
  }
  return local;
}

/**
 * Root motion stripped: positions (one [x, y, z] per frame, y up) with the straight-line travel from the first frame
 * to the last taken off across the ground, so the clip plays in place and loops; heights and sway are kept.
 */
export function stripRootMotion(positions) {
  const n = positions.length;
  if (n < 2) return positions.map((p) => [...p]);
  const [a, b] = [positions[0], positions[n - 1]];
  return positions.map((p, i) => {
    const t = i / (n - 1);
    return [p[0] - (b[0] - a[0]) * t, p[1], p[2] - (b[2] - a[2]) * t];
  });
}

/**
 * A clip's ground speed (m/s) and which way the body goes (unit [x, z]), from its feet in the body's own frame (in
 * place): the foot on the ground slides back under the body at the speed the body walks. Each frame the lower foot
 * (within `contact` m of the lowest any foot gets) gives its sideways speed; the median over frames is the speed.
 * `feet`: per foot, one [x, y, z] per frame; `dt` seconds between frames.
 */
export function plantedSpeed(feet, dt, contact = 0.03) {
  const n = feet[0].length;
  let low = Infinity;
  for (const f of feet) for (const p of f) low = Math.min(low, p[1]);
  const speeds = [];
  const dirs = [0, 0];
  for (let i = 1; i < n - 1; i++) {
    const f = feet.reduce((best, foot) => (foot[i][1] < best[i][1] ? foot : best));
    if (f[i][1] > low + contact) continue;
    const [p0, p1] = [f[i - 1], f[i + 1]];
    const v = [(p1[0] - p0[0]) / (2 * dt), (p1[2] - p0[2]) / (2 * dt)];
    speeds.push(Math.hypot(v[0], v[1]));
    dirs[0] -= v[0];
    dirs[1] -= v[1];
  }
  if (!speeds.length) return { speed: 0, dir: [0, 1] };
  speeds.sort((x, y) => x - y);
  const l = Math.hypot(dirs[0], dirs[1]) || 1;
  return { speed: speeds[Math.floor(speeds.length / 2)], dir: [dirs[0] / l, dirs[1] / l] };
}

/**
 * Where in its loop (0..1) a clip sets its left foot down: the frame its foot, having swung the way the body goes,
 * starts sliding back under it (the planted foot moves against the travel `dir`, [x, z]). `foot`: one [x, y, z] per
 * frame in the body's frame (in place). Gaits phase-lock on it (packages/client/src/game/gait.ts matchPhase).
 */
export function footDown(foot, dir) {
  const n = foot.length;
  const along = (i) => (foot[(i + 1) % n][0] - foot[i][0]) * dir[0] + (foot[(i + 1) % n][2] - foot[i][2]) * dir[1];
  let best = -1;
  let lowest = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const prev = along((i - 1 + n - 1) % (n - 1));
    if (prev > 0 && along(i) <= 0 && foot[i][1] < lowest) {
      lowest = foot[i][1];
      best = i;
    }
  }
  return best < 0 ? 0 : best / (n - 1);
}

/** Linear sampling of a keyed track (times ascending; values arrays of `size`; quaternions slerped). */
export function sampleTrack(times, values, size, t, quat = false) {
  const n = times.length;
  if (t <= times[0] || n === 1) return values.slice(0, size);
  if (t >= times[n - 1]) return values.slice((n - 1) * size, n * size);
  let i = 0;
  while (times[i + 1] < t) i++;
  const k = (t - times[i]) / (times[i + 1] - times[i] || 1);
  const a = values.slice(i * size, i * size + size);
  const b = values.slice((i + 1) * size, (i + 1) * size + size);
  return quat ? slerp(a, b, k) : a.map((x, j) => x + (b[j] - x) * k);
}

/** Leg length (hip joint to ankle, plus the ankle's height) of a pose given by world positions: hips height for scaling the hips' motion. */
export function legLength(at, thigh, calf, foot) {
  return Math.hypot(...sub(at(calf), at(thigh))) + Math.hypot(...sub(at(foot), at(calf))) + at(foot)[1];
}

/**
 * Retarget one clip. `src`: the source skeleton (Meshy names) with `rest` local transforms; `tracks`: per source
 * joint name, { r?: [times, values], t?: [times, values] }; `times`: the frames to sample; `rig`: the rig's
 * skeleton (names, parent, rest local). Returns per frame each rig joint's local rotation, the pelvis's local
 * translation (in its parent's frame), and the clip's ground speed and direction at the rig's size.
 */
export function retargetClip(src, tracks, times, rig) {
  const srcRestW = world(src, src.rest);
  const rigRestW = world(rig, rig.rest);
  const srcIndex = new Map(src.names.map((n, i) => [n, i]));
  const rigByName = new Map(rig.names.map((n, i) => [n, rigRestW[i]]));
  const rigParent = new Map(rig.names.map((n, i) => [n, rig.parent[i] >= 0 ? rig.names[rig.parent[i]] : null]));
  const turns = reposeTurns(src, srcRestW, rigByName);
  const srcRestByName = new Map(src.names.map((n, i) => [n, srcRestW[i]]));
  const need = (n) => {
    if (!srcIndex.has(n)) throw new Error(`source has no joint ${n}`);
    return srcIndex.get(n);
  };
  for (const n of ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightFoot']) need(n);
  // The hips' motion scaled from the source's legs to the rig's.
  const srcLeg = legLength((n) => srcRestW[need(n)].t, 'LeftUpLeg', 'LeftLeg', 'LeftFoot');
  const rigAt = (n) => rigByName.get(n).t;
  const k = legLength(rigAt, 'thigh_l', 'calf_l', 'foot_l') / srcLeg;
  const frames = [];
  const hips = [];
  const feet = [[], []];
  for (const t of times) {
    const local = src.rest.map((r, i) => {
      const tr = tracks[src.names[i]];
      return {
        t: tr?.t ? sampleTrack(tr.t[0], tr.t[1], 3, t) : r.t,
        q: tr?.r ? sampleTrack(tr.r[0], tr.r[1], 4, t, true) : r.q,
        s: r.s ?? 1,
      };
    });
    const w = world(src, local);
    const byName = new Map(src.names.map((n, i) => [n, w[i]]));
    frames.push(retargetFrame(byName, srcRestByName, turns, rigByName, rigParent));
    hips.push(w[srcIndex.get('Hips')].t);
    feet[0].push(w[srcIndex.get('LeftFoot')].t);
    feet[1].push(w[srcIndex.get('RightFoot')].t);
  }
  // In place: the body's travel off the hips (and the feet, measured in the body's frame).
  const still = stripRootMotion(hips);
  const drift = hips.map((p, i) => sub(p, still[i]));
  const feetInPlace = feet.map((f) => f.map((p, i) => sub(p, drift[i])));
  const dt = times.length > 1 ? (times[times.length - 1] - times[0]) / (times.length - 1) : 1 / 30;
  const { speed, dir } = plantedSpeed(feetInPlace, dt);
  // The pelvis in its rig parent's frame: the rig's rest place plus the source's hip motion, scaled.
  const restHips = srcRestW[srcIndex.get('Hips')].t;
  const pelvisRest = rigByName.get('pelvis');
  const pelvisParent = rig.parent[rig.names.indexOf('pelvis')];
  const parentW = pelvisParent >= 0 ? rigRestW[pelvisParent] : { t: [0, 0, 0], q: [0, 0, 0, 1], s: 1 };
  const pelvis = still.map((p) => {
    const worldAt = add(pelvisRest.t, scale(sub(p, restHips), k));
    return scale(qrot(qinv(parentW.q), sub(worldAt, parentW.t)), 1 / (parentW.s || 1));
  });
  return { frames, pelvis, speed: speed * k, dir, footDown: footDown(feetInPlace[0], dir), legScale: k, turns };
}
