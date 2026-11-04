// The airliner shell's cross-section, measured from the owner's Meshy download, for the in-house cabin kit
// (tools/content/prepare-cabin.mjs): the kit's fuselage sections are modelled from these rings so they sit just
// inside the shell (content/props/meshy-owned-airliner.json, prop `airliner_shell`).
//
//   node tools/content/fuselage-profile.mjs <downloads dir>
//
// reads `airliner-2026-11-04/refined/airliner.glb` there (the raw download stays out of the repo) and writes
// assets-src/tiletrigger-cabin/fuselage.json: the shell built as prepare-props builds it (turned to face +Z,
// centred on its footprint, standing on y = 0, scaled by SCALE), cut by planes across it every STEP metres; at each
// station, the distance from the fuselage's centre line to the nearest skin in each of RAYS directions (0 = +x,
// counter-clockwise seen from the front, so a quarter turn is straight up). The nearest skin, so wings, engines,
// fairings and the fin standing out of the round body don't count. `constant` is the smallest ring over the
// straight part of the body, which every straight section uses.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
/** The shell's scale (content/props/meshy-owned-airliner.json `scale`): the download is 1.9 units long. */
export const SCALE = 36;
const RAYS = 48;
const STEP = 0.3;
/** The straight part of the body (z, metres, shell frame): every straight section of the kit sits in it. */
export const STRAIGHT = [-14.15, 23.65];
/** The cabin floor (the sill of the shell's painted doors), metres up from the ground the shell stands on. */
export const FLOOR = 6.79;
/**
 * The openings cut through the shell, each side (z front, z aft, sill, head): L1/R1 on the painted front doors, L2/R2
 * where the window row leaves a door's gap (the cabin kit's door section), the over-wing exits on their painted
 * outlines (a 0.25 m sill, onto the wing root), the rear doors. The cabin kit's sections have the same openings.
 */
export const OPENINGS = {
  l1: [25.62, 24.2, FLOOR, FLOOR + 2.45],
  l2: [11.8, 10.3, FLOOR, FLOOR + 2.45],
  exit: [2.82, 1.28, FLOOR + 0.25, FLOOR + 2.16],
  rear: [-21.7, -23.2, FLOOR, FLOOR + 2.45],
};
/**
 * The collision gap at an opening (z front, z aft): at least 2 m wide round its middle, wider than the painted door,
 * because the navmesh keeps about 0.8 m off every obstacle and bots need a lane through (players brush the jambs).
 */
