// Everything MapMaker's test worker runs (mapTestWorker.ts loads it with a dynamic import, for the reason
// game/simWorkerCore.ts gives: Safari gives a chunk imported from a module worker's entry file a second Rapier).
import { initPhysics, type MapDocument } from '@tiletrigger/shared';
import type { BotTestOptions, BotTestResult, ExposureResult } from '@tiletrigger/shared/match';

/** The page to the worker: one job a worker (the page starts a new worker for each, and Cancel ends it). */
export type ToMapTest = { k: 'bots'; map: MapDocument; opts: BotTestOptions } | { k: 'exposure'; map: MapDocument };

/** The worker to the page. */
export type FromMapTest =
  | { k: 'ready'; setupMs: number }
  | { k: 'progress'; share: number; seconds: number }
  | { k: 'bots'; result: BotTestResult }
  | { k: 'exposure'; result: ExposureResult }
  | { k: 'failed'; error: string };

/** How long a slice of the match runs before the page hears how far it got (ms of the worker's time). */
const REPORT_MS = 150;

export async function runMapTest(m: ToMapTest, post: (m: FromMapTest) => void): Promise<void> {
  const t0 = performance.now();
  const mod = await import('@tiletrigger/shared/match');
  await Promise.all([initPhysics(), mod.initNavigation()]);
  if (m.k === 'exposure') {
    post({ k: 'exposure', result: mod.mapExposure(m.map) });
    return;
  }
  const run = new mod.BotTestRun(m.map, m.opts);
  post({ k: 'ready', setupMs: Math.round(performance.now() - t0) });
  try {
    let last = performance.now();
    while (!run.done) {
      // A quarter of a match second at a time.
      run.advance(15);
      const now = performance.now();
      if (now - last >= REPORT_MS || run.done) {
        last = now;
        post({ k: 'progress', share: run.progress, seconds: Math.round(run.progress * m.opts.seconds) });
      }
    }
    post({ k: 'bots', result: run.result() });
  } finally {
    run.destroy();
  }
}
