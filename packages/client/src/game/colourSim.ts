/**
 * Colour-vision simulation and colour difference, for checking team colours (colourVision.ts, its tests and
 * tools/look/colourblind-sim.mjs). Not used while a match plays.
 * - Protanopia and deuteranopia: Viénot, Brettel & Mollon (1999), one projection in linear sRGB.
 * - Tritanopia: Brettel, Viénot & Mollon (1997), two half-planes split by the neutral axis and the 485 nm / 660 nm
 *   anchors, in linear sRGB.
 * The matrices are the ones DaltonLens publishes for sRGB (libDaltonLens, public domain).
 * Differences are CIEDE2000 in CIELAB (D65).
 */

export type Deficiency = 'protan' | 'deutan' | 'tritan';
export type Rgb = readonly [number, number, number];

const VIENOT: Record<'protan' | 'deutan', readonly number[]> = {
  protan: [0.11238, 0.88762, 0.0, 0.11238, 0.88762, -0.0, 0.00401, -0.00401, 1.0],
  deutan: [0.29275, 0.70725, 0.0, 0.29275, 0.70725, -0.0, -0.02234, 0.02234, 1.0],
};
const TRITAN_1 = [1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.805, 0.11911];
const TRITAN_2 = [0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.1232, -0.37562, 1.12767, 0.24796];
const TRITAN_PLANE = [0.03901, -0.02788, -0.01113];

/** '#rrggbb' → 0..255 channels. */
export function hexRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbHex = (c: Rgb): string => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const toLinear = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number): number => {
  const c = Math.max(0, Math.min(1, v));
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
};

const mul = (m: readonly number[], v: Rgb): Rgb => [m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2], m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2], m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2]];

/** How a colour (0..255 channels) looks to someone with the deficiency (complete: dichromacy). */
export function simulate(c: Rgb, kind: Deficiency): Rgb {
  const lin: Rgb = [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])];
  let out: Rgb;
  if (kind === 'tritan') {
    const side = lin[0] * TRITAN_PLANE[0]! + lin[1] * TRITAN_PLANE[1]! + lin[2] * TRITAN_PLANE[2]!;
    out = mul(side >= 0 ? TRITAN_1 : TRITAN_2, lin);
  } else out = mul(VIENOT[kind], lin);
  return [fromLinear(out[0]), fromLinear(out[1]), fromLinear(out[2])];
}

export const simulateHex = (hex: string, kind: Deficiency): string => rgbHex(simulate(hexRgb(hex), kind));

/** CIELAB (D65) of a colour (0..255 channels). */
export function lab(c: Rgb): Rgb {
  const [r, g, b] = [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 between two colours (0..255 channels). About 2 is just noticeable; past 20 two colours read apart at a glance. */
export function deltaE2000(c1: Rgb, c2: Rgb): number {
  const [L1, a1, b1] = lab(c1);
  const [L2, a2, b2] = lab(c2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

/** CIEDE2000 between two '#rrggbb' colours as seen with `kind` (null: normal vision). */
export function seenDelta(a: string, b: string, kind: Deficiency | null): number {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  return kind ? deltaE2000(simulate(ca, kind), simulate(cb, kind)) : deltaE2000(ca, cb);
}
