import { CORE_WEAPONS, ELECTRIC_FENCE, PLAYER, borderShockLines, borderStyles, fenceRun, getItem, shockLineNearest, type ShockLine, type MapDocument, type GameEvent, type Tuple3, type Vec3, type WeaponDefinition, getWeapon, getProp, glassAt, propBreakLook } from '@tiletrigger/shared';
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
/** Engines: how often a copy starts (ms; each is 1.2 s, so two overlap), how many others are heard, and how far (m). */
const ENGINE_REPEAT_MS = 600;
const ENGINE_OTHERS = 2;
const ENGINE_REACH = 60;

/** What the engine sound reads of a mount (game/mountState.ts ClientMount). */
export interface EngineMount {
  index: number;
  alive: boolean;
  seats: readonly number[];
  vel: Vec3;
  shown: { pos: Vec3 };
  def: { kind: string; turret?: unknown; vehicle?: { fly?: unknown; hover?: boolean; maxSpeed?: number } };
}

const tuple = (p: readonly number[]): Vec3 => ({ x: p[0]!, y: p[1]!, z: p[2]! });

/**
 * Turns one match's events and movement into sounds. Local actions (own shots,
 * footsteps, reloads) play immediately from prediction and without position;
 * everything else is positioned in the world.
 */
/** How often an arc sentry's locked arc is heard (ms): its hits come ten a second. */
const ARC_SOUND_MS = 300;

export class SessionAudio {
  private readonly pickupAt = new Map<string, Vec3>();
  private entities: MapDocument['entities'] = [];
  private doc: MapDocument | null = null;
  private readonly strides = new Map<number, { x: number; z: number; acc: number }>();
  private localStride = 0;
  private wasGrounded = true;
  private fallSpeed = 0;
  private prevReload = 0;
  private prevHeld = 0;
  private dryFireAt = 0;
  private recentKills: number[] = [];
  private fences: ShockLine[] = [];
  private humAt = 0;
  /** Force fields (block index and the run of its long side) and when one last hummed. */
  private fields: { i: number; line: ShockLine }[] = [];
  private fieldHumAt = 0;
  /** When each arc sentry (mount index) last crackled: its arc hits ten times a second, heard every ARC_SOUND_MS. */
  private readonly arcSoundAt = new Map<number, number>();

  /** Whether a block (entity index) is up: force fields only hum while they stand. */
  blockPresent: (i: number) => boolean = () => true;

  /** Your team in team modes (null otherwise), for objective and round announcements. */
  myTeam: () => string | null = () => null;

  /**
   * The sound of a round from `from` landing at `to` in the level: its surface type's sound family (game/fxMap.ts
   * impactSoundId; the session asks the view what it struck). Default: the one generic impact.
   */
  worldImpact: (from: Vec3, to: Vec3) => SoundId | null = () => 'impact.world';

  /** Whether blood is shown (the map's setting and the player's): the wet splat on a kill goes with it. */
  bloodOn: () => boolean = () => true;

  constructor(
    private readonly audio: AudioSystem,
    private readonly localSlot: () => number,
  ) {}

  /** An arc sentry starting its wind-up on someone: the warning (break its line of sight). */
  sentryCharge(at: Vec3): void {
    this.audio.play('trap.warn', { at });
  }

  setMap(doc: MapDocument): void {
    this.entities = doc.entities;
    this.doc = doc;
    // Electric fences hum: the border's, and placed ones that are always on.
    this.fences = Object.values(borderStyles(doc)).includes('fence') ? borderShockLines(doc, 0) : [];
    for (const e of doc.entities) {
      if (e.kind !== 'trap' || e.trap !== 'shock' || e.activation !== 'always' || !e.startEnabled) continue;
      const run = fenceRun(e);
      this.fences.push({ a: run.a, b: run.b, y0: e.position[1], height: ELECTRIC_FENCE.height, push: null, entity: null });
    }
    for (const e of doc.entities) if (e.kind === 'pickup') this.pickupAt.set(e.id, tuple(e.position));
    // Force fields hum along their long side.
    this.fields = [];
    doc.entities.forEach((e, i) => {
      if (e.kind !== 'block' || !e.field) return;
      const [w, h, d] = e.size;
      const along = w >= d ? w / 2 : d / 2;
      const [ax, az] = w >= d ? [Math.cos(e.yaw), -Math.sin(e.yaw)] : [Math.sin(e.yaw), Math.cos(e.yaw)];
      const [x, , z] = e.position;
      this.fields.push({ i, line: { a: [x - ax * along, z - az * along], b: [x + ax * along, z + az * along], y0: e.position[1], height: h, push: null, entity: null } });
    });
  }

