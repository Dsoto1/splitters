import {
  BOT_DIFFICULTIES,
  rulesForMap,
  MAX_PLAYER_SLOTS,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_RATE,
  getWeapon,
  initPhysics,
  parseClientMessage,
  sanitizeName,
  weaponCode,
  type BotDifficulty,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
} from '@chronosplit/shared';
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
  private teardown?: () => void;
  /** Time from start() to the welcome message, for the TEST transition budget. */
  startupMs = 0;
  /** Friends playing in this match (Host game), and the hook that lets them in once it's running. */
  private remotes = new Set<{ link: RemoteLink; slot: number | null }>();
  private admit?: (link: RemoteLink) => void;
  /** How many people can play: friends take bots' places up to the match's size. */
  get capacity(): number {
    return Math.max(1, Math.min(this.opts.botFill, MAX_PLAYER_SLOTS));
  }

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
    const [{ Match, BotFiller, initNavigation }] = await Promise.all([import('@chronosplit/shared/match'), initPhysics()]);
    await initNavigation();
    if (this.stopped) return;
    const rules = this.opts.rules ?? rulesForMap(this.map);
    const match = new Match(this.map, rules, Math.floor(Math.random() * 1e6));
    const me = match.addHuman(this.opts.name, this.opts.look)!;
    // Automation hook for browser tests (give weapons, place players).
    (window as unknown as { __match: unknown; __give: (id: string) => void }).__match = match;
    (window as unknown as { __give: (id: string) => void }).__give = (id) => {
      const def = getWeapon(id);
      me.weapons.set(weaponCode(def), { def, mag: def.magazine, reserve: def.reserveMax, alt: def.alt?.max ?? 0 });
      me.current = weaponCode(def);
      me.raiseTicks = 0;
    };
    const bots = new BotFiller(match, BOT_DIFFICULTIES[this.opts.difficulty]);
    const botFill = Math.min(this.opts.botFill, MAX_PLAYER_SLOTS);
    bots.rebalance(botFill);
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
          const bot = match.combatants().find((c) => c.kind === 'bot');
          if (match.combatants().length >= MAX_PLAYER_SLOTS && bot) match.remove(bot.slot);
          const player = match.addHuman(sanitizeName(msg.name), msg.look);
          if (!player) {
            link.send(JSON.stringify({ t: 'reject', reason: 'match full' }));
            return link.close();
          }
          r.slot = player.slot;
          bots.rebalance(botFill);
          link.send(JSON.stringify({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: player.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules, sc: match.scenario.fullState() } satisfies ServerMessage));
          rosterToAll();
        } else if (msg.t === 'input' && r.slot !== null) match.queueInputs(r.slot, msg.inputs);
        else if (msg.t === 'ping') link.send(JSON.stringify({ t: 'pong', id: msg.id, ct: msg.ct } satisfies ServerMessage));
      });
      link.onClose(() => {
        this.remotes.delete(r);
        if (r.slot === null || this.stopped) return;
        match.remove(r.slot);
        bots.rebalance(botFill);
        rosterToAll();
      });
    };
    this.queueInputs = (inputs) => match.queueInputs(me.slot, inputs);
    this.teardown = () => match.destroy();

    onMessage({ t: 'welcome', protocol: PROTOCOL_VERSION, slot: me.slot, maxSlots: MAX_PLAYER_SLOTS, tickRate: TICK_RATE, snapshotInterval: SNAPSHOT_INTERVAL_TICKS, map: this.map, rules, sc: match.scenario.fullState() });
    onMessage({ t: 'roster', players: match.roster() });
    this.startupMs = performance.now() - t0;

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
            // Serialise the shared part once; each guest gets its own ack and private state.
            const body = JSON.stringify(snap);
            for (const r of this.remotes) {
              if (r.slot === null) continue;
              const mine = match.privateState(r.slot);
              r.link.send(`{"t":"snapshot","ack":${match.slots[r.slot]?.lastSeq ?? 0},${mine ? `"me":${JSON.stringify(mine)},` : ''}${body.slice(1)}`);
            }
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

  /** Let a friend into this match (Host game). Links arriving before the match has loaded are turned away. */
  accept(link: RemoteLink): void {
    if (this.admit && !this.stopped) this.admit(link);
    else link.close();
  }

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.queueInputs?.(inputs);
  }

  close(): void {
    for (const r of this.remotes) r.link.close();
    this.remotes.clear();
    this.stopped = true;
    clearTimeout(this.timer);
    this.teardown?.();
  }
}
