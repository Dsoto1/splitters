import { CORE_WEAPONS, THROWABLE_DEFS, type ThrowableKind, ELECTRIC_FENCE, PLAYER, UNARMED, lookGroup, borderShockLines, borderStyles, fenceRun, getItem, shockLineNearest, type ShockLine, type MapDocument, type GameEvent, type Tuple3, type Vec3, type WeaponDefinition, getWeapon, getProp, glassAt, propBreakLook, weaponByCode } from '@tiletrigger/shared';
import { gunPan } from './pairView.ts';
import type { AudioSystem, SoundId } from '../audio/audio.ts';
import { Announcer, loadVoiceLines } from '../audio/announcer.ts';
import type { LocalPlayer } from './prediction.ts';
import type { RemotePose } from './interpolation.ts';

/** Metres walked per footstep. */
const STRIDE = 2.3;
/** Kills this close together (seconds) count towards a multi-kill (the announcer's chain uses the same window). */
const MULTI_KILL_WINDOW = 4;
/** A kill this soon (ms) after its killer's blast with the same weapon was that blast's. */
const BLAST_KILL_MS = 300;
/** Shotgun pellets that each make an impact sound (the rest would only add mush). */
const MAX_IMPACTS_PER_SHOT = 2;

/** Every sound a weapon plays: its shot, its second trigger's, its reload, its pump or bolt, its own blast and hit; and a throwable's blast. */
export function weaponSoundIds(): Set<string> {
  const out = new Set<string>();
  for (const def of Object.values(CORE_WEAPONS)) {
    out.add(def.view.sound ?? `fire.${def.id.replace(/^core\./, '')}`);
    if (def.view.altShot?.sound) out.add(def.view.altShot.sound);
    if (def.view.reloadSound) out.add(def.view.reloadSound);
    if (def.view.cycle?.sound) out.add(def.view.cycle.sound);
    if (def.view.explosionSound) out.add(def.view.explosionSound);
    if (def.view.impactSound) out.add(def.view.impactSound);
  }
  for (const t of Object.values(THROWABLE_DEFS)) if (t.explosionSound) out.add(t.explosionSound);
  return out;
}

/**
 * The blast sound of what blew up (`weapon`: a weapon's id, or a throwable's `core.<kind>`): its own (the Weapon
 * Manager's Explosion pick), else the shared one.
 */
export function explosionSoundOf(weapon: string | undefined): SoundId {
  if (!weapon) return 'explosion';
  const own = CORE_WEAPONS[weapon]?.view.explosionSound ?? THROWABLE_DEFS[weapon.replace(/^core\./, '') as ThrowableKind]?.explosionSound;
  return (own ?? 'explosion') as SoundId;
}

/** A weapon's own hit sound (the Weapon Manager's Impact pick), layered on the struck surface's; none by default. */
export const impactSoundOf = (weapon: string): SoundId | null => (CORE_WEAPONS[weapon]?.view.impactSound as SoundId | undefined) ?? null;
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

/** A round passing within this of your head (metres) whizzes by. */
const FLYBY_NEAR = 1.6;
/** ...and only once it is this far from the gun (the report covers a round that close). */
const FLYBY_FROM_GUN = 4;

/**
 * Where a round from `from` to `to` passes closest to `ear`, when that is near enough to whizz by (FLYBY_NEAR) and far
 * enough from the gun (FLYBY_FROM_GUN) and short of where it struck; else null.
 */
export function flybyPoint(from: Vec3, to: Vec3, ear: Vec3): Vec3 | null {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 < 1e-6) return null;
  const t = ((ear.x - from.x) * dx + (ear.y - from.y) * dy + (ear.z - from.z) * dz) / len2;
  if (t <= 0 || t >= 1) return null;
  const p = { x: from.x + dx * t, y: from.y + dy * t, z: from.z + dz * t };
  if (Math.hypot(p.x - ear.x, p.y - ear.y, p.z - ear.z) > FLYBY_NEAR) return null;
  if (Math.sqrt(len2) * t < FLYBY_FROM_GUN) return null;
  return p;
}

