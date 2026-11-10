import type { MapDocument } from '../map/schema.ts';
import { TIME_OF_DAY_STEP, wrapHours } from '../map/timeOfDay.ts';
import { cleanWeather, weatherActive, type MapWeather } from '../map/weather.ts';
import type { EditCommand } from './commands.ts';

/**
 * MapMaker's time of day and weather (Map properties; map format v34). Each change is one undo step; the UI
 * (client/editor/skyWeatherSection.ts) only wires these up.
 */

/** A time snapped to MapMaker's quarter hours (24:00 is 00:00). */
export const snapTime = (hours: number): number => wrapHours(Math.round(hours / TIME_OF_DAY_STEP) * TIME_OF_DAY_STEP);

/** Set the map's time of day (null: back to the sky's own look). */
export function setTimeOfDayCommand(doc: MapDocument, hours: number | null): EditCommand {
  return { kind: 'setTimeOfDay', before: doc.timeOfDay ?? null, after: hours === null || !Number.isFinite(hours) ? null : snapTime(hours) };
}

/** Change part of the map's weather (clear weather leaves no `weather` key). */
export function setWeatherCommand(doc: MapDocument, patch: Partial<MapWeather>): EditCommand {
  const now = cleanWeather(doc.weather);
  const next = cleanWeather({ ...now, ...patch });
  // Choosing rain or snow from nothing starts at a moderate fall.
  if (patch.fall && patch.fall !== 'none' && now.fall === 'none' && patch.amount === undefined) next.amount = 0.5;
  const round = (v: number) => Math.round(v * 100) / 100;
  const after: MapWeather = { fall: next.fall, amount: round(next.amount), wind: round(next.wind), fog: round(next.fog) };
  return { kind: 'setWeather', before: doc.weather ?? null, after: weatherActive(after) ? after : null };
}
