import {
  inHand,
  CLASS_DEFS,
  CLASS_IDS,
  BUTTON_ALT,
  BUTTON_AUTO_RELOAD,
  BUTTON_THIRD_PERSON,
  BUTTON_FIRE,
  BUTTON_MELEE,
  BUTTON_RELOAD,
  BUTTON_SPRINT,
  BUTTON_USE,
  BUTTON_ZOOM,
  RELOAD_KINDS,
  akimboCone,
  akimboKick,
  akimboLoader,
  akimboMove,
  akimboOf,
  akimboRaise,
  pairReloadTurn,
  spreadOf,
  type AkimboSpec,
  angleDelta,
  beginReload,
  bulletPhysics,
  counterFrom,
  counterRecoil,
  gunplayOf,
  clampFireMode,
  fireModeCount,
  firingOf,
  nextFireMode,
  type Firing,
  isTracer,
  newGunState,
  recoilIdle,
  recoilShot,
  roundsReady,
  autoReloadDue,
  shotCone,
  stepAds,
  stepReload,
  traceBullet,
  type AmmoBox,
  type GunState,
  type MatchRules,
  type ReloadRun,
  OIL_TRACTION,
  applyPads,
  applyPortals,
  bodyHeightOf,
  type Portal,
  type JumpPad,
  type Ladder,
  type LiquidBox,
  JET,
  stepJetFuel,
  TICK_DT,
  ZONE_KINDS,
  zoneContains,
  THROWABLES,
  PLAYER,
  eyeHeightOf,
  eyePoint,
  eyeScaleOf,
  PhysicsWorld,
  SPEED_BOOST,
  RAPID_RELOAD,
  fillMagazine,
  noPowers,
  powerMove,
  powersFromWire,
  rapidFireRate,
  rapidSteps,
  tickPowers,
  type PowerTicks,
  WEAPONS_BY_SLOT,
  weaponByCode,
  weaponCode,
  distance,
  stepMovement,
  viewDirection,
  type GravityZone,
  type MoveState,
  type PlayerInput,
  type PlayerSnapshot,
  type PrivateState,
  type Vec3,
  type WeaponDefinition,
  type ZoneSnapshot,
  type Zipline,
  oneHanded,
  thirdPersonAim,
} from '@tiletrigger/shared';
import type { VehiclePrediction } from './vehiclePrediction.ts';

const MAX_PENDING = 120;
const ORDER = new Map(WEAPONS_BY_SLOT.map((w) => [w.id, weaponCode(w)]));

export interface PredictedShot {
  def: WeaponDefinition;
  /** Predicted tracer end points (one per pellet; empty for melee/projectiles). */
  ends: Vec3[];
  /** The second trigger. */
  alt?: boolean;
  /** Dual wielding: the second gun of a pair fired it. */
  off?: boolean;
  /** Ballistic bullets: muzzle speed (m/s) for the drawn round, flight time to each end (s), and whether this round shows a tracer. */
  speed?: number;
  times?: number[];
  tracer?: boolean;
}

/** Crouched and prone steady the aim (the server's STANCE_SPREAD). */
const STANCE_SPREAD = [1, 0.7, 0.5] as const;


/**
 * Client-side prediction for the local player: apply each input immediately
 * with the shared movement code, keep unacknowledged inputs, and on every
 * snapshot rewind to the server state and replay them.
 *
 * Movement (including speed boosts) is predicted exactly. Weapon state is
 * predicted cosmetically, for instant tracers, viewmodel kick and HUD ammo;
 * the server stays authoritative for hits, ammo and reloads.
 */
