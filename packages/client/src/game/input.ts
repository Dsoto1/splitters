import { LookFilter, browserLookScale } from './lookFilter.ts';
import { AimLatch, combatPrefs } from './combatPrefs.ts';
import { CATEGORY_ACTIONS, bindAction, bindings as loadBindings, onBindingsChange, type Bindings } from './keyBindings.ts';
import { CLASS_SAY_BASE, ROULETTE_SAY_PICK, ROULETTE_SAY_REROLL, EMOTE_DANCE, PING, QUICK_MESSAGES, BUTTON_ALT, BUTTON_CROUCH, BUTTON_FIRE, BUTTON_JUMP, BUTTON_MELEE, BUTTON_PRONE, BUTTON_RELOAD, BUTTON_RESPAWN, BUTTON_SPRINT, BUTTON_THROW, BUTTON_USE, BUTTON_USE_HOLD, BUTTON_ZOOM, BUTTON_LEAN_LEFT, BUTTON_LEAN_RIGHT } from '@tiletrigger/shared';

const MOUSE_SENSITIVITY = 0.0022;
const MOUSE_PREF_KEY = 'tiletrigger.mouse';
const HAS_COALESCED = typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getCoalescedEvents === 'function';

/** The player's mouse settings, kept between sessions. */
export interface MousePrefs {
  /** Multiplier on look speed (0.2–4). */
  sensitivity: number;
  /** Multiplier on look speed while aiming down the sights or scoped (0.2–3), on top of the zoom's own 1:1 scaling. */
  zoomSensitivity: number;
  /** The right stick's look speed (0.2–3), apart from the mouse's: it does not follow `sensitivity`. */
  padLook: number;
  /** The right stick's look speed while aiming (0.2–3), as `zoomSensitivity` is the mouse's. */
  padZoom: number;
  /** How far a stick must move before it counts (0.05–0.3). */
  padDeadzone: number;
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
      padLook: Math.min(3, Math.max(0.2, Number(p.padLook) || 1)),
      padZoom: Math.min(3, Math.max(0.2, Number(p.padZoom) || 1)),
      padDeadzone: Math.min(0.3, Math.max(0.05, Number(p.padDeadzone) || STICK_DEADZONE)),
      invertY: p.invertY === true,
      aimAssist: p.aimAssist === true,
    };
  } catch {
    return { sensitivity: 1, zoomSensitivity: 1, padLook: 1, padZoom: 1, padDeadzone: STICK_DEADZONE, invertY: false, aimAssist: false };
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
 * The keys come from the bindings table (keyBindings.ts; Options → Controls rebinds every action). Fire mode's key,
 * for the HUD's hints.
 */
export { keyLabel } from './keyBindings.ts';
/** Held this long, the wheel key (or a controller's Y) opens the wheel; a shorter press is a tap. */
export const WHEEL_HOLD_MS = 180;
/** A press of the wheel's key shorter than this, where the wheel didn't open, is a tap. */
const TAP_MS = 400;
/** Mouse buttons (PointerEvent.buttons bits) as codes. */
const MOUSE_BITS: readonly [string, number][] = [['Mouse0', 1], ['Mouse2', 2], ['Mouse1', 4], ['MouseSide', 24]];
/** Touch look: radians per pixel dragged, at sensitivity 1. */
const TOUCH_LOOK = 0.0055;

const PITCH_LIMIT = 1.5;
/** Arrow-key turning, radians per second at sensitivity 1. */
const KEY_TURN = 2.4;
/** Right-stick turning at full tilt, radians per second at sensitivity 1. */
const STICK_TURN = 3.4;
const STICK_DEADZONE = 0.15;

/** How long B is held for prone (a tap is the crouch), ms. */
const PAD_PRONE_MS = 400;

/** Standard-mapping gamepad buttons. */
const PAD = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 } as const;

const deadzone = (v: number, dz = STICK_DEADZONE) => (Math.abs(v) < dz ? 0 : Math.sign(v) * ((Math.abs(v) - dz) / (1 - dz)));

