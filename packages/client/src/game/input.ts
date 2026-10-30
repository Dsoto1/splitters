import { LookFilter, browserLookScale } from './lookFilter.ts';
import { CLASS_SAY_BASE, EMOTE_DANCE, PING, QUICK_MESSAGES, BUTTON_ALT, BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, BUTTON_MELEE, BUTTON_PRONE, BUTTON_RELOAD, BUTTON_RESPAWN, BUTTON_SPRINT, BUTTON_THROW, BUTTON_USE, BUTTON_ZOOM } from '@tiletrigger/shared';

const MOUSE_SENSITIVITY = 0.0022;
const MOUSE_PREF_KEY = 'tiletrigger.mouse';
const HAS_COALESCED = typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getCoalescedEvents === 'function';

/** The player's mouse settings, kept between sessions. */
export interface MousePrefs {
  /** Multiplier on look speed (0.2–4). */
  sensitivity: number;
  /** Multiplier on look speed while aiming down the sights or scoped (0.2–3), on top of the zoom's own 1:1 scaling. */
  zoomSensitivity: number;
  invertY: boolean;
  /** Gently pulls the sights onto enemies near the crosshair (touchpads, controllers). */
  aimAssist: boolean;
}

export function loadMousePrefs(): MousePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(MOUSE_PREF_KEY) ?? '{}') as Partial<MousePrefs>;
    return {
      sensitivity: Math.min(4, Math.max(0.2, Number(p.sensitivity) || 1)),
      zoomSensitivity: Math.min(3, Math.max(0.2, Number(p.zoomSensitivity) || 1)),
      invertY: p.invertY === true,
      aimAssist: p.aimAssist === true,
    };
  } catch {
    return { sensitivity: 1, zoomSensitivity: 1, invertY: false, aimAssist: false };
  }
}

export function saveMousePrefs(p: MousePrefs): void {
  try {
    localStorage.setItem(MOUSE_PREF_KEY, JSON.stringify(p));
  } catch {
    // Private windows: the setting lasts for this session.
  }
}
/**
 * The weapon wheel's key (Options → Controls rebinds it). Held, it opens a
 * radial pick of the weapons you carry; a quick tap still does the key's own
 * job (Q: back to your last weapon).
 */