export class SessionAudio {
  private readonly pickupAt = new Map<string, Vec3>();
  private entities: MapDocument['entities'] = [];
  private doc: MapDocument | null = null;
  private readonly strides = new Map<number, { x: number; z: number; acc: number }>();
  private localStride = 0;
  private wasGrounded = true;
  private fallSpeed = 0;
  private prevReload = 0;
  /** The second gun's reload (a pair), as `prevReload`. */
  private prevReload2 = 0;
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
  /** Recent blasts (who, with what, when; `key` tells them apart), for the announcer's explosive kills. */
  private blasts: { s: number; w: string; at: number; key: string }[] = [];
  private blastCount = 0;
  /** Breakthrough: the team attacking this round. */
  private btAttackers: string | null = null;
  /** The announcer's "3, 2, 1, FIGHT!" is under way (the countdown's beeps give way). */
  private countingDown = false;

  /** The owner's announcer (audio/announcer.ts): lines on match flow, objectives and your kills. */
  readonly announcer: Announcer;

  /** A player's look (the roster's, or this life's): "blew up a dog" asks if it is an animal. */
  lookOf: (slot: number) => string | undefined = () => undefined;

  /** Your own position (the predicted one), for a kill's distance. */
  myPos: () => Vec3 | undefined = () => undefined;

  /** At the match's end: whether you top the board (most kills, nobody level with you). */
  topScorer: () => boolean = () => false;

  /** Bomb mode: the attacking team (the mode's first), else null. */
  bombAttackers: () => string | null = () => null;

  /** The low-health warning's heartbeat (lowHealth.ts): louder as it gets worse, never loud. */
  heartbeat(level: number): void {
    this.audio.play('ui.heartbeat', { gain: 0.45 + 0.55 * Math.max(0, Math.min(1, level)) });
  }

  /** Whether a block (entity index) is up: force fields only hum while they stand. */
  blockPresent: (i: number) => boolean = () => true;

  /** Your team in team modes (null otherwise), for objective and round announcements. */
  myTeam: () => string | null = () => null;

  /**
   * The sound of a round from `from` landing at `to` in the level: its surface type's sound family (game/fxMap.ts
   * impactSoundId; the session asks the view what it struck). Default: the one generic impact.
   */
  worldImpact: (from: Vec3, to: Vec3) => SoundId | null = () => 'impact.world';

  /**
   * The footstep for feet at `at`: the recorded steps of the surface under them (game/fxMap.ts footstepSoundId; the
   * session asks the view what is underfoot, from the map on this machine, so nothing is sent). Default: the plain one.
   */
  stepSound: (at: Vec3) => SoundId = () => 'footstep';

  /** Whether a kill of this victim makes the wet splat: blood is shown (the map's setting and the player's) and the victim's blood is a liquid (not bone dust or a wisp). */
  bloodOn: (victim: number) => boolean = () => true;

  constructor(
    private readonly audio: AudioSystem,
    private readonly localSlot: () => number,
  ) {
    this.announcer = new Announcer(
      {
        speak: (line) => audio.speak(line),
        sound: (id) => {
          const secs = audio.duration(id);
          if (secs !== null) audio.play(id, { announcer: true });
          return secs;
        },
      },
      localSlot,
    );
    // Its lines load once the game's sounds are in, when the page is idle (never on the match's way in).
    if (typeof audio.onUnlock === 'function') loadVoiceLines(audio);
    // The weapons' own sounds that are picker-only alternates (content/sounds.json `lazy`, the Weapon Manager's picks)
    // load with the game's sounds; the rest of the picker's library never loads in a match.
    if (typeof audio.want === 'function') audio.want(weaponSoundIds());
  }

  /** Every frame: the announcer says what's waiting once the last line is done. */
  tick(now: number): void {
    this.announcer.update(now / 1000);
  }

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

