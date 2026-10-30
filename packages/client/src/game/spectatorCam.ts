import { angleDelta, fitBounds, lookAngles, viewDirection, type MapDocument, type Vec3 } from '@tiletrigger/shared';

/**
 * The cameras for when you're out of play (docs/FEATURES.md, "Spectating"):
 *
 * - **Kill cam**: as you die, the view turns from where you were looking to
 *   your killer and follows them from just behind and above your body, for
 *   KILL_CAM_SECONDS or until you respawn (any spectator key skips it). A
 *   killer out of what this client knows is replaced by where the shot came
 *   from.
 * - **Follow**: over the shoulder of a player you pick (next / previous).
 * - **Free**: a noclip camera inside the map's bounds (mouse looks, WASD
 *   moves, E/Q up and down, Shift faster).
 *
 * Who you may watch (spectateRule): a dead player in a team mode follows
 * only their own team (no ghosting for their side); pure spectators (who
 * chose to spectate: on no team), free-for-all modes, offline matches and
 * whoever runs the match may follow anyone and use the free camera.
 *
 * Pure logic, no Babylon: the session asks it for a camera pose each frame.
 */

/** How long the kill cam lasts at most (s); it ends sooner when you respawn. */
export const KILL_CAM_SECONDS = 3.5;
/** How long the view takes to turn to the killer (s). */
const KILL_CAM_TURN = 0.45;
/** Free camera speed (m/s), and with Shift held. */
export const FREE_CAM_SPEED = 9;
export const FREE_CAM_FAST = 24;

export interface SpectateRule {
  /** Follow only your own team (a dead player in a team mode). */
  teamOnly: boolean;
  /** The free camera is allowed. */
  freeCam: boolean;
}

/**
 * The spectating rule: in team modes a dead team player follows teammates only and has no free camera
 * (it would scout for their side); a pure spectator (on no team), any free-for-all mode, an offline match
 * and whoever runs the match (its host or admin) may follow anyone and fly the free camera.
 */
export function spectateRule(o: { teamMode: boolean; pureSpectator: boolean; offline: boolean; runsMatch: boolean }): SpectateRule {
  const open = !o.teamMode || o.pureSpectator || o.offline || o.runsMatch;
  return { teamOnly: !open, freeCam: open };
}

/** Someone the camera can watch, as drawn this frame. */
export interface Watchable {
  slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  alive: boolean;
}

export interface CameraPose {
  pos: Vec3;
  yaw: number;
  pitch: number;
}

/** A ray against the level: the distance to the first hit, or null. */
export type Cast = (from: Vec3, dir: Vec3, len: number) => number | null;

/** The free camera's box: the map's play area plus a margin, and a floor and ceiling. */
export interface FreeBounds {
  min: Vec3;
  max: Vec3;
}

interface KillCam {
  killer: number;
  weapon: string;
  startedAt: number;
  until: number;
  /** Where you died (your body), and where the killing shot came from (null: not seen). */
  body: Vec3;
  from: Vec3 | null;
  /** Where you were looking as you died: the view turns from here. */
  yaw: number;
  pitch: number;
  /** Where the killer was last seen, for when they drop out of view. */
  lastSeen: Vec3 | null;
}

const lerpAngle = (a: number, b: number, t: number): number => a + angleDelta(a, b) * t;

/** The free camera's box: the map's boundary (else round everything built, 12 m out), from 10 m under its lowest entity to 60 m over its highest. */
export function freeCamBounds(map: MapDocument): FreeBounds | null {
  const b = map.bounds ?? fitBounds(map, 12);
  if (!b) return null;
  let low = Infinity;
  let high = -Infinity;
  for (const e of map.entities) {
    low = Math.min(low, e.position[1]);
    high = Math.max(high, e.position[1]);
  }
  if (!Number.isFinite(low)) low = high = 0;
  return { min: { x: b.min[0], y: low - 10, z: b.min[1] }, max: { x: b.max[0], y: high + 60, z: b.max[1] } };
}

export class SpectatorCam {
  private kill: KillCam | null = null;
  /** The slot followed (-1: none yet). */
  following = -1;
  /** Flying the free camera. */
  free = false;
  /** The free camera's position (set from the view when it starts). */
  private freePos: Vec3 | null = null;

  /** You died to `killer` (a player or NPC, not yourself): the kill cam starts. */
  startKillCam(o: { killer: number; weapon: string; body: Vec3; from: Vec3 | null; yaw: number; pitch: number; now: number; seconds?: number }): void {
    this.kill = { killer: o.killer, weapon: o.weapon, startedAt: o.now, until: o.now + (o.seconds ?? KILL_CAM_SECONDS) * 1000, body: { ...o.body }, from: o.from, yaw: o.yaw, pitch: o.pitch, lastSeen: null };
    // Whom to follow afterwards is picked afresh (spectateRule decides who may be watched).
    this.following = -1;
  }

  /** The kill cam in progress (null when it isn't), for the banner. */
  killCam(now: number): { killer: number; weapon: string; left: number } | null {
    const k = this.kill;
    if (!k) return null;
    if (now >= k.until) {
      this.kill = null;
      return null;
    }
    return { killer: k.killer, weapon: k.weapon, left: (k.until - now) / 1000 };
  }

  /** End the kill cam now (skipped, or you respawned). */
  endKillCam(): void {
    this.kill = null;
  }

  /** Back in play: everything resets for the next time. */
  reset(): void {
    this.kill = null;
    this.free = false;
    this.freePos = null;
  }

