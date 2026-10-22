import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  PhysicsWorld,
  TICK_DT,
  buildMapGeometry,
  getWeapon,
  loadMap,
  type MatchPhase,
  type PlayerInput,
  type ScoreEntry,
  type ServerMessage,
  type ServerStats,
} from '@chronosplit/shared';
import type { RendererKind } from '../engine.ts';
import { Hud } from './hud.ts';
import { InputState } from './input.ts';
import { Interpolator } from './interpolation.ts';
import { LocalPlayer } from './prediction.ts';
import type { Transport } from './transport.ts';
import { GameView, slotColor } from './view.ts';

export interface SessionOptions {
  engine: AbstractEngine;
  rendererKind: RendererKind;
  canvas: HTMLCanvasElement;
  transport: Transport;
  /** Label for the pause menu's exit button ("Back to MapMaker", "Leave match"). */
  exitLabel: string;
  showStats: boolean;
  /** F5 leaves the match (MapMaker TEST toggles with F5). */
  exitOnF5: boolean;
  /** Called when the player leaves or the transport closes. `reason` is set for unexpected closes. */
  onExit: (reason?: string) => void;
  /** Called once the map is loaded and the first frame can render. */
  onReady?: () => void;
}

const $ = (id: string) => document.getElementById(id)!;

/**
 * One match from the player's point of view: transport messages in, predicted
 * local movement, interpolated remote players, HUD. The same class serves
 * online play, offline bot matches and MapMaker TEST.
 */
export class GameSession {
  readonly view: GameView;
  private readonly hud = new Hud();
  private readonly input: InputState;
  private readonly interp = new Interpolator();
  private readonly abort = new AbortController();
  private slot = -1;
  private local: LocalPlayer | null = null;
  private phase: MatchPhase = 'playing';
  private timeLeft = 0;
  private scores: ScoreEntry[] = [];
  private serverStats: ServerStats | null = null;
  private winner: string | null = null;
  private botStates: string[] = [];
  private outbox: PlayerInput[] = [];
  private showStats: boolean;
  private closed = false;

  // Frame timing / instrumentation.
  private acc = 0;
  private last = performance.now();
  private frames = 0;
  private fps = 0;
  private fpsAt = performance.now();
  private frameMs = 0;
  private lastCorrections = 0;
  private correctionsPerSec = 0;
  private bytesInAt = 0;
  private kibPerSec = 0;

