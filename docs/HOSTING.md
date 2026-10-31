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
| `infra/tiletrigger-update.sh` | runs on the box (`sudo tiletrigger-update`): installs the site build CI made, verified; rollback (see [Updates](#updates-how-new-code-reaches-the-box)) |
| `tools/ci/client-release.sh` | CI: packages the site build and publishes it to GitHub Releases |
| `infra/turn-check.py` | proves the relay refuses anyone without fresh credentials and won't reach private addresses |
| `infra/test/update-dry-run.sh` | a local rehearsal of updates, refusals and rollbacks (no AWS, no GitHub) |

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
budget alerting at 15 and 25 USD, and Lightsail alarms. It installs the latest
site build CI published for `main` (the box doesn't build it; see
[Updates](#updates-how-new-code-reaches-the-box)), starts the game on the new box
and checks it (the HTTPS check waits for DNS). Lightsail
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
- Sign-in: every run looks up the shared ToshiroPlay Cognito pool from its
  login domain (`--cognito-domain`, default `login.toshiroplay.com`) and
  Trigger's app client in it by name (`--app-client-name`, default `trigger`;
  or `--app-client-id <id>`). Nothing is hardcoded: the hub gets them in its
  environment and gives the page its client and login domain at
  `/auth-config.js`. If a lookup fails, the stack keeps the values it has.
- Budget: `--budget-scope project` (default) counts only costs tagged with the
  project (every taggable resource carries `Project=toshiro-trigger` and
  `AppName=TileTrigger`; pick the one activated as a cost allocation tag with
  `--budget-tag`); `account` counts the whole AWS account. A deploy with the
  current script retags the live stack in place (no new server); costs before
  the change keep the old `AppName` value in Cost Explorer.
- Which build: by default the latest green build of `main`; `--release vX.Y.Z`
  a release, `--channel stable` the newest release, `--ref <commit>` a commit
  CI published, `--branch check/<name>` (testing) the head of a check branch
  from its green CI build. `--build-here` builds on the box instead (slow;
  only when asked). `--auto-update on` turns on the hourly update timer.
- `--admin-ssh-cidr <your-ip>/32` keeps SSH open to your own address;
  otherwise SSH is only open to the Lightsail console's **Connect** button
  (and to CloudShell for the length of a deploy).
- `--bundle medium_3_0` for a 4 GB box (24 USD/month); changing the bundle
  replaces the instance (the script rebuilds it; the static IP stays).

### Later

- **New code on `main`**: once CI is green it publishes the build; then
  Lightsail console → instance → **Connect** → `sudo tiletrigger-update`
  (seconds), or re-run `infra/deploy-multiplayer.sh` (same settings are kept;
  also applies config changes). Back out with `sudo tiletrigger-update --rollback`.
- **Relay abuse or a bandwidth alarm**: Connect → `sudo tiletrigger-relay off`
  (direct connections keep working; `on` to restore, `status` to look).
- **Rotate the relay secret**: `aws ssm put-parameter --name /toshiro/trigger/turn-secret --type SecureString --overwrite --value "$(openssl rand -hex 32)"`, then re-run the deploy.
- **Logs**: Connect → `sudo journalctl -u tiletrigger-hub -f` (hub),
  `-u coturn` (relay), `-u caddy` (HTTPS).
- **Remove everything**: `aws cloudformation delete-stack --stack-name toshiro-trigger-multiplayer`
  (instance, static IP, records, alarms, budget); the SSM parameters stay
  until deleted with `aws ssm delete-parameter`.

### Updates: how new code reaches the box

The box never builds the site. A `vite build` on the 2 GB instance took ~5
minutes at 100% CPU and ~1.5 GB of heap: it drained the CPU burst credits (the
CPU-burst alarm fired) and once ran out of memory. Now CI builds and tests the
site, and the box downloads that build for the exact commit, checks it and
switches to it in seconds.

**In CI** (`.github/workflows/ci.yml`, `tools/ci/client-release.sh`): every
push builds the site with `VITE_HUB=self` (the site is served by its hub; the
only difference from the e2e build), packages it as a reproducible
`tiletrigger-client-<sha>.tar.gz` (sorted, fixed owner, modes and times: the
same commit gives the same bytes) with `tiletrigger-client-<sha>.json`
(build.json: commit, version, times, Node/pnpm versions, CI run) and
`tiletrigger-client-<sha>.sha256`, and smoke-tests it through the hub. When the
run is green, the release job attests it (Sigstore build provenance, below)
and publishes it to GitHub Releases:

| Push | Release | |
|---|---|---|
| `main` | `main-latest` (prerelease, rolling) | `build.json` + `SHA256SUMS` name the newest green commit; each commit's files stay for the last 20 commits |
| `vX.Y.Z` tag | `vX.Y.Z` | notes = its CHANGELOG section; the tag must match `packages/client/package.json` |
| `check/**` | `check-builds` (prerelease) | for `--branch` testing; last 8 commits |

A `main` commit that already went green on a check branch isn't tested again:
the release job publishes that check run's package (kept 14 days), so `main`
ships the very bytes the check run tested (it builds again only if that
package has expired).

**On the box** (`sudo tiletrigger-update`, from `infra/tiletrigger-update.sh`):

1. Which commit: `main-latest`'s `build.json` (default), `--release vX.Y.Z`,
   `--channel stable` (the newest release), `--sha <commit>`, or
   `--branch check/<name>` (its head; its build from `check-builds`).
2. Download `tiletrigger-client-<sha>.tar.gz`, `.json`, `.sha256` and
   `.sigstore.json` (HTTPS only; ~50 MB, seconds).
3. Verify: SHA-256 sums; the build-provenance attestation (made by this
   repository's `ci.yml` on `main`, a `v*` tag or, for `--branch`, a
   `check/**` branch, for this very commit); only plain files and folders,
   all inside the site. Anything off: refused, nothing changes.
4. Unpack into `/opt/tiletrigger-site/releases/<sha>/site` (root-owned; the
   hub can read it, not change it).
5. Move the hub's code (`/opt/tiletrigger`, git) to the same commit;
   reinstall its dependencies only if they changed, production ones only
   (`pnpm install --prod --filter @tiletrigger/server...`: ~56 MB instead of
   ~300 MB; no Vite, Playwright or sharp on the box).
6. Switch `/opt/tiletrigger-site/current` to it (an atomic rename). The hub
   follows the link on every request, so a site-only update needs **no hub
   restart**. If the hub's code changed (`packages/server`, `packages/shared`,
   `maps`, the lockfile), the hub restarts (systemd, SIGTERM; players' browsers
   reconnect and hosts re-list within one 20 s check-in; running matches are
   peer-to-peer and carry on).
7. Health check: `/lobby/health`, the page is this build's `index.html`, one
   of its scripts loads. If not within 45 s: the link and the code go back
   to the previous build (and the hub restarts if needed); the failed build is
   marked as rolled back from, so the timer won't retry it.
8. Keep the last 3 builds on disk (instant rollback); remove older ones.

Commands on the box (Lightsail console → **Connect**):

```
sudo tiletrigger-update                  # latest green main build
sudo tiletrigger-update --release v0.3.0 # a release
sudo tiletrigger-update --rollback       # the build before this one (repeat to go further back)
sudo tiletrigger-update --status         # what runs, what is kept, the timer
sudo tiletrigger-update --build-here     # no CI build: build on the box (slow, ~5 min at full CPU)
```

Without a published build the updater stops with a message instead of
building (wait for CI, pick a published build, or pass `--build-here`
deliberately; `infra/deploy-multiplayer.sh --build-here` also grows the swap
to the 4 GB such a build needs).

**Automatic updates (off by default).** `sudo systemctl enable --now
tiletrigger-update.timer` (or `infra/deploy-multiplayer.sh --auto-update on`)
checks `main-latest` hourly (one small HTTPS request; random delay up to 15
minutes; low CPU and I/O priority) and installs a new verified build with the
same checks and rollback. `systemctl disable --now tiletrigger-update.timer`
turns it off; `journalctl -u tiletrigger-update` shows what it did. It
follows `main`; set `AUTO_CHANNEL=stable` in `/etc/tiletrigger-update.conf`
(or deploy with `--channel stable`) to follow releases only.

**Signing: Sigstore build provenance (no setup).** The release job runs
`actions/attest-build-provenance`: GitHub's OIDC token for this workflow run
gets a short-lived certificate from Sigstore (public good instance, since the
repository is public) and signs an in-toto SLSA provenance statement over the
tarball and build.json; the signature goes into Sigstore's public
transparency log. There is no key to create, store, rotate or leak, and no
repository secret. The box verifies it with `cosign verify-blob-attestation`
(cosign v3.0.2, downloaded once from its GitHub release and checked against a
pinned SHA-256 in the updater): the certificate must say the
`Dsoto1/splitters` repository, workflow `.github/workflows/ci.yml` on
`refs/heads/main` or a `v*` tag (or `check/**` for `--branch`), and this
exact commit; GitHub's issuer; and the tarball's digest. A tampered release
asset, a build from a fork, another workflow or another commit is refused.
The attestations are also listed on the repository's Attestations page
(`gh attestation verify <file> --repo Dsoto1/splitters` checks one by hand).
`--no-provenance` skips the check for an emergency (Sigstore unreachable);
the SHA-256 check still runs. What it does not cover: someone who can push
to `main` (or change `ci.yml` there) can still ship code, so branch
protection on `main` is the remaining control.

**Rehearsal.** `infra/test/update-dry-run.sh` runs the whole box side locally
(a throwaway origin with five commits, CI-style packages served over local
HTTP, the real hub behind a stand-in `systemctl`): first install, no-op,
site-only update without a restart, hub restart on hub changes, `--auto`,
checksum mismatch, missing attestation, unsafe tarball, missing build,
health-check failure and automatic rollback, `--rollback`, `--release`,
`--channel stable`, pruning.

**Moving the live box to this (once).** Fast-forward `main` to this change
and wait for its CI run to publish `main-latest` (the release job; the
repository's Releases page then shows it). Then re-run
`infra/deploy-multiplayer.sh` from CloudShell: it installs the new updater,
switches the hub to one process serving `/opt/tiletrigger-site/current/site`,
installs the build, and removes the old on-box build and development
dependencies. Don't run the old box's `sudo tiletrigger-update` for this: that
is the old updater, which builds on the box. If the run stops at the site
build step, the old hub keeps serving; fix the cause and re-run.

**Not changed by updates**: systemd units, Caddy, coturn, the firewall and
secrets. Those change only through `infra/deploy-multiplayer.sh` (it runs
the updater as its last step).

**Idle CPU and memory** (checked October 2026). The burst credits went to
the on-box builds; at idle the box does little:

- The hub ran as three Node processes (`corepack pnpm --filter … hub` → pnpm
  → tsx's CLI → Node: ~345 MB resident); it is now one (`node --import tsx
  src/hub.ts`, ~190 MB). Its only timers are PeerJS's broker sweeps (300 ms
  and 1 s, a few microseconds with nobody connected); the lobby prunes on
  requests, not on a timer. Startup compiles TypeScript once (~2 s).
- coturn: logs to journald only (no verbose logging, no CLI, no TLS
  listeners, no Prometheus), so idle relay threads just wait on sockets.
- Caddy: no access logs; compresses only text the hub hasn't already
  gzipped.
- The update timer is off by default; on, it makes one small HTTPS request
  an hour at low priority.

Nothing else polls. If the CPU-burst alarm fires now, look at real traffic
(`tiletrigger-relay status`, `journalctl -u tiletrigger-hub`).

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

## Dedicated host (Host Service)

A server on your own computer (a spare PC is ideal) that people on the
internet join from https://trigger.toshiroplay.com, by the game browser or a
join code: no port forwarding, no certificates, no browser tab. It is the
dedicated server's match (`packages/server/src/server.ts`) with players
arriving the way they join a browser host (WebRTC through the hub's broker),
so to players it is just another game, labelled **Dedicated host** (never
"official"). Nobody needs it to play: joining any game needs no install, and
the download is offered only on the /host page.

### For the owner: four steps, no commands

1. Open https://trigger.toshiroplay.com/host (or Online → **Host a dedicated
   server…**) and download the Host Service for your computer (Windows,
   macOS Apple silicon or Intel, Linux).
2. Unzip it and double-click **Start Tile Trigger Host** (Windows: the `.cmd`;
   it may say the app is unrecognised: More info → Run anyway. macOS:
   right-click the `.command` → Open the first time. Linux: `./start-host.sh`).
3. A server window opens and the server starts: Frost Basin, 24 players and
   bots, listed in the game browser. The **launcher** opens in your browser
   with it: the same console (every line the window shows, a command line
   with suggestions, Tab completion and ↑ ↓ history) and a right bar of
   controls for the server, map and mode, players and bots (skill, style,
   people at most, idle limits), the match rules (score and time limits and
   every other Match setup rule: see Match settings below), the game browser
   listing and join message, the people playing (kick, ban), a message to
   everyone, the admin token and bans. Each control runs the console command it shows under it,
   so you can type the same thing in either place; while the server is
   stopped, the controls set what **Start** starts with. Type `help` in
   either to see every command (`players`, `kick`, `ban`, `map`, `bots`,
   `teams`, `say`, `visibility`, `stop`, `quit`…); `launcher` opens the page
   again. The launcher is served by the Host Service on this computer only
   (`http://127.0.0.1:7797/`, the pairing key in the link), and closing it
   changes nothing.
4. Optional: click the **Also on the site** link the window shows. It opens
   /host already paired with this computer, where you choose the map, mode,
   players and bots (96 = 48 v 48), name, visibility and admin token, press
   Start / Stop / Restart, and see players (kick, ban), uptime and errors.
   Closing that page changes nothing. **Closing the server window stops the
   server**; next time you open it, it starts again with the last settings
   (or stays stopped if you stopped it).

Settings, bans and the pairing key live in your user profile
(`%LOCALAPPDATA%\TileTriggerHost`, `~/Library/Application Support/TileTriggerHost`,
`~/.local/state/tiletrigger-host`); logs in the unpacked folder's `logs/`
(`host.log`, rotated at 5 MB, 5 kept).

### From the repository (the owner's machine with git)

```
git clone https://github.com/Dsoto1/splitters.git && cd splitters
pnpm install
MAP=frost_basin MODE=core.tdm BOT_FILL=96 MAX_PLAYERS=16 SERVER_NAME="Frost Basin 48v48" ADMIN_TOKEN=pick-a-long-secret pnpm host
```

That is a 48 v 48 Team Deathmatch on Frost Basin (bots fill the 96 slots,
up to 16 people take bots' places), listed in the game browser of
https://trigger.toshiroplay.com. Windows PowerShell:
`$env:MAP="frost_basin"; $env:MODE="core.tdm"; $env:BOT_FILL="96"; pnpm host`.
`pnpm host --idle` waits for `start` (console, launcher or /host); `--no-open` (or `HOST_OPEN=0`) doesn't open the launcher. The launcher opens in a window of its own (Edge, Chrome, Brave or Chromium in app mode, with its own profile in the service's state folder; Edge comes with Windows); without one of those, or with `--browser` (or `HOST_APP_WINDOW=0`), it opens as a tab in your default browser. Closing the launcher never stops the server: type `launcher` in the console to open it again. `pnpm host:package`
builds the downloads (CI does this for every green `main` and `vX.Y.Z`).

| Setting (env, or the same key in `HOST_CONFIG=host.json`) | Default | |
|---|---|---|
| `HUB` | `https://trigger.toshiroplay.com` | the hub (plain `http://` only for one on your own network) |
| `MAP` | `frost_basin` | a map of our suite by ID, or a map file's path (listed as a **Community map**) |
| `MODE` | the map's first | `core.tdm`, `core.ctf`, … |
| `BOT_FILL` | 24 | players + bots to keep (≤ 96) |
| `MAX_PLAYERS` | 16 | people at once: your upload carries each one (~20 KB/s at 48 v 48) |
| `SERVER_NAME`, `HOST_NAME` | Dedicated host, Host Service | the game browser's name and "hosted by" (names claiming to be official are refused) |
| `VISIBILITY` | `listed` | `listed` (game browser and code) or `code` (join code only) |
| `ADMIN_TOKEN` | none | in-game admin (pause menu → Server admin, or `?admin=`); 8+ characters |
| `JOIN_CODE` | random, kept across crashes | a fixed code (6 characters, no look-alikes) for bookmarks |
| `BOT_DIFFICULTY`, `BOT_TAKEBACK`, `LEADERS`, `PLAYLIST` | | as the dedicated server |
| `ROTATION` | none | the map rotation: after each match the next of these maps instead of a replay, round and round. `frost_basin:tdm,diamond_park:ctf` (no mode: the map's first), or `preset:flag_run` (maps/rotations/); in a config file also a list. Maps that aren't ours and modes a map can't play are dropped with a log line. Edited live with the console's `rotation` and `skip`, the launcher's Rotation card or the admin's pause menu, and kept for the next start |
| `ROTATION_SHUFFLE` | off | play the rotation in a random order (a new one each time round) |
| `BOTSET` | none | your own bots (see Host controls → Bot sets): a built-in set's id (`knights_vs_space`, `zombie_horde`, `classic_mix`: maps/botsets/), a JSON file of one (`BOTSET=bots.json`), or a list, one bot per `;`: `Sir Clank, core.knight, hard, -, 1, Vanguard; Zorp, core.visitor` (name, look, skill, style, team from 1, squad; `-` or blank for the default; a first item `only` keeps the match to these bots). In a config file also a `{ name, entries, fill }` object. Edited live with the console's `botset`, the launcher's Bots card or the admin's pause menu (Bots…), and kept for the next start |
| `CONTROL_PORT` | 7797 | the control API (127.0.0.1 only) |
| `STATUS_EVERY` | 60 | seconds between status lines (0: none) |
| `AFK_SECONDS` | 90 | idle this long and a bot plays for a player until they're back (0: never) |
| `IDLE_KICK_MINUTES` | 10 | away for being idle this long and still connected: removed, freeing the place (0: never) |
| `RULES` | none (the modes' own) | the match rules, every one a browser host has (score, time, respawn per mode; friendly fire, gravity, classes, leaders…; per map): see Match settings below. Changed live with `rules`, the launcher's Match rules card or the admin's pause menu, and kept |
| `MOTD` | none | a message each player gets when they join (200 characters); `motd` changes it live |
| `REGION` | from the time zone | `na-west`, `na-east`, `sa`, `eu`, `africa`, `me`, `asia-south`, `asia-east`, `oceania`: the game browser shows games in a player's region first |

No setting is a ToshiroPlay or AWS credential: the host needs none.

### Match settings: the same as a browser host's, and more

Every setting a browser host has (Play → Match setup before the match, the
pause menu's Match panel during it, the Host tab's listing) is in the
launcher, the console and the settings, and applies to the running match the
way the browser host's does: **live** at once, at the **restart** (the pause
menu's "Apply on restart" rules), or at the **next match** (the rules a
browser host picks in Match setup before its match starts). For the last two,
**Restart match** (launcher: **Restart now with them**, console `restart`)
plays them now: with Match setup rules waiting it starts a fresh match on the
same map (everyone comes along, as on a map change). The launcher tags each
rule (live / restart / next match) and lists what is waiting.

The rules live in `RULES` (`shared/src/sim/serverRules.ts`), kept for every
match the server plays (each restart, map change and the rotation's next
map), not just the first: score, time and respawn **per mode** (they mean
different things in Team Deathmatch and CTF), everything else for every
mode, and any rule **per map** on top (`rules map …`, or the launcher's
"This map only"). In host.json:

```json
{ "RULES": { "ff": "half", "gravity": "low", "modes": { "tdm": { "score": 60, "time": 15 }, "ctf": { "score": 5 } }, "maps": { "iron_maw": { "time": 20 } } } }
```

(as an environment variable the same JSON: `RULES='{"modes":{"tdm":{"score":60}}}'`).
Changes from the console, the launcher or an in-game admin are saved for the
next start, as are players + bots, bot skill, people at most, the join
message, idle limits, name, visibility, and (without a rotation) the map and
mode playing.

| Browser host setting (where) | Host Service: launcher | console | setting | applies |
|---|---|---|---|---|
| Mode (Match setup; pause menu → Change map) | Map & mode card | `mode <mode>` | `MODE` | live (the match travels) |
| Map (Change map…) | Map & mode card | `map <map>` | `MAP` | live (travels) |
| Map rotation, shuffle, skip (pause menu) | Rotation card | `rotation …`, `skip` | `ROTATION`, `ROTATION_SHUFFLE` | live |
| Players / squad (FFA, co-op) | Players + bots | `bots <n>` | `BOT_FILL` | live |
| Team sizes, uneven teams (team editor) | Team size | `teams <n>`, `teams 10 8` | `BOT_FILL` | live |
| Number of teams (2–8) | Match rules → Teams | `rules teams 4` | `RULES.teams` | next match |
| Team names, colours | Match rules → Team names / colours | `rules teamnames Reds, Blues`, `rules teamcolors #ff0000, #0000ff` | `RULES.teamnames`, `teamcolors` | next match |
| Your team / balance (Balanced, Random; Fixed is the host's own seat: a dedicated host has none) | Match rules → Team balance | `rules assign random` | `RULES.assign` | next match |
| Bot skill | Players → Bot skill | `skill hard` | `BOT_DIFFICULTY` | live |
| Bot style | Players → Bot style | `style arena` | `RULES.style` | live |
| Your bots (bot set) | Bot set card | `botset …` | `BOTSET` | live (swapped in one at a time) |
| Score limit | Match rules → Score limit | `rules score 60` | `RULES.modes.<mode>.score` | restart |
| Time limit | Match rules → Time limit | `rules time 15` | `RULES.modes.<mode>.time` | restart |
| Respawn delay | Match rules → Respawn delay | `rules respawn 3` | `RULES.modes.<mode>.respawn` | restart |
| Friendly fire | Match rules → Friendly fire | `rules ff half` | `RULES.ff` | restart |
| Mix up weapon pickups | Match rules → Mix up weapon pickups | `rules mix on` | `RULES.mix` | live |
| Drop weapon on death | Match rules → Drop weapon on death | `rules drops off` | `RULES.drops` | live |
| Team leaders, Leader hunt | Match rules → Team leaders | `rules leaders vip` | `RULES.leaders` (or `LEADERS`) | next match |
| Spawn on teammates | Match rules | `rules squadspawn off` | `RULES.squadspawn` | next match |
| Kill streaks | Match rules | `rules streaks off` | `RULES.streaks` | next match |
| Character sizes | Match rules | `rules sizes off` | `RULES.sizes` | next match |
| Gravity | Match rules | `rules gravity low` | `RULES.gravity` | next match |
| Fall damage | Match rules | `rules fall on` | `RULES.fall` | next match |
| Lethality | Match rules | `rules lethality tactical` | `RULES.lethality` | next match |
| Ballistics | Match rules | `rules ballistics advanced` | `RULES.ballistics` | next match |
| Emotes & messages | Match rules | `rules emotes off` | `RULES.emotes` | next match |
| Weapons & pickups (Normal, Spears only, Discs only) | Match rules | `rules weapons spears` | `RULES.weapons` | next match |
| Classes (and Max 1 / Max 2) | Match rules | `rules classes 2` | `RULES.classes` | next match |
| Vehicle damage | Match rules | `rules vehicles tough` | `RULES.vehicles` | next match |
| Flag return (CTF, Fort Wars) | Match rules | `rules flagreturn 45` | `RULES.flagreturn` | next match |
| Hill moves (King of the Hill) | Match rules | `rules hill 90` | `RULES.hill` | next match |
| Fort Wars build phase, combat phase, cycles, build points | Match rules | `rules fortbuild 3`, `fortcombat 8`, `fortcycles 2`, `fortbudget 600` | `RULES.fort*` | next match |
| Race laps, vehicle, combat | Match rules | `rules laps 5`, `racevehicle buggy`, `racecombat off` | `RULES.laps`, `racevehicle`, `racecombat` | next match |
| Restart match, End match | Server card | `restart`, `end` | | live |
| Kick, ban (pause menu → Players) | People playing | `kick`, `ban`, `unban` | `bans.json` | live |
| Listed in the game browser / code only | Game browser → Who can join | `visibility listed\|code` | `VISIBILITY` | live |
| Listing name | Game browser → Name | `name <text>` | `SERVER_NAME` | live |
| Playlist (co-op chain; the browser plays them offline only) | | | `PLAYLIST` | next start |
| Max players (a browser host: its device's cap) | Players → People at most | `maxplayers <n>` | `MAX_PLAYERS` | live (nobody playing is removed) |
| Password | neither has one: `VISIBILITY=code` and a `JOIN_CODE` keep a game private | | | |
| Graphics (Match setup's Performance fold) | the browser's own, not the match's | | | |

Only on the Host Service (extras): **per-map rules** (`rules map <rule> <value>`,
`RULES.maps`), a **join message** each player gets (`motd <text>`, launcher
Game browser → Join message, `MOTD`), the **idle limits** live (`afk`,
`idlekick`, launcher Players → Idle), **uneven teams** from the console
(`teams 10 8`), `rules` listing what plays and what waits, `rules reset`, and
everything saved for the next start. `rules <rule> default` (or the launcher's
↺) puts one back to the mode's own.


### How it works

- **Hub link** (`packages/host/src/hubLink.ts`): PeerJS, unchanged, on
  [node-datachannel](https://github.com/murat-dogan/node-datachannel)'s
  standard WebRTC polyfill (libdatachannel; prebuilt for Linux, macOS and
  Windows, x64 and arm64, installed without build scripts). The host
  registers `tiletrigger-<CODE>` on the hub's broker exactly as a browser host
  does, so the client needed no change to join it. TURN credentials come
  from `/lobby/ice?role=host` and are renewed at half life; libdatachannel
  takes them escaped (coturn's usernames carry `:`; checked against a TURN
  server in relay-only mode). The broker socket uses the `ws` package:
  Node's own WebSocket never reports a connection that failed, and PeerJS
  would then never retry.
- **Players** (`peerConn.ts`): each data channel becomes a `PlayerConn` of the
  dedicated server (same join flow, MessageGuard rate limits, caps, admin
  commands, delta snapshots); what a player sends is reassembled with
  `GUEST_TO_HOST_LIMITS`, what it gets is the same deflate stream a browser
  host sends (`shared/src/net/peerZip.ts`). A player whose link can't keep up
  (150 messages held back) is dropped instead of filling memory.
- **Listing** (`advertiser.ts`): `hostType: "dedicated"`, checked in every
  20 s, re-listed when the hub forgot it; taken down on stop.
- **Robustness**: the match runs in a child process (`--child`) supervised
  by the service (`supervisor.ts`): a crash or a hang (no report for 30 s)
  restarts it after 5 s doubling to 5 min under the same join code; 5
  crashes in 10 min stop it (`crashloop`, shown in the console and /host); a
  setting that can't start (a bad map) is not retried. Losing the hub: players
  already in keep playing (their connections are direct or relayed, not
  through the hub); the host reconnects with backoff (1 s → 30 s) under the
  same code and re-lists. Ctrl+C, `quit`, closing the window, SIGTERM or
  SIGHUP: players are told, the listing is removed, the match ends.
- **Control API** (`control.ts`) for /host: `127.0.0.1` only; Origin must be
  `https://trigger.toshiroplay.com` or a localhost page (`HOST_ALLOWED_ORIGINS`
  adds others), Host must be the loopback name (no DNS rebinding), and every
  command needs the pairing key (`Bearer`). Closed command set: status,
  start (suite map by ID, checked numbers and match rules; never a path, URL or the hub),
  stop, restart, kick, ban, unban, quit.
- **Launcher** (`launcher.ts`): the same server serves the launcher page at
  `/` (no secrets in it: the key comes in the link's `#fragment`; a strict
  Content-Security-Policy with a per-response script nonce, no framing). Its
  console log (`GET /api/log?after=n`, the last 1500 lines) and command line
  (`POST /api/console`, one line of at most 300 characters, parsed and
  checked exactly like the window's) answer only that page (its own origin
  on this port) with the pairing key: the site's /host page keeps the closed
  API above.
- **Kick and ban** (`bans.ts`): bans live in `bans.json` in the state folder
  and survive restarts. Signed-in players are banned by account: the client
  asks the hub for an account ticket for that join code
  (`GET /api/v1/ticket`, Ed25519-signed, 2 min, single use at the host) and
  the host checks it with the hub's public key (`/api/v1/ticket-keys`): it
  never sees the player's Cognito token. Guests can only be banned by their
  browser key (`p_…`, cleared with site data) and their address when the link
  is direct (not relayed; shared by households, and changes): **guest bans are
  weak**. In-game admins kick and ban from pause menu → Match → Players; a
  Host game host can kick and ban friends too (for that game only).

### Measured (October 2026, this repository's 4-core container)

Frost Basin, Team Deathmatch, 96 players and bots (48 v 48), 8 players joined
from Node clients over WebRTC: simulation + snapshots + compression
**5.2–7.5 ms a tick** (of 16.7; no late ticks), bot AI 1.2–1.6 ms, each
player getting **~19 KB/s** compressed at 30 snapshots a second (so 16
players ≈ 300 KB/s ≈ 2.5 Mbit/s of upload). The download is ~50 MB
(Linux .tar.gz), ~170 MB unpacked, most of it the Node runtime.

### Run on boot (optional)

The service starts when you double-click it; to start it with the computer:

- **Windows**: Task Scheduler → Create Task → Trigger "At log on" → Action
  "Start a program": `C:\…\tiletrigger-host\Start Tile Trigger Host.cmd`
  (run as your user; no administrator rights needed).
- **macOS**: System Settings → General → Login Items → add
  `Start Tile Trigger Host.command`, or a LaunchAgent
  (`~/Library/LaunchAgents/com.toshiroplay.trigger-host.plist` with
  `ProgramArguments` = the `.command` path and `RunAtLoad` true).
- **Linux** (`systemd --user`, no root): `~/.config/systemd/user/tiletrigger-host.service`

  ```
  [Unit]
  Description=Tile Trigger Host Service
  After=network-online.target
  [Service]
  WorkingDirectory=%h/tiletrigger-host
  ExecStart=%h/tiletrigger-host/start-host.sh
  Restart=on-failure
  [Install]
  WantedBy=default.target
  ```

  then `systemctl --user enable --now tiletrigger-host` (and
  `loginctl enable-linger $USER` to run without logging in). Logs: `logs/`
  and `journalctl --user -u tiletrigger-host`.

### Known limits

- Windows SmartScreen and macOS Gatekeeper warn the first time (the start
  files are not code-signed; the Node runtime inside is the official signed
  one). The archives are attested by CI (Sigstore build provenance:
  `gh attestation verify tiletrigger-host-windows-x64.zip --repo Dsoto1/splitters`).
- /host talks to `http://127.0.0.1` from an https page: Chrome, Edge and
  Firefox allow it (Chrome may ask for "local network access" once);
  Safari may refuse, and the console remains the full admin interface.
- Guest bans are weak (above). Join tickets carry the account only; the
  host doesn't yet check a hub-signed ticket for every join (protocol §7).
- One match per service; no automatic updates (download the new version);
  the upload is the limit long before the CPU (`MAX_PLAYERS`).

### Next steps

Account pairing of a Host Service with a ToshiroPlay account and the hub's
host control socket (MULTIPLAYER_SECURITY.md section 6), so /host works from
any device; signed self-updates (section 7); an installer with start-on-boot;
a tray icon; per-ticket join authorization for every player.

## Players who go quiet: idle, asleep, dropped

The same rules on every host (dedicated server, Host Service, a browser
hosting friends), in `BotFiller` (`shared/src/sim/match.ts`, `AWAY`):

- **Idle** (no moving, turning or pressing anything for `AFK_SECONDS`, 90 by
  default; only while the match is being played): a warning 15 s before, then
  a bot plays their place, shown as "Name (away)": same body, team, score and
  loadout. Their next real input takes it back. A browser host never does
  this to its own player.
- **Dropped** (the connection closed, or sent nothing for 20 s: a phone that
  went to sleep, a dead network): a bot plays their place, kept 60 s for them.
  Their next connection from the same account (or, for a guest, the same
  browser) takes it back, score and all; after that the bot keeps it. Kicked
  and banned players' places aren't kept.
- **The player's side** (`client/src/main.ts`): a match that drops after it
  started shows "Connection lost: reconnecting…" (Cancel) and joins the same
  game again for up to 60 s, at once when the page is shown again or the
  network comes back. A refusal (kicked, banned, full) or leaving doesn't.
- **Hosting from a phone**: the match runs on the phone, so it stops for
  everyone if the screen turns off; the host gets a warning. Keeping a match
  alive without its host (moving it to another player) isn't done.

## Profiles

Signed-in players pick a **username** (Profile, at the bottom of the main
menu): 3–16 letters, numbers, `_ - .`, unique in Tile Trigger whatever the
case, no reserved or official-looking names. It is their name in every match:
the hub signs it into the account ticket a host checks (dedicated servers and
Host Services in Node, browser hosts on the page with Ed25519), and the
scoreboard marks it with a ✓; other people show as GUEST once more than one
plays. Their Google name and email are never shown. They also set a
**region** (guessed from the time zone; guests keep theirs in the browser),
which listings carry so the game browser shows nearby games first. Kept on the
hub in `PROFILES_DIR` (`/var/lib/tiletrigger/profiles` on the box; set by
`infra/host-setup.sh`), `GET/PUT /api/v1/profile`, `GET /api/v1/profile/check`.

## Publishing maps (the owner)

Every map, the official ones included, is made and edited in MapMaker. The
game's owner publishes from there; nobody else can, and players never upload
anything.

**Once:** sign in on the site, open **Profile** (bottom of the main menu) and
click **Copy my account ID**. In AWS CloudShell, run
`infra/deploy-multiplayer.sh --owner <account ID>` (it keeps the ID in SSM,
`/toshiro/trigger/owner-subs`, and gives the box a folder for published maps).

**Then, any time:** open MapMaker signed in. Open… lists the official maps as
**Official map** (not "Template"): they open as they are, with their own ID,
instead of as a remix. Change what you like, then **Publish** (top bar, orange):
it says whether this replaces an official map or adds a new one, refuses a map
with errors, and lists every version published before with **Restore**. **Go
back to the built-in version** stops using the published one. A map of your own
(a new ID) published this way becomes an official map in everyone's list; a
community map you like can be imported and published the same way.

What happens:
- The hub (`packages/server/src/publish.ts`) checks the map itself (it loads,
  its ID, no validation errors, a mode that can run), keeps it in
  `/var/lib/tiletrigger/maps` with every earlier version (the last 50 of each),
  and serves `/api/v1/maps`. Only the accounts in `OWNER_SUBS` can publish,
  roll back or take down, checked against a verified sign-in token.
- The site (`packages/client/src/publishedMaps.ts`) asks the hub for the list
  and uses a published version over the one built into it, everywhere a map
  loads: the map list, matches, MapMaker. A match already running keeps the
  version it started with; players joining it get that version from its host.
- Host Services keep their maps in their state folder: the ones they came
  with, with the published versions over them, updated at start and every 10
  minutes (`packages/host/src/published.ts`); a running server picks a publish
  up at its next map change.
- The repository's `maps/` catches up once a day: the **Published maps**
  workflow downloads them to `check/published-maps` and runs CI there; main is
  fast-forwarded to it once green, like any change.

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
| `ROTATION=frost_basin:tdm,diamond_park:ctf` | Map rotation: after each match (the scoreboard), the next of these instead of a replay, round and round; `preset:<id>` adds a built-in one (maps/rotations/). `ROTATION_SHUFFLE=1` plays them in a random order. See Host controls → Rotation. |
| `BOTSET=knights_vs_space` | Your own bots: a built-in set (maps/botsets/), a JSON file (`BOTSET=bots.json`) or a list (`Sir Clank, core.knight, hard; Zorp`). See Host controls → Bot sets. |
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
- **Rotation.** A list of up to 20 maps of our suite, each in a mode
  (`shared/sim/rotation.ts`): Add map… (the map picker), remove, move up and
  down, start from a preset (`maps/rotations/*.json`, data), Shuffle (a new
  random order each time round, never the same map twice in a row) and Skip to
  next (travels now, as Change map does). When a match ends with nowhere else
  to go (a co-op playlist's win or a "Next map" link come first), the end of
  the scoreboard takes everyone to the next entry, with the host's settings and
  players as Change map does; scores start fresh. Everyone's scoreboard says
  "Next map: … (…)" (`round_end.up`). Empty: the match replays, as before.
  Offline and Host game keep the list in the page across map changes (until
  you go back to the menu); a dedicated server keeps it in the match process
  (`ROTATION`, the console's `rotation` / `skip`, the launcher's Rotation card;
  in-game changes are saved for the next start). Commands: `{ c: 'rotation',
  entries?, shuffle? }` (the whole list) and `{ c: 'skip' }`; HostState carries
  `rotation` (absent from older hosts, so the panel hides the section).
- **Bot sets.** Your own bots (`shared/sim/botSet.ts`): a named list of bots,
  each with a name (at most 20 characters, cleaned; repeats get a number), a
  look (any preset character or NPC skin, or random), a skill (easy, normal,
  hard, or the match's), a style (own, arena, tactical, or the match's), a team
  (by order, or auto) and a squad label. Bots join in the list's order (in team
  modes the team that most needs a player takes its own bots first, then
  unteamed ones), then random bots fill up to the player count, unless the set
  says **Only these bots**. Random bots give way first when the match shrinks
  or a player joins, then the set's from its end. Bots with the same squad on
  one side stick together: the first of them alive leads, the others go back
  to it past 14 m and otherwise take its goal (a teammate's Follow me / Hold
  here order still comes first; free-for-all has no squads). A bot's own skill
  and style survive the match-wide Bot skill / Bot style.
  - **Where:** Play → Match setup → Bots → Name your bots… (kept with the setup
    and saved setups); pause menu → Match → Bot set → **Bots…** (live: Apply
    keeps bots that are still in the list where they stand, renamed and
    re-dressed in place, and swaps the rest in one bot every quarter second, so
    every screen builds the new characters in turn); a dedicated host's
    `BOTSET`, console `botset` and the launcher's Bots card.
  - **The window:** a table (look picker with portraits, name, skill, style,
    team, squad; ↑ ↓ duplicate remove), Fill the rest randomly / Only these
    bots, Start from… a built-in set (`maps/botsets/*.json`, data) or one saved
    in this browser (`cs.botsets`), Save, Delete saved. Keys: Tab and ↑ ↓ (the
    same column in the next row), Esc closes the look picker then the window,
    Ctrl+Enter applies; a controller drives it through the pause menu (d-pad,
    A, B).
  - **Console:** `botset` (show), `botset preset <id>`, `botset add <name>
    [look] [skill] [team]`, `botset remove <n|name>`, `botset list <bot; bot…>`
    (the whole list in the text form above), `botset only|random`, `botset
    clear` (random bots). Each sends the whole set as an admin's command.
  - **Scenario maps** can name their own bots (`MapDocument.bots`, MapMaker →
    map properties → Bots): they play unless the host picks a set; a map change
    carries only a set the host chose, so the next map's own bots play there.
  - **Protocol:** `{ c: 'bots', botSet }` (the whole set; `null`: random bots),
    checked by the host (validateBotSet: unknown looks become random, names
    are cleaned and capped, at most 96 bots); HostState carries `botSet` (and
    `mapBots` when the set in play is the map's). Older hosts ignore the field
    and send no `botSet`, so the pause menu shows no Bots… button.

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
