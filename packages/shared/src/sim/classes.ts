/**
 * Classes (Team Fortress-style): a match setting (`MatchRules.classes`) for
 * any mode with weapons. Everyone plays one of nine classes, each with its
 * own loadout, health, speed and, for some, an ability on G (in place of a
 * grenade). Players pick on the class screen (keys 1-9) when they join and
 * whenever they are down; bots take whatever their team is short of.
 *
 * The match calls this at a few hook points (spawn, inputs, damage, step,
 * snapshots, bots); everything a class does lives here.
 */
import type { Faction } from '../map/schema.ts';
import { horizontalDistance, lookAngles, type Vec3 } from '../math.ts';
import { FX_CLOAK, FX_OVERCHARGE, type GameEvent, type PrivateState } from '../protocol.ts';
import { PLAYER, TICK_RATE } from './constants.ts';
import type { Combatant } from './match.ts';
import { BUTTON_ALT, BUTTON_FIRE, BUTTON_THROW, type PlayerInput } from './movement.ts';
import { restrictedWeapons, type MatchRules } from './rules.ts';
import { getWeapon, weaponCode, type ThrowableKind } from './weapons.ts';

export const CLASS_IDS = ['runner', 'rocketeer', 'torch', 'breacher', 'bulwark', 'mechanic', 'medic', 'marksman', 'shade'] as const;
export type ClassId = (typeof CLASS_IDS)[number];
export type ClassAbility = 'sentry' | 'overcharge' | 'cloak';

export interface ClassDef {
  id: ClassId;
  name: string;
  /** One line for the class screen. */
  blurb: string;
  role: 'Offence' | 'Defence' | 'Support';
  health: number;
  /** Movement multiplier. */
  speed: number;
  /** Extra jumps in the air (double jump). */
  airJumps?: number;
  /** Weapons it spawns with; the last one is held. */
  weapons: string[];
  throwable?: { kind: ThrowableKind; count: number };
  /** What G does (instead of throwing a grenade). */
  ability?: ClassAbility;
  /** Knife hits from behind kill outright. */
  backstab?: boolean;
}

export const CLASS_DEFS: Readonly<Record<ClassId, ClassDef>> = {
  runner: { id: 'runner', name: 'Runner', role: 'Offence', blurb: 'Fastest on foot, double jump, a sawed-off up close. Fragile.', health: 75, speed: 1.3, airJumps: 1, weapons: ['core.knife', 'core.machine_pistol', 'core.sawed_off'] },
  rocketeer: { id: 'rocketeer', name: 'Rocketeer', role: 'Offence', blurb: 'Blast rockets: fire one at your feet to rocket-jump.', health: 130, speed: 0.86, weapons: ['core.knife', 'core.shotgun', 'core.blast_rockets'], throwable: { kind: 'frag', count: 1 } },
  torch: { id: 'torch', name: 'Torch', role: 'Offence', blurb: 'Flamethrower up close; the oil slicker lays slick, flammable puddles.', health: 115, speed: 1, weapons: ['core.knife', 'core.shotgun', 'core.oil_slicker', 'core.flamethrower'] },
  breacher: { id: 'breacher', name: 'Breacher', role: 'Defence', blurb: 'Grenade launcher and three proximity mines to lock down a route.', health: 115, speed: 0.93, weapons: ['core.knife', 'core.pistol', 'core.launcher'], throwable: { kind: 'mine', count: 3 } },
  bulwark: { id: 'bulwark', name: 'Bulwark', role: 'Defence', blurb: 'Huge health, slow, and a spin gun that shreds once it is turning.', health: 200, speed: 0.77, weapons: ['core.knife', 'core.shotgun', 'core.lmg'] },
  mechanic: { id: 'mechanic', name: 'Mechanic', role: 'Defence', blurb: 'G builds a sentry gun that also heals and restocks teammates beside it.', health: 100, speed: 1, weapons: ['core.knife', 'core.pistol', 'core.shotgun'], ability: 'sentry' },
  medic: { id: 'medic', name: 'Medic', role: 'Support', blurb: 'Medi-beam heals teammates; healing charges an overcharge (G): 6 s untouchable for you and your patient.', health: 100, speed: 1.07, weapons: ['core.knife', 'core.nailgun', 'core.medi_beam'], ability: 'overcharge' },
  marksman: { id: 'marksman', name: 'Marksman', role: 'Support', blurb: 'A charged railgun from long range, an SMG for anyone who gets close.', health: 85, speed: 1, weapons: ['core.knife', 'core.smg', 'core.railgun'] },
  shade: { id: 'shade', name: 'Shade', role: 'Support', blurb: 'G cloaks you (firing breaks it); a knife in the back kills outright.', health: 85, speed: 1.07, weapons: ['core.hand_cannon', 'core.knife'], ability: 'cloak', backstab: true },
};