  /**
   * One tick of the start countdown (`secondsLeft`), or the "Go!" when it ends. At 3 the announcer's "3, 2, 1,
   * FIGHT!" starts (its FIGHT on the Go), and the beeps under it stop; without it, the old "Fight!" on the Go.
   */
  countdownBeep(go: boolean, secondsLeft = 0, now = performance.now()): void {
    if (go) {
      this.countingDown = false;
      this.announcer.started(now / 1000);
      return;
    }
    if (this.announcer.countdown(secondsLeft, now / 1000)) this.countingDown = true;
    if (!this.countingDown) this.audio.play('message');
  }

  /** A shot the local player just fired (predicted); `delay`: seconds to wait, its tick's place in a slow frame (shotDelay). */
  localShot(def: WeaponDefinition, alt = false, delay = 0, pan = 0): void {
    const own = alt ? def.view.altShot : undefined;
    if (own) this.audio.play(own.sound as SoundId, { rate: own.rate ?? 1, gain: 1.15, delay });
    // (`pan`: a pair's guns sound a little to their own side, pairView.ts gunPan; one gun's stays in the middle.)
    else this.audio.play(alt && def.alt?.kind === 'projectile' && def.alt.ammo === 'own' ? 'fire.launcher' : fireSound(def.id), pan ? { delay, pan } : { delay });
    // A pump gun's pump, worked after the shot (its `view.cycle`).
    const cycle = def.view.cycle;
    if (cycle) this.audio.play(cycle.sound as SoundId, pan ? { delay: delay + cycle.at, pan } : { delay: delay + cycle.at });
  }

  /** A moment of play read off movement (gameplayFxWatch.ts): a jump pad throwing someone sounds its launch. */
  gameplayMoment(key: string, at: Vec3): void {
    if (key === 'pad') this.audio.play('pad.launch', { at });
  }

  /** Your own punch or kick: a swish as you throw it. */
  localStrike(): void {
    this.audio.play('fire.knife', { gain: 0.6 });
  }

