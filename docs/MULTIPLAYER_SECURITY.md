# Multiplayer security configuration

Deliverable 30 D of `docs/MULTIPLAYER_DIRECTION.md`. What is exposed, how
it is protected, where secrets live, and how hosts, the hub and updates
authenticate. Infrastructure: `infra/toshiro-trigger-multiplayer.yaml`,
`infra/deploy-multiplayer.sh`, `infra/host-setup.sh`. Gaps in today's code:
`docs/MULTIPLAYER_REVIEW.md`. Message formats: `docs/MULTIPLAYER_PROTOCOL.md`.

## 1. Exposed ports (hub instance)

| Port | Protocol | From | Service | Why |
|---|---|---|---|---|
| 22 | TCP | Lightsail browser console (`lightsail-connect` alias); the deploy shell's IP/32 during a run; optional `AdminSshCidr` | sshd | Administration only. Never a game endpoint. Key-only (Lightsail default); the deploy uses Lightsail's temporary SSH certificate. |
| 80 | TCP | anywhere (IPv4/IPv6) | Caddy | ACME HTTP-01 challenge; redirect to HTTPS. |
| 443 | TCP | anywhere | Caddy → hub 127.0.0.1:8080 | Site, `/lobby/*` (HTTPS), `/broker` (WSS signaling), later `/host` control (WSS). |
| 3478 | UDP + TCP | anywhere | coturn | STUN and TURN (auth required for TURN). |
| 49160–49200 | UDP | anywhere | coturn relay | Relayed media/data (41 ports = at most ~41 concurrent allocations). |

Not exposed: the hub's own port 8080 (bound to 127.0.0.1; the deploy checks
it is unreachable from outside), Caddy's admin API (localhost:2019), coturn
CLI (`no-cli`), TURNS/DTLS 5349 (`no-tls`, `no-dtls`), any database (there is
none), LAN discovery UDP 7790 (off behind a proxy, `hub.ts:28`).

## 2. Firewall rules

Two layers with the same allow-list, both written by code:

1. **Lightsail instance firewall** (CloudFormation `HubInstance.Networking.Ports`).
   Deploys replace the whole rule set, so console edits are reverted on the
   next deploy: change the template instead.
2. **ufw on the box** (`host-setup.sh`): default deny incoming, allow 22/tcp,
   80/tcp, 443/tcp, 3478/tcp+udp, 49160:49200/udp; default allow outgoing.

coturn's own peer filter (`denied-peer-ip`) keeps the relay from reaching
loopback, RFC 1918, CGNAT 100.64/10, link-local and the cloud metadata
address 169.254.169.254, test networks, multicast/reserved (240/4) and IPv6
loopback/ULA/link-local/NAT64. The box's private IP (172.26.x.x on
Lightsail) is inside 172.16/12. The static IP is *not* denied: two relayed
players reach each other relay-to-relay through it; reaching Caddy that way
gives nothing the internet doesn't already have, and the hub's 8080 is on
loopback.

## 3. TURN authentication

- **Method:** coturn `use-auth-secret` (the "TURN REST API" scheme). The hub
  holds the shared secret and mints credentials: username
  `"<unix-expiry>:<id>"`, password `base64(HMAC-SHA1(secret, username))`
  (`packages/server/src/ice.ts`, `coturnCredentials`). coturn recomputes the
  HMAC and refuses expired usernames. No user database on the relay.
  **Done:** the username is `<expiry>:s_<CODE>.<host|p_xxxxxxxx>`, one per
  game and peer, so coturn's logs attribute relay use to a game.
- **Lifetime:** `ICE_TTL=3600` (1 h, now also the code's default; floor
  10 min). Browser hosts renew at half life. An ICE session only needs the credential while
  allocating and refreshing; established relays outlive it until
  `max-allocate-lifetime` (1 h) and must refresh with a fresh credential.
- **Issued to whom:** `GET /lobby/ice?session=<CODE>&role=host|guest`, only
  for a game that is live on the hub's broker (or listed): 12 a minute per
  address and 30 per game (then 1 a minute). Without a session the hub
  answers STUN only. **Still to do** (protocol section 8): require a join
  ticket or host token instead of a live code; at most 3 credentials per
  ticket.
- **Bounds (coturn):** `total-quota=40`, `user-quota=8` allocations per
  credential, `max-bps=48000` per session, `bps-capacity=2000000` for the
  server, `no-tcp-relay`, `stale-nonce=600`, `max-allocate-lifetime=3600`.
- **Monitoring:** coturn logs to journald (session open/close with byte
  counts), Lightsail `NetworkOut` alarm (~1 MB/s sustained for 15 min), budget.
