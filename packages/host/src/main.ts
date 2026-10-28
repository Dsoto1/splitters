import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { BanList } from './bans.ts';
import { runChild } from './child.ts';
import { COMMANDS, complete, helpText, parseCommand } from './commands.ts';
import { ConfigError, describeConfig, loadConfig, type HostConfig } from './config.ts';
import { DEFAULT_CONTROL_PORT, startControl } from './control.ts';
import { DEFAULT_MAPS_DIR, suiteIds } from './host.ts';
import { openLauncherWindow } from './appWindow.ts';
import { LogBuffer, mapCatalog } from './launcher.ts';
import { syncMaps } from './published.ts';
import { Logger } from './logger.ts';
import { ServiceState, stateDir } from './state.ts';
import { Supervisor, forkChild, CRASH_POLICY } from './supervisor.ts';

/**
 * Tile Trigger Host Service: a dedicated host people on the internet join
 * from the site's game browser or by join code, with no port forwarding,
 * certificates or browser tab (packages/host/README in docs/HOSTING.md,
 * "Dedicated host"). This process is the service: a server console (live log
 * and commands), a supervisor that runs the match in a child process and
 * restarts it after a crash, a control API on 127.0.0.1 for the site's /host
 * page, and the launcher (launcher.ts): the same console as a page in the
 * site's look, with a right bar of controls, opened in the browser on start.
 * `--child` runs the match process.
 *
 *   pnpm host                   start (settings from the environment / HOST_CONFIG, else the last ones)
 *   pnpm host --idle            don't start a server until asked (console `start`, the launcher, or /host)
 *   pnpm host --no-open         don't open the launcher in the browser (HOST_OPEN=0 too)
 */

const VERSION = (() => {
  // Packaged: version.txt beside the bundle; from the repository: the client's version (the game's).
  const here = dirname(fileURLToPath(import.meta.url));
  for (const f of [join(here, 'version.txt'), join(here, '../../client/package.json')]) {
    try {
      const t = readFileSync(f, 'utf8');
      return f.endsWith('.json') ? (JSON.parse(t) as { version: string }).version : t.trim();
    } catch {
      // next
    }
  }
  return 'dev';
})();

const SITE = 'https://trigger.toshiroplay.com';

