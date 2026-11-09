import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import {
  BUILT_MOUNT_BASE,
  CLASS_DEFS,
  CLASS_IDS,
  DISC_POWERS,
  DISC_POWER_LABELS,
  classesInPlay,
  QUICK_MESSAGES,
  ORDER_ACKS,
  ORDER_KINDS,
  ORDER_LABELS,
  REFUSALS,
  REFUSAL_TEXT,
  SPACING_ACKS,
  SQUAD_SPACINGS,
  nextSpacing,
  orderSay,
  spacingLabel,
  type OrderKind,
  withTrackVehicles,
  CHUTE,
  CHUTE_GLIDER,
  heightAboveGround,
  matchStats,
  CORE_WEAPONS,
  gunplayOf,
  traceBullet,
  THROWABLE_DEFS,
  predictThrow,
  mapLadders,
  mapZiplines,
  grabZipline,
  oneHanded,
  mapPortals,
  mapPads,
  LUNAR_PAD_BOOST,
  TINY_SIZE,
  FX_JACKPOT,
  FX_PROTECTED,
  type MatchAward,
  type GameEvent,
  rouletteOn,
  cockpitEye,
  mountToWorld,
  firingSeat,
  viewDirection,
  thirdPersonCamera,
  thirdPersonAim,
  angleDelta,
  type ZoneSnapshot,
  BUTTON_FIRE,
  BUTTON_MELEE,
  UNARMED,
  stoppingPower,
  unarmedStrike,
  BUTTON_RELOAD,
  BUTTON_STEER_LOOK,
  BUTTON_THIRD_PERSON,
  BUTTON_AUTO_RELOAD,
  PhysicsWorld,
  SPEED_BOOST,
  TICK_DT,
  TICK_RATE,
  type CarryOver,
  weaponByCode,
  DESTRUCTIBLE_SPECS,
  glassAt,
  NPC_ROLES,
  NPC_ROLE_SPECS,
  isCreature,
  zombieHasCreatureBody,
  STREAK_REWARDS,
  matchPhysics,
  matchTeams,
  type Vec3,
  type WeaponDefinition,
  npcLookRole,
  type CreatureModel,
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
  mapGravityZones,
  JET,
  getItem,
  setPickupPool,
  setSpawnWeapons,
  setThrowables,
  setWeaponsInPlay,
  weaponSetInPlay,
  matchWeather,
  heldModel,
  throwableModel,
  getMountDef,
  airCraftDef,
  getWeapon,
  loadMap,
  pickUsable,
  type MapDocument,
  type MatchPhase,
  type PlayerInput,
  type ScoreEntry,
  type RosterEntry,
  type ServerMessage,
  type ServerStats,
  type MatchRules,
  PLAYER,
  getProp,
  mapTerrainMesh,
  environmentShapes,
  mountDamageState,
  rulesForTravel,
  mapPlayerCaps,
  travelNotice,
  withPending,
  nextMapLine,
  validateRotation,
  type GameMode,
  type HostState,
  type MapRotation,
  type RotationCommand,
  type RotationLookup,
  mapIdentity,
  WEAPONS_BY_SLOT,
  parseVoteState,
  pickVoteOptions,
  VOTE_RESULT_SECONDS,
  type VoteCandidate,
  type VoteState,
} from '@tiletrigger/shared';
import { MapVoteHud } from './mapVoteHud.ts';
import { myParty } from './party.ts';
import { GameplayFxWatch } from './gameplayFxWatch.ts';
import type { AudioSystem } from '../audio/audio.ts';
import { BLOOD_PREF_KEY } from './bloodVisuals.ts';
import { REDUCE_FLASHING_EVENT, reduceFlashing, saveReduceFlashing } from './reduceFlashing.ts';
import { BULLET_SPEED } from './impactVisuals.ts';
import { bindFullscreenButton, browserTookEscape, isFullscreen, pageHoldsEscape, toggleFullscreen } from '../fullscreen.ts';
import { testMode } from '../testMode.ts';
import type { RendererKind } from '../engine.ts';
import { Hud } from './hud.ts';
import { DamageNumbers, SprayReadout, autoReloadOn } from './combatReadouts.ts';
import { MountState } from './mountState.ts';
import { RiderPlacement } from './riderPlacement.ts';
import { ownBodyDrawn } from './ownBody.ts';
import { LocalTransport } from './localTransport.ts';
import { SYS, netProbe, perfProbe } from './perfProbe.ts';
import { PerfOverlay, loadPerfOverlay, savePerfOverlay } from './perfOverlay.ts';
import { loadHitboxOverlay } from './hitboxPrefs.ts';
import { PerfRecorder, captureTrace, downloadJson, fileStamp, type RecorderContext } from './perfRecorder.ts';
import { NetTransport } from './netTransport.ts';
import { HostPanel } from './hostPanel.ts';
import { loadSignaling, type HostLink } from './transport.ts';
import { loadRelay, relayParams } from './relay.ts';
import { ROTATION_PRESETS, inSuite } from '../playlists.ts';
import { PauseMenu } from './pauseMenu.ts';
import type { ScreenMarker } from './hud.ts';
import type { BoardData } from './scoreBoard.ts';
import { CoverState } from './coverState.ts';
import { FortsClient } from './fortsClient.ts';
import { HOSTAGE_SLOT_BASE, ModeHud } from './modeHud.ts';
import type { MinimapBlip } from './minimap.ts';
import { SQUAD_COLOR, SquadHud } from './squadHud.ts';
import { RouletteHud } from './rouletteHud.ts';
import { AwardsHud } from './awardsHud.ts';
import { LobbyAdvertiser, builtHub, hubAddress, hubSetting } from './hub.ts';
import { myRegion } from '../profile.ts';
import { statusColor } from './arsenalVisuals.ts';
import { InputState, saveMousePrefs } from './input.ts';
import { TouchControls } from './touchControls.ts';
import { WeaponWheel, wheelEntries } from './weaponWheel.ts';
import { isTouchDevice } from '../touchDevice.ts';
import { CoachHud } from './coachHud.ts';
import { TipBook, type TipId } from './tips.ts';
import { Tutorial, setTutorialState } from './tutorial.ts';
import { zoomLookScale } from './lookFilter.ts';
import { markerSetting } from './crosshair.ts';
import { Interpolator } from './interpolation.ts';
import { LocalPlayer } from './prediction.ts';
import { SessionAudio } from './sessionAudio.ts';
import { WeatherAudio } from './weatherAudio.ts';
import { impactSoundId, impactStyle } from './fxMap.ts';
import { ScenarioState } from './scenarioState.ts';
import { VISUAL_EVENTS } from './snapshotMerge.ts';
import type { Transport } from './transport.ts';
import { BODIES_PREF_KEY, DEFAULT_FOV, GameView, slotColor } from './view.ts';
import { loadFirstPersonMode } from './graphicsSettings.ts';
import { VehicleCamera, rayBoxExit } from './vehicleCamera.ts';
import { KILL_CAM_SECONDS, SpectatorCam, followable, freeCamBounds, spectateRule, type CameraPose, type FreeBounds, type SpectateRule } from './spectatorCam.ts';

/** Field of view while aiming down the sights, as a fraction of the normal one. */
const ADS_FOV = 0.72;
/** Kills this close together escalate the kill marker (and its sound). */
const MULTI_KILL_MS = 4000;

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
  /** `how`: lost (the connection to a match we were playing dropped: worth reconnecting), rejected (the server refused or removed us). */
  /** `end`: how the match stood when it ended for us (the standings, map and rules), once it had taken us in. */
  onExit: (reason?: string, travel?: Travel, how?: 'lost' | 'rejected', end?: SessionEnd) => void;
  /** Local matches in a playlist: a co-op win moves on even without a "Next map" link. */
  chain?: boolean;
  /** Called once the map is loaded and the first frame can render. */
  onReady?: () => void;
  /** Your character's portrait for the HUD (rendered by the menus). */
  portrait?: Promise<string>;
  /** Any look's portrait (the menus' renderer): the HUD follows your body when Random characters gives you a new one. */
  portraitOf?: (look: string) => Promise<string>;
  /** Host game across a map change: the join code already open (friends come back to it), and the game browser listing's name when it was listed. */
  hosting?: { peer: HostLink; listing?: string };
  /**
   * Host online from the start (Match setup's Host online; Host this map, after a host left): the same as the Host
   * tab's Host online, without its restart: a join code, and listed in the game browser when there's a hub.
   */
  autoHost?: boolean;
  /** A line to show as the match starts ("Host left: Ann is taking over"). */
  greeting?: string;
  /** The map picker for the host's Change map (pause menu → Match): the front end's map cards. `title`: its heading and button. */
  mapPicker?: (o: { mode: GameMode; current: string; suiteOnly: boolean; title?: string; onPick: (map: MapDocument, mode: GameMode) => void; onClose: () => void }) => HTMLElement;
  /**
   * The map rotation this browser keeps across map changes (offline and Host game; main.ts holds it):
   * after each match the next of its maps instead of a replay. `load` fetches a map of our suite;
   * `info` is a map's name and the modes it plays (null: not one of ours).
   */
  rotation?: {
    list: MapRotation;
    load(id: string): Promise<MapDocument | null>;
    info: RotationLookup;
    /** Our suite's maps that play `mode`, each with its player cap for it (the next-map vote's ballot: sim/mapVote.ts). */
    pool(mode: GameMode): VoteCandidate[];
    /** The host's "Vote on the next map" setting (on by default; kept by the page). */
    vote: { get(): boolean; set(on: boolean): void };
  };
  /** A suite map's picture by ID (the vote's cards), or null. */
  mapPicture?: (id: string) => string | null;
  /** Joined a friend's game by its code (Join by code, an invite link): the pause menu offers an invite link to it. */
  joinCode?: string;
  /** The tutorial (tutorial.ts): its step card over the match, Skip in it and in the pause menu (back to the menu). */
  tutorial?: boolean;
  /** First-time tips (tips.ts); off in the tutorial and in browser tests (main.ts). */
  tips?: boolean;
}

/** How a match stood when it ended for this player: the last standings, and enough to host the same match again. */
export interface SessionEnd {
  /** The final scoreboard as this player last saw it. */
  board: BoardData;
  /** The map as the match sent it, and the rules it played. */
  map: MapDocument;
  rules: MatchRules;
  /** Players in the match then (people and bots): roughly the bot fill to host it again. */
  fill: number;
}

/** Where a scenario chain goes next: a suite map ID (local "Next map"), or the server's new map (its name). */
export interface Travel {
  id?: string;
  map?: string;
  carry?: CarryOver;
  /** The host changed map (offline, Host game): play `map` with these rules, players and bot skill. */
  host?: { map: MapDocument; rules: MatchRules; fill: number; skill: HostState['skill']; botSet?: HostState['botSet'] };
  /** Host game: the join code, handed on to the next match (friends were sent `travel` and rejoin it). */
  hosting?: { peer: HostLink; listing?: string };
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
  /** Damage numbers and the spray pattern (combatReadouts.ts; HUD options, off by default). */
  private readonly damageNumbers = new DamageNumbers(document.getElementById('damage-numbers')!);
  private readonly spray = new SprayReadout(document.getElementById('spray-readout')!);
  private readonly input: InputState;
  /** The weapon wheel (hold Q, hold a controller's Y, or the Weapons button on a phone). */
  private readonly wheel = new WeaponWheel(document.getElementById('hud')!);
  /** Fireteams: the order wheel (hold B, hold a controller's d-pad up, or the Orders button on a phone). */
  private readonly orderWheel = new WeaponWheel(document.getElementById('hud')!, 'order-wheel');
  /** Fireteams' squad HUD: your squad's portraits, health and order; its minimap markers and colour (Part 2). */
  private readonly squadHud = new SquadHud(document.getElementById('hud')!, (look) => this.opts.portraitOf?.(look) ?? Promise.reject(new Error('no portraits')));
  /** Fireteams: you lead a squad now (its id), and its current order (the HUD's line); null: you lead none. */
  private squadLed: number | null = null;
  private squadOrder: OrderKind | null = null;
  /** Phones and tablets: the on-screen controls (null with a mouse). */
  private touch: TouchControls | null = null;
  private readonly interp = new Interpolator();
  private readonly sfx: SessionAudio;
  /** The weather's rain and wind (weatherAudio.ts), and the weather last shown. */
  private readonly weatherSound: WeatherAudio;
  private weatherKey = '';
  private readonly abort = new AbortController();
  private slot = -1;
  private local: LocalPlayer | null = null;
  /** This player has had a life in this match (the first one may start looking up or down: Play from here). */
  private livedBefore = false;
  /** Spawns, portals, jump pads and ziplines read off movement, for their effects (gameplayFxWatch.ts). */
  private fxWatch: GameplayFxWatch | null = null;
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
  /** Your recent kills (ms), for the multi-kill rhythm of the kill marker. */
  private killTimes: number[] = [];
  /** Out of play: the kill cam, following someone and the free camera (spectatorCam.ts). */
  private readonly specCam = new SpectatorCam();
  /** Spectating by choice (the roster marks you `sp`): out of the match until you join again. */
  private spectator = false;
  /** The host lets players spectate by choice (welcome `spectate`). */
  private canSpectate = false;
  /** Out of play this frame: spectating, or dead in a running match. */
  private outOfPlay = false;
  /** The latest shot that hit you: who fired it and from where (the kill cam looks there when the killer isn't in view). */
  private lastHitBy: { slot: number; from: Vec3; at: number } | null = null;
  /** Where the free camera may fly. */
  private freeBounds: FreeBounds | null = null;
  /** The view angles sent last tick (turning while watching counts as activity). */
  private sentLook = { yaw: NaN, pitch: NaN };

  /** Hit confirmation on the crosshair for your shot: head, armor or body, told apart by shape (and by sound, in SessionAudio). */
  private hitFeedback(hits: readonly (number | null)[], zones: readonly number[] | undefined, armor: boolean): void {
    const target = hits.find((h): h is number => h !== null && h !== undefined);
    if (target === undefined) return;
    const head = zones?.some((z, i) => z === 1 && hits[i] !== null && hits[i] !== undefined) ?? false;
    this.hud.hit(head ? 'head' : armor ? 'armor' : 'body');
    this.hud.showTarget(this.hud.name(target), this.hp.get(target) ?? 1, target >= NPC_ID_BASE ? '#e74c3c' : (this.hud.team(target)?.color ?? '#ff8a3d'));
  }
  private outcome: 'victory' | 'defeat' | null = null;
  /** Role and faction of each NPC seen, for names and looks. */
  private npcInfo = new Map<number, { role: number; faction: number; size: number }>();
  /** Character look of each player slot (from the roster). */
  private looks = new Map<number, string>();

  /** Tests (the flashing flow's jackpot moment): Roulette's jackpot card and glow, as a jackpot life shows them, in any match. */
  private testJackpot(): void {
    if (!this.map) return;
    this.rouletteHud ??= new RouletteHud(this.hud, this.input, this.map, () => this.rules, () => this.slot, this.opts.portraitOf);
    this.rouletteHud.spawned(this.looks.get(this.slot) ?? 'core.ranger', 1);
  }

  /** A player plays another look from now (Random characters): their body, size, portrait and arms follow. */
  private relook(slot: number, look: string): void {
    this.looks.set(slot, look);
    const entry = this.lastRoster?.find((p) => p.slot === slot);
    if (entry) {
      entry.look = look;
      this.hud.setRoster(this.lastRoster!);
    }
    if (slot === this.slot) {
      this.view.setLocalLook(look);
      if (this.local) this.local.scale = this.sizeOf(slot);
      // The HUD's portrait is the body you play now, not the one picked in the menu.
      const want = look;
      this.portraitLook = want;
      void this.opts.portraitOf?.(want).then((src) => this.portraitLook === want && this.hud.setPortrait(src), () => undefined);
    }
    this.view.characters.preload({ look });
  }
  /** The look the HUD portrait is (being) shown for: a late portrait for an earlier body doesn't replace a newer one. */
  private portraitLook: string | null = null;

  /** A player's body scale: their look's size (class, or its own size stat), as the match plays it (Character sizes and stats). */
  private sizeOf(slot: number): number {
    const size = matchStats(this.looks.get(slot), this.rules ?? {}).size;
    // Roulette's tiny roll: smaller still, as the match plays it.
    return this.rlTiny.has(slot) ? size * TINY_SIZE : size;
  }
  private botStates: string[] = [];
  private outbox: PlayerInput[] = [];
  private showStats: boolean;
  private closed = false;
  /** Pickups currently taken (hidden until they respawn). */
  private taken = new Set<string>();
  /** Random weapon pickups holding something other than what was placed (snapshot `pw`). */
  private pickupItems = new Map<string, string>();
  /** Weapons the fallen dropped, lying now (snapshot `dw`). */
  private drops: readonly [number, string, number, number, number, number][] = [];
  /** Weapon slot the player asked for (0 = no request). */
  private wantWeapon = 0;
  /** Ground hazards from the latest snapshot, and your own status effects. */
  private zones: ZoneSnapshot[] = [];
  /** Turrets, sentries and vehicles, and your seat in one: [mount entity index, seat, gun heat %]. */
  private mounts?: MountState;
  /** Where riders are drawn (on their seats, see riderPlacement.ts). */
  private readonly riderPlacement = new RiderPlacement();
  private covers?: CoverState;
  /** Seconds of UAV sweep left for your side: enemies show on the minimap. */
  private uav = 0;
  /** H: a camera over your shoulder, to see your own character. */
  private thirdPerson = false;
  /** What you carried when the kept first-person guns were last trimmed (View.trimViewmodels): the map and its codes. */
  private carriedInventory: unknown = null;
  private carried = '';
  /** Third person: your own gun's last turn from the view onto the crosshair point (tests: `__cs.tpAim()`). */
  private tpAim: { yaw: number; pitch: number } | null = null;
  /** Riding: the cockpit or chase camera (H switches while driving, remembered per ground / air). */
  private readonly vehicleCam = new VehicleCamera();
  /** The riding view this frame (cockpit, chase or a rider's seat), null on foot: for tests. */
  private rideView: 'cockpit' | 'chase' | 'seat' | null = null;
  /** The join code's registration while this match is hosted for friends. */
  private peerHost?: HostLink;
  /** The pause menu's Match section (bots, map, restart, end) and the match's settings while you run it. */
  private hostPanel: HostPanel;
  private hostState: HostState | null = null;
  private mapPicker: HTMLElement | null = null;
  /** The pause menu's tabs, keys and controller. */
  private readonly pauseMenu: PauseMenu;
  /** When the pause menu's scores were last drawn. */
  private pauseDrawnAt = 0;
  /** The host has a relay set up (Options → Relay), for the game browser's badge. */
  private relayOn = false;
  private tpClose = false;
  /** Your position as drawn this frame (blended between prediction ticks). */
  private drawnPos: Vec3 = { x: 0, y: 0, z: 0 };
  /** Smoothed ground speed of drawnPos (m/s). */
  private drawnSpeed = 0;
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
  private seat: [number, number, number] | [number, number, number, number] | null = null;
  private localStatus = 0;
  private lastWeapon = 0;

  /**
   * Quick melee pressed: a melee weapon in hand swings (its kick and sound
   * here; the server lands it); otherwise a punch, or a kick moving forward or
   * straight after a punch (the server's rule, sim UNARMED), shown at once.
   */
  private localStrike(def: WeaponDefinition | undefined, forward: number, now: number): void {
    if (def?.kind === 'melee') {
      this.view.kick(def);
      this.sfx.localShot(def);
      return;
    }
    // Disc Arena has no fists (nobody takes damage there).
    if (now < this.meleeReadyAt || def?.projectile?.disc) return;
    const kind = unarmedStrike(forward, ((now - this.punchedAt) / 1000) * TICK_RATE);
    this.meleeReadyAt = now + (UNARMED[kind].cooldownTicks / TICK_RATE) * 1000;
    this.punchedAt = kind === 'punch' ? now : -1e9;
    this.view.localStrike(kind, this.jabNext);
    if (kind === 'punch') this.jabNext = !this.jabNext;
    this.sfx.localStrike();
  }

