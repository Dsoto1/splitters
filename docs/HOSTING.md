# Hosting Tile Trigger

## Live site: trigger.toshiroplay.com (one AWS Lightsail instance)

The official site is **https://trigger.toshiroplay.com**. Everything runs on
one small Lightsail server: the site, the hub (signaling + game browser +
relay credentials), a relay for strict networks (coturn) and HTTPS (Caddy,
certificates fetched and renewed automatically). Matches run on players'
machines, never on AWS (docs/MULTIPLAYER_DIRECTION.md). The domain
`toshiroplay.com` is registered in AWS, so its DNS is a Route 53 hosted zone.

The server is described by a CloudFormation template and set up by one
script, run from **AWS CloudShell** (no local tools, no keys to manage):

| File | What |
|---|---|
| `infra/toshiro-trigger-multiplayer.yaml` | Lightsail instance (Ubuntu 24.04, 2 GB), static IP, firewall, Route 53 records, alarms, monthly budget |
| `infra/deploy-multiplayer.sh` | validates, creates secrets in SSM, deploys the stack, bootstraps the box over SSH, checks it |
| `infra/host-setup.sh` | runs on the box: Caddy, hub, coturn, systemd restarts, ufw, log limits |
| `infra/turn-check.py` | proves the relay refuses anyone without fresh credentials and won't reach private addresses |

Security and costs: docs/MULTIPLAYER_SECURITY.md, docs/MULTIPLAYER_REVIEW.md
(section 6: about 13 USD a month).

### First deployment (moving from the hand-made server)

In the AWS console (us-east-1), open **CloudShell** (the `>_` icon), then:

```
git clone https://github.com/Dsoto1/splitters.git && cd splitters
infra/deploy-multiplayer.sh --email you@example.com --dns skip
```

This creates the stack beside the current server without touching DNS:
instance `toshiro-trigger-hub`, its static IP, the SSM secrets
`/toshiro/trigger/turn-secret` and `/toshiro/trigger/hub-signing-secret`, a
budget alerting at 15 and 25 USD, and Lightsail alarms. It builds and starts
the game on the new box and checks it (the HTTPS check waits for DNS). Lightsail
emails a verification link for alarm notifications: click it, or alarms stay
silent (budget alerts need no confirmation).

When it reports the hub healthy, move the name over:

```
infra/deploy-multiplayer.sh --dns replace
```

