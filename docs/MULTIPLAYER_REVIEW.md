# Multiplayer architecture review (against MULTIPLAYER_DIRECTION.md)

Review of the code and infrastructure as of 27 Oct 2026 (branch
`claude/new-session-o6mv1w`) against the owner's direction in
`docs/MULTIPLAYER_DIRECTION.md`, deliverables 30 A–G. This pass delivers
documentation and infrastructure only; the hub/Host Service code changes it
lists are for the implementation task.

| Deliverable | Where |
|---|---|
| A. Architecture review | this document, sections 1–4 |
| B. CloudFormation | `infra/toshiro-trigger-multiplayer.yaml` |
| C. Deploy/setup script | `infra/deploy-multiplayer.sh` (+ `infra/host-setup.sh`, `infra/turn-check.py`); runbook in `docs/HOSTING.md` |
| D. Security configuration | `docs/MULTIPLAYER_SECURITY.md` |
| E. Protocol boundary | `docs/MULTIPLAYER_PROTOCOL.md` |
| F. Map security schema | this document, section 5 |
| G. Cost estimate | this document, section 6 |

Legend: **Complies** · **Partly** (works, but a rule is not fully met) ·
**Must change** · **Blocker** (stops a phase of the direction until fixed).

## 0. Phase 1 hardening: done (implementation pass, 27 Oct 2026)

The tables below are the review as written; this is what the implementation
pass changed since. Items marked ✔ in section 4 are done.

