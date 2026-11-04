import { COUNT_NAMES, perfProbe, type FrameSample } from './perfProbe.ts';
import { HITCH_MS, SPLIT_KEYS, avg, frameCounts, frameSplit, pct, gpuName, type DrawCounts, type FrameSplit } from './perfOverlay.ts';
import { currentFrameCap, loadGraphicsQuality, loadRenderScale } from './graphicsSettings.ts';
import type { ServerStats } from '@tiletrigger/shared';

/**
 * Level 2 of the performance tools (docs/PERF_TOOLS.md): a whole match recorded while "Record performance" is
 * on (Pause → Settings), saved as one compact JSON file through a plain browser download (nothing is uploaded:
 * the owner sends it on by hand). Each second: the per-system split (average and slowest frame), frame times,
 * what was drawn and the counts; each frame over HITCH_MS: a snapshot of where the player was and what was in
 * view. `tools/perf/compare.mjs` summarises one recording or compares two.
 */

/** Recording file format (compare.mjs reads it). */
export const RECORDING_FORMAT = 'tiletrigger-perf-recording';
export const RECORDING_VERSION = 1;
/** Frame-time histogram bucket edges (ms) per system, for p95s over the whole match without keeping every frame. */
export const BUCKETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100, 150, 250, 500, 1000];
/** At most this many hitch snapshots (the rest are counted): a ten-minute match of hitches stays a small file. */
const MAX_HITCHES = 2000;

/** What the session tells the recording about the moment (a hitch's snapshot, the header). */
export interface RecorderContext {
  map: string;
  mode: string;
  players: number;
  match: string;
  renderer: string;
  /** The player's (or the camera's) position. */
  pos: [number, number, number] | null;
  /** The latest server figures, when the match runs on a server (a dedicated host). */
  server: ServerStats | null;
  /** Shader programs built so far (new ones mid-match are first-sight stalls). */
  shaders: number;
}

/** The per-second row's fields, in order (the file names them once). */
const SECOND_FIELDS = [
  't',
  'frames',
  'frameAvg',
  'frameP95',
  'frameMax',
  ...SPLIT_KEYS.map((k) => `${k}Avg`),
  ...SPLIT_KEYS.map((k) => `${k}Max`),
  'draws',
  'meshes',
  'casters',
  'characters',
  'effectsDrawn',
  ...COUNT_NAMES,
  'shadersNew',
  'serverTickAvg',
  'serverTickMax',
] as const;

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export class PerfRecorder {
  readonly started = new Date();
  private readonly t0 = performance.now();
  private second: { f: FrameSample; c: DrawCounts }[] = [];
  private secondAt = performance.now();
  private readonly seconds: number[][] = [];
  private readonly hitches: unknown[] = [];
  private hitchCount = 0;
  private readonly hist = new Map<string, number[]>();
  private frames = 0;
  private shaders0 = -1;
  private shadersAt = 0;
  private header: RecorderContext | null = null;

  constructor(private readonly ctx: () => RecorderContext) {
    perfProbe.keep ||= 3600;
    perfProbe.use('record', true);
  }

  /** After each rendered frame (the probe's last sample and what it drew). */
  noteFrame(c: DrawCounts): void {
    const f = perfProbe.last;
    if (!f) return;
    perfProbe.last = null;
    this.frames++;
    const split = frameSplit(f);
    this.histAdd('frame', f.dt);
    for (const k of SPLIT_KEYS) this.histAdd(k, split[k]);
    this.second.push({ f, c });
    if (f.dt > HITCH_MS) this.hitch(f, split, c);
    const now = performance.now();
    if (now - this.secondAt >= 1000) this.flushSecond(now);
  }

  private histAdd(key: string, ms: number): void {
    let h = this.hist.get(key);
    if (!h) this.hist.set(key, (h = new Array<number>(BUCKETS.length + 1).fill(0)));
    let i = 0;
    while (i < BUCKETS.length && ms > BUCKETS[i]!) i++;
    h[i]!++;
  }

  private hitch(f: FrameSample, split: FrameSplit, c: DrawCounts): void {
    this.hitchCount++;
    if (this.hitches.length >= MAX_HITCHES) return;
    const x = this.ctx();
    const n = frameCounts(f);
    // Between frames: time the frame's own spans don't cover (a long task outside the frame: building a
    // character, a garbage collection, the browser itself), when the frame's work is far below its time.
    const busy = f.sim + f.msg + f.js + f.render;
    const shaders = x.shaders;
    this.hitches.push({
      t: round((performance.now() - this.t0) / 1000, 2),
      dt: round(f.dt, 1),
      busy: round(busy, 1),
      outside: round(Math.max(0, f.dt - busy), 1),
      split: Object.fromEntries(SPLIT_KEYS.map((k) => [k, round(split[k], 2)])),
      pos: x.pos?.map((v) => round(v, 1)) ?? null,
      map: x.map,
      inView: { characters: c.characters, effects: c.effects, lasting: n.lasting, ragdolls: n.ragdolls, draws: c.draws, meshes: c.meshes, casters: c.casters },
      counts: n,
      shadersNew: this.shaders0 >= 0 ? shaders - this.shadersAt : 0,
      quality: { graphics: loadGraphicsQuality(), renderScale: loadRenderScale(), frameCap: currentFrameCap() || null },
      server: x.server ? { tickAvg: round(x.server.tickMsAvg), tickMax: round(x.server.tickMsMax), aiAvg: round(x.server.aiMsAvg), late: x.server.lateTicks, bots: x.server.bots, ...(x.server.split ? { split: x.server.split } : {}) } : null,
    });
  }

  private flushSecond(now: number): void {
    const rows = this.second;
    this.second = [];
    this.secondAt = now;
    if (!rows.length) return;
    const x = this.ctx();
    if (!this.header) this.header = x;
    if (this.shaders0 < 0) this.shaders0 = this.shadersAt = x.shaders;
    const shadersNew = x.shaders - this.shadersAt;
    this.shadersAt = x.shaders;
    const dt = rows.map((r) => r.f.dt);
    const splits = rows.map((r) => frameSplit(r.f));
    const counts = rows.map((r) => r.f.n ?? []);
    const drawn = (k: keyof DrawCounts) => round(avg(rows.map((r) => r.c[k])), 1);
    this.seconds.push([
      round((now - this.t0) / 1000, 1),
      rows.length,
      round(avg(dt)),
      round(pct(dt, 0.95)),
      round(Math.max(...dt), 1),
      ...SPLIT_KEYS.map((k) => round(avg(splits.map((s) => s[k])), 3)),
      ...SPLIT_KEYS.map((k) => round(Math.max(...splits.map((s) => s[k])), 2)),
      drawn('draws'),
      drawn('meshes'),
      drawn('casters'),
      drawn('characters'),
      drawn('effects'),
      ...COUNT_NAMES.map((_, i) => round(avg(counts.map((n) => n[i] ?? 0)), 2)),
      shadersNew,
      x.server ? round(x.server.tickMsAvg) : -1,
      x.server ? round(x.server.tickMsMax) : -1,
    ]);
  }

  /** Stop: the recording as the file's object. */
  finish(): object {
    perfProbe.use('record', false);
    this.flushSecond(performance.now());
    const x = this.header ?? this.ctx();
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      format: RECORDING_FORMAT,
      version: RECORDING_VERSION,
      app: `${__APP_VERSION__} (${__ASSET_VERSION__})`,
      started: this.started.toISOString(),
      ended: new Date().toISOString(),
      seconds: round((performance.now() - this.t0) / 1000, 1),
      frames: this.frames,
      hitchMs: HITCH_MS,
      hitchCount: this.hitchCount,
      machine: {
        browser: navigator.userAgent,
        cores: navigator.hardwareConcurrency ?? null,
        memoryGB: nav.deviceMemory ?? null,
        gpu: gpuName(),
        screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
        window: `${innerWidth}x${innerHeight}`,
      },
      settings: { renderer: x.renderer, graphics: loadGraphicsQuality(), renderScale: loadRenderScale(), frameCap: currentFrameCap() || null },
      match: { map: x.map, mode: x.mode, players: x.players, match: x.match },
      buckets: BUCKETS,
      histograms: Object.fromEntries(this.hist),
      secondFields: SECOND_FIELDS,
      perSecond: this.seconds,
      hitches: this.hitches,
    };
  }
}

