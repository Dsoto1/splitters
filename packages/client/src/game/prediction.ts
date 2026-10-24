import {
  BUTTON_ALT,
  BUTTON_FIRE,
  OIL_TRACTION,
  applyPads,
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
  type MoveState,
  type PlayerInput,
  type PlayerSnapshot,
  type PrivateState,
  type Vec3,
  type WeaponDefinition,
  type ZoneSnapshot,
} from '@chronosplit/shared';

const MAX_PENDING = 120;
const ORDER = new Map(WEAPONS_BY_SLOT.map((w) => [w.id, weaponCode(w)]));

export interface PredictedShot {
  def: WeaponDefinition;
  /** Predicted tracer end points (one per pellet; empty for melee/projectiles). */
  ends: Vec3[];
  /** The second trigger. */
  alt?: boolean;
}


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
  /** Seated in a turret or vehicle: the server moves you, so movement isn't predicted. */
  mounted = false;
  /** The seat's gun (set by the session while seated), its heat, and whether the seat can't shoot at all (driving). */
  seatGun: WeaponDefinition | null = null;
  private seatAmmo: [number, number, number, number] = [0, 0, 0, 0];
  unarmed = false;
  /** Movement multiplier from status effects (server value). */
  statusSpeed = 1;
  /** Ground hazards from the latest snapshot (oil makes movement slick). */
  zones: readonly ZoneSnapshot[] = [];
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

  /** Predict one tick. Returns the input to send and any predicted shot. */
  tick(sample: { forward: number; right: number; buttons: number; say?: number }, yaw: number, pitch: number, weapon: number, viewTick: number): { input: PlayerInput; shot: PredictedShot | null } {
    const input: PlayerInput = { seq: ++this.seq, ...sample, yaw, pitch, weapon, viewTick };
    this.prevPos = { ...this.state.pos };
    let shot: PredictedShot | null = null;
    if (this.alive) {
      if (weapon && weapon !== this.held && this.inventory.has(weapon)) {
        this.held = weapon;
        this.raiseTicks = this.weapon?.raiseTicks ?? 0;
        this.reloadTicks = 0;
        this.windup = 0;
        this.burstLeft = 0;
      }
      if (!this.mounted) this.state = this.move(this.state, input);
      if (this.fireCooldown > 0) this.fireCooldown--;
      if (this.raiseTicks > 0) this.raiseTicks--;
      if (this.reloadTicks > 0) this.reloadTicks--;
      shot = this.predictFire(input);
    }
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    return { input, shot };
  }

  /** Same order as the server: move with the current boost, then count the boost down. */
  private move(state: MoveState, input: PlayerInput): MoveState {
    const jet = this.jetFuel !== null && this.jetFuel >= JET.burn;
    const next = applyPads(this.pads, stepMovement(this.physics, this.collider, state, input, (this.speedTicks > 0 ? SPEED_BOOST : 1) * this.statusSpeed, TICK_DT, this.traction(state.pos), { liquids: this.liquids, jet, ladders: this.ladders, scale: this.scale }));
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

  /** Mirrors the server's trigger rules (semi-auto, burst, spin-up, heat) so tracers and the HUD match what will happen. */
  private predictFire(input: PlayerInput): PredictedShot | null {
    const def = this.seatGun ?? this.weapon;
    const ammo = this.seatGun ? this.seatAmmo : this.inventory.get(this.held);
    const fireDown = (input.buttons & BUTTON_FIRE) !== 0;
    if (!fireDown) this.semiLatch = false;
    if (!def || !ammo || this.unarmed) return null;
    if (def.windupTicks) {
      const able = fireDown && this.raiseTicks === 0 && this.reloadTicks === 0 && ammo[3] < 100 && (def.magazine === 0 || ammo[0] > 0);
      this.windup = able ? Math.min(def.windupTicks, this.windup + 1) : Math.max(0, this.windup - 2);
    }
    if (this.burstLeft > 0) {
      if (--this.burstTimer > 0) return null;
      if (ammo[0] === 0) {
        this.burstLeft = 0;
        return null;
      }
      ammo[0]--;
      this.burstLeft--;
      this.burstTimer = def.burst?.intervalTicks ?? 1;
      return this.hitscanShot(def, input, def.pellets, def.spread, false);
    }
    if (this.fireCooldown > 0 || (this.raiseTicks > 0 && !this.seatGun) || this.reloadTicks > 0 || this.statusSpeed === 0) return null;
    let pellets = def.pellets;
    let spread = def.spread;
    let alt = false;
    if (fireDown) {
      if (this.semiLatch || (def.windupTicks && this.windup < def.windupTicks)) return null;
      if (def.magazine > 0 && ammo[0] === 0) return null;
      if (def.heat) {
        if (ammo[3] >= 100) return null;
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
      if (def.kind !== 'hitscan') return { def, ends: [] };
    } else if (input.buttons & BUTTON_ALT && def.alt) {
      // Mirrors the server: own-ammo triggers spend their own rounds, shared ones the magazine.
      const a = def.alt;
      if (a.ammo === 'own' ? ammo[2] < a.cost : ammo[0] < a.cost) return null;
      if (a.ammo === 'own') ammo[2] -= a.cost;
      else ammo[0] -= a.cost;
      this.fireCooldown = a.fireIntervalTicks;
      alt = true;
      if (a.kind !== 'hitscan') return { def, ends: [], alt };
      pellets = a.pellets ?? pellets;
      spread = a.spread ?? spread;
    } else return null;
    return this.hitscanShot(def, input, pellets, spread, alt);
  }

  private hitscanShot(def: WeaponDefinition, input: PlayerInput, pellets: number, spread: number, alt: boolean): PredictedShot {
    const eye = this.eye;
    const ends: Vec3[] = [];
    for (let i = 0; i < pellets; i++) {
      // Cosmetic spread; the server rolls its own.
      const yaw = input.yaw + (Math.random() - 0.5) * 2 * spread;
      const pitch = input.pitch + (Math.random() - 0.5) * 2 * spread;
      const dir = viewDirection(yaw, pitch);
      const d = this.physics.raycastWorld(eye, dir, def.range) ?? def.range;
      ends.push({ x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d });
    }
    return { def, ends, ...(alt ? { alt } : {}) };
  }

  /** Server reconciliation. */
  reconcile(server: PlayerSnapshot, ack: number, me?: PrivateState): void {
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
      this.reloadTicks = Math.max(0, me.rl - this.pending.length);
      this.raiseTicks = Math.max(0, me.rs - this.pending.length);
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
      ...(sta ? { ...(sta[0] < 1000 ? { stamina: sta[0] / 1000 } : {}), ...(sta[1] ? { rest: sta[1] } : {}), ...(sta[2] ? { winded: true } : {}) } : {}),
    };
    if (this.alive && !this.mounted) {
      for (const input of this.pending) this.state = this.move(this.state, input);
    }
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
