// A look's own skin-weight fixes (manifest `fixes.skin`), for the faults its hands and cloth show on a gun that the
// shared weighting leaves (docs/CHARACTERS.md, "A look's own skin weights"). Opt-in per look: a look without
// `fixes.skin` is weighted exactly as before.
//
// Three parts:
// - hard parts bound whole to one joint (`rigid`, `bindRigid` below), in the download's own pose before the build turns
//   its arms out to the rig's T-pose (prepare-meshy-characters.mjs `pose`): a back pack the download's rig held partly
//   by the arms, the neck and the head came out of that turn already pulled out of shape, and bent with them in play
//   (Starfarer's). Only a build from the download applies it (rehand-built.mjs keeps what the file has);
// - the fingers, weighted by hands.mjs `fitHands` with the look's options (`tips`, `knuckle`, `joints`, `lanes`,
//   `fingers`, each for both hands or under `l` / `r`); fitHands shares the hand's weights out afresh every run, so
//   these are applied on every build and rehand alike;
// - the body (here, after the hands): `hops` drops the influences of joints further than that many steps along the
//   skeleton from a vertex's own joint (a belly vertex held by a thigh and a collarbone at once, stretched between
//   them when the arm rises: Croakley's), `clamp` drops influences under that weight, and `smooth` evens the weights
//   of the vertices a joint pattern holds with their neighbours' (`{ joints: "<regex>", passes }`: a tabard's skin
//   flipping from one thigh to the other between neighbouring vertices: the Iron Knight's); `wrist`
//   (`{ until, band }`, shares of the hand's length past the wrist joint) puts the skin up to `until` on the forearm
//   alone, easing back to the hand over `band` (a cuff or bracelet that twisted with the hand: the Wealthy Otter's).
// Apart from `wrist`, vertices held by a hand chain (hand, fingers, thumb) are left to fitHands.
//
// The body part is not idempotent (smoothing twice smooths more), so a file records the body fixes it was given
// (`extras.skinFix` on its skin) and rehand-built.mjs does not apply the same ones again.

const HAND_CHAIN = /^(hand|index|middle|ring|pinky|thumb)_/;

/** The options fitHands takes from a look's `fixes.skin` (finger weighting). */
export function fingerSkin(skin) {
  if (!skin) return {};
  const pick = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => ['tips', 'knuckle', 'joints', 'lanes', 'fingers'].includes(k)));
  return { ...pick(skin), ...(skin.l ? { l: pick(skin.l) } : {}), ...(skin.r ? { r: pick(skin.r) } : {}) };
}

/**
 * `fixes.skin.rigid`: hard parts bound whole to one joint, on a download's skin in its own pose. Each region is
 * `{ joint, box, blend?, except? }`:
 * - `joint`: the rig joint the part rides (`spine_03`, the chest);
 * - `box`: one box `[x0, y0, z0, x1, y1, z1]` or a list of them, in shares of the download's height in its own pose,
 *   feet at y = 0, x and z from its origin, +x its left and +z its front (the manifest's `landmarks` frame): every
 *   vertex inside is held by `joint` alone;
 * - `blend` (a share of the height, 0.03 unless set): outside the boxes, a vertex this close eases from its own
 *   weights to `joint` (smoothstep by its distance), so the skin round the part has no hard edge;
 * - `except`: a pattern of rig joints; a vertex held most by one is left as it is (the helmet's back where a pack's
 *   tank sits against it: `^Head$`).
 * `at(v)` is vertex v's place in the download's pose; `J`/`W` (four per vertex, the download's joint indices) are
 * changed in place; `rigOf[j]` is source joint j's rig joint. Returns { bound, eased } per region.
 */
