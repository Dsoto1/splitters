import { fork, type ChildProcess } from 'node:child_process';
import type { FromChild, ToChild } from './child.ts';
import type { HostConfig } from './config.ts';
import type { HostStatus } from './host.ts';

/** Crash-loop protection (MULTIPLAYER_SECURITY.md section 6): backoff 5 s doubling to 5 min; 5 crashes in 10 min stop it. */
export type CrashPolicy = { firstDelayMs: number; maxDelayMs: number; maxCrashes: number; windowMs: number; hangMs: number; stopGraceMs: number };
export const CRASH_POLICY: Readonly<CrashPolicy> = { firstDelayMs: 5000, maxDelayMs: 300_000, maxCrashes: 5, windowMs: 600_000, hangMs: 30_000, stopGraceMs: 8000 };

export type ServiceState = 'stopped' | 'starting' | 'running' | 'stopping' | 'restarting' | 'crashloop';

export interface SupervisorStatus {
  state: ServiceState;
  config: HostConfig | null;
  host: HostStatus | null;
  /** Bounded: the last failure (≤ 300 characters), never tokens. */
  lastError: { at: number; summary: string } | null;
  crashes: number;
  /** When the match process (re)started. */
  since: number | null;
}

/** How to start a match process (tests pass a fake). */
export type Spawner = () => ChildProcess;

export const forkChild = (entry = process.argv[1]!): Spawner => () => fork(entry, ['--child'], { execArgv: process.execArgv, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });

/**
 * Runs the match in a child process and keeps it running: restarts it after a
 * crash or a hang (no status for 30 s) with backoff, under the same join code
 * (players' links and bookmarks keep working), and gives up after 5 crashes in
 * 10 minutes (state "crashloop", shown on /host) instead of looping forever.
 */
export class Supervisor {
  private child: ChildProcess | null = null;
  private crashTimes: number[] = [];
  private restartTimer?: NodeJS.Timeout;
  private watchdog?: NodeJS.Timeout;
  private lastBeat = 0;
  private resume?: { code: string; token: string };
  private wanted = false;
  private stopWaiters: (() => void)[] = [];
  state: ServiceState = 'stopped';
  config: HostConfig | null = null;
  host: HostStatus | null = null;
  lastError: { at: number; summary: string } | null = null;
  since: number | null = null;

  constructor(
    private readonly spawn: Spawner,
    private readonly log: (line: string) => void = (l) => console.log(`[service] ${l}`),
    private readonly policy: Readonly<CrashPolicy> = CRASH_POLICY,
    private readonly onChange: () => void = () => undefined,
    /** The match process's own log lines and events (joins, kicks, results). */
    private readonly onLine: (line: string, kind: 'log' | 'event') => void = (l) => console.log(l),
    private readonly bansFile?: string,
  ) {}

  private replies = new Map<number, (text: string) => void>();
  private nextReply = 1;

