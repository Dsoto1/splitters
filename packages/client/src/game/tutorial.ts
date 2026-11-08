/**
 * The tutorial (main menu → Tutorial, and offered once on a first visit): ten short steps on the Training Range, each
 * done by doing it (read from your input and your predicted player, never by a timer): look, move, sprint, crouch,
 * shoot, aim and shoot, reload, switch weapon, throw a grenade, drive the buggy. Skip is always there; skipping or
 * finishing marks it seen, so the first-visit offer doesn't come back.
 *
 * This file is the rules; coachHud.ts draws the prompt, session.ts feeds a TutorialSample each frame.
 */

export type StepId = 'look' | 'move' | 'sprint' | 'crouch' | 'shoot' | 'aim' | 'reload' | 'switch' | 'throw' | 'drive';

/** One frame of what you did (the session gathers it from the ticks of the frame). */
export interface TutorialSample {
  /** Seconds since the last sample. */
  dt: number;
  alive: boolean;
  /** Your feet (on foot) or your ride (driving), on the ground plane. */
  x: number;
  z: number;
  /** Your view, radians. */
  yaw: number;
  pitch: number;
  /** A movement key, stick or the pad pushed this frame. */
  moving: boolean;
  sprinting: boolean;
  /** 0 standing, 1 crouching, 2 prone. */
  stance: number;
  /** Rounds fired this frame, and of those the ones fired aiming down the sights or scoped. */
  shots: number;
  aimedShots: number;
  /** A reload is running. */
  reloading: boolean;
  /** The weapon in hand (its code; 0: none yet). */
  held: number;
  /** Grenades (or other throwables) thrown this frame. */
  thrown: number;
  /** In a vehicle's driver seat. */
  driving: boolean;
}

export interface StepDef {
  id: StepId;
  title: string;
  /** What to do, keyboard and mouse, and on the touch controls. `[X]`: a key or button. */
  kb: string;
  touch: string;
  /** How much makes it done (radians, metres, seconds or a count, by the step). */
  goal: number;
}

export const TUTORIAL_STEPS: readonly StepDef[] = [
  { id: 'look', title: 'Look around', kb: 'Move the [Mouse] to look around', touch: 'Drag on the right half of the screen to look around', goal: 2 },
  { id: 'move', title: 'Move', kb: 'Walk with [W] [A] [S] [D]', touch: 'Walk with the pad, bottom left', goal: 5 },
  { id: 'sprint', title: 'Sprint', kb: 'Hold [Shift] while you walk forward', touch: 'Push the pad forward past its rim to sprint', goal: 1.2 },
  { id: 'crouch', title: 'Crouch', kb: 'Press [C] to crouch ([C] again stands up)', touch: "Hold the pad's middle to crouch", goal: 0.4 },
  { id: 'shoot', title: 'Shoot', kb: '[Left click] to fire at the targets downrange', touch: 'Hold [Fire] to shoot at the targets downrange', goal: 3 },
  { id: 'aim', title: 'Aim down the sights', kb: 'Hold [Right click] to aim, then fire', touch: 'Tap [Aim], then [Fire]', goal: 2 },
  { id: 'reload', title: 'Reload', kb: 'Press [R] to reload', touch: 'Tap [Reload]', goal: 1 },
  { id: 'switch', title: 'Switch weapon', kb: 'Press [1] or [2], or roll the [Mouse wheel]', touch: 'Tap [Weapons] and pick another', goal: 1 },
  { id: 'throw', title: 'Throw a grenade', kb: 'Hold [G] to aim, let go to throw (more grenades lie by the spawn)', touch: 'Hold [Throw] to aim, let go to throw (more grenades lie by the spawn)', goal: 1 },
  { id: 'drive', title: 'Drive', kb: 'Walk to the buggy (the marker), press [E] to get in and drive with [W] [A] [S] [D]', touch: 'Walk to the buggy (the marker), tap [Use] to get in and drive with the pad', goal: 15 },
];

