// Joint landmarks for an unrigged humanoid, found from its mesh (prepare-meshy-characters.mjs), so a
// character standing in a T-pose or A-pose needs no hand-placed landmarks:
// - the mesh is drawn into a front view (which pixels it covers, and how deep it is there);
// - the head's top is the top of the mesh; the neck is the narrowest row of the body's middle below the head;
// - the crotch is the highest row where the space between the legs shows (a robe or coat that hides
//   it: a share of the height, as in most bodies);
// - each arm is found from the shoulder as the direction the body reaches furthest out along (level for
//   a T-pose, down to 75° for an A-pose), then followed through the mesh to the hand's tip; the elbow and
//   wrist go at the usual shares of its length;
// - each leg's knee and ankle are the middle of that leg's run of pixels at the usual heights, and the
//   foot runs from the heel to the furthest toe near the ground;
// - depths are the middle of the mesh there (front to back).
// The result is in the manifest's `landmarks` form (units of the model's height, feet at y = 0, +x the
// character's left, +z its front). It is a guess: LANDMARK_DEBUG=<dir> draws it over the views, and a
// manifest's own `landmarks` replace it (print the found ones with LANDMARK_PRINT=1 to start from them).

import sharp from 'sharp';

const GRID = 320;

/** The front view: per pixel, covered or not and the nearest and farthest depth. Coordinates in units of H, x centred. */
function frontView(P, idx, lo, H, cx) {
  const N = GRID;
  const cell = 1 / N;
  const near = new Float32Array(N * N).fill(Infinity);
  const far = new Float32Array(N * N).fill(-Infinity);
  const X = (x) => ((x - cx) / H + 0.5) * N;
  const Y = (y) => ((y - lo) / H) * N;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const q = v.map((o) => [X(P[o]), Y(P[o + 1]), P[o + 2] / H]);
    const minx = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0])));
    const maxx = Math.min(N - 1, Math.floor(Math.max(q[0][0], q[1][0], q[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1])));
    const maxy = Math.min(N - 1, Math.floor(Math.max(q[0][1], q[1][1], q[2][1])));
    const d = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]);
    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        let z;
        if (Math.abs(d) < 1e-12) z = q[0][2];
        else {
          const px = x + 0.5;
          const py = y + 0.5;
          const w1 = ((px - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (py - q[0][1])) / d;
          const w2 = ((q[1][0] - q[0][0]) * (py - q[0][1]) - (px - q[0][0]) * (q[1][1] - q[0][1])) / d;
          // A little slack, so thin parts (fingers seen edge on) still cover their pixels.
          if (w1 < -0.15 || w2 < -0.15 || w1 + w2 > 1.15) continue;
          z = q[0][2] + w1 * (q[1][2] - q[0][2]) + w2 * (q[2][2] - q[0][2]);
        }
        const i = y * N + x;
        if (z < near[i]) near[i] = z;
        if (z > far[i]) far[i] = z;
      }
    }
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && near[y * N + x] !== Infinity;
  const depth = (x, y) => (near[y * N + x] + far[y * N + x]) / 2;
  return { N, cell, on, depth, near, far };
}

/** The runs of covered pixels in row y, as [x0, x1] (inclusive). */
function runs(v, y) {
  const out = [];
  let s = -1;
  for (let x = 0; x <= v.N; x++) {
    const c = x < v.N && v.on(x, y);
    if (c && s < 0) s = x;
    if (!c && s >= 0) {
      out.push([s, x - 1]);
      s = -1;
    }
  }
  return out;
}

/**
 * Landmarks for a mesh standing on y = lo, Y up, facing +Z. `P` positions,
 * `idx` triangle indices. Returns { spine, L, R } (the manifest's form) and
 * what it saw (for the debug picture).
 */
