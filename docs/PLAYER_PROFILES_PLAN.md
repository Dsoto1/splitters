# Player profiles: plan

QUEUE Features, lane B (the owner's next priority after gun handling, 2026-11-18). Written and Phase 1 built on `wip/player-profiles` by a helper of lane B's splitters22. The owner's direction: profiles are small and declarative, cheap to keep on AWS (docs/MULTIPLAYER_DIRECTION.md: AWS coordinates, players' machines compute), and nobody uploads anything (no avatar pictures: you are your in-game character).

## What was there before

- **Identity.** Optional sign-in with the owner's ToshiroPlay Cognito pool (Google), through the "trigger" app client, PKCE, no secret in the site (`packages/client/src/account.ts`). The hub verifies tokens against the pool's keys (`packages/server/src/auth.ts`).
- **The hub's profiles.** `packages/server/src/profiles.ts`: by Cognito `sub`, a username (unique whatever the case, signed into account tickets so hosts show ✓) and a region, in one small JSON file (`PROFILES_DIR/profiles.json` on the Lightsail box, `/var/lib/tiletrigger/profiles`). No database.
- **The menu's Profile screen** (`frontend/frontEnd.ts`, P or the badge top right): your character (Change character), username or guest name, Sign in / Sign out, region, privacy link.
- **In this browser:** your name and clan tag (`cs.name`, `cs.clan`), your character (`cs.look`), Character Select's favourites, the last match setup. Nothing kept between matches about how you played.
- **In a match:** kills and deaths on the scoreboard; the end-of-match awards (`sim/awards.ts`: Most Accurate from rounds fired and hit, streaks, nemesis). All gone when the match ends.
- **Loadouts:** there are no personal loadouts. Weapons come from the match's weapon set and pickups; in a match with Classes you pick one of nine classes on the class screen.

## Phases

### Phase 1 (built): career, favourite class, profile card

- **Career stats**: matches, wins (and win rate), kills, deaths, K/D, accuracy, headshot kills, best streak, time played, favourite weapon (most kills). `shared/net/career.ts` (the totals, a match summary, the bounds the hub enforces).
- **Counted by the browser that played** (`client/game/careerTally.ts`), from the events it already gets (shots, impacts, kills, the round end): a few additions per event, nothing at match start, nothing per frame. Accuracy counts exactly as the Most Accurate award does (guns' rounds, hits on enemies). A match counts when it ends with you in it for at least 30 s; not while spectating, not in MapMaker TEST or the tutorial. Bot matches count (most play is offline against bots).
- **Guests**: the career lives in the browser (`tiletrigger.career`).
- **Signed in**: on the hub, in the same profiles file (a few hundred bytes per player). Each match end sends one summary (`POST /api/v1/profile/match`); the hub checks it (`matchProblem`: whole numbers, hits ≤ shots, headshots and streak ≤ kills, at most 500 kills, at least 30 s …) and adds it. A few a minute per account. A summary the hub can't take now waits in the browser (up to 20) and goes later. Writes are batched (one file write within 2 s; flushed on stop).
- **First sign-in**: a guest career in this browser moves onto an account with no matches, once (`POST /api/v1/profile/career`, bounded the same way per match), then leaves the browser.
- **Favourite class** ("favourite loadout"): picked on Profile; picked for you as you join a match with classes (the class screen stays open, its card marked ★, so you can change it). In the browser for everyone, on the profile when signed in (`PUT /api/v1/profile { favClass }`).
- **Profile card** (`client/game/profileCard.ts`): a strip under the Tab scoreboard and the end-of-match board with your portrait, name (✓ or GUEST), character, favourite class, this match so far (K, D, accuracy) and your career line. Patched only when its text changes.
- **Profile screen**: a Career block (nine figures and the favourite weapon with its icon, where it's kept) and a Favourite loadout block.
- **Trust**: a modified browser can send inflated numbers. No ranked play, so the hub only checks plausibility (MULTIPLAYER_DIRECTION §6). Nothing reads the career for matchmaking or rewards.
- **Cost**: no new AWS service, table or endpoint host: the existing hub process and file. A match end is one small HTTPS request.

### Phase 2: other players' cards and emblems

- **Emblems**: a set of in-game emblems (vector shapes in our own style, a colour), picked on Profile; shown beside your name on the scoreboard, kill feed and card. Data only (an emblem id and a colour index). No uploads.
- **Other players' cards**: click a row on the scoreboard (or hold Tab and point) to see that player's card. Signed-in players' cards come from the hub by username (`GET /api/v1/profile/card?u=`: public fields only: username, character, emblem, favourite class, career headline); the account ticket already proves the username. Guests show their in-match card only.
- **A title** chosen from what you've earned (e.g. "Marksman" at 40 % accuracy over 50 matches), from a small table in content.

### Phase 3: history and per-mode stats

- The last 20 matches (map, mode, result, K/D) on Profile; career split by mode; per-weapon stats (kills, accuracy) on a Weapons tab.
- Still one file per hub unless it grows past a few MB (then one file per player, or SQLite on the same box: still no RDS).

### Phase 4 (only if wanted): stats a host vouches for

- A host (browser or Host Service) sends the end-of-match standings it computed, signed by the hub's account tickets, so stats can't be inflated by a modified browser. Only worth it if stats ever feed anything competitive (not planned).

## What the owner deploys for Phase 1

Nothing on AWS changes: no new table, bucket, template or host. The hub's code changed (new routes on the existing `/api/v1/profile`, profile file fields), so **redeploy the hub** as for any hub change (`infra/deploy-multiplayer.sh`, or the update script that pulls the release). Older profiles read as empty careers. Until the hub is redeployed, signed-in players' matches wait in their browsers (up to 20) and the favourite class stays in the browser.

## Open questions (built with the ★ pick)

See the report to the lead (QUEUE "Waiting on the owner" once landed).
