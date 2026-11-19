import type { Vec3 } from '@tiletrigger/shared';
import soundManifest from '../../../../content/sounds.json';
import { SYNTH_RATE, synthesize, type SynthRecipe } from './synth.ts';
import { versioned } from '../assetUrl.ts';

export const SOUND_BASE = `${import.meta.env.BASE_URL}sounds/`;
/** The lines themselves are listed by the announcer (audio/announcer.ts), which loads with a match: not in the menu's first JS. */
export type VoiceLine = keyof (typeof import('../../../../content/owner-audio.json'))['announcer'];

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
/** Seconds a voice cut to make room fades over. */
const STEAL_FADE = 0.015;

interface Voice {
  id: string;
  src: AudioBufferSourceNode;
  started: number;
  /** Its gain node (a stolen voice fades out through it instead of clicking off). */
  gain?: GainNode;
  /** Your own (unpositioned: your shots, steps, reloads, the HUD): never cut to make room for the world's sounds. */
  own: boolean;
  /** Metres from the listener when it started (0: your own). */
  dist: number;
}

/** A voice as the steal rule reads it (voiceToSteal). */
export interface VoiceSlot {
  id: string;
  own: boolean;
  dist: number;
  started: number;
}

/**
 * Which voice a new sound takes the place of: `index` into `voices` (-1: none needed), or `drop` when the new sound
 * should not play (owner, 2026-11-18: "gunshots are lagging now… chugging", in a 64-player Deathmatch on St. John's).
 * There every bot's rifle is heard (about 110 rifle shots a second, all inside the far range's 250 m), and the oldest
 * voice of a sound was cut for each new one: your own rifle's report, 0.4 s long, was cut within about 50 ms by the
 * bots' shots, every shot, so your full-auto stuttered. Now:
 * - your own sounds are only ever cut by your own (the oldest of the same sound past MAX_VOICES_PER_SOUND);
 * - a world sound replaces the farthest world voice of the same sound, or of any sound when every voice is in use,
 *   and is dropped instead when it is farther than all of those (a distant shot never silences a near one).
 */
export function voiceToSteal(voices: readonly VoiceSlot[], id: string, own: boolean, dist: number): { index: number; drop: boolean } {
  const pick = (ok: (v: VoiceSlot) => boolean, best: (a: VoiceSlot, b: VoiceSlot) => boolean): number => {
    let at = -1;
    for (let i = 0; i < voices.length; i++) if (ok(voices[i]!) && (at < 0 || best(voices[i]!, voices[at]!))) at = i;
    return at;
  };
  const oldest = (a: VoiceSlot, b: VoiceSlot) => a.started < b.started;
  const farthest = (a: VoiceSlot, b: VoiceSlot) => a.dist > b.dist || (a.dist === b.dist && a.started < b.started);
  let same = 0;
  for (const v of voices) if (v.id === id && v.own === own) same++;
  if (same >= MAX_VOICES_PER_SOUND) {
    const i = own ? pick((v) => v.id === id && v.own, oldest) : pick((v) => v.id === id && !v.own, farthest);
    if (!own && voices[i]!.dist <= dist) return { index: -1, drop: true };
    return { index: i, drop: false };
  }
  if (voices.length < MAX_VOICES) return { index: -1, drop: false };
  const world = pick((v) => !v.own, farthest);
  if (world >= 0 && (own || voices[world]!.dist > dist)) return { index: world, drop: false };
  if (!own) return { index: -1, drop: true };
  return { index: pick(() => true, oldest), drop: false };
}

