import type { InputState } from './input.ts';
import { TOUCH_LAYOUT_EVENT, applyTouchLayout, touchLayout } from './touchLayout.ts';

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
 * (InputState.virtualAction), the pad is an analog stick beside WASD and a drag is
 * mouse look, so touch goes through the same input path as keyboard, mouse and
 * controller.
 *
 *   left        the movement pad; its middle jumps (tap) or crouches (hold);
 *               pushed past its rim forward, you sprint
 *   right half  drag to look
 *   Fire        hold to fire; drag it to aim while firing
 *   Aim         aim down the sights: held, or a tap to aim and another to stop (Aim: Hold / Toggle,
 *               combatPrefs.ts; Toggle by default on touch)
 *   Melee       a punch, kick or swing (Y)
 *   Reload, Use (E: vehicles, doors, pickups), Throw (hold to aim, let go), Weapons (the wheel), Orders
 *   (Fireteams' order wheel, while you lead a squad), pause
 *   scorebar    tap to show the scoreboard, tap again to hide it
 *
 * The layout (Options → Controls → Touch; touchLayout.ts): button size, opacity and a left-handed swap (the pad on
 * the right, the buttons on the left). The buttons sit in one cluster scaled from its corner.
 */
export class TouchControls {
  readonly el: HTMLDivElement;
  private readonly rotate: HTMLDivElement;
  private readonly abort = new AbortController();
  private readonly aimBtn: HTMLButtonElement;
  private readonly wheelBtn: HTMLButtonElement;
  /** Fireteams: the order wheel's button (shown while you lead a squad). */
  private readonly ordersBtn: HTMLButtonElement;
  private readonly watchBar: HTMLDivElement;
  /** The scorebar's tap target (proposal 6 in docs/MOBILE_AUDIT.md). */
  private readonly scoresBtn: HTMLButtonElement;
  private readonly joinBtn: HTMLButtonElement;

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
    this.ordersBtn = btn('tc-orders', 'Orders', 'Squad orders (the order wheel)');
    this.ordersBtn.hidden = true;
    const pause = btn('tc-pause', 'II', 'Pause');
    // Over the scorebar (top middle): a tap shows the scoreboard, another hides it (Tab on a keyboard, held).
    this.scoresBtn = btn('tc-scores', '', 'Scores: tap to show or hide the scoreboard');
    // The action buttons in one cluster (scaled together from its bottom corner; left-handed puts it on the left).
    const cluster = div('tc-cluster');
    cluster.append(fire, this.aimBtn, melee, reload, use, thrw, this.wheelBtn, this.ordersBtn);
    this.el.append(look, pad, cluster, pause, this.scoresBtn);
    // Watching (dead, or spectating): previous / next player, follow or free camera, and Join (spectators).
    this.watchBar = div('tc-watch');
    this.watchBar.hidden = true;
    const watchBtn = (label: string, title: string, action: string) => {
      const b = btn('tc-wbtn', label, title);
      b.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.input.virtualAction(action, true);
          this.input.virtualAction(action, false);
        },
        { signal },
      );
      return b;
    };
    this.joinBtn = watchBtn('Join', 'Join the game', 'joinGame');
    this.watchBar.append(watchBtn('◀', 'Previous player', 'specPrev'), watchBtn('Camera', 'Follow players or fly the free camera', 'specCamera'), watchBtn('▶', 'Next player', 'specNext'), this.joinBtn);
    this.el.append(this.watchBar);
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
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            // Not a live pointer (a synthetic event): tracked all the same.
          }
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
        this.input.virtualAction('fire', true);
      },
      move: fireDrag.move,
      up: (e) => {
        fireDrag.end(e);
        fire.classList.remove('on');
        this.input.virtualAction('fire', false);
      },
    });
    /** A button that holds an action (keyBindings.ts) while pressed. */
    const holdKey = (b: HTMLElement, action: string) =>
      track(b, {
        down: () => {
          b.classList.add('on');
          this.input.virtualAction(action, true);
        },
        up: () => {
          b.classList.remove('on');
          this.input.virtualAction(action, false);
        },
      });
    holdKey(melee, 'melee');
    holdKey(reload, 'reload');
    holdKey(use, 'use');
    holdKey(thrw, 'throw');
    // Aim holds the aim action while pressed: the input's own latch makes it a toggle when Aim is set to Toggle (combatPrefs.ts).
    track(this.aimBtn, {
      down: () => this.input.virtualAction('aim', true),
      up: () => this.input.virtualAction('aim', false),
    });
    track(this.wheelBtn, {
      down: () => {
        if (this.input.wheelOpen) this.input.closeWheel(false);
        else this.input.openWheel('touch');
      },
      up: () => undefined,
    });
    track(this.ordersBtn, {
      down: () => {
        if (this.input.wheelOpen) this.input.closeWheel(false);
        else this.input.openWheel('touch', 'order');
      },
      up: () => undefined,
    });
    track(pause, { down: () => this.hooks.pause(), up: () => undefined });
    track(this.scoresBtn, { down: () => this.input.toggleScoreboard(), up: () => undefined });

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
        this.input.virtualAction('sprint', sprint);
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
            at: e.timeStamp,
            long: false,
            timer: window.setTimeout(() => {
              // Held: crouch (toggle), with a tick of the phone's vibration where it has one. On the next frame,
              // not now: a busy page can run this timer before it handles a lift that already happened, and
              // touch events are handled before animation frames, so a tap's lift is seen first.
              requestAnimationFrame(() => {
                if (centre !== c) return;
                c.long = true;
                this.input.virtualAction('crouch', true);
                this.input.virtualAction('crouch', false);
                navigator.vibrate?.(15);
              });
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
          // Tap or hold, by when the finger really went down and came up (event times): on a slow frame the
          // lift can be handled after the hold timer ran, so a tap that crouched by mistake stands back up.
          const tap = e.timeStamp - centre.at < LONG_PRESS_MS;
          if (tap && centre.long) {
            this.input.virtualAction('crouch', true);
            this.input.virtualAction('crouch', false);
          }
          if (tap && centre.long && !this.input.crouchOn && !this.input.spectating) {
            // Crouched by mistake and stood back up: jump on the tick after (pressed now, it would only stand
            // you up from the crouch the mistake already put you in).
            this.input.jumpAfterStanding();
          } else if (tap) {
            // A tap: jump (it also stands you up), or while you're down switch the camera, as Space does.
            const act = this.input.spectating ? 'specCamera' : 'jump';
            this.input.virtualAction(act, true);
            this.input.virtualAction(act, false);
          }
          endCentre();
        }
        setMove(0, 0);
      },
    });
    // No long-press menus, text selection or page zoom over the controls.
    this.el.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    // The layout (size, opacity, left-handed): now, when it changes, and when the window does (Large is held back on short screens).
    const layout = () => applyTouchLayout(document.documentElement, touchLayout(), window.innerHeight);
    layout();
    window.addEventListener(TOUCH_LAYOUT_EVENT, layout, opts);
    window.addEventListener('resize', layout, opts);
  }

  /** Shown while you play; hidden in the pause menu. Keeps the Aim and Weapons buttons' state in step. */
  setActive(on: boolean): void {
    if (this.el.hidden === !on) return;
    this.el.hidden = !on;
    // Paused: the scoreboard a tap opened closes (the pause menu shows the scores).
    if (!on && this.input.scoreboardPinned) this.input.toggleScoreboard();
  }

  /** Out of play: the watching buttons (Join for spectators by choice); null hides them. */
  setWatching(w: { join: boolean } | null): void {
    if (this.watchBar.hidden !== !w) this.watchBar.hidden = !w;
    if (w && this.joinBtn.hidden === w.join) this.joinBtn.hidden = !w.join;
  }

  /** Once a frame: the toggle buttons show their state. */
  update(): void {
    this.aimBtn.classList.toggle('on', this.input.aimShown && this.input.locked);
    this.scoresBtn.classList.toggle('on', this.input.scoreboardPinned);
    this.wheelBtn.classList.toggle('on', this.input.wheelOpen && this.input.wheelKind === 'weapon');
    if (this.ordersBtn.hidden === this.input.ordersOn) this.ordersBtn.hidden = !this.input.ordersOn;
    this.ordersBtn.classList.toggle('on', this.input.wheelOpen && this.input.wheelKind === 'order');
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
