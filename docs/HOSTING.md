# Hosting Tile Trigger

## Live site: trigger.toshiroplay.com (one AWS Lightsail instance)

The official site is **https://trigger.toshiroplay.com**. Everything runs on
one small Lightsail server: the site, the hub (broker + game browser), a relay
for strict networks (coturn) and HTTPS (Caddy, certificates fetched and renewed
automatically). The domain `toshiroplay.com` is registered in AWS, so its DNS
is a Route 53 hosted zone. Script: `deploy/aws-lightsail-setup.sh`.

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

  Credentials last `ICE_TTL` seconds (default 6 h); each address can ask
  12 times a minute. Relayed play is about 3 KB/s per player. Without a
  provider, players can still enter their own relay in Options → Relay.
- **Matches** run in the host player's browser (pause menu → Host game).
  Ticking "List in the game browser" lists it; it checks in every 20 s and
  drops off within about a minute of the host leaving.
- Traffic per player is ~3 KB/s (8 players) to ~10 KB/s (16 players),
  compressed, from the host's upload.

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
| `LAN_DISCOVERY=0` | Don't answer LAN discovery broadcasts (UDP 7790). |

### 96 players

`MAX_PLAYER_SLOTS` is 96. What keeps that affordable:

- **Interest management** (`shared/src/net/interest.ts`): past 32 players each
  client gets players within 60 m in every snapshot (30 Hz), 60–150 m in every
  other one and farther ones in every fourth; the ones left out are listed in
  `hold` and drawn from the snapshots that had them. Every player entry is
  turned into JSON once per snapshot, not once per client. Dead/spectating
  clients get everyone.
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