  /**
   * The kill cam's view this frame: from behind and above your body, turning (over KILL_CAM_TURN) from where
   * you looked to the killer (`target`: their chest as drawn), or to where the shot came from when they
   * aren't in view.
   */
  killCamPose(now: number, target: Vec3 | null, cast: Cast): CameraPose | null {
    const k = this.kill;
    if (!k) return null;
    if (target) k.lastSeen = { ...target };
    const look = target ?? k.lastSeen ?? k.from;
    const head = { x: k.body.x, y: k.body.y + 1.6, z: k.body.z };
    if (!look) return { pos: head, yaw: k.yaw, pitch: k.pitch };
    // Back from the body, away from the killer, and up: your body in the foreground, the killer beyond.
    const dx = look.x - head.x;
    const dz = look.z - head.z;
    const flat = Math.hypot(dx, dz) || 1;
    const off = { x: (-dx / flat) * 2.6, y: 1.4, z: (-dz / flat) * 2.6 };
    const len = Math.hypot(off.x, off.y, off.z);
    const dir = { x: off.x / len, y: off.y / len, z: off.z / len };
    const hit = cast(head, dir, len);
    const d = hit === null ? len : Math.max(0.3, hit - 0.25);
    const pos = { x: head.x + dir.x * d, y: head.y + dir.y * d, z: head.z + dir.z * d };
    const aim = lookAngles(pos, look);
    // Ease out: a quick turn that settles on them.
    const t = Math.min(1, (now - k.startedAt) / 1000 / KILL_CAM_TURN);
    const e = 1 - (1 - t) * (1 - t);
    return { pos, yaw: lerpAngle(k.yaw, aim.yaw, e), pitch: k.pitch + (aim.pitch - k.pitch) * e };
  }

  /** Whom to follow among `candidates` (in slot order): the one followed now if still there, else the first. */
  target(candidates: readonly Watchable[]): Watchable | null {
    if (!candidates.length) return null;
    const now = candidates.find((c) => c.slot === this.following);
    if (now) return now;
    this.following = candidates[0]!.slot;
    return candidates[0]!;
  }

  /** Next (+1) or previous (-1) player to follow. */
  cycle(step: number, candidates: readonly Watchable[]): void {
    if (!candidates.length || !step) return;
    const i = candidates.findIndex((c) => c.slot === this.following);
    const n = candidates.length;
    const next = i < 0 ? (step > 0 ? 0 : n - 1) : (((i + Math.sign(step)) % n) + n) % n;
    this.following = candidates[next]!.slot;
  }

  /** Over the shoulder of whom you follow, pulled in where a wall is in the way. */
  followPose(watch: Watchable, cast: Cast): CameraPose {
    const fwd = viewDirection(watch.yaw, 0.25);
    const at = { x: watch.x, y: watch.y + 1.7, z: watch.z };
    const back = { x: -fwd.x, y: 0.35, z: -fwd.z };
    const len = Math.hypot(back.x, back.y, back.z);
    const dir = { x: back.x / len, y: back.y / len, z: back.z / len };
    const hit = cast(at, dir, 3.2);
    const d = hit === null ? 3.2 : Math.max(0.4, hit - 0.25);
    return { pos: { x: at.x + dir.x * d, y: at.y + dir.y * d, z: at.z + dir.z * d }, yaw: watch.yaw, pitch: -0.2 };
  }

  /** Start (or stop) the free camera, from `from` (the view as it is). */
  setFree(on: boolean, from: Vec3): void {
    this.free = on;
    this.freePos = on ? { ...from } : null;
  }

  /** Where the free camera is (null when it isn't flying). */
  get freeAt(): Vec3 | null {
    return this.freePos;
  }

  /**
   * One step of the free camera: `forward`/`right` (-1..1) along the view, `up` (-1..1) straight up, for
   * `dt` seconds, kept inside `bounds`. Returns whether it moved.
   */
  moveFree(dt: number, forward: number, right: number, up: number, yaw: number, pitch: number, fast: boolean, bounds: FreeBounds | null): boolean {
    const p = this.freePos;
    if (!p || (!forward && !right && !up)) return false;
    const speed = (fast ? FREE_CAM_FAST : FREE_CAM_SPEED) * dt;
    const f = viewDirection(yaw, pitch);
    const r = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    p.x += (f.x * forward + r.x * right) * speed;
    p.y += (f.y * forward + up) * speed;
    p.z += (f.z * forward + r.z * right) * speed;
    if (bounds) {
      p.x = Math.min(bounds.max.x, Math.max(bounds.min.x, p.x));
      p.y = Math.min(bounds.max.y, Math.max(bounds.min.y, p.y));
      p.z = Math.min(bounds.max.z, Math.max(bounds.min.z, p.z));
    }
    return true;
  }
}

/**
 * Who you may follow: living players (NPCs never), not yourself, your team only under `teamOnly`. Sorted by
 * slot, so next and previous go round in a fixed order.
 */
export function followable(poses: readonly Watchable[], me: number, rule: SpectateRule, teamOf: (slot: number) => string | undefined, npcBase: number): Watchable[] {
  const mine = teamOf(me);
  return poses
    .filter((p) => p.alive && p.slot !== me && p.slot < npcBase && (!rule.teamOnly || (mine !== undefined && teamOf(p.slot) === mine)))
    .sort((a, b) => a.slot - b.slot);
}
