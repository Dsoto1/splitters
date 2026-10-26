import type RAPIER from '@dimforge/rapier3d-compat';
import type { WorldBox } from '../../map/geometry.ts';
import { viewDirection, type Vec3 } from '../../math.ts';
import type { ModeSnapshot } from '../../protocol.ts';
import { TICK_RATE } from '../constants.ts';
import {
  BUILDER_WEAPON,
  FORT_BARRIER_HALF,
  FORT_BLAST_SCALE,
  FORT_BUILD,
  FORT_BULLET_SCALE,
  FORT_COMBAT,
  FORT_FLAG_CLEARANCE,
  FORT_MAX_PIECES,
  FORT_PIECES,
  FORT_PIECE_KINDS,
  FORT_REACH,
  FORT_SPAWN_CLEARANCE,
  fortAimPlacement,
  fortBounds,
  fortFlagBases,
  fortMidfield,
  fortPieceBoxes,
  fortPlacementProblem,
  type FortPieceKind,
  type FortPieceState,
  type FortWorld,
} from '../forts.ts';
import type { Combatant } from '../match.ts';
import { BUTTON_ALT, BUTTON_FIRE, BUTTON_RELOAD, BUTTON_ZOOM, eyeHeightOf, type PlayerInput } from '../movement.ts';
import { getWeapon, weaponCode } from '../weapons.ts';
import { CtfMode } from './ctf.ts';
import { FortBots } from './fortsBots.ts';
import type { BotGoal, ModeHost, ModeLogic } from './types.ts';

/** A piece on the server: its state, health and colliders. */
export interface FortPieceRt extends FortPieceState {
  health: number;
  max: number;
  colliders: RAPIER.Collider[];
  /** Slot of whoever placed it (-1 for none). */
  by: number;
}

/**
 * Fort Wars (SourceForts-style) over any Capture the Flag map. Each cycle
 * opens with a build phase: a force field splits the map down the middle,
 * nobody can hurt anybody, and everyone holds the Builder, spending their
 * team's build points on pieces round their flag (placed on a 0.5 m grid,
 * only on their own half, never into a player, a spawn point or a flag;
 * their own pieces can be picked up again for a full refund). Then the field
 * drops and it's Capture the Flag: pieces can be shot (bullets chip them,
 * explosives smash them). After the last combat phase the match ends; the
 * score is the captures.
 */
export class FortsMode implements ModeLogic {
  readonly ctf: CtfMode;
  phase = FORT_BUILD;
  cycle = 1;
  phaseEnd = 0;
  readonly pieces: FortPieceRt[] = [];
  readonly bases: [Vec3, Vec3];
  readonly midfield: ReturnType<typeof fortMidfield>;
  readonly bots: FortBots;
  private readonly byHandle = new Map<number, FortPieceRt>();
  private barrier: RAPIER.Collider | null = null;
  /** The bots' navmesh was rebuilt with the forts in at the start of combat (small maps only). */
  navRebuilt = false;
  private nextId = 1;
  private version = 0;
  private sentVersion = -1;
  private snapshots = 0;
  private healthDirty = false;
  private healthSent = 0;
  private readonly prevButtons = new Map<number, number>();

  constructor(readonly host: ModeHost) {
    this.ctf = new CtfMode(host);
    this.bases = fortFlagBases(host.map, host.teams) ?? [{ ...this.ctf.flags[0]!.base }, { ...this.ctf.flags[1]!.base }];
    this.midfield = fortMidfield(this.bases[0], this.bases[1]);
    this.bots = new FortBots(this, host);
    this.reset();
  }

  get buildTicks(): number {
    return Math.round(Math.max(10, this.host.rules.fortBuildSeconds ?? 150) * TICK_RATE);
  }

  get combatTicks(): number {
    return Math.round(Math.max(10, this.host.rules.fortCombatSeconds ?? 300) * TICK_RATE);
  }

  get cycles(): number {
    return Math.max(1, Math.round(this.host.rules.fortCycles ?? 1));
  }

  get budget(): number {
    return Math.max(0, Math.round(this.host.rules.fortBudget ?? 120));
  }

