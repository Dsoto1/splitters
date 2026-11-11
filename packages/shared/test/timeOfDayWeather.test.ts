// MapMaker overhaul Phase 5 (map format v34): the time of day's sun maths, the v33 -> v34 migration, the weather
// settings and the host's override.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLEAR_WEATHER,
  DEFAULT_RULES,
  EditHistory,
  MAP_FORMAT_VERSION,
  NOON_ELEVATION,
  SKIES,
  WEATHER_CHOICES,
  WEATHER_PARTICLES,
  WEATHER_PRESETS,
  applyCommand,
  cleanWeather,
  formatTime,
  initPhysics,
  invertCommand,
  loadMap,
  mapContentHash,
  mapTimeOfDay,
  mapWeather,
  matchWeather,
  migrateMapDocument,
  parseClientMessage,
  presetDirection,
  rulesFromSetup,
  serializeMap,
  setTimeOfDayCommand,
  setWeatherCommand,
  sightDistance,
  sunAt,
  weatherFogDensity,
  weatherLabel,
  weatherParticles,
  withPending,
  type MapDocument,
} from '../src/index.ts';
import { BotFiller, HostControl, Match, initNavigation } from '../src/match.ts';
import { makeMap } from './helpers.ts';

beforeAll(() => Promise.all([initPhysics(), initNavigation()]));

const yard = (): MapDocument => {
  const tiles = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 2; y++) tiles.push({ id: `y${x}_${y}`, tile: 'core.yard', x, y, z: 0, rotation: 0 as const });
  return makeMap(tiles, [[0, 0, 4], [40, 0, 4], [10, 0, 10], [30, 0, 10]]);
};
const len = (v: readonly number[]) => Math.hypot(...v);

describe('time of day: the sun', () => {
  it('rises in the east, is highest and south at noon, sets in the west; the moon lights the night', () => {
    const dawn = sunAt(6.5, 'clear');
    const noon = sunAt(12, 'clear');
    const dusk = sunAt(17.5, 'clear');
    const night = sunAt(0, 'clear');
    // The light travels away from the sun: from the east (+X) it travels towards -X.
    expect(dawn.direction[0]).toBeLessThan(-0.5);
    expect(dusk.direction[0]).toBeGreaterThan(0.5);
    // Noon: straight from the south (-Z), so the light travels +Z, at the noon elevation.
    expect(Math.abs(noon.direction[0])).toBeLessThan(1e-6);
    expect(noon.direction[2]).toBeGreaterThan(0);
    expect(noon.elevation).toBeCloseTo(NOON_ELEVATION, 5);
    expect(noon.elevation).toBeGreaterThan(dawn.elevation);
    expect(noon.elevation).toBeGreaterThan(dusk.elevation);
    // Midnight: moonlight, at Night's own elevation, Night's colour and picture.
    expect(night.night).toBe(1);
    expect(night.elevation).toBeCloseTo(40, 5);
    expect(night.sky.light.sunColor).toBe(SKIES.get('night')!.light.sunColor);
    expect(night.from).toBe('night');
    expect(night.mix).toBe(0);
    for (const s of [dawn, noon, dusk, night]) expect(len(s.direction)).toBeCloseTo(1, 9);
  });

  it('never lights from below 6° and moves smoothly through the whole day (no jumps in light, colour or direction)', () => {
    let prev = sunAt(0, 'cloudy');
    for (let q = 1; q <= 96 * 4; q++) {
      const s = sunAt(q / 16, 'cloudy');
      expect(s.elevation).toBeGreaterThanOrEqual(6 - 1e-9);
      expect(s.direction[1]).toBeLessThan(0);
      // A sixteenth of an hour moves the light a few degrees at most.
      const dot = s.direction.reduce((a, v, i) => a + v * prev.direction[i]!, 0);
      expect(Math.acos(Math.min(1, dot)) * (180 / Math.PI)).toBeLessThan(6);
      expect(Math.abs(s.sky.light.sun - prev.sky.light.sun)).toBeLessThan(0.08);
      expect(Math.abs(s.sky.light.hemi - prev.sky.light.hemi)).toBeLessThan(0.08);
      prev = s;
    }
  });

  it('blends between the presets: the day is the map own sky, dawn and dusk the sunrise, sunset and dusk pictures', () => {
    expect(sunAt(12, 'cloudy').from).toBe('cloudy');
    expect(sunAt(12, 'cloudy').sky.light).toMatchObject({ hemi: SKIES.get('cloudy')!.light.hemi, sun: SKIES.get('cloudy')!.light.sun, sunColor: SKIES.get('cloudy')!.light.sunColor });
    expect(sunAt(6.5, 'clear').from).toBe('sunrise');
    expect(sunAt(17.75, 'clear').from).toBe('sunset');
    // Between keys: two pictures, the second blended over the first.
    const between = sunAt(18.4, 'clear');
    expect([between.from, between.to]).toEqual(['sunset', 'dusk']);
    expect(between.mix).toBeGreaterThan(0);
    expect(between.mix).toBeLessThan(1);
    // A sunset or night map takes Clear day by day; a grey sky keeps its own picture at sunrise (with half its light).
    expect(sunAt(12, 'sunset').from).toBe('clear');
    expect(sunAt(6.5, 'storm').from).toBe('storm');
    expect(sunAt(6.5, 'storm').sky.light.sunColor).not.toBe(SKIES.get('storm')!.light.sunColor);
    // A Plain colour sky has no pictures, only colours (its theme's by day).
    const plain = sunAt(12, 'plain', '#336699');
    expect([plain.from, plain.to]).toEqual(['plain', 'plain']);
    expect(plain.sky.horizon).toBe('#336699');
    expect(sunAt(23, 'plain', '#336699').sky.horizon).toBe(SKIES.get('night')!.horizon);
  });

  it('a map without a time (or under a starfield) keeps its sky: the preset sun, exactly as before', () => {
    expect(mapTimeOfDay({}, 'clear')).toBeNull();
    expect(mapTimeOfDay({ timeOfDay: 9 }, 'space')).toBeNull();
    expect(mapTimeOfDay({ timeOfDay: 9 }, 'clear')).toBe(9);
    const clear = SKIES.get('clear')!;
    const el = (clear.light.elevation * Math.PI) / 180;
    expect(presetDirection(clear)).toEqual([-0.8 * Math.cos(el), -Math.max(0.15, Math.sin(el)), 0.6 * Math.cos(el)]);
    expect(formatTime(6.25)).toBe('06:15');
    expect(formatTime(24)).toBe('00:00');
    expect(sunAt(24, 'clear')).toEqual(sunAt(0, 'clear'));
  });
});

