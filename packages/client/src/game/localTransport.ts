import { BROWSER_HOST_MAX_GUESTS, MAX_PLAYER_SLOTS, SNAPSHOT_BINARY_VERSION, SnapshotBinaryDecoder, type CarryOver, type GameMode, type HostCommand, type HostState, type MapDocument, type MatchRules, type PlayerInput, type RotationCommand, type ServerMessage, type VoteOption } from '@tiletrigger/shared';
import { deviceMaxPlayers } from '../touchDevice.ts';
import { MatchHost, dispatchToHost, sinkTo, type FromSimHost, type HostFacts, type HostListing, type LocalMatchOptions, type ToSimHost } from './matchHost.ts';
import { allowedHere } from '../testMode.ts';
import { playerKey } from './playerKey.ts';
import { perfProbe } from './perfProbe.ts';
import { perfOn } from './perfSwitches.ts';
import { INTERP_KEEPS_SNAPSHOTS } from './interpolation.ts';
import { SnapshotCoalescer, type SnapshotBacklog } from './snapshotMerge.ts';
import type { RemoteLink, Transport } from './transport.ts';
import { checkTicket, helloTicket } from './ticketCheck.ts';
import type { BotDebugFrame } from '@tiletrigger/shared/match';
import { PlayTracker } from './communityPlays.ts';
import { opticsHello } from '../opticPrefs.ts';

export type { RemoteLink } from './transport.ts';

export type { LocalMatchOptions } from './matchHost.ts';


/** Where this browser's match runs: a worker (the default), or the page's own thread. */
export type SimThread = 'worker' | 'main';

const SIM_KEY = 'tiletrigger.sim';
/**
 * Binary snapshots are read into a ring of reused player objects this long: more than the interpolation buffer
 * keeps (the only reader that holds a snapshot's players past the next few; session.ts reads the rest at once),
 * with room for what a frame still has in hand.
 */
export const SNAPSHOT_RING = INTERP_KEEPS_SNAPSHOTS + 11;
/** Buffers of read snapshots go back to the worker this many at a time. */
const RETURN_BUFFERS = 4;
/** How often the page tells the match which friends' links are up (MatchHost.linkUp). */
const LINK_UP_EVERY_MS = 2000;

/**
 * The page's thread instead of a worker: browsers without module workers, `?sim=main`,
 * or `localStorage['tiletrigger.sim'] = 'main'` (browser tests that reach into the
 * match synchronously through `window.__match`).
 */
export function simThreadWanted(): SimThread {
  if (typeof Worker === 'undefined') return 'main';
  try {
    if (new URLSearchParams(location.search).get('sim') === 'main') return 'main';
    if (localStorage.getItem(SIM_KEY) === 'main') return 'main';
  } catch {
    // No storage: the default.
  }
  return 'worker';
}

/** A match worker started ahead of time (prewarmSimWorker), taken by the next match. */
let spare: Worker | null = null;

function newSimWorker(): Worker {
  return new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module', name: 'match' });
}

/**
 * Start a match worker loading the simulation and its WebAssembly (physics,
 * navigation) ahead of time, so the next local match (MapMaker TEST) doesn't
 * wait for it. Harmless when unused; does nothing without workers.
 */
export function prewarmSimWorker(): void {
  if (spare || simThreadWanted() !== 'worker') return;
  try {
    const w = newSimWorker();
    w.onerror = () => {
      w.terminate();
      if (spare === w) spare = null;
    };
    w.postMessage({ k: 'warm' } satisfies ToSimHost);
    spare = w;
  } catch {
    spare = null;
  }
}

/** Test hooks (browser tests, perf runs): the same in both threads, async because a worker answers later. */
export interface SimHook {
  mode: SimThread;
  /** Run `(match, me, arg, module) => value` (its source) where the match runs; resolves with a value that can be copied. */
  eval(src: string, arg?: unknown): Promise<unknown>;
  /** How the page has kept up with the worker's snapshots (null with the match on the page). */
  backlog: SnapshotBacklog | null;
  /** Snapshots that came as binary messages (0 with the match on the page, or with `?perfoff=snapbin`). */
  binary: number;
}

