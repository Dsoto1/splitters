import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  BUILT_MOUNT_BASE,
  CLASS_DEFS,
  CLASS_IDS,
  DISC_POWERS,
  DISC_POWER_LABELS,
  classesInPlay,
  QUICK_MESSAGES,
  withTrackVehicles,
  CHUTE,
  CHUTE_GLIDER,
  heightAboveGround,
  BODY_SIZES,
  bodySizeOf,
  CORE_WEAPONS,
  THROWABLE_DEFS,
  predictThrow,
  mapLadders,
  mapPads,
  mountToWorld,
  viewDirection,
  type ZoneSnapshot,
  BUTTON_FIRE,
  BUTTON_RELOAD,
  PhysicsWorld,
  SPEED_BOOST,
  TICK_DT,
  TICK_RATE,
  type CarryOver,
  weaponByCode,
  DESTRUCTIBLE_SPECS,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  isCreature,
  STREAK_REWARDS,
  matchPhysics,
  matchTeams,
  type Vec3,
  npcLookRole,
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
  getMountDef,
  getWeapon,
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
  mountDamageState,
} from '@tiletrigger/shared';
import type { AudioSystem } from '../audio/audio.ts';
import { BLOOD_PREF_KEY } from './bloodVisuals.ts';
import { BULLET_SPEED } from './impactVisuals.ts';
import { bindFullscreenButton, pageHoldsEscape } from '../fullscreen.ts';
import type { RendererKind } from '../engine.ts';
import { Hud } from './hud.ts';
import { MountState } from './mountState.ts';
import { LocalTransport } from './localTransport.ts';
import type { ScreenMarker } from './hud.ts';
import { CoverState } from './coverState.ts';
import { FortsClient } from './fortsClient.ts';
import { HOSTAGE_SLOT_BASE, ModeHud } from './modeHud.ts';
import { RaceHud } from './raceHud.ts';
import { LobbyAdvertiser, builtHub, hubAddress, hubSetting } from './hub.ts';
import { statusColor } from './arsenalVisuals.ts';
import { InputState, saveMousePrefs } from './input.ts';
import { markerSetting } from './crosshair.ts';
import { Interpolator, type RemotePose } from './interpolation.ts';
import { LocalPlayer } from './prediction.ts';
import { SessionAudio } from './sessionAudio.ts';
import { ScenarioState } from './scenarioState.ts';
import type { Transport } from './transport.ts';
import { BODIES_PREF_KEY, DEFAULT_FOV, GameView, slotColor } from './view.ts';

/** Match events that only make effects, skipped while the tab is hidden. */
/** Field of view while aiming down the sights, as a fraction of the normal one. */
const ADS_FOV = 0.72;
const HIDDEN_SKIP = new Set(['shot', 'melee', 'arc', 'explode', 'crash', 'throw']);

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
  /** An in-browser match friends can be let into (pause menu → Host game). */
  hostable?: boolean;
  /**
   * Called when the player leaves or the transport closes. `reason` is set for unexpected closes.
   * `travel`: a scenario chain moves on (a won co-op map with a next map, or the server changing map).
   */
  onExit: (reason?: string, travel?: Travel) => void;
  /** Local matches in a playlist: a co-op win moves on even without a "Next map" link. */
  chain?: boolean;
  /** Called once the map is loaded and the first frame can render. */
  onReady?: () => void;
  /** Your character's portrait for the HUD (rendered by the menus). */
  portrait?: Promise<string>;
}

/** Where a scenario chain goes next: a suite map ID (local "Next map"), or the server's new map (its name). */
export interface Travel {
  id?: string;
  map?: string;
  carry?: CarryOver;
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
  private npcInfo = new Map<number, { role: number; faction: number; size: number }>();
  /** Character look of each player slot (from the roster). */
  private looks = new Map<number, string>();

  /** A player's body scale: their look's size, unless the match plays everyone at standard size. */
  private sizeOf(slot: number): number {
    return this.rules?.bodySizes === false ? 1 : BODY_SIZES[bodySizeOf(this.looks.get(slot))].scale;
  }
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
  private covers?: CoverState;
  /** Seconds of UAV sweep left for your side: enemies show on the minimap. */
  private uav = 0;
  /** H: a camera over your shoulder, to see your own character. */
  private thirdPerson = false;
  /** The join code's registration while this match is hosted for friends. */
  private peerHost?: { close(): void; code: string };
  /** The host has a relay set up (Options → Relay), for the game browser's badge. */
  private relayOn = false;
  private tpClose = false;
  /** Your position as drawn this frame (blended between prediction ticks). */
  private drawnPos: Vec3 = { x: 0, y: 0, z: 0 };
  /** Seconds your minimap stays jammed (enemy Counter-UAV), and your kill streak. */
  private jam = 0;
  private streak = 0;
  /** Classes: whether the match has them, every player's class (CLASS_IDS index), and your own class state (PrivateState.cl). */
  private classesOn = false;
  private classOf = new Map<number, number>();
  private myClass: readonly number[] | null = null;
  /** Disc Arena: your power disc and throws left (PrivateState.dp). */
  private myDisc: readonly number[] | null = null;
  /** Team pings on screen: where, who (an enemy when `target` is set), until when. */
  private pings: { id: number; at: Vec3; target?: number; until: number; from: number }[] = [];
  private nextPingId = 1;
  private seat: [number, number, number] | null = null;
  private localStatus = 0;
  private lastWeapon = 0;
  /** Capture the Flag, King of the Hill, Elimination: flags, hill, status line, markers, announcer. */
  private modeHud: ModeHud | null = null;
  /** Fort Wars: pieces, the build-phase barrier, the Builder's ghost and panel. */
  private forts: FortsClient | null = null;
  /** Race mode's lap counter, places, next-checkpoint marker and countdown. */
  private raceHud: RaceHud | null = null;

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
  /** Camera field of view now (eases for aiming down the sights), the scope's zoom level, and how far the gun is up to the eye. */
  private fov = DEFAULT_FOV;
  private zoomLevel = 0;
  private scopedNow = false;
  private adsAmount = 0;
  private readonly markers = markerSetting();
  /** Health and armour last frame, and where the latest shot at you (or blast) came from, for the damage flash. */
  private lastHealth = 100;
  private lastArmor = 0;
  private hurtFrom: { x: number; z: number; at: number } | null = null;
  private kibPerSec = 0;

