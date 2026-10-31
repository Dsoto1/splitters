import { BOT_SET_MAX, GAME_MODES, HOST_BOT_SKILLS, HOST_BOT_STYLES, MAX_PLAYER_SLOTS, MODE_LABELS, ROTATION_MAX, SERVER_RULES, botSetFromText, botSetLabel, botSetToText, emptyBotSet, isGameMode, parseRuleValue, presetBotSet, ruleSpec, serverRulesText, type BotSet, type BotSetPreset, type GameMode, type HostCommand, type RotationEntry, type RotationPreset, type RotationState } from '@tiletrigger/shared';
import type { PlayerInfo, RulesState } from '@tiletrigger/server/server';

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
  { name: 'teams', args: '[size | size size…]', help: 'show the teams, or set every team to this size (8 = 8v8), or each team its own (10 8)', match: true },
  { name: 'skill', args: 'easy|normal|hard', help: 'bot skill, live', match: false },
  { name: 'style', args: 'mixed|arena|tactical', help: 'bot style, live', match: false },
  { name: 'rules', args: '[<rule> <value>|<rule> default|map <rule> <value>|reset]', help: 'the match rules (score, time, ff, respawn, gravity, classes…): list them, or set one for every match (map: this map only)', match: false },
  { name: 'maxplayers', args: '<n>', help: 'people (not bots) who may play at once, live', match: false },
  { name: 'motd', args: '[<text>|clear]', help: 'the message each player gets when they join', match: false },
  { name: 'afk', args: '<seconds>', help: 'idle this long and a bot plays for a player until they\'re back (0: never), live', match: false },
  { name: 'idlekick', args: '<minutes>', help: 'idle this long (still connected) and a player is removed (0: never), live', match: false },
  { name: 'rotation', args: '[add <map> [mode]|remove <n>|move <n> up|down|preset <name>|shuffle on|off|clear]', help: 'the map rotation: the maps played in turn after each match (empty: the match replays)', match: true },
  { name: 'skip', args: '', help: "go on to the rotation's next map now", match: true },
  { name: 'botset', args: '[preset <name>|add <name> [look] [skill] [team]|remove <n>|list <bot; bot…>|only|random|clear]', help: 'your own bots: names, looks, skills, teams, squads (a bot: "Name, look, skill, style, team, squad")', match: true },
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

export const ROTATION_ACTIONS = ['add', 'remove', 'move', 'preset', 'shuffle', 'clear'] as const;
export const BOTSET_ACTIONS = ['preset', 'add', 'remove', 'list', 'only', 'random', 'clear'] as const;
/** What `rules` completes: the rule names, then (for a rule) its values. */
export const RULE_WORDS = SERVER_RULES.map((r) => r.key);
const ruleValues = (key: string): readonly string[] => {
  const t = ruleSpec(key)?.type;
  if (!t) return [];
  if (t.kind === 'choice') return [...t.values.map(([v]) => v), 'default'];
  if (t.kind === 'bool') return ['on', 'off', 'default'];
  return ['default'];
};