export function bindRigid({ count, at, J, W, rigOf, regions }) {
  const pos = new Float64Array(count * 3);
  let low = Infinity;
  let high = -Infinity;
  for (let v = 0; v < count; v++) {
    const p = at(v);
    pos[v * 3] = p[0];
    pos[v * 3 + 1] = p[1];
    pos[v * 3 + 2] = p[2];
    low = Math.min(low, p[1]);
    high = Math.max(high, p[1]);
  }
  const H = high - low;
  const report = [];
  for (const region of regions) {
    const target = rigOf.indexOf(region.joint);
    if (target < 0) throw new Error(`fixes.skin.rigid: the download has no joint for ${region.joint}`);
    const boxes = (Array.isArray(region.box[0]) ? region.box : [region.box]).map((b) => [b[0] * H, low + b[1] * H, b[2] * H, b[3] * H, low + b[4] * H, b[5] * H]);
    const blend = (region.blend ?? 0.03) * H;
    const except = region.except ? new RegExp(region.except) : null;
    // Distance from a point to the nearest box (0 inside one).
    const away = (x, y, z) => {
      let best = Infinity;
      for (const b of boxes) {
        const dx = Math.max(b[0] - x, 0, x - b[3]);
        const dy = Math.max(b[1] - y, 0, y - b[4]);
        const dz = Math.max(b[2] - z, 0, z - b[5]);
        best = Math.min(best, Math.hypot(dx, dy, dz));
      }
      return best;
    };
    let bound = 0;
    let eased = 0;
    for (let v = 0; v < count; v++) {
      const d = away(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      if (d >= blend && d > 0) continue;
      let own = 0;
      for (let q = 1; q < 4; q++) if (W[v * 4 + q] > W[v * 4 + own]) own = q;
      if (except && except.test(rigOf[J[v * 4 + own]] ?? '')) continue;
      // Inside: the joint alone. Within the blend: eased toward it.
      const k = d <= 0 ? 1 : 1 - ((t) => t * t * (3 - 2 * t))(d / blend);
      const acc = new Map();
      for (let q = 0; q < 4; q++) if (W[v * 4 + q] > 0) acc.set(J[v * 4 + q], (acc.get(J[v * 4 + q]) ?? 0) + W[v * 4 + q] * (1 - k));
      acc.set(target, (acc.get(target) ?? 0) + k);
      const top = [...acc].filter(([, w]) => w > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = top.reduce((s, [, w]) => s + w, 0);
      for (let q = 0; q < 4; q++) {
        J[v * 4 + q] = top[q]?.[0] ?? 0;
        W[v * 4 + q] = top[q] ? top[q][1] / sum : 0;
      }
      if (d <= 0) bound++;
      else eased++;
    }
    report.push({ joint: region.joint, bound, eased });
  }
  return report;
}

/** The body part of a look's `fixes.skin`, or null when it has none. */
export function bodySkin(skin) {
  if (!skin) return null;
  const out = {};
  for (const k of ['hops', 'clamp', 'smooth', 'wrist']) if (skin[k] !== undefined) out[k] = skin[k];
  return Object.keys(out).length ? out : null;
}

/** Steps between two joints along the skeleton (`parentOf` maps a joint name to its parent's). */
function hopsBetween(a, b, parentOf) {
  const up = (n) => {
    const chain = [];
    for (let x = n; x; x = parentOf.get(x)) chain.push(x);
    return chain;
  };
  const ca = up(a);
  const cb = up(b);
  const ib = new Map(cb.map((n, i) => [n, i]));
  for (let i = 0; i < ca.length; i++) if (ib.has(ca[i])) return i + ib.get(ca[i]);
  return Infinity;
}

/** Write a vertex's influences (a Map joint -> weight) back: the four largest, normalised. */
function put(m, v, acc) {
  const top = [...acc].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((x, [, w]) => x + w, 0);
  if (!(sum > 0)) return;
  for (let q = 0; q < 4; q++) {
    m.J[v * 4 + q] = top[q]?.[0] ?? 0;
    m.W[v * 4 + q] = top[q] ? top[q][1] / sum : 0;
  }
}

const influences = (m, v) => {
  const acc = new Map();
  for (let q = 0; q < 4; q++) {
    const w = m.W[v * 4 + q];
    if (w > 0) acc.set(m.J[v * 4 + q], (acc.get(m.J[v * 4 + q]) ?? 0) + w);
  }
  return acc;
};
const strongest = (acc) => [...acc].sort((a, b) => b[1] - a[1])[0]?.[0];

/**
 * Neighbours of every vertex through the triangles, with vertices at the same place (texture seams) joined, so
 * smoothing runs across seams as the skin does.
 */
function neighbours(m) {
  const n = m.pos.length / 3;
  const key = new Map();
  const weld = new Int32Array(n);
  for (let v = 0; v < n; v++) {
    const k = `${Math.round(m.pos[v * 3] * 1e5)},${Math.round(m.pos[v * 3 + 1] * 1e5)},${Math.round(m.pos[v * 3 + 2] * 1e5)}`;
    if (!key.has(k)) key.set(k, v);
    weld[v] = key.get(k);
  }
  const nb = new Map();
  const link = (a, b) => {
    if (a === b) return;
    if (!nb.has(a)) nb.set(a, new Set());
    nb.get(a).add(b);
  };
  const idx = m.idx;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const t = [weld[idx[i]], weld[idx[i + 1]], weld[idx[i + 2]]];
    for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      link(a, b);
      link(b, a);
    }
  }
  return { weld, nb };
}

/**
 * Skin of one hand up to `until` (a share of the hand's length past the wrist joint, along the forearm) goes to the
 * forearm alone, easing back to the hand over `band`. `world` maps joint name to bind { q, t }; `hand` is the hand's
 * measurement (extras.hand: its length). Returns the vertices changed.
 */
