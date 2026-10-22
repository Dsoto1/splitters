# Scenarios, traps and logic (M3)

How creators turn a Classic Grid layout into a scenario: doors, buttons, breakable objects, trigger zones, traps, and WHEN → IF → DO rules. This is the implementation of the ENTITIES and LOGIC workspaces in [`MAPMAKER_SCENARIO.md`](MAPMAKER_SCENARIO.md). Everything is data in the map file. There is no creator code: the server interprets the rules.

Try it: main menu → **Play The Vault**, or MapMaker → Open… → **The Vault** template.

## Objects (MapMaker → "Scenario & Traps")

| Object | What it does | Settings |
|---|---|---|
| **Door** | Sliding double door sized for a doorway (3 m × 3 m). Snaps into the nearest doorway when placed. | Opens by itself (auto) or with E; locked; starts open |
| **Locked Door** | A door that starts locked. Something has to unlock or open it (validation warns if nothing does). | Same as Door |
| **Button** | Wall button pressed with **E**. Fires "Button pressed". | Prompt text ("Unlock the vault door"), single use, cooldown, starts enabled |
| **Crate** | Breakable cover (60 HP). | Health, explosives only |
| **Explosive Barrel** | Explodes when destroyed (4.5 m blast) and sets off nearby barrels. | Health |
| **Breakable Wall** | Wall panel that fills a doorway (250 HP). Tick "explosives only" for a reinforced wall that needs grenades. | Health, explosives only |
| **Trigger Zone** | Invisible box (drawn in MapMaker only). Fires "Players enter zone" / "Player leaves zone". | Size; fires for any player, once N players are inside, or once every living player is inside |

### Traps

| Trap | Danger | Default |
|---|---|---|
| **Spike Floor** | 3 × 3 m plate; spikes punch up (35 damage every ½ s while up) | 1.5 s up, 2.5 s down |
| **Flame Jet** | Nozzle that throws a 5.6 m flame forward (heavy damage over time) | 2 s on, 3 s off |
| **Crusher** | 3 × 3 m block that drops from the ceiling; anyone under it dies | 1.2 s down, 3 s up |
| **Proximity Mine** | Beeps when someone steps close, then explodes (4.5 m blast) | Rearms after 20 s |
| **Laser Fence** | Four beams across a doorway (25 damage every ¼ s). Snaps into doorways. | 2 s on, 2 s off |

Every trap fires in one of four ways:

- **always**: permanently on;
- **on a cycle**: on/off seconds plus an *offset*, so a row of traps can ripple;
- **when stepped on**: a short warning (the spikes rumble, the crusher shudders, the mine beeps), then it fires and rearms after the "off" time;
- **only from logic**: a rule's "Fire trap" action.

Damage can be overridden per trap. Trap deaths show in the kill feed ("was crushed", "stepped on a mine") and cost the victim a point, like falls.

## Logic (MapMaker → ⚙ Logic, or press L)

- **Objectives**: lines on every player's HUD while active, with an optional marker pointing at an object. Rules activate, complete or fail them.
- **Variables**: numbers rules can set, add to and test. Use 0/1 for on/off.
- **Timers**: started and stopped by rules. Optionally shown on the HUD. "Timer runs out" fires when one finishes, and repeating timers restart.
- **Rules**: **WHEN** an event happens, **IF** every condition holds, **DO** the actions in order.

| WHEN | IF | DO |
|---|---|---|
| Match starts · Button pressed · Players enter zone · Player leaves zone · Door opened/closed · Object destroyed · Trap fires · Pickup taken · A player dies · Timer runs out · Objective completed · Variable changes | Variable compare · Objective is … · Door is open/closed/locked/unlocked · Players in zone compare · Is enabled/disabled | Open/close/toggle/lock/unlock door · Enable/disable (buttons, zones, traps, pickups) · Fire trap · Destroy object · Set/add variable · Set objective · Start/stop timer · Show message · Play sound (alarm, chime, buzzer, boom) · **Wait** · End the round (instigator wins / nobody wins) |

- A rule can be marked **Once** (fires once per round).
- "Wait" pauses the action list, so a rule can be a timed sequence.
- The **instigator** is whoever caused the event: the player who pressed the button, entered the zone, broke the object or took the pickup. "End the round: instigator wins" uses them.
- **Quick add** templates create ready-made rules wired to the first matching objects:
  - Button opens a locked door
  - Trap ambush
  - Reach the exit (objective + win)
  - Breach alarm
  - Countdown
  - Collect 3 items to open a door
- In the inspector, a selected object lists the rules that use it and has **+ Add rule for this**.
- Every edit is one undo step.

### Validation

The validator reports:

- references to deleted objects (as warnings, so TEST still runs; the runtime skips missing targets);
- empty rules and messages;
- buttons no rule uses;
- locked doors nothing unlocks;
- logic-only traps nothing fires;
- objectives nothing completes.

Clicking an issue frames the object or opens the rule.

## How it runs

- **Format:** map format v4 (`map/schema.ts`, `map/logic.ts`). v3 maps migrate with empty logic.
- **Runtime:** `sim/scenario.ts`, stepped by `Match` each tick on the server (and in TEST/offline via the same code).
  - Event chains deeper than 8 are cut off, so a rule that triggers itself can't hang a match.
  - At most 256 waiting sequences.
  - Scenario state resets each round, and "Match starts" fires again.
- **Physics:** doors and destructibles are real colliders (`ScenarioBodies` in `sim/scenarioDefs.ts`). They block movement, bullets, grenades and line of sight. Clients mirror them in prediction from replicated state.
- **Network:** `snapshot.sc` carries entity states as deltas, with a full keyframe every 2 s; `welcome.sc` carries a full copy. Events cover doors, buttons, traps, breakage, objectives, messages and sound cues.
- **Bots:** paths through locked/manual closed doors and intact breakable walls count as blocked, and bots wait at the edge of an active trap. Mines are hidden from them. Bots don't press buttons or chase objectives yet (M4).
- **Look and sound:** procedural models (`client/src/game/scenarioVisuals.ts`), the same in MapMaker and in game. Sounds are Kenney CC0 plus our synthesised flame, beep and alarm (see [`AUDIO.md`](AUDIO.md)).
