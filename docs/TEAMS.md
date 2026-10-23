# Teams and squads

Team Deathmatch takes 2–8 teams of any sizes (1–16 players each, 32 in all):
1v1, 2v2 squads, 4v4, three-way 3v3v3, eight squads of two, or lopsided
mixes like 2v2v2v2v2v2v12 and 1v3.

- **Teams.** Embers, Tide, Verdant, Volt, Violet, Frost, Crimson and Ash, in
  that order. A map that names two factions renames the first two.
- **Rules.** `MatchRules.teamSizes` holds players per team. Each newcomer,
  human or bot, joins the team furthest below its size as a share of it, so
  a 12-player team fills alongside 2-player squads. When bots leave, they
  leave the team most over its size. Kills score for the killer's team; the
  highest team score wins, and a tie at the top is a draw.
- **Spawns.** A team spawns on its own points when the map has any, else on
  shared points, else on anyone's, always farthest from enemies. So an
  8-team match works on a two-base map. Bots of teams with a base push
  toward the others' bases; teams without one roam.
- **MapMaker.** In Team Deathmatch, Map properties has a Teams section:
  pick a preset or set each team's size, then add or remove teams. Spawns can
  be given to any of the eight teams. TEST fills every team with bots.
  The layout is saved in the map (`teamSetup`, format v8) as its
  recommendation.
- **Arcade.** Team Deathmatch has a Teams row (presets, + / − Team) and a
  size stepper per team in its colour. The match fills every team with bots
  and you take a place on one.
- **HUD.** The score bar shows your team on the left and the strongest other
  team on the right (marked "lead" with three or more teams). The
  scoreboard (Tab) lays the teams out side by side.
