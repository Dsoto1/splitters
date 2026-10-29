import {
  BOT_DIFFICULTIES,
  BROWSER_HOST_MAX_GUESTS,
  BROWSER_MAX_PLAYERS,
  CHECKPOINT_EVERY_SECONDS,
  STANDBY_ANSWER_SECONDS,
  handoffKey,
  isJoinCode,
  KeyedLimiter,
  rulesForMap,
  MAX_PLAYER_SLOTS,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_RATE,
  encodeSnapshots,
  SnapshotStream,
  getWeapon,
  initPhysics,
  parseClientMessage,
  sanitizeName,
  weaponCode,
  type BotDifficulty,
  type BotSet,
  type CarryOver,
  type GameEvent,
  type GameMode,
  type HostCommand,
  type RotationCommand,
  type HostState,
  type MapDocument,
  type MatchCheckpoint,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
} from '@tiletrigger/shared';
import { Zipper } from '@tiletrigger/shared/peerZip';

/** Messages kept from a friend whose link opened before the match was ready. */
const MAX_EARLY_MESSAGES = 64;

export interface LocalMatchOptions {
  name: string;
  /** The local player is signed in and `name` is their username: shown as a verified account. */
  verified?: boolean;
  /** Character look for the local player. */
  look?: string;
  /** Total players to fill with Player Bots. */
  botFill: number;
  difficulty: BotDifficulty['id'];
  /** The host's own bots (Play → Match setup → Bots, or the pause menu's Bots…), kept across map changes by the page. */
  botSet?: BotSet | null;
  rules?: MatchRules;
  /** Scenario chains: the score and weapons the local player brings from the previous map. */
  carry?: CarryOver;
  /** Browser tests' deterministic mode (testMode.ts): a fixed seed, optionally an invulnerable player. Offline only. */
  test?: { seed: number; god: boolean };
  /** Host handoff: carry on the match this checkpoint describes (the host left; this browser was its successor). */
  restore?: MatchCheckpoint;
  /** This browser's own key (`pk:…`): if the match is handed on, the next host keeps this player's place for it. */
  selfKey?: string;
}

