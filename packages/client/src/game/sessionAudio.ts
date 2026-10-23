import { CORE_WEAPONS, PLAYER, getItem, type MapDocument, type GameEvent, type Vec3, type WeaponDefinition, getWeapon, getProp } from '@chronosplit/shared';
import type { AudioSystem, SoundId } from '../audio/audio.ts';
import type { LocalPlayer } from './prediction.ts';
import type { RemotePose } from './interpolation.ts';

/** Metres walked per footstep. */
const STRIDE = 2.3;
/** Kills this close together (seconds) count towards a multi-kill. */
const MULTI_KILL_WINDOW = 4;
/** Shotgun pellets that each make an impact sound (the rest would only add mush). */
const MAX_IMPACTS_PER_SHOT = 2;

const fireSound = (weaponId: string) => (CORE_WEAPONS[weaponId]?.view.sound ?? `fire.${weaponId.replace(/^core\./, '')}`) as SoundId;
const tuple = (p: readonly number[]): Vec3 => ({ x: p[0]!, y: p[1]!, z: p[2]! });

/**
 * Turns one match's events and movement into sounds. Local actions (own shots,
 * footsteps, reloads) play immediately from prediction and without position;
 * everything else is positioned in the world.
 */
export class SessionAudio {
  private readonly pickupAt = new Map<string, Vec3>();
  private entities: MapDocument['entities'] = [];
  private readonly strides = new Map<number, { x: number; z: number; acc: number }>();
  private localStride = 0;
  private wasGrounded = true;
  private fallSpeed = 0;
  private prevReload = 0;
  private prevHeld = 0;
  private dryFireAt = 0;
  private recentKills: number[] = [];

  constructor(
    private readonly audio: AudioSystem,
    private readonly localSlot: () => number,
  ) {}

  setMap(doc: MapDocument): void {
    this.entities = doc.entities;
    for (const e of doc.entities) if (e.kind === 'pickup') this.pickupAt.set(e.id, tuple(e.position));
  }

  joined(): void {
    this.audio.play('announce.fight');
  }

  /** A shot the local player just fired (predicted). */
  localShot(def: WeaponDefinition, alt = false): void {
    this.audio.play(alt && def.alt?.kind === 'projectile' && def.alt.ammo === 'own' ? 'fire.launcher' : fireSound(def.id));
  }

  /** The fire button is down with an empty magazine. */
  dryFire(now: number): void {
    if (now - this.dryFireAt < 300) return;
    this.dryFireAt = now;
    this.audio.play('dryfire');
  }

  /** Per-tick local movement: footsteps and landings. */
  localStep(local: LocalPlayer, before: Vec3, speedScale: number): void {
    const s = local.state;
    if (!local.alive) {
      this.wasGrounded = true;
      return;
    }
    if (s.grounded) {
      if (!this.wasGrounded && this.fallSpeed > 5) this.audio.play('land', { gain: Math.min(1.4, this.fallSpeed / 9) });
      this.localStride += Math.hypot(s.pos.x - before.x, s.pos.z - before.z);
      if (this.localStride > STRIDE * speedScale) {
        this.localStride = 0;
        this.audio.play('footstep', { gain: 0.7 });
      }
    } else {
      this.fallSpeed = -s.velY;
    }
    this.wasGrounded = s.grounded;
  }

  /** Per-frame local weapon state: reload and weapon-raise cues. */
  localWeapon(local: LocalPlayer): void {
    if (local.alive) {
      if (local.held !== this.prevHeld && this.prevHeld !== 0) this.audio.play('weapon.raise');
      if (local.reloadTicks > 0 && this.prevReload === 0) this.audio.play('reload.start');
      if (local.reloadTicks === 0 && this.prevReload > 0 && local.held === this.prevHeld) this.audio.play('reload.end');
    }
    this.prevHeld = local.alive ? local.held : 0;
    this.prevReload = local.alive ? local.reloadTicks : 0;
  }

  /** Per-frame remote movement: footsteps from interpolated poses. */
  remoteSteps(poses: readonly RemotePose[]): void {
    const me = this.localSlot();
    for (const p of poses) {
      if (p.slot === me) continue;
      const prev = this.strides.get(p.slot);
      if (!p.alive || !prev) {
        this.strides.set(p.slot, { x: p.x, z: p.z, acc: 0 });
        continue;
      }
      const d = Math.hypot(p.x - prev.x, p.z - prev.z);
      // Teleports (respawns) are not steps.
      prev.acc = d > 3 ? 0 : prev.acc + d;
      prev.x = p.x;
      prev.z = p.z;
      if (prev.acc > STRIDE) {
        prev.acc = 0;
        this.audio.play('footstep', { at: { x: p.x, y: p.y, z: p.z } });
      }
    }
  }