| Area | Done | Where |
|---|---|---|
| Guest → host input bounds | Chunked text from a friend: ≤ 4 pieces, ≤ 64 KiB a message, ≤ 4 half-sent messages, 10 s timeout (host → friend: 4 MiB, 60 s). Inflated output ≤ 4 MiB a message, aborted mid-inflate. Early messages before the match loads ≤ 64. | `client/src/game/peerZip.ts` (`Reassembler`, `Unzipper`), `peerLink.ts` `onText`, `matchHost.ts` |
| Message rate limits | Per connection, browser host and dedicated server: token bucket 100/s, burst 200 (a client sends 60 inputs + 1 ping a second); over it dropped; 250 drops in 5 s → disconnected (server close `4008`). | `shared/src/net/rateLimit.ts` (`MessageGuard`), `peerLink.ts` `linkFor`, `server/src/server.ts` |
| Hub rate limits | Per address: `GET /lobby/games` 120/min (burst 60), POST/PUT/DELETE 60/min (burst 30), new listings 10/min, `/lobby/ice` 12/min and 30 per game (then 1/min), `/lobby/lan` 12/min, `/api/v1/me` 30/min and 10 failed tokens/min → 15 min block. Broker: ≤ 16 sockets and 30 connects/min per address, 2,000 sockets in all, 20 messages/s (burst 100) per socket, 30 OFFERs (joins, i.e. join-code guesses)/min per address, 16 KB frames, 60 HTTP requests/min. | `server/src/lobby.ts` (`LOBBY_LIMITS`), `broker.ts` (`BROKER_LIMITS`), `auth.ts` |
| Hub validation | JSON bodies only (415), ≤ 4 KB (413, checked from Content-Length and while reading), schema-checked adverts, `v` query checked, 405 on other methods; listing secrets compared in constant time. | `lobby.ts` |
| Heartbeats | Listing hidden after 30 s without a check-in (stale), removed at 65 s. | `shared/src/net/lobby.ts`, `lobby.ts` |
| Client IP | `TRUST_PROXY=1` believes `X-Forwarded-For` only from loopback (Caddy on the box), last entry only; IPv6 keyed by /64. | `server/src/clientIp.ts` |
| Per-session relay credentials | `/lobby/ice?session=<CODE>&role=host\|guest`: only for a game live on the hub's broker (or listed); username `<expiry>:s_<CODE>.<host\|p_xxxxxxxx>`, HMAC-SHA1 with the TURN secret; `ICE_TTL` default 3600 (floor 600). Without a session: STUN only. Hosts renew at half life; new connections use the fresh ones. | `server/src/ice.ts`, `lobby.ts`, `client/src/game/relay.ts`, `peerLink.ts` |
| Join codes | `crypto.getRandomValues`, rejection sampling (no modulo bias), 31^6 ≈ 29.7 bits; 666/rude-word filter kept. Guessing is bounded by the broker's OFFER limit. | `client/src/game/joinCode.ts` |
| Transport | `RemoteLink`, `HostLink`, `Signaling`, `loadSignaling()`; session.ts and main.ts no longer construct PeerJS classes; relay settings moved out of the PeerJS file. | `client/src/game/transport.ts`, `relay.ts` |
| Map safety | 2 MiB before parsing (`loadMap`), `dependencies` ≤ 16; load budgets (errors): vehicles/mounts ≤ 32, destructibles + breakable blocks ≤ 1,024; warnings: encounter caps over 64 NPCs, rule loops (A → B → A within a tick). Runtime: 2,000 scenario actions and 256 rule firings a tick (rest deferred, ≤ 1,024 waiting events), one rule ≤ 30 firings/s, 64 NPCs alive, 32 NPC spawns/s and 256/min, 512 projectiles (oldest bot/NPC ones removed first); one warning per kind per match. | `shared/src/map/budgets.ts` (`RESOURCE_BUDGETS`), `validate.ts`, `sim/scenario.ts`, `sim/match.ts` |
| Map identity | Optional `metadata.release` {mapId `m_`+16, versionId `v_`+16, revision, `sha256:` content hash of canonical JSON (picture, last-saved time and release excluded), schemaVersion, releasedAt}; stamped by MapMaker Export (new version only when the content changed); unstamped maps get a derived identity. No format bump (optional field). | `shared/src/map/identity.ts`, `client/src/editor/storage.ts` |
| Listings | Non-suite maps may be listed only as `community: true` with map ID, version ID and content hash ("Community map" tag in the game browser and the host's badge); a non-community listing must name a suite map (hub reads `maps/`). Official/featured: browser hosts are never either. | `lobby.ts`, `hub.ts`, `client/src/game/session.ts`, `frontend/frontEnd.ts` |
| Sign-in | Cognito managed login, authorization code + PKCE, public client `2lrej6nsacfag8a7taeu3u6sc2`, `/auth/callback`, tokens in sessionStorage, sign-out; hub verifies ID/access tokens (JWKS cached; iss, aud/client_id, token_use, exp) at `GET /api/v1/me`. No user records. | `client/src/account.ts`, `server/src/auth.ts` |
| Privacy page | `/privacy` (static), linked from the menu footer; contact is a placeholder for the owner. | `client/public/privacy/index.html`, `server/src/site.ts` |

Not done in this pass (Phase 1 remainder → next): hub-issued join tickets
and join authorization (so relay credentials and joins need a ticket rather
than a live code), hub-issued join codes, origin allow-list for
authenticated endpoints, and an active-vehicle (24) runtime cap. Phase 2 and
3 items are unchanged.

## 1. What exists today

- **Simulation**: `packages/shared/src/sim` (Match, bots, NPCs, vehicles,
  scenario logic). It has no DOM/Babylon imports and already runs in three
  hosts: a Web Worker for offline/browser-hosted play
  (`packages/client/src/game/simWorker.ts`, `matchHost.ts`; see PERF_96.md),
  the page thread as a fallback, and Node for the dedicated server
  (`packages/server/src/server.ts`).
- **Browser hosting** ("Host game"): the host's browser runs the match; friends
  connect over WebRTC data channels through PeerJS
  (`packages/client/src/game/peerLink.ts`, the only file importing `peerjs`,
  line 1). Up to `BROWSER_HOST_MAX_GUESTS` = 10 friends
  (`shared/src/sim/constants.ts:10`).
- **Hub** (`packages/server/src/hub.ts`): one Node process that serves the
  built site, runs the PeerJS broker at `/broker` (`peer` 1.0.2,
  `hub.ts:32`), the game browser list at `/lobby/games`
  (`lobby.ts`), relay credentials at `/lobby/ice` (`ice.ts`) and LAN
  discovery (off behind a proxy, `hub.ts:28`).
- **Dedicated server** (`server.ts`): a WebSocket match server for LAN and
  future official servers, with an `ADMIN_TOKEN` admin role.
- **Infrastructure**: one hand-made Lightsail instance serving
  trigger.toshiroplay.com, set up by `deploy/aws-lightsail-setup.sh` (Caddy,
  hub, coturn, systemd). DNS record, firewall and static IP were made by hand
  in the console (HOSTING.md steps 1–4). No CloudFormation, budget, alarms or
  secret store before this pass.

## 2. Rule by rule (section 29 "non-negotiable" rules, then the topic sections)

| # | Rule | Status | Evidence / what must change |
|---|---|---|---|
| 1 | Browser-first | **Complies** | The whole game is the static site; Host game runs in the browser. |
| 2 | Normal players install nothing | **Complies** | Nothing to install for play or browser hosting. |
| 3 | Optional small Host Service | **Must change** (Phase 2) | Does not exist. `packages/server/src/server.ts` + `main.ts` (env-configured, `ADMIN_TOKEN`) is the nearest thing: the Host Service should wrap the same `Match` headless, but with an outbound hub control channel instead of an inbound admin token. |
| 4 | Closing the browser must not end a Persistent Host | **Must change** (Phase 2) | Only true for the dedicated server today; no browser-managed persistent hosting yet. |
| 5 | AWS is control plane, not match compute | **Complies** | The hub runs no match ("No match runs here", `hub.ts:16`). Keep `server.ts` off the AWS box. |
| 6 | Player machines compute matches | **Complies** | Worker in the host's browser; dedicated server on anyone's PC. |
| 7 | Browser clients are untrusted | **Partly** | Intent-only inputs: clients send `input`/`ready`/`ping`/`host`, parsed by `parseClientMessage` (`shared/src/net/clientMessages.ts:19`), shared by the dedicated server and the browser host (`matchHost.ts:316`); inputs capped (32 a message, `clientMessages.ts:10`; 2 a tick and 16 queued, `shared/src/sim/match.ts:74-75`). Host commands from guests are refused in the browser host (HOSTING.md "Host controls"). **Gaps**: no per-connection message-rate limit on the dedicated server (`server.ts:216-271`; a client may spam `ping`, each answered with a `pong`); the browser host's chunk reassembly trusts the guest's chunk count (`peerLink.ts:116-139`: `n` comes from the peer, partial messages are kept without a cap) and the deflate stream has no output cap (`peerZip.ts:39-60`), so one guest can exhaust the host tab's memory. |
| 8 | Community maps are declarative data only | **Complies** (see section 5) | `MapDocument` (`shared/src/map/schema.ts:766`) is a zod schema of plain data; unknown keys are stripped; no script field exists. |
| 9 | No user-uploaded assets; in-house IDs only | **Partly** | Props, tiles, materials, items, themes are `ContentId`s checked against our catalog (`validate.ts:88-163`). Map thumbnails are in-engine captures restricted to a `data:image/jpeg|webp` URL ≤ 48,000 chars (`schema.ts:36-43`): an image the player's browser made, not an upload, but it is player-supplied pixels — keep it out of public listings or re-render it server-side when publishing exists. `dependencies` packs (`schema.ts:793`) are unbounded and not checked against a pack registry. |
| 10 | Community content cannot execute code | **Complies** | Logic is a closed set of WHEN/IF/DO enums (`shared/src/map/logic.ts:19-160`). |
| 11 | Host Service: no remote shell | n/a yet | Protocol defined with a closed command set (MULTIPLAYER_PROTOCOL.md section 9). |
| 12 | Host Service without admin rights | n/a yet | Planned: per-user install, no service account (MULTIPLAYER_SECURITY.md section 6). |
| 13 | TURN authenticated, temporary, monitored, bounded | **Partly → infra fixed** | coturn already used `use-auth-secret` + `denied-peer-ip` (`deploy/aws-lightsail-setup.sh:76-96`). **Code gaps**: TTL 6 h (`ice.ts:43`, should be 1 h: the new deploy sets `ICE_TTL=3600`); `/lobby/ice` is anonymous (any address, 12 a minute, `lobby.ts:90-98,155-164`) so the relay is open to anyone who asks the hub; one username id for everyone (`ice.ts:29`, `id = 'tiletrigger'`) so usage can't be attributed or revoked per session. Fixed in infra: quotas, per-session and total bandwidth caps, more denied ranges, NetworkOut alarm, kill switch (`tiletrigger-relay off`), open-relay check in every deploy. |
| 14 | No secrets in Git or browser bundles | **Complies** | `TURN_SECRET` was generated on the box (`aws-lightsail-setup.sh:66`); now kept in SSM. The client holds no secrets; Cloudflare/Metered keys stay in hub env. |
| 15 | All external data schema-validated and bounded | **Partly** | Lobby adverts: `parseAdvert` (`shared/src/net/lobby.ts:46`), bodies ≤ 4096 bytes (`lobby.ts:88`), 3 listings an address, 500 total, 10 creates a minute (`lobby.ts:14-16`). Maps: `loadMap` (`validate.ts:35-62`) on every join (`client/src/game/session.ts:969`). WebSocket frames ≤ 64 KiB (`server.ts:209`). **Gaps**: no byte cap before `JSON.parse` of a map (only the 64 KiB frame cap on the dedicated server; none in the browser host path); `/lobby/games` GET and PUT unthrottled; PeerJS broker has no per-address limits (`hub.ts:32` uses defaults). |
| 16 | Simulation independent of rendering/DOM | **Complies** | `packages/shared` imports no Babylon/DOM; it runs in Node and in a Worker. |
| 17 | PeerJS behind a transport abstraction | **Partly** | The client side is behind `Transport` (`client/src/game/transport.ts:8`); PeerJS is confined to `peerLink.ts`. But `session.ts:622` constructs `PeerHost` directly and `main.ts:365` constructs `PeerTransport`, and the hub side *is* the PeerJS broker. The direction's hub needs its own signaling (join authorization, rate limits), so add a `HostLink`/`Signaling` interface and keep PeerJS as one implementation until it is replaced. |
| 18 | Small AWS cost | **Complies** | ~13 USD/month (section 6). |
| 19 | No expensive infra without measurement | **Complies** | No NAT gateway, RDS, ELB, ECS, GameLift. Keep it that way. |
| 20 | New CloudFormation + deploy script | **Done in this pass** | `infra/`. |

### Topic sections

| § | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | Instant Browser Host over WebRTC, TURN fallback | **Complies** | Host game / Go online (HOSTING.md). |
| 2.2, 3 | Persistent Host + `/host` dashboard | **Must change** (Phase 2) | Neither exists. |
| 4 | Shared authoritative sim, transport abstraction | **Partly** | See rules 16–17. |
| 5 | SEC-HOST-001…005 | n/a yet | Designed in MULTIPLAYER_SECURITY.md section 6 and MULTIPLAYER_PROTOCOL.md section 9. |
| 6 | Validate movement, firing, ammo, damage, pickups, objectives… on the host | **Complies** | The host's `Match` owns all of these; clients only send `PlayerInput`. |
| 7 | No uploaded assets; declarative maps | **Complies/Partly** | Section 5. |
| 8 | Resource budgets, trigger-loop protection | **Partly** | Section 5.3: depth and sequence caps exist; per-tick execution budget and global entity/NPC/projectile caps do not. |
| 9 | Map ID/version/hash, same version everywhere | **Must change** (Phase 3) | Maps have `metadata.id` only (`schema.ts:29`, `StableId`); no version ID, content hash, creator ID or required game version. Today a host sends the whole map in `welcome` (`server.ts:243-249`) and the joiner validates it, which is safe but not versioned. |
| 10 | Hub: discovery, codes, signaling, registration, heartbeats, TURN auth, host control | **Partly** | Discovery + heartbeats (20 s, expiry 65 s, `shared/src/net/lobby.ts:38-39`) + signaling (PeerJS) + TURN creds exist. No authenticated registration, no host control, no join authorization. |
| 11 | Home network safety | **Complies** | Browser hosts need no port forwarding (WebRTC + TURN). The dedicated server's docs open port 7777 on a LAN only; keep "no DMZ, no admin port" in Host Service docs. |
| 12 | Secrets | **Complies** (infra) | SSM SecureStrings; nothing reusable in the bundle. |
| 13 | Signed updates | **Complies** for the site and hub; Host Service n/a yet | The box no longer builds: CI publishes the site build to GitHub Releases with a Sigstore build-provenance attestation (keyless, no secret), and `tiletrigger-update` verifies SHA-256 + the attestation (this repo's `ci.yml`, `main`/`v*`, this commit) over HTTPS before installing; versioned folders, atomic switch, health check with automatic rollback, `--rollback` to the last 3 builds; locked dependencies (`--frozen-lockfile`, production only on the box). Draining doesn't apply to the hub (no matches run on it). Host Service updates: strategy in MULTIPLAYER_SECURITY.md section 7. HOSTING.md, "Updates". |
| 14 | Logging/privacy | **Partly** | Hub logs little. Caddy access logs are off (default). journald now capped (300 MB, 14 days). The lobby keeps IPs in memory only for rate limits (`lobby.ts:6-11,26,90`). **Task**: a privacy page (section 7). |
| 15 | Moderation primitives possible later | **Partly** | Listings have IDs; players have names only (no account ID). Plan account IDs (Cognito `sub`) in join tickets so kick/ban/report can key on them. |
| 16–18 | AWS: control plane, S3/CloudFront evaluated, Lightsail hub | **Complies** | See section 3. |
| 19–22 | Template, script, secrets, cost safety | **Done** | Budget 15/25 USD, Lightsail alarms (NetworkOut, status, CPU burst), tags, log caps, relay kill switch. |
| 23 | Hub security (TLS, schema validation, size and rate limits, auth, expiry, join-code entropy) | **Partly** | TLS via Caddy; schema validation on adverts; size limits; some rate limits. **Gaps**: join codes from `Math.random` (`client/src/game/joinCode.ts:18-22`; ~29.7 bits of 31^6 space but not from a CSPRNG); no limit on join-code guesses (anyone can try codes against the broker); listing secrets compared with `!==` (`lobby.ts:57,68`; use `timingSafeEqual`); `X-Forwarded-For` first entry trusted (`lobby.ts:151`; correct behind Caddy, which replaces the header, but wrong if CloudFront or another proxy is put in front). |
| 24 | Heartbeat lifecycle | **Complies** for listings | 20 s / 65 s expiry (`lobby.ts:30-33`, pruned on every request). Extend to registered hosts. |
| 25 | Budgets for hub/TURN/host | **Partly** | Section 2 rows 7, 13, 15 and section 5. |
| 26 | Failure behaviour | **Partly** | Hub outage: established WebRTC matches continue (data channels don't need the broker); listings drop and return when hosts re-advertise. TURN outage: direct sessions continue. Invalid map: rejected by `loadMap` before load. |

## 3. Infrastructure findings

| Item | Before | After this pass |
|---|---|---|
| Provisioning | Console clicks (HOSTING.md steps 1–4) | `infra/toshiro-trigger-multiplayer.yaml`, deployed by `infra/deploy-multiplayer.sh` |
| SSH | Port 22 open to the world (Lightsail default) | `lightsail-connect` alias only (browser SSH), plus the deploy shell's IP for the length of a run; optional `AdminSshCidr` |
| Ports | 22, 80, 443, 3478/tcp+udp, 49160–49200/udp, opened by hand | Same set, in the template; `ufw` on the box mirrors it; hub on 127.0.0.1:8080 only (checked from outside by the deploy) |
| TURN secret | Generated on the box into `/etc/tiletrigger.env` | SSM SecureString `/toshiro/trigger/turn-secret`; pushed over SSH into root:tiletrigger 0640 files; coturn config 0640 root:turnserver |
| TURN TTL | 6 h | 1 h (`ICE_TTL=3600`) |
| TURN bounds | `total-quota=200` | `total-quota=40` (= relay ports), `user-quota=8`, `max-bps=48000`, `bps-capacity=2000000`, `no-tcp-relay`, `no-tls/no-dtls`, `stale-nonce=600`, more denied ranges (IPv6, test nets, 240/4) |
| Open-relay check | none | `infra/turn-check.py` from CloudShell and on the box, every deploy |
| Restarts | `Restart=always`, 3 s, no backoff | Restart always with 5 s → 5 min backoff (`RestartSteps`), never giving up; hub sandboxed (`ProtectSystem`, `NoNewPrivileges`, `MemoryMax=768M`…) |
| HTTPS | Caddy, bare `reverse_proxy` | + HSTS, nosniff, Referrer-Policy, frame, Permissions-Policy, 1 MB request bodies, `Server` header removed; optional apex redirect |
| Cost safety | none | Budget (15/25 USD + forecast), NetworkOut alarm at ~1 MB/s sustained, status and CPU-burst alarms, tags, log caps |
| DNS | Hand-made A record `trigger` | Stack-managed (hand-over mode `--dns replace`); apex optional (it holds a 192.0.2.1 placeholder: owner's call) |

**Static delivery (direction §17).** The site is served by the hub on the
Lightsail box (`site.ts`). The client's `public/` is ~83 MB (props 41 MB,
characters 20 MB); a first visit downloads a fraction of that (one map's
assets), cached for a year (`site.ts:55`). At ~40 MB a first visit, the 3 TB
allowance covers ~75,000 first visits a month, so S3 + CloudFront is not
needed yet. Move static files to S3/CloudFront (free tier: 1 TB out a month)
when NetworkOut nears ~1 TB/month from site traffic; the hub keeps `/lobby`
and `/broker`. If CloudFront is ever put in front of the hub, fix the
`X-Forwarded-For` handling first (`lobby.ts:151`).

## 4. Must change (implementation backlog, in direction-phase order)

Phase 1 (secure foundation):

1. **Join authorization**: the hub issues short-lived signed join tickets
   (MULTIPLAYER_PROTOCOL.md section 7); the host admits only valid tickets;
   join-code lookups rate-limited per address (10 a minute, 50 an hour).
2. ✔ partly (per game, by live join code; tickets come with item 1) **TURN credentials per session**: `/lobby/ice` only with a join ticket or
   a host registration token; username `<expiry>:<sessionId>.<playerId>` so
   coturn logs attribute usage; keep 1 h TTL; cap credentials per account.
3. ✔ CSPRNG (hub-issued codes come with item 1) **Join codes from a CSPRNG** (`crypto.getRandomValues`) and issued by the
   hub, which knows which codes exist (`joinCode.ts:18`).
4. ✔ **Browser-host input bounds**: cap chunk count/size and pending partial
   messages in `onText` (`peerLink.ts:116-139`, e.g. ≤ 64 chunks, ≤ 1 MiB a
   message, ≤ 4 partials a connection), cap inflated output in `Unzipper`
   (`peerZip.ts:39-60`, ≤ 1 MiB), and per-connection message-rate limits on
   both hosts (token bucket: 60 messages/s burst 120; close on sustained abuse).
5. ✔ **Dedicated server message-rate limit** (`server.ts:216`), same bucket.
6. ✔ (origin allow-list waits for authenticated endpoints) **Hub hardening**: rate-limit `GET/PUT /lobby/games` (60/min/address),
   constant-time secret compare (`lobby.ts:57,68`), PeerJS broker
   `concurrent_limit` and per-address connection caps, origin allow-list for
   authenticated endpoints (keep `*` on anonymous reads).
7. ✔ **Signaling behind an interface**: `HostLink`/`Signaling` abstraction so
   PeerJS can be swapped for the hub's own signaling (`session.ts:622`,
   `main.ts:365`).
8. ✔ **Map budgets** (section 5.3): per-tick trigger action budget, global
   NPC/projectile/spawn caps, byte cap before parsing, `dependencies` max.
9. ✔ **Hub-side listing rules**: verify `mapId` against the suite manifest for
   official/featured listings; allow community maps only with a
   `community: true` label plus map/version/hash (section 5.5).

Phase 2 (Persistent Host): Host Service skeleton wrapping `Match` headless,
pairing with Cognito accounts, outbound WSS control channel, closed command
set, crash supervision, startup restore, signed updates (SECURITY sections 6–7).

Phase 3: published map IDs/versions/hashes, map sync, rotations, moderation
primitives keyed on account IDs.

### Migration risks

- **DNS hand-over.** The live A record for trigger.toshiroplay.com was made
  by hand; CloudFormation can't adopt it. The deploy script refuses to
  continue unless told (`--dns skip` or `--dns replace`). Recommended: create
  the stack with `--dns skip` (new box beside the old one, verified on its
  IP), then `--dns replace` (record deleted and recreated by the stack; up to
  the 300 s TTL of mixed answers). If a stack *create* fails after the old
  record was deleted, CloudFormation rolls back and the name has no record:
  re-create it by hand (old IP) or re-run.
- **New instance, new IP.** The stack makes its own instance and static IP.
  The old instance (and its static IP, free only while attached) keep billing
  until the owner deletes them after the cut-over: about 12 USD for an
  overlapping month at most.
- **TURN secret changes** at cut-over (old box's own secret → SSM). Credentials
  issued by the old hub stop working on the new coturn; at most one TTL of
  failed relay joins, during a cut-over nobody is relayed through the old box
  anyway because the hub and TURN move together.
- **Bundle change replaces the instance** (template parameter `BundleId`).
  The box is set up again from Git, SSM and the published site build by the
  next deploy run; static IP stays.
- **Tighter coturn bounds** (41 relay ports, 48 KB/s per session) could
  refuse relays during a busy evening: watch coturn logs (`tiletrigger-relay
  status`) and widen the port range in both the template and host-setup
  together.
- **ufw on the box**: if a future service needs a port, open it in the
  template *and* `host-setup.sh`.
- ~~**Building on the box**~~ done: CI builds and attests the site, the box
  downloads and verifies it (GitHub Releases rather than S3: free for a
  public repository, nothing to run). On-box builds drained the CPU burst
  credits (the burst alarm fired) and once ran out of memory; now only
  `tiletrigger-update --build-here` builds there. The same verify-then-switch
  path is the base for signed Host Service releases.
- **Hub env grows**: `HUB_SIGNING_SECRET`, `COGNITO_*` and `PUBLIC_ORIGIN` are
  written to `/etc/tiletrigger.env` now but unused until the hub code lands.

### Blockers

- ~~**Cognito app client ID**~~ resolved: `2lrej6nsacfag8a7taeu3u6sc2`
  (public SPA client), the default in the client, the hub and
  `infra/deploy-multiplayer.sh --app-client-id`.
- ~~**Privacy page**~~ done (`/privacy`); the owner fills in the contact link.
- No other blockers for Phase 1. Phase 2 needs a code-signing key decision
  (SECURITY section 7) before the first Host Service release.

## 5. Map security schema (deliverable F)

### 5.1 Declarative data only — confirmed

- A map is a `MapDocument` JSON (`shared/src/map/schema.ts:766-794`): format
  and version literals, metadata, tile structure, a discriminated union of 23
  entity kinds, factions, logic, terrain, bounds, track, backdrop, physics,
  blood, glass, team setup, dependencies. Every field is a number, bounded
  string, enum, tuple or array of those.
- zod objects strip unknown keys, so a `script`, `url` or `onLoad` field in a
  file never reaches the game. **Rule for reviewers**: never add
  `z.any()`, `z.unknown()`, `.passthrough()`, free-form URLs, or a `script`
  field to `MapDocument`; CI test to add: parse a map with injected
  `script`/`url` keys and assert they are absent after `loadMap`.
- Logic is a closed vocabulary: event, condition and action types are enums
  (`logic.ts:19,61,78`), strings are display text (≤ 200 chars, `logic.ts:182`).

### 5.2 In-house asset IDs only — confirmed with two gaps

- Assets are referenced by `ContentId` (`"pack.name"`, `schema.ts:31`) for
  tiles, themes, materials, props, items, modes; destructibles, mounts, NPC
  roles, lights and liquids are enums. `validateMap` rejects unknown tiles,
  themes, materials, items and props (`validate.ts:88-163`), and `loadMap`
  refuses a map with any error (`validate.ts:59`).
- Gap 1: `dependencies[].pack` is a `ContentId` but is neither capped nor
  checked against our pack registry (`schema.ts:793`). Add `.max(16)` and an
  "unknown pack" error.
- Gap 2: the thumbnail is a captured image (data URL, ≤ 48,000 chars,
  JPEG/WebP only, `schema.ts:36-43`). Not an asset the game renders in play,
  but user pixels: don't show it in public listings until publishing
  re-renders it from the map on our side (or a moderation flag exists).

### 5.3 Resource budgets — concrete caps to implement

What exists, and what to add. "Schema" caps reject the map at load;
"runtime" caps are enforced by the simulation every tick, whatever the map
says.

| Budget | Today | To implement (default; host-configurable down, never up) |
|---|---|---|
| Map data size | none before `JSON.parse` (thumbnail ≤ 48 k chars) | **2 MiB** raw JSON, checked before parsing, everywhere a map arrives (hub, Host Service, browser host, joiner) |
| Total entities | ≤ 4,096 (`schema.ts:771`) | keep 4,096 schema; plus runtime **6,000** live entities incl. spawned |
| Tiles | ≤ 4,096 (`schema.ts:143`) | keep |
| Terrain | ≤ 161 × 161 vertices (`terrain.ts:36`) | keep |
| Map size (play area) | tile grid ±256 × ±16 (`schema.ts:116-118`), airplane routes ±2,000 m | **2 km × 2 km** bounds; refuse entities outside |
| Active NPCs | per encounter `activeCap` ≤ 32 (`schema.ts:340`), reinforcements ≤ 500 each; no global cap (`sim/encounters.ts:123`) | **64** alive at once map-wide (direction §27 test target), **256** spawned per minute |
| Player bots | `MAX_PLAYER_SLOTS` 96 (`sim/constants.ts:2`); guests ≤ 10 on a browser host | keep 96; Host Service default 32 until measured |
| Vehicles | per-entity, no total | **32** vehicles/mounts per map, **24** active (simulated) |
| Active projectiles | unbounded list (`sim/match.ts:421`) | **512** live; oldest non-player projectile despawns first |
| Destructibles | part of the 4,096 entities | **1,024** destructibles + blocks with health; **128** debris bodies alive |
| Simultaneous physics bodies | not counted | **1,500** dynamic bodies (props, debris, ragdolls, vehicles) |
| Trigger nodes | rules ≤ 256, ≤ 16 conditions and ≤ 32 actions each (`logic.ts:193-194,224`); variables ≤ 64, timers ≤ 32, objectives ≤ 32 | keep; plus a load-time warning when the rule graph has a cycle (A fires B fires A) |
| Trigger executions per tick | none (only depth) | **2,000 actions/tick**, **256 rule firings/tick**; past it, remaining work is deferred to the next tick and the host logs one warning per map |
| Sequence depth | `MAX_EVENT_DEPTH` = 8 (`sim/scenario.ts:169`, enforced at `:828`) | keep |
| Pending sequences (waits) | `MAX_SEQUENCES` = 256 (`sim/scenario.ts:170`, `:848`) | keep |
| Repeated events | none | same rule ≤ **30 firings/s**; timers ≥ 0.1 s already (`logic.ts:206`) |
| Spawned entities per interval | encounter `respawnSeconds` ≥ 0.5 (`schema.ts:344`) | **32 spawns/s** map-wide (NPCs, pickups, props) |
| Particle/effect requests | client-side only | **64 effect events per snapshot** sent to clients |
| Physics/tick time | `MAX_CATCH_UP_TICKS` 4, then drop (PERF_96.md) | Host Service: if a match runs > 2× real time budget for 10 s, pause logic and tell the owner (degrade, never freeze) |

Why per-tick: depth 8 alone doesn't bound breadth. 256 rules × 32 actions
that each fire an event can do up to (256 × 32)^8 work in one tick; the
action budget turns that into "slow, then deferred" instead of a frozen host.

### 5.4 Validated before execution

Every path that runs a map calls `loadMap` (schema + semantic validation):
joiners on `welcome` (`client/src/game/session.ts:969`), the dedicated server
for files in `maps/`, MapMaker on open. To add: the byte cap (5.3), the
budget checks as `validateMap` errors (so creators see them in MapMaker), the
Host Service validating before `START_SERVER`, and the hub validating
published maps at publish time. A map that fails is refused before the match
starts with the validation message (direction §26).

### 5.5 Identity: map ID, version ID, content hash

Published maps get (Phase 3; MULTIPLAYER_PROTOCOL.md section 10):

- `mapId`: immutable, assigned at first publish (`m_` + 16 base32 chars).
- `versionId`: immutable per publish (`v_` + 16 base32 chars), with a
  monotonically increasing `revision` for display.
- `contentHash`: `sha256` of the canonical JSON (keys sorted, no whitespace,
  thumbnail excluded) — hosts and clients compare it before joining.
- `schemaVersion` (= `MAP_FORMAT_VERSION`, today 22, `schema.ts:26`),
  `creatorId` (Cognito `sub`), `minGameVersion` (`PROTOCOL_VERSION`),
  `assetIds` (the distinct `ContentId`s used), metadata.

Joining a server announces `{ mapId, versionId, contentHash }`; a client
without that version fetches it from the hub, checks the hash, runs
`loadMap`, confirms every asset ID exists in its catalog, then joins. Names
are never identifiers.

**Owner's decision (recorded):** official and featured servers run only maps
of our suite (`maps/`, `inSuite()` in `client/src/playlists.ts`; today
enforced in the client, `frontEnd.ts:799`, and by the dedicated server's
`maps/` lookup). Community servers may run published community maps; the
game browser shows them with a **"Community map"** label. The hub enforces
both: a listing without `community: true` must name a suite `mapId`; a
community listing must carry a published `versionId` + `contentHash`. This
complements CLAUDE.md's rule ("online servers carry only maps built from our
own suite"), which applies to the servers we run.

## 6. Cost estimate (deliverable G)

Region us-east-1, prices as published in 2026; check the console before
deciding on anything close to a threshold.

| Item | Monthly |
|---|---|
| Lightsail 2 GB (`small_3_0`): 2 vCPU, 60 GB SSD, **3 TB transfer out included** | 12.00 USD |
| Static IP (attached) | 0 |
| Lightsail alarms: 3 metric alarms × 0.10 | 0.30 |
| Route 53 hosted zone toshiroplay.com (exists already) | 0.50 |
| Route 53 queries (~1 M/month standard at 0.40/M) | ~0.40 at most |
| SSM Parameter Store, standard tier, `aws/ssm` key | 0 |
| AWS Budgets (first two budgets free) | 0 |
| CloudFormation | 0 |
| Cognito (shared existing pool; free up to 10,000 MAU on Lite/Essentials) | 0 |
| **Total** | **~13 USD** (12.80 + DNS) |

Not included: the domain's yearly renewal (~15 USD/year, existing), and the
old hand-made instance until it is deleted.

### TURN bandwidth math

Relayed play costs ~3 KB/s per player in an 8-player match and ~10 KB/s at
16 players (HOSTING.md; host upload per friend). Inbound is free; outbound
counts against the 3 TB allowance, then **0.09 USD/GB** (us-east-1 overage).

| Case | Out through the box | Per hour | 3 TB covers |
|---|---|---|---|
| One relayed guest, 8-player match | ~3 KB/s | ~11 MB | ~277,000 relayed player-hours/month (≈ 380 relayed players around the clock) |
| One relayed guest, 16-player match | ~10 KB/s | ~36 MB | ~83,000 player-hours (≈ 115 around the clock) |
| A relayed *host* with 10 friends at 16 players (all their snapshots cross the relay) | ~100 KB/s | ~360 MB | ~8,300 host-hours (≈ 11 such hosts around the clock) |
| Hard ceiling: coturn `bps-capacity` 2 MB/s, saturated all month | 2 MB/s | 7.2 GB | 3 TB used in ~17 days; worst case ~5.2 TB → ~200 USD overage |

The worst case needs someone to saturate the relay for weeks: the NetworkOut
alarm fires after 15 minutes at ~1 MB/s, the budget alerts at 15 and 25 USD,
and `sudo tiletrigger-relay off` stops it in seconds.

### What would raise the cost

- **TURN traffic** (above): many players on strict networks, relayed hosts
  with full lobbies, or abuse of credentials (fixed for good by per-session
  TURN auth, section 4 item 2). Lower `bps-capacity` to cap the worst case.
- **Site downloads** from the box: ~40 MB per first visit; ~75,000 first
  visits a month fit in 3 TB. Past that, S3 + CloudFront (1 TB/month free).
- **Running matches on AWS** (official servers on the hub box or extra
  instances): CPU, not bandwidth, is the limit — a 96-player match takes
  8–10 ms of a 16.7 ms tick on a 4-core box (HOSTING.md "96 players"). A
  dedicated 4 GB/2 vCPU instance is 24 USD/month. Not planned.
- **Map publishing storage** (Phase 3): S3 at 0.023 USD/GB-month; maps are
  KBs, so negligible unless thumbnails/screenshots multiply.
- **Larger bundle** (4 GB = 24 USD) only if hub CPU/RAM is measured short.
- **Cognito** beyond 10,000 monthly active users (Essentials: ~0.015
  USD/MAU after that), or advanced security features.
- **CloudWatch Logs** if logs are shipped off the box (not done; journald is
  capped instead).
- **Snapshots** if automatic snapshots are enabled (0.05 USD/GB-month; not
  needed — the box rebuilds from Git + SSM).

## 7. Task: privacy page

Google sign-in (via Cognito) and Google's consent screen need a public
privacy policy URL: **https://trigger.toshiroplay.com/privacy**.

Done in the implementation pass (`packages/client/public/privacy/index.html`, linked from the menu footer; the hub serves folder pages, `site.ts`). As planned:

1. Add `packages/client/public/privacy/index.html` (static, no scripts),
   served by the hub's site handler at `/privacy` and `/privacy/` (the SPA
   fallback in `site.ts:48-52` would otherwise serve the game there).
2. Content: who runs it (ToshiroPlay), what is collected (account ID, email
   and display name from Cognito/Google sign-in; IP addresses transiently for
   rate limits and in coturn/journald logs, kept ≤ 14 days; game settings in
   the browser's local storage; no ads, no selling data, no in-game chat),
   peer-to-peer note (players in a match see each other's IP addresses
   through WebRTC unless relayed), cookies (none beyond sign-in), how to
   delete an account, contact email, last-updated date.
3. Link it from the main menu footer and the sign-in screen; add the URL in
   the Google Cloud OAuth consent screen and the Cognito app client.
4. Optionally a `/terms` page the same way.