  /** Run a match command (commands.ts) in the match process; resolves with what to print. */
  command(name: string, args: string[], rest: string): Promise<string> {
    const child = this.child;
    if (!child || this.state !== 'running') return Promise.resolve(`the server is ${this.state}: ${this.state === 'stopped' ? 'start it first' : 'try again in a moment'}`);
    const id = this.nextReply++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.replies.delete(id);
        resolve('no answer from the match (busy?)');
      }, 5000);
      this.replies.set(id, (text) => {
        clearTimeout(timer);
        resolve(text);
      });
      child.send?.({ t: 'cmd', id, name, args, rest } satisfies ToChild);
    });
  }

  /** A new in-game admin token, live (and for every later start). */
  setAdminToken(token: string | undefined): void {
    if (this.config) this.config = { ...this.config, ...(token ? { adminToken: token } : {}) };
    if (this.config && !token) delete this.config.adminToken;
    this.child?.send?.({ t: 'admin-token', ...(token ? { token } : {}) } satisfies ToChild);
  }

  status(): SupervisorStatus {
    return { state: this.state, config: this.config, host: this.host, lastError: this.lastError, crashes: this.crashTimes.length, since: this.since };
  }

  /** Start a match with this config (a running one is stopped first; a new config gets a new join code unless it names one). */
  async start(config: HostConfig): Promise<void> {
    const sameCode = this.config && this.config.joinCode === config.joinCode && this.config.hub === config.hub;
    if (this.child) await this.stop();
    if (!sameCode) this.resume = undefined;
    this.config = config;
    this.crashTimes = [];
    this.lastError = null;
    this.wanted = true;
    this.launch();
  }

  /** Stop the match (players are told), and don't restart it. */
  stop(): Promise<void> {
    this.wanted = false;
    clearTimeout(this.restartTimer);
    if (!this.child) {
      this.set('stopped');
      return Promise.resolve();
    }
    this.set('stopping');
    const child = this.child;
    const done = new Promise<void>((r) => this.stopWaiters.push(r));
    child.send?.({ t: 'stop', reason: 'The host stopped the server' } satisfies ToChild);
    const kill = setTimeout(() => child.kill('SIGKILL'), this.policy.stopGraceMs);
    kill.unref?.();
    return done.finally(() => clearTimeout(kill));
  }

  async restart(): Promise<void> {
    if (!this.config) throw new Error('nothing to restart: start a server first');
    const config = this.config;
    await this.stop();
    this.config = config;
    this.wanted = true;
    this.set('restarting');
    this.launch();
  }

  private set(state: ServiceState): void {
    if (state === this.state) return;
    this.state = state;
    if (state === 'stopped' || state === 'crashloop') this.host = null;
    this.onChange();
  }

  private launch(): void {
    if (!this.config || !this.wanted) return;
    const child = this.spawn();
    this.child = child;
    this.since = Date.now();
    this.lastBeat = Date.now();
    this.set('starting');
    let startupFailed = false;
    child.on('message', (m: FromChild) => {
      if (this.child !== child) return;
      this.lastBeat = Date.now();
      if (m.t === 'up') {
        this.resume = { code: m.code, token: m.token };
        this.set('running');
      } else if (m.t === 'status') {
        this.host = m.status;
        if (this.state === 'starting' || this.state === 'restarting') this.set('running');
        this.onChange();
      } else if (m.t === 'log' || m.t === 'event') {
        this.onLine(m.line, m.t);
      } else if (m.t === 'reply') {
        this.replies.get(m.id)?.(m.text);
        this.replies.delete(m.id);
      } else if (m.t === 'failed') {
        startupFailed = this.state === 'starting' || this.state === 'restarting';
        this.lastError = { at: Date.now(), summary: m.error.slice(0, 300) };
        this.log(`match process failed: ${this.lastError.summary}`);
      }
    });
    child.on('exit', (code, signal) => {
      if (this.child !== child) return;
      this.child = null;
      clearInterval(this.watchdog);
      for (const w of this.stopWaiters.splice(0)) w();
      if (!this.wanted) return this.set('stopped');
      // A server that can't start (a bad map or setting) won't start next time either.
      if (startupFailed && code === 3) {
        this.wanted = false;
        return this.set('stopped');
      }
      const now = Date.now();
      this.crashTimes = [...this.crashTimes.filter((t) => now - t < this.policy.windowMs), now];
      if (!this.lastError || this.lastError.at < now - 1000) this.lastError = { at: now, summary: `the match process stopped unexpectedly (${signal ?? `exit ${code}`})` };
      if (this.crashTimes.length >= this.policy.maxCrashes) {
        this.wanted = false;
        this.log(`${this.crashTimes.length} crashes in ${this.policy.windowMs / 60000} minutes: not restarting (crash loop). Start it again from /host.`);
        return this.set('crashloop');
      }
      const delay = Math.min(this.policy.maxDelayMs, this.policy.firstDelayMs * 2 ** (this.crashTimes.length - 1));
      this.log(`match process stopped unexpectedly; restarting in ${Math.round(delay / 1000)} s (same join code)`);
      this.set('restarting');
      this.restartTimer = setTimeout(() => this.launch(), delay);
    });
    child.send?.({ t: 'start', config: this.config, ...(this.resume ? { resume: this.resume } : {}), ...(this.bansFile ? { bansFile: this.bansFile } : {}) } satisfies ToChild);
    // A match process that stops reporting is hung (a stuck loop): kill it, and the exit handler restarts it.
    clearInterval(this.watchdog);
    this.watchdog = setInterval(() => {
      if (this.child === child && Date.now() - this.lastBeat > this.policy.hangMs) {
        this.lastError = { at: Date.now(), summary: `the match process stopped responding for ${this.policy.hangMs / 1000} s` };
        this.log(this.lastError.summary);
        child.kill('SIGKILL');
      }
    }, Math.min(5000, this.policy.hangMs / 3));
    this.watchdog.unref?.();
  }
}