It shows the current record (the old server's IP), asks, deletes it and
lets the stack create its own pointing at the new static IP; Caddy fetches
the certificate within a minute or two, and the script checks
`https://trigger.toshiroplay.com/lobby/health`, `/lobby/ice` and the relay.
Players may reach either server for up to 5 minutes (DNS TTL). Then delete
the old instance and **release its static IP** in the Lightsail console
(an unattached static IP is billed).

Options worth knowing (`infra/deploy-multiplayer.sh --help` for all):

- `--root` also points `toshiroplay.com` at this server (Caddy redirects it
  to trigger.toshiroplay.com). The apex holds a `192.0.2.1` placeholder now;
  replacing it is the owner's call, so it's off unless asked (`--root` with
  `--dns replace` replaces the placeholder).
- `--app-client-id <id>` stores the Cognito app client ID for Trigger (user
  pool `us-east-1_VdMsuDJ59`, login at `login.toshiroplay.com`; the pool is
  shared and is not managed by this stack).
- `--branch <name>` / `--ref <commit>` build another branch or a pinned commit.
- `--admin-ssh-cidr <your-ip>/32` keeps SSH open to your own address;
  otherwise SSH is only open to the Lightsail console's **Connect** button
  (and to CloudShell for the length of a deploy).
- `--bundle medium_3_0` for a 4 GB box (24 USD/month); changing the bundle
  replaces the instance (the script rebuilds it; the static IP stays).

### Later

- **New code on `main`**: re-run `infra/deploy-multiplayer.sh` (same settings
  are kept), or for a quick code-only update: Lightsail console → instance →
  **Connect** → `sudo tiletrigger-update`.
- **Relay abuse or a bandwidth alarm**: Connect → `sudo tiletrigger-relay off`
  (direct connections keep working; `on` to restore, `status` to look).
- **Rotate the relay secret**: `aws ssm put-parameter --name /toshiro/trigger/turn-secret --type SecureString --overwrite --value "$(openssl rand -hex 32)"`, then re-run the deploy.
- **Logs**: Connect → `sudo journalctl -u tiletrigger-hub -f` (hub),
  `-u coturn` (relay), `-u caddy` (HTTPS).
- **Remove everything**: `aws cloudformation delete-stack --stack-name toshiro-trigger-multiplayer`
  (instance, static IP, records, alarms, budget); the SSM parameters stay
  until deleted with `aws ssm delete-parameter`.

### The old one-command setup (still works)

`deploy/aws-lightsail-setup.sh` sets up a hand-made instance in one go, as
the live server was originally built. Kept for other domains and for
reference; the infra/ flow above replaces it for trigger.toshiroplay.com.

1. **Instance:** Lightsail → Create instance → Linux/Unix → OS only →
   **Ubuntu 24.04**. Plan: 2 GB (~$12/month) builds the game comfortably; the
   $5 plan works but builds slowly on swap. Resize later if needed.
2. **Static IP:** Instance → Networking → attach a **static IP**.
3. **DNS:** Route 53 → Hosted zones → `toshiroplay.com` → Create record:
   name `trigger`, type **A**, value the static IP, TTL 300.
4. **Firewall:** Instance → Networking → IPv4 firewall: add **TCP 443**,
   **TCP 3478**, **UDP 3478**, **UDP 49160–49200** (22 and 80 are open
   already; 80 is needed for the HTTPS certificate).
5. **Install:** once `trigger.toshiroplay.com` resolves to the static IP
   (a few minutes after step 3), open Connect (browser SSH) and run:
   ```
   curl -fsSL https://raw.githubusercontent.com/Dsoto1/splitters/main/deploy/aws-lightsail-setup.sh | sudo bash -s -- trigger.toshiroplay.com
   ```
   For another branch, put its name in the URL and add `BRANCH=<name>` after `sudo`.
6. **Play:** https://trigger.toshiroplay.com. After new pushes to `main`, update
   the server with `sudo tiletrigger-update`.

Other games on `toshiroplay.com` get their own subdomain the same way (a new A
record in the same hosted zone). For any other domain, use your own name in
steps 3 and 5.

The other options below are the same pieces, run elsewhere.

Two ways to run online play. Start with the first; add the second when you
want always-on official matches.

## 1. Site + community hub (player-hosted games)

- **The site** is static files (`pnpm build` → `packages/client/dist`). Any
  static host works (Cloudflare Pages, Netlify, GitHub Pages).
- **The community hub** (`packages/server/src/hub.ts`) is the only always-on
  piece. It introduces players' browsers to each other (a PeerJS broker) and
  keeps the game browser's list. No match runs on it, so a tiny VM or
  container is plenty.
  - Run: `pnpm dev:hub` (env `PORT`, default 9000; `HOST`; `TRUST_PROXY=1`
    behind a reverse proxy, which is also where HTTPS goes).
  - Point the site at it: build with `VITE_HUB=hub.example.com` (HTTPS
    assumed when the site is HTTPS and no port is given), or players use
    `?hub=host:port`, or type it under Online → Game browser.
- **Relay for strict networks.** Some home networks block direct browser
  connections ("found the game but couldn't connect"). Give the hub a TURN
  provider and it hands every player short-lived relay credentials
  (`GET /lobby/ice`), so nobody sets anything up. One of:
  - Cloudflare TURN: `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN`
  - Metered: `METERED_DOMAIN` (yourapp.metered.live) + `METERED_API_KEY`
  - Your own coturn (`use-auth-secret`): `TURN_URLS` + `TURN_SECRET`

  Credentials last `ICE_TTL` seconds (default 1 h) and are only given for a
  game open on the hub (its join code), one per game and player (coturn
  usernames `<expiry>:s_<CODE>.<host|p_…>`); each address can ask 12 times a
  minute and each game 30 times, then once a minute. Relayed play is about 3 KB/s per player. Without a
  provider, players can still enter their own relay in Options → Relay.
- **Matches** run in the host player's browser, in a Web Worker (its own
  core, apart from rendering; the page's thread where workers aren't
  available). See docs/PERF_96.md.
