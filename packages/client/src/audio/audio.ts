import type { Vec3 } from '@chronosplit/shared';
import soundManifest from '../../../../content/sounds.json';
import { SYNTH_RATE, synthesize, type SynthRecipe } from './synth.ts';
import { versioned } from '../assetUrl.ts';

export const SOUND_BASE = `${import.meta.env.BASE_URL}sounds/`;

type Range = 'near' | 'mid' | 'far';

export interface SoundDef {
  gain?: number;
  range?: Range;
  jitter?: number;
  rate?: number;
  synth?: string;
  variants: number | { pack: string; file: string }[];
}

export const SOUNDS = soundManifest.sounds as Record<string, SoundDef>;
export type SoundId = keyof typeof soundManifest.sounds;

/** How each range carries: reference distance, rolloff, and the distance past which it isn't played. */
const RANGES: Record<Range, { ref: number; rolloff: number; cull: number }> = {
  near: { ref: 2, rolloff: 2, cull: 30 },
  mid: { ref: 3, rolloff: 1.4, cull: 60 },
  far: { ref: 6, rolloff: 1, cull: 250 },
};

/** Voices of one sound allowed at once; the oldest is cut when exceeded. */
const MAX_VOICES_PER_SOUND = 6;
const MAX_VOICES = 40;

interface Voice {
  id: string;
  src: AudioBufferSourceNode;
  started: number;
}

export interface PlayOptions {
  /** World position; omit for a non-positional (first-person / UI) sound. */
  at?: Vec3;
  /** Extra volume multiplier. */
  gain?: number;
}

/**
 * Game audio on the Web Audio API. Sound buffers are loaded once and shared by
 * every match. World sounds are positioned with HRTF panners relative to the
 * listener (the camera); distant sounds are also muffled with a low-pass.
 *
 * World space is Babylon's left-handed system; Web Audio is right-handed, so Z
 * is mirrored on the way in.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer[]>();
  private voices: Voice[] = [];
  private loading: Promise<void> | null = null;
  private listener: Vec3 = { x: 0, y: 0, z: 0 };
  private volume = 0.8;
  /** Counters for tests and the stats overlay. */
  readonly stats = { loaded: 0, failed: 0, played: 0, culled: 0 };

  /** Create the context and start loading. Call from a user gesture so the context can start. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      // A gentle limiter keeps many simultaneous shots from clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.15;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp);
      void this.load();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Number of sounds in the manifest. */
  get total(): number {
    return Object.keys(SOUNDS).length;
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  getVolume(): number {
    return this.volume;
  }

  /** Load every sound in the manifest. Resolves when all have loaded or failed. */
  load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve();
    this.loading ??= Promise.all(
      Object.entries(SOUNDS).map(async ([id, def]) => {
        try {
          let list: AudioBuffer[];
          if (def.synth) {
            const count = def.variants as number;
            list = Array.from({ length: count }, (_, v) => {
              const samples = synthesize(def.synth as SynthRecipe, v);
              const buf = ctx.createBuffer(1, samples.length, SYNTH_RATE);
              buf.copyToChannel(samples, 0);
              return buf;
            });
          } else {
            const files = def.variants as { file: string }[];
            list = await Promise.all(
              files.map(async (_, i) => {
                const res = await fetch(versioned(`${SOUND_BASE}${id}_${i}.ogg`));
                if (!res.ok) throw new Error(`${res.status}`);
                return ctx.decodeAudioData(await res.arrayBuffer());
              }),
            );
          }
          this.buffers.set(id, list);
          this.stats.loaded++;
        } catch (err) {
          this.stats.failed++;
          console.warn(`sound ${id} failed to load`, err);
        }
      }),
    ).then(() => undefined);
    return this.loading;
  }

  /** Move the listener (call once per frame with the camera). */
  setListener(eye: Vec3, yaw: number, pitch: number): void {
    this.listener = eye;
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const cp = Math.cos(pitch);
    // Forward and up in audio space (Z mirrored).
    const f = [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp] as const;
    const u = [-Math.sin(yaw) * Math.sin(pitch), cp, Math.cos(yaw) * Math.sin(pitch)] as const;
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setValueAtTime(eye.x, t);
      l.positionY.setValueAtTime(eye.y, t);
      l.positionZ.setValueAtTime(-eye.z, t);
      l.forwardX.setValueAtTime(f[0], t);
      l.forwardY.setValueAtTime(f[1], t);
      l.forwardZ.setValueAtTime(f[2], t);
      l.upX.setValueAtTime(u[0], t);
      l.upY.setValueAtTime(u[1], t);
      l.upZ.setValueAtTime(u[2], t);
    } else {
      l.setPosition(eye.x, eye.y, -eye.z);
      l.setOrientation(f[0], f[1], f[2], u[0], u[1], u[2]);
    }
  }

  play(id: SoundId, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    const list = this.buffers.get(id);
    if (!ctx || !master || ctx.state !== 'running' || !list?.length) return;
    const def = SOUNDS[id]!;
    const range = RANGES[def.range ?? 'mid'];
    const at = opts.at;
    const dist = at ? Math.hypot(at.x - this.listener.x, at.y - this.listener.y, at.z - this.listener.z) : 0;
    if (dist > range.cull) {
      this.stats.culled++;
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)]!;
    src.playbackRate.value = (def.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (def.jitter ?? 0));
    const gain = ctx.createGain();
    gain.gain.value = (def.gain ?? 1) * (opts.gain ?? 1);
    let tail: AudioNode = gain;
    src.connect(gain);
    if (at) {
      // Air absorption: far sounds lose their top end.
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.max(1200, 20000 / (1 + dist / 12));
      const panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: range.ref,
        rolloffFactor: range.rolloff,
        maxDistance: range.cull,
        positionX: at.x,
        positionY: at.y,
        positionZ: -at.z,
      });
      tail.connect(lp);
      lp.connect(panner);
      tail = panner;
    }
    tail.connect(master);

    this.limitVoices(id);
    const voice: Voice = { id, src, started: ctx.currentTime };
    this.voices.push(voice);
    src.onended = () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
      src.disconnect();
      tail.disconnect();
    };
    src.start();
    this.stats.played++;
  }

  private limitVoices(id: string): void {
    const same = this.voices.filter((v) => v.id === id);
    if (same.length >= MAX_VOICES_PER_SOUND) this.stop(same[0]!);
    if (this.voices.length >= MAX_VOICES) this.stop(this.voices[0]!);
  }

  private stop(v: Voice): void {
    try {
      v.src.stop();
    } catch {
      // Already stopped.
    }
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
  }

  /** Silence everything (leaving a match). */
  stopAll(): void {
    for (const v of [...this.voices]) this.stop(v);
  }
}