export const classIndex = (id: ClassId): number => CLASS_IDS.indexOf(id);

/** Whether a match plays with classes: asked for, in a mode with weapons (not co-op, Zombies, Fort Wars or spears/discs only). */
export const classesInPlay = (rules: MatchRules): boolean => !!rules.classes && !restrictedWeapons(rules) && rules.mode !== 'core.coop' && rules.mode !== 'core.zombies' && rules.mode !== 'core.forts';

/** `PlayerInput.say` values from CLASS_SAY_BASE pick a class (CLASS_IDS order): the class screen sends them. */
export const CLASS_SAY_BASE = 200;
export const classSay = (id: ClassId): number => CLASS_SAY_BASE + classIndex(id);
export const classFromSay = (say: number | undefined): ClassId | null => (say !== undefined && say >= CLASS_SAY_BASE ? (CLASS_IDS[say - CLASS_SAY_BASE] ?? null) : null);

/** The order bots fill a team: a team of nine has one of each, a team of four a Rocketeer, Medic, Bulwark and Mechanic. */
export const BOT_CLASS_ORDER: readonly ClassId[] = ['rocketeer', 'medic', 'bulwark', 'mechanic', 'runner', 'torch', 'breacher', 'marksman', 'shade'];

/** May one more player on a side take this class (under the per-team limit)? `taken` is the side's other players' classes. */
export function classOpen(id: ClassId, taken: readonly ClassId[], limit: number | undefined): boolean {
  return !limit || taken.filter((c) => c === id).length < limit;
}

/** The class a bot takes: the one its side has fewest of (in BOT_CLASS_ORDER), within the limit. */
export function pickBotClass(taken: readonly ClassId[], limit: number | undefined): ClassId {
  let best: ClassId = BOT_CLASS_ORDER[0]!;
  let fewest = Infinity;
  for (const id of BOT_CLASS_ORDER) {
    const n = taken.filter((c) => c === id).length;
    if (n < fewest && classOpen(id, taken, limit)) {
      fewest = n;
      best = id;
    }
  }
  return best;
}

/** A player's class: what they play now, what they asked for next, and their ability's state. */
export interface ClassState {
  id: ClassId;
  next?: ClassId;
  /** Ability 0..1: sentry readiness, overcharge, cloak energy. */
  charge: number;
  /** Cloaked, or overcharged, until this tick (0: not). */
  activeUntil: number;
  /** Medic: the teammate last healed (overcharge shares with them). */
  patient?: number;
  spawnTick: number;
  /** Where they spawned: changing class while still standing there swaps at once. */
  spawnPos?: Vec3;
  /** No ability use before this tick (presses don't flap). */
  readyAt: number;
}

