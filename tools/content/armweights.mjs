// Skin on the arms kept to the arms (prepare-meshy-characters.mjs at import, rehand-built.mjs on characters
// already built), for a character whose manifest asks (`fixes.armCloth: true`). Tried on every character it made
// the stretching worse (wide sleeves grew wings from the arms instead of streaks), so none uses it yet.
//
// Meshy's rigs and our own bone heat both leave some vertices weighted to an arm that hang well away from it:
// a coat's side, a sleeve's hem down by the hip, a cape's edge, a strap. In the T-pose they sit still; when the
// arms come up to hold a gun those vertices go with the arm while their neighbours stay with the body, and the
// triangles between them stretch into long "spikes" from the arm to the hip (Giggles, Vanguard, the robed
// rangers). Here every vertex an arm holds is measured against that arm: past a few limb radii from its bones
// it is cloth hanging off the arm, and it takes the weights of the nearest vertex the arm doesn't hold (blended
// over a band, so the cloth eases from the arm into the body). A wide sleeve round the arm stays on the arm:
// the limb radius is measured from what the arm holds outright, sleeve included.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1e-9)));
  return t * t * (3 - 2 * t);
};
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

/** How far out (in limb radii) arm skin starts to go to the body, and where it has gone entirely. */
const FROM = 2.2;
const TO = 3.4;
/** ...and never nearer the bones than this share of the arm's length (a thin arm's sleeve). */
const MIN_REACH = 0.2;
/**
 * Only cloth that hangs: clear of the shoulder (round the shoulder joint the arm rightly holds the chest and back
 * it moves) and mostly below the arm (the T-pose's sleeves, coat sides and straps hang down from it).
 */
const PAST_SHOULDER = 0.3;
const HANGS = 0.5;

/**
 * `meshes`: { pos (bind world xyz per vertex), J, W (four influences per vertex) }, rewritten in place;
 * `jointNames`; `world`: joint name to rest { t }. Returns how many vertices changed per side.
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
      const others = [];
      for (let v = 0; v < n; v++) if (anyArmW[v] < 0.05) others.push(v);
      // Too little of a body to hand cloth to (first-person arms: forearms and hands only).
      if (held.length < 30 || others.length < 100) continue;
      const r = pct(held, 75);
      const from = Math.max(FROM * r, MIN_REACH * length);
      const to = Math.max(TO * r, from * 1.5);
      for (let v = 0; v < n; v++) {
        if (armW[v] < 0.15) continue;
        const p = P(v);
        const near = toLine(p, line);
        if (near.along < PAST_SHOULDER || near.at[1] - p[1] < HANGS * near.d) continue;
        const t = smooth(from, to, near.d);
        // Already eased this far (a second run changes nothing).
        if (t <= 0 || armW[v] <= 1 - t + 1e-4) continue;
        // The nearest vertex the arm doesn't hold.
        let best = -1;
        let bd = Infinity;
        for (const o of others) {
          const d = (m.pos[o * 3] - p[0]) ** 2 + (m.pos[o * 3 + 1] - p[1]) ** 2 + (m.pos[o * 3 + 2] - p[2]) ** 2;
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best < 0) continue;
        const acc = new Map();
        for (let k = 0; k < 4; k++) {
          const w0 = m.W[v * 4 + k] * (1 - t);
          if (w0 > 1e-5) acc.set(m.J[v * 4 + k], (acc.get(m.J[v * 4 + k]) ?? 0) + w0);
          const w1 = m.W[best * 4 + k] * t;
          if (w1 > 1e-5) acc.set(m.J[best * 4 + k], (acc.get(m.J[best * 4 + k]) ?? 0) + w1);
        }
        const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
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
  if (out.l || out.r) log(`arm skin kept to the arms: ${out.l ?? 0} left, ${out.r ?? 0} right vertices eased to the body`);
  return out;
}
