import {
  PRECIPITATION,
  TIME_OF_DAY_STEP,
  TIME_PRESETS,
  formatTime,
  mapWeather,
  resolveBackdrop,
  setTimeOfDayCommand,
  setWeatherCommand,
  timeOfDayApplies,
  weatherLabel,
  type EditCommand,
  type MapDocument,
  type MapWeather,
  type Precipitation,
} from '@tiletrigger/shared';

/**
 * Map properties → Time of day and Weather (MapMaker overhaul Phase 5; map format v34). The time slider and the
 * weather sliders preview live as they move (no edit: EditorView.previewSky) and make one undo step when let go
 * (shared editor/skyWeather.ts). Both are fixed for a match; the host may play another weather (Match setup, the
 * Host tab).
 */
export interface SkyWeatherHost {
  current(): MapDocument;
  run(label: string, cmd: EditCommand): boolean;
  /** Show a time (null: the sky's own look; undefined: the map's) and/or a weather without an edit. */
  preview(hours: number | null | undefined, weather?: MapWeather): void;
}

const FALL_LABELS: Record<Precipitation, string> = { none: 'None', rain: 'Rain', snow: 'Snow' };

function slider(id: string, value: number, max: number, step: number): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'range';
  i.id = id;
  i.min = '0';
  i.max = String(max);
  i.step = String(step);
  i.value = String(value);
  return i;
}

function line(label: string, ...controls: HTMLElement[]): HTMLElement {
  const r = document.createElement('div');
  r.className = 'row';
  const t = document.createElement('span');
  t.textContent = label;
  r.append(t, ...controls);
  return r;
}

export function skyWeatherSection(host: SkyWeatherHost): HTMLElement {
  const doc = host.current();
  const wrap = document.createElement('div');
  wrap.className = 'ed-skyweather';
  wrap.id = 'ed-skyweather';
  const head = document.createElement('div');
  head.className = 'sub-h';
  head.textContent = 'Time of day & weather';
  wrap.append(head);

  // ---- time of day
  const sky = resolveBackdrop(doc).sky;
  const hours = doc.timeOfDay;
  const on = document.createElement('input');
  on.type = 'checkbox';
  on.id = 'ed-tod-on';
  on.checked = hours !== undefined;
  on.title = "Off: the sky's own look (Environment → Sky). On: the sun at this time, its light and the sky between the presets.";
  const time = slider('ed-tod', hours ?? 12, 24, TIME_OF_DAY_STEP);
  time.disabled = !on.checked;
  const shown = document.createElement('span');
  shown.id = 'ed-tod-label';
  shown.className = 'ed-tod-label';
  shown.textContent = on.checked ? formatTime(hours!) : 'Sky';
  time.addEventListener('input', () => {
    shown.textContent = formatTime(Number(time.value));
    host.preview(Number(time.value));
  });
  time.addEventListener('change', () => host.run(`Time of day ${formatTime(Number(time.value))}`, setTimeOfDayCommand(host.current(), Number(time.value))));
  on.addEventListener('change', () => host.run(on.checked ? 'Set a time of day' : 'Clear time of day', setTimeOfDayCommand(host.current(), on.checked ? Number(time.value) : null)));
  const slide = document.createElement('div');
  slide.className = 'ed-tod-row';
  slide.append(time);
  wrap.append(line('Time of day', on, shown), slide);
  const presets = document.createElement('div');
  presets.className = 'ed-tod-presets';
  for (const [label, h] of TIME_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ed-tod-preset${hours === h ? ' on' : ''}`;
    b.dataset.hours = String(h);
    b.textContent = label;
    b.title = formatTime(h);
    b.addEventListener('click', () => host.run(`Time of day: ${label}`, setTimeOfDayCommand(host.current(), h)));
    presets.append(b);
  }
  wrap.append(presets);
  if (!timeOfDayApplies(sky)) {
    const note = document.createElement('small');
    note.className = 'ed-note';
    note.textContent = 'A starfield has no sun: the time of day changes nothing under it.';
    wrap.append(note);
  }

  // ---- weather
  const w = mapWeather(doc);
  const fall = document.createElement('select');
  fall.id = 'ed-weather-fall';
  for (const p of PRECIPITATION) fall.append(new Option(FALL_LABELS[p], p, false, p === w.fall));
  fall.addEventListener('change', () => host.run(`Weather: ${FALL_LABELS[fall.value as Precipitation]}`, setWeatherCommand(host.current(), { fall: fall.value as Precipitation })));
  wrap.append(line('Weather', fall));
  const live = (key: 'amount' | 'wind' | 'fog', label: string, id: string, tip: string) => {
    const s = slider(id, Math.round(w[key] * 100), 100, 5);
    s.title = tip;
    if (key === 'amount') s.disabled = w.fall === 'none';
    const patch = () => ({ [key]: Number(s.value) / 100 }) as Partial<MapWeather>;
    s.addEventListener('input', () => host.preview(undefined, { ...mapWeather(host.current()), ...patch() }));
    s.addEventListener('change', () => host.run(`Weather ${label.toLowerCase()}`, setWeatherCommand(host.current(), patch())));
    wrap.append(line(label, s));
  };
  live('amount', 'How hard', 'ed-weather-amount', 'From a few drops (or flakes) to a downpour (or a blizzard).');
  live('wind', 'Wind', 'ed-weather-wind', 'Slants the rain, drives the snow, moves the fog banks; and its sound.');
  live('fog', 'Fog banks', 'ed-weather-fog', 'Fog drifting low over the ground, and haze that hides the distance: everyone sees less far (its one effect on play).');
  const note = document.createElement('small');
  note.className = 'ed-note';
  note.id = 'ed-weather-note';
  note.textContent = `${weatherLabel(w)}. Fixed for the match; the host may pick another. Low graphics draw no rain or snow, only the fog.`;
  wrap.append(note);
  return wrap;
}
