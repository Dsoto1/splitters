import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  CORE_WEAPONS,
  THROWABLE_DEFS,
  predictThrow,
  mapPads,
  mountToWorld,
  viewDirection,
  type ZoneSnapshot,
  BUTTON_FIRE,
  PhysicsWorld,
  SPEED_BOOST,
  TICK_DT,
  TICK_RATE,
  weaponByCode,
  DESTRUCTIBLE_SPECS,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  isCreature,
  type CreatureKind,
  OBJECTIVE_STATES,
  mapFactions,
  mapTeams,
  isTeamMode,
  MODE_LABELS,
  NPC_ID_BASE,
  type NpcSnapshot,
  type PlayerSnapshot,
  buildMapGeometry,
  mapLiquids,
  JET,
  getItem,
  loadMap,
  pickUsable,
  type MapDocument,
  type MatchPhase,
  type PlayerInput,
  type ScoreEntry,
  type ServerMessage,
  type ServerStats,
  type MatchRules,
  PLAYER,
  getProp,
  mapTerrainMesh,
} from '@chronosplit/shared';
import type { AudioSystem } from '../audio/audio.ts';
import { BLOOD_PREF_KEY } from './bloodVisuals.ts';
import { BULLET_SPEED } from './impactVisuals.ts';
import { bindFullscreenButton, pageHoldsEscape } from '../fullscreen.ts';
import type { RendererKind } from '../engine.ts';
import { Hud } from './hud.ts';
import { MountState } from './mountState.ts';
import { ModeHud } from './modeHud.ts';
import { statusColor } from './arsenalVisuals.ts';
import { InputState, saveMousePrefs } from './input.ts';
import { Interpolator } from './interpolation.ts';
import { LocalPlayer } from './prediction.ts';
import { SessionAudio } from './sessionAudio.ts';
import { ScenarioState } from './scenarioState.ts';
import type { Transport } from './transport.ts';
import { BODIES_PREF_KEY, DEFAULT_FOV, GameView, slotColor } from './view.ts';

/** Match events that only make effects, skipped while the tab is hidden. */
const HIDDEN_SKIP = new Set(['shot', 'melee', 'arc', 'explode', 'throw']);

export interface SessionOptions {
  engine: AbstractEngine;
  rendererKind: RendererKind;
  canvas: HTMLCanvasElement;
  transport: Transport;
  audio: AudioSystem;
  /** Label for the pause menu's exit button ("Back to MapMaker", "Leave match"). */
  exitLabel: string;
  showStats: boolean;
  /** F5 leaves the match (MapMaker TEST toggles with F5). */
  exitOnF5: boolean;
  /** Called when the player leaves or the transport closes. `reason` is set for unexpected closes. */
  onExit: (reason?: string) => void;
  /** Called once the map is loaded and the first frame can render. */
  onReady?: () => void;
  /** Your character's portrait for the HUD (rendered by the menus). */
  portrait?: Promise<string>;
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
  private readonly sfx: SessionAudio;
  private readonly abort = new AbortController();
  private slot = -1;
  private local: LocalPlayer | null = null;
  private map: MapDocument | null = null;
  private scenario: ScenarioState | null = null;
  /** When each objective last changed state, for fading out finished ones on the HUD. */
  private objectiveChanged = new Map<number, number>();
  private phase: MatchPhase = 'playing';
  private timeLeft = 0;
  private scores: ScoreEntry[] = [];
  private serverStats: ServerStats | null = null;
  private winner: string | null = null;
  /** Last known health fraction of every player and NPC, for the target bar. */
  private readonly hp = new Map<number, number>();
  private rules: MatchRules | null = null;
  private outcome: 'victory' | 'defeat' | null = null;
  /** Role and faction of each NPC seen, for names and looks. */
  private npcInfo = new Map<number, { role: number; faction: number }>();
  /** Character look of each player slot (from the roster). */
  private looks = new Map<number, string>();
  private botStates: string[] = [];
  private outbox: PlayerInput[] = [];
  private showStats: boolean;
  private closed = false;
  /** Pickups currently taken (hidden until they respawn). */
  private taken = new Set<string>();
  /** Weapon slot the player asked for (0 = no request). */
  private wantWeapon = 0;
  /** Ground hazards from the latest snapshot, and your own status effects. */
  private zones: ZoneSnapshot[] = [];
  /** Turrets, sentries and vehicles, and your seat in one: [mount entity index, seat, gun heat %]. */
  private mounts?: MountState;
  private seat: [number, number, number] | null = null;
  private localStatus = 0;
  private lastWeapon = 0;
  /** Capture the Flag, King of the Hill, Elimination: flags, hill, status line, markers, announcer. */
  private modeHud: ModeHud | null = null;

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
  /** Scope sway state and breath (1 full). */
  private sway = { x: 0, y: 0, t: 0 };
  private breath = 1;
  private breathSpent = false;
  /** Smoothed eye height above the feet (crouching and prone lower it). */
  private eyeOffset: number | null = null;
  private kibPerSec = 0;

