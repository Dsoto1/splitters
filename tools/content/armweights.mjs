// Skin on the arms kept to the arms (prepare-meshy-characters.mjs at import, rehand-built.mjs on characters
// already built), for a character whose manifest asks (`fixes.armCloth: true`).
//
// Meshy's rigs and our own bone heat both leave some vertices weighted to an arm that hang well away from it:
// a coat's side, a sleeve's hem down by the hip, a cape's edge, a strap. In the T-pose they sit still; when the
// arms come up to hold a gun those vertices go with the arm while their neighbours stay with the body, and the
// triangles between them stretch into long "spikes" from the arm to the hip (Giggles, Vanguard, the robed
// rangers). Every vertex an arm holds that hangs well off it (past a few limb radii from its bones, below it,
// clear of the shoulder) is cloth: it is eased from the arm's weights to the body's by how far it is, ALONG THE
// SURFACE, from the arm and from the body (its share of the way from the arm to the body, eased: EASE), taking the weights of the body vertex nearest along the surface. A coat's side that joins the body
// under the arm goes with the body; a wide sleeve, joined to the body only round the shoulder, stays on the arm.
// (The first rule took the nearest body vertex in a straight line: a wide sleeve hanging by the hip went to the
// hip and grew wings from the arm, Giggles' and the Dust Trooper's.) The limb radius is measured from what the
// arm holds outright, sleeve included.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function pct(xs, p) {
  if (!xs.length) return 0;
  const s = Float64Array.from(xs).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

/** Distance from a point to a polyline, the nearest point on it, and how far along the polyline (segments) that is. */
function toLine(p, line) {
  let best = { d: Infinity, at: line[0], along: 0 };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const ab = sub(line[i + 1], a);
    const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / (dot(ab, ab) || 1e-12)));
    const at = add(a, scale(ab, t));
    const d = Math.hypot(...sub(p, at));
    if (d < best.d) best = { d, at, along: i + t };
  }
  return best;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1e-9)));
  return t * t * (3 - 2 * t);
};
/**
 * Cloth goes to the body by its share of the way from the arm to the body along the surface, eased over this
 * span of it: a sleeve's hem (its way to the body round the shoulder about as long as its way back up to the arm)
 * stays mostly on the arm; a coat's side joined to the body under the arm goes with the body.
 */
const EASE = [0.3, 0.8];
/** How far out (in limb radii) arm skin counts as cloth hanging off the arm. */
const FROM = 2.2;
/** ...and never nearer the bones than this share of the arm's length (a thin arm's sleeve). */
const MIN_REACH = 0.2;
/**
 * Only cloth that hangs: clear of the shoulder (round the shoulder joint the arm rightly holds the chest and back
 * it moves) and mostly below the arm (the T-pose's sleeves, coat sides and straps hang down from it).
 */
const PAST_SHOULDER = 0.3;
const HANGS = 0.5;

/** A binary heap of [key, value] by key, smallest first. */
class Heap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.k.length;
  }
  push(key, value) {
    const { k, v } = this;
    let i = k.length;
    k.push(key);
    v.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const { k, v } = this;
    const top = [k[0], v[0]];
    const lk = k.pop();
    const lv = v.pop();
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const a = 2 * i + 1;
        const b = a + 1;
        let m = i;
        if (a < k.length && k[a] < k[m]) m = a;
        if (b < k.length && k[b] < k[m]) m = b;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * The surface as a graph: vertices at the same place (split at texture seams) are one node; edges from the
 * triangles, as long as they are. Returns { node (vertex to node), adj (per node: [node, length] pairs) }.
 */
function surfaceGraph(pos, idx) {
  const n = pos.length / 3;
  const node = new Int32Array(n);
  const seen = new Map();
  let count = 0;
  for (let v = 0; v < n; v++) {
    const key = `${Math.round(pos[v * 3] * 1e4)},${Math.round(pos[v * 3 + 1] * 1e4)},${Math.round(pos[v * 3 + 2] * 1e4)}`;
    let id = seen.get(key);
    if (id === undefined) seen.set(key, (id = count++));
    node[v] = id;
  }
  const adj = Array.from({ length: count }, () => []);
  for (let i = 0; i + 2 < idx.length; i += 3) {
    for (const [a, b] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]]) {
      const [p, q] = [node[a], node[b]];
      if (p === q) continue;
      const d = Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
      adj[p].push(q, d);
      adj[q].push(p, d);
    }
  }
  return { node, adj, count };
}

/** Distances along the surface from a set of source nodes, and which source each node is nearest. */
function spread(adj, count, sources) {
  const dist = new Float64Array(count).fill(Infinity);
  const from = new Int32Array(count).fill(-1);
  const heap = new Heap();
  for (const [s, origin] of sources) {
    if (dist[s] === 0) continue;
    dist[s] = 0;
    from[s] = origin;
    heap.push(0, s);
  }
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist[u]) continue;
    const list = adj[u];
    for (let i = 0; i < list.length; i += 2) {
      const w = list[i];
      const nd = d + list[i + 1];
      if (nd < dist[w]) {
        dist[w] = nd;
        from[w] = from[u];
        heap.push(nd, w);
      }
    }
  }
  return { dist, from };
}

