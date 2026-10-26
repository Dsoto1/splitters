# Game modes

| Mode | ID | Teams | Score limit counts | Map needs |
| --- | --- | --- | --- | --- |
| Deathmatch | `core.deathmatch` | none | kills | spawns |
| Team Deathmatch | `core.tdm` | 2–8 | team kills | spawns (team spawns optional) |
| Capture the Flag | `core.ctf` | 2 | captures (default 3) | a **Flag Base** per team |
| King of the Hill | `core.koth` | 2–8 | seconds on the hill (default 120) | one or more **Hills** |
| Elimination | `core.elim` | 2–8 | rounds won (default 5) | what TDM needs |
| Co-op | `core.coop` | players vs NPCs | none (logic ends it) | NPC encounters |
| Fort Wars | `core.forts` | 2 | captures (default 3) | a **Flag Base** per team (any CTF map) |

Teams, team sizes and team spawns work the same in every team mode (see
[TEAMS.md](TEAMS.md)). A team spawns on its own spawn points if the map has
any. Objective modes replace kill totals with their own team score on the
scorebar and scoreboard. The round ends at the score limit or the time limit,
and the higher team score wins.

## Capture the Flag

- Each of the two teams has a flag on its **flag base**. To pick up the enemy
  flag, touch it.
- The carrier moves at 85% speed and can't use a jetpack (the fuel is kept
  and handed back after) or get into a vehicle. Turrets are allowed. Everyone
  sees the flag on the carrier's back.
- To **capture**, bring the flag to your own base **while your own flag is
  home**. Each capture scores 1.
- If the carrier dies or leaves, the flag **drops** where they fell and stays
  on the ground. A defender who touches it sends it **home**. Otherwise it
  goes home on its own after 30 s (`MatchRules.flagReturnSeconds`). A flag
  lost over the void or a drop goes home at once.
