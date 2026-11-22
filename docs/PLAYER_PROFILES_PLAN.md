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

### Phase 2 (built 2026-11-22, `wip/profiles-2`): emblems, titles, other players' cards

- **Emblems** (`shared/content/emblems.ts`, drawn by `client/game/emblemSvg.ts`): 16 shapes of our own (flat polygons in the badges' style: bolt, star, crown, flame, wings, crosshair, shield, diamond, sword, heart, moon, sun, spade, eye, trident, tiles) in 12 colours, on a dark round plate rimmed in the colour. An emblem is data only: `"<id>.<colour>"`. Picked on Profile (Emblem and title); kept in this browser (`tiletrigger.emblem`) and on the account when signed in (`PUT /api/v1/profile { emblem }`). Shown after your name on the scoreboard, in the kill feed and on your card.
- **Titles** (`shared/content/titles.ts`): a small table, each with how it's earned (Recruit, Regular, Veteran, Champion, Marksman: 40 % over 50 matches, Headhunter, Unstoppable, Survivor, Centurion, Specialist, All-Rounder, Marathoner). Profile's Title list offers the earned ones (the rest greyed with how). The hub takes a signed-in player's title only once the career it keeps has earned it.
- **In the match**: the hello carries `em` and `tt` (checked against the tables by every host: `parseClientMessage`), the roster passes them on (people only). `PROTOCOL_VERSION` stays: older hosts and browsers ignore them.
- **Other players' cards** (`client/game/playerCard.ts`): click a row on the pause menu's Match tab or the end-of-match board (the Tab board takes no clicks while you aim) and the card opens beside it: portrait, name with ✓ / GUEST / BOT, emblem, title, character, class (or favourite class), this match's K and D, and for a signed-in player the career headline from the hub (`GET /api/v1/profile/card?u=<username>`: public fields only: username, emblem, title, favourite class, career, host-counted record; no account id, no region; no sign-in needed, rate-limited like the other reads). A guest's career stays in their browser, so their card says so; without the hub (offline, an older hub) a signed-in player's card shows the match's part only.

### Phase 3 (built 2026-11-22): history, per-mode and per-weapon stats

- A match summary also carries the map's name (cleaned: letters, digits, a little punctuation, 40 characters), rounds and hits by gun (`weaponRounds`), and when it ended (`at`; the hub keeps it if it's within the last 30 days and not ahead of its clock, else uses its own).
- A career keeps a line per mode (matches, wins, kills, deaths, rounds, hits, time; up to 24 modes), rounds and hits by gun (40 guns) and the last 20 matches (time, map, mode, result, K, D). All bounded and checked like the totals (`matchProblem`, `careerProblem`: the parts add up to no more than the totals); a guest career moving onto an account brings them (the hub takes up to 16 KB for that one request).
- Profile's Career block has tabs: **Overview** (the totals as before), **Modes**, **Weapons** (kills, accuracy, rounds; the weapon's icon) and **History**.
- Signed in against a hub from before Phase 3, the hub keeps only the totals; the detail then comes from this browser's copy of the matches played here signed in (`tiletrigger.career.mirror`), and Profile says so.
- Size: about 2-4 KB per player in `profiles.json` (a thousand players: a few MB). Still one file; past ~10 MB, one file per player or SQLite on the same box (no RDS).

### Phase 4 (built 2026-11-22): stats other people's hosts counted

- **How**: at a match's end a signed-in **browser host** of a listed game sends the hub the standings it computed for the signed-in friends still in it (`POST /api/v1/profile/vouch`: join code, mode, and per account its result, kills, deaths and seconds in the match; `shared/net/vouch.ts`). The friends' accounts are the ones their tickets proved to the host (`communityPlays.ts` PlayTracker, `LocalTransport.accountSlots`).
- **What the hub keeps**: a line counts for an account only if the hub gave that account a ticket for that code in the last 6 hours (it remembers tickets in memory, like the community counts), it isn't the host's own account, and its seconds fit in the time since the ticket and since the last line for that account in that game (so a host can't send an hour of play in a minute). A host may send a few a minute. Each counted line adds to the account's **host-counted record** (matches, wins, kills, deaths, time).
- **Shown**: on Profile (signed in) under the career, and on a signed-in player's card ("Counted by other hosts: N matches · W wins · K/D"). The self-counted career is unchanged; nothing reads either for matchmaking or rewards.
- **Not yet**: the Host Service (dedicated host) doesn't vouch (it isn't signed in to an account); a host and a friend who collude can still inflate each other. Both fine for a casual game (MULTIPLAYER_DIRECTION §6).

## What the owner deploys for Phases 2-4

Nothing on AWS changes: no new table, bucket, template, host or paid service. The hub's code changed (new routes on the existing `/api/v1/profile`: `GET card`, `POST vouch`; new fields in the same profiles file), so **redeploy the hub** as for any hub change (the update script that pulls the release, or `infra/deploy-multiplayer.sh`). Until then: emblems and titles still show in matches (they travel between browsers) and stay in each browser, other players' cards show the match's part only, history and per-mode stats come from each browser's own copy, and nothing is host-counted.

## What the owner deploys for Phase 1

Nothing on AWS changes: no new table, bucket, template or host. The hub's code changed (new routes on the existing `/api/v1/profile`, profile file fields), so **redeploy the hub** as for any hub change (`infra/deploy-multiplayer.sh`, or the update script that pulls the release). Older profiles read as empty careers. Until the hub is redeployed, signed-in players' matches wait in their browsers (up to 20) and the favourite class stays in the browser.

## Open questions (Phase 1 built with the ★ pick)

1. Bot matches in the career: a ★ all count · b only matches with other people · c two careers (bots, online)
2. Who counts a match: a ★ the player's browser, the hub checks it's plausible · b the host vouches (Phase 4 now)
3. A guest's career at the first sign-in: a ★ moves onto the account once · b stays in the browser · c ask
4. Favourite loadout: a ★ a favourite class, picked for you in class matches · b also a favourite weapon set for Match Setup · c marked only, never picked
5. Profile cards: a ★ your own now, other players' in Phase 2 · b other players' now too
6. End of match: a ★ card under the board, the board moved above the awards · b card on Tab only
7. Shortest match that counts: a ★ 30 s · b 2 min · c any
8. Next: a ★ Phase 2 (emblems, other players' cards) · b Phase 3 (history, per-mode) · c stop here
