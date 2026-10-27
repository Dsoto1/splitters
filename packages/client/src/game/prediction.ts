import {
  CLASS_DEFS,
  CLASS_IDS,
  BUTTON_ALT,
  BUTTON_FIRE,
  BUTTON_RELOAD,
  BUTTON_SPRINT,
  BUTTON_USE,
  BUTTON_ZOOM,
  RELOAD_KINDS,
  angleDelta,
  beginReload,
  bulletPhysics,
  counterFrom,
  counterRecoil,
  gunplayOf,
  isTracer,
  newGunState,
  recoilIdle,
  recoilShot,
  roundsReady,
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
  PhysicsWorld,
  SPEED_BOOST,
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
} from '@tiletrigger/shared';

const MAX_PENDING = 120;
const ORDER = new Map(WEAPONS_BY_SLOT.map((w) => [w.id, weaponCode(w)]));

export interface PredictedShot {
  def: WeaponDefinition;
  /** Predicted tracer end points (one per pellet; empty for melee/projectiles). */
  ends: Vec3[];
  /** The second trigger. */
  alt?: boolean;
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
  /** Your body size (BODY_SIZES scale), the same the server uses. */
  scale = 1;
  /** Jetpack fuel units (see JET), or null without a jetpack. */
  jetFuel: number | null = null;
  /** Carrying a glider (canopies open as gliders, as on the server). */
  glider = false;
  /** Seated in a turret or vehicle: the server moves you, so movement isn't predicted. */
  mounted = false;
  /** The seat's gun (set by the session while seated), its heat, and whether the seat can't shoot at all (driving). */
  seatGun: WeaponDefinition | null = null;
  private seatAmmo: [number, number, number, number] = [0, 0, 0, 0];
  unarmed = false;
  /** Movement multiplier from status effects (server value). */
  statusSpeed = 1;
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
  /** Carried grenades or mines. */
  throwable: { kind: (typeof THROWABLES)[number]; count: number } | null = null;
  reloadTicks = 0;
  raiseTicks = 0;
  speedTicks = 0;
  damageTicks = 0;
  private readonly collider;
  private pending: PlayerInput[] = [];
  private seq = 0;
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

