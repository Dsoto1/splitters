import { SKIES, type SkyDefinition, type SkyId } from './backdrop.ts';

/**
 * Time of day (map format v34, `MapDocument.timeOfDay`: hours, 0-24; MapMaker's Map properties). The map's sky is its
 * look by day; the time moves the sun across the sky and blends the light, the sky colours and the sky picture between
 * the existing sky presets: night, dusk, sunrise, the map's own day sky, sunset. A map without a time keeps its sky
 * exactly as it was (no field, no change). The time is fixed for the match, so the sun never moves while it plays
 * (the static shadow cache, game/shadowCache.ts, stays valid).
 */

export const TIME_OF_DAY_MIN = 0;
export const TIME_OF_DAY_MAX = 24;
/** MapMaker's slider steps a quarter of an hour. */
export const TIME_OF_DAY_STEP = 0.25;
/** Named times MapMaker offers beside the slider (and the screenshots use). */
export const TIME_PRESETS: readonly (readonly [label: string, hours: number])[] = [
  ['Dawn', 6.25],
  ['Morning', 9],
  ['Noon', 12],
  ['Afternoon', 15],
  ['Dusk', 18.75],
  ['Night', 22],
];

/** Day skies: the map's sky is its daytime look. Any other sky (sunrise, sunset, dusk, night) takes Clear day by day. */
const DAY_SKIES: ReadonlySet<string> = new Set(['clear', 'cloudy', 'overcast', 'misty', 'storm', 'snowy', 'plain']);
/** Grey day skies keep their own picture at sunrise and sunset (no clear-sky sunrise over a storm), with that light. */
const GREY_SKIES: ReadonlySet<string> = new Set(['overcast', 'storm', 'snowy', 'misty']);

/** Key times (hours) and the preset each looks like; `day` is the map's own day sky. Between two keys it blends. */
const KEYS: readonly (readonly [hours: number, look: SkyId | 'day'])[] = [
  [0, 'night'],
  [4.5, 'night'],
  [5.5, 'dusk'],
  [6.5, 'sunrise'],
  [8.5, 'day'],
  [15.5, 'day'],
  [17.75, 'sunset'],
  [19, 'dusk'],
  [20.5, 'night'],
  [24, 'night'],
];

/** The sun's highest (noon), degrees. */
export const NOON_ELEVATION = 62;
/** The moon's highest (midnight), degrees: Night's own light. */
const MOON_ELEVATION = 40;
/** Light never comes from lower than this (degrees): long shadows, never along the ground. */
const LOWEST = 6;

/** What a time of day draws: a sky made from the blend, the two sky pictures and how far between them, the light's direction. */
export interface SunState {
  /** The time, wrapped to 0-24. */
  hours: number;
  /** A sky definition carrying the blended colours and light (its id is the nearer key's sky, for sky effects). */
  sky: SkyDefinition;
  /** The sky picture under (`from`) and the one blended over it (`to`, by `mix` 0-1). Both the same when no blend. */
  from: string;
  to: string;
  mix: number;
  /** The direction the light travels (unit vector, pointing down): the sun by day, the moon by night. */
  direction: [number, number, number];
  /** The light's elevation above the horizon, degrees. */
  elevation: number;
  /** 0 by day, 1 at night (moonlight). */
  night: number;
}

/** Wrap any hour into [0, 24). */
export const wrapHours = (h: number): number => ((h % 24) + 24) % 24;

