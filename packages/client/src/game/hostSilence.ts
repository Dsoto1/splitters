/** A friend's browser host that sends nothing for this long has dropped (it streams snapshots all the time). */
export const HOST_SILENT_MS = 20_000;
/**
 * A dedicated host silent this long has let us go: it closes a player it hasn't heard from in 20 s (a page stalled
 * that long, e.g. building shaders on a slow GPU) and holds the place 60 s, but that close can fail to reach us,
 * which left the page in a match that had stopped coming (CI's dedicatedhost, 2026-11-16). Past the server's 20 s
 * and its 5 s close wait, so we only give up on a link it has given up on; the reconnect then takes the place back.
 */
export const DEDICATED_SILENT_MS = 30_000;

/** Whether a host not heard from since `heardAt` has gone (a browser host after 20 s, a dedicated one after 30 s). */
export function hostSilent(now: number, heardAt: number, dedicated: boolean): boolean {
  return now - heardAt > (dedicated ? DEDICATED_SILENT_MS : HOST_SILENT_MS);
}
