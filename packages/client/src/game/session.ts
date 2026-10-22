import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  PhysicsWorld,
  TICK_DT,
  TICK_RATE,
  WEAPONS_BY_SLOT,
  buildMapGeometry,
  getItem,
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
import { DEFAULT_FOV, GameView, slotColor } from './view.ts';

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
  /** Pickups currently taken (hidden until they respawn). */
  private taken = new Set<string>();
  /** Weapon slot the player asked for (0 = no request). */
  private wantWeapon = 0;
  private lastWeapon = 0;

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
    this.input.onToggle.set('KeyQ', () => {
      if (this.lastWeapon && this.local?.inventory.has(this.lastWeapon)) this.requestWeapon(this.lastWeapon);
    });
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
        this.local = new LocalPlayer(new PhysicsWorld(geometry));
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
        this.interp.push(msg.tick, msg.players, msg.pr);
        this.taken = new Set(msg.pk);
        const me = msg.players.find((p) => p.s === this.slot);
        if (me && this.local) {
          if (me.alive && !this.local.alive) {
            this.input.yaw = me.yaw;
            this.input.pitch = 0;
            this.wantWeapon = 0;
          }
          this.local.reconcile(me, msg.ack, msg.me);
        }
        this.botStates = msg.players.filter((p) => p.st).map((p) => `  ${this.hud.name(p.s).padEnd(14)} ${p.st}`);
        for (const ev of msg.ev) {
          if (ev.e === 'shot') {
            if (ev.s === this.slot) {
              if (ev.hit.some((h) => h !== null)) this.hud.hit();
            } else {
              const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
              for (const to of ev.to) this.view.addTracer(from, { x: to[0], y: to[1], z: to[2] }, slotColor(ev.s));
            }
          } else if (ev.e === 'melee') {
            if (ev.s === this.slot && ev.hit !== null) this.hud.hit();
          } else if (ev.e === 'explode') {
            this.view.explosion({ x: ev.p[0], y: ev.p[1], z: ev.p[2] }, ev.r);
          } else if (ev.e === 'pickup') {
            if (ev.s === this.slot) this.hud.pickup(getItem(ev.item)?.displayName ?? 'Item');
          } else if (ev.e === 'kill') {
            this.hud.kill(ev.killer, ev.victim, ev.weapon, this.slot);
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

  private requestWeapon(slot: number): void {
    const current = this.wantWeapon || this.local?.held || 0;
    if (slot !== current) this.lastWeapon = current;
    this.wantWeapon = slot;
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
      // Weapon selection: number keys or wheel cycling through owned weapons.
      const key = this.input.takeSlotRequest();
      if (key && local.inventory.has(key)) this.requestWeapon(key);
      const wheel = this.input.takeWheel();
      if (wheel) {
        const owned = local.ownedSlots();
        const i = owned.indexOf(this.wantWeapon || local.held);
        const next = owned[(((i + wheel) % owned.length) + owned.length) % owned.length];
        if (next) this.requestWeapon(next);
      }

      this.acc += dt;
      let moving = false;
      const viewTick = Math.round(this.interp.renderTick(now));
      while (this.acc >= TICK_DT) {
        this.acc -= TICK_DT;
        const sample = this.input.sample();
        moving ||= sample.forward !== 0 || sample.right !== 0;
        const { input: cmd, shot } = local.tick(sample, this.input.yaw, this.input.pitch, this.wantWeapon, viewTick);
        this.outbox.push(cmd);
        if (shot) {
          this.view.kick(shot.def);
          for (const end of shot.ends) this.view.addTracer(local.eye, end, shot.def.view.tracer, 60);
        }
      }
      this.opts.transport.sendInputs(this.outbox.splice(0));

      const weapon = local.alive ? local.weapon : undefined;
      const zoomed = !!weapon?.view.zoomFov && this.input.zooming && local.raiseTicks === 0 && local.reloadTicks === 0;
      const fov = zoomed ? weapon!.view.zoomFov! : DEFAULT_FOV;
      this.input.sensitivityScale = fov / DEFAULT_FOV;
      this.view.setCamera(local.eye, this.input.yaw, this.input.pitch, fov);
      this.view.setViewmodel(weapon);
      const reloadFrac = weapon && local.reloadTicks > 0 ? Math.min(1, local.reloadTicks / 10, (weapon.reloadTicks - local.reloadTicks) / 10) : 0;
      this.view.updateViewmodel(dt, { moving, raise: weapon && weapon.raiseTicks ? local.raiseTicks / weapon.raiseTicks : 0, reload: reloadFrac, hidden: zoomed });
      this.hud.setScope(zoomed);
      this.hud.setHealth(local.health, local.armor, local.alive);
      this.hud.setWeapons(WEAPONS_BY_SLOT, local.inventory, local.held, local.reloadTicks > 0, local.alive);
      this.hud.setPowerups(local.speedTicks / TICK_RATE, local.damageTicks / TICK_RATE);
      this.hud.setStatus(this.phase, this.timeLeft, local.alive, this.winner);
    }
    this.view.updatePickups(this.taken, now);
    this.view.updateProjectiles(this.interp.sampleProjectiles(now));
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
