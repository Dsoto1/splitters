/**
 * A player's input: the buttons, the input itself and the quick messages (split from movement.ts, which re-exports
 * them, 2026-11-18: the menu's key bindings and class cards read the buttons, and reaching movement.ts took the
 * movement code, the nav links and the kit props' table into the menu's first JS; docs/LOADING.md).
 */
export const BUTTON_JUMP = 1;
export const BUTTON_FIRE = 2;
export const BUTTON_RELOAD = 4;
export const BUTTON_ZOOM = 8;
/** Use / interact (E): press buttons, open manual doors. Sent once per key press. */
export const BUTTON_USE = 16;
/** Second trigger (right mouse on weapons that have one). */
export const BUTTON_ALT = 32;
/** Throw the carried grenade or mine (G). */
export const BUTTON_THROW = 64;
/** Sprint while held (Shift): faster forward running that uses stamina. */
export const BUTTON_SPRINT = 128;
/** Wants to crouch / lie prone (held state; the client turns toggle keys into it). */
export const BUTTON_CROUCH = 256;
export const BUTTON_PRONE = 512;
/** Walking speed while aiming down the sights. */
export const ADS_SPEED = 0.75;
/** Ask to respawn now (stuck somewhere): you die where you stand and come back as usual. Counts as a suicide. */
export const BUTTON_RESPAWN = 1024;
/** Quick melee (side mouse button or Y): swing the held melee weapon, or punch / kick when none is held (UNARMED). */
export const BUTTON_MELEE = 2048;
/**
 * Look-to-steer (held while the option is on): a driver's vehicle steers toward where they look (their yaw), the
 * Warthog way, on top of any A/D steering. Ignored on foot and in flyers.
 */
export const BUTTON_STEER_LOOK = 4096;
/**
 * Third-person view on foot (held while it's on): the host sends this player's rounds from the eye toward what
 * the third-person crosshair is on (sim/thirdPerson.ts thirdPersonAim, worked out by the host), not along the
 * view from the eye. Older hosts mask it off (rounds go along the view, as before).
 */
export const BUTTON_THIRD_PERSON = 8192;
/**
 * Auto-reload (held every input while the player's option is on, the default): an empty magazine starts its reload
 * by itself once the gun is ready, without a trigger pull (gunplay.ts autoReloadDue; prediction mirrors the
 * host). Not while sprinting forward or holding quick melee, so both still break a reload. Older hosts mask it off (reloads wait for the trigger, as before).
 */
export const BUTTON_AUTO_RELOAD = 16384;
/**
 * Use (E) is down (held every input while it is): a hold to use (sim/holdUse.ts: resupplying at a Supply Buggy or an
 * Ammo Box) runs while it is. BUTTON_USE stays the press. Older hosts mask it off (a press resupplies at once, as before).
 */
export const BUTTON_USE_HOLD = 32768;
/**
 * Lean (peek) left / right while held (sim/moves.ts stepLean): the head, the gun and the hit shapes move out to that
 * side. Both held, or neither: upright. Older hosts mask them off (no lean, as before).
 */
export const BUTTON_LEAN_LEFT = 65536;
export const BUTTON_LEAN_RIGHT = 131072;
/**
 * Dodge (V; sent once per press, like Use): a quick dodge-step the way you are moving, or a combat roll when crouched or
 * sprinting (sim/moves.ts DODGE, ROLL). Older hosts mask it off (nothing happens, as before).
 */
export const BUTTON_DODGE = 262144;
/** Every button a host takes (sanitizeInput masks the rest off). */
export const ALL_BUTTONS = BUTTON_DODGE | BUTTON_LEAN_LEFT | BUTTON_LEAN_RIGHT | BUTTON_USE_HOLD | BUTTON_AUTO_RELOAD | BUTTON_THIRD_PERSON | BUTTON_STEER_LOOK | BUTTON_JUMP | BUTTON_FIRE | BUTTON_RELOAD | BUTTON_ZOOM | BUTTON_USE | BUTTON_ALT | BUTTON_THROW | BUTTON_SPRINT | BUTTON_CROUCH | BUTTON_PRONE | BUTTON_RESPAWN | BUTTON_MELEE;

/** One tick of player intent. Humans and Player Bots produce exactly the same structure. */
export interface PlayerInput {
  seq: number;
  /** -1..1 forward/back. */
  forward: number;
  /** -1..1 strafe right/left. */
  right: number;
  yaw: number;
  pitch: number;
  buttons: number;
  /** Weapon code (see weaponCode) the player wants held (0 = keep current). */
  weapon?: number;
  /** Server tick the player was looking at when this input was made (lag compensation). */
  viewTick?: number;
  /**
   * The fire mode wanted for the held weapon (index into its `fireModes`, sim/fireModes.ts), sent with every input
   * while a weapon with modes is held; absent: keep the mode it has. Older hosts ignore it (the first mode).
   * Dual wielding: with a pair of the held weapon, 1 puts the second gun away (one gun, with its sights) and
   * anything else brings it back; sent while you hold a pair.
   */
  fireMode?: number;
  /** A quick message (1-QUICK_MESSAGES.length) or emote (EMOTE_DANCE) sent with this input. */
  say?: number;
  /** Fort Wars Builder: the piece picked (FORT_PIECE_KINDS index) plus quarter turns × 16. */
  build?: number;
  /**
   * Recoil counter (radians, pitch and yaw): how much of this input's mouse
   * movement pulled against the weapon's recoil. The client doesn't move its
   * view by that amount; the server takes it off the recoil offset instead
   * (gunplay.ts counterRecoil), so the aim never overshoots on recovery.
   */
  rc?: [number, number];
  /**
   * A spectator's camera input (or a dead player's while watching: kill cam, follow or free camera): they
   * turned, moved the free camera or picked whom to watch this tick. Counts as activity for the idle and
   * away rules (Match.noteActivity). Optional: hosts that don't know it go by turning alone.
   */
  sp?: 1;
}

/**
 * Quick messages players can send (QUICK_MESSAGE_KEYS while the quick-message menu is open, or the quick-chat wheel):
 * `PlayerInput.say` is the index + 1. New lines go on the end (older hosts drop numbers past their own list).
 */
export const QUICK_MESSAGES = ['Follow me!', 'Need backup!', 'Enemy spotted!', 'On my way!', 'Thanks!', 'Nice shot!', 'Hold here!', 'Need ammo!', 'Defend A!', 'Defend B!', 'Fall back!', 'Sorry!'] as const;
/** The quick-message menu's keys, in QUICK_MESSAGES order (key codes; shown as 1-9, 0, - and =). */
export const QUICK_MESSAGE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'] as const;
/** QUICK_MESSAGES numbers that are also orders to your team's bots. */
export const SAY_FOLLOW = 1;
export const SAY_HOLD = 7;
/** `say` value for a ping: marks what you're aiming at for your team. */
export const PING = 101;
/** `say` value for the dance emote. */
export const EMOTE_DANCE = 100;
