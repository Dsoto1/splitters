/**
 * Switches for measuring a performance change against the code without it, on the same build (docs/PERF_96.md,
 * "Performance round 2"): `?perfoff=shadowcache,levelmerge,meshsel,animlod2` turns those savings off for the page
 * (round 3 adds `propbatch` and `fogprepass`; round 4 `animlod4`, the animation bands by size on screen and the smoothing
 * between evaluations, back to round 2's by distance, and `animlinger`, loops kept a moment at weight 0 instead of stopped;
 * St. John's step 2 adds `indoorshadow`, props under a roof kept out of the sun's shadow pass: shared map/indoors.ts;
 * `bodyspread`: a going character put away over the next frames, View.retireAvatar; the destructible environment's
 * next step adds `breakbatch`, breakable props in the prop batches while intact, propBatches.ts).
 * Players never set it; everything is on by default.
 */
export type PerfSwitch = 'shadowcache' | 'levelmerge' | 'meshsel' | 'animlod2' | 'propbatch' | 'fogprepass' | 'animlod4' | 'animlinger' | 'indoorshadow' | 'bodyspread' | 'breakbatch';

let off: Set<string> | null = null;

/** Whether a saving is on (it is unless the page's `?perfoff=` names it). */
export function perfOn(name: PerfSwitch): boolean {
  if (!off) {
    off = new Set();
    try {
      const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('perfoff');
      for (const s of (v ?? '').split(',')) if (s) off.add(s.trim());
    } catch {
      // No page (tests): everything on.
    }
  }
  return !off.has(name);
}
