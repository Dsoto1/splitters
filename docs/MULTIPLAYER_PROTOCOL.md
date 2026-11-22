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
(≤ 3 MiB, `Content-Type: application/json`, `ETag: "<contentHash>"`), cached
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
address). Map data (section 10): 3 MiB (`RESOURCE_BUDGETS.mapBytes`; 2 MiB before 2026-11-22) before parsing is enforced by
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
  (`HOST_SILENT_MS`: a browser host streams 20 snapshots a second; 60 s while
  the connection itself is up, `HOST_STALLED_SILENT_MS`: the host's page has
  stalled, e.g. building shaders, it hasn't gone), as `dropped`. Dedicated
  hosts (`welcome.dedicated`) keep the old behaviour (reconnect for up to a
  minute: they hold places and come back), and a dedicated host silent for
  30 s (`DEDICATED_SILENT_MS`, `game/hostSilence.ts`) has dropped us without
  the close reaching us: the page reconnects into its kept place.
- **Dropped**: "Reconnecting to host…": rejoining the same code until let in,
  or until the broker says the game is gone (at once when the host's tab closed
  or crashed), for up to a minute (a host whose machine lost its network stays
  on the broker until it gives up on it, about a minute; a successor must not
  take over a match that is still running). The host keeps the place 60 s by
  the friend's key, so a blip or a reload brings them back to it.
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
  named, the one with the lowest ping (away players are skipped). A friend
  clearly better (by 80 ms and 40 %) replaces a ready successor, but only after that one
  has been ready 30 s (pings on a loaded machine swing by seconds), and the
  successor stays named until the replacement answers, so there's always
  one (a friend asked while another is named keeps its standby code unless
  the host names a third). It sends that friend
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
  one in hand, and a person's party tag (`py`, net/party.ts). People carry only a hashed key (`handoffKey`: `h:` + 32 hex of
  SHA-256 of `pk:…` or `sub:…`), never the key; bans likewise; plus the game
  browser listing's name (never its id or secret). Between matches, the open
  next-map vote too (`vote`: `{ o, votes: [[player index, option]], left, w?, by? }`,
  `CheckpointVote`); a change in the vote sends a fresh checkpoint at the host's
  next once-a-second turn. The successor checks shape and size
  (`parseCheckpoint`, ≤ 96 KB; a bad ballot drops the vote, bad votes are left out).
  Older successors ignore `py` and `vote` (the party's tags and the vote start fresh there, as before).
  With Fireteams on, each player's own squad points (`sp`: `[points, kills, assists, objectives, hill s]`) and the
  squads themselves (`squads`: `[{ m: [player index…], l: leader index or -1, t: tally, h?: 1 }]`,
  `Match.checkpointSquads`); the successor makes the squads again as they were, with their points
  (`Match.restoreSquads`, from `BotFiller.restore`), so neither restarts from zero (Fireteams follow-ups,
  2026-11-10). Older successors ignore both (the squads' points started from zero there before).
- **The host goes** (`bye`, or a drop after the reconnect try): the successor,
  if its checkpoint is at most 30 s old and for the map it has, starts the
  match from it (`LocalMatchOptions.restore`: `BotFiller.restore`,
  `Match.resume`) on its standby code, with the clock moved on by the
  checkpoint's age, and lists the match under its own code with the old
  listing's name. A host leaving on purpose takes its listing down itself,
  and its `bye` to the successor alone carries the listing's id and secret
  (`{ t: "bye", listing }`), which the successor uses to take it down too,
  in case the host's request didn't get out of its closing tab. A crashed
  host's listing is hidden once it misses a check-in (30 s) and expires
  after 65 s. Everyone else gets "The host left: <name> is
  taking over…" and joins the successor's code with the usual hello, ticket
  and join checks; their places wait for them as away players held 120 s by
  hashed key (`reclaim` tries the key and its hash), so they get back their
  slot's team, score and weapons. They keep trying (`keepJoining`: tries of
  10 s, or a minute once linked, for up to 90 s, as the successor is busy
  starting the match at that very moment) until let in; refused, the
  successor's code gone, the time up, or no successor: the host-left screen
  (section 13).
- **Trust**: friends only ever follow a code their own host named over its
  link; nobody can claim to be the successor. The successor sees no other
  player's key, and gets the listing's id and secret only with the host's
  goodbye (sooner, any friend named successor could take a live host's
  listing down or point it at another game).
- **Forks**: a successor takes over only when its host said `bye`, or when
  its own reconnect to the host ends with the broker saying the code is gone,
  twice, 3 s apart (a host whose broker link blipped is back on it within
  seconds), while its checkpoint is still fresh (30 s); a host that is unreachable
  from the successor but still registered keeps the successor retrying the
  old code until the checkpoint is stale, so it never starts a second copy
  (that match then ends for the successor, who gets the host-left screen).
- **Carries over**: players and teams, scores, team scores of objective
  modes, the clock, positions, facing, health, armour, weapons and ammo, bot
  count and skill, rules as changed, bans, the listing. **Starts fresh**:
  projectiles and bullets in flight, ground hazards, deployed cover,
  vehicles and turrets (back at their spots; riders are put on foot where
  they were), pickups (all available), doors / buttons / destructibles /
  scenario logic and timers, NPCs and encounters, flags and bombs (back at
  base), Zombies waves (from wave 1), classes, kill streaks
  and UAVs, the dead (they respawn a second later). Bots get fresh brains.

`standby`, `successor`, `checkpoint` and the `standby` client message are
new optional messages: older clients ignore them (an older friend just never
answers `standby` and is passed over), so `PROTOCOL_VERSION` stays 4.
Dedicated servers never send them and ignore a `standby` answer. No hub
change was needed: the standby code is an ordinary broker registration and
the listing moves with the existing `POST` / `DELETE /lobby/games`.

## 15. Spectating (October 2026)

Players can leave play to watch, and a watcher's camera input counts as being
there (`shared/src/sim/match.ts` `Match.spectate` / `joinFromSpectating`,
`BotFiller.spectate` / `rejoin` / `watch`; `client/src/game/spectatorCam.ts`).
All additions are optional, so `PROTOCOL_VERSION` stays 4:

- **`welcome.spectate: 1`**: the host (dedicated server, Host Service or a
  browser host) lets players spectate by choice. Without it the pause menu
  doesn't offer Spectate.
- **`ClientMessage { t: "spectate", on }`**: `on: true` takes the sender's
  player out of the match: their body goes (as if they left, so a mode's
  `onLeave` runs: a carried flag drops), the bot fill brings in a bot for the
  place, their slot is kept with nothing in it (no newcomer or bot takes it),
  and their kills, deaths and objective plays wait for them. `on: false` puts
  them back in that slot with that score (team: the rules' assignment) and a
  bot gives way. Older hosts ignore the message (`parseClientMessage` returns
  null for unknown types and the hosts drop it).
- **`RosterEntry.sp: 1`**: a spectator (after the players, `team: null`, not
  a bot). Snapshots to a spectator carry no `me` and don't list them among
  the players; interest management sends them everyone (a viewer with no
  body, like the dead).
- **`PlayerInput.sp: 1`**: camera input from someone watching (a spectator,
  or a dead player in the kill cam, following someone or flying the free
  camera): they turned, moved the free camera or picked whom to watch that
  tick. `Match.noteActivity` counts it as activity, for spectators too (their
  inputs move nothing, they only count). So the away rule (`AWAY.afkSeconds`:
  a bot plays for an idle player) never fires on someone watching and
  touching the controls. A spectator has no body for a bot to play, so the
  only idle rule for them is the idle kick: no input at all for
  `AWAY.kickMinutes` (`IDLE_KICK_MINUTES`) and they are removed, freeing the
  slot. Older hosts drop the field and go by turning alone.

**Who may watch what** (client side, `spectateRule`): in team modes a dead
player follows only their own team and has no free camera (it would scout for
their side); a pure spectator (on no team), free-for-all modes, offline
matches, and whoever runs the match (its browser host, or a dedicated
server's admin) may follow anyone and fly the free camera. The rule is the
client's: a modified client could ignore it (casual play, as everywhere in
this design; see MULTIPLAYER_DIRECTION.md).

Not carried: a map change (`travel`) or a host handoff brings spectators back
as players (they reconnect with `hello`); they choose Spectate again.


## 16. Zipline riders (November 2026)

Ziplines (map format v25, `shared/src/sim/zipline.ts`) are movement like any
other: the host steps riders in the shared sim and clients predict their own
ride. One optional field, so `PROTOCOL_VERSION` stays 4:

- **`PlayerSnapshot.zl: [line, along, speed]`** while a player rides a
  zipline: the line (index into `mapZiplines(map.entities)`, the map's
  ziplines in entity order), metres along it from its start, and the signed
  speed along it (m/s, + toward its end), all quantised like the rest of the
  movement state (`MoveState.zip` / `zs` / `zv`). Absent when not riding.
  The receiver's own entry carries it exactly, so prediction rewinds to the
  host's ride and replays its inputs (E grabs within reach, jump or E lets
  go); others' entries use it for the trolley over the rider and the whirr.
  In deltas it is one of the optional keys (`null` when the ride ends).
  Older clients ignore it (they draw the rider where `p` says, without the
  trolley); older hosts never send it.

Grabbing, letting go and being knocked off (a hit of `ZIP.knockDamage` or
more) are decided by the host; nothing new goes from client to host (E and
jump are the existing `BUTTON_USE` / `BUTTON_JUMP` input bits).

## 17. Vehicle suspension and look-to-steer (November 2026)

Wheeled light vehicles with `MountDef.vehicle.suspension` (the buggy and the
gun jeep) ride a sprung body on one ray per wheel (`shared/src/sim/suspension.ts`),
stepped by the host in the shared sim like the rest of the vehicle. Riding
isn't predicted, so clients only draw it. One optional snapshot field and one
input bit, so `PROTOCOL_VERSION` stays 4:

- **`ms: number[][]`**, one entry per living vehicle with suspension:
  `[mount index, body height (cm), pitch (mrad, + nose up), roll (mrad, +
  leaning right), steering (-100..100), ...each wheel's hub offset (cm, +
  compressed)]`, all integers. Absent when there are none. It is a
  `REPEATABLE` field (sent only when it changed; parked vehicles settle and
  stop changing). Older clients ignore it and draw the body settling to the
  ground as before; with an older host the client does the same.
- **`BUTTON_STEER_LOOK` (4096)** in `PlayerInput.buttons`, held while a
  driver has look-to-steer on: the host turns the vehicle toward the
  driver's look (`yaw`) on top of `right`. Ignored on foot, in flyers and by
  older hosts (they mask unknown bits off, so the driver steers with A/D only).

## 18. Third-person aim (November 2026)

In third person the camera sits over the right shoulder (3 m back, 0.6 m
right, 0.35 m up from the eye; `shared/src/sim/thirdPerson.ts`
`thirdPersonCamera`), so the crosshair's line and the eye's line differ.
Rounds still leave from the eye (cover in front of the body protects it), but
go toward the point the crosshair is on. One input bit, so `PROTOCOL_VERSION`
stays 4:

- **`BUTTON_THIRD_PERSON` (8192)** in `PlayerInput.buttons`, held while a
  player on foot has the third-person view. The host works the aim out
  itself (`Match.aimOf` → `thirdPersonAim`): the camera from the player's
  eye and view, its centre ray against the level (`raycastWorld`) and the
  bodies the player could hit as they saw them (`targetsFor` at the input's
  `viewTick`, the same lag compensation as the shot), then the eye → that
  point direction, plus the recoil offset. No aim point or direction comes
  from the client: the bit only picks the view, so it can't steer a round
  anywhere the player couldn't aim it with the mouse, and can't move its
  origin. Ignored for riders (vehicle and gun cameras have their own aim)
  and bots. Older hosts mask the bit off (rounds go along the view from the
  eye, as before); older clients never send it.
- The client's own predicted shot (tracers, `Prediction.shotAim`) does the
  same against its level only (cosmetic: the host's hit decides).

## 19. Bot characters (November 2026)

Which looks random bots wear, and so their names (`shared/content/botNames.ts`):

- **Host command** `{ c: "bots", cast }`: `cast` is a list of bot type ids
  (`army`, `agency`, `legends`, …; `soldiers` for both of the first two; an old
  name theme id such as `pirate` is read as its type since 2026-11-19),
  `[]` for all characters, or `null` for the map's own (`MapDocument.botCast`,
  map data). The host keeps it to known ids, at most 8 (a list longer than 32
  or anything not a list is refused), like any other administrative action
  from an untrusted client. Random bots outside it change look and name at
  once, where they stand; the host's bot set keeps its own.
- **HostState** gains `cast` (the host's choice; `null`: the map's) and
  `mapCast` (the map's, `[]` for all). Older clients ignore both; older hosts
  send neither, so the pause menu shows no Bot characters row.
- Bot names and looks travel as before (the roster's `name` and `look`); the
  names themselves are chosen by the host and nothing else crosses the wire.

## 20. Weapon sets (November 2026)

What everyone spawns with and what weapon and grenade pickups hold (`shared/sim/weaponSets.ts`,
docs/WEAPON_SETS_PLAN.md):

- **Map data:** `MapDocument.weaponSet` (map format v28), the map's default set id (`military`, `scifi`, `medieval`,
  `chaos`, `mixed`); absent: Standard. An id the host's build has no set for plays Standard.
- **Rules:** `MatchRules.weaponSet`, the host's choice (absent: the map's default). It rides in `welcome` and `rules`
  messages like every rule, so clients know the set in play (they load its guns with the map).
- **Host command** `{ c: "rules", rules: { weaponSet } }`: a set id, or `null` for the map's default; any other value
  is refused. It applies at once, like `mixPickups`: pickups roll within the new set now and everyone's next life spawns
  with its loadout. **HostState** `rules.weaponSet` (the host's choice, `null`: the map's) and `mapWeaponSet` (the map's
  own). Older clients ignore both; older hosts send neither, so the pause menu shows no Weapon set row.
- Nothing new crosses the wire in play: loadouts and inventories travel as before (private state), and what a pickup
  holds is the snapshot's `pw`, as for random pickups. A life's random spawn gun (Chaos, Mixed bag) is the host's roll
  from its match seed, the slot and the life.

## 21. Between matches: the next-map vote and parties (November 2026)

docs/GAME_MODES.md, "Between matches". No hub change: everything rides on the host's existing links.

- **ClientMessage** `{ t: "vote", i }` (index into the open vote's options); anyone in the match may send it, bots
  never do. `hello` gains `party` (`/^[A-Za-z0-9]{6,12}$/`, net/party.ts). Older hosts ignore both.
- **ServerMessage** `{ t: "vote", v }`: `v` = `{ o: [{ map, name, mode }], n: [votes], left: seconds, w?: winner,
  by?: "votes" | "host" | "order" | "none" }` when it opens, on each vote, every second, and with the winner;
  `null` once over (the match replayed). Sent to anyone who joins meanwhile. Clients check it (`parseVoteState`).
  Then the usual `travel` (dedicated) or the browser host's own map change.
- **RosterEntry** `py`: a person's party tag. **HostCommand** `{ c: "rotation", vote }` and **RotationState** `vote`.
- Hosts refuse a join past the map's player cap for the mode (`reject` "match full …").
- The match holds its intermission while the vote runs (`Match.holdIntermission`), so it never restarts itself
  under the vote.


## 22. Binary snapshots (November 2026)

`shared/net/snapshotBinary.ts`. One snapshot message in an `ArrayBuffer`, for a channel that can hand a buffer over
without copying it. Measured first (docs/PERF_FLAVIUS_MEMORY_2026-11-16.md, "Snapshot format"):

- **The local match** (offline play, MapMaker TEST, the host's own page in Host game) is where snapshots cost: the
  sim worker's `postMessage` structured-cloned every snapshot into new objects on the page, 1.2 MB of garbage a
  second at 64 players. **This is the only place the binary message is used.**
- **Networked play is unchanged**, byte for byte: `PROTOCOL_VERSION` stays 5, `hello` and `welcome` gain nothing,
  hosts (a browser's Host game, the Host Service, a dedicated server) send friends the delta JSON of
  `net/interest.ts`, deflated (`net/peerZip.ts`, or the WebSocket's own compression). That is 580 B a snapshot at 64
  players; the binary message, which has no deltas, would deflate to 1,077 B on the same link. So an old client on a
  new host, a new client on an old host and any hub between them (the hub never sees gameplay messages: section 1)
  speak exactly what they spoke before.

**Negotiation (page ⇄ its match worker).** The page's `start` message says `snap: <version>` when it reads binary
snapshots of that version (`ToSimHost`, `game/matchHost.ts`). The match host sends this player's snapshots as
`{ k: "snap", b: ArrayBuffer }` (the buffer in the transfer list) only when `snap` is the version it writes;
otherwise as `{ k: "local", msg }` objects, as always. Every pairing works:

| Page | Match worker | Snapshots |
|---|---|---|
| says `snap: 2` | writes 2 | binary |
| says nothing (older, or `?perfoff=snapbin`) | writes 2 | objects |
| says `snap: 2` | older (doesn't know `snap`) | objects |
| says `snap: 1` (a page from before version 2) | writes 2 | objects |
| says `snap: N` | writes another version | objects |
| a match on the page's own thread (`?sim=main`, no workers) | | objects, by reference (no message at all) |

Two more fallbacks, both to objects and both for the rest of the match: the encoder meets a snapshot it can't carry
exactly (below) and the host stops writing binary; or the page can't read a buffer (another version, damaged), drops
it and says `{ k: "snapobjects" }`. Read buffers go back four at a time (`{ k: "snapbufs", bufs }`, transferred) and
are written again; the page keeps no view of a buffer it has handed back.

**Versions.** The version is raised once per change of layout; page and worker are built together, so a reader
takes its own version only and refuses the rest, and a writer writes only when the page asked for its version.

| Version | |
|---|---|
| 1 | the first layout (November 2026) |
| 2 | two more player bits: 32 `zm` (aiming through a magnified optic, section 23) and 64 `dw` (dual wielding, a pair is drawn: section 24; reserved with this version, written since dual wielding step 2 with no change of version). No byte added: both go in the record's bits byte. A version 1 record is a valid version 2 record with neither bit |
| 3 | slide and peek (section 26): player bit 128 `sd` (sliding), and mask bit 256 `ln` (the lean in steps, an i8 after `zl`). A version 2 record is a valid version 3 record with neither; a version 2 reader refuses both (bit 128 and mask bit 256 were unknown to it), and the page and worker are built together |

**Layout** (little-endian; version 3). Every message is whole in itself: nothing depends on an earlier one.

| Bytes | |
|---|---|
| 0-3 | magic `54 54 53 4E` ("TTSN") |
| 4-5 | version (u16): 3. A reader takes only versions it knows; anything else is refused before another byte is read |
| 6-7 | flags (u16): bit 0, the snapshot has `hold` |
| 8-11 | the message's length in bytes (u32; the buffer may be longer: buffers are pooled). At most 4 MiB |
| 12-15, 16-19 | `tick`, `ack` (u32) |
| 20-27 | `timeLeft` (f64) |
| 28-31 | `phase` (u32: 0 waiting, 1 countdown, 2 playing, 3 intermission) |
| then | the bot states' strings: count (u16), each a length (u8) and UTF-8 |
| then | players: count (u16), then a record each (below) |
| then | eight lists of number rows, in this order: `pr`, `np`, `mt`, `ms`, `zn`, `cv`, `ab`, `fs`. Each: row count (u16; `FFFF` = the field is absent), each row its length (u8) and that many f64 |
| then | JSON fields: count (u8), each an id (u8), a length (u32) and UTF-8 JSON text. Ids in rising order: 0 `score`, 1 `ev`, 2 `pk`, 3 `pw`, 4 `dw`, 5 `me`, 6 `sc`, 7 `md`, 8 `hold`, 9 `ld`, 10 `rl`; last, 255: an object of any fields this version has no place for |

A player's record (60 bytes, then its optional fields):

| Field | Type | |
|---|---|---|
| `s` | u8 | slot |
| bits | u8 | 1 `g`, 2 `alive`, 4 `em`, 8 `sr`, 16 `dr`, 32 `zm`, 64 `dw`, 128 `sd` |
| mask | u16 | which optional fields follow: 1 `vx`, 2 `vz`, 4 `fx`, 8 `st`, 16 `sn`, 32 `cl`, 64 `ch`, 128 `zl`, 256 `ln`. Higher bits are not used: a reader refuses them |
| `p` (x, y, z), `vy`, `yaw`, `pitch` | 6 × f64 | exactly the sim's values |
| `hp`, `ar` | i16 | |
| `w` | u16 | weapon code |
| `pu` | u8, and a zero byte | |
| `vx`, `vz` | f64 each | |
| `fx` | u32 | |
| `st` | u16 | index into the message's strings |
| `sn`, `cl`, `ch` | u8 each | `sn` and `ch` are 1 or 2 |
| `zl` | 3 × f64 | |
| `ln` | i8 | lean steps, -10..10 |

**Precision: nothing is quantised.** Positions, speeds, angles, timers and every row's numbers travel as the sim's
own 64-bit floats (a `-0` stays a `-0`); integers go in integer fields only after the encoder has checked they fit.
A transferred buffer costs no bandwidth, so rounding would buy nothing and would have to be argued for against
prediction (which reconciles against the player's own entry, exactly), interpolation and hit feedback: with
bit-identical values they behave as before by construction. The fields that travel as JSON text (`score`, `ev`,
`pk`, `pw`, `dw`, `me`, `sc`, `md`, `hold`, `ld`, `rl`) read back as JSON reads them (a `-0` becomes `0`), which is
how every networked player has always received them. (The network's own rounding, players to the centimetre in
delta snapshots, is unchanged and is not this format's.)

**The encoder refuses rather than approximates.** A player entry with a field the record doesn't have, an integer
out of its field's range, a row of a length the list doesn't allow, a row holding something that isn't a number: the
snapshot is not encoded and goes as objects, and so do all after it. A new *top-level* field needs no fallback: it
travels in the extras object (id 255) until it is given a place. Adding a field to the snapshot message or to
`PlayerSnapshot` without listing it in `snapshotBinary.ts` fails the type check (`SNAPSHOT_KEYS_COVERED`,
`SNAPSHOT_PLAYER_KEYS_COVERED`), and `shared/test/snapshotBinary.test.ts` round-trips every snapshot of bot matches
on five maps in seven modes and checks every listed field was exercised.

**The decoder trusts nothing** (docs/MULTIPLAYER_SECURITY.md): the length field is checked against the buffer and
the 4 MiB cap; every count is checked against the bytes left before a loop runs or anything is made, so nothing is
allocated beyond a small multiple of the message's own size; string indices, bit and mask values, `sn`/`ch`, row
lengths, field order, the required lists and trailing bytes are checked; bad UTF-8 or JSON is caught. Anything wrong
gives `null` and a reason; `decode` never throws (fuzzed in the test: noise, every truncation, every byte changed).
The JSON fields' contents are trusted as far as the JSON a host sends over the network is: their shapes are the
session's to live with, as before.

**What the page gets.** The same snapshot message as before, in objects it partly reuses: players (and the
projectile and NPC rows) come from a ring of 72 snapshots' worth, longer than the two seconds the interpolation
buffer keeps (61), and a snapshot merged away before delivery (`SnapshotCoalescer`) takes no place in it; a player
entry has every field as an own property (absent ones `undefined`), so entries can be refilled. Rows of vehicles,
zones, cover, ammo boxes and squads, and the `score`, `pk`, `pw`, `dw`, `hold` and `ld` lists, are the *same
arrays* as in the previous snapshot while they haven't changed. Readers must not write into a snapshot (none does).
Events, private state (`me`), scenario and mode state are new objects every time.

**A later version** changes the version number; a reader of an earlier version refuses it and the page falls back to objects
as above. If the binary message is ever put on a network link, it must be offered the same way (the receiver says
which version it reads, in `hello`; the sender uses it only then) and would need deltas of its own to beat the
JSON deltas.


## 23. Scoped players (November 2026)

Two optional public fields on `PlayerSnapshot`, beside `sr`, `em`, `dr` and the rest; `PROTOCOL_VERSION` stays 5
(an older client ignores a field it does not know; an older host never sends them).

- **`PlayerSnapshot.zm: 1`**: the player is aiming through a magnified optic and the scope picture is up. Written by
  the match (`sim/match.ts` `scopeUp`) from state it already keeps, for people and bots alike; nothing in the match
  reads it. Set when all of these hold, absent otherwise:
  - the held gun's optic is a magnified kind (`content/optics.json`: a kind with `mag`, so the 2-3x optic and the
    sniper scope: Battle Rifle, Marksman Rifle, Sniper Rifle, Railgun); not iron sights, a red dot or a holographic
    sight;
  - the aim button (`BUTTON_ZOOM`) is held in the last input the host took from the player;
  - the gun's aim (`GunState.ads`, 0 at the hip to 1 fully up) is at least 0.5 (`SCOPE_UP_ADS`): the line the match
    already draws between a no-scope shot and a scoped one, 6 ticks (0.1 s) after the button with the usual 12-tick
    aim. It falls with the button, at once (the scope picture cuts out when the aim is let go);
  - the gun is ready (raised, not reloading: the client shows no scope picture otherwise) and the player is alive
    and not in a seat that takes their hands (a driver, a seat with a gun, the plane).
- **`PlayerSnapshot.dw: 1`**: dual wielding, a pair is drawn (section 24).

Both are in the delta snapshots' optional keys (`net/interest.ts` `OPTIONAL_KEYS`): a delta names the field when it
is set (`"zm":1`) and when it goes away (`"zm":null`), and not in between, so a player who stops aiming is cleared
on every receiver and a match where nobody is scoped sends not one byte more than before
(`shared/test/scopedBit.test.ts`). In the binary snapshot of the local match they are bits 32 and 64 of the player
record (section 22, version 2).

**What reads it.** The sniper glint (docs/GUNPLAY_SPEC.md section 15): a client draws a glint at a player only with
`zm` and a sniper-kind optic in their hands. **An older host** sends no `zm`, and nothing it does send (`welcome`
has no build or capability list; `protocol` is 5 on both sides of this change) tells it from a host on which nobody
is scoped, so on such a host nobody glints: the earlier guess from the held weapon and the bot's state was dropped
rather than kept for hosts that cannot be recognised (a missing glint is better than a wrong one).

## 24. Dual wielding (November 2026)

docs/GUNPLAY_SPEC.md, "Akimbo / Dual Wield". **Optional fields only; `PROTOCOL_VERSION` stays 5 and
`SNAPSHOT_BINARY_VERSION` stays 2.** An older client ignores them (it sees every player with one gun; holding a pair itself it cannot
aim, and its second gun fires only from its second-trigger key, which sends `BUTTON_ALT`); an older host never sends
them and never makes a pair. A
match sends none of them unless dual wielding is in play in it and someone holds a second gun
(`packages/shared/test/akimbo.test.ts`: with it off, the same inputs leave no trace of any of these).

| Field | Where | |
|---|---|---|
| `dw: 1` | `PlayerSnapshot` (public) | A pair is drawn: the player is alive, the weapon in hand (`w`) has its second gun and it is out (not put away with the fire-mode key), and they are not in a seat that takes the hands. Absent otherwise. In the delta snapshots' optional keys (`net/interest.ts`: named when set, `null` when it goes, not in between); bit 64 of the player record in the binary snapshot (section 22) |
| `ow: [code, magazine, flags?][]` | `PrivateState` (`me`) | The second guns the player holds, in weapon-code order: the second gun's magazine (the reserve is the weapon's one, in `inv`). `flags` is left out when 0: 1 = a magazine is in but no round chambered (as `uc` for the first gun), 2 = put away (one gun in hand). Absent without a second gun |
| `rl2`, `rd2: [kind, inputs, total, stage]` | `PrivateState` | The second gun's reload, as `rl` and `rd` are the first's; both absent when it has none. One hand reloads at a time: a run at 0 inputs beside a first-gun reload under way (or the other way round) is waiting its turn (`gunplay.ts` `pairReloadTurn`) |
| `off: 1` | the `shot` event | The second gun of a pair fired it (absent: the gun the player held). Not `alt`: it is the weapon's own trigger |

No new input bit. The second gun's trigger is the existing `BUTTON_ALT` (a pair-eligible weapon has no second trigger
of its own: the content check refuses it), and `PlayerInput.fireMode` (the fire mode wanted, an index: `sim/inputs.ts`)
is 1 for "one gun" and anything else for "the pair" while the held weapon has a second gun (such a weapon has no fire
modes: also refused by the content check). A host with dual wielding in play drops `BUTTON_ZOOM` from the input of a
player with a pair in hand, and `BUTTON_SPRINT` with `BUTTON_ALT`, before it moves them; prediction does the same.

`me` goes whole with every snapshot, so `ow`, `rl2` and `rd2` are gone the snapshot after their cause. Host handoff's
checkpoint does not carry second guns: after a handoff a pair is one gun again.

## 25. Switch team (November 2026)

Owner, 2026-11-17 ("a"). **Optional fields only; `PROTOCOL_VERSION` stays 5.** The host decides; every host runs
the same `Match.switchTeam` (`sim/match.ts`): the dedicated server and Host Service (`server/src/server.ts`), a
browser host and offline matches (`game/matchHost.ts`).

| Field | Where | |
|---|---|---|
| `ts: 1` | `welcome` | The host takes `team` messages. Absent from older hosts: the client offers no Switch team |
| `{ t: 'team', i? }` | `ClientMessage` | Switch to team `i` (index into the match's teams, 0-7; absent: the next one round; -1: call off a waiting switch) at the sender's next spawn. An older host ignores it |
| `tm` | `PrivateState` (`me`) | The team (index) the player moves to at their next spawn, while that waits |
| `msg` event with `s` | events | The host's answer, for the sender only: "Switching to Blue when you next respawn", "Staying on Red", "Wait 6 s to switch team again", "Blue has more players: switching would leave the teams uneven", "You're on Blue now" |

The rules (`Match.switchTeam`): team modes only, people only (not a bot playing an away player's place); the move is
made at the player's next spawn (a death they take as usual, or the next round in Elimination, Bomb and Hostage, where
the dead wait for it) and counts no death; asking again, or for your own team, calls it off; 10 s between asks
(`TEAM_SWITCH_COOLDOWN_SECONDS`); a team's leader (Leaders) can't. It is refused when the teams, counted with every
switch still waiting and against their sizes (uneven team sizes), would be further apart than one player (or than
they are now), unless a random bot on the team joined can move the other way: that bot moves at its own next spawn.
Team Deathmatch's score keeps the kills a player made for the team they left (`teamBank`). The roster goes to everyone
again when a switch takes effect (`Match.teamMoved`). Host handoff's checkpoint carries no waiting switch.

## 26. Slide and peek (November 2026)

docs/GUNPLAY_SPEC.md section 27, "Slide and peek". **`PROTOCOL_VERSION` stays 5**: two input bits an older host masks
off and optional fields an older client ignores. **`SNAPSHOT_BINARY_VERSION` 2 → 3** (the local match's binary player
record gains the slide bit and the lean byte: section 22).

| Field | Where | |
|---|---|---|
| `BUTTON_LEAN_LEFT` 65536, `BUTTON_LEAN_RIGHT` 131072 | `PlayerInput.buttons` | Held. An older host's `sanitizeInput` masks them off (no lean). The slide needs no bit: it is a sprint, then `BUTTON_CROUCH` |
| `sd: 1` | `PlayerSnapshot` (public) | Sliding. Absent otherwise. In the delta snapshots' optional keys (`net/interest.ts`: named when set, `null` when it goes); bit 128 of the binary record |
| `ln: n` | `PlayerSnapshot` (public) | Leaning, in steps (-10 full left .. 10 full right); absent upright, dead or seated. Optional key in the deltas; mask bit 256 (an i8) in the binary record. Receivers blend it between snapshots (`game/interpolation.ts`) |
| `mv: [slide ticks, cooldown ticks]` | `PrivateState` (`me`) | A slide under way and the stamina moves' cooldown, for prediction; absent when both are 0 |

Prediction also takes the sprint back from `sr` on a correction (a slide starts from a sprint the tick before), the
lean from `ln`, and replays them as the host steps them. **An older client** on a new host sees nobody lean or slide
(it draws a sliding player crouched and moving fast) and is never sent a lean of its own (it cannot press the keys);
a new client on an older host leans and slides only in its own prediction until the host's snapshot puts it back.

## 27. Optic choice (November 2026)

docs/GUNPLAY_SPEC.md section 15, "Optic choice". **Optional fields and one new message; `PROTOCOL_VERSION` stays 5 and
`SNAPSHOT_BINARY_VERSION` stays 3.** A player's choice is a small map, weapon ID → optic kind (`content/optics.json`
kinds: `irons`, `reddot`, `holo`, `x2`, ...), naming only guns that are not on their default; an empty or absent map is
"every gun its default".

| Field | Where | |
|---|---|---|
| `op: { [weapon]: kind }` | `hello` | The joining player's choices. Shape only at the door (`net/clientMessages.ts`: a plain object of at most 64 short IDs; anything else leaves `op` out, so the player joins on the defaults) |
| `{ t: 'optics', op }` | `ClientMessage` | The choices changed mid-match (pause menu → Settings → Optic): the whole map again (`{}`: all defaults). An older host ignores it |
| `op: { [weapon]: kind }` | `RosterEntry` | A person's choices as the host keeps them, for every client to draw. Absent for bots, for people on all defaults, and from older hosts |

The host makes the map valid (`Match.setOptics`, `sim/opticChoice.ts` `cleanOpticChoices`: guns that have that kind
among their `allowed`, not their default; unknown guns and kinds dropped) and keeps it on the player (a spectator's
too, for when they play again). When it changes, the host sends the roster to everyone again (the dedicated server and
Host Service, `server/src/server.ts`; a browser host and offline matches, `game/matchHost.ts`). Bots never have one:
they carry each gun's default.

The match reads it for one thing: **`PlayerSnapshot.zm`** (section 23) is set for a magnified optic in hand, which now
includes the 2x optic a player picked (`sim/opticChoice.ts` `magnifiedOptic`). Nothing about a shot depends on it.

**Older peers.** An older host ignores `op` and the `optics` message and sends no `op` in the roster: everyone, you
included in others' eyes, carries each gun's default, while your own first-person gun still shows your pick (drawn from
your own loadout) and `zm` is not set for your 2x. An older client ignores the roster's `op` and draws everyone's
defaults. Host handoff's checkpoint carries no choices: after a handoff the next host has them again only from each
player's `hello` when they rejoin (the new host's own from its loadout).

