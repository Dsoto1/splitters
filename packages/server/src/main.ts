import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_MODES, isGameMode, parsePlaylist, type GameMode } from '@tiletrigger/shared';
import { startServer } from './server.ts';

const env = process.env;
const defaultMap = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));
const difficulty = env.BOT_DIFFICULTY;
if (difficulty && !['easy', 'normal', 'hard'].includes(difficulty)) throw new Error(`BOT_DIFFICULTY must be easy|normal|hard`);
// MODE=core.ctf (core.koth, core.elim, core.tdm, core.deathmatch, core.coop); default: the map's first mode.
const mode = env.MODE || undefined;
if (mode && !isGameMode(mode)) throw new Error(`MODE must be one of ${GAME_MODES.join('|')}`);

// PLAYLIST=maps/playlists/night_shift.json plays a scenario chain (its maps in order, each once the one before is won).
const playlist = env.PLAYLIST ? parsePlaylist(JSON.parse(readFileSync(resolve(env.INIT_CWD ?? process.cwd(), env.PLAYLIST), 'utf8'))) : undefined;
if (playlist === null) throw new Error(`PLAYLIST ${env.PLAYLIST} is not a valid playlist`);

// ROTATION=frost_basin:tdm,diamond_park:ctf (or preset:team_classics, maps/rotations/): after each match the next of
// these instead of a replay, round and round; ROTATION_SHUFFLE=1 plays them in a random order.
const rotation = (env.ROTATION ?? '').split(/[\s,]+/).filter(Boolean);

const server = await startServer({
  playlist,
  ...(rotation.length ? { rotation, rotationShuffle: /^(1|true|yes|on)$/i.test(env.ROTATION_SHUFFLE ?? '') } : {}),
  port: Number(env.PORT ?? 7777),
  host: env.HOST,
  map: env.MAP ?? defaultMap,
  botFill: Number(env.BOT_FILL ?? 4),
  botDifficulty: difficulty as 'easy' | 'normal' | 'hard' | undefined,
  mode: mode as GameMode | undefined,
  // BOT_TAKEBACK=1: a bot takes over where a leaving player was, instead of the slot emptying and a fresh bot spawning normally.
  botTakeBack: env.BOT_TAKEBACK === '1',
  // AFK_SECONDS: idle this long and a bot plays for a player until they're back (default 90; 0: never).
  afkSeconds: env.AFK_SECONDS !== undefined ? Number(env.AFK_SECONDS) : undefined,
  // IDLE_KICK_MINUTES: away for being idle this long, still connected, and they're removed (default 10; 0: never).
  idleKickMinutes: env.IDLE_KICK_MINUTES !== undefined ? Number(env.IDLE_KICK_MINUTES) : undefined,
  // LEADERS=on (team leaders) or LEADERS=vip (Leader variant: downing a leader scores extra).
  leaders: env.LEADERS === 'vip' ? 'vip' : env.LEADERS === 'on' ? true : undefined,
  name: env.SERVER_NAME,
  // LAN_DISCOVERY=0 stops answering LAN discovery broadcasts (UDP 7790).
  lanDiscovery: env.LAN_DISCOVERY !== '0',
  // ADMIN_TOKEN=…: players who join with ?admin=… (or enter it in the pause menu) change bots and map, restart and end the match.
  adminToken: env.ADMIN_TOKEN || undefined,
  onStats: env.QUIET_STATS ? undefined : (line) => console.log(`[stats] ${line}`),
});
console.log(`Tile Trigger server listening on ws://localhost:${server.port}`);
const lan = server.info().addresses.filter((a) => !a.includes('localhost'));
if (lan.length) console.log(`On your network, join at: ${lan.join('  ')}  (Online → LAN finds it too)`);

const shutdown = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
