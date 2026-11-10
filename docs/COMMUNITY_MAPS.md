# Community maps: saving, sharing and Community Picks (plan, owner-approved 2026-11-05)

The owner's direction:
- Players may save as many of their own maps as they like.
- Sharing should invite creativity: Far Cry 2's online lobbies and browser, not Far Cry Arcade.
- Vetting is low overhead and needs no moderator: maps earn their place through real plays.
- AWS cost stays near zero.

Every pick below (★) is the owner's choice. **Built (2026-11-10, `wip/community-maps`): all five steps of the build
order.** What was built, and where, is in "What's built" at the end; the open questions for the owner are there too.

## Decisions
1. **Local saving: unlimited** ★. Maps are saved in the browser (IndexedDB) and exported or imported as files. No
   account and no server storage.
2. **Sharing by hosting** ★ (Far Cry 2 style).
   - A player hosts a match on their own map.
   - The game browser lists it with a clear **Community map** label, its name and its creator.
   - Joiners receive the map from the host, as they already do. The hub stores nothing but the lobby listing.
3. **Automatic promotion into Community Picks** ★.
   - The hub counts plays per map version.
   - A map that clears the thresholds below becomes a Community Pick, with its own tab in the map list.
   - The owner gets a weekly summary and can promote a pick to **Official** with the existing Publish, or take it
     down.
4. **Community Picks are kept on the hub** ★. Once a map is promoted, the hub asks a client that has it to send its
   map file once, verified against the content hash. Anyone can then play it while the creator is offline, and
   Host Services can rotate it.
5. **The direction rule is amended** ★. See docs/MULTIPLAYER_DIRECTION.md §7:
   - still no uploaded assets or code;
   - validated declarative map files only;
   - stored centrally only after earning Community Pick.

## Play statistics (hub, per map version)
- **Key:** the map's content hash (map id + version).
- **Reports:** the host reports at the end of each match: distinct signed-in players, minutes played, early quits
  (left within 2 minutes), and the reports filed.
- **What counts:**
  - signed-in accounts only, each counted once per map version;
  - bots never count;
  - the creator's own plays don't count;
  - each host contributes at most one match per hour.
- **Storage:** a few hundred bytes per map in the hub's SQLite. Rate limited like the lobby.

## Promotion thresholds (starting values, tunable in the hub's config)
- 25+ distinct players from 5+ different hosts, over 3+ days;
- early-quit rate under 30%;
- under 3 reports per 100 players;
- passes the hub's own check:
  - `loadMap` + `validateMap`, with the same budgets as MapMaker;
  - spawns reachable;
  - no logic loops;
  - schema and size limits (MULTIPLAYER_DIRECTION §8).

## Safety
- **Assets:** maps reference in-house asset IDs only, as today. Unknown IDs fail validation.
- **Player-written text** (map name, description, sign text) goes through a word filter. Every Community map has a
  Report button.
- **Auto-hide:** a map hides automatically past a report threshold, until the owner looks at it.
- **Creator identity** comes from the Cognito sign-in. A creator can withdraw their own map.

## Cost
- **Map size:** median about 300 KB raw (about 30 KB gzip). The largest, St. John's, is 1.6 MB (96 KB gzip).
- **Storage:** 10,000 Community Picks take about 0.3–1 GB gzip on the Lightsail box's disk.
- **Bandwidth:** about 30 KB per download, inside the box's monthly transfer allowance.
- No S3 and no new AWS services. CloudFront only if downloads ever grow past the allowance.

## Build order (when it starts)
1. Local map library: list, rename, duplicate, delete, export and import. Part of it exists in MapMaker's Open.
2. Community map lobbies: the browser labels and filters, and creator names.
3. Hub play statistics, plus the host's end-of-match report.
4. Promotion job, Community Picks tab, the one-time map fetch and its storage, and the owner's weekly summary.
5. Reports, the word filter and auto-hide.

## What's built (2026-11-10)
1. **Local map library** (`packages/client/src/localMaps.ts`, `editor/storage.ts`, `editor/mapSaving.ts`).
   - Saved maps are in IndexedDB: a list store (name, when, size, what a map card needs) read as the page opens, and a
     files store read when a map is opened. Unlimited in practice (the browser's quota is a share of the disk); the
     page asks the browser to keep it (`navigator.storage.persist`).
   - The old localStorage library (`cs.maps.index`, `cs.map.<id>`) moves in once and is removed; if the move is
     refused it stays where it was and is tried again. Without IndexedDB, localStorage is used as before.
   - Open… lists, opens, **Duplicate**s (a new ID and a new identity), **Rename**s and deletes saved maps. Export and
     Import (top bar) were already there. Unsaved drafts stay in localStorage (five at most).
2. **Community map lobbies.**
   - Your saved maps are in Match setup under **Your maps** (`main.ts ownMaps`): host one online and it is listed as a
     Community map (that part was built before: a map outside the suite is listed with its map ID, version ID and
     content hash).
   - **Creator:** the hub records a map ID's creator as the first signed-in account to list it (the host's
     `Authorization` goes with a new listing, `game/hub.ts`), and the listing shows "by <username> ✓"; a map nobody
     signed in has listed shows "creator not signed in". The host's advert can't set it.
   - The game browser: **Community Pick** tag, **Report**, and a map filter (All maps / Our maps / Community maps).