  constructor(private readonly opts: SessionOptions) {
    this.view = new GameView(opts.engine);
    this.input = new InputState(opts.canvas);
    this.showStats = opts.showStats;
    this.input.onToggle.set('F3', () => (this.showStats = !this.showStats));
    if (opts.exitOnF5) this.input.onToggle.set('F5', () => this.exit());
    this.hud.reset();

    const signal = this.abort.signal;
    const lock = () => void opts.canvas.requestPointerLock();
    opts.canvas.addEventListener('click', lock, { signal });
    $('resume').addEventListener('click', lock, { signal });
    $('exitmatch').addEventListener('click', () => this.exit(), { signal });
    $('exitmatch').textContent = opts.exitLabel;
    document.addEventListener('pointerlockchange', () => this.updatePause(), { signal });
    // A second Esc (the first one releases the pointer) leaves.
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Escape' && !this.input.locked && this.local) this.exit();
      },
      { signal },
    );

    opts.transport.start(
      (m) => this.onMessage(m),
      (reason) => this.exit(reason),
    );
  }

  private updatePause(): void {
    $('pause').hidden = this.input.locked || !this.local || this.closed;
  }

  exit(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.opts.transport.close();
    this.abort.abort();
    this.input.dispose();
    this.hud.hide();
    $('pause').hidden = true;
    this.view.dispose();
    this.opts.onExit(reason);
  }

  private onMessage(msg: ServerMessage): void {
    if (this.closed) return;
    switch (msg.t) {
      case 'welcome': {
        const loaded = loadMap(msg.map);
        if (!loaded.ok) {
          this.exit(`invalid map: ${loaded.issues[0]?.message}`);
          return;
        }
        this.slot = msg.slot;
        const geometry = buildMapGeometry(loaded.map);
        this.view.buildMap(loaded.map, geometry);
        this.local = new LocalPlayer(new PhysicsWorld(geometry), getWeapon(msg.rules.startingWeapon));
        this.hud.show();
        this.updatePause();
        (window as unknown as { __cs: unknown }).__cs = { slot: this.slot, renderer: this.opts.rendererKind, local: this.local };
        this.opts.onReady?.();
        break;
      }
      case 'reject':
        this.exit(`rejected: ${msg.reason}`);
        break;
      case 'roster':
        this.hud.setRoster(msg.players);
        break;
      case 'snapshot': {
        this.phase = msg.phase;
        this.timeLeft = msg.timeLeft;
        this.scores = msg.score;
        this.interp.push(msg.tick, msg.players);
        const me = msg.players.find((p) => p.s === this.slot);
        if (me && this.local) {
          if (me.alive && !this.local.alive) {
            this.input.yaw = me.yaw;
            this.input.pitch = 0;
          }
          this.local.reconcile(me, msg.ack);
        }
        this.botStates = msg.players.filter((p) => p.st).map((p) => `  ${this.hud.name(p.s).padEnd(14)} ${p.st}`);
        for (const ev of msg.ev) {
          if (ev.e === 'shot') {
            if (ev.s === this.slot) {
              if (ev.hit !== null) this.hud.hit();
            } else {
              this.view.addTracer({ x: ev.from[0], y: ev.from[1], z: ev.from[2] }, { x: ev.to[0], y: ev.to[1], z: ev.to[2] }, slotColor(ev.s));
            }
          } else if (ev.e === 'kill') {
            this.hud.kill(ev.killer, ev.victim, this.slot);
          } else if (ev.e === 'round_end') {
            this.winner = ev.winner === null ? null : this.hud.name(ev.winner);
          }
        }
        break;
      }
      case 'stats':
        this.serverStats = msg;
        break;
      case 'pong':
        break;
    }
  }

  /** Advance prediction at a fixed 60 Hz and render one frame. */
  frame(): void {
    if (this.closed) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.frameMs = now - this.last;
    this.last = now;
    const local = this.local;

    if (local) {
      this.acc += dt;
      while (this.acc >= TICK_DT) {
        this.acc -= TICK_DT;
        const { input: cmd, shotEnd } = local.tick(this.input.sample(), this.input.yaw, this.input.pitch);
        this.outbox.push(cmd);
        if (shotEnd) this.view.addTracer(local.eye, shotEnd, '#ffe08a', 60);
      }
      this.opts.transport.sendInputs(this.outbox.splice(0));
      this.view.setCamera(local.eye, this.input.yaw, this.input.pitch);
      this.hud.setHealth(local.health, local.alive);
      this.hud.setStatus(this.phase, this.timeLeft, local.alive, this.winner);
    }
    this.view.updateAvatars(this.interp.sample(now), this.slot);
    this.hud.renderScoreboard(this.input.held('Tab') || this.phase === 'intermission', this.scores, this.slot);

    this.frames++;
    if (now - this.fpsAt >= 1000) {
      const secs = (now - this.fpsAt) / 1000;
      this.fps = this.frames / secs;
      this.correctionsPerSec = ((local?.corrections ?? 0) - this.lastCorrections) / secs;
      this.lastCorrections = local?.corrections ?? 0;
      this.kibPerSec = (this.opts.transport.bytesIn - this.bytesInAt) / 1024 / secs;
      this.bytesInAt = this.opts.transport.bytesIn;
      this.frames = 0;
      this.fpsAt = now;
    }
    this.hud.renderPerf(
      this.showStats,
      {
        renderer: this.opts.rendererKind,
        match: this.opts.transport.label,
        fps: this.fps.toFixed(0),
        frame: `${this.frameMs.toFixed(1)} ms`,
        ping: `${this.opts.transport.rttMs.toFixed(0)} ms`,
        'down (client)': `${this.kibPerSec.toFixed(1)} KiB/s`,
        corrections: `${this.correctionsPerSec.toFixed(1)}/s (last ${((local?.lastCorrection ?? 0) * 100).toFixed(1)} cm)`,
        'unacked input': local?.pendingCount ?? 0,
        'active meshes': this.view.scene.getActiveMeshes().length,
        position: local ? `${local.state.pos.x.toFixed(1)}, ${local.state.pos.y.toFixed(1)}, ${local.state.pos.z.toFixed(1)}` : '-',
      },
      this.serverStats,
      this.botStates,
    );
    this.view.render();
  }
}