/** Tab completion for the console: command names, then map IDs and modes where they fit. */
export function complete(line: string, maps: readonly string[], presets: readonly string[] = [], botSets: readonly string[] = []): [string[], string] {
  const parts = line.split(/\s+/);
  if (parts.length <= 1) {
    const hits = NAMES.filter((n) => n.startsWith(parts[0] ?? ''));
    return [hits.length ? hits : NAMES.slice(), line];
  }
  const last = parts.at(-1) ?? '';
  const modes = GAME_MODES.map((m) => m.replace('core.', ''));
  const rotation = (): readonly string[] => {
    if (parts.length === 2) return ROTATION_ACTIONS;
    if (parts[1] === 'add') return parts.length === 3 ? maps : parts.length === 4 ? modes : [];
    if (parts[1] === 'preset') return parts.length === 3 ? presets : [];
    if (parts[1] === 'shuffle') return parts.length === 3 ? ['on', 'off'] : [];
    if (parts[1] === 'move') return parts.length === 4 ? ['up', 'down'] : [];
    return [];
  };
  const botset = (): readonly string[] => (parts.length === 2 ? BOTSET_ACTIONS : parts[1] === 'preset' && parts.length === 3 ? botSets : []);
  const rules = (): readonly string[] => {
    const at = parts[1] === 'map' ? 2 : 1;
    if (parts.length === 2) return [...RULE_WORDS, 'map', 'reset'];
    if (parts.length === at + 1) return RULE_WORDS;
    return parts.length === at + 2 ? ruleValues(parts[at]!) : [];
  };
  const pool = parts[0] === 'map' ? maps : parts[0] === 'mode' ? modes : parts[0] === 'visibility' ? ['listed', 'code'] : parts[0] === 'admin' ? ['token'] : parts[0] === 'rotation' ? rotation() : parts[0] === 'botset' ? botset() : parts[0] === 'rules' ? rules() : parts[0] === 'skill' ? HOST_BOT_SKILLS : parts[0] === 'style' ? HOST_BOT_STYLES : parts[0] === 'motd' ? ['clear'] : [];
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
  /** The map rotation now. */
  rotation(): RotationState;
  /** The built-in rotations (maps/rotations/). */
  presets: readonly RotationPreset[];
  /** The host's bot set now (null: random bots), and the built-in ones (maps/botsets/). */
  botSet(): BotSet | null;
  botSetPresets: readonly BotSetPreset[];
  /** The modes a map of our suite plays (its first is its own), or null. */
  modes(id: string): readonly GameMode[] | null;
  command(cmd: HostCommand, by: string): string | null;
  say(text: string): void;
  currentMapId(): string;
  teams(): string;
  setVisibility(v: 'listed' | 'code'): void;
  setName(name: string): void;
  maps: ReadonlyMap<string, string>;
  /** The match rules (RULES): what the server keeps, what plays, what waits; and setting one. */
  rules(): RulesState;
  setRule(key: string, value: unknown, by: string, where?: { map?: boolean }): string | null;
  /** People at most, the join message, the idle limits: live. */
  setLive(o: { maxPlayers?: number; motd?: string | null; afkSeconds?: number; idleKickMinutes?: number }): void;
  live(): { maxPlayers: number; motd: string | null; afkSeconds: number; idleKickMinutes: number };
}

/**
 * `rules …` (the parts after the word): which rule, its value (undefined: default) and whether for this map
 * only; `{ list: true }` to list them; `{ reset: true }` to clear them all; or an error.
 */
export function parseRulesArgs(args: string[]): { list: true } | { reset: true } | { key: string; value: unknown; map: boolean; text: string } | { error: string } {
  if (!args.length) return { list: true };
  if (args[0] === 'reset' && args.length === 1) return { reset: true };
  const map = args[0] === 'map';
  const rest = map ? args.slice(1) : args;
  const spec = rest[0] ? ruleSpec(rest[0]) : undefined;
  if (!spec) return { error: rest[0] ? `no rule "${rest[0]}" (rules lists them: ${RULE_WORDS.join(', ')})` : 'usage: rules map <rule> <value>' };
  const raw = rest.slice(1).join(' ');
  if (!raw) return { error: `usage: rules ${map ? 'map ' : ''}${spec.key} <${spec.type.kind === 'choice' ? spec.type.values.map(([v]) => v).join('|') : spec.type.kind === 'bool' ? 'on|off' : spec.type.kind === 'int' ? `${spec.type.min}-${spec.type.max}` : 'a, b, …'}|default>  (${spec.help})` };
  if (raw === 'default') return { key: spec.key, value: undefined, map, text: 'default' };
  const v = parseRuleValue(spec, raw);
  if (!v.ok) return { error: v.error };
  return { key: spec.key, value: v.value, map, text: raw };
}