export interface ClassHost {
  readonly tick: number;
  readonly rules: MatchRules;
  readonly teams: readonly Faction[] | null;
  combatants(): Combatant[];
  hostile(a: Combatant, b: Combatant): boolean;
  emit(ev: GameEvent): void;
  /** Height of the floor under a point (within a few metres), or null over a drop. */
  groundBelow(p: Vec3): number | null;
  lineOfSight(a: Vec3, b: Vec3): boolean;
  /** Build `c`'s sentry (moving the old one): false when there is no room. */
  buildSentry(c: Combatant, at: Vec3, yaw: number): boolean;
  /** Where `slot`'s sentry stands, or null when they have none standing. */
  sentryOf(slot: number): Vec3 | null;
  removeSentry(slot: number): void;
}

/** Seconds: a Mechanic's sentry kit comes back after its sentry is destroyed; cloak lasts and recharges; overcharge lasts. */
const SENTRY_REBUILD_SECONDS = 12;
const CLOAK_SECONDS = 9;
const CLOAK_RECHARGE_SECONDS = 10;
const OVERCHARGE_SECONDS = 6;
/** Health a Medic heals to fill the overcharge. */
const OVERCHARGE_HEALING = 300;
/** Changing class this soon after spawning (and before being hurt) swaps the loadout on the spot. */
const SWAP_GRACE_SECONDS = 8;
/** The sentry's dispenser: reach (m), health per second, and a share of each weapon's pickup ammo per second. */
export const DISPENSER = { radius: 3.5, hps: 10, ammo: 0.25 } as const;

export class ClassPlay {
  /** Overcharged players (Medics and their patients): slot -> tick it ends. */
  private readonly overcharged = new Map<number, number>();

  constructor(private readonly host: ClassHost) {}

  def(c: Combatant): ClassDef | null {
    return c.cls ? CLASS_DEFS[c.cls.id] : null;
  }

  /** Classes already taken on `c`'s side (everyone in free-for-all), not counting `c`. */
  private taken(c: Combatant): ClassId[] {
    return this.host
      .combatants()
      .filter((o) => o !== c && o.cls && (this.host.teams ? o.faction === c.faction : true))
      .map((o) => (o.alive ? o.cls!.id : (o.cls!.next ?? o.cls!.id)));
  }

  /** The class screen: take this class now (just spawned and unhurt) or at the next spawn. */
  choose(c: Combatant, id: ClassId): void {
    if (c.npc) return;
    if (!classOpen(id, this.taken(c), this.host.rules.classLimit)) {
      if (c.kind === 'human') this.host.emit({ e: 'msg', text: `${CLASS_DEFS[id].name} is full on your team`, secs: 2 });
      return;
    }
    if (!c.cls) c.cls = { id, charge: 0, activeUntil: 0, spawnTick: this.host.tick, readyAt: 0 };
    c.cls.next = id;
    const atSpawn = !!c.cls.spawnPos && horizontalDistance(c.move.pos, c.cls.spawnPos) < 2.5;
    const fresh = c.alive && (c.hurtAt ?? -1) < c.cls.spawnTick && (atSpawn || this.host.tick - c.cls.spawnTick < SWAP_GRACE_SECONDS * TICK_RATE);
    if (fresh && id !== c.cls.id) this.equip(c, id, false);
  }

  /** At every spawn: take the class asked for (bots and newcomers: what the side is short of) and its loadout. */
  onSpawn(c: Combatant): void {
    if (c.npc) return;
    const taken = this.taken(c);
    let id = c.cls?.next ?? c.cls?.id ?? null;
    if (!id || !classOpen(id, taken, this.host.rules.classLimit)) id = c.kind === 'bot' || !id ? pickBotClass(taken, this.host.rules.classLimit) : id;
    this.equip(c, id, true);
  }

