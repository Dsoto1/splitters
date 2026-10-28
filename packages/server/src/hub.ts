import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { isRetiredMap } from '@tiletrigger/shared';
import { JwksCache, accountHandler, authConfigScript, cognitoFromEnv, issuerOf, verifyCognitoToken } from './auth.ts';
import { createBroker } from './broker.ts';
import { iceFromEnv } from './ice.ts';
import { discoverLan, lanInterfaces } from './lan.ts';
import { LobbyStore, lobbyHandler } from './lobby.ts';
import { PublishedMaps, publishHandler } from './publish.ts';
import { ProfileStore, profileHandler } from './profiles.ts';
import { siteHandler } from './site.ts';
import { TicketSigner } from './tickets.ts';

/**
 * The community hub: the one always-on piece player-hosted games need, and
 * on its own enough to run the whole game online. It
 * - serves the built site (packages/client/dist, when built; SITE_DIR to change),
 * - introduces players' browsers to each other (a PeerJS broker at /broker, rate-limited: broker.ts),
 * - keeps the game browser's list (/lobby),
 * - hands out relay credentials for live games (ice.ts) so strict networks still connect,
 * - checks sign-in tokens (/api/v1/me, auth.ts; sign-in is optional),
 * - keeps the maps the owner publishes from MapMaker (/api/v1/maps, publish.ts).
 * No match runs here: players' browsers run them.
 *   PORT (9000), HOST (0.0.0.0), TRUST_PROXY=1 behind a reverse proxy on the same box (Caddy; see clientIp.ts),
 *   MAPS_DIR (../../../maps: the suite, for listing rules),
 *   PUBLISHED_MAPS_DIR (where published maps are kept; unset: publishing is off), OWNER_SUBS (accounts that may publish),
 *   PROFILES_DIR (players' usernames and regions, profiles.ts; unset: profiles are off).
 * A site built with VITE_HUB=self uses the hub it was served from; otherwise
 * point the game at it with ?hub=<host:port> or VITE_HUB=<host:port>.
 */
const port = Number(process.env.PORT ?? process.env.PEER_PORT ?? 9000);
const host = process.env.HOST ?? '0.0.0.0';
const proxied = process.env.TRUST_PROXY === '1';
const mapsDir = process.env.MAPS_DIR ?? fileURLToPath(new URL('../../../maps', import.meta.url));
// Our suite's map IDs: listings that aren't "community" must name one of these.
const suite = existsSync(mapsDir)
  ? new Set(
      readdirSync(mapsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))
        .filter((id) => !isRetiredMap(id)),
    )
  : undefined;
const builtIn = new Set(suite ?? []);
const store = new LobbyStore(Date.now, { suite });
const ice = iceFromEnv();
const server = createServer();
const broker = createBroker(server, proxied);
// LAN discovery for browsers (which can't send UDP): the hub broadcasts for them. Off behind a proxy (it's for home networks).
const lanHttp = () => lanInterfaces().map((i) => `http://${i.address}:${port}`);
const lan = proxied || process.env.LAN_DISCOVERY === '0' ? undefined : async () => ({ addresses: lanHttp(), servers: await discoverLan({ timeoutMs: 350, targets: ['127.0.0.1'] }) });
const lobby = lobbyHandler(store, { trustProxy: proxied, ice, lan, isLive: (code) => broker.isLive(code) });
const cognito = cognitoFromEnv();
// Account tickets (tickets.ts): signed-in players prove their account to game hosts. HUB_TICKET_KEY (PEM) keeps the key across restarts.
const tickets = new TicketSigner(process.env.HUB_TICKET_KEY || undefined);
const jwks = cognito ? new JwksCache(`${issuerOf(cognito)}/.well-known/jwks.json`) : undefined;
// Profiles (profiles.ts): usernames go into account tickets, so hosts show them as verified accounts.
const profiles = process.env.PROFILES_DIR ? new ProfileStore(process.env.PROFILES_DIR) : null;
const account = accountHandler(cognito, proxied, jwks, tickets, (sub) => profiles?.username(sub) ?? null);
// Published maps (publish.ts): the owner's MapMaker publishes; everyone reads.
const owners = new Set((process.env.OWNER_SUBS ?? '').split(/[\s,]+/).filter(Boolean));
const published = process.env.PUBLISHED_MAPS_DIR ? new PublishedMaps(process.env.PUBLISHED_MAPS_DIR, builtIn, suite) : null;
const publish = published ? publishHandler(published, { owners, trustProxy: proxied, verify: cognito && jwks ? (t) => verifyCognitoToken(t, cognito, jwks) : null }) : (_req: unknown, _res: unknown, next: () => void) => next();
const profile = profiles ? profileHandler(profiles, { trustProxy: proxied, verify: cognito && jwks ? (t) => verifyCognitoToken(t, cognito, jwks) : null }) : (_req: unknown, _res: unknown, next: () => void) => next();
// The page's sign-in settings (auth.ts authConfigScript): served, never compiled into the site.
const authConfig = authConfigScript(cognito);
const siteDir = process.env.SITE_DIR ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
// SITE_DIR set (the Lightsail box: a link to the current build, switched by updates): always serve it.
const site = process.env.SITE_DIR || existsSync(`${siteDir}/index.html`) ? siteHandler(siteDir) : null;

server.on('request', (req, res) => {
  const notFound = () => {
    if (res.headersSent) return void res.end();
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('not found');
  };
  const path = (req.url ?? '/').split('?')[0]!;
  if (path === '/broker' || path.startsWith('/broker/')) return broker.handle(req, res, notFound);
  if (path === '/auth-config.js') {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return void res.end(authConfig);
  }
  void lobby(req, res, () => void publish(req, res, () => void profile(req, res, () => void account(req, res, () => (site ? void site(req, res, notFound) : notFound()))))).catch(() => notFound());
});
server.listen(port, host, () => {
  console.log(
    `Tile Trigger hub on :${port} — site ${site ? siteDir : 'not built (pnpm build to serve it)'}, broker at /broker, game browser at /lobby, relay ${ice.provider ?? 'none (see src/ice.ts)'} (${ice.ttl} s credentials), sign-in ${cognito ? 'on' : 'off'}, publishing ${published ? `${published.list().length} maps, ${owners.size} owner${owners.size === 1 ? '' : 's'}` : 'off'}, suite ${suite?.size ?? 'unchecked'} maps`,
  );
  if (site && lanHttp().length) console.log(`On your network, open the game at: ${lanHttp().join('  ')}`);
});