- **Revocation:** individual REST credentials cannot be revoked (no state);
  short TTL is the bound. To cut everyone off: rotate the secret (section 4)
  — every outstanding credential dies at once; or `sudo tiletrigger-relay off`
  (stops coturn and keeps it off across reboots and deploys until `on`).
- **Verification:** `infra/turn-check.py` runs on every deploy, from CloudShell
  and on the box: unauthenticated, made-up and expired credentials must get
  401; a valid one must allocate; relaying to 127.0.0.1, 10/8, 172.16/12,
  192.168/16, 169.254.169.254 and 100.64/10 must get 403.

## 4. Secret storage

| Secret | Where | Who reads it | Rotation |
|---|---|---|---|
| TURN shared secret | SSM SecureString `/toshiro/trigger/turn-secret` (standard tier, `aws/ssm` KMS key: free) | deploy script (owner's AWS credentials in CloudShell) → `/etc/tiletrigger.env` (root:tiletrigger 0640) and `/etc/turnserver.conf` (root:turnserver 0640) | `aws ssm put-parameter --name /toshiro/trigger/turn-secret --type SecureString --overwrite --value "$(openssl rand -hex 32)"`, then re-run the deploy. Relayed sessions reconnect with new credentials. |
| Hub signing secret (join tickets, host session tokens, pairing codes) | SSM `/toshiro/trigger/hub-signing-secret` | same path → `HUB_SIGNING_SECRET` in the hub env | Rotate the same way; support two keys (`kid`) in the hub so tokens signed with the old one stay valid for their (short) life. |
| Cognito app client ID, pool ID, domain | template parameters (not secret; public client `2lrej6nsacfag8a7taeu3u6sc2`, no client secret; also the default compiled into the client, `VITE_COGNITO_CLIENT_ID`) | hub env `COGNITO_*` | — |
| Admin token for a dedicated server | that server's own env (`ADMIN_TOKEN`) | the server | Owner's choice; constant-time compare already (`server.ts:153-155`). |
| Host Service device keys | generated on the user's machine, private key never leaves it (section 6) | Host Service | Re-pair. |
| Release signing key (Host Service updates) | offline / CI secret, never on the hub (section 7) | release CI | Key rollover via a signed key-transition manifest. |
| AWS credentials | none on the instance (Lightsail has no instance roles; none needed) | — | — |

Rules: nothing reusable in the browser bundle (the client only ever receives
short-lived TURN credentials and its own tokens); no secrets on command lines
(the deploy writes them to 0600 temp files, `--cli-input-json`, and over SSH
into files, never as process arguments); no secrets in logs (the hub never
logs headers or tokens; the deploy's `/lobby/ice` check doesn't print the
answer). Secrets Manager (0.40 USD/secret/month) is not needed; SSM standard
is free and enough at this scale.

## 5. Hub authentication

Three kinds of caller, three credentials (formats in MULTIPLAYER_PROTOCOL.md):

1. **Anonymous players** (no sign-in): may list games, look up a join code
   (rate-limited) and receive a join ticket for a *public* game. Identity is
   a random per-browser `playerKey` kept in local storage — not trusted, only
   used for rate limits and the host's local kick/ban list.
2. **Signed-in players / host owners**: Cognito (existing pool
   `us-east-1_VdMsuDJ59`, managed login at `login.toshiroplay.com`,
   authorization code + PKCE, public app client without a secret). The hub
   verifies the **ID/access token** (RS256, JWKS from
   `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_VdMsuDJ59/.well-known/jwks.json`,
   cached; check `iss`, `aud`/`client_id`, `token_use`, `exp`) once when the
   WebSocket opens, then issues its own short session (15 min, renewed while
   connected). **Done:** the client's sign-in (`client/src/account.ts`:
   `/auth/callback`, tokens in sessionStorage, no refresh token kept,
   sign-out through `/logout`) and the hub's verification
   (`server/src/auth.ts`, `GET /api/v1/me`: RS256 against the cached JWKS,
   `iss`, `aud` for ID tokens / `client_id` for access tokens, `token_use`,
   `exp`, `iat` not in the future; 10 failures a minute per address → 15 min
   block). The hub session token comes with the session socket. Needed for: pairing a Host Service, managing persistent hosts,
   private games for friends, later moderation.
3. **Hosts**: browser hosts get a `hostToken` when they register a session
   (HMAC-signed by the hub signing secret, scoped to that session ID, 2 h,
   renewed by heartbeat). Persistent hosts authenticate as paired devices
   (section 6).

Every authenticated message is checked for scope (which session/host it
names) as well as validity. Sensitive tokens carry `exp` and a `jti`;
one-time tokens (pairing codes, join tickets) are remembered until expiry to
refuse replays.