  /** Take a class's loadout; `spawning`: a fresh spawn here (a swap at the spawn keeps the spawn's time and place). */
  private equip(c: Combatant, id: ClassId, spawning: boolean): void {
    const def = CLASS_DEFS[id];
    const was = c.cls?.id;
    if (was === 'mechanic' && id !== 'mechanic') this.host.removeSentry(c.slot);
    const spawnTick = spawning || !c.cls ? this.host.tick : c.cls.spawnTick;
    const spawnPos = spawning || !c.cls?.spawnPos ? { ...c.move.pos } : c.cls.spawnPos;
    c.cls = { id, ...(c.cls?.next ? { next: c.cls.next } : {}), charge: def.ability === 'overcharge' ? 0 : 1, activeUntil: 0, spawnTick, spawnPos, readyAt: 0 };
    // A Mechanic whose sentry still stands has no kit until it goes down.
    if (def.ability === 'sentry' && this.host.sentryOf(c.slot)) c.cls.charge = 0;
    c.weapons = new Map();
    for (const w of def.weapons) {
      const wd = getWeapon(w);
      c.weapons.set(weaponCode(wd), { def: wd, mag: wd.magazine, reserve: wd.reserveMax, alt: wd.alt?.ammo === 'own' ? (wd.alt.max ?? 0) : 0 });
      c.current = weaponCode(wd);
    }
    c.reloadTicks = 0;
    c.raiseTicks = 0;
    c.windup = 0;
    c.burstLeft = 0;
    c.throwable = def.throwable ? { ...def.throwable } : null;
    c.maxHealth = def.health;
    c.health = def.health;
    c.speedMul = 1;
    c.classSpeed = def.speed;
  }

  onLeave(c: Combatant): void {
    this.host.removeSentry(c.slot);
    this.overcharged.delete(c.slot);
  }

  /** A new round: sentries come down, overcharges end. */
  reset(): void {
    for (const c of this.host.combatants()) this.host.removeSentry(c.slot);
    this.overcharged.clear();
  }

  airJumps(c: Combatant): number {
    return this.def(c)?.airJumps ?? 0;
  }

  cloaked(c: Combatant): boolean {
    return !!c.cls && this.def(c)!.ability === 'cloak' && c.cls.activeUntil > this.host.tick;
  }

  isOvercharged(c: Combatant): boolean {
    return (this.overcharged.get(c.slot) ?? 0) > this.host.tick;
  }

  /** G: the class's ability, when it has one (true: G was used for it, so no grenade). */
  useAbility(c: Combatant): boolean {
    const def = this.def(c);
    const st = c.cls;
    if (!def?.ability || !st) return false;
    const tick = this.host.tick;
    if (tick < st.readyAt) return true;
    st.readyAt = tick + Math.round(TICK_RATE * 0.4);
    if (def.ability === 'sentry') {
      if (st.charge < 1 || this.host.sentryOf(c.slot)) return true;
      // On the floor a step and a half ahead, about level with your feet.
      const at = { x: c.move.pos.x + Math.sin(c.yaw) * 1.6, y: c.move.pos.y + 1, z: c.move.pos.z + Math.cos(c.yaw) * 1.6 };
      const floor = this.host.groundBelow(at);
      if (floor === null || Math.abs(floor - c.move.pos.y) > 1.2) return true;
      if (this.host.buildSentry(c, { x: at.x, y: floor, z: at.z }, c.yaw)) {
        st.charge = 0;
        if (c.kind === 'human') this.host.emit({ e: 'msg', text: 'Sentry up', secs: 2 });
      }
      return true;
    }
    if (def.ability === 'cloak') {
      if (this.cloaked(c)) st.activeUntil = 0;
      else if (st.charge > 0.2) st.activeUntil = tick + Math.round(st.charge * CLOAK_SECONDS * TICK_RATE);
      return true;
    }
    // Overcharge: you and the teammate you last healed, if they're still close.
    if (st.charge < 1) return true;
    st.charge = 0;
    const until = tick + OVERCHARGE_SECONDS * TICK_RATE;
    this.overcharged.set(c.slot, until);
    const patient = this.host.combatants().find((o) => o.slot === st.patient);
    if (patient?.alive && horizontalDistance(patient.move.pos, c.move.pos) < 12) this.overcharged.set(patient.slot, until);
    this.host.emit({ e: 'msg', text: `${c.name}: overcharge!`, secs: 2 });
    return true;
  }