/** The game browser listing of a hosted match, for the successor to carry on (net/handoff.ts): its name only. */
export interface HostListing {
  name: string;
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
  /** From now on, compress what goes to this friend's link (one deflate stream, shared/net/peerZip.ts). */
  compress?(id: number): void;
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
  /** Compressing friends' streams (ms), and the characters compressed. */
  zipMs: 0,
  zipChars: 0,
  /** Time spent ticking (ms) and the slowest single wake. */
  ms: 0,
  maxWakeMs: 0,
  /** Each tick's time (ms, the step and its snapshots), the latest 20,000: perf runs read percentiles. */
  tickMs: [] as number[],
  reset(): void {
    this.wakes = this.ticks = this.maxBatch = this.dropped = this.ms = this.maxWakeMs = this.zipMs = this.zipChars = 0;
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
  /** The friend's own round-trip time to us (ms), from their pings: for everyone's scoreboard. */
  rtt?: number | undefined;
  /** Delta snapshots: what this friend was last sent of each player (net/interest.ts). */
  stream: SnapshotStream;
  /** The friend's browser key (hello.pk), for a ban, and to take their place back after a dropped link. */
  pk?: string;
  /** Their account, as the page checked their ticket: their username is their name, as a verified account. */
  account?: { sub: string; name?: string };
  /** When the friend's link last sent anything (ms): a silent one is closed (FRIEND_SILENT_MS). */
  heardAt: number;
  /** The friend has loaded the match (`ready`): until then a slow machine building the map may go quiet longer. */
  loaded?: boolean;
}

/** A friend's link that sends nothing this long is closed; their place is kept for them (AWAY.holdSeconds) to reconnect. */
const FRIEND_SILENT_MS = 20_000;
/** …and one still loading the match (no `ready` yet: a slow machine building a big map can't answer meanwhile). */
const FRIEND_LOADING_SILENT_MS = 60_000;
/** Friends' joins per minute, in all: a burst of joins (many tabs at once) is refused. */
const FRIEND_JOINS_PER_MINUTE = 12;
/** Host handoff: a ready successor keeps the role at least this long (seconds) before a better connection takes it over. */
const SUCCESSOR_KEEP_SECONDS = 30;

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
  private readonly joins = new KeyedLimiter({ perMinute: FRIEND_JOINS_PER_MINUTE, burst: FRIEND_JOINS_PER_MINUTE });
  /** Browser keys the host banned (this game only). */
  private readonly banned = new Set<string>();
  private hidden = false;
  private factsSent = '';
  /**
   * The map rotation's next map (display name) and mode, set by the page that keeps the rotation: a match
   * that ends says so to everyone (round_end `up`), and the page takes everyone there after the scoreboard.
   */
  private upNext: { map: string; mode: GameMode } | null = null;
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
    const cp = this.opts.restore;
    const rules = cp?.rules ?? this.opts.rules ?? rulesForMap(this.map);
    const test = this.opts.test;
    const match = new Match(this.map, rules, test ? test.seed : Math.floor(Math.random() * 1e6), { startGate: true });
    const bots = new BotFiller(match, BOT_DIFFICULTIES[cp?.skill ?? this.opts.difficulty], { botSet: this.opts.botSet ?? null });
    const fill = Math.min(cp?.fill ?? this.opts.botFill, MAX_PLAYER_SLOTS);
    let me: Combatant;
    if (cp) {
      // Handed on: everyone where the old host's checkpoint had them (the others' places kept for them), the clock and team scores too.
      me = bots.restore(cp, fill, { name: this.opts.name, ...(this.opts.look ? { look: this.opts.look } : {}) })!;
      match.resume(cp.phase, cp.timeLeft, cp.teams);
      for (const key of cp.banned ?? []) this.banned.add(key);
      if (cp.listing) this.listing = { name: cp.listing.name };
    } else {
      me = match.addHuman(this.opts.name, this.opts.look)!;
      if (this.opts.carry) match.applyCarry(me, this.opts.carry);
    }
    me.account = !!this.opts.verified;
    if (test?.god) me.invulnerable = true;
    // Load tests (?bots=96) start past the browser's cap; the host can't raise it further.
    const control = new HostControl(match, bots, fill, 'Host', Math.max(BROWSER_MAX_PLAYERS, fill));
    Object.assign(this, { match, me, mod, control, bots });
    if (!cp) bots.rebalance(control.fill);
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
    let pingRounds = 0;
    const wake = () => {
      if (this.stopped) return;
      const now = performance.now();
      const most = this.hidden ? HIDDEN_CATCH_UP_TICKS : MAX_CATCH_UP_TICKS;
      let n = 0;
      let localMs = 0;
      const w0 = now;
      for (; now >= next && n < most; n++) {
        const s = performance.now();
        const stepped = match.step();
        // A match that ends with nowhere else to go ("Next map" logic): everyone sees where the rotation goes next.
        if (this.upNext) for (const ev of stepped) if (ev.e === 'round_end' && !ev.next) ev.up = { ...this.upNext };
        events.push(...stepped);
        if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
          const snap = match.snapshot(events);
          const l0 = performance.now();
          this.sink.local({ t: 'snapshot', ack: me.lastSeq, me: match.privateState(me.slot), ...snap });
          localMs += performance.now() - l0;
          const guests = [...this.remotes.values()].filter((r): r is Remote & { slot: number } => r.slot !== null);
          if (guests.length) {
            // Serialise the shared part once; each guest gets its own ack, private state and (big matches) nearby players.
            const texts = encodeSnapshots(snap, guests.map((r) => ({ slot: r.slot, ack: match.slots[r.slot]?.lastSeq ?? 0, me: match.privateState(r.slot), stream: r.stream })));
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
        // A new bot set swaps in a bot every quarter second (every screen builds the new characters in turn).
        const bots = this.bots;
        if (bots?.settling && match.tick % Math.round(TICK_RATE / 4) === 0 && this.control && bots.stage(this.control.fill)) {
          this.rosterToAll();
          if (!bots.settling) this.announce({ t: 'host', state: this.control.state() });
        }
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
        // Friends who went idle: a warning, then a bot plays for them until they're back; kept places that ran out; silent links.
        if (this.remotes.size || match.combatants().some((c) => c.away)) this.watchAway(match);
        // Host handoff: keep a successor named, and their checkpoint fresh.
        if (this.remotes.size || this.successor) this.tendSuccessor(match);
        // Host game, every other second: each friend's ping (the host's own is 0) for everyone's scoreboard.
        if (this.remotes.size && ++pingRounds % 2 === 0) {
          const p = [me.slot, 0, ...[...this.remotes.values()].flatMap((r) => (r.slot !== null && r.rtt !== undefined ? [r.slot, r.rtt] : []))];
          this.announce({ t: 'pings', p });
        }
      }
      this.timer = setTimeout(wake, Math.max(0, next - performance.now()));
    };
    wake();
  }

