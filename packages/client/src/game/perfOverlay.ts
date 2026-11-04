import { COUNT, SYS, perfProbe, type FrameSample } from './perfProbe.ts';
import { currentFrameCap, loadGraphicsQuality, loadRenderScale } from './graphicsSettings.ts';

export { loadPerfOverlay, savePerfOverlay } from './perfPrefs.ts';

/**
 * The performance overlay (F3, or Options → Display) and the report it copies: what frames cost on the
 * player's own machine, so a slowdown is measured rather than guessed (CI renders on the CPU and can't
 * see it). It reads perfProbe's frame samples (the probe runs while the overlay is on, keeping about a
 * minute of frames) and what each frame drew. docs/PERF_TOOLS.md explains the split.
 */

/** Frames kept: about a minute at 60 fps. */
const KEEP = 3600;
/** A frame this long (ms) is a hitch: a visible stutter. */
export const HITCH_MS = 50;
/** The overlay's figures cover this many seconds. */
const WINDOW_S = 5;

/**
 * A frame's main-thread time by system (ms), from perfProbe's spans. `render*` add up to the frame's
 * `scene.render()` without the characters' clips and skinning (counted under `characters`); `game` is the
 * frame's own JS that no system span covers (prediction, interpolation, camera, sounds, the view model).
 */
export interface FrameSplit {
  /** Placing characters and their state machines, Babylon's clips + aim + grip, and skinning. */
  characters: number;
  /** Of `characters`: the clips and the after-animation aim and grip. */
  charAnim: number;
  /** Of `characters`: skinning (bone matrices). */
  charSkin: number;
  effects: number;
  ragdolls: number;
  flames: number;
  hud: number;
  /** Handling server messages (snapshots, events), between frames. */
  net: number;
  game: number;
  /** The main pass: mesh evaluation (culling, LOD, world matrices) and drawing. */
  renderScene: number;
  /** Of `renderScene`: the active-mesh evaluation. */
  renderCull: number;
  /** Shadow maps and other render targets (the mist's depth map). */
  renderShadow: number;
  renderPost: number;
}

export const SPLIT_KEYS: (keyof FrameSplit)[] = ['characters', 'charAnim', 'charSkin', 'effects', 'ragdolls', 'flames', 'hud', 'net', 'game', 'renderScene', 'renderCull', 'renderShadow', 'renderPost'];

export function frameSplit(f: FrameSample): FrameSplit {
  const y = f.sys ?? [];
  const at = (i: number) => y[i] ?? 0;
  const inRender = at(SYS.anim) + at(SYS.skin);
  const systems = at(SYS.avatars) + at(SYS.fx) + at(SYS.ragdoll) + at(SYS.flames) + at(SYS.hud);
  return {
    characters: at(SYS.avatars) + inRender,
    charAnim: at(SYS.anim),
    charSkin: at(SYS.skin),
    effects: at(SYS.fx),
    ragdolls: at(SYS.ragdoll),
    flames: at(SYS.flames),
    hud: at(SYS.hud),
    net: f.msg,
    game: Math.max(0, f.js - systems),
    renderScene: Math.max(0, f.render - inRender - at(SYS.shadow) - at(SYS.post)),
    renderCull: at(SYS.cull),
    renderShadow: at(SYS.shadow),
    renderPost: at(SYS.post),
  };
}

/** The per-frame counts of perfProbe (COUNT) by name. */
export function frameCounts(f: FrameSample): { animated: number; skinned: number; ragdolls: number; lasting: number; effects: number; built: number } {
  const n = f.n ?? [];
  return { animated: n[COUNT.animated] ?? 0, skinned: n[COUNT.skinned] ?? 0, ragdolls: n[COUNT.ragdolls] ?? 0, lasting: n[COUNT.lasting] ?? 0, effects: n[COUNT.effects] ?? 0, built: n[COUNT.built] ?? 0 };
}

/** What one frame drew (GameView.perfCounts). */
export interface DrawCounts {
  draws: number;
  meshes: number;
  casters: number;
  characters: number;
  effects: number;
}

