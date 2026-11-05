# Community maps: saving, sharing and Community Picks (plan, owner-approved 2026-11-05)

The owner's direction:
- Players may save as many of their own maps as they like.
- Sharing should invite creativity: Far Cry 2's online lobbies and browser, not Far Cry Arcade.
- Vetting is low overhead and needs no moderator: maps earn their place through real plays.
- AWS cost stays near zero.

Every pick below (★) is the owner's choice. Nothing here is built yet; it is queued in HANDOFF.md.

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