/**
 * Runs the authoritative Match for this browser and speaks the same message
 * protocol as the dedicated server. Used by MapMaker TEST, offline play and
 * Host game, so "test" exercises exactly the code a hosted match runs.
 *
 * The match itself (MatchHost) runs in a Web Worker, so bots, navigation and
 * physics don't share a core with rendering: snapshots and events come back
 * as messages, inputs and host commands go to it, and friends' links are
 * relayed through. Without workers (or asked: see simThreadWanted) the same
 * MatchHost runs on the page's thread, with the same messages.
 */
export class LocalTransport implements Transport {
  readonly label = 'local';
  rttMs = 0;
  bytesIn = 0;
  /** Time from start() to the welcome message, for the TEST transition budget. */
  startupMs = 0;
  /** Where the match runs (known once started). */
  thread: SimThread | null = null;
  private stopped = false;
  private worker?: Worker;
  private inThread?: MatchHost;
  /** What we've told the host before it existed (and, with a worker, until it welcomed us: replayed if it fails). */
  private early: ToSimHost[] = [];
  private welcomed = false;
  private facts: HostFacts | null = null;
  /** Friends playing in this match (Host game), by the id the host knows them by. */
  private links = new Map<number, { link: RemoteLink; slot: number | null }>();
  private nextLink = 1;
  /** Friends were sent `travel`: give it time to arrive before their links close. */
  private departing = false;
  /** Every few seconds: which friends' links are up (the match gives a stalled friend longer: MatchHost.linkUp). */
  private upTimer?: number;
  private evals = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextEval = 1;
  private onVisibility?: () => void;
  private onMessage?: (m: ServerMessage) => void;
  private onBotDebug?: (f: BotDebugFrame) => void;
  private onClose?: (reason: string) => void;
  /** With the match in a worker: a page that fell behind handles the snapshots waiting for it as one. */
  private snapshots?: SnapshotCoalescer;
  /** With the match in a worker: reads its binary snapshots (asked for in `start`; `?perfoff=snapbin` asks for objects). */
  private decoder?: SnapshotBinaryDecoder;
  /** Buffers of snapshots read, on their way back to the worker. */
  private spent: ArrayBuffer[] = [];
  /** Binary snapshots read (perf runs and tests: `window.__sim.binary`). */
  binarySnapshots = 0;

  constructor(
    private readonly map: MapDocument,
    private readonly opts: LocalMatchOptions,
  ) {}

  /**
   * The in-game bot debug view (`?botdebug=1`, host or offline: game/botDebugView.ts): frames from the match a few
   * times a second while `onFrame` is given; null turns it off.
   */
  botDebug(onFrame: ((f: BotDebugFrame) => void) | null): void {
    this.onBotDebug = onFrame ?? undefined;
    // (Before the match is started, it is asked for once it is: the worker drops anything before its 'start'.)
    if (this.worker || this.inThread) this.toHost({ k: 'botdebug', on: !!onFrame });
  }

  /** A browser test's deterministic match (testMode.ts): offline only. */
  get testMode(): boolean {
    return !!this.opts.test;
  }

  /** What the local player would take into the next map of a chain (score and weapons), or null before the match runs. */
  carry(): CarryOver | null {
    if (this.stopped) return null;
    return this.inThread ? this.inThread.carry() : (this.facts?.carry ?? null);
  }

  /**
   * How many people can play: friends take bots' places up to the match's size,
   * and the host's browser takes BROWSER_HOST_MAX_GUESTS friends at most (its upload carries their snapshots).
   */
  get capacity(): number {
    return Math.max(1, Math.min(this.facts?.state.fill ?? this.opts.botFill, MAX_PLAYER_SLOTS, 1 + BROWSER_HOST_MAX_GUESTS));
  }

  /** The match's host settings now (null before it runs). */
  hostState(): HostState | null {
    return this.stopped ? null : (this.facts?.state ?? null);
  }

  /** The rules the match plays now (the host may have changed team sizes and bot style), or null before it runs. */
  liveRules(): MatchRules | null {
    return this.stopped ? null : (this.facts?.rules ?? null);
  }

