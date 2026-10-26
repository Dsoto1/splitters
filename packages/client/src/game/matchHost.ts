import {
  BOT_DIFFICULTIES,
  BROWSER_HOST_MAX_GUESTS,
  rulesForMap,
  MAX_PLAYER_SLOTS,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_RATE,
  encodeSnapshots,
  getWeapon,
  initPhysics,
  parseClientMessage,
  sanitizeName,
  weaponCode,
  type BotDifficulty,
  type CarryOver,
  type GameEvent,
  type HostCommand,
  type HostState,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
} from '@tiletrigger/shared';

export interface LocalMatchOptions {
  name: string;
  /** Character look for the local player. */
  look?: string;
  /** Total players to fill with Player Bots. */
  botFill: number;
  difficulty: BotDifficulty['id'];
  rules?: MatchRules;
  /** Scenario chains: the score and weapons the local player brings from the previous map. */
  carry?: CarryOver;
}

/** What the page reads synchronously about a match that may run elsewhere (a worker): kept up to date by the host. */
export interface HostFacts {
  state: HostState;
  rules: MatchRules;
  carry: CarryOver;
}

/** Where a MatchHost's output goes: this browser's player, and friends' links (by the id the page gave them). */
export interface MatchHostSink {
  /** A message for this browser's player. */
  local(msg: ServerMessage): void;
  /** Text for one friend's link. */
  send(id: number, text: string): void;
  /** Close a friend's link, after `delayMs` (time for a last message to arrive). */
  close(id: number, delayMs: number): void;
  /** A friend took a player's place (slot), or left (null). */
  guest(id: number, slot: number | null): void;
  /** The host settings, rules or carry-over changed. */
  facts(f: HostFacts): void;
}

/**
 * Catch-up: after a late wake the loop runs at most this many ticks at once, then
 * drops the rest of the backlog (the match runs a little behind real time instead
 * of snowballing: a slow moment must not make the next frame slower still).
 */
export const MAX_CATCH_UP_TICKS = 4;
/**
 * A background tab only wakes timers about once a second: there the loop catches
 * up to real time (up to this many ticks a wake), so the bots shooting an idle or
 * tabbed-out player keep going at full speed. Nothing renders then.
 */
export const HIDDEN_CATCH_UP_TICKS = 150;

/** How the sim loop has kept up since the last reset (perf runs read it as `globalThis.__simWake`). */
export const simWake = {
  wakes: 0,
  ticks: 0,
  maxBatch: 0,
  /** Ticks dropped to resync after falling behind. */
  dropped: 0,
  /** Time spent ticking (ms) and the slowest single wake. */
  ms: 0,
  maxWakeMs: 0,
  /** Each tick's time (ms, the step and its snapshots), the latest 20,000: perf runs read percentiles. */
  tickMs: [] as number[],
  reset(): void {
    this.wakes = this.ticks = this.maxBatch = this.dropped = this.ms = this.maxWakeMs = 0;
    this.tickMs.length = 0;
  },
};
(globalThis as unknown as { __simWake: typeof simWake }).__simWake = simWake;

type MatchModule = typeof import('@tiletrigger/shared/match');
type MatchT = InstanceType<MatchModule['Match']>;
type Combatant = NonNullable<ReturnType<MatchT['addHuman']>>;

interface Remote {
  id: number;
  slot: number | null;
  /** Messages that came before the match was running (their hello comes at once). */
  early: string[] | null;
}

/**
 * Runs the authoritative Match for this browser (offline play, MapMaker TEST,
 * Host game) and speaks the dedicated server's message protocol to the local
 * player and to friends. It knows nothing of the page: LocalTransport runs it
 * in a Web Worker (simWorker.ts), so the simulation and rendering use
 * different cores, or on the page's own thread where workers aren't available.
 */
export class MatchHost {
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private match?: MatchT;
  private me?: Combatant;
  private mod?: MatchModule;
  private control?: InstanceType<MatchModule['HostControl']>;
  private bots?: InstanceType<MatchModule['BotFiller']>;
  private remotes = new Map<number, Remote>();
  private hidden = false;
  private factsSent = '';
  /** Called with the match once it runs (the page's test hooks). */
  onMatch?: (match: MatchT, me: Combatant, mod: MatchModule) => void;
  /** Ticking time and wake count, for perf probes on the page's thread: (ms, ticks) per wake, without delivery to the local player. */
  onWake?: (ms: number, ticks: number) => void;

  constructor(
    private readonly map: MapDocument,
    private readonly opts: LocalMatchOptions,
    private readonly sink: MatchHostSink,
  ) {}

