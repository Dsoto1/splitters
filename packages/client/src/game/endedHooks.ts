/**
 * `window.__cs` between two sessions (session.ts `dropTestHooks`): the match has gone, and a page that rejoins (a
 * reconnect after a dropped link, the host's next map) installs the next session's hooks once its welcome comes.
 * Browser tests poll these readers across that gap, so they keep their shape and answer "no match" (phase `ended`,
 * not spectating, no rules, no clock, not running it), and hold nothing of the old session (the memory probe's fix 3c).
 */
export function endedReaders() {
  return {
    phase: () => 'ended' as const,
    spec: () => ({ spectator: false, can: false, out: true, killCam: null, killCamEnd: null, following: -1, free: false }),
    rules: () => null,
    timeLeft: () => 0,
    host: () => null,
  };
}