  /** Damage after class rules: nothing gets through an overcharge; a Shade's knife in the back kills. */
  adjustDamage(victim: Combatant, attacker: Combatant | null, weapon: string, amount: number): number {
    if (this.isOvercharged(victim)) return 0;
    if (attacker && attacker !== victim && weapon === 'core.knife' && this.def(attacker)?.backstab) {
      // Behind: the attacker stands within 60° of straight behind the victim's facing.
      const fx = Math.sin(victim.yaw);
      const fz = Math.cos(victim.yaw);
      const dx = victim.move.pos.x - attacker.move.pos.x;
      const dz = victim.move.pos.z - attacker.move.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if ((fx * dx + fz * dz) / d > 0.5) return Math.max(amount, victim.health + victim.armor * 3 + 1);
    }
    return amount;
  }

  /** Once per tick while playing: recharge, cloak drain, the sentries' dispensers. */
  step(): void {
    const tick = this.host.tick;
    const all = this.host.combatants();
    for (const c of all) {
      const st = c.cls;
      if (!st || !c.alive) continue;
      const ability = CLASS_DEFS[st.id].ability;
      if (ability === 'sentry' && st.charge < 1 && !this.host.sentryOf(c.slot)) st.charge = Math.min(1, st.charge + 1 / (SENTRY_REBUILD_SECONDS * TICK_RATE));
      if (ability === 'cloak') {
        if (st.activeUntil > tick) {
          // Firing gives you away.
          if (c.prevButtons & (BUTTON_FIRE | BUTTON_ALT)) st.activeUntil = 0;
          else st.charge = Math.max(0, st.charge - 1 / (CLOAK_SECONDS * TICK_RATE));
        } else st.charge = Math.min(1, st.charge + 1 / (CLOAK_RECHARGE_SECONDS * TICK_RATE));
      }
    }
    for (const [slot, until] of this.overcharged) if (until <= tick) this.overcharged.delete(slot);
    // Sentries double as dispensers: health every tick, ammo every second, to the builder's side close by.
    const ammoTick = tick % TICK_RATE === 0;
    for (const owner of all) {
      if (owner.cls?.id !== 'mechanic') continue;
      const at = this.host.sentryOf(owner.slot);
      if (!at) continue;
      for (const c of all) {
        if (!c.alive || (c !== owner && this.host.hostile(owner, c)) || horizontalDistance(c.move.pos, at) > DISPENSER.radius || Math.abs(c.move.pos.y - at.y) > 2) continue;
        if (c.health < c.maxHealth) c.health = Math.min(c.maxHealth, c.health + DISPENSER.hps / TICK_RATE);
        if (ammoTick) for (const w of c.weapons.values()) if (w.def.magazine > 0 && w.reserve < w.def.reserveMax) w.reserve = Math.min(w.def.reserveMax, w.reserve + Math.max(1, Math.round(w.def.pickupAmmo * DISPENSER.ammo)));
      }
    }
  }

  /** After each tick: Medics' healing fills their overcharge. */
  events(events: readonly GameEvent[]): void {
    for (const ev of events) {
      if (ev.e !== 'heal' || ev.s === ev.t) continue;
      const medic = this.host.combatants().find((c) => c.slot === ev.s);
      if (!medic?.cls || CLASS_DEFS[medic.cls.id].ability !== 'overcharge') continue;
      medic.cls.charge = Math.min(1, medic.cls.charge + ev.n / OVERCHARGE_HEALING);
      medic.cls.patient = ev.t;
    }
  }

  /** Snapshot status bits (FX_CLOAK, FX_OVERCHARGE). */
  fx(c: Combatant): number {
    return (this.cloaked(c) ? FX_CLOAK : 0) | (this.isOvercharged(c) ? FX_OVERCHARGE : 0);
  }

