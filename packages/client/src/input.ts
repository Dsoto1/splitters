import { BUTTON_FIRE, BUTTON_JUMP } from '@chronosplit/shared';

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = 1.5;

/** Keyboard + pointer-lock mouse. View angles accumulate here; movement is sampled once per tick. */
export class InputState {
  yaw = 0;
  pitch = 0;
  private keys = new Set<string>();
  private mouseDown = false;
  private jumpQueued = false;
  readonly onToggle = new Map<string, () => void>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'F3') e.preventDefault();
      if (!e.repeat) this.onToggle.get(e.code)?.();
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw += e.movementX * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - e.movementY * MOUSE_SENSITIVITY));
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  held(code: string): boolean {
    return this.keys.has(code);
  }

  /** Sample movement axes and buttons for one simulation tick. */
  sample(): { forward: number; right: number; buttons: number } {
    if (!this.locked) return { forward: 0, right: 0, buttons: 0 };
    const axis = (pos: string, neg: string) => (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    let buttons = 0;
    if (this.jumpQueued || this.keys.has('Space')) buttons |= BUTTON_JUMP;
    if (this.mouseDown) buttons |= BUTTON_FIRE;
    this.jumpQueued = false;
    return { forward: axis('KeyW', 'KeyS'), right: axis('KeyD', 'KeyA'), buttons };
  }
}
