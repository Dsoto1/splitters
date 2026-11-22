# Process tools

The owner's process improvements of 2026-11-18 ("a" to all). The rules themselves are in CLAUDE.md, "Git workflow"; this page says how each tool works.

## HANDOFF stays short

HANDOFF.md keeps the current state: the notes for each lane, live claims, the "Checking" lines and the last couple of days of Landed notes and owner answers. History (older Landed notes, finished claims, old owner-answer blocks, the earlier sessions' "Start here" sections) moves to `docs/history/handoff-<YYYY-MM>.md`, every line kept. Move a block there once its work has landed and it is more than about two days old; the slimming is a docs-only commit straight to `main`.

## Which branches are ready: `train.mjs --ready`

```
node tools/ci/train.mjs --ready                      
node tools/ci/train.mjs --ready --run --holder "<session>"
```

It reads QUEUE's "Ready to land" entries (`` `branch` · sha · run ``) from origin/main's copy, and confirms each from GitHub with the same `gh api` access `--land` uses:

- the entry's run is for that sha, completed and successful;
- it is still the latest push run on its check branch (a newer run for another commit means check again);
- the branch on origin is still at that sha, or has only docs (`*.md`) commits on top;
- the sha isn't on main yet (if it is, the entry is stale: take it off the list).

Each entry prints `LANDABLE` or `NOT YET` with the reason, then the landable branches in list order. `--run` starts a train on exactly those (taking the landing lock, as any train; `--no-push` builds the candidate only).

## Trains resolve notes-only conflicts

When a branch's merge into the train's candidate conflicts only in HANDOFF.md and docs/QUEUE.md, the train resolves it (tools/ci/docMerge.mjs): for each conflicting hunk it keeps the candidate's side and adds the lines the branch added there, unless the candidate already has them. That holds when the branch only added lines in that hunk. If the branch changed or removed a line there, it isn't a simple union: the train stops as before, naming the branch and the files, and says the notes need a hand merge. A conflict in any other file stops it as always. Tested in tools/ci/test/docMerge.test.mjs and the scratch-repository train test.

## e2e in parallel worktrees

`e2e/run.mjs` serves and opens everything on `http://127.0.0.1` (the preview with `--host 127.0.0.1`). Off CI, every port it would use (the preview, the game server, each flow's hub, Host Service control and peer ports) is a free one picked at start, unless its variable is set: `E2E_CLIENT_PORT`, `E2E_SERVER_PORT`, `E2E_HUB_PORT`, `E2E_PEER_PORT`, `E2E_PARTY_HUB_PORT`, `E2E_COMMUNITY_HUB_PORT`, `E2E_DEDICATED_HUB_PORT`, `E2E_DEDICATED_CONTROL_PORT`, `E2E_HOSTPAGE_HUB_PORT`, `E2E_HOSTPAGE_CONTROL_PORT`. On CI (`CI` set) the fixed ports stay as they were. `CHROMIUM=/path/to/chrome` (or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`) launches that browser instead of Playwright's own, so a local run needs no temporary copy.

## Disk clean-up: `tools/dev/cleanup.mjs`

```
node tools/dev/cleanup.mjs            # lists, removes nothing
node tools/dev/cleanup.mjs --yes      # removes, prints the space freed
node tools/dev/cleanup.mjs --min-age 6
```

A worktree is removed only when it isn't the main checkout, the one you're in, or locked; `git status` is empty (no changes, no untracked files); its commit is in origin/main or on a branch on origin; and its index and HEAD haven't changed for `--min-age` hours (default 2), since another session may be working in it. Removal is `git worktree remove` without `--force`, so git refuses anything unclean too. In idle worktrees that stay, build output goes (`dist/`, `.vite/`, `e2e-artifacts/`, `host-release/`: ignored, rebuilt). Then the temp directory's `node-compile-cache` and `tsx-*` caches.

## The daily flake list: `tools/ci/flakes.mjs`

```
node tools/ci/flakes.mjs              # last 7 days; writes docs/FLAKES.md
node tools/ci/flakes.mjs --days 2 --print
```

It reads recent CI runs through `gh api` and counts each check that failed and then passed on the same code:

- **retry**: an e2e flow failed and passed on its own retry in the same job (`E2E_RETRIES=1`; the shard's `e2e-flaky-<i>` artifact and its log's `FLOW x FLAKY` line);
- **re-run**: a job failed in one attempt of a run and a later attempt of that run succeeded;
- **same sha**: a run failed and another run for the same commit succeeded.

A failed job is named by its log: its e2e flows (`FLOW x FAIL`), else its unit tests (vitest's `FAIL file > test`), else the job. [docs/FLAKES.md](FLAKES.md) lists them most frequent first, with how they flaked, the last run seen and its first failed check. Lane A runs it each day and works the top of the list in its fix batch.

## Performance lines for map steps (owner, 2026-11-22)

- Outdoor and campus-wide views: a step that costs more than 10 % in draws or shadow casters against the same view
  before it does not land until it is brought back.
- Inside a single room: no percentage against the empty room; a fixed ceiling of 250 draws a view at Medium.
- Whole map: the tracked totals (prop models, lights, entities) against their budgets.
