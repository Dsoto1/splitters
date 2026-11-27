/**
 * Fetches model files ahead of need and hands their bytes to a loader once: Character Select's prefetch (a tile
 * hovered or focused) and its click share one download per file, with its progress (the preview's loading bar).
 *
 * - `now` (a click) starts at once; `soon` (the tile under the pointer) and `later` (its row neighbours) wait for
 *   one of `max` slots, `soon` first.
 * - `want` keeps only the prefetches still wanted: queued ones not named go, and running `later` ones are aborted.
 * - Bytes fetched and not yet taken are kept up to `keepBytes` (oldest dropped first); `take` hands them over and
 *   forgets them (the loader keeps its parsed copy).
 */
export type FetchPriority = 'now' | 'soon' | 'later';

const RANK: Record<FetchPriority, number> = { now: 0, soon: 1, later: 2 };

interface Entry {
  url: string;
  priority: FetchPriority;
  state: 'queued' | 'running' | 'done';
  loaded: number;
  total: number;
  bytes: Promise<ArrayBuffer>;
  resolve(b: ArrayBuffer): void;
  reject(e: unknown): void;
  abort: AbortController | null;
  size: number;
  /** Order of finishing, for dropping the oldest. */
  doneAt: number;
}

export interface FileFetcherOptions {
  /** Prefetches running at once (a click's `now` always starts). */
  max?: number;
  /** Bytes kept for files fetched but not yet taken. */
  keepBytes?: number;
  fetch?: typeof fetch;
}

export class FileFetcher {
  private readonly entries = new Map<string, Entry>();
  private readonly max: number;
  private readonly keepBytes: number;
  private readonly doFetch: typeof fetch;
  private finished = 0;

  constructor(opts: FileFetcherOptions = {}) {
    this.max = opts.max ?? 2;
    this.keepBytes = opts.keepBytes ?? 24 << 20;
    this.doFetch = opts.fetch ?? ((...a) => fetch(...a));
  }

  /** The file's bytes, fetching it (or raising its priority) as needed. */
  get(url: string, priority: FetchPriority): Promise<ArrayBuffer> {
    let e = this.entries.get(url);
    if (!e) {
      let resolve!: (b: ArrayBuffer) => void;
      let reject!: (err: unknown) => void;
      const bytes = new Promise<ArrayBuffer>((res, rej) => ((resolve = res), (reject = rej)));
      // A prefetch nobody takes must not show as an unhandled rejection.
      bytes.catch(() => undefined);
      e = { url, priority, state: 'queued', loaded: 0, total: 0, bytes, resolve, reject, abort: null, size: 0, doneAt: 0 };
      this.entries.set(url, e);
    } else if (RANK[priority] < RANK[e.priority]) e.priority = priority;
    this.pump();
    return e.bytes;
  }

  /** Prefetch these (at `priority`) and drop the prefetches not among them or `keep` (a click's files always stay). */
  want(urls: readonly string[], priority: Exclude<FetchPriority, 'now'>, keep: readonly string[] = []): void {
    const named = new Set([...urls, ...keep]);
    for (const e of [...this.entries.values()]) {
      if (named.has(e.url) || e.priority === 'now' || e.state === 'done') continue;
      if (e.state === 'queued' || e.priority === 'later') this.drop(e);
    }
    for (const u of urls) this.get(u, priority);
  }

  /** The bytes, once fetched, handed over and forgotten here; null when the file isn't fetched yet. */
  take(url: string): Promise<ArrayBuffer> | null {
    const e = this.entries.get(url);
    if (!e) return null;
    if (e.state === 'done') this.entries.delete(url);
    else e.bytes.then(() => this.entries.get(url) === e && this.entries.delete(url), () => undefined);
    return e.bytes;
  }

  /** Bytes in and expected, over these files (a file not known here counts as in: a loader has it). */
  progress(urls: readonly string[]): { loaded: number; total: number } {
    let loaded = 0;
    let total = 0;
    for (const u of urls) {
      const e = this.entries.get(u);
      if (!e) continue;
      total += Math.max(e.total, e.loaded);
      loaded += e.loaded;
    }
    return { loaded, total };
  }

  /** Whether this file is fetched or on its way. */
  has(url: string): boolean {
    return this.entries.has(url);
  }

  private drop(e: Entry): void {
    this.entries.delete(e.url);
    e.abort?.abort();
    e.reject(new Error('prefetch dropped'));
  }

  private pump(): void {
    const queued = [...this.entries.values()].filter((e) => e.state === 'queued').sort((a, b) => RANK[a.priority] - RANK[b.priority]);
    let running = [...this.entries.values()].filter((e) => e.state === 'running' && e.priority !== 'now').length;
    for (const e of queued) {
      if (e.priority !== 'now' && running >= this.max) continue;
      if (e.priority !== 'now') running++;
      this.start(e);
    }
  }

  private start(e: Entry): void {
    e.state = 'running';
    e.abort = typeof AbortController === 'function' ? new AbortController() : null;
    const init: RequestInit & { priority?: string } = { signal: e.abort?.signal, priority: e.priority === 'later' ? 'low' : 'high' };
    void this.read(e, init).then(
      (buf) => {
        e.state = 'done';
        e.size = buf.byteLength;
        e.doneAt = ++this.finished;
        e.abort = null;
        e.resolve(buf);
        this.trim();
        this.pump();
      },
      (err) => {
        if (this.entries.get(e.url) === e) this.entries.delete(e.url);
        e.reject(err);
        this.pump();
      },
    );
  }

  private async read(e: Entry, init: RequestInit): Promise<ArrayBuffer> {
    const res = await this.doFetch(e.url, init);
    if (!res.ok) throw new Error(`${res.status} ${e.url}`);
    e.total = Number(res.headers.get('content-length')) || 0;
    if (!res.body) {
      const buf = await res.arrayBuffer();
      e.loaded = e.total = buf.byteLength;
      return buf;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      e.loaded += value.byteLength;
    }
    const out = new Uint8Array(e.loaded);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    e.total = e.loaded;
    return out.buffer;
  }

  /** Fetched-but-untaken files past the byte budget go, oldest first. */
  private trim(): void {
    const done = [...this.entries.values()].filter((e) => e.state === 'done').sort((a, b) => a.doneAt - b.doneAt);
    let bytes = done.reduce((n, e) => n + e.size, 0);
    for (const e of done) {
      if (bytes <= this.keepBytes) break;
      if (e.priority === 'now') continue;
      this.entries.delete(e.url);
      bytes -= e.size;
    }
  }
}
