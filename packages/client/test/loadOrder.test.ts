import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadOrder } from '../src/content/loadOrder.ts';

/** A download that finishes when told. */
function download(log: string[], name: string) {
  let finish!: () => void;
  const done = new Promise<string>((r) => (finish = () => r(name)));
  return {
    start: () => {
      log.push(name);
      return done;
    },
    finish,
  };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('LoadOrder: characters first while a match loads', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    now = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('starts everything at once when not held', async () => {
    const order = new LoadOrder(2, () => now);
    const log: string[] = [];
    const a = download(log, 'gun1');
    const b = download(log, 'gun2');
    const c = download(log, 'gun3');
    void order.other(a.start);
    void order.other(b.start);
    void order.other(c.start);
    expect(log).toEqual(['gun1', 'gun2', 'gun3']);
  });

  it('holds other models to a share while character files load, then lets the rest go', async () => {
    const order = new LoadOrder(2, () => now);
    const log: string[] = [];
    order.hold(20000, 3000);
    const body = download(log, 'body');
    const guns = [1, 2, 3, 4, 5].map((i) => download(log, `gun${i}`));
    const got = guns.map((g) => order.other(g.start));
    const bodyP = order.first(body.start);
    expect(log).toEqual(['gun1', 'gun2', 'body']);
    // A gun finishing lets the next one in, still two at a time.
    guns[0]!.finish();
    await got[0];
    await flush();
    expect(log).toEqual(['gun1', 'gun2', 'body', 'gun3']);
    // The body in, and the roster's grace over: everything waiting starts.
    now = 3500;
    body.finish();
    await bodyP;
    await flush();
    expect(log).toEqual(['gun1', 'gun2', 'body', 'gun3', 'gun4', 'gun5']);
    for (const g of guns) g.finish();
    await expect(Promise.all(got)).resolves.toEqual(['gun1', 'gun2', 'gun3', 'gun4', 'gun5']);
  });

  it('keeps holding through the grace for looks that come in a moment later (the roster)', async () => {
    const order = new LoadOrder(1, () => now);
    const log: string[] = [];
    order.hold(20000, 3000);
    const guns = [1, 2, 3].map((i) => download(log, `gun${i}`));
    guns.forEach((g) => void order.other(g.start));
    expect(log).toEqual(['gun1']);
    // A bot's look arrives at 1 s: its body goes first; the guns still wait.
    now = 1000;
    const bot = download(log, 'bot');
    const botP = order.first(bot.start);
    expect(log).toEqual(['gun1', 'bot']);
    now = 3200;
    vi.advanceTimersByTime(2300);
    expect(log).toEqual(['gun1', 'bot']);
    bot.finish();
    await botP;
    await flush();
    expect(log).toEqual(['gun1', 'bot', 'gun2', 'gun3']);
  });

  it('never holds past its cap, and release ends it at once', async () => {
    const order = new LoadOrder(1, () => now);
    const log: string[] = [];
    order.hold(20000, 3000);
    const body = download(log, 'body');
    void order.first(body.start);
    const guns = [1, 2, 3].map((i) => download(log, `gun${i}`));
    guns.forEach((g) => void order.other(g.start));
    expect(log).toEqual(['body', 'gun1']);
    // The body is still on its way at the cap: the guns go anyway.
    now = 20001;
    vi.advanceTimersByTime(20010);
    expect(log).toEqual(['body', 'gun1', 'gun2', 'gun3']);
    const late = download(log, 'late');
    order.hold(20000);
    void order.other(late.start);
    void order.other(download(log, 'later').start);
    expect(log.slice(4)).toEqual([]);
    order.release();
    expect(log.slice(4)).toEqual(['late', 'later']);
  });

  it('a failed download frees its place', async () => {
    const order = new LoadOrder(1, () => now);
    const log: string[] = [];
    order.hold(20000);
    void order.first(() => new Promise(() => {}));
    const bad = order.other(() => (log.push('bad'), Promise.reject(new Error('404'))));
    const next = download(log, 'next');
    void order.other(next.start);
    await expect(bad).rejects.toThrow('404');
    await flush();
    expect(log).toEqual(['bad', 'next']);
  });
});
