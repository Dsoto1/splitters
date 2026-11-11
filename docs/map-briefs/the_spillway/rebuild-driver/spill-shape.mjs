// The Spillway's ground as designed (metres; +z north/upstream, x east): what the sculpting driver aims the brushes at.
const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function hash(ix, iz) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = sm(x - ix), fz = sm(z - iz); return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), fx), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx), fz) * 2 - 1; }
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 7, z * 2.1 - 3) * 0.3 + vnoise(x * 4.3 - 11, z * 4.3 + 5) * 0.15;
// Piecewise-smooth through (z, value) knots.
function knots(z, ks) { if (z <= ks[0][0]) return ks[0][1]; for (let i = 1; i < ks.length; i++) if (z <= ks[i][0]) return lerp(ks[i - 1][1], ks[i][1], sm((z - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0]))); return ks.at(-1)[1]; }
const KNOLLS = [[-52, -98, 6.5, 24], [58, -44, 5, 19], [-70, -20, 4, 16], [36, -118, 4.5, 20], [84, -96, 3.5, 15]];
export const DAM = { z0: 54, z1: 70, crest: 20, water: 17 };
/** The valley's centre line and the half-width of its floor. */
export const centre = (z) => 9 * Math.sin((z + 30) / 62) + 62 * sm((z - 96) / 64);
export const halfWidth = (z) => knots(z, [[-160, 118], [-60, 104], [20, 84], [54, 66], [70, 66], [100, 84], [130, 62], [160, 44]]);
/** The river: from the tailrace at the powerhouse, winding south-west out of the map. */
export const riverX = (z) => centre(z) + 26 * Math.sin((z - 20) / 34) * sm((20 - z) / 40) - 30 * sm((-70 - z) / 80);
// A band along z that fades in and out over `edge` metres.
const band = (z, a, b, edge = 14) => sm((z - a) / edge) * sm((b - z) / edge);
export function height(x, z) {
  const cx = centre(z), hw = halfWidth(z), side = x < cx ? -1 : 1;
  let d = Math.abs(x - cx) - hw; // past the floor's edge
  // The floor: the low basin, the toe terrace in front of the dam, the reservoir's bed behind it.
  let floor = z < 54 ? lerp(1.2, 4, sm((z + 8) / 26)) : lerp(4, 7, sm((z - 54) / 16));
  // The basin rolls a little and rises towards the walls; the toe terrace and the lake bed stay near level.
  const loose = z < 16 ? 1 : 0.2;
  floor += (fbm(x / 34, z / 34) * 1.0 + fbm(x / 75 - 2, z / 75 + 9) * 1.9 + 2.6 * sm((Math.abs(x - cx) / hw - 0.4) / 0.6)) * loose;
  // Knolls and rock outcrops in the basin (cover, and the river winds between them).
  if (z < 16) for (const [kx, kz, kh, kr] of KNOLLS) floor += kh * sm(1 - Math.hypot(x - kx, z - kz) / kr);
  // Benches cut into the walls (the yards' pads are levelled exactly later).
  let bench = 0, benchWide = 0;
  const add = (w, h, wide) => { if (w > 0.001) { bench = lerp(bench, h, w); benchWide = lerp(benchWide, wide, w); } };
  if (side < 0) { add(band(z, -56, 30), 8, 50); add(band(z, 40, 78, 8), 20, 34); }
  else { add(band(z, 2, 50), 16, 42); add(band(z, 50, 78, 8), 20, 30); add(band(z, -110, -70), 4, 36); }
  let h = floor;
  if (d > 0) {
    const up = lerp(floor, Math.max(floor, bench), sm(d / 7)); // the bank up to the bench
    const dd = Math.max(0, d - benchWide);
    const rim = 50 + fbm(x / 60 + 3, z / 60) * 9;
    const wall = rim * sm(dd / 40) + fbm(x / 16, z / 16) * 4.5 * sm(dd / 14) + fbm(x / 7, z / 7) * 1.4 * sm(dd / 10);
    h = up + wall;
  } else if (z < 22) {
    // The river's channel in the basin, its banks eased.
    const r = Math.abs(x - riverX(z));
    h = lerp(h, -2, sm(1 - r / 11) * sm((22 - z) / 10));
  }
  return Math.round(Math.max(-4, Math.min(64, h)) * 4) / 4;
}
