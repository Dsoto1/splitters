import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODE_LABELS, isMapId, isRetiredMap, loadMap, mapContentHash, mapIdentity, parsePlaylist, sanitizeName, type LobbyAdvert, type MapDocument, type ServerStats } from '@tiletrigger/shared';
import { startServer, type RunningServer } from '@tiletrigger/server/server';
import { verifyTicket } from '@tiletrigger/server/tickets';
import { LobbyAdvertiser, type Fetch } from './advertiser.ts';
import type { BanList } from './bans.ts';
import type { MatchCommandTarget } from './commands.ts';
import type { HostConfig } from './config.ts';
import { HubLink } from './hubLink.ts';
import { peerConn } from './peerConn.ts';

/** Our suite (maps/): where suite IDs are looked up, and what may be listed as one of our maps. */
export const DEFAULT_MAPS_DIR =
  process.env.HOST_MAPS_DIR ??
  // The packaged Host Service keeps them beside its bundle (app/maps); from the repository, the repo's maps/.
  [new URL('./maps/', import.meta.url), new URL('../../../maps/', import.meta.url)].map((u) => fileURLToPath(u)).find((d) => existsSync(d)) ??
  fileURLToPath(new URL('../../../maps/', import.meta.url));

export interface HostStatus {
  state: 'starting' | 'running' | 'stopping';
  code: string;
  online: boolean;
  listed: boolean;
  relay: boolean;
  listingError: string | null;
  map: string;
  mode: string;
  community: boolean;
  players: number;
  bots: number;
  maxPlayers: number;
  uptimeS: number;
  hubReconnects: number;
  visibility: 'listed' | 'code';
  name: string;
  mapId: string;
  /** Simulation time per tick (ms, last second) and everything sent to players (KB/s). */
  tickMs: number;
  upKBps: number;
  people: { slot: number; name: string; account: boolean; ping: number | null; team: string | null; kills: number; deaths: number }[];
}

export interface RunningHost {
  readonly code: string;
  readonly token: string;
  readonly server: RunningServer;
  /** What the console's match commands act on (commands.ts). */
  readonly commands: MatchCommandTarget;
  setAdminToken(token: string | undefined): void;
  status(): HostStatus;
  /** Tell players, take the listing down, leave the hub, end the match. */
  stop(reason?: string): Promise<void>;
}

export interface HostDeps {
  log?: (line: string) => void;
  mapsDir?: string;
  fetcher?: Fetch;
  /** Join code and broker token a restarted service had (main.ts passes them on). */
  resume?: { code: string; token: string };
  onStats?: (line: string) => void;
  /** The ban list (bans.ts): checked at every join, and in-game admins' bans go in it. */
  bans?: BanList;
  /** Joins, leaves, kicks and results, for the console. */
  onEvent?: (line: string) => void;
}

/** The hub's public keys for account tickets (tickets.ts), fetched at start and again (at most every 30 s) for an unknown key. */
export class TicketKeys {
  private keys = new Map<string, string>();
  private fetchedAt = 0;
  private readonly seen = new Map<string, number>();
  constructor(
    private readonly hub: string,
    private readonly fetcher: Fetch = fetch,
  ) {}
  async refresh(): Promise<void> {
    if (Date.now() - this.fetchedAt < 30_000) return;
    this.fetchedAt = Date.now();
    try {
      const res = await this.fetcher(`${this.hub}/api/v1/ticket-keys`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const j = (await res.json()) as { keys?: { kid?: unknown; x?: unknown }[] };
      for (const k of j.keys ?? []) if (typeof k.kid === 'string' && typeof k.x === 'string' && k.x.length < 100) this.keys.set(k.kid, k.x);
    } catch {
      // No tickets checked until the hub answers: signed-in players count as guests meanwhile.
    }
  }
  /** The account a ticket for `code` proves, or null (an unknown key: fetch again for next time). Each ticket counts once. */
  verify(ticket: string, code: string): string | null {
    const c = verifyTicket(ticket, code, this.keys);
    if (!c) {
      void this.refresh();
      return null;
    }
    const t = Date.now();
    for (const [j, exp] of this.seen) if (exp * 1000 < t) this.seen.delete(j);
    if (this.seen.has(c.jti)) return null;
    this.seen.set(c.jti, c.exp);
    return c.sub;
  }
}

/** Suite map IDs (maps/*.json, retired ones left out), as the hub reads them. */
export function suiteIds(mapsDir: string): Set<string> {
  if (!existsSync(mapsDir)) return new Set();
  return new Set(
    readdirSync(mapsDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5))
      .filter((id) => !isRetiredMap(id)),
  );
}