/** Hand a JSON object to the browser as a file download (no upload anywhere). */
export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A file name safe on every system: the map's name and the time. */
export function fileStamp(map: string): string {
  const t = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  return `${map.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'match'}-${t}`;
}

/**
 * Level 3 (docs/PERF_TOOLS.md): for `seconds`, every span of the split is also a `performance.measure` (named
 * `tt:…`, seen in a Chrome DevTools Performance recording's Timings track); at the end the spans download as a
 * Chrome trace-event JSON file that chrome://tracing and ui.perfetto.dev open. Resolves with the span count.
 */
export function captureTrace(seconds: number, name: string, meta: Record<string, unknown>): Promise<number> {
  perfProbe.spans = [];
  perfProbe.trace = true;
  perfProbe.use('trace', true);
  performance.mark('tt:trace start');
  return new Promise((done) => {
    setTimeout(() => {
      performance.mark('tt:trace end');
      perfProbe.trace = false;
      perfProbe.use('trace', false);
      const spans = perfProbe.spans;
      perfProbe.spans = [];
      // Complete events ("X") on one thread: nested spans (a frame holding its systems) show as a flame chart.
      const traceEvents = [
        { name: 'process_name', ph: 'M', pid: 1, tid: 1, args: { name: 'Tile Trigger page' } },
        { name: 'thread_name', ph: 'M', pid: 1, tid: 1, args: { name: 'main thread (tt: spans)' } },
        ...spans.map((s) => ({ name: s.name.replace(/^tt:/, ''), cat: 'tiletrigger', ph: 'X', ts: s.ts, dur: s.dur, pid: 1, tid: 1 })),
      ];
      downloadJson(`${name}.trace.json`, { traceEvents, displayTimeUnit: 'ms', metadata: { ...meta, app: `${__APP_VERSION__} (${__ASSET_VERSION__})`, gpu: gpuName() } });
      done(spans.length);
    }, seconds * 1000);
  });
}

export type { FrameSplit };