  /**
   * The host runs the match (this browser's player: offline, or Host game).
   * A map change is the session's (it restarts the match on the new map);
   * everything else happens there, live. A refused command comes back as a
   * `host` message with its error. Friends can't: their commands are refused.
   */
  host(cmd: Exclude<HostCommand, { c: 'map' } | RotationCommand>): string | null {
    if (this.stopped || !this.facts) return 'The match has not started';
    this.toHost({ k: 'cmd', cmd });
    return null;
  }

  /** Where the map rotation (kept by the page) goes after this match: the end-of-match scoreboard says so to everyone. */
  setUpNext(next: { map: string; mode: GameMode } | null): void {
    this.toHost({ k: 'upnext', next });
  }

  /** Go offline: every friend is told why and disconnected, and bots take their places again (the match carries on). */
  dropGuests(reason: string): void {
    this.toHost({ k: 'drop', reason });
  }

  /**
   * The game browser listing (or none): if the match is handed on, the successor lists it under the same name.
   * Its ID and secret stay on this page until we leave: then the successor gets them with its goodbye (sayGoodbye).
   */
  setListing(listing: (HostListing & { id?: string; secret?: string }) | null): void {
    this.listing = listing?.id && listing.secret ? { id: listing.id, secret: listing.secret } : null;
    this.toHost({ k: 'listing', listing: listing ? { name: listing.name } : null });
  }

  private listing: { id: string; secret: string } | null = null;

  /** Tell everyone the map is about to change ("Changing map to …"). */
  notice(text: string): void {
    // This player sees it now (the map change follows at once); friends get it from the match.
    if (!this.stopped) this.onMessage?.({ t: 'notice', text });
    this.toHost({ k: 'notice', text, guestsOnly: true });
  }

  /** Host game, map change: friends get `travel` and reconnect by themselves to the same join code, where the next match lets them in. */
  travelGuests(mapName: string): void {
    // Sent from here: the match (and its worker) stops right after, before it could answer.
    const text = JSON.stringify({ t: 'travel', map: mapName } satisfies ServerMessage);
    for (const r of this.links.values()) if (r.slot !== null) r.link.send(text);
    this.departing = true;
  }

  /**
   * This host is leaving on purpose (left the match, the tab is closing): every friend is told (`bye`) before the
   * links close, so they know it wasn't a network drop. Sent from the page: the match may stop before it could.
   */
  sayGoodbye(): void {
    if (this.departing || this.stopped || this.saidBye) return;
    const text = JSON.stringify({ t: 'bye' } satisfies ServerMessage);
    // The successor also gets the listing, to take it down should our own request not get out of a closing tab.
    const heir = this.listing && this.facts?.successor !== undefined ? this.facts.successor : null;
    const theirs = JSON.stringify({ t: 'bye', ...(this.listing ? { listing: this.listing } : {}) } satisfies ServerMessage);
    for (const [id, r] of this.links) if (r.slot !== null) r.link.send(id === heir ? theirs : text);
    this.saidBye = true;
  }

  private saidBye = false;

  /** Players connected from elsewhere (Host game). */
  get guests(): number {
    return [...this.links.values()].filter((r) => r.slot !== null).length;
  }

