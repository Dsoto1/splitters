import { describe, expect, it } from 'vitest';
import { CLEAR_WEATHER, WEATHER_PRESETS } from '@tiletrigger/shared';
import { WeatherAudio } from '../src/game/weatherAudio.ts';

describe('weather sounds', () => {
  it('rain and wind beds: a copy every 1.2 s while it rains or blows, nothing in clear weather; a roof quietens the rain', () => {
    const played: { id: string; gain: number }[] = [];
    const audio = new WeatherAudio({ play: (id, opts) => void played.push({ id, gain: opts?.gain ?? 1 }) });
    for (let ms = 0; ms <= 6000; ms += 16) audio.update(WEATHER_PRESETS.storm.weather, 0, ms);
    expect(audio.started.rain).toBe(6);
    expect(audio.started.wind).toBe(6);
    const quiet = new WeatherAudio({ play: () => undefined });
    for (let ms = 0; ms <= 6000; ms += 16) quiet.update(CLEAR_WEATHER, 0, ms);
    expect(quiet.started).toEqual({ rain: 0, wind: 0 });
    // Snow: no rain, its wind only.
    expect(WeatherAudio.levels(WEATHER_PRESETS.snow.weather, 0).rain).toBe(0);
    expect(WeatherAudio.levels(WEATHER_PRESETS.snow.weather, 0).wind).toBeGreaterThan(0);
    const open = WeatherAudio.levels(WEATHER_PRESETS.storm.weather, 0);
    const roof = WeatherAudio.levels(WEATHER_PRESETS.storm.weather, 1);
    expect(roof.rain).toBeLessThan(open.rain * 0.5);
    expect(roof.rain).toBeGreaterThan(0);
  });
});
