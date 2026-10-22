import {
  BUTTON_FIRE,
  PLAYER,
  PhysicsWorld,
  SPEED_BOOST,
  WEAPONS_BY_SLOT,
  distance,
  stepMovement,
  viewDirection,
  type MoveState,
  type PlayerInput,
  type PlayerSnapshot,
  type PrivateState,
  type Vec3,
  type WeaponDefinition,
} from '@chronosplit/shared';

const MAX_PENDING = 120;

export interface PredictedShot {
  def: WeaponDefinition;
  /** Predicted tracer end points (one per pellet; empty for melee/projectiles). */
  ends: Vec3[];
}

const weaponBySlot = (slot: number) => WEAPONS_BY_SLOT.find((w) => w.slot === slot);

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
  /** Held weapon slot (predicted). */
  held = 2;
  /** Owned weapons: slot -> [magazine, reserve] (server values, adjusted by predicted shots). */
  inventory = new Map<number, [number, number]>();
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

  constructor(private readonly physics: PhysicsWorld) {
    this.collider = physics.createPlayerCollider();
  }

  get eye(): Vec3 {
    return { x: this.state.pos.x, y: this.state.pos.y + PLAYER.eyeHeight, z: this.state.pos.z };
  }

  get weapon(): WeaponDefinition | undefined {
    return weaponBySlot(this.held);
  }

  /** Owned slots in order (for wheel cycling and the HUD). */
  ownedSlots(): number[] {
    return [...this.inventory.keys()].sort((a, b) => a - b);
  }

  /** Predict one tick. Returns the input to send and any predicted shot. */
  tick(sample: { forward: number; right: number; buttons: number }, yaw: number, pitch: number, weapon: number, viewTick: number): { input: PlayerInput; shot: PredictedShot | null } {
    const input: PlayerInput = { seq: ++this.seq, ...sample, yaw, pitch, weapon, viewTick };
    let shot: PredictedShot | null = null;
    if (this.alive) {
      if (weapon && weapon !== this.held && this.inventory.has(weapon)) {
        this.held = weapon;
        this.raiseTicks = this.weapon?.raiseTicks ?? 0;
        this.reloadTicks = 0;
      }
      this.state = this.move(this.state, input);
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
    const next = stepMovement(this.physics, this.collider, state, input, this.speedTicks > 0 ? SPEED_BOOST : 1);
    if (this.speedTicks > 0) this.speedTicks--;
    return next;
  }

  private predictFire(input: PlayerInput): PredictedShot | null {
    const def = this.weapon;
    const ammo = this.inventory.get(this.held);
    if (!def || !ammo || !(input.buttons & BUTTON_FIRE) || this.fireCooldown > 0 || this.raiseTicks > 0 || this.reloadTicks > 0) return null;
    if (def.magazine > 0 && ammo[0] === 0) return null;
    if (def.magazine > 0) ammo[0]--;
    this.fireCooldown = def.fireIntervalTicks;
    if (def.kind !== 'hitscan') return { def, ends: [] };
    const eye = this.eye;
    const ends: Vec3[] = [];
    for (let i = 0; i < def.pellets; i++) {
      // Cosmetic spread; the server rolls its own.
      const yaw = input.yaw + (Math.random() - 0.5) * 2 * def.spread;
      const pitch = input.pitch + (Math.random() - 0.5) * 2 * def.spread;
      const dir = viewDirection(yaw, pitch);
      const d = this.physics.raycastWorld(eye, dir, def.range) ?? def.range;
      ends.push({ x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d });
    }
    return { def, ends };
  }

  /** Server reconciliation. */
  reconcile(server: PlayerSnapshot, ack: number, me?: PrivateState): void {
    const wasAlive = this.alive;
    this.alive = server.alive === 1;
    this.health = server.hp;
    this.armor = server.ar;
    this.pending = this.pending.filter((i) => i.seq > ack);
    if (me) {
      this.inventory = new Map(me.inv.map(([slot, mag, reserve]) => [slot, [mag, reserve]]));
      this.speedTicks = me.sp;
      this.damageTicks = me.dm;
      this.reloadTicks = Math.max(0, me.rl - this.pending.length);
      this.raiseTicks = Math.max(0, me.rs - this.pending.length);
    }
    // Keep a pending weapon switch the server hasn't seen yet.
    const pendingSwitch = [...this.pending].reverse().find((i) => i.weapon && this.inventory.has(i.weapon))?.weapon;
    this.held = pendingSwitch ?? server.w;

    const before = this.state.pos;
    this.state = { pos: { x: server.p[0], y: server.p[1], z: server.p[2] }, velY: server.vy, grounded: server.g === 1 };
    if (this.alive) {
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