  /** A remote player's next punch: jab and cross in turn. */
  private nextPunch(slot: number): 'jab' | 'melee' {
    const jab = this.punches.get(slot) ?? true;
    this.punches.set(slot, !jab);
    return jab ? 'jab' : 'melee';
  }
  /** Quick melee, as you see it: the key held last input, when the next strike is ready, the last punch (ms), and jab or cross next. */
  private meleeHeld = false;
  private meleeReadyAt = 0;
  private punchedAt = -1e9;
  private jabNext = true;
  /** Remote players' next punch: jab or cross, alternating. */
  private readonly punches = new Map<number, boolean>();
  /** Capture the Flag, King of the Hill, Elimination: flags, hill, status line, markers, announcer. */
  private modeHud: ModeHud | null = null;
  /** The end-of-match awards and the revenge and nemesis callouts (awardsHud.ts), every mode. */
  private awardsHud: AwardsHud | null = null;
  /** Between matches: the vote on the next map (mapVoteHud.ts), and whether Esc asked for the pause menu over it. */
  private voteHud: MapVoteHud | null = null;
  private votePause = false;
  private voteTravelling = false;
  /** Kills in this life by slot (the kill-streak burst at 3, 5, 10...: content/vfx.json map.gameplay streak). */
  private readonly lifeKills = new Map<number, number>();

  /** A kill: the killer's streak this life, and its burst over them at 3, 5, 7, 10, 15, 20... */
  private streakMoment(ev: Extract<GameEvent, { e: 'kill' }>, poses: () => ReturnType<Interpolator['sample']>): void {
    this.lifeKills.delete(ev.victim);
    if (ev.killer === null || ev.killer === undefined || ev.killer === ev.victim) return;
    // A team kill ends the killer's streak (no burst, no "in a row").
    if (ev.tk) return void this.lifeKills.delete(ev.killer);
    const n = (this.lifeKills.get(ev.killer) ?? 0) + 1;
    this.lifeKills.set(ev.killer, n);
    if (!(n === 3 || n === 5 || n === 7 || (n >= 10 && n % 5 === 0)) || document.hidden) return;
    // Over them for everyone else; yours shows on the HUD (the burst would be round your own head).
    if (ev.killer === this.slot && !this.thirdPerson) return void this.hud.showMessage(`${n} kills in a row!`, 1.5);
    const p = ev.killer === this.slot && this.local ? this.local.state.pos : poses().find((x) => x.slot === ev.killer);
    if (p) {
      const at = this.view.towardCamera({ x: p.x, y: p.y + 2.1, z: p.z }, 0.3);
      this.view.playGameplayFx('streak', at, { calmable: true, size: this.view.farSize(at) });
    }
  }

  /** A hit worth showing (the `hurt` event): armour breaking, a heavy hit (and, if it was you, the screen's edge). */
  private hurtMoment(ev: Extract<GameEvent, { e: 'hurt' }>): void {
    const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
    const me = ev.s === this.slot;
    if (me && ev.a === 'big') this.hud.heavyHit(ev.n ?? 50);
    // Not on yourself in first person (it would be round the camera).
    if (me && !this.thirdPerson) return;
    // On the body's near side, toward the camera: from its middle the burst would be hidden inside the body.
    const near = this.view.towardCamera(at, 0.5);
    this.view.playGameplayFx(ev.a === 'armor' ? 'armor.break' : 'hit.big', near, { calmable: true, size: this.view.farSize(near) });
  }