  constructor(private readonly opts: SessionOptions) {
    this.view = new GameView(opts.engine);
    this.input = new InputState(opts.canvas);
    this.sfx = new SessionAudio(opts.audio, () => this.slot);
    this.showStats = opts.showStats;
    this.input.onToggle.set('F3', () => (this.showStats = !this.showStats));
    if (opts.exitOnF5) this.input.onToggle.set('F5', () => this.exit());
    this.input.onToggle.set('Space', () => {
      if (this.local && !this.local.alive) this.spectateNext = true;
    });
    this.input.onToggle.set('KeyH', () => {
      this.thirdPerson = !this.thirdPerson;
      this.hud.pickup(this.thirdPerson ? 'Third-person view (H to go back)' : 'First-person view');
    });
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
    $('respawn-now').addEventListener(
      'click',
      () => {
        this.input.respawnQueued = true;
        lock();
      },
      { signal },
    );
    $('exitmatch').textContent = opts.exitLabel;
    // Host game: open a join code so friends' browsers can connect to this match.
    const hostBtn = $('host-game') as HTMLButtonElement;
    const hostInfo = $('host-info');
    hostBtn.hidden = !opts.hostable || !(opts.transport instanceof LocalTransport);
    hostInfo.hidden = true;
    hostBtn.textContent = 'Host game (invite friends)';
    hostBtn.disabled = false;
    hostBtn.addEventListener('click', () => void this.startHosting(hostBtn, hostInfo), { signal });
    // Public: the hosted match shows up in everyone's game browser (needs a community hub).
    const pub = $('host-public');
    const listBox = $('host-list') as HTMLInputElement;
    const listName = $('host-name') as HTMLInputElement;
    pub.hidden = hostBtn.hidden || !hubSetting();
    listBox.checked = false;
    listName.value = '';
    listBox.addEventListener('change', () => this.updateListing(), { signal });
    listName.addEventListener('change', () => this.updateListing(), { signal });
    // Mouse sensitivity and invert, saved for next time.
    const sens = $('mouse-sens') as HTMLInputElement;
    const sensVal = $('mouse-sens-val');
    const invert = $('mouse-invert') as HTMLInputElement;
    const assist = $('aim-assist') as HTMLInputElement;
    const showMouse = () => {
      assist.checked = this.input.mouse.aimAssist;
      sens.value = String(this.input.mouse.sensitivity);
      sensVal.textContent = `${this.input.mouse.sensitivity.toFixed(1)}×`;
      invert.checked = this.input.mouse.invertY;
    };
    showMouse();
    const mouseChanged = () => {
      this.input.mouse = { sensitivity: Number(sens.value) || 1, invertY: invert.checked, aimAssist: assist.checked };
      saveMousePrefs(this.input.mouse);
      showMouse();
    };
    sens.addEventListener('input', mouseChanged, { signal });
    invert.addEventListener('change', mouseChanged, { signal });
    assist.addEventListener('change', mouseChanged, { signal });
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

  /**
   * Aim assist (an option, for touchpads and controllers): when an enemy is
   * close to the crosshair and in plain sight, the sights drift onto them, a
   * little faster the closer they already are. Never through walls.
   */
  private aimAssist(eye: Vec3, dt: number, now: number): void {
    const mine = this.hud.team(this.slot)?.id;
    const coop = this.allied;
    const cone = 0.12;
    let best: { dy: number; dp: number; score: number } | null = null;
    for (const p of this.interp.sample(now)) {
      if (!p.alive || p.slot === this.slot || p.slot >= HOSTAGE_SLOT_BASE) continue;
      const npc = p.slot >= NPC_ID_BASE;
      if (!npc && (coop || (mine && this.hud.team(p.slot)?.id === mine))) continue;
      const chest = { x: p.x - eye.x, y: p.y + ((p.stance ?? 0) === 2 ? 0.3 : (p.stance ?? 0) === 1 ? 0.8 : 1.25) - eye.y, z: p.z - eye.z };
      const dist = Math.hypot(chest.x, chest.y, chest.z);
      if (dist < 1 || dist > 80) continue;
      const yaw = Math.atan2(chest.x, chest.z);
      const pitch = Math.asin(chest.y / dist);
      const dy = Math.atan2(Math.sin(yaw - this.input.yaw), Math.cos(yaw - this.input.yaw));
      const dp = pitch - this.input.pitch;
      const off = Math.hypot(dy, dp);
      if (off > cone || (best && off >= best.score)) continue;
      const dir = { x: chest.x / dist, y: chest.y / dist, z: chest.z / dist };
      const wall = this.view.raycastLevel(eye, dir, dist);
      if (wall && wall.dist < dist - 0.5) continue;
      best = { dy, dp, score: off };
    }
    if (!best) return;
    const pull = Math.min(1, dt * (2 + 4 * (1 - best.score / cone)));
    this.input.yaw += best.dy * pull;
    this.input.pitch += best.dp * pull;
  }

  private updatePause(): void {
    $('pause').hidden = this.input.locked || !this.local || this.closed;
  }

  /** Open a join code for this match and show it (with an invite link) in the pause menu. */
  private async startHosting(btn: HTMLButtonElement, info: HTMLElement): Promise<void> {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || this.peerHost) return;
    btn.disabled = true;
    btn.textContent = 'Opening a join code…';
    try {
      const peerLink = await import('./peerLink.ts');
      const { PeerHost, loadRelay, relayParams } = peerLink;
      const host = new PeerHost((link) => local.accept(link));
      this.peerHost = host;
      const code = await host.start();
      if (this.closed) return host.close();
      // A slow first answer from the hub left us without its relay: ask once more before telling anyone.
      if (!peerLink.hubRelay) await peerLink.prepareIce();
      this.relayOn = !!loadRelay() || peerLink.hubRelay;
      const q = new URLSearchParams(location.search);
      const peer = q.get('peer');
      // Friends must use the same broker: carry the hub unless it's the site's built-in one.
      const hub = hubSetting() && hubSetting() !== builtHub() ? hubSetting() : null;
      const link = `${location.origin}${location.pathname}?join=${code}${peer ? `&peer=${encodeURIComponent(peer)}` : ''}${hub ? `&hub=${encodeURIComponent(hub)}` : ''}${relayParams()}`;
      // "localhost" only works on this machine: friends need the address the game is served from.
      const onlyHere = /^(localhost|127\.|\[::1\])/.test(location.hostname);
      const hubHere = /^(\w+:\/\/)?(localhost|127\.|\[::1\])/.test(hubSetting());
      btn.hidden = true;
      info.hidden = false;
      info.innerHTML = `<div class="host-code">Join code <b>${code}</b></div><input readonly value="${link}" /><button id="host-copy">Copy invite link</button><p class="hint">Friends open the link (or Online → Join by code). They take bots' places. Your browser runs the match: keep this tab open.${peerLink.hubRelay ? ' The hub provides a relay, so friends on strict networks can connect too.' : loadRelay() ? ' The link carries your relay settings.' : ' If a friend gets &quot;couldn\'t connect&quot;, set a relay in Options and send a new link.'}</p>${hubHere ? '<p class="hint" style="color:#ffb03b">Your community hub is set to localhost, which other computers can\'t reach. Friends elsewhere: clear the hub (Online → Game browser → empty → Use) and host again. Same Wi-Fi: use your computer\'s network address for the hub.</p>' : ''}${onlyHere ? '<p class="hint" style="color:#ffb03b">This link says localhost, which only works on your computer. Friends on your network: open the game at your computer\'s network address (for example http://192.168.1.20:5173) and host from there; over the internet, host from the published site.</p>' : ''}`;
      info.querySelector('#host-copy')!.addEventListener('click', () => void navigator.clipboard?.writeText(link).then(() => this.hud.pickup('Invite link copied')));
      if (onlyHere) void this.lanInvite(info, code, link);
      this.hud.showMessage(`Hosting: join code ${code}`, 5);
      this.updateListing();
    } catch (e) {
      this.peerHost = undefined;
      btn.disabled = false;
      btn.textContent = 'Host game (invite friends)';
      this.hud.showMessage(`Couldn't host: ${(e as Error).message}`, 5);
    }
  }

  /** A dedicated server's LAN join addresses in the pause menu, to pass on to people on the same network. */
  private showLanAddresses(lan: readonly string[]): void {
    const info = $('host-info');
    info.hidden = false;
    info.replaceChildren();
    const head = document.createElement('div');
    head.className = 'host-code';
    head.textContent = 'LAN join address';
    info.append(head);
    for (const addr of lan) {
      const row = document.createElement('div');
      row.className = 'lan-address';
      const input = document.createElement('input');
      input.readOnly = true;
      input.value = addr;
      const copy = document.createElement('button');
      copy.textContent = 'Copy';
      copy.addEventListener('click', () => void navigator.clipboard?.writeText(addr).then(() => this.hud.pickup('LAN address copied')));
      row.append(input, copy);
      info.append(row);
    }
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'People on your network: Online → LAN finds this server, or paste the address under Online → Server.';
    info.append(hint);
  }

