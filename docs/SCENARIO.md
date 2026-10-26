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
| **Ladder** | Wooden ladder up a wall. Put its foot against the wall facing out (R turns it). Walk into it to climb, look down or back off to go down, jump to let go. Bots use ladders both ways. | Facing, height (1-24 m; 4 m reaches the next level), width |
| **Trigger Zone** | Invisible box (drawn in MapMaker only). Fires "Players enter zone" / "Player leaves zone". | Size; fires for any player, once N players are inside, or once every living player is inside; team only |
| **Lift / Sliding Wall / Drawbridge** | A **mover** with the block it carries (v20): see *Movers* below. | Mode, speed, turn speed, wait, points, carried blocks |

Buttons, doors and zones take an optional **Team only** (v20): only that team
(or NPC faction, or `players` in co-op) can press the button, opens the door by
walking up or pressing E, or counts in the zone ("every living player" then
means all of that team). Logic still opens a team door for everyone. Bots of
other teams path round a team door as if it were locked.

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
| Match starts · Button pressed · Players enter zone · Player leaves zone · Door opened/closed · Object destroyed · Trap fires · Pickup taken · A player dies · Timer runs out · Objective completed · Variable changes · Mover arrives | Variable compare · Objective is … · Door is open/closed/locked/unlocked · Players in zone compare · Is enabled/disabled · Light is on/off · Block is present/gone · Mover parked at point (compare; 0 while moving) | Open/close/toggle/lock/unlock door · Enable/disable (buttons, zones, traps, pickups, blocks, movers, lights) · Fire trap · Destroy object (destructibles and blocks) · Set/add variable · Set objective · Start/stop timer · Show message · Play sound (alarm, chime, buzzer, boom) · **Wait** · End the round (instigator wins / nobody wins) · Light on/off/toggle · Set light colour · Flash light · Blink light · Drop / crumble block · Rebuild block · Send mover · Move mover to point |

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
- objectives nothing completes;
- logic-only trapdoors and crumbling floors nothing drops, and blocks that start hidden nothing rebuilds;
- "Set light colour" without a #rrggbb colour, and "Move mover to point" past the mover's last point;
- movers carrying missing blocks, a block carried by two movers (an error), and trigger movers no rule sends;
- team filters naming no team or faction of the map.

Clicking an issue frames the object or opens the rule.

### Lights, blocks and movers in logic (map format v20)

**Lights.** Every light has an ID like any object, so rules can switch it
**on**, **off** or **toggle** it, **set its colour** (a #rrggbb colour; empty puts
back its own), **flash** it (a bright pulse for *seconds*, then back as it was:
a trap's tell) and **blink** it (*per second*; state on/off: alarms, failing
tubes). Enable/Disable and "Is enabled" work on lights too, and "Light is
on/off" is a condition. In the inspector a light can **start off** or **blink**
from the start. Only lights some rule (or a start setting) drives are sent to
players, as `[index, flags, colour]` in the scenario snapshot (flags:
`LIGHT_ON`, `LIGHT_FLASH`, blinks per second × 10 from bit 2); the rest cost
nothing. Blinking runs on each client's clock; on/off/colour/flash are the
server's.

**Blocks.** Any free block can be a target: **Drop / crumble block** makes a
crumbling floor or trapdoor give way now (a breakable block breaks, a solid one
vanishes), **Rebuild block** puts it back (as soon as nobody stands where it
goes), and Enable/Disable do the same. "Destroy object" also accepts blocks,
and "Block is present/gone" is a condition. A block can **start hidden** (a
bridge that extends on cue). Solid blocks a rule targets, that start hidden or
that a mover carries leave the static level and are run by the scenario like
trapdoors (`dynamicBlockIds`): drawn as their own meshes, colliders switched
and moved, state replicated like any breakable. Hidden solid blocks never come
back by themselves.