export const NAV_GAP = 2.0;
export const navSpan = ([f, a]) => {
  const [c, h] = [(f + a) / 2, Math.max((f - a) / 2, NAV_GAP / 2)];
  return [Math.round((c + h) * 1000) / 1000, Math.round((c - h) * 1000) / 1000];
};
const AIRLINER = join(ROOT, 'content/props/meshy-owned-airliner.json');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: node tools/content/fuselage-profile.mjs <downloads dir>');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(join(resolve(dir), 'airliner-2026-11-04/refined/airliner.glb'));
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const b = getBounds(doc.getRoot().listScenes()[0]);
  const src = prim.getAttribute('POSITION').getArray();
  // The model's nose points to -x: turned a quarter about +Y (x, z) -> (z, -x), centred, stood up, scaled; then in
  // the game's frame (x mirrored, as the game draws glTF models). Left/right are averaged below anyway.
  const [cx, cz] = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
  const P = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    P[i] = -(src[i + 2] - cz) * SCALE;
    P[i + 1] = (src[i + 1] - b.min[1]) * SCALE;
    P[i + 2] = -(src[i] - cx) * SCALE;
  }
  const I = prim.getIndices().getArray();
  const slice = (z) => {
    const pts = [];
    for (let t = 0; t < I.length; t += 3) {
      for (const [a, c] of [[I[t], I[t + 1]], [I[t + 1], I[t + 2]], [I[t + 2], I[t]]]) {
        const [za, zc] = [P[a * 3 + 2], P[c * 3 + 2]];
        if ((za - z) * (zc - z) >= 0) continue;
        const u = (z - za) / (zc - za);
        pts.push([P[a * 3] + u * (P[c * 3] - P[a * 3]), P[a * 3 + 1] + u * (P[c * 3 + 1] - P[a * 3 + 1])]);
      }
    }
    return pts;
  };
  /** Nearest skin round (0, cy) in each direction, left and right folded together (the smaller of the two). */
  const ring = (pts, cy) => {
    const r = new Array(RAYS).fill(Infinity);
    for (const [x, y] of pts) {
      const a = Math.atan2(y - cy, Math.abs(x));
      for (const ang of [a, Math.PI - a]) {
        const k = Math.round((((ang / (2 * Math.PI)) * RAYS) % RAYS + RAYS) % RAYS) % RAYS;
        r[k] = Math.min(r[k], Math.hypot(x, y - cy));
      }
    }
    // Directions no edge fell in: the neighbours' mean.
    for (let k = 0; k < RAYS; k++) if (!Number.isFinite(r[k])) r[k] = (r[(k + RAYS - 1) % RAYS] + r[(k + 1) % RAYS]) / 2;
    return r;
  };
  /** The body's centre line at a station: halfway between the nearest skin straight above and below `cy0`. */
  const centre = (pts, cy0) => {
    const near = pts.filter(([x]) => Math.abs(x) < 0.25);
    const up = Math.min(...near.filter(([, y]) => y > cy0).map(([, y]) => y));
    const down = Math.max(...near.filter(([, y]) => y < cy0).map(([, y]) => y));
    return Number.isFinite(up) && Number.isFinite(down) ? (up + down) / 2 : cy0;
  };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const stations = [];
  const zMax = b.max[0] - cx;
  const zMin = b.min[0] - cx;
  // March out from the middle so each station's centre starts from its neighbour's.
  const mid = (STRAIGHT[0] + STRAIGHT[1]) / 2;
  const cy0 = centre(slice(mid), (b.max[1] - b.min[1]) * SCALE * 0.3);
  for (const dir of [1, -1]) {
    let cy = cy0;
    for (let z = mid + (dir > 0 ? 0 : -STEP); dir > 0 ? z < -zMin * SCALE - 0.1 : z > -zMax * SCALE + 0.1; z += dir * STEP) {
      const pts = slice(z);
      if (pts.length < 8) break;
      cy = centre(pts, cy);
      const r = ring(pts, cy);
      if (Math.max(...r) < 0.2 || !r.every(Number.isFinite)) break;
      stations.push({ z: r3(z), cy: r3(cy), r: r.map(r3) });
    }
  }
  stations.sort((p, q) => p.z - q.z);
  const straight = stations.filter((s) => s.z >= STRAIGHT[0] && s.z <= STRAIGHT[1]);
  const cy = r3(straight.reduce((s, q) => s + q.cy, 0) / straight.length);
  const constant = { cy, r: Array.from({ length: RAYS }, (_, k) => r3(Math.min(...straight.map((s) => s.r[k] + (s.cy - cy) * Math.sin((k / RAYS) * 2 * Math.PI))))) };
  const out = join(ROOT, 'assets-src/tiletrigger-cabin/fuselage.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({ $comment: 'Measured from the airliner shell by tools/content/fuselage-profile.mjs. Do not edit by hand.', scale: SCALE, rays: RAYS, straight: STRAIGHT, constant, stations: stations.filter((s) => s.z < STRAIGHT[0] + 0.6 || s.z > STRAIGHT[1] - 0.6) }, null, 0).replace(/\{"z"/g, '\n{"z"')}\n`);
  console.log(`wrote ${out}: ${stations.length} stations, constant ring ${Math.min(...constant.r)}–${Math.max(...constant.r)} m round y ${cy}`);
  writeShellCollision(P, I, stations);
}

/**
 * The shell's collision and openings, written into its entry in content/props/meshy-owned-airliner.json (`cut` and
 * `boxes`, the game's frame): the body as bands round the cabin, hollow above the floor so the cabin kit fits inside
 * (each band's inner face no further in than the kit's panels, its outer face on the skin), solid below the floor
 * and over the ceiling, with gaps at the openings; and whatever stands out of the body (wings, engines, the tail's
 * fin and stabilisers, the landing gear) as solid spans over a 1.2 m grid seen from above, merged where they agree.
 */
function writeShellCollision(P, I, stations) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const half = (st, y, inset) => {
    // Widest point of the ring at height y, `inset` in (0 where it doesn't reach).
    let best = 0;
    for (let k = 0; k < RAYS; k++) {
      const [a0, a1] = [(k / RAYS) * 2 * Math.PI, ((k + 1) / RAYS) * 2 * Math.PI];
      const p0 = [Math.cos(a0) * (st.r[k] - inset), st.cy + Math.sin(a0) * (st.r[k] - inset)];
      const p1 = [Math.cos(a1) * (st.r[(k + 1) % RAYS] - inset), st.cy + Math.sin(a1) * (st.r[(k + 1) % RAYS] - inset)];
      if ((p0[1] - y) * (p1[1] - y) > 0) continue;
      const t = p1[1] === p0[1] ? 0 : (y - p0[1]) / (p1[1] - p0[1]);
      best = Math.max(best, p0[0] + (p1[0] - p0[0]) * t);
    }
    return best;
  };
  // The body's rings, the fin's root held down to a round top (as the cabin kit does).
  const body = stations.filter((st) => st.r.every(Number.isFinite) && Math.min(...st.r) > 0.3).map((st) => {
    const hw = Math.max(st.r[0], st.r[RAYS / 2]);
    const topR = Math.min(st.r[RAYS / 4], hw * 1.08);
    return { z: st.z, cy: st.cy, r: st.r.map((v, k) => {
      const a = (k / RAYS) * 2 * Math.PI;
      return Math.sin(a) <= 0 ? v : Math.min(v, 1 / Math.hypot(Math.cos(a) / hw, Math.sin(a) / topR));
    }) };
  });
  const front = Math.max(...body.map((b) => b.z));
  const aft = Math.min(...body.map((b) => b.z));
  const boxes = [];
  const segs = [];
  for (let z = front; z > STRAIGHT[1] + 1e-6; z -= 1.2) segs.push([z, Math.max(STRAIGHT[1], z - 1.2)]);
  segs.push([STRAIGHT[1], STRAIGHT[0]]);
  for (let z = STRAIGHT[0]; z > aft + 1e-6; z -= 1.2) segs.push([z, Math.max(aft, z - 1.2)]);
  const doors = Object.values(OPENINGS);
  const gaps = doors.map((o) => [...navSpan(o), o[2], o[3]]);
  for (const [za, zb] of segs) {
    const rings = body.filter((b) => b.z <= za + 0.3 && b.z >= zb - 0.3);
    if (!rings.length) continue;
    const top = Math.max(...rings.map((b) => b.cy + b.r[RAYS / 4]));
    const bottom = Math.min(...rings.map((b) => b.cy - b.r[(3 * RAYS) / 4]));
    const cabin = rings.every((b) => half(b, FLOOR, 0.12) > 1.2) && za <= front - 1.0;
    for (let y0 = bottom; y0 < top - 0.05; y0 += 0.5) {
      const y1 = Math.min(top, y0 + 0.5);
      const ys = [y0, (y0 + y1) / 2, y1];
      const out = Math.max(...rings.flatMap((b) => ys.map((y) => half(b, y, 0))));
      if (out < 0.05) continue;
      const inn = Math.max(...rings.flatMap((b) => ys.map((y) => half(b, y, 0.12))));
      // Hollow where the cabin is: from the floor's underside to the ceiling's top.
      if (!cabin || y1 <= FLOOR - 0.3 || inn < 0.5 || y0 >= FLOOR + 2.85) {
        boxes.push([-out, y0, zb, out, y1, za]);
        continue;
      }
      const inner = Math.min(inn, out - 0.1);
      for (const side of [-1, 1]) {
        // The band less the openings on this side.
        let spans = [[za, zb]];
        for (const [f, a, sill, head] of gaps) {
          if (head <= y0 || sill >= y1 || a >= za || f <= zb) continue;
          spans = spans.flatMap(([s0, s1]) => (a >= s0 || f <= s1 ? [[s0, s1]] : [...(s0 > f ? [[s0, f]] : []), ...(a > s1 ? [[a, s1]] : [])]));
        }
        for (const [s0, s1] of spans) boxes.push(side < 0 ? [-out, y0, s1, -inner, y1, s0] : [inner, y0, s1, out, y1, s0]);
      }
    }
  }
  // What stands out of the body: vertical spans through the model over a grid, outside the body's rings.
  const CELL = 1.2;
  const [minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity].map((v, i) => {
    let m = v;
    for (let k = i < 2 ? 0 : 2; k < P.length; k += 3) m = i % 2 ? Math.max(m, P[k]) : Math.min(m, P[k]);
    return m;
  });
  const nx = Math.ceil((maxX - minX) / CELL);
  const nz = Math.ceil((maxZ - minZ) / CELL);
  const ringAt = (z) => body.reduce((best, b) => (Math.abs(b.z - z) < Math.abs(best.z - z) ? b : best), body[0]);
  const cols = new Map();
  const tris = [];
  for (let t = 0; t < I.length; t += 3) tris.push([I[t], I[t + 1], I[t + 2]].map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]));
  for (const tri of tris) {
    const xs = tri.map((q) => q[0]);
    const zs = tri.map((q) => q[2]);
    const [i0, i1] = [Math.floor((Math.min(...xs) - minX) / CELL - 0.5), Math.ceil((Math.max(...xs) - minX) / CELL - 0.5)];
    const [k0, k1] = [Math.floor((Math.min(...zs) - minZ) / CELL - 0.5), Math.ceil((Math.max(...zs) - minZ) / CELL - 0.5)];
    for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++)
      for (let k = Math.max(0, k0); k <= Math.min(nz - 1, k1); k++) {
        // Several rays per cell (its centre and four inner points): the column holds what any of them meets.
        for (const [du, dv] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
          const [x, z] = [minX + (i + du) * CELL, minZ + (k + dv) * CELL];
          const [a, b, c] = tri;
          const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
          if (Math.abs(d) < 1e-12) continue;
          const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d;
          const v = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const y = a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
          const key = `${i},${k},${du},${dv}`;
          if (!cols.has(key)) cols.set(key, []);
          cols.get(key).push(y);
        }
      }
  }
  // Per cell: the solid spans (hits paired off from the top), less what lies in the body.
  const cell = new Map();
  for (const [key, hits] of cols) {
    const [i, k] = key.split(',').map(Number);
    const [x, z] = [minX + (i + 0.5) * CELL, minZ + (k + 0.5) * CELL];
    const ring = ringAt(z);
    const inBody = z <= front + 0.3 && z >= aft - 0.3;
    hits.sort((p, q) => q - p);
    for (let h = 0; h + 1 < hits.length; h += 2) {
      let [y1, y0] = [hits[h], hits[h + 1]];
      if (y1 - y0 < 0.05) y0 = y1 - 0.15;
      const bodyHalf = inBody ? Math.max(half(ring, y0, -0.3), half(ring, y1, -0.3), half(ring, (y0 + y1) / 2, -0.3)) : 0;
      if (Math.abs(x) - CELL / 2 < bodyHalf) continue;
      const c = cell.get(`${i},${k}`) ?? { lo: Infinity, hi: -Infinity, spans: [] };
      c.spans.push([y0, y1]);
      cell.set(`${i},${k}`, c);
    }
  }
  // One span per cell: what a player meets (the lowest bottom to the highest top), then runs merged along z
  // (chord-wise) while their tops stay within 0.3 m (a step), then along x.
  const grid = new Map([...cell].map(([key, c]) => [key, [Math.min(...c.spans.map((s) => s[0])), Math.max(...c.spans.map((s) => s[1]))]]));
  const runs = [];
  for (let i = 0; i < nx; i++) {
    let k = 0;
    while (k < nz) {
      const g = grid.get(`${i},${k}`);
      if (!g) {
        k++;
        continue;
      }
      let [lo, hi] = g;
      let k1 = k;
      while (grid.has(`${i},${k1 + 1}`)) {
        const [l2, h2] = grid.get(`${i},${k1 + 1}`);
        if (Math.abs(h2 - hi) > 0.3 || Math.abs(l2 - lo) > 0.6) break;
        [lo, hi] = [Math.min(lo, l2), Math.max(hi, h2)];
        k1++;
      }
      runs.push({ i0: i, i1: i, k0: k, k1, lo, hi });
      k = k1 + 1;
    }
  }
  const merged = [];
  for (const r of runs.sort((a, b) => a.k0 - b.k0 || a.i0 - b.i0)) {
    const m = merged.find((q) => q.k0 === r.k0 && q.k1 === r.k1 && q.i1 === r.i0 - 1 && Math.abs(q.hi - r.hi) < 0.2 && Math.abs(q.lo - r.lo) < 0.4);
    if (m) Object.assign(m, { i1: r.i0, lo: Math.min(m.lo, r.lo), hi: Math.max(m.hi, r.hi) });
    else merged.push({ ...r });
  }
  for (const m of merged) boxes.push([minX + m.i0 * CELL, Math.max(0, m.lo), minZ + m.k0 * CELL, minX + (m.i1 + 1) * CELL, m.hi, minZ + (m.k1 + 1) * CELL]);
  // The openings, cut a little wider than the skin is thick round them; each side.
  const cut = [];
  for (const [f, a, sill, head] of doors) {
    const ring = ringAt((f + a) / 2);
    const inner = Math.min(half(ring, sill, 0.35), half(ring, head, 0.35));
    for (const side of [-1, 1]) cut.push(side < 0 ? [-4, sill, a, -inner, head, f] : [inner, sill, a, 4, head, f]);
  }
  const file = JSON.parse(readFileSync(AIRLINER, 'utf8'));
  const shell = file.props.find((q) => q.id === 'airliner_shell');
  shell.cut = cut.map((b) => b.map(r3));
  shell.boxes = boxes.map((b) => b.map(r3));
  writeFileSync(AIRLINER, `${JSON.stringify(file, null, 2).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, '[$1, $2, $3, $4, $5, $6]')}\n`);
  console.log(`wrote the shell's collision (${boxes.length} boxes, ${merged.length} of them outside the body) and ${cut.length} openings to ${AIRLINER}`);
}
