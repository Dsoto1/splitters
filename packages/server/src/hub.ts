import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PeerServer } from 'peer';
import { iceFromEnv } from './ice.ts';
import { discoverLan, lanInterfaces } from './lan.ts';
import { LobbyStore, lobbyHandler } from './lobby.ts';
import { siteHandler } from './site.ts';

/**
 * The community hub: the one always-on piece player-hosted games need, and
 * on its own enough to run the whole game online. It
 * - serves the built site (packages/client/dist, when built; SITE_DIR to change),
 * - introduces players' browsers to each other (a PeerJS broker at /broker),
 * - keeps the game browser's list (/lobby),
 * - hands out relay credentials (ice.ts) so strict networks still connect.
 * No match runs here: players' browsers run them.
 *   PORT (9000), HOST (0.0.0.0), TRUST_PROXY=1 behind a reverse proxy (Fly, Render…).
 * A site built with VITE_HUB=self uses the hub it was served from; otherwise
 * point the game at it with ?hub=<host:port> or VITE_HUB=<host:port>.
 */
const port = Number(process.env.PORT ?? process.env.PEER_PORT ?? 9000);
const host = process.env.HOST ?? '0.0.0.0';
const proxied = process.env.TRUST_PROXY === '1';
const store = new LobbyStore();
const ice = iceFromEnv();
// LAN discovery for browsers (which can't send UDP): the hub broadcasts for them. Off behind a proxy (it's for home networks).
const lanHttp = () => lanInterfaces().map((i) => `http://${i.address}:${port}`);
const lan = proxied || process.env.LAN_DISCOVERY === '0' ? undefined : async () => ({ addresses: lanHttp(), servers: await discoverLan({ timeoutMs: 350, targets: ['127.0.0.1'] }) });
const lobby = lobbyHandler(store, proxied, ice, lan);
const siteDir = process.env.SITE_DIR ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
const site = existsSync(`${siteDir}/index.html`) ? siteHandler(siteDir) : null;
const app = PeerServer({ port, host, path: '/broker', proxied }, () => {
  console.log(
    `Tile Trigger hub on :${port} — site ${site ? siteDir : 'not built (pnpm build to serve it)'}, broker at /broker, game browser at /lobby, relay ${ice.provider ?? 'none (see src/ice.ts)'}`,
  );
  if (site && lanHttp().length) console.log(`On your network, open the game at: ${lanHttp().join('  ')}`);
});
app.use((req, res, next) => void lobby(req, res, () => (site ? void site(req, res, next) : next())));
