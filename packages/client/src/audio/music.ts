import ownerAudio from '../../../../content/owner-audio.json';
import { versioned } from '../assetUrl.ts';
import type { AudioSystem } from './audio.ts';

/**
 * The owner's music (docs/AUDIO_MUSIC_ANNOUNCER_PLAN.md, "Music"): the Arena tracks on the main menu, Match Setup
 * and lobbies, the Map Maker tracks in MapMaker, none in a match (MapMaker's test play included).
 *
 * - Each scene plays its tracks shuffled, none again until all have played (ShuffleDeck), crossfading about 3 s
 *   from one into the next; changing scene crossfades too, and a match fades it out.
 * - A track streams through an <audio> element into the music's bus (AudioSystem: its slider under the master
 *   volume), so only the one playing is fetched, and only once audio is unlocked by a click or key: the menu's
 *   first paint and a match's start never wait on it. Music at 0 % fetches nothing.
 * - A hidden tab pauses it; it carries on where it was when the tab is seen again.
 */
export type MusicScene = 'menu' | 'mapmaker';

export const MUSIC_BASE = `${import.meta.env.BASE_URL}music/`;
export const MUSIC_TRACKS: Record<MusicScene, string[]> = {
  menu: ownerAudio.music.menu.map((t) => t.id),
  mapmaker: ownerAudio.music.mapmaker.map((t) => t.id),
};
/** Seconds of crossfade between tracks and between scenes. */
export const CROSSFADE = 3;
/** Seconds the music takes to fade out when a match starts. */
export const MATCH_FADE = 1.2;

/** A shuffle that plays every item once before any repeats, and never the same one twice in a row across rounds. */
export class ShuffleDeck<T> {
  private order: T[] = [];
  private last: T | undefined;

  constructor(
    private readonly items: readonly T[],
    private readonly rng: () => number = Math.random,
  ) {}

  next(): T | undefined {
    if (!this.items.length) return undefined;
    if (!this.order.length) {
      const deck = [...this.items];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      // The new round mustn't open with the track that closed the last one.
      if (deck.length > 1 && deck[0] === this.last) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
      this.order = deck;
    }
    this.last = this.order.shift();
    return this.last;
  }
}

interface Playing {
  scene: MusicScene;
  id: string;
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  gain: GainNode;
  /** Already fading out (into the next track, another scene or a match). */
  leaving: boolean;
}

export class MusicPlayer {
  private scene: MusicScene | null = null;
  private readonly decks: Record<MusicScene, ShuffleDeck<string>>;
  private playing: Playing[] = [];
  private timer = 0;
  /** Tracks started, for tests (`__music`). */
  readonly stats = { started: 0, track: '' as string };

  constructor(
    private readonly audio: AudioSystem,
    rng: () => number = Math.random,
    private readonly enabled = true,
  ) {
    this.decks = { menu: new ShuffleDeck(MUSIC_TRACKS.menu, rng), mapmaker: new ShuffleDeck(MUSIC_TRACKS.mapmaker, rng) };
    audio.onUnlock(() => this.refresh());
    audio.onMusicVolume(() => this.refresh());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.visibility());
  }

  /** Where the app is: a scene's music, or none (a match). */
  setScene(scene: MusicScene | null): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.refresh();
  }

  /** At 0 % (the slider's Off) it stops, and fetches nothing; moved up from 0 it starts. */
  private get wanted(): MusicScene | null {
    return this.enabled && this.audio.getMusicVolume() > 0 ? this.scene : null;
  }

  private refresh(): void {
    const want = this.wanted;
    const current = this.playing.find((p) => !p.leaving);
    if (current && current.scene === want) return;
    if (current) this.fadeOut(current, want ? CROSSFADE : MATCH_FADE);
    if (want) this.start(want);
    this.tick();
  }

  private start(scene: MusicScene): void {
    const out = this.audio.musicOut;
    const id = out && this.decks[scene].next();
    if (!out || !id || (typeof document !== 'undefined' && document.hidden)) return;
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.src = versioned(`${MUSIC_BASE}${id}.ogg`);
    const src = out.ctx.createMediaElementSource(el);
    const gain = out.ctx.createGain();
    const t = out.ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + CROSSFADE);
    src.connect(gain);
    gain.connect(out.bus);
    const p: Playing = { scene, id, el, src, gain, leaving: false };
    // A track that fails (offline, an old browser without Opus) gives way to the next one after a pause, not a loop.
    el.addEventListener('error', () => this.drop(p));
    el.addEventListener('ended', () => {
      this.drop(p);
      if (!this.playing.some((q) => !q.leaving)) this.refresh();
    });
    this.playing.push(p);
    this.stats.started++;
    this.stats.track = id;
    void el.play().catch(() => undefined);
  }

  private fadeOut(p: Playing, secs: number): void {
    const out = this.audio.musicOut;
    p.leaving = true;
    if (!out) return this.drop(p);
    const t = out.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + secs);
    setTimeout(() => this.drop(p), secs * 1000 + 100);
  }

  private drop(p: Playing): void {
    const i = this.playing.indexOf(p);
    if (i < 0) return;
    this.playing.splice(i, 1);
    p.el.pause();
    // Stop the download too.
    p.el.removeAttribute('src');
    p.el.load();
    p.src.disconnect();
    p.gain.disconnect();
  }

  /** Twice a second while music plays: crossfade into the next track as this one nears its end. */
  private tick(): void {
    clearTimeout(this.timer);
    if (!this.playing.length) return;
    const current = this.playing.find((p) => !p.leaving);
    if (current && Number.isFinite(current.el.duration) && current.el.duration - current.el.currentTime <= CROSSFADE && !current.el.paused) {
      this.fadeOut(current, CROSSFADE);
      this.start(current.scene);
    }
    this.timer = window.setTimeout(() => this.tick(), 500);
  }

  private visibility(): void {
    if (document.hidden) {
      for (const p of this.playing) p.el.pause();
      return;
    }
    const live = this.playing.filter((p) => !p.leaving);
    for (const p of live) void p.el.play().catch(() => undefined);
    if (!live.length) this.refresh();
    else this.tick();
  }

  /** For tests: what plays now. */
  debug(): { scene: MusicScene | null; tracks: string[]; started: number } {
    return { scene: this.scene, tracks: this.playing.filter((p) => !p.leaving).map((p) => p.id), started: this.stats.started };
  }
}
