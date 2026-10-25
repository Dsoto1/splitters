/**
 * Outfit dyes: a character texture recoloured in the browser so one outfit
 * can come in any colour. Each outfit family names which pixels count as its
 * cloth and which as its trim (by hue, saturation and lightness); those take
 * the dye's hue and saturation while keeping their own shading, measured
 * against the average lightness of that region so folds and seams survive.
 */
type Region = (h: number, s: number, l: number) => number;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Per family: how strongly a pixel (hue in degrees, sat and lightness 0–1) belongs to the cloth and to the trim. */
const REGIONS: Record<string, { cloth: Region; trim: Region }> = {
  // Greens are the cloth; browns the leather.
  ranger: {
    cloth: (h, s) => (h > 50 && h < 210 ? smooth(0.08, 0.2, s) * smooth(50, 65, h) * (1 - smooth(190, 210, h)) : 0),
    trim: (h, s, l) => (h < 50 || h > 340 ? smooth(0.15, 0.3, s) * (1 - smooth(0.75, 0.9, l)) : 0),
  },
  // The pale linen is the cloth; the browns the trim.
  peasant: {
    cloth: (h, s, l) => (h < 75 || h > 340 ? smooth(0.42, 0.55, l) * (1 - smooth(0.5, 0.7, s)) : 0) + (h >= 75 && h < 200 ? smooth(0.08, 0.2, s) : 0),
    trim: (h, s, l) => (h < 60 || h > 340 ? (1 - smooth(0.4, 0.5, l)) * smooth(0.12, 0.25, s) : 0),
  },
  // Sportswear: the grey fabric (everything else is skin).
  athlete: {
    cloth: (_h, s) => 1 - smooth(0.1, 0.2, s),
    trim: () => 0,
  },
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) as [number, number, number];

const loaded = new Map<string, Promise<HTMLImageElement>>();
function image(url: string): Promise<HTMLImageElement> {
  let p = loaded.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    loaded.set(url, p);
  }
  return p;
}

/** The texture at `url` (of outfit `family`) dyed, as a data URL; null if the family has no dye regions. */
export async function dyeTexture(url: string, family: string, cloth: string | null, trim: string | null): Promise<string | null> {
  const regions = REGIONS[family];
  if (!regions || (!cloth && !trim)) return null;
  const img = await image(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const n = px.length / 4;
  const hsl = new Float32Array(n * 3);
  const wc = new Float32Array(n);
  const wt = new Float32Array(n);
  // First pass: classify, and measure each region's average lightness.
  let sumC = 0;
  let accC = 0;
  let sumT = 0;
  let accT = 0;
  for (let i = 0; i < n; i++) {
    const [h, s, l] = rgbToHsl(px[i * 4]! / 255, px[i * 4 + 1]! / 255, px[i * 4 + 2]! / 255);
    hsl[i * 3] = h;
    hsl[i * 3 + 1] = s;
    hsl[i * 3 + 2] = l;
    const c = cloth ? Math.min(1, regions.cloth(h, s, l)) : 0;
    const t = trim ? Math.min(1 - c, regions.trim(h, s, l)) : 0;
    wc[i] = c;
    wt[i] = t;
    sumC += c * l;
    accC += c;
    sumT += t * l;
    accT += t;
  }
  const target = (c: string | null, mean: number) => {
    if (!c) return null;
    const [h, s, l] = rgbToHsl(...hex(c));
    return { h, s, l, mean: Math.max(0.05, mean) };
  };
  const tc = target(cloth, accC ? sumC / accC : 0.3);
  const tt = target(trim, accT ? sumT / accT : 0.3);
  for (let i = 0; i < n; i++) {
    const w = wc[i]! || wt[i]!;
    const t = wc[i] ? tc : wt[i] ? tt : null;
    if (!t || w <= 0) continue;
    const l = hsl[i * 3 + 2]!;
    // Keep the shading: lightness relative to the region's average, around the dye's own lightness.
    const nl = Math.max(0, Math.min(0.97, t.l * Math.pow(l / t.mean, 0.85)));
    const [r, g, b] = hslToRgb(t.h, t.s, nl);
    px[i * 4] = px[i * 4]! * (1 - w) + r * 255 * w;
    px[i * 4 + 1] = px[i * 4 + 1]! * (1 - w) + g * 255 * w;
    px[i * 4 + 2] = px[i * 4 + 2]! * (1 - w) + b * 255 * w;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}
