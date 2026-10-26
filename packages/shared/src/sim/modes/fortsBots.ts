import { horizontalDistance, lookAngles, type Vec3 } from '../../math.ts';
import { PLAYER, TICK_RATE } from '../constants.ts';
import { fortBounds, snapFortBase, type FortPieceKind } from '../forts.ts';
import type { Combatant } from '../match.ts';
import { BUTTON_FIRE, type PlayerInput } from '../movement.ts';
import { segmentHitsAabb } from '../scenarioDefs.ts';
import { weaponCode } from '../weapons.ts';
import type { FortPieceRt, FortsMode } from './forts.ts';
import type { BotGoal, ModeHost } from './types.ts';

/**
 * Fort Wars bots. During the build phase each team's bots work through a
 * simple fortification template laid out round their own flag (a front wall
 * with a gap, sandbags out in front, a metal wall inside, side walls, a
 * two-high block tower with stairs up to it, a crate), walking to each piece
 * and placing it through the same rules players build by. In combat they play
 * Capture the Flag; the navmesh is rebuilt with the forts in when combat
 * starts, so they path round walls and through gaps, and a bot whose way
 * ahead is shut by an enemy piece (and isn't fighting anyone) shoots it down.
 */

/** A template entry: piece, metres toward the enemy (`f`) and to the right (`r`) of the flag, and extra quarter turns. */
type TemplateItem = [FortPieceKind, number, number, number];

const TEMPLATE: readonly TemplateItem[] = [
  ['wall', 6, -2, 0],
  ['wall', 6, 2, 0],
  ['wall', 6, -4, 0],
  ['wall', 6, 4, 0],
  ['metal_wall', 3.5, -3, 0],
  ['sandbags', 8.5, -4, 0],
  ['sandbags', 8.5, 4, 0],
  ['wall', 4.75, -5.25, 1],
  ['wall', 4.75, 5.25, 1],
  // Tower: two layers of four blocks, stairs up the side.
  ['block', -4, 4, 0],
  ['block', -4, 5, 0],
  ['block', -5, 4, 0],
  ['block', -5, 5, 0],
  ['stairs', -4, 2.5, 1],
  ['block', -4, 4, 0],
  ['block', -4, 5, 0],
  ['block', -5, 4, 0],
  ['block', -5, 5, 0],
  ['crate', 1.5, -4.5, 0],
];

interface Plan {
  kind: FortPieceKind;
  rot: number;
  /** x and z of the footprint centre (snapped); the height is found when it's placed. */
  at: Vec3;
  /** Where the bot stands to place it. */
  stand: Vec3;
  state: 'todo' | 'done' | 'skip';
  tries: number;
  claimedBy: number | null;
  claimedAt: number;
}

/** How long a bot may take to reach a piece's spot before it gives that piece up. */
const REACH_TIMEOUT = 15 * TICK_RATE;
/** A bot places at most one piece this often. */
const PLACE_EVERY = Math.round(0.6 * TICK_RATE);
/** Looking this far ahead for an enemy piece in the way. */
const BLAST_LOOKAHEAD = 6;

export class FortBots {
  readonly plans: Plan[][] = [[], []];
  private readonly nextPlace = new Map<number, number>();
  private readonly blasting = new Map<number, { piece: number; until: number }>();
  /** Where each bot was a second ago, and whether it has barely moved since (stuck against something). */
  private readonly lastPos = new Map<number, { pos: Vec3; tick: number; stuck: boolean }>();

  constructor(
    private readonly mode: FortsMode,
    private readonly host: ModeHost,
  ) {}

  /** Lay out each team's template afresh (a new build phase: pieces still standing are simply skipped). */
  reset(): void {
    this.nextPlace.clear();
    this.blasting.clear();
    this.lastPos.clear();
    for (const team of [0, 1]) this.plans[team] = this.layout(team);
  }

