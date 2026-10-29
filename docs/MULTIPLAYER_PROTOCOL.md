# Multiplayer protocol boundary (hub ⇄ players ⇄ hosts)

Deliverable 30 E of `docs/MULTIPLAYER_DIRECTION.md`: the initial message and
schema boundaries between browsers, the hub on AWS, browser hosts and
persistent hosts (Toshiro Host Service). This is the contract for the
implementation task; today's endpoints (`/lobby/*`, PeerJS `/broker`) map
onto it in section 11. Security model: `docs/MULTIPLAYER_SECURITY.md`.

Gameplay messages between a player and the authoritative host
(`ClientMessage`/`ServerMessage` in `packages/shared/src/protocol.ts`) are
out of scope here: they ride the WebRTC data channel once a join succeeds,
and keep their own limits (inputs ≤ 32 a message, 2 a tick, 16 queued).
Since `PROTOCOL_VERSION` 4 their snapshots are delta-encoded per connection
(players as changes since the copy last sent on it; see HOSTING.md "96
players"), which relies on that channel being reliable and ordered.

## 1. Parties and channels

| Channel | Who | Transport | Auth |
|---|---|---|---|
| Discovery API | anyone | `GET https://trigger.toshiroplay.com/api/v1/...` | none |
| Account API | signed-in users | HTTPS | `Authorization: Bearer <Cognito access token>` |
| Session socket | browser hosts and joining players | `wss://…/api/v1/session` | host token or join ticket in the first message |
| Host control socket | paired Host Service | `wss://…/api/v1/host` (outbound from the PC) | device-key challenge |
| Gameplay | player ⇄ host | WebRTC data channel (direct, or TURN) | join ticket checked by the host |

All hub messages are UTF-8 JSON. Every WebSocket message is an object with:

```json
{ "v": 1, "t": "<type>", "rid": "<optional request id, ≤ 16 chars>", ... }
```

Unknown `t` → `{ "t": "error", "code": "unknown_type" }`; malformed or
over-size → close `4400`. Responses echo `rid`. Errors:
`{ "t": "error", "rid", "code": "<snake_case>", "message": "<≤ 200 chars>" }`.

## 2. Global limits

| Limit | Value |
|---|---|
| HTTP request body | 4 KB (`/api/v1/*`), 1 MB hard limit at Caddy |
| WebSocket frame | 8 KB session socket, 16 KB host socket (`maxPayload`) |
| WebSocket messages | token bucket per connection: 10/s, burst 30 (session); 5/s, burst 20 (host). Exceed for 10 s → close `4429` |
| Connections | 4 session sockets per IP, 2 per player key; 2 host sockets per hostId |
| HTTP requests | 60/min per IP across `/api/v1/*` (finer limits per endpoint below) |
| Auth failures | 10/min per IP → 15 min block (429) |
| Handshake | first message within 5 s, else close `4408` |
| Idle | ping every 25 s; no pong in 60 s → close |
| Strings | trimmed, control characters stripped, lengths below; names never used as IDs |
| IDs | `[A-Za-z0-9_-]`, fixed prefixes: `s_` session, `h_` host, `m_` map, `v_` map version, `p_` player key; 8–32 chars after the prefix |

Validation uses one schema per message (zod in `packages/shared`, shared by
hub, hosts and tests). Hosts and clients never trust each other's metadata
without the same validation.

## 3. Host registration (browser host)

Opens a listing/session for a match running in a browser.

`session.create` (host → hub), first message on the session socket.
Rate: 10/min per IP, 3 live sessions per IP, 1 per browser host tab.

```jsonc
{ "v": 1, "t": "session.create", "rid": "r1",
  "name": "Ana's game",            // 1-40 chars
  "visibility": "public",          // public | unlisted | friends (friends needs sign-in)
  "mode": "core.tdm",              // GAME_MODES
  "map": { "kind": "suite", "mapId": "frost_basin" },
  // or { "kind": "community", "mapId": "m_…", "versionId": "v_…", "contentHash": "sha256:…" }
  "players": 1, "max": 11,         // 0-96, max ≤ 96 (browser hosts ≤ 1 + BROWSER_HOST_MAX_GUESTS)
  "gameVersion": 7,                // PROTOCOL_VERSION
  "hostType": "browser",
  "region": "eu"                   // optional, coarse: na | sa | eu | af | as | oc
}
```

Hub checks: schema; suite `mapId` exists in the suite manifest, community
maps are published and the hash matches the version (labelled "Community
map" in listings; never on official/featured servers); `gameVersion`
supported.

Reply `session.created`:

```json
{ "v": 1, "t": "session.created", "rid": "r1",
  "sessionId": "s_…", "joinCode": "K7QX4M",   // 6 chars, CSPRNG, alphabet without look-alikes
  "hostToken": "<hub-signed, scope=session:s_…, exp 2 h>",
  "heartbeatSeconds": 20, "expirySeconds": 65 }
```

## 4. Heartbeat

`host.heartbeat` (host → hub) every 20 s (± 3 s jitter). Accept at most 1
per 5 s; more → ignored, sustained → close.

```jsonc
{ "v": 1, "t": "host.heartbeat",
  "players": 6, "max": 11, "bots": 12,
  "state": "playing",              // lobby | playing | ending | draining
  "map": { "kind": "suite", "mapId": "frost_basin" },
  "mode": "core.tdm",
  "health": { "tickMs": 4.1, "lateTicks": 0 }   // numbers, clamped; optional
}
```

Reply `host.ack { "t": "host.ack", "hostToken"?: "<renewed>" }`. Missing
heartbeats: after 30 s marked `stale` (hidden from discovery), after 65 s
removed and its join code freed. A host that reconnects within 65 s with its
`hostToken` resumes the same session and code (`session.resume`).

`session.close { "t": "session.close" }` removes it at once (also on socket
close for browser hosts).

## 5. Discovery

`GET /api/v1/servers?v=<gameVersion>&mode=<mode>&cursor=<opaque>` → 200

```json
{ "servers": [
  { "sessionId": "s_…", "name": "Ana's game", "hostType": "browser",
    "mode": "core.tdm", "map": { "kind": "suite", "mapId": "frost_basin", "name": "Frost Basin" },
    "community": false, "players": 6, "max": 11, "region": "eu",
    "official": false, "relay": true, "age": 4 } ],
  "next": "<cursor or null>" }
```

Only `public` sessions; ≤ 50 per page; 30 requests/min per IP; response
cached 2 s. Join codes are **not** in listings (joining goes through a
ticket); `name` comes from the hub's sanitised copy. Persistent hosts list
the same way with `hostType: "persistent"`.

## 6. Session creation (persistent host)

The hub starts a session on a paired host only through `START_SERVER`
(section 9); the Host Service then calls `session.create` over its host
socket with `hostType: "persistent"` and the same fields. One host may run
one session (Phase 4 may raise this).

## 7. Join authorization

Before any signaling, a player obtains a **join ticket**.

`POST /api/v1/join` (HTTPS), body ≤ 512 bytes.
Rate: 10/min and 50/hour per IP, 5 failures/min per IP → 15 min block;
per code: 20 lookups/min (stops brute force on one code).

```jsonc
{ "code": "K7QX4M",          // or "sessionId": "s_…" (from the server browser)
  "playerKey": "p_…",        // random per browser, kept in local storage
  "name": "Bo" }             // 1-32 chars (24 + clan tag)
// optional header Authorization: Bearer <Cognito token> (required for friends-only sessions)
```

→ 200

```json
{ "ticket": "<hub-signed JWT-like token>",
  "sessionId": "s_…", "expires": 1798400000,
  "signalUrl": "wss://trigger.toshiroplay.com/api/v1/session",
  "map": { "kind": "suite", "mapId": "frost_basin" } }
```

Ticket claims: `sid` (session), `pk` (player key), `sub` (account, if signed
in), `name`, `iat`, `exp` (iat + 120 s), `jti`. HMAC-SHA256 with the hub
signing secret (`kid` header for rotation). Errors: `not_found` (no such
code — same answer and timing as `full`/`closed` to avoid enumeration),
`full`, `version_mismatch`, `banned` (host-local ban list keyed on `pk`/`sub`).

The host verifies the ticket again when the data channel opens (the hub sends
hosts its current verification key over the host socket), refuses reused
`jti`s and tickets for other sessions.

## 8. Signaling and TURN credentials

### TURN credential request

`GET /api/v1/ice` with `Authorization: Bearer <ticket or hostToken>`.
Rate: 3 per ticket, 12/min per hostToken, 12/min per IP.

```json
{ "iceServers": [
    { "urls": ["stun:trigger.toshiroplay.com:3478"] },
    { "urls": ["turn:trigger.toshiroplay.com:3478", "turn:trigger.toshiroplay.com:3478?transport=tcp"],
      "username": "1798403600:s_ab12.p_cd34", "credential": "<base64 HMAC-SHA1>" } ],
  "ttl": 3600 }
```

Username = `<expiry>:<sessionId>.<playerKey|host>` so coturn's logs attribute
relay use to a session. TTL 1 h. When the relay is switched off the hub
returns only STUN and `"relay": false`.

### Signaling (session socket)

After `session.create` (host) or `join.hello { ticket }` (player), the hub
relays opaque WebRTC negotiation between exactly that player and that
session's host. It never interprets SDP beyond size and type checks.

| Message | Direction | Fields | Limits |
|---|---|---|---|
| `join.hello` | player → hub | `ticket` | first message; 1 per socket |
| `join.request` | hub → host | `peerId` (hub-assigned, per join), `name`, `pk`, `sub?` | — |
| `join.accept` / `join.reject` | host → hub | `peerId`, `reason?` (≤ 80) | 1 per peerId |
| `signal.offer`, `signal.answer` | both ways | `peerId`, `sdp` (≤ 6 KB) | 4 per peerId |
| `signal.candidate` | both ways | `peerId`, `candidate` (≤ 512 B), `sdpMid` (≤ 16), `sdpMLineIndex` (0-15) | 40 per peerId |
| `signal.done` | both ways | `peerId` | closes the negotiation; hub forgets it after 60 s |

A peer that hasn't completed negotiation in 30 s is dropped. The host
admits a guest only after its own ticket check (section 7).

This replaces the PeerJS broker (`/broker`) behind the transport/signaling
abstraction; until then PeerJS stays as one implementation.

## 9. Persistent-host control

### Pairing

1. Owner (signed in): `POST /api/v1/pairing-codes` → `{ code: "8 chars", expires }`
   (10/hour per account, single use, 10 min).
2. Host Service, host socket: `host.pair { code, publicKey (Ed25519, base64url 32 B),
   version, os: "windows|macos|linux", capabilities }` → `host.paired { hostId }`.
   5 attempts per code, 10/hour per IP.

### Connect and register

1. hub → `host.challenge { nonce (32 B base64url), ts }`
2. host → `host.auth { hostId, sig: Ed25519(nonce ‖ hostId ‖ ts) }` (within 5 s)
3. host → `host.register`:

```jsonc
{ "v": 1, "t": "host.register",
  "version": "0.4.2", "gameVersion": 7,
  "capabilities": { "maxPlayers": 32, "maxBots": 48, "modes": ["core.tdm", "core.ctf"],
                    "cpuCores": 8, "ramGB": 16 },   // coarse; no hostname, user name, IP list or hardware IDs
  "state": "idle" }                                   // idle | running | draining | crashloop
```

Heartbeats as section 4 plus `status` (below) every 20 s.

### Commands (closed set)

Owner → hub: `POST /api/v1/hosts/{hostId}/commands` with a Cognito token of
the host's owner (later: an Admin role). Body ≤ 4 KB. 30/min per account,
1 in flight per host (except `REQUEST_STATUS`). The hub validates, adds
`cmdId` and `exp` (60 s), signs nothing new (the host socket is
authenticated), and forwards:

```json
{ "v": 1, "t": "command", "cmdId": "c_…", "exp": 1798400060, "cmd": "<NAME>", "args": { ... } }
```

The Host Service checks `cmd` is one of the eight below, validates `args`
with the same schema, refuses expired or repeated `cmdId`s, and answers
`command.result { cmdId, ok, error?: code, status? }`. Anything else is
refused with `unknown_command` and logged. There is no command that takes a
shell string, executable, file path or URL.

| Command | Args (all validated) | Effect |
|---|---|---|
| `START_SERVER` | `{ map: {kind:"suite",mapId} \| {kind:"community",mapId,versionId,contentHash}, mode, name (1-40), visibility, maxPlayers (1-96 ≤ capability), bots (0-96), botSkill: easy\|normal\|hard, rules?: HostRulesPatch }` | Validates the map (fetch by ID from the hub, check hash, `loadMap`, budgets), starts the sim child, `session.create`. |
| `STOP_SERVER` | `{ reason?: ≤ 80 }` | Notifies players, ends the match, closes the session. |
| `RESTART_SERVER` | `{}` | Stop + start with the current config (crash-loop rules apply). |
| `DRAIN_SERVER` | `{ deadlineSeconds?: 0-7200, shutdownWhenEmpty?: bool }` | No new joins; ends after the match or the deadline. |
| `SET_CONFIG` | `{ name?, visibility?, maxPlayers?, bots?, botSkill?, botStyle?, autoStart?: bool, startWithOS?: bool }` | Applies live where possible, else at next match. |
| `SET_ROTATION` | `{ entries: [{ map, mode }] (1-32), shuffle?: bool }` | Next maps; each entry validated like `START_SERVER`. |
| `UPDATE` | `{ version: semver, emergency?: bool }` | Fetch the signed manifest from the built-in URL, verify, drain (unless the signed manifest is an emergency release), apply, restart (SECURITY section 7). No URL argument. |
| `REQUEST_STATUS` | `{}` | Replies with `status` now. 6/min. |

`status` (host → hub, with heartbeats and on request), ≤ 2 KB:

```json
{ "state": "running", "uptimeS": 86400, "session": "s_…", "players": 5, "bots": 11,
  "map": { "kind": "suite", "mapId": "frost_basin" }, "mode": "core.tdm",
  "cpuPct": 23, "ramMB": 610, "netKBps": { "in": 40, "out": 180 },
  "tick": { "p50Ms": 3.2, "p95Ms": 7.9, "lateTicks": 0 },
  "lastCrash": { "at": 1798390000, "summary": "≤ 200 chars" } }
```

The `/host` dashboard reads it through `GET /api/v1/hosts` (owner's hosts)
and a WSS subscription; closing the dashboard changes nothing on the host.

## 10. Map data (Phase 3 boundary)

`GET /api/v1/maps/{mapId}/versions/{versionId}` → the canonical map JSON
(≤ 2 MiB, `Content-Type: application/json`, `ETag: "<contentHash>"`), cached
immutably. Clients and hosts check `sha256(canonical JSON) == contentHash`,
then `loadMap`, then that every asset ID exists in their catalog. Publishing
(`POST /api/v1/maps`, signed-in, 10/day per account) validates schema,
budgets and asset IDs on the hub before accepting.

## 11. Mapping from today's endpoints

| Today | Becomes | Note |
|---|---|---|
| `GET /lobby/games` | `GET /api/v1/servers` | listings stop carrying join codes. **Now:** rate-limited, stale listings hidden after 30 s, `community` flag on every listing |
| `POST/PUT/DELETE /lobby/games[/id]` + `X-Lobby-Secret` | `session.create` / `host.heartbeat` / `session.close` on the session socket + `hostToken` | **Now:** JSON ≤ 4 KB, schema-checked, constant-time secret, suite-or-community rule (`community`, `versionId`, `contentHash` fields) |
| `GET /lobby/ice?session=<CODE>&role=host\|guest` | `GET /api/v1/ice` with ticket/hostToken | **Now:** per-game username `<expiry>:s_<CODE>.<host\|p_…>`, only for a live code, TTL 1 h by default |
| PeerJS `/broker` + code `tiletrigger-<CODE>` | `POST /api/v1/join` + session socket signaling | keep PeerJS as a transport until replaced. **Now:** behind the client's `Signaling`/`HostLink` interface (`client/src/game/transport.ts`); broker rate-limited per address (`server/src/broker.ts`) |
| — | `GET /api/v1/me` | **Now:** Cognito token check (no user records); `GET /api/v1/health` too |
| `GET /lobby/health` | unchanged (also `GET /api/v1/health`) | used by the deploy script |
| `GET /lobby/lan` | unchanged | home networks only |

Keep the old endpoints serving the previous `PROTOCOL_VERSION` for one
release so cached clients keep working. (Clients from before the
per-session relay change call `/lobby/ice` without a session and get STUN
only: they still connect directly.)

### Implemented limits (Phase 1 pass) vs this document

The gameplay channel and today's `/lobby` endpoints enforce the limits in
MULTIPLAYER_REVIEW.md section 0. Where they differ from section 2 above,
section 2 is the target for the session socket (`/api/v1/session`), which
doesn't exist yet: gameplay connections allow 100 messages/s (burst 200)
because a client sends 60 inputs a second; the PeerJS broker allows 20/s
(burst 100) per socket and 16 KB frames; `/lobby/games` reads are 120/min
per address (the game browser refreshes every 10 s and households share an
address). Map data (section 10): 2 MiB before parsing is enforced by
`loadMap` everywhere; content hashes are `sha256:` over the canonical JSON
with the picture, `updatedAt` and the `release` block left out
(`shared/src/map/identity.ts`).

## 12. Host Service MVP (implemented, October 2026)

The first Host Service (`packages/host`, HOSTING.md "Dedicated host") uses
today's endpoints rather than sections 6 and 9, which still describe the
paired version:

- **Registration**: the PeerJS broker as a host, `tiletrigger-<CODE>`, exactly
  as a browser host (reconnecting with the same id and broker token after
  losing the hub). Listing: `POST/PUT/DELETE /lobby/games` with
  `hostType: "dedicated"` (absent or `"browser"` for browser hosts). The hub
  never marks a listing official; names and host names that claim to be
  ("Official", "ToshiroPlay", "Tile Trigger", look-alike spellings) are
  refused with 400 (`claimsOfficial`, `shared/src/net/lobby.ts`).
- **TURN**: `GET /lobby/ice?session=<CODE>&role=host`, renewed at half life.
- **Gameplay**: unchanged messages (`PROTOCOL_VERSION` 4, still compatible
  with 0.3.0 clients: every new field is optional). `welcome.dedicated: true`
  tells a client joined by code that the pause menu's Server admin login
  applies. `hello` gains `pk` (a random per-browser key, `p_` + 8–32
  `[A-Za-z0-9_-]`) and `ticket` (≤ 1000 chars). `HostCommand` gains
  `{ c: "kick", slot, reason? }` and `{ c: "ban", slot, minutes?, reason? }`
  (reason ≤ 80 chars, minutes ≤ 525,600; 0/absent = for good). Browser hosts
  run kick/ban for their own friends; dedicated servers for admins only.
- **Account tickets** (a first piece of section 7): `GET /api/v1/ticket?code=<CODE>`
  with `Authorization: Bearer <Cognito token>` → `{ ticket, exp }`;
  `GET /api/v1/ticket-keys` → `{ keys: [{ kid, x }] }` (Ed25519 raw public
  keys, base64url). Ticket = `base64url(JSON{kid, sub, code, iat, exp, jti})`
  `.` `base64url(Ed25519 signature)`, 120 s, for one join code; the host checks
  the signature, the code and the expiry, and accepts each `jti` once. Same
  per-address limits as `/api/v1/me`. The key is made at hub start
  (`HUB_TICKET_KEY` keeps one); hosts refetch keys on an unknown `kid`.
- **Control API** (local only, not the hub's): `http://127.0.0.1:7797/api/`
  `ping` (no auth: `{service, version, paired}`), `status`, and POST `start`,
  `stop`, `restart`, `kick`, `ban`, `unban`, `quit`, with
  `Authorization: Bearer <pairing key>`; bodies ≤ 4 KB JSON; 240 requests and
  20 commands a minute. See MULTIPLAYER_SECURITY.md section 6a.

## 13. Host leaves (browser hosts, October 2026)

A match a player's browser hosts ends when that browser goes. What friends
see then (`client/src/main.ts` `afterHost`, `game/hostLeft.ts`):

- **Goodbye**: a host leaving on purpose (Leave match, closing or reloading
  the tab: `pagehide`) sends every friend `{ t: "bye" }` before its links
  close (`LocalTransport.sayGoodbye`). A friend's `PeerTransport` then reports
  the host as `left`; a link that closes without it, or a host silent for 20 s
  (`HOST_SILENT_MS`: a browser host streams 20 snapshots a second), as
  `dropped`. Dedicated hosts (`welcome.dedicated`) keep the old behaviour
  (reconnect for up to a minute: they hold places and come back).
- **Dropped**: "Reconnecting to host…" for up to 15 s (rejoining the same code
  until let in, or until the broker says it is gone; the host keeps the place
  60 s by the friend's key, so a blip or a reload brings them back to it).
- **Then**: the host-left screen: the last standings the friend had, "The host
  left", and **Host this map** (one click: a Host game on the same map, mode
  and rules, about as many players, listed in the game browser so the others
  can find it) or **Back to menu**.

`bye` is a new optional server message: older clients ignore it, so
`PROTOCOL_VERSION` stays 4.

## 14. Host handoff (browser hosts, October 2026)

A browser-hosted match with friends in no longer has to end with its host
(`shared/src/net/handoff.ts`, `client/src/game/matchHost.ts` `tendSuccessor`,
`peerLink.ts` `onHandoff`, `main.ts` `afterHost` / `takeOver`):

- **Successor, named in advance**: once a second the host keeps one friend
  named, the one with the lowest ping (a friend clearly better by 80 ms takes
  the role over; away players are skipped). It sends that friend
  `{ t: "standby" }`; the friend opens a join code of its own on the broker
  (a `PeerHost` that holds any links until it has a match) and answers
  `ClientMessage { t: "standby", code }` (a join code, nothing else). Only the
  friend asked may answer; one that doesn't within 30 s is passed over (a
  late answer still counts while no one else is ready). Then
  every friend gets `{ t: "successor", code, slot, name }` (again whenever it
  changes, `code: ""` when there's none, and on joining).
- **Checkpoint**: every 3 s, to the successor only,
  `{ t: "checkpoint", cp }` (`MatchCheckpoint`): map ID, live rules, phase and
  seconds left, fill, bot skill, objective team scores, and every player
  (people and bots): name, team, kills / deaths / self-kills / objective
  plays, alive, position, facing, health, armour, weapons with ammo and the
  one in hand. People carry only a hashed key (`handoffKey`: `h:` + 32 hex of
  SHA-256 of `pk:…` or `sub:…`), never the key; bans likewise; plus the game
  browser listing's name, id and secret. The successor checks shape and size
  (`parseCheckpoint`, ≤ 96 KB).
- **The host goes** (`bye`, or a drop after the reconnect try): the successor,
  if its checkpoint is at most 30 s old and for the map it has, starts the
  match from it (`LocalMatchOptions.restore`: `BotFiller.restore`,
  `Match.resume`) on its standby code, with the clock moved on by the
  checkpoint's age, deletes the old listing with its secret and lists the
  match under its own code. Everyone else gets "The host left: <name> is
  taking over…" and joins the successor's code with the usual hello, ticket
  and join checks; their places wait for them as away players held 60 s by
  hashed key (`reclaim` tries the key and its hash), so they get back their
  slot's team, score and weapons. Not let in within 20 s, or no successor:
  the host-left screen (section 13).
- **Trust**: friends only ever follow a code their own host named over its
  link; nobody can claim to be the successor. The successor sees no other
  player's key. It does get the listing's secret (it can only take that
  listing down or update it).
- **Carries over**: players and teams, scores, team scores of objective
  modes, the clock, positions, facing, health, armour, weapons and ammo, bot
  count and skill, rules as changed, bans, the listing. **Starts fresh**:
  projectiles and bullets in flight, ground hazards, deployed cover,
  vehicles and turrets (back at their spots; riders are put on foot where
  they were), pickups (all available), doors / buttons / destructibles /
  scenario logic and timers, NPCs and encounters, flags and bombs (back at
  base), Zombies waves (from wave 1), race progress, classes, kill streaks
  and UAVs, the dead (they respawn a second later). Bots get fresh brains.

`standby`, `successor`, `checkpoint` and the `standby` client message are
new optional messages: older clients ignore them (an older friend just never
answers `standby` and is passed over), so `PROTOCOL_VERSION` stays 4.
Dedicated servers never send them and ignore a `standby` answer. No hub
change was needed: the standby code is an ordinary broker registration and
the listing moves with the existing `POST` / `DELETE /lobby/games`.