3. **Play statistics** (`packages/server/src/community.ts`, `shared/src/net/community.ts`).
   - Keyed by content hash. The host's report at the end of the match (`game/communityPlays.ts`, sent when the hosted
     session ends or the tab closes, `POST /api/v1/community/plays`, signed in): each signed-in player's account,
     minutes and whether they left within 2 minutes.
   - Counting rules: the hub counts an account only if it gave it an account ticket for that listing's join code (so a
     host can't make players up), plus the host's own account; bots have no account; the creator's plays don't count
     and the creator hosting isn't one of the hosts; one match an hour per host. Each account once per version; an
     early quitter stays one only while every counted play of theirs was early.
   - Kept in `COMMUNITY_DIR/community.json` (on the box `/var/lib/tiletrigger/community`, beside the profiles: no
     setting needed). Accounts only as short salted hashes. Rate-limited like the lobby.
   - **Reports go straight from the player to the hub** (signed in, once per account), not through the host's report.
4. **Promotion** (`community.ts`, `communityCheck.ts`).
   - Thresholds as in the plan, tunable with `COMMUNITY_THRESHOLDS` (JSON with any of `players`, `hosts`, `days`,
     `earlyQuitRate`, `reportsPer100`, `hideReports`, `hidePer100`).
   - A version that clears them is "wanted": the next host report of it gets `wantFile`, and that host sends the file
     once (gzipped, `PUT /api/v1/community/maps/<hex>/file`). The hub checks it in a worker thread (2 min at most):
     it loads, `validateMap` has no errors (MapMaker's budgets; unknown asset IDs fail), its content hash is the
     version's, no `logic.cycle`, a mode can run, no spawn cut off or inside something solid (the navigation check),
     the word filter. Passed: a **Community Pick**, its file kept in `COMMUNITY_DIR/picks/<hex>.json`. Failed: kept
     out, with the reason in the owner's summary.
   - The **Community Picks** tab in Match setup (`main.ts pickEntry`, `frontEnd.ts`): the picks' files come from the
     hub when picked. Hosted, a pick is listed as a community map with its Community Pick tag.
5. **Safety.** The word filter (`shared/src/net/community.ts blockedWord`: case, accents, look-alikes, spacing and
   repeats; short words whole only, so "Scunthorpe" and "Class" pass; the owner adds words with
   `COMMUNITY_BLOCKED_WORDS`) on listing names, map names and every player-written string of a pick. Auto-hide: 5
   fresh reports and at least 10 per 100 players (tunable); hidden maps can't be listed. Creators withdraw a map
   (every version) from Profile → Community maps.
6. **The owner.** Profile → Community maps (signed in as an owner): the week's summary with **Make Official** (the
   pick's file published through publish.ts, so it becomes an official map everywhere), **Take down** and **Restore**.
   The same data: `GET /api/v1/community/summary?days=7[&format=text]` and, on the box,
   `pnpm --filter @tiletrigger/server community-summary /var/lib/tiletrigger/community`. No email is sent.

Tests: `packages/server/test/community.test.ts` (counting rules, thresholds, promotion, the check, the word filter,
auto-hide, withdraw, the API), `packages/client/test/localMaps.test.ts`, `communityPlays.test.ts`; e2e `community`.

**Deployment:** nothing on AWS. The hub keeps its new folder in its own state folder; an update of the box brings the
code. Bandwidth and disk as in "Cost" above.

### Open questions for the owner
Parked, with the default built in brackets:
1. **The hub's storage.** The plan says SQLite; the hub keeps everything else in JSON files, so community stats are a
   JSON file too (written a moment after a change). (a) keep JSON [built]; (b) move to SQLite (`node:sqlite`, Node 22).
2. **Creator identity.** (a) the first signed-in account to list a map ID [built]; (b) stamp the creator's account in
   the map file's release block at Export (a map format change, MapMaker lane).
3. **The creator as a host.** (a) the creator's matches count other players, but the creator isn't one of the 5
   hosts [built]; (b) they count as a host too; (c) the creator's matches don't count at all.
4. **"Over 3+ days".** (a) plays on 3 different days [built]; (b) 3 days between the first and the last counted play.
5. **Auto-hide threshold** (the plan gives none). (a) 5 reports and 10 per 100 players [built]; (b) a flat number
   (say 5); (c) another number.
6. **Dedicated Host Services** have no sign-in, so their matches aren't reported. (a) leave them out [built];
   (b) give paired Host Services a way to report (signed with their pairing).
7. **Where Report shows.** (a) the game browser and Match setup's picks [built]; (b) also the pause menu in a match.