  /** Once a second: idle friends (never the host's own player), kept places, silent links. */
  private watchAway(match: MatchT): void {
    const { bots, control } = this;
    if (!bots || !control) return;
    const friends = [...this.remotes.values()].filter((r): r is Remote & { slot: number } => r.slot !== null);
    const changes = bots.watch(control.fill, new Set(friends.map((r) => r.slot)));
    for (const slot of changes.warn) {
      const r = friends.find((f) => f.slot === slot);
      if (r) this.sink.send(r.id, JSON.stringify({ t: 'notice', text: `You're idle: move or a bot plays for you in ${this.mod?.AWAY.warnSeconds ?? 15} s` } satisfies ServerMessage));
    }
    for (const slot of changes.away) this.announce({ t: 'notice', text: `${match.slots[slot]?.away?.name ?? 'A player'} is away: a bot plays for them` });
    // Idle for a long time, still connected: removed, freeing the place.
    for (const slot of changes.kick) {
      const r = friends.find((f) => f.slot === slot);
      if (!r) continue;
      const name = match.slots[slot]?.away?.name ?? 'A player';
      this.sink.send(r.id, JSON.stringify({ t: 'reject', reason: `Removed for being idle (${this.mod?.AWAY.kickMinutes ?? 10} minutes)` } satisfies ServerMessage));
      this.leave(r);
      this.remotes.delete(r.id);
      this.sink.close(r.id, 500);
      this.announce({ t: 'notice', text: `${name} was removed for being idle` });
    }
    if (changes.kick.length) this.rosterToAll();
    if (changes.away.length || changes.released.length) this.rosterToAll();
    const now = Date.now();
    // This tab slept (hidden, a phone's screen off): friends weren't silent, we weren't listening. Start their clocks again.
    // So did the page (a long stall: friends' messages reach us through it), going by its own player's inputs.
    const slept = now - this.lastWatch > 5000 || this.hidden || now - this.pageHeardAt > 5000;
    this.lastWatch = now;
    for (const r of friends) {
      if (slept) r.heardAt = now;
      else if (now - r.heardAt > (r.loaded ? FRIEND_SILENT_MS : FRIEND_LOADING_SILENT_MS)) {
        this.sink.close(r.id, 0);
        this.closed(r.id);
      }
    }
  }

  /** When watchAway last ran (ms). */
  private lastWatch = Date.now();

