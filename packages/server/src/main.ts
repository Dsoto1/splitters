import { fileURLToPath } from 'node:url';
import { startServer } from './server.ts';

const env = process.env;
const defaultMap = fileURLToPath(new URL('../../../maps/phase0_arena.json', import.meta.url));
const difficulty = env.BOT_DIFFICULTY;
if (difficulty && !['easy', 'normal', 'hard'].includes(difficulty)) throw new Error(`BOT_DIFFICULTY must be easy|normal|hard`);

const server = await startServer({
  port: Number(env.PORT ?? 7777),
  host: env.HOST,
  map: env.MAP ?? defaultMap,
  botFill: Number(env.BOT_FILL ?? 4),
  botDifficulty: difficulty as 'easy' | 'normal' | 'hard' | undefined,
  onStats: env.QUIET_STATS ? undefined : (line) => console.log(`[stats] ${line}`),
});
console.log(`ChronoSplit server listening on ws://localhost:${server.port}`);

const shutdown = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