export interface PlayOptions {
  /** World position; omit for a non-positional (first-person / UI) sound. */
  at?: Vec3;
  /** Extra volume multiplier. */
  gain?: number;
  /** Extra playback-rate multiplier (pitch and speed: the kill sound climbs with multi-kills). */
  rate?: number;
  /** The announcer's own volume (its slider) on top of the master: the announcer's Kenney fallbacks. */
  announcer?: boolean;
  /** Seconds from now to start it (your own shots keep their ticks' spacing when a frame runs several: SessionAudio.localShot). */
  delay?: number;
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
  /** The music's and the announcer's own volumes (Options), under the master volume. */
  private musicVolume = 0.5;
  private announcerVolume = 1;
  private musicBus: GainNode | null = null;
  private announcerBus: GainNode | null = null;
  /** The owner's announcer lines, decoded (audio/announcer.ts loads them, with a match: not in the menu's first JS). */
  readonly voice = new Map<VoiceLine, AudioBuffer>();
  private readonly unlockListeners: (() => void)[] = [];
  private readonly musicListeners: (() => void)[] = [];
  /** Counters for tests and the stats overlay (`voice`: the announcer lines loaded). */
  readonly stats = { loaded: 0, failed: 0, played: 0, culled: 0, dropped: 0, voice: 0, voiceFailed: 0, spoken: 0 };

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
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume;
      this.musicBus.connect(this.master);
      this.announcerBus = this.ctx.createGain();
      this.announcerBus.gain.value = this.announcerVolume;
      this.announcerBus.connect(this.master);
      void this.load();
      for (const f of this.unlockListeners.splice(0)) f();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Run `f` once audio is unlocked (now, if it already is): the music starts on the first click or key. */
  onUnlock(f: () => void): void {
    if (this.ctx) f();
    else this.unlockListeners.push(f);
  }

  /** The context and the music's bus (music.ts), once unlocked. */
  get musicOut(): { ctx: AudioContext; bus: GainNode } | null {
    return this.ctx && this.musicBus ? { ctx: this.ctx, bus: this.musicBus } : null;
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume;
    for (const f of this.musicListeners) f();
  }

  /** Call `f` when the music's volume changes (the player starts at the slider's first move up from 0, stops at 0). */
  onMusicVolume(f: () => void): void {
    this.musicListeners.push(f);
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setAnnouncerVolume(v: number): void {
    this.announcerVolume = Math.max(0, Math.min(1, v));
    if (this.announcerBus) this.announcerBus.gain.value = this.announcerVolume;
  }

  getAnnouncerVolume(): number {
    return this.announcerVolume;
  }

  /** The audio context, once unlocked. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Speak one of the owner's announcer lines (unpositioned, on the announcer's volume): its length in seconds, or
   * null when it can't be heard yet (audio locked, or the line not loaded), so the announcer can fall back.
   */
  speak(id: VoiceLine, gain = 1): number | null {
    const ctx = this.ctx;
    const buf = this.voice.get(id);
    if (!ctx || !this.announcerBus || ctx.state !== 'running' || !buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.announcerBus);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
    src.start();
    this.stats.spoken++;
    return buf.duration;
  }

  /** A sound's length in seconds (its first variant), or null if it isn't loaded. */
  duration(id: SoundId): number | null {
    return this.buffers.get(id)?.[0]?.duration ?? null;
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
      Object.entries(SOUNDS).map(async ([id, def], n) => {
        try {
          let list: AudioBuffer[];
          if (def.synth) {
            // One sound per task, spread out: synthesising them all at once froze the page for most of a second
            // right after the first click (which is usually opening a menu screen).
            await new Promise((r) => setTimeout(r, n * 8));
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
    src.playbackRate.value = (def.rate ?? 1) * (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (def.jitter ?? 0));
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
    tail.connect(opts.announcer && this.announcerBus ? this.announcerBus : master);

    const own = !at;
    const steal = voiceToSteal(this.voices, id, own, dist);
    if (steal.drop) {
      src.disconnect();
      tail.disconnect();
      this.stats.dropped++;
      return;
    }
    if (steal.index >= 0) this.stop(this.voices[steal.index]!);
    const when = ctx.currentTime + Math.max(0, opts.delay ?? 0);
    const voice: Voice = { id, src, started: when, gain, own, dist };
    this.voices.push(voice);
    src.onended = () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
      src.disconnect();
      tail.disconnect();
    };
    src.start(when);
    this.stats.played++;
  }

  private stop(v: Voice): void {
    try {
      // A short fade, not a click: a cut voice dies away over STEAL_FADE seconds.
      const t = this.ctx?.currentTime ?? 0;
      if (v.gain && this.ctx) {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(v.gain.gain.value, t);
        v.gain.gain.linearRampToValueAtTime(0, t + STEAL_FADE);
        v.src.stop(Math.max(t, v.started) + STEAL_FADE);
      } else v.src.stop();
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