  /** Load the simulation, start the match and its loop. Resolves once the welcome has gone out. */
  async start(): Promise<void> {
    // The match module pulls in Recast; load it only when a local match starts.
    const [mod] = await Promise.all([import('@tiletrigger/shared/match'), initPhysics()]);
    await mod.initNavigation();
    if (this.stopped) return;
    const { Match, BotFiller, HostControl } = mod;
    const rules = this.opts.rules ?? rulesForMap(this.map);
    const match = new Match(this.map, rules, Math.floor(Math.random() * 1e6), { startGate: true });
    const me = match.addHuman(this.opts.name, this.opts.look)!;
    if (this.opts.carry) match.applyCarry(me, this.opts.carry);
    const bots = new BotFiller(match, BOT_DIFFICULTIES[this.opts.difficulty]);
    const control = new HostControl(match, bots, Math.min(this.opts.botFill, MAX_PLAYER_SLOTS));
    Object.assign(this, { match, me, mod, control, bots });
    bots.rebalance(control.fill);
    this.onMatch?.(match, me, mod);

    this.sink.local({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: me.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules, sc: match.scenario.fullState() });
    this.sink.local({ t: 'roster', players: match.roster() });
    this.sink.local({ t: 'host', state: control.state() });
    this.sendFacts();
    // Friends who connected before the match had loaded (after a map change, they come straight back).
    for (const r of this.remotes.values()) {
      const early = r.early ?? [];
      r.early = null;
      for (const text of early) this.message(r.id, text);
    }
    this.loop(match, me);
  }