  start(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void {
    const t0 = performance.now();
    this.onMessage = (m) => {
      if (m.t === 'welcome' && !this.welcomed) {
        this.welcomed = true;
        this.early = [];
        this.startupMs = performance.now() - t0;
      }
      onMessage(m);
    };
    this.onClose = onClose;
    this.onVisibility = () => this.toHost({ k: 'hidden', v: document.hidden });
    // (Unit tests run this without a real document.)
    if (typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', this.onVisibility);
    // The tab is closing (or reloading): friends hear it from us, not from a dead link.
    if (typeof window.addEventListener === 'function') window.addEventListener('pagehide', this.onPageHide);
    // This browser's key goes with the match: a successor keeps our place for it if the match is handed on.
    // `?drive=classic` / `?drive=rigid` / `?drive=own`: every vehicle that has rigid driving drives the classic way, or
    // rigid even where it is off, or rigid with driving physics 3's own hull contacts and sweep in place of the Rapier
    // body (docs/DRIVING_PHYSICS_PLAN.md), for comparing.
    const drive = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('drive');
    // `?akimbo=1` (a dev server, a test-hooks build or this machine only, as test mode): dual wielding in play in
    // this browser's own matches while it is being built (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield").
    const akimbo = typeof location !== 'undefined' && new URLSearchParams(location.search).get('akimbo') === '1' && allowedHere();
    const start: ToSimHost = { k: 'start', map: this.map, opts: { selfKey: `pk:${playerKey()}`, maxPlayers: deviceMaxPlayers(), ...(opticsHello().op ? { optics: opticsHello().op } : {}), ...(drive === 'classic' || drive === 'rigid' || drive === 'own' ? { drive } : {}), ...(akimbo ? { akimbo: true } : {}), ...this.opts }, hidden: document.hidden };
    if (!(simThreadWanted() === 'worker' && this.startWorker(start))) this.startHere(start);
    if (this.onBotDebug) this.toHost({ k: 'botdebug', on: true });
  }

  /** The match in a module worker. False when one can't be made here. */
  private startWorker(first: ToSimHost): boolean {
    let start = first;
    let worker: Worker;
    try {
      worker = spare ?? newSimWorker();
      spare = null;
    } catch {
      return false;
    }
    this.worker = worker;
    this.thread = 'worker';
    const decoder = perfOn('snapbin') ? new SnapshotBinaryDecoder({ ring: SNAPSHOT_RING }) : undefined;
    this.decoder = decoder;
    if (decoder && start.k === 'start') start = { ...start, snap: SNAPSHOT_BINARY_VERSION };
    this.snapshots = new SnapshotCoalescer((m) => {
      // A snapshot handed on keeps its (reused) objects until the ring comes round; one merged away never took a place.
      if (m.t === 'snapshot') decoder?.commit();
      if (!this.stopped) this.onMessage?.(m);
    });
    worker.onmessage = (e: MessageEvent<FromSimHost>) => this.receive(e.data);
    // A worker that can't run (it failed to load) before the match began: run it here instead.
    worker.onerror = (e) => {
      e.preventDefault();
      if (this.stopped) return;
      if (!this.welcomed) {
        console.warn('match worker failed, running the match on the page instead', e.message);
        return this.fallBack(start);
      }
      // A running match's error stays an error of this page (as it was when the match ran here): tests and the console see it.
      const error = new Error(`match worker: ${e.message || 'error'}`);
      window.setTimeout(() => {
        throw error;
      });
    };
    worker.postMessage(start);
    // What came before (a friend reconnecting after a map change): kept until the welcome, in case we fall back.
    for (const m of this.early) worker.postMessage(m);
    this.installHooks();
    return true;
  }

  /** The match on the page's own thread (no workers, or asked for). */
  private startHere(start: ToSimHost): void {
    if (start.k !== 'start') return;
    this.thread = 'main';
    const post = (m: FromSimHost) => this.receive(m);
    const host = new MatchHost(start.map, start.opts, sinkTo(post));
    this.inThread = host;
    host.setHidden(start.hidden);
    host.onWake = (ms, ticks) => perfProbe.on && perfProbe.addSim(ms, ticks);
    // Automation hook for browser tests (give weapons, place players): the match itself, synchronously.
    host.onMatch = (match) => ((window as unknown as { __match: unknown }).__match = match);
    const early = this.early.splice(0);
    for (const m of early) if (m.k !== 'start') dispatchToHost(host, m, post);
    this.installHooks();
    host.start().catch((e: Error) => post({ k: 'failed', error: e.message }));
  }

  private fallBack(start: ToSimHost): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.snapshots = undefined;
    this.decoder = undefined;
    this.spent = [];
    this.startHere(start);
  }

  /** The test hooks this transport put on the page (installHooks): taken off when it closes. */
  private hook?: SimHook;

  private installHooks(): void {
    const transport = this;
    const hook: SimHook = {
      mode: this.thread ?? 'main',
      get backlog() {
        return transport.snapshots?.backlog ?? null;
      },
      get binary() {
        return transport.binarySnapshots;
      },
      eval: (src, arg) =>
        new Promise((resolve, reject) => {
          const req = this.nextEval++;
          this.evals.set(req, { resolve, reject });
          this.toHost({ k: 'eval', req, src, arg });
        }),
    };
    const w = window as unknown as { __sim: SimHook; __give: (id: string) => void };
    this.hook = hook;
    w.__sim = hook;
    w.__give = (id) => this.toHost({ k: 'give', id });
  }

  /** To the match: posted to the worker, called on this thread, or kept until there is a match. */
  private toHost(m: ToSimHost): void {
    if (this.stopped) return;
    if (this.worker) {
      if (!this.welcomed) this.early.push(m);
      this.worker.postMessage(m);
    } else if (this.inThread) dispatchToHost(this.inThread, m as Exclude<ToSimHost, { k: 'start' }>, (r) => this.receive(r));
    else this.early.push(m);
  }

  /** From the match. */
  private receive(m: FromSimHost): void {
    if (this.stopped) return;
    switch (m.k) {
      case 'local':
        if (this.snapshots) return this.snapshots.push(m.msg);
        return this.onMessage?.(m.msg);
      case 'snap': {
        const msg = this.decoder?.decode(m.b) ?? null;
        if (!msg) {
          // Not readable here (another version, or damaged): dropped, and the match is asked for objects instead.
          if (!this.snapRefused) {
            this.snapRefused = true;
            console.warn(`binary snapshot not read (${this.decoder?.error ?? 'not asked for'}): asking for objects`);
            this.toHost({ k: 'snapobjects' });
          }
          return;
        }
        this.binarySnapshots++;
        // Everything is read out of the buffer: it goes back to be written again.
        this.spent.push(m.b);
        if (this.spent.length >= RETURN_BUFFERS) {
          const bufs = this.spent;
          this.spent = [];
          this.worker?.postMessage({ k: 'snapbufs', bufs } satisfies ToSimHost, bufs);
        }
        if (this.snapshots) return this.snapshots.push(msg);
        return this.onMessage?.(msg);
      }
      case 'facts':
        this.facts = m.facts;
        return;
      case 'send':
        return this.links.get(m.id)?.link.send(m.text);
      case 'bytes':
        return this.links.get(m.id)?.link.sendPieces?.(m.pieces);
      case 'close': {
        const r = this.links.get(m.id);
        this.links.delete(m.id);
        if (r) window.setTimeout(() => r.link.close(), m.delay);
        return;
      }
      case 'guest': {
        const r = this.links.get(m.id);
        if (r) r.slot = m.slot;
        return;
      }
      case 'failed':
        return this.fail(`local match failed: ${m.error}`);
      case 'botdebug':
        return this.onBotDebug?.(m.f);
      case 'eval': {
        const p = this.evals.get(m.req);
        this.evals.delete(m.req);
        if (m.ok) p?.resolve(m.value);
        else p?.reject(new Error(m.error));
        return;
      }
    }
  }

  private snapRefused = false;

  private fail(reason: string): void {
    const cb = this.onClose;
    this.close();
    cb?.(reason);
  }

  /** This game's join code while it's hosted (friends' account tickets are for it); set by the session. */
  joinCode: string | null = null;
  /** Signed-in friends and how long they played (the end-of-match report on a community map: communityPlays.ts). */
  readonly plays = new PlayTracker();

  /** Signed-in friends playing now: their slot, account and since when (ms): the host's end-of-match vouch. */
  accountSlots(): { slot: number; sub: string; from: number }[] {
    return this.plays.stays().flatMap((s) => {
      const slot = this.links.get(s.id)?.slot;
      return slot === null || slot === undefined ? [] : [{ slot, sub: s.sub, from: s.from }];
    });
  }

  /** Let a friend into this match (Host game). Links arriving while the match loads wait for it (a map change brings everyone back at once). */
  accept(link: RemoteLink): void {
    // Test mode is offline only (MatchHost refuses too).
    if (this.stopped || this.testMode) return link.close();
    const id = this.nextLink++;
    this.links.set(id, { link, slot: null });
    this.toHost({ k: 'open', id, ...(link.zip ? { zip: true } : {}) });
    this.upTimer ??= window.setInterval(() => {
      for (const [lid, r] of this.links) if (r.link.connected?.()) this.toHost({ k: 'up', id: lid });
    }, LINK_UP_EVERY_MS);
    // A signed-in friend's hello carries an account ticket for our join code: check it here (the match trusts the
    // page), and hold their messages until it's checked, so the match knows their username before it lets them in.
    let held: string[] | null = null;
    let first = true;
    link.onMessage((text) => {
      if (held) return void (held.length < 64 && held.push(text));
      const ticket = first ? helloTicket(text) : null;
      first = false;
      const code = this.joinCode;
      if (!ticket || !code) return this.toHost({ k: 'msg', id, text });
      const waiting: string[] = (held = [text]);
      void checkTicket(ticket, code).then((proof) => {
        if (proof && this.links.has(id)) {
          this.toHost({ k: 'verified', id, sub: proof.sub, ...(proof.name ? { name: proof.name } : {}) });
          this.plays.joined(id, proof.sub);
        }
        held = null;
        for (const t of waiting) this.toHost({ k: 'msg', id, text: t });
      });
    });
    link.onClose(() => {
      this.plays.left(id);
      if (!this.links.delete(id)) return;
      this.toHost({ k: 'closed', id });
    });
  }

  flush(): void {
    this.snapshots?.flush();
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.toHost({ k: 'input', inputs });
  }

  sendReady(): void {
    this.toHost({ k: 'ready' });
  }

  sendSpectate(on: boolean): void {
    this.toHost({ k: 'spectate', on });
  }

  sendTeam(i?: number): void {
    this.toHost({ k: 'team', ...(i === undefined ? {} : { i }) });
  }

  sendVote(i: number): void {
    this.toHost({ k: 'vote', i });
  }

  sendOptics(op: Record<string, string>): void {
    this.toHost({ k: 'optics', op });
  }

  sendChat(x: string, team: boolean): void {
    this.toHost({ k: 'chat', x, ...(team ? { tm: 1 as const } : {}) });
  }

  /** Between matches: open the vote on these maps (the page picked them from our suite). */
  openVote(options: VoteOption[]): void {
    this.toHost({ k: 'voteopen', options });
  }

  private readonly onPageHide = () => this.sayGoodbye();

  close(): void {
    if (this.stopped) return;
    // Leaving with friends in the match (not a map change): they're told first.
    this.sayGoodbye();
    const links = [...this.links.values()].map((r) => r.link);
    // A map change's `travel`, or the goodbye, gets a moment to arrive before the links close.
    if (this.departing) window.setTimeout(() => links.forEach((l) => l.close()), 3000);
    else if (this.saidBye && links.length) window.setTimeout(() => links.forEach((l) => l.close()), 1000);
    else links.forEach((l) => l.close());
    if (typeof window.removeEventListener === 'function') window.removeEventListener('pagehide', this.onPageHide);
    window.clearInterval(this.upTimer);
    this.upTimer = undefined;
    this.links.clear();
    // The test hooks (`__sim`, `__give`, and `__match` for a match on this thread) would keep the ended match, and
    // through `onClose` its session, view and scene, alive under MapMaker or the menu (the memory probe, fix 3c).
    const w = window as unknown as { __sim?: SimHook; __give?: unknown; __match?: unknown };
    if (this.hook && w.__sim === this.hook) {
      delete w.__sim;
      delete w.__give;
    }
    if (this.inThread) delete w.__match;
    this.toHost({ k: 'stop' });
    this.stopped = true;
    this.snapshots?.clear();
    this.worker?.terminate();
    this.worker = undefined;
    this.inThread = undefined;
    if (this.onVisibility && typeof document.removeEventListener === 'function') document.removeEventListener('visibilitychange', this.onVisibility);
    for (const p of this.evals.values()) p.reject(new Error('The match ended'));
    this.evals.clear();
  }
}