- Defaults: 3 captures, 15 minutes, 3 s respawn.
- Events: `flag` with `a` = `take` / `drop` / `return` / `capture`. The HUD
  shows each flag as home, taken (blinking, with the carrier's name) or
  dropped (with its return countdown). Markers point to the enemy flag, to your
  flag when it's away, and to your base while you carry. The announcer says
  "Your flag has been taken!", "Flag captured!" and so on. Sounds use existing
  cues: alarm when your flag is taken, chime on a return, objective-complete
  on your capture, buzzer on theirs.
- Bots: `sim/modes/ctfBots.ts` handles CTF goals on its own. Bots take roles
  in slot order (attack, defend, attack, escort). Defenders and escorts, plus
  any bot within 22 m, chase an enemy carrier or return a dropped flag. The
  carrier runs home and only reacts to enemies within 4 m.

## Fort Wars

SourceForts-style: build a fort round your flag, then Capture the Flag over
the forts (`sim/modes/forts.ts`, pieces and placement rules in
`sim/forts.ts`). Plays on any map with a flag base for both teams.

- **Phases.** A build phase (default 2.5 min), then a combat phase of CTF
  (default 5 min); optionally several build/combat **cycles** (default 1).
  Captures carry over between cycles; the match ends after the last combat
  phase (or at the capture limit). Everyone respawns at each phase change.
- **Build phase.** A force field (`FORT_BARRIER_HALF`, a tall thin wall
  through the midpoint between the flag bases, square to the line between
  them) splits the map; nobody can hurt anybody, flags can't be taken, and
  anyone on the wrong half is put back by their flag. Everyone holds only
  the **Builder** (`core.builder`).
- **The Builder.** Number keys 1-8 or the wheel pick a piece, **R** turns it
  a quarter, **LMB** places, **RMB** (aim / alt fire) picks up one of your
  team's pieces for a full refund. A ghost shows where it goes: green, or
  red with the reason. The input carries the pick as `build` (piece + 16 ×
  turns); the server works out the spot from your aim (`fortAimPlacement`).
- **Pieces** (cost, health): Block 1×1×1 (2, 160), Plank 2×0.25×1 (1, 90),
  Wall 2×2×0.5 (4, 320), Metal wall (8, 650), Ramp 2 wide rising 1 m over
  2 m (3, 220), Stairs 1 wide rising 2 m over 2 m (3, 220), Crate 1.5 m
  (3, 300, metal), Sandbags 2×1×0.5 (2, 300). Pieces turn in quarter turns
  and their edges sit on a **0.5 m grid**; ramps and stairs are built from
  low steps, so they walk like stairs. No team doors (yet).
- **Rules** (`fortPlacementProblem`, shared by server, client ghost and
  bots): on your own half and at least 1 m from the barrier, at least 3 m
  from either flag base and 1.2 m from spawn points, not into a player,
  another piece or the level (a little sinking into uneven ground is fine),
  something underneath, enough build points, and at most 80 pieces per team.
- **Build points** (default 120 per team): what your standing pieces cost
  comes off the budget, so picking up refunds and each new build phase lets
  you rebuild what was broken.
- **Combat.** The barrier drops and the Builder goes. Pieces take damage:
  bullets and blades chip them (×0.5 wood, ×0.15 metal, ×0.3 sandbags),
  explosions smash them (×2.5, ×1.3, ×1.6). Your own team's shots don't
  hurt your pieces (unless friendly fire is on). Pieces darken as they're
  hurt and burst into splinters when they break.
- **Networking.** Pieces ride in the mode snapshot: `md.fo` (phase, seconds
  left, cycle, cycles, points left and piece count per team, budget) every
  snapshot, and `md.fp` (every piece) only when pieces change (health at
  most twice a second) plus every 60th snapshot. The client puts every
  piece (and the barrier, during the build phase) into its prediction
  physics, so walking into a wall predicts exactly like on the server.
- **Bots** (`sim/modes/fortsBots.ts`). During the build phase each team's
  bots work through a template laid out round their flag (facing the enemy):
  a front wall with a gap, sandbags out in front, a metal wall inside, side
  walls, a two-high block tower with stairs up to it, a crate. Each bot
  claims the next piece, walks to it and places it through the same rules
  (skipping what doesn't fit). In combat they play CTF. On maps up to about
  150 × 150 m the navmesh is rebuilt with the forts in when combat starts,
  so they path round walls and through gaps; Recast rebuilds the whole mesh,
  which takes seconds on big terrain maps, so those keep their mesh. A bot
  whose way ahead is shut by an enemy piece (and isn't fighting, or has been
  stuck a second) shoots it down, picking an explosive weapon if it has one;
  one stuck on its own team's piece sidesteps.
- **Arcade:** Fort Wars appears on every map with flag bases. The panel
  sets the build and combat minutes, cycles and build points (the match
  time limit doesn't apply). Quick start:
  `?offline=fort_meadow&gamemode=core.forts`. Dedicated server:
  `MODE=core.forts MAP=maps/fort_meadow.json pnpm dev:server`.
- **HUD:** the Fort Wars panel above the weapon bar shows the phase and its
  clock, your build points, both teams' piece counts and, with the Builder
  out, the piece picker with costs, why the ghost can't go where it is, and
  the keys. The flags show as in CTF.
- **Maps.** **Fort Meadow** (`maps/fort_meadow.json`, built by
  `packages/server/src/tools/maps/fort_meadow.ts`) is made for it: a wide,
  rolling meadow with the bases 84 m apart on flat greens, a low ridge with
  two saddles across the middle and knolls on the flanks. Of the other CTF
  maps, the open ones work well: in a 40 s build test bots put up most of
  their template on St John's, Twin Spires, Canyon, Elm Grove and Ridge
  Camp. Bases indoors or on narrow ground leave little room (Temple, Step
  Temple, Void Yard, Bottling), and the huge maps (Blood Gulch, Frost Basin)
  keep their bases on structures and are too big for the navmesh rebuild.

## King of the Hill

- The hill is one of the map's **Hill** spots, used in the order they were
  placed. It moves to the next spot every 60 s (`MatchRules.hillSeconds`).
  With only one spot it stays put.
- A team scores 1 point per second while it is the only team with living
  players inside: within the hill's radius, from just below its floor to
  3.5 m above. Two teams inside is **contested**, and nobody scores.
- The HUD shows who holds the hill and when it moves. The hill is drawn as a
  ring in the holder's colour (white when nobody holds it, amber when
  contested), with a marker that points to it.
- Bots head for the active hill and spread out on it.

## Elimination

- Round-based Team Deathmatch. The dead stay out until the next round starts.
  A round goes to the last team with anyone standing. A round that runs 120 s
  goes to the team with more players alive; a tie is a draw.
- There is a 3 s pause, then everyone respawns for the next round. The score
  limit counts rounds won.
- While only one team has players (warm-up), the dead respawn as normal.
- After 30 s in a round, bots stop roaming and hunt the nearest enemy.

## Zombies

Survival on any map: you and your bot squad hold out against endless waves
of zombies (`sim/zombies.ts`).

- **Waves.** An 8 s wait, then wave 1. Each wave raises more zombies
  (4 + 3 × wave, × 1.5 per extra human; Player Bots count as a third of a
  human), with 15% more health and a little more speed each time. Only so
  many are up at once (6 + 2 × wave, more with more players); the rest wait
  their turn. A wave is beaten when every zombie in it is down, then there is
  a 12 s break.
- **The fallen** stay down until the next wave starts, then come back. When
  nobody is left standing the game is over ("Overrun on wave N") and a new
  one starts after the intermission. The HUD shows the wave, how many are
  left, the countdown between waves and your best wave this session.
- **Where they come from.** Out of sight, 16–70 m from the nearest player:
  the map's NPC spawners first (so a vent, hatch, burrow or breach spawner
  makes them climb out of it), then spawn points, then open floor anywhere.
- **Zombies** are an NPC kind on the soldiers' rig with Quaternius' zombie
  clips (UAL2): they shamble at the nearest living player and claw (no
  weapon). They always know where you are. They are also an encounter
  roster option in MapMaker and a skin in Character Select.
- **Your squad.** Player Bots stay with the humans and let the horde come;
  "Follow me!" / "Hold here!" orders work as in co-op. Quick start
  (`?offline=<map>&gamemode=core.zombies`) brings three bots.

## Map requirements and MapMaker steps

Flag bases and hills are map entities (map format v11): `flag` has `team` and
`yaw`, and `hill` has `radius` (2–20 m). Other modes ignore them.

**Which modes a map offers:** its supported modes that it can run, plus
Capture the Flag when it has a flag base for both teams, King of the Hill
when it has a hill, and Elimination wherever Team Deathmatch is offered.
`playableModes(map)` decides this. A map without flag bases never offers CTF.

MapMaker:

1. **Entities** tab → **Flag Base**. Click to place it. A new base goes to
   the first team without one, and the inspector can change its team and
   facing. Place one per team, somewhere the team can defend and not right on
   its spawn points. 30–80 m apart works well.
2. **Entities** tab → **Hill** for King of the Hill. Place two or more and
   set each one's radius in the inspector. The hill moves through them in the
   order you placed them.
3. Give spawns a team (spawn inspector), as for Team Deathmatch.
4. **Map properties → Mode**: choose Capture the Flag, King of the Hill or
   Elimination. This is the mode TEST plays, and TEST fills the teams with
   bots. Flag bases and hills also make those modes appear in the Arcade
   whatever the main mode is.
5. Validation: listing CTF without a base for each team is an **error**, and
   so is listing KOTH with no hill. A base for a team that isn't one of the
   two is a warning, two bases for one team is a warning (only the first is
   used), and bases less than 16 m apart get a suggestion. Bases and hills
   that can't be reached on foot are warnings.

Map scripts: `m.flag(team, at, yaw)` and `m.hill(at, radius)` in
`packages/server/src/tools/mapkit.ts`, with the modes listed in `m.meta()`.
Bunker Cross, Rail Stockyard and Twin Spires have both. Twin Spires is a
low-scoring CTF map: its bases are 108 m apart on a sniper causeway.

## Playing

- **Arcade:** pick a map. Its mode tabs include the new modes it supports.
  The CTF team rows set the size of the two teams; KOTH and Elimination take
  2–8 teams as in TDM.
- **Quick start:** `?offline=bunker_cross&gamemode=core.ctf` (or
  `core.koth`, `core.elim`).
- **Dedicated server:** `MODE=core.ctf MAP=maps/bunker_cross.json pnpm
  dev:server`. The server refuses a mode the map can't run.
- **Headless bots:** `pnpm bench 8 300 maps/bunker_cross.json --mode=core.ctf`
  prints flag takes, drops, returns and captures. In 5 simulated minutes of
  4v4 on Bunker Cross the bots score about 5 captures.

## Code

- `packages/shared/src/sim/modes/`: `types.ts` (the `ModeLogic` hooks),
  `ctf.ts`, `ctfBots.ts`, `koth.ts`, `elim.ts`. `match.ts` calls them on
  step, kill, leave, round start, snapshot, team scores, vehicle entry and
  bot goals.
- Protocol: `flag`, `hill` and `elim` events, and an optional `md`
  (`ModeSnapshot`) in snapshots carrying team scores, flags, the hill and
  the round state.
- Client: `game/flagVisuals.ts` holds the flag, base and hill models, built
  from primitives and shared with MapMaker. `game/modeHud.ts` handles the
  status line, markers and announcer.