/** When a rule's change reaches the match, for the console's answer. */
export const RULE_WHEN = { live: 'now', restart: 'at the restart (restart) or the next map', next: 'at the next match (restart or the next map)' } as const;

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
      const sizes = args.map(Number);
      if (sizes.some((n) => !Number.isInteger(n) || n < 1 || n > MAX_PLAYER_SLOTS)) return 'usage: teams [size | size size…]';
      if (sizes.length === 1) return done(t.command({ c: 'bots', teamSize: sizes[0]! }, by), `teams set to ${sizes[0]} each`);
      return done(t.command({ c: 'bots', teamSizes: sizes }, by), `teams set to ${sizes.join('v')} (the number of teams is the rules' teams: it changes at the next match)`);
    }
    case 'skill': {
      const v = HOST_BOT_SKILLS.find((x) => x === args[0]);
      if (!v) return `usage: skill ${HOST_BOT_SKILLS.join('|')}`;
      return done(t.command({ c: 'bots', skill: v }, by), `bot skill set to ${v}`);
    }
    case 'style': {
      const v = HOST_BOT_STYLES.find((x) => x === args[0]);
      if (!v) return `usage: style ${HOST_BOT_STYLES.join('|')}`;
      return done(t.setRule('style', v, by), `bot style set to ${v}`);
    }
    case 'rules': {
      const r = parseRulesArgs(args);
      if ('error' in r) return r.error;
      if ('list' in r) {
        const s = t.rules();
        return serverRulesText(s.set, s.now, s.map, new Set(s.pending));
      }
      if ('reset' in r) {
        const s = t.rules();
        for (const spec of SERVER_RULES) {
          t.setRule(spec.key, undefined, by);
          if (s.set.maps?.[s.map]) t.setRule(spec.key, undefined, by, { map: true });
        }
        return 'every rule back to the default (the mode\'s own) for every match; restart to play with them now';
      }
      const spec = ruleSpec(r.key)!;
      const err = t.setRule(r.key, r.value, by, { map: r.map });
      const scope = r.map ? ' on this map' : spec.perMode ? ` in ${MODE_LABELS[t.rules().now.mode as GameMode] ?? 'this mode'}` : '';
      const off = spec.modes && !spec.modes(t.rules().now.mode) ? ` (not used in ${MODE_LABELS[t.rules().now.mode]}: kept for the modes that use it)` : '';
      return done(err, `${spec.label} set to ${r.text}${scope}: applies ${RULE_WHEN[spec.apply]}${off}`);
    }
    case 'maxplayers': {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 1 || n > MAX_PLAYER_SLOTS) return `usage: maxplayers <1-${MAX_PLAYER_SLOTS}>`;
      t.setLive({ maxPlayers: n });
      return `up to ${n} people at once (now; nobody playing is removed)`;
    }
    case 'motd': {
      if (!rest) return t.live().motd ? `join message: ${t.live().motd}` : 'no join message (motd <text> sets one)';
      const text = rest === 'clear' ? null : rest.slice(0, 200);
      t.setLive({ motd: text });
      return text ? `join message set: ${text}` : 'join message removed';
    }
    case 'afk':
    case 'idlekick': {
      const n = Number(args[0]);
      const max = name === 'afk' ? 3600 : 1440;
      if (!Number.isInteger(n) || n < 0 || n > max) return `usage: ${name} <0-${max}>`;
      t.setLive(name === 'afk' ? { afkSeconds: n } : { idleKickMinutes: n });
      return name === 'afk' ? (n ? `a bot plays for anyone idle ${n} s` : 'idle players keep their place') : n ? `idle players are removed after ${n} min` : 'idle players are never removed';
    }
    case 'rotation':
      return rotationCommand(args, t);
    case 'skip':
      return done(t.command({ c: 'skip' }, by), "going on to the rotation's next map");
    case 'botset':
      return botSetCommand(args, rest, t);
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

/** The rotation as console lines: each map in turn, what plays now and what's next. */
export function rotationText(r: RotationState): string {
  if (!r.entries.length) return 'The rotation is empty: each match replays its map. rotation add <map> [mode], or rotation preset <name>.';
  const lines = r.entries.map((e, i) => `${String(i + 1).padStart(2)}. ${e.name} · ${MODE_LABELS[e.mode] ?? e.mode}${i === r.current ? '   (playing)' : ''}${i === r.next ? '   (next)' : ''}`);
  return [`Map rotation${r.shuffle ? ' (shuffled)' : ''}:`, ...lines].join('\n');
}

/** `rotation …`: show it, or change it with the same command in-game admins send (the whole list). */
function rotationCommand(args: string[], t: MatchCommandTarget): string {
  const by = 'Console';
  const r = t.rotation();
  const list: RotationEntry[] = r.entries.map((e) => ({ map: e.map, mode: e.mode }));
  const after = (err: string | null) => (err ? `refused: ${err}` : rotationText(t.rotation()));
  const set = (entries: RotationEntry[]) => after(t.command({ c: 'rotation', entries }, by));
  const at = (s: string | undefined) => {
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 && n <= list.length ? n - 1 : null;
  };
  switch (args[0]) {
    case undefined:
      return rotationText(r);
    case 'add': {
      if (!args[1]) return 'usage: rotation add <map> [mode]';
      const id = findMap(t.maps, args[1]);
      if (!id) return `no map "${args[1]}" among the game's maps`;
      const modes = t.modes(id) ?? [];
      const mode = args[2] ? findMode(args[2]) : (modes[0] ?? null);
      if (!mode) return `usage: rotation add <map> [${GAME_MODES.map((m) => m.replace('core.', '')).join('|')}]`;
      if (!modes.includes(mode)) return `${t.maps.get(id)} can't play ${MODE_LABELS[mode]} (it plays ${modes.map((m) => MODE_LABELS[m]).join(', ')})`;
      if (list.length >= ROTATION_MAX) return `the rotation holds ${ROTATION_MAX} maps at most`;
      return set([...list, { map: id, mode }]);
    }
    case 'remove': {
      const i = at(args[1]);
      if (i === null) return `usage: rotation remove <1-${list.length}>`;
      list.splice(i, 1);
      return set(list);
    }
    case 'move': {
      const i = at(args[1]);
      const d = args[2] === 'up' ? -1 : args[2] === 'down' ? 1 : 0;
      if (i === null || !d) return 'usage: rotation move <n> up|down';
      const j = i + d;
      if (j < 0 || j >= list.length) return rotationText(r);
      [list[i], list[j]] = [list[j]!, list[i]!];
      return set(list);
    }
    case 'clear':
      return set([]);
    case 'preset': {
      const p = t.presets.find((x) => x.id === args[1] || x.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());
      if (!p) return `usage: rotation preset <name>\n${t.presets.map((x) => `  ${x.id.padEnd(22)} ${x.name}: ${x.maps.length} maps`).join('\n') || '  (no built-in rotations)'}`;
      const err = t.command({ c: 'rotation', entries: p.maps.map((m) => ({ map: m.map, mode: m.mode })), shuffle: p.shuffle }, by);
      return err ? `refused: ${err}` : `rotation set to ${p.name}\n${rotationText(t.rotation())}`;
    }
    case 'shuffle': {
      if (args[1] !== 'on' && args[1] !== 'off') return 'usage: rotation shuffle on|off';
      return after(t.command({ c: 'rotation', shuffle: args[1] === 'on' }, by));
    }
    default:
      return `usage: ${helpText('rotation')}`;
  }
}

