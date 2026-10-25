import { PeerServer } from 'peer';
import { LobbyStore, lobbyHandler } from './lobby.ts';

/**
 * The community hub: the one always-on piece player-hosted games need. It
 * introduces players' browsers to each other (a PeerJS broker, for Host game
 * and Join by code) and keeps the game browser's list. No match runs here.
 *   PORT (9000), HOST (0.0.0.0), TRUST_PROXY=1 behind a reverse proxy.
 * Point the game at it with ?hub=<host:port> or VITE_HUB at build time.
 */
const port = Number(process.env.PORT ?? process.env.PEER_PORT ?? 9000);
const host = process.env.HOST ?? '0.0.0.0';
const store = new LobbyStore();
const handle = lobbyHandler(store, process.env.TRUST_PROXY === '1');
const app = PeerServer({ port, host, path: '/', proxied: process.env.TRUST_PROXY === '1' }, () => {
  console.log(`ChronoSplit hub on :${port} — broker at /, game browser at /lobby (open the game with ?hub=<this machine>:${port})`);
});
app.use((req, res, next) => void handle(req, res, next));