describe('map format v34', () => {
  it('a v33 map migrates unchanged and loads at its own look; time and weather save, load and count in the content hash', () => {
    expect(MAP_FORMAT_VERSION).toBeGreaterThanOrEqual(34);
    const v33 = { ...JSON.parse(readFileSync(new URL('./fixtures/iron_compound_v26.json', import.meta.url), 'utf8')), formatVersion: 33 };
    const { doc, fromVersion } = migrateMapDocument(structuredClone(v33));
    expect(fromVersion).toBe(33);
    expect(doc).toEqual({ ...v33, formatVersion: MAP_FORMAT_VERSION });
    const loaded = loadMap(structuredClone(v33));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.map.timeOfDay).toBeUndefined();
    expect(loaded.map.weather).toBeUndefined();
    expect(mapWeather(loaded.map)).toEqual(CLEAR_WEATHER);

    const base = yard();
    let set = applyCommand(base, setTimeOfDayCommand(base, 18.8));
    set = applyCommand(set, setWeatherCommand(set, { fall: 'snow', wind: 0.4 }));
    expect(set.timeOfDay).toBe(18.75);
    expect(set.weather).toEqual({ fall: 'snow', amount: 0.5, wind: 0.4, fog: 0 });
    const back = loadMap(serializeMap(set));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.map.timeOfDay).toBe(18.75);
    expect(back.map.weather).toEqual(set.weather);
    expect(mapContentHash(set)).not.toBe(mapContentHash(base));
    // Out of range is refused by the schema.
    expect(loadMap(JSON.parse(serializeMap({ ...base, timeOfDay: 25 }))).ok).toBe(false);
    expect(loadMap(JSON.parse(serializeMap({ ...base, weather: { fall: 'hail' as 'rain', amount: 1, wind: 0, fog: 0 } }))).ok).toBe(false);
  });

  it('each change is one undo step; clearing leaves no key', () => {
    const history = new EditHistory(yard());
    history.execute('Time', setTimeOfDayCommand(history.doc, 6.1));
    expect(history.doc.timeOfDay).toBe(6);
    history.execute('Rain', setWeatherCommand(history.doc, { fall: 'rain' }));
    history.execute('Harder', setWeatherCommand(history.doc, { amount: 1, fog: 0.33 }));
    expect(history.doc.weather).toEqual({ fall: 'rain', amount: 1, wind: 0, fog: 0.33 });
    history.undo();
    expect(history.doc.weather).toEqual({ fall: 'rain', amount: 0.5, wind: 0, fog: 0 });
    history.undo();
    expect('weather' in history.doc).toBe(false);
    history.execute('Clear time', setTimeOfDayCommand(history.doc, null));
    expect('timeOfDay' in history.doc).toBe(false);
    history.undo();
    expect(history.doc.timeOfDay).toBe(6);
    // Back to nothing at all: no weather key.
    const rainy = applyCommand(history.doc, setWeatherCommand(history.doc, { fall: 'rain' }));
    const none = setWeatherCommand(rainy, { fall: 'none' });
    expect(none).toEqual({ kind: 'setWeather', before: { fall: 'rain', amount: 0.5, wind: 0, fog: 0 }, after: null });
    expect(applyCommand(applyCommand(rainy, none), invertCommand(none)).weather).toEqual(rainy.weather);
  });
});

