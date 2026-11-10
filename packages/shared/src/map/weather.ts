/**
 * Weather (map format v34, `MapDocument.weather`; MapMaker's Map properties): rain or snow falling, wind driving it,
 * and fog banks, with their sounds. The host may play another (MatchRules.weather: Match setup, the pause menu's Host
 * tab), which takes effect from the next match: the weather is fixed while a match plays.
 *
 * It only changes what you see and hear. Its one effect on play is fog: it thickens the haze, so you see less far
 * (everyone alike). Rain and snow never flash: there is no lightning (Reduce flashing, docs/LOOK.md).
 */

export const PRECIPITATION = ['none', 'rain', 'snow'] as const;
export type Precipitation = (typeof PRECIPITATION)[number];

export interface MapWeather {
  /** What falls: nothing, rain or snow. */
  fall: Precipitation;
  /** How hard it falls, 0 (a few drops) to 1 (a downpour or a blizzard). */
  amount: number;
  /** Wind, 0 (still) to 1 (a gale): slants the rain, drives the snow, moves the fog banks, and its sound. */
  wind: number;
  /** Fog banks, 0 (none) to 1 (thick): drifting fog low over the ground, and haze that hides the distance. */
  fog: number;
}

/** No weather: what a map without the field plays. */
export const CLEAR_WEATHER: MapWeather = { fall: 'none', amount: 0, wind: 0, fog: 0 };

/** The host's choices (Match setup, the Host tab): the map's own, or one of these. */
export const WEATHER_CHOICES = ['clear', 'rain', 'storm', 'snow', 'blizzard', 'fog'] as const;
export type WeatherChoice = (typeof WEATHER_CHOICES)[number];

export const WEATHER_PRESETS: Record<WeatherChoice, { label: string; weather: MapWeather }> = {
  clear: { label: 'Clear', weather: CLEAR_WEATHER },
  rain: { label: 'Rain', weather: { fall: 'rain', amount: 0.45, wind: 0.2, fog: 0.15 } },
  storm: { label: 'Heavy rain', weather: { fall: 'rain', amount: 1, wind: 0.7, fog: 0.3 } },
  snow: { label: 'Snow', weather: { fall: 'snow', amount: 0.45, wind: 0.15, fog: 0.2 } },
  blizzard: { label: 'Blizzard', weather: { fall: 'snow', amount: 1, wind: 0.85, fog: 0.45 } },
  fog: { label: 'Fog', weather: { fall: 'none', amount: 0, wind: 0.1, fog: 0.75 } },
};

export const isWeatherChoice = (v: unknown): v is WeatherChoice => typeof v === 'string' && (WEATHER_CHOICES as readonly string[]).includes(v);

const clamp01 = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** A weather made safe to play (unknown fall: none; numbers clamped to 0-1). */
export function cleanWeather(w: Partial<MapWeather> | null | undefined): MapWeather {
  if (!w) return CLEAR_WEATHER;
  const fall = (PRECIPITATION as readonly string[]).includes(w.fall as string) ? (w.fall as Precipitation) : 'none';
  return { fall, amount: fall === 'none' ? 0 : clamp01(w.amount), wind: clamp01(w.wind), fog: clamp01(w.fog) };
}

/** Whether a weather draws or sounds like anything at all. */
export const weatherActive = (w: MapWeather): boolean => (w.fall !== 'none' && w.amount > 0) || w.wind > 0 || w.fog > 0;

/** The map's own weather (MapDocument.weather), or clear. */
export function mapWeather(map: { weather?: Partial<MapWeather> | undefined } | null | undefined): MapWeather {
  return cleanWeather(map?.weather);
}

/** The weather a match plays: the host's choice (MatchRules.weather), else the map's own. */
export function matchWeather(rules: { weather?: string | undefined }, map: { weather?: Partial<MapWeather> | undefined } | null | undefined): MapWeather {
  return isWeatherChoice(rules.weather) ? WEATHER_PRESETS[rules.weather].weather : mapWeather(map);
}

/** A weather in a few words: "Heavy rain, windy, fog". */
export function weatherLabel(w: MapWeather): string {
  const parts: string[] = [];
  if (w.fall !== 'none' && w.amount > 0) parts.push(w.fall === 'rain' ? (w.amount >= 0.7 ? 'Heavy rain' : w.amount < 0.3 ? 'Drizzle' : 'Rain') : w.amount >= 0.7 ? 'Heavy snow' : w.amount < 0.3 ? 'Light snow' : 'Snow');
  if (w.wind >= 0.6) parts.push('gale');
  else if (w.wind >= 0.25) parts.push('windy');
  if (w.fog >= 0.5) parts.push('thick fog');
  else if (w.fog > 0) parts.push('fog');
  if (!parts.length) return 'Clear';
  const s = parts.join(', ');
  return s[0]!.toUpperCase() + s.slice(1);
}

/**
 * How much the fog banks thicken the scene's haze (exponential-squared density, added to the backdrop's): about 360 m
 * of sight at fog 0.5, 180 m at 1 (sightDistance). The one way weather touches play: what you can see.
 */
export function weatherFogDensity(w: MapWeather): number {
  return w.fog * 0.011 + (w.fall !== 'none' ? w.amount * 0.0025 : 0);
}

/** How far (m) a mid-grey target stays visible through a fog density (exp² fog to 2 % contrast). */
export function sightDistance(density: number): number {
  return density > 0 ? Math.sqrt(-Math.log(0.02)) / density : Infinity;
}

/**
 * Particles each graphics setting draws for a weather (the "phone tiers": Low draws none, only the mist; docs/MAP_BUDGETS.md,
 * "Weather"). Rain and snow are one draw each (a field of quads moved in the vertex shader), fog banks another.
 */
export const WEATHER_PARTICLES = { low: 0, medium: 2500, high: 6000 } as const;
export const FOG_BANK_SPRITES = { low: 0, medium: 10, high: 18 } as const;

/** Particles drawn for a weather at a graphics setting. */
export function weatherParticles(w: MapWeather, quality: keyof typeof WEATHER_PARTICLES): number {
  if (w.fall === 'none' || w.amount <= 0) return 0;
  return Math.round(WEATHER_PARTICLES[quality] * (0.25 + 0.75 * w.amount));
}