function readMap(path: string): MapDocument {
  const r = loadMap(readFileSync(path, 'utf8'));
  if (!r.ok) throw new Error(`map ${path} failed validation: ${r.issues.find((i) => i.severity === 'error')?.message ?? 'invalid'}`);
  return r.map;
}

/**
 * Whether the game browser shows this map as one of ours, or as a "Community
 * map" with its exact version: a map is ours only when it is byte-for-byte
 * (content hash) the suite's file of that ID. A changed copy of a suite map,
 * or any other file, is a community map; the hub refuses a listing that
 * claims a suite map it doesn't have, and official/featured servers are suite-only.
 */
export function listingMap(map: MapDocument, suite: ReadonlySet<string>, mapsDir: string): Pick<LobbyAdvert, 'map' | 'mapId' | 'community' | 'versionId' | 'contentHash'> {
  const id = map.metadata.id;
  const file = join(mapsDir, `${id}.json`);
  if (isMapId(id) && suite.has(id) && existsSync(file)) {
    try {
      if (mapContentHash(readMap(file)) === mapContentHash(map)) return { map: map.metadata.name, mapId: id };
    } catch {
      // fall through: community
    }
  }
  const ident = mapIdentity(map);
  return { map: map.metadata.name, mapId: ident.mapId, community: true, versionId: ident.versionId, contentHash: ident.contentHash };
}

/**
 * The Host Service's match: the dedicated server's match loop and join flow
 * (packages/server/src/server.ts, no listener) with players arriving over
 * WebRTC from the hub's broker (hubLink.ts), listed in the game browser as a
 * dedicated host (advertiser.ts) unless it is join-code only.
 */
