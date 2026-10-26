import { CLASS_SAY_BASE, EMOTE_DANCE, PING, QUICK_MESSAGES, BUTTON_ALT, BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, BUTTON_PRONE, BUTTON_RELOAD, BUTTON_RESPAWN, BUTTON_SPRINT, BUTTON_THROW, BUTTON_USE, BUTTON_ZOOM } from '@tiletrigger/shared';

const MOUSE_SENSITIVITY = 0.0022;
const MOUSE_PREF_KEY = 'tiletrigger.mouse';
/** Safari reports locked-pointer movement at roughly half the scale of other browsers. */
const BROWSER_SCALE = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(navigator.userAgent) ? 2 : 1;

/** The player's mouse settings, kept between sessions. */
export interface MousePrefs {
  /** Multiplier on look speed (0.2–4). */
  sensitivity: number;
  invertY: boolean;
  /** Gently pulls the sights onto enemies near the crosshair (touchpads, controllers). */
  aimAssist: boolean;
}

export function loadMousePrefs(): MousePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(MOUSE_PREF_KEY) ?? '{}') as Partial<MousePrefs>;
    return { sensitivity: Math.min(4, Math.max(0.2, Number(p.sensitivity) || 1)), invertY: p.invertY === true, aimAssist: p.aimAssist === true };
  } catch {
    return { sensitivity: 1, invertY: false, aimAssist: false };
  }
}

export function saveMousePrefs(p: MousePrefs): void {
  try {
    localStorage.setItem(MOUSE_PREF_KEY, JSON.stringify(p));
  } catch {
    // Private windows: the setting lasts for this session.
  }
}
const PITCH_LIMIT = 1.5;
/** Arrow-key turning, radians per second at sensitivity 1. */
const KEY_TURN = 2.4;
/** Right-stick turning at full tilt, radians per second at sensitivity 1. */
const STICK_TURN = 3.4;
const STICK_DEADZONE = 0.15;

/** Standard-mapping gamepad buttons. */
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 } as const;

const deadzone = (v: number) => (Math.abs(v) < STICK_DEADZONE ? 0 : Math.sign(v) * ((Math.abs(v) - STICK_DEADZONE) / (1 - STICK_DEADZONE)));

