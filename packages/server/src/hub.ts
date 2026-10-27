import { existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { isRetiredMap } from '@tiletrigger/shared';
import { accountHandler, cognitoFromEnv } from './auth.ts';
import { createBroker } from './broker.ts';
import { iceFromEnv } from './ice.ts';
import { discoverLan, lanInterfaces } from './lan.ts';
import { LobbyStore, lobbyHandler } from './lobby.ts';
import { siteHandler } from './site.ts';

/**
 * The community hub: the one always-on piece player-hosted games need, and
 * on its own enough to run the whole game online. It
 * - serves the built site (packages/client/dist, when built; SITE_DIR to change),
 * - introduces players' browsers to each other (a PeerJS broker at /broker, rate-limited: broker.ts),
 * - keeps the game browser's list (/lobby),
 * - hands out relay credentials for live games (ice.ts) so strict networks still connect,
 * - checks sign-in tokens (/api/v1/me, auth.ts; sign-in is optional).
 * No match runs here: players' browsers run them.
 *   PORT (9000), HOST (0.0.0.0), TRUST_PROXY=1 behind a reverse proxy on the same box (Caddy; see clientIp.ts),
 *   MAPS_DIR (../../../maps: the suite, for listing rules).
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
const store = new LobbyStore(Date.now, { suite });
const ice = iceFromEnv();
const server = createServer();
const broker = createBroker(server, proxied);
// LAN discovery for browsers (which can't send UDP): the hub broadcasts for them. Off behind a proxy (it's for home networks).
const lanHttp = () => lanInterfaces().map((i) => `http://${i.address}:${port}`);
const lan = proxied || process.env.LAN_DISCOVERY === '0' ? undefined : async () => ({ addresses: lanHttp(), servers: await discoverLan({ timeoutMs: 350, targets: ['127.0.0.1'] }) });
const lobby = lobbyHandler(store, { trustProxy: proxied, ice, lan, isLive: (code) => broker.isLive(code) });
const cognito = cognitoFromEnv();
const account = accountHandler(cognito, proxied);
const siteDir = process.env.SITE_DIR ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
const site = existsSync(`${siteDir}/index.html`) ? siteHandler(siteDir) : null;

server.on('request', (req, res) => {
  const notFound = () => {
    if (res.headersSent) return void res.end();
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('not found');
  };
  const path = (req.url ?? '/').split('?')[0]!;
  if (path === '/broker' || path.startsWith('/broker/')) return broker.handle(req, res, notFound);
  void lobby(req, res, () => void account(req, res, () => (site ? void site(req, res, notFound) : notFound()))).catch(() => notFound());
});
server.listen(port, host, () => {
  console.log(
    `Tile Trigger hub on :${port} — site ${site ? siteDir : 'not built (pnpm build to serve it)'}, broker at /broker, game browser at /lobby, relay ${ice.provider ?? 'none (see src/ice.ts)'} (${ice.ttl} s credentials), sign-in ${cognito ? 'on' : 'off'}, suite ${suite?.size ?? 'unchecked'} maps`,
  );
  if (site && lanHttp().length) console.log(`On your network, open the game at: ${lanHttp().join('  ')}`);
});
