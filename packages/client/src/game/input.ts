import { BUTTON_FIRE, BUTTON_JUMP, BUTTON_RELOAD, BUTTON_USE, BUTTON_ZOOM } from '@chronosplit/shared';

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
        if (!e.repeat) this.onToggle.get(e.code)?.();
        this.keys.add(e.code);
        if (e.code === 'Space') this.jumpQueued = true;
        if (e.code === 'KeyR') this.reloadQueued = true;
        if (e.code === 'KeyE' && !e.repeat) this.useQueued = true;
        const digit = /^Digit([1-9])$/.exec(e.code);
        if (digit) this.slotRequest = Number(digit[1]);
      },
      opts,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), opts);
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.fireDown = this.zoomDown = false;
      },
      opts,
    );
    canvas.addEventListener(
      'mousedown',
      (e) => {
        if (e.button === 0) this.fireDown = true;
        if (e.button === 2) this.zoomDown = true;
      },
      opts,
    );
    window.addEventListener(
      'mouseup',
      (e) => {
        if (e.button === 0) this.fireDown = false;
        if (e.button === 2) this.zoomDown = false;
      },
      opts,
    );
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.locked) this.wheelSteps += Math.sign(e.deltaY);
      },
      opts,
    );
    window.addEventListener(
      'mousemove',
      (e) => {
        if (!this.locked) return;
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
    if (!this.locked) return { forward: 0, right: 0, buttons: 0 };
    const axis = (pos: string, neg: string) => (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    let buttons = 0;
    if (this.jumpQueued || this.keys.has('Space')) buttons |= BUTTON_JUMP;
    if (this.fireDown) buttons |= BUTTON_FIRE;
    if (this.reloadQueued) buttons |= BUTTON_RELOAD;
    if (this.zoomDown) buttons |= BUTTON_ZOOM;
    if (this.useQueued) buttons |= BUTTON_USE;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.useQueued = false;
    return { forward: axis('KeyW', 'KeyS'), right: axis('KeyD', 'KeyA'), buttons };
  }
}