function wristToForearm(meshes, jointNames, world, hand, s, { until = 0.08, band = 0.08 }) {
  const lower = jointNames.indexOf(`lowerarm_${s}`);
  const E = world.get(`lowerarm_${s}`)?.t;
  const H = world.get(`hand_${s}`)?.t;
  if (lower < 0 || !E || !H || !hand?.length) return 0;
  const d = [H[0] - E[0], H[1] - E[1], H[2] - E[2]];
  const len = Math.hypot(...d);
  const dir = d.map((x) => x / len);
  const chain = new RegExp(`^(hand|index|middle|ring|pinky|thumb)(_0\\d)?_${s}$`);
  const inChain = jointNames.map((n) => chain.test(n));
  const a = until * hand.length;
  const b = Math.max(1e-4, band * hand.length);
  let n = 0;
  for (const m of meshes) for (let v = 0; v < m.pos.length / 3; v++) {
    const u = (m.pos[v * 3] - H[0]) * dir[0] + (m.pos[v * 3 + 1] - H[1]) * dir[1] + (m.pos[v * 3 + 2] - H[2]) * dir[2];
    if (u >= a + b || u < -len) continue;
    const keep = u <= a ? 0 : ((t) => t * t * (3 - 2 * t))((u - a) / b);
    const acc = influences(m, v);
    let moved = 0;
    for (const [j, w] of [...acc]) if (inChain[j]) {
      acc.set(j, w * keep);
      moved += w * (1 - keep);
    }
    if (moved < 1e-4) continue;
    acc.set(lower, (acc.get(lower) ?? 0) + moved);
    put(m, v, acc);
    n++;
  }
  return n;
}

/**
 * The body part of a look's skin fixes, on meshes in bind space ({ pos, J, W, idx }; J indexes `jointNames`).
 * `parentOf` maps joint name to its parent's name. Returns a short report.
 */
export function fixBodySkin({ meshes, jointNames, parentOf, fix, world = null, hands = {}, log = () => {} }) {
  if (!fix) return null;
  const isHand = jointNames.map((n) => HAND_CHAIN.test(n));
  const report = { hops: 0, clamp: 0, smooth: 0, wrist: 0 };
  if (fix.wrist && world) for (const s of ['l', 'r']) report.wrist += wristToForearm(meshes, jointNames, world, hands[s], s, fix.wrist);
  const re = fix.smooth ? new RegExp(fix.smooth.joints) : null;
  const near = new Map();
  const within = (a, b) => {
    const k = a * 4096 + b;
    if (!near.has(k)) near.set(k, hopsBetween(jointNames[a], jointNames[b], parentOf));
    return near.get(k);
  };
  for (const m of meshes) {
    const n = m.pos.length / 3;
    const handHeld = (v) => [0, 1, 2, 3].some((q) => m.W[v * 4 + q] > 0 && isHand[m.J[v * 4 + q]]);
    for (let v = 0; v < n; v++) {
      if (handHeld(v)) continue;
      const acc = influences(m, v);
      let changed = false;
      if (fix.hops !== undefined) {
        const own = strongest(acc);
        for (const j of [...acc.keys()]) if (j !== own && within(own, j) > fix.hops) {
          acc.delete(j);
          changed = true;
          report.hops++;
        }
      }
      if (fix.clamp !== undefined) {
        const own = strongest(acc);
        for (const [j, w] of [...acc]) if (j !== own && w < fix.clamp) {
          acc.delete(j);
          changed = true;
          report.clamp++;
        }
      }
      if (changed) put(m, v, acc);
    }
    if (re && m.idx) {
      const { weld, nb } = neighbours(m);
      const passes = fix.smooth.passes ?? 2;
      const chosen = [];
      for (let v = 0; v < n; v++) {
        if (weld[v] !== v || handHeld(v)) continue;
        const own = strongest(influences(m, v));
        if (own !== undefined && re.test(jointNames[own])) chosen.push(v);
      }
      for (let p = 0; p < passes; p++) {
        const next = new Map();
        for (const v of chosen) {
          const mine = influences(m, v);
          const around = [...(nb.get(v) ?? [])];
          if (!around.length) continue;
          const acc = new Map([...mine].map(([j, w]) => [j, w * 0.5]));
          for (const u of around) for (const [j, w] of influences(m, u)) acc.set(j, (acc.get(j) ?? 0) + (0.5 * w) / around.length);
          next.set(v, acc);
        }
        for (const [v, acc] of next) put(m, v, acc);
      }
      // Seam copies take their welded vertex's weights.
      for (let v = 0; v < n; v++) if (weld[v] !== v) for (let q = 0; q < 4; q++) {
        m.J[v * 4 + q] = m.J[weld[v] * 4 + q];
        m.W[v * 4 + q] = m.W[weld[v] * 4 + q];
      }
      report.smooth += chosen.length;
    }
  }
  log(`skin fixes: ${Object.entries(report).filter(([k]) => fix[k] !== undefined).map(([k, x]) => `${k} ${x}`).join(', ')}`);
  return report;
}