  private loop(match: MatchT, me: Combatant): void {
    let events: GameEvent[] = [];
    const tickMs = 1000 / TICK_RATE;
    let next = performance.now();
    let statsAt = next;
    let tickTotal = 0;
    let tickMax = 0;
    let aiTotal = 0;
    let ticks = 0;
    let late = 0;
    const wake = () => {
      if (this.stopped) return;
      const now = performance.now();
      const most = this.hidden ? HIDDEN_CATCH_UP_TICKS : MAX_CATCH_UP_TICKS;
      let n = 0;
      let localMs = 0;
      const w0 = now;
      for (; now >= next && n < most; n++) {
        const s = performance.now();
        events.push(...match.step());
        if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
          const snap = match.snapshot(events);
          const l0 = performance.now();
          this.sink.local({ t: 'snapshot', ack: me.lastSeq, me: match.privateState(me.slot), ...snap });
          localMs += performance.now() - l0;
          const guests = [...this.remotes.values()].filter((r): r is Remote & { slot: number } => r.slot !== null);
          if (guests.length) {
            // Serialise the shared part once; each guest gets its own ack, private state and (big matches) nearby players.
            const texts = encodeSnapshots(snap, guests.map((r) => ({ slot: r.slot, ack: match.slots[r.slot]?.lastSeq ?? 0, me: match.privateState(r.slot) })));
            guests.forEach((r, i) => this.sink.send(r.id, texts[i]!));
          }
          events = [];
        }
        const ms = performance.now() - s;
        if (simWake.tickMs.length < 20000) simWake.tickMs.push(ms);
        tickTotal += ms;
        tickMax = Math.max(tickMax, ms);
        aiTotal += match.lastAiMs;
        ticks++;
        next += tickMs;
        if (match.tick % 30 === 0) this.sendFacts();
      }
      if (n) {
        const ms = performance.now() - w0;
        simWake.wakes++;
        simWake.ticks += n;
        simWake.maxBatch = Math.max(simWake.maxBatch, n);
        simWake.ms += ms;
        simWake.maxWakeMs = Math.max(simWake.maxWakeMs, ms);
        this.onWake?.(ms - localMs, n);
      }
      // Still behind after the most we run at once: drop the backlog and carry on from now.
      if (now - next > tickMs) {
        const behind = Math.floor((now - next) / tickMs);
        late += behind;
        simWake.dropped += behind;
        next = now;
      }
      if (now - statsAt >= 1000) {
        statsAt = now;
        const all = match.combatants();
        this.sink.local({
          t: 'stats',
          tickMsAvg: ticks ? tickTotal / ticks : 0,
          tickMsMax: tickMax,
          aiMsAvg: ticks ? aiTotal / ticks : 0,
          snapshotBytes: 0,
          bytesPerSecPerClient: 0,
          humans: all.filter((c) => c.kind === 'human').length,
          bots: all.filter((c) => c.kind === 'bot').length,
          lateTicks: late,
        });
        tickTotal = tickMax = aiTotal = ticks = late = 0;
      }
      this.timer = setTimeout(wake, Math.max(0, next - performance.now()));
    };
    wake();
  }

  /** The page's tab was hidden or shown again (a hidden tab's timers wake rarely: catch up further then). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  input(inputs: PlayerInput[]): void {
    if (this.match && this.me) this.match.queueInputs(this.me.slot, inputs);
  }

  ready(): void {
    if (this.match && this.me) this.match.ready(this.me.slot);
  }

  /** What the local player would take into the next map of a chain (score and weapons). */
  carry(): CarryOver | null {
    return this.match && this.me && !this.stopped ? this.match.carryOf(this.me) : null;
  }

  /** The match's host settings now (null before it runs). */
  hostState(): HostState | null {
    return this.stopped ? null : (this.control?.state() ?? null);
  }

  /** The host's controls (bots, skill, style, restart, end). Returns the error, if it was refused. */
  command(cmd: Exclude<HostCommand, { c: 'map' }>): string | null {
    const c = this.control;
    if (!c || this.stopped) return 'The match has not started';
    const r = c.apply(cmd);
    if (r.error) return r.error;
    if (r.notice) this.announce({ t: 'notice', text: r.notice });
    this.announce({ t: 'roster', players: c.match.roster() });
    this.announce({ t: 'host', state: c.state() });
    this.sendFacts();
    return null;
  }

  /** Go offline: every friend is told why and disconnected, and bots take their places again. */
  dropGuests(reason: string): void {
    const text = JSON.stringify({ t: 'reject', reason } satisfies ServerMessage);
    for (const r of [...this.remotes.values()]) {
      if (r.slot !== null) {
        this.sink.send(r.id, text);
        this.leave(r);
      }
      this.remotes.delete(r.id);
      // A moment for the message to get there before the link closes.
      this.sink.close(r.id, 500);
    }
    if (this.control && !this.stopped) this.announce({ t: 'roster', players: this.control.match.roster() });
  }

  /** Tell everyone something ("Changing map to …"). */
  notice(text: string): void {
    this.announce({ t: 'notice', text });
  }

  /** A friend's link opened (Host game). Before the match runs, what they say waits for it. */
  open(id: number): void {
    if (this.stopped) return this.sink.close(id, 0);
    this.remotes.set(id, { id, slot: null, early: this.match ? null : [] });
  }

  /** Text from a friend's link. */
  message(id: number, text: string): void {
    const r = this.remotes.get(id);
    const { match, bots, control } = this;
    if (!r) return;
    if (r.early || !match || !bots || !control) return void r.early?.push(text);
    const msg = parseClientMessage(text);
    if (!msg) return;
    if (msg.t === 'hello' && r.slot === null) {
      if (msg.protocol !== PROTOCOL_VERSION) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: `protocol ${msg.protocol} unsupported (host speaks ${PROTOCOL_VERSION})` }));
        return this.drop(id);
      }
      // The host's upload carries every friend's snapshots: BROWSER_HOST_MAX_GUESTS of them at most (bots fill the rest).
      if (this.guests >= BROWSER_HOST_MAX_GUESTS) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: `match full (a player-hosted game takes up to ${BROWSER_HOST_MAX_GUESTS} friends)` }));
        return this.drop(id);
      }
      // The friend takes over a bot where it stands, on the team that needs a player.
      const player = bots.join(sanitizeName(msg.name), msg.look, control.fill);
      if (!player) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: 'match full' }));
        return this.drop(id);
      }
      r.slot = player.slot;
      this.sink.guest(id, player.slot);
      this.sink.send(id, JSON.stringify({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: player.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules: match.rules, sc: match.scenario.fullState() } satisfies ServerMessage));
      this.rosterToAll();
    } else if (msg.t === 'input' && r.slot !== null) match.queueInputs(r.slot, msg.inputs);
    else if (msg.t === 'ready' && r.slot !== null) match.ready(r.slot);
    else if (msg.t === 'ping') this.sink.send(id, JSON.stringify({ t: 'pong', id: msg.id, ct: msg.ct } satisfies ServerMessage));
    // Only the host runs the match: a friend's host commands (or admin logins) are refused.
    else if ((msg.t === 'host' || msg.t === 'admin') && r.slot !== null) this.sink.send(id, JSON.stringify({ t: 'host', state: null, error: 'Only the host can change the match' } satisfies ServerMessage));
  }

  /** A friend's link closed: a bot takes their place where they were. */
  closed(id: number): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.remotes.delete(id);
    if (r.slot === null || this.stopped) return;
    this.leave(r);
    this.rosterToAll();
  }

  /** Friends playing in this match. */
  get guests(): number {
    return [...this.remotes.values()].filter((r) => r.slot !== null).length;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    this.match?.destroy();
  }

  /** Test hook: run `src` (a function's source) against the match: `(match, me, arg, module) => …`. */
  evaluate(src: string, arg?: unknown): unknown {
    if (!this.match) throw new Error('The match has not started');
    const fn = new Function(`return (${src})`)() as (m: MatchT, me: Combatant, a: unknown, mod: MatchModule) => unknown;
    return fn(this.match, this.me!, arg, this.mod!);
  }

  /** Test hook: hand the local player a weapon, full. */
  give(id: string): void {
    const me = this.me;
    if (!me) return;
    const def = getWeapon(id);
    me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 });
    me.current = weaponCode(def);
    me.raiseTicks = 0;
  }

  private drop(id: number): void {
    this.remotes.delete(id);
    this.sink.close(id, 0);
  }

  private leave(r: Remote): void {
    if (r.slot !== null && this.control && !this.stopped) this.control.bots.leave(r.slot, this.control.fill);
    r.slot = null;
    this.sink.guest(r.id, null);
  }

  private rosterToAll(): void {
    if (this.match) this.announce({ t: 'roster', players: this.match.roster() });
  }

  /** Notices, rosters and the host's settings: to this player, and (except the settings) to every friend. */
  private announce(msg: ServerMessage): void {
    this.sink.local(msg);
    if (msg.t === 'host') return;
    const text = JSON.stringify(msg);
    for (const r of this.remotes.values()) if (r.slot !== null) this.sink.send(r.id, text);
  }

  private sendFacts(): void {
    const c = this.control;
    if (!c || !this.match || !this.me || this.stopped) return;
    const facts: HostFacts = { state: c.state(), rules: this.match.rules, carry: this.match.carryOf(this.me) };
    const key = JSON.stringify(facts);
    if (key === this.factsSent) return;
    this.factsSent = key;
    this.sink.facts(facts);
  }
}

