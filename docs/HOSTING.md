# Hosting ChronoSplit

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
- **Matches** run in the host player's browser (pause menu → Host game).
  Ticking "List in the game browser" lists it; it checks in every 20 s and
  drops off within about a minute of the host leaving.
- Traffic per player is ~3 KB/s (8 players) to ~10 KB/s (16 players),
  compressed, from the host's upload.

What a player-hosted game can't do: survive the host leaving, or stop the
host from cheating. The game browser tags these games "Player-hosted".

## 2. Official servers (later)

`pnpm --filter @chronosplit/server start` runs one dedicated match
(`MAP`, `MODE`, `BOT_FILL`, `PORT`). Several fit on one small VPS (a match
takes ~0.5–1.5 ms of a 16.7 ms tick). Listing them in the game browser is
the next step on the roadmap (#12).
