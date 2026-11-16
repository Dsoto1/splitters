/** A friend's browser host that sends nothing for this long has dropped (it streams snapshots all the time). */
export const HOST_SILENT_MS = 20_000;
/**
 * …unless the connection itself is still up: the browser's network threads keep it up while the host's page is busy,
 * so the host's page has stalled (building shaders on a slow GPU can take half a minute), it hasn't gone. As the
 * host allows its friends (matchHost.ts FRIEND_STALLED_SILENT_MS).
 */
export const HOST_STALLED_SILENT_MS = 60_000;
/**
 * A dedicated host silent this long has let us go: it closes a player it hasn't heard from (20 s, or 60 s while the
 * connection is up: server.ts silentLimitMs) and holds the place 60 s, but that close can fail to reach us, which
 * left the page in a match that had stopped coming (CI's dedicatedhost, 2026-11-16). A Host Service streams 20
 * snapshots a second and answers every ping, and it isn't a page that stalls: silence this long means the link is
 * gone, so we reconnect (the place is still kept).
 */
export const DEDICATED_SILENT_MS = 30_000;

/** Whether a host not heard from since `heardAt` has gone (its link to us `up`, as the browser sees it). */
export function hostSilent(now: number, heardAt: number, dedicated: boolean, up: boolean): boolean {
  return now - heardAt > (dedicated ? DEDICATED_SILENT_MS : up ? HOST_STALLED_SILENT_MS : HOST_SILENT_MS);
}