  /** Team index (0, 1) of a faction, -1 for anyone else. */
  teamIndex(faction: string | null): number {
    return faction === null ? -1 : this.host.teams.slice(0, 2).findIndex((t) => t.id === faction);
  }

  /** Build points a team has left: its budget less what it has standing. */
  pointsLeft(team: number): number {
    return this.budget - this.pieces.filter((p) => p.team === team).reduce((n, p) => n + FORT_PIECES[p.kind].cost, 0);
  }

  count(team: number): number {
    return this.pieces.filter((p) => p.team === team).length;
  }

  reset(): void {
    for (const p of [...this.pieces]) this.removePiece(p);
    this.cycle = 1;
    this.ctf.reset();
    this.startBuild(false);
  }

  // ---------------------------------------------------------------- phases

  private startBuild(respawn: boolean): void {
    this.phase = FORT_BUILD;
    this.phaseEnd = this.host.tick + this.buildTicks;
    this.setBarrier(true);
    this.bots.reset();
    this.prevButtons.clear();
    if (respawn) for (const c of this.host.combatants()) this.host.respawn(c);
    else for (const c of this.host.combatants()) if (c.alive) this.equipBuilder(c);
    this.host.emit({ e: 'msg', text: `Build phase${this.cycles > 1 ? ` ${this.cycle} of ${this.cycles}` : ''}: fortify your flag!`, secs: 4 });
  }