  /** The page's tab was hidden or shown again (a hidden tab's timers wake rarely: catch up further then). */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
  }

  /** When this browser's own player last sent inputs (ms): the page is alive and passing friends' messages on. */
  private pageHeardAt = Date.now();

  input(inputs: PlayerInput[]): void {
    this.pageHeardAt = Date.now();
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

  /** Where the map rotation goes after this match (null: nowhere, the match replays). */
  setUpNext(next: { map: string; mode: GameMode } | null): void {
    this.upNext = next;
  }

  /** The host's controls (bots, skill, style, restart, end). Returns the error, if it was refused. */
  command(cmd: Exclude<HostCommand, { c: 'map' } | RotationCommand>): string | null {
    const c = this.control;
    if (!c || this.stopped) return 'The match has not started';
    if (cmd.c === 'kick' || cmd.c === 'ban') {
      const r = [...this.remotes.values()].find((x) => x.slot === cmd.slot);
      if (!r || r.slot === null) return cmd.slot === this.me?.slot ? "You can't remove yourself" : 'Only friends who joined can be removed (bots come and go by themselves)';
      const name = this.match?.slots[r.slot]?.name ?? 'A player';
      // Host game bans last while this game runs, by the friend's browser key (weak: there is no account to hold on to here).
      if (cmd.c === 'ban' && r.pk) this.banned.add(r.pk);
      const why = cmd.reason ? `: ${cmd.reason}` : '';
      this.sink.send(r.id, JSON.stringify({ t: 'reject', reason: cmd.c === 'ban' ? `You were banned from this game${why}` : `The host removed you from the game${why}` } satisfies ServerMessage));
      this.leave(r);
      this.remotes.delete(r.id);
      this.sink.close(r.id, 500);
      this.announce({ t: 'notice', text: `${name} was ${cmd.c === 'ban' ? 'banned' : 'kicked'}` });
      this.rosterToAll();
      return null;
    }
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

  /** Tell everyone something ("Changing map to …"); `guestsOnly` when the page has shown it to its player already. */
  notice(text: string, guestsOnly = false): void {
    this.announce({ t: 'notice', text }, guestsOnly);
  }

  /** A friend's link opened (Host game). Before the match runs, what they say waits for it. */
  open(id: number, zip = false): void {
    // A test-mode match (fixed seed, maybe an invulnerable player) is offline only: nobody joins it.
    if (this.stopped || this.opts.test) return this.sink.close(id, 0);
    this.remotes.set(id, { id, slot: null, early: this.match ? null : [], stream: new SnapshotStream(), heardAt: Date.now() });
    // The friend's link compresses what it carries: here, where the match runs (a worker), not on the page.
    if (zip) this.sink.compress?.(id);
  }

  /** Text from a friend's link. */
  message(id: number, text: string): void {
    const r = this.remotes.get(id);
    const { match, bots, control } = this;
    if (!r) return;
    r.heardAt = Date.now();
    // While the match loads, a friend's first few messages wait for it (hello, ready, a ping or two); the rest are dropped.
    if (r.early || !match || !bots || !control) return void (r.early && r.early.length < MAX_EARLY_MESSAGES && r.early.push(text));
    const msg = parseClientMessage(text);
    if (!msg) return;
    if (msg.t === 'hello' && r.slot === null) {
      if (msg.protocol !== PROTOCOL_VERSION) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: `protocol ${msg.protocol} unsupported (host speaks ${PROTOCOL_VERSION})` }));
        return this.drop(id);
      }
      if (msg.pk && (this.banned.has(msg.pk) || this.banned.has(handoffKey(`pk:${msg.pk}`)))) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: 'You were banned from this game' }));
        return this.drop(id);
      }
      r.pk = msg.pk;
      // The host's upload carries every friend's snapshots: BROWSER_HOST_MAX_GUESTS of them at most (bots fill the rest).
      if (this.guests >= BROWSER_HOST_MAX_GUESTS) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: `match full (a player-hosted game takes up to ${BROWSER_HOST_MAX_GUESTS} friends)` }));
        return this.drop(id);
      }
      if (!this.joins.allow('all')) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: 'Too many people are joining right now: try again in a minute' }));
        return this.drop(id);
      }
      // Back after a dropped link: their kept place. Else the friend takes over a bot where it stands, on the team that needs a player.
      // Signed in with a username: that's their name (a verified account); else the name they typed, as a guest.
      const name = r.account?.name ?? sanitizeName(msg.name);
      const key = r.account ? `sub:${r.account.sub}` : msg.pk ? `pk:${msg.pk}` : null;
      // The same browser (or account) again: this link replaces the old one, whose place it takes back (one place per browser).
      const old = key ? [...this.remotes.values()].find((o) => o !== r && o.slot !== null && (o.account ? `sub:${o.account.sub}` : o.pk ? `pk:${o.pk}` : null) === key) : undefined;
      if (old) {
        this.remotes.delete(old.id);
        bots.hold(old.slot!, 'dropped', key, control.fill);
        this.sink.guest(old.id, null);
        this.sink.close(old.id, 0);
      }
      // A place kept by a handoff is held under the hashed key (the old host's checkpoint never carried keys themselves).
      const back = key ? (bots.reclaim(key, name) ?? bots.reclaim(handoffKey(key), name)) : null;
      const player = back ?? bots.join(name, msg.look, control.fill);
      if (!player) {
        this.sink.send(id, JSON.stringify({ t: 'reject', reason: 'match full' }));
        return this.drop(id);
      }
      r.slot = player.slot;
      player.account = !!r.account?.name;
      this.sink.guest(id, player.slot);
      this.sink.send(id, JSON.stringify({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: player.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules: match.rules, sc: match.scenario.fullState() } satisfies ServerMessage));
      if (back) this.announce({ t: 'notice', text: `${name} is back` });
      this.rosterToAll();
      // Who takes over if this host goes: everyone knows in advance.
      if (this.successorSent) this.sink.send(id, this.successorSent);
    } else if (msg.t === 'input' && r.slot !== null) {
      // An idle friend's place goes back to them the moment they play.
      if (bots.input(r.slot, msg.inputs)) {
        this.announce({ t: 'notice', text: `${match.slots[r.slot]?.name ?? 'A player'} is back` });
        this.rosterToAll();
      }
    }
    else if (msg.t === 'ready' && r.slot !== null) {
      r.loaded = true;
      match.ready(r.slot);
    }
    else if (msg.t === 'ping') {
      if (msg.rtt !== undefined) r.rtt = msg.rtt;
      this.sink.send(id, JSON.stringify({ t: 'pong', id: msg.id, ct: msg.ct } satisfies ServerMessage));
    }
    // The friend asked to stand by has opened its code: it's the successor now (nobody else can name a code).
    else if (msg.t === 'standby' && r.slot !== null) this.standingBy(r, msg.code);
    // Only the host runs the match: a friend's host commands (or admin logins) are refused.
    else if ((msg.t === 'host' || msg.t === 'admin') && r.slot !== null) this.sink.send(id, JSON.stringify({ t: 'host', state: null, error: 'Only the host can change the match' } satisfies ServerMessage));
  }

  /** A friend's link closed: a bot plays their place, kept a while for them to reconnect (or, with no key, takes it over). */
  closed(id: number): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.remotes.delete(id);
    if (r.slot === null || this.stopped || !this.control) return;
    this.control.bots.hold(r.slot, 'dropped', r.account ? `sub:${r.account.sub}` : r.pk ? `pk:${r.pk}` : null, this.control.fill);
    this.sink.guest(r.id, null);
    this.rosterToAll();
  }

  /**
   * Host handoff: the friend named to take over (asked to stand by until `code` comes back), when they were
   * asked, and since when they've been ready (their code came).
   */
  private successor: { id: number; code: string | null; askedAt: number; since: number } | null = null;
  /**
   * A friend with a clearly better connection, asked to stand by to replace a successor that is ready: the
   * successor stays named until they answer, so the match is never without one in between.
   */
  private candidate: { id: number; askedAt: number } | null = null;
  /** Friends who were asked and never answered (they aren't asked again), and everyone asked. */
  private readonly passedOver = new Set<number>();
  private readonly asked = new Set<number>();
  private checkpointAt = 0;
  /** The successor message friends were last sent ('' before any). */
  private successorSent = '';
  /** The game browser listing (the page tells us), for the successor to carry on. */
  private listing: HostListing | null = null;

  /** The page listed (or unlisted) the match in the game browser. */
  setListing(listing: HostListing | null): void {
    this.listing = listing;
  }

  /** A friend's key as the match holds places by it: their account, else their browser key. */
  private keyOf(r: Remote): string | null {
    return r.account ? `sub:${r.account.sub}` : r.pk ? `pk:${r.pk}` : null;
  }

  /**
   * Once a second with friends in: keep one of them named successor (the best connection, asked to stand
   * by first), tell everyone who it is and its code, and send it a fresh checkpoint every few seconds.
   */
  private tendSuccessor(match: MatchT): void {
    const now = Date.now();
    const friends = [...this.remotes.values()].filter((r): r is Remote & { slot: number } => r.slot !== null && !match.slots[r.slot]?.away);
    let s = this.successor;
    const current = s ? friends.find((r) => r.id === s!.id) : undefined;
    // Gone, or away (a bot plays for them): someone else.
    if (s && !current) s = null;
    // Asked and never answered: someone else, and not them again.
    if (s && !s.code && now - s.askedAt > STANDBY_ANSWER_SECONDS * 1000) {
      this.passedOver.add(s.id);
      s = null;
    }
    // A candidate gone, away or silent too long: not them again.
    let c = this.candidate;
    if (c && (!friends.some((r) => r.id === c!.id) || now - c.askedAt > STANDBY_ANSWER_SECONDS * 1000)) {
      this.passedOver.add(c.id);
      c = null;
    }
    const rtt = (r: Remote) => r.rtt ?? 999;
    const best = friends.filter((r) => !this.passedOver.has(r.id)).sort((a, b) => rtt(a) - rtt(b) || a.id - b.id)[0];
    if (!s && c) {
      // No successor any more, and someone asked already: they're the one we wait for.
      s = { id: c.id, code: null, askedAt: c.askedAt, since: 0 };
      c = null;
    } else if (!s && best) {
      s = { id: best.id, code: null, askedAt: now, since: 0 };
      this.ask(best.id);
    } else if (s?.code && current && best && !c && best.id !== s.id && rtt(best) + 80 < rtt(current) && now - s.since >= SUCCESSOR_KEEP_SECONDS * 1000) {
      // A clearly better connection takes the role over (well better, and not more often than every so often: a
      // loaded machine's pings swing by seconds). The successor stays named until the new one is ready.
      c = { id: best.id, askedAt: now };
      this.ask(best.id);
    }
    this.candidate = c;
    this.successor = s;
    this.announceSuccessor();
    if (s?.code && now - this.checkpointAt >= CHECKPOINT_EVERY_SECONDS * 1000) this.sendCheckpoint();
  }

  /**
   * A friend asked to stand by answered with its code: it's the successor now. A late answer (we'd moved on
   * to asking someone else) still counts while nobody else is ready. Friends never asked are ignored.
   */
  private standingBy(r: Remote, code: string): void {
    const s = this.successor;
    if (!this.asked.has(r.id) || r.slot === null || !isJoinCode(code)) return;
    const replacing = this.candidate?.id === r.id;
    if (s?.code && s.id !== r.id && !replacing) return;
    if (replacing) this.candidate = null;
    this.passedOver.delete(r.id);
    this.successor = { id: r.id, code, askedAt: s?.id === r.id ? s.askedAt : Date.now(), since: s?.id === r.id && s.code === code ? s.since : Date.now() };
    this.announceSuccessor();
    this.sendCheckpoint();
  }

  /** Ask a friend to stand by (open a join code of their own to take the match over on). */
  private ask(id: number): void {
    this.asked.add(id);
    this.sink.send(id, JSON.stringify({ t: 'standby' } satisfies ServerMessage));
  }

  /** Tell every friend who takes over (and where), when that changes. */
  private announceSuccessor(): void {
    const s = this.successor;
    const r = s?.code ? this.remotes.get(s.id) : undefined;
    const msg: ServerMessage = s?.code && r && r.slot !== null ? { t: 'successor', code: s.code, slot: r.slot, name: this.match?.slots[r.slot]?.name ?? 'A player' } : { t: 'successor', code: '' };
    const text = JSON.stringify(msg);
    // Nothing named yet and nothing said: nothing to take back.
    if (text === this.successorSent || (!this.successorSent && !s?.code)) return;
    this.successorSent = text;
    for (const g of this.remotes.values()) if (g.slot !== null) this.sink.send(g.id, text);
  }

  /** The match as it stands, to the successor only. */
  private sendCheckpoint(): void {
    const s = this.successor;
    const r = s ? this.remotes.get(s.id) : undefined;
    if (!s?.code || !r || r.slot === null) return;
    const cp = this.checkpoint(r.slot);
    if (!cp) return;
    this.checkpointAt = Date.now();
    this.sink.send(r.id, JSON.stringify({ t: 'checkpoint', cp } satisfies ServerMessage));
  }

  /** A checkpoint of the match for a successor at `successor` (net/handoff.ts): people by hashed key only. */
  checkpoint(successor: number | null): MatchCheckpoint | null {
    const { match, control, bots, me } = this;
    if (!match || !control || !bots || this.stopped) return null;
    const keys = new Map<number, string>();
    for (const r of this.remotes.values()) {
      const key = r.slot !== null ? this.keyOf(r) : null;
      if (key) keys.set(r.slot!, key);
    }
    const keyOf = (c: Combatant) => {
      const key = keys.get(c.slot) ?? (c === me ? this.opts.selfKey : c.away?.key) ?? null;
      return key ? handoffKey(key) : null;
    };
    const teams = match.mode ? [...match.mode.teamScores()] : undefined;
    return {
      v: 1,
      map: this.map.metadata.id,
      rules: match.rules,
      phase: match.phase,
      timeLeft: match.timeLeftSeconds(),
      fill: control.fill,
      skill: bots.skill.id,
      ...(teams?.length ? { teams } : {}),
      players: match.checkpointPlayers(keyOf, successor),
      ...(this.banned.size ? { banned: [...this.banned].map((k) => (k.startsWith('h:') ? k : handoffKey(`pk:${k}`))) } : {}),
      ...(this.listing ? { listing: { name: this.listing.name } } : {}),
    };
  }

  /** The page checked a friend's account ticket (their hello follows). */
  verified(id: number, sub: string, name?: string): void {
    const r = this.remotes.get(id);
    if (r && r.slot === null) r.account = { sub, ...(name ? { name } : {}) };
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
  private announce(msg: ServerMessage, guestsOnly = false): void {
    if (!guestsOnly) this.sink.local(msg);
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
  | { k: 'cmd'; cmd: Exclude<HostCommand, { c: 'map' } | RotationCommand> }
  /** The map rotation's next map and mode (the page keeps the rotation), for the end-of-match scoreboard. */
  | { k: 'upnext'; next: { map: string; mode: GameMode } | null }
  | { k: 'drop'; reason: string }
  | { k: 'notice'; text: string; guestsOnly?: boolean }
  /** `zip`: the link wants the compressed stream (the match host compresses it: see sinkTo). */
  | { k: 'open'; id: number; zip?: boolean }
  | { k: 'msg'; id: number; text: string }
  /** The page checked a friend's account ticket (ticketCheck.ts) before passing their hello on. */
  | { k: 'verified'; id: number; sub: string; name?: string }
  | { k: 'closed'; id: number }
  | { k: 'hidden'; v: boolean }
  /** The game browser listing changed (host handoff carries it to the successor). */
  | { k: 'listing'; listing: HostListing | null }
  | { k: 'eval'; req: number; src: string; arg?: unknown }
  | { k: 'give'; id: string }
  | { k: 'stop' }
  /** Load the simulation now, before a match is asked for (a worker started ahead of time). */
  | { k: 'warm' };

/** The match host → the page. */
export type FromSimHost =
  | { k: 'local'; msg: ServerMessage }
  | { k: 'send'; id: number; text: string }
  /** Compressed pieces for a friend's link, ready to go on the wire as they are. */
  | { k: 'bytes'; id: number; pieces: Uint8Array[] }
  | { k: 'close'; id: number; delay: number }
  | { k: 'guest'; id: number; slot: number | null }
  | { k: 'facts'; facts: HostFacts }
  | { k: 'failed'; error: string }
  | { k: 'eval'; req: number; ok: boolean; value?: unknown; error?: string };

/**
 * A sink that turns everything the host says into messages for the page. Friends' links that
 * compress get their stream compressed here, where the match runs (the sim worker): the page
 * only puts the pieces on the wire (`transfer` hands their buffers over without a copy).
 */
export function sinkTo(post: (m: FromSimHost, transfer?: Transferable[]) => void): MatchHostSink {
  const zips = new Map<number, Zipper>();
  return {
    local: (msg) => post({ k: 'local', msg }),
    send: (id, text) => {
      const zip = zips.get(id);
      if (!zip) return post({ k: 'send', id, text });
      const t0 = performance.now();
      const pieces = zip.pieces(text);
      simWake.zipMs += performance.now() - t0;
      simWake.zipChars += text.length;
      post({ k: 'bytes', id, pieces }, pieces.map((p) => p.buffer as ArrayBuffer));
    },
    compress: (id) => void zips.set(id, new Zipper()),
    close: (id, delay) => {
      zips.delete(id);
      post({ k: 'close', id, delay });
    },
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
    case 'upnext':
      return host.setUpNext(m.next);
    case 'drop':
      return host.dropGuests(m.reason);
    case 'notice':
      return host.notice(m.text, m.guestsOnly);
    case 'open':
      return host.open(m.id, m.zip);
    case 'msg':
      return host.message(m.id, m.text);
    case 'verified':
      return host.verified(m.id, m.sub, m.name);
    case 'closed':
      return host.closed(m.id);
    case 'hidden':
      return host.setHidden(m.v);
    case 'listing':
      return host.setListing(m.listing);
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
    case 'warm':
      return;
  }
}