/** The page → the match host (a worker's messages; the same calls on the page's own thread). */
export type ToSimHost =
  | { k: 'start'; map: MapDocument; opts: LocalMatchOptions; hidden: boolean }
  | { k: 'input'; inputs: PlayerInput[] }
  | { k: 'ready' }
  | { k: 'cmd'; cmd: Exclude<HostCommand, { c: 'map' }> }
  | { k: 'drop'; reason: string }
  | { k: 'notice'; text: string }
  | { k: 'open'; id: number }
  | { k: 'msg'; id: number; text: string }
  | { k: 'closed'; id: number }
  | { k: 'hidden'; v: boolean }
  | { k: 'eval'; req: number; src: string; arg?: unknown }
  | { k: 'give'; id: string }
  | { k: 'stop' };

/** The match host → the page. */
export type FromSimHost =
  | { k: 'local'; msg: ServerMessage }
  | { k: 'send'; id: number; text: string }
  | { k: 'close'; id: number; delay: number }
  | { k: 'guest'; id: number; slot: number | null }
  | { k: 'facts'; facts: HostFacts }
  | { k: 'failed'; error: string }
  | { k: 'eval'; req: number; ok: boolean; value?: unknown; error?: string };

/** A sink that turns everything the host says into messages for the page. */
export function sinkTo(post: (m: FromSimHost) => void): MatchHostSink {
  return {
    local: (msg) => post({ k: 'local', msg }),
    send: (id, text) => post({ k: 'send', id, text }),
    close: (id, delay) => post({ k: 'close', id, delay }),
    guest: (id, slot) => post({ k: 'guest', id, slot }),
    facts: (facts) => post({ k: 'facts', facts }),
  };
}

/** Act on one message from the page (everything but 'start', which makes the host). */
export function dispatchToHost(host: MatchHost, m: Exclude<ToSimHost, { k: 'start' }>, post: (m: FromSimHost) => void): void {
  switch (m.k) {
    case 'input':
      return host.input(m.inputs);
    case 'ready':
      return host.ready();
    case 'cmd': {
      const error = host.command(m.cmd);
      // A refused command: the host's panel shows why (as a dedicated server would tell it).
      if (error) post({ k: 'local', msg: { t: 'host', state: host.hostState(), error } });
      return;
    }
    case 'drop':
      return host.dropGuests(m.reason);
    case 'notice':
      return host.notice(m.text);
    case 'open':
      return host.open(m.id);
    case 'msg':
      return host.message(m.id, m.text);
    case 'closed':
      return host.closed(m.id);
    case 'hidden':
      return host.setHidden(m.v);
    case 'give':
      return host.give(m.id);
    case 'eval':
      try {
        post({ k: 'eval', req: m.req, ok: true, value: host.evaluate(m.src, m.arg) });
      } catch (err) {
        post({ k: 'eval', req: m.req, ok: false, error: (err as Error).message });
      }
      return;
    case 'stop':
      return host.stop();
  }
}
