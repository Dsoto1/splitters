# Controls: the keys and Options → Controls

The owner (2026-11-23): "Q and E need to be the peeks. we need a way to remap controls, right now they are all over the
place." Every keyboard and mouse action is one row of one table, `packages/client/src/game/keyBindings.ts`
(`BIND_ACTIONS`); input (`game/input.ts`), the menus and pause, the tips, the tutorial and the HUD prompts read the keys
from it, and **Options → Controls** rebinds them.

## Default keys

| Group | Action | Keys |
|---|---|---|
| Move | Forward / left / back / right | W / A / S / D |
| | Jump | Space |
| | Sprint (through a scope: hold breath) | Shift |
| | Crouch (toggle) / prone (toggle) | C / Z |
| | Lean left / right (held) | **Q / E** (were ` and Left Alt) |
| | **Dodge** (a dodge-step; crouched or sprinting, a combat roll; both on stamina) | **V** (2026-11-25; was the second trigger's alternative) |
| | Third person | H |
| | Look (touchpad, keyboard) | arrow keys |
| Combat | Fire | Left mouse · **Left Alt** (was F) |
| | Aim down sights / scope | Right mouse · **`** (was X) |
| | Second trigger | Middle mouse (its V went to Dodge, 2026-11-25) |
| | Quick melee | Side mouse button · Y |
| | Reload | R |
| | Throw grenade or mine (hold to aim) | G (also the class ability) |
| | Fire mode | U |
| | Use, doors, get in or out (hold: resupply) | **F** (was E) |
| | Respawn / class screen | K / L · , |
| Weapons | Weapon wheel (hold) | **Tab** (was Q held) |
| | Last weapon | **X** (was a tap of Q) |
| | Next / previous weapon | wheel down / up |
| | Categories (Pistols … Melee & gadgets) | 1-8 |
| Comms | Quick messages (fireteam lead: hold for orders) / ping / dance | B / T / N |
| Vehicles | Brake, climb, jump out of a plane / descend, duck / cockpit or chase camera | Space / C (held) / H |
| Spectate | Follow or free camera / next / previous player | Space / → / ← (or clicks) |
| | Free camera up / down / faster | E / Q · Left Ctrl / Shift (free camera only) |
| | Join the game | J |
| Menus | Scoreboard | **a tap of Tab** (another hides it; was Tab held) |
| | Big map / switch team | M / O |
| | Previous / next tab, Filter maps | Q / E, F (menus only) |
| Fixed | Pause, menu numbers, performance overlay, fullscreen | Esc, 1-9 in an open menu, F3, F11 · Alt+Enter |

## Controller (fixed, `game/input.ts pollPad`; Options → Controls → Controller lists it)

| Action | Button |
|---|---|
| Move / look | Left stick / right stick |
| Fire / aim | RT / LT |
| Jump (stands you up) | A |
| Crouch (toggle) | Tap B |
| Prone (toggle) | **Hold B** (0.4 s) |
| Reload | X |
| Next weapon / weapon wheel (right stick points) | Tap Y / hold Y |
| Previous / next weapon | D-pad left / right (not aiming) |
| **Lean left / right (held)** | **D-pad left / right while LT aims** (held or toggled) |
| **Dodge-step; crouched, a combat roll** | **B while LT aims** (held or toggled; at once, never a crouch) |
| Use, get in or out (hold: resupply) | RB |
| Throw (hold to aim) | LB |
| Sprint | L3 |
| Ping (Fireteams lead: hold for orders) | D-pad up |
| Respawn / class screen | D-pad down |
| Third person / vehicle camera | R3 |
| **Pause menu** (Menu again, or B, resumes) | **Menu (Start)** |
| **Scoreboard** (while held) | **View (Back)** |
| **Next-map vote** (end of a match): move the highlight / vote (vote again to change it) | **D-pad or left stick left / right** / **A** |
| Spectating | RB / LB next / previous player, Y camera (the d-pad is as before) |

Lean and weapon switch share the d-pad, told apart by where the press began: pressed while aiming it leans for as long as
it is held and the aim lasts (letting go of LT stops the lean and never switches a weapon); pressed without the aim it is a
weapon switch, made when the d-pad is let go, unless the aim began meanwhile (d-pad first, then LT: nothing happens). Keys
and pad combine (both sides: upright). B is told apart the same way: a tap crouches when let go, a hold of 0.4 s goes prone
at once; pressed while aiming it is Dodge at once (a dodge-step, or crouched a combat roll; sprinting can't aim, so a
sprint's roll is the keyboard's and touch's). In a vehicle B ducks at once.

**Touch** has a **Dodge** button in the action cluster (`game/touchControls.ts`): a dodge-step the way the pad points;
crouched or sprinting, a combat roll.

A connected pad whose browser mapping isn't `standard` (some third-party, wired Xbox 360 or Switch Pro pads) is ignored; with no
standard pad connected, a message says so once per pad (`InputState.checkPadMapping`, also on `gamepadconnected`).

**Stick settings** (Options → Controls and the pause menu's Controls, kept with the mouse's in `tiletrigger.mouse`, this
browser only like them): **Stick look** 0.2-3× (default 1), **Stick aim** 0.2-3× (default 1; the stick's version of Zoom
sensitivity, through the same zoom scaling) and **Stick dead zone** 0.05-0.3 (default 0.15). They are apart from Mouse
sensitivity, which no longer moves the stick. Invert look applies to the stick too.

**Hints follow the last input**: after a controller press, the HUD's use prompt ("RB Drive the Troop Buggy"), vehicle hints, tips and
tutorial read the pad's button (`hintKey`, `PAD_HINTS` in `keyBindings.ts`; actions without a button show their key).

Free buttons for the actions the pad lacks (not built; the owner picks): Back / View (melee), LB + RB together (alt
fire), hold R3 (fire mode). Menu and View are taken (above).

## How it works

- **Two keys an action** (`Bindings`: action → `[key, alt]`). A slot holds a key code (`KeyQ`, `Space`), a mouse code
  (`Mouse0` left, `Mouse1` middle, `Mouse2` right, `MouseSide` either side button, `WheelUp` / `WheelDown`) or nothing.
- **Places.** Each action works on foot, in a vehicle, spectating or in the menus (`places`). Two actions clash only when
  they share a key and a place: E leans on foot and lifts the free camera; F uses in play and filters maps in the menus;
  Space jumps, brakes a vehicle and switches the spectator camera. In a vehicle the on-foot moves (jump, crouch, sprint,
  lean) give way to the vehicle's keys, and its down key is held, not a toggle.
- **The wheel's key** may share its key with one **tap** job (`tap: true`): held past 180 ms the wheel opens; a shorter
  press does the tap job. By default that is the scoreboard (a tap shows it, another hides it; while the wheel can't open,
  dead or in a vehicle, Tab held shows it too). On a key of its own the scoreboard shows while held.
- **Options → Controls** (`frontend/controlsPage.ts`): the groups in order; click a key (or Enter / Space on it), then
  press the new key or mouse button or roll the wheel. Esc keeps the old key, Delete clears it. A key another action
  uses in the same place warns and offers **Swap** (the other action takes the old key), **Take it** (the other loses
  it) or Cancel. **Reset to defaults** puts every key back. Keyboard alone works; at phone width each row stacks.
  Controllers and touch keep their own fixed layouts (the controller's is above).
- **Kept** in this browser (`tiletrigger.keys`: only the actions changed from the defaults, so later defaults reach
  everyone who kept them) and, signed in, on the account (profile field `keys`, shared `net/profile.ts keysShape`; the
  hub's `PUT /api/v1/profile` checks the shape; `careerStats.ts syncKeys`, as optic picks are synced). An older hub keeps
  them in the browser only.
- **Players who rebound keep their choices.** The first read moves the old stores in once (`migrateOldKeys`): a lean
  key, the wheel key or a category key the player had changed is kept (a stored old default, ` / Left Alt / Q, is not a
  choice, so those players get Q / E lean). A kept key that is now another action's default takes it from that action.
- **Hints read the bindings**: the HUD's use prompt and vehicle hints, the spectator line ("Free camera: WASD fly · E/Q
  up and down…", "Space: follow players · J: join the game"), the quick-message menu, tips and the tutorial
  (`[@action]` in their text), Roulette's reroll, the menus' footer and the pause menu's tab hint.

## Tests

`packages/client/test/keyBindings.test.ts` (defaults, clashes, swap, the stored diff, the migration),
`hintKey.test.ts`, `padInput.test.ts` (the d-pad lean and its edges, B crouch and prone, B while aiming dodges), `inputWheel.test.ts` (Tab hold and tap, Q/E lean, F use, V dodge once a press, vehicle keys, a live rebind); e2e `offline`
(`weaponKeysChecks`: X, Tab, Q/E lean; `controlsPageChecks`: the page, keyboard-only rebind, clash and swap, Reset, a
mouse button, phone width; `CONTROLS_PICS=<dir>` takes its pictures).