  privateState(c: Combatant): Pick<PrivateState, 'cl'> {
    const st = c.cls;
    if (!st) return {};
    const active = this.cloaked(c) || this.isOvercharged(c) ? 1 : 0;
    return { cl: [classIndex(st.id), classIndex(st.next ?? st.id), Math.round(st.charge * 100), active, (c.move.airJumps ?? 0) + (c.move.jumpHeld ? 4 : 0)] };
  }

  // ---------------------------------------------------------------- bots

  /**
   * Where a bot goes: Medics stay with the teammate who needs them most;
   * Mechanics hold the objective (or their sentry); everyone else plays the mode.
   */
  botGoal(c: Combatant, goal: { pos: Vec3; radius: number } | null): { pos: Vec3; radius: number } | null {
    const id = c.cls?.id;
    if (id === 'medic') {
      const patient = this.bestPatient(c, 60);
      if (patient) return { pos: patient.move.pos, radius: 3 };
    }
    if (id === 'mechanic' && !goal) {
      const sentry = this.host.sentryOf(c.slot);
      if (sentry) return { pos: sentry, radius: 6 };
    }
    return goal;
  }

  /** The teammate a Medic should be with: the most hurt within `range` m, else the nearest who isn't a Medic. */
  private bestPatient(c: Combatant, range: number): Combatant | null {
    let best: Combatant | null = null;
    let bestScore = Infinity;
    for (const o of this.host.combatants()) {
      // Free-for-all has no teammates to heal.
      if (!this.host.teams || o === c || !o.alive || o.npc || o.faction !== c.faction) continue;
      const d = horizontalDistance(o.move.pos, c.move.pos);
      if (d > range) continue;
      const hurt = o.health / o.maxHealth;
      const score = d / range + hurt * 2 + (o.cls?.id === 'medic' ? 3 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }

  /**
   * Class play on top of a bot's own input: Mechanics build at the objective,
   * Medics beam hurt teammates (and overcharge when it counts), Shades cloak
   * while they move in.
   */
  botInput(c: Combatant, input: PlayerInput, goal: { pos: Vec3; radius: number } | null): void {
    const st = c.cls;
    if (!st || !c.alive || !c.bot || c.mount) return;
    const state = c.bot.state;
    const fighting = state === 'engage' || state === 'cover';
    switch (st.id) {
      case 'mechanic': {
        // At the objective, in a fight, or once it has been on its way a while: anywhere is better than nowhere.
        const near = !goal || horizontalDistance(goal.pos, c.move.pos) < goal.radius + 8;
        const alive = this.host.tick - st.spawnTick;
        if (st.charge >= 1 && !this.host.sentryOf(c.slot) && c.move.grounded && alive > TICK_RATE * 2 && (near || fighting || alive > TICK_RATE * 10)) input.buttons |= BUTTON_THROW;
        break;
      }
      case 'medic': {
        if (st.charge >= 1 && (fighting || c.health < c.maxHealth * 0.5)) input.buttons |= BUTTON_THROW;
        const patient = this.bestPatient(c, 9);
        if (!patient || patient.health >= patient.maxHealth || (fighting && patient.health > patient.maxHealth * 0.5)) break;
        const eye = { x: c.move.pos.x, y: c.move.pos.y + PLAYER.eyeHeight * c.size, z: c.move.pos.z };
        const chest = { x: patient.move.pos.x, y: patient.move.pos.y + PLAYER.height * 0.55 * patient.size, z: patient.move.pos.z };
        if (!this.host.lineOfSight(eye, chest)) break;
        const aim = lookAngles(eye, chest);
        input.yaw = aim.yaw;
        input.pitch = aim.pitch;
        input.weapon = weaponCode(getWeapon('core.medi_beam'));
        input.buttons = (input.buttons & ~BUTTON_ALT) | BUTTON_FIRE;
        break;
      }
      case 'shade':
        if (!this.cloaked(c) && st.charge >= 0.9 && (state === 'roam' || state === 'advance' || state === 'chase' || state === 'investigate')) input.buttons |= BUTTON_THROW;
        break;
    }
  }
}
