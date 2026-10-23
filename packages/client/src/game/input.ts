import { BUTTON_ALT, BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, BUTTON_PRONE, BUTTON_RELOAD, BUTTON_SPRINT, BUTTON_THROW, BUTTON_USE, BUTTON_ZOOM } from '@chronosplit/shared';

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = 1.5;

/** Keyboard + pointer-lock mouse. View angles accumulate here; movement is sampled once per tick. */
export class InputState {
  yaw = 0;
  pitch = 0;
  /** Zoomed aim lowers mouse sensitivity by this factor (set by the session). */
  sensitivityScale = 1;
  private keys = new Set<string>();
  private fireDown = false;
  private zoomDown = false;
  private jumpQueued = false;
  private reloadQueued = false;
  private useQueued = false;
  private throwQueued = false;
  /** G is held: aiming a throw. */
  throwAiming = false;
  /** Crouch / prone toggles (C, Z). */
  crouchOn = false;
  proneOn = false;
  /** Set by the session: the held weapon has a second trigger (RMB fires it instead of zooming). */
  altTrigger = false;
  /** Weapon slot requested with number keys (0 = none pending). */
  private slotRequest = 0;
  /** Mouse wheel steps since last read (+ = next weapon). */
  private wheelSteps = 0;
  readonly onToggle = new Map<string, () => void>();
  private readonly abort = new AbortController();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const opts = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Tab' || e.code === 'F3' || e.code === 'F5') e.preventDefault();
        // Safari otherwise acts on plain letter keys in play (e.g. the character/emoji picker).
        else if (this.locked && !e.metaKey && !e.ctrlKey && e.code !== 'Escape' && !/^F\d+$/.test(e.code)) e.preventDefault();
        if (!e.repeat) this.onToggle.get(e.code)?.();
        this.keys.add(e.code);
        if (e.code === 'Space') this.jumpQueued = true;
        if (e.code === 'KeyR') this.reloadQueued = true;
        if (e.code === 'KeyE' && !e.repeat) this.useQueued = true;
        // C crouches and Z lies prone (toggles); jumping or sprinting gets you up.
        if (e.code === 'KeyC' && !e.repeat) {
          this.crouchOn = !this.crouchOn;
          this.proneOn = false;
        }
        if (e.code === 'KeyZ' && !e.repeat) {
          this.proneOn = !this.proneOn;
          this.crouchOn = false;
        }
        if ((e.code === 'Space' || e.code === 'ShiftLeft') && !e.repeat) this.crouchOn = this.proneOn = false;
        // Hold G to aim a throw (the arc shows), let go to throw.
        if (e.code === 'KeyG' && !e.repeat) this.throwAiming = true;
        const digit = /^Digit([1-9])$/.exec(e.code);
        if (digit) this.slotRequest = Number(digit[1]);
      },
      opts,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        this.keys.delete(e.code);
        if (e.code === 'KeyG' && this.throwAiming) {
          this.throwAiming = false;
          this.throwQueued = true;
        }
      },
      opts,
    );
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.fireDown = this.zoomDown = this.throwAiming = false;
      },
      opts,
    );
    // Pointer events, not mouse events: Safari drops the compatibility mousedown under
    // pointer lock (the engine cancels pointerdown). `buttons` also covers chorded presses.
    const buttons = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const press = this.locked || e.target === canvas;
      this.fireDown = (e.buttons & 1) !== 0 && (press || this.fireDown);
      this.zoomDown = (e.buttons & 2) !== 0 && (press || this.zoomDown);
    };
    window.addEventListener('pointerdown', buttons, opts);
    window.addEventListener('pointerup', buttons, opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.locked) this.wheelSteps += Math.sign(e.deltaY);
      },
      opts,
    );
    // pointermove, not mousemove: Safari doesn't reliably report locked-pointer movement on mousemove.
    window.addEventListener(
      'pointermove',
      (e) => {
        buttons(e);
        if (!this.locked || e.pointerType === 'touch') return;
        const s = MOUSE_SENSITIVITY * this.sensitivityScale;
        this.yaw += e.movementX * s;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - e.movementY * s));
      },
      opts,
    );
  }

  dispose(): void {
    this.abort.abort();
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  get zooming(): boolean {
    return this.locked && this.zoomDown;
  }

  held(code: string): boolean {
    return this.keys.has(code);
  }

  /** Consume a pending number-key weapon request. */
  takeSlotRequest(): number {
    const s = this.slotRequest;
    this.slotRequest = 0;
    return s;
  }

  /** Consume accumulated wheel steps. */
  takeWheel(): number {
    const w = this.wheelSteps;
    this.wheelSteps = 0;
    return w;
  }

  /** Sample movement axes and buttons for one simulation tick. */
  sample(): { forward: number; right: number; buttons: number } {
    // Automation hook for browser tests and screenshots (no pointer lock in headless browsers).
    const auto = (window as unknown as { __autoInput?: { forward?: number; right?: number; buttons?: number; once?: number } }).__autoInput;
    if (auto) {
      // `once`: buttons for a single tick (like a key press of E).
      const once = auto.once ?? 0;
      auto.once = 0;
      return { forward: auto.forward ?? 0, right: auto.right ?? 0, buttons: (auto.buttons ?? 0) | once };
    }
    if (!this.locked) return { forward: 0, right: 0, buttons: 0 };
    const axis = (pos: string, neg: string) => (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    let buttons = 0;
    if (this.jumpQueued || this.keys.has('Space')) buttons |= BUTTON_JUMP;
    if (this.fireDown) buttons |= BUTTON_FIRE;
    if (this.reloadQueued) buttons |= BUTTON_RELOAD;
    // Right mouse: the held weapon's second trigger if it has one, otherwise zoom.
    if (this.zoomDown) buttons |= this.altTrigger ? BUTTON_ALT : BUTTON_ZOOM;
    if (this.throwQueued) buttons |= BUTTON_THROW;
    // Shift sprints, except through a scope, where it holds your breath.
    if (this.keys.has('ShiftLeft') && !this.zoomDown) buttons |= BUTTON_SPRINT;
    if (this.crouchOn) buttons |= BUTTON_CROUCH;
    if (this.proneOn) buttons |= BUTTON_PRONE;
    if (this.useQueued) buttons |= BUTTON_USE;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.useQueued = false;
    this.throwQueued = false;
    return { forward: axis('KeyW', 'KeyS'), right: axis('KeyD', 'KeyA'), buttons };
  }
}
