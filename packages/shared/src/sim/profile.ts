/**
 * Opt-in counters for the load bench (`pnpm bench`): time and call counts per
 * part of the tick. Off by default; when off each probe is one boolean check.
 */
export const simProfile = {
  on: false,
  /** Milliseconds per section, summed since reset(). */
  ms: new Map<string, number>(),
  /** Calls per counter, summed since reset(). */
  n: new Map<string, number>(),
  reset(): void {
    this.ms.clear();
    this.n.clear();
  },
  add(key: string, ms: number): void {
    this.ms.set(key, (this.ms.get(key) ?? 0) + ms);
  },
  count(key: string, by = 1): void {
    this.n.set(key, (this.n.get(key) ?? 0) + by);
  },
};