## 6. Host Service pairing and ownership (Phase 2 design)

- **Install**: per-user, no administrator rights (Windows: user-level
  install under `%LOCALAPPDATA%`, starts with a Run key or Scheduled Task at
  logon; macOS: LaunchAgent; Linux: `systemd --user`). It opens **no inbound
  admin port**; game traffic is WebRTC (direct or relayed), so no port
  forwarding is required.
- **Device key**: on first start the service generates an **Ed25519** key
  pair, stored with OS protection (DPAPI / Keychain / file 0600). `hostId` =
  `h_` + base32(sha256(publicKey))[0..16].
- **Pairing**: the owner opens `/host` signed in → "Add this PC" → the hub
  issues a **pairing code** (8 chars from a 31-symbol alphabet, ~40 bits,
  single use, 10 min, ≤ 5 attempts per code, ≤ 10 codes/hour per account).
  The Host Service shows a local prompt where the user types it (or the page
  opens `toshiro-host://pair?code=…`, confirmed in the service's own UI). The
  service sends `PAIR {code, publicKey, version, capabilities}`; the hub binds
  `hostId → ownerAccountId` and records version, capabilities, created/last
  seen.
- **Authentication**: every connection is outbound WSS to
  `wss://trigger.toshiroplay.com/host`. The hub sends a nonce; the service
  signs `nonce || hostId || timestamp`; the hub verifies with the stored public
  key. Knowing a host's IP gives nothing: there is nothing listening.
- **Ownership**: only the owner (Cognito `sub`) may control a host; later
  roles Owner/Admin/Moderator are explicit grants per host, never shared keys.
- **Revocation**: owner (or ToshiroPlay admin) revokes `hostId` in `/host`;
  the hub closes its socket and refuses its key. Re-pair to come back.
- **Control**: only the closed command set (protocol section 9); no command
  carries a path, URL, executable or shell text. Config values are
  schema-validated by the service as well as the hub.
- **Crash supervision**: the service supervises a child simulation process:
  bounded crash record (last 200 log lines, ≤ 64 KB, no tokens), restart with
  backoff 5 s → 5 min, at most 5 crashes in 10 min then stop and report
  `crashloop` to the owner; reconnect to the hub with jittered backoff.

## 7. Update signing strategy

Applies to the Host Service (executable code). The website is ordinary web
deployment (HTTPS from our box), not this pipeline.

**Status (site and hub on the Lightsail box): done**, with the same shape
and keyless signing (HOSTING.md, "Updates"): CI builds the site once, attests
it with Sigstore build provenance (GitHub's OIDC identity of `ci.yml` on
`main` or a `v*` tag; no key to keep), publishes it to GitHub Releases;
`tiletrigger-update` on the box checks SHA-256 and the attestation (cosign,
pinned by hash; the certificate must name this repository, `ci.yml`, an
allowed ref and the exact commit), unpacks into a versioned folder, switches
a link, health-checks and rolls back on failure. The hub runs from the git
checkout at the same commit with production dependencies from the lockfile.
For the Host Service, Sigstore keyless signing can replace the Ed25519 CI
key below (the service would embed the expected identity instead of a public
key); a key is still needed if it must verify offline.

- **Signing key**: Ed25519 release key generated offline; the private key
  lives in the release CI's secret store (GitHub Actions environment with
  required reviewers) or offline, never on the hub. The public key is
  compiled into the Host Service. A second, offline "root" key signs key
  rotation manifests.
- **Release manifest**: `{version, channel, minVersion, artifacts:[{os, arch,
  url, sha256, size}], released, notes}` signed with the release key
  (detached signature). Optionally also OS code signing (Authenticode /
  notarization) so installers don't warn; that is separate from, and in
  addition to, our signature.
- **Distribution**: artifacts and manifest on HTTPS (S3 + CloudFront, or
  GitHub Releases). The URL base is compiled in; the hub's `UPDATE` command
  carries only a version string — never a URL — and the service fetches the
  manifest from its built-in base.