/** A time of day as "06:15". */
export function formatTime(hours: number): string {
  const h = wrapHours(hours);
  const m = Math.round((h % 1) * 60);
  const hh = Math.floor(h) + (m === 60 ? 1 : 0);
  return `${String(hh % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The sky id the map's own day look is (its sky when it is a day sky, else Clear day). */
export function daySky(sky: string): string {
  return DAY_SKIES.has(sky) ? sky : 'clear';
}

/** Whether a sky takes a time of day at all (a starfield has no sun). */
export const timeOfDayApplies = (sky: string): boolean => sky !== 'space';

/** Which two keys a time falls between, and how far (0 at `a`, 1 at `b`), eased so a blend starts and ends gently. */
function keyAt(hours: number): { a: SkyId | 'day'; b: SkyId | 'day'; t: number } {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, a] = KEYS[i]!;
    const [h1, b] = KEYS[i + 1]!;
    if (hours >= h0 && hours < h1) {
      const u = h1 > h0 ? (hours - h0) / (h1 - h0) : 0;
      return { a, b, t: u * u * (3 - 2 * u) };
    }
  }
  return { a: 'night', b: 'night', t: 0 };
}

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const toHex = (c: readonly number[]): string => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** Two colours mixed (in sRGB, as the presets were picked). */
export function mixColor(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + (y[i]! - v) * t));
}
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Where the light comes from at a time: the sun's arc by day (east at 06:00, south at noon, west at 18:00), the moon's by night. */
function lightDirection(hours: number): { direction: [number, number, number]; elevation: number; night: number } {
  // Day: 06:00-18:00 along the sun's arc; night: 18:00-06:00 along the moon's. Twilight blends the two.
  const dayU = (hours - 6) / 12;
  const nightU = wrapHours(hours - 18) / 12;
  const sunEl = Math.max(LOWEST, NOON_ELEVATION * Math.sin(Math.PI * Math.min(1, Math.max(0, dayU))));
  const moonEl = Math.max(LOWEST, MOON_ELEVATION * Math.sin(Math.PI * Math.min(1, Math.max(0, nightU))));
  // Night weight: 0 from 06:00 to 18:30, 1 from 20:30 to 04:30, eased between.
  const ease = (u: number) => {
    const c = Math.min(1, Math.max(0, u));
    return c * c * (3 - 2 * c);
  };
  const night = hours >= 12 ? ease((hours - 18.5) / 2) : 1 - ease((hours - 4.5) / 1.5);
  const toward = (el: number, az: number): [number, number, number] => {
    const e = (el * Math.PI) / 180;
    // Where the light is: east (+X) at az 0, south (-Z) at az π/2, west (-X) at az π. The light travels the other way.
    return [-Math.cos(az) * Math.cos(e), -Math.sin(e), Math.sin(az) * Math.cos(e)];
  };
  const sun = toward(sunEl, Math.PI * Math.min(1, Math.max(0, dayU)));
  // The moon rises where the sun set and sets where it rose (west at dusk, south at midnight, east at dawn), so the
  // light turns from one to the other without sweeping across the sky.
  const moon = toward(moonEl, Math.PI * (1 - Math.min(1, Math.max(0, nightU))));
  const d = sun.map((v, i) => lerp(v, moon[i]!, night)) as [number, number, number];
  // Never lower than LOWEST however the two mix.
  const minY = -Math.sin((LOWEST * Math.PI) / 180);
  if (d[1] > minY) d[1] = minY;
  const len = Math.hypot(...d) || 1;
  const direction = d.map((v) => v / len) as [number, number, number];
  const elevation = (Math.asin(-direction[1]) * 180) / Math.PI;
  return { direction, elevation, night };
}

/**
 * The look at a time of day under a map's sky (`sky`: its backdrop's sky id; `plainColour`: a Plain colour sky's
 * theme colour). Pure: the same inputs always give the same look (unit-tested in shared/test/timeOfDay.test.ts).
 */
export function sunAt(hours: number, sky: string, plainColour?: string): SunState {
  const h = wrapHours(hours);
  const day = daySky(sky);
  const plain = day === 'plain';
  const grey = GREY_SKIES.has(day);
  const { a, b, t } = keyAt(h);
  const lookOf = (k: SkyId | 'day'): SkyDefinition => {
    const id = k === 'day' ? day : k;
    const def = SKIES.get(id) ?? SKIES.get('clear')!;
    if (id === 'plain' && plainColour) return { ...def, horizon: plainColour, zenith: plainColour };
    return def;
  };
  // The picture each key shows: a Plain colour sky has none; a grey day keeps its own at sunrise and sunset.
  const pictureOf = (k: SkyId | 'day'): string => (plain ? 'plain' : k === 'day' || (grey && (k === 'sunrise' || k === 'sunset')) ? day : k);
  const A = lookOf(a);
  const B = lookOf(b);
  // A grey day's sunrise and sunset light is half the preset's, half its own (the sun behind cloud).
  const greyLight = (k: SkyId | 'day', s: SkyDefinition): SkyDefinition['light'] => {
    if (!grey || (k !== 'sunrise' && k !== 'sunset')) return s.light;
    const own = lookOf('day').light;
    return { hemi: lerp(s.light.hemi, own.hemi, 0.5), sun: lerp(s.light.sun, own.sun, 0.5), sunColor: mixColor(s.light.sunColor, own.sunColor, 0.5), elevation: s.light.elevation };
  };
  const la = greyLight(a, A);
  const lb = greyLight(b, B);
  const dir = lightDirection(h);
  const from = pictureOf(a);
  const to = pictureOf(b);
  const nearer = t < 0.5 ? a : b;
  const id = nearer === 'day' ? day : grey && (nearer === 'sunrise' || nearer === 'sunset') ? day : nearer;
  const out: SkyDefinition = {
    id,
    name: formatTime(h),
    file: (SKIES.get(t < 0.5 ? from : to) ?? SKIES.get('plain')!).file,
    horizon: mixColor(A.horizon, B.horizon, t),
    zenith: mixColor(A.zenith, B.zenith, t),
    light: { hemi: lerp(la.hemi, lb.hemi, t), sun: lerp(la.sun, lb.sun, t), sunColor: mixColor(la.sunColor, lb.sunColor, t), elevation: dir.elevation },
  };
  return { hours: h, sky: out, from, to, mix: from === to ? 0 : t, direction: dir.direction, elevation: dir.elevation, night: dir.night };
}

/** The direction light travels for a sky without a time of day (the presets' fixed sun: its elevation, from the south-east). */
export function presetDirection(sky: SkyDefinition): [number, number, number] {
  const el = (sky.light.elevation * Math.PI) / 180;
  return [-0.8 * Math.cos(el), -Math.max(0.15, Math.sin(el)), 0.6 * Math.cos(el)];
}

/** A map's time of day, or null when it keeps its sky's own look (no time set, or a starfield). */
export function mapTimeOfDay(doc: { timeOfDay?: number | undefined }, sky: string): number | null {
  const t = doc.timeOfDay;
  return typeof t === 'number' && Number.isFinite(t) && timeOfDayApplies(sky) ? wrapHours(t) : null;
}
