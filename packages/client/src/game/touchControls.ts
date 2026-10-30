import type { InputState } from './input.ts';

/** The pad's middle (this share of its radius) is the jump button; holding it this long crouches instead. */
const PAD_CENTRE = 0.32;
const LONG_PRESS_MS = 380;
/** A finger that leaves the middle this far becomes movement (no jump, no crouch). */
const PAD_SLIDE = 0.5;
/** Pushed past the rim this far, mostly forward: sprint. */
const SPRINT_PAST = 1.2;
const DEADZONE = 0.12;

/**
 * On-screen controls for phones and tablets held sideways (touchDevice.ts).
 * Nothing here plays the game itself: every control is a key of the keyboard
 * (InputState.virtualKey), the pad is an analog stick beside WASD and a drag is
 * mouse look, so touch goes through the same input path as keyboard, mouse and
 * controller.
 *
 *   left        the movement pad; its middle jumps (tap) or crouches (hold);
 *               pushed past its rim forward, you sprint
 *   right half  drag to look
 *   Fire        hold to fire; drag it to aim while firing
 *   Aim         tap to aim down the sights, tap again to stop
 *   Melee       a punch, kick or swing (Y)
 *   Reload, Use (E: vehicles, doors, pickups), Throw (hold to aim, let go), Weapons (the wheel), pause
 */
export class TouchControls {
  readonly el: HTMLDivElement;
  private readonly rotate: HTMLDivElement;
  private readonly abort = new AbortController();
  private readonly aimBtn: HTMLButtonElement;
  private readonly wheelBtn: HTMLButtonElement;

