import { GAME_MODES, MODE_LABELS, isGameMode, type GameMode, type HostCommand } from '@tiletrigger/shared';
import type { PlayerInfo } from '@tiletrigger/server/server';

/**
 * The server console's commands (main.ts reads them from the console window;
 * the match process runs the ones about the match). Parsing is pure and
 * tested; nothing here runs a shell or touches a path.
 */
export interface CommandSpec {
  name: string;
  args: string;
  help: string;
  /** Runs in the match process (it needs the match); otherwise in the service. */
  match: boolean;
}

export const COMMANDS: readonly CommandSpec[] = [
  { name: 'help', args: '[command]', help: 'this list, or one command', match: false },
  { name: 'status', args: '', help: 'server state, join code, players, map, tick time, upload', match: false },
  { name: 'players', args: '', help: 'people in the match: id, name, account or guest, ping, team, score', match: true },
  { name: 'kick', args: '<id|name> [reason]', help: 'remove a player (they may come back)', match: true },
  { name: 'ban', args: '<id|name> [duration] [reason]', help: 'remove and keep out: 30m, 12h, 7d, or for good (signed-in players by account; guests weakly)', match: true },
  { name: 'unban', args: '<ban id|name>', help: 'lift a ban', match: false },
  { name: 'bans', args: '', help: 'the ban list', match: false },
  { name: 'say', args: '<text>', help: 'a message to everyone in the match', match: true },
  { name: 'map', args: '<map>', help: 'change map (one of the game\'s maps, by ID or name)', match: true },
  { name: 'mode', args: '<mode>', help: `change mode on this map (${GAME_MODES.map((m) => m.replace('core.', '')).join(', ')})`, match: true },
  { name: 'bots', args: '<n>', help: 'players and bots to keep (people take bots\' places)', match: true },
  { name: 'teams', args: '[size]', help: 'show the teams, or set every team to this size (8 = 8v8)', match: true },
  { name: 'restart', args: '', help: 'restart the match (same map)', match: true },
  { name: 'end', args: '', help: 'end the match now, to the scoreboard', match: true },
  { name: 'visibility', args: 'listed|code', help: 'in the game browser, or join code only', match: true },
  { name: 'name', args: '<text>', help: 'the name in the game browser', match: true },
  { name: 'admin', args: 'token [rotate|clear]', help: 'show, change or remove the in-game admin token', match: false },
  { name: 'start', args: '', help: 'start the server again (after stop)', match: false },
  { name: 'stop', args: '', help: 'stop the server (the window stays: start brings it back)', match: false },
  { name: 'launcher', args: '', help: 'open the launcher (this console with controls) in your browser', match: false },
  { name: 'quit', args: '', help: 'stop the server and close the Host Service', match: false },
];

const NAMES = COMMANDS.map((c) => c.name);

export type Parsed = { ok: true; name: string; args: string[]; rest: string } | { ok: false; error: string };

/** A console line as a command and its arguments ("quoted words" stay together). */
export function parseCommand(line: string): Parsed | null {
  const text = line.trim();
  if (!text) return null;
  const words = [...text.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]!);
  const name = words[0]!.toLowerCase().replace(/^\//, '');
  if (!NAMES.includes(name)) {
    const near = NAMES.filter((n) => n.startsWith(name.slice(0, 2)));
    return { ok: false, error: `unknown command "${name}"${near.length ? ` (did you mean ${near.join(', ')}?)` : ''}: type help` };
  }
  return { ok: true, name, args: words.slice(1), rest: text.slice(text.match(/^\S+/)![0].length).trim() };
}

/** Tab completion for the console: command names, then map IDs and modes where they fit. */
export function complete(line: string, maps: readonly string[]): [string[], string] {
  const parts = line.split(/\s+/);
  if (parts.length <= 1) {
    const hits = NAMES.filter((n) => n.startsWith(parts[0] ?? ''));
    return [hits.length ? hits : NAMES.slice(), line];
  }
  const last = parts.at(-1) ?? '';
  const pool = parts[0] === 'map' ? maps : parts[0] === 'mode' ? GAME_MODES.map((m) => m.replace('core.', '')) : parts[0] === 'visibility' ? ['listed', 'code'] : parts[0] === 'admin' ? ['token'] : [];
  return [pool.filter((p) => p.startsWith(last)), last];
}

export function helpText(name?: string): string {
  const one = name ? COMMANDS.find((c) => c.name === name) : undefined;
  if (one) return `${one.name} ${one.args}  ${one.help}`;
  const w = Math.max(...COMMANDS.map((c) => `${c.name} ${c.args}`.length));
  return ['Commands (Tab completes):', ...COMMANDS.map((c) => `  ${`${c.name} ${c.args}`.padEnd(w)}  ${c.help}`)].join('\n');
}

/** "30m", "12h", "7d", "2w" or plain minutes → minutes; null if it isn't a duration. */
export function parseDuration(s: string): number | null {
  const m = /^(\d{1,6})([mhdw]?)$/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || 'm').toLowerCase();
  return n * ({ m: 1, h: 60, d: 1440, w: 10080 } as Record<string, number>)[unit]!;
}

