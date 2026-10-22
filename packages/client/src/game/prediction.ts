import {
  BUTTON_FIRE,
  PLAYER,
  PhysicsWorld,
  distance,
  stepMovement,
  viewDirection,
  type MoveState,
  type PlayerInput,
  type PlayerSnapshot,
  type Vec3,
  type WeaponDefinition,
} from '@chronosplit/shared';

const MAX_PENDING = 120;

/**
 * Client-side prediction for the local player: apply each input immediately
 * with the shared movement code, keep unacknowledged inputs, and on every
 * snapshot rewind to the server state and replay them.
 */
export class LocalPlayer {
  state: MoveState = { pos: { x: 0, y: 0, z: 0 }, velY: 0, grounded: false };
  alive = false;
  health = 100;
  private readonly collider;
  private pending: PlayerInput[] = [];
  private seq = 0;
  private fireCooldown = 0;
  /** Corrections larger than this count toward the misprediction metric. */
  corrections = 0;
  lastCorrection = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly weapon: WeaponDefinition,
  ) {
    this.collider = physics.createPlayerCollider();
  }

  get eye(): Vec3 {
    return { x: this.state.pos.x, y: this.state.pos.y + PLAYER.eyeHeight, z: this.state.pos.z };
  }

  /** Predict one tick. Returns the input to send and, if the weapon fired, the predicted tracer end. */
  tick(sample: { forward: number; right: number; buttons: number }, yaw: number, pitch: number): { input: PlayerInput; shotEnd: Vec3 | null } {
    const input: PlayerInput = { seq: ++this.seq, ...sample, yaw, pitch };
    let shotEnd: Vec3 | null = null;
    if (this.alive) {
      this.state = stepMovement(this.physics, this.collider, this.state, input);
      shotEnd = this.predictFire(input);
    }
    this.pending.push(input);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    return { input, shotEnd };
  }

  private predictFire(input: PlayerInput): Vec3 | null {
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (!(input.buttons & BUTTON_FIRE) || this.fireCooldown > 0) return null;
    this.fireCooldown = this.weapon.fireIntervalTicks;
    const eye = this.eye;
    const dir = viewDirection(input.yaw, input.pitch);
    const d = this.physics.raycastWorld(eye, dir, this.weapon.range) ?? this.weapon.range;
    return { x: eye.x + dir.x * d, y: eye.y + dir.y * d, z: eye.z + dir.z * d };
  }

  /** Server reconciliation. */
  reconcile(server: PlayerSnapshot, ack: number): void {
    const wasAlive = this.alive;
    this.alive = server.alive === 1;
    this.health = server.hp;
    this.pending = this.pending.filter((i) => i.seq > ack);
    const before = this.state.pos;
    this.state = { pos: { x: server.p[0], y: server.p[1], z: server.p[2] }, velY: server.vy, grounded: server.g === 1 };
    if (this.alive) {
      for (const input of this.pending) this.state = stepMovement(this.physics, this.collider, this.state, input);
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
