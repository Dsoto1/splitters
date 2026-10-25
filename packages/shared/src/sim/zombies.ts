import { horizontalDistance, type Vec3 } from '../math.ts';
import type { GameEvent } from '../protocol.ts';
import { PLAYER, TICK_RATE } from './constants.ts';

/**
 * Zombie survival: every player (and Player Bot) holds out together against
 * endless waves of zombies. Each wave brings more of them, tougher and a
 * little faster; a short break between waves lets everyone regroup, and the
 * fallen come back at the start of the next one. The game is over when
 * nobody is left standing; the score is the wave reached.
 */

/** What the director needs from the match. */
export interface ZombieHost {
  readonly tick: number;
  /** Every player and Player Bot, alive or not. */
  players(): readonly { slot: number; alive: boolean; pos: Vec3; eye: Vec3; bot: boolean }[];
  /** Where zombies may come from: the map's NPC spawners first, then its spawn points, then open floor. */
  spawnSpots(): readonly Vec3[];
  /** Is there a clear line between two points? */
  sees(a: Vec3, b: Vec3): boolean;
  /** Raise a zombie at a spot; returns its actor ID (or null when it couldn't be placed). */
  spawnZombie(pos: Vec3, health: number, speed: number): number | null;
  zombieAlive(id: number): boolean;
  /** Bring a fallen player back. */
  revive(slot: number): void;
  emit(ev: GameEvent): void;
  /** Everyone is down: the round ends in defeat. */
  defeat(): void;
  random(): number;
}

/** Seconds before the first wave, and between waves. */
export const ZOMBIE_FIRST_BREAK_SECONDS = 8;
export const ZOMBIE_BREAK_SECONDS = 12;
/** Zombies don't rise closer than this to a player, or in plain sight of one, when there's any other choice. */
const SPAWN_CLEAR = 16;
/** ...nor so far away that they take ages to arrive. */
const SPAWN_REACH = 70;

/**
 * Zombies in wave `n` (1-based) for this many players. Humans count as one
 * each and Player Bots as a third (see `zombieHeadcount`), so a full bot squad
 * doesn't triple the horde.
 */
export function zombiesInWave(n: number, players: number): number {
  return Math.round((4 + 3 * n) * (1 + 0.5 * Math.max(0, players - 1)));
}

/** Players for wave sizes: humans count as one, Player Bots as a third, never less than one. */
export function zombieHeadcount(players: readonly { bot: boolean }[]): number {
  return Math.max(1, players.reduce((n, p) => n + (p.bot ? 1 / 3 : 1), 0));
}

/** How many may be up at once: the rest wait their turn. */
export function zombieCap(n: number, players: number): number {
  return Math.min(32, Math.round(6 + 2 * n + 2 * Math.max(0, players - 1)));
}

/** Health multiple (on the zombie's own) and walking-speed multiple in wave `n`. */
export function zombieToughness(n: number): { health: number; speed: number } {
  return { health: 1 + 0.15 * (n - 1), speed: Math.min(1.25, 1 + 0.04 * (n - 1)) };
}

export class ZombieSurvival {
  wave = 0;
  /** Best wave reached in this match (kept across games). */
  best = 0;
  private phase: 'break' | 'wave' = 'break';
  private toSpawn = 0;
  private readonly alive = new Set<number>();
  private breakUntil: number;
  private nextSpawn = 0;
  private over = false;

  constructor(private readonly host: ZombieHost) {
    this.breakUntil = host.tick + ZOMBIE_FIRST_BREAK_SECONDS * TICK_RATE;
  }

  /** A new game: back to the first break. */
  reset(): void {
    this.wave = 0;
    this.phase = 'break';
    this.toSpawn = 0;
    this.alive.clear();
    this.breakUntil = this.host.tick + ZOMBIE_FIRST_BREAK_SECONDS * TICK_RATE;
    this.over = false;
  }

