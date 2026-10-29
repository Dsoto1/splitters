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
| Disc Arena | `core.discs` | none | knock-offs (default 10) | listed in the map's modes (decks over a void) |
| Race | `core.race` | none | first over the line after the last lap | a **track** (Road tool) |

**Classes** isn't a mode but a match setting for any mode with weapons
(see below).

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
  something underneath, enough build points, and at most 200 pieces per team.
- **Build points** (default 420 per team): what your standing pieces cost
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
  `maps/fort_meadow.json`) is made for it: a wide,
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

## Classes

A match setting (`MatchRules.classes`, Arcade **More rules → Classes**) for
every mode with weapons: Deathmatch, TDM, CTF, KOTH, Elimination, Bomb and
Hostage (not co-op, Zombies, Fort Wars, or spears/discs only). Everyone plays one of
nine classes (`sim/classes.ts`), each with its own loadout of existing
weapons, health and speed. Classes replace character sizes' health and speed
(sizes still set the hitbox).

| # | Class | Role | HP | Speed | Loadout (held last) | G |
|---|---|---|---|---|---|---|
| 1 | Runner | Offence | 75 | 1.3 | Knife, Machine Pistol, Sawed-Off; **double jump** | — |
| 2 | Rocketeer | Offence | 130 | 0.86 | Knife, Shotgun, Blast Rockets (rocket-jump) | frag |
| 3 | Torch | Offence | 115 | 1.0 | Knife, Shotgun, Oil Slicker, Flamethrower | — |
| 4 | Breacher | Defence | 115 | 0.93 | Knife, Pistol, Grenade Launcher | 3 proximity mines |
| 5 | Bulwark | Defence | 200 | 0.77 | Knife, Shotgun, Spin Gun | — |
| 6 | Mechanic | Defence | 100 | 1.0 | Knife, Pistol, Shotgun | **build sentry** |
| 7 | Medic | Support | 100 | 1.07 | Knife, Nailgun, Medi-Beam | **overcharge** |
| 8 | Marksman | Support | 85 | 1.0 | Knife, SMG, Railgun (charged) | — |
| 9 | Shade | Support | 85 | 1.07 | Hand Cannon, Knife (backstab kills) | **cloak** |

- **Class screen.** Opens when you join and whenever you're down; **L** or
  **,** opens and closes it. Number keys 1–9 or a click pick a class. While
  you're still at your spawn point and unhurt (or in your first 8 s), the
  new class's loadout replaces yours at once; otherwise it starts at your
  next spawn. The pick travels as `PlayerInput.say = CLASS_SAY_BASE + index`,
  so it works over every transport.
- **Limits.** `MatchRules.classLimit` caps players per team in one class
  (Arcade: Max 1 / Max 2). Full classes are dimmed on the class screen.