export function findLandmarks(P, idx) {
  let lo = Infinity;
  let hi = -Infinity;
  let xlo = Infinity;
  let xhi = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    lo = Math.min(lo, P[i + 1]);
    hi = Math.max(hi, P[i + 1]);
    xlo = Math.min(xlo, P[i]);
    xhi = Math.max(xhi, P[i]);
  }
  const H = hi - lo;
  // Centred on the body's middle in x (half way across its extent: models are near enough symmetric).
  const cx = (xlo + xhi) / 2;
  const v = frontView(P, idx, lo, H, cx);
  const N = v.N;
  const mid = N / 2;
  const row = (y) => Math.min(N - 1, Math.max(0, Math.round(y * N)));
  const col = (x) => Math.round((x + 0.5) * N);
  const ux = (px) => (px + 0.5) / N - 0.5;
  /** The run covering (or nearest) the body's middle in a row. */
  const central = (y) => {
    const rs = runs(v, row(y));
    let best = null;
    for (const r of rs) {
      const d = mid < r[0] ? r[0] - mid : mid > r[1] ? mid - r[1] : 0;
      if (!best || d < best.d) best = { r, d };
    }
    return best?.r ?? [mid, mid];
  };
  const width = (y) => {
    const r = central(y);
    return (r[1] - r[0] + 1) / N;
  };
  /** Depth at the middle of a run, averaged over its middle half. */
  const runDepth = (y, r) => {
    const yy = row(y);
    let s = 0;
    let n = 0;
    for (let x = Math.round(r[0] + (r[1] - r[0]) * 0.25); x <= Math.round(r[1] - (r[1] - r[0]) * 0.25); x++) {
      if (!v.on(x, yy)) continue;
      s += v.depth(x, yy);
      n++;
    }
    return n ? s / n : 0;
  };
  const centreDepth = (y) => runDepth(y, central(y));

  // Neck: the narrowest middle between the shoulders and the head.
  let neck = 0.83;
  {
    let best = Infinity;
    for (let y = 0.76; y <= 0.92; y += 1 / N) {
      const w = width(y);
      if (w < best) {
        best = w;
        neck = y;
      }
    }
  }
  // A crown, hat or collar can make the narrowest row sit too high or low: the neck stays where necks are.
  neck = Math.min(0.88, Math.max(0.8, neck));
  // Crotch: the highest row below the waist where the middle is open between two runs.
  let crotch = null;
  for (let y = 0.6; y >= 0.15; y -= 1 / N) {
    const rs = runs(v, row(y));
    const left = rs.some((r) => r[1] < mid - 1 && r[1] > mid - 0.12 * N);
    const right = rs.some((r) => r[0] > mid + 1 && r[0] < mid + 0.12 * N);
    if (!v.on(Math.round(mid), row(y)) && left && right) {
      crotch = y;
      break;
    }
  }
  // No gap, or one far down (a coat or rags hanging below the hips): the hips go where most bodies have them.
  const covered = crotch === null || crotch < 0.36;
  if (covered) crotch = 0.44;
  const hips = crotch + 0.05;
  const shoulderY = neck - 0.055;
  // The chest's half width below the armpits: the narrowest middle just under the shoulder line.
  let chest = Infinity;
  for (let y = shoulderY - 0.16; y <= shoulderY - 0.08; y += 1 / N) chest = Math.min(chest, width(y) / 2);
  // A cape or coat widens the chest: the shoulder joint stays within a shoulder's width of the middle.
  const shoulderX = Math.min(0.13, Math.max(0.06, chest * 0.8));

  const spineY = [hips, hips + 0.22 * (shoulderY - hips), hips + 0.45 * (shoulderY - hips), hips + 0.7 * (shoulderY - hips), neck, neck + 0.04, 1];
  const spine = spineY.map((y, i) => [0, y, i === 6 ? centreDepth(0.97) : centreDepth(y)]);

  const side = (s) => {
    // s = +1: the character's left (+x).
    let S = [s * shoulderX, shoulderY];
    // The arm: the direction from the shoulder that stays in the mesh the furthest.
    const reachAt = (from, angle) => {
      const dx = Math.cos(angle) * s;
      const dy = -Math.sin(angle);
      let last = 0;
      let gap = 0;
      for (let t = 0; t <= 0.7; t += 0.5 / N) {
        const x = col(from[0] + dx * t);
        const y = row(from[1] + dy * t);
        if (from[1] + dy * t < crotch - 0.02) break;
        if (v.on(x, y)) {
          last = t;
          gap = 0;
        } else if ((gap += 0.5 / N) > 0.035) break;
      }
      return last;
    };
    const search = (from) => {
      let best = { reach: 0, angle: 0 };
      for (let a = 0; a <= (75 * Math.PI) / 180; a += Math.PI / 180) {
        const r = reachAt(from, a);
        // Prefer the level arm on a tie (a T-pose arm also reaches down its own thickness).
        if (r > best.reach + 0.01) best = { reach: r, angle: a };
      }
      return best;
    };
    let best = search(S);
    // A shoulder line that misses the arm (a high collar or cape over the shoulders): lower it until the arm shows.
    for (let k = 1; best.reach < 0.18 && k <= 8; k++) {
      const lower = [S[0], shoulderY - 0.015 * k];
      const b = search(lower);
      if (b.reach > best.reach) {
        best = b;
        S = lower;
      }
    }
    const dir = [Math.cos(best.angle) * s, -Math.sin(best.angle)];
    // Follow the arm: at steps along the direction, the middle of the mesh across it (it may bend a little).
    const across = [-dir[1], dir[0]];
    const path = [];
    for (let t = 0.02; t <= best.reach; t += 1 / N) {
      let s0 = null;
      let s1 = null;
      for (let u = -0.08; u <= 0.08; u += 1 / N) {
        const x = col(S[0] + dir[0] * t + across[0] * u);
        const y = row(S[1] + dir[1] * t + across[1] * u);
        if (v.on(x, y)) {
          if (s0 === null) s0 = u;
          s1 = u;
        }
      }
      const c = s0 === null ? 0 : (s0 + s1) / 2;
      const p = [S[0] + dir[0] * t + across[0] * c, S[1] + dir[1] * t + across[1] * c];
      const yy = row(p[1]);
      const xx = col(p[0]);
      path.push([p[0], p[1], v.on(xx, yy) ? v.depth(xx, yy) : centreDepth(shoulderY)]);
    }
    const along = (k) => {
      const i = Math.min(path.length - 1, Math.max(0, Math.round(k * (path.length - 1))));
      return path[i] ?? [S[0], S[1], centreDepth(shoulderY)];
    };
    const z0 = centreDepth(shoulderY);
    const arm = [S[0], S[1], path.length ? path[0][2] : z0];
    // Hand tip: the end of the path; wrist and elbow at the usual shares from the shoulder.
    const tip = along(1);
    const elbow = along(0.38);
    const wrist = along(0.74);
    const clav = [s * Math.max(0.025, shoulderX * 0.3), S[1] + 0.01, z0];
    // The leg: the run on this side below the crotch.
    const legAt = (y) => {
      const rs = runs(v, row(y)).filter((r) => (s > 0 ? (r[0] + r[1]) / 2 > mid : (r[0] + r[1]) / 2 < mid));
      // The run nearest the middle (an A-pose hand can hang beside the thigh).
      rs.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - mid) - Math.abs((b[0] + b[1]) / 2 - mid));
      const r = rs[0];
      if (!r || covered) return [s * 0.055, y, centreDepth(y)];
      return [ux((r[0] + r[1]) / 2), y, runDepth(y, r)];
    };
    const kneeY = crotch * 0.6;
    const hip = legAt(crotch - 0.04);
    const upleg = [hip[0] * 0.85, crotch + 0.02, centreDepth(crotch + 0.02)];
    const knee = legAt(kneeY);
    const ankle = legAt(0.065);
    // The foot: from its heel to the furthest toe near the ground, on this side.
    let heel = Infinity;
    let toe = -Infinity;
    const fx = [];
    for (let i = 0; i < P.length; i += 3) {
      const y = (P[i + 1] - lo) / H;
      const x = (P[i] - cx) / H;
      if (y > 0.045 || x * s < 0.005) continue;
      const z = P[i + 2] / H;
      heel = Math.min(heel, z);
      toe = Math.max(toe, z);
      fx.push(x);
    }
    if (!Number.isFinite(toe)) [heel, toe] = [ankle[2] - 0.03, ankle[2] + 0.08];
    const footX = fx.length ? fx.reduce((a, b) => a + b, 0) / fx.length : ankle[0];
    const ball = [footX, 0.02, heel + 0.72 * (toe - heel)];
    const toeTip = [footX, 0.015, toe - 0.01];
    return [clav, arm, elbow, wrist, tip, upleg, knee, [ankle[0], 0.065, ankle[2]], ball, toeTip];
  };
  // Back into the model's own x (the views are centred on the body).
  const r3 = (p) => [p[0] + cx / H, p[1], p[2]].map((x) => Math.round(x * 1000) / 1000);
  return {
    landmarks: { spine: spine.map(r3), L: side(1).map(r3), R: side(-1).map(r3) },
    seen: { neck, crotch, covered, shoulderX, shoulderY, view: v, cx, lo, H },
  };
}