- **Size: up to 96 players (48 v 48), up to 10 friends.** Bots fill the
  match to any size up to 96, offline or hosted; friends take bots' places.
  The host's upload carries every friend's snapshots, so a player-hosted
  game takes up to `BROWSER_HOST_MAX_GUESTS` (10) friends; the next one is
  turned away ("match full") and the game browser lists the game with that
  many seats. If the host's device can't keep up with a big match (the
  match falls behind real time, or frames crawl, for 5 s), one quiet line
  suggests fewer bots or lower graphics; nothing otherwise.
- An offline match stays
  offline and private: nothing listens or connects until the player chooses.
  Pause menu → **Go online** (after a confirm) restarts the match on the same
  map and rules (scores reset, bots back to the host's count), opens a join
  code and lists it in the game browser; the HUD shows an "Online" badge with
  players and the code. **Go offline** tells friends "The host took the game
  offline", disconnects them (bots take their places), removes the listing
  and closes the code; the match itself carries on (no restart).
  **Host with code only (not listed)** opens a code without restarting or
  listing (the "List in the game browser" box can still list it later).
  Imported and MapMaker maps are listed as a **Community map** (a tag in the
  game browser and on the host's badge), with the map's ID, version and
  content hash; the hub refuses a listing that claims to be one of our maps
  when it isn't. A listing checks in every 20 s, is hidden after a missed
  check-in (30 s) and drops off at 65 s.
- Traffic per player is ~3 KB/s (8 players) to ~10 KB/s (16 players), and
  12–30 KB/s at 48 v 48 (delta snapshots), compressed, from the host's
  upload. The host's match worker compresses each friend's stream; the page
  only sends it. See PERF_96.md "Hosted 48 v 48".
- **Host controls** (pause menu → Match): the host changes the players
  (free-for-all) or team size (4v4 → 8v8, presets up to 48v48), bot skill and
  style live, restarts or ends the match, and changes map (our suite's maps
  only). Friends are sent `travel` and rejoin the same join code by
  themselves; a friend's own host commands are refused. See "Host controls"
  below.

What a player-hosted game can't do: survive the host leaving, or stop the
host from cheating. The game browser tags these games "Player-hosted".

## 2. Official servers (later)

`pnpm --filter @tiletrigger/server start` runs one dedicated match
(`MAP`, `MODE`, `BOT_FILL`, `PORT`). Several fit on one small VPS (a match
takes ~0.5–1.5 ms of a 16.7 ms tick). Listing them in the game browser is
the next step on the roadmap (#12).

Other settings (environment variables):

| Variable | What it does |
| --- | --- |
| `BOT_FILL` | Players + bots to keep (up to 96: 48 v 48). A player who joins **replaces a bot**: the worst-scoring bot on the team that most needs a person is removed and the player spawns normally (the feed says "Ana joined, replacing Mildred"). |
| `BOT_TAKEBACK=1` | When a player leaves, a bot takes over where they were. Default: the slot empties and a fresh bot spawns normally. |
| `LEADERS=on` / `vip` | Team leaders (gold star; their Follow me / Hold here orders every bot on the team). `vip`: Leader hunt, downing a leader scores 3 for Team Deathmatch. |
| `PLAYLIST=maps/playlists/night_shift.json` | Plays a scenario chain: each won map moves everyone on to the next (see GAME_MODES.md, Scenario chains). |
| `SERVER_NAME` | Name shown in Online → LAN. |
| `ADMIN_TOKEN` | Lets a player run the match from the pause menu (Match: players or team size, bot skill and style, change map, restart, end). A player is admin when they join with `?admin=<token>` in the page address (`/?autojoin&server=ws://…&admin=<token>`) or enter it under pause menu → Server admin. Unset: nobody can. Five wrong tokens close the connection. |
| `LAN_DISCOVERY=0` | Don't answer LAN discovery broadcasts (UDP 7790). |

### 96 players

`MAX_PLAYER_SLOTS` is 96. What keeps that affordable:

- **Interest management** (`shared/src/net/interest.ts`): past 32 players each
  client gets players within 60 m in every snapshot (30 Hz), 60–150 m in every
  other one and farther ones in every fourth; the ones left out are listed in
  `hold` and drawn from the snapshots that had them (carried on along their
  last move until their next copy). Dead/spectating clients get everyone.
- **Delta snapshots** (protocol 4, `SnapshotStream`/`SnapshotDecoder`): each
  connection is reliable and ordered, so every client's copy is written
  against the one last sent to it: players as changes (position in cm), the
  scoreboard, vehicles, pickups, cover and leaders only when they changed;
  your own entry always in full. A third of the characters of full snapshots,
  roughly half the compressed bytes. Each quantised entry and each delta is
  written once per snapshot, shared by clients last sent the same copy.
- **Clients merge a backlog** (`SnapshotCoalescer`, every transport): a page
  that fell behind handles the snapshots waiting as one, so it catches up
  instead of falling further behind.
- **Bot think budget** (`Match.botBudget`): past 40 thinking bots, a bot with
  nobody to fight thinks every other tick and repeats its last move in
  between. Who-may-shoot-whom is worked out once per side a tick, not per bot.
- **Movement detail** (`Match.relaxedMove`): past 40 bots, bots on foot move
  over terrain with its height function instead of its collision mesh (the
  dearest thing Rapier's character controller collides with), and ones more
  than 45 m from every player move every other tick by two ticks' worth
  (snapshots go out every other tick anyway). Empty vehicles 90 m from
  everyone drive at half rate, and parked ones settle and stop simulating.
  Players always get the exact move (it's what their prediction replays).
- **Physics**: static boxes with the same cross-section are merged into fewer
  colliders; player capsules are kept out of the broad phase; a physics
  update after something moved runs Rapier's pipeline directly (World.step
  also walked every collider through a JS callback, ~0.1 µs each, every tick).
- **Long routes** (`NavWorld.findPath`): Detour's default 2,048 search nodes
  ran out on long routes (round the lake on Norman Shores) and the partial
  path counted as no way there: 70% of path queries failed there and bots
  stood about. Searches now have 65,535 nodes, routes that don't exist are
  remembered, and a bot that finds no way backs off (0.2 s doubling to 4 s)
  instead of asking again every few ticks.
- **Client**: past 24 characters on screen, ones over 45 m animate every other
  frame and over 120 m every fourth (meshes already drop to low detail past
  18 m), and ones outside the view aren't drawn (or drawn into the shadow
  map) and animate every eighth frame; at most 12 ragdolls tumble at once (a
  death past that plays the death animation). The shadow map only draws
  casters within its reach of the camera.
- **Bench**: `pnpm bench:96` (96 bots, Frost Basin, Team Deathmatch, 60 s).
  Before this work, on a shared 4-core box: avg 9.3 ms (Frost Basin) and 11.6 ms
  (Shingle Point) a tick. After: 7.7–8.1 ms and 8.8–9.7 ms, with bot AI down from
  2.6–3.6 ms to 1.5–2.1 ms. What's left is mostly Rapier's character
  controller (~50% of the tick, ~40–60 µs a move with autostep and snap to
  ground on big terrain maps). A test (`shared/test/bigMatch.test.ts`) runs
  96 bots for 15 s with a generous 30 ms ceiling.
  `pnpm bench:96:maps` runs the eight big maps (Norman Shores, Apex Ring,
  Capitol Mall, Riot Junction, Eagle Spires, Shingle Point, Frost Basin,
  Primeval Park) and breaks each tick down: bot thinking, path queries
  (count, failures, time), character moves (full and coarse), vehicles and
  traffic, scenario logic, snapshots, process CPU, stuck and idle bots, with
  the load average. After the movement-detail, physics and long-route work
  (October 2026) the process CPU per tick went from 11–16 ms to 7.4–10 ms on
  those maps; see MAP_BUDGETS.md for the table.

### Host controls

Whoever runs a match changes it mid-match from the pause menu's **Match**
section:

| Who | Where the match runs | How a command gets there |
| --- | --- | --- |
| Offline player | their browser | straight to the match |
| Host game host | the host's browser | straight to the match; friends' `host` messages are refused |
| Server admin (`ADMIN_TOKEN`) | the dedicated server | `{ t: 'host', cmd }`; the server checks the sender is an admin |

- **Bots.** Free-for-all and co-op: a total-players stepper. Team modes: a
  per-team size stepper (every team the same size) and presets. Apply
  rebalances live: new bots spawn normally at spawn points; extra bots go,
  the worst-scoring first (fewest kills less deaths, as when a player joins),
  from the team most over its size. Bot skill and style apply to every bot at
  once. Everyone's feed and a toast say what changed ("Host set teams to
  8v8").
- **Change map.** The Arcade's map cards, a tab per mode. Offline also lists
  your MapMaker maps. Servers and Host game only take maps of our suite: the
  server looks the ID up in `maps/` and refuses anything else. Everyone sees
  "Changing map to Diamond Park (Team Deathmatch)…", then:
  - offline, the match restarts on the new map with the same rules (the
    host's own settings, and the score and time limits when the mode stays),
    players and bot skill;
  - Host game, the same, and friends get `travel` and rejoin the same join
    code by themselves (the next match holds their connection until it has
    loaded);
  - dedicated server, everyone gets `travel` and reconnects (an admin with
    `?admin=` or a token entered this session stays admin).
- **Restart match** starts over on the same map (scores cleared, everyone
  respawns, countdown). **End match** ends it now, to the scoreboard.

## 3. LAN games

**Dedicated server on your network.** `pnpm dev:server` prints the addresses
people on your network join at (`ws://192.168.1.20:7777`). The same port
answers `GET /info` (name, map, mode, players; CORS open) and the pause menu
of everyone connected shows the LAN address with a Copy button.

**Finding games: Online → LAN.** Browsers can't send UDP broadcasts, so the
LAN list finds servers two ways:

1. It asks `/info` on ports 7777–7780 of the computer the page came from, of
   this computer (`localhost`) and of any address you add in the panel
   (e.g. `192.168.1.20`). That doesn't search the subnet: a server on another
   computer only shows up if you add it, or…
2. …if a community hub runs on your network (`pnpm dev:hub`). The hub
   broadcasts a probe (`tiletrigger:discover`, UDP 7790) on each of its
   networks for you, and every dedicated server that hears it answers with its
   `/info`. The list asks the hub (`GET /lobby/lan`) and shows what answered.
   Behind a reverse proxy (`TRUST_PROXY=1`) the hub doesn't do this.

Limits: a page served over **https** can't reach `http://`/`ws://` addresses
on your network (mixed content; only `localhost` is allowed), so on the
published site the LAN list only sees servers on your own computer. Open the
game over http on your network for LAN play (the hub serves it: `pnpm build`
then `pnpm dev:hub`, and open the address it prints). Some routers and Wi-Fi
"client isolation" block broadcasts and traffic between devices.

**Player-hosted (Host game) on a LAN.** Join codes work on a LAN without any
relay (the browsers connect directly). When you host from a page opened at
`localhost` and a hub runs on your computer, the host panel also offers the
invite link at your computer's network address.
