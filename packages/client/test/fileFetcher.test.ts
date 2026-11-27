/**
 * Character Select's file fetcher (content/fileFetcher.ts): prefetches wait for a slot and for more urgent files (a click doesn't wait), one
 * download per file shared by a prefetch and the pick, prefetches no longer wanted are dropped, progress counts the
 * bytes in, and bytes not taken are kept only up to a budget.
 */
import { describe, expect, it } from 'vitest';
import { FileFetcher } from '../src/content/fileFetcher.ts';

/** A fake fetch whose responses finish when the test says, each a body of `size` bytes in two chunks. */
function fakeFetch(size = 100) {
  const calls: { url: string; priority?: string; aborted: () => boolean; finish: () => void }[] = [];
  const fetchImpl = ((url: string, init: RequestInit & { priority?: string }): Promise<Response> => {
    let finish!: () => void;
    const done = new Promise<void>((r) => (finish = r));
    calls.push({ url, priority: init.priority, aborted: () => !!init.signal?.aborted, finish });
    const half = new Uint8Array(size / 2);
    let step = 0;
    const body = {
      getReader: () => ({
        read: async () => {
          if (init.signal?.aborted) throw new Error('aborted');
          if (step === 0) return (step++, { done: false, value: half });
          await done;
          if (init.signal?.aborted) throw new Error('aborted');
          return step++ === 1 ? { done: false, value: half } : { done: true, value: undefined };
        },
      }),
    };
    return Promise.resolve({ ok: true, status: 200, headers: new Headers({ 'content-length': String(size) }), body } as unknown as Response);
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('FileFetcher', () => {
  it('runs at most `max` prefetches; neighbours wait for the hovered tile, everything for a click', async () => {
    const f = fakeFetch();
    const ff = new FileFetcher({ max: 2, fetch: f.fetch });
    ff.get('s1', 'soon');
    ff.get('l1', 'later');
    await tick();
    // The neighbour waits while the hovered tile's file downloads.
    expect(f.calls.map((c) => c.url)).toEqual(['s1']);
    expect(f.calls[0]!.priority).toBe('high');
    f.calls[0]!.finish();
    await tick();
    await tick();
    expect(f.calls.map((c) => c.url)).toEqual(['s1', 'l1']);
    expect(f.calls[1]!.priority).toBe('low');
    // A click starts at once, drops the neighbour running beside it, and holds back the next hovered tile.
    ff.get('now1', 'now');
    ff.get('s2', 'soon');
    await tick();
    expect(f.calls.map((c) => c.url)).toEqual(['s1', 'l1', 'now1']);
    expect(f.calls[1]!.aborted()).toBe(true);
    expect(ff.has('l1')).toBe(false);
    f.calls[2]!.finish();
    await tick();
    await tick();
    expect(f.calls.map((c) => c.url)).toEqual(['s1', 'l1', 'now1', 's2']);
  });

  it('shares one download between a prefetch and the pick, with its progress', async () => {
    const f = fakeFetch(100);
    const ff = new FileFetcher({ fetch: f.fetch });
    const a = ff.get('x', 'soon');
    await tick();
    await tick();
    expect(ff.progress(['x'])).toEqual({ loaded: 50, total: 100 });
    const b = ff.get('x', 'now');
    expect(b).toBe(a);
    f.calls[0]!.finish();
    expect((await b).byteLength).toBe(100);
    expect(f.calls).toHaveLength(1);
    expect(ff.progress(['x'])).toEqual({ loaded: 100, total: 100 });
    // Taken: forgotten here (the loader keeps its parsed copy).
    expect(ff.take('x')).not.toBeNull();
    expect(ff.has('x')).toBe(false);
  });

  it('drops prefetches no longer wanted: queued ones, and running low-priority ones (aborted)', async () => {
    const f = fakeFetch();
    const ff = new FileFetcher({ max: 1, fetch: f.fetch });
    ff.get('n1', 'later');
    ff.get('n2', 'later');
    await tick();
    const click = ff.get('c', 'now');
    ff.want(['t'], 'soon');
    await tick();
    expect(f.calls[0]!.aborted()).toBe(true);
    expect(ff.has('n1')).toBe(false);
    expect(ff.has('n2')).toBe(false);
    // The click's file stays whatever is wanted.
    expect(ff.has('c')).toBe(true);
    expect(ff.has('t')).toBe(true);
    for (const c of f.calls) c.finish();
    expect((await click).byteLength).toBe(100);
  });

  it('keeps bytes not taken only up to its budget, oldest first', async () => {
    const f = fakeFetch(100);
    const ff = new FileFetcher({ max: 3, keepBytes: 250, fetch: f.fetch });
    const all = ['a', 'b', 'c'].map((u) => ff.get(u, 'soon'));
    await tick();
    for (const c of f.calls) c.finish();
    await Promise.all(all);
    await tick();
    expect(['a', 'b', 'c'].filter((u) => ff.has(u))).toEqual(['b', 'c']);
  });
});
