import {
  BOT_DIFFICULTIES,
  rulesForMap,
  MAX_PLAYER_SLOTS,
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_RATE,
  initPhysics,
  type BotDifficulty,
  type GameEvent,
  type MapDocument,
  type MatchRules,
  type PlayerInput,
  type ServerMessage,
} from '@chronosplit/shared';
import type { Transport } from './transport.ts';

export interface LocalMatchOptions {
  name: string;
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
    const me = match.addHuman(this.opts.name)!;
    new BotFiller(match, BOT_DIFFICULTIES[this.opts.difficulty]).rebalance(Math.min(this.opts.botFill, MAX_PLAYER_SLOTS));
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
      for (let n = 0; now >= next && n < 5; n++) {
        const s = performance.now();
        events.push(...match.step());
        if (match.tick % SNAPSHOT_INTERVAL_TICKS === 0) {
          onMessage({ t: 'snapshot', ack: me.lastSeq, me: match.privateState(me.slot), ...match.snapshot(events) });
          events = [];
        }
        const ms = performance.now() - s;
        tickTotal += ms;
        tickMax = Math.max(tickMax, ms);
        aiTotal += match.lastAiMs;
        ticks++;
        next += tickMs;
      }
      if (now - next > tickMs * 10) next = now;
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

  sendInputs(inputs: PlayerInput[]): void {
    if (inputs.length) this.queueInputs?.(inputs);
  }

  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    this.teardown?.();
  }
}
