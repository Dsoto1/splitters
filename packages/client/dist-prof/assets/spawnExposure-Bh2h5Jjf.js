const HEAT_LAYERS = ["went", "stuck", "died", "failed"];
const HEAT_LAYER_LABELS = {
  went: "Where bots went",
  stuck: "Where they got stuck",
  died: "Where they died",
  failed: "Where routes failed"
};
const HEAT_BAND = 2.5;
const SPAN = 1 << 14;
const OFF = SPAN / 2;
const BANDS = 1 << 9;
function heatCellFor(extent) {
  return Math.max(2, Math.min(8, Math.ceil(extent / 150)));
}
function heatGrid(cell = 2) {
  return { cell, cells: /* @__PURE__ */ new Map() };
}
function keyOf(g, x, y, z) {
  const c = Math.floor(x / g.cell) + OFF;
  const r = Math.floor(z / g.cell) + OFF;
  const b = Math.floor(y / HEAT_BAND) + BANDS / 2;
  if (c < 0 || c >= SPAN || r < 0 || r >= SPAN || b < 0 || b >= BANDS || !Number.isFinite(x + y + z)) return null;
  return (c * SPAN + r) * BANDS + b;
}
function addHeat(g, x, y, z, w = 1) {
  const k = keyOf(g, x, y, z);
  if (k === null || !(w > 0)) return false;
  const c = g.cells.get(k);
  if (c) {
    c.w += w;
    c.y += y * w;
  } else g.cells.set(k, { w, y: y * w });
  return true;
}
function heatCells(g, minShare = 0, limit = Infinity) {
  let max = 0;
  for (const c of g.cells.values()) max = Math.max(max, c.w);
  if (max <= 0) return [];
  const out = [];
  for (const [k, c] of g.cells) {
    const share = c.w / max;
    if (share < minShare) continue;
    const col = Math.floor(k / BANDS / SPAN) - OFF;
    const row = Math.floor(k / BANDS) % SPAN - OFF;
    out.push({ k, x: (col + 0.5) * g.cell, z: (row + 0.5) * g.cell, y: c.y / c.w, value: c.w, share });
  }
  out.sort((a, b) => b.value - a.value || a.k - b.k);
  return out.slice(0, limit).map(({ k: _k, ...cell }) => cell);
}
function heatColor(share) {
  const s = Math.max(0, Math.min(1, share));
  const stops = [
    [0, [0.1, 0.2, 0.9]],
    [0.35, [0.1, 0.85, 0.95]],
    [0.65, [1, 0.9, 0.15]],
    [1, [1, 0.15, 0.1]]
  ];
  for (let i = 1; i < stops.length; i++) {
    const [s1, c1] = stops[i];
    const [s0, c0] = stops[i - 1];
    if (s <= s1) {
      const f = (s - s0) / (s1 - s0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops[stops.length - 1][1];
}
const EXPOSURE_EYE = 1.5;
const EXPOSURE_CHEST = 1.2;
const EXPOSURE_RANGE = 120;
const EXPOSURE_NEAR = 4;
const EXPOSURE_SAMPLES = 400;
const EXPOSED_SHARE = 0.5;
const LONG_SIGHTLINE = 50;
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function samplePlaces(places, max = EXPOSURE_SAMPLES) {
  if (places.length <= max) return [...places];
  const out = [];
  const stride = places.length / max;
  for (let i = 0; i < max; i++) out.push(places[Math.floor(i * stride)]);
  return out;
}
function median(sorted) {
  if (!sorted.length) return 0;
  const m = sorted.length >> 1;
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}
function spawnExposure(spawns, places, sees, o = {}) {
  const range = o.range ?? EXPOSURE_RANGE;
  const near = o.near ?? EXPOSURE_NEAR;
  const keepLines = o.lines ?? 3;
  return spawns.map((s) => {
    const chest = { x: s.pos.x, y: s.pos.y + EXPOSURE_CHEST, z: s.pos.z };
    const dists = [];
    const seenAt = [];
    for (const p of places) {
      const d = flat(p, s.pos);
      if (d < near || d > range) continue;
      const eye = { x: p.x, y: p.y + EXPOSURE_EYE, z: p.z };
      if (!sees(eye, chest)) continue;
      dists.push(d);
      seenAt.push({ eye, d });
    }
    dists.sort((a, b) => a - b);
    seenAt.sort((a, b) => b.d - a.d);
    const share = places.length ? dists.length / places.length : 0;
    return {
      id: s.id,
      pos: s.pos,
      team: s.team ?? null,
      seenFrom: dists.length,
      of: places.length,
      share,
      nearest: dists[0] ?? 0,
      median: median(dists),
      farthest: dists[dists.length - 1] ?? 0,
      lines: seenAt.slice(0, keepLines).map((x) => [x.eye, chest])
    };
  });
}
function longSightlines(places, sees, o = {}) {
  const min = o.min ?? LONG_SIGHTLINE;
  const max = o.max ?? EXPOSURE_RANGE * 2;
  const keep = o.keep ?? 24;
  const apart = o.apart ?? 12;
  const pairs = [];
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const d = flat(places[i], places[j]);
      if (d >= min && d <= max) pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => b.d - a.d || a.i - b.i || a.j - b.j);
  const out = [];
  const eye = (p) => ({ x: p.x, y: p.y + EXPOSURE_EYE, z: p.z });
  for (const { i, j, d } of pairs) {
    if (out.length >= keep) break;
    const a = eye(places[i]);
    const b = eye(places[j]);
    const same = out.some((l) => flat(l.a, a) < apart && flat(l.b, b) < apart || flat(l.a, b) < apart && flat(l.b, a) < apart);
    if (same || !sees(a, b)) continue;
    out.push({ a, b, length: d });
  }
  return out;
}
function exposureIssues(results, share = EXPOSED_SHARE) {
  return results.filter((r) => r.of > 0 && r.share >= share).map((r) => ({
    severity: "warning",
    code: "spawn.exposed",
    message: `Exposed spawn: ${Math.round(r.share * 100)}% of the map can see it (from up to ${Math.round(r.farthest)} m away): give it cover`,
    targetId: r.id
  }));
}
export {
  EXPOSURE_SAMPLES as E,
  HEAT_LAYERS as H,
  addHeat as a,
  heatCells as b,
  spawnExposure as c,
  heatCellFor as d,
  heatColor as e,
  EXPOSED_SHARE as f,
  HEAT_LAYER_LABELS as g,
  heatGrid as h,
  exposureIssues as i,
  longSightlines as l,
  samplePlaces as s
};
