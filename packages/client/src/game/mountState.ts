import { getMountDef, type MapDocument, type MountDef, type MountSnapshot, type PhysicsWorld, type Vec3 } from '@tiletrigger/shared';

/** One mount as the client knows it: the latest server state and a smoothed pose to draw. */
export interface ClientMount {
  index: number;
  def: MountDef;
  model: string;
  /** Latest server state. */
  pos: Vec3;
  yaw: number;
  aimYaw: number;
  aimPitch: number;
  health: number;
  alive: boolean;
  seats: number[];
  /** Smoothed pose for drawing. */
  shown: { pos: Vec3; yaw: number; aimYaw: number; aimPitch: number };
  body: ReturnType<PhysicsWorld['createBox']>;
}

const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

/**
 * The client's copy of turrets, sentries and vehicles: snapshot state, a
 * smoothed pose for the renderer and collision boxes in the prediction
 * physics, so walking into a vehicle predicts the same as on the server.
 */
export class MountState {
  readonly mounts = new Map<number, ClientMount>();

  constructor(
    map: MapDocument,
    private readonly physics: PhysicsWorld,
  ) {
    map.entities.forEach((e, index) => {
      if (e.kind !== 'mount') return;
      const def = getMountDef(e.model);
      if (!def) return;
      const pos = { x: e.position[0], y: e.position[1], z: e.position[2] };
      const body = physics.createBox({ x: pos.x, y: pos.y + def.half[1], z: pos.z }, { x: def.half[0], y: def.half[1], z: def.half[2] }, e.yaw);
      this.mounts.set(index, { index, def, model: e.model, pos, yaw: e.yaw, aimYaw: e.yaw, aimPitch: 0, health: 100, alive: true, seats: def.seats.map(() => -1), shown: { pos: { ...pos }, yaw: e.yaw, aimYaw: e.yaw, aimPitch: 0 }, body });
    });
  }

  apply(list: readonly MountSnapshot[] | undefined): void {
    if (!list) return;
    for (const s of list) {
      const m = this.mounts.get(s[0]!);
      if (!m) continue;
      m.pos = { x: s[1]!, y: s[2]!, z: s[3]! };
      m.yaw = s[4]!;
      m.aimYaw = s[5]!;
      m.aimPitch = s[6]!;
      m.health = s[7]!;
      const alive = s[8] === 1;
      if (!m.alive && alive) m.shown = { pos: { ...m.pos }, yaw: m.yaw, aimYaw: m.aimYaw, aimPitch: m.aimPitch };
      m.alive = alive;
      m.seats = s.slice(9);
      this.physics.setBoxEnabled(m.body, alive);
      if (alive) this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    }
    this.physics.commit();
  }

  /** Ease the drawn poses toward the latest state (vehicles at 30 snapshots a second still look smooth). */
  smooth(dt: number): void {
    const k = Math.min(1, dt * 18);
    for (const m of this.mounts.values()) {
      const p = m.shown.pos;
      // Respawns and long jumps snap.
      if (Math.hypot(m.pos.x - p.x, m.pos.z - p.z) > 8) m.shown.pos = { ...m.pos };
      else m.shown.pos = { x: p.x + (m.pos.x - p.x) * k, y: p.y + (m.pos.y - p.y) * k, z: p.z + (m.pos.z - p.z) * k };
      m.shown.yaw = angleLerp(m.shown.yaw, m.yaw, k);
      m.shown.aimYaw = angleLerp(m.shown.aimYaw, m.aimYaw, k);
      m.shown.aimPitch += (m.aimPitch - m.shown.aimPitch) * k;
    }
  }

  /** Every slot riding in something. */
  riders(): Set<number> {
    const out = new Set<number>();
    for (const m of this.mounts.values()) for (const s of m.seats) if (s >= 0) out.add(s);
    return out;
  }

  /** The mount you would get into from here, and the seat (same rule as the server: driver, then gunner, then passengers). */
  enterable(feet: Vec3): { mount: ClientMount; seat: number } | null {
    let best: ClientMount | null = null;
    let bestD = Infinity;
    for (const m of this.mounts.values()) {
      if (!m.alive || !m.def.seats.length || !m.seats.includes(-1)) continue;
      const d = Math.hypot(m.pos.x - feet.x, m.pos.z - feet.z);
      if (d <= m.def.enterRadius && Math.abs(m.pos.y - feet.y) < 2.5 && d < bestD) {
        best = m;
        bestD = d;
      }
    }
    if (!best) return null;
    for (const role of ['driver', 'gunner', 'passenger'] as const) {
      const seat = best.def.seats.findIndex((s, i) => s.role === role && best!.seats[i] === -1);
      if (seat >= 0) return { mount: best, seat };
    }
    return null;
  }
}