- **Abilities (G, instead of a grenade).**
  - Mechanic: builds the map's **sentry gun** mount on the floor ahead
    (one per Mechanic; kills are the Mechanic's). It is also a
    **dispenser**: teammates within 3.5 m get 10 HP/s and ammo each second.
    A destroyed sentry's kit comes back after 12 s. Built sentries go out in
    snapshots as `BUILT_MOUNT_BASE + slot`; the client draws them from the
    snapshot alone.
  - Medic: the Medi-Beam heals the teammate in your sights (30 HP/s, 9 m);
    300 HP of healing fills the **overcharge**: 6 s when neither you nor the
    teammate you last healed can be hurt.
  - Shade: **cloak** for up to 9 s (recharges in 10 s); firing breaks it.
    Cloaked Shades are almost invisible to enemies (`FX_CLOAK`), and bots
    treat them like players hidden in a bush. A knife hit from behind kills.
- **HUD.** Your class and its ability state sit over the vitals; the
  scoreboard shows everyone's class (`PlayerSnapshot.cl`); your own class
  and ability charge come in `PrivateState.cl` (which also lets the client
  predict the Runner's double jump and class speeds).
- **Bots** take whatever their team has fewest of (Rocketeer, Medic,
  Bulwark, Mechanic, Runner, Torch, Breacher, Marksman, Shade), within the
  limit. Mechanics build at the objective (or wherever they are after 10 s,
  or in a fight); Medics follow the teammate who needs them most, beam them
  when they're hurt and overcharge in a fight; Shades cloak while moving in.
- Quick start: `?offline=twin_spires&gamemode=core.ctf&classes=1`
  (`classes=2`: at most two per class per team).

## Disc Arena

Ricochet-style free-for-all (`core.discs`, `sim/discs.ts`) on maps that list
it. Everyone holds the **Arena Disc** and starts with three discs that fly
straight and bounce off walls (up to six times). After 2.4 s, or when it hits
someone, a disc **drops where it is**, and anyone short of three picks it up by
walking over it, like ammo (not the player it just hit, for 0.4 s). One that
falls into the void goes back to its thrower, and so does one left lying 15 s. Discs do **no damage**: a hit shoves the player away (and a little
up). Fall into the void within 6 s of an enemy's hit and it's **their point**;
fall on your own and you lose one. Your own discs never hit you, and discs
glance off anyone who spawned (or started the round) in the last 2 s.

- **Power discs** (pickups, `core.disc_fast`/`triple`/`split`/`freeze`) are
  good for your next three throws: fast (1.7× speed, a harder shove), triple
  (three discs in a fan; only the middle one drops to be picked up), splitting (it
  becomes three at its first bounce) and freeze (freezes whoever it hits
  for a moment, with only a nudge). The HUD shows the power and throws left.
- No weapon, ammo or grenade pickups, no kill streaks. **Weapons: Discs
  only** in the Arcade plays any mode (TDM too) with the same discs.
- **Bots** lead their throws like any projectile, sidestep and hop discs
  about to hit them (never off the edge), stop at edges, leave jump pad
  flights alone, and steer back toward the deck when knocked out over the
  void. In 3 simulated minutes of 6 bots on Grid Rings about 40 knock-offs
  are credited and bots fall on their own about once.
- **Grid Rings** (`maps/grid_rings.json`, script
  `maps/grid_rings.json`) is the demo arena: a hub,
  four rings with bounce walls and four towers with the power discs, all
  dark circuit decks rimmed in light under a night sky, joined only by jump
  pads.
- MapMaker: **Map properties → Mode → Disc Arena**. A map listing only Disc
  Arena isn't asked for health pickups.

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

Flags and hills are placed in MapMaker (Entities → Game Modes & Objectives),
with the modes listed in the map's settings. Bunker Cross, Rail Stockyard and Twin Spires have both. Twin Spires is a
low-scoring CTF map: its bases are 108 m apart on a sniper causeway.

## Big matches, taking over bots, team leaders

- **48 v 48.** Up to 96 players and bots (Arcade team sizes go to 48; presets
  16v16, 24v24, 48v48). See HOSTING.md (96 players) for what keeps it fast.
- **Joining running matches.** A player joining a running match (dedicated
  server, Host game, or a LAN game) makes room by removing a Player Bot: the
  worst-scoring one (fewest kills less deaths) on the team that most needs a
  person. They then spawn normally at a spawn point with a fresh loadout. The
  feed says "Ana joined, replacing Mildred".
  When a player leaves, their slot empties and a fresh bot spawns normally to
  keep the teams full (servers can have a bot take over where they were
  instead: `BOT_TAKEBACK=1`).
- **Team leaders** (Arcade → More rules → Team leaders; servers `LEADERS=on`).
  Each team's first person leads it (a bot leads a team without one; a
  person joining takes over from a bot leader). Leaders wear a gold star that
  both sides see. A leader's "Follow me!" / "Hold here!" (B, then 1 or 7)
  orders every bot on the team wherever they are; anyone else's reaches the
  bots within 30 m. **Leader hunt** (`vip`): in Team Deathmatch, downing an
  enemy leader scores 3 extra for your team (the feed calls it out).

## Scenario chains

Co-op maps can be played back to back:

- **Playlists** are JSON files in `maps/playlists/` (`format:
  "tiletrigger.playlist"`, `id`, `name`, `description`, `maps: [{ map, mode? }]`,
  `carry: { score, loadout }`, `loop`). Win a map and everyone goes on to the
  next; lose and the map restarts. `carry` keeps your score and your weapons
  (with their ammo) into the next map. The first one is **Night Shift**:
  Outpost Siege → Creature Lab → Blackout → Dead Reel.
  Play one from Arcade → a co-op map → Playlist, or on a server with
  `PLAYLIST=maps/playlists/night_shift.json`.
- **MapMaker "Next map"** (Logic → DO → "Next map (wins, then loads it)",
  text: a map ID such as `creature_lab`) wins the match and sends everyone on
  to that map, carrying score and weapons. Only maps of our own suite load:
  the ID must be a file in `maps/` (MapMaker warns about a malformed ID; the
  host and the dedicated server look it up and ignore anything else).
- On a dedicated server the map changes CS-style: clients get a `travel`
  message, reconnect by themselves, and get their score and weapons back.
  In Host game, friends get `travel` too and rejoin the same join code by
  themselves (the host's browser starts the next match on the same code).
- **The host can change map any time** (pause menu → Match → Change map):
  see HOSTING.md, Host controls. The same section changes the players or
  team size and bot skill and style live, and restarts or ends the match.

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

- `sim/classes.ts` (class data, `ClassPlay`: spawn loadouts, abilities, damage
  rules, dispensers, class bots) and `sim/discs.ts` (power discs, throws,
  splitting, bots' dodging and edge sense); `match.ts` calls them at a few
  hook points.
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
