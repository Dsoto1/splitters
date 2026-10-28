import { BanList } from './bans.ts';
import { runMatchCommand } from './commands.ts';
import type { HostConfig } from './config.ts';
import { startHost, type HostStatus, type RunningHost } from './host.ts';

/** Service → match process. */
export type ToChild =
  | { t: 'start'; config: HostConfig; resume?: { code: string; token: string }; bansFile?: string }
  | { t: 'stop'; reason?: string }
  /** A console (or /host page) command about the match (commands.ts). */
  | { t: 'cmd'; id: number; name: string; args: string[]; rest: string }
  | { t: 'admin-token'; token?: string };
/** Match process → service. */
export type FromChild =
  | { t: 'up'; code: string; token: string }
  | { t: 'status'; status: HostStatus }
  /** Alive (every 2 s from the start, also while the hub is unreachable). */
  | { t: 'beat' }
  | { t: 'log'; line: string }
  /** Joins, leaves, kicks, results: the console's live log. */
  | { t: 'event'; line: string }
  | { t: 'reply'; id: number; text: string }
  | { t: 'failed'; error: string };

/**
 * The match process the Host Service supervises (main.ts --child): runs one
 * host (host.ts) with the config the service sends, reports its status every
 * couple of seconds (the service treats silence as a hang), runs the
 * console's match commands, and stops cleanly on 'stop', SIGTERM/SIGINT or
 * when the service goes away.
 */
export function runChild(): void {
  const send = (m: FromChild) => process.send?.(m);
  const log = (line: string) => send({ t: 'log', line: line.slice(0, 300) });
  let host: RunningHost | null = null;
  const beat = setInterval(() => send({ t: 'beat' }), 2000);
  let stopping = false;
  const stop = async (reason?: string) => {
    if (stopping) return;
    stopping = true;
    await host?.stop(reason).catch(() => undefined);
    process.exit(0);
  };
  process.on('message', (m: ToChild) => {
    if (m.t === 'stop') return void stop(m.reason);
    if (m.t === 'cmd') {
      let text: string;
      try {
        text = host ? runMatchCommand(m.name, m.args, m.rest, host.commands) : 'the server is still starting';
      } catch (e) {
        text = `failed: ${(e as Error).message}`;
      }
      return void send({ t: 'reply', id: m.id, text });
    }
    if (m.t === 'admin-token') return void host?.setAdminToken(m.token);
    if (m.t === 'start' && !host) {
      const bans = m.bansFile ? new BanList(m.bansFile) : undefined;
      startHost(m.config, {
        log,
        resume: m.resume,
        bans,
        onEvent: (line) => send({ t: 'event', line: line.slice(0, 300) }),
        onStats: process.env.HOST_STATS === '1' ? (l) => console.log(`[stats] ${l}`) : undefined,
      })
        .then((h) => {
          host = h;
          send({ t: 'up', code: h.code, token: h.token });
          send({ t: 'status', status: h.status() });
          clearInterval(beat);
          setInterval(() => send({ t: 'status', status: h.status() }), 2000);
        })
        .catch((e: Error) => {
          send({ t: 'failed', error: e.message.slice(0, 300) });
          process.exit(3);
        });
    }
  });
  process.on('SIGTERM', () => void stop());
  // Ctrl+C in the console reaches the whole process group: the service decides (it stops this process itself).
  process.on('SIGINT', () => undefined);
  // The service went away (closed, crashed): don't run on unsupervised.
  process.on('disconnect', () => void stop());
  process.on('uncaughtException', (e) => {
    send({ t: 'failed', error: `crash: ${(e.stack ?? e.message).slice(0, 300)}` });
    console.error(e);
    process.exit(1);
  });
}
