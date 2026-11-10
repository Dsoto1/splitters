import { EARLY_QUIT_MINUTES, MAX_REPORTED_PLAYERS, type PlayReport } from '@tiletrigger/shared';

/**
 * Who played a hosted match, for the host's end-of-match report on a community map (docs/COMMUNITY_MAPS.md, "Play
 * statistics"; sent by communityMaps.ts sendPlayReport). Only signed-in players are kept: the account their ticket
 * proved to this host (localTransport.ts), from when it was checked to when their link closed. Bots and guests aren't
 * in it. The hub counts an account only if it gave that account a ticket for this game's code.
 */
export class PlayTracker {
  private readonly open = new Map<number, { sub: string; from: number }>();
  /** Finished stays by account: the time played, and whether any lasted past EARLY_QUIT_MINUTES. */
  private readonly done = new Map<string, { ms: number; stayed: boolean }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** A friend's link (`id`) proved this account. */
  joined(id: number, sub: string): void {
    this.open.set(id, { sub, from: this.now() });
  }

  /** A friend's link closed. */
  left(id: number): void {
    const s = this.open.get(id);
    if (!s) return;
    this.open.delete(id);
    this.add(s.sub, this.now() - s.from);
  }

  private add(sub: string, ms: number): void {
    const d = this.done.get(sub) ?? { ms: 0, stayed: false };
    d.ms += ms;
    d.stayed ||= ms >= EARLY_QUIT_MINUTES * 60_000;
    this.done.set(sub, d);
  }

  /**
   * The report as the match ends: everyone still in stops now. `host`: the host's own account (signed in) and when
   * the match started. Reading it closes every stay (a tracker reports once).
   */
  report(code: string, contentHash: string, host: { sub: string; since: number } | null): PlayReport {
    const t = this.now();
    for (const id of [...this.open.keys()]) this.left(id);
    if (host) this.add(host.sub, t - host.since);
    const players = [...this.done].slice(0, MAX_REPORTED_PLAYERS).map(([sub, d]) => ({ sub, minutes: Math.round((d.ms / 60_000) * 10) / 10, early: !d.stayed }));
    this.done.clear();
    return { code, contentHash, players };
  }
}
