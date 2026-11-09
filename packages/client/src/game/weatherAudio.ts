import type { MapWeather } from '@tiletrigger/shared';
import type { AudioSystem } from '../audio/audio.ts';

/** Each bed's copy lasts 2.4 s with a sine-squared fade at both ends (synth.ts `rain`, `wind`): one every 1.2 s is steady. */
const REPEAT_MS = 1200;

/**
 * The weather's sounds (map/weather.ts): rain on the ground, wind; unpositioned, round you. Each is a bed of
 * overlapping synthesised copies (`weather.rain`, `weather.wind`: our own synthesiser, docs/AUDIO.md), as the engines
 * are. Under a roof the rain is heard on it, quieter. Snow makes no sound of its own, only its wind.
 */
export class WeatherAudio {
  private rainAt = -Infinity;
  private windAt = -Infinity;
  /** Copies started (tests). */
  readonly started = { rain: 0, wind: 0 };

  constructor(private readonly audio: Pick<AudioSystem, 'play'>) {}

  /** How loud each bed plays for a weather, 0-1 (`shelter`: 0 in the open, 1 under a roof). */
  static levels(w: MapWeather, shelter: number): { rain: number; wind: number } {
    const rain = w.fall === 'rain' ? w.amount * (1 - shelter * 0.6) : 0;
    const wind = Math.min(1, w.wind + (w.fall === 'snow' ? w.amount * 0.25 : 0)) * (1 - shelter * 0.5);
    return { rain, wind };
  }

  /** Every frame in play (`now`: performance.now()). */
  update(w: MapWeather, shelter: number, now: number): void {
    const { rain, wind } = WeatherAudio.levels(w, shelter);
    if (rain > 0.02 && now - this.rainAt >= REPEAT_MS) {
      this.rainAt = now;
      this.started.rain++;
      this.audio.play('weather.rain', { gain: 0.35 + rain * 0.9 });
    }
    if (wind > 0.02 && now - this.windAt >= REPEAT_MS) {
      this.windAt = now;
      this.started.wind++;
      this.audio.play('weather.wind', { gain: 0.25 + wind * 0.9, rate: 0.9 + wind * 0.2 });
    }
  }
}