  /** Zombies still to beat this wave (up and yet to come). */
  get left(): number {
    return this.toSpawn + this.alive.size;
  }

  /** Seconds until the next wave starts (0 during a wave). */
  get breakSeconds(): number {
    return this.phase === 'break' ? Math.max(0, Math.ceil((this.breakUntil - this.host.tick) / TICK_RATE)) : 0;
  }

  step(): void {
    if (this.over) return;
    const tick = this.host.tick;
    const players = this.host.players();
    if (this.wave > 0 && players.length && players.every((p) => !p.alive)) {
      this.over = true;
      this.host.emit({ e: 'msg', text: `Overrun on wave ${this.wave}`, secs: 5 });
      this.host.defeat();
      return;
    }
    for (const id of [...this.alive]) if (!this.host.zombieAlive(id)) this.alive.delete(id);
    if (this.phase === 'break') {
      if (tick >= this.breakUntil) this.startWave(zombieHeadcount(players));
      return;
    }
    if (this.left === 0) {
      // Wave cleared: a breather, then the next.
      this.phase = 'break';
      this.breakUntil = tick + ZOMBIE_BREAK_SECONDS * TICK_RATE;
      this.host.emit({ e: 'msg', text: `Wave ${this.wave} cleared`, secs: 4 });
      this.host.emit({ e: 'cue', cue: 'chime' });
      return;
    }
    // Raise zombies up to the cap, a second or two apart (faster in later waves).
    if (this.toSpawn > 0 && this.alive.size < zombieCap(this.wave, zombieHeadcount(players)) && tick >= this.nextSpawn) {
      const at = this.pickSpot(players.filter((p) => p.alive));
      if (at) {
        const t = zombieToughness(this.wave);
        const id = this.host.spawnZombie(at, t.health, t.speed);
        if (id !== null) {
          this.alive.add(id);
          this.toSpawn--;
        }
      }
      this.nextSpawn = tick + Math.round(TICK_RATE * Math.max(0.35, 1.6 - 0.1 * this.wave));
    }
  }

  private startWave(players: number): void {
    this.wave++;
    this.best = Math.max(this.best, this.wave);
    this.phase = 'wave';
    this.toSpawn = zombiesInWave(this.wave, Math.max(1, players));
    this.nextSpawn = this.host.tick;
    for (const p of this.host.players()) if (!p.alive) this.host.revive(p.slot);
    this.host.emit({ e: 'msg', text: `Wave ${this.wave}`, secs: 3 });
    this.host.emit({ e: 'cue', cue: 'alarm' });
  }

  /**
   * Somewhere out of sight, not too close and not too far: a random pick among
   * the good spots, else the farthest spot that is at least out of sight, else
   * the farthest one.
   */
  private pickSpot(players: readonly { pos: Vec3; eye: Vec3 }[]): Vec3 | null {
    const spots = this.host.spawnSpots();
    if (!spots.length) return null;
    if (!players.length) return spots[Math.floor(this.host.random() * spots.length)]!;
    const near = (s: Vec3) => Math.min(...players.map((p) => horizontalDistance(p.pos, s) + Math.abs(p.pos.y - s.y) * 2));
    const hidden = (s: Vec3) => players.every((p) => !this.host.sees(p.eye, { x: s.x, y: s.y + PLAYER.eyeHeight, z: s.z }));
    const good = spots.filter((s) => {
      const d = near(s);
      return d >= SPAWN_CLEAR && d <= SPAWN_REACH && hidden(s);
    });
    if (good.length) return good[Math.floor(this.host.random() * good.length)]!;
    const byDistance = [...spots].sort((a, b) => near(b) - near(a));
    return byDistance.find((s) => near(s) >= SPAWN_CLEAR && hidden(s)) ?? byDistance[0]!;
  }

  /** [wave, zombies left, seconds to the next wave, best wave]. */
  snapshot(): [number, number, number, number] {
    return [this.wave, this.left, this.breakSeconds, this.best];
  }
}
