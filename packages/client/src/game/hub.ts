import { LOBBY_HEARTBEAT_SECONDS, PROTOCOL_VERSION, type LobbyAdvert, type LobbyListing } from '@tiletrigger/shared';

/**
 * The community hub (packages/server/src/hub.ts): the PeerJS broker for Host
 * game plus the game browser's list. Where it is: `?hub=host:port` in the
 * address, else the one saved in Online, else the one the site was built
 * with (VITE_HUB). None: Host game uses the public PeerJS broker and there's
 * no game browser.
 */
const HUB_KEY = 'tiletrigger.hub';

export function hubSetting(): string {
  const fromUrl = new URLSearchParams(location.search).get('hub');
  if (fromUrl) return fromUrl;
  try {
    const saved = localStorage.getItem(HUB_KEY);
    if (saved) return saved;
  } catch {
    // Private windows: fall through to the built-in one.
  }
  return builtHub();
}

/** The hub the site was built with (VITE_HUB); "self" means the site is served by its hub (one address for everything). */
export function builtHub(): string {
  const built = (import.meta.env.VITE_HUB as string | undefined) ?? '';
  return built === 'self' ? `${location.protocol === 'https:' ? 'https' : 'http'}://${location.host}` : built;
}

export function saveHub(address: string): void {
  try {
    if (address.trim()) localStorage.setItem(HUB_KEY, address.trim());
    else localStorage.removeItem(HUB_KEY);
  } catch {
    // Lasts for this page.
  }
}

/** The hub as a parsed address (host, port, secure), or null when there's none. */
export function hubAddress(): { host: string; port: number; secure: boolean; path: string } | null {
  const raw = hubSetting();
  const m = /^(?:(wss?|https?):\/\/)?([^:/]+)(?::(\d+))?(\/.*)?$/.exec(raw);
  if (!raw || !m) return null;
  const secure = m[1] === 'wss' || m[1] === 'https' || (!m[1] && !m[3] && location.protocol === 'https:');
  return { host: m[2]!, port: Number(m[3] ?? (secure ? 443 : 80)), secure, path: (m[4] ?? '/').replace(/\/?$/, '/') };
}

function lobbyUrl(rest = ''): string | null {
  const a = hubAddress();
  return a ? `${a.secure ? 'https' : 'http'}://${a.host}:${a.port}${a.path}lobby/games${rest}` : null;
}

/**
 * Relay credentials from the hub for one game ({ iceServers, relay, ttl }): the hub gives them only for a game
 * open on it (its join code), scoped to it. Null when there's no hub, no such game, or no quick answer.
 */
export async function fetchIce(code: string, role: 'host' | 'guest'): Promise<{ iceServers: RTCIceServer[]; relay: boolean; ttl?: number } | null> {
  const url = lobbyUrl();
  if (!url) return null;
  try {
    const res = await fetch(`${url.replace(/games$/, 'ice')}?${new URLSearchParams({ session: code, role })}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()) as { iceServers: RTCIceServer[]; relay: boolean; ttl?: number }) : null;
  } catch {
    return null;
  }
}

/** The games listed for this version of the game. Throws when the hub can't be reached. */
export async function fetchGames(): Promise<LobbyListing[]> {
  const url = lobbyUrl(`?v=${PROTOCOL_VERSION}`);
  if (!url) return [];
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`game browser answered ${res.status}`);
  return ((await res.json()) as { games: LobbyListing[] }).games;
}

/**
 * Keeps a hosted game in the game browser: lists it, checks in with fresh
 * details every LOBBY_HEARTBEAT_SECONDS, re-lists it if the hub forgot it
 * (a hub restart), and takes it down on stop or when the page closes.
 */
export class LobbyAdvertiser {
  private id: string | null = null;
  private secret = '';
  private timer?: number;
  private stopped = false;
  private readonly onHide = () => this.takeDown(true);
  /** Why listing failed, for the host to see (null while listed). */
  error: string | null = null;

  constructor(
    private readonly advert: () => Omit<LobbyAdvert, 'version'>,
    private readonly changed: () => void = () => undefined,
    /** The listing's id and secret once listed (null once it's down): a successor host takes it down if the match is handed on. */
    private readonly onListed: (id: string | null, secret: string) => void = () => undefined,
  ) {}

  start(): void {
    window.addEventListener('pagehide', this.onHide);
    void this.tick();
    this.timer = window.setInterval(() => void this.tick(), LOBBY_HEARTBEAT_SECONDS * 1000);
  }

  get listed(): boolean {
    return this.id !== null;
  }

  private async tick(): Promise<void> {
    const url = lobbyUrl();
    if (!url || this.stopped) return;
    const body = JSON.stringify({ ...this.advert(), version: PROTOCOL_VERSION });
    try {
      if (this.id) {
        const res = await fetch(`${url}/${this.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Lobby-Secret': this.secret }, body });
        if (res.ok) return this.set(null);
        this.id = null; // forgotten (hub restarted, or it expired): list it again below
      }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = (await res.json()) as { id?: string; secret?: string; error?: string };
      if (this.stopped) return this.takeDown(false, data.id, data.secret);
      if (!res.ok || !data.id) return this.set(data.error ?? `game browser answered ${res.status}`);
      this.id = data.id;
      this.secret = data.secret ?? '';
      this.onListed(this.id, this.secret);
      this.set(null);
    } catch {
      this.set("couldn't reach the game browser");
    }
  }

  private set(error: string | null): void {
    if (error === this.error) return;
    this.error = error;
    this.changed();
  }

  private takeDown(closing: boolean, id = this.id, secret = this.secret): void {
    const url = lobbyUrl();
    if (!url || !id) return;
    // keepalive lets the request finish while the page is closing.
    void fetch(`${url}/${id}`, { method: 'DELETE', headers: { 'X-Lobby-Secret': secret }, keepalive: closing }).catch(() => undefined);
    if (id === this.id) this.id = null;
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onHide);
    this.takeDown(false);
    this.onListed(null, '');
  }
}

/** Take down a listing with its secret (a successor host replacing the listing of the host it took over from). */
export function dropListing(id: string, secret: string): void {
  const url = lobbyUrl();
  if (!url || !/^[\w-]{1,64}$/.test(id)) return;
  void fetch(`${url}/${id}`, { method: 'DELETE', headers: { 'X-Lobby-Secret': secret } }).catch(() => undefined);
}