  /** Server events. `poses` gives remote positions for events that carry none. */
  event(ev: GameEvent, poses: () => readonly RemotePose[], now: number): void {
    const me = this.localSlot();
    const poseOf = (slot: number): Vec3 | undefined => {
      const p = poses().find((q) => q.slot === slot);
      return p && { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z };
    };
    switch (ev.e) {
      case 'shot': {
        const mine = ev.s === me;
        // Own shots already played from prediction. A second trigger that launches something sounds like a launcher.
        const altLaunch = ev.alt && getWeapon(ev.w).alt?.kind === 'projectile' && getWeapon(ev.w).alt?.ammo === 'own';
        if (!mine) this.audio.play(altLaunch ? 'fire.launcher' : fireSound(ev.w), { at: tuple(ev.from) });
        let impacts = 0;
        ev.to.forEach((to, i) => {
          if (impacts >= MAX_IMPACTS_PER_SHOT) return;
          impacts++;
          const hit = ev.hit[i];
          if (hit === me) return; // the hurt sound covers it
          this.audio.play(hit === null || hit === undefined ? 'impact.world' : 'impact.body', { at: tuple(to) });
        });
        if (mine && ev.hit.some((h) => h !== null)) this.audio.play('ui.hit');
        break;
      }
      case 'melee': {
        if (ev.s !== me) {
          const at = poseOf(ev.s);
          if (at) this.audio.play('fire.knife', { at });
          if (at && ev.hit !== null) this.audio.play('knife.hit', { at });
        } else if (ev.hit !== null) {
          this.audio.play('knife.hit');
          this.audio.play('ui.hit');
        }
        break;
      }
      case 'explode': {
        const at = tuple(ev.p);
        this.audio.play('explosion', { at });
        this.audio.play('explosion.debris', { at });
        break;
      }
      case 'pickup': {
        const kind = getItem(ev.item)?.effect.kind ?? 'ammo';
        const id = `pickup.${kind}` as SoundId;
        if (ev.s === me) this.audio.play(id);
        else {
          const at = this.pickupAt.get(ev.id) ?? poseOf(ev.s);
          if (at) this.audio.play(id, { at, gain: 0.7 });
        }
        break;
      }
      case 'kill': {
        const at = ev.victim === me ? undefined : poseOf(ev.victim);
        if (ev.victim === me) this.audio.play('death');
        else if (at) this.audio.play('death', { at });
        if (ev.killer === me && ev.victim !== me) {
          this.audio.play('ui.kill');
          const t = now / 1000;
          this.recentKills = [...this.recentKills.filter((k) => t - k < MULTI_KILL_WINDOW), t];
          if (this.recentKills.length === 2) this.audio.play('announce.multikill');
        }
        break;
      }
      case 'round_end':
        this.audio.play(ev.winner === null ? 'announce.tie' : ev.winner === me ? 'announce.win' : 'announce.lose');
        break;
      case 'round_start':
        this.recentKills = [];
        this.audio.play('announce.fight');
        break;
      case 'door':
        this.audio.play(ev.open ? 'door.open' : 'door.close', { at: this.entityAt(ev.i, 1.5) });
        break;
      case 'use':
        if (ev.s === me) this.audio.play(ev.ok ? 'button.press' : 'use.denied');
        else if (ev.ok) this.audio.play('button.press', { at: this.entityAt(ev.i, 1.2) });
        break;
      case 'trap': {
        const e = this.entities[ev.i];
        if (e?.kind !== 'trap') break;
        const at = this.entityAt(ev.i, 0.5);
        if (ev.warn) this.audio.play('trap.warn', { at });
        else if (e.trap !== 'mine') this.audio.play(`trap.${e.trap}` as SoundId, { at });
        break;
      }
      case 'broken': {
        const e = this.entities[ev.i];
        if (e?.kind === 'prop') {
          if (!getProp(e.model)?.breakable?.blast) this.audio.play('break.crate', { at: this.entityAt(ev.i, 0.6) });
          break;
        }
        // Barrels, gas and generators are heard as their explosions.
        if (e?.kind !== 'destructible' || e.model === 'barrel' || e.model === 'gas' || e.model === 'generator') break;
        this.audio.play(e.model === 'wall' ? 'break.wall' : e.model === 'glass' ? 'break.glass' : 'break.crate', { at: this.entityAt(ev.i, e.model === 'glass' ? 1.7 : 0.6) });
        if (e.model === 'wall') this.audio.play('explosion.debris', { at: this.entityAt(ev.i, 1) });
        break;
      }
      case 'throw': {
        const at = ev.s === me ? undefined : poseOf(ev.s);
        if (ev.s === me) this.audio.play('throw');
        else if (at) this.audio.play('throw', { at });
        break;
      }
      case 'cue':
        this.audio.play(ev.cue === 'boom' ? 'explosion' : (`cue.${ev.cue}` as SoundId));
        break;
      case 'obj':
        this.audio.play(ev.st === 2 ? 'objective.complete' : ev.st === 3 ? 'cue.buzzer' : 'objective.new');
        break;
      case 'msg':
        this.audio.play('message');
        break;
      case 'spawn':
        break;
    }
  }

  private entityAt(i: number, lift: number): Vec3 | undefined {
    const e = this.entities[i];
    return e && { x: e.position[0], y: e.position[1] + lift, z: e.position[2] };
  }
}