  /** Where your eyes are (they drop when you crouch or go prone). */
  get eye(): Vec3 {
    return { x: this.state.pos.x, y: this.state.pos.y + eyeHeightOf(this.state, this.scale), z: this.state.pos.z };
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
   * Predict one tick. Returns the input to send, any predicted shot, and the
   * part of this tick's mouse movement that went into countering recoil
   * (`absorbed`, pitch and yaw): the caller adds it back to its view angles,
   * because that movement brought the recoil down instead of turning the view.
   */
  tick(sample: { forward: number; right: number; buttons: number; say?: number }, yaw: number, pitch: number, weapon: number, viewTick: number): { input: PlayerInput; shot: PredictedShot | null; absorbed: [number, number] | null } {
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
    this.prevPos = { ...this.state.pos };
    let shot: PredictedShot | null = null;
    if (this.alive) {
      if (weapon && weapon !== this.held && this.inventory.has(weapon)) {
        this.held = weapon;
        this.raiseTicks = this.weapon?.raiseTicks ?? 0;
        this.reloadTicks = 0;
        this.reload = null;
        this.windup = 0;
        this.burstLeft = 0;
        this.gun.shots = 0;
        this.gun.spray = 0;
        this.gun.ads = 0;
        this.rounds = 0;
      }
      if (!this.mounted) this.state = this.move(this.state, input, this.predTick + 1, true);
      if (this.fireCooldown > 0) this.fireCooldown--;
      if (this.raiseTicks > 0) this.raiseTicks--;
      this.advanceReload();
      shot = this.predictFire(input);
    }
    this.predTick++;
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    return { input, shot, absorbed };
  }

  /** The held weapon's ammunition as the reload code sees it (written back with `storeBox`). */
  private box(code: number, ammo: [number, number, number, number]): AmmoBox {
    return { mag: ammo[0], reserve: ammo[1], unchambered: this.unchambered.has(code) };
  }

  private storeBox(code: number, ammo: [number, number, number, number], b: AmmoBox): void {
    ammo[0] = b.mag;
    ammo[1] = b.reserve;
    if (b.unchambered) this.unchambered.add(code);
    else this.unchambered.delete(code);
  }

  /** The server's reload, step for step: ammunition follows the stages. */
  private advanceReload(): void {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    if (!this.reload || this.reloadTicks === 0 || !def || !ammo) {
      this.reload = null;
      this.reloadTicks = 0;
      return;
    }
    const b = this.box(this.held, ammo);
    this.reload = stepReload(def, b, this.reload);
    this.storeBox(this.held, ammo, b);
    this.reloadTicks = this.reload ? Math.max(1, this.reload.total - this.reload.t) : 0;
  }

  private startReload(): void {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    if (this.reloadTicks > 0 || !def || !ammo) return;
    const run = beginReload(def, this.box(this.held, ammo));
    if (!run) return;
    this.reload = run;
    this.reloadTicks = run.total;
    this.burstLeft = 0;
  }

  private cancelReload(): void {
    this.reload = null;
    this.reloadTicks = 0;
  }

  /** Same order as the server: move with the current boost, then count the boost down. */
  private move(state: MoveState, input: PlayerInput, tick: number, live = false): MoveState {
    if (this.platforms) {
      // The server moves platforms, then riders, then everyone's own movement (Match.step).
      this.platforms.poseAt(tick);
      const ridden = this.platforms.carry(state.pos, tick);
      if (ridden) state = { ...state, pos: ridden };
    }
    const jet = this.jetFuel !== null && this.jetFuel >= JET.burn;
    const before = state;
    let next = applyPads(this.pads, stepMovement(this.physics, this.collider, state, input, (this.speedTicks > 0 ? SPEED_BOOST : 1) * this.statusSpeed, TICK_DT, this.traction(state.pos), { liquids: this.liquids, jet, ladders: this.ladders, scale: this.scale, gravity: this.gravity, ...(this.gravityZones.length ? { gravityZones: this.gravityZones } : {}), ...(this.airJumps ? { airJumps: this.airJumps } : {}), ...(this.jetFuel !== null ? { jetpack: true } : {}), ...(this.glider ? { glider: true } : {}) }));
    // Portals, exactly as the server takes them (Match.step).
    const through = this.portals.length ? applyPortals(this.portals, before, next, this.portalOn, this.scale, bodyHeightOf(next, this.scale)) : null;
    if (through) {
      next = through.state;
      if (live) this.portalTurn += through.turn;
    }
    if (this.jetFuel !== null) this.jetFuel = stepJetFuel(this.jetFuel, !!next.jet);
    if (this.speedTicks > 0) this.speedTicks--;
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
  private predictFire(input: PlayerInput): PredictedShot | null {
    const def = this.seatGun ?? this.weapon;
    const ammo = this.seatGun ? this.seatAmmo : this.inventory.get(this.held);
    const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
    const pressed = input.buttons & ~this.prevButtons;
    this.prevButtons = input.buttons;
    if (!fireDown) this.semiLatch = false;
    if (!def || !ammo) return null;
    if (this.reload && ((pressed & BUTTON_SPRINT && input.forward > 0) || pressed & BUTTON_USE)) this.cancelReload();
    if (input.buttons & BUTTON_RELOAD) this.startReload();
    const gp = gunplayOf(def);
    stepAds(this.gun, gp.accuracy, !!(input.buttons & BUTTON_ZOOM) && !this.seatGun);
    const ready = (a: [number, number, number, number]) => (this.seatGun ? a[0] : roundsReady(this.box(this.held, a)));
    if (fireDown && this.reload && !this.seatGun && !this.semiLatch && this.fireCooldown === 0 && this.raiseTicks === 0 && ready(ammo) > 0) this.cancelReload();
    const { shot, fired } = this.trigger(def, ammo, input, fireDown, ready);
    if (!fired) recoilIdle(this.gun, gp.kick, gp.accuracy, def.fireIntervalTicks);
    return shot;
  }

  /** The trigger itself. `fired`: a primary round (or swing) went off, as the server counts it. */
  private trigger(def: WeaponDefinition, ammo: [number, number, number, number], input: PlayerInput, fireDown: boolean, ready: (a: [number, number, number, number]) => number): { shot: PredictedShot | null; fired: boolean } {
    const none = { shot: null, fired: false };
    if (def.windupTicks) {
      const able = fireDown && this.raiseTicks === 0 && this.reloadTicks === 0 && ammo[3] < 100 && (def.magazine === 0 || ready(ammo) > 0);
      this.windup = able ? Math.min(def.windupTicks, this.windup + 1) : Math.max(0, this.windup - 2);
    }
    if (this.unarmed) return none;
    if (this.burstLeft > 0) {
      if (--this.burstTimer > 0) return none;
      if (ready(ammo) === 0 || this.reloadTicks > 0 || this.statusSpeed === 0) {
        this.burstLeft = 0;
        return none;
      }
      ammo[0]--;
      this.burstLeft--;
      this.burstTimer = def.burst?.intervalTicks ?? 1;
      return { shot: this.primaryShot(def, input, ammo), fired: true };
    }
    if (this.fireCooldown > 0 || (this.raiseTicks > 0 && !this.seatGun) || this.reloadTicks > 0 || this.statusSpeed === 0) return none;
    if (fireDown) {
      if (this.semiLatch || (def.windupTicks && this.windup < def.windupTicks)) return none;
      if (def.magazine > 0 && ready(ammo) === 0) {
        if (!this.seatGun) this.startReload();
        return none;
      }
      if (def.heat) {
        if (ammo[3] >= 100) return none;
        ammo[3] = Math.min(100, ammo[3] + def.heat.perShot * 100);
      }
      if (def.magazine > 0) ammo[0]--;
      this.fireCooldown = def.fireIntervalTicks;
      this.semiLatch = (def.fireMode ?? 'auto') !== 'auto';
      if (def.fireMode === 'burst' && def.burst) {
        this.burstLeft = def.burst.count - 1;
        this.burstTimer = def.burst.intervalTicks;
      }
      if (def.windupResets) this.windup = 0;
      return { shot: this.primaryShot(def, input, ammo), fired: true };
    }
    if (input.buttons & BUTTON_ALT && def.alt) {
      // Mirrors the server: own-ammo triggers spend their own rounds, shared ones the magazine.
      const a = def.alt;
      if (a.ammo === 'own' ? ammo[2] < a.cost : ammo[0] < a.cost) {
        if (a.ammo === 'shared' && !this.seatGun) this.startReload();
        return none;
      }
      if (a.ammo === 'own') ammo[2] -= a.cost;
      else ammo[0] -= a.cost;
      this.fireCooldown = a.fireIntervalTicks;
      if (a.kind !== 'hitscan') return { shot: { def, ends: [], alt: true }, fired: false };
      return { shot: this.hitscanShot(def, this.aimAngles(input.yaw, input.pitch), a.pellets ?? def.pellets, a.spread ?? def.spread, true), fired: false };
    }
    return none;
  }

  /** A primary round: spread from the gunplay model, then the recoil kick (as the server does in Match.fire). */
  private primaryShot(def: WeaponDefinition, input: PlayerInput, ammo: [number, number, number, number]): PredictedShot {
    const gp = gunplayOf(def);
    const aim = this.aimAngles(input.yaw, input.pitch);
    const run = this.prevPos ? Math.hypot(this.state.pos.x - this.prevPos.x, this.state.pos.z - this.prevPos.z) / TICK_DT / PLAYER.runSpeed : 0;
    const spread = gp.accuracy ? shotCone(def, gp.accuracy, this.gun, { run, airborne: !this.state.grounded, stance: STANCE_SPREAD[this.state.stance ?? 0] ?? 1 }) : def.spread;
    if (def.kind !== 'melee') recoilShot(this.gun, gp.kick);
    if (def.kind !== 'hitscan') return { def, ends: [] };
    const shot = this.hitscanShot(def, aim, def.pellets, spread, false);
    if (gp.ballistic) shot.tracer = isTracer(gp.ballistic, this.rounds, ammo[0]);
    this.rounds++;
    return shot;
  }

  private hitscanShot(def: WeaponDefinition, aim: { yaw: number; pitch: number }, pellets: number, spread: number, alt: boolean): PredictedShot {
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
      const d = this.physics.raycastHit(eye, dir, def.range)?.dist ?? def.range;
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
    if (me) {
      this.inventory = new Map(me.inv.map(([code, mag, reserve, alt, heat]) => [code, [mag, reserve, alt ?? 0, heat ?? 0]]));
      this.statusSpeed = (me.ms ?? 1000) / 1000;
      this.mounted = !!me.mo;
      this.seatAmmo = [0, 0, 0, me.mo?.[2] ?? 0];
      this.throwable = me.gr ? { kind: THROWABLES[me.gr[0]] ?? 'frag', count: me.gr[1] } : null;
      this.speedTicks = me.sp;
      this.damageTicks = me.dm;
      this.jetFuel = me.jp ?? null;
      this.airJumps = me.cl ? (CLASS_DEFS[CLASS_IDS[me.cl[0]] ?? 'rocketeer'].airJumps ?? 0) : 0;
      this.glider = me.gl === 1;
      this.reloadTicks = Math.max(0, me.rl - this.pending.length);
      this.raiseTicks = Math.max(0, me.rs - this.pending.length);
      this.unchambered = new Set(me.uc ?? []);
      // The reload as the server has it, moved on by the inputs it hasn't seen yet (their stages land on the next tick).
      this.reload = me.rd && this.reloadTicks > 0 ? { kind: RELOAD_KINDS[me.rd[0]] ?? 'tactical', t: me.rd[1] + this.pending.length, total: me.rd[2], stage: me.rd[3] } : null;
    }
    // A fresh life: no recoil left over.
    if (!wasAlive && this.alive) {
      this.gun = newGunState();
      this.rounds = 0;
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
      ...(sta ? { ...(sta[0] < 1000 ? { stamina: sta[0] / 1000 } : {}), ...(sta[1] ? { rest: sta[1] } : {}), ...(sta[2] ? { winded: true } : {}) } : {}),
      // Double jumps already used and whether jump was held, so a replay doesn't jump again.
      ...(me?.cl && me.cl[4] & 3 ? { airJumps: me.cl[4] & 3 } : {}),
      ...(me?.cl && me.cl[4] & 4 ? { jumpHeld: true } : {}),
    };
    let t = serverTick ?? this.predTick - this.pending.length;
    if (this.alive && !this.mounted) {
      for (const input of this.pending) this.state = this.move(this.state, input, ++t);
    } else t += this.pending.length;
    this.predTick = t;
    const err = distance(before, this.state.pos);
    if (wasAlive && this.alive && err > 0.01) {
      this.corrections++;
      this.lastCorrection = err;
    }
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}
