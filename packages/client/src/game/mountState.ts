import { AIRPLANE_DEF, BUILT_MOUNT_BASE, MAX_TEAMS, MOUNT_DEFS, MOUNT_FLAG_ALIVE, MOUNT_FLAG_BURNING, MOUNT_FLAG_WRECK, TICK_RATE, airRoute, getMountDef, mapTeams, mountTint, routePose, type MapDocument, type MountDef, type MountSnapshot, type PhysicsWorld, type Vec3 } from '@tiletrigger/shared';

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
  /** Destroyed vehicle: its charred wreck still stands (solid, no seats). */
  wreck: boolean;
  /** On fire (bail out!). */
  burning: boolean;
  /** When the wreck stopped being solid (ms), so it can fade out; 0 otherwise. */
  wreckGoneAt: number;
  seats: number[];
  /** Team colour, paint skin tint, or null: what the model is painted (see mountTint). */
  tint: string | null;
  /** Smoothed pose for drawing. */
  shown: { pos: Vec3; yaw: number; aimYaw: number; aimPitch: number };
  /** Motion between the last two snapshots (m/s, rad/s), the snapshot's tick, and when it arrived (ms). */
  vel: Vec3;
  spin: number;
  tick: number;
  at: number;
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
    const teams = map.entities.some((e) => e.kind === 'mount' && e.faction) ? mapTeams(map, MAX_TEAMS) : [];
    map.entities.forEach((e, index) => {
      // Transport planes are mounts too (they fly their route); their box never blocks anything.
      const plane = e.kind === 'airplane';
      if (e.kind !== 'mount' && !plane) return;
      const def = plane ? AIRPLANE_DEF : getMountDef(e.model);
      if (!def) return;
      const start = plane ? routePose(airRoute(e), 0) : null;
      const pos = start ? start.pos : { x: e.position[0], y: e.position[1], z: e.position[2] };
      const yaw = start ? start.yaw : e.kind === 'mount' ? e.yaw : 0;
      const body = physics.createBox({ x: pos.x, y: pos.y + def.half[1], z: pos.z }, { x: def.half[0], y: def.half[1], z: def.half[2] }, yaw);
      if (plane) physics.setBoxEnabled(body, false);
      const team = e.kind === 'mount' && e.faction ? (teams.find((t) => t.id === e.faction)?.color ?? null) : null;
      const tint = e.kind === 'mount' && def.kind !== 'sentry' ? mountTint(e.skin, team) : null;
      this.mounts.set(index, { index, def, model: def.id, pos, yaw, aimYaw: yaw, aimPitch: 0, health: 100, alive: true, wreck: false, burning: false, wreckGoneAt: 0, seats: def.seats.map(() => -1), tint, shown: { pos: { ...pos }, yaw, aimYaw: yaw, aimPitch: 0 }, vel: { x: 0, y: 0, z: 0 }, spin: 0, tick: -1, at: 0, body });
    });
  }

  apply(list: readonly MountSnapshot[] | undefined, tick = -1): void {
    if (!list) return;
    const now = performance.now();
    for (const s of list) {
      const m = this.mounts.get(s[0]!) ?? (s[0]! >= BUILT_MOUNT_BASE ? this.addBuilt(s) : undefined);
      if (!m) continue;
      const pos = { x: s[1]!, y: s[2]!, z: s[3]! };
      // Velocity from the server's own clock (ticks), so network jitter doesn't shake it.
      const dt = m.tick >= 0 && tick > m.tick ? (tick - m.tick) / TICK_RATE : 0;
      if (dt > 0 && dt < 0.5) {
        const k = 0.5;
        m.vel = { x: m.vel.x + ((pos.x - m.pos.x) / dt - m.vel.x) * k, y: m.vel.y + ((pos.y - m.pos.y) / dt - m.vel.y) * k, z: m.vel.z + ((pos.z - m.pos.z) / dt - m.vel.z) * k };
        m.spin += (Math.atan2(Math.sin(s[4]! - m.yaw), Math.cos(s[4]! - m.yaw)) / dt - m.spin) * k;
      } else if (dt >= 0.5) {
        m.vel = { x: 0, y: 0, z: 0 };
        m.spin = 0;
      }
      if (tick >= 0) m.tick = tick;
      m.at = now;
      m.pos = pos;
      m.yaw = s[4]!;
      m.aimYaw = s[5]!;
      m.aimPitch = s[6]!;
      m.health = s[7]!;
      const flags = s[8]!;
      const alive = (flags & MOUNT_FLAG_ALIVE) !== 0;
      const wreck = (flags & MOUNT_FLAG_WRECK) !== 0;
      if (!m.alive && alive) {
        m.shown = { pos: { ...m.pos }, yaw: m.yaw, aimYaw: m.aimYaw, aimPitch: m.aimPitch };
        m.vel = { x: 0, y: 0, z: 0 };
        m.spin = 0;
      }
      if (m.wreck && !wreck && !alive) m.wreckGoneAt = now;
      if (alive || wreck) m.wreckGoneAt = 0;
      m.alive = alive;
      m.wreck = wreck;
      m.burning = (flags & MOUNT_FLAG_BURNING) !== 0;
      m.seats = s.slice(9);
      // The wreck is solid on the server too: keep it in the prediction physics until it goes. The plane never blocks.
      const solid = (alive || wreck) && !m.def.airplane;
      this.physics.setBoxEnabled(m.body, solid);
      if (solid) this.physics.setBoxPose(m.body, { x: m.pos.x, y: m.pos.y + m.def.half[1], z: m.pos.z }, m.yaw);
    }
    this.physics.commit();
  }

  /** A sentry someone built (Classes): not on the map, so it first shows up in a snapshot. */
  private addBuilt(s: MountSnapshot): ClientMount {
    const def = MOUNT_DEFS.sentry;
    const pos = { x: s[1]!, y: s[2]!, z: s[3]! };
    const yaw = s[4]!;
    const body = this.physics.createBox({ x: pos.x, y: pos.y + def.half[1], z: pos.z }, { x: def.half[0], y: def.half[1], z: def.half[2] }, yaw);
    const m: ClientMount = { index: s[0]!, def, model: def.id, pos, yaw, aimYaw: yaw, aimPitch: 0, health: 100, alive: false, wreck: false, burning: false, wreckGoneAt: 0, seats: [], tint: null, shown: { pos: { ...pos }, yaw, aimYaw: yaw, aimPitch: 0 }, vel: { x: 0, y: 0, z: 0 }, spin: 0, tick: -1, at: 0, body };
    this.mounts.set(m.index, m);
    return m;
  }

  /**
   * Ease the drawn poses toward where each mount is now: its latest state
   * carried on by its motion since that snapshot (at most a few frames'
   * worth), so a fast vehicle glides between snapshots instead of surging
   * at each one.
   */
  smooth(dt: number): void {
    const k = Math.min(1, dt * 18);
    const now = performance.now();
    for (const m of this.mounts.values()) {
      const p = m.shown.pos;
      const ahead = m.alive ? Math.min(0.1, (now - m.at) / 1000) : 0;
      const want = { x: m.pos.x + m.vel.x * ahead, y: m.pos.y + m.vel.y * ahead, z: m.pos.z + m.vel.z * ahead };
      // Respawns and long jumps snap.
      if (Math.hypot(want.x - p.x, want.z - p.z) > 8) m.shown.pos = want;
      else m.shown.pos = { x: p.x + (want.x - p.x) * k, y: p.y + (want.y - p.y) * k, z: p.z + (want.z - p.z) * k };
      m.shown.yaw = angleLerp(m.shown.yaw, m.yaw + m.spin * ahead, k);
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
      if (!m.alive || !m.def.seats.length || !m.seats.includes(-1) || m.def.airplane) continue;
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