  private startCombat(): void {
    this.phase = FORT_COMBAT;
    this.phaseEnd = this.host.tick + this.combatTicks;
    this.setBarrier(false);
    this.flagsHome();
    // Bots plan round the forts from now on (pieces only change by breaking in combat).
    this.navRebuilt = this.host.rebuildNav(this.pieces.flatMap((p) => p.boxes.map((b): WorldBox => ({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], kind: 'solid', sourceId: `fort_${p.id}` }))));
    for (const c of this.host.combatants()) this.host.respawn(c);
    this.host.emit({ e: 'msg', text: 'The barrier is down: capture their flag!', secs: 4 });
  }

  private endCombat(): void {
    if (this.cycle >= this.cycles) {
      this.host.endRound();
      return;
    }
    this.cycle++;
    this.flagsHome();
    this.startBuild(true);
  }

  /** Both flags back on their bases (captures kept). */
  private flagsHome(): void {
    const saved = new Map(this.ctf.captures);
    this.ctf.reset();
    for (const [k, v] of saved) this.ctf.captures.set(k, v);
  }

  private setBarrier(on: boolean): void {
    const physics = this.host.physics;
    if (on && !this.barrier) {
      const m = this.midfield;
      this.barrier = physics.createBox(m.mid, FORT_BARRIER_HALF, m.yaw);
    } else if (!on && this.barrier) {
      physics.removeCollider(this.barrier);
      this.barrier = null;
    }
    physics.commit();
  }

  get barrierUp(): boolean {
    return this.barrier !== null;
  }

  step(): void {
    const host = this.host;
    if (this.phase === FORT_BUILD) {
      this.keepToOwnHalves();
      this.bots.build();
      if (host.tick >= this.phaseEnd) this.startCombat();
      return;
    }
    this.ctf.step();
    if (host.tick >= this.phaseEnd) this.endCombat();
  }

  /** Nobody spends the build phase on the other team's half (a spawn there, or slipping round the field's end). */
  private keepToOwnHalves(): void {
    for (const c of this.host.combatants()) {
      const t = this.teamIndex(c.faction);
      if (!c.alive || t < 0 || c.mount) continue;
      if (this.midfield.side(c.move.pos) * (t === 0 ? -1 : 1) > 0.3) continue;
      const home = this.bases[t]!;
      const back = t === 0 ? -1 : 1;
      c.move = { pos: { x: home.x + this.midfield.dir.x * back * 1.5, y: home.y + 0.3, z: home.z + this.midfield.dir.z * back * 1.5 }, velY: 0, grounded: false };
    }
  }

  // ---------------------------------------------------------------- the Builder

  onSpawn(c: Combatant): void {
    if (this.phase === FORT_BUILD) this.equipBuilder(c);
  }

  /** Build phase: the Builder is all anyone holds. */
  private equipBuilder(c: Combatant): void {
    const def = getWeapon(BUILDER_WEAPON);
    const code = weaponCode(def);
    c.weapons = new Map([[code, { def, mag: 0, reserve: 0, alt: 0 }]]);
    c.current = code;
    c.throwable = null;
    c.raiseTicks = 0;
    c.reloadTicks = 0;
  }

  blocksDamage(victim: Combatant, attacker: Combatant | null): boolean {
    return this.phase === FORT_BUILD && attacker !== null && attacker !== victim;
  }

  useInput(c: Combatant, input: PlayerInput): boolean {
    if (c.weapons.get(c.current)?.def.id !== BUILDER_WEAPON) return false;
    const prev = this.prevButtons.get(c.slot) ?? 0;
    this.prevButtons.set(c.slot, input.buttons);
    if (this.phase !== FORT_BUILD) return true;
    const pressed = input.buttons & ~prev;
    const team = this.teamIndex(c.faction);
    if (team < 0 || !(pressed & (BUTTON_FIRE | BUTTON_ALT | BUTTON_ZOOM))) return true;
    const eye = { x: c.move.pos.x, y: c.move.pos.y + eyeHeightOf(c.move, c.size), z: c.move.pos.z };
    const code = input.build ?? 0;
    const kind = FORT_PIECE_KINDS[code & 15] ?? 'block';
    const rot = (code >> 4) & 3;
    if (pressed & BUTTON_FIRE) {
      const base = fortAimPlacement(this.host.physics, eye, c.yaw, c.pitch, kind, rot);
      if (base) this.place(team, kind, rot, base, c.slot);
    } else {
      const hit = this.host.physics.raycastHit(eye, viewDirection(c.yaw, c.pitch), FORT_REACH);
      const p = hit ? this.byHandle.get(hit.handle) : undefined;
      if (p && p.team === team) this.removePiece(p);
    }
    return true;
  }

  /** What placement checks see. */
  world(): FortWorld {
    const keepClear = [
      ...this.bases.map((pos) => ({ pos, r: FORT_FLAG_CLEARANCE })),
      ...this.host.spawnPoints.map((s) => ({ pos: s.pos, r: FORT_SPAWN_CLEARANCE })),
    ];
    return {
      physics: this.host.physics,
      side: this.midfield.side,
      pieces: this.pieces,
      bodies: this.host.combatants().filter((c) => c.alive).map((c) => c.move.pos),
      keepClear,
    };
  }

  /** Why team `team` can't put this piece here right now (null: it can). */
  problem(team: number, kind: FortPieceKind, rot: number, base: Vec3): string | null {
    if (this.phase !== FORT_BUILD) return 'Only in the build phase';
    if (FORT_PIECES[kind].cost > this.pointsLeft(team)) return 'Not enough build points';
    if (this.count(team) >= FORT_MAX_PIECES) return 'Your team has built all it can';
    return fortPlacementProblem(this.world(), team, kind, rot, base);
  }

  /** Place a piece for a team if the rules allow it; returns it, or the reason it can't go there. */
  place(team: number, kind: FortPieceKind, rot: number, base: Vec3, by = -1): FortPieceRt | string {
    const why = this.problem(team, kind, rot, base);
    if (why) return why;
    const def = FORT_PIECES[kind];
    const boxes = fortPieceBoxes(kind, rot, base);
    const physics = this.host.physics;
    const colliders = boxes.map((b) =>
      physics.createBox({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 }, { x: (b.max.x - b.min.x) / 2, y: (b.max.y - b.min.y) / 2, z: (b.max.z - b.min.z) / 2 }),
    );
    physics.commit();
    const p: FortPieceRt = { id: this.nextId++, kind, team, base: { ...base }, rot: ((rot % 4) + 4) % 4, boxes, health: def.health, max: def.health, colliders, by };
    this.pieces.push(p);
    for (const col of colliders) this.byHandle.set(col.handle, p);
    this.version++;
    return p;
  }

  removePiece(p: FortPieceRt): void {
    const i = this.pieces.indexOf(p);
    if (i < 0) return;
    this.pieces.splice(i, 1);
    for (const col of p.colliders) {
      this.byHandle.delete(col.handle);
      this.host.physics.removeCollider(col);
    }
    this.host.physics.commit();
    this.version++;
  }

  pieceByHandle(handle: number): FortPieceRt | undefined {
    return this.byHandle.get(handle);
  }

  // ---------------------------------------------------------------- damage

  /** Combat only; teams don't wreck their own forts (unless friendly fire is on). */
  hurtPiece(p: FortPieceRt, amount: number, attacker: Combatant | null): void {
    if (this.phase !== FORT_COMBAT || amount <= 0 || !this.pieces.includes(p)) return;
    if (attacker && this.teamIndex(attacker.faction) === p.team && (this.host.rules.friendlyFire ?? 'off') === 'off') return;
    p.health -= amount;
    this.healthDirty = true;
    if (p.health <= 0) this.removePiece(p);
  }

  damageBody(handle: number, amount: number, attacker: Combatant | null): boolean {
    const p = this.byHandle.get(handle);
    if (!p) return false;
    this.hurtPiece(p, amount * FORT_BULLET_SCALE[FORT_PIECES[p.kind].tier], attacker);
    return true;
  }

  splash(at: Vec3, radius: number, damage: number, edge: number, attacker: Combatant | null): void {
    if (this.phase !== FORT_COMBAT) return;
    for (const p of [...this.pieces]) {
      const b = fortBounds(p.boxes);
      const dx = Math.max(b.min.x - at.x, 0, at.x - b.max.x);
      const dy = Math.max(b.min.y - at.y, 0, at.y - b.max.y);
      const dz = Math.max(b.min.z - at.z, 0, at.z - b.max.z);
      const d = Math.hypot(dx, dy, dz);
      if (d > radius) continue;
      this.hurtPiece(p, (damage + (edge - damage) * (d / radius)) * FORT_BLAST_SCALE[FORT_PIECES[p.kind].tier], attacker);
    }
  }

  // ---------------------------------------------------------------- CTF and the rest

  onKill(victim: Combatant, killer: Combatant | null): void {
    this.ctf.onKill(victim);
    void killer;
  }

  onLeave(c: Combatant): void {
    this.ctf.onLeave(c);
    this.prevButtons.delete(c.slot);
  }

  teamScores(): Map<string, number> {
    return this.ctf.teamScores();
  }

  snapshot(): ModeSnapshot {
    const md = this.ctf.snapshot();
    const secs = Math.max(0, Math.ceil((this.phaseEnd - this.host.tick) / TICK_RATE));
    md.fo = [this.phase, secs, this.cycle, this.cycles, this.pointsLeft(0), this.pointsLeft(1), this.count(0), this.count(1), this.budget];
    const keyframe = this.snapshots++ % 60 === 0;
    if (keyframe || this.version !== this.sentVersion || (this.healthDirty && this.host.tick - this.healthSent >= TICK_RATE / 2)) {
      const r2 = (v: number) => Math.round(v * 100) / 100;
      md.fp = this.pieces.map((p) => [p.id, FORT_PIECE_KINDS.indexOf(p.kind), p.team, r2(p.base.x), r2(p.base.y), r2(p.base.z), p.rot, Math.ceil((Math.max(0, p.health) / p.max) * 100)]);
      this.sentVersion = this.version;
      this.healthDirty = false;
      this.healthSent = this.host.tick;
    }
    return md;
  }

  blocksVehicle(c: Combatant): boolean {
    return this.phase === FORT_BUILD || this.ctf.blocksVehicle(c);
  }

  botAwareness(c: Combatant): number {
    // Nothing to fight while the teams build.
    return this.phase === FORT_BUILD ? 0 : this.ctf.botAwareness(c);
  }

  botGoal(c: Combatant): BotGoal | null {
    return this.phase === FORT_BUILD ? this.bots.goal(c) : this.ctf.botGoal(c);
  }

  botInput(c: Combatant, input: PlayerInput): void {
    if (this.phase === FORT_BUILD) input.buttons &= ~(BUTTON_FIRE | BUTTON_ALT | BUTTON_ZOOM | BUTTON_RELOAD);
    else this.bots.blast(c, input);
  }
}