/** About the match and the machine, for the report. */
export interface ReportContext {
  renderer: string;
  match: string;
  map: string;
  mode: string;
  players: number;
  ping: string;
}

let gpu: string | null = null;

/** The graphics card, as the browser names it (WebGL's unmasked renderer, else the plain one). */
export function gpuName(): string {
  if (gpu !== null) return gpu;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = (gl && (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))) || 'unknown';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    gpu = 'unknown';
  }
  return gpu!;
}

export const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
export const pct = (xs: readonly number[], q: number) => {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
};
const ms = (x: number) => `${x.toFixed(1)} ms`;
/** The report's names for the split (8 wide, like its other lines). */
const SPLIT_LABEL: Record<keyof FrameSplit, string> = {
  characters: 'chars',
  charAnim: ' clips',
  charSkin: ' skin',
  effects: 'effects',
  ragdolls: 'ragdolls',
  flames: 'flames',
  hud: 'hud',
  net: 'net in',
  game: 'other',
  renderScene: 'r.scene',
  renderCull: ' culling',
  renderShadow: 'r.shadow',
  renderPost: 'r.post',
};
/** The match runs on a worker (offline play by default; a friend's game runs on its host): none of its ticks run here. */
const onWorker = (frames: readonly FrameSample[]) => frames.every((f) => f.ticks === 0);

export class PerfOverlay {
  private counts: DrawCounts[] = [];
  private shown = false;