/** Keyboard + pointer-lock mouse. View angles accumulate here; movement is sampled once per tick. */
export class InputState {
  yaw = 0;
  pitch = 0;
  /** Zoomed aim lowers mouse sensitivity by this factor (set by the session). */
  sensitivityScale = 1;
  /** The player's own look settings (Options / pause menu). */
  mouse: MousePrefs = loadMousePrefs();
  private keys = new Set<string>();
  private fireDown = false;
  private keyFire = false;
  private zoomDown = false;
  private jumpQueued = false;
  private reloadQueued = false;
  private useQueued = false;
  private throwQueued = false;
  /** G is held: aiming a throw. */
  throwAiming = false;
  /** Crouch / prone toggles (C, Z). */
  crouchOn = false;
  /** Respawn asked for (K, or the pause menu): sent with the next input. */
  respawnQueued = false;
  /** The quick-message menu is open (B): digits pick a message instead of a weapon. */
  msgMenu = false;
  /** A quick message or emote to send with the next input. */
  private sayQueued = 0;
  /** Classes: how many classes there are (0: the match has none), and whether the class screen is open (L or ,): digits pick a class. */
  classCount = 0;
  classMenu = false;
  proneOn = false;
  /** Set by the session: right mouse fires the held weapon's second trigger instead of aiming (melee heavy swings). */
  altTrigger = false;
  /** Middle mouse (or V): the held weapon's second trigger. */
  private altDown = false;
  /** Weapon slot requested with number keys (0 = none pending). */
  private slotRequest = 0;
  /** Mouse wheel steps since last read (+ = next weapon). */
  private wheelSteps = 0;
  readonly onToggle = new Map<string, () => void>();
  /** Gamepad state from the last frame: sticks, and which buttons were down (for presses). */
  private pad = { move: { x: 0, y: 0 }, fire: false, zoom: false, sprint: false, jump: false, prev: [] as boolean[] };
  /** A controller has been used since the page loaded (its sticks and triggers count). */
  padActive = false;
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
        // F fires and X aims, for touchpads, where clicking while dragging a finger is awkward.
        if (e.code === 'KeyF') this.keyFire = true;
        if (e.code === 'KeyE' && !e.repeat) this.useQueued = true;
        if (e.code === 'KeyK' && !e.repeat) this.respawnQueued = true;
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
        // B opens the quick-message menu; N dances.
        if (e.code === 'KeyB' && !e.repeat) this.msgMenu = !this.msgMenu;
        if (e.code === 'KeyN' && !e.repeat) this.sayQueued = EMOTE_DANCE;
        if (e.code === 'KeyT' && !e.repeat) this.sayQueued = PING;
        if ((e.code === 'KeyL' || e.code === 'Comma') && !e.repeat && this.classCount) {
          this.classMenu = !this.classMenu;
          this.msgMenu = false;
        }
        const digit = /^Digit([1-9])$/.exec(e.code);
        if (digit && this.classMenu) {
          if (Number(digit[1]) <= this.classCount) this.chooseClass(Number(digit[1]) - 1);
        } else if (digit && this.msgMenu) {
          if (Number(digit[1]) <= QUICK_MESSAGES.length) this.sayQueued = Number(digit[1]);
          this.msgMenu = false;
        } else if (digit) this.slotRequest = Number(digit[1]);
      },
      opts,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        this.keys.delete(e.code);
        if (e.code === 'KeyF') this.keyFire = false;
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
        this.fireDown = this.zoomDown = this.altDown = this.throwAiming = this.keyFire = false;
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
      this.altDown = (e.buttons & 4) !== 0 && (press || this.altDown);
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
        const s = MOUSE_SENSITIVITY * this.sensitivityScale * this.mouse.sensitivity * BROWSER_SCALE;
        this.yaw += e.movementX * s;
        this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - e.movementY * s * (this.mouse.invertY ? -1 : 1)));
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
    // Tests can hold the aim with window.__autoInput = { zoom: true }.
    return (this.locked && (this.zoomDown || this.keys.has('KeyX') || this.pad.zoom)) || !!(window as unknown as { __autoInput?: { zoom?: boolean } }).__autoInput?.zoom;
  }

  held(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * Once per rendered frame: arrow keys and a controller's right stick turn the
   * view; the controller's buttons are read here too (Gamepad API is polled).
   */
  frame(dt: number): void {
    if (!this.locked) return;
    const scale = this.sensitivityScale * this.mouse.sensitivity;
    const invert = this.mouse.invertY ? -1 : 1;
    const key = (pos: string, neg: string) => (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    this.yaw += key('ArrowRight', 'ArrowLeft') * KEY_TURN * scale * dt;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + key('ArrowUp', 'ArrowDown') * KEY_TURN * 0.7 * scale * invert * dt));
    this.pollPad(dt, scale, invert);
  }

  private pollPad(dt: number, scale: number, invert: number): void {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected && g.mapping === 'standard');
    const p = this.pad;
    if (!pad) {
      p.move = { x: 0, y: 0 };
      p.fire = p.zoom = p.sprint = p.jump = false;
      return;
    }
    const down = pad.buttons.map((b) => b.pressed || b.value > 0.4);
    const pressed = (i: number) => !!down[i] && !p.prev[i];
    const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes.map(deadzone);
    if (down.some(Boolean) || lx || ly || rx || ry) this.padActive = true;
    p.move = { x: lx, y: -ly };
    // Squared response: fine aim near the centre, fast turns at full tilt.
    this.yaw += rx * Math.abs(rx) * STICK_TURN * scale * dt;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - ry * Math.abs(ry) * STICK_TURN * 0.7 * scale * invert * dt));
    p.fire = !!down[PAD.rt];
    p.zoom = !!down[PAD.lt];
    p.jump = !!down[PAD.a];
    if (pressed(PAD.l3)) p.sprint = !p.sprint;
    if (!lx && !ly) p.sprint = false;
    if (pressed(PAD.a)) {
      this.jumpQueued = true;
      this.crouchOn = this.proneOn = false;
    }
    if (pressed(PAD.x)) this.reloadQueued = true;
    if (pressed(PAD.rb)) this.useQueued = true;
    if (pressed(PAD.b)) {
      this.crouchOn = !this.crouchOn;
      this.proneOn = false;
    }
    if (pressed(PAD.y)) this.wheelSteps += 1;
    if (pressed(PAD.right)) this.wheelSteps += 1;
    if (pressed(PAD.left)) this.wheelSteps -= 1;
    if (pressed(PAD.up)) this.sayQueued = PING;
    if (pressed(PAD.down)) this.respawnQueued = true;
    // LB: hold to aim a throw, let go to throw (like G).
    if (pressed(PAD.lb)) this.throwAiming = true;
    if (!down[PAD.lb] && p.prev[PAD.lb] && this.throwAiming) {
      this.throwAiming = false;
      this.throwQueued = true;
    }
    if (pressed(PAD.r3)) this.onToggle.get('KeyH')?.();
    p.prev = down;
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
  /** Classes: pick class `index` (CLASS_IDS order), sent with the next input; closes the class screen. */
  chooseClass(index: number): void {
    this.sayQueued = CLASS_SAY_BASE + index;
    this.classMenu = false;
  }

  sample(): { forward: number; right: number; buttons: number; say?: number } {
    // Automation hook for browser tests and screenshots (no pointer lock in headless browsers).
    const auto = (window as unknown as { __autoInput?: { forward?: number; right?: number; buttons?: number; once?: number } }).__autoInput;
    if (auto) {
      // `once`: buttons for a single tick (like a key press of E).
      const once = auto.once ?? 0;
      auto.once = 0;
      return { forward: auto.forward ?? 0, right: auto.right ?? 0, buttons: (auto.buttons ?? 0) | once };
    }
    if (!this.locked) {
      // The class screen works with the pointer free (clicking a class): its pick still goes out.
      if (this.sayQueued >= CLASS_SAY_BASE) {
        const say = this.sayQueued;
        this.sayQueued = 0;
        return { forward: 0, right: 0, buttons: 0, say };
      }
      return { forward: 0, right: 0, buttons: 0 };
    }
    const axis = (pos: string, neg: string) => (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
    let buttons = 0;
    if (this.jumpQueued || this.keys.has('Space') || this.pad.jump) buttons |= BUTTON_JUMP;
    if (this.fireDown || this.keyFire || this.pad.fire) buttons |= BUTTON_FIRE;
    if (this.reloadQueued) buttons |= BUTTON_RELOAD;
    // Right mouse aims down the sights (or scopes); melee weapons swing heavy with it instead.
    const aim = this.zoomDown || this.keys.has('KeyX') || this.pad.zoom;
    if (aim) buttons |= this.altTrigger ? BUTTON_ALT : BUTTON_ZOOM;
    // Middle mouse or V: the second trigger (grenade launcher, alt fire…).
    if (this.altDown || this.keys.has('KeyV')) buttons |= BUTTON_ALT;
    if (this.throwQueued) buttons |= BUTTON_THROW;
    // Shift sprints, except through a scope, where it holds your breath.
    if ((this.keys.has('ShiftLeft') || this.pad.sprint) && !aim) buttons |= BUTTON_SPRINT;
    if (this.crouchOn) buttons |= BUTTON_CROUCH;
    if (this.proneOn) buttons |= BUTTON_PRONE;
    if (this.useQueued) buttons |= BUTTON_USE;
    if (this.respawnQueued) buttons |= BUTTON_RESPAWN;
    this.respawnQueued = false;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.useQueued = false;
    this.throwQueued = false;
    const say = this.sayQueued;
    this.sayQueued = 0;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    return { forward: clamp(axis('KeyW', 'KeyS') + this.pad.move.y), right: clamp(axis('KeyD', 'KeyA') + this.pad.move.x), buttons, ...(say ? { say } : {}) };
  }
}
