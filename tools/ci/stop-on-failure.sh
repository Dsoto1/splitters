#!/usr/bin/env bash
# Fail fast across a CI run: runs the given command, and stops it (exit 1) as soon as another job of this run has
# failed, so a red run doesn't keep 20 runners busy for minutes. The job then fails too, so the run's conclusion
# stays "failure" (cancelling the run instead would read "cancelled"). Polls the run's jobs every STOP_POLL_S
# seconds (default 40) with GITHUB_TOKEN (actions: read); API errors are ignored (the command just runs on).
#   tools/ci/stop-on-failure.sh pnpm e2e
# Outside GitHub Actions (no GITHUB_RUN_ID) it just runs the command.
set -u
if [ -z "${GITHUB_RUN_ID:-}" ] || [ -z "${GH_TOKEN:-}" ]; then exec "$@"; fi
poll="${STOP_POLL_S:-40}"
failed_job() {
  local out
  # Only a good answer counts (gh prints an error's body on stdout too).
  out="$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/jobs?per_page=100" --jq '.jobs[] | select(.conclusion == "failure") | .name' 2>/dev/null)" || return 0
  printf '%s\n' "$out" | head -1
}
# Already red before this job started (a job it doesn't wait for failed): don't start.
first="$(failed_job)"
if [ -n "$first" ]; then
  echo "::error title=stopped::another job of this run failed ($first): not starting"
  exit 1
fi
setsid "$@" &
pid=$!
while kill -0 "$pid" 2>/dev/null; do
  for _ in $(seq 1 "$poll"); do
    kill -0 "$pid" 2>/dev/null || break 2
    sleep 1
  done
  other="$(failed_job)"
  if [ -n "$other" ]; then
    echo "::error title=stopped::another job of this run failed ($other): stopping this one"
    kill -TERM -- "-$pid" 2>/dev/null
    sleep 5
    kill -KILL -- "-$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
    exit 1
  fi
done
wait "$pid"