/**
 * `meshes`: { pos (bind world xyz per vertex), J, W (four influences per vertex), idx (triangle indices) },
 * rewritten in place (a mesh without `idx` is left alone); `jointNames`; `world`: joint name to rest { t }.
 * Returns how many vertices changed per side.
 */
export function keepArmsToArms({ meshes, jointNames, world, log = () => {} }) {
  const out = {};
  for (const s of ['l', 'r']) {
    const at = (n) => world.get(`${n}_${s}`)?.t;
    const [U, E, H] = [at('upperarm'), at('lowerarm'), at('hand')];
    if (!U || !E || !H) continue;
    const tip = at('middle_03') ?? add(H, scale(sub(H, E), 0.6));
    const line = [U, E, H, tip];
    const length = Math.hypot(...sub(E, U)) + Math.hypot(...sub(H, E));
    const chainOf = (side) => new Set(jointNames.map((n, i) => (new RegExp(`^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)(_0\\d)?(_leaf)?_${side}$`).test(n) ? i : -1)).filter((i) => i >= 0));
    const chain = chainOf(s);
    // Both arms: cloth never goes from one arm to the other.
    const arms = new Set([...chain, ...chainOf(s === 'l' ? 'r' : 'l')]);
    let changed = 0;
    for (const m of meshes) {
      if (!m.idx) continue;
      const n = m.pos.length / 3;
      const P = (v) => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]];
      const armW = new Float32Array(n);
      const anyArmW = new Float32Array(n);
      for (let v = 0; v < n; v++)
        for (let k = 0; k < 4; k++) {
          if (chain.has(m.J[v * 4 + k])) armW[v] += m.W[v * 4 + k];
          if (arms.has(m.J[v * 4 + k])) anyArmW[v] += m.W[v * 4 + k];
        }
      // The limb's radius: how far from its bones the skin the arm holds outright lies.
      const held = [];
      for (let v = 0; v < n; v++) if (armW[v] >= 0.9) held.push(toLine(P(v), line).d);
      let body = 0;
      for (let v = 0; v < n; v++) if (anyArmW[v] < 0.05) body++;
      // Too little of a body to hand cloth to (first-person arms: forearms and hands only).
      if (held.length < 30 || body < 100) continue;
      const r = pct(held, 75);
      const reach = Math.max(FROM * r, MIN_REACH * length);
      // Cloth: held by this arm, hanging well off it. The arm: what it holds within reach (and round the shoulder).
      const cloth = [];
      const g = surfaceGraph(m.pos, m.idx);
      const armSources = [];
      const bodySources = [];
      for (let v = 0; v < n; v++) {
        if (anyArmW[v] < 0.05) {
          bodySources.push([g.node[v], v]);
          continue;
        }
        if (armW[v] < 0.15) continue;
        const p = P(v);
        const near = toLine(p, line);
        const hangs = near.along >= PAST_SHOULDER && near.at[1] - p[1] >= HANGS * near.d;
        if (hangs && near.d > reach) cloth.push(v);
        else if (near.d <= reach) armSources.push([g.node[v], v]);
      }
      if (!cloth.length) continue;
      const fromArm = spread(g.adj, g.count, armSources);
      const fromBody = spread(g.adj, g.count, bodySources);
      for (const v of cloth) {
        const a = fromArm.dist[g.node[v]];
        const b = fromBody.dist[g.node[v]];
        const best = fromBody.from[g.node[v]];
        if (best < 0 || !Number.isFinite(b)) continue;
        const t = Number.isFinite(a) ? smooth(EASE[0], EASE[1], a / (a + b)) : 1;
        // Already eased this far (a second run changes nothing).
        if (t <= 1e-3 || armW[v] <= 1 - t + 1e-4) continue;
        const acc = new Map();
        for (let k = 0; k < 4; k++) {
          const w0 = m.W[v * 4 + k] * (1 - t);
          if (w0 > 1e-5) acc.set(m.J[v * 4 + k], (acc.get(m.J[v * 4 + k]) ?? 0) + w0);
          const w1 = m.W[best * 4 + k] * t;
          if (w1 > 1e-5) acc.set(m.J[best * 4 + k], (acc.get(m.J[best * 4 + k]) ?? 0) + w1);
        }
        const top = [...acc].sort((x, y) => y[1] - x[1]).slice(0, 4);
        const sum = top.reduce((x, [, w]) => x + w, 0) || 1;
        for (let k = 0; k < 4; k++) {
          m.J[v * 4 + k] = top[k]?.[0] ?? 0;
          m.W[v * 4 + k] = top[k] ? top[k][1] / sum : 0;
        }
        changed++;
      }
    }
    out[s] = changed;
  }
  if (out.l || out.r) log(`arm cloth eased to the body along the surface: ${out.l ?? 0} left, ${out.r ?? 0} right vertices`);
  return out;
}
