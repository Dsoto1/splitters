# Fireteams: every player leads their own bot squad (owner-approved, 2026-11-06)

## The owner's idea
"A mode where there are 1 player squads, meaning, when they join, they are given a squad of bots that will move
like a squad with them and can be ordered around. I don't want other players to be able to join their squad, it
would only be squads of 4-6 and only 1 player as the leader. Not sure how we would handle AI squads just to fill the
empty map, but that could work possibly too since we already have a somewhat working squad system in place."

The owner approved the write-up and the name **Fireteams**, and queued it **right after Bot AI Phase B**
(docs/BOT_AI_PLAN.md).

## What exists today (docs/BOTS.md)
- **Bot squads.** The director groups free bots into squads of 4–6 once a second, with a leader, a goal and a route
  (`bots/director.ts`, "Squads (clusters)").
  - Members regroup when they fall behind.
  - They go single file through doorways.
  - They are told about the leader's enemy.
- **Team leaders** (`rules.leaders`): a person leads their team's squad.
  - "Follow me!" and "Hold here!" (B, then 1 or 7) order the bots.
  - Pings (T) mark places.
- **Squads are clustered on the fly.** Membership changes as bots move. Nothing belongs to one player.

## Fireteams
A **variant for every team mode** (Team Deathmatch, CTF, King of the Hill, Bomb, Hostage, and MAP 21's assault),
switched on in Match Setup's variants row. There is also a party preset.

1. **Your own squad.**
   - Every human player leads a fixed squad of **4–6, the human included**. The host picks the size.
   - **No human joins another human's squad.** One human per squad, always its leader.
2. **AI squads fill the map.**
   - The rest of each team is **bot-led squads** of the same size. A 24 v 24 with squads of 6 is four squads a side.
   - A friend who joins mid-match **takes over an AI squad**: its bot leader steps down to member. Nobody respawns.
   - When a human leaves, a bot leads their squad.
3. **Orders, by a quick wheel:**
   - **Follow me**
   - **Hold here**
   - **Go there** (where you ping)
   - **Attack that** (ping an enemy)
   - **Defend the objective**
   - **Regroup**
   - **Spread out** / **Stay tight**

   Bots acknowledge each order with a callout. Today's B-menu messages and pings keep working.
4. **They move as a squad:**
   - a formation round the leader that adapts to corridors, doorways and open ground;
   - moving cover to cover;
   - covering fire while a member moves;
   - spotting for each other.
5. **Respawns.**
   - Squadmates respawn near their leader when it's safe, otherwise at their team's spawn.
   - While the leader is down, the squad holds its ground and fights. When the leader is back, it forms up on them.
6. **HUD:**
   - your squad's portraits, health and current order;
   - squad markers on the minimap;
   - your squad's colour on its members.
7. **Scoring:** squad scores, and a squad MVP at the end.

**Later options:** squad wipe (all respawn together), and squad roles through Classes (medic, gunner, marksman).

## How it builds on Bot AI Phase B
- **Scored choices.** The leader's order is a heavy weight in each bot's choice, so squadmates follow orders and
  still fight sensibly.
- **The team brain per mode.** It gives AI-led squads coherent plays (pushes, flanks, defending), so they act as squads
  rather than loose groups.
- **What Fireteams adds:**
  - fixed squads owned by a leader;
  - the order wheel and its acknowledgements;
  - formations and bounding;
  - respawn-on-leader;
  - the HUD;
  - the variant and its party preset.

## Rules that frame it
- **Server-authoritative and deterministic by seed.** Orders are small input messages, checked by the server.
- **Performance:**
  - the same number of bots as any match;
  - squad decisions once a second per side, plus a few comparisons per bot;
  - bot thinking at 96 bots within 2.5 ms a tick (`pnpm bench:96:clump`).
- **Measured with the bot scorecard** (`pnpm bot-report`):
  - squad cohesion (distance to the leader);
  - time to carry out an order;
  - squad survival;
  - the mode's objective numbers.
- **Proof:** e2e for the order wheel and the HUD, then an owner playtest.

## Part 1: done (2026-11-08, `wip/fireteams`)
Part 1 was the variant, fixed squads, the order wheel, respawn on the leader and the measures. Parts 2 (formations and
bounding, the squad HUD) and 3 (squad scores, MVP, the party preset) are still to come. The rules as built are in
docs/BOTS.md, "Fireteams"; the code is `sim/fireteams.ts`.

- **The variant:** "Fireteams" in Match setup's Variants row for Team Deathmatch, CTF, King of the Hill, Bomb, Hostage and
  Breakthrough (MAP 21's assault). The squad size picker (4 / 5 / 6, standard 5) sits beside the score. It is
  `MatchRules.fireteams` (the size), and on servers `rules fireteams 5`. Host travel and the rotation keep it.
- **Squads:** every person leads one; bot-led squads of the same size fill the team, as even as can be. A friend
  joining mid-match takes over a bot-led squad (the one with a hole first): its bot leader steps down, and nobody
  respawns. A person leaving, or going away, hands their squad to its best bot. Holes in a person's squad are filled
  from bot-led squads (the nearest member walks over). Player caps are untouched: squads only group who is there.
  The joining path (`takeOverBot`, `BotFiller.join`) is unchanged: the squads follow the roster (`Fireteams.sync`).
  So wip/party's party join stacks on top without conflict.
- **Orders:** the order wheel. Hold B (a tap is still the quick messages), hold a controller's d-pad up (a tap still
  pings), or tap the Orders button on a phone. The orders are Follow me, Hold here, Go there (a fresh ping, else the
  aim), Attack that, Defend the objective (`ModeLogic.defendSpot`, else the side's trips) and Regroup. Each is an
  input message (say 110-115) that the match checks (`checkOrder`). A bot answers in the chat. The B menu's Follow
  me! and Hold here! order your squad. The HUD shows your squad's order. An order is a heavy weight (2.4) in each
  member's scored choice; following a bot leader is lighter (1.3).
- **Respawn on the leader:** when it's safe by the spawn choice's own measures (`leaderSpotSafe`), else at the team's
  spawn. With the leader down the squad holds and fights; back, it forms up on them (a place order stays).
- **Hooks left for Parts 2 and 3:** `Squad.id / members / order / anchor`, `FireteamOrder.done`, and the 'squad'
  events (`lead`, `order`, `ack`, `deny`) with the squad id.

### Part 1, measured
`pnpm bot-report <maps> --mode=<mode> --seeds=1,2 --seconds=180` with the variant off (the same squads worked out
alongside and measured), on (`--fireteams=5`), and on with an order to every squad every 30 s (`--orders`: Hold here,
Go there 25 m toward the nearest enemy, Regroup, Defend the objective, Follow me, Attack that, in turn). Every bot is
bot-led here (no person). Columns: the mean distance from each member to its leader, the share of members within
10 m, members alive, kills, captures, and hill seconds. Per match.

| Map (mode) | off | on | on + orders |
|---|---|---|---|
| Riot Junction (TDM) | 49.2 m, 15 %, 94 %, 128 kills | 25.0 m, 48 %, 96 %, 88 kills | 36.5 m, 29 %, 94 %, 134 kills |
| Eagle Spires (TDM) | 58.0 m, 21 %, 96 %, 65 | 38.2 m, 36 %, 97 %, 54 | 44.0 m, 26 %, 97 %, 58 |
| Bunker Cross (CTF) | 31.4 m, 22 %, 93 %, 72, 2.0 captures | 25.1 m, 35 %, 96 %, 44, 1.0 | 27.3 m, 30 %, 94 %, 60, 0.5 |
| Diamond Park (CTF) | 38.1 m, 13 %, 90 %, 142, 2.0 | 16.2 m, 50 %, 96 %, 66, 0.5 | 22.4 m, 35 %, 96 %, 56, 0.0 |
| Shingle Point (KotH) | 47.9 m, 18 %, 94 %, 90, hill 104 s | 26.9 m, 50 %, 96 %, 59, 88 s | 29.4 m, 36 %, 96 %, 56, 110 s |

Orders carried out (half the squad there), done / given and the mean seconds. These are scripted orders on bot-led
squads whose leaders keep moving, so a person standing still to give one sees them carried out sooner:

| Map | Hold here | Go there | Regroup | Attack that | Defend the objective | Follow me |
|---|---|---|---|---|---|---|
| Riot Junction | 12/16, 7.9 s | 8/16, 8.2 s | 10/16, 6.5 s | 7/16, 4.4 s | 1/14 (TDM: the trip's end) | 12/15, 5.5 s |
| Eagle Spires | 9/11, 3.0 s | 5/11, 18.7 s | 4/12, 3.0 s | 4/12, 7.8 s | 0/11 | 6/12, 9.2 s |
| Bunker Cross | 6/8, 7.6 s | 6/8, 11.0 s | 3/7, 0.0 s | 3/7, 4.8 s | 5/8, 19.7 s | 3/7, 7.8 s |
| Diamond Park | 12/12, 5.9 s | 7/10, 13.3 s | 9/11, 3.9 s | 7/11, 3.9 s | 10/12, 8.3 s | 6/12, 2.4 s |
| Shingle Point | 9/10, 6.8 s | 9/10, 7.8 s | 9/12, 6.0 s | 7/12, 6.3 s | 5/12, 12.5 s | 9/12, 11.2 s |

- **Cohesion:** the squads hold together. Distance to the leader is 20-57 % less and the share within 10 m is 1.6-3.8
  times as large. Members stay alive slightly more (96-97 % against 90-96 %).
- **The cost: fewer fights and fewer captures.** Squads that keep together meet the enemy less often: kills fall 17-53 %
  (with orders, about main's in TDM). CTF captures fell from 2.0 to 1.0 and 0.5 a match (2 seeds each; captures swing
  about ±1 between seeds). The hill was held about the same. Members follow a bot leader rather than the mode's
  objective; only the leader plays it.
  - Tried and reverted: bot-led members near their leader going for the leader's own objective with it. Cohesion fell
    back (Riot Junction 25 → 38 m), stuck recoveries rose by half, and captures didn't come back (Bunker Cross 1.5,
    Diamond Park 0).
  - **For Part 2 (formations and bounding):** a squad that moves on the objective as a unit is the fix; the owner's
    call whether Part 1 lands as it is.
- **Defend the objective in TDM** has no objective: the wheel dims it, and a person's order is refused. The scripted
  order there went to a trip's end.
- **Bot thinking** (`pnpm bench:96:clump`, 96 bots, CPU ms a tick scaled to CPU time, this container at load 25-33 on
  4 cores; main, the branch with the variant off, the branch with `--fireteams=5`):

  | Map | main | branch, off | branch, Fireteams |
  |---|---|---|---|
  | Norman Shores spread / clumped | 2.61 / 3.25 | 3.07 / 3.64 | 2.66 / 3.38 |
  | Frost Basin spread / clumped | 2.78 / 2.18 | 3.12 / 2.43 | 2.30 / 2.63 |
  | Riot Junction spread / clumped | 2.42 / 2.06 | 2.88 / 2.49 | 2.07 / 1.61 |

  The variant off plays main's matches exactly (same kills and stuck counts); its higher numbers are the load (28-33
  against 25-31). Fireteams costs about what main does. Clumped Norman Shores is over 2.5 ms on main too, at this load
  (the guard's 1.0-1.8 ms was measured on a quiet machine): re-measure both on a quiet one. Fireteams makes more route
  searches (members follow a moving leader: 60 → 104 a second on Norman Shores), within the same thinking time.
