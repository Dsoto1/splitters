# Hosting Tile Trigger

## Quickest: one AWS Lightsail instance (~$5/month)

Everything on one small server: the site, the hub (broker + game browser),
a relay for strict networks (coturn) and HTTPS (Caddy). Nothing else to sign
up for. Script: `deploy/aws-lightsail-setup.sh`.

1. Lightsail → Create instance → Linux, **Ubuntu 24.04**, the $5 plan.
2. Networking → attach a **static IP**; in Route 53, point an **A record**
   (for example `play.yourdomain.com`) at it.
3. Instance → Networking → IPv4 firewall: add **TCP 443**, **TCP 3478**,
   **UDP 3478**, **UDP 49160–49200** (22 and 80 are open already).
4. Connect (browser SSH) and run, with your domain:
   ```
   curl -fsSL https://raw.githubusercontent.com/Dsoto1/splitters/main/deploy/aws-lightsail-setup.sh | sudo bash -s -- play.yourdomain.com
   ```
   For another branch, put its name in the URL and add `BRANCH=<name>` after `sudo`.
5. Open `https://play.yourdomain.com`. Updates later: `sudo tiletrigger-update`.

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