/** The bot set as console lines: one bot a line in the text form ("Name, look, skill, style, team, squad"). */
export function botSetText(set: BotSet | null): string {
  if (!set) return 'Random bots (no bot set). botset preset <name>, botset add <name> [look] [skill] [team], or botset list "Name, look, skill; …".';
  const lines = set.entries.map((e, i) => `${String(i + 1).padStart(2)}. ${botSetToText({ ...set, fill: 'random', entries: [e] })}`);
  return [`${botSetLabel(set)}${set.fill === 'only' ? '' : ' (random bots fill the rest)'}:`, ...lines].join('\n');
}

/** `botset …`: show it, or change it with the same command in-game admins send (the whole set). */
function botSetCommand(args: string[], rest: string, t: MatchCommandTarget): string {
  const by = 'Console';
  const now = t.botSet() ?? emptyBotSet();
  const send = (set: BotSet | null) => {
    const err = t.command({ c: 'bots', botSet: set }, by);
    return err ? `refused: ${err}` : botSetText(t.botSet());
  };
  const after = rest.slice(rest.match(/^\S+/)?.[0].length ?? 0).trim();
  switch (args[0]) {
    case undefined:
      return botSetText(t.botSet());
    case 'preset': {
      const key = args.slice(1).join(' ').toLowerCase();
      const p = t.botSetPresets.find((x) => x.id === args[1] || x.name.toLowerCase() === key);
      if (!p) return `usage: botset preset <name>\n${t.botSetPresets.map((x) => `  ${x.id.padEnd(22)} ${x.name}: ${x.entries.length} bots`).join('\n') || '  (no built-in bot sets)'}`;
      return send(presetBotSet(p));
    }
    case 'add': {
      if (!args[1]) return 'usage: botset add <name> [look] [skill] [team]  ("quoted names" may have spaces)';
      if (now.entries.length >= BOT_SET_MAX) return `a bot set holds ${BOT_SET_MAX} bots at most`;
      const add = botSetFromText([args[1], args[2] ?? '-', args[3] ?? '-', '-', args[4] ?? '-'].join(', ')).set.entries[0];
      if (!add) return 'usage: botset add <name> [look] [skill] [team]';
      return send({ ...now, entries: [...now.entries, add] });
    }
    case 'remove': {
      const n = Number(args[1]);
      const i = Number.isInteger(n) && n >= 1 && n <= now.entries.length ? n - 1 : now.entries.findIndex((e) => e.name.toLowerCase() === args.slice(1).join(' ').toLowerCase());
      if (i < 0) return `usage: botset remove <1-${now.entries.length}|name>`;
      return send({ ...now, entries: now.entries.filter((_, j) => j !== i) });
    }
    case 'list': {
      if (!after) return 'usage: botset list Name, look, skill, style, team, squad; Name2, …';
      const v = botSetFromText(after, now.name);
      return send({ ...v.set, fill: /^only\b/i.test(after) ? 'only' : now.fill }) + (v.fixes.length ? `\n(${v.fixes.join('; ')})` : '');
    }
    case 'only':
    case 'random':
      return send({ ...now, fill: args[0] });
    case 'clear':
      return send(null);
    default:
      return `usage: ${helpText('botset')}`;
  }
}