  private layout(team: number): Plan[] {
    const home = this.mode.bases[team]!;
    const away = this.mode.bases[1 - team]!;
    const ex = away.x - home.x;
    const ez = away.z - home.z;
    // Quarter turn whose local +z points (most nearly) at the enemy, and the world directions it gives.
    const facing = Math.abs(ex) >= Math.abs(ez) ? (ex >= 0 ? 1 : 3) : ez >= 0 ? 0 : 2;
    const turn = (x: number, z: number, r: number): [number, number] => (r === 0 ? [x, z] : r === 1 ? [z, -x] : r === 2 ? [-x, -z] : [-z, x]);
    const [fx, fz] = turn(0, 1, facing);
    const [rx, rz] = turn(1, 0, facing);
    return TEMPLATE.map(([kind, f, r, q]) => {
      const rot = (facing + q) % 4;
      const at = snapFortBase(kind, rot, { x: home.x + fx * f + rx * r, y: home.y, z: home.z + fz * f + rz * r });
      // Stand a couple of metres from the spot, on the flag's side of it.
      const dx = home.x - at.x;
      const dz = home.z - at.z;
      const d = Math.hypot(dx, dz) || 1;
      const stand = { x: at.x + (dx / d) * 2.4, y: home.y, z: at.z + (dz / d) * 2.4 };
      return { kind, rot, at, stand, state: 'todo' as const, tries: 0, claimedBy: null, claimedAt: 0 };
    });
  }

  /** The plan this bot is working on, claiming the next free one if it has none. */
  private claim(c: Combatant, team: number): Plan | undefined {
    const plans = this.plans[team]!;
    const mine = plans.find((p) => p.state === 'todo' && p.claimedBy === c.slot);
    if (mine) return mine;
    const alive = new Set(this.host.combatants().filter((o) => o.alive).map((o) => o.slot));
    const free = plans.find((p) => p.state === 'todo' && (p.claimedBy === null || !alive.has(p.claimedBy)));
    if (free) {
      free.claimedBy = c.slot;
      free.claimedAt = this.host.tick;
    }
    return free;
  }

  goal(c: Combatant): BotGoal | null {
    const team = this.mode.teamIndex(c.faction);
    if (team < 0) return null;
    const plan = this.claim(c, team);
    if (plan) return { pos: plan.stand, radius: 0.8 };
    return { pos: this.mode.bases[team]!, radius: 6 };
  }

  /** Build phase, every tick: bots at their spot place their piece. */
  build(): void {
    const tick = this.host.tick;
    for (const c of this.host.combatants()) {
      if (!c.bot || !c.alive) continue;
      const team = this.mode.teamIndex(c.faction);
      if (team < 0) continue;
      const plan = this.plans[team]!.find((p) => p.state === 'todo' && p.claimedBy === c.slot);
      if (!plan) continue;
      if (tick - plan.claimedAt > REACH_TIMEOUT) {
        plan.state = 'skip';
        continue;
      }
      if (horizontalDistance(c.move.pos, plan.stand) > 1.8 || tick < (this.nextPlace.get(c.slot) ?? 0)) continue;
      this.nextPlace.set(c.slot, tick + PLACE_EVERY);
      // Settle it on whatever is there now (the ground, or the layer below).
      const down = this.host.physics.raycastHit({ x: plan.at.x, y: plan.at.y + 3.5, z: plan.at.z }, { x: 0, y: -1, z: 0 }, 8);
      if (!down) {
        plan.state = 'skip';
        continue;
      }
      const base = { x: plan.at.x, y: Math.round((plan.at.y + 3.5 - down.dist) * 100) / 100, z: plan.at.z };
      const placed = this.mode.place(team, plan.kind, plan.rot, base, c.slot);
      if (typeof placed !== 'string') plan.state = 'done';
      else if (placed === 'Not enough build points' || placed === 'Your team has built all it can' || ++plan.tries >= 4) plan.state = 'skip';
    }
  }