  /** Someone or something going into water (the view's splash effects call this). */
  splash(at: Vec3): void {
    this.audio.play('water.splash', { at });
  }

  joined(): void {
    // The announcer waits for the countdown's "Go!" (countdownBeep).
  }

  /** One tick of the start countdown, or the "Go!" when it ends. */
  countdownBeep(go: boolean): void {
    this.audio.play(go ? 'announce.fight' : 'message');
  }

  /** A shot the local player just fired (predicted). */
  localShot(def: WeaponDefinition, alt = false): void {
    const own = alt ? def.view.altShot : undefined;
    if (own) this.audio.play(own.sound as SoundId, { rate: own.rate ?? 1, gain: 1.15 });
    else this.audio.play(alt && def.alt?.kind === 'projectile' && def.alt.ammo === 'own' ? 'fire.launcher' : fireSound(def.id));
  }

  /** Your own punch or kick: a swish as you throw it. */
  localStrike(): void {
    this.audio.play('fire.knife', { gain: 0.6 });
  }

  /** The fire button is down with an empty magazine. */
  dryFire(now: number): void {
    if (now - this.dryFireAt < 300) return;
    this.dryFireAt = now;
    this.audio.play('dryfire');
  }

  /** Per-tick local movement: footsteps and landings (none while `mounted`: riding in a seat). */
  localStep(local: LocalPlayer, before: Vec3, speedScale: number, mounted = false): void {
    const s = local.state;
    if (!local.alive || mounted) {
      // A seat moves you without a step (and getting out isn't a landing).
      this.wasGrounded = true;
      this.fallSpeed = 0;
      this.localStride = 0;
      return;
    }
    // On a zipline: the trolley's whirr, higher the faster it runs (no footsteps, no landing from it).
    if (s.zip !== undefined) {
      this.whirr(-1, undefined, Math.abs(s.zv ?? 0));
      this.fallSpeed = 0;
      this.prevReload = local.reloadTicks;
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
    this.fenceHum(s.pos);
    this.fieldHum(s.pos);
  }

  /** The low hum of a standing force field nearby (and only while it is up). */
  private fieldHum(pos: Vec3): void {
    if (!this.fields.length) return;
    const now = performance.now();
    if (now - this.fieldHumAt < 1700) return;
    let best: { x: number; z: number; dist: number } | null = null;
    for (const f of this.fields) {
      if (!this.blockPresent(f.i) || pos.y < f.line.y0 - 3 || pos.y > f.line.y0 + f.line.height + 2) continue;
      const n = shockLineNearest(f.line, pos.x, pos.z);
      if (!best || n.dist < best.dist) best = n;
    }
    if (!best || best.dist > 12) return;
    this.fieldHumAt = now;
    this.audio.play('fence.hum', { at: { x: best.x, y: pos.y + 1.2, z: best.z }, gain: 0.55 });
  }

  /** The hum of a live electric fence nearby, from its nearest point (each buzz is 2 s; they overlap). */
  private fenceHum(pos: Vec3): void {
    if (!this.fences.length) return;
    const now = performance.now();
    if (now - this.humAt < 1700) return;
    let best: { x: number; z: number; dist: number } | null = null;
    for (const l of this.fences) {
      const n = shockLineNearest(l, pos.x, pos.z);
      if (!best || n.dist < best.dist) best = n;
    }
    if (!best || best.dist > 16) return;
    this.humAt = now;
    this.audio.play('fence.hum', { at: { x: best.x, y: pos.y + 1.6, z: best.z } });
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

  /** When each rider's (slot; -1 you) zipline whirr last started. */
  private readonly whirrAt = new Map<number, number>();

  /** A zipline trolley running: the whirr again every ~0.6 s (each one overlaps the last), pitched by speed. */
  private whirr(slot: number, at: Vec3 | undefined, speed: number): void {
    const now = performance.now();
    if (now - (this.whirrAt.get(slot) ?? 0) < 600) return;
    this.whirrAt.set(slot, now);
    if (this.whirrAt.size > 64) this.whirrAt.clear();
    this.audio.play('zip.whirr', { ...(at ? { at } : {}), rate: 0.75 + Math.min(1, speed / 20) * 0.6, gain: 0.5 + Math.min(1, speed / 15) * 0.6 });
  }

  /** When each vehicle's (mount index) engine copy last started. */
  private readonly engineAt = new Map<number, number>();

  /**
   * Vehicle engines, every frame: each living vehicle anyone rides runs its engine (`vehicle.engine`, a 1.2 s copy
   * every 0.6 s, overlapping into a drone), pitched by its speed. `mine` (the vehicle you ride, or null) is heard
   * unpositioned; the nearest ENGINE_OTHERS others from where they are (`ear`: the camera).
   */
  engines(mounts: Iterable<EngineMount>, mine: number | null, ear: Vec3): void {
    const now = performance.now();
    const running: { m: EngineMount; d: number }[] = [];
    for (const m of mounts) {
      if (!m.alive || m.def.kind !== 'vehicle' || !m.seats.some((s) => s >= 0)) continue;
      const d = m.index === mine ? -1 : Math.hypot(m.shown.pos.x - ear.x, m.shown.pos.y - ear.y, m.shown.pos.z - ear.z);
      if (d <= ENGINE_REACH) running.push({ m, d });
    }
    running.sort((a, b) => a.d - b.d);
    const heard = new Set<number>();
    for (const { m, d } of running.slice(0, mine === null ? ENGINE_OTHERS : ENGINE_OTHERS + 1)) {
      heard.add(m.index);
      const last = this.engineAt.get(m.index);
      if (last !== undefined && now - last < ENGINE_REPEAT_MS) continue;
      this.engineAt.set(m.index, now);
      const speed = Math.hypot(m.vel.x, m.vel.z);
      const v = m.def.vehicle;
      const base = v?.fly ? 1.3 : v?.hover ? 1.15 : m.def.turret ? 0.7 : 1;
      const pace = Math.min(1, speed / (v?.maxSpeed || 25));
      const rate = base * (0.8 + pace * 0.6);
      const gain = 0.6 + pace * 0.5;
      if (d < 0) this.audio.play('vehicle.engine', { rate, gain: gain * 0.8 });
      else this.audio.play('vehicle.engine', { at: { x: m.shown.pos.x, y: m.shown.pos.y + 0.6, z: m.shown.pos.z }, rate, gain });
    }
    for (const i of this.engineAt.keys()) if (!heard.has(i)) this.engineAt.delete(i);
  }

  /** Per-frame remote movement: footsteps from interpolated poses (none for `riding`: slots in a seat). */
  remoteSteps(poses: readonly RemotePose[], riding: ReadonlySet<number> = new Set()): void {
    const me = this.localSlot();
    for (const p of poses) {
      if (p.slot === me) continue;
      if (p.alive && p.zip !== undefined) this.whirr(p.slot, { x: p.x, y: p.y + 2, z: p.z }, p.zipSpeed ?? 0);
      const prev = this.strides.get(p.slot);
      if (!p.alive || !prev || riding.has(p.slot)) {
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
  /** Your hit, by sound (GUNPLAY_SPEC §21): a bright ding for the head, a dull clank for armor, the tick for flesh. */
  private hitSound(hits: readonly (number | null)[], zones: readonly number[] | undefined, armor: boolean): void {
    if (!hits.some((h) => h !== null && h !== undefined)) return;
    const head = zones?.some((z, i) => z === 1 && hits[i] !== null && hits[i] !== undefined) ?? false;
    this.audio.play(head ? 'ui.hit.head' : armor ? 'ui.hit.armor' : 'ui.hit');
  }

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
        // A melee weapon's own barrel (the Battle Axe's blunderbuss) has its own report.
        const own = ev.alt ? getWeapon(ev.w).view.altShot : undefined;
        if (!mine && own) this.audio.play(own.sound as SoundId, { at: tuple(ev.from), rate: own.rate ?? 1, gain: 1.15 });
        else if (!mine) this.audio.play(altLaunch ? 'fire.launcher' : fireSound(ev.w), { at: tuple(ev.from) });
        let impacts = 0;
        // Bodies: one meaty hit per victim (a shotgun blast is one big hit, not nine little ones), heavier for big damage.
        const def = getWeapon(ev.w);
        const perVictim = new Map<number, { at: Tuple3; pellets: number; head: boolean }>();
        ev.to.forEach((to, i) => {
          // Rounds still in the air sound where they land (their impact event).
          if (ev.fl?.includes(i)) return;
          const hit = ev.hit[i];
          if (hit !== null && hit !== undefined) {
            const v = perVictim.get(hit);
            perVictim.set(hit, { at: v?.at ?? to, pellets: (v?.pellets ?? 0) + 1, head: (v?.head ?? false) || ev.z?.[i] === 1 });
            return;
          }
          if (impacts >= MAX_IMPACTS_PER_SHOT) return;
          impacts++;
          const sound = this.worldImpact(tuple(ev.from), tuple(to));
          if (sound) this.audio.play(sound, { at: tuple(to) });
        });
        for (const [victim, v] of perVictim) {
          const heavy = v.head || ((ev.alt ? def.alt?.damage : undefined) ?? def.damage) * v.pellets >= 45;
          const at = victim === me ? undefined : tuple(v.at);
          this.audio.play(heavy ? 'impact.heavy' : 'impact.body', { at, gain: victim === me ? 0.6 : 1 });
          this.audio.play('impact.thud', { at, gain: 0.8 });
        }
        if (mine) this.hitSound(ev.hit, ev.z, !!ev.ar);
        break;
      }
      case 'impact': {
        // A bullet that was in flight landed (no shot sound: that played when it was fired).
        if (ev.gone) break;
        const def = getWeapon(ev.w);
        if (ev.hit !== null) {
          const head = ev.z === 1;
          const at = ev.hit === me ? undefined : tuple(ev.to);
          this.audio.play(head || def.damage >= 45 ? 'impact.heavy' : 'impact.body', { at, gain: ev.hit === me ? 0.6 : 1 });
          this.audio.play('impact.thud', { at, gain: 0.8 });
        } else {
          const sound = this.worldImpact(tuple(ev.from), tuple(ev.to));
          if (sound) this.audio.play(sound, { at: tuple(ev.to) });
        }
        if (ev.s === me) this.hitSound([ev.hit], ev.z !== undefined ? [ev.z] : undefined, !!ev.ar);
        break;
      }
      case 'melee': {
        if (ev.u) {
          // Punch or kick: a swish, and a meaty thump when it lands (yours swished when you pressed the key).
          const at = poseOf(ev.s);
          const hitAt = ev.hit !== null && ev.hit !== me ? poseOf(ev.hit) : undefined;
          if (ev.s !== me && at) this.audio.play('fire.knife', { at, gain: 0.6 });
          if (ev.hit !== null) {
            this.audio.play('impact.body', hitAt ? { at: hitAt, gain: 0.9 } : { gain: 0.6 });
            this.audio.play('impact.thud', hitAt ? { at: hitAt } : {});
            if (ev.s === me) this.audio.play('ui.hit');
          }
          break;
        }
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
      case 'knock': {
        const at = ev.t === me ? undefined : poseOf(ev.t);
        this.audio.play('impact.thud', at ? { at } : {});
        if (ev.s === me) this.audio.play('ui.hit');
        break;
      }
      case 'explode': {
        const at = tuple(ev.p);
        // A vehicle going up: a deeper, longer boom under the usual crack, and metal raining down.
        if (ev.m !== undefined) this.audio.play('explosion.vehicle', { at });
        this.audio.play('explosion', { at });
        this.audio.play('explosion.debris', { at });
        if (ev.m !== undefined) this.audio.play('vehicle.crash', { at, gain: 0.7 });
        break;
      }
      case 'crash': {
        this.audio.play('vehicle.crash', { at: tuple(ev.p), gain: 0.4 + ev.n * 0.8 });
        break;
      }
      case 'resupply': {
        // The Supply Buggy's back: the ammo pickup's sound when it gave something.
        if (!ev.ok) break;
        if (ev.s === me) this.audio.play('pickup.ammo');
        else {
          const at = poseOf(ev.s);
          if (at) this.audio.play('pickup.ammo', { at, gain: 0.7 });
        }
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
        if (at && this.bloodOn()) this.audio.play('blood.splat', { at });
        // A team kill: the death sounds only, no kill confirmation.
        if (ev.killer === me && ev.victim !== me && !ev.tk) {
          const t = now / 1000;
          this.recentKills = [...this.recentKills.filter((k) => t - k < MULTI_KILL_WINDOW), t];
          // Crunchy kill confirmation (GUNPLAY_SPEC §22): short, and each kill in a row climbs a step, so a multi-kill is a rhythm.
          const step = Math.min(4, this.recentKills.length) - 1;
          this.audio.play('ui.kill.confirm', { rate: 1 + step * 0.12 });
          this.audio.play('ui.kill', { rate: 1 + step * 0.122, gain: 0.8 });
          if (this.recentKills.length === 2) this.audio.play('announce.multikill');
        }
        break;
      }
      case 'round_end':
        if (ev.team !== undefined) this.audio.play(ev.team === null ? 'announce.tie' : ev.team === this.myTeam() ? 'announce.win' : 'announce.lose');
        else this.audio.play(ev.winner === null ? 'announce.tie' : ev.winner === me ? 'announce.win' : 'announce.lose');
        break;
      // Objective modes: existing cues, chosen by whether it is good or bad news for your team.
      case 'flag': {
        const ours = ev.team === this.myTeam();
        if (ev.a === 'take') this.audio.play(ours ? 'cue.alarm' : ev.s === me ? 'pickup.powerup' : 'objective.new');
        else if (ev.a === 'drop') this.audio.play('message');
        else if (ev.a === 'return') this.audio.play('cue.chime');
        else this.audio.play(ours ? 'cue.buzzer' : 'objective.complete');
        break;
      }
      case 'hill':
        if (ev.a === 'move') this.audio.play('objective.new');
        else if (ev.team !== null) this.audio.play(ev.team === this.myTeam() ? 'cue.chime' : 'cue.buzzer', { gain: 0.6 });
        break;
      case 'hostage':
        if (ev.a === 'rescue') this.audio.play('objective.complete');
        else if (ev.a === 'follow' && ev.s === me) this.audio.play('cue.chime');
        break;
      case 'bomb':
        if (ev.a === 'plant') this.audio.play('cue.alarm');
        else if (ev.a === 'defuse') this.audio.play('objective.complete');
        else if (ev.a === 'pickup' && ev.s === me) this.audio.play('pickup.powerup');
        else if (ev.a === 'drop') this.audio.play('message');
        break;
      // Breakthrough (`team`: the attackers, but on a round's end the winners): good or bad news for your side.
      case 'bt': {
        const ours = ev.team === this.myTeam();
        if (ev.a === 'plant') this.audio.play('cue.alarm');
        else if (ev.a === 'capture' || ev.a === 'destroy' || ev.a === 'defuse') this.audio.play(ours === (ev.a !== 'defuse') ? 'objective.complete' : 'cue.buzzer');
        else if (ev.a === 'sector') this.audio.play(ours ? 'objective.new' : 'cue.alarm');
        else if (ev.a === 'round') this.audio.play(ours ? 'announce.win' : 'announce.lose');
        else if (ev.a === 'start') this.audio.play('announce.fight');
        else if (ev.a === 'pool' && ours) this.audio.play('cue.alarm');
        break;
      }
      case 'elim':
        if (ev.a === 'start') this.audio.play('announce.fight');
        else this.audio.play(ev.team === null ? 'announce.tie' : ev.team === this.myTeam() ? 'announce.win' : 'announce.lose');
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
      case 'arc':
        if (ev.m !== undefined && ev.pts[0]) {
          // An arc sentry's locked arc: its crackle at the gun, a few times a second.
          const now = performance.now();
          if (now - (this.arcSoundAt.get(ev.m) ?? -Infinity) >= ARC_SOUND_MS) {
            this.arcSoundAt.set(ev.m, now);
            this.audio.play('fire.arc', { at: tuple(ev.pts[0]), gain: 0.8 });
          }
        }
        // An electric fence zapping someone (chain-lightning arcs are heard as the gun's own sound).
        else if (ev.s === -1 && ev.pts[0]) this.audio.play('trap.shock', { at: tuple(ev.pts[0]) });
        break;
      case 'trap': {
        const e = this.entities[ev.i];
        if (e?.kind !== 'trap') break;
        const at = this.entityAt(ev.i, 0.5);
        if (ev.warn) this.audio.play('trap.warn', { at });
        else if (e.trap !== 'mine') this.audio.play(`trap.${e.trap}` as SoundId, { at });
        break;
      }
      case 'crack': {
        const pane = this.doc && glassAt(this.doc, ev.i);
        if (pane) this.audio.play('glass.crack', { at: pane.box.center });
        break;
      }
      case 'broken': {
        const e = this.entities[ev.i];
        // Window panes (past the entities) and glass blocks shatter.
        const pane = this.doc && glassAt(this.doc, ev.i);
        if (pane) {
          this.audio.play('break.glass', { at: pane.box.center });
          break;
        }
        // A force field switching off crackles out.
        if (e?.kind === 'block' && e.field) {
          this.audio.play('trap.shock', { at: this.entityAt(ev.i, e.size[1] / 2), gain: 0.6 });
          break;
        }
        if (e?.kind === 'prop') {
          if (!getProp(e.model)?.breakable?.blast) this.audio.play(getProp(e.model)?.breakable ? 'break.crate' : propBreakLook(e.model).sound, { at: this.entityAt(ev.i, 0.6) });
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