**Reachability.** Navigation and the validator's reachability checks see every
block in its **idle** state: trapdoors and crumbling floors present, blocks
that start hidden absent, carried blocks at their mover's first point. So a
trapdoor sprung from a lever is still a floor for the spawn-to-spawn checks,
and a bridge that only appears on cue doesn't count as a way across.

### Movers (map format v20)

A **mover** carries a group of free blocks (by ID) between two or more
**points**, offsets in metres from where the blocks are placed (point 1 is
usually 0, 0, 0), and can turn them at each point by an **angle** about a
level hinge through the mover's marker, square to its facing (drawbridges:
positive angles lift the side it faces). It moves at **speed** m/s and turns at
**turn speed** °/s (a leg takes the slower of the two), eases in and out, and
waits **wait** seconds at each point.

| Mode | Runs |
|---|---|
| loop | 1 → 2 → … → last → 1, over and over |
| pingpong | there and back, over and over |
| trigger | only when logic sends it: **Send mover** (on to the next point, back and forth) or **Move mover to point** *n* |

Enable/Disable start and park loop and pingpong movers (they finish the leg
they are on). "Mover arrives" fires at each point; "Mover parked at point" is
a condition.

Players standing on a carried block ride it: each tick the server moves the
movers first, then carries everyone standing on top of a carried block by that
spot's own motion (turning with it on a drawbridge), then moves everyone as
usual. Client prediction does the same thing at the same ticks, because a
mover's pose is a pure function of its current leg (from, to, start tick) and
the tick: the server sends only the leg, `[index, start tick, from × 64 + to]`,
when it changes, and every client works out the pose for its own predicted
tick, and draws platforms at that tick so they stay under your feet. Movers
don't push anyone: keep their paths clear of walls and floors players stand
on.

Bots ride **lifts**: every loop or pingpong mover that mostly goes up and down
adds a navmesh link each way between its stops (`liftLinks`); a bot waits a
couple of metres back until the platform is there, steps on, stands still
until it arrives, then walks off. Trigger movers and drawbridges are not
links: bots treat them as wherever they start.

## How it runs

- **Format:** map format v4 (`map/schema.ts`, `map/logic.ts`). v3 maps migrate with empty logic.
- **Runtime:** `sim/scenario.ts`, stepped by `Match` each tick on the server (and in TEST/offline via the same code).
  - Event chains deeper than 8 are cut off, so a rule that triggers itself can't hang a match.
  - At most 256 waiting sequences.
  - Scenario state resets each round, and "Match starts" fires again.