/** A player by slot ("12", "#12") or name (exact, else a unique start, case-insensitive). */
export function findPlayer(players: readonly PlayerInfo[], key: string): PlayerInfo | string {
  const id = /^#?(\d{1,3})$/.exec(key);
  if (id) return players.find((p) => p.slot === Number(id[1])) ?? `no player with id ${id[1]} (players shows them)`;
  const k = key.toLowerCase();
  const exact = players.filter((p) => p.name.toLowerCase() === k);
  if (exact.length === 1) return exact[0]!;
  const start = players.filter((p) => p.name.toLowerCase().startsWith(k));
  if (start.length === 1) return start[0]!;
  return start.length ? `"${key}" matches ${start.map((p) => `${p.name} (#${p.slot})`).join(', ')}: use the id` : `no player called "${key}"`;
}

export function playersTable(players: readonly PlayerInfo[]): string {
  if (!players.length) return 'Nobody is playing (bots only).';
  const rows = players.map((p) => [`#${p.slot}`, p.name, p.sub ? 'account' : 'guest', p.ping === null ? '-' : `${p.ping} ms`, p.team ?? '-', `${p.kills}/${p.deaths}`, p.admin ? 'admin' : '']);
  const head = ['id', 'name', 'who', 'ping', 'team', 'k/d', ''];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  return [head, ...rows].map((r) => r.map((c, i) => c.padEnd(w[i]!)).join('  ').trimEnd()).join('\n');
}

/** A map by ID or display name among `maps` (id → name). */
export function findMap(maps: ReadonlyMap<string, string>, key: string): string | null {
  const k = key.toLowerCase().replace(/\s+/g, '_');
  if (maps.has(k)) return k;
  for (const [id, name] of maps) if (name.toLowerCase().replace(/\s+/g, '_') === k) return id;
  const starts = [...maps].filter(([id, name]) => id.startsWith(k) || name.toLowerCase().replace(/\s+/g, '_').startsWith(k));
  return starts.length === 1 ? starts[0]![0] : null;
}

export function findMode(key: string): GameMode | null {
  const k = key.toLowerCase();
  const full = k.startsWith('core.') ? k : `core.${k}`;
  if (isGameMode(full)) return full;
  for (const m of GAME_MODES) if ((MODE_LABELS[m] ?? '').toLowerCase().replace(/\s+/g, '') === k.replace(/\s+/g, '')) return m;
  return null;
}

/** What the match process needs to run match commands. */
export interface MatchCommandTarget {
  players(): PlayerInfo[];
  command(cmd: HostCommand, by: string): string | null;
  say(text: string): void;
  currentMapId(): string;
  teams(): string;
  setVisibility(v: 'listed' | 'code'): void;
  setName(name: string): void;
  maps: ReadonlyMap<string, string>;
}

/** Run a match command from the console; returns what to print. */
export function runMatchCommand(name: string, args: string[], rest: string, t: MatchCommandTarget): string {
  const by = 'Console';
  const done = (err: string | null, ok: string) => (err ? `refused: ${err}` : ok);
  switch (name) {
    case 'players':
      return playersTable(t.players());
    case 'kick':
    case 'ban': {
      if (!args[0]) return `usage: ${helpText(name)}`;
      const p = findPlayer(t.players(), args[0]);
      if (typeof p === 'string') return p;
      if (name === 'kick') {
        const reason = args.slice(1).join(' ');
        return done(t.command({ c: 'kick', slot: p.slot, ...(reason ? { reason } : {}) }, by), `kicked ${p.name}`);
      }
      const minutes = args[1] ? parseDuration(args[1]) : null;
      const reason = args.slice(minutes === null ? 1 : 2).join(' ');
      return done(t.command({ c: 'ban', slot: p.slot, ...(minutes ? { minutes } : {}), ...(reason ? { reason } : {}) }, by), `banned ${p.name}${minutes ? ` for ${args[1]}` : ' for good'}${p.sub ? ' (account)' : ' (guest: browser key and address, weak)'}`);
    }
    case 'say':
      if (!rest) return 'usage: say <text>';
      t.say(rest.slice(0, 200));
      return `said: ${rest.slice(0, 200)}`;
    case 'map': {
      if (!args[0]) return `usage: map <map>  (${[...t.maps.keys()].slice(0, 8).join(', ')}, …)`;
      const id = findMap(t.maps, rest);
      if (!id) return `no map "${rest}" among the game's maps`;
      return done(t.command({ c: 'map', map: id }, by), `changing map to ${t.maps.get(id)}`);
    }
    case 'mode': {
      const mode = args[0] ? findMode(args[0]) : null;
      if (!mode) return `usage: mode <${GAME_MODES.map((m) => m.replace('core.', '')).join('|')}>`;
      return done(t.command({ c: 'map', map: t.currentMapId(), mode }, by), `changing mode to ${MODE_LABELS[mode] ?? mode}`);
    }
    case 'bots': {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 1) return 'usage: bots <n>  (players and bots to keep)';
      return done(t.command({ c: 'bots', fill: n }, by), `keeping ${n} players and bots`);
    }
    case 'teams': {
      if (!args[0]) return t.teams();
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 1) return 'usage: teams [size]';
      return done(t.command({ c: 'bots', teamSize: n }, by), `teams set to ${n} each`);
    }
    case 'restart':
      return done(t.command({ c: 'restart' }, by), 'match restarting');
    case 'end':
      return done(t.command({ c: 'end' }, by), 'match ended');
    case 'visibility':
      if (args[0] !== 'listed' && args[0] !== 'code') return 'usage: visibility listed|code';
      t.setVisibility(args[0]);
      return args[0] === 'listed' ? 'listed in the game browser' : 'join code only (taken out of the game browser)';
    case 'name':
      if (!rest) return 'usage: name <text>';
      t.setName(rest);
      return `listed as "${rest.slice(0, 40)}"`;
    default:
      return `not a match command: ${name}`;
  }
}