  constructor(private readonly opts: SessionOptions) {
    this.view = new GameView(opts.engine);
    this.input = new InputState(opts.canvas);
    this.sfx = new SessionAudio(opts.audio, () => this.slot);
    this.showStats = opts.showStats;
    this.input.onToggle.set('F3', () => (this.showStats = !this.showStats));
    if (opts.exitOnF5) this.input.onToggle.set('F5', () => this.exit());
    this.input.onToggle.set('KeyQ', () => {
      if (this.lastWeapon && this.local?.inventory.has(this.lastWeapon)) this.requestWeapon(this.lastWeapon);
    });
    this.hud.reset();

    const signal = this.abort.signal;
    const lock = () => {
      opts.audio.unlock();
      void opts.canvas.requestPointerLock();
    };
    opts.canvas.addEventListener('click', lock, { signal });
    $('resume').addEventListener('click', lock, { signal });
    $('exitmatch').addEventListener('click', () => this.exit(), { signal });
    $('exitmatch').textContent = opts.exitLabel;
    // Mouse sensitivity and invert, saved for next time.
    const sens = $('mouse-sens') as HTMLInputElement;
    const sensVal = $('mouse-sens-val');
    const invert = $('mouse-invert') as HTMLInputElement;
    const showMouse = () => {
      sens.value = String(this.input.mouse.sensitivity);
      sensVal.textContent = `${this.input.mouse.sensitivity.toFixed(1)}×`;
      invert.checked = this.input.mouse.invertY;
    };
    showMouse();
    const mouseChanged = () => {
      this.input.mouse = { sensitivity: Number(sens.value) || 1, invertY: invert.checked };
      saveMousePrefs(this.input.mouse);
      showMouse();
    };
    sens.addEventListener('input', mouseChanged, { signal });
    invert.addEventListener('change', mouseChanged, { signal });
    // The player's own blood switch; the map sets the colour and amount.
    const bloodBox = $('blood-toggle') as HTMLInputElement;
    bloodBox.checked = this.view.blood.enabled;
    bloodBox.addEventListener(
      'change',
      () => {
        this.view.blood.enabled = bloodBox.checked;
        try {
          localStorage.setItem(BLOOD_PREF_KEY, bloodBox.checked ? 'on' : 'off');
        } catch {
          // Private windows: the switch lasts for this match.
        }
      },
      { signal },
    );
    this.sfx.bloodOn = () => this.view.blood.on;
    // Bodies: stay all match, or sink away after a while.
    const bodiesSel = $('bodies-setting') as HTMLSelectElement;
    bodiesSel.value = this.view.bodies;
    bodiesSel.addEventListener(
      'change',
      () => {
        this.view.bodies = bodiesSel.value === 'fade' ? 'fade' : 'stay';
        try {
          localStorage.setItem(BODIES_PREF_KEY, this.view.bodies);
        } catch {
          // Private windows: the setting lasts for this match.
        }
      },
      { signal },
    );
    bindFullscreenButton($('pause-fullscreen') as HTMLButtonElement, signal);
    document.addEventListener('pointerlockchange', () => this.updatePause(), { signal });
    // A second Esc (the first one releases the pointer) leaves. In fullscreen the
    // page holds Esc (Keyboard Lock), so the first press releases the pointer here.
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code !== 'Escape') return;
        // Normally the browser's own Esc releases the mouse (in Safari the first Esc only
        // closes its banner); only when the page holds Esc in fullscreen do we release it.
        if (this.input.locked) {
          if (pageHoldsEscape()) document.exitPointerLock();
        } else if (this.local) this.exit();
      },
      { signal },
    );

    opts.transport.start(
      (m) => this.onMessage(m),
      (reason) => this.exit(reason),
    );
  }

  /**
   * Scoped sway: the sights drift in a slow figure of eight, and the drift
   * moves your real aim. Holding Shift steadies it while your breath lasts;
   * run out and it sways harder until you've recovered.
   */
  private updateScopeSway(dt: number, zoomed: boolean): void {
    const holding = zoomed && this.input.held('ShiftLeft') && !this.breathSpent;
    this.breath = Math.max(0, Math.min(1, this.breath + (holding ? -dt / 3.5 : dt / 4)));
    if (this.breath === 0) this.breathSpent = true;
    if (this.breathSpent && this.breath > 0.5) this.breathSpent = false;
    this.hud.setBreath(this.breath, this.breathSpent);
    if (!zoomed) {
      this.sway = { x: 0, y: 0, t: 0 };
      return;
    }
    const amp = 0.0035 * (holding ? 0.12 : this.breathSpent ? 2.2 : 1);
    const t = (this.sway.t += dt);
    const x = (Math.sin(t * 0.9) + Math.sin(t * 2.1) * 0.3) * amp;
    const y = Math.sin(t * 1.4) * amp * 0.75;
    // Apply only the change, so your own aiming adds on top.
    this.input.yaw += x - this.sway.x;
    this.input.pitch += y - this.sway.y;
    this.sway.x = x;
    this.sway.y = y;
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
    this.opts.audio.stopAll();
    this.modeHud?.dispose();
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
        this.rules = msg.rules;
        const teams = isTeamMode(msg.rules.mode) ? mapTeams(loaded.map, msg.rules.mode === 'core.ctf' ? 2 : (msg.rules.teamSizes?.length ?? 2)) : null;
        this.hud.setTeams(teams);
        this.hud.setModeLabel(msg.rules.mode === 'core.coop' ? 'Co-op Mission' : (MODE_LABELS[msg.rules.mode] ?? 'Deathmatch'));
        this.sfx.myTeam = () => this.hud.team(this.slot)?.id ?? null;
        this.hud.minimap.setMap(loaded.map);
        void this.opts.portrait?.then((src) => this.hud.setPortrait(src), () => undefined);
        const geometry = buildMapGeometry(loaded.map);
        this.map = loaded.map;
        this.view.buildMap(loaded.map, geometry);
        if (teams && (msg.rules.mode === 'core.ctf' || msg.rules.mode === 'core.koth' || msg.rules.mode === 'core.elim')) this.modeHud = new ModeHud(this.hud, this.view, loaded.map, teams, msg.rules.mode, () => this.slot);
        this.sfx.setMap(loaded.map);
        this.sfx.joined();
        const physics = new PhysicsWorld(geometry, mapTerrainMesh(loaded.map));
        this.local = new LocalPlayer(physics);
        this.local.pads = mapPads(loaded.map.entities);
        this.local.liquids = mapLiquids(loaded.map.entities);
        this.scenario = new ScenarioState(loaded.map, physics);
        this.mounts = new MountState(loaded.map, physics);
        this.scenario.apply(msg.sc);
        this.hud.show();
        this.hud.npcName = (id) => this.npcLook(id)?.label;
        this.updatePause();
        (window as unknown as { __cs: unknown }).__cs = { slot: this.slot, renderer: this.opts.rendererKind, local: this.local, view: this.view, input: this.input, mode: this.modeHud };
        this.opts.onReady?.();
        break;
      }
      case 'reject':
        this.exit(`rejected: ${msg.reason}`);
        break;
      case 'roster':
        this.hud.setRoster(msg.players);
        this.looks = new Map(msg.players.map((p) => [p.slot, p.look]));
        this.view.setLocalLook(this.looks.get(this.slot));
        for (const p of msg.players) this.view.characters.preload({ look: p.look });
        break;
      case 'snapshot': {
        this.phase = msg.phase;
        this.timeLeft = msg.timeLeft;
        this.scores = msg.score;
        for (const p of msg.players) this.hp.set(p.s, p.hp / PLAYER.maxHealth);
        for (const n of msg.np) this.hp.set(n[0], n[6] / 100);
        for (const n of msg.np) this.npcInfo.set(n[0], { role: n[7], faction: n[8] });
        this.interp.push(msg.tick, [...msg.players, ...msg.np.map(npcAsPlayer)], msg.pr);
        this.zones = msg.zn ?? [];
        this.mounts?.apply(msg.mt);
        this.seat = msg.me?.mo ?? null;
        if (this.local) this.local.zones = this.zones;
        this.localStatus = msg.players.find((p) => p.s === this.slot)?.fx ?? 0;
        this.taken = new Set(msg.pk);
        this.modeHud?.snapshot(msg.md);
        // Door and crate colliders first, so reconciliation replays against the same world as the server.
        this.scenario?.apply(msg.sc);
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
        let poses: ReturnType<Interpolator['sample']> | undefined;
        const posesNow = () => (poses ??= this.interp.sample());
        for (const ev of msg.ev) {
          // In a background tab nothing draws, so effects would only pile up (blood, bullets,
          // sounds) and all land at once when you come back: skip the purely visual ones.
          if (document.hidden && HIDDEN_SKIP.has(ev.e)) continue;
          if (!document.hidden) this.sfx.event(ev, posesNow, performance.now());
          this.modeHud?.event(ev);
          if (ev.e === 'shot') {
            const def = CORE_WEAPONS[ev.w];
            const mine = ev.s === this.slot;
            const eye = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
            const muzzle = mine ? null : this.view.muzzleOf(ev.s);
            const color = def?.view.tracer ?? '#ffd36b';
            const strength = Math.min(2.5, Math.max(0.6, (def?.damage ?? 20) / 25));
            ev.to.forEach((t, i) => {
              const to = { x: t[0], y: t[1], z: t[2] };
              const victim = ev.hit[i] ?? null;
              const zone = ev.z?.[i] ?? 0;
              if (victim !== null) {
                const d = { x: to.x - eye.x, y: to.y - eye.y, z: to.z - eye.z };
                const len = Math.hypot(d.x, d.y, d.z) || 1;
                this.view.pushPlayer(victim, { x: (d.x / len) * 2.5 * strength, y: zone === 1 ? 1.4 : 0.8, z: (d.z / len) * 2.5 * strength });
              }
              // Your own rounds are already in the air (drawn when you fired); only your hits land here.
              if (mine) {
                // Land the hit when your round gets there (it left the muzzle about one round trip ago).
                const dist = Math.hypot(to.x - eye.x, to.y - eye.y, to.z - eye.z);
                if (victim !== null) window.setTimeout(() => this.view.landRound({ eye, to, victim, zone, strength }), Math.max(0, (dist / BULLET_SPEED) * 1000 - 40));
                return;
              }
              this.view.shotVisual({ eye, muzzle, to, color, victim, zone, strength, def });
            });
            if (mine) {
              const hits = ev.hit.filter((h) => h !== null).length;
              if (hits) this.hud.hit(ev.z?.some((z, i) => z === 1 && ev.hit[i] !== null) ?? false);
              const target = ev.hit.find((h): h is number => h !== null && h !== undefined);
              if (target !== undefined) this.hud.showTarget(this.hud.name(target), this.hp.get(target) ?? 1, target >= NPC_ID_BASE ? '#e74c3c' : (this.hud.team(target)?.color ?? '#ff8a3d'));
            } else {
              this.view.avatarAction(ev.s, 'shoot');
              if (def && def.kind !== 'melee') this.view.remoteFlash(ev.s);
            }
          } else if (ev.e === 'melee') {
            if (ev.s === this.slot && ev.hit !== null) this.hud.hit();
            if (ev.s !== this.slot) this.view.avatarAction(ev.s, 'melee');
            const at = ev.hit !== null ? this.view.chestOf(ev.hit) : null;
            const from = this.view.chestOf(ev.s) ?? (ev.s === this.slot ? this.view.cameraPosition() : null);
            if (at && from) {
              const d = { x: at.x - from.x, y: 0, z: at.z - from.z };
              const len = Math.hypot(d.x, d.z) || 1;
              const dir = { x: d.x / len, y: 0.1, z: d.z / len };
              this.view.blood.hit(at, dir, 1.4);
              this.view.pushPlayer(ev.hit!, { x: dir.x * 4, y: 1.5, z: dir.z * 4 });
            }
          } else if (ev.e === 'arc') {
            this.view.addArc(ev.pts.map((p) => ({ x: p[0], y: p[1], z: p[2] })));
          } else if (ev.e === 'explode') {
            this.view.explosion({ x: ev.p[0], y: ev.p[1], z: ev.p[2] }, ev.r);
            this.view.blast({ x: ev.p[0], y: ev.p[1], z: ev.p[2] }, ev.r);
          } else if (ev.e === 'pickup') {
            if (ev.s === this.slot) this.hud.pickup(getItem(ev.item)?.displayName ?? 'Item');
          } else if (ev.e === 'kill') {
            this.hud.kill(ev.killer, ev.victim, ev.weapon, this.slot, !!ev.hs);
            const at = this.view.chestOf(ev.victim);
            if (at) this.view.blood.kill(at);
            if (at && ev.hs) this.view.blood.hit({ x: at.x, y: at.y + 0.55, z: at.z }, { x: 0, y: 0.6, z: 0 }, 2.2);
            if (ev.hs && ev.killer === this.slot) this.hud.headshot();
          } else if (ev.e === 'round_end') {
            this.winner = ev.team !== undefined ? (this.hud.teamById(ev.team)?.name ?? null) : ev.winner === null ? null : this.hud.name(ev.winner);
            this.outcome = ev.outcome ?? null;
          } else if (ev.e === 'round_start') {
            this.outcome = null;
            this.view.clearCorpses();
            this.npcInfo.clear();
          } else if (ev.e === 'msg') {
            this.hud.showMessage(ev.text, ev.secs);
          } else if (ev.e === 'obj') {
            this.objectiveChanged.set(ev.i, performance.now());
          } else if (ev.e === 'broken') {
            const e = this.map?.entities[ev.i];
            if (e?.kind === 'destructible') {
              const spec = DESTRUCTIBLE_SPECS[e.model];
              const h = spec.half;
              const colors: Record<string, string> = { crate: '#8a5d33', barrel: '#9c2f22', glass: '#bfe6f5', boards: '#7a5430', gas: '#d8d8d0', generator: '#5a6066' };
              this.view.debris({ x: e.position[0], y: e.position[1] + (spec.lift ?? 0) + h.y, z: e.position[2] }, colors[e.model] ?? '#8d8c86', Math.max(h.x, h.y));
            } else if (e?.kind === 'prop') {
              const def = getProp(e.model);
              this.view.breakProp(ev.i);
              if (def) this.view.debris({ x: e.position[0], y: e.position[1] + (def.size[1] * e.scale) / 2, z: e.position[2] }, def.breakable?.debris ?? '#8a5a32', Math.max(0.3, Math.min(1.2, (Math.max(...def.size) * e.scale) / 2)));
            }
          } else if (ev.e === 'throw') {
            if (ev.s !== this.slot) this.view.avatarAction(ev.s, 'throw');
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

  private npcLook(id: number): { color: string; scale: number; label: string; creature?: CreatureKind } | undefined {
    const info = this.npcInfo.get(id);
    if (!info || !this.map) return undefined;
    const faction = mapFactions(this.map)[info.faction];
    const role = NPC_ROLES[info.role] ?? 'trooper';
    return { color: faction?.color ?? '#d04a3a', scale: NPC_ROLE_SPECS[role].scale, label: `${faction?.name ?? 'Enemy'} ${NPC_ROLE_SPECS[role].label}`, ...(isCreature(role) ? { creature: role } : {}) };
  }

  /** Objectives, timers, the Use prompt and the objective marker. */
  private updateScenarioHud(local: LocalPlayer, now: number): void {
    const map = this.map;
    const sc = this.scenario;
    if (!map || !sc) return;
    type Shown = { text: string; state: 'active' | 'complete' | 'failed' | 'gone' };
    const objectives = map.logic.objectives.flatMap((o, i): Shown[] => {
      const state = OBJECTIVE_STATES[sc.objectives[i] ?? 0];
      if (state === 'active') return [{ text: o.text, state: 'active' }];
      if (state === 'complete' || state === 'failed') {
        const age = now - (this.objectiveChanged.get(i) ?? -Infinity);
        if (age < 5000) return [{ text: o.text, state: age < 4000 ? state : 'gone' }];
      }
      return [];
    });
    this.hud.setObjectives(objectives);
    this.hud.setTimers(sc.timers.map((t) => {
      const left = sc.timerLeft(t, now);
      return `${map.logic.timers[t[0]]?.name ?? 'Timer'} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }));

    // Use prompt: get out, get in, or the button or door in front of the player.
    const target = local.alive ? pickUsable(map, local.eye, this.input.yaw, this.input.pitch, (i) => sc.usable(i)) : null;
    const e = target === null ? undefined : map.entities[target];
    const enter = local.alive && !this.seat ? this.mounts?.enterable(local.state.pos) : null;
    if (local.alive && this.seat) {
      const m = this.mounts?.mounts.get(this.seat[0]);
      this.hud.setPrompt(`Get out of the ${m?.def.displayName ?? 'vehicle'}`);
    } else if (enter) {
      const seat = enter.mount.def.seats[enter.seat]!;
      const verb = seat.role === 'driver' ? (enter.mount.def.kind === 'vehicle' ? 'Drive' : 'Use') : seat.role === 'gunner' ? 'Man the gun on' : 'Ride in';
      this.hud.setPrompt(`${verb} the ${enter.mount.def.displayName}`);
    } else if (e?.kind === 'button') this.hud.setPrompt(sc.state(target!)?.[0] === 0 ? 'Not working' : e.label || 'Press', sc.state(target!)?.[0] === 0);
    else if (e?.kind === 'door') {
      const [open, locked] = sc.state(target!) ?? [0, 0];
      this.hud.setPrompt(locked ? 'Locked' : open > 50 ? 'Close' : 'Open', locked === 1);
    } else this.hud.setPrompt(null);

    // Marker for the first active objective that points at something.
    const marked = map.logic.objectives.find((o, i) => o.marker && OBJECTIVE_STATES[sc.objectives[i] ?? 0] === 'active');
    const markerEntity = marked ? map.entities.find((m) => m.id === marked.marker) : undefined;
    if (markerEntity && local.alive) {
      const p = { x: markerEntity.position[0], y: markerEntity.position[1] + 1.6, z: markerEntity.position[2] };
      const screen = this.view.project(p);
      const eye = local.eye;
      this.hud.setMarker(screen && { ...screen, dist: Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) });
    } else this.hud.setMarker(null);
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
      // Weapon selection: a number key picks that slot (again to cycle the weapons in it); the wheel steps through everything owned.
      const key = this.input.takeSlotRequest();
      if (key) {
        const inSlot = local.ownedCodes().filter((code) => weaponByCode(code)?.slot === key);
        const i = inSlot.indexOf(this.wantWeapon || local.held);
        const next = inSlot[(i + 1) % inSlot.length];
        if (next) this.requestWeapon(next);
      }
      const wheel = this.input.takeWheel();
      if (wheel) {
        const owned = local.ownedCodes();
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
        const before = { ...local.state.pos };
        const { input: cmd, shot } = local.tick(sample, this.input.yaw, this.input.pitch, this.wantWeapon, viewTick);
        this.outbox.push(cmd);
        this.sfx.localStep(local, before, local.speedTicks > 0 ? SPEED_BOOST : 1);
        const ammo = local.inventory.get(local.held);
        if (local.alive && sample.buttons & BUTTON_FIRE && ammo && ammo[0] === 0 && ammo[1] === 0 && local.weapon?.magazine) this.sfx.dryFire(now);
        if (shot) {
          this.sfx.localShot(shot.def, shot.alt);
          this.view.kick(shot.def);
          const muzzle = this.view.localMuzzle();
          const strength = Math.min(2.5, Math.max(0.6, shot.def.damage / 25));
          for (const end of shot.ends) this.view.shotVisual({ eye: local.eye, muzzle, to: end, color: shot.def.view.tracer, victim: null, zone: 0, strength, def: shot.def, local: true });
          // Recoil: the sights climb (and wander a little) with each shot.
          const recoil = !shot.alt ? shot.def.recoil : undefined;
          if (recoil?.kick) {
            this.input.pitch = Math.min(1.5, this.input.pitch + recoil.kick * (0.8 + Math.random() * 0.4));
            this.input.yaw += (Math.random() - 0.5) * recoil.kick * 0.5;
          }
        }
      }
      this.opts.transport.sendInputs(this.outbox.splice(0));
      this.sfx.localWeapon(local);
      this.opts.audio.setListener(local.eye, this.input.yaw, this.input.pitch);

      // Seated: the camera rides the vehicle (drivers watch from behind it); seat guns replace your own weapon.
      this.mounts?.smooth(dt);
      const ride = local.alive && this.seat ? this.mounts?.mounts.get(this.seat[0]) : undefined;
      const seatDef = ride?.def.seats[this.seat?.[1] ?? 0];
      const seatGun = seatDef?.weapon ? CORE_WEAPONS[seatDef.weapon] : undefined;
      const handsBusy = !!seatDef && (seatDef.role === 'driver' || !!seatDef.weapon);
      local.seatGun = seatGun ?? null;
      local.unarmed = seatDef?.role === 'driver' && !seatGun;
      const weapon = local.alive && !handsBusy ? local.weapon : undefined;
      const zoomed = !!weapon?.view.zoomFov && this.input.zooming && local.raiseTicks === 0 && local.reloadTicks === 0;
      const fov = zoomed ? weapon!.view.zoomFov! : DEFAULT_FOV;
      this.input.sensitivityScale = fov / DEFAULT_FOV;
      if (ride && seatDef) {
        const feet = mountToWorld(ride.shown.pos, ride.shown.yaw, seatDef.offset);
        const eye = { x: feet.x, y: feet.y + PLAYER.eyeHeight, z: feet.z };
        if (seatDef.role === 'driver' && ride.def.kind === 'vehicle') {
          // The chase camera swings round behind the vehicle as it turns (the mouse can still look about).
          const d = Math.atan2(Math.sin(ride.shown.yaw - this.input.yaw), Math.cos(ride.shown.yaw - this.input.yaw));
          this.input.yaw += d * Math.min(1, dt * 2.5);
          const back = viewDirection(this.input.yaw, this.input.pitch - 0.25);
          const dist = 4 + ride.def.half[2] * 1.5;
          this.view.setCamera({ x: eye.x - back.x * dist, y: eye.y - back.y * dist + 1, z: eye.z - back.z * dist }, this.input.yaw, this.input.pitch - 0.15, DEFAULT_FOV);
        } else this.view.setCamera(eye, this.input.yaw, this.input.pitch, DEFAULT_FOV);
      } else {
        // The view eases down and up as you crouch, go prone or stand.
        const eye = local.eye;
        const offset = eye.y - local.state.pos.y;
        this.eyeOffset = this.eyeOffset === null || !local.alive ? offset : this.eyeOffset + (offset - this.eyeOffset) * Math.min(1, dt * 12);
        this.view.setCamera({ x: eye.x, y: local.state.pos.y + this.eyeOffset, z: eye.z }, this.input.yaw, this.input.pitch, fov);
      }
      this.view.setViewmodel(weapon);
      const reloadFrac = weapon && local.reloadTicks > 0 ? Math.min(1, local.reloadTicks / 10, (weapon.reloadTicks - local.reloadTicks) / 10) : 0;
      this.view.updateViewmodel(dt, { moving, raise: weapon && weapon.raiseTicks ? local.raiseTicks / weapon.raiseTicks : 0, reload: reloadFrac, hidden: zoomed });
      this.hud.setScope(zoomed);
      this.updateScopeSway(dt, zoomed);
      this.hud.setHealth(local.health, local.armor, local.alive);
      this.hud.setStamina(local.state.stamina ?? 1, !!local.state.winded, local.alive, local.state.stance ?? 0);
      if (seatGun && this.seat) this.hud.setMountedGun(seatGun.displayName, this.seat[2]);
      else this.hud.setWeapons(local.inventory, local.held, local.reloadTicks > 0, local.alive, handsBusy);
      this.hud.setThrowable(local.throwable, local.alive);
      // Holding G: show where the throw will go (bounces and the blast area).
      if (this.input.throwAiming && local.alive && local.throwable && !handsBusy) {
        const spec = THROWABLE_DEFS[local.throwable.kind].projectile;
        const path = predictThrow(spec, local.state.pos, this.input.yaw, this.input.pitch, 0.12, (o, d, len) => this.view.raycastLevel(o, d, len));
        this.view.throwArc.show(path, spec.mine?.triggerRadius ?? spec.splashRadius);
      } else this.view.throwArc.hide();
      this.input.altTrigger = !!local.weapon?.alt;
      this.hud.setPowerups(local.speedTicks / TICK_RATE, local.damageTicks / TICK_RATE, local.jetFuel === null ? null : local.jetFuel / JET.max);
      this.hud.setStatus(this.phase, this.timeLeft, local.alive, this.winner, this.outcome);
      this.updateScenarioHud(local, now);
    }
    if (this.scenario) {
      this.view.scenario.apply(this.scenario.entities);
      this.view.applyPropStates(this.scenario.entities);
    }
    this.view.updatePickups(this.taken, now);
    this.view.updateProjectiles(this.interp.sampleProjectiles(now));
    this.view.updateZones(this.zones, now);
    if (this.mounts) {
      const manned = this.seat ? this.mounts.mounts.get(this.seat[0]) : undefined;
      this.hud.setVehicle(manned?.alive ? { name: manned.def.displayName, pct: manned.health } : null);
      // Health bars over damaged vehicles and turrets in sight.
      const cam = this.view.cameraPosition();
      const bars: { id: number; x: number; y: number; pct: number }[] = [];
      for (const m of this.mounts.mounts.values()) {
        if (!m.alive || m.health >= 100 || m === manned) continue;
        const top = { x: m.shown.pos.x, y: m.shown.pos.y + m.def.half[1] * 2 + 0.6, z: m.shown.pos.z };
        if (Math.hypot(top.x - cam.x, top.y - cam.y, top.z - cam.z) > 50) continue;
        const at = this.view.project(top);
        if (at) bars.push({ id: m.index, x: at.x, y: at.y, pct: m.health });
      }
      this.hud.setVehicleBars(bars);
      this.view.updateMounts(this.mounts.mounts.values(), manned?.def.kind === 'turret' ? manned.index : null);
    }
    this.hud.setStatusTint(statusColor(this.local?.alive ? this.localStatus : 0));
    const poses = this.interp.sample(now);
    this.modeHud?.frame(poses, local?.alive ? local.eye : null, this.input.yaw, now);
    this.view.updateAvatars(
      poses,
      this.slot,
      (id) => {
        const npc = this.npcLook(id);
        // About half of each squad uses the female mannequin.
        if (npc?.creature) return { creature: npc.creature };
        return npc ? { npc: { color: npc.color, scale: npc.scale, female: id % 2 === 1 } } : { look: this.looks.get(id) };
      },
      this.phase === 'intermission',
      (id) => {
        const mine = this.hud.team(this.slot);
        const theirs = id < NPC_ID_BASE ? this.hud.team(id) : undefined;
        return mine && theirs && mine.id === theirs.id ? mine.color : null;
      },
      this.mounts?.riders(),
    );
    this.sfx.remoteSteps(poses);
    this.hud.renderScoreboard(this.input.held('Tab') || this.phase === 'intermission', this.scores, this.slot);
    this.hud.setTeamScore(this.scores, this.slot, this.rules?.scoreLimit ?? 0, this.rules?.mode === 'core.coop');
    if (local) {
      // Teammates on the minimap (co-op: every player is one).
      const mine = this.hud.team(this.slot);
      const coop = this.rules?.mode === 'core.coop';
      const blips = poses
        .filter((p) => p.slot !== this.slot && p.slot < NPC_ID_BASE && p.alive && (coop || (mine && this.hud.team(p.slot)?.id === mine.id)))
        .map((p) => ({ x: p.x, z: p.z, color: coop ? '#2ecc71' : mine!.color }));
      this.hud.minimap.update(local.eye.x, local.eye.z, this.input.yaw, blips);
    }

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

/** NPCs ride the same interpolation as players; fields they don't have are zero. */
function npcAsPlayer(n: NpcSnapshot): PlayerSnapshot {
  return { s: n[0], p: [n[1], n[2], n[3]], vy: 0, g: 1, yaw: n[4], pitch: n[5], hp: n[6], ar: 0, alive: n[9], w: n[10], pu: 0 };
}
