# Crash and error reports

The owner, 2026-11-19 ("A" on the lead's list of gaps): "when a player's game breaks, a small 'Something went wrong —
send report' posts the error, the build and the map to the hub (no personal data; stays inside the $30 guard)."
Built 2026-11-24.

## What the player sees

When the game breaks, a small dark card in the bottom right corner: **Something went wrong**, one line on what a
report holds, **What is sent** (opens to show the exact report), **Dismiss** and **Send report**. Nothing is sent
unless the player presses Send; after Send it says "Sent. Thank you." (or why not) and closes itself.

Calm by design (Reduce flashing, docs/LOOK.md): no red, no flash, no motion; the game's own greys and blue.

What counts as a break (`packages/client/src/crashReport.ts`, filtered in `crashPanel.ts breakOf`):
- an uncaught error in the game's own scripts (another origin's script, such as a browser extension, and the
  browser's opaque "Script error." are left out);
- an unhandled promise rejection (a fetch or sound the browser stopped on purpose, `AbortError`, `NotAllowedError`,
  `TimeoutError`, is left out);
- a WebGL context lost and not back after 20 s while the page is on screen (one the browser restores isn't a break).

Not watched yet: a frozen game loop. The panel knows the kind (`freeze`), but the menu's first JS had 1 kB left
(`tools/ci/bundle-budget.mjs`), so the frame-gap watch was left out; it is a few lines in `main.ts frame()` once there
is room.

Each break (by signature) is offered once a session, one panel at a time, three in all. Only the listener is in the
menu's first JS (0.6 kB); the panel and the scrubbing load on the first break. Browser tests (`?test=1`) keep it off
unless the page asks with `&crashpanel=1` (the `crashreport` flow). With no hub, nothing is offered.

## What a report holds (`packages/shared/src/net/crashReport.ts`)

| Field | What |
|---|---|
| `kind` | `error`, `rejection`, `webgl` (`freeze` reserved) |
| `message`, `stack` | the error's text, scrubbed (below), 300 and 4000 characters at most |
| `version`, `sha` | the client's version (the menu's) and the commit it was built from |
| `map`, `mode` | in a match only: a suite map's ID, or `custom` for any other map (a player's own, a community map), and the mode |
| `screen` | `menu`, `game`, `editor` (and `designer` from builds before the Character Designer was removed, 2026-11-25) |
| `quality` | the graphics quality (`low`, `medium`, `high`) |
| `browser`, `os` | the browser family and major version (`Chrome 131`) and the OS family (`Windows`): nothing finer |
| `at` | the time, to the minute |
| `sig` | the signature: the kind, the message with numbers taken out, the first three frames' files and functions (no line numbers, no bundle hashes), FNV-1a |

**Scrubbing**, on the player's machine before it is shown, and again on the hub: URLs and file paths cut to the file
name with its line and column (`https://…/assets/session-Bx9z.js:120:44` → `session-Bx9z.js:120:44`), extension URLs to
`[extension]`, `data:` URLs to `[data]`, emails to `[email]`, IPv4 and IPv6 addresses to `[ip]`, UUIDs (account IDs) to
`[id]`, runs of 32+ token-like characters (JWTs, keys) to `[token]`, and the player's own name and clan tag (the name
shown on the menu, a signed-in username too) to `[name]`.

**Never sent:** the player's name, account ID or email, anything derived from their address, chat, a map's contents or
name. At most 8 KB (`CRASH_REPORT_MAX_BYTES`): the stack is trimmed first, then the message.

## On the hub (`packages/server/src/reports.ts`)

- `POST /api/v1/reports`: anyone; JSON, at most 8 KB (413 past it); checked field by field (`cleanCrashReport`: known
  fields only, types and shapes, scrubbed again, the signature recomputed); 3 a minute per address (in memory only:
  no address is written anywhere) and at most 300 a day in all (503 after). The hub adds the minute it arrived.
- Kept in `REPORTS_DIR` (default: `reports` beside `PROFILES_DIR`, so `/var/lib/tiletrigger/reports` on the box with
  no new setting), one JSON line per report in that day's file (`2026-11-24.jsonl`); files older than 30 days are
  deleted. Worst case 300 × 8 KB × 30 days ≈ 72 MB on the box's disk; nothing new on AWS, no new cost. Reports are
  not in the nightly backup (it keeps `profiles/`, `community/` and `maps/` only), which is fine for 30-day notes.
- `GET /api/v1/reports?days=7[&format=text]`: the owner only (a signed-in account in `OWNER_SUBS`, as for publishing
  maps): the reports grouped by signature, most frequent first, each with its count, first and last time, the builds,
  maps and browsers it was seen on, and the newest report in full.

## For the owner: reading them

On the box (Lightsail console → **Connect**):

```
cd /opt/tiletrigger/packages/server
sudo -u tiletrigger node --import tsx src/tools/crash-reports.ts /var/lib/tiletrigger/reports              # the last 7 days
sudo -u tiletrigger node --import tsx src/tools/crash-reports.ts /var/lib/tiletrigger/reports --days=30    # all that is kept
sudo -u tiletrigger node --import tsx src/tools/crash-reports.ts /var/lib/tiletrigger/reports --json       # as JSON
```

(The same Node and loader the hub runs with; on a machine with the repository, `pnpm --filter @tiletrigger/server
crash-reports <folder>`.) It only reads. Or from any machine signed in as the
owner: `GET https://trigger.toshiroplay.com/api/v1/reports?days=7&format=text` with the access token as
`Authorization: Bearer …`.

## Deploying it

Nothing changes in AWS. Once it is on `main` and CI has published the build: Lightsail console → **Connect** →
`sudo tiletrigger-update`. The hub's code changed, so the hub restarts once (players reconnect within one 20 s
check-in; running matches carry on). The folder is made on the first report.

## Tests

`packages/shared/test/crashReport.test.ts` (scrubbing, size cap, signature, the user agent, the hub's check),
`packages/server/test/reports.test.ts` (the endpoint: validation, size, rate limit, daily cap, owner-only reading,
pruning), `packages/client/test/crashPanel.test.ts` (the report built from a break, which breaks count, once per
signature); e2e `crashreport` (a break shows the calm panel, what it would send is scrubbed, Send reaches a real hub
that keeps it, the same break isn't offered twice, Dismiss sends nothing).