/** Radians between two angles, the short way round. */
const turn = (a: number, b: number): number => {
  const d = (((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return Math.abs(d);
};

/** A move longer than this in one frame is a respawn or a teleport, not walking. */
const JUMP_M = 3;

/**
 * The tutorial's progress: `update` with each frame's sample; the step in hand completes on its own action, then
 * the next begins. `step` is null once every step is done.
 */
export class Tutorial {
  index = 0;
  /** How far into the step in hand (in its goal's units). */
  amount = 0;
  private last: TutorialSample | null = null;
  /** The weapon in hand when the switch step began. */
  private heldAtStart = 0;

  get step(): StepDef | null {
    return TUTORIAL_STEPS[this.index] ?? null;
  }

  get done(): boolean {
    return this.index >= TUTORIAL_STEPS.length;
  }

  /** 0..1 through the step in hand. */
  get progress(): number {
    const s = this.step;
    return s ? Math.min(1, this.amount / s.goal) : 1;
  }

  /** Steps finished (for "3 / 10"). */
  get finished(): number {
    return Math.min(this.index, TUTORIAL_STEPS.length);
  }

  /** A frame's sample; true when it finished the step in hand. */
  update(s: TutorialSample): boolean {
    const step = this.step;
    const last = this.last;
    this.last = s;
    if (!step || !s.alive) return false;
    if (this.heldAtStart === 0 && step.id === 'switch') this.heldAtStart = s.held;
    const moved = last && last.alive ? Math.hypot(s.x - last.x, s.z - last.z) : 0;
    const walked = moved < JUMP_M ? moved : 0;
    switch (step.id) {
      case 'look':
        if (last) this.amount += turn(last.yaw, s.yaw) + Math.abs(s.pitch - last.pitch);
        break;
      case 'move':
        if (s.moving && !s.driving) this.amount += walked;
        break;
      case 'sprint':
        if (s.sprinting && s.moving) this.amount += s.dt;
        break;
      case 'crouch':
        if (s.stance >= 1) this.amount += s.dt;
        break;
      case 'shoot':
        this.amount += s.shots;
        break;
      case 'aim':
        this.amount += s.aimedShots;
        break;
      case 'reload':
        if (s.reloading) this.amount = 1;
        break;
      case 'switch':
        if (s.held !== 0 && this.heldAtStart !== 0 && s.held !== this.heldAtStart) this.amount = 1;
        break;
      case 'throw':
        this.amount += s.thrown;
        break;
      case 'drive':
        if (s.driving && last?.driving) this.amount += walked;
        break;
    }
    if (this.amount < step.goal) return false;
    this.index++;
    this.amount = 0;
    this.heldAtStart = 0;
    if (this.step?.id === 'switch') this.heldAtStart = s.held;
    return true;
  }

  /** Jump to a step (tests, and Skip step). */
  goTo(index: number): void {
    this.index = Math.max(0, Math.min(TUTORIAL_STEPS.length, index));
    this.amount = 0;
    this.heldAtStart = 0;
  }
}

/** Whether the tutorial was offered (first visit), finished or skipped, in this browser. */
export type TutorialState = 'new' | 'offered' | 'skipped' | 'done';
const KEY = 'tiletrigger.tutorial';

export function tutorialState(): TutorialState {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'offered' || v === 'skipped' || v === 'done' ? v : 'new';
  } catch {
    // No storage (private window, blocked): treat it as offered, so nobody is offered it on every visit.
    return 'offered';
  }
}

export function setTutorialState(s: Exclude<TutorialState, 'new'>): void {
  try {
    // Done or skipped stays so: a later "offered" doesn't undo it.
    if (s === 'offered' && tutorialState() !== 'new') return;
    localStorage.setItem(KEY, s);
  } catch {
    // Lasts for this page.
  }
}