  /** Spawn protection on you: a line under the crosshair until it drops (firing ends it). */
  private shieldNote(on: boolean): void {
    if (on) this.tips?.trigger('shield', performance.now() / 1000);
    let el = document.getElementById('shield-note');
    if (!on) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'shield-note';
      el.textContent = 'Spawn protection: firing ends it';
      (document.getElementById('hud') ?? document.body).append(el);
    }
    el.hidden = false;
  }

  /** Roulette (rouletteHud.ts): the spawn card, the death screen's pick and reroll, the storm, the awards. */
  private rouletteHud: RouletteHud | null = null;
  /** Roulette: players on a tiny roll this life (drawn and predicted smaller), on a jackpot (a gold glow); the cards coming up (preloaded). */
  private rlTiny = new Set<number>();
  private rlJackpot = new Set<number>();
  private readonly rlUpcoming = new Set<string>();
  /** Roulette: cards further ahead, loaded once the match has started (the loading gate waits only for the next ones). */
  private rlLater: string[] | null = [];
  private readonly rlLoaded = new Set<string>();
  /** Fort Wars: pieces, the build-phase barrier, the Builder's ghost and panel. */
  private forts: FortsClient | null = null;

  // Frame timing / instrumentation.
  private acc = 0;
  private last = performance.now();
  private frames = 0;
  private fps = 0;
  private fpsAt = performance.now();
  private frameMs = 0;
  /** The performance overlay's measurements (on while it shows). */
  private readonly perf = new PerfOverlay();
  /** The match recording while "Record performance" is on (perfRecorder.ts). */
  private recorder: PerfRecorder | null = null;
  /** What a recording (and a trace's header) needs to know about the moment. */
  private recorderContext(): RecorderContext {
    const cam = this.view.cameraPosition();
    return {
      map: this.map?.metadata.name ?? '?',
      mode: this.rules?.mode ?? '?',
      players: this.view.avatarCount + 1,
      match: this.opts.transport.label,
      renderer: this.opts.rendererKind,
      pos: this.local ? [this.local.state.pos.x, this.local.state.pos.y, this.local.state.pos.z] : [cam.x, cam.y, cam.z],
      server: this.serverStats,
      shaders: this.view.shaderCount(),
    };
  }
  /** Stop the recording and download it. */
  private stopRecording(): void {
    const r = this.recorder;
    if (!r) return;
    this.recorder = null;
    downloadJson(`tiletrigger-perf-${fileStamp(this.map?.metadata.name ?? 'match')}.json`, r.finish());
  }
  private lastCorrections = 0;
  private correctionsPerSec = 0;
  private bytesInAt = 0;
  /** Scope sway state and breath (1 full). */
  private sway = { x: 0, y: 0, t: 0 };
  private breath = 1;
  private breathSpent = false;
  /** Smoothed eye height above the feet (crouching and prone lower it). */
  private eyeOffset: number | null = null;
  /** First-person roll riding a zipline (eased in and out). */
  private zipRoll = 0;

  /**
   * Riding a zipline the view banks with the ride: leaning into the line's
   * sideways run across your view, and swaying a little on the cable, more
   * the faster you go. Level again once you let go.
   */
  private zipLean(local: LocalPlayer, dt: number, now: number): number {
    const line = local.alive && local.state.zip !== undefined ? local.ziplines[local.state.zip] : undefined;
    let target = 0;
    if (line) {
      const v = local.state.zv ?? 0;
      const k = Math.min(1, Math.abs(v) / 15);
      // Sideways component of the motion across your view (right positive).
      const across = (Math.cos(this.input.yaw) * line.dir.x - Math.sin(this.input.yaw) * line.dir.z) * Math.sign(v || 1);
      target = -across * 0.12 * k + Math.sin(now / 1000 * 1.9) * 0.025 * k;
    }
    this.zipRoll += (target - this.zipRoll) * Math.min(1, dt * 4);
    return Math.abs(this.zipRoll) < 1e-4 ? 0 : this.zipRoll;
  }
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
    // Show hitboxes (dev and test setting): every body's hit shapes drawn over it.
    this.view.showHitboxes = loadHitboxOverlay();
    this.input = new InputState(opts.canvas);
    this.sfx = new SessionAudio(opts.audio, () => this.slot);
    this.weatherSound = new WeatherAudio(opts.audio);
    // The performance overlay: ?stats, F3 or Options; remembered.
    this.showStats = opts.showStats || loadPerfOverlay();
    this.input.onToggle.set('F3', () => this.setShowStats(!this.showStats));
    if (opts.exitOnF5) this.input.onToggle.set('F5', () => this.exit());
    // Watching: Space switches between following someone and the free camera (or skips the kill cam).
    this.input.onToggle.set('Space', () => {
      if (this.outOfPlay || this.spectator || (this.local && !this.local.alive && this.phase === 'playing')) this.input.toggleSpectateCamera();
    });
    // Spectating by choice: J joins the game again.
    this.input.onToggle.set('KeyJ', () => {
      if (this.spectator) this.setSpectating(false);
    });
    this.input.onToggle.set('KeyH', () => {
      // In a vehicle H switches the driver between the cockpit and the chase camera; on foot, first and third person.
      const ride = this.seat && this.local?.alive ? this.mounts?.mounts.get(this.seat[0]) : undefined;
      if (ride && ride.def.kind === 'vehicle' && !ride.def.airplane) {
        if (VehicleCamera.drives(ride.def, this.seat![1])) {
          const view = this.vehicleCam.toggle(ride.def);
          this.hud.pickup(view === 'chase' ? 'Chase camera (H for the cockpit)' : 'Cockpit view (H for the chase camera)');
        } else this.hud.pickup('Riders look out from their seat (the driver can use the chase camera)');
        return;
      }
      this.thirdPerson = !this.thirdPerson;
      this.hud.pickup(this.thirdPerson ? 'Third-person view (H to go back)' : 'First-person view');
    });
    this.input.onToggle.set('KeyQ', () => {
      if (this.lastWeapon && this.local?.inventory.has(this.lastWeapon)) this.requestWeapon(this.lastWeapon);
    });
    // The wheel pointed or picked by a finger (it's drawn on top of everything else in play).
    this.wheel.onPoint = (x, y) => this.input.aimWheel(x, y);
    this.wheel.onTouchPick = () => this.input.closeWheel(true);
    this.wheel.onTouchCancel = () => this.input.closeWheel(false);
    this.orderWheel.onPoint = (x, y) => this.input.aimWheel(x, y);
    this.orderWheel.onTouchPick = () => this.input.closeWheel(true);
    this.orderWheel.onTouchCancel = () => this.input.closeWheel(false);
    // Phones and tablets: on-screen controls instead of pointer lock (touchControls.ts).
    if (isTouchDevice()) {
      this.touch = new TouchControls(this.input, $('hud'), { pause: () => this.input.setTouchEngaged(false) });
      this.input.onEngage = () => {
        this.touch?.setActive(this.input.touchEngaged);
        this.updatePause();
      };
    }
    this.hud.reset();
    this.setUpCoach();

    const signal = this.abort.signal;
    const lock = () => {
      opts.audio.unlock();
      if (this.touch) {
        // A phone plays fullscreen (no browser bars over the controls) where it can, turned sideways.
        if (!this.input.touchEngaged && !isFullscreen() && !testMode()) void toggleFullscreen().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => undefined);
        this.input.setTouchEngaged(true);
        return;
      }
      // Raw mouse movement (no OS acceleration) where the browser has it; Safari and older ones refuse
      // the option, so ask again plainly.
      const raw = (opts.canvas.requestPointerLock as (this: HTMLCanvasElement, o?: { unadjustedMovement?: boolean }) => Promise<void> | void).call(opts.canvas, { unadjustedMovement: true });
      if (raw instanceof Promise) raw.catch(() => opts.canvas.requestPointerLock());
    };
    opts.canvas.addEventListener('click', lock, { signal });
    $('resume').addEventListener('click', lock, { signal });
    $('exitmatch').addEventListener('click', () => this.confirmLeave(), { signal });
    $('respawn-now').addEventListener(
      'click',
      () => {
        this.input.respawnQueued = true;
        lock();
      },
      { signal },
    );
    // Spectate by choice (a bot plays in your place), or join the game again.
    $('pause-spectate').addEventListener(
      'click',
      () => {
        this.setSpectating(!this.spectator);
        lock();
      },
      { signal },
    );
    $('exitmatch').textContent = opts.exitLabel;
    this.pauseMenu = new PauseMenu(
      {
        resume: () => {
          lock();
          // The browser may refuse the mouse right after Esc: Resume (click) always works (the Host tab has its own, in its foot).
          ((this.pauseMenu.tab === 'host' ? document.getElementById('hc-resume') : null) ?? $('resume')).focus();
        },
        overlay: () => document.getElementById('bm-pick-wrap') ?? document.getElementById('bot-manager') ?? document.getElementById('leave-confirm') ?? document.getElementById('online-confirm') ?? this.mapPicker,
        opened: () => this.drawPause(true),
        // MapMaker TEST: back from the top goes back to MapMaker.
        ...(opts.exitOnF5 ? { top: { label: 'MapMaker', act: () => this.exit() } } : {}),
      },
      signal,
    );
    // Classes: pick your next class from the menu too.
    $('pause-class').addEventListener(
      'click',
      () => {
        this.input.classMenu = true;
        lock();
      },
      { signal },
    );
    // Host game: open a join code so friends' browsers can connect to this match.
    const hostBtn = $('host-game') as HTMLButtonElement;
    const hostInfo = $('host-info');
    hostBtn.hidden = !opts.hostable || !(opts.transport instanceof LocalTransport) || this.offlineOnly;
    hostInfo.hidden = true;
    hostBtn.textContent = 'Host with code only (not listed)';
    hostBtn.disabled = false;
    hostBtn.addEventListener('click', () => void this.startHosting(hostBtn, hostInfo), { signal });
    // Host game across a map change: the same code, friends come back to it.
    if (opts.hosting && opts.transport instanceof LocalTransport) {
      const local = opts.transport;
      this.peerHost = opts.hosting.peer;
      this.peerHost.admit = (link) => local.accept(link);
      local.joinCode = this.peerHost.code;
      if (opts.hosting.listing !== undefined) {
        ($('host-list') as HTMLInputElement).checked = true;
        ($('host-name') as HTMLInputElement).value = opts.hosting.listing;
      }
      void this.showHostInfo(hostBtn, hostInfo, this.peerHost.code);
    }
    this.hostPanel = this.makeHostPanel();
    // Offline by default: nothing listens until the player goes online (or hosts with a code). The Host tab's foot
    // switches between the two: Host online (goOnline, the same as Match setup's) lists the match when there's a hub to
    // list it on (after a confirm: it restarts), else opens a join code; Offline disconnects friends and takes the
    // listing down.
    $('go-online').addEventListener('click', () => (this.peerHost ? undefined : hubSetting() ? this.confirmGoOnline() : void this.goOnline(false)), { signal });
    $('go-offline').addEventListener('click', () => this.peerHost && this.goOffline(), { signal });
    // Public: the hosted match shows up in everyone's game browser (needs a community hub).
    const pub = $('host-public');
    const listBox = $('host-list') as HTMLInputElement;
    const listName = $('host-name') as HTMLInputElement;
    pub.hidden = hostBtn.hidden || !hubSetting();
    // Listed already (a map change carried the listing).
    listBox.checked = !!opts.hosting && opts.hosting.listing !== undefined;
    listName.value = opts.hosting?.listing ?? '';
    // The server name only matters when the match is listed.
    const showName = () => (listName.hidden = !listBox.checked);
    showName();
    listBox.addEventListener('change', () => (showName(), this.updateListing()), { signal });
    listName.addEventListener('change', () => this.updateListing(), { signal });
    // Online from the start (Match setup's Host online, Host this map): the Host tab's Host online, the match being new.
    if (!opts.hosting && opts.autoHost) void this.goOnline(false);
    // Mouse sensitivity and invert, saved for next time.
    const sens = $('mouse-sens') as HTMLInputElement;
    const sensVal = $('mouse-sens-val');
    const zoomSens = $('zoom-sens') as HTMLInputElement;
    const zoomSensVal = $('zoom-sens-val');
    const invert = $('mouse-invert') as HTMLInputElement;
    const assist = $('aim-assist') as HTMLInputElement;
    const showMouse = () => {
      assist.checked = this.input.mouse.aimAssist;
      sens.value = String(this.input.mouse.sensitivity);
      sensVal.textContent = `${this.input.mouse.sensitivity.toFixed(1)}×`;
      zoomSens.value = String(this.input.mouse.zoomSensitivity);
      zoomSensVal.textContent = `${this.input.mouse.zoomSensitivity.toFixed(2)}×`;
      invert.checked = this.input.mouse.invertY;
    };
    showMouse();
    const mouseChanged = () => {
      this.input.mouse = { sensitivity: Number(sens.value) || 1, zoomSensitivity: Number(zoomSens.value) || 1, invertY: invert.checked, aimAssist: assist.checked };
      saveMousePrefs(this.input.mouse);
      showMouse();
    };
    sens.addEventListener('input', mouseChanged, { signal });
    zoomSens.addEventListener('input', mouseChanged, { signal });
    invert.addEventListener('change', mouseChanged, { signal });
    assist.addEventListener('change', mouseChanged, { signal });
    // The player's own blood switch; the map sets the colour and amount.
    // The performance overlay, and the report to paste when the game runs slowly.
    const perfBox = $('perf-overlay') as HTMLInputElement;
    perfBox.checked = this.showStats;
    perfBox.addEventListener('change', () => this.setShowStats(perfBox.checked), { signal });
    const reportBtn = $('perf-report') as HTMLButtonElement;
    const reportNote = $('perf-report-note');
    reportBtn.addEventListener(
      'click',
      () => {
        if (!this.perf.visible) {
          this.setShowStats(true);
          reportNote.textContent = 'Measuring now: play a minute (as when it was slow), then copy the report.';
          return;
        }
        const text = this.perf.report({
          renderer: this.opts.rendererKind,
          match: this.opts.transport.label,
          map: this.map?.metadata.name ?? '?',
          mode: this.rules?.mode ?? '?',
          players: this.view.avatarCount + 1,
          ping: `${this.opts.transport.rttMs.toFixed(0)} ms`,
        });
        void navigator.clipboard?.writeText(text).then(
          () => (reportNote.textContent = 'Copied: paste it into a message.'),
          () => (reportNote.textContent = 'Copying was blocked: select the report below and copy it.'),
        );
        const box = document.getElementById('perf-report-text') as HTMLTextAreaElement;
        box.value = text;
        box.hidden = false;
      },
      { signal },
    );
    // Record performance (a whole match, downloaded as a file on stop) and the 10 s trace (docs/PERF_TOOLS.md).
    const recordBtn = $('perf-record') as HTMLButtonElement;
    const recordNote = $('perf-record-note');
    recordBtn.addEventListener(
      'click',
      () => {
        if (this.recorder) {
          this.stopRecording();
          recordBtn.textContent = 'Start recording';
          recordNote.textContent = 'Saved to your downloads: send that file.';
          return;
        }
        this.recorder = new PerfRecorder(() => this.recorderContext());
        recordBtn.textContent = 'Stop and save';
        recordNote.textContent = 'Recording: play on. Stop here (or leave the match) to save the file.';
      },
      { signal },
    );
    const traceBtn = $('perf-trace') as HTMLButtonElement;
    traceBtn.addEventListener(
      'click',
      () => {
        if (traceBtn.disabled) return;
        traceBtn.disabled = true;
        recordNote.textContent = 'Tracing for 10 s: close this menu and play.';
        const x = this.recorderContext();
        void captureTrace(10, `tiletrigger-${fileStamp(x.map)}`, { map: x.map, mode: x.mode, players: x.players, renderer: x.renderer }).then((n) => {
          traceBtn.disabled = false;
          recordNote.textContent = `Trace saved to your downloads (${n} spans).`;
        });
      },
      { signal },
    );
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
    // Reduce flashing (also Options → Accessibility): on unless switched off, applied at once (reduceFlashing.ts).
    const flashBox = $('reduce-flashing') as HTMLInputElement;
    flashBox.checked = reduceFlashing();
    flashBox.addEventListener('change', () => saveReduceFlashing(flashBox.checked), { signal });
    window.addEventListener(REDUCE_FLASHING_EVENT, () => (flashBox.checked = reduceFlashing()), { signal });
    // A round landing in the level sounds like what it struck (its surface type's sound family: bark knocks, metal rings).
    this.sfx.worldImpact = (from, to) => {
      const struck = this.view.surfaceStruck(from, to);
      return impactSoundId(struck ? impactStyle(struck).sound : 'hard');
    };
    this.sfx.blockPresent = (i) => this.scenario?.present(i) ?? true;
    this.view.scenario.liquids.fx.onSplash = (at) => this.sfx.splash(at);
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
    // First person: full body or arms only (Options → Display), applied at once.
    window.addEventListener('tiletrigger:first-person', () => this.view.setFirstPersonMode(loadFirstPersonMode()), { signal });
    bindFullscreenButton($('pause-fullscreen') as HTMLButtonElement, signal);
    document.addEventListener('pointerlockchange', () => this.updatePause(), { signal });
    // Esc: in the game, the browser's own Esc releases the mouse and the menu opens (in fullscreen with
    // Keyboard Lock the page holds Esc, so the press releases the mouse here). In the menu, each press goes
    // back one level (dialog, then tab, then resume). A press the browser used (leaving fullscreen in Safari,
    // releasing the mouse) or a held Esc repeating does nothing more (fullscreen.ts browserTookEscape).
    window.addEventListener(
      'keydown',
      (e) => {
        const paused = !$('pause').hidden;
        if (paused && e.code !== 'Escape' && this.pauseMenu.key(e)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        if (e.code !== 'Escape') return;
        if (this.input.locked) {
          if (pageHoldsEscape() && !e.repeat) document.exitPointerLock();
          return;
        }
        if (!paused && this.voteHud?.open && !this.votePause) {
          // Over the vote: Esc opens the pause menu (Resume goes back to the vote).
          this.votePause = true;
          return this.updatePause();
        }
        if (!paused) return;
        // The menu takes this Esc: a dialog under it (the Bots window) doesn't also act on it.
        e.preventDefault();
        e.stopPropagation();
        if (browserTookEscape(e)) return;
        // Typing in a box: the first Esc only leaves the box.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes((t as HTMLInputElement).type)))) return t.blur();
        this.pauseMenu.back();
      },
      { signal, capture: true },
    );

    opts.transport.start(
      (m) => {
        if (!perfProbe.on) return this.onMessage(m);
        const t0 = performance.now();
        this.onMessage(m);
        const t1 = performance.now();
        perfProbe.msg += t1 - t0;
        if (perfProbe.trace) perfProbe.mark('tt:net in', t0, t1);
      },
      // The link closed by itself: after the welcome that's a lost connection (a sleeping phone, a network blip), not a refusal.
      (reason) => this.exit(reason, this.welcomed && !this.rejected ? 'lost' : undefined),
    );
  }

  /** The match took us in (welcome), and the server refused or removed us (reject): how an exit is reported. */
  private welcomed = false;
  private rejected = false;

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
    const was = $('pause').hidden;
    // The vote between matches holds the screen (the mouse is free to pick a map) until Esc asks for the menu.
    $('pause').hidden = this.input.locked || !this.local || this.closed || (!!this.voteHud?.open && !this.votePause);
    if (was && !$('pause').hidden) {
      this.drawPause(true);
      ($('resume') as HTMLButtonElement).focus({ preventScroll: true });
    }
  }

  /** What the pause menu shows about the match: its line (map, mode, time), the scores, your online state. */
  private drawPause(now = false): void {
    if ($('pause').hidden) return;
    const t = performance.now();
    if (!now && t - this.pauseDrawnAt < 500) return;
    this.pauseDrawnAt = t;
    this.hud.pauseContext();
    if (this.pauseMenu.tab === 'match') {
      this.hud.renderPauseScores($('pause-scores'), this.scores, this.slot, this.phase === 'intermission');
    }
    ($('pause-class') as HTMLButtonElement).hidden = !this.classesOn;
    this.drawSpectateButton();
  }

  /** The pause menu's Spectate / Join game button (only where the host supports it), and Respawn (not while spectating). */
  private drawSpectateButton(): void {
    const btn = $('pause-spectate') as HTMLButtonElement;
    btn.hidden = !this.canSpectate || !this.opts.transport.sendSpectate;
    btn.textContent = this.spectator ? 'Join game' : 'Spectate';
    btn.title = this.spectator ? 'Back into the match (J)' : 'Leave play and watch: follow players or fly a free camera. A bot plays in your place until you join again';
    ($('respawn-now') as HTMLButtonElement).hidden = this.spectator;
  }

  /** Ask the host to make you a spectator (on) or put you back in the game; the roster answers (`sp`). */
  private setSpectating(on: boolean): void {
    if (on === this.spectator || !this.canSpectate) return;
    this.opts.transport.sendSpectate?.(on);
  }

  /** The roster says you are (or are no longer) a spectator. */
  private spectatorChanged(on: boolean): void {
    this.spectator = on;
    this.specCam.reset();
    if (on && this.local) this.local.alive = false;
    this.hud.showMessage(on ? 'Spectating · J to join the game' : 'Back in the game', 3);
    this.drawSpectateButton();
  }

  /** For browser tests: what the out-of-play camera is doing. */
  private specState(): { spectator: boolean; can: boolean; out: boolean; killCam: number | null; killCamEnd: 'skipped' | 'over' | null; following: number; free: boolean; camera: Vec3; rule: SpectateRule } {
    const c = this.view.cameraPosition();
    return { spectator: this.spectator, can: this.canSpectate, out: this.outOfPlay, killCam: this.specCam.killCam()?.killer ?? null, killCamEnd: this.specCam.killCamEnd, following: this.specCam.following, free: this.specCam.free, camera: { x: c.x, y: c.y, z: c.z }, rule: this.spectateRule() };
  }

  /** Who you may watch and whether the free camera is yours (spectatorCam.ts spectateRule). */
  private spectateRule(): SpectateRule {
    const local = this.opts.transport instanceof LocalTransport;
    return spectateRule({ teamMode: !!this.rules && isTeamMode(this.rules.mode), pureSpectator: this.spectator, offline: local, runsMatch: local || this.hostState !== null });
  }

  /** Leave: when friends play in this hosted match, it ends for them too, so ask first. */
  private confirmLeave(): void {
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const friends = this.peerHost && local ? local.guests : 0;
    if (!friends) return this.exit();
    this.confirmBox('leave-confirm', 'Leave the match?', `You host this game: leaving ends it for ${friends === 1 ? 'your friend' : `${friends} friends`}.`, 'Leave', () => this.exit(), true);
  }

  /** A short confirm over the pause menu (Esc or Cancel closes it). */
  private confirmBox(id: string, title: string, text: string, yes: string, onYes: () => void, danger = false): void {
    if (document.getElementById(id)) return;
    const box = document.createElement('div');
    box.id = id;
    box.className = 'panel confirm';
    box.setAttribute('role', 'dialog');
    const h = document.createElement('h3');
    h.className = 'panel-title';
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.dataset.cancel = '1';
    cancel.id = id.replace('-confirm', '-cancel');
    const ok = document.createElement('button');
    ok.className = danger ? 'danger' : 'primary';
    ok.id = id.replace('-confirm', '-yes');
    ok.textContent = yes;
    const actions = document.createElement('div');
    actions.className = 'confirm-actions';
    actions.append(cancel, ok);
    box.append(h, p, actions);
    $('pause').append(box);
    cancel.addEventListener('click', () => (box.remove(), ($('resume') as HTMLButtonElement).focus()));
    ok.addEventListener('click', () => {
      box.remove();
      onYes();
    });
    ok.focus();
  }

  /** Open a join code for this match and show it (with an invite link) in the pause menu. */
  private async startHosting(btn: HTMLButtonElement, info: HTMLElement): Promise<void> {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || this.peerHost || this.offlineOnly) return;
    btn.disabled = true;
    btn.textContent = 'Opening a join code…';
    try {
      const host = (await loadSignaling()).host((link) => local.accept(link));
      this.peerHost = host;
      const code = await host.start();
      if (this.closed) return host.close();
      local.joinCode = code;
      await this.showHostInfo(btn, info, code);
    } catch (e) {
      this.peerHost = undefined;
      btn.disabled = false;
      btn.textContent = 'Host with code only (not listed)';
      this.hud.showMessage(`Couldn't host: ${(e as Error).message}`, 5);
    }
  }

  /** The join code and invite link in the pause menu (a new code, or one carried over a map change). */
  private async showHostInfo(btn: HTMLButtonElement, info: HTMLElement, code: string): Promise<void> {
    if (this.closed) return;
    const hubRelay = !!this.peerHost?.relay;
    this.relayOn = !!loadRelay() || hubRelay;
    const link = this.inviteLink(code);
    // "localhost" only works on this machine: friends need the address the game is served from.
    const onlyHere = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    const hubHere = /^(\w+:\/\/)?(localhost|127\.|\[::1\])/.test(hubSetting());
    btn.hidden = true;
    info.hidden = false;
    info.innerHTML = `<div class="host-code">Join code <b>${code}</b></div><input readonly value="${link}" /><button id="host-copy">Copy invite link</button><p class="hint">Friends open the link (or Online → Join by code). They take bots' places; with the link they join your side (your party), and stay together into the next map. Your browser runs the match: keep this tab open.${hubRelay ? ' The hub provides a relay, so friends on strict networks can connect too.' : loadRelay() ? ' The link carries your relay settings.' : ' If a friend gets &quot;couldn\'t connect&quot;, set a relay in Options and send a new link.'}</p>${hubHere ? '<p class="hint" style="color:#ffb03b">Your community hub is set to localhost, which other computers can\'t reach. Friends elsewhere: clear the hub (Online → Game browser → empty → Use) and host again. Same Wi-Fi: use your computer\'s network address for the hub.</p>' : ''}${phoneHost() ? '<p class="hint" style="color:#ffb03b">You\'re hosting from a phone or tablet: the match runs on it, so if its screen turns off or you switch apps it stops for everyone. Keep it awake and plugged in, or host from a computer (or a dedicated Host Service) for a game that keeps going.</p>' : ''}${onlyHere ? '<p class="hint" style="color:#ffb03b">This link says localhost, which only works on your computer. Friends on your network: open the game at your computer\'s network address (for example http://192.168.1.20:5173) and host from there; over the internet, host from the published site.</p>' : ''}`;
    info.querySelector('#host-copy')!.addEventListener('click', () => void navigator.clipboard?.writeText(link).then(() => this.hud.pickup('Invite link copied')));
    if (onlyHere) void this.lanInvite(info, code, link);
    this.hud.showMessage(`Hosting: join code ${code}`, 5);
    this.updateListing();
  }

  /** Any valid map may be listed publicly: our suite's as they are, others (MapMaker) labelled "Community map". */
  private get listable(): boolean {
    return !!this.map && !this.offlineOnly;
  }

  /** A browser test's deterministic match (testMode.ts): never hosted, listed or joined. */
  private get offlineOnly(): boolean {
    return this.opts.transport instanceof LocalTransport && this.opts.transport.testMode;
  }

  /** Not one of our suite's maps: listed as a community map, with its exact version (map/identity.ts). */
  private get community(): boolean {
    return !!this.map && !inSuite(this.map.metadata.id);
  }

  private identityFor?: { map: MapDocument; id: ReturnType<typeof mapIdentity> };
  /** The map's ID, version and content hash (hashed once per map). */
  private mapIdentity(): ReturnType<typeof mapIdentity> | null {
    if (!this.map) return null;
    if (this.identityFor?.map !== this.map) this.identityFor = { map: this.map, id: mapIdentity(this.map) };
    return this.identityFor.id;
  }

  /** The online controls and status badge, after any change (hosting, friends, listing). */
  private updateOnline(): void {
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const can = !!this.opts.hostable && !!local && !!this.map && !this.offlineOnly;
    const online = !!this.peerHost;
    const goOn = $('go-online') as HTMLButtonElement;
    const goOff = $('go-offline') as HTMLButtonElement;
    const note = $('online-note');
    const listed = online && ($('host-list') as HTMLInputElement).checked && !!this.advertiser;
    // The Host tab's foot: Offline | Host online, the one in effect lit. Online, the "List in the game browser" box lists or unlists it.
    $('pause-online-switch').hidden = !can;
    goOn.classList.toggle('on', online);
    goOff.classList.toggle('on', !online);
    goOn.setAttribute('aria-checked', String(online));
    goOff.setAttribute('aria-checked', String(!online));
    goOn.title = hubSetting() ? 'Host online: the match restarts and is listed in the game browser; friends also join with the code, taking bots\' places' : 'Host online: a join code and invite link for friends, who take bots\' places';
    const line = $('online-state-line');
    line.hidden = !can;
    line.textContent = online ? `${listed ? 'Online and listed' : 'Online, code only'}: friends join with the code or the invite link, taking bots' places.` : 'Offline: only you and your bots. Host online (at the bottom) lets friends join.';
    note.hidden = !can || !this.community || !hubSetting();
    note.textContent = this.community ? 'Not one of our own maps: it is listed as a "Community map".' : '';
    ($('host-list') as HTMLInputElement).disabled = !this.listable;
    ($('host-name') as HTMLInputElement).hidden = !($('host-list') as HTMLInputElement).checked;
    // Hosting online: a line in the Tab scoreboard (not over the score and clock).
    const where = online && local && this.peerHost ? `${listed ? 'Online · listed' : 'Online · code only'} · ${1 + local.guests}/${local.capacity} · code ${this.peerHost.code}${this.community ? ' · Community map' : ''}` : '';
    this.hud.onlineNote = where;
    // The Match tab says where you stand; the Host tab has the controls.
    const state = $('pause-online-state');
    state.hidden = !can;
    state.textContent = online ? `${where}. Host tab: invite link, Go offline.` : 'Offline: only you and bots. Host tab → Go online to let people join.';
    state.classList.toggle('on', online);
    this.pauseMenu.setTabVisible('host', !!local || this.hostPanel.controlling);
  }

  /** "Go online": a short confirm, then the match restarts and is listed (and joinable by code). */
  private confirmGoOnline(): void {
    if (!this.listable) return;
    this.confirmBox('online-confirm', 'Go online?', 'The match restarts on the same map and rules (scores reset) and is listed publicly in the game browser. Friends can also join with the code.', 'Go online', () => void this.goOnline(true));
  }

  /**
   * Host online, one path wherever it's chosen (the Host tab's switch, Match setup's, Host this map): a join code
   * for friends (shown in the Host tab), and the match listed publicly in the game browser when there's a community
   * hub to list it on (a match still loading lists once it has loaded); without a hub, the code only. `restart`: a
   * match under way starts over first, a fresh one for the public (scores reset, bots back to the host's count); a
   * match that is just starting is fresh already.
   */
  private async goOnline(restart: boolean): Promise<void> {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || !this.opts.hostable || this.offlineOnly) return;
    const first = !this.peerHost;
    if (first && restart) local.host({ c: 'restart' });
    if (hubSetting()) ($('host-list') as HTMLInputElement).checked = true;
    if (first) await this.startHosting($('host-game') as HTMLButtonElement, $('host-info'));
    else this.updateListing();
    this.updateOnline();
  }

  /** "Go offline": friends are told and disconnected, the listing and join code go; the match itself carries on. */
  private goOffline(): void {
    const local = this.opts.transport;
    if (!(local instanceof LocalTransport) || !this.peerHost) return;
    local.dropGuests('The host took the game offline');
    ($('host-list') as HTMLInputElement).checked = false;
    this.advertiser?.stop();
    this.advertiser = undefined;
    this.peerHost.close();
    this.peerHost = undefined;
    const btn = $('host-game') as HTMLButtonElement;
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Host with code only (not listed)';
    $('host-info').hidden = true;
    $('host-public-status').textContent = 'Offline: only you and your bots.';
    this.hud.showMessage('Offline: friends were disconnected and the listing removed', 4);
    this.updateOnline();
  }

  /** The pause menu's Match section: the offline player and the Host game host run their match; on a dedicated server, its admin. */
  private makeHostPanel(dedicated = false): HostPanel {
    const t = this.opts.transport;
    const local = t instanceof LocalTransport ? t : null;
    // A dedicated server: by WebSocket, or a Host Service joined by code (its welcome says so).
    const net = t instanceof NetTransport || (dedicated && !local && t.sendCommand) ? (t as Required<Pick<typeof t, 'sendCommand'>>) : null;
    const panel = new HostPanel(
      {
        command: (cmd) => {
          if (local) {
            if (cmd.c === 'rotation' || cmd.c === 'skip') return this.rotationCommand(cmd);
            const error = local.host(cmd);
            if (error) panel.setStatus(error, true);
          } else net?.sendCommand({ t: 'host', cmd });
        },
        // The foot's Resume: as the Match tab's (it asks for the mouse back).
        resume: () => ($('resume') as HTMLButtonElement).click(),
        ...((local ? this.opts.hostable : net) && this.opts.mapPicker ? { changeMap: () => this.openMapPicker() } : {}),
        ...(net ? { login: (token: string) => net.sendCommand({ t: 'admin', token }) } : {}),
        // The map rotation: kept by this browser (not in a playlist, whose wins move it on), or by the server (when it has one).
        ...(this.opts.mapPicker && ((local && this.opts.hostable && this.opts.rotation && !this.opts.chain) || net) ? { rotation: { add: () => this.openMapPicker('rotation'), presets: ROTATION_PRESETS } } : {}),
      },
      net ? 'Admin' : 'Host',
    );
    panel.root.hidden = true;
    $(net ? 'pause-admin-slot' : 'pause-host-slot').append(panel.root);
    // Its foot (Resume, Apply) leads the pause menu's foot while the Host tab is open.
    $('pause-host-foot').prepend(panel.foot);
    panel.setMap(this.map);
    if (local) this.showRotation(panel);
    // The Host tab's Online block sits at the top of the panel's first column.
    const online = document.getElementById('pause-online-box');
    const tab = document.querySelector<HTMLElement>('#pause .pause-sec[data-sec="host"]');
    if (local && online && tab) panel.setLead(online, tab);
    return panel;
  }

  /** This browser's rotation, if it keeps one here (offline, Host game; not a playlist or MapMaker TEST). */
  private get ownRotation(): NonNullable<SessionOptions['rotation']> | null {
    return this.opts.transport instanceof LocalTransport && this.opts.hostable && !this.opts.chain ? (this.opts.rotation ?? null) : null;
  }

  /** The panel shows the rotation, and the match knows where it goes next (everyone's end-of-match scoreboard says so). */
  private showRotation(panel = this.hostPanel): void {
    const r = this.ownRotation;
    const t = this.opts.transport;
    if (!r || !(t instanceof LocalTransport)) return;
    const name = (id: string) => r.info(id)?.name ?? id;
    panel.setRotation({ ...r.list.state(name), vote: r.vote.get() });
    const up = r.list.peek();
    t.setUpNext(up ? { map: name(up.entry.map), mode: up.entry.mode } : null);
  }

  /** The host changed this browser's rotation (the list, shuffle), or skipped to its next map. */
  private rotationCommand(cmd: RotationCommand): void {
    const r = this.ownRotation;
    if (!r) return;
    if (cmd.c === 'skip') return void this.skipRotation();
    if (cmd.entries) {
      // Our suite only, each in a mode it plays (as a server checks it).
      const v = validateRotation(cmd.entries, r.info);
      if (cmd.entries.length && !v.entries.length) return this.hostPanel.setStatus(`None of those can be played: ${v.dropped.join('; ')}`, true);
      const s = this.hostState;
      r.list.set(v.entries, s ? { map: s.map, mode: s.mode } : null);
    }
    if (cmd.shuffle !== undefined) r.list.setShuffle(cmd.shuffle);
    if (cmd.vote !== undefined) r.vote.set(cmd.vote);
    this.hostPanel.setStatus('');
    this.showRotation();
  }

  /** Skip to next: the rotation's next map now (as Change map does). */
  private async skipRotation(): Promise<void> {
    const r = this.ownRotation;
    const up = r?.list.peek();
    if (!r || !up || this.travel) return;
    const map = await r.load(up.entry.map);
    if (this.closed || this.travel) return;
    if (!map) return this.hostPanel.setStatus(`${r.info(up.entry.map)?.name ?? up.entry.map} didn't load`, true);
    r.list.advance();
    this.changeMap(map, up.entry.mode);
  }

  /**
   * A match ended with nowhere else to go, the host's vote is on: two or three of our maps that fit the people here
   * (the rotation's next first; sim/mapVote.ts), and the match holds the scoreboard while everyone votes. False when
   * there's no vote to have (off, not this browser's match, fewer than two maps fit): the rotation goes on as before.
   */
  private openVote(): boolean {
    const r = this.ownRotation;
    const t = this.opts.transport;
    if (!r || !(t instanceof LocalTransport) || !r.vote.get() || !this.rules || !this.map) return false;
    const people = Math.max(1, (this.lastRoster ?? []).filter((p) => !p.bot).length);
    const ahead = r.list.upcomingEntries().flatMap((e) => r.pool(e.mode).filter((c) => c.map === e.map));
    const options = pickVoteOptions({ rotation: ahead, suite: r.pool(this.rules.mode), current: this.map.metadata.id, people });
    if (options.length < 2) return false;
    t.openVote(options);
    return true;
  }

  /** The vote as the host sends it: the cards under the scoreboard, the mouse freed to pick; the winner, then (hosting) the travel. */
  private voteMessage(v: VoteState | null): void {
    const hud = this.voteHud;
    if (!hud) return;
    const was = hud.open;
    hud.update(v);
    if (v && !was) {
      // The mouse is free to pick a map (the menu stays away until Esc).
      this.votePause = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    // The scoreboard's line: the vote while it's open, then where everyone goes.
    const lead = hud.leader();
    this.hud.nextMap = v && v.w === undefined ? 'Voting on the next map' : lead && v ? nextMapLine(lead.map, lead.mode) : this.hud.nextMap;
    if (v?.w !== undefined) void this.voteWon(v);
    this.updatePause();
  }

  /** This browser runs the match and the vote closed: everyone to the winner, with the host's settings (as the rotation goes). */
  private async voteWon(v: VoteState): Promise<void> {
    const r = this.ownRotation;
    const t = this.opts.transport;
    const won = v.o[v.w!];
    if (!r || !(t instanceof LocalTransport) || !won || this.travel || this.voteTravelling) return;
    this.voteTravelling = true;
    const t0 = performance.now();
    const map = await r.load(won.map);
    const s = this.hostState;
    const live = t.liveRules() ?? this.rules;
    const rules = live && withPending(live, s?.pending);
    this.voteTravelling = false;
    if (this.closed || this.travel || !s || !rules) return;
    if (!map) return void console.warn(`vote: ${won.map} didn't load; the match replays`);
    // A rotation map: the rotation carries on after it.
    r.list.moveTo(won);
    const next = rulesForTravel(rules, map, s.fill, won.mode, s.teamSize);
    this.travel = { host: { map, rules: next.rules, fill: next.fill, skill: s.skill, botSet: s.mapBots ? null : (s.botSet ?? null) } };
    this.showRotation();
    window.setTimeout(() => !this.closed && this.exit('travel'), Math.max(0, VOTE_RESULT_SECONDS * 1000 - (performance.now() - t0)));
  }

  /** An invite link to this match: its code, the hub and relay friends need, and your party (they join your side). */
  private inviteLink(code: string): string {
    const q = new URLSearchParams(location.search);
    const peer = q.get('peer');
    // Friends must use the same broker: carry the hub unless it's the site's built-in one.
    const hub = hubSetting() && hubSetting() !== builtHub() ? hubSetting() : null;
    return `${location.origin}${location.pathname}?join=${code}&party=${myParty()}${peer ? `&peer=${encodeURIComponent(peer)}` : ''}${hub ? `&hub=${encodeURIComponent(hub)}` : ''}${relayParams()}`;
  }

  /** Joined a friend's game by code: the Match tab's invite link, so you can bring more friends (they join your party). */
  private showInvite(): void {
    const box = document.getElementById('pause-invite');
    const code = this.opts.joinCode;
    if (!box) return;
    box.hidden = !code;
    if (!code) return box.replaceChildren();
    const link = this.inviteLink(code);
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = link;
    input.id = 'pause-invite-link';
    const copy = document.createElement('button');
    copy.id = 'pause-invite-copy';
    copy.textContent = 'Copy invite link';
    copy.addEventListener('click', () => void navigator.clipboard?.writeText(link).then(() => this.hud.pickup('Invite link copied')));
    const head = document.createElement('div');
    head.className = 'host-code';
    head.innerHTML = `Invite friends · code <b>${code}</b>`;
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = "Friends who open your link join this match on your side (your party), taking bots' places; the party stays together into the next map.";
    box.replaceChildren(head, input, copy, hint);
  }

  /** A match ended with nowhere else to go: after the scoreboard, the rotation's next map (an empty rotation replays). */
  private rotating = false;
  private async rotateOn(): Promise<void> {
    const r = this.ownRotation;
    const t = this.opts.transport;
    let up = r?.list.peek();
    if (!r || !up || !(t instanceof LocalTransport) || this.travel || this.rotating) return;
    this.rotating = true;
    const t0 = performance.now();
    // Before the match starts itself over (the page hears of the end a little after the match).
    const wait = Math.max(1000, ((this.rules?.intermissionTicks ?? 300) / TICK_RATE) * 1000 - 1500);
    let map = await r.load(up.entry.map);
    // Past maps too small for the people here (the mode's player cap: MapMaker's, else the automatic one).
    const people = Math.max(1, (this.lastRoster ?? []).filter((p) => !p.bot && !p.sp).length);
    for (let tries = r.list.entries.length; map && tries > 1 && mapPlayerCaps(map, up.entry.mode).max < people; tries--) {
      r.list.advance();
      up = r.list.peek()!;
      map = await r.load(up.entry.map);
    }
    const s = this.hostState;
    // The next match: what plays now, with the rules the host saved for it.
    const live = t.liveRules() ?? this.rules;
    const rules = live && withPending(live, s?.pending);
    this.rotating = false;
    if (this.closed || this.travel || !s || !rules) return;
    if (!map) return void console.warn(`rotation: ${up.entry.map} didn't load; the match replays`);
    r.list.advance();
    const next = rulesForTravel(rules, map, s.fill, up.entry.mode, s.teamSize);
    this.travel = { host: { map, rules: next.rules, fill: next.fill, skill: s.skill, botSet: s.mapBots ? null : (s.botSet ?? null) } };
    this.showRotation();
    window.setTimeout(() => !this.closed && this.exit('travel'), Math.max(0, wait - (performance.now() - t0)));
  }

  /** Change map (or add one to the rotation): the front end's map cards (our suite only on servers, in Host game and for rotations). */
  private openMapPicker(purpose: 'change' | 'rotation' = 'change'): void {
    const s = this.hostState;
    if (!s || !this.opts.mapPicker || this.mapPicker) return;
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    const close = () => {
      this.mapPicker?.remove();
      this.mapPicker = null;
    };
    this.mapPicker = this.opts.mapPicker({
      mode: s.mode,
      current: s.map,
      suiteOnly: !local || !!this.peerHost || purpose === 'rotation',
      ...(purpose === 'rotation' ? { title: 'Add to rotation' } : {}),
      onClose: close,
      onPick: (map, mode) => {
        close();
        if (purpose === 'rotation') this.addToRotation(map, mode);
        else this.changeMap(map, mode);
      },
    });
    $('pause').append(this.mapPicker);
  }

  /** The host picked a map for the end of the rotation (the whole list goes, as every rotation change does). */
  private addToRotation(map: MapDocument, mode: GameMode): void {
    const entry = { map: map.metadata.id, mode };
    const own = this.ownRotation;
    const now = own ? own.list.entries : (this.hostState?.rotation?.entries ?? []);
    const cmd: RotationCommand = { c: 'rotation', entries: [...now.map((e) => ({ map: e.map, mode: e.mode })), entry] };
    if (own) return this.rotationCommand(cmd);
    this.opts.transport.sendCommand?.({ t: 'host', cmd });
  }

  /**
   * The host picked a map. Dedicated server: ask it (it checks the map is ours
   * and sends everyone `travel`). In the browser: tell everyone, then restart
   * the match there with the same rules and players; Host game friends follow.
   */
  private changeMap(map: MapDocument, mode: GameMode): void {
    const s = this.hostState;
    const t = this.opts.transport;
    if (!s || this.travel) return;
    if (!(t instanceof LocalTransport)) {
      t.sendCommand?.({ t: 'host', cmd: { c: 'map', map: map.metadata.id, mode } });
      this.hostPanel.setStatus(`Changing map to ${map.metadata.name}…`);
      return;
    }
    const live = t.liveRules() ?? this.rules;
    if (!live) return;
    // A new match there: the rules the host saved for the next match go along.
    const next = rulesForTravel(withPending(live, s.pending), map, s.fill, mode, s.teamSize);
    t.notice(travelNotice(map.metadata.name, next.rules.mode));
    this.travel = { host: { map, rules: next.rules, fill: next.fill, skill: s.skill, botSet: s.mapBots ? null : (s.botSet ?? null) } };
    window.setTimeout(() => this.exit('travel'), 1200);
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

  /** Seconds in a row this browser's own match fell behind or rendered slowly (see noteIfSlow); -1 once noted. */
  private slowSeconds = 0;

  /**
   * A big match in this browser (offline, Host game) on a device that can't keep
   * up: after a few seconds of the match falling behind real time or frames
   * crawling, one quiet line says what helps. Nothing otherwise.
   */
  /** Show or hide the performance overlay (and remember it). */
  private setShowStats(on: boolean): void {
    this.showStats = on;
    savePerfOverlay(on);
    const box = document.getElementById('perf-overlay') as HTMLInputElement | null;
    if (box) box.checked = on;
  }

  private noteIfSlow(stats: Extract<ServerMessage, { t: 'stats' }>): void {
    // Not in a browser test's match: on CI's software-rendered page every match is "heavy", and the advice took the
    // announcer's line from the check reading it (ctf: "the announcer calls it").
    if (this.slowSeconds < 0 || !(this.opts.transport instanceof LocalTransport) || this.offlineOnly) return;
    const slow = !document.hidden && (stats.lateTicks > 12 || this.frameMs > 50);
    this.slowSeconds = slow ? this.slowSeconds + 1 : 0;
    if (this.slowSeconds < 5) return;
    this.slowSeconds = -1;
    const players = stats.humans + stats.bots;
    this.hud.showMessage(`This device is finding ${players} players heavy: fewer bots, or lower graphics in Options, will help.`, 6);
  }

  /** Set when a chain moves on (see Travel). */
  private travel: Travel | null = null;
  private dedicatedPanel = false;
  private lastRoster: RosterEntry[] | null = null;
  /** The roster's people other than you, for the host's kick and ban buttons. */
  private peopleIn(players: readonly RosterEntry[]): { slot: number; name: string }[] {
    return players.filter((p) => !p.bot && p.slot !== this.slot).map((p) => ({ slot: p.slot, name: p.name }));
  }

  /** The match's teams' IDs in order (team modes), for counting the people on each. */
  private teamIds: string[] | null = null;

  /** People on each team besides you, and your team (team modes; spectators are on none): the Host tab's teams read "You + 6 bots". */
  private teamPeople(players: readonly RosterEntry[]): { others: number[]; you: number | null } | null {
    const ids = this.teamIds;
    if (!ids) return null;
    const others = ids.map(() => 0);
    let you: number | null = null;
    for (const p of players) {
      const i = p.bot || p.sp || p.team === null ? -1 : ids.indexOf(p.team);
      if (i < 0) continue;
      if (p.slot === this.slot) you = i;
      else others[i]!++;
    }
    return { others, you };
  }

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
    if (!box.checked || !host?.code || !(local instanceof LocalTransport) || !this.listable) {
      this.advertiser?.stop();
      this.advertiser = undefined;
      status.textContent = !this.listable && this.map ? 'Not listed.' : box.checked ? 'Will be listed once you host (Go online, or Host with code).' : 'Friends only: share the code or link.';
      this.updateOnline();
      return;
    }
    if (this.advertiser) return;
    // Listed under your name: wait for the roster that says it (a match hosted from the start lists as it loads).
    if (!this.lastRoster) {
      status.textContent = 'Listing as the match starts…';
      return;
    }
    const me = this.hud.name(this.slot);
    const show = () => (status.textContent = this.advertiser?.error ? `Not listed: ${this.advertiser.error}` : 'Listed: anyone can join from Online → Game browser.');
    this.advertiser = new LobbyAdvertiser(
      () => ({
        code: host.code,
        name: ($('host-name') as HTMLInputElement).value.trim() || `${me}'s game`,
        host: me,
        map: this.map?.metadata.name ?? 'Unknown map',
        ...(this.community && this.mapIdentity()
          ? { community: true, mapId: this.mapIdentity()!.mapId, versionId: this.mapIdentity()!.versionId, contentHash: this.mapIdentity()!.contentHash }
          : { mapId: this.map?.metadata.id }),
        mode: this.rules?.mode ?? 'core.deathmatch',
        players: 1 + local.guests,
        max: local.capacity,
        relay: this.relayOn,
        region: myRegion(),
      }),
      show,
      // The match knows its listing's name (a successor lists the match under it if this browser goes); the page keeps its secret.
      (id, secret) => local.setListing(id ? { name: ($('host-name') as HTMLInputElement).value.trim() || `${me}'s game`, id, secret } : null),
    );
    this.advertiser.start();
    show();
    this.updateOnline();
  }

  exit(reason?: string, how?: 'lost' | 'rejected'): void {
    if (this.closed) return;
    this.closed = true;
    // A recording running when the match ends is saved, not lost.
    this.stopRecording();
    perfProbe.use('overlay', false);
    this.advertiser?.stop();
    const local = this.opts.transport instanceof LocalTransport ? this.opts.transport : null;
    if (reason === 'travel' && this.travel && this.peerHost && local) {
      // Host game: friends get `travel` and rejoin the same code, which the next match takes over.
      local.travelGuests(this.travel.host?.map.metadata.name ?? this.travel.id ?? 'the next map');
      const listed = ($('host-list') as HTMLInputElement).checked;
      this.travel.hosting = { peer: this.peerHost, ...(listed ? { listing: ($('host-name') as HTMLInputElement).value } : {}) };
    } else if (this.peerHost && local?.guests) {
      // Friends are told we're leaving (bye) before the join code goes, which closes their links.
      local.sayGoodbye();
      const peer = this.peerHost;
      window.setTimeout(() => peer.close(), 1500);
    } else this.peerHost?.close();
    // The standings as they were (before the HUD goes), for a screen after the match (the host left).
    const end: SessionEnd | undefined = this.welcomed && this.welcomeMap && this.rules ? { board: this.hud.boardData(this.scores, this.slot, true), map: this.welcomeMap, rules: this.rules, fill: Math.max(2, this.lastRoster?.length ?? 2) } : undefined;
    this.hostPanel.remove();
    this.wheel.dispose();
    this.orderWheel.dispose();
    this.touch?.dispose();
    this.mapPicker?.remove();
    document.getElementById('online-confirm')?.remove();
    document.getElementById('leave-confirm')?.remove();
    $('pause-scores').replaceChildren();
    if (document.pointerLockElement) document.exitPointerLock();
    this.opts.transport.close();
    this.abort.abort();
    this.input.dispose();
    this.opts.audio.stopAll();
    this.modeHud?.dispose();
    this.forts?.dispose();
    this.rouletteHud?.dispose();
    this.awardsHud?.dispose();
    this.voteHud?.dispose();
    this.voteHud = null;
    this.coach?.dispose();
    document.getElementById('pause-skip-tutorial')?.remove();
    this.hud.hide();
    $('pause').hidden = true;
    this.view.dispose();
    this.opts.onExit(reason, this.travel ?? undefined, how ?? (this.rejected ? 'rejected' : undefined), end);
  }

  /** The map as the welcome brought it (before this page added anything to it), for hosting the match again. */
  private welcomeMap: MapDocument | null = null;

  private onMessage(msg: ServerMessage): void {
    if (this.closed) return;
    switch (msg.t) {
      case 'welcome': {
        this.welcomed = true;
        this.welcomeMap = msg.map;
        // The track's ambient NPC cars join the map's own mounts, as on the server.
        const loaded = loadMap(withTrackVehicles(msg.map));
        if (!loaded.ok) {
          this.exit(`invalid map: ${loaded.issues[0]?.message}`);
          return;
        }
        this.slot = msg.slot;
        this.hud.self = msg.slot;
        if (this.markers.ally !== 'team') this.hud.partyColor = this.markers.ally;
        this.rules = msg.rules;
        // Grenades wear the weapon set's looks (the Military frag, the Sci-fi smoke canister) before the map's pickups are drawn.
        this.view.setWeaponSetLook(weaponSetInPlay(msg.rules, loaded.map)?.id);
        // The match's weather (the host's choice, else the map's), fixed while it plays.
        this.applyWeather(msg.rules, loaded.map);
        this.canSpectate = msg.spectate === 1;
        this.drawSpectateButton();
        this.freeBounds = freeCamBounds(loaded.map);
        if (msg.lan?.length) this.showLanAddresses(msg.lan);
        // A Host Service joined by code has an admin login, as a dedicated server does.
        if (msg.dedicated && !(this.opts.transport instanceof NetTransport) && !(this.opts.transport instanceof LocalTransport) && !this.dedicatedPanel) {
          this.dedicatedPanel = true;
          this.hostPanel.remove();
          this.hostPanel = this.makeHostPanel(true);
          if (this.lastRoster) this.hostPanel.setPeople(this.peopleIn(this.lastRoster), this.teamPeople(this.lastRoster));
        }
        const teams = isTeamMode(msg.rules.mode) ? matchTeams(loaded.map, msg.rules) : null;
        this.teamIds = teams?.map((t) => t.id) ?? null;
        this.hud.setTeams(teams);
        this.hud.setBoardMode(msg.rules.mode);
        this.hud.setModeLabel(msg.rules.mode === 'core.coop' ? 'Co-op Mission' : rouletteOn(msg.rules) && msg.rules.mode !== 'core.roulette' ? `Roulette: ${MODE_LABELS[msg.rules.mode]}` : (MODE_LABELS[msg.rules.mode] ?? 'Deathmatch'));
        this.hud.waitLabel = msg.rules.mode === 'core.zombies' ? 'Down: back at the next wave' : 'Respawning…';
        // Classes: the class screen opens as you join (and whenever you're down).
        this.classesOn = classesInPlay(msg.rules);
        this.input.classCount = this.classesOn ? CLASS_IDS.length : 0;
        this.input.classMenu = this.classesOn;
        this.hud.setMapName(loaded.map.metadata.name);
        this.sfx.myTeam = () => this.hud.team(this.slot)?.id ?? null;
        this.hud.minimap.setMap(loaded.map);
        void this.opts.portrait?.then((src) => this.portraitLook === null && this.hud.setPortrait(src), () => undefined);
        const geometry = buildMapGeometry(loaded.map);
        this.map = loaded.map;
        this.hostPanel.setMap(loaded.map);
        this.view.buildMap(loaded.map, geometry);
        if (teams && (msg.rules.mode === 'core.ctf' || msg.rules.mode === 'core.forts' || msg.rules.mode === 'core.koth' || msg.rules.mode === 'core.elim' || msg.rules.mode === 'core.bomb' || msg.rules.mode === 'core.hostage' || msg.rules.mode === 'core.breakthrough')) this.modeHud = new ModeHud(this.hud, this.view, loaded.map, teams, msg.rules.mode, () => this.slot);
        // The end-of-match awards and the revenge and nemesis callouts (every mode: awardsHud.ts).
        this.awardsHud?.dispose();
        this.awardsHud = new AwardsHud(this.hud, () => this.slot);
        // Between matches: the vote on the next map (hosts that have one send it; mapVoteHud.ts).
        this.voteHud?.dispose();
        this.voteHud = new MapVoteHud((i) => this.opts.transport.sendVote?.(i), (id) => this.opts.mapPicture?.(id) ?? null);
        this.showInvite();
        if (rouletteOn(msg.rules)) {
          // Roulette: its HUD, outlines in the team's colour (its Teams variant) and a jackpot's glow, warmed up at loading.
          this.rouletteHud = new RouletteHud(this.hud, this.input, loaded.map, () => this.rules, () => this.slot, this.opts.portraitOf);
          this.view.auraWarm = true;
          this.view.auraOf = (slot) => {
            const outline = this.rules?.teamOutlines ? (this.hud.team(slot)?.color ?? null) : null;
            const glow = this.rlJackpot.has(slot) ? '#ffc93c' : null;
            return outline || glow ? { outline, glow } : null;
          };
        }
        // Lunar: floaty ragdolls (the effects world falls as slowly as the match).
        if (msg.rules.lunar) this.view.setEffectsGravity(matchPhysics(msg.rules, loaded.map).gravity);
        this.sfx.setMap(loaded.map);
        this.sfx.joined();
        const physics = new PhysicsWorld(geometry, mapTerrainMesh(loaded.map), environmentShapes(loaded.map));
        this.local = new LocalPlayer(physics);
        this.local.pads = mapPads(loaded.map.entities, msg.rules.lunar ? LUNAR_PAD_BOOST : 1);
        this.local.ladders = mapLadders(loaded.map.entities);
        this.local.ziplines = mapZiplines(loaded.map.entities);
        this.local.team = () => this.hud.team(this.slot)?.id ?? (this.rules?.mode === 'core.coop' ? 'players' : null);
        this.local.scale = this.sizeOf(this.slot);
        this.local.gravity = matchPhysics(msg.rules, loaded.map).gravity;
        this.local.rules = { ...(msg.rules.ballistics ? { ballistics: msg.rules.ballistics } : {}) };
        this.local.liquids = mapLiquids(loaded.map.entities);
        this.local.gravityZones = mapGravityZones(loaded.map.entities);
        this.local.portals = mapPortals(loaded.map.entities);
        // Spawns, portals, jump pads and ziplines read off everyone's movement, for their effects (content/vfx.json map.gameplay).
        this.fxWatch = new GameplayFxWatch(this.local.pads, this.local.portals, (key, at) => this.view.playGameplayFx(key, at));
        this.scenario = new ScenarioState(loaded.map, physics);
        if (this.scenario.movers.defs.length) this.local.platforms = this.scenario;
        if (this.local.portals.length) this.local.portalOn = this.scenario.portalOn;
        this.mounts = new MountState(loaded.map, physics);
        this.covers = new CoverState(this.view.scene, physics, (at) => this.view.debris(at, '#b39b6b', 0.7));
        if (teams && msg.rules.mode === 'core.forts') this.forts = new FortsClient(this.view, physics, loaded.map, teams, () => this.hud.team(this.slot)?.id ?? null, this.opts.audio);
        this.scenario.apply(msg.sc);
        this.hud.show();
        this.hud.npcName = (id) => this.npcLook(id)?.label;
        this.updatePause();
        // Hosting since before the match had loaded (Host this map, a handoff, a map change): list it now that it can be.
        if (this.peerHost) this.updateListing();
        this.updateOnline();
        (window as unknown as { __cs: unknown }).__cs = { slot: this.slot, hud: this.hud, renderer: this.opts.rendererKind, local: this.local, view: this.view, input: this.input, wheel: this.wheel, orderWheel: this.orderWheel, squad: () => ({ led: this.squadLed, order: this.squadOrder, hud: this.squadHud.current }), mode: this.modeHud, transport: this.opts.transport, mounts: this.mounts, forts: this.forts, phase: () => this.phase, rideView: () => this.rideView, host: () => this.hostState, rules: () => this.rules, roulette: () => this.rouletteHud?.debug(), awards: () => this.awardsHud?.debug(), vote: () => this.voteHud?.debug() ?? null, showAwards: (aw: MatchAward[]) => this.awardsHud?.show(aw), heavyOverlay: () => this.hud.heavyOverlay(), rouletteGlow: () => this.rouletteHud?.glowOverlay() ?? null, rouletteHold: (on: boolean) => void (this.rouletteHud && (this.rouletteHud.hold = on)), jackpotGlow: () => this.testJackpot(), timeLeft: () => this.timeLeft, map: loaded.map.metadata.id, spec: () => this.specState(), spectate: (on: boolean) => this.setSpectating(on), thirdPerson: () => this.thirdPerson, tpAim: () => this.tpAim, viewTick: () => this.interp.renderTick(), lifeKills: this.lifeKills, damageNumbers: this.damageNumbers, spray: this.spray };
        this.opts.onReady?.();
        if (this.opts.greeting) this.hud.showMessage(this.opts.greeting, 6);
        void this.prepareMatch();
        break;
      }
      case 'reject':
        this.rejected = true;
        this.exit(msg.reason, 'rejected');
        break;
      case 'roster':
        this.hud.setRoster(msg.players);
        this.lastRoster = msg.players;
        this.hostPanel.setPeople(this.peopleIn(msg.players), this.teamPeople(msg.players));
        if (this.peerHost) {
          // Hosting from the start: the listing waited for your name (updateListing).
          if (!this.advertiser) this.updateListing();
          this.updateOnline();
        }
        if ((msg.players.find((p) => p.slot === this.slot)?.sp === 1) !== this.spectator) this.spectatorChanged(!this.spectator);
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
        if (netProbe.on) {
          const at = netProbe.inputAt.get(msg.ack);
          if (at !== undefined) {
            netProbe.ackMs.push(performance.now() - at);
            for (const seq of netProbe.inputAt.keys()) if (seq <= msg.ack) netProbe.inputAt.delete(seq);
          }
        }
        if (msg.ld) this.view.setLeaders(new Set(msg.ld.filter((s) => s >= 0)));
        this.hud.setLeaders(msg.ld);
        if (msg.fs || this.squadHud.current) this.squadSnapshot(msg.fs, msg.players);
        this.hud.setLife(msg.players);
        this.zones = msg.zn ?? [];
        this.mounts?.apply(msg.mt, msg.tick);
        for (const at of this.mounts?.takeCharges() ?? []) this.sfx.sentryCharge(at);
        this.mounts?.applySuspension(msg.ms);
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
        this.pickupItems = new Map(msg.pw ?? []);
        this.drops = msg.dw ?? [];
        this.modeHud?.snapshot(msg.md);
        this.forts?.apply(msg.md);
        this.zombieHud(msg.md?.zb);
        this.awardsHud?.phase(msg.phase);
        this.shieldNote(((this.localStatus & FX_PROTECTED) !== 0) && msg.phase === 'playing');
        if (this.rouletteHud) {
          // Lunar's gravity storm: prediction falls as the match does, ragdolls too; the warning's countdown.
          this.rouletteHud.stormSnapshot(msg.rl);
          if (msg.rl && this.local) {
            const g = msg.rl[2] / 100;
            if (this.local.gravity !== g) {
              this.local.gravity = g;
              this.view.setEffectsGravity(g);
            }
          }
          const kept = msg.hold ? [...this.rlJackpot].filter((slot) => msg.hold!.includes(slot)) : [];
          this.rlJackpot = new Set([...kept, ...msg.players.filter((p) => ((p.fx ?? 0) & FX_JACKPOT) !== 0).map((p) => p.s)]);
          const mine = msg.players.find((p) => p.s === this.slot);
          this.rouletteHud.state(msg.me?.rp, mine ? mine.alive === 1 : true, msg.phase);
          this.rouletteHud.phase(msg.phase);
        }
        // Door and crate colliders first, so reconciliation replays against the same world as the server.
        this.scenario?.apply(msg.sc);
        const me = msg.players.find((p) => p.s === this.slot);
        if (me && this.local) {
          if (!me.alive && this.local.alive && this.classesOn) this.input.classMenu = true;
          if (me.alive && !this.local.alive) {
            this.input.yaw = me.yaw;
            // The first life looks where the server put it (MapMaker's Play from here: up or down as the camera
            // looked; otherwise level); every later one level.
            this.input.pitch = this.livedBefore ? 0 : me.pitch;
            this.livedBefore = true;
            this.wantWeapon = 0;
          }
          this.local.reconcile(me, msg.ack, msg.me, msg.tick);
          this.damageNumbers.take(msg.me?.dd, performance.now());
          // A switch the server has made is done: stop asking for it, or every input would take back the server's
          // own switches (a better gun picked up, a thrown spear caught, `__give`).
          if (this.wantWeapon && me.w === this.wantWeapon) this.wantWeapon = 0;
        }
        this.botStates = msg.players.filter((p) => p.st).map((p) => `  ${this.hud.name(p.s).padEnd(14)} ${p.st}`);
        let poses: ReturnType<Interpolator['sample']> | undefined;
        const posesNow = () => (poses ??= this.interp.sample());
        for (const ev of msg.ev) {
          // Random characters: this life's look (the roster has the one they had when it was sent).
          if (ev.e === 'spawn' && this.rouletteHud) {
            // Roulette: this life's roll (a tiny body is drawn and predicted smaller), and the cards it is dealt next,
            // loaded now so a spawn never waits on a download.
            if (ev.j === 2) this.rlTiny.add(ev.s);
            else this.rlTiny.delete(ev.s);
            (ev.nx ?? []).forEach((look, i) => {
              if (this.rlLoaded.has(look)) return;
              // The next card now (and in the loading gate's warm-up); the ones after it once the match is under way.
              if (i > 0 && this.rlLater) return void this.rlLater.push(look);
              this.rlLoaded.add(look);
              if (i === 0 && this.rlLater) this.rlUpcoming.add(look);
              void this.view.characters.preload({ look });
            });
          }
          if (ev.e === 'spawn' && ev.l) this.relook(ev.s, ev.l);
          else if (ev.e === 'spawn' && this.rouletteHud && ev.s === this.slot && this.local) this.local.scale = this.sizeOf(this.slot);
          if (ev.e === 'spawn' && this.rouletteHud && ev.s === this.slot) this.rouletteHud.spawned(this.looks.get(this.slot) ?? ev.l ?? '', ev.j);
          if (ev.e === 'rl' && ev.a === 'swap' && ev.s !== undefined && ev.l) this.relook(ev.s, ev.l);
          if (ev.e === 'rl') this.rouletteHud?.event(ev);
          if (ev.e === 'awards' || ev.e === 'callout') this.awardsHud?.event(ev);
          if (ev.e === 'kill') this.streakMoment(ev, posesNow);
          // In a background tab nothing draws, so effects would only pile up (blood, bullets,
          // sounds) and all land at once when you come back: skip the purely visual ones.
          if (document.hidden && VISUAL_EVENTS.has(ev.e)) continue;
          if (!document.hidden) this.sfx.event(ev, posesNow, performance.now());
          this.modeHud?.event(ev);
          if (ev.e === 'hurt') this.hurtMoment(ev);
          if (ev.e === 'shot') {
            const def = CORE_WEAPONS[ev.w];
            const mine = ev.s === this.slot;
            const eye = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
            const muzzle = mine ? null : this.view.muzzleOf(ev.s);
            const color = def?.view.tracer ?? '#ffd36b';
            const strength = Math.min(2.5, Math.max(0.6, ((ev.alt ? def?.alt?.damage : undefined) ?? def?.damage ?? 20) / 25));
            if (def?.grapple) {
              // The rope, from the launcher's muzzle out to the hook: yours from the gun in your hands (first person's
              // viewmodel, or your character's in third person), not from the eye (it seemed to leave your chest).
              const t = ev.to[0];
              // It stays on the muzzle while the hook pulls you in.
              const slot = ev.s;
              const muzzleNow = () => (mine ? (this.view.localMuzzle() ?? this.view.muzzleOf(slot)) : this.view.muzzleOf(slot));
              if (t) this.view.addRope(muzzleNow, { x: eye.x, y: eye.y - 0.25, z: eye.z }, { x: t[0], y: t[1], z: t[2] }, color, 0.025, 450);
              continue;
            }
            const flying = new Set(ev.fl ?? []);
            ev.to.forEach((t, i) => {
              const to = { x: t[0], y: t[1], z: t[2] };
              if (flying.has(i)) {
                // Still in the air: someone else's round flies on from their muzzle until it meets the level
                // (drawn here, at its real speed and drop); the server's impact event lands it. Yours is already drawn.
                if (!mine && ev.v && this.local) {
                  const d = { x: to.x - eye.x, y: to.y - eye.y, z: to.z - eye.z };
                  const len = Math.hypot(d.x, d.y, d.z) || 1;
                  const physics = this.local.physics;
                  const flight = traceBullet(eye, { x: d.x / len, y: d.y / len, z: d.z / len }, { speed: ev.v, gravity: ev.g ?? 0, drag: 0 }, def?.range ?? 300, (o, dir, l) => physics.raycastHit(o, dir, l)?.dist ?? null);
                  this.view.shotVisual({ eye, muzzle, to: flight.end, color, victim: null, zone: 0, strength, def, speed: ev.v, land: false });
                }
                return;
              }
              const wet = this.view.scenario.liquids.fx.shot(eye, to);
              if (wet) this.view.surfaceAccent('water', wet);
              // Weapons whose rounds land with an impact of their own (the railgun's: content/vfx.json map.weaponImpacts).
              if (def) this.view.hitFx(to, def);
              const victim = ev.hit[i] ?? null;
              const zone = ev.z?.[i] ?? 0;
              if (victim === this.slot) {
                this.hurtFrom = { x: eye.x, z: eye.z, at: performance.now() };
                this.lastHitBy = { slot: ev.s, from: eye, at: performance.now() };
              }
              if (victim !== null) {
                const d = { x: to.x - eye.x, y: to.y - eye.y, z: to.z - eye.z };
                const len = Math.hypot(d.x, d.y, d.z) || 1;
                this.view.pushPlayer(victim, { x: (d.x / len) * 1.4 * strength, y: zone === 1 ? 0.8 : 0.4, z: (d.z / len) * 1.4 * strength });
                this.view.flinchPlayer(victim, d, zone, Math.max(strength, def ? stoppingPower(def) * 2.2 : 0));
              }
              // Your own rounds are already in the air (drawn when you fired); only your hits land here.
              if (mine) {
                // Land the hit when your round gets there (it left the muzzle about one round trip ago).
                const dist = Math.hypot(to.x - eye.x, to.y - eye.y, to.z - eye.z);
                if (victim !== null) window.setTimeout(() => this.view.landRound({ eye, to, victim, zone, strength }), Math.max(0, (dist / (ev.v ?? BULLET_SPEED)) * 1000 - 40));
                return;
              }
              this.view.shotVisual({ eye, muzzle, to, color, victim, zone, strength, def, slot: ev.s, ...(ev.v ? { speed: ev.v } : {}) });
            });
            // Rounds that went through a surface or glanced off it leave their mark there too.
            for (const p of ev.pn ?? []) this.view.landRound({ eye, to: { x: p[0], y: p[1], z: p[2] }, victim: null, zone: 0, strength });
            if (mine) {
              this.hitFeedback(ev.hit, ev.z, !!ev.ar);
            } else {
              this.view.avatarAction(ev.s, 'shoot');
              if (def && (def.kind !== 'melee' || ev.alt)) this.view.remoteFlash(ev.s, def, !!ev.alt);
            }
          } else if (ev.e === 'impact') {
            // A bullet that was in flight landed.
            const def = CORE_WEAPONS[ev.w];
            const mine = ev.s === this.slot;
            const from = { x: ev.from[0], y: ev.from[1], z: ev.from[2] };
            const to = { x: ev.to[0], y: ev.to[1], z: ev.to[2] };
            const strength = Math.min(2.5, Math.max(0.6, (def?.damage ?? 20) / 25));
            const zone = ev.z ?? 0;
            if (ev.hit === this.slot) this.hurtFrom = { x: from.x, z: from.z, at: performance.now() };
            if (ev.hit !== null) {
              const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
              const len = Math.hypot(d.x, d.y, d.z) || 1;
              this.view.pushPlayer(ev.hit, { x: (d.x / len) * 1.4 * strength, y: zone === 1 ? 0.8 : 0.4, z: (d.z / len) * 1.4 * strength });
              this.view.flinchPlayer(ev.hit, d, zone, Math.max(strength, def ? stoppingPower(def) * 2.2 : 0));
            }
            for (const p of ev.pn ?? []) this.view.landRound({ eye: from, to: { x: p[0], y: p[1], z: p[2] }, victim: null, zone: 0, strength });
            // Your own misses already landed where your predicted round hit the level.
            if (!ev.gone && (ev.hit !== null || !mine)) this.view.landRound({ eye: from, to, victim: ev.hit, zone, strength });
            if (mine) this.hitFeedback([ev.hit], [zone], !!ev.ar);
          } else if (ev.e === 'melee') {
            if (ev.s === this.slot && ev.hit !== null) this.hud.hit();
            // Punches alternate jab and cross; a kick is the legs' own motion.
            if (ev.s !== this.slot) this.view.avatarAction(ev.s, ev.u === 2 ? 'kick' : ev.u === 1 ? this.nextPunch(ev.s) : 'melee');
            const at = ev.hit !== null ? this.view.chestOf(ev.hit) : null;
            const from = this.view.chestOf(ev.s) ?? (ev.s === this.slot ? this.view.cameraPosition() : null);
            if (at && from) {
              const d = { x: at.x - from.x, y: 0, z: at.z - from.z };
              const len = Math.hypot(d.x, d.z) || 1;
              const dir = { x: d.x / len, y: 0.1, z: d.z / len };
              // Fists draw no blood, just the hit flash.
              if (!ev.u) this.view.blood.hit(at, dir, 1.4);
              this.view.hitFx(at, 'melee');
              this.view.pushPlayer(ev.hit!, { x: dir.x * 4, y: 1.5, z: dir.z * 4 });
              this.view.flinchPlayer(ev.hit!, dir, ev.u === 1 ? 1 : 0, ev.u === 1 ? 1 : 1.8);
            }
          } else if (ev.e === 'knock') {
            if (ev.s === this.slot) this.hud.hit();
          } else if (ev.e === 'arc') {
            // An arc sentry's arc is drawn in its own colour.
            const glow = ev.m !== undefined ? this.mounts?.mounts.get(ev.m)?.def.glow : undefined;
            // Lightning by its source (content/vfx.json map.arcs): an arc sentry, an electric fence (no shooter) or a gun.
            // With flashing reduced, each source holds one steady beam (keyed by it; a fence's by where it struck).
            const source = ev.m !== undefined ? 'mount' : ev.s < 0 ? 'fence' : 'default';
            this.view.addArc(ev.pts.map((p) => ({ x: p[0], y: p[1], z: p[2] })), glow, source, ev.m !== undefined ? `m${ev.m}` : ev.s >= 0 ? `s${ev.s}` : undefined);
          } else if (ev.e === 'explode') {
            this.hurtFrom = { x: ev.p[0], z: ev.p[2], at: performance.now() };
            const at = { x: ev.p[0], y: ev.p[1], z: ev.p[2] };
            if (ev.m !== undefined) this.view.vehicleExplosion(at, ev.r);
            else this.view.explosion(at, ev.r, ev.w);
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
            if (ev.s === this.slot && getItem(ev.item)?.effect.kind === 'armor') this.tips?.trigger('armor', performance.now() / 1000);
            // A sparkle where it was taken (content/vfx.json map.gameplay, by the item's kind).
            const at = this.view.chestOf(ev.s);
            // Grown with distance (owner, 2026-11-08: an armour pickup 7 m off was a speck): as big on screen as at 3 m (View.farSize).
            if (at) this.view.playGameplayFx(`pickup.${getItem(ev.item)?.effect.kind ?? 'item'}`, at, { size: this.view.farSize(at) });
          } else if (ev.e === 'kill') {
            this.hud.kill(ev.killer, ev.victim, ev.weapon, this.slot, !!ev.hs, !!ev.tk);
            if (ev.victim === this.slot && ev.killer !== null && ev.killer !== this.slot && this.local && msg.phase === 'playing') this.startKillCam(ev.killer, ev.weapon);
            // A team kill confirms nothing: no kill marker, no multi-kill.
            if (ev.killer === this.slot && ev.victim !== this.slot && !ev.tk) {
              // Kill confirmation (GUNPLAY_SPEC §22): a sharper marker that escalates with kills in a row.
              const t = performance.now();
              this.killTimes = [...this.killTimes.filter((k) => t - k < MULTI_KILL_MS), t];
              this.hud.killConfirm(this.killTimes.length);
            }
            const at = this.view.chestOf(ev.victim);
            if (at) this.view.blood.kill(at);
            if (at && ev.hs) this.view.blood.hit({ x: at.x, y: at.y + 0.55, z: at.z }, { x: 0, y: 0.6, z: 0 }, 2.2);
            if (ev.hs && !ev.tk && ev.killer === this.slot) this.hud.headshot();
          } else if (ev.e === 'round_end') {
            if (ev.outcome === 'victory') this.chainOn(ev.next);
            // Nowhere else to go: this browser's rotation moves on after the scoreboard.
            // Or, with the vote on, everyone votes on where it goes (the page picks the maps: openVote).
            if (!this.travel && !ev.next && !this.openVote()) void this.rotateOn();
            // Everyone's scoreboard says where the match goes next (a server's or host's rotation).
            this.hud.nextMap = ev.up ? nextMapLine(ev.up.map, ev.up.mode) : '';
            this.winner = ev.team !== undefined ? (this.hud.teamById(ev.team)?.name ?? null) : ev.winner === null ? null : this.hud.name(ev.winner);
            this.outcome = ev.outcome ?? null;
          } else if (ev.e === 'round_start') {
            this.outcome = null;
            this.hud.nextMap = '';
            // A new round: any vote is over (the match replayed).
            if (this.voteHud?.open) this.voteMessage(null);
            this.view.clearCorpses();
            this.npcInfo.clear();
          } else if (ev.e === 'say') {
            // Team modes: only your own team hears it.
            const mine = this.hud.team(this.slot)?.id;
            if (!ev.team || !mine || ev.team === mine) this.hud.say(ev.s, QUICK_MESSAGES[ev.m - 1] ?? '');
          } else if (ev.e === 'squad') {
            this.squadEvent(ev);
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
            // A message for one player (the drop route's "not over the drop zone") only shows for them.
            if (ev.s === undefined || ev.s === this.slot) this.hud.showMessage(ev.text, ev.secs);
          } else if (ev.e === 'obj') {
            this.objectiveChanged.set(ev.i, performance.now());
          } else if (ev.e === 'trap' && !ev.warn) {
            // A trap going off (content/vfx.json map.gameplay: trap.<type>).
            const e = this.map?.entities[ev.i];
            if (e?.kind === 'trap') this.view.playGameplayFx(`trap.${e.trap}`, { x: e.position[0], y: e.position[1] + 0.3, z: e.position[2] });
          } else if (ev.e === 'broken') {
            const e = this.map?.entities[ev.i];
            // Glass (window panes past the entities, glass blocks, Window panes): a shower of shards.
            const pane = this.view.scenario.glass.paneAt(ev.i) ?? (this.map ? glassAt(this.map, ev.i) : null);
            if (pane) {
              this.view.glassShards(pane.box, pane.tint ?? '#d4eef2');
            } else if (e?.kind === 'destructible') {
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
      case 'host':
        // You run this match (or a command was refused).
        if (msg.state || !this.hostPanel.controlling) {
          this.hostState = msg.state;
          this.hostPanel.setState(msg.state);
          // Admins' controls go in the Host tab; the login stays in Match.
          $(this.hostPanel.controlling ? 'pause-host-slot' : 'pause-admin-slot').append(this.hostPanel.root);
          if (this.hostPanel.controlling) this.hostPanel.root.open = true;
          this.pauseMenu.setTabVisible('host', this.opts.transport instanceof LocalTransport || this.hostPanel.controlling);
        }
        if (msg.error) {
          this.hostPanel.setStatus(msg.error, true);
          this.hud.showMessage(msg.error, 3);
        } else if (msg.state) this.hostPanel.setStatus('');
        break;
      case 'notice':
        this.hud.note(msg.text);
        this.hud.showMessage(msg.text, 4);
        break;
      case 'vote':
        this.voteMessage(msg.v === null ? null : parseVoteState(msg.v));
        break;
      case 'travel':
        // The server is changing map: reconnect to play the next one.
        this.travel = { map: msg.map };
        this.hud.showMessage(`Next map: ${msg.map}`, 3);
        this.exit('travel');
        break;
      case 'stats':
        this.serverStats = msg;
        this.noteIfSlow(msg);
        break;
      case 'pings':
        this.hud.setPings(msg.p);
        break;
      case 'rules':
        // The host restarted with new rules (score limit, time…), or changed a live one.
        if (this.rules && msg.rules.mode === this.rules.mode) {
          const before = this.map ? weaponSetInPlay(this.rules, this.map)?.id : undefined;
          this.rules = msg.rules;
          // Another weapon set: its guns load now, before a pickup or your next life shows one mid-fight, and grenades
          // wear its looks from now on.
          if (this.map && weaponSetInPlay(msg.rules, this.map)?.id !== before) {
            this.view.setWeaponSetLook(weaponSetInPlay(msg.rules, this.map)?.id);
            this.loadSetGuns();
          }
          // A new match with another weather (the host's Host tab: it waits for the next match).
          if (this.map) this.applyWeather(msg.rules, this.map);
        }
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
    // Roulette: the cards everyone is dealt next as well (the spawn events name them), so the first lives load with the map.
    for (const look of new Set([...this.looks.values(), ...this.rlUpcoming])) jobs.push(this.view.characters.preload({ look }));
    jobs.push(this.view.characters.preload({ npc: { color: '#888888', scale: 1, female: true } }));
    if (rules.mode === 'core.zombies' || map.entities.some((e) => e.kind === 'encounter' && (e.roster?.zombie ?? 0) > 0)) this.view.creatures.preload('zombie');
    // NPCs drawn as a creature original's look (goblins, boglurkers…) in this map's encounters.
    for (const role of NPC_ROLES) {
      const look = NPC_ROLE_SPECS[role].look;
      if (look && map.entities.some((e) => e.kind === 'encounter' && (e.roster?.[role] ?? 0) > 0)) jobs.push(this.view.characters.preload({ look }));
    }
    const models = new Set<string>();
    // The weapon set's (sim/weaponSets.ts): its spawn weapons (Standard: the mode's own), random spawn guns, sniper gun
    // and what its pickups hold.
    const set = weaponSetInPlay(rules, map);
    const spawnGuns = set ? setSpawnWeapons(set, rules) : rules.startingWeapons;
    for (const id of spawnGuns) models.add(getWeapon(id).view.model);
    for (const id of set ? (setWeaponsInPlay(set, rules) ?? []) : []) models.add(getWeapon(id).view.model);
    // Your starting guns' sharper copies for your own hands (Medium, High: View.sharpenViewmodel) come in with the
    // loading screen, as you hold them at once; a gun picked up later fetches its own then.
    for (const id of spawnGuns) {
      const held = heldModel(getWeapon(id), this.view.atmosphere.quality);
      if (held) jobs.push(this.view.models.load(held).catch(() => undefined));
    }
    // Throwables' models (content/throwables.json `view`, as the weapon set shows them: its `looks`): the grenade
    // everyone may start with (the set's first, else the frag) and what grenade pickups may hold, loaded and warmed like
    // the guns, so the first one in a hand, in the air or on the ground is no stall mid-fight.
    const thrown = new Set<string>();
    const look = set?.id;
    const first = rules.startingGrenades > 0 ? throwableModel((set && setThrowables(set)?.[0]) || 'frag', look) : null;
    if (first) thrown.add(first);
    for (const e of map.entities) {
      if (e.kind !== 'pickup') continue;
      const item = getItem(e.item);
      if (item?.effect.kind !== 'throwable') continue;
      for (const it of setPickupPool(set, e, !!rules.mixPickups) ?? [item]) {
        const model = it.effect.kind === 'throwable' ? throwableModel(it.effect.throwable, look) : null;
        if (model) thrown.add(model);
      }
    }
    for (const m of thrown) models.add(m);
    for (const e of map.entities) {
      if (e.kind === 'pickup') {
        const fx = getItem(e.item)?.effect;
        // Whatever a random (or mixed-up, or weapon set's) weapon pickup may roll, so a respawn never loads a model
        // mid-fight; the weapon placed there only while it stays as placed.
        const pool = setPickupPool(set, e, !!rules.mixPickups);
        if (fx?.kind === 'weapon' && !pool) models.add(getWeapon(fx.weapon).view.model);
        for (const item of pool ?? []) if (item.effect.kind === 'weapon') models.add(getWeapon(item.effect.weapon).view.model);
      }
      if (e.kind === 'mount') {
        const def = getMountDef(e.model);
        if (def) models.add(def.model);
      }
      // The plane or dropship flying a drop route (riders start in it).
      if (e.kind === 'airplane') models.add(airCraftDef(e.craft).model);
    }
    for (const m of models) jobs.push(this.view.models.load(m).catch(() => undefined));
    // Every shader the match will need (a character of each look, every effect), built before the start:
    // the first sight of a model or an effect mid-fight otherwise stalled on it (GameView.prewarm).
    const looks = [...new Set([...this.looks.values(), ...this.rlUpcoming])].map((look) => ({ look }));
    // (The gate waits for it 8 s at most: a slow machine finishes it in the background, out of sight.)
    // Every gun the match can put in a hand (starting weapons, pickups and what they may roll), as held and as yours.
    const guns = [...models].filter((m) => WEAPONS_BY_SLOT.some((w) => w.view.model === m) || thrown.has(m));
    let started = false;
    // The gate waits for the warm-up's files (a first visit downloads every look in the match and every gun: the
    // overall cap below still holds), then gives its shader builds 8 s: a slow GPU finishes those out of sight after
    // the start. Round 3 counted the 8 s from the warm-up's start, so on a first visit the files came in after the
    // gate and the spawn wave built its shaders in the first seconds of play (docs/PERF_96.md, "Performance round 4").
    let filesIn: () => void = () => {};
    const loaded = new Promise<void>((r) => (filesIn = r));
    const warm = this.view.prewarm(looks, guns, () => !started && !this.closed, () => filesIn());
    jobs.push(Promise.race([warm, Promise.race([loaded, new Promise((r) => setTimeout(r, 20000))]).then(() => new Promise((r) => setTimeout(r, 8000)))]));
    let done = 0;
    const total = jobs.length + 2;
    // A file that finishes after the start (see the cap below) must not bring the loading screen back over the game.
    const tick = () => void (started || this.hud.setLoading(`Loading ${map.metadata.name}`, ++done / total));
    this.hud.setLoading(`Loading ${map.metadata.name}`, 0);
    const all = Promise.all([...jobs.map((j) => j.then(tick, tick)), this.view.scene.whenReadyAsync().then(tick, tick), this.view.city.ready.then(tick, tick)]);
    // Never stall the start on one slow file.
    await Promise.race([all, new Promise((r) => setTimeout(r, 25000))]);
    started = true;
    if (this.closed) return;
    // Roulette: the cards further ahead, now the match has its files.
    for (const look of this.rlLater ?? []) {
      if (this.rlLoaded.has(look)) continue;
      this.rlLoaded.add(look);
      void this.view.characters.preload({ look });
    }
    this.rlLater = null;
    this.hud.setLoading(null);
    this.opts.transport.sendReady();
  }

  /** The weapon set's guns (a host switched sets mid-match), loaded in the background. */
  /** The match's weather (the host's choice, else the map's), drawn and heard; set again only when it changed. */
  private applyWeather(rules: MatchRules, map: MapDocument): void {
    const w = matchWeather(rules, map);
    const key = JSON.stringify(w);
    if (key === this.weatherKey) return;
    this.weatherKey = key;
    this.view.setWeather(w);
  }

  private loadSetGuns(): void {
    const map = this.map;
    const rules = this.rules;
    const set = map && rules ? weaponSetInPlay(rules, map) : null;
    for (const id of set && rules ? (setWeaponsInPlay(set, rules) ?? []) : []) void this.view.models.load(getWeapon(id).view.model).catch(() => undefined);
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

  private npcLook(id: number): { color: string; scale: number; size: number; label: string; creature?: CreatureModel; zombie?: boolean; look?: string } | undefined {
    const info = this.npcInfo.get(id);
    if (!info || !this.map) return undefined;
    const faction = mapFactions(this.map)[info.faction];
    const role = NPC_ROLES[info.role] ?? 'trooper';
    // Most zombies wear Quaternius' zombie body (its own walk, run and bite); the rest shamble on the soldiers' rig.
    if (role === 'zombie') return { color: '#76866a', scale: info.size, size: info.size, label: 'Zombie', zombie: true, ...(zombieHasCreatureBody(id) ? { creature: 'zombie' as const } : {}) };
    const spec = NPC_ROLE_SPECS[role];
    // The creature originals wear their own character look.
    return { color: faction?.color ?? '#d04a3a', scale: spec.scale * info.size, size: info.size, label: `${faction?.name ?? 'Enemy'} ${spec.label}`, ...(isCreature(role) ? { creature: role } : {}), ...(spec.look ? { look: spec.look } : {}) };
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
    let full: { def: { displayName: string } } | null = null;
    if (local.alive && this.seat) {
      const m = this.mounts?.mounts.get(this.seat[0]);
      const hint = m && m.def.kind === 'vehicle' && !m.def.airplane && VehicleCamera.drives(m.def, this.seat[1]) ? { key: 'H', text: this.vehicleCam.viewFor(m.def) === 'cockpit' ? 'Chase camera' : 'Cockpit view' } : undefined;
      this.hud.setPrompt(m?.def.airplane ? 'Jump out (E or Space), then Space to open your parachute' : `Get out of the ${m?.def.displayName ?? 'vehicle'}`, false, hint);
    } else if (local.alive && local.state.zip !== undefined) {
      const two = local.weapon && !oneHanded(local.weapon);
      this.hud.setPrompt(two ? 'Zipline: Space or E to let go (sidearm or blade to shoot)' : 'Zipline: Space or E to let go');
    } else if (local.alive && !this.seat && !enter && local.ziplines.length && grabZipline(local.ziplines, local.state.pos, this.input.yaw, local.team())) {
      this.hud.setPrompt('Grab the zipline');
    } else if (enter) {
      const seat = enter.mount.def.seats[enter.seat]!;
      const verb = seat.role === 'driver' ? (enter.mount.def.kind === 'vehicle' ? 'Drive' : 'Use') : seat.role === 'gunner' ? 'Man the gun on' : 'Ride in';
      this.hud.setPrompt(`${verb} the ${enter.mount.def.displayName}`);
    } else if (local.alive && !this.seat && (full = this.mounts?.fullInReach(local.state.pos) ?? null)) {
      // In reach but every seat is taken: say so (E does nothing here).
      this.hud.setPrompt(`The ${full.def.displayName} is full`, true);
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

  /**
   * You died to `killer`: the kill cam turns to them from by your body, for KILL_CAM_SECONDS or until you
   * respawn (a delay just past that stretches it to the respawn); with a long delay (or none: Elimination)
   * you then watch.
   */
  private startKillCam(killer: number, weapon: string): void {
    const local = this.local!;
    const now = performance.now();
    const hit = this.lastHitBy && this.lastHitBy.slot === killer && now - this.lastHitBy.at < 3000 ? this.lastHitBy.from : null;
    const delay = (this.rules?.respawnDelayTicks ?? 0) / TICK_RATE;
    const seconds = Math.max(KILL_CAM_SECONDS, delay > 0 && delay <= KILL_CAM_SECONDS + 1 ? delay + 0.5 : 0);
    this.specCam.startKillCam({ killer, weapon, body: this.drawnPos, from: hit, yaw: this.input.yaw, pitch: this.input.pitch, seconds });
  }

  /**
   * The camera while out of play (dead, or spectating by choice): the kill cam, then following someone you
   * may watch (spectateRule) or the free camera. Returns the pose set, or null when there is nothing to
   * watch (the view stays where you fell).
   */
  private spectatorCamera(now: number, local: LocalPlayer, fov: number, picks: { step: number; toggle: boolean }): CameraPose | null {
    const cast = (o: Vec3, d: Vec3, len: number) => local.physics.raycastWorld(o, d, len);
    const poses = this.interp.sample(now);
    // Someone you watch in a vehicle: on their seat, as they are drawn (the blend steps once a frame, below).
    if (this.mounts) this.riderPlacement.place(poses, this.mounts.seatedRiders(), (i, o) => this.view.seatPoint(i, o), 0);
    const rule = this.spectateRule();
    const kc = this.spectator ? null : this.specCam.killCam();
    if (kc) {
      // Any spectator key skips it.
      if (picks.step || picks.toggle) {
        this.specCam.endKillCam();
        picks = { step: 0, toggle: false };
      } else {
        const k = poses.find((p) => p.slot === kc.killer);
        const pose = this.specCam.killCamPose(now, k ? { x: k.x, y: k.y + 1.3, z: k.z } : null, cast)!;
        this.view.setCamera(pose.pos, pose.yaw, pose.pitch, fov);
        const hp = this.hp.get(kc.killer);
        this.hud.setKillCam({ name: this.hud.name(kc.killer), color: kc.killer >= NPC_ID_BASE ? '#e74c3c' : (this.hud.team(kc.killer)?.color ?? slotColor(kc.killer)), weapon: kc.weapon, hp: k?.alive === false ? 0 : hp === undefined ? null : Math.round(hp * PLAYER.maxHealth) });
        this.hud.setSpectating(null);
        return pose;
      }
    }
    this.hud.setKillCam(null);
    const list = followable(poses, this.slot, rule, (s) => this.hud.team(s)?.id, NPC_ID_BASE);
    const hint = (free: boolean) =>
      [free ? 'WASD fly · E/Q up and down · Shift faster' : list.length > 1 ? 'Click or ←/→: next player' : '', rule.freeCam ? `Space: ${free ? 'follow players' : 'free camera'}` : '', this.spectator ? 'J: join the game' : ''].filter(Boolean).join(' · ');
    if (picks.toggle && rule.freeCam) {
      const from = this.view.cameraPosition();
      if (!this.specCam.free) {
        // The free camera starts where the view is, looking the same way.
        this.input.yaw = this.view.camera.rotation.y;
        this.input.pitch = -this.view.camera.rotation.x;
      }
      this.specCam.setFree(!this.specCam.free, from);
    }
    // Nobody to follow: a spectator flies instead.
    if (!list.length && rule.freeCam && !this.specCam.free) this.specCam.setFree(true, this.view.cameraPosition());
    if (!rule.freeCam && this.specCam.free) this.specCam.setFree(false, this.view.cameraPosition());
    const at = this.specCam.freeAt;
    if (this.specCam.free && at) {
      const pose = { pos: at, yaw: this.input.yaw, pitch: this.input.pitch };
      this.view.setCamera(at, pose.yaw, pose.pitch, fov);
      this.hud.setSpectating('Free camera', hint(true));
      return pose;
    }
    this.specCam.cycle(picks.step, list);
    const watch = this.specCam.target(list);
    if (!watch) {
      this.hud.setSpectating(rule.teamOnly ? 'No teammates left to watch' : 'Nobody to watch', this.spectator ? 'J: join the game' : '');
      return null;
    }
    const pose = this.specCam.followPose(watch, cast);
    this.view.setCamera(pose.pos, pose.yaw, pose.pitch, fov);
    this.hud.setSpectating(`Watching ${this.hud.name(watch.slot)}`, hint(false));
    return pose;
  }

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

  /** The turret you are gunning (hidden, as your own body is), or null. */
  private mannedTurret(): number | null {
    const m = this.seat ? this.mounts?.mounts.get(this.seat[0]) : undefined;
    return m?.def.kind === 'turret' ? m.index : null;
  }

  /**
   * The weapon wheel, once a frame: open while the input holds it (alive, on foot), showing
   * what you carry; when it closes with a pick, switch to it (as a number key would).
   */
  private updateWheel(local: LocalPlayer, building: boolean): void {
    const input = this.input;
    input.canOpenWheel = local.alive && !this.seat && !building && local.inventory.size > 0;
    if (input.wheelOpen && input.wheelKind === 'weapon' && !input.canOpenWheel) input.closeWheel(false);
    if (input.wheelOpen && input.wheelKind === 'weapon') {
      this.wheel.show(wheelEntries(local.ownedCodes(), local.inventory, this.wantWeapon || local.held));
      this.wheel.aim(input.wheelAim.x, input.wheelAim.y);
    }
    const closed = input.takeWheelClose();
    if (closed === null && ((input.wheelOpen && input.wheelKind === 'weapon') || !this.wheel.shown)) return;
    const pick = this.wheel.hide();
    if (closed && pick && local.inventory.has(pick) && pick !== (this.wantWeapon || local.held)) this.requestWeapon(pick);
  }

  /**
   * Fireteams' order wheel, once a frame: it may open while you lead a squad, alive and on foot; open, it shows the
   * six orders (your squad's current one ringed; Defend the objective dimmed where the mode has none); let go on one
   * and it goes to the match (fireteams.ts orderSay), which checks it.
   */
  private updateOrderWheel(local: LocalPlayer): void {
    const input = this.input;
    input.ordersOn = this.squadLed !== null && local.alive && !this.seat && !this.spectator;
    if (input.wheelOpen && input.wheelKind === 'order' && !input.ordersOn) input.closeWheel(false);
    if (input.wheelOpen && input.wheelKind === 'order') {
      const noObjective = this.rules?.mode === 'core.tdm';
      // (Spread out / Stay tight: one entry, named for what it does now; Part 2.)
      const spacing = this.squadHud.current?.spacing ?? 'normal';
      const spaceName = (k: OrderKind) => (k === 'spacing' ? spacingLabel(spacing) : ORDER_LABELS[k]);
      const spaceHint = (k: OrderKind) => (k === 'spacing' ? (nextSpacing(spacing) === 'spread' ? 'Further apart' : 'Closer together') : ORDER_HINTS[k]);
      this.orderWheel.show(ORDER_KINDS.map((k, i) => ({ code: i + 1, name: spaceName(k), ammo: spaceHint(k), empty: k === 'defend' && noObjective, held: k === this.squadOrder, weaponId: '' })));
      this.orderWheel.aim(input.wheelAim.x, input.wheelAim.y);
    }
    const closed = input.takeOrderClose();
    if (closed === null && ((input.wheelOpen && input.wheelKind === 'order') || !this.orderWheel.shown)) return;
    const pick = this.orderWheel.hide();
    const kind = pick ? ORDER_KINDS[pick - 1] : undefined;
    if (closed && kind) input.queueSay(orderSay(kind));
  }

  /** Fireteams' news (the 'squad' event): leading a squad, its orders (the HUD's line), the bots' answers, a refusal. */
  private squadEvent(ev: Extract<GameEvent, { e: 'squad' }>): void {
    const mine = this.hud.team(this.slot)?.id;
    if (ev.team && mine && ev.team !== mine) return;
    const kind = ev.k !== undefined ? ORDER_KINDS[ev.k] : undefined;
    if (ev.a === 'lead') {
      if (ev.s === this.slot) {
        const first = this.squadLed === null;
        this.squadLed = ev.sq ?? null;
        this.squadOrder = 'follow';
        if (first) this.hud.showMessage(`You lead a fireteam of ${ev.n ?? 0} · hold B for orders`, 4);
      } else if (ev.from === this.slot) this.squadLed = this.squadOrder = null;
    } else if (ev.a === 'order' && kind) {
      // (Spread out / Stay tight keeps the squad's order: only its spacing changes.)
      if (ev.s === this.slot && kind !== 'spacing') {
        this.squadLed = ev.sq ?? this.squadLed;
        this.squadOrder = kind;
      }
      // (The match's own orders, as a squad forms up or an order ends, aren't called out.)
      const said = kind === 'spacing' ? spacingLabel(SQUAD_SPACINGS[ev.n ?? 0] === 'spread' ? 'normal' : 'spread') : ORDER_LABELS[kind];
      if (!ev.auto && ev.s !== this.slot) this.hud.say(ev.s, `${said}!`);
    } else if (ev.a === 'ack' && kind) this.hud.say(ev.s, kind === 'spacing' ? SPACING_ACKS[SQUAD_SPACINGS[ev.n ?? 0] ?? 'spread'] : ORDER_ACKS[kind]);
    else if (ev.a === 'deny' && ev.s === this.slot) this.hud.showMessage(REFUSAL_TEXT[REFUSALS[ev.n ?? 0] ?? 'notLeader'], 2.5);
  }

  /**
   * Fireteams' squad HUD (Part 2), once a snapshot: your squad from the snapshot's squads (`fs`), its order and spacing,
   * and each squadmate's portrait and health.
   */
  private squadSnapshot(fs: readonly (readonly number[])[] | undefined, players: readonly PlayerSnapshot[]): void {
    for (const p of players) this.alive.set(p.s, p.alive === 1);
    const mine = this.squadHud.read(fs, this.slot);
    if (mine && mine.leader === this.slot && mine.order !== 'spacing') this.squadOrder = mine.order;
    this.squadHud.update(this.slot, (slot) => ({ slot, name: this.hud.name(slot), look: this.looks.get(slot), hp: this.hp.get(slot) ?? 1, alive: this.alive.get(slot) ?? true }));
  }
  /** Who is alive, by slot, as the last snapshot had them (the squad HUD's cards). */
  private readonly alive = new Map<number, boolean>();

  private requestWeapon(slot: number): void {
    const current = this.wantWeapon || this.local?.held || 0;
    if (slot !== current) this.lastWeapon = current;
    this.wantWeapon = slot;
  }

  /** Advance prediction at a fixed 60 Hz and render one frame. */
  /** The tutorial (opts.tutorial) and the first-time tips (opts.tips): coachHud.ts draws both. */
  private coach: CoachHud | null = null;
  private tutorial: Tutorial | null = null;
  private tips: TipBook | null = null;
  /** Gathered over a frame's ticks for the tutorial: rounds fired, and those fired aiming. */
  private coachShots = 0;
  private coachAimed = 0;
  private coachMoving = false;
  private coachThrowables = -1;
  private coachAlive = false;
  private coachPickups: { x: number; z: number }[] | null = null;

  private setUpCoach(): void {
    const tutorial = !!this.opts.tutorial;
    // No "You / Leader" score in the tutorial (owner, 2026-11-08): there are no bots and no score to play for.
    if (tutorial) this.hud.showScorebar(false);
    if (tutorial) this.tutorial = new Tutorial();
    if (this.opts.tips !== false && !tutorial) this.tips = new TipBook();
    if (!this.tutorial && !this.tips) return;
    this.coach = new CoachHud($('hud'), isTouchDevice(), tutorial ? { onSkip: () => this.skipTutorial() } : null);
    // Browser tests: the tip showing, and a situation set off by hand.
    if (this.tips) (window as unknown as { __tips: unknown }).__tips = { current: () => this.tips?.current ?? null, trigger: (id: TipId) => this.tips?.trigger(id, performance.now() / 1000) };
    if (!tutorial) return;
    // Pause menu: Skip tutorial beside Resume.
    const skip = document.createElement('button');
    skip.id = 'pause-skip-tutorial';
    skip.textContent = 'Skip tutorial';
    skip.title = "Leave the tutorial and go back to the main menu (it won't be offered again; the main menu has it any time)";
    skip.addEventListener('click', () => this.skipTutorial(), { signal: this.abort.signal });
    $('resume').after(skip);
    (window as unknown as { __tutorial: unknown }).__tutorial = { state: () => ({ index: this.tutorial?.index ?? -1, step: this.tutorial?.step?.id ?? null, progress: this.tutorial?.progress ?? 0, done: !!this.tutorial?.done }), goTo: (i: number) => this.tutorial?.goTo(i), skip: () => this.skipTutorial() };
  }

  /** Skip (the card, the pause menu): the tutorial counts as seen, and you go back to the main menu. */
  private skipTutorial(): void {
    if (!this.tutorial) return;
    setTutorialState(this.tutorial.done ? 'done' : 'skipped');
    this.exit();
  }

  /** Each frame: the tutorial's step from what you did, the tips' situations, and their HUD. */
  private coachFrame(local: LocalPlayer, now: number, dt: number, ride: { def: { kind: string }; shown: { pos: Vec3 } } | undefined, driving: boolean): void {
    if (!this.coach) return;
    const t = now / 1000;
    const shots = this.coachShots;
    const aimed = this.coachAimed;
    const moving = this.coachMoving;
    this.coachShots = this.coachAimed = 0;
    this.coachMoving = false;
    const count = local.alive ? (local.throwable?.count ?? 0) : -1;
    const thrown = this.coachThrowables > 0 && count >= 0 && count < this.coachThrowables && local.alive ? this.coachThrowables - count : 0;
    this.coachThrowables = count;
    const died = this.coachAlive && !local.alive && this.phase === 'playing';
    this.coachAlive = local.alive;
    if (this.tutorial) {
      const at = driving && ride ? ride.shown.pos : local.state.pos;
      const advanced = this.tutorial.update({
        dt,
        alive: local.alive,
        x: at.x,
        z: at.z,
        yaw: this.input.yaw,
        pitch: this.input.pitch,
        moving,
        sprinting: !!local.state.sprint,
        stance: local.state.stance ?? 0,
        shots,
        aimedShots: aimed,
        reloading: local.reloadTicks > 0 || !!local.reload,
        held: local.held,
        thrown,
        driving,
      });
      if (advanced && this.tutorial.done) setTutorialState('done');
      this.coach.tutorial(this.tutorial, advanced, t);
      // The drive step: the marker points at the nearest vehicle until you're in one.
      if (this.tutorial.step?.id === 'drive' && !this.seat && local.alive && this.mounts) {
        let best: Vec3 | null = null;
        let bestD = Infinity;
        for (const m of this.mounts.mounts.values()) {
          if (!m.alive || m.def.kind !== 'vehicle') continue;
          const d = Math.hypot(m.shown.pos.x - local.state.pos.x, m.shown.pos.z - local.state.pos.z);
          if (d < bestD) [best, bestD] = [m.shown.pos, d];
        }
        if (best) {
          const p = { x: best.x, y: best.y + 2.2, z: best.z };
          const eye = local.eye;
          const w = innerWidth;
          const h = innerHeight;
          let screen = this.view.project(p);
          // Off screen (behind you, or to a side): held at the edge on its side, so it always shows the way.
          if (!screen || screen.x < 40 || screen.x > w - 40 || screen.y < 40 || screen.y > h - 40) {
            const right = (p.x - eye.x) * Math.cos(this.input.yaw) - (p.z - eye.z) * Math.sin(this.input.yaw);
            screen = { x: right >= 0 ? w * 0.78 : w * 0.22, y: h * 0.5 };
          }
          this.hud.setMarker({ ...screen, dist: Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) });
        }
      }
    }
    const tips = this.tips;
    if (!tips) return;
    if (tips.enabled && this.phase === 'playing') {
      if (died) tips.trigger('death', t);
      if (local.alive && !this.seat) {
        const w = local.weapon;
        const ammo = local.inventory.get(local.held);
        if (w?.magazine && ammo && ammo[0] <= Math.max(1, Math.floor(w.magazine * 0.25)) && ammo[1] > 0 && local.reloadTicks === 0) tips.trigger('reload', t);
        const enter = this.mounts?.enterable(local.state.pos);
        if (enter && enter.mount.def.kind === 'vehicle') tips.trigger('vehicle', t);
        // A pickup a few metres ahead.
        this.coachPickups ??= (this.map?.entities ?? []).filter((e) => e.kind === 'pickup').map((e) => ({ x: e.position[0], z: e.position[2] }));
        const fx = Math.sin(this.input.yaw);
        const fz = Math.cos(this.input.yaw);
        for (const p of this.coachPickups) {
          const dx = p.x - local.state.pos.x;
          const dz = p.z - local.state.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 1 && d < 8 && (dx * fx + dz * fz) / d > 0.7) {
            tips.trigger('pickup', t);
            break;
          }
        }
      }
    }
    this.coach.setTip(tips.update(t));
  }

  frame(): void {
    if (this.closed) return;
    const t0 = performance.now();
    if (!$('pause').hidden) {
      this.pauseMenu.pollPad();
      this.drawPause();
    }
    const now = performance.now();
    if (perfProbe.on) {
      perfProbe.beginFrame(t0);
      // The pause menu is HUD.
      perfProbe.add(SYS.hud, t0);
    }
    // Snapshots that came in a burst and wait merged: this frame draws the newest, not the one before it.
    this.opts.transport.flush?.();
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
      this.updateWheel(local, building);
      this.updateOrderWheel(local);
      this.touch?.update();
      const wheel = this.input.takeWheel();
      // Through a scope the wheel steps between its zoom levels instead of switching weapons.
      if (wheel && this.scopedNow && local.weapon?.view.zoomFov) this.zoomLevel = wheel > 0 ? 1 : 0;
      else if (wheel) {
        const owned = local.ownedCodes();
        const i = owned.indexOf(this.wantWeapon || local.held);
        const next = owned[(((i + wheel) % owned.length) + owned.length) % owned.length];
        if (next) this.requestWeapon(next);
      }

      // Out of play: spectating by choice, or dead while the match runs. The controls watch instead of play.
      if (this.spectator) local.alive = false;
      const out = this.spectator || (!local.alive && this.phase === 'playing');
      if (!out && this.outOfPlay) {
        this.specCam.reset();
        this.hud.setKillCam(null);
        this.hud.setSpectating(null);
      }
      this.outOfPlay = out;
      this.input.spectating = out;
      this.input.spectatingFree = out && this.specCam.free;
      this.hud.setWatching(out);
      this.touch?.setWatching(out ? { join: this.spectator } : null);
      const picks = out ? this.input.takeSpectate() : { step: 0, toggle: false, used: false };
      let watched = picks.used || picks.step !== 0 || picks.toggle;
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
        if (out) {
          // Watching: the keys fly the free camera (if it's up), and nothing goes to the body you don't have.
          const up = this.input.spectateVertical();
          if (this.specCam.moveFree(TICK_DT, sample.forward, sample.right, up, this.input.yaw, this.input.pitch, this.input.held('ShiftLeft'), this.freeBounds)) watched = true;
          if (sample.forward || sample.right || sample.buttons || up) watched = true;
          sample.forward = 0;
          sample.right = 0;
          sample.buttons = 0;
        }
        // Look-to-steer (Options): the driver's vehicle steers toward where they look.
        if (this.seat && local.alive) {
          const ride = this.mounts?.mounts.get(this.seat[0]);
          if (ride && this.vehicleCam.steersByLook(ride.def, this.seat[1])) sample.buttons |= BUTTON_STEER_LOOK;
        }
        // Third person on foot: the host sends your rounds from the eye toward what the crosshair is on.
        if (this.thirdPerson && !this.seat && local.alive) sample.buttons |= BUTTON_THIRD_PERSON;
        // Auto-reload (Options → Controls, on by default): the host starts an empty magazine's reload by itself.
        if (local.alive && autoReloadOn()) sample.buttons |= BUTTON_AUTO_RELOAD;
        moving ||= sample.forward !== 0 || sample.right !== 0;
        this.coachMoving ||= sample.forward !== 0 || sample.right !== 0;
        const before = { ...local.state.pos };
        const meleeNow = (sample.buttons & BUTTON_MELEE) !== 0;
        if (meleeNow && !this.meleeHeld && local.alive && !this.seat) this.localStrike(local.weapon, sample.forward, now);
        this.meleeHeld = meleeNow;
        const { input: cmd, shot, absorbed } = local.tick(sample, this.input.yaw, this.input.pitch, this.wantWeapon, viewTick);
        if (local.portalTurn) {
          // Through a portal: you face the way you came out.
          this.input.yaw += local.portalTurn;
          local.portalTurn = 0;
        }
        // Mouse movement that pulled against the recoil brought the recoil down instead of turning the view.
        if (absorbed) {
          this.input.pitch += absorbed[0];
          this.input.yaw += absorbed[1];
        }
        if (this.forts) cmd.build = this.forts.code;
        if (out) {
          // Camera input while watching is activity (the host's idle and away rules: PlayerInput.sp).
          if (watched || cmd.yaw !== this.sentLook.yaw || cmd.pitch !== this.sentLook.pitch) cmd.sp = 1;
          watched = false;
        }
        this.sentLook = { yaw: cmd.yaw, pitch: cmd.pitch };
        this.outbox.push(cmd);
        this.sfx.localStep(local, before, local.speedTicks > 0 ? SPEED_BOOST : 1, !!this.seat);
        const ammo = local.inventory.get(local.held);
        if (local.alive && sample.buttons & BUTTON_FIRE && ammo && ammo[0] === 0 && ammo[1] === 0 && local.weapon?.magazine) this.sfx.dryFire(now);
        if (shot) {
          this.coachShots++;
          if (this.input.zooming) this.coachAimed++;
          this.sfx.localShot(shot.def, shot.alt);
          // The spray pattern (an option): single-round hitscan guns, round by round.
          if (!shot.alt && shot.def.kind === 'hitscan' && shot.def.pellets === 1 && shot.ends[0]) {
            const e = local.eye;
            const d = { x: shot.ends[0].x - e.x, y: shot.ends[0].y - e.y, z: shot.ends[0].z - e.z };
            const len = Math.hypot(d.x, d.y, d.z);
            if (len > 0.01) this.spray.shot(shot.def.id, { x: d.x / len, y: d.y / len, z: d.z / len }, (cmd.seq * 1000) / TICK_RATE);
          }
          this.view.kick(shot.def, shot.alt);
          const muzzle = this.view.localMuzzle();
          const strength = Math.min(2.5, Math.max(0.6, ((shot.alt ? shot.def.alt?.damage : undefined) ?? shot.def.damage) / 25));
          // Your rounds leave at their real speed; only tracer rounds draw a streak (the rest still land).
          shot.ends.forEach((end, i) => this.view.shotVisual({ eye: local.eye, muzzle, to: end, color: shot.def.view.tracer, victim: null, zone: 0, strength, def: shot.def, local: true, ...(shot.speed ? { speed: shot.speed, time: shot.times?.[i] ?? 0, tracer: shot.tracer !== false } : {}) }));
          // Mechanical recoil is in the prediction (the camera shows it, below); this is the visual kick on top.
          // Only big single kicks (revolver, rifles that slam, shotguns) shake the camera, and briefly: automatics would blur your target.
          // A second trigger shakes only by its own kick (the Battle Axe's blunderbuss); a swing never does.
          const visual = shot.alt ? (shot.def.alt?.kick?.visual ?? 0) : shot.def.kind === 'melee' ? 0 : (gunplayOf(shot.def).kick?.visual ?? 0);
          if (visual >= 0.8) this.view.shake(Math.min(0.25, visual * 0.15));
        }
      }
      if (netProbe.on) for (const i of this.outbox) netProbe.inputAt.set(i.seq, now);
      this.opts.transport.sendInputs(this.outbox.splice(0));
      this.sfx.localWeapon(local);
      if (!out) this.opts.audio.setListener(local.eye, this.input.yaw, this.input.pitch);

      // Seated: the camera rides the vehicle (cockpit or chase, see VehicleCamera); seat guns replace your own weapon.
      this.mounts?.smooth(dt);
      // Vehicles are posed before the camera, so a cockpit view rides the model drawn this frame (no lag, no jitter).
      if (this.mounts) this.view.updateMounts(this.mounts.mounts.values(), this.mannedTurret());
      const ride = local.alive && this.seat ? this.mounts?.mounts.get(this.seat[0]) : undefined;
      const seatDef = ride?.def.seats[this.seat?.[1] ?? 0];
      // The gun this seat fires: its own, or (the driver) an empty gunner seat's marked driverFires (the Tank's cannon).
      const gunSeat = ride && this.seat ? firingSeat(ride.def, this.seat[1], (i) => (ride.seats[i] ?? -1) >= 0 && ride.seats[i] !== this.slot) : null;
      const gunWeapon = gunSeat === null ? undefined : ride!.def.seats[gunSeat]?.weapon;
      const seatGun = gunWeapon ? CORE_WEAPONS[gunWeapon] : undefined;
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
      // Zoomed look speed: 1:1 with hip fire at the crosshair, times the player's zoom sensitivity.
      this.input.sensitivityScale = zoomLookScale(fov, DEFAULT_FOV, DEFAULT_FOV * ADS_FOV, this.input.mouse.zoomSensitivity);
      // Full-body first person stands your character under the camera only while the camera is your own eyes.
      this.view.firstPersonEye = false;
      if (ride && seatDef) {
        const seatIndex = this.seat![1];
        const feet = mountToWorld(ride.shown.pos, ride.shown.yaw, seatDef.offset);
        const body = ride.body.handle;
        // The chase camera's ray ignores the ride's own box (it starts above it, but you can look up from under it).
        const cast = (from: Vec3, dir: Vec3, len: number): number | null => {
          let start = 0;
          for (let i = 0; i < 4; i++) {
            const o = { x: from.x + dir.x * start, y: from.y + dir.y * start, z: from.z + dir.z * start };
            const hit = local.physics.raycastHit(o, dir, len - start);
            if (!hit) return null;
            if (hit.handle !== body) return start + hit.dist;
            const exit = rayBoxExit(o, dir, { x: ride.pos.x, y: ride.pos.y + ride.def.half[1], z: ride.pos.z }, ride.def.half, ride.yaw);
            start += Math.max(hit.dist, exit ?? 0) + 0.05;
            if (start >= len) return null;
          }
          return null;
        };
        const pose = this.vehicleCam.update(
          dt,
          {
            def: ride.def,
            index: ride.index,
            seat: seatIndex,
            pos: ride.shown.pos,
            yaw: ride.shown.yaw,
            vel: ride.vel,
            tilt: this.view.mountTilt(ride.index),
            cockpitEye: this.view.mountPoint(ride.index, cockpitEye(ride.def, seatIndex)) ?? mountToWorld(ride.shown.pos, ride.shown.yaw, cockpitEye(ride.def, seatIndex)),
            levelEye: mountToWorld(ride.shown.pos, ride.shown.yaw, cockpitEye(ride.def, seatIndex)),
            // A real seat: a seated head height over the cushion (the sim's crouching eye); otherwise standing.
            seatEye: seatDef.seated ? mountToWorld(ride.shown.pos, ride.shown.yaw, cockpitEye(ride.def, seatIndex)) : { x: feet.x, y: feet.y + PLAYER.eyeHeight, z: feet.z },
          },
          this.input,
          cast,
          fov,
        );
        this.rideView = pose.mode;
        this.view.setCockpit(pose.mode === 'cockpit' ? ride.index : null);
        this.view.setCamera(pose.pos, pose.yaw, pose.pitch, pose.fov, pose.roll);
      } else {
        this.vehicleCam.reset();
        this.rideView = null;
        this.view.setCockpit(null);
        // The view eases down and up as you crouch, go prone or stand; between ticks it glides.
        const eye = local.eye;
        const offset = eye.y - local.state.pos.y;
        this.eyeOffset = this.eyeOffset === null || !local.alive ? offset : this.eyeOffset + (offset - this.eyeOffset) * Math.min(1, dt * 12);
        const drawn = local.renderPos(this.acc / TICK_DT);
        // How fast you're going on screen (the weapon bob keeps pace with it).
        const v = dt > 0 ? Math.hypot(drawn.x - this.drawnPos.x, drawn.z - this.drawnPos.z) / dt : 0;
        this.drawnSpeed += ((v > 20 ? 0 : v) - this.drawnSpeed) * Math.min(1, dt * 10);
        this.drawnPos = drawn;
        const head = { x: drawn.x, y: drawn.y + this.eyeOffset, z: drawn.z };
        // Out of play: the kill cam, following someone, or the free camera (the sound goes where the camera is).
        const watching = out ? this.spectatorCamera(now, local, fov, picks) : null;
        if (watching) {
          this.opts.audio.setListener(watching.pos, watching.yaw, watching.pitch);
        } else if (out) {
          // Nobody to watch: the view stays where you fell.
          this.opts.audio.setListener(local.eye, this.input.yaw, this.input.pitch);
          this.view.setCamera(head, this.input.yaw, this.input.pitch, fov);
        } else if (this.thirdPerson && local.alive) {
          // Over the right shoulder, pulled in where a wall is in the way (shared/sim/thirdPerson.ts: the host aims
          // your rounds from the same camera).
          const cam = thirdPersonCamera((o, d, max) => local.physics.raycastWorld(o, d, max), head, this.input.yaw, this.input.pitch);
          // Squeezed in against a wall: your own body would fill the screen, so it isn't drawn.
          this.tpClose = cam.dist < 1.6;
          this.view.setCamera(cam.pos, this.input.yaw, this.input.pitch, fov);
        } else {
          // First person: the view carries the weapon's mechanical recoil (it is where your rounds go).
          const aimed = local.aimAngles(this.input.yaw, this.input.pitch);
          this.view.setCamera(head, aimed.yaw, aimed.pitch, fov, this.zipLean(local, dt, now));
          this.view.firstPersonEye = true;
        }
      }
      this.view.setViewmodel(weapon);
      // Guns no longer carried free their first-person copies (and a held copy's video memory).
      if (local.inventory !== this.carriedInventory) {
        this.carriedInventory = local.inventory;
        const carried = [...local.inventory.keys()].sort((a, b) => a - b).join(',');
        if (carried !== this.carried) {
          this.carried = carried;
          this.view.trimViewmodels(new Set([...local.inventory.keys()].map((code) => weaponByCode(code)?.id).filter((id): id is string => !!id)));
        }
      }
      const reloadFrac = weapon && local.reloadTicks > 0 ? Math.min(1, local.reloadTicks / 10, ((local.reload?.total ?? weapon.reloadTicks) - local.reloadTicks) / 10) : 0;
      this.view.updateViewmodel(dt, { moving, raise: weapon && weapon.raiseTicks ? local.raiseTicks / weapon.raiseTicks : 0, reload: reloadFrac, hidden: zoomed || (this.thirdPerson && !ride) || this.rideView === 'chase', ads: this.adsAmount, speed: this.drawnSpeed });
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
      this.hud.setStamina(local.state.stamina ?? 1, !!local.state.winded, local.alive, this.seat ? 0 : (local.state.stance ?? 0));
      // On a vehicle or turret gun the crosshair becomes a gunner's reticle (heat shown round it).
      this.hud.setGunnerReticle(seatGun && this.seat ? this.seat[2] : null);
      if (seatGun && this.seat) this.hud.setMountedGun(seatGun.displayName, this.seat[2], this.seat[3], gunSeat === null ? undefined : ride?.def.seats[gunSeat]?.ammo?.max);
      else this.hud.setWeapons(local.inventory, local.held, local.reloadTicks > 0, local.alive, handsBusy);
      this.hud.setThrowable(local.throwable, local.alive);
      // Holding G: show where the throw will go (bounces and the blast area).
      const aiming = this.input.throwAiming && local.alive && local.throwable && !handsBusy ? local.throwable.kind : null;
      if (aiming) {
        const spec = THROWABLE_DEFS[aiming].projectile;
        const path = predictThrow(spec, local.state.pos, this.input.yaw, this.input.pitch, 0.12, (o, d, len) => this.view.raycastLevel(o, d, len));
        // How far it reaches where it lands: a mine's trigger, a blast, or a cloud or puddle (gas, smoke, fire).
        this.view.throwArc.show(path, spec.mine?.triggerRadius ?? (spec.splashRadius || spec.zone?.radius || 0));
      } else this.view.throwArc.hide();
      // The throwable in your hands while you line it up (first person; your own model in third person throws as before).
      this.view.setThrowHold(aiming && !this.thirdPerson ? aiming : null);
      this.input.altTrigger = !!local.weapon?.alt && local.weapon.kind === 'melee';
      this.hud.setMessageMenu(this.input.msgMenu && this.rules?.emotes !== false, QUICK_MESSAGES);
      this.hud.setClassMenu(this.classesOn && this.input.classMenu, this.classesOn ? { current: this.myClass?.[0] ?? null, next: this.myClass?.[1] ?? null, full: this.classesFull(), pick: (i) => this.input.chooseClass(i) } : null);
      this.hud.setStatusLines(this.classStatusLines());
      this.hud.setPowerups(local.speedTicks / TICK_RATE, local.damageTicks / TICK_RATE, local.jetFuel === null ? null : local.jetFuel / JET.max, this.uav, this.jam, this.streakLabel());
      // A spectator isn't waiting to respawn: no "Respawning…".
      this.hud.setStatus(this.phase, this.timeLeft, local.alive || this.spectator, this.winner, this.outcome);
      this.rouletteHud?.frame(now);
      this.updateScenarioHud(local, now);
      this.coachFrame(local, now, dt, ride, !!ride && seatDef?.role === 'driver' && ride.def.kind === 'vehicle');
    }
    if (this.scenario) {
      this.view.scenario.apply(this.scenario.entities);
      // Platforms are drawn where you are in time (your predicted tick), so what you stand on stays under your feet.
      if (this.scenario.movers.defs.length && this.local) {
        const tick = this.local.predTick - 1 + this.acc / TICK_DT;
        this.view.scenario.applyMovers(this.scenario.movers, tick);
        this.view.applyMoverProps(this.scenario.movers, tick);
      }
      this.view.applyPropStates(this.scenario.entities);
    }
    this.view.updatePickups(this.taken, now, this.pickupItems);
    this.view.updateDrops(this.drops);
    const shells = this.interp.sampleProjectiles(now);
    this.view.updateProjectiles(shells);
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
      // Engines run while anyone rides: yours unpositioned, the nearest others' from where they are.
      if (!document.hidden) this.sfx.engines(this.mounts.mounts.values(), manned?.alive ? manned.index : null, cam);
      if (!document.hidden) this.weatherSound.update(this.view.weather.current, this.view.weather.stats.shelter, performance.now());
      if (!local) this.view.updateMounts(this.mounts.mounts.values(), this.mannedTurret());
    }
    this.hud.setStatusTint(statusColor(this.local?.alive ? this.localStatus : 0));
    this.hud.tickHurt();
    this.hud.tickHeavy();
    const poses = this.interp.sample(now);
    // Riders are drawn on their seats of the vehicle as drawn this frame (not where their own, interpolated pose
    // has them: that runs behind the vehicle's clock, and at speed they drifted out of the back of it).
    if (this.mounts) this.riderPlacement.place(poses, this.mounts.seatedRiders(), (i, o) => this.view.seatPoint(i, o), dt);
    // Splashes and ripples where players and projectiles meet water.
    this.view.scenario.liquids.fx.track(poses, shells);
    this.modeHud?.frame(poses, local?.alive ? local.eye : null, this.input.yaw, now);
    this.forts?.frame(local?.alive ? local.eye : null, this.input.yaw, this.input.pitch, !!local?.alive && building, poses.filter((p) => p.slot !== this.slot), local?.alive ? local.state.pos : null);
    // Your own character drawn where prediction has you (not the delayed server copy): in third person, and in
    // full-body first person (under the camera).
    const mine = local?.alive && !this.seat ? poses.find((p) => p.slot === this.slot) : undefined;
    if (mine && local) Object.assign(mine, { x: this.drawnPos.x, y: this.drawnPos.y, z: this.drawnPos.z, yaw: this.input.yaw, pitch: this.input.pitch, stance: local.state.stance ?? 0, grounded: local.state.grounded, weapon: local.held, chute: local.state.chute ?? 0, sprinting: !!local.state.sprint, zip: local.state.zip, zipSpeed: Math.abs(local.state.zv ?? 0) });
    // Drawn as others see you: on foot in third person, and in a seat in the chase view (ownBody.ts).
    const bodyDrawn = ownBodyDrawn({ alive: !!local?.alive, seated: !!this.seat, rideView: this.rideView, thirdPerson: this.thirdPerson, tpClose: this.tpClose });
    const self = bodyDrawn ? mine : undefined;
    // In a seat: the pose riderPlacement put on your seat of the vehicle as drawn (seated and holding as every rider
    // is), turned where you look now rather than where the server last had you.
    const rider = bodyDrawn && this.seat ? poses.find((p) => p.slot === this.slot && p.alive) : undefined;
    if (rider) Object.assign(rider, { yaw: this.input.yaw, pitch: this.input.pitch });
    if (self && local) {
      // The gun points where your rounds go: at what the crosshair is on (the host aims them from the same camera),
      // not along the view, beside it: aiming down the sights magnified that miss.
      const aim = thirdPersonAim((o, d, max) => local.physics.raycastWorld(o, d, max), local.eye, this.input.yaw, this.input.pitch);
      self.pitch = aim.pitch;
      self.aimYaw = angleDelta(this.input.yaw, aim.yaw);
      this.tpAim = { yaw: self.aimYaw, pitch: aim.pitch };
    }
    // Your own canopy in first person (third person draws it over your character).
    this.view.updateLocalCanopy(local?.alive && !self && !this.seat && local.state.chute ? this.drawnPos : null, this.input.yaw, local?.state.chute ?? 0);
    this.view.updateLocalTrolley(local?.alive && !self && !this.seat && local.state.zip !== undefined ? this.drawnPos : null, local?.state.zip, local?.scale ?? 1);
    // Hostage Rescue: the hostages walk about like everyone else.
    const hostages = this.modeHud?.hostagePoses() ?? [];
    const tAvatars = perfProbe.on ? performance.now() : 0;
    this.view.updateAvatars(
      hostages.length ? [...poses, ...hostages] : poses,
      self || rider ? -1 : this.slot,
      (id) => {
        if (id >= HOSTAGE_SLOT_BASE) return { npc: { color: '#cfc4a8', scale: 1, female: id % 2 === 1 } };
        const npc = this.npcLook(id);
        // About half of each squad uses the female mannequin.
        if (npc?.creature) return npc.size === 1 ? { creature: npc.creature } : { creature: npc.creature, size: npc.size };
        if (npc?.look) return npc.scale === 1 ? { look: npc.look } : { look: npc.look, size: npc.scale };
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
        // Fireteams: your squadmates in your squad's colour (Part 2).
        if (this.squadHud.isMate(id, this.slot)) return SQUAD_COLOR;
        if (mine && theirs && mine.id === theirs.id) return this.markers.ally === 'team' ? mine.color : this.markers.ally;
        if (mine && theirs) return this.markers.enemy;
        // Free-for-all: your party's people get the ally marker (ffaParty.ts).
        if (!mine && id < NPC_ID_BASE && this.hud.partyMate(id)) return this.hud.partyColor;
        return null;
      },
      this.mounts?.riders(),
      this.mounts?.sitters(),
    );
    if (tAvatars) perfProbe.add(SYS.avatars, tAvatars);
    this.sfx.remoteSteps(poses, this.riderPlacement.placed);
    if (this.fxWatch) {
      const me = this.local;
      this.fxWatch.update(me ? [...poses.filter((p) => p.slot !== this.slot), { slot: this.slot, x: me.state.pos.x, y: me.state.pos.y, z: me.state.pos.z, alive: me.alive, grounded: me.state.grounded, ...(me.state.zip !== undefined ? { zip: me.state.zip } : {}) }] : poses);
    }
    const tHud = perfProbe.on ? performance.now() : 0;
    this.hud.renderScoreboard(this.input.held('Tab') || this.phase === 'intermission', this.scores, this.slot, this.phase === 'intermission');
    this.hud.setTeamScore(this.scores, this.slot, this.rules?.scoreLimit ?? 0, this.allied);
    if (local) {
      // Teammates on the minimap (co-op: every player is one).
      const mine = this.hud.team(this.slot);
      const coop = this.allied;
      const shown = poses.filter((p) => p.slot !== this.slot && p.slot < NPC_ID_BASE && p.alive && (coop || (mine && this.hud.team(p.slot)?.id === mine.id)));
      const visible = shown.map((p) => p.slot);
      const blips: MinimapBlip[] = shown.map((p) => ({ x: p.x, z: p.z, color: coop ? '#2ecc71' : mine!.color }));
      // Fireteams: your squadmates in the squad's colour (ringed), and its order's place (Part 2).
      if (this.squadHud.current) {
        const mates = new Map(poses.map((p) => [p.slot, p] as const));
        for (let i = blips.length - 1; i >= 0; i--) if (this.squadHud.isMate(visible[i]!, this.slot)) blips.splice(i, 1);
        blips.push(...this.squadHud.blips(this.slot, (slot) => mates.get(slot) ?? null));
      }
      // The mode's objectives (Breakthrough's in play), pinned to the rim when out of range.
      blips.push(...(this.modeHud?.minimapBlips() ?? []));
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
      this.damageNumbers.update((p) => this.view.project(p), now);
      // On the game's clock (inputs), so a slow frame rate doesn't split a burst or stretch the settle time.
      this.spray.update(local.gun, (local.inputSeq * 1000) / TICK_RATE);
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
        ...(this.showStats ? this.perf.lines() : {}),
        renderer: this.opts.rendererKind,
        match: this.opts.transport.label,
        ...(this.showStats ? {} : { fps: this.fps.toFixed(0), frame: `${this.frameMs.toFixed(1)} ms` }),
        ping: `${this.opts.transport.rttMs.toFixed(0)} ms`,
        'down (client)': `${this.kibPerSec.toFixed(1)} KiB/s`,
        corrections: `${this.correctionsPerSec.toFixed(1)}/s (last ${((local?.lastCorrection ?? 0) * 100).toFixed(1)} cm)`,
        'unacked input': local?.pendingCount ?? 0,
        position: local ? `${local.state.pos.x.toFixed(1)}, ${local.state.pos.y.toFixed(1)}, ${local.state.pos.z.toFixed(1)}` : '-',
      },
      this.serverStats,
      this.botStates,
    );
    this.perf.visible = this.showStats;
    if (tHud && perfProbe.on) perfProbe.add(SYS.hud, tHud);
    if (!perfProbe.on) return this.view.render();
    this.view.countDraws();
    const r0 = performance.now();
    this.view.render();
    const end = performance.now();
    perfProbe.render = end - r0;
    perfProbe.endFrame(end);
    const counts = this.view.perfCounts();
    this.perf.noteFrame(counts);
    this.recorder?.noteFrame(counts);
  }
}

/** NPCs ride the same interpolation as players; fields they don't have are zero. */
function npcAsPlayer(n: NpcSnapshot): PlayerSnapshot {
  return { s: n[0], p: [n[1], n[2], n[3]], vy: 0, g: 1, yaw: n[4], pitch: n[5], hp: n[6], ar: 0, alive: n[9], w: n[10], pu: 0 };
}

/** This browser is a phone or tablet (touch first): hosting on it stops when its screen goes off. */
function phoneHost(): boolean {
  try {
    return matchMedia('(pointer: coarse)').matches && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

/** The order wheel's second line for each order: what it goes by. */
const ORDER_HINTS: Readonly<Record<OrderKind, string>> = { follow: 'On you', hold: 'Where you stand', go: 'Where you aim or ping', attack: 'The enemy you aim at or ping', defend: "The mode's objective", regroup: 'To you, now', spacing: 'Further apart' };