  /**
   * Host game on a page opened at localhost: a hub on this computer knows its
   * network addresses, so offer the invite link at one of those instead.
   */
  private async lanInvite(info: HTMLElement, code: string, link: string): Promise<void> {
    const hub = hubAddress();
    if (!hub) return;
    try {
      const res = await fetch(`${hub.secure ? 'https' : 'http'}://${hub.host}:${hub.port}${hub.path}lobby/lan`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      const body = res.ok ? ((await res.json()) as { addresses?: string[] }) : {};
      const ip = /^http:\/\/([\d.]+):/.exec(body.addresses?.[0] ?? '')?.[1];
      if (!ip || this.closed) return;
      const lanLink = link.replace(/^(\w+:\/\/)[^:/]+/, `$1${ip}`).replace(/([?&]hub=)[^&]*/, `$1${encodeURIComponent(`${ip}:${hub.port}`)}`);
      const row = document.createElement('div');
      row.className = 'lan-address';
      const input = document.createElement('input');
      input.readOnly = true;
      input.value = lanLink;
      const copy = document.createElement('button');
      copy.textContent = 'Copy LAN link';
      copy.addEventListener('click', () => void navigator.clipboard?.writeText(lanLink).then(() => this.hud.pickup(`LAN link for ${code} copied`)));
      row.append(input, copy);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Same network: this link uses your computer\'s network address (the game must be served there too, e.g. by the hub after pnpm build).';
      info.append(row, hint);
    } catch {
      // No hub here: the localhost warning above stands.
    }
  }

  /** Set when a chain moves on (see Travel). */
  private travel: Travel | null = null;

  /** A won co-op map in a local match: after a moment for the results, go on to the next map of the chain. */
  private chainOn(next: string | undefined): void {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || (!next && !this.opts.chain) || this.travel) return;
    this.travel = { ...(next ? { id: next } : {}) };
    const wait = Math.max(1000, ((this.rules?.intermissionTicks ?? 300) / TICK_RATE) * 1000 - 600);
    this.hud.showMessage(next ? 'Mission complete: on to the next map…' : 'Mission complete: next mission…', wait / 1000);
    window.setTimeout(() => {
      if (this.closed) return;
      this.travel!.carry = local.carry() ?? undefined;
      this.exit('travel');
    }, wait);
  }

  private advertiser?: LobbyAdvertiser;

  /** Start or stop listing the hosted match in the game browser, following the pause-menu checkbox. */
  private updateListing(): void {
    const box = $('host-list') as HTMLInputElement;
    const status = $('host-public-status');
    const local = this.opts.transport;
    const host = this.peerHost;
    if (!box.checked || !host?.code || !(local instanceof LocalTransport)) {
      this.advertiser?.stop();
      this.advertiser = undefined;
      status.textContent = box.checked ? 'Will be listed once you host (Host game above).' : 'Friends only: share the code or link.';
      return;
    }
    if (this.advertiser) return;
    const me = this.hud.name(this.slot);
    const show = () => (status.textContent = this.advertiser?.error ? `Not listed: ${this.advertiser.error}` : 'Listed: anyone can join from Online → Game browser.');
    this.advertiser = new LobbyAdvertiser(
      () => ({
        code: host.code,
        name: ($('host-name') as HTMLInputElement).value.trim() || `${me}'s game`,
        host: me,
        map: this.map?.metadata.name ?? 'Unknown map',
        mode: this.rules?.mode ?? 'core.deathmatch',
        players: 1 + local.guests,
        max: local.capacity,
        relay: this.relayOn,
      }),
      show,
    );
    this.advertiser.start();
    show();
  }

  exit(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.advertiser?.stop();
    this.peerHost?.close();
    if (document.pointerLockElement) document.exitPointerLock();
    this.opts.transport.close();
    this.abort.abort();
    this.input.dispose();
    this.opts.audio.stopAll();
    this.modeHud?.dispose();
    this.forts?.dispose();
    this.raceHud?.dispose();
    this.hud.hide();
    $('pause').hidden = true;
    this.view.dispose();
    this.opts.onExit(reason, this.travel ?? undefined);
  }