describe('weather settings', () => {
  it('cleans what it is given, says itself in a few words, and fog is its one effect on play (sight distance)', () => {
    expect(cleanWeather({ fall: 'hail' as 'rain', amount: 3, wind: -1, fog: Number.NaN })).toEqual({ fall: 'none', amount: 0, wind: 0, fog: 0 });
    expect(weatherLabel(CLEAR_WEATHER)).toBe('Clear');
    expect(weatherLabel(WEATHER_PRESETS.storm.weather)).toBe('Heavy rain, gale, fog');
    expect(weatherLabel(WEATHER_PRESETS.fog.weather)).toBe('Thick fog');
    expect(weatherFogDensity(CLEAR_WEATHER)).toBe(0);
    expect(sightDistance(weatherFogDensity({ ...CLEAR_WEATHER, fog: 0.5 }))).toBeCloseTo(360, -1);
    expect(sightDistance(weatherFogDensity({ ...CLEAR_WEATHER, fog: 1 }))).toBeCloseTo(180, -1);
  });

  it('phone tiers: Low draws no particles; more on High than Medium; only rain and snow draw any', () => {
    for (const w of WEATHER_CHOICES.map((c) => WEATHER_PRESETS[c].weather)) {
      expect(weatherParticles(w, 'low')).toBe(0);
      expect(weatherParticles(w, 'medium')).toBeLessThanOrEqual(weatherParticles(w, 'high'));
      if (w.fall === 'none') expect(weatherParticles(w, 'high')).toBe(0);
      else expect(weatherParticles(w, 'high')).toBeLessThanOrEqual(WEATHER_PARTICLES.high);
    }
  });
});

describe('the host override', () => {
  it("plays the host's choice, else the map's; Match setup carries it into the rules", () => {
    const map = { ...yard(), weather: { fall: 'snow' as const, amount: 0.8, wind: 0.2, fog: 0.1 } };
    expect(matchWeather({}, map)).toEqual(map.weather);
    expect(matchWeather({ weather: 'clear' }, map)).toEqual(CLEAR_WEATHER);
    expect(matchWeather({ weather: 'storm' }, map)).toEqual(WEATHER_PRESETS.storm.weather);
    expect(matchWeather({ weather: 'tornado' }, map)).toEqual(map.weather);
    expect(rulesFromSetup({ mode: 'core.deathmatch', weather: 'fog' } as never, map).rules.weather).toBe('fog');
    expect(rulesFromSetup({ mode: 'core.deathmatch', weather: 'tornado' } as never, map).rules.weather).toBeUndefined();
  });

  it('the Host tab: a weather waits for the next match (the weather is fixed while one plays), null is the map own', () => {
    const match = new Match(yard(), { ...DEFAULT_RULES['core.deathmatch'] }, 3);
    const bots = new BotFiller(match);
    bots.join('Host', undefined, 4);
    const control = new HostControl(match, bots, 4);
    expect(control.state().rules?.weather).toBeNull();
    expect(control.state().mapWeather).toBe('Clear');
    const parsed = parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { weather: 'blizzard' } } }));
    expect(parsed).toEqual({ t: 'host', cmd: { c: 'rules', rules: { weather: 'blizzard' } } });
    expect(parseClientMessage(JSON.stringify({ t: 'host', cmd: { c: 'rules', rules: { weather: 'tornado' } } }))).toBeNull();
    const r = control.apply({ c: 'rules', rules: { weather: 'blizzard' } });
    expect(r.notice).toContain('next match');
    expect(match.rules.weather).toBeUndefined();
    expect(control.state().pending).toEqual({ weather: 'blizzard' });
    expect(withPending(match.rules, control.state().pending).weather).toBe('blizzard');
    control.apply({ c: 'restart' });
    expect(match.rules.weather).toBe('blizzard');
    expect(control.state().rules?.weather).toBe('blizzard');
    // Back to the map's own.
    control.apply({ c: 'rules', rules: { weather: null } });
    control.apply({ c: 'restart' });
    expect(match.rules.weather).toBeUndefined();
    expect(withPending({ ...match.rules, weather: 'fog' }, { weather: null }).weather).toBeUndefined();
  });
});
