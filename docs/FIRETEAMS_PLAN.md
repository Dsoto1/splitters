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
