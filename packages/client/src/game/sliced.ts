/**
 * Work over a list spread across frames: `fn` for each item, at most `budgetMs` of it before the page draws a frame,
 * so a long list (every effect the map can play, warmed at loading) is several short tasks instead of one freeze
 * (docs/PERF_MAPMAKER_TRACE_2026-11-15.md fix 5). Stops early when `stop()` says so (the scene went).
 */
export async function sliced<T>(items: Iterable<T>, fn: (item: T) => void, budgetMs = 8, stop: () => boolean = () => false): Promise<void> {
  let t0 = performance.now();
  for (const item of items) {
    if (stop()) return;
    fn(item);
    if (performance.now() - t0 >= budgetMs) {
      await nextFrame();
      t0 = performance.now();
    }
  }
}

/** After the next frame is drawn (or 50 ms at most: a hidden tab draws none). */
export function nextFrame(): Promise<void> {
  return new Promise((done) => {
    const timer = setTimeout(done, 50);
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      clearTimeout(timer);
      // (A task of its own after the frame: the frame's own work is not lengthened.)
      setTimeout(done, 0);
    });
  });
}