const WHEEL_KEY_PREF = 'tiletrigger.wheelKey';
export const DEFAULT_WHEEL_KEY = 'KeyQ';
/** Keys the game already uses for something else (a wheel there would fight them). Q isn't here: a tap keeps its quick switch. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyC', 'KeyZ', 'KeyF', 'KeyX', 'KeyV', 'KeyG', 'KeyY', 'KeyR', 'KeyE', 'KeyH', 'KeyK', 'KeyB', 'KeyN', 'KeyT', 'KeyL', 'Comma',
  'Tab', 'Escape', 'Enter', 'F3', 'F5', 'F11', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'MetaLeft', 'MetaRight',
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
]);
export function loadWheelKey(): string {
  try {
    const k = localStorage.getItem(WHEEL_KEY_PREF);
    if (k && !RESERVED_KEYS.has(k)) return k;
  } catch {
    // Private windows: the default.
  }
  return DEFAULT_WHEEL_KEY;
}
export function saveWheelKey(code: string): void {
  try {
    localStorage.setItem(WHEEL_KEY_PREF, code);
  } catch {
    // Lasts for this page.
  }
}
/** "KeyQ" → "Q", "Backquote" → "`": how a key code reads in the menus. */
export function keyLabel(code: string): string {
  const named: Record<string, string> = { Backquote: '`', CapsLock: 'Caps Lock', AltLeft: 'Left Alt', AltRight: 'Right Alt', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', ShiftRight: 'Right Shift', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Slash: '/', Period: '.', Minus: '-', Equal: '=' };
  return named[code] ?? code.replace(/^Key/, '').replace(/^Numpad/, 'Num ');
}
/** Held this long, the wheel key (or a controller's Y) opens the wheel; a shorter press is a tap. */
export const WHEEL_HOLD_MS = 180;
/** Touch look: radians per pixel dragged, at sensitivity 1. */
const TOUCH_LOOK = 0.0055;

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
  /** Zoomed aim lowers look speed by this factor (set by the session each frame: zoomLookScale). */
  sensitivityScale = 1;
  /** Locked-pointer deltas, cleaned and summed until the next frame (see lookFilter.ts). */
  readonly look = new LookFilter(browserLookScale(navigator.userAgent, HAS_COALESCED));
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
  /** A side mouse button (or Y): quick melee. */
  private meleeDown = false;
  /** Weapon slot requested with number keys (0 = none pending). */
  private slotRequest = 0;
  /** Mouse wheel steps since last read (+ = next weapon). */
  private wheelSteps = 0;
  readonly onToggle = new Map<string, () => void>();
  /**
   * Out of play (dead, or spectating by choice), set by the session: clicks, the arrow keys (following) and
   * a controller's shoulder buttons pick whom to watch instead of playing (takeSpectate). `spectatingFree`:
   * the free camera flies, so the arrow keys turn it as usual.
   */
  spectating = false;
  spectatingFree = false;
  private specStep = 0;
  private specToggle = false;
  /** A spectator control was used (a pick, the camera toggle, Y): the session sends it as activity. */
  private specUsed = false;
  /** Gamepad state from the last frame: sticks, and which buttons were down (for presses). */
  private pad = { move: { x: 0, y: 0 }, fire: false, zoom: false, sprint: false, jump: false, prev: [] as boolean[] };
  /** A controller has been used since the page loaded (its sticks and triggers count). */
  padActive = false;
  /** Weapon wheel: its key, whether it's open, and where it points (x right, y down; length up to 1). */
  wheelKey = loadWheelKey();
  wheelOpen = false;
  readonly wheelAim = { x: 0, y: 0 };
  /** Set by the session each frame: whether the wheel may open now (alive, on foot). */
  canOpenWheel = true;
  /** What opened the wheel (letting go of it picks), and when the wheel key / Y went down (0: not held). */
  private wheelBy: 'key' | 'pad' | 'touch' | null = null;
  private wheelKeyAt = 0;
  private padWheelAt = 0;
  /** How the wheel last closed, until the session reads it: true picks the highlighted weapon, false cancels. */
  private wheelClosed: boolean | null = null;
  /** The fire button that picked from the wheel is still down: no shot until it's let go. */
  private fireLatch = false;
  /** Phones and tablets (touchControls.ts): play is on without pointer lock, and the on-screen controls feed this class. */
  touchEngaged = false;
  /** Called when touch play starts or stops (the session shows or hides the pause menu). */
  onEngage?: () => void;
  private readonly touchMove = { x: 0, y: 0 };
  private readonly touchLook = { dx: 0, dy: 0 };
  private readonly abort = new AbortController();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const opts = { signal: this.abort.signal };
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Tab' || e.code === 'F3' || e.code === 'F5') e.preventDefault();
        // Safari otherwise acts on plain letter keys in play (e.g. the character/emoji picker).
        else if (this.locked && !e.metaKey && !e.ctrlKey && e.code !== 'Escape' && !/^F\d+$/.test(e.code)) e.preventDefault();
        this.keyDown(e);
      },
      opts,
    );
    window.addEventListener('keyup', (e) => this.keyUp(e.code), opts);
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.fireDown = this.zoomDown = this.altDown = this.meleeDown = this.throwAiming = this.keyFire = false;
        this.wheelKeyAt = this.padWheelAt = 0;
        this.closeWheel(false);
      },
      opts,
    );
    // Pointer events, not mouse events: Safari drops the compatibility mousedown under
    // pointer lock (the engine cancels pointerdown). `buttons` also covers chorded presses.
    const buttons = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const press = this.locked || e.target === canvas;
      // Watching: a left click is the next player, a right click the previous one.
      if (this.spectating && this.locked && e.type === 'pointerdown') {
        if (e.buttons & 1 && !this.fireDown) this.specStep++;
        if (e.buttons & 2 && !this.zoomDown) this.specStep--;
        this.specUsed = true;
      }
      const wasFire = this.fireDown;
      this.fireDown = (e.buttons & 1) !== 0 && (press || this.fireDown);
      this.zoomDown = (e.buttons & 2) !== 0 && (press || this.zoomDown);
      this.altDown = (e.buttons & 4) !== 0 && (press || this.altDown);
      this.meleeDown = (e.buttons & 24) !== 0 && (press || this.meleeDown);
      // A click with the wheel open picks the weapon it points at (and doesn't fire).
      if (this.wheelOpen && this.fireDown && !wasFire) {
        this.closeWheel(true);
        this.fireLatch = true;
      }
    };
    window.addEventListener('pointerdown', buttons, opts);
    window.addEventListener('pointerup', buttons, opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    // The side buttons are quick melee in play, not the browser's back and forward.
    window.addEventListener(
      'mouseup',
      (e) => {
        if (this.locked && (e.button === 3 || e.button === 4)) e.preventDefault();
      },
      opts,
    );
    window.addEventListener(
      'wheel',
      (e) => {
        if (this.locked && !this.wheelOpen) this.scroll(e);
      },
      opts,
    );
    // pointermove, not mousemove: Safari doesn't reliably report locked-pointer movement on mousemove.
    // Deltas go through the look filter and turn the view once per frame (frame()).
    window.addEventListener(
      'pointermove',
      (e) => {
        buttons(e);
        if (!this.locked || e.pointerType === 'touch') return;
        const subs = HAS_COALESCED ? e.getCoalescedEvents() : [];
        this.look.push({ dx: e.movementX, dy: e.movementY, t: e.timeStamp, coalesced: subs.length > 1 ? subs.map((c) => ({ dx: c.movementX, dy: c.movementY })) : undefined });
      },
      opts,
    );
    // A new lock (or coming back to the window) starts afresh: the first move after it can be the cursor's jump.
    document.addEventListener('pointerlockchange', (e) => this.look.reset(e.timeStamp), opts);
    window.addEventListener('focus', (e) => this.look.reset(e.timeStamp), opts);
    // Diagnostics for the console (e.g. in Safari): how many moves were re-summed or dropped.
    (window as unknown as { __lookStats?: unknown }).__lookStats = this.look.stats;
  }

  /**
   * A key going down, from the keyboard or an on-screen control (virtualKey):
   * every key's job lives here once, so touch plays through the same path.
   */
  private keyDown(e: { code: string; repeat: boolean }): void {
    // The wheel key: held, it opens the wheel; a tap does the key's own job when let go (keyUp).
    if (e.code === this.wheelKey) {
      if (!e.repeat) {
        this.wheelKeyAt = performance.now();
        // A key with no job of its own opens the wheel at once.
        if (!this.onToggle.has(e.code)) this.openWheel('key');
      }
      this.keys.add(e.code);
      return;
    }
    if (!e.repeat) this.onToggle.get(e.code)?.();
    this.keys.add(e.code);
    // Following someone: the arrow keys pick the previous or next player (the camera follows them, so turning does nothing).
    if (this.spectating && !this.spectatingFree && !e.repeat && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
      this.specStep += e.code === 'ArrowRight' ? 1 : -1;
      this.specUsed = true;
    }
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
  }

  private keyUp(code: string): void {
    this.keys.delete(code);
    if (code === this.wheelKey) {
      const held = this.wheelKeyAt;
      this.wheelKeyAt = 0;
      if (this.wheelOpen && this.wheelBy === 'key') this.closeWheel(true);
      // A tap: the key's own job (Q: back to your last weapon).
      else if (held && !this.wheelOpen) this.onToggle.get(code)?.();
      return;
    }
    if (code === 'KeyF') this.keyFire = false;
    if (code === 'KeyG' && this.throwAiming) {
      this.throwAiming = false;
      this.throwQueued = true;
    }
  }

  /** An on-screen control pressing or letting go of a key (touchControls.ts): exactly what that key does. */
  virtualKey(code: string, down: boolean): void {
    if (down) this.keyDown({ code, repeat: this.keys.has(code) });
    else if (this.keys.has(code)) this.keyUp(code);
  }

  /** Touch: the movement pad (x right, y forward; each −1..1). */
  setTouchMove(x: number, y: number): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  /** Touch: a look drag of (dx, dy) pixels, turned into view with the next frame. */
  addTouchLook(dx: number, dy: number): void {
    this.touchLook.dx += dx;
    this.touchLook.dy += dy;
  }

  /** Touch play on or off (Resume, the pause button): it stands in for pointer lock. */
  setTouchEngaged(on: boolean): void {
    if (this.touchEngaged === on) return;
    this.touchEngaged = on;
    if (!on) {
      for (const k of [...this.keys]) this.keyUp(k);
      this.setTouchMove(0, 0);
      this.touchLook.dx = this.touchLook.dy = 0;
      this.closeWheel(false);
    }
    this.onEngage?.();
  }

  /** Open the weapon wheel (when the session allows it now). */
  openWheel(by: 'key' | 'pad' | 'touch'): void {
    if (this.wheelOpen || !this.canOpenWheel) return;
    this.wheelOpen = true;
    this.wheelBy = by;
    this.wheelAim.x = this.wheelAim.y = 0;
    this.wheelClosed = null;
  }

  /** Close the wheel: `pick` switches to the weapon it points at; otherwise nothing changes. */
  closeWheel(pick: boolean): void {
    if (!this.wheelOpen) return;
    this.wheelOpen = false;
    this.wheelBy = null;
    this.wheelClosed = pick;
  }

  /** How the wheel closed since last asked: true (pick), false (cancelled) or null (it didn't). */
  takeWheelClose(): boolean | null {
    const c = this.wheelClosed;
    this.wheelClosed = null;
    return c;
  }

  /** Point the wheel (x right, y down), kept within the unit circle. */
  aimWheel(x: number, y: number): void {
    const len = Math.hypot(x, y);
    const k = len > 1 ? 1 / len : 1;
    this.wheelAim.x = x * k;
    this.wheelAim.y = y * k;
  }

  dispose(): void {
    this.abort.abort();
  }

  /** In play: the mouse is captured, or (phones and tablets) touch play is on. */
  get locked(): boolean {
    return document.pointerLockElement === this.canvas || this.touchEngaged;
  }

  get zooming(): boolean {
    // Tests can hold the aim with window.__autoInput = { zoom: true }.
    return (this.locked && !this.wheelOpen && (this.zoomDown || this.keys.has('KeyX') || this.pad.zoom)) || !!(window as unknown as { __autoInput?: { zoom?: boolean } }).__autoInput?.zoom;
  }

  held(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * Once per rendered frame: arrow keys and a controller's right stick turn the
   * view; the controller's buttons are read here too (Gamepad API is polled).
   */
  frame(dt: number): void {
    const move = this.look.take();
    const touch = { dx: this.touchLook.dx, dy: this.touchLook.dy };
    this.touchLook.dx = this.touchLook.dy = 0;
    if (!this.locked) {
      this.closeWheel(false);
      return;
    }
    // The wheel key held past a tap opens the wheel.
    if (this.wheelKeyAt && !this.wheelOpen && performance.now() - this.wheelKeyAt >= WHEEL_HOLD_MS) this.openWheel('key');
    if (!this.fireDown && !this.keyFire && !this.pad.fire) this.fireLatch = false;
    const scale = this.sensitivityScale * this.mouse.sensitivity;
    const invert = this.mouse.invertY ? -1 : 1;
    if (this.wheelOpen) {
      // The wheel takes the look: the mouse points it (about 120 pixels to the rim) and the view holds still.
      this.aimWheel(this.wheelAim.x + move.dx / 120, this.wheelAim.y + move.dy / 120);
      this.pollPad(dt, scale, invert);
      return;
    }
    this.yaw += move.dx * MOUSE_SENSITIVITY * scale;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - move.dy * MOUSE_SENSITIVITY * scale * invert));
    // A finger dragging on the right of the screen (touchControls.ts).
    this.yaw += touch.dx * TOUCH_LOOK * scale;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - touch.dy * TOUCH_LOOK * scale * invert));
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
    // Squared response: fine aim near the centre, fast turns at full tilt. With the wheel open the right stick points it.
    if (this.wheelOpen) {
      if (Math.hypot(rx, ry) > 0.35) this.aimWheel(rx * 1.5, ry * 1.5);
    } else {
      this.yaw += rx * Math.abs(rx) * STICK_TURN * scale * dt;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - ry * Math.abs(ry) * STICK_TURN * 0.7 * scale * invert * dt));
    }
    p.fire = !!down[PAD.rt];
    p.zoom = !!down[PAD.lt];
    p.jump = !!down[PAD.a];
    if (this.spectating) {
      // Watching: the shoulder buttons pick the next or previous player, Y switches the camera (follow / free).
      if (pressed(PAD.rb)) this.specStep++;
      if (pressed(PAD.lb)) this.specStep--;
      if (pressed(PAD.y)) this.specToggle = true;
      if (down.some(Boolean) || lx || ly || rx || ry) this.specUsed = true;
      p.prev = down;
      return;
    }
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
    // Y: a tap is the next weapon; held, it opens the weapon wheel (the right stick points, let go to switch).
    if (pressed(PAD.y)) this.padWheelAt = performance.now();
    if (down[PAD.y] && this.padWheelAt && !this.wheelOpen && performance.now() - this.padWheelAt >= WHEEL_HOLD_MS) this.openWheel('pad');
    if (!down[PAD.y] && p.prev[PAD.y]) {
      if (this.wheelOpen && this.wheelBy === 'pad') this.closeWheel(true);
      else if (this.padWheelAt && performance.now() - this.padWheelAt < WHEEL_HOLD_MS) this.wheelSteps += 1;
      this.padWheelAt = 0;
    }
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

  /** Consume the spectator picks since last asked: `step` (+ next, - previous), the camera toggle (Space, Y), and whether any control was used. */
  takeSpectate(): { step: number; toggle: boolean; used: boolean } {
    const out = { step: this.specStep, toggle: this.specToggle, used: this.specUsed };
    this.specStep = 0;
    this.specToggle = false;
    this.specUsed = false;
    return out;
  }

  /** Space (or Y on a controller) while watching: switch between following and the free camera. */
  toggleSpectateCamera(): void {
    this.specToggle = true;
    this.specUsed = true;
  }

  /** The free camera's climb: E (or the right trigger) up, Q or Ctrl (or the left trigger) down. */
  spectateVertical(): number {
    const auto = (window as unknown as { __autoInput?: { up?: number } }).__autoInput;
    if (auto?.up) return auto.up;
    return (this.keys.has('KeyE') || this.pad.fire ? 1 : 0) - (this.keys.has('KeyQ') || this.keys.has('ControlLeft') || this.pad.zoom ? 1 : 0);
  }

  /** Consume a pending number-key weapon request. */
  takeSlotRequest(): number {
    const s = this.slotRequest;
    this.slotRequest = 0;
    return s;
  }

  /** Scroll so far towards the next step (pixels), when the last step was, and the last scroll event. */
  private scrollAcc = 0;
  private scrollStepAt = 0;
  private scrollAt = 0;

  /**
   * One weapon step per notch of a mouse wheel, and per ~60 px of a trackpad or smooth-scrolling mouse (which send
   * dozens of small events per flick: one step each skipped through several weapons at once), at most one step per
   * 90 ms, so a flick's momentum doesn't keep cycling.
   */
  private scroll(e: WheelEvent): void {
    const now = e.timeStamp;
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    if (now - this.scrollAt > 250 || Math.sign(px) !== Math.sign(this.scrollAcc)) this.scrollAcc = 0;
    this.scrollAt = now;
    this.scrollAcc += px;
    if (Math.abs(this.scrollAcc) < 50 || now - this.scrollStepAt < 90) return;
    this.wheelSteps += Math.sign(this.scrollAcc);
    this.scrollAcc = 0;
    this.scrollStepAt = now;
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
    // Side mouse button or Y: quick melee (punch or kick, or a swing of a melee weapon in hand).
    if (this.meleeDown || this.keys.has('KeyY')) buttons |= BUTTON_MELEE;
    // The wheel is open (or the click that picked from it is still held): no shooting, aiming or swinging; moving goes on.
    if (this.wheelOpen) buttons &= ~(BUTTON_FIRE | BUTTON_ZOOM | BUTTON_ALT | BUTTON_MELEE | BUTTON_THROW);
    if (this.fireLatch) buttons &= ~BUTTON_FIRE;
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
    return { forward: clamp(axis('KeyW', 'KeyS') + this.pad.move.y + this.touchMove.y), right: clamp(axis('KeyD', 'KeyA') + this.pad.move.x + this.touchMove.x), buttons, ...(say ? { say } : {}) };
  }
}