/** Keyboard + pointer-lock mouse. View angles accumulate here; movement is sampled once per tick. */
export class InputState {
  yaw = 0;
  pitch = 0;
  /** Zoomed aim lowers look speed by this factor (set by the session each frame: zoomLookScale). */
  sensitivityScale = 1;
  /** The same for the right stick (set by the session each frame: zoomLookScale with the stick's own aim sensitivity). */
  padSensitivityScale = 1;
  /** Locked-pointer deltas, cleaned and summed until the next frame (see lookFilter.ts). */
  readonly look = new LookFilter(browserLookScale(navigator.userAgent, HAS_COALESCED));
  /** The player's own look settings (Options / pause menu). */
  mouse: MousePrefs = loadMousePrefs();
  /** Keys and mouse buttons down now, by code (keyBindings.ts: `KeyQ`, `Mouse0`…). */
  private keys = new Set<string>();
  /** Actions an on-screen control holds (touchControls.ts: virtualAction). */
  private readonly virt = new Set<string>();
  /** The bindings table, and code → the actions bound to it. */
  private b: Bindings = loadBindings();
  private byCode = new Map<string, string[]>();
  /** Set by the session each frame: seated in a vehicle or turret (its own keys work, the on-foot moves don't). */
  inVehicle = false;
  /** The scoreboard pinned open by a tap of its key (shared with the wheel) or touch's Scores button. */
  scoreboardPinned = false;
  /** Aim down the sights: held or toggled (Options → Accessibility, combatPrefs.ts). */
  private readonly aimLatch = new AimLatch();
  private jumpQueued = false;
  /** A jump for the tick after the next one sampled (jumpAfterStanding). */
  private jumpNext = false;
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
  /**
   * Fireteams: the order wheel may open now (set by the session: you lead a squad, alive, on foot). Then B held opens
   * the order wheel (a tap still opens the quick-message menu), as does a controller's d-pad up held (a tap pings),
   * and the Orders button on a phone.
   */
  ordersOn = false;
  /** When B (orders on) or the d-pad's up went down (0: not held), and whether that press opened the order wheel. */
  private msgKeyAt = 0;
  private msgWheeled = false;
  private padOrderAt = 0;
  /** How the order wheel last closed, until the session reads it (as wheelClosed is for weapons). */
  private orderClosed: boolean | null = null;
  /** A quick message or emote to send with the next input. */
  private sayQueued = 0;
  /** Classes: how many classes there are (0: the match has none), and whether the class screen is open (L or ,): digits pick a class. */
  classCount = 0;
  classMenu = false;
  proneOn = false;
  /** Set by the session: right mouse fires the held weapon's second trigger instead of aiming (melee heavy swings). */
  altTrigger = false;
  /**
   * Set by the session while you hold a pair (dual wielding; with `altTrigger`): the aim button is the second gun's
   * trigger, a press and release of it between two ticks still fires, and on touch the Fire button pulls both.
   */
  pairTrigger = false;
  /**
   * Set by the session: the weapon in hand has a scope or optic, so Shift (a controller's sprint) holds your breath
   * through it rather than sprinting, and doesn't let a toggled aim go (sprintPressed).
   */
  breathScope = false;
  /** The aim button went down since the last tick sampled (pairTrigger). */
  private altTap = false;
  /** Weapon category requested with its key (1-based, in the wheel's order; 0 = none pending). */
  private slotRequest = 0;
  /** The fire mode key was pressed (sim/fireModes.ts). */
  private fireModeQueued = false;
  /** Mouse wheel steps since last read (+ = next weapon). */
  private wheelSteps = 0;
  /** Fixed keys' jobs by code (F3, F5). */
  readonly onToggle = new Map<string, () => void>();
  /** Press actions' jobs by action id (keyBindings.ts: lastWeapon, bigMap, thirdPerson, vehicleCamera, specCamera, joinGame, switchTeam). */
  readonly onAction = new Map<string, () => void>();
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
  private pad = { move: { x: 0, y: 0 }, fire: false, zoom: false, sprint: false, jump: false, use: false, leanL: false, leanR: false, back: false, prev: [] as boolean[] };
  /**
   * The d-pad's left and right, each press told apart where it began: pressed while aiming it is a lean (held, until let
   * go or the aim ends; never a weapon switch); pressed otherwise it is a weapon switch, made when let go, unless the
   * aim began meanwhile. `at` is when it went down, 0 for not held.
   */
  private dpad = { l: { at: 0, lean: false, aimed: false }, r: { at: 0, lean: false, aimed: false } };
  /** When B went down (0: not held), and whether the hold already made prone (a tap is the crouch). */
  private padBAt = 0;
  private padBProne = false;
  /** A controller has been used since the page loaded (its sticks and triggers count). */
  padActive = false;
  /** Weapon wheel: whether it's open, and where it points (x right, y down; length up to 1). */
  wheelOpen = false;
  /** Which wheel is open: the weapon wheel or (Fireteams) the order wheel. Only one at a time. */
  wheelKind: 'weapon' | 'order' = 'weapon';
  readonly wheelAim = { x: 0, y: 0 };
  /** Set by the session each frame: whether the wheel may open now (alive, on foot). */
  canOpenWheel = true;
  /** What opened the wheel (letting go of it picks), and when the wheel key / Y went down (0: not held). */
  private wheelBy: 'key' | 'pad' | 'touch' | null = null;
  private wheelKeyAt = 0;
  /** The key that is holding the wheel open (or about to). */
  private wheelCode = '';
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
    this.setBindings(this.b);
    const off = onBindingsChange((b) => this.setBindings(b));
    this.abort.signal.addEventListener?.('abort', off);
    window.addEventListener('gamepadconnected', () => this.checkPadMapping(), opts);
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
    window.addEventListener(
      'keyup',
      (e) => {
        // Alt let go on its own would bring up some browsers' menu bar (Left Alt fires by default).
        if (this.locked && (e.code === 'AltLeft' || e.code === 'AltRight')) e.preventDefault();
        this.keyUp(e.code);
      },
      opts,
    );
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.throwAiming = false;
        this.aimLatch.cancel();
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
        if (e.buttons & 1 && !this.keys.has('Mouse0')) this.specStep++;
        if (e.buttons & 2 && !this.keys.has('Mouse2')) this.specStep--;
        this.specUsed = true;
      }
      // Each button as a code (Mouse0 left, Mouse2 right, Mouse1 middle, MouseSide either side button): its actions.
      for (const [code, bits] of MOUSE_BITS) {
        const was = this.keys.has(code);
        const now = (e.buttons & bits) !== 0 && (press || was);
        if (now && !was) this.keyDown({ code, repeat: false });
        else if (!now && was) this.keyUp(code);
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

  /** Take a bindings table (keyBindings.ts): read when the match starts and whenever Options changes it. */
  setBindings(b: Bindings): void {
    this.b = b;
    const by = new Map<string, string[]>();
    for (const [action, keys] of Object.entries(b)) for (const k of keys) if (k) by.set(k, [...(by.get(k) ?? []), action]);
    this.byCode = by;
  }

  /** Whether an action is held now: one of its keys (or mouse buttons), or an on-screen control. */
  active(action: string): boolean {
    if (this.virt.has(action)) return true;
    const k = this.b[action];
    return !!k && ((!!k[0] && this.keys.has(k[0])) || (!!k[1] && this.keys.has(k[1])));
  }

  /**
   * A key going down, from the keyboard, the mouse or an on-screen control: each code's actions (keyBindings.ts) do
   * their job here once, so touch plays through the same path.
   */
  private keyDown(e: { code: string; repeat: boolean }): void {
    const code = e.code;
    const acts = this.byCode.get(code) ?? [];
    if (!e.repeat) this.onToggle.get(code)?.();
    this.keys.add(code);
    // An open menu's numbers (fixed: 1-9): Roulette's death screen picks a card, the class screen a class, the
    // quick-message menu a message. Then the key's own actions (a weapon category) wait.
    const digit = /^Digit([1-9])$/.exec(code);
    if (digit && !e.repeat) {
      const n = Number(digit[1]);
      if (this.roulettePick && n <= this.roulettePick) return this.chooseRoulette(ROULETTE_SAY_PICK + n - 1);
      if (this.classMenu) {
        if (n <= this.classCount) this.chooseClass(n - 1);
        return;
      }
      if (this.msgMenu) {
        if (n <= QUICK_MESSAGES.length) this.sayQueued = n;
        this.msgMenu = false;
        return;
      }
    }
    // The wheel's key: held, it opens the wheel; a tap does the jobs that share the key when let go (keyUp).
    const wheelHere = acts.includes('weaponWheel');
    if (wheelHere && !e.repeat) {
      this.wheelKeyAt = performance.now();
      this.wheelCode = code;
      // A key with no tap job of its own opens the wheel at once.
      if (!acts.some((a) => bindAction(a)?.tap)) this.openWheel('key');
    }
    // A click of the fire button with the wheel open picks the weapon it points at (and doesn't fire).
    if (this.wheelOpen && !e.repeat && code.startsWith('Mouse') && acts.includes('fire')) {
      this.closeWheel(true);
      this.fireLatch = true;
    }
    for (const a of acts) if (a !== 'weaponWheel' && !(wheelHere && bindAction(a)?.tap)) this.press(a, e.repeat);
  }

  /** An action's key went down (`repeat`: the key's auto-repeat). */
  private press(a: string, repeat: boolean): void {
    const once = !repeat;
    const foot = !this.inVehicle;
    switch (a) {
      case 'jump':
        if (!foot) return;
        this.jumpQueued = true;
        if (once) this.crouchOn = this.proneOn = false;
        return;
      case 'vehicleUp':
        if (!foot) this.jumpQueued = true;
        return;
      case 'sprint':
        if (once && foot) {
          this.crouchOn = this.proneOn = false;
          this.sprintPressed();
        }
        return;
      case 'reload':
        // Roulette's death screen: the reload key spends a reroll token.
        if (once && this.rouletteReroll) this.chooseRoulette(ROULETTE_SAY_REROLL);
        else this.reloadQueued = true;
        return;
      case 'aim':
        if (once) {
          this.aimLatch.press();
          this.altTap = true;
        }
        return;
      case 'use':
        if (once) this.useQueued = true;
        return;
      case 'respawn':
        if (once) this.respawnQueued = true;
        return;
      // Crouch and prone are toggles; jumping or sprinting gets you up.
      case 'crouch':
        if (once && foot) {
          this.crouchOn = !this.crouchOn;
          this.proneOn = false;
        }
        return;
      case 'prone':
        if (once && foot) {
          this.proneOn = !this.proneOn;
          this.crouchOn = false;
        }
        return;
      // Hold to aim a throw (the arc shows), let go to throw.
      case 'throw':
        if (once) this.throwAiming = true;
        return;
      // The quick-message menu (Fireteams: held, the order wheel instead: frame() opens it, keyUp tells a tap from a hold).
      case 'quickMessage':
        if (!once) return;
        if (this.ordersOn) {
          this.msgKeyAt = performance.now();
          this.msgWheeled = false;
        } else this.msgMenu = !this.msgMenu;
        return;
      case 'fireMode':
        if (once) this.fireModeQueued = true;
        return;
      case 'dance':
        if (once) this.sayQueued = EMOTE_DANCE;
        return;
      case 'ping':
        if (once) this.sayQueued = PING;
        return;
      case 'classMenu':
        if (once && this.classCount) {
          this.classMenu = !this.classMenu;
          this.msgMenu = false;
        }
        return;
      case 'nextWeapon':
      case 'prevWeapon':
        if (once) this.wheelSteps += a === 'nextWeapon' ? 1 : -1;
        return;
      // Following someone: the previous or next player (the camera follows them, so turning does nothing).
      case 'specNext':
      case 'specPrev':
        if (once && this.spectating && !this.spectatingFree) {
          this.specStep += a === 'specNext' ? 1 : -1;
          this.specUsed = true;
        }
        return;
    }
    // A weapon category's key (1-8 by default). Not on a key's repeat: holding it doesn't spin through the slice.
    const n = (CATEGORY_ACTIONS as readonly string[]).indexOf(a);
    if (n >= 0) {
      if (once) this.slotRequest = n + 1;
      return;
    }
    if (once) this.onAction.get(a)?.();
  }

  private keyUp(code: string): void {
    this.keys.delete(code);
    for (const a of this.byCode.get(code) ?? []) this.release(a, code);
  }

  /** An action's key (`code`) let go. */
  private release(a: string, code: string): void {
    if (a === 'quickMessage' && this.msgKeyAt && !this.active(a)) {
      const wheeled = this.msgWheeled;
      this.msgKeyAt = 0;
      this.msgWheeled = false;
      // Let go of a held key: the order the wheel points at. A tap: the quick-message menu, as without Fireteams.
      if (this.wheelOpen && this.wheelKind === 'order' && this.wheelBy === 'key') this.closeWheel(true);
      else if (!wheeled) this.msgMenu = !this.msgMenu;
    } else if (a === 'weaponWheel' && code === this.wheelCode) {
      const held = this.wheelKeyAt;
      this.wheelKeyAt = 0;
      this.wheelCode = '';
      if (this.wheelOpen && this.wheelBy === 'key' && this.wheelKind === 'weapon') this.closeWheel(true);
      // A tap: the jobs that share the key (the scoreboard, the last weapon). A long hold where the wheel couldn't open isn't one.
      else if (held && !this.wheelOpen && performance.now() - held < TAP_MS) for (const t of this.byCode.get(code) ?? []) if (bindAction(t)?.tap) this.tap(t);
    } else if (a === 'throw' && this.throwAiming && !this.active(a)) {
      this.throwAiming = false;
      this.throwQueued = true;
    }
  }

  /** A tap action on the wheel's key. */
  private tap(a: string): void {
    if (a === 'scoreboard') this.scoreboardPinned = !this.scoreboardPinned;
    else this.onAction.get(a)?.();
  }

  /** Whether the scoreboard shows: pinned (a tap, touch's Scores), or its own key held (one it shares with the wheel only while the wheel can't open). */
  get scoreboardShown(): boolean {
    if (this.scoreboardPinned || this.pad.back) return true;
    if (!this.active('scoreboard')) return false;
    const wheel = this.b.weaponWheel ?? ['', ''];
    const shared = (this.b.scoreboard ?? ['', '']).every((k) => !k || !this.keys.has(k) || wheel.includes(k));
    return !shared || !this.canOpenWheel;
  }

  /** Touch's Scores button: show or hide the board. */
  toggleScoreboard(): void {
    this.scoreboardPinned = !this.scoreboardPinned;
  }

  /** Touch: jump one tick from now, once the tick sampled next has stood you up. A tap on the pad's middle that a
   * slow page first took for a hold has already crouched you, and a jump pressed while crouched only stands you up
   * (movement.ts): the tap stood you up and never jumped.
   */
  jumpAfterStanding(): void {
    this.jumpNext = true;
  }

  /** An on-screen control pressing or letting go of an action (touchControls.ts): exactly what its key does. */
  virtualAction(action: string, down: boolean): void {
    if (down) {
      const repeat = this.virt.has(action);
      this.virt.add(action);
      this.press(action, repeat);
    } else if (this.virt.delete(action)) this.release(action, '');
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
      for (const a of [...this.virt]) this.virtualAction(a, false);
      this.setTouchMove(0, 0);
      this.touchLook.dx = this.touchLook.dy = 0;
      this.closeWheel(false);
    }
    this.onEngage?.();
  }

  /** Open the weapon wheel, or (`kind` 'order') the order wheel, when the session allows it now. True if it opened. */
  openWheel(by: 'key' | 'pad' | 'touch', kind: 'weapon' | 'order' = 'weapon'): boolean {
    if (this.wheelOpen || !(kind === 'order' ? this.ordersOn : this.canOpenWheel)) return false;
    this.wheelOpen = true;
    this.wheelKind = kind;
    this.wheelBy = by;
    this.wheelAim.x = this.wheelAim.y = 0;
    if (kind === 'order') {
      this.orderClosed = null;
      this.msgMenu = false;
    } else this.wheelClosed = null;
    return true;
  }

  /** Close the wheel: `pick` takes what it points at (the weapon, or the order); otherwise nothing changes. */
  closeWheel(pick: boolean): void {
    if (!this.wheelOpen) return;
    this.wheelOpen = false;
    this.wheelBy = null;
    if (this.wheelKind === 'order') this.orderClosed = pick;
    else this.wheelClosed = pick;
    this.wheelKind = 'weapon';
  }

  /** How the order wheel closed since last asked: true (give the order it points at), false (cancelled) or null. */
  takeOrderClose(): boolean | null {
    const c = this.orderClosed;
    this.orderClosed = null;
    return c;
  }

  /** Send `say` (an order: fireteams.ts orderSay) with the next input. */
  queueSay(say: number): void {
    this.sayQueued = say;
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
    // (A pair in hand has no aim: the button is the second gun's trigger.)
    if (this.pairTrigger) return false;
    // Tests can hold the aim with window.__autoInput = { zoom: true }.
    return (this.locked && !this.wheelOpen && this.aiming()) || !!(window as unknown as { __autoInput?: { zoom?: boolean } }).__autoInput?.zoom;
  }

  /**
   * Whether you aim down the sights now: the aim action (right mouse by default, a controller's LT) held, or with Aim
   * set to Toggle, pressed once to aim and again to stop (touch's Aim button too: it holds the action while pressed). A melee
   * weapon's heavy swing (`altTrigger`) is always held.
   */
  private aiming(): boolean {
    const down = this.active('aim') || this.pad.zoom;
    const mode = this.altTrigger ? 'hold' : combatPrefs().aim;
    return (this.aimShown = this.aimLatch.update(down, mode));
  }

  /** Whether you aimed at the last read (touch's Aim button lights with it). */
  aimShown = false;

  /**
   * Sprint pressed (Shift, a controller's L3, touch's Sprint): a toggled aim lets go so you break into a sprint, as in
   * most shooters (held aim still wins while the button is down). Not with a scope or optic in hand, where Shift holds
   * your breath, nor for a melee weapon's heavy swing (always held). A reload keeps a toggled aim: the sights come back
   * up when it ends.
   */
  private sprintPressed(): void {
    if (!this.breathScope && !this.altTrigger) this.aimLatch.cancel();
  }

  /** Let a toggled aim go: a weapon change, death, a vehicle (the session calls it). */
  cancelAim(): void {
    this.aimLatch.cancel();
  }

  /** The sprint key (Shift by default), or a controller's sprint button: through a scope it holds your breath (it sprints otherwise). */
  get holdingBreath(): boolean {
    return this.active('sprint') || this.pad.sprint;
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
      this.aimLatch.cancel();
      return;
    }
    // The wheel key held past a tap opens the wheel; so does B (Fireteams), the order wheel.
    if (this.wheelKeyAt && !this.wheelOpen && performance.now() - this.wheelKeyAt >= WHEEL_HOLD_MS) this.openWheel('key');
    if (this.msgKeyAt && !this.msgWheeled && !this.wheelOpen && performance.now() - this.msgKeyAt >= WHEEL_HOLD_MS && this.openWheel('key', 'order')) this.msgWheeled = true;
    if (!this.active('fire') && !this.pad.fire) this.fireLatch = false;
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
    const key = (pos: string, neg: string) => (this.active(pos) ? 1 : 0) - (this.active(neg) ? 1 : 0);
    // (Following someone, the look keys that also pick players don't turn: the camera follows them.)
    if (!this.spectating || this.spectatingFree) {
      this.yaw += key('lookRight', 'lookLeft') * KEY_TURN * scale * dt;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + key('lookUp', 'lookDown') * KEY_TURN * 0.7 * scale * invert * dt));
    }
    this.pollPad(dt, scale, invert);
  }

  /** Told once per pad (by id) that its layout isn't standard, so the game ignores it. Set by the session (a HUD message). */
  onNotice: ((text: string) => void) | null = null;
  private noticed = new Set<string>();

  /** A connected pad without the standard layout, and no standard one: say so once per pad (calm, a message, no flash). */
  checkPadMapping(): void {
    const pads = [...(navigator.getGamepads?.() ?? [])].filter((g): g is Gamepad => !!g?.connected);
    if (pads.some((g) => g.mapping === 'standard')) return;
    for (const g of pads) {
      if (this.noticed.has(g.id)) continue;
      this.noticed.add(g.id);
      this.onNotice?.("Controller found, but this browser doesn't report a standard layout for it. Try Chrome or Edge, or an Xbox or PlayStation controller.");
    }
  }

  private pollPad(dt: number, scale: number, invert: number): void {
    this.checkPadMapping();
    const pad = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected && g.mapping === 'standard');
    const p = this.pad;
    if (!pad) {
      p.move = { x: 0, y: 0 };
      p.fire = p.zoom = p.sprint = p.jump = p.use = p.leanL = p.leanR = p.back = false;
      this.dpad.l.at = this.dpad.r.at = this.padBAt = 0;
      return;
    }
    const down = pad.buttons.map((b) => b.pressed || b.value > 0.4);
    const pressed = (i: number) => !!down[i] && !p.prev[i];
    const dz = this.mouse.padDeadzone;
    const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes.map((v) => deadzone(v, dz));
    // The stick has its own look and aim speeds, apart from the mouse's.
    scale = this.padSensitivityScale * this.mouse.padLook;
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
    // View / Back shows the scoreboard while held; Menu opens the pause menu (the page lets the mouse go).
    p.back = !!down[PAD.back];
    if (pressed(PAD.start)) document.exitPointerLock?.();
    if (pressed(PAD.lt) && !this.spectating) this.aimLatch.press();
    p.jump = !!down[PAD.a];
    p.use = !!down[PAD.rb];
    if (this.spectating) {
      // Watching: the shoulder buttons pick the next or previous player, Y switches the camera (follow / free).
      if (pressed(PAD.rb)) this.specStep++;
      if (pressed(PAD.lb)) this.specStep--;
      if (pressed(PAD.y)) this.specToggle = true;
      if (down.some(Boolean) || lx || ly || rx || ry) this.specUsed = true;
      p.leanL = p.leanR = false;
      this.dpad.l.at = this.dpad.r.at = this.padBAt = 0;
      p.prev = down;
      return;
    }
    if (pressed(PAD.l3)) {
      p.sprint = !p.sprint;
      if (p.sprint) this.sprintPressed();
    }
    if (!lx && !ly) p.sprint = false;
    if (pressed(PAD.a)) {
      this.jumpQueued = true;
      this.crouchOn = this.proneOn = false;
    }
    if (pressed(PAD.x)) this.reloadQueued = true;
    if (pressed(PAD.rb)) this.useQueued = true;
    // B: a tap is crouch (a toggle, made when let go); held PAD_PRONE_MS on foot it is prone (a toggle); in a vehicle it
    // is the duck at once.
    if (this.inVehicle) {
      if (pressed(PAD.b)) this.crouchOn = !this.crouchOn;
      this.padBAt = 0;
    } else {
      const now = performance.now();
      if (pressed(PAD.b)) {
        this.padBAt = now;
        this.padBProne = false;
      }
      if (down[PAD.b] && this.padBAt && !this.padBProne && now - this.padBAt >= PAD_PRONE_MS) {
        this.padBProne = true;
        this.proneOn = !this.proneOn;
        this.crouchOn = false;
      }
      if (!down[PAD.b] && p.prev[PAD.b] && this.padBAt) {
        if (!this.padBProne) {
          this.crouchOn = !this.crouchOn;
          this.proneOn = false;
        }
        this.padBAt = 0;
      }
    }
    // Y: a tap is the next weapon; held, it opens the weapon wheel (the right stick points, let go to switch).
    if (pressed(PAD.y)) this.padWheelAt = performance.now();
    if (down[PAD.y] && this.padWheelAt && !this.wheelOpen && performance.now() - this.padWheelAt >= WHEEL_HOLD_MS) this.openWheel('pad');
    if (!down[PAD.y] && p.prev[PAD.y]) {
      if (this.wheelOpen && this.wheelBy === 'pad' && this.wheelKind === 'weapon') this.closeWheel(true);
      else if (this.padWheelAt && performance.now() - this.padWheelAt < WHEEL_HOLD_MS) this.wheelSteps += 1;
      this.padWheelAt = 0;
    }
    // D-pad left / right: aiming (LT held, or the aim toggled on) they lean; otherwise the previous and next weapon.
    // (Held aim is read fresh: the last sample's answer is a frame old. A toggled aim is the latch.)
    const aimingNow = this.altTrigger || combatPrefs().aim === 'hold' ? p.zoom || this.active('aim') : this.aimShown;
    const dpadSide = (d: { at: number; lean: boolean; aimed: boolean }, i: number): { lean: boolean; switched: boolean } => {
      let switched = false;
      if (pressed(i)) {
        d.at = performance.now();
        d.lean = d.aimed = aimingNow;
      }
      if (d.at) {
        if (aimingNow) d.aimed = true;
        if (!down[i]) {
          switched = !d.aimed;
          d.at = 0;
          d.lean = false;
        }
      }
      return { lean: !!d.at && d.lean && aimingNow, switched };
    };
    const r = dpadSide(this.dpad.r, PAD.right);
    const l = dpadSide(this.dpad.l, PAD.left);
    p.leanR = r.lean;
    p.leanL = l.lean;
    if (r.switched) this.wheelSteps += 1;
    if (l.switched) this.wheelSteps -= 1;
    // D-pad up: a tap pings; held (Fireteams, leading a squad), the order wheel (the right stick points, let go to give it).
    if (!this.ordersOn) {
      if (pressed(PAD.up)) this.sayQueued = PING;
    } else {
      if (pressed(PAD.up)) this.padOrderAt = performance.now();
      if (down[PAD.up] && this.padOrderAt && !this.wheelOpen && performance.now() - this.padOrderAt >= WHEEL_HOLD_MS) this.openWheel('pad', 'order');
      if (!down[PAD.up] && p.prev[PAD.up]) {
        if (this.wheelOpen && this.wheelBy === 'pad' && this.wheelKind === 'order') this.closeWheel(true);
        else if (this.padOrderAt && performance.now() - this.padOrderAt < WHEEL_HOLD_MS) this.sayQueued = PING;
        this.padOrderAt = 0;
      }
    }
    if (pressed(PAD.down)) this.respawnQueued = true;
    // LB: hold to aim a throw, let go to throw (like G).
    if (pressed(PAD.lb)) this.throwAiming = true;
    if (!down[PAD.lb] && p.prev[PAD.lb] && this.throwAiming) {
      this.throwAiming = false;
      this.throwQueued = true;
    }
    // R3: the view (third person on foot, the vehicle's camera in one; each job checks where you are).
    if (pressed(PAD.r3)) {
      this.onAction.get('thirdPerson')?.();
      this.onAction.get('vehicleCamera')?.();
    }
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

  /** The camera key (Space by default; Y on a controller) while watching: switch between following and the free camera. */
  toggleSpectateCamera(): void {
    this.specToggle = true;
    this.specUsed = true;
  }

  /** The free camera's climb: its up key (E; or the right trigger), its down key (Q or Ctrl; or the left trigger). Free camera only. */
  spectateVertical(): number {
    const auto = (window as unknown as { __autoInput?: { up?: number } }).__autoInput;
    if (auto?.up) return auto.up;
    return (this.active('freeUp') || this.pad.fire ? 1 : 0) - (this.active('freeDown') || this.pad.zoom ? 1 : 0);
  }

  /** The free camera's faster key (Shift) held. */
  get freeFast(): boolean {
    return this.active('freeFast');
  }

  /** Consume a pending fire mode switch (its key: U). */
  takeFireModeSwitch(): boolean {
    const s = this.fireModeQueued;
    this.fireModeQueued = false;
    return s;
  }

  /** Consume a pending weapon category request (its key's number, 1-based; Fort Wars' builder: the piece). */
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
    // A step is a press of WheelDown or WheelUp: the next / previous weapon by default (keyBindings.ts).
    const code = this.scrollAcc > 0 ? 'WheelDown' : 'WheelUp';
    for (const a of this.byCode.get(code) ?? []) this.press(a, false);
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

  /** Roulette's death screen (rouletteHud.ts): cards of a streak pick on offer (1-3 choose), and a reroll token to spend (R). */
  roulettePick = 0;
  rouletteReroll = false;

  /** Roulette: pick a card or spend a reroll token (ROULETTE_SAY_*), sent with the next input (the pointer may be free: a click on a card). */
  chooseRoulette(say: number): void {
    this.sayQueued = say;
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
      // The class screen works with the pointer free (clicking a class): its pick still goes out (and Roulette's card).
      if (this.sayQueued >= ROULETTE_SAY_PICK || this.sayQueued >= CLASS_SAY_BASE) {
        const say = this.sayQueued;
        this.sayQueued = 0;
        return { forward: 0, right: 0, buttons: 0, say };
      }
      return { forward: 0, right: 0, buttons: 0 };
    }
    const axis = (pos: string, neg: string) => (this.active(pos) ? 1 : 0) - (this.active(neg) ? 1 : 0);
    let buttons = 0;
    if (this.jumpQueued || this.active(this.inVehicle ? 'vehicleUp' : 'jump') || this.pad.jump) buttons |= BUTTON_JUMP;
    if (this.active('fire') || this.pad.fire) buttons |= BUTTON_FIRE;
    if (this.reloadQueued) buttons |= BUTTON_RELOAD;
    // Right mouse aims down the sights (or scopes); melee weapons swing heavy with it instead.
    const aim = this.aiming();
    if (aim) buttons |= this.altTrigger ? BUTTON_ALT : BUTTON_ZOOM;
    // A pair in hand (dual wielding): a tap of the second trigger between two ticks is not lost, and touch's Fire
    // button (it holds the fire action) pulls both triggers.
    if (this.pairTrigger && (this.altTap || (this.touchEngaged && this.virt.has('fire')))) buttons |= BUTTON_ALT;
    this.altTap = false;
    // The second trigger (middle mouse or V: grenade launcher, alt fire…).
    if (this.active('altFire')) buttons |= BUTTON_ALT;
    if (this.throwQueued) buttons |= BUTTON_THROW;
    // Quick melee (a side mouse button or Y: a punch or kick, or a swing of a melee weapon in hand).
    if (this.active('melee')) buttons |= BUTTON_MELEE;
    // The wheel is open (or the click that picked from it is still held): no shooting, aiming or swinging; moving goes on.
    if (this.wheelOpen) buttons &= ~(BUTTON_FIRE | BUTTON_ZOOM | BUTTON_ALT | BUTTON_MELEE | BUTTON_THROW);
    if (this.fireLatch) buttons &= ~BUTTON_FIRE;
    // Shift sprints, except through a scope, where it holds your breath.
    if ((this.active('sprint') || this.pad.sprint) && !aim) buttons |= BUTTON_SPRINT;
    // In a vehicle the down key (C) is held, not a toggle: down in an aircraft, ducking where you stand.
    if (this.inVehicle ? this.crouchOn || this.active('vehicleDown') : this.crouchOn) buttons |= BUTTON_CROUCH;
    if (this.proneOn) buttons |= BUTTON_PRONE;
    if (this.useQueued) buttons |= BUTTON_USE;
    // The use key (F; or the pad's RB, or the touch Use button) still down: a hold to use (resupplying) goes on while it is.
    if (this.active('use') || this.pad.use) buttons |= BUTTON_USE_HOLD;
    // The lean keys (Q and E), held (both: upright).
    if (this.active('leanLeft') || this.pad.leanL) buttons |= BUTTON_LEAN_LEFT;
    if (this.active('leanRight') || this.pad.leanR) buttons |= BUTTON_LEAN_RIGHT;
    if (this.respawnQueued) buttons |= BUTTON_RESPAWN;
    this.respawnQueued = false;
    this.jumpQueued = this.jumpNext;
    this.jumpNext = false;
    this.reloadQueued = false;
    this.useQueued = false;
    this.throwQueued = false;
    const say = this.sayQueued;
    this.sayQueued = 0;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    return { forward: clamp(axis('forward', 'back') + this.pad.move.y + this.touchMove.y), right: clamp(axis('right', 'left') + this.pad.move.x + this.touchMove.x), buttons, ...(say ? { say } : {}) };
  }
}