/** A picture of the front and side views with the landmarks drawn over them (LANDMARK_DEBUG). */
export async function landmarkPicture(P, idx, found, file) {
  const { view: v } = found.seen;
  const N = v.N;
  const S = 2;
  const W = N * S;
  const front = Buffer.alloc(W * W * 3, 30);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (v.on(x, y)) for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) front.set([150, 150, 150], ((W - 1 - (y * S + a)) * W + x * S + b) * 3);
  const dot = (buf, px, py, c) => {
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const x = Math.round(px) + a;
      const y = Math.round(py) + b;
      if (x >= 0 && y >= 0 && x < W && y < W) buf.set(c, (y * W + x) * 3);
    }
  };
  const side = Buffer.alloc(W * W * 3, 30);
  const { lo, H } = found.seen;
  for (let i = 0; i < P.length; i += 9) {
    const y = W - 1 - ((P[i + 1] - lo) / H) * W;
    const x = (P[i + 2] / H + 0.5) * W;
    if (x >= 0 && y >= 0 && x < W && y < W) side.set([150, 150, 150], (Math.round(y) * W + Math.round(x)) * 3);
  }
  const { spine, L, R } = found.landmarks;
  const colours = [[255, 220, 0], [255, 60, 60], [60, 160, 255]];
  [spine, L, R].forEach((list, k) => {
    for (const p of list) {
      dot(front, (p[0] + 0.5) * W, W - 1 - p[1] * W, colours[k]);
      dot(side, (p[2] + 0.5) * W, W - 1 - p[1] * W, colours[k]);
    }
  });
  const a = await sharp(front, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer();
  const b = await sharp(side, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer();
  await sharp({ create: { width: W * 2, height: W, channels: 3, background: '#000' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: W, top: 0 }]).png().toFile(file);
}
