# Game modes

| Mode | ID | Teams | Score limit counts | Map needs |
| --- | --- | --- | --- | --- |
| Deathmatch | `core.deathmatch` | none | kills | spawns |
| Team Deathmatch | `core.tdm` | 2–8 | team kills | spawns (team spawns optional) |
| Capture the Flag | `core.ctf` | 2 | captures (default 3) | a **Flag Base** per team |
| King of the Hill | `core.koth` | 2–8 | seconds on the hill (default 120) | one or more **Hills** |
| Elimination | `core.elim` | 2–8 | rounds won (default 5) | what TDM needs |
| Co-op | `core.coop` | players vs NPCs | none (logic ends it) | NPC encounters |
| Race | `core.race` | none | first over the line after the last lap | a **track** (Road tool) |

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

## Race

Everyone starts on the start grid in a vehicle and races the map's track
(`sim/race.ts`). Needs a **track** (map format v18), drawn with MapMaker's
Road tool.

- **The start.** Racers are put at the wheel of a fresh vehicle on the
  grid, two abreast behind the start line, in join order. A 3 s countdown
  holds everyone still (when the match's own countdown has just run, the
  race goes straight away). Unused grid vehicles are taken off the track.
- **Checkpoints** are spaced about 40 m apart along the road (at least
  four on a circuit); gate 0 is the start line, which is also the finish
  line of a circuit. They count only in order and only when you cross the
  line forwards within the road's width (plus 4 m), so cutting across the
  infield doesn't help. A lap is a crossing of the start line; the race is
  the track's laps (point to point: one run, start line to finish).
- **Positions:** finishers by finish time, then by checkpoints passed, then
  by distance to the next one. First over the line wins the round; the rest
  have 30 s to finish (or until everyone is in). The HUD shows lap X/Y, your
  place, the race clock, the current and best lap, a marker on the next
  checkpoint (an arrow at the screen edge when it's behind you), the
  running order, the countdown and a **WRONG WAY** warning.
- **Back on track.** Wrecked, thrown out of your vehicle for 1.5 s, stuck
  for 5 s or more than 30 m off the road for 3 s: you are put just past the
  last checkpoint you passed, in a fresh vehicle. Dying (respawn key
  included) does the same after the respawn delay. You can't get out (E).
- **Clean or combat.** In a clean race nobody can hurt anybody (no shots,
  no run-overs between racers, sentries asleep). A **combat race** turns on
  weapons, vehicle guns (the speeder pilot's blasters) and the sideline
  sentries. The track sets it; Arcade can override it, and the vehicle class
  and laps too (`MatchRules.raceCombat`, `raceVehicle`, `raceLaps`).
- **Grip.** On any map with a track, wheeled vehicles grip the road 1.7×
  better and are 15% slower off it; hovercraft don't care.
- **Bots** drive with the reusable `TrackDriver` (`sim/trackDriver.ts`):
  look-ahead steering in their own lane, braking for the bends they see
  coming, pulling out to pass slower cars (braking when boxed in), backing
  out when stuck. In a combat race they fire bursts of their forward gun at
  rivals ahead in reach, after the first 10 s.
- **Ambient cars** (any mode): a track can carry up to 12 NPC-driven cars
  (`track.ambient`, `ambientVehicle`) that lap it with the same driver. They
  belong to no team: they run anyone over, anyone can shoot them up or take
  the wheel (the AI lets go), and wrecked or stranded ones come back in the
  pit lane (`track.pit`, else just off the road by the start line). For an
  F1-style map with traffic while players fight round it.
- **Events:** `race` with `a` = `go` / `gate` / `lap` / `best` / `finish`.
  Snapshots carry `md.rc` (`RaceSnapshot`).
- **Quick start:** `?offline=sandsweep&gamemode=core.race`. Headless:
  `pnpm bench 8 200 maps/sandsweep.json --mode=core.race` (8 bots finish a
  3-lap race in about 3 minutes, ~53 s laps).

Sandsweep Circuit is the demo: a 1 km podrace circuit round a desert mesa
in speeders, a combat race by default, with five sentries on the rocks 31 m
off the straights (they reach only the near edge of the road).

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