async function service(): Promise<void> {
  const env = process.env;
  const args = process.argv.slice(2);
  const interactive = !!process.stdin.isTTY && !args.includes('--no-console');
  const state = new ServiceState(stateDir());
  // Logs next to the app when it can write there (the packaged folder), else in the state folder.
  const appDir = env.HOST_APP_DIR ?? null;
  let rl: ReturnType<typeof createInterface> | null = null;
  const print = (line: string) => {
    if (!rl) return console.log(line);
    process.stdout.write(`\r\x1b[K${line}\n`);
    rl.prompt(true);
  };
  // Everything the window shows, the launcher shows too.
  const logs = new LogBuffer();
  const printLog = (line: string) => {
    logs.push('log', line);
    print(line);
  };
  let logger = new Logger(appDir ? join(appDir, 'logs') : join(state.dir, 'logs'), printLog);
  if (!logger.file && appDir) logger = new Logger(join(state.dir, 'logs'), printLog);
  const log = (l: string) => logger.line(l);

  let config: HostConfig;
  try {
    config = loadConfig(env, env.INIT_CWD ?? process.cwd());
  } catch (e) {
    if (e instanceof ConfigError) {
      log(`settings: ${e.message}`);
      process.exit(2);
    }
    throw e;
  }
  const saved = state.load();
  // Settings given in the environment or a config file win; otherwise the last ones (set from /host or the console).
  const explicit = !!env.HOST_CONFIG || ['MAP', 'MODE', 'BOT_FILL', 'SERVER_NAME', 'VISIBILITY', 'MAX_PLAYERS'].some((k) => env[k]);
  const base = explicit || !saved.config ? config : { ...saved.config, hub: config.hub, ...(config.adminToken ? { adminToken: config.adminToken } : {}) };

  // The maps the match reads: the ones that came with the service, with the owner's published versions over them
  // (published.ts), kept up to date in the state folder. The match processes read that folder.
  const mapsDir = join(state.dir, 'maps');
  const syncNow = async () => {
    const r = await syncMaps(DEFAULT_MAPS_DIR, mapsDir, base.hub, fetch, (l) => log(`[maps] ${l}`)).catch((e: Error) => (log(`[maps] couldn't update the maps: ${e.message}`), null));
    if (!r) return;
    for (const id of suiteIds(mapsDir)) suite.add(id);
    for (const id of [...suite]) if (!existsSync(join(mapsDir, `${id}.json`))) suite.delete(id);
    launcherMaps.splice(0, launcherMaps.length, ...mapCatalog(mapsDir, suite));
    return r;
  };
  const suite = new Set<string>();
  const launcherMaps: ReturnType<typeof mapCatalog> = [];
  const synced = await syncNow();
  process.env.HOST_MAPS_DIR = mapsDir;
  if (synced?.published) log(`[maps] ${synced.published} map${synced.published === 1 ? '' : 's'} published by the game's owner${synced.added.length ? ` (new: ${synced.added.join(', ')})` : ''}`);
  // A publish reaches a running server at its next map change.
  setInterval(() => void syncNow(), 10 * 60_000).unref();

  const bansFile = join(state.dir, 'bans.json');
  const bans = new BanList(bansFile);
  let lastHost = '';
  const sup = new Supervisor(
    forkChild(),
    (l) => log(`[service] ${l}`),
    CRASH_POLICY,
    () => {
      const h = sup.host;
      const key = `${sup.state}|${h?.code}|${h?.online}|${h?.listed}`;
      if (key === lastHost) return;
      lastHost = key;
      if (sup.state === 'running' && h) log(`[service] running: join code ${h.code}, hub ${h.online ? 'connected' : 'unreachable (players in the match carry on)'}, ${h.visibility === 'listed' ? (h.listed ? 'listed in the game browser' : `not listed yet${h.listingError ? ` (${h.listingError})` : ''}`) : 'join code only'}`);
      else if (sup.state !== 'running') log(`[service] server ${sup.state}${sup.lastError && sup.state !== 'stopped' ? `: ${sup.lastError.summary}` : ''}`);
    },
    (line, kind) => log(kind === 'event' || line.startsWith('[') ? line : `[host] ${line}`),
    bansFile,
  );

  const token = state.token();
  let quitting = false;
  const quit = async (why: string) => {
    if (quitting) return;
    quitting = true;
    log(`[service] ${why}: stopping the server…`);
    await sup.stop();
    await control?.close().catch(() => undefined);
    log('[service] stopped. Bye.');
    rl?.close();
    process.exit(0);
  };

  // A console line from the window or the launcher: both see the command and its answer.
  let runLine: (line: string, from: 'window' | 'launcher') => Promise<void> = async () => undefined;
  const site = env.HOST_SITE ?? SITE;

  const port = env.CONTROL_PORT !== undefined ? Number(env.CONTROL_PORT) : DEFAULT_CONTROL_PORT;
  let control: Awaited<ReturnType<typeof startControl>> | null = null;
  try {
    control = await startControl({
      port,
      token,
      supervisor: sup,
      base,
      suite,
      origins: (env.HOST_ALLOWED_ORIGINS ?? '').split(/[\s,]+/).filter(Boolean),
      version: VERSION,
      persist: (c, running) => state.save(c, running),
      quit: () => void quit('quit from /host'),
      log: (l) => log(`[web] ${l}`),
      bans,
      launcher: { version: VERSION, commands: COMMANDS, maps: launcherMaps, site, logs, run: (line) => runLine(line, 'launcher') },
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      log(`[service] another Host Service is already running on this computer (port ${port} is taken). Close it first, or set CONTROL_PORT.`);
      process.exit(1);
    }
    throw e;
  }
  const pairUrl = `${site}/host#pair=${token}${control.port !== DEFAULT_CONTROL_PORT ? `&port=${control.port}` : ''}`;
  // The launcher, on this computer only; the key rides in the #fragment, which the browser never sends anywhere.
  const launcherUrl = `http://127.0.0.1:${control.port}/#key=${token}`;
  // Its own window (Edge or Chrome in app mode, a profile of its own in the state folder) when it can;
  // else a tab in your browser. `--browser` or HOST_APP_WINDOW=0: always a tab.
  const openLauncher = (): string =>
    openLauncherWindow(launcherUrl, { profileDir: join(state.dir, 'launcher-window'), appWindow: !args.includes('--browser') && env.HOST_APP_WINDOW !== '0', log });

  log(`Tile Trigger Host Service ${VERSION}. Type help for commands; closing this window stops the server.`);
  log(`Launcher: ${launcherUrl}  (opens in its own window; closing it leaves the server running: type launcher to open it again. The link carries this computer's pairing key: don't share it)`);
  log(`Also on the site: ${pairUrl}`);
  log(`Settings, bans and logs: ${state.dir}${logger.file ? `  (log: ${logger.file})` : ''}`);

  const startNow = !args.includes('--idle') && (explicit || !saved.config || saved.running);
  if (startNow) {
    log(`[service] starting: ${describeConfig(base)}`);
    state.save(base, true);
    void sup.start(base);
  } else log(`[service] not started${saved.config ? ' (it was stopped last time)' : ''}: type start, or use the web control`);

  // A status line now and then: players, bots, tick time, upload.
  if (base.statusEvery > 0)
    setInterval(() => {
      const h = sup.host;
      if (sup.state === 'running' && h) log(`[status] ${h.players}/${h.maxPlayers} players, ${h.bots} bots, ${h.map} (${h.mode.replace('core.', '')}), tick ${h.tickMs.toFixed(2)} ms, upload ${h.upKBps} KB/s, code ${h.code}${h.online ? '' : ', hub unreachable'}`);
    }, base.statusEvery * 1000).unref();

  const serviceCommand = async (name: string, a: string[], rest: string): Promise<string> => {
    switch (name) {
      case 'help':
        return helpText(a[0]);
      case 'status': {
        const h = sup.host;
        const s = sup.status();
        if (!h || s.state !== 'running') return `server ${s.state}${s.lastError ? ` (last error: ${s.lastError.summary})` : ''}`;
        return [
          `server running ${Math.round(h.uptimeS / 60)} min, join code ${h.code}, hub ${h.online ? 'connected' : 'unreachable'}${h.relay ? ', relay on' : ''}`,
          `${h.visibility === 'listed' ? `listed as "${h.name}"${h.listed ? '' : ' (not yet)'}` : 'join code only'}${h.community ? ', community map' : ''}`,
          `${h.map}, ${h.mode.replace('core.', '')}: ${h.players}/${h.maxPlayers} players, ${h.bots} bots, tick ${h.tickMs.toFixed(2)} ms, upload ${h.upKBps} KB/s`,
        ].join('\n');
      }
      case 'bans': {
        const list = bans.list();
        return list.length ? list.map((b) => `${b.id}  ${b.name}  ${b.sub ? 'account' : 'guest'}  ${b.until ? `until ${new Date(b.until).toLocaleString()}` : 'for good'}  ${b.reason}`).join('\n') : 'No bans.';
      }
      case 'unban': {
        if (!rest) return 'usage: unban <ban id|name>';
        const n = bans.remove(rest);
        return n ? `lifted ${n} ban${n === 1 ? '' : 's'}` : `no ban "${rest}" (bans lists them)`;
      }
      case 'admin': {
        if (a[0] !== 'token') return 'usage: admin token [rotate|clear]';
        const cur = sup.config ?? base;
        if (a[1] === 'rotate') {
          const t = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
          sup.setAdminToken(t);
          state.save(sup.config ?? { ...base, adminToken: t }, sup.state === 'running');
          return `new admin token: ${t} (players log in with it in the pause menu → Server admin; the old one no longer works)`;
        }
        if (a[1] === 'clear') {
          sup.setAdminToken(undefined);
          state.save(sup.config, sup.state === 'running');
          return 'admin token removed: nobody can log in as admin in-game';
        }
        return cur.adminToken ? `admin token: ${cur.adminToken}` : 'no admin token (admin token rotate makes one)';
      }
      case 'start':
        if (sup.state === 'running' || sup.state === 'starting') return 'already running (restart restarts the match; stop stops it)';
        void sup.start(sup.config ?? base);
        state.save(sup.config ?? base, true);
        return 'starting…';
      case 'stop':
        await sup.stop();
        state.save(sup.config, false);
        return 'server stopped (start brings it back; quit closes the Host Service)';
      case 'quit':
        void quit('quit');
        return '';
      case 'launcher':
        return openLauncher();
      default: {
        const spec = COMMANDS.find((c) => c.name === name);
        return spec?.match ? sup.command(name, a, rest) : `unknown command ${name}`;
      }
    }
  };

  // The window already shows what was typed there; a line from the launcher is echoed in the window too.
  runLine = async (line, from) => {
    const p = parseCommand(line);
    if (!p) return;
    logs.push('cmd', line.trim(), from);
    if (from === 'launcher') print(`> ${line.trim()}   (from the launcher)`);
    const out = p.ok ? await serviceCommand(p.name, p.args, p.rest) : p.error;
    if (!out) return;
    logs.push('out', out);
    print(out);
  };

  if (interactive) {
    const maps = [...suite].sort();
    rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ', completer: (line: string) => complete(line, maps) });
    rl.on('line', (line) => {
      if (!parseCommand(line)) return rl?.prompt();
      void runLine(line, 'window');
    });
    // Ctrl+C at the prompt: stop cleanly.
    rl.on('SIGINT', () => void quit('Ctrl+C'));
    rl.on('close', () => void quit('console closed'));
    rl.prompt();
  }
  // The launcher opens with the window (not for a service run in the background, or with --no-open / HOST_OPEN=0).
  if (interactive && !args.includes('--no-open') && env.HOST_OPEN !== '0') log(`[service] ${openLauncher()}`);
  process.on('SIGINT', () => void quit('Ctrl+C'));
  process.on('SIGTERM', () => void quit('asked to stop'));
  // The console window was closed (Windows sends SIGHUP then ends the process ~10 s later; macOS/Linux terminals too).
  process.on('SIGHUP', () => void quit('window closed'));
  if (process.platform === 'win32') process.on('SIGBREAK', () => void quit('window closed'));
}

if (process.argv.includes('--child')) runChild();
else if (!existsSync(DEFAULT_MAPS_DIR)) {
  console.error(`The game's maps are missing (${DEFAULT_MAPS_DIR}): run from the repository or the unpacked Host Service folder.`);
  process.exit(2);
} else
  void service().catch((e: Error) => {
    console.error(e);
    process.exit(1);
  });
