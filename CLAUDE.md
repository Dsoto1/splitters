# Tile Trigger: notes for Claude sessions

## Git workflow
- Work on the session branch; no pull requests unless asked.
- Before pushing, run the checks: `pnpm typecheck`, `pnpm test:changed` (vitest on what changed vs origin/main) and `pnpm e2e:changed` (after `pnpm build`: the e2e flows `e2e/flowMap.mjs` maps your changed files to; one flow by hand: `E2E_ONLY=<flow> node e2e/run.mjs`). Agents use these two rather than picking tests by hand.
- CI on a check branch runs only what the change needs (`pnpm ci:plan` shows it; unmapped paths run everything, docs nothing) and a push to `main` already green on a check branch isn't re-run; nightly, `v*` tags and Run workflow run everything. E2E: `?test=1` for determinism, wait on conditions (no new `waitForTimeout`), screenshot baselines via `pnpm e2e:baselines`.
- The full suite runs on GitHub, not locally: push a merge candidate to a `check/<name>` branch (`git push origin HEAD:check/<name>`); CI (unit tests, build, the e2e shards the change needs) runs there. Fast-forward `main` only to a commit that went green on a check branch.
- Push the session branch, then fast-forward `main` to it: `git push origin HEAD:main`. CI runs on every push to `main`; if it goes red, fix forward on `main` the same way.
- Agents: run at most 2–3 at a time; commit at every milestone (a restart loses uncommitted work); run only the tests and e2e flows your change touches.
- Releases: semantic versions (see CHANGELOG.md). When main is fast-forwarded to a release, bump `packages/client/package.json` (shown on the menu), add a CHANGELOG entry, and tag `vX.Y.Z` on that green commit (`git push origin vX.Y.Z`). Minor for features, patch for fixes; 1.0.0 is the public launch.
- If `main` has moved, rebase the session branch onto `origin/main` first.

## Gunplay
- Before changing weapons, recoil, ballistics, damage, TTK or weapon animation, read `docs/GUNPLAY_SPEC.md` (technical design) and `docs/GUNPLAY_DIRECTION.md` (the feel it's tuned for: arcade responsiveness + ballistic depth + modern polish; responsiveness > realism, fun > simulation).

## Multiplayer and hosting
- Before changing networking, the hub, hosting, TURN, AWS infrastructure or map publishing, read `docs/MULTIPLAYER_DIRECTION.md` (the owner's direction: AWS coordinates, player machines compute; no uploads; maps are declarative data; small recurring cost).
- Identity: the owner's shared ToshiroPlay Cognito user pool (also used by their Flavius game) with Google sign-in, through a separate "trigger" app client; the hub verifies Cognito tokens against the pool's public keys (no client secret in the site).

## Content rules
- No in-game AI generation: players can't make content through an AI service or connector, and can't upload assets.
- Models we generate ourselves on the owner's Meshy subscription are fine to ship (record them in content provenance as Meshy, owned).
- Otherwise only CC0, credit-only human-made, or approved Quaternius packs; never commit raw pack files.
- Official and featured servers carry only maps built from our own suite. Community-hosted servers may run community maps (declarative data, in-house assets only), shown with a clear "Community map" label.