  private onMessage(msg: ServerMessage): void {
    if (this.closed) return;
    switch (msg.t) {
      case 'welcome': {
        // The race's start-grid vehicles and the track's ambient cars join the map's own mounts, as on the server.
        const loaded = loadMap(withTrackVehicles(msg.map, msg.rules));
        if (!loaded.ok) {
          this.exit(`invalid map: ${loaded.issues[0]?.message}`);
          return;
        }
        this.slot = msg.slot;
        this.rules = msg.rules;
        if (msg.lan?.length) this.showLanAddresses(msg.lan);
        const teams = isTeamMode(msg.rules.mode) ? matchTeams(loaded.map, msg.rules) : null;
        this.hud.setTeams(teams);
        this.hud.setModeLabel(msg.rules.mode === 'core.coop' ? 'Co-op Mission' : (MODE_LABELS[msg.rules.mode] ?? 'Deathmatch'));
        this.hud.waitLabel = msg.rules.mode === 'core.zombies' ? 'Down: back at the next wave' : 'Respawning…';
        // Classes: the class screen opens as you join (and whenever you're down).
        this.classesOn = classesInPlay(msg.rules);
        this.input.classCount = this.classesOn ? CLASS_IDS.length : 0;
        this.input.classMenu = this.classesOn;
        this.hud.setMapName(loaded.map.metadata.name);
        this.sfx.myTeam = () => this.hud.team(this.slot)?.id ?? null;
        this.hud.minimap.setMap(loaded.map);
        void this.opts.portrait?.then((src) => this.hud.setPortrait(src), () => undefined);
        const geometry = buildMapGeometry(loaded.map);
        this.map = loaded.map;
        this.view.buildMap(loaded.map, geometry);
        if (teams && (msg.rules.mode === 'core.ctf' || msg.rules.mode === 'core.forts' || msg.rules.mode === 'core.koth' || msg.rules.mode === 'core.elim' || msg.rules.mode === 'core.bomb' || msg.rules.mode === 'core.hostage')) this.modeHud = new ModeHud(this.hud, this.view, loaded.map, teams, msg.rules.mode, () => this.slot);
        if (msg.rules.mode === 'core.race') this.raceHud = new RaceHud(this.hud, this.view, loaded.map, () => this.slot);
        this.sfx.setMap(loaded.map);
        this.sfx.joined();
        const physics = new PhysicsWorld(geometry, mapTerrainMesh(loaded.map));
        this.local = new LocalPlayer(physics);
        this.local.pads = mapPads(loaded.map.entities);
        this.local.ladders = mapLadders(loaded.map.entities);
        this.local.scale = this.sizeOf(this.slot);
        this.local.gravity = matchPhysics(msg.rules, loaded.map).gravity;
        this.local.liquids = mapLiquids(loaded.map.entities);
        this.scenario = new ScenarioState(loaded.map, physics);
        if (this.scenario.movers.defs.length) this.local.platforms = this.scenario;
        this.mounts = new MountState(loaded.map, physics);
        this.covers = new CoverState(this.view.scene, physics, (at) => this.view.debris(at, '#b39b6b', 0.7));
        if (teams && msg.rules.mode === 'core.forts') this.forts = new FortsClient(this.view, physics, loaded.map, teams, () => this.hud.team(this.slot)?.id ?? null, this.opts.audio);
        this.scenario.apply(msg.sc);
        this.hud.show();
        this.hud.npcName = (id) => this.npcLook(id)?.label;
        this.updatePause();
        (window as unknown as { __cs: unknown }).__cs = { slot: this.slot, renderer: this.opts.rendererKind, local: this.local, view: this.view, input: this.input, mode: this.modeHud, race: () => this.raceHud?.state, transport: this.opts.transport, mounts: this.mounts, forts: this.forts, phase: () => this.phase };
        this.opts.onReady?.();
        void this.prepareMatch();
        break;
      }
      case 'reject':
        this.exit(`rejected: ${msg.reason}`);
        break;
      case 'roster':
        this.hud.setRoster(msg.players);
        this.looks = new Map(msg.players.map((p) => [p.slot, p.look]));
        this.view.setLocalLook(this.looks.get(this.slot));
        if (this.local) this.local.scale = this.sizeOf(this.slot);
        for (const p of msg.players) this.view.characters.preload({ look: p.look });
        break;
      case 'snapshot': {
        if (this.phase === 'countdown' && msg.phase === 'playing') this.hud.flashGo();
        if (msg.phase === 'countdown' && msg.timeLeft !== this.timeLeft && msg.timeLeft > 0) this.sfx.countdownBeep(false);
        if (this.phase === 'countdown' && msg.phase === 'playing') this.sfx.countdownBeep(true);
        this.phase = msg.phase;
        this.timeLeft = msg.timeLeft;
        this.scores = msg.score;
        for (const p of msg.players) this.hp.set(p.s, p.hp / PLAYER.maxHealth);
        for (const n of msg.np) this.hp.set(n[0], n[6] / 100);
        for (const n of msg.np) this.npcInfo.set(n[0], { role: n[7], faction: n[8], size: n[11] ?? 1 });
        this.interp.push(msg.tick, [...msg.players, ...msg.np.map(npcAsPlayer)], msg.pr, msg.hold);
        if (msg.ld) this.view.setLeaders(new Set(msg.ld.filter((s) => s >= 0)));
        this.zones = msg.zn ?? [];
        this.mounts?.apply(msg.mt, msg.tick);
        this.covers?.apply(msg.cv);
        this.seat = msg.me?.mo ?? null;
        this.uav = msg.me?.uv ?? 0;
        this.jam = msg.me?.jm ?? 0;
        this.streak = msg.me?.ks ?? 0;
        if (this.local) this.local.zones = this.zones;
        this.localStatus = msg.players.find((p) => p.s === this.slot)?.fx ?? 0;
        if (this.classesOn) {
          // Players held back from this snapshot (far away in a big match) keep the class they had.
          const kept = msg.hold ? [...this.classOf].filter(([slot]) => msg.hold!.includes(slot)) : [];
          this.classOf = new Map([...kept, ...msg.players.filter((p) => p.cl !== undefined).map((p): [number, number] => [p.s, p.cl!])]);
          this.hud.setClasses(msg.players);
        }
        this.myClass = msg.me?.cl ?? null;
        this.myDisc = msg.me?.dp ?? null;
        this.taken = new Set(msg.pk);
        this.modeHud?.snapshot(msg.md);
        this.forts?.apply(msg.md);
        this.raceHud?.snapshot(msg.md?.rc);
        this.zombieHud(msg.md?.zb);
        // Door and crate colliders first, so reconciliation replays against the same world as the server.
        this.scenario?.apply(msg.sc);
        const me = msg.players.find((p) => p.s === this.slot);
        if (me && this.local) {
          if (!me.alive && this.local.alive && this.classesOn) this.input.classMenu = true;
          if (me.alive && !this.local.alive) {
            this.input.yaw = me.yaw;
            this.input.pitch = 0;
            this.wantWeapon = 0;
          }
          this.local.reconcile(me, msg.ack, msg.me, msg.tick);
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
          this.raceHud?.event(ev);
          if (ev.e === 'shot') {
            const def = CORE_WEAPONS[ev.w];
            const mine = ev.s === this.slot;
            const eye = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
            const muzzle = mine ? null : this.view.muzzleOf(ev.s);
            const color = def?.view.tracer ?? '#ffd36b';
            const strength = Math.min(2.5, Math.max(0.6, (def?.damage ?? 20) / 25));
            if (def?.grapple) {
              // The rope, from the hand out to the hook.
              const t = ev.to[0];
              if (t) this.view.addBeam(muzzle ?? { x: eye.x, y: eye.y - 0.25, z: eye.z }, { x: t[0], y: t[1], z: t[2] }, color, 0.025, 450);
              continue;
            }
            ev.to.forEach((t, i) => {
              const to = { x: t[0], y: t[1], z: t[2] };
              const victim = ev.hit[i] ?? null;
              const zone = ev.z?.[i] ?? 0;
              if (victim === this.slot) this.hurtFrom = { x: eye.x, z: eye.z, at: performance.now() };
              if (victim !== null) {
                const d = { x: to.x - eye.x, y: to.y - eye.y, z: to.z - eye.z };
                const len = Math.hypot(d.x, d.y, d.z) || 1;
                this.view.pushPlayer(victim, { x: (d.x / len) * 1.4 * strength, y: zone === 1 ? 0.8 : 0.4, z: (d.z / len) * 1.4 * strength });
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
          } else if (ev.e === 'knock') {
            if (ev.s === this.slot) this.hud.hit();
          } else if (ev.e === 'arc') {
            this.view.addArc(ev.pts.map((p) => ({ x: p[0], y: p[1], z: p[2] })));
          } else if (ev.e === 'explode') {
            this.hurtFrom = { x: ev.p[0], z: ev.p[2], at: performance.now() };
            const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
            if (ev.m !== undefined) this.view.vehicleExplosion(at, ev.r);
            else this.view.explosion(at, ev.r);
            this.view.blast(at, ev.r);
            // Blasts shake the camera of anyone near: a vehicle going up is felt from much further away.
            const cam = this.view.cameraPosition();
            const reach = ev.r * (ev.m !== undefined ? 6 : 3.5);
            const near = 1 - Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) / reach;
            if (near > 0) this.view.shake(near * (ev.m !== undefined ? 0.95 : 0.6));
          } else if (ev.e === 'crash') {
            const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
            this.view.impacts.sparkBurst(at, Math.round(6 + ev.n * 18), 2 + ev.n * 5);
            const cam = this.view.cameraPosition();
            const near = 1 - Math.hypot(cam.x - at.x, cam.y - at.y, cam.z - at.z) / 12;
            if (near > 0) this.view.shake(near * ev.n * 0.6);
          } else if (ev.e === 'pickup') {
            if (ev.s === this.slot) this.hud.pickup(getItem(ev.item)?.displayName ?? 'Item');
          } else if (ev.e === 'kill') {
            this.hud.kill(ev.killer, ev.victim, ev.weapon, this.slot, !!ev.hs);
            const at = this.view.chestOf(ev.victim);
            if (at) this.view.blood.kill(at);
            if (at && ev.hs) this.view.blood.hit({ x: at.x, y: at.y + 0.55, z: at.z }, { x: 0, y: 0.6, z: 0 }, 2.2);
            if (ev.hs && ev.killer === this.slot) this.hud.headshot();
          } else if (ev.e === 'round_end') {
            if (ev.outcome === 'victory') this.chainOn(ev.next);
            this.winner = ev.team !== undefined ? (this.hud.teamById(ev.team)?.name ?? null) : ev.winner === null ? null : this.hud.name(ev.winner);
            this.outcome = ev.outcome ?? null;
          } else if (ev.e === 'round_start') {
            this.outcome = null;
            this.view.clearCorpses();
            this.npcInfo.clear();
          } else if (ev.e === 'say') {
            // Team modes: only your own team hears it.
            const mine = this.hud.team(this.slot)?.id;
            if (!ev.team || !mine || ev.team === mine) this.hud.say(ev.s, QUICK_MESSAGES[ev.m - 1] ?? '');
          } else if (ev.e === 'ping') {
            const mine = this.hud.team(this.slot)?.id;
            if (ev.team ? ev.team === mine : ev.s === this.slot) {
              // One ping per player at a time.
              this.pings = this.pings.filter((p) => p.from !== ev.s);
              this.pings.push({ id: this.nextPingId++, at: { x: ev.p[0], y: ev.p[1], z: ev.p[2] }, ...(ev.t !== undefined ? { target: ev.t } : {}), until: performance.now() + (ev.t !== undefined ? 4000 : 6000), from: ev.s });
              if (ev.s !== this.slot) this.hud.say(ev.s, ev.t !== undefined ? 'Enemy here!' : 'Look here!');
            }
          } else if (ev.e === 'streak') {
            const reward = STREAK_REWARDS[ev.r];
            if (reward) {
              const mine = this.hud.team(this.slot)?.id;
              const ally = ev.s === this.slot || (!!mine && this.hud.team(ev.s)?.id === mine);
              if (ev.s === this.slot) this.hud.showMessage(`${reward.name}! ${reward.kills} kill streak`, 3);
              else this.hud.say(ev.s, `${reward.name} (${reward.kills} kill streak)${ally ? '' : ' — enemy'}`);
            }
          } else if (ev.e === 'heal') {
            if (ev.t === this.slot) this.hud.pickup(ev.s === this.slot ? `+${ev.n} health` : `${this.hud.name(ev.s)} healed you +${ev.n}`);
            else if (ev.s === this.slot) this.hud.pickup(`Healed ${this.hud.name(ev.t)} +${ev.n}`);
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
          } else if (ev.e === 'leader') {
            const team = this.hud.teamById(ev.team);
            if (ev.a === 'lead' && ev.s === this.slot) this.hud.showMessage('You lead your team: B then 1 "Follow me!" or 7 "Hold here!" orders all its bots', 5);
            else if (ev.a === 'lead') this.hud.say(ev.s, `leads ${team?.name ?? 'the team'}`);
            else this.hud.say(ev.s, `${team?.name ?? 'Team'} leader down!${ev.n ? ` (+${ev.n} to the other side)` : ''}`);
          } else if (ev.e === 'takeover') {
            this.hud.takeover(ev.s, ev.to, ev.from, !!ev.bot);
          } else if (ev.e === 'throw') {
            if (ev.s !== this.slot) this.view.avatarAction(ev.s, 'throw');
          }
        }
        break;
      }
      case 'travel':
        // The server is changing map: reconnect to play the next one.
        this.travel = { map: msg.map };
        this.hud.showMessage(`Next map: ${msg.map}`, 3);
        this.exit('travel');
        break;
      case 'stats':
        this.serverStats = msg;
        break;
      case 'pong':
        break;
    }
  }

  /**
   * Load what the match needs before saying we're ready: everyone's characters
   * (players and bots, from the roster), the weapon models we start with and
   * can pick up, mounted guns and vehicles, and the scene's textures and
   * shaders. The server holds the countdown until every player is ready (or
   * gives up waiting), so nobody starts while others still load.
   */
  private async prepareMatch(): Promise<void> {
    const map = this.map;
    const rules = this.rules;
    if (!map || !rules) return;
    // The roster comes straight after the welcome.
    for (let i = 0; i < 40 && this.looks.size === 0; i++) await new Promise((r) => setTimeout(r, 50));
    const jobs: Promise<unknown>[] = [];
    for (const look of new Set(this.looks.values())) jobs.push(this.view.characters.preload({ look }));
    jobs.push(this.view.characters.preload({ npc: { color: '#888888', scale: 1, female: true } }));
    const models = new Set<string>();
    for (const id of rules.startingWeapons) models.add(getWeapon(id).view.model);
    for (const e of map.entities) {
      if (e.kind === 'pickup') {
        const fx = getItem(e.item)?.effect;
        if (fx?.kind === 'weapon') models.add(getWeapon(fx.weapon).view.model);
      }
      if (e.kind === 'mount') {
        const def = getMountDef(e.model);
        if (def) models.add(def.model);
      }
    }
    for (const m of models) jobs.push(this.view.models.load(m).catch(() => undefined));
    let done = 0;
    const total = jobs.length + 2;
    const tick = () => this.hud.setLoading(`Loading ${map.metadata.name}`, ++done / total);
    this.hud.setLoading(`Loading ${map.metadata.name}`, 0);
    const all = Promise.all([...jobs.map((j) => j.then(tick, tick)), this.view.scene.whenReadyAsync().then(tick, tick), this.view.city.ready.then(tick, tick)]);
    // Never stall the start on one slow file.
    await Promise.race([all, new Promise((r) => setTimeout(r, 25000))]);
    if (this.closed) return;
    this.hud.setLoading(null);
    this.opts.transport.sendReady();
  }

  /** Everyone on one side against NPCs (co-op missions and Zombies). */
  private get allied(): boolean {
    return this.rules?.mode === 'core.coop' || this.rules?.mode === 'core.zombies';
  }

  /** Zombies: the wave and how many are left (or the countdown to the next wave) under the mode name. */
  private zombieHud(zb: [number, number, number, number] | undefined): void {
    if (!zb) return;
    const [wave, left, wait, best] = zb;
    const record = best > wave ? ` · best ${best}` : '';
    this.hud.setModeLabel(wave === 0 ? `Zombies · first wave in ${wait}s` : wait > 0 ? `Zombies · wave ${wave + 1} in ${wait}s${record}` : `Zombies · wave ${wave} · ${left} left${record}`);
  }

  /** Classes: which classes are at the limit on your side (the server refuses them). */
  private classesFull(): boolean[] {
    const limit = this.rules?.classLimit ?? 0;
    const mine = this.hud.team(this.slot)?.id;
    return CLASS_IDS.map((_, i) => {
      if (!limit || this.myClass?.[0] === i) return false;
      let n = 0;
      for (const [slot, cl] of this.classOf) if (slot !== this.slot && cl === i && (!mine || this.hud.team(slot)?.id === mine)) n++;
      return n >= limit;
    });
  }

  /** Your class and its ability (G), and a power disc you hold, for the HUD. */
  private classStatusLines(): { text: string; color: string }[] {
    const out: { text: string; color: string }[] = [];
    const disc = this.myDisc;
    if (disc) out.push({ text: `${DISC_POWER_LABELS[DISC_POWERS[disc[0]!] ?? 'fast'].toUpperCase()} ×${disc[1]}`, color: '#5ff2ff' });
    const cl = this.myClass;
    if (!cl) return out;
    const def = CLASS_DEFS[CLASS_IDS[cl[0]!] ?? 'rocketeer'];
    const pct = cl[2]!;
    const active = cl[3] === 1;
    let ability = '';
    if (def.ability === 'sentry') ability = this.mounts?.mounts.get(BUILT_MOUNT_BASE + this.slot)?.alive ? 'SENTRY UP' : pct >= 100 ? 'SENTRY READY (G)' : `SENTRY ${pct}%`;
    else if (def.ability === 'overcharge') ability = active ? 'OVERCHARGED' : pct >= 100 ? 'OVERCHARGE READY (G)' : `OVERCHARGE ${pct}%`;
    else if (def.ability === 'cloak') ability = active ? `CLOAKED ${pct}%` : `CLOAK ${pct}% (G)`;
    const next = cl[1] !== cl[0] ? ` → ${CLASS_DEFS[CLASS_IDS[cl[1]!] ?? 'rocketeer'].name.toUpperCase()} NEXT` : '';
    out.push({ text: `${def.name.toUpperCase()}${ability ? ` · ${ability}` : ''}${next}`, color: active ? '#ffd24a' : '#cfe8ff' });
    return out;
  }

  private npcLook(id: number): { color: string; scale: number; size: number; label: string; creature?: CreatureKind; zombie?: boolean } | undefined {
    const info = this.npcInfo.get(id);
    if (!info || !this.map) return undefined;
    const faction = mapFactions(this.map)[info.faction];
    const role = NPC_ROLES[info.role] ?? 'trooper';
    if (role === 'zombie') return { color: '#76866a', scale: info.size, size: info.size, label: 'Zombie', zombie: true };
    return { color: faction?.color ?? '#d04a3a', scale: NPC_ROLE_SPECS[role].scale * info.size, size: info.size, label: `${faction?.name ?? 'Enemy'} ${NPC_ROLE_SPECS[role].label}`, ...(isCreature(role) ? { creature: role } : {}) };
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
    const myTeam = this.hud.team(this.slot)?.id ?? (this.rules?.mode === 'core.coop' ? 'players' : null);
    const target = local.alive ? pickUsable(map, local.eye, this.input.yaw, this.input.pitch, (i) => sc.usable(i, myTeam)) : null;
    const e = target === null ? undefined : map.entities[target];
    const enter = local.alive && !this.seat ? this.mounts?.enterable(local.state.pos) : null;
    if (local.alive && this.seat) {
      const m = this.mounts?.mounts.get(this.seat[0]);
      this.hud.setPrompt(m?.def.airplane ? 'Jump out (E or Space), then Space to open your parachute' : `Get out of the ${m?.def.displayName ?? 'vehicle'}`);
    } else if (enter) {
      const seat = enter.mount.def.seats[enter.seat]!;
      const verb = seat.role === 'driver' ? (enter.mount.def.kind === 'vehicle' ? 'Drive' : 'Use') : seat.role === 'gunner' ? 'Man the gun on' : 'Ride in';
      this.hud.setPrompt(`${verb} the ${enter.mount.def.displayName}`);
    } else if (local.alive && !local.state.grounded && !local.state.chute && local.state.velY < -CHUTE.armSpeed && local.jetFuel === null && heightAboveGround(local.physics, local.state.pos, CHUTE.minHeight) === null) {
      this.hud.setPrompt(local.glider ? 'Open your glider (Space)' : 'Open your parachute (Space)');
    } else if (local.state.chute) this.hud.setPrompt(local.state.chute === CHUTE_GLIDER ? 'Gliding: W faster, S slower, crouch to let go' : 'Parachute: steer with WASD, crouch to cut away');
    else if (e?.kind === 'button') this.hud.setPrompt(sc.state(target!)?.[0] === 0 ? 'Not working' : e.label || 'Press', sc.state(target!)?.[0] === 0);
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

  /** Who you watch while out of an Elimination or Bomb round (Space: the next teammate). */
  private spectating = -1;

  private spectateTarget(now: number): RemotePose | null {
    const mode = this.rules?.mode;
    if (mode !== 'core.elim' && mode !== 'core.bomb' && mode !== 'core.hostage') return null;
    if (this.phase !== 'playing') return null;
    const mine = this.hud.team(this.slot)?.id;
    const mates = this.interp.sample(now).filter((p) => p.alive && p.slot !== this.slot && p.slot < NPC_ID_BASE && this.hud.team(p.slot)?.id === mine);
    if (!mates.length) return null;
    if (this.spectateNext) {
      this.spectateNext = false;
      const i = mates.findIndex((p) => p.slot === this.spectating);
      this.spectating = mates[(i + 1) % mates.length]!.slot;
    }
    return mates.find((p) => p.slot === this.spectating) ?? ((this.spectating = mates[0]!.slot), mates[0]!);
  }

  private spectateNext = false;

  /** "STREAK 4 · Supply Pulse at 5", while streaks are on and you have one. */
  private streakLabel(): string {
    if (!this.streak || this.rules?.killstreaks === false) return '';
    const next = STREAK_REWARDS.find((r) => r.kills > this.streak);
    return `STREAK ${this.streak}${next ? ` · ${next.name} at ${next.kills}` : ''}`;
  }

  /** Team pings as screen markers (or edge arrows), following a pinged enemy while they're seen. */
  private updatePings(local: LocalPlayer, poses: readonly { slot: number; x: number; y: number; z: number; alive: boolean }[], now: number): void {
    this.pings = this.pings.filter((p) => p.until > now);
    const eye = local.eye;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const list: ScreenMarker[] = [];
    for (const p of this.pings) {
      const pose = p.target !== undefined ? poses.find((q) => q.slot === p.target && q.alive) : undefined;
      const at = pose ? { x: pose.x, y: pose.y + 2.2, z: pose.z } : { x: p.at.x, y: p.at.y + 0.6, z: p.at.z };
      const enemy = p.target !== undefined;
      const color = enemy ? '#ff3b3b' : '#ffd24a';
      const label = `${p.from === this.slot ? '' : `${this.hud.name(p.from)} · `}${Math.round(Math.hypot(at.x - eye.x, at.y - eye.y, at.z - eye.z))} m`;
      const screen = this.view.project(at);
      if (screen && screen.x > 30 && screen.x < w - 30 && screen.y > 60 && screen.y < h - 30) list.push({ id: `ping${p.id}`, x: screen.x, y: screen.y, color, icon: enemy ? '◆' : '●', label });
      else {
        const bearing = Math.atan2(at.x - eye.x, at.z - eye.z) - this.input.yaw;
        const a = Math.atan2(Math.sin(bearing), Math.cos(bearing));
        list.push({ id: `ping${p.id}`, x: w / 2 + Math.sin(a) * (w / 2 - 70), y: h / 2 - Math.cos(a) * (h / 2 - 70), color, icon: enemy ? '◆' : '●', label, edge: a });
      }
    }
    this.hud.setPingMarkers(list);
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

    // Fort Wars: with the Builder out in the build phase, number keys and the wheel pick pieces (R turns them).
    const building = !!local && !!this.forts?.holding(local.held, local.weapon?.id);
    if (local && building) {
      const pick = this.input.takeSlotRequest();
      if (pick) this.forts!.pick(pick - 1);
      const steps = this.input.takeWheel();
      if (steps) this.forts!.cycle(steps);
    }
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
      // Through a scope the wheel steps between its zoom levels instead of switching weapons.
      if (wheel && this.scopedNow && local.weapon?.view.zoomFov) this.zoomLevel = wheel > 0 ? 1 : 0;
      else if (wheel) {
        const owned = local.ownedCodes();
        const i = owned.indexOf(this.wantWeapon || local.held);
        const next = owned[(((i + wheel) % owned.length) + owned.length) % owned.length];
        if (next) this.requestWeapon(next);
      }

      this.input.frame(dt);
      if (this.input.mouse.aimAssist && local.alive && !this.seat) this.aimAssist(local.eye, dt, now);
      this.acc += dt;
      let moving = false;
      const viewTick = Math.round(this.interp.renderTick(now));
      while (this.acc >= TICK_DT) {
        this.acc -= TICK_DT;
        const sample = this.input.sample();
        if (this.phase === 'waiting' || this.phase === 'countdown') {
          // Loading and the countdown: stand still (looking round is fine); the server holds everyone too.
          sample.forward = 0;
          sample.right = 0;
          sample.buttons = 0;
        }
        if (building && sample.buttons & BUTTON_RELOAD) {
          this.forts!.rotate();
          sample.buttons &= ~BUTTON_RELOAD;
        }
        moving ||= sample.forward !== 0 || sample.right !== 0;
        const before = { ...local.state.pos };
        const { input: cmd, shot } = local.tick(sample, this.input.yaw, this.input.pitch, this.wantWeapon, viewTick);
        if (this.forts) cmd.build = this.forts.code;
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
      const handsBusy = !!seatDef && (seatDef.role === 'driver' || !!seatDef.weapon || !!ride?.def.airplane);
      local.seatGun = seatGun ?? null;
      local.unarmed = (seatDef?.role === 'driver' && !seatGun) || !!ride?.def.airplane;
      const weapon = local.alive && !handsBusy ? local.weapon : undefined;
      const ready = local.raiseTicks === 0 && local.reloadTicks === 0;
      const zoomed = !!weapon?.view.zoomFov && this.input.zooming && ready;
      // Aiming down the sights of any other gun: a slight zoom and the gun brought up to the eye.
      const ads = !!weapon && !weapon.view.zoomFov && weapon.kind !== 'melee' && this.input.zooming && ready;
      if (!zoomed) this.zoomLevel = 0;
      this.scopedNow = zoomed;
      const wantFov = zoomed ? weapon!.view.zoomFov! * (this.zoomLevel ? 0.45 : 1) : ads ? DEFAULT_FOV * ADS_FOV : DEFAULT_FOV;
      // Scopes snap; sights ease in and out.
      this.fov = zoomed ? wantFov : this.fov + (wantFov - this.fov) * Math.min(1, dt * 14);
      this.adsAmount += ((ads ? 1 : 0) - this.adsAmount) * Math.min(1, dt * 14);
      const fov = this.fov;
      this.input.sensitivityScale = fov / DEFAULT_FOV;
      if (ride && seatDef) {
        const feet = mountToWorld(ride.shown.pos, ride.shown.yaw, seatDef.offset);
        const eye = { x: feet.x, y: feet.y + PLAYER.eyeHeight, z: feet.z };
        if (ride.def.airplane) {
          // Riding the plane: watch from behind and above it, looking wherever you like.
          const back = viewDirection(this.input.yaw, this.input.pitch - 0.3);
          const dist = 10 + ride.def.half[2] * 1.5;
          this.view.setCamera({ x: ride.shown.pos.x - back.x * dist, y: ride.shown.pos.y - back.y * dist + 3, z: ride.shown.pos.z - back.z * dist }, this.input.yaw, this.input.pitch - 0.15, DEFAULT_FOV);
        } else if (seatDef.role === 'driver' && ride.def.kind === 'vehicle') {
          // The chase camera swings round behind the vehicle as it turns (the mouse can still look about).
          const d = Math.atan2(Math.sin(ride.shown.yaw - this.input.yaw), Math.cos(ride.shown.yaw - this.input.yaw));
          this.input.yaw += d * Math.min(1, dt * 2.5);
          const back = viewDirection(this.input.yaw, this.input.pitch - 0.25);
          const dist = 4 + ride.def.half[2] * 1.5;
          this.view.setCamera({ x: eye.x - back.x * dist, y: eye.y - back.y * dist + 1, z: eye.z - back.z * dist }, this.input.yaw, this.input.pitch - 0.15, DEFAULT_FOV);
        } else this.view.setCamera(eye, this.input.yaw, this.input.pitch, DEFAULT_FOV);
      } else {
        // The view eases down and up as you crouch, go prone or stand; between ticks it glides.
        const eye = local.eye;
        const offset = eye.y - local.state.pos.y;
        this.eyeOffset = this.eyeOffset === null || !local.alive ? offset : this.eyeOffset + (offset - this.eyeOffset) * Math.min(1, dt * 12);
        const drawn = local.renderPos(this.acc / TICK_DT);
        this.drawnPos = drawn;
        const head = { x: drawn.x, y: drawn.y + this.eyeOffset, z: drawn.z };
        const watch = !local.alive ? this.spectateTarget(now) : null;
        if (watch) {
          // Out of the round: watch a teammate who's still in it, from over their shoulder.
          const fwd = viewDirection(watch.yaw, 0.25);
          const at = { x: watch.x, y: watch.y + 1.7, z: watch.z };
          const back = { x: -fwd.x, y: 0.35, z: -fwd.z };
          const len = Math.hypot(back.x, back.y, back.z);
          const dir = { x: back.x / len, y: back.y / len, z: back.z / len };
          const hit = local.physics.raycastWorld(at, dir, 3.2);
          const d = hit === null ? 3.2 : Math.max(0.4, hit - 0.25);
          this.view.setCamera({ x: at.x + dir.x * d, y: at.y + dir.y * d, z: at.z + dir.z * d }, watch.yaw, -0.2, fov);
          this.hud.setSpectating(this.hud.name(watch.slot));
        } else if (this.thirdPerson && local.alive) {
          this.hud.setSpectating(null);
          // Over the right shoulder, pulled in where a wall is in the way.
          const fwd = viewDirection(this.input.yaw, this.input.pitch);
          const right = { x: Math.cos(this.input.yaw), y: 0, z: -Math.sin(this.input.yaw) };
          const off = { x: -fwd.x * 3 + right.x * 0.6, y: -fwd.y * 3 + 0.35, z: -fwd.z * 3 + right.z * 0.6 };
          const len = Math.hypot(off.x, off.y, off.z);
          const dir = { x: off.x / len, y: off.y / len, z: off.z / len };
          const hit = local.physics.raycastWorld(head, dir, len);
          const d = hit === null ? len : Math.max(0.3, hit - 0.25);
          // Squeezed in against a wall: your own body would fill the screen, so it isn't drawn.
          this.tpClose = d < 1.6;
          this.view.setCamera({ x: head.x + dir.x * d, y: head.y + dir.y * d, z: head.z + dir.z * d }, this.input.yaw, this.input.pitch, fov);
        } else {
          this.hud.setSpectating(null);
          this.view.setCamera(head, this.input.yaw, this.input.pitch, fov);
        }
      }
      this.view.setViewmodel(weapon);
      const reloadFrac = weapon && local.reloadTicks > 0 ? Math.min(1, local.reloadTicks / 10, (weapon.reloadTicks - local.reloadTicks) / 10) : 0;
      this.view.updateViewmodel(dt, { moving, raise: weapon && weapon.raiseTicks ? local.raiseTicks / weapon.raiseTicks : 0, reload: reloadFrac, hidden: zoomed || (this.thirdPerson && !ride), ads: this.adsAmount });
      this.hud.setScope(zoomed);
      this.hud.setAds(this.thirdPerson ? 0 : this.adsAmount);
      this.updateScopeSway(dt, zoomed);
      this.hud.setHealth(local.health, local.armor, local.alive);
      // Took damage since last frame: flash, pointing at the latest shot or blast near you.
      const lost = this.lastHealth + this.lastArmor - local.health - local.armor;
      if (local.alive && lost > 0) {
        const from = this.hurtFrom && performance.now() - this.hurtFrom.at < 400 ? this.hurtFrom : null;
        const pos = local.state.pos;
        const dir = from && Math.hypot(from.x - pos.x, from.z - pos.z) > 0.5 ? Math.atan2(from.x - pos.x, from.z - pos.z) - this.input.yaw : null;
        this.hud.hurt(dir, lost);
      }
      this.lastHealth = local.health;
      this.lastArmor = local.armor;
      this.hud.setStamina(local.state.stamina ?? 1, !!local.state.winded, local.alive, local.state.stance ?? 0);
      // On a vehicle or turret gun the crosshair becomes a gunner's reticle (heat shown round it).
      this.hud.setGunnerReticle(seatGun && this.seat ? this.seat[2] : null);
      if (seatGun && this.seat) this.hud.setMountedGun(seatGun.displayName, this.seat[2]);
      else this.hud.setWeapons(local.inventory, local.held, local.reloadTicks > 0, local.alive, handsBusy);
      this.hud.setThrowable(local.throwable, local.alive);
      // Holding G: show where the throw will go (bounces and the blast area).
      if (this.input.throwAiming && local.alive && local.throwable && !handsBusy) {
        const spec = THROWABLE_DEFS[local.throwable.kind].projectile;
        const path = predictThrow(spec, local.state.pos, this.input.yaw, this.input.pitch, 0.12, (o, d, len) => this.view.raycastLevel(o, d, len));
        this.view.throwArc.show(path, spec.mine?.triggerRadius ?? spec.splashRadius);
      } else this.view.throwArc.hide();
      this.input.altTrigger = !!local.weapon?.alt && local.weapon.kind === 'melee';
      this.hud.setMessageMenu(this.input.msgMenu && this.rules?.emotes !== false, QUICK_MESSAGES);
      this.hud.setClassMenu(this.classesOn && this.input.classMenu, this.classesOn ? { current: this.myClass?.[0] ?? null, next: this.myClass?.[1] ?? null, full: this.classesFull(), pick: (i) => this.input.chooseClass(i) } : null);
      this.hud.setStatusLines(this.classStatusLines());
      this.hud.setPowerups(local.speedTicks / TICK_RATE, local.damageTicks / TICK_RATE, local.jetFuel === null ? null : local.jetFuel / JET.max, this.uav, this.jam, this.streakLabel());
      this.hud.setStatus(this.phase, this.timeLeft, local.alive, this.winner, this.outcome);
      this.updateScenarioHud(local, now);
    }
    if (this.scenario) {
      this.view.scenario.apply(this.scenario.entities);
      // Platforms are drawn where you are in time (your predicted tick), so what you stand on stays under your feet.
      if (this.scenario.movers.defs.length && this.local) this.view.scenario.applyMovers(this.scenario.movers, this.local.predTick - 1 + this.acc / TICK_DT);
      this.view.applyPropStates(this.scenario.entities);
    }
    this.view.updatePickups(this.taken, now);
    this.view.updateProjectiles(this.interp.sampleProjectiles(now));
    this.view.updateZones(this.zones, now);
    if (this.mounts) {
      const manned = this.seat ? this.mounts.mounts.get(this.seat[0]) : undefined;
      this.hud.setVehicle(manned?.alive ? { name: manned.def.displayName, pct: manned.health, burning: manned.def.kind === 'vehicle' && mountDamageState(manned.health / 100, manned.burning) === 'burning' } : null);
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
    this.forts?.frame(local?.alive ? local.eye : null, this.input.yaw, this.input.pitch, !!local?.alive && building, poses.filter((p) => p.slot !== this.slot), local?.alive ? local.state.pos : null);
    this.raceHud?.frame(this.view.camera.position, this.view.camera.rotation.y);
    // Third person: your own character drawn where prediction has you (not the delayed server copy).
    const self = this.thirdPerson && !this.tpClose && local?.alive && !this.seat ? poses.find((p) => p.slot === this.slot) : undefined;
    if (self && local) Object.assign(self, { x: this.drawnPos.x, y: this.drawnPos.y, z: this.drawnPos.z, yaw: this.input.yaw, pitch: this.input.pitch, stance: local.state.stance ?? 0, grounded: local.state.grounded, weapon: local.held, chute: local.state.chute ?? 0 });
    // Your own canopy in first person (third person draws it over your character).
    this.view.updateLocalCanopy(local?.alive && !self && !this.seat && local.state.chute ? this.drawnPos : null, this.input.yaw, local?.state.chute ?? 0);
    // Hostage Rescue: the hostages walk about like everyone else.
    const hostages = this.modeHud?.hostagePoses() ?? [];
    this.view.updateAvatars(
      hostages.length ? [...poses, ...hostages] : poses,
      self ? -1 : this.slot,
      (id) => {
        if (id >= HOSTAGE_SLOT_BASE) return { npc: { color: '#cfc4a8', scale: 1, female: id % 2 === 1 } };
        const npc = this.npcLook(id);
        // About half of each squad uses the female mannequin.
        if (npc?.creature) return npc.size === 1 ? { creature: npc.creature } : { creature: npc.creature, size: npc.size };
        if (npc) return { npc: { color: npc.color, scale: npc.scale, female: id % 2 === 1, ...(npc.zombie ? { zombie: true } : {}) } };
        const role = npcLookRole(this.looks.get(id));
        if (role && NPC_ROLE_SPECS[role].creature && isCreature(role)) return { creature: role, armed: true };
        const size = this.sizeOf(id);
        return size === 1 ? { look: this.looks.get(id) } : { look: this.looks.get(id), size };
      },
      this.phase === 'intermission',
      (id) => {
        // Allies get a calm marker (your choice in Options), enemies a red one so they read as the bad guys.
        const mine = this.hud.team(this.slot);
        const theirs = id < NPC_ID_BASE ? this.hud.team(id) : undefined;
        if (mine && theirs && mine.id === theirs.id) return this.markers.ally === 'team' ? mine.color : this.markers.ally;
        if (mine && theirs) return this.markers.enemy;
        return null;
      },
      this.mounts?.riders(),
    );
    this.sfx.remoteSteps(poses);
    this.hud.renderScoreboard(this.input.held('Tab') || this.phase === 'intermission', this.scores, this.slot);
    this.hud.setTeamScore(this.scores, this.slot, this.rules?.scoreLimit ?? 0, this.allied);
    if (local) {
      // Teammates on the minimap (co-op: every player is one).
      const mine = this.hud.team(this.slot);
      const coop = this.allied;
      const blips = poses
        .filter((p) => p.slot !== this.slot && p.slot < NPC_ID_BASE && p.alive && (coop || (mine && this.hud.team(p.slot)?.id === mine.id)))
        .map((p) => ({ x: p.x, z: p.z, color: coop ? '#2ecc71' : mine!.color }));
      // Pings show on the minimap too.
      for (const p of this.pings) blips.push({ x: p.at.x, z: p.at.z, color: p.target !== undefined ? '#ff3b3b' : '#ffd24a' });
      // A UAV sweep puts every enemy (and hostile NPC) on the map too.
      if (this.uav > 0) {
        for (const p of poses) {
          if (p.slot === this.slot || !p.alive || blips.length > 64) continue;
          const ally = p.slot < NPC_ID_BASE && (coop || (mine && this.hud.team(p.slot)?.id === mine.id));
          if (!ally) blips.push({ x: p.x, z: p.z, color: '#ff3b3b' });
        }
      }
      // Jammed by an enemy Counter-UAV: no blips at all.
      this.hud.minimap.update(local.eye.x, local.eye.z, this.input.yaw, this.jam > 0 ? [] : blips);
      this.updatePings(local, poses, now);
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
