import {
  BOT_DIFFICULTIES,
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
import type { Transport } from './transport.ts';

/** A friend's connection to a match this browser hosts (a WebRTC data channel, or anything that moves text). */
export interface RemoteLink {
  send(text: string): void;
  onMessage(cb: (text: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

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

/**
 * Runs the authoritative Match inside the browser and speaks the same message
 * protocol as the dedicated server. Used by MapMaker TEST and offline play, so
 * "test" exercises exactly the code a hosted match runs.
 */
export class LocalTransport implements Transport {
  readonly label = 'local';
  rttMs = 0;
  bytesIn = 0;
  private stopped = false;
  private timer?: number;
  private queueInputs?: (inputs: PlayerInput[]) => void;
  private markReady?: () => void;
  private teardown?: () => void;
  private carryNow?: () => CarryOver;
  /** What the local player would take into the next map of a chain (score and weapons), or null before the match runs. */
  carry(): CarryOver | null {
    return this.stopped ? null : (this.carryNow?.() ?? null);
  }
  /** Time from start() to the welcome message, for the TEST transition budget. */
  startupMs = 0;
  /** Friends playing in this match (Host game), and the hook that lets them in once it's running. */
  private remotes = new Set<{ link: RemoteLink; slot: number | null }>();
  private admit?: (link: RemoteLink) => void;
  /** Friends who connected before the match had loaded (after a map change, they come straight back): let in once it runs. */
  private waiting: RemoteLink[] = [];
  /** The host's controls over this match (pause menu → Match): bots, skill, style, restart, end. */
  private control?: import('@tiletrigger/shared/match').HostControl;
  private announce?: (msg: ServerMessage) => void;
  /** How many people can play: friends take bots' places up to the match's size. */
  get capacity(): number {
    return Math.max(1, Math.min(this.control?.fill ?? this.opts.botFill, MAX_PLAYER_SLOTS));
  }

  /** The match's host settings now (null before it runs). */
  hostState(): HostState | null {
    return this.stopped ? null : (this.control?.state() ?? null);
  }

  /** The rules the match plays now (the host may have changed team sizes and bot style), or null before it runs. */
  liveRules(): MatchRules | null {
    return this.stopped ? null : (this.control?.match.rules ?? null);
  }

  /**
   * The host runs the match (this browser's player: offline, or Host game).
   * A map change is the session's (it restarts the match on the new map);
   * everything else happens here, live. Friends can't: their commands are refused.
   */
  host(cmd: Exclude<HostCommand, { c: 'map' }>): string | null {
    const c = this.control;
    if (!c || this.stopped) return 'The match has not started';
    const r = c.apply(cmd);
    if (r.error) return r.error;
    if (r.notice) this.announce?.({ t: 'notice', text: r.notice });
    this.announce?.({ t: 'roster', players: c.match.roster() });
    this.announce?.({ t: 'host', state: c.state() });
    return null;
  }

  /**
   * Go offline: every friend is told why and disconnected, and bots take
   * their places again (the match itself carries on).
   */
  dropGuests(reason: string): void {
    const c = this.control;
    const text = JSON.stringify({ t: 'reject', reason } satisfies ServerMessage);
    for (const r of [...this.remotes]) {
      if (r.slot !== null) {
        r.link.send(text);
        if (c && !this.stopped) c.bots.leave(r.slot, c.fill);
        r.slot = null;
      }
      this.remotes.delete(r);
      const link = r.link;
      // A moment for the message to get there before the link closes.
      window.setTimeout(() => link.close(), 500);
    }
    if (c && !this.stopped) this.announce?.({ t: 'roster', players: c.match.roster() });
  }

  /** Tell everyone the map is about to change ("Changing map to …"). */
  notice(text: string): void {
    this.announce?.({ t: 'notice', text });
  }

  /**
   * Host game, map change: friends get `travel` and reconnect by themselves
   * to the same join code, where the next match lets them in.
   */
  travelGuests(mapName: string): void {
    const text = JSON.stringify({ t: 'travel', map: mapName } satisfies ServerMessage);
    for (const r of this.remotes) if (r.slot !== null) r.link.send(text);
    this.departing = true;
  }

  /** Friends were sent `travel`: give it time to arrive before their links close. */
  private departing = false;

  /** Players connected from elsewhere (Host game). */
  get guests(): number {
    return [...this.remotes].filter((r) => r.slot !== null).length;
  }

  constructor(
    private readonly map: MapDocument,
    private readonly opts: LocalMatchOptions,
  ) {}

  start(onMessage: (m: ServerMessage) => void, onClose: (reason: string) => void): void {
    const t0 = performance.now();
    void this.run(onMessage, t0).catch((e: Error) => onClose(`local match failed: ${e.message}`));
  }

  private async run(onMessage: (m: ServerMessage) => void, t0: number): Promise<void> {
    // The match module pulls in Recast; load it only when a local match starts.
    const [{ Match, BotFiller, HostControl, initNavigation }] = await Promise.all([import('@tiletrigger/shared/match'), initPhysics()]);
    await initNavigation();
    if (this.stopped) return;
    const rules = this.opts.rules ?? rulesForMap(this.map);
    const match = new Match(this.map, rules, Math.floor(Math.random() * 1e6), { startGate: true });
    const me = match.addHuman(this.opts.name, this.opts.look)!;
    if (this.opts.carry) match.applyCarry(me, this.opts.carry);
    this.carryNow = () => match.carryOf(me);
    // Automation hook for browser tests (give weapons, place players).
    (window as unknown as { __match: unknown; __give: (id: string) => void }).__match = match;
    (window as unknown as { __give: (id: string) => void }).__give = (id) => {
      const def = getWeapon(id);
      me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 });
      me.current = weaponCode(def);
      me.raiseTicks = 0;
    };
    const bots = new BotFiller(match, BOT_DIFFICULTIES[this.opts.difficulty]);
    const control = new HostControl(match, bots, Math.min(this.opts.botFill, MAX_PLAYER_SLOTS));
    this.control = control;
    bots.rebalance(control.fill);
    // Host game: friends join like they would a dedicated server (same messages, same checks).
    const rosterToAll = () => {
      const msg: ServerMessage = { t: 'roster', players: match.roster() };
      onMessage(msg);
      const text = JSON.stringify(msg);
      for (const r of this.remotes) if (r.slot !== null) r.link.send(text);
    };
    this.admit = (link) => {
      const r = { link, slot: null as number | null };
      this.remotes.add(r);
      link.onMessage((text) => {
        const msg = parseClientMessage(text);
        if (!msg) return;
        if (msg.t === 'hello' && r.slot === null) {
          if (msg.protocol !== PROTOCOL_VERSION) {
            link.send(JSON.stringify({ t: 'reject', reason: `protocol ${msg.protocol} unsupported (host speaks ${PROTOCOL_VERSION})` }));
            return link.close();
          }
          // The friend takes over a bot where it stands, on the team that needs a player.
          const player = bots.join(sanitizeName(msg.name), msg.look, control.fill);
          if (!player) {
            link.send(JSON.stringify({ t: 'reject', reason: 'match full' }));
            return link.close();
          }
          r.slot = player.slot;
          link.send(JSON.stringify({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: player.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules: match.rules, sc: match.scenario.fullState() } satisfies ServerMessage));
          rosterToAll();
        } else if (msg.t === 'input' && r.slot !== null) match.queueInputs(r.slot, msg.inputs);
        else if (msg.t === 'ready' && r.slot !== null) match.ready(r.slot);
        else if (msg.t === 'ping') link.send(JSON.stringify({ t: 'pong', id: msg.id, ct: msg.ct } satisfies ServerMessage));
        // Only the host runs the match: a friend's host commands (or admin logins) are refused.
        else if ((msg.t === 'host' || msg.t === 'admin') && r.slot !== null) link.send(JSON.stringify({ t: 'host', state: null, error: 'Only the host can change the match' } satisfies ServerMessage));
      });
      link.onClose(() => {
        this.remotes.delete(r);
        if (r.slot === null || this.stopped) return;
        // A bot takes their place where they were.
        bots.leave(r.slot, control.fill);
        rosterToAll();
      });
    };
    // Notices, rosters and the host's settings: to this player, and (except the settings) to every friend.
    this.announce = (msg) => {
      onMessage(msg);
      if (msg.t === 'host') return;
      const text = JSON.stringify(msg);
      for (const r of this.remotes) if (r.slot !== null) r.link.send(text);
    };
    this.queueInputs = (inputs) => match.queueInputs(me.slot, inputs);
    this.markReady = () => match.ready(me.slot);
    this.teardown = () => match.destroy();

    onMessage({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: me.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules, sc: match.scenario.fullState() });
    onMessage({ t: 'roster', players: match.roster() });
    onMessage({ t: 'host', state: control.state() });
    this.startupMs = performance.now() - t0;
    // Friends who came back from a map change before the match had loaded.
    for (const link of this.waiting.splice(0)) this.admit(link);

    let events: GameEvent[] = [];
    const tickMs = 1000 / TICK_RATE;
    let next = performance.now();
    let statsAt = next;
    let tickTotal = 0;
    let tickMax = 0;
    let aiTotal = 0;
    let ticks = 0;
    const loop = () => {
      if (this.stopped) return;
      const now = performance.now();
      // A background tab only wakes us about once a second: then catch up to real time, so the
      // match (and the bots shooting an idle or tabbed-out player) keeps going at full speed.
      const hidden = document.hidden;
      for (let n = 0; now >= next && n < (hidden ? 150 : 5); n++) {
        const s = performance.now();
        events.push(...match.step());
        if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
          const snap = match.snapshot(events);
          onMessage({ t: 'snapshot', ack: me.lastSeq, me: match.privateState(me.slot), ...snap });
          if (this.remotes.size) {
            // Serialise the shared part once; each guest gets its own ack, private state and (big matches) nearby players.
            const guests = [...this.remotes].filter((r): r is { link: RemoteLink; slot: number } => r.slot !== null);
            const texts = encodeSnapshots(snap, guests.map((r) => ({ slot: r.slot, ack: match.slots[r.slot]?.lastSeq ?? 0, me: match.privateState(r.slot) })));
            guests.forEach((r, i) => r.link.send(texts[i]!));
          }
          events = [];
        }
        const ms = performance.now() - s;
        tickTotal += ms;
        tickMax = Math.max(tickMax, ms);
        aiTotal += match.lastAiMs;
        ticks++;
        next += tickMs;
      }
      if (now - next > tickMs * (hidden ? 300 : 10)) next = now;
      if (now - statsAt >= 1000) {
        statsAt = now;
        const all = match.combatants();
        onMessage({
          t: 'stats',
          tickMsAvg: ticks ? tickTotal / ticks : 0,
          tickMsMax: tickMax,
          aiMsAvg: ticks ? aiTotal / ticks : 0,
          snapshotBytes: 0,
          bytesPerSecPerClient: 0,
          humans: all.filter((c) => c.kind === 'human').length,
          bots: all.filter((c) => c.kind === 'bot').length,
          lateTicks: 0,
        });
        tickTotal = tickMax = aiTotal = ticks = 0;
      }
      this.timer = window.setTimeout(loop, Math.max(0, next - performance.now()));
    };
    loop();
  }

  /** Let a friend into this match (Host game). Links arriving while the match loads wait for it (a map change brings everyone back at once). */
  accept(link: RemoteLink): void {
    if (this.stopped) return link.close();
    if (this.admit) return this.admit(link);
    // Keep what they say meanwhile (their hello comes at once) for when they're let in.
    const early: string[] = [];
    let deliver: ((text: string) => void) | null = null;
    link.onMessage((text) => (deliver ? deliver(text) : early.push(text)));
    const held: RemoteLink = {
      send: (text) => link.send(text),
      close: () => link.close(),
      onClose: (cb) => link.onClose(cb),
      onMessage: (cb) => {
        deliver = cb;
        for (const text of early.splice(0)) cb(text);
      },
    };
    this.waiting.push(held);
    link.onClose(() => (this.waiting = this.waiting.filter((l) => l !== held)));
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.queueInputs?.(inputs);
  }

  sendReady(): void {
    this.markReady?.();
  }

  close(): void {
    if (this.stopped) return;
    const links = [...this.remotes].map((r) => r.link);
    if (this.departing) window.setTimeout(() => links.forEach((l) => l.close()), 3000);
    else links.forEach((l) => l.close());
    this.remotes.clear();
    for (const l of this.waiting.splice(0)) l.close();
    this.stopped = true;
    clearTimeout(this.timer);
    this.teardown?.();
  }
}
