/**
 * Work over a list spread across frames: `fn` for each item, at most `budgetMs` of it before the page draws a frame,
 * so a long list (every effect the map can play, warmed at loading) is several short tasks instead of one freeze
 * (docs/PERF_MAPMAKER_TRACE_2026-11-15.md fix 5). Each slice takes at least a `1 / maxSlices` share of the list, so
 * a page whose frames are slow (loading on a busy graphics card) still gets through it in `maxSlices` frames. Stops
 * early when `stop()` says so (the scene went).
 */
export async function sliced<T>(items: readonly T[], fn: (item: T) => void, budgetMs = 8, stop: () => boolean = () => false, maxSlices = 10): Promise<void> {
  const least = Math.ceil(items.length / maxSlices);
  let t0 = performance.now();
  let inSlice = 0;
  for (let i = 0; i < items.length; i++) {
    if (stop()) return;
    fn(items[i]!);
    inSlice++;
    if (i < items.length - 1 && inSlice >= least && performance.now() - t0 >= budgetMs) {
      await nextFrame();
      t0 = performance.now();
      inSlice = 0;
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