  /** The selector clicked over to another fire mode: the magazine's metal click, quieter and higher (a small part). */
  fireModeClick(): void {
    this.audio.play('reload.start', { gain: 0.45, rate: 1.4 });
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
        this.audio.play(this.stepSound(s.pos), { gain: 0.7 });
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
      // A pair's reloads sound from their own hands (the second gun's a little left, the first's a little right).
      const pan = local.paired ? { pan: gunPan(true, 'right') } : {};
      // A weapon's own reload sound (its `view.reloadSound`, the Weapon Manager), else every weapon's.
      const reload = (weaponByCode(local.held)?.view.reloadSound ?? 'reload.start') as SoundId;
      if (local.reloadTicks > 0 && this.prevReload === 0) this.audio.play(reload, pan);
      if (local.reloadTicks === 0 && this.prevReload > 0 && local.held === this.prevHeld) this.audio.play('reload.end', pan);
      const second = local.paired ? local.reloadTicks2 : 0;
      if (second > 0 && this.prevReload2 === 0) this.audio.play(reload, { pan: gunPan(true, 'left') });
      if (second === 0 && this.prevReload2 > 0 && local.paired && local.held === this.prevHeld) this.audio.play('reload.end', { pan: gunPan(true, 'left') });
    }
    this.prevHeld = local.alive ? local.held : 0;
    this.prevReload = local.alive ? local.reloadTicks : 0;
    this.prevReload2 = local.alive && local.paired ? local.reloadTicks2 : 0;
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
        const at = { x: p.x, y: p.y, z: p.z };
        this.audio.play(this.stepSound(at), { at, by: p.slot });
      }
    }
  }

  /** Server events. `poses` gives remote positions for events that carry none. */
  /** Whether a player is under spawn protection now (set by the session): your hits on them ping off the shield. */
  shielded?: (slot: number) => boolean;

  /** Your hit, by sound (GUNPLAY_SPEC §21): a bright ding for the head, a dull clank for armor, a ping off a shield, the tick for flesh. */
  private hitSound(hits: readonly (number | null)[], zones: readonly number[] | undefined, armor: boolean): void {
    if (!hits.some((h) => h !== null && h !== undefined)) return;
    // A spawn-protected target's shield took it: a high, thin ping (the armour clank pitched up and softer).
    if (this.shielded && hits.every((h) => h === null || h === undefined || this.shielded!(h))) {
      this.audio.play('ui.hit.armor', { rate: 1.7, gain: 0.7 });
      return;
    }
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
        if (!mine && own) this.audio.play(own.sound as SoundId, { at: tuple(ev.from), rate: own.rate ?? 1, gain: 1.15, by: ev.s, caption: 'fire.shot' });
        else if (!mine) this.audio.play(altLaunch ? 'fire.launcher' : fireSound(ev.w), { at: tuple(ev.from), by: ev.s, caption: 'fire.shot' });
        const cycle = getWeapon(ev.w).view.cycle;
        if (!mine && cycle) this.audio.play(cycle.sound as SoundId, { at: tuple(ev.from), delay: cycle.at, by: ev.s, caption: 'fire.cycle' });
        // A round that passes close by your head (not yours, not one that hit you) whizzes past: one per shot.
        const ear = mine ? undefined : poseOf(me);
        if (ear) {
          for (let i = 0; i < ev.to.length; i++) {
            if (ev.hit[i] === me) continue;
            const by = flybyPoint(tuple(ev.from), tuple(ev.to[i]!), ear);
            if (by) {
              this.audio.play('bullet.flyby', { at: by });
              break;
            }
          }
        }
        let impacts = 0;
        // The weapon's own hit sound (none unless picked), on top of the surface's.
        const ownHit = impactSoundOf(ev.w);
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
          if (ownHit) this.audio.play(ownHit, { at: tuple(to) });
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
          const ownHit = impactSoundOf(ev.w);
          if (ownHit) this.audio.play(ownHit, { at: tuple(ev.to) });
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
        if (ev.w) {
          this.blasts = [...this.blasts.filter((b) => now - b.at < BLAST_KILL_MS), { s: ev.s, w: ev.w, at: now, key: `b${++this.blastCount}` }];
        }
        // A vehicle going up: a deeper, longer boom under the usual crack, and metal raining down.
        if (ev.m !== undefined) this.audio.play('explosion.vehicle', { at });
        this.audio.play(explosionSoundOf(ev.w), { at });
        this.audio.play('explosion.debris', { at });
        if (ev.m !== undefined) this.audio.play('vehicle.crash', { at, gain: 0.7 });
        break;
      }
      case 'ice': {
        // A freeze blast: the ice cracking shut round them; when they die in it, the block breaking. A melt is quiet.
        const at = ev.s === me ? undefined : tuple(ev.p);
        if (ev.on) this.audio.play('glass.crack', { at, gain: 0.8 });
        else if (ev.x) this.audio.play('break.glass', { at, gain: 0.6 });
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
        if (at && this.bloodOn(ev.victim)) this.audio.play('blood.splat', { at });
        // A team kill: the death sounds only, no kill confirmation.
        if (ev.killer === me && ev.victim !== me && !ev.tk) {
          const t = now / 1000;
          this.recentKills = [...this.recentKills.filter((k) => t - k < MULTI_KILL_WINDOW), t];
          // Crunchy kill confirmation (GUNPLAY_SPEC §22): short, and each kill in a row climbs a step, so a multi-kill is a rhythm.
          const step = Math.min(4, this.recentKills.length) - 1;
          this.audio.play('ui.kill.confirm', { rate: 1 + step * 0.12 });
          this.audio.play('ui.kill', { rate: 1 + step * 0.122, gain: 0.8 });
        }
        this.announceKill(ev, poses, now);
        break;
      }
      case 'round_end': {
        const t = now / 1000;
        if (ev.team !== undefined) this.announcer.sound(ev.team === null ? 'announce.tie' : ev.team === this.myTeam() ? 'announce.win' : 'announce.lose', 'flow', t, 'result');
        else this.announcer.sound(ev.winner === null ? 'announce.tie' : ev.winner === me ? 'announce.win' : 'announce.lose', 'flow', t, 'result');
        this.announcer.matchOver(this.topScorer(), !!(ev.next || ev.up), t + 0.001);
        break;
      }
      // Objective modes: existing cues, chosen by whether it is good or bad news for your team.
      case 'flag': {
        const ours = ev.team === this.myTeam();
        if (ev.a === 'take') this.audio.play(ours ? 'cue.alarm' : ev.s === me ? 'pickup.powerup' : 'objective.new');
        else if (ev.a === 'drop') this.audio.play('message');
        else if (ev.a === 'return') this.audio.play('cue.chime');
        else this.audio.play(ours ? 'cue.buzzer' : 'objective.complete');
        this.announcer.flag(ev.a, now / 1000);
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
        if (ev.a === 'plant' || ev.a === 'defuse') this.announcer.bomb(ev.a, now / 1000);
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
        // A round's end by side (`team`: the winners), "Attackers win" or "Defenders win"; the start, "3, 2, 1, FIGHT!".
        else if (ev.a === 'round') this.announcer.sideWon(ev.team === this.btAttackers, now / 1000);
        else if (ev.a === 'start') {
          this.btAttackers = ev.team ?? null;
          this.announcer.started(now / 1000);
        }
        else if (ev.a === 'pool' && ours) this.audio.play('cue.alarm');
        if (ev.a === 'plant' || ev.a === 'defuse') this.announcer.bomb(ev.a, now / 1000);
        break;
      }
      case 'elim': {
        const t = now / 1000;
        const attackers = this.bombAttackers();
        if (ev.a === 'start') this.announcer.started(t);
        // Bomb mode's rounds by side; Elimination's by your team.
        else if (attackers && ev.team !== null) this.announcer.sideWon(ev.team === attackers, t);
        else this.announcer.sound(ev.team === null ? 'announce.tie' : ev.team === this.myTeam() ? 'announce.win' : 'announce.lose', 'flow', t, 'round');
        break;
      }
      case 'round_start':
        this.recentKills = [];
        this.announcer.started(now / 1000);
        break;
      case 'rl':
        if (ev.a === 'jackpot' && ev.s === me) this.announcer.jackpot(now / 1000);
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
        else if (at) this.audio.play('throw', { at, by: ev.s });
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

  /** A kill for the announcer: yours (multi-kills, streaks, special kills), your death, and everyone's streaks. */
  private announceKill(ev: Extract<GameEvent, { e: 'kill' }>, poses: () => readonly RemotePose[], now: number): void {
    const me = this.localSlot();
    const mine = ev.killer === me && ev.victim !== me;
    let distance: number | null = null;
    let blast: string | null = null;
    if (mine) {
      const from = this.myPos();
      const p = poses().find((q) => q.slot === ev.victim);
      if (from && p) distance = Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
      blast = this.blasts.find((b) => b.s === ev.killer && b.w === ev.weapon && now - b.at < BLAST_KILL_MS)?.key ?? null;
    }
    const melee = ev.weapon === UNARMED.punch.id || ev.weapon === UNARMED.kick.id || CORE_WEAPONS[ev.weapon]?.kind === 'melee';
    this.announcer.kill(
      { killer: ev.killer, victim: ev.victim, tk: !!ev.tk, headshot: !!ev.hs, distance, melee, explosive: blast !== null, blast, victimAnimal: mine && lookGroup(this.lookOf(ev.victim)) === 'animals' },
      now / 1000,
    );
  }

  private entityAt(i: number, lift: number): Vec3 | undefined {
    const e = this.entities[i];
    return e && { x: e.position[0], y: e.position[1] + lift, z: e.position[2] };
  }
}
