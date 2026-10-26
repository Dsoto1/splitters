# Tile Trigger: notes for Claude sessions

## Git workflow
- Work on the session branch; no pull requests unless asked.
- Before pushing, run the checks: `pnpm typecheck`, `pnpm test`, and the e2e flows the change touches (`E2E_ONLY=<flow> node e2e/run.mjs` after `pnpm build`).
- The full suite runs on GitHub, not locally: push a merge candidate to a `check/<name>` branch (`git push origin HEAD:check/<name>`); CI (unit tests, build, all 4 e2e shards) runs there. Fast-forward `main` only to a commit that went green on a check branch.
- Push the session branch, then fast-forward `main` to it: `git push origin HEAD:main`. CI runs on every push to `main`; if it goes red, fix forward on `main` the same way.
- Agents: run at most 2–3 at a time; commit at every milestone (a restart loses uncommitted work); run only the tests and e2e flows your change touches.
- If `main` has moved, rebase the session branch onto `origin/main` first.

## Content rules
- No in-game AI generation: players can't make content through an AI service or connector, and can't upload assets.
- Models we generate ourselves on the owner's Meshy subscription are fine to ship (record them in content provenance as Meshy, owned).
- Otherwise only CC0, credit-only human-made, or approved Quaternius packs; never commit raw pack files.
- Online servers carry only maps built from our own suite.
