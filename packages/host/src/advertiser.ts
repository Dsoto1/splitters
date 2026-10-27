import { LOBBY_HEARTBEAT_SECONDS, PROTOCOL_VERSION, type LobbyAdvert } from '@tiletrigger/shared';

export type Fetch = typeof fetch;

/**
 * Keeps the Host Service's game in the hub's game browser, as a browser host
 * does (client/src/game/hub.ts LobbyAdvertiser): lists it, checks in every
 * LOBBY_HEARTBEAT_SECONDS with fresh details, lists it again when the hub has
 * forgotten it (a hub restart, or the host was offline past the listing's
 * expiry), and takes it down on stop. While the hub can't be reached it keeps
 * trying at the same pace: the listing comes back within one check-in of the
 * hub returning.
 */
export class LobbyAdvertiser {
  private id: string | null = null;
  private secret = '';
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private busy = false;
  /** Why the last check-in failed (null while listed). */
  error: string | null = null;

  constructor(
    /** The hub's origin (https://trigger.toshiroplay.com). */
    private readonly hub: string,
    private readonly advert: () => Omit<LobbyAdvert, 'version'> | null,
    private readonly log: (line: string) => void = () => undefined,
    private readonly fetcher: Fetch = fetch,
    private readonly everyMs = LOBBY_HEARTBEAT_SECONDS * 1000,
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.everyMs);
    this.timer.unref?.();
  }

  get listed(): boolean {
    return this.id !== null;
  }

  private get url(): string {
    return `${this.hub}/lobby/games`;
  }

  /** One check-in (exposed for tests). */
  async tick(): Promise<void> {
    if (this.stopped || this.busy) return;
    const ad = this.advert();
    if (!ad) return;
    this.busy = true;
    const body = JSON.stringify({ ...ad, version: PROTOCOL_VERSION });
    try {
      if (this.id) {
        const res = await this.fetcher(`${this.url}/${this.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Lobby-Secret': this.secret }, body, signal: AbortSignal.timeout(10_000) });
        if (res.ok) return this.set(null);
        // Forgotten (the hub restarted, or the listing expired while we were away): list it again below.
        if (res.status === 404 || res.status === 403) this.id = null;
        else return this.set(`the game browser answered ${res.status}`);
      }
      const res = await this.fetcher(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10_000) });
      const data = (await res.json().catch(() => ({}))) as { id?: string; secret?: string; error?: string };
      if (this.stopped) return void this.remove(data.id, data.secret);
      if (!res.ok || !data.id) return this.set(data.error ?? `the game browser answered ${res.status}`);
      this.id = data.id;
      this.secret = data.secret ?? '';
      this.set(null);
      this.log(`listed in the game browser at ${this.hub}`);
    } catch (e) {
      this.set(`couldn't reach the game browser (${(e as Error).message})`);
    } finally {
      this.busy = false;
    }
  }

  private set(error: string | null): void {
    if (error === this.error) return;
    this.error = error;
    if (error) this.log(`not listed: ${error}`);
  }

  private async remove(id = this.id, secret = this.secret): Promise<void> {
    if (!id) return;
    if (id === this.id) this.id = null;
    await this.fetcher(`${this.url}/${id}`, { method: 'DELETE', headers: { 'X-Lobby-Secret': secret }, signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  }

  /** Stop checking in and take the listing down (resolves when the hub answered, or gave up). */
  async stop(): Promise<void> {
    this.stopped = true;
    clearInterval(this.timer);
    await this.remove();
  }
}