- **Verify before apply**: signature on the manifest → version newer than
  current (no downgrades unless the manifest marks a signed rollback) →
  download → size + sha256 match → install to a new versioned folder →
  switch a pointer → restart. Keep the previous version for **rollback** if
  the new one fails its health check (doesn't register within 2 min) three
  times.
- **Drain first**: `UPDATE` sets drain (no new matches), waits for the match
  to end or the owner's deadline, then applies. An emergency flag in the
  signed manifest may skip draining.
- **Supply chain**: `pnpm install --frozen-lockfile` (already in CI); add
  `pnpm audit --prod` and GitHub Dependabot/CodeQL to CI; pin the Node
  runtime bundled with the service; reproducible build notes.

## 8. Hub defensive limits (summary)

Per-message sizes and rates are in MULTIPLAYER_PROTOCOL.md (section 2 and
each message). Implemented in the hub (MULTIPLAYER_REVIEW.md section 0 has
the numbers): per-address limits on every `/lobby` route and `/api/v1/me`;
JSON bodies only, ≤ 4 KB, schema-checked; constant-time listing secrets;
listings hidden after 30 s without a heartbeat and removed at 65 s; the
PeerJS broker behind our own HTTP server with per-address socket and connect
caps, a per-socket message budget, an OFFER (join) limit per address against
join-code guessing and 16 KB frames; client addresses from
`X-Forwarded-For` only when `TRUST_PROXY=1` and the request came from
loopback (Caddy), last entry only (`server/src/clientIp.ts`). Game hosts
(browser host and dedicated server) give each connection a message budget
(100/s, burst 200; sustained abuse disconnects) and cap message reassembly
and decompression. Infra already gives: TLS only (Caddy, HSTS), request bodies
≤ 1 MB at Caddy and 4 KB in `/lobby` (`lobby.ts:88`), the hub sandboxed by
systemd (`NoNewPrivileges`, `ProtectSystem=full`, `PrivateTmp`,
`MemoryMax=768M`), restarts with backoff, journald capped at 300 MB / 14
days, Caddy access logs off (no per-request IP log).

## 6a. Host Service MVP as built (October 2026)

What runs today (`packages/host`; HOSTING.md "Dedicated host"), against the
Phase 2 design above:

- **No credentials**: the service holds no AWS credential, hub secret or
  ToshiroPlay token. It talks to the hub as any browser host does (broker,
  `/lobby`), so the hub's rate limits and caps apply unchanged (3 listings per
  address, broker limits, 30 relay credentials per game).
- **Nothing listens on the internet**: the broker socket is outbound; players
  arrive over WebRTC (ICE; direct or through the hub's TURN). The only
  listener is the control API on `127.0.0.1` (never `0.0.0.0`), protected by
  an Origin allow-list (`https://trigger.toshiroplay.com`, localhost pages;
  CORS echoes the allowed origin, never `*`; `Access-Control-Allow-Private-Network`),
  a Host-header check against DNS rebinding, and a 192-bit pairing key made on
  first run (state folder, file mode 0600) that /host receives in the URL
  fragment of the link the service prints, and keeps in its own storage.
  Without the key a page learns only that a service runs (`/api/ping`).
- **Closed command set** (SEC-HOST-002): the console and the API accept only
  named commands with validated arguments; a start request may name only a
  suite map ID (never a path) and never the hub; there is no shell, path or
  URL argument anywhere.
  The launcher (the service's own page on 127.0.0.1) sends console lines,
  which go through the same parser and commands as the console window; only
  that page's origin may send them, with the pairing key, and the site's
  /host page cannot.
- **Normal user** (SEC-HOST-001): no administrator rights to unpack, run or
  start on boot (per-user Task Scheduler / Login Items / `systemd --user`).
- **Crash supervision** (SEC-HOST-005): the match runs in a child process;
  bounded error summaries (≤ 300 chars, no tokens); backoff 5 s → 5 min; 5
  crashes in 10 min stop it (`crashloop`); a hung match (no report for 30 s)
  is killed and restarted.
- **Untrusted players**: the dedicated server's limits (MessageGuard, input
  caps), plus per-link caps (`GUEST_TO_HOST_LIMITS`, binary refused, a link
  150 messages behind is closed). `MAX_PLAYERS` caps people (upload).
- **Bans**: by Cognito account when the player is signed in (hub-signed
  Ed25519 ticket bound to the join code, 120 s, single use: the host never
  sees the Cognito token, and a ticket can't be replayed at another game);
  guests only by browser key and direct address, which is weak by design.
  Stored locally (`bans.json`, 0600).
- **No impersonation**: listings are never official; the hub refuses names
  that claim to be (`claimsOfficial`); the game browser labels these games
  "Dedicated host" with a "community-run" tooltip; non-suite maps stay
  "Community map".
- **Supply chain**: the downloads are built by CI from the lockfile, with
  the official Node runtime checked against nodejs.org's SHASUMS256 and
  node-datachannel's prebuilt module from npm (integrity-checked), and are
  attested with Sigstore build provenance. Not yet: code signing (Windows
  SmartScreen and macOS Gatekeeper warn once), signed self-updates (section
  7), account pairing and the hub's host control socket (section 6).