  /** Show or hide: the frame probe runs while shown (or while a recording or a trace wants it). */
  set visible(on: boolean) {
    if (on === this.shown) return;
    this.shown = on;
    if (on) {
      perfProbe.frames = [];
      this.counts = [];
    }
    perfProbe.keep = KEEP;
    perfProbe.use('overlay', on);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** After each rendered frame: what it drew. */
  noteFrame(c: DrawCounts): void {
    this.counts.push(c);
    if (this.counts.length > KEEP) this.counts.splice(0, this.counts.length - KEEP);
  }

  /** The newest frames covering the last `seconds`. */
  private recent(seconds: number): { frames: FrameSample[]; counts: DrawCounts[] } {
    const frames = perfProbe.frames;
    let t = 0;
    let i = frames.length;
    while (i > 0 && t < seconds * 1000) t += frames[--i]!.dt;
    const n = frames.length - i;
    return { frames: frames.slice(i), counts: this.counts.slice(-n) };
  }

  /** The overlay's lines (label → value), over the last few seconds. */
  lines(): Record<string, string> {
    const { frames, counts } = this.recent(WINDOW_S);
    if (!frames.length) return { performance: 'measuring…' };
    const dt = frames.map((f) => f.dt);
    const seconds = dt.reduce((s, x) => s + x, 0) / 1000;
    const hitches = perfProbe.frames.filter((f) => f.dt > HITCH_MS).length;
    const sim = avg(frames.map((f) => f.sim));
    const net = avg(frames.map((f) => f.msg));
    const game = avg(frames.map((f) => f.js));
    const render = avg(frames.map((f) => f.render));
    const c = (k: keyof DrawCounts) => Math.round(avg(counts.map((x) => x[k])));
    const splits = frames.map(frameSplit);
    const sp = (k: keyof FrameSplit) => avg(splits.map((x) => x[k])).toFixed(1);
    const n = frames.map(frameCounts);
    const cn = (k: keyof ReturnType<typeof frameCounts>) => Math.round(avg(n.map((x) => x[k])));
    return {
      fps: `${(frames.length / seconds).toFixed(0)}  (frame ${ms(avg(dt))}, slowest 5% ${ms(pct(dt, 0.95))}, worst ${Math.round(Math.max(...dt))} ms)`,
      hitches: `${hitches} over ${HITCH_MS} ms in the last minute`,
      'frame split': `sim ${onWorker(frames) ? 'on a worker' : sim.toFixed(1)} · net ${net.toFixed(1)} · game ${game.toFixed(1)} · render ${render.toFixed(1)} ms`,
      render: `scene ${sp('renderScene')} (culling ${sp('renderCull')}) · shadows ${sp('renderShadow')} · post ${sp('renderPost')} ms`,
      systems: `characters ${sp('characters')} (clips ${sp('charAnim')}, skinning ${sp('charSkin')}) · effects ${sp('effects')} · ragdolls ${sp('ragdolls')} · flames ${sp('flames')} · hud ${sp('hud')} · other game ${sp('game')} ms`,
      drawn: `${c('draws')} draws · ${c('meshes')} meshes · ${c('casters')} shadow casters`,
      '': `${c('characters')} characters (${cn('animated')} animated, ${cn('skinned')} skinned a frame) · ${c('effects')} effects · ${cn('lasting')} lasting · ${cn('ragdolls')} ragdolls awake`,
      gpu: gpuName(),
      report: 'Pause → Settings → Copy performance report',
    };
  }

  /** The text to paste when reporting a slowdown: the machine, the settings, the match and the last minute's frames. */
  report(ctx: ReportContext): string {
    const frames = perfProbe.frames;
    const dt = frames.map((f) => f.dt);
    const seconds = dt.reduce((s, x) => s + x, 0) / 1000;
    const field = (k: 'sim' | 'msg' | 'js' | 'render') => frames.map((f) => f[k]);
    const line = (name: string, xs: number[]) => `${name.padEnd(8)} avg ${ms(avg(xs))}, slowest 5% ${ms(pct(xs, 0.95))}, worst ${ms(xs.length ? Math.max(...xs) : 0)}`;
    const count = (k: keyof DrawCounts) => {
      const xs = this.counts.map((c) => c[k]);
      return `${Math.round(avg(xs))} avg, ${xs.length ? Math.max(...xs) : 0} most`;
    };
    const splits = frames.map(frameSplit);
    const counts = frames.map(frameCounts);
    const perFrame = (k: keyof ReturnType<typeof frameCounts>) => {
      const xs = counts.map((c) => c[k]);
      return `${avg(xs).toFixed(1)} avg / ${xs.length ? Math.max(...xs) : 0} most`;
    };
    const nav = navigator as Navigator & { deviceMemory?: number };
    return [
      `Tile Trigger v${__APP_VERSION__} (${__ASSET_VERSION__}) performance report, ${new Date().toISOString()}`,
      '',
      `Browser   ${navigator.userAgent}`,
      `Machine   ${navigator.hardwareConcurrency ?? '?'} cores${nav.deviceMemory ? `, ${nav.deviceMemory} GB` : ''}; screen ${screen.width}×${screen.height} at ${devicePixelRatio}×; window ${innerWidth}×${innerHeight}`,
      `GPU       ${gpuName()}`,
      `Renderer  ${ctx.renderer}; graphics ${loadGraphicsQuality()}, render scale ${loadRenderScale()}, frame cap ${currentFrameCap() || 'none'}`,
      `Match     ${ctx.map}, ${ctx.mode}, ${ctx.players} players; ${ctx.match}; ping ${ctx.ping}`,
      '',
      `Frames    ${frames.length} over ${seconds.toFixed(0)} s: ${seconds ? (frames.length / seconds).toFixed(1) : 0} fps`,
      line('frame', dt),
      `hitches   ${dt.filter((x) => x > HITCH_MS).length} over ${HITCH_MS} ms, ${dt.filter((x) => x > 100).length} over 100 ms, ${dt.filter((x) => x > 250).length} over 250 ms`,
      onWorker(frames) ? 'sim      runs on a worker thread, off this one' : line('sim', field('sim')),
      line('net', field('msg')),
      line('game', field('js')),
      line('render', field('render')),
      '',
      'Per system (ms a frame; docs/PERF_TOOLS.md):',
      ...SPLIT_KEYS.map((k) => line(SPLIT_LABEL[k], splits.map((x) => x[k]))),
      '',
      `draws     ${count('draws')}`,
      `meshes    ${count('meshes')}`,
      `shadows   ${count('casters')} shadow casters`,
      `people    ${count('characters')} characters drawn`,
      `effects   ${count('effects')}`,
      `per frame ${(['animated', 'skinned', 'ragdolls', 'lasting', 'built'] as const).map((k) => `${k} ${perFrame(k)}`).join(', ')}`,
    ].join('\n');
  }
}