export async function startHost(config: HostConfig, deps: HostDeps = {}): Promise<RunningHost> {
  const log = deps.log ?? ((l: string) => console.log(`[host] ${l}`));
  const mapsDir = deps.mapsDir ?? DEFAULT_MAPS_DIR;
  const suite = suiteIds(mapsDir);
  const mapPath = isMapId(config.map) ? join(mapsDir, `${config.map}.json`) : config.map;
  if (!existsSync(mapPath)) throw new Error(isMapId(config.map) ? `MAP ${config.map} is not one of our maps (maps/${config.map}.json)` : `MAP file ${mapPath} not found`);
  const playlist = config.playlist ? parsePlaylist(JSON.parse(readFileSync(config.playlist, 'utf8')), suite) : undefined;
  if (playlist === null) throw new Error(`PLAYLIST ${config.playlist} is not a valid playlist of our maps`);
  const startedAt = Date.now();
  const tickets = new TicketKeys(config.hub, deps.fetcher);
  void tickets.refresh();
  let linkRef: HubLink | null = null;
  let lastStats: ServerStats | null = null;

  const server = await startServer({
    port: null,
    map: readMap(mapPath),
    mapsDir,
    playlist,
    mode: config.mode,
    botFill: config.botFill,
    maxPlayers: config.maxPlayers,
    botDifficulty: config.botDifficulty,
    botTakeBack: config.botTakeBack,
    leaders: config.leaders,
    name: config.name,
    adminToken: config.adminToken,
    lanDiscovery: false,
    onStats: (line, stats) => {
      lastStats = stats;
      deps.onStats?.(line);
    },
    onEvent: deps.onEvent,
    admission: (who) => deps.bans?.check(who) ?? null,
    onBan: (who, minutes, reason, by) => void deps.bans?.add(who, minutes, reason, by),
    verifyTicket: (ticket) => (linkRef ? tickets.verify(ticket, linkRef.code) : null),
  });

  const link = new HubLink({
    hub: config.hub,
    code: deps.resume?.code ?? config.joinCode,
    token: deps.resume?.token,
    fixedCode: !!config.joinCode || !!deps.resume,
    admit: (conn) => {
      try {
        server.accept(peerConn(conn as never, log));
      } catch (e) {
        log(`refused a connection: ${(e as Error).message}`);
      }
    },
    log,
    fetcher: deps.fetcher,
  });
  linkRef = link;
  let stopping = false;
  let code: string;
  try {
    code = await link.start();
  } catch (e) {
    link.close();
    await server.close();
    throw e;
  }
  log(`open on ${config.hub} with join code ${code}${link.relay ? ' (the hub provides a relay)' : ''}`);

  let shown: { map: MapDocument; listing: ReturnType<typeof listingMap> } | null = null;
  const currentListing = () => {
    const map = server.match.map;
    if (shown?.map !== map) shown = { map, listing: listingMap(map, suite, mapsDir) };
    return shown.listing;
  };
  const live = { name: config.name, visibility: config.visibility };
  const makeAdvertiser = () =>
    new LobbyAdvertiser(
      config.hub,
      () =>
        link.online && !stopping
          ? {
              code: link.code,
              name: live.name,
              host: config.hostName,
              ...currentListing(),
              mode: server.match.rules.mode,
              players: Math.min(server.info().players, config.maxPlayers),
              max: config.maxPlayers,
              relay: link.relay,
              hostType: 'dedicated',
            }
          : null,
      log,
      deps.fetcher,
    );
  let advertiser: LobbyAdvertiser | null = live.visibility === 'listed' ? makeAdvertiser() : null;
  advertiser?.start();
  const maps = new Map<string, string>();
  for (const id of suite) {
    try {
      maps.set(id, (JSON.parse(readFileSync(join(mapsDir, `${id}.json`), 'utf8')) as { metadata?: { name?: string } }).metadata?.name ?? id);
    } catch {
      // not a map file
    }
  }

  const target: MatchCommandTarget = {
    players: () => server.players(),
    command: (cmd, by) => server.command(cmd, by),
    say: (text) => server.notice(`[Host] ${text}`),
    currentMapId: () => server.match.map.metadata.id,
    teams: () => {
      const m = server.match;
      if (!m.teams) return `${MODE_LABELS[m.rules.mode] ?? m.rules.mode} has no teams`;
      const all = m.combatants().filter((c) => c.kind !== 'npc');
      return m.teams.map((t) => {
        const on = all.filter((c) => c.faction === t.id);
        return `${t.name}: ${on.length} (${on.filter((c) => c.kind === 'human').length} people), ${on.reduce((n, c) => n + c.kills, 0)} kills`;
      }).join('\n');
    },
    setVisibility: (v) => {
      live.visibility = v;
      if (v === 'listed' && !advertiser) (advertiser = makeAdvertiser()).start();
      if (v === 'code' && advertiser) {
        void advertiser.stop();
        advertiser = null;
      }
    },
    setName: (name) => {
      live.name = sanitizeName(name).slice(0, 40);
      void advertiser?.tick();
    },
    maps,
  };

  return {
    code,
    token: link.token,
    server,
    commands: target,
    setAdminToken: (t) => server.setAdminToken(t),
    status: () => {
      const info = server.info();
      return {
        state: stopping ? 'stopping' : 'running',
        code: link.code,
        online: link.online,
        listed: !!advertiser?.listed,
        visibility: live.visibility,
        name: live.name,
        relay: link.relay,
        listingError: advertiser?.error ?? null,
        map: info.map,
        mapId: server.match.map.metadata.id,
        mode: info.mode,
        community: !!currentListing().community,
        players: info.players,
        bots: info.bots,
        maxPlayers: config.maxPlayers,
        uptimeS: Math.round((Date.now() - startedAt) / 1000),
        hubReconnects: link.reconnects,
        tickMs: lastStats?.tickMsAvg ?? 0,
        upKBps: lastStats ? Math.round((lastStats.bytesPerSecPerClient * lastStats.humans) / 102.4) / 10 : 0,
        people: server.players().map((p) => ({ slot: p.slot, name: p.name, account: !!p.sub, ping: p.ping, team: p.team, kills: p.kills, deaths: p.deaths })),
      };
    },
    stop: async (reason = 'The server is shutting down') => {
      if (stopping) return;
      stopping = true;
      // Players see why before their link closes.
      server.notice(reason);
      await Promise.all([advertiser?.stop(), new Promise((r) => setTimeout(r, 500))]);
      link.close();
      await server.close();
    },
  };
}