  constructor(
    private readonly input: InputState,
    parent: HTMLElement,
    private readonly hooks: { pause: () => void },
  ) {
    const signal = this.abort.signal;
    this.el = document.createElement('div');
    this.el.id = 'touch-ui';
    this.el.hidden = true;
    const look = div('tc-look');
    const pad = div('tc-pad');
    for (const d of ['up', 'right', 'down', 'left']) pad.append(div(`tc-arm ${d}`));
    const knob = div('tc-knob');
    const jump = div('tc-jump');
    jump.innerHTML = '<span>Jump</span><small>hold: crouch</small>';
    pad.append(knob, jump);
    const btn = (cls: string, label: string, title: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tc-btn ${cls}`;
      b.textContent = label;
      b.setAttribute('aria-label', title);
      return b;
    };
    const fire = btn('tc-fire', 'Fire', 'Fire (drag to aim)');
    this.aimBtn = btn('tc-aim', 'Aim', 'Aim down the sights');
    const melee = btn('tc-melee', 'Melee', 'Quick melee');
    const reload = btn('tc-reload', 'Reload', 'Reload');
    const use = btn('tc-use', 'Use', 'Use: vehicles, doors, pickups');
    const thrw = btn('tc-throw', 'Throw', 'Hold to aim a throw, let go to throw');
    this.wheelBtn = btn('tc-wheel', 'Weapons', 'Weapon wheel');
    const pause = btn('tc-pause', 'II', 'Pause');
    this.el.append(look, pad, fire, this.aimBtn, melee, reload, use, thrw, this.wheelBtn, pause);
    this.rotate = div('');
    this.rotate.id = 'touch-rotate';
    this.rotate.innerHTML = '<div><b>Turn your phone sideways</b><small>Tile Trigger plays in landscape</small></div>';
    parent.append(this.el, this.rotate);

    const opts = { signal };
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    /** Track one finger from pointerdown on `target` until it lifts (captured, so it can leave the button). */
    const track = (target: HTMLElement, h: { down: (e: PointerEvent) => void; move?: (e: PointerEvent) => void; up: (e: PointerEvent) => void }) => {
      const fingers = new Set<number>();
      target.addEventListener(
        'pointerdown',
        (e) => {
          stop(e);
          target.setPointerCapture?.(e.pointerId);
          fingers.add(e.pointerId);
          h.down(e);
        },
        opts,
      );
      target.addEventListener(
        'pointermove',
        (e) => {
          if (fingers.has(e.pointerId)) h.move?.(e);
        },
        opts,
      );
      const end = (e: PointerEvent) => {
        if (!fingers.delete(e.pointerId)) return;
        h.up(e);
      };
      target.addEventListener('pointerup', end, opts);
      target.addEventListener('pointercancel', end, opts);
      target.addEventListener('lostpointercapture', end, opts);
    };
    /** A drag that turns the view: the change since the last move. */
    const dragLook = () => {
      const last = new Map<number, { x: number; y: number }>();
      return {
        start: (e: PointerEvent) => last.set(e.pointerId, { x: e.clientX, y: e.clientY }),
        move: (e: PointerEvent) => {
          const l = last.get(e.pointerId);
          if (!l) return;
          this.input.addTouchLook(e.clientX - l.x, e.clientY - l.y);
          last.set(e.pointerId, { x: e.clientX, y: e.clientY });
        },
        end: (e: PointerEvent) => last.delete(e.pointerId),
      };
    };
    const lookDrag = dragLook();
    track(look, { down: lookDrag.start, move: lookDrag.move, up: lookDrag.end });
    const fireDrag = dragLook();
    track(fire, {
      down: (e) => {
        fireDrag.start(e);
        fire.classList.add('on');
        this.input.virtualKey('KeyF', true);
      },
      move: fireDrag.move,
      up: (e) => {
        fireDrag.end(e);
        fire.classList.remove('on');
        this.input.virtualKey('KeyF', false);
      },
    });
    /** A button that holds a key down while pressed. */
    const holdKey = (b: HTMLElement, code: string) =>
      track(b, {
        down: () => {
          b.classList.add('on');
          this.input.virtualKey(code, true);
        },
        up: () => {
          b.classList.remove('on');
          this.input.virtualKey(code, false);
        },
      });
    holdKey(melee, 'KeyY');
    holdKey(reload, 'KeyR');
    holdKey(use, 'KeyE');
    holdKey(thrw, 'KeyG');
    track(this.aimBtn, {
      down: () => this.input.virtualKey('KeyX', !this.input.held('KeyX')),
      up: () => undefined,
    });
    track(this.wheelBtn, {
      down: () => {
        if (this.input.wheelOpen) this.input.closeWheel(false);
        else this.input.openWheel('touch');
      },
      up: () => undefined,
    });
    track(pause, { down: () => this.hooks.pause(), up: () => undefined });

    // The pad: an analog stick drawn as a d-pad; its middle is jump (tap) and crouch (hold).
    let centre: { id: number; at: number; timer: number; long: boolean } | null = null;
    let sprinting = false;
    const vec = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const half = r.width / 2;
      return { x: (e.clientX - r.left - half) / half, y: (e.clientY - r.top - half) / half };
    };
    const setMove = (x: number, y: number) => {
      const len = Math.hypot(x, y);
      const k = len > 1 ? 1 / len : 1;
      const mx = Math.abs(x * k) < DEADZONE ? 0 : x * k;
      const my = Math.abs(y * k) < DEADZONE ? 0 : y * k;
      this.input.setTouchMove(mx, -my);
      knob.style.transform = `translate(${mx * 100}%, ${my * 100}%)`;
      const sprint = len > SPRINT_PAST && -y / len > 0.75;
      if (sprint !== sprinting) {
        sprinting = sprint;
        this.input.virtualKey('ShiftLeft', sprint);
        pad.classList.toggle('sprint', sprint);
      }
    };
    const endCentre = () => {
      if (!centre) return;
      clearTimeout(centre.timer);
      jump.classList.remove('on');
      centre = null;
    };
    track(pad, {
      down: (e) => {
        const v = vec(e);
        if (Math.hypot(v.x, v.y) < PAD_CENTRE) {
          jump.classList.add('on');
          const c = {
            id: e.pointerId,
            at: performance.now(),
            long: false,
            timer: window.setTimeout(() => {
              // Held: crouch (toggle), with a tick of the phone's vibration where it has one.
              c.long = true;
              this.input.virtualKey('KeyC', true);
              this.input.virtualKey('KeyC', false);
              navigator.vibrate?.(15);
            }, LONG_PRESS_MS),
          };
          centre = c;
        } else setMove(v.x, v.y);
      },
      move: (e) => {
        const v = vec(e);
        if (centre?.id === e.pointerId) {
          // Slid off the middle: it's movement now.
          if (Math.hypot(v.x, v.y) < PAD_SLIDE) return;
          endCentre();
        }
        setMove(v.x, v.y);
      },
      up: (e) => {
        if (centre?.id === e.pointerId) {
          if (!centre.long) {
            // A tap: jump (Space, so it also stands you up, or picks whom to watch while you're down).
            this.input.virtualKey('Space', true);
            this.input.virtualKey('Space', false);
          }
          endCentre();
        }
        setMove(0, 0);
      },
    });
    // No long-press menus, text selection or page zoom over the controls.
    this.el.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
  }

  /** Shown while you play; hidden in the pause menu. Keeps the Aim and Weapons buttons' state in step. */
  setActive(on: boolean): void {
    if (this.el.hidden === !on) return;
    this.el.hidden = !on;
  }

  /** Once a frame: the toggle buttons show their state. */
  update(): void {
    this.aimBtn.classList.toggle('on', this.input.held('KeyX'));
    this.wheelBtn.classList.toggle('on', this.input.wheelOpen);
  }

  dispose(): void {
    this.abort.abort();
    this.el.remove();
    this.rotate.remove();
  }
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  return d;
}