- **Physics:** doors and destructibles are real colliders (`ScenarioBodies` in `sim/scenarioDefs.ts`). They block movement, bullets, grenades and line of sight. Clients mirror them in prediction from replicated state.
- **Network:** `snapshot.sc` carries entity states as deltas, with a full keyframe every 2 s; `welcome.sc` carries a full copy. Events cover doors, buttons, traps, breakage, objectives, messages and sound cues.
- **Bots:** paths through locked/manual closed doors (and other teams' team doors) and intact breakable walls count as blocked, and bots wait at the edge of an active trap. Mines are hidden from them. When a closed door blocks a bot's way and an enabled button it may press has a rule that opens, toggles or unlocks-and-opens that door, the bot walks to the button, faces it, presses E and goes on (`Scenario.doorButtons`, `BotBrain.planPress`); it doesn't read the rule's IF conditions. Bots ride lifts (see *Movers*).
- **Look and sound:** procedural models (`client/src/game/scenarioVisuals.ts`), the same in MapMaker and in game. Sounds are Kenney CC0 plus our synthesised flame, beep and alarm (see [`AUDIO.md`](AUDIO.md)).

## NPCs, factions and co-op (M4)

### NPC squads (MapMaker → Entities → NPCs, or Entities → Scenario → "NPC Squad")

An **encounter** is one squad of a faction's soldiers that spawns around its marker.

The **NPCs** sub-tab places ready-made encounters in one click: a lone **Trooper**, **Gunner** or **Heavy**
(one soldier holding the spot), a **Squad** (two troopers and a gunner), a **Hunter Squad** (four that hunt
the players), a **Reinforced Squad** (12 reinforcements) and an **Allied Militia** that follows the players
(it adds a friendly *Militia* faction if the map has none, in the same undo step). They are ordinary
encounters afterwards: every setting below is in the inspector.

| Setting | Meaning |
|---|---|
| Faction | Which side the squad fights for (see Factions below) |
| Troopers / Gunners / Heavies | The first wave. Troopers carry rifles, Gunners shotguns, Heavies grenade launchers (tougher, slower) |
| Imps / Puglins / Cyclopes / Oculi / Scolitexes | Creatures in the first wave, mixed freely with soldiers (see *Creatures* below) |
| Max alive | Never more than this many at once |
| Reinforcements, + per extra player | Extra soldiers that trickle in as others die. The per-player number scales co-op difficulty with team size |
| Reinforce every (s) | Delay between reinforcements |
| Spawn radius | Spawn area. Soldiers avoid spawning next to enemies |
| Order | hold here · hunt the enemy · defend the target · patrol to the target and back · follow the players (allies) |
| Skill | easy / normal / hard aim and reactions |
| Active at start | Otherwise a rule starts it ("Start encounter") |

- Squads share sightings, so when one soldier spots you, the rest come looking.
- NPCs don't use player slots.
- In deathmatch they fight everyone; in co-op they fight the players' side.

### Creatures

Encounters can field creatures as well as soldiers. They use the same squad
settings and the same player-sized hit capsule; only the body, the attack and
the stats differ (`NPC_ROLE_SPECS` in `shared/src/sim/npc.ts`, looks in
`shared/src/sim/creatures.ts`).

| Creature | Health | Speed | Attack | Behaviour |
|---|---|---|---|---|
| Imp (1.7 m, Bestiary pack) | 70 | 1.05 × player | Claw (knife strike, 0.7 × damage) | Paths toward you, then rushes straight in from 10 m and claws |
| Puglin (1.1 m) | 45 | 1.15 × player | Bite (knife strike, 0.45 × damage) | Like the imp, smaller, faster and weaker |
| Cyclops (alien, hovers) | 90 | 0.75 × player | Spits slowing goo (Goo Gun) | Keeps its distance like a soldier |
| Oculus (alien, hovers) | 60 | 0.9 × player | Spits fast plasma bolts (Plasma Rifle) | Keeps its distance |
| Scolitex (alien brute, 2.5 m) | 320 | 0.8 × player | Heavy claws (knife strike, 1.5 × damage) | Rushes in like the imps |

- Melee creatures switch from the bot brain's pathing to a straight charge once
  they see their target within 10 m (`chargeIntoMelee`).
- Creatures carry no visible weapon, have no ragdoll, and play their own death
  (the imp and puglin a death clip, the aliens drop and roll over); the body
  stays like any other.
- Demo: `maps/creature_lab.json` (`?offline=creature_lab`), three waves on a deck
  built from the sci-fi kit.

### Factions (Logic panel → Factions)

- Every map has at least one NPC faction. The default is the red *Syndicate*.
- Add more, recolour them, and set each one's relation to the players and to the other factions: **ally**, **neutral** (they won't attack each other) or **enemy**.
- A friendly "Militia" squad with *follow* fights alongside the players.

### Co-op missions (Map inspector → Mode → Co-op mission)

- All players and Player Bots share a side. There's no friendly fire and no score or time limit.
- Bots go after the mission's NPCs.
- End the mission from logic with **End the round → players win / players lose**, which shows "Mission complete" or "Mission failed".
- Useful pieces:
  - **Encounter cleared** (the squad and all its reinforcements are dead), **An NPC dies**, and **NPCs alive in** (condition);
  - **Start encounter**, **Stop reinforcements**, **Order squad to …**;
  - a lives counter on **A player dies**.
- Templates: *Ambush*, *Clear the squad*, *Co-op: win when all squads are cleared*.
- See *Outpost Siege* for a full mission.
