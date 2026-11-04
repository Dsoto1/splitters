/**
 * Opt-in frame timing for performance runs (tools/perf96.mjs) and the F3 overlay, the match recording
 * (perfRecorder.ts) and the trace capture: where each rendered frame's time went. Off by default; when off
 * every probe is one boolean check. Turned on from the page with `window.__perf.on = true`.
 */

/**
 * The per-system split of a frame (docs/PERF_TOOLS.md). Each is a sum of `performance.now()` spans in the
 * frame; the render parts are spans inside `scene.render()`, the others inside the game frame's own JS.
 */
export const SYS = {
  /** GameView.updateAvatars: placing characters, their state machines, animation LOD, deaths. */
  avatars: 0,
  /** Babylon's clip evaluation and the after-animation aim and grip (inside render). */
  anim: 1,
  /** Skeletons' bone matrices (skinning on the CPU side, inside render). */
  skin: 2,
  /** One-shot and lasting effects (godotVfx, lastingFx), hit sparks, blood, remote muzzle flashes. */
  fx: 3,
  /** The effects physics step: ragdolls, debris, falling bodies. */
  ragdoll: 4,
  /** Prop flames (which flames are drawn this frame). */
  flames: 5,
  /** The HUD, minimap, overlay and pause menu. */
  hud: 6,
  /** Shadow maps and other render targets (the mist's depth map, reflections), inside render. */
  shadow: 7,
  /** Post-processing, inside render. */
  post: 8,
  /** The active-mesh evaluation (culling, LOD choice, world matrices), inside render, without skinning. */
  cull: 9,
} as const;
export type SysName = keyof typeof SYS;
export const SYS_NAMES = Object.keys(SYS) as SysName[];
/** The spans' names in a Chrome trace (performance.measure). */
export const SYS_LABELS: Record<SysName, string> = {
  avatars: 'tt:characters (update)',
  anim: 'tt:characters (clips + aim)',
  skin: 'tt:characters (skinning)',
  fx: 'tt:effects',
  ragdoll: 'tt:ragdolls + effects physics',
  flames: 'tt:prop flames',
  hud: 'tt:hud',
  shadow: 'tt:render: shadow + depth maps',
  post: 'tt:render: post-processing',
  cull: 'tt:render: mesh evaluation',
};

/** Per-frame counts that don't depend on timing (docs/PERF_TOOLS.md). */
export const COUNT = {
  /** Characters whose clips were evaluated this frame (animation LOD skips the others). */
  animated: 0,
  /** Skeletons whose bone matrices were computed this frame. */
  skinned: 1,
  /** Ragdolls awake (moving under physics). */
  ragdolls: 2,
  /** Lasting effects drawn (fires, gas, glows). */
  lasting: 3,
  /** One-shot effects playing. */
  effects: 4,
  /** Characters let through to be built this frame (one per 16 ms; their build runs after the frame). */
  built: 5,
} as const;
export type CountName = keyof typeof COUNT;
export const COUNT_NAMES = Object.keys(COUNT) as CountName[];

export interface FrameSample {
  /** Time since the previous frame started (ms). */
  dt: number;
  /** Simulation run on this thread since the previous frame (ms): Match.step, snapshots, encoding for friends. */
  sim: number;
  /** Ticks the simulation ran on this thread since the previous frame. */
  ticks: number;
  /** Largest number of ticks one wake of the sim loop ran since the previous frame (catch-up). */
  batch: number;
  /** Handling server messages (snapshots, events) since the previous frame (ms). */
  msg: number;
  /** The game frame's own JS: prediction, interpolation, visuals, HUD (ms), not counting render. */
  js: number;
  /** scene.render() (ms). */
  render: number;
  /** Per-system ms (SYS order). */
  sys: number[];
  /** Per-frame counts (COUNT order). */
  n: number[];
}

/** A finished trace span (Chrome trace event, microseconds from the page's time origin). */
export interface TraceSpan {
  name: string;
  ts: number;
  dur: number;
}

export const perfProbe = {
  on: false,
  /** Who wants the probe on (the overlay, a match recording, a trace): it runs while anyone does. */
  users: new Set<string>(),
  use(who: string, on: boolean): void {
    if (on) this.users.add(who);
    else this.users.delete(who);
    this.on = this.users.size > 0;
  },
  frames: [] as FrameSample[],
  /** Keep only this many frames (the performance overlay's rolling minute); 0 keeps them all (perf runs). */
  keep: 0,
  /** Accumulated since the last frame. */
  sim: 0,
  ticks: 0,
  batch: 0,
  msg: 0,
  lastFrame: 0,
  /** Start of the frame being measured, and its render time. */
  frameStart: 0,
  render: 0,
  /** This frame's per-system ms and counts so far. */
  sys: new Array<number>(SYS_NAMES.length).fill(0),
  n: new Array<number>(COUNT_NAMES.length).fill(0),
  /**
   * Trace capture: while set, every span is also a `performance.measure` (named SYS_LABELS, seen in a
   * Chrome DevTools Performance recording) and kept in `spans` for the JSON export.
   */
  trace: false,
  spans: [] as TraceSpan[],
  /** A span of system `i` that began at `t0` (performance.now) ends now. Returns now. */
  add(i: number, t0: number): number {
    const t = performance.now();
    this.sys[i]! += t - t0;
    if (this.trace) this.mark(SYS_LABELS[SYS_NAMES[i]!], t0, t);
    return t;
  },
  /** A traced span by name (frames, render, net): a measure in the trace only. */
  mark(name: string, t0: number, t1: number): void {
    try {
      performance.measure(name, { start: t0, end: t1 });
    } catch {
      // Older browsers without measure options: the JSON export still has it.
    }
    if (this.spans.length < 400_000) this.spans.push({ name, ts: Math.round(t0 * 1000), dur: Math.max(1, Math.round((t1 - t0) * 1000)) });
  },
  /** The sim loop ran `ticks` ticks taking `ms` (this thread). */
  addSim(ms: number, ticks: number): void {
    this.sim += ms;
    this.ticks += ticks;
    this.batch = Math.max(this.batch, ticks);
  },
  beginFrame(now: number): void {
    this.frameStart = now;
    this.render = 0;
  },
  endFrame(end: number): void {
    const dt = this.lastFrame ? this.frameStart - this.lastFrame : 0;
    this.lastFrame = this.frameStart;
    const total = end - this.frameStart;
    if (this.trace) {
      this.mark('tt:frame', this.frameStart, end);
      this.mark('tt:render', end - this.render, end);
    }
    if (dt > 0) {
      const f: FrameSample = { dt, sim: this.sim, ticks: this.ticks, batch: this.batch, msg: this.msg, js: Math.max(0, total - this.render), render: this.render, sys: this.sys.slice(), n: this.n.slice() };
      this.frames.push(f);
      this.last = f;
    }
    // Trimmed in batches: splicing a long array every frame was a copy of the whole minute per frame.
    if (this.keep && this.frames.length > this.keep + 600) this.frames.splice(0, this.frames.length - this.keep);
    this.sim = this.ticks = this.batch = this.msg = 0;
    this.sys.fill(0);
    this.n.fill(0);
  },
  /** The frame just finished (the match recording reads it). */
  last: null as FrameSample | null,
  reset(): void {
    this.frames = [];
    this.sim = this.ticks = this.batch = this.msg = 0;
    this.sys.fill(0);
    this.n.fill(0);
    this.lastFrame = 0;
  },
};

(globalThis as unknown as { __perf: typeof perfProbe }).__perf = perfProbe;

export { netProbe } from './netProbe.ts';
