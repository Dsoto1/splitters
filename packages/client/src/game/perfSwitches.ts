/**
 * Switches for measuring a performance change against the code without it, on the same build (docs/PERF_96.md,
 * "Performance round 2"): `?perfoff=shadowcache,levelmerge,meshsel,animlod2` turns those savings off for the page.
 * Players never set it; everything is on by default.
 */
export type PerfSwitch = 'shadowcache' | 'levelmerge' | 'meshsel' | 'animlod2';

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
