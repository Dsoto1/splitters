# Game modes

| Mode | ID | Teams | Score limit counts | Map needs |
| --- | --- | --- | --- | --- |
| Deathmatch | `core.deathmatch` | none | kills | spawns |
| Team Deathmatch | `core.tdm` | 2–8 | team kills | spawns (team spawns optional) |
| Capture the Flag | `core.ctf` | 2 | captures (default 3) | a **Flag Base** per team |
| King of the Hill | `core.koth` | 2–8 | seconds on the hill (default 120) | one or more **Hills** |
| Elimination | `core.elim` | 2–8 | rounds won (default 5) | what TDM needs |
| Co-op | `core.coop` | players vs NPCs | none (logic ends it) | NPC encounters |

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