export class LocalPlayer {
  state: MoveState = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: false };
  alive = false;
  health = 100;
  armor = 0;
  /** Held weapon code (predicted). */
  held = 0;
  /** Owned weapons: code -> [magazine, reserve, second-trigger rounds, heat %] (server values, adjusted by predicted shots). */
  inventory = new Map<number, [number, number, number, number]>();
  /** The map's jump pads (launches are predicted like the server's). */
  pads: JumpPad[] = [];
  liquids: LiquidBox[] = [];
  ladders: Ladder[] = [];
  /** The map's ziplines (E grabs one; riding is predicted like the server's), and your team for team-only lines. */
  ziplines: Zipline[] = [];
  team: () => string | null = () => null;
  /** Your body size (BODY_SIZES scale), the same the server uses. */
  scale = 1;
  /** Jetpack fuel units (see JET), or null without a jetpack. */
  jetFuel: number | null = null;
  /** Carrying a glider (canopies open as gliders, as on the server). */
  glider = false;
  /** Seated in a turret or vehicle: the server moves you, so movement isn't predicted. */
  mounted = false;
  /** Driving a rigid vehicle: it is predicted (vehiclePrediction.ts; the session sets it up from PrivateState.vp). */
  vehicle: VehiclePrediction | null = null;
  /** The seat's gun (set by the session while seated), its heat, and whether the seat can't shoot at all (driving). */
  seatGun: WeaponDefinition | null = null;
  private seatAmmo: [number, number, number, number] = [0, 0, 0, 0];
  /** The seat gun's rounds aboard when limited (the Tank's shells, PrivateState.mo[3]); null: it never runs dry. */
  private seatShells: number | null = null;
  unarmed = false;
  /** Movement multiplier from status effects (server value). */
  statusSpeed = 1;
  /** Your body's own speed, jump and stamina (size class and character stats; server values). */
  bodySpeed = 1;
  jump = 1;
  stamina = 1;
  /** Classes: extra jumps in the air your class has (the Runner's double jump). */
  airJumps = 0;
  /** Ground hazards from the latest snapshot (oil makes movement slick). */
  zones: readonly ZoneSnapshot[] = [];
  /**
   * Moving platforms (map movers): put their colliders where they are at a
   * tick and carry feet standing on them, exactly as the server does.
   */
  platforms: { poseAt(tick: number): void; carry(feet: Vec3, tick: number): Vec3 | null } | null = null;
  /** The map's portals, and whether one (entity index) is switched on (replicated scenario state): crossings are predicted like the server's. */
  portals: Portal[] = [];
  portalOn: (entity: number) => boolean = () => true;
  /** View turn (radians) from portals walked through in live prediction, for the session to add to your yaw (replays never turn it again). */
  portalTurn = 0;
  /** Server tick the latest predicted input will run on (estimate: snapshot tick + inputs not yet acknowledged). */
  predTick = 0;
  /**
   * Gunplay state mirrored exactly from the server (gunplay.ts): the
   * mechanical recoil offset (the camera shows it, and it is where rounds
   * go), spray, sights, and the reload in progress with its stages.
   */
  gun: GunState = newGunState();
  reload: ReloadRun | null = null;
  /** Weapons with a magazine in but no round chambered. */
  private unchambered = new Set<number>();
  /** Rounds fired since drawing the held weapon (tracer intervals). */
  private rounds = 0;
  /** Angles sent with the last input (mouse movement is measured from them to counter recoil). */
  private lastYaw = 0;
  private lastPitch = 0;
  private prevButtons = 0;
  /** Match rules the drawn rounds fly by (ballistics). */
  rules: Pick<MatchRules, 'ballistics'> = {};
  /** Trigger state mirrored from the server rules (semi-auto latch, spin-up, burst). */
  private semiLatch = false;
  private windup = 0;
  private burstLeft = 0;
  private burstTimer = 0;
  private burstEvery = 0;
  /** The fire mode you want for each weapon you hold (by code; sim/fireModes.ts), sent with every input. */
  private readonly wantedModes = new Map<number, number>();
  /** Fire modes as the host applies them (WeaponState.mode): the inputs' values, step for step. */
  private readonly appliedModes = new Map<number, number>();

  /** Switch the held weapon to its next fire mode; returns the new mode, or null when it has only one. */
  cycleFireMode(): Firing | null {
    const def = this.weapon;
    // A pair: the key puts the second gun away and brings it back (a pair has no fire modes).
    if (def && !this.seatGun && this.offs.has(this.held)) {
      this.wantedModes.set(this.held, this.wantedModes.get(this.held) === 1 ? 0 : 1);
      return firingOf(def);
    }
    if (!def || fireModeCount(def) < 2 || this.seatGun) return null;
    const next = nextFireMode(def, this.wantedModes.get(this.held) ?? 0);
    this.wantedModes.set(this.held, next);
    return firingOf(def, next);
  }

  /** The held weapon's fire mode (as wanted: the host takes it with the next input), or null when it has one. */
  fireMode(): Firing | null {
    const def = this.weapon;
    if (!def || fireModeCount(def) < 2) return null;
    return firingOf(def, this.wantedModes.get(this.held) ?? 0);
  }
  /**
   * Dual wielding (docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield"): the second guns you hold, by weapon code
   * (PrivateState.ow: magazine, no round chambered, put away), predicted like the inventory; and the second gun's own
   * trigger and reload, mirrored from the match (Combatant.fireCooldown2 and the rest).
   */
  offs = new Map<number, { mag: number; unchambered: boolean; away: boolean }>();
  reload2: ReloadRun | null = null;
  reloadTicks2 = 0;
  private fireCooldown2 = 0;
  private semiLatch2 = false;
  /**
   * Rounds a pair fired in inputs the host may not have seen yet ([input seq, weapon code, first gun's, second
   * gun's]): taken off the host's magazines on each snapshot, so the two counts don't jump back up between a shot
   * and its acknowledgement and neither gun fires rounds it doesn't have.
   */
  private pairShots: [number, number, number, number][] = [];

  /** The pair in hand's trade, or null: the weapon `code` has its second gun and it is out. */
  pairOf(code: number = this.held): AkimboSpec | null {
    const o = this.offs.get(code);
    const def = o && !o.away ? weaponByCode(code) : undefined;
    return def ? akimboOf(def) : null;
  }

  /** Whether a pair is in your hands now (not from a seat's gun): the second trigger is the second gun's, and nothing aims. */
  get paired(): boolean {
    return !this.seatGun && this.pairOf() !== null;
  }

  /**
   * Which of a pair's guns a hand is on now, [the gun you held, the second gun]: one reloads at a time, and the other's
   * reload, when asked for, waits its turn (that gun still fires, so it shows its rounds).
   */
  pairReloading(): [boolean, boolean] {
    const first = this.reload && this.reloadTicks > 0 ? this.reload : null;
    const second = this.reload2 && this.reloadTicks2 > 0 ? this.reload2 : null;
    if (!second) return [!!first, false];
    const turn = pairReloadTurn(first, second, this.inventory.get(this.held)?.[0] ?? 0, this.offs.get(this.held)?.mag ?? 0);
    return [turn === 1, turn === 2];
  }

  /** With a second gun of the held weapon: 'pair' (both out, as wanted: the host takes it with the next input) or 'single'; null without one. */
  pairMode(): 'pair' | 'single' | null {
    if (!this.offs.has(this.held) || this.seatGun) return null;
    return this.wantedModes.get(this.held) === 1 ? 'single' : 'pair';
  }

  /** Carried grenades or mines. */
  throwable: { kind: (typeof THROWABLES)[number]; count: number } | null = null;
  reloadTicks = 0;
  raiseTicks = 0;
  speedTicks = 0;
  damageTicks = 0;
  /** The other power-ups' timers (sim/powerups.ts), counted down as the server does (in each move). */
  power: PowerTicks = noPowers();
  /** Whether each input's predicted move ended sprinting (by seq): where a replay starts, for the sprint exit. */
  private readonly sprintAfter = new Map<number, boolean>();
  private readonly collider;
  private pending: PlayerInput[] = [];
  private seq = 0;
  /** The last input's sequence number: the game's own clock (one a tick), for readouts timed in game time. */
  get inputSeq(): number {
    return this.seq;
  }
  private fireCooldown = 0;
  corrections = 0;
  lastCorrection = 0;

  constructor(readonly physics: PhysicsWorld) {
    this.collider = physics.createPlayerCollider();
  }

  /** Gravity multiple in force (match rules over the map's), so prediction falls like the server. */
  gravity = 1;
  /** The map's low-gravity zones (see mapGravityZones), applied exactly as the server applies them. */
  gravityZones: GravityZone[] = [];

  /** Position at the start of the latest predicted tick (drawing blends from it to `state.pos`). */
  private prevPos: Vec3 | null = null;

  /**
   * Where to draw you between ticks: prediction runs at 60 Hz, screens often refresh faster,
   * so without blending the camera and your third-person body step instead of gliding.
   * `alpha` is how far into the next tick (0..1); big jumps (respawns, teleports) snap.
   */
  renderPos(alpha: number): Vec3 {
    const p = this.prevPos;
    const c = this.state.pos;
    if (!p || Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) > 2) return c;
    const k = Math.min(1, Math.max(0, alpha));
    return { x: p.x + (c.x - p.x) * k, y: p.y + (c.y - p.y) * k, z: p.z + (c.z - p.z) * k };
  }

  /** Where your eyes are (they drop when you crouch or go prone, and lean out with a peek, as the host has them: eyePoint). */
  get eye(): Vec3 {
    // On a mount at full size, as the host has it (eyeScaleOf).
    if (!this.state.lean) return { x: this.state.pos.x, y: this.state.pos.y + eyeHeightOf(this.state, eyeScaleOf(this.scale, this.mounted)), z: this.state.pos.z };
    return eyePoint(this.state.pos, this.lastYaw, this.state.stance ?? 0, this.state.lean, this.scale);
  }

  get weapon(): WeaponDefinition | undefined {
    return weaponByCode(this.held);
  }

  /** Owned weapon codes in slot order (for wheel cycling and number keys). */
  ownedCodes(): number[] {
    return WEAPONS_BY_SLOT.map((w) => ORDER.get(w.id)!).filter((code) => this.inventory.has(code));
  }

  /** Where the camera and the rounds point: the view plus the mechanical recoil offset. */
  aimAngles(yaw: number, pitch: number): { yaw: number; pitch: number } {
    return { yaw: yaw + this.gun.ry, pitch: Math.max(-1.55, Math.min(1.55, pitch + this.gun.rp)) };
  }

  /**
   * Where a round fired with this input goes (Match.aimOf): the view plus the recoil; in third person, first
   * turned from the eye onto what the crosshair is on. (The host works that out against the players as you saw
   * them too; this cosmetic copy only against the level.)
   */
  private shotAim(input: PlayerInput): { yaw: number; pitch: number } {
    if (!(input.buttons & BUTTON_THIRD_PERSON) || this.seatGun) return this.aimAngles(input.yaw, input.pitch);
    const a = thirdPersonAim((o, d, max) => this.physics.raycastWorld(o, d, max), this.eye, input.yaw, input.pitch);
    return this.aimAngles(a.yaw, a.pitch);
  }

  /**
   * Predict one tick. Returns the input to send, any predicted shot, and the
   * part of this tick's mouse movement that went into countering recoil
   * (`absorbed`, pitch and yaw): the caller adds it back to its view angles,
   * because that movement brought the recoil down instead of turning the view.
   */
  tick(sample: { forward: number; right: number; buttons: number; say?: number }, yaw: number, pitch: number, weapon: number, viewTick: number): { input: PlayerInput; shot: PredictedShot | null; shot2: PredictedShot | null; absorbed: [number, number] | null } {
    let absorbed: [number, number] | null = null;
    if (this.alive) {
      // Pulling against the recoil (the server applies the same counter from `rc`).
      const [cp, cy] = counterFrom(this.gun, pitch - this.lastPitch, angleDelta(this.lastYaw, yaw));
      if (cp || cy) {
        counterRecoil(this.gun, cp, cy);
        pitch += cp;
        yaw += cy;
        absorbed = [cp, cy];
      }
    }
    this.lastYaw = yaw;
    this.lastPitch = pitch;
    const input: PlayerInput = { seq: ++this.seq, ...sample, yaw, pitch, weapon, viewTick, ...(absorbed ? { rc: absorbed } : {}) };
    // The fire mode wanted for the gun that will be in hand (the host sets it after any switch, as here).
    const modeCode = weapon && this.inventory.has(weapon) ? weapon : this.held;
    const modeDef = weaponByCode(modeCode);
    if (modeDef?.fireModes) input.fireMode = clampFireMode(modeDef, this.wantedModes.get(modeCode));
    // A pair: 1 puts the second gun away, 0 keeps it out.
    else if (this.offs.has(modeCode)) input.fireMode = this.wantedModes.get(modeCode) === 1 ? 1 : 0;
    this.prevPos = { ...this.state.pos };
    let shot: PredictedShot | null = null;
    let shot2: PredictedShot | null = null;
    if (this.alive) {
      if (weapon && weapon !== this.held && this.inventory.has(weapon)) {
        this.held = weapon;
        const pair = this.pairOf();
        this.raiseTicks = pair && this.weapon ? akimboRaise(this.weapon, pair) : (this.weapon?.raiseTicks ?? 0);
        this.cancelReload();
        this.windup = 0;
        this.burstLeft = 0;
        this.gun.shots = 0;
        this.gun.spray = 0;
        this.gun.ads = 0;
        this.rounds = 0;
      }
      // As the host (Match.applyInputs): the input's fire mode puts a pair's second gun away or brings it back; with
      // the pair in hand nothing aims and the second trigger ends a sprint. The input goes out as it was sampled.
      const applied = this.pairInput(input, this.held, this.offs.get(this.held), true);
      const sprinted = !!this.state.sprint;
      // (Rapid Fire as the server reads it: its timer before this input's count down, which the move does here.)
      const rapidLeft = this.power.rapid;
      if (!this.mounted) this.state = this.move(this.state, applied, this.predTick + 1, true);
      else this.vehicle?.step(input);
      if (this.fireCooldown > 0) this.fireCooldown--;
      if (this.fireCooldown2 > 0) this.fireCooldown2--;
      const rapid = rapidSteps(rapidLeft, rapidFireRate(this.damageTicks > 0));
      if (rapid) {
        this.fireCooldown = Math.max(0, this.fireCooldown - rapid);
        this.fireCooldown2 = Math.max(0, this.fireCooldown2 - rapid);
      }
      if (this.raiseTicks > 0) this.raiseTicks--;
      // As the server: out of a sprint the weapon comes up before it fires (its sprint-exit time, on the raise timer).
      if (!this.mounted && sprinted && !this.state.sprint) this.raiseTicks = Math.max(this.raiseTicks, this.handling(this.held).sprintExit);
      this.sprintAfter.set(input.seq, !!this.state.sprint);
      this.sprintAfter.delete(input.seq - 600);
      this.advanceReload();
      if (rapidSteps(rapidLeft, RAPID_RELOAD) && this.reloadTicks > 0) this.advanceReload();
      [shot, shot2] = this.predictFire(applied);
      if ((shot || shot2) && this.paired) this.pairShots.push([input.seq, this.held, shot && !shot.alt ? 1 : 0, shot2 ? 1 : 0]);
    }
    this.predTick++;
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    return { input, shot, shot2, absorbed };
  }

  /**
   * One input as the host applies it to someone with a second gun `o` of the held weapon `code` (Match.applyInputs):
   * its fire mode sets the second gun away or out (`live`: with the host's side effects, a toggle beating a reload),
   * and with the pair out the aim button is dropped and the second trigger takes the sprint button with it.
   */
  private pairInput(input: PlayerInput, code: number, o: { away: boolean } | undefined, live: boolean): PlayerInput {
    if (!o || this.seatGun) return input;
    if (input.fireMode !== undefined && o.away !== (input.fireMode === 1)) {
      o.away = input.fireMode === 1;
      if (live) {
        this.cancelReload();
        this.semiLatch2 = false;
        if (!o.away) this.pairOut(code);
      }
    }
    if (o.away) return input;
    const buttons = input.buttons & ~BUTTON_ZOOM & (input.buttons & BUTTON_ALT ? ~BUTTON_SPRINT : ~0);
    return buttons === input.buttons ? input : { ...input, buttons };
  }

  /** The second gun comes out (Match.pairOut): its raise before its first round, and no sights. */
  private pairOut(code: number, since = 0): void {
    const def = weaponByCode(code);
    const pair = def && akimboOf(def);
    if (!def || !pair) return;
    this.fireCooldown2 = Math.max(this.fireCooldown2, akimboRaise(def, pair) - since);
    this.gun.ads = 0;
  }

  /** The second gun's ammunition as the reload code sees it: its magazine over the weapon's one reserve (`storeOff` writes back). */
  private offBox(o: { mag: number; unchambered: boolean }, ammo: [number, number, number, number]): AmmoBox {
    return { mag: o.mag, reserve: ammo[1], unchambered: o.unchambered };
  }

  private storeOff(o: { mag: number; unchambered: boolean }, ammo: [number, number, number, number], b: AmmoBox): void {
    o.mag = b.mag;
    ammo[1] = b.reserve;
    o.unchambered = !!b.unchambered;
  }

  /** The held weapon's ammunition as the reload code sees it (written back with `storeBox`). */
  private box(code: number, ammo: [number, number, number, number]): AmmoBox {
    return { mag: ammo[0], reserve: ammo[1], unchambered: this.unchambered.has(code), alt: ammo[2] };
  }

  private storeBox(code: number, ammo: [number, number, number, number], b: AmmoBox): void {
    ammo[0] = b.mag;
    ammo[1] = b.reserve;
    ammo[2] = b.alt ?? ammo[2];
    if (b.unchambered) this.unchambered.add(code);
    else this.unchambered.delete(code);
  }

  /** The server's reload, step for step: ammunition follows the stages. */
  private advanceReload(): void {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    const o = this.offs.get(this.held);
    const pair = this.pairOf();
    if (!this.reload2 || this.reloadTicks2 === 0 || !def || !ammo || !o || !pair) {
      this.reload2 = null;
      this.reloadTicks2 = 0;
    }
    if (this.reload && (this.reloadTicks === 0 || !def || !ammo)) this.reload = null;
    if (!this.reload) this.reloadTicks = 0;
    if (!def || !ammo || (!this.reload && !this.reload2)) return;
    // A pair's reloads take its `reload` times as long, one gun at a time (Match.advancePairReload).
    const loader = pair ? akimboLoader(def) : def;
    if (this.reload2 && o && pairReloadTurn(this.reload, this.reload2, ammo[0], o.mag) === 2) {
      const b = this.offBox(o, ammo);
      let run: ReloadRun | null = this.reload2;
      if (run.t === 0) run = beginReload(loader, b);
      if (run) run = stepReload(loader, b, run);
      this.storeOff(o, ammo, b);
      this.reload2 = run;
      this.reloadTicks2 = run ? Math.max(1, run.total - run.t) : 0;
      return;
    }
    const b = this.box(this.held, ammo);
    let run: ReloadRun | null = this.reload!;
    // (A pair's reload that waited for the other gun's starts from the ammunition as it is now.)
    if (pair && run.t === 0) run = beginReload(loader, b);
    if (run) run = stepReload(loader, b, run);
    this.reload = run;
    this.storeBox(this.held, ammo, b);
    this.reloadTicks = this.reload ? Math.max(1, this.reload.total - this.reload.t) : 0;
  }

  private startReload(): void {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    if (this.reloadTicks > 0 || !def || !ammo) return;
    const run = beginReload(this.pairOf() ? akimboLoader(def) : def, this.box(this.held, ammo));
    if (!run) return;
    this.reload = run;
    this.reloadTicks = run.total;
    this.burstLeft = 0;
  }

  /** The second gun's reload (Match.startReloadOff). */
  private startReloadOff(): void {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    const o = this.offs.get(this.held);
    if (this.reloadTicks2 > 0 || !def || !ammo || !o || !this.pairOf()) return;
    const run = beginReload(akimboLoader(def), this.offBox(o, ammo));
    if (!run) return;
    this.reload2 = run;
    this.reloadTicks2 = run.total;
  }

  /** `which`: 1 the gun's, 2 the second gun's of a pair, 0 both (Match.cancelReload). */
  private cancelReload(which: 0 | 1 | 2 = 0): void {
    if (which !== 2) {
      this.reload = null;
      this.reloadTicks = 0;
    }
    if (which !== 1) {
      this.reload2 = null;
      this.reloadTicks2 = 0;
    }
  }

  /** A weapon's handling (spec §27): its running speed and sprint-exit time; full speed with nothing in hand. */
  private handling(code: number, pair: AkimboSpec | null = this.pairOf(code)): { move: number; sprintExit: number } {
    const def = weaponByCode(code);
    if (!def) return { move: 1, sprintExit: 0 };
    const h = gunplayOf(def).handling;
    return pair && pair.move !== 0 ? { move: akimboMove(h.move, pair), sprintExit: h.sprintExit } : h;
  }

  /** Same order as the server: move with the current boost, then count the boost down. `held`: the weapon in hand for it. */
  private move(state: MoveState, input: PlayerInput, tick: number, live = false, held = this.held, pair: AkimboSpec | null = this.pairOf(held)): MoveState {
    if (this.platforms) {
      // The server moves platforms, then riders, then everyone's own movement (Match.step).
      this.platforms.poseAt(tick);
      const ridden = this.platforms.carry(state.pos, tick);
      if (ridden) state = { ...state, pos: ridden };
    }
    const jet = this.jetFuel !== null && this.jetFuel >= JET.burn;
    const before = state;
    // Overdrive's speed, Moon Boots' gravity and jump (as the server's movement environment).
    const pm = powerMove(this.power);
    let next = applyPads(this.pads, stepMovement(this.physics, this.collider, state, input, (this.speedTicks > 0 ? SPEED_BOOST : 1) * pm.speed * this.bodySpeed * this.statusSpeed, TICK_DT, this.traction(state.pos), { liquids: this.liquids, jet, ladders: this.ladders, scale: this.scale, jump: this.jump * pm.jump, stamina: this.stamina, gravity: this.gravity * pm.gravity, weaponMove: this.handling(held, pair).move, ...(this.gravityZones.length ? { gravityZones: this.gravityZones } : {}), ...(this.airJumps ? { airJumps: this.airJumps } : {}), ...(this.jetFuel !== null ? { jetpack: true } : {}), ...(this.glider ? { glider: true } : {}), ...(this.ziplines.length ? { ziplines: this.ziplines, team: this.team() } : {}) }));
    // Portals, exactly as the server takes them (Match.step).
    const through = this.portals.length && next.zip === undefined ? applyPortals(this.portals, before, next, this.portalOn, this.scale, bodyHeightOf(next, this.scale)) : null;
    if (through) {
      next = through.state;
      if (live) this.portalTurn += through.turn;
    }
    if (this.jetFuel !== null) this.jetFuel = stepJetFuel(this.jetFuel, !!next.jet);
    if (this.speedTicks > 0) this.speedTicks--;
    tickPowers(this.power);
    return next;
  }

  private traction(pos: Vec3): number {
    for (const z of this.zones) {
      if (ZONE_KINDS[z[0]] === 'oil' && zoneContains('oil', { x: z[1], y: z[2], z: z[3] }, z[4], pos)) return OIL_TRACTION;
    }
    return 1;
  }

  /**
   * Mirrors the server's trigger rules (semi-auto, burst, spin-up, heat,
   * reload interrupts, recoil and spray) so tracers, the HUD and the camera
   * match what will happen. Same order as Match.applyInputs.
   */
  private predictFire(input: PlayerInput): [PredictedShot | null, PredictedShot | null] {
    const def = this.seatGun ?? this.weapon;
    const ammo = this.seatGun ? this.seatAmmo : this.inventory.get(this.held);
    const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
    const pressed = input.buttons & ~this.prevButtons;
    this.prevButtons = input.buttons;
    if (!fireDown) this.semiLatch = false;
    if (!(input.buttons & BUTTON_ALT)) this.semiLatch2 = false;
    if (!def || !ammo) return [null, null];
    const paired = this.seatGun ? null : this.pairOf();
    const off = paired ? this.offs.get(this.held) : undefined;
    if ((this.reload || this.reload2) && ((pressed & BUTTON_SPRINT && input.forward > 0) || pressed & BUTTON_USE)) this.cancelReload();
    if (input.buttons & BUTTON_RELOAD) {
      this.startReload();
      if (paired) this.startReloadOff();
    }
    const gp = gunplayOf(def);
    // As the host: the input's fire mode for the gun in hand (absent: the one it has).
    if (!this.seatGun && input.fireMode !== undefined && def.fireModes) this.appliedModes.set(this.held, clampFireMode(def, input.fireMode));
    const firing = firingOf(def, this.seatGun ? 0 : this.appliedModes.get(this.held));
    // Bottomless Mag (as the server): the gun in hand stays full, so nothing reloads.
    const bottomless = this.power.bottomless > 0 && !this.seatGun;
    if (bottomless) {
      this.fillHeld(def, ammo, off);
      if (this.reload || this.reload2) this.cancelReload();
    }
    stepAds(this.gun, gp.accuracy, !!(input.buttons & BUTTON_ZOOM) && !this.seatGun && !paired);
    const ready = (a: [number, number, number, number]) => (this.seatGun ? a[0] : roundsReady(this.box(this.held, a)));
    // As the server: a swing always interrupts a melee weapon's barrel reload; its barrel fires once a load is in.
    if (this.reload && !this.seatGun && this.fireCooldown === 0 && this.raiseTicks === 0) {
      const swing = def.kind === 'melee' && ((fireDown && !this.semiLatch) || (pressed & BUTTON_MELEE) !== 0);
      const shoot = (fireDown && !this.semiLatch && ready(ammo) > 0) || (input.buttons & BUTTON_ALT && !fireDown && def.alt?.reload && ammo[2] >= def.alt.cost);
      if (swing || shoot) this.cancelReload(paired ? 1 : 0);
    }
    const first = this.trigger(def, ammo, input, fireDown, ready, firing, paired);
    const shot = first.shot;
    let fired = first.fired;
    // As the server: the second gun of a pair on the second trigger, with its own latch, cooldown, magazine and reload.
    let shot2: PredictedShot | null = null;
    if (paired && off) {
      const rounds = off.unchambered ? 0 : off.mag;
      const up = this.fireCooldown2 === 0 && this.raiseTicks === 0 && (input.buttons & BUTTON_ALT) !== 0 && !this.semiLatch2;
      if (this.reload2 && up && rounds > 0) this.cancelReload(2);
      if (up && this.reloadTicks2 === 0 && this.statusSpeed !== 0 && !this.unarmed && this.state.zip === undefined) {
        if (rounds === 0) this.startReloadOff();
        else {
          off.mag--;
          this.fireCooldown2 = firing.interval;
          this.semiLatch2 = firing.mode !== 'auto';
          shot2 = this.primaryShot(def, input, [off.mag, ammo[1], 0, 0], firing, paired);
          shot2.off = true;
          fired = true;
        }
      }
    }
    if (!this.seatGun && this.statusSpeed !== 0 && !fired) {
      // As the server: a quick-melee press with a gun in hand breaks a reload (spec §16), struck or not.
      if (pressed & BUTTON_MELEE && !this.mounted && def.kind !== 'melee' && (this.reload || this.reload2)) this.cancelReload();
      // Auto-reload (the option): an empty magazine starts reloading by itself once the gun is ready.
      const armed = !this.unarmed && !(this.state.zip !== undefined && !oneHanded(def));
      const timers = { reloadTicks: this.reloadTicks, fireCooldown: this.fireCooldown, raiseTicks: this.raiseTicks, burstLeft: this.burstLeft };
      if (armed && input.buttons & BUTTON_AUTO_RELOAD && autoReloadDue(def, this.box(this.held, ammo), timers, ((input.buttons & BUTTON_SPRINT) !== 0 && input.forward > 0) || (input.buttons & BUTTON_MELEE) !== 0)) this.startReload();
      if (armed && paired && off && input.buttons & BUTTON_AUTO_RELOAD && autoReloadDue(def, this.offBox(off, ammo), { reloadTicks: this.reloadTicks2, fireCooldown: this.fireCooldown2, raiseTicks: this.raiseTicks, burstLeft: 0 }, ((input.buttons & BUTTON_SPRINT) !== 0 && input.forward > 0) || (input.buttons & BUTTON_MELEE) !== 0)) this.startReloadOff();
    }
    if (!fired) recoilIdle(this.gun, firing.kick, gp.accuracy, firing.interval);
    if (bottomless) this.fillHeld(def, ammo, off);
    return [shot, shot2];
  }

  /** Bottomless Mag: the held gun's magazine (and a second gun's) full, a round chambered (sim/powerups.ts fillMagazine). */
  private fillHeld(def: WeaponDefinition, ammo: [number, number, number, number], off: { mag: number; unchambered: boolean } | undefined): void {
    const w = { def, mag: ammo[0], unchambered: this.unchambered.has(this.held) || undefined, off: off ? { mag: off.mag, unchambered: off.unchambered || undefined } : undefined };
    if (!fillMagazine(w)) return;
    ammo[0] = w.mag;
    this.unchambered.delete(this.held);
    if (off && w.off) {
      off.mag = w.off.mag;
      off.unchambered = false;
    }
  }

  /** The trigger itself. `fired`: a primary round (or swing) went off, as the server counts it. */
  private trigger(def: WeaponDefinition, ammo: [number, number, number, number], input: PlayerInput, fireDown: boolean, ready: (a: [number, number, number, number]) => number, firing: Firing = firingOf(def), paired: AkimboSpec | null = null): { shot: PredictedShot | null; fired: boolean } {
    const none = { shot: null, fired: false };
    if (def.windupTicks) {
      const able = fireDown && this.raiseTicks === 0 && this.reloadTicks === 0 && ammo[3] < 100 && (def.magazine === 0 || ready(ammo) > 0);
      this.windup = able ? Math.min(def.windupTicks, this.windup + 1) : Math.max(0, this.windup - 2);
    }
    // On a zipline (as the server): one hand on the trolley, so sidearms and blades only.
    if (this.unarmed || (this.state.zip !== undefined && !this.seatGun && !oneHanded(def))) return none;
    if (this.burstLeft > 0) {
      if (--this.burstTimer > 0) return none;
      if (ready(ammo) === 0 || this.reloadTicks > 0 || this.statusSpeed === 0) {
        this.burstLeft = 0;
        return none;
      }
      ammo[0]--;
      this.burstLeft--;
      this.burstTimer = this.burstEvery || (def.burst?.intervalTicks ?? 1);
      return { shot: this.primaryShot(def, input, ammo, firing), fired: true };
    }
    if (this.fireCooldown > 0 || (this.raiseTicks > 0 && !this.seatGun) || this.reloadTicks > 0 || this.statusSpeed === 0) return none;
    if (fireDown) {
      if (this.semiLatch || (def.windupTicks && this.windup < def.windupTicks)) return none;
      if (def.magazine > 0 && ready(ammo) === 0) {
        // As the server: a thrown spear leaves nothing to poke with (and nothing to reload).
        if (inHand(def)) this.semiLatch = true;
        else if (!this.seatGun) this.startReload();
        return none;
      }
      // A seat gun out of shells (as the server's spendRound) doesn't fire.
      if (this.seatGun && this.seatShells !== null) {
        if (this.seatShells <= 0 || (def.heat && ammo[3] >= 100)) return none;
        this.seatShells--;
      }
      if (def.heat) {
        if (ammo[3] >= 100) return none;
        ammo[3] = Math.min(100, ammo[3] + def.heat.perShot * 100);
      }
      // A spear's poke keeps the spear (inHand); a gun spends a round.
      if (def.magazine > 0 && !inHand(def)) ammo[0]--;
      this.fireCooldown = firing.interval;
      this.semiLatch = firing.mode !== 'auto';
      if (firing.burst) {
        this.burstLeft = firing.burst.count - 1;
        this.burstTimer = this.burstEvery = firing.burst.intervalTicks;
      }
      if (def.windupResets) this.windup = 0;
      return { shot: this.primaryShot(def, input, ammo, firing, paired), fired: true };
    }
    if (input.buttons & BUTTON_ALT && def.alt) {
      // Mirrors the server: own-ammo triggers spend their own rounds, shared ones the magazine.
      const a = def.alt;
      if (a.ammo === 'own' ? ammo[2] < a.cost : ammo[0] < a.cost) {
        if ((a.ammo === 'shared' || a.reload) && !this.seatGun) this.startReload();
        return none;
      }
      if (a.ammo === 'own') ammo[2] -= a.cost;
      else ammo[0] -= a.cost;
      this.fireCooldown = a.fireIntervalTicks;
      // Its own kick after the aim it fired along (Match.fireNow).
      const aim = this.shotAim(input);
      if (a.kick) recoilShot(this.gun, a.kick);
      if (a.kind !== 'hitscan') return { shot: { def, ends: [], alt: true }, fired: false };
      return { shot: this.hitscanShot(def, aim, a.pellets ?? def.pellets, a.spread ?? def.spread, true, a.range), fired: false };
    }
    return none;
  }

  /** A primary round: spread from the gunplay model, then the recoil kick (as the server does in Match.fire). */
  private primaryShot(def: WeaponDefinition, input: PlayerInput, ammo: [number, number, number, number], firing?: Firing, paired: AkimboSpec | null = null): PredictedShot {
    const gp = gunplayOf(def);
    const aim = this.shotAim(input);
    const run = this.prevPos ? Math.hypot(this.state.pos.x - this.prevPos.x, this.state.pos.z - this.prevPos.z) / TICK_DT / PLAYER.runSpeed : 0;
    const ctx = { run, airborne: !this.state.grounded, stance: STANCE_SPREAD[this.state.stance ?? 0] ?? 1 };
    // One of a pair (Match.fireNow): a wider aim cone and pellet pattern, a harder kick.
    const spread = !gp.accuracy
      ? def.spread * (paired ? (def.pellets > 1 ? paired.pattern : paired.cone) : 1)
      : paired
        ? akimboCone(paired, spreadOf(gp.accuracy, this.gun, ctx), def.pellets > 1 ? def.spread : 0)
        : shotCone(def, gp.accuracy, this.gun, ctx);
    if (paired) recoilShot(this.gun, akimboKick(gp.kick, paired.kick));
    else if (def.kind !== 'melee') recoilShot(this.gun, firing && firing.index > 0 ? firing.kick : gp.kick);
    if (def.kind !== 'hitscan') return { def, ends: [] };
    const shot = this.hitscanShot(def, aim, def.pellets, spread, false);
    if (gp.ballistic) shot.tracer = isTracer(gp.ballistic, this.rounds, ammo[0]);
    this.rounds++;
    return shot;
  }

  private hitscanShot(def: WeaponDefinition, aim: { yaw: number; pitch: number }, pellets: number, spread: number, alt: boolean, reach = def.range): PredictedShot {
    const eye = this.eye;
    const ends: Vec3[] = [];
    const times: number[] = [];
    const bal = alt ? null : gunplayOf(def).ballistic;
    const phys = bal ? bulletPhysics(bal, this.rules) : null;
    for (let i = 0; i < pellets; i++) {
      // Cosmetic spread; the server rolls its own.
      const yaw = aim.yaw + (Math.random() - 0.5) * 2 * spread;
      const pitch = aim.pitch + (Math.random() - 0.5) * 2 * spread;
      const dir = viewDirection(yaw, pitch);
      if (phys) {
        // A bullet: it flies (and drops) until it meets the level.
        // Shot rays: bulletproof glass stops them where sight goes on.
        const t = traceBullet(eye, dir, phys, def.range, (o, d, len) => this.physics.raycastHit(o, d, len)?.dist ?? null);
        ends.push(t.end);
        times.push(t.time);
        continue;
      }
      const d = this.physics.raycastHit(eye, dir, reach)?.dist ?? reach;
      ends.push({ x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d });
    }
    return { def, ends, ...(alt ? { alt } : {}), ...(phys ? { speed: phys.speed, times } : {}) };
  }

  /** Server reconciliation. */
  reconcile(server: PlayerSnapshot, ack: number, me?: PrivateState, serverTick?: number): void {
    const wasAlive = this.alive;
    this.alive = server.alive === 1;
    this.health = server.hp;
    this.armor = server.ar;
    this.pending = this.pending.filter((i) => i.seq > ack);
    if (this.vehicle && me?.vp && me.vp[0] === this.vehicle.mount) this.vehicle.reconcile(me.vp, this.pending);
    if (me) {
      this.inventory = new Map(me.inv.map(([code, mag, reserve, alt, heat]) => [code, [mag, reserve, alt ?? 0, heat ?? 0]]));
      this.statusSpeed = (me.ms ?? 1000) / 1000;
      [this.bodySpeed, this.jump, this.stamina] = (me.bs ?? [1000, 1000, 1000]).map((v) => v / 1000) as [number, number, number];
      this.mounted = !!me.mo;
      this.seatAmmo = [0, 0, 0, me.mo?.[2] ?? 0];
      this.seatShells = me.mo?.[3] ?? null;
      this.throwable = me.gr ? { kind: THROWABLES[me.gr[0]] ?? 'frag', count: me.gr[1] } : null;
      this.speedTicks = me.sp;
      this.damageTicks = me.dm;
      this.power = powersFromWire(me.px);
      this.jetFuel = me.jp ?? null;
      this.airJumps = me.cl ? (CLASS_DEFS[CLASS_IDS[me.cl[0]] ?? 'rocketeer'].airJumps ?? 0) : 0;
      this.glider = me.gl === 1;
      this.reloadTicks = Math.max(0, me.rl - this.pending.length);
      this.raiseTicks = Math.max(0, me.rs - this.pending.length);
      this.unchambered = new Set(me.uc ?? []);
      // The reload as the server has it, moved on by the inputs it hasn't seen yet (their stages land on the next tick).
      this.reload = me.rd && this.reloadTicks > 0 ? { kind: RELOAD_KINDS[me.rd[0]] ?? 'tactical', t: me.rd[1] + this.pending.length, total: me.rd[2], stage: me.rd[3] } : null;
      this.reconcilePair(me, server.w, ack);
    }
    // A fresh life: no recoil left over.
    if (!wasAlive && this.alive) {
      this.gun = newGunState();
      this.rounds = 0;
      this.fireCooldown2 = 0;
      this.semiLatch2 = false;
    }
    // Keep a pending weapon switch the server hasn't seen yet.
    const pendingSwitch = [...this.pending].reverse().find((i) => i.weapon && this.inventory.has(i.weapon))?.weapon;
    this.held = pendingSwitch ?? server.w;

    const before = this.state.pos;
    const sta = me?.sta;
    this.state = {
      pos: { x: server.p[0], y: server.p[1], z: server.p[2] },
      velY: server.vy,
      grounded: server.g === 1,
      ...(server.vx || server.vz ? { vx: server.vx ?? 0, vz: server.vz ?? 0 } : {}),
      ...(server.sn ? { stance: server.sn } : {}),
      ...(server.ch ? { chute: server.ch } : {}),
      ...(server.dr ? { drop: true } : {}),
      ...(server.zl ? { zip: server.zl[0], zs: server.zl[1], zv: server.zl[2] } : {}),
      // The sprint (a slide starts from one), a slide under way, the stamina moves' cooldown and the lean (sim/moves.ts).
      ...(server.sr ? { sprint: true } : {}),
      ...(me?.mv?.[0] ? { slide: me.mv[0] } : {}),
      ...(me?.mv?.[1] ? { moveCd: me.mv[1] } : {}),
      ...(server.ln ? { lean: server.ln } : {}),
      ...(sta ? { ...(sta[0] < 1000 ? { stamina: sta[0] / 1000 } : {}), ...(sta[1] ? { rest: sta[1] } : {}), ...(sta[2] ? { winded: true } : {}) } : {}),
      // Double jumps already used and whether jump was held, so a replay doesn't jump again.
      ...(me?.cl && me.cl[4] & 3 ? { airJumps: me.cl[4] & 3 } : {}),
      ...(me?.cl && me.cl[4] & 4 ? { jumpHeld: true } : {}),
    };
    let t = serverTick ?? this.predTick - this.pending.length;
    if (this.alive && !this.mounted) {
      // Replayed as the server will apply them: each input's weapon switch first (its raise), then the move with
      // the weapon then in hand, then the raise timer, then a sprint's exit time (Match.applyInputs).
      let held = server.w;
      let raise = me ? me.rs : this.raiseTicks;
      let sprinted = this.sprintAfter.get(ack) ?? false;
      for (const input of this.pending) {
        if (input.weapon && input.weapon !== held && this.inventory.has(input.weapon)) {
          held = input.weapon;
          const def = weaponByCode(held);
          const pair = this.serverPair(held);
          raise = def && pair ? akimboRaise(def, pair) : (def?.raiseTicks ?? 0);
        }
        // (A pair, as the host takes each input: put away or out by its fire mode, no aim, no sprint on the second trigger.)
        const o = this.replayOffs.get(held);
        const applied = o ? this.pairInput(input, held, o, false) : input;
        this.state = this.move(this.state, applied, ++t, false, held, this.serverPair(held));
        if (raise > 0) raise--;
        if (sprinted && !this.state.sprint) raise = Math.max(raise, this.handling(held).sprintExit);
        sprinted = !!this.state.sprint;
        this.sprintAfter.set(input.seq, sprinted);
      }
      if (me) this.raiseTicks = raise;
    } else t += this.pending.length;
    for (const seq of this.sprintAfter.keys()) if (seq < ack) this.sprintAfter.delete(seq);
    this.predTick = t;
    const err = distance(before, this.state.pos);
    if (wasAlive && this.alive && err > 0.01) {
      this.corrections++;
      this.lastCorrection = err;
    }
  }

  /** Second guns as the host has them at the acknowledged input (put away or out), stepped through the pending inputs in a replay. */
  private replayOffs = new Map<number, { away: boolean }>();

  private serverPair(code: number): AkimboSpec | null {
    const o = this.replayOffs.get(code);
    const def = o && !o.away ? weaponByCode(code) : undefined;
    return def ? akimboOf(def) : null;
  }

  /**
   * The second guns and the second gun's reload from the host (PrivateState.ow, rl2, rd2). Magazines are the host's,
   * as the inventory's are; a second gun put away or brought out by inputs the host hasn't seen stays as predicted.
   */
  private reconcilePair(me: PrivateState, serverHeld: number, ack: number): void {
    const before = this.offs;
    if (this.pairShots.length) this.pairShots = this.pairShots.filter((p) => p[0] > ack);
    this.offs = new Map();
    this.replayOffs = new Map();
    for (const [code, mag, flags] of me.ow ?? []) {
      const away = ((flags ?? 0) & 2) !== 0;
      this.replayOffs.set(code, { away });
      // The host's, then every pending input's fire mode for the weapon it was held with (the held one's is enough).
      let now = away;
      let held = serverHeld;
      for (const i of this.pending) {
        if (i.weapon && i.weapon !== held && this.inventory.has(i.weapon)) held = i.weapon;
        if (held === code && i.fireMode !== undefined) now = i.fireMode === 1;
      }
      this.offs.set(code, { mag, unchambered: ((flags ?? 0) & 1) !== 0, away: now });
      // A pair just made with the gun in hand: its second gun is coming up (Match.makePair).
      if (!before.has(code) && code === this.held && !now) this.pairOut(code, this.pending.length);
    }
    if (!this.offs.size) {
      this.pairShots.length = 0;
      this.reload2 = null;
      this.reloadTicks2 = 0;
      return;
    }
    // Rounds fired since the acknowledged input come off the host's magazines (not off a gun the host is reloading:
    // its magazine is changing hands there).
    for (const [, code, first, second] of this.pairShots) {
      const ammo = this.inventory.get(code);
      const o = this.offs.get(code);
      if (!ammo || !o || code !== serverHeld) continue;
      if (first && me.rl === 0) ammo[0] = Math.max(0, ammo[0] - first);
      if (second && !me.rl2) o.mag = Math.max(0, o.mag - second);
    }
    // The reloads as the host has them; the inputs it hasn't seen move on the one whose turn it is (pairReloadTurn).
    const rd2 = me.rd2 && (me.rl2 ?? 0) > 0 ? me.rd2 : null;
    const second: ReloadRun | null = rd2 ? { kind: RELOAD_KINDS[rd2[0]] ?? 'tactical', t: rd2[1], total: rd2[2], stage: rd2[3] } : null;
    if (!second) {
      this.reload2 = null;
      this.reloadTicks2 = 0;
      return;
    }
    const first: ReloadRun | null = me.rd && me.rl > 0 ? { kind: RELOAD_KINDS[me.rd[0]] ?? 'tactical', t: me.rd[1], total: me.rd[2], stage: me.rd[3] } : null;
    const main = this.inventory.get(serverHeld)?.[0] ?? 0;
    const turn = pairReloadTurn(first, second, main, this.offs.get(serverHeld)?.mag ?? 0);
    const n = this.pending.length;
    if (turn === 2) {
      second.t += n;
      this.reloadTicks2 = Math.max(0, me.rl2! - n);
      this.reload2 = this.reloadTicks2 > 0 ? second : null;
      // The first gun's waits where it is.
      this.reload = first;
      this.reloadTicks = first ? me.rl : 0;
    } else {
      this.reload2 = second;
      this.reloadTicks2 = me.rl2!;
    }
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