  /**
   * Combat: a bot whose way toward its goal is shut by an enemy piece within a
   * few metres, and which isn't fighting anyone (or has been stuck against
   * the piece for a second), turns on it and shoots until it breaks,
   * preferring an explosive weapon if it has one.
   */
  blast(c: Combatant, input: PlayerInput): void {
    const bot = c.bot;
    const tick = this.host.tick;
    let last = this.lastPos.get(c.slot);
    if (!last || tick - last.tick >= TICK_RATE) {
      const stuck = !!last && c.alive && horizontalDistance(last.pos, c.move.pos) < 0.5;
      this.lastPos.set(c.slot, (last = { pos: { ...c.move.pos }, tick, stuck }));
    }
    if (!bot || !c.alive || c.mount || (bot.target !== null && !last.stuck && !this.blasting.has(c.slot))) {
      this.blasting.delete(c.slot);
      return;
    }
    const team = this.mode.teamIndex(c.faction);
    if (team < 0) return;
    // Stuck on one of our own pieces (the navmesh doesn't know the forts on big maps): sidestep round it.
    if (last.stuck && !this.blasting.has(c.slot) && this.mode.pieces.some((p) => p.team === team && boxDistance(fortBounds(p.boxes), c.move.pos) < 1.2)) {
      input.right = Math.floor(tick / (2 * TICK_RATE) + c.slot) % 2 ? 1 : -1;
      return;
    }
    const chest = { x: c.move.pos.x, y: c.move.pos.y + PLAYER.height * 0.55, z: c.move.pos.z };
    let job = this.blasting.get(c.slot);
    let piece = job ? this.mode.pieces.find((p) => p.id === job!.piece) : undefined;
    if (!piece || (job && tick > job.until)) {
      this.blasting.delete(c.slot);
      job = undefined;
      piece = undefined;
      // Look again a few times a second, staggered between bots.
      if ((tick + c.slot) % 8 !== 0) return;
      const goal = this.mode.ctf.botGoal(c);
      if (!goal) return;
      const dx = goal.pos.x - chest.x;
      const dz = goal.pos.z - chest.z;
      const d = Math.hypot(dx, dz);
      if (d < 1) return;
      const k = Math.min(1, BLAST_LOOKAHEAD / d);
      const ahead = { x: chest.x + dx * k, y: chest.y, z: chest.z + dz * k };
      piece = this.nearestBlocking(chest, ahead, team);
      if (!piece) return;
      job = { piece: piece.id, until: tick + 4 * TICK_RATE };
      this.blasting.set(c.slot, job);
    }
    const b = fortBounds(piece.boxes);
    const aim = { x: Math.max(b.min.x, Math.min(b.max.x, chest.x)), y: Math.min(b.max.y - 0.1, Math.max(b.min.y + 0.3, chest.y)), z: Math.max(b.min.z, Math.min(b.max.z, chest.z)) };
    const centre = { x: (b.min.x + b.max.x) / 2, y: aim.y, z: (b.min.z + b.max.z) / 2 };
    const look = lookAngles({ x: chest.x, y: c.move.pos.y + 1.6, z: chest.z }, { x: (aim.x + centre.x) / 2, y: aim.y, z: (aim.z + centre.z) / 2 });
    input.yaw = look.yaw;
    input.pitch = look.pitch;
    input.forward = 0;
    input.right = 0;
    const gun = this.bestWeapon(c);
    if (gun && gun !== c.current) input.weapon = gun;
    // Tap the trigger (semi-automatics need it let go between shots).
    input.buttons = tick % 2 === 0 ? input.buttons | BUTTON_FIRE : input.buttons & ~BUTTON_FIRE;
  }

  private nearestBlocking(from: Vec3, to: Vec3, team: number): FortPieceRt | undefined {
    let best: FortPieceRt | undefined;
    let bestD = Infinity;
    for (const p of this.mode.pieces) {
      if (p.team === team) continue;
      if (!p.boxes.some((box) => segmentHitsAabb(from, to, box, PLAYER.radius))) continue;
      const b = fortBounds(p.boxes);
      const d = Math.hypot((b.min.x + b.max.x) / 2 - from.x, (b.min.z + b.max.z) / 2 - from.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** An explosive launcher with rounds if it has one, else the hardest-hitting loaded gun, else what it holds. */
  private bestWeapon(c: Combatant): number | null {
    let best: number | null = null;
    let score = -Infinity;
    for (const [code, w] of c.weapons) {
      if (w.def.magazine > 0 && w.mag + w.reserve === 0) continue;
      if (w.def.heal || w.def.grapple || (w.def.damage <= 0 && !w.def.projectile)) continue;
      const blast = w.def.projectile?.splashDamage ?? 0;
      const s = blast * 3 + w.def.damage * Math.max(1, w.def.pellets) * (TICK_RATE / Math.max(1, w.def.fireIntervalTicks));
      if (s > score) {
        score = s;
        best = code;
      }
    }
    return best ?? (weaponCode(c.weapons.get(c.current)?.def ?? { id: '' }) || null);
  }
}

/** Horizontal distance from a point to a box (0 inside). */
function boxDistance(b: { min: Vec3; max: Vec3 }, p: Vec3): number {
  return Math.hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.z - p.z, 0, p.z - b.max.z));
}
