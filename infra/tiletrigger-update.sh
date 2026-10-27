#!/usr/bin/env bash
# Tile Trigger box updater, installed as /usr/local/bin/tiletrigger-update by infra/host-setup.sh.
# The box never builds the site: it downloads the build CI produced for the exact commit, checks it, and
# switches to it in seconds. The hub runs from source (git) at the same commit.
#
#   sudo tiletrigger-update                    latest green build of main (release main-latest)
#   sudo tiletrigger-update --release v0.3.0   a release
#   sudo tiletrigger-update --channel stable   the newest release (vX.Y.Z)
#   sudo tiletrigger-update --sha <commit>     a commit CI published (main-latest, or check-builds)
#   sudo tiletrigger-update --branch check/x   the head of a check branch (its green CI build; testing)
#   sudo tiletrigger-update --rollback         back to the build before this one (kept on disk: instant)
#   sudo tiletrigger-update --status           what runs now, what is kept, the timer
#   tiletrigger-update --auto                  for the timer: update when main-latest names a new commit
#
#   --build-here    no CI build: build the site on this box (slow: ~5 min at full CPU and ~1.5 GB of memory on
#                   the 2 GB box; it drains the CPU burst credits). Never done without this flag.
#   --force         install even when it is already the current build (or one rolled back from)
#   --no-provenance skip the build-provenance check (emergencies only; the SHA-256 check still runs)
#
# Each update: resolve the commit → download tiletrigger-client-<sha>.tar.gz, its .sha256 and its
# .sigstore.json → check the SHA-256 sums and the Sigstore build-provenance attestation (made by this
# repository's CI workflow on main, a v* tag or, with --branch, a check/** branch, for this commit) →
# unpack into releases/<sha>/site → git reset the hub's code to <sha> (production dependencies only when
# they changed) → switch the `current` link → restart the hub only if its code changed → health check
# (hub, page, an asset) → on failure, switch the link and the code back. The last KEEP builds stay on disk.
# Settings: /etc/tiletrigger-update.conf (written by host-setup.sh); TT_* variables override (tests).
set -euo pipefail
umask 022

CONF="${TT_CONF:-/etc/tiletrigger-update.conf}"
# shellcheck disable=SC1090
[ -r "$CONF" ] && . "$CONF"
APP="${TT_APP:-${APP:-/opt/tiletrigger}}"
SITE_ROOT="${TT_SITE_ROOT:-${SITE_ROOT:-/opt/tiletrigger-site}}"
REPO="${TT_REPO:-${REPO:-https://github.com/Dsoto1/splitters.git}}"
SLUG="${TT_SLUG:-${SLUG:-$(sed -E 's#^(https://|git@)github\.com[:/]##; s#\.git$##' <<<"$REPO")}}"
RELEASE_BASE="${TT_RELEASE_BASE:-${RELEASE_BASE:-https://github.com/$SLUG/releases}}"
AUTO_CHANNEL="${TT_AUTO_CHANNEL:-${AUTO_CHANNEL:-main}}"
HEALTH_URL="${TT_HEALTH_URL:-${HEALTH_URL:-http://127.0.0.1:8080}}"
HEALTH_TIMEOUT="${TT_HEALTH_TIMEOUT:-${HEALTH_TIMEOUT:-45}}"
KEEP="${TT_KEEP:-${KEEP:-3}}"
APP_USER="${TT_APP_USER-${APP_USER-tiletrigger}}"
HUB_SERVICE="${TT_HUB_SERVICE:-${HUB_SERVICE:-tiletrigger-hub}}"
SYSTEMCTL="${TT_SYSTEMCTL:-${SYSTEMCTL:-systemctl}}"
PNPM="${TT_PNPM:-${PNPM:-corepack pnpm}}"
PROVENANCE="${TT_PROVENANCE:-${PROVENANCE:-required}}"
COSIGN_DIR="${TT_COSIGN_DIR:-${COSIGN_DIR:-/usr/local/lib/tiletrigger}}"
SIGSTORE_TRUSTED_ROOT="${TT_SIGSTORE_TRUSTED_ROOT:-${SIGSTORE_TRUSTED_ROOT:-}}"
UPDATER_BIN="${TT_UPDATER_BIN:-${UPDATER_BIN:-/usr/local/bin/tiletrigger-update}}"
# cosign (Sigstore's verifier), pinned: version and the SHA-256 of its release binary per architecture.
COSIGN_VERSION=v3.0.2
cosign_sha256() {
  case "$1" in
    amd64) echo 46dbdcb5467a3dfec2526923d0b3365e40c8d9dc00ec23d5aca3437449e8cbfd ;;
    arm64) echo 17fd784737ca54d7d8a343c82da6c5d6dbdee971e66644d923d1b057fb97d7ed ;;
  esac
}
# What the hub runs (a change here restarts it) and what its dependencies are installed from.
HUB_PATHS=(packages/server packages/shared maps package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc)
DEP_FILES=(package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc packages/server/package.json packages/shared/package.json)

STATE="$SITE_ROOT/state"
RELEASES="$SITE_ROOT/releases"
CURRENT="$SITE_ROOT/current"

say() { printf '== %s\n' "$*"; }
note() { printf '   %s\n' "$*"; }
die() { printf 'tiletrigger-update: %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,26p' "$0"; exit "${1:-0}"; }

MODE=channel CHANNEL='' RELEASE='' WANT_SHA='' BRANCH='' BUILD_HERE=0 FORCE=0 AUTO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --channel) CHANNEL="${2:?}"; MODE=channel; shift ;;
    --release) RELEASE="${2:?}"; MODE=release; shift ;;
    --sha|--ref) WANT_SHA="${2:?}"; MODE=sha; shift ;;
    --branch) BRANCH="${2:?}"; MODE=branch; shift ;;
    --rollback) MODE=rollback; if [[ "${2:-}" =~ ^[0-9a-f]{7,40}$ ]]; then WANT_SHA="$2"; shift; fi ;;
    --status) MODE=status ;;
    --auto) AUTO=1; MODE=channel; CHANNEL="$AUTO_CHANNEL" ;;
    --build-here) BUILD_HERE=1 ;;
    --force) FORCE=1 ;;
    --no-provenance) PROVENANCE=off ;;
    -h|--help) usage 0 ;;
    *) printf 'unknown option %s\n\n' "$1" >&2; usage 2 ;;
  esac
  shift
done
CHANNEL="${CHANNEL:-main}"
case "$CHANNEL" in main|stable) ;; *) die "--channel must be main or stable" ;; esac
[ -z "$RELEASE" ] || [[ "$RELEASE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || die "--release takes a version tag (vX.Y.Z)"
[ -z "$BRANCH" ] || [[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "bad branch name"
case "$PROVENANCE" in required|off) ;; *) die "PROVENANCE must be required or off" ;; esac

# ------------------------------------------------------------------ helpers
as_app() { # run a command as the hub's user (owner of the checkout), in the checkout
  if [ -n "$APP_USER" ] && [ "$(id -un)" != "$APP_USER" ]; then
    # shellcheck disable=SC2016 # expanded by that shell
    sudo -u "$APP_USER" -H env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 sh -c 'cd "$0" && exec "$@"' "$APP" "$@"
  else
    (cd "$APP" && env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 "$@")
  fi
}
git_app() { as_app git -C "$APP" "$@"; }
pnpm_app() { local p; read -ra p <<<"$PNPM"; as_app "${p[@]}" --dir "$APP" "$@"; }

curl_get() { # url out: the release host is HTTPS (redirects too); a plain-http base is the local dry run
  local proto=(--proto '=https' --proto-redir '=https')
  case "$RELEASE_BASE" in http://*) proto=() ;; esac
  curl -fsSL "${proto[@]}" --retry 3 --retry-delay 2 --connect-timeout 10 --max-time 900 --max-filesize 1073741824 -o "$2" "$1"
}
asset_url() { # release name
  if [ "$1" = latest ]; then echo "$RELEASE_BASE/latest/download/$2"; else echo "$RELEASE_BASE/download/$1/$2"; fi
}
json_get() { python3 -I -c 'import json,sys; v=json.load(open(sys.argv[1])).get(sys.argv[2]); print("" if v is None else v)' "$1" "$2"; }

current_sha() { if [ -L "$CURRENT" ]; then basename "$(readlink "$CURRENT")"; fi; }
deps_hash() {
  local f
  for f in "${DEP_FILES[@]}"; do
    echo "== $f"
    if [ -f "$APP/$f" ]; then cat "$APP/$f"; fi
  done | sha256sum | cut -d' ' -f1
}

health() { # sha: the hub answers, serves this build's page, and one of its scripts
  local dir="$RELEASES/$1/site" deadline=$((SECONDS + HEALTH_TIMEOUT)) page asset
  page="$(mktemp)"
  asset="$(grep -o 'src="/assets/[^"]*\.js"' "$dir/index.html" | head -1 | sed 's/^src="//; s/"$//')" || true
  while :; do
    if curl -fsS --max-time 5 "$HEALTH_URL/lobby/health" >/dev/null 2>&1 \
      && curl -fsS --max-time 10 -o "$page" "$HEALTH_URL/" 2>/dev/null && cmp -s "$page" "$dir/index.html" \
      && { [ -z "$asset" ] || curl -fsS --max-time 10 -o /dev/null "$HEALTH_URL$asset" 2>/dev/null; }; then
      rm -f "$page"; return 0
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then rm -f "$page"; return 1; fi
    sleep 1
  done
}

hub_active() { "$SYSTEMCTL" is-active --quiet "$HUB_SERVICE"; }
restart_hub() { "$SYSTEMCTL" restart "$HUB_SERVICE" 9>&-; echo "$1" > "$STATE/hub.sha"; } # (the lock stays with this run)

hub_code_changed() { # new sha: does the hub's code differ from what it runs now?
  local running; running="$(cat "$STATE/hub.sha" 2>/dev/null || true)"
  [ -n "$running" ] || return 0
  [ "$running" = "$1" ] && return 1
  ! git_app diff --quiet "$running" "$1" -- "${HUB_PATHS[@]}" 2>/dev/null
}

install_deps() { # production dependencies of the hub, only when they changed (or the last install was a full one)
  local want; want="prod $(deps_hash)"
  if [ "$(cat "$STATE/deps" 2>/dev/null || true)" = "$want" ] && [ -d "$APP/node_modules" ]; then return 0; fi
  if [ "$(cut -d' ' -f1 "$STATE/deps" 2>/dev/null || true)" != prod ]; then
    # Left over from a full install (on-box builds): start clean so only what the hub needs stays.
    as_app rm -rf "$APP/node_modules" "$APP/packages/server/node_modules" "$APP/packages/shared/node_modules" "$APP/packages/client/node_modules"
  fi
  note "installing the hub's production dependencies"
  pnpm_app install --frozen-lockfile --prod --filter '@tiletrigger/server...' --reporter=silent
  echo "$want" > "$STATE/deps"
}

fetch_commit() { # sha [branch]: make the commit present in the checkout
  git_app cat-file -e "$1^{commit}" 2>/dev/null && return 0
  git_app fetch -q origin "$1" 2>/dev/null && git_app cat-file -e "$1^{commit}" 2>/dev/null && return 0
  git_app fetch -q origin main ${2:+"$2"} --tags 2>/dev/null || true
  git_app cat-file -e "$1^{commit}" 2>/dev/null || die "commit $1 is not in $REPO"
}

ensure_cosign() {
  local arch bin want
  case "$(uname -m)" in x86_64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) die "no pinned cosign for $(uname -m)" ;; esac
  bin="$COSIGN_DIR/cosign-$COSIGN_VERSION"
  want="$(cosign_sha256 "$arch")"
  if [ -x "$bin" ] && [ "$(sha256sum "$bin" | cut -d' ' -f1)" = "$want" ]; then COSIGN="$bin"; return 0; fi
  note "installing cosign $COSIGN_VERSION (Sigstore's verifier)"
  mkdir -p "$COSIGN_DIR"
  curl -fsSL --proto '=https' --proto-redir '=https' --retry 3 -o "$bin.part" \
    "https://github.com/sigstore/cosign/releases/download/$COSIGN_VERSION/cosign-linux-$arch"
  [ "$(sha256sum "$bin.part" | cut -d' ' -f1)" = "$want" ] || { rm -f "$bin.part"; die "cosign download doesn't match its pinned SHA-256"; }
  chmod 755 "$bin.part" && mv "$bin.part" "$bin"
  COSIGN="$bin"
}

verify_provenance() { # dir sha: the attestation was made by this repository's CI, for this commit, on an allowed ref
  local dir="$1" sha="$2" name="tiletrigger-client-$2" refs='heads/main|tags/v[0-9]+\.[0-9]+\.[0-9]+.*'
  [ "$MODE" = branch ] || [ "${3:-}" = check ] && refs="$refs|heads/check/.+"
  [ -s "$dir/$name.sigstore.json" ] || die "no build-provenance attestation for $sha ($name.sigstore.json): refusing it (--no-provenance to skip, emergencies only)"
  ensure_cosign
  local slug_re="${SLUG//./\\.}"
  local args=(verify-blob-attestation --new-bundle-format --bundle "$dir/$name.sigstore.json" --type slsaprovenance1
    --certificate-oidc-issuer https://token.actions.githubusercontent.com
    --certificate-identity-regexp "^https://github\\.com/$slug_re/\\.github/workflows/ci\\.yml@refs/($refs)\$"
    --certificate-github-workflow-repository "$SLUG" --certificate-github-workflow-sha "$sha")
  [ -n "$SIGSTORE_TRUSTED_ROOT" ] && args+=(--trusted-root "$SIGSTORE_TRUSTED_ROOT")
  # cosign keeps Sigstore's trust root (TUF) here, not in a home folder.
  if ! TUF_ROOT="$STATE/sigstore" HOME="$STATE" "$COSIGN" "${args[@]}" "$dir/$name.tar.gz" >"$dir/cosign.log" 2>&1; then
    sed 's/^/   cosign: /' "$dir/cosign.log" >&2
    die "build-provenance check failed for $sha: refusing it"
  fi
  note "provenance: built by $SLUG's CI workflow for commit ${sha:0:12} (Sigstore attestation verified)"
}

download_build() { # sha release(s)...: fetch and check into $STAGE; prints nothing on a missing build
  local sha="$1" name="tiletrigger-client-$1" from='' rel
  shift
  for rel in "$@"; do
    if curl_get "$(asset_url "$rel" "$name.sha256")" "$STAGE/$name.sha256" 2>/dev/null; then from="$rel"; break; fi
  done
  [ -n "$from" ] || return 1
  note "downloading $name.tar.gz (release $from)"
  curl_get "$(asset_url "$from" "$name.tar.gz")" "$STAGE/$name.tar.gz"
  curl_get "$(asset_url "$from" "$name.json")" "$STAGE/$name.json"
  curl_get "$(asset_url "$from" "$name.sigstore.json")" "$STAGE/$name.sigstore.json" 2>/dev/null || rm -f "$STAGE/$name.sigstore.json"
  # Only the two expected names, each with a 64-hex sum.
  grep -Evq "^[0-9a-f]{64}  $name\.(tar\.gz|json)\$" "$STAGE/$name.sha256" && die "unexpected lines in $name.sha256"
  [ "$(wc -l < "$STAGE/$name.sha256")" = 2 ] || die "$name.sha256 should list the tarball and build.json"
  (cd "$STAGE" && sha256sum --quiet --strict -c "$name.sha256") || die "SHA-256 mismatch for $name: refusing it (download corrupted or tampered with)"
  note "SHA-256 sums match"
  [ "$(json_get "$STAGE/$name.json" sha)" = "$sha" ] || die "$name.json is for another commit"
  if [ "$PROVENANCE" = required ]; then verify_provenance "$STAGE" "$sha" "$( [ "$from" = check-builds ] && echo check )"
  else note "WARNING: build-provenance check skipped (--no-provenance)"; fi
  # A site is files and folders only, all inside it.
  tar -tvzf "$STAGE/$name.tar.gz" > "$STAGE/types"
  tar -tzf "$STAGE/$name.tar.gz" > "$STAGE/names"
  if cut -c1 "$STAGE/types" | grep -qv '^[-d]$'; then die "$name.tar.gz holds links or special files: refusing it"; fi
  if grep -Eq '^/|(^|/)\.\.(/|$)' "$STAGE/names"; then die "$name.tar.gz has paths outside the site: refusing it"; fi
  mkdir -p "$STAGE/site"
  tar -xzf "$STAGE/$name.tar.gz" -C "$STAGE/site" --no-same-owner --no-same-permissions
  [ -f "$STAGE/site/index.html" ] || die "$name.tar.gz has no index.html"
  cp "$STAGE/$name.json" "$STAGE/build.json"
  rm -f "$STAGE/$name.tar.gz"
}

build_here() { # sha: the slow path, by request only
  local mem; mem="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)"
  say "Building the site on this box (--build-here): several minutes at full CPU, ~1.5 GB of memory (${mem} MB here)"
  git_app reset -q --hard "$1"
  pnpm_app install --frozen-lockfile --reporter=silent
  echo "full" > "$STATE/deps"
  local p; read -ra p <<<"$PNPM"
  as_app env VITE_HUB=self NODE_OPTIONS=--max-old-space-size=3072 "${p[@]}" --dir "$APP" build
  mkdir -p "$STAGE/site"
  cp -a "$APP/packages/client/dist/." "$STAGE/site/"
  printf '{"name":"tiletrigger-client","sha":"%s","builtOnBox":true,"builtAt":"%s"}\n' "$1" "$(date -u +%FT%TZ)" > "$STAGE/build.json"
}

no_build() { # sha where
  cat >&2 <<MSG
tiletrigger-update: no CI build of $1 is published ($2).
  The box doesn't build the site by itself (on a 2 GB box that takes ~5 minutes at full CPU and drains the
  CPU burst credits). Either:
    - wait for CI to go green and publish it (main: release main-latest; a check/** branch: check-builds),
    - deploy a build that exists: tiletrigger-update (latest main), --release vX.Y.Z, --rollback, or
    - build it here on purpose: tiletrigger-update ... --build-here
MSG
  exit 1
}

switch_to() { # sha: point `current` at releases/<sha> (atomic rename of a new link)
  ln -sfn "releases/$1" "$SITE_ROOT/current.new"
  mv -T "$SITE_ROOT/current.new" "$CURRENT"
}

prune() { # keep the KEEP most recently installed builds (and always the current one)
  local cur keep_list sha n=0
  cur="$(current_sha)"
  keep_list="$(tac "$STATE/history" 2>/dev/null | awk '{print $2}' | awk '!s[$0]++')"
  for sha in $keep_list; do
    [ -d "$RELEASES/$sha" ] || continue
    n=$((n + 1))
    if [ "$n" -gt "$KEEP" ] && [ "$sha" != "$cur" ]; then rm -rf "${RELEASES:?}/$sha"; note "removed old build ${sha:0:12}"; fi
  done
  # Builds no longer in the history, and unfinished downloads.
  for d in "$RELEASES"/*; do
    [ -d "$d" ] || continue
    sha="$(basename "$d")"
    grep -q " $sha " "$STATE/history" 2>/dev/null || [ "$sha" = "$cur" ] || rm -rf "$d"
  done
  rm -rf "$SITE_ROOT"/.stage-*
}

self_update() { # the updater from the checkout (takes effect on the next run)
  local src="$APP/infra/tiletrigger-update.sh"
  [ -f "$src" ] && [ -w "$(dirname "$UPDATER_BIN")" ] || return 0
  cmp -s "$src" "$UPDATER_BIN" 2>/dev/null && return 0
  install -m 755 "$src" "$UPDATER_BIN.new" && mv -f "$UPDATER_BIN.new" "$UPDATER_BIN" && note "updater updated from the checkout (next run)"
}

status() {
  local cur; cur="$(current_sha)"
  echo "site:     ${cur:-none}  $( [ -n "$cur" ] && python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("version","?"), d.get("commitTime",""), "built on the box" if d.get("builtOnBox") else "CI build")' "$RELEASES/$cur/build.json" 2>/dev/null )"
  echo "hub code: $(cat "$STATE/hub.sha" 2>/dev/null || echo unknown)  ($("$SYSTEMCTL" is-active "$HUB_SERVICE" 2>/dev/null || true))"
  echo "checkout: $(git_app log -1 --format='%H %s' 2>/dev/null || echo none)"
  echo "kept:"
  for d in "$RELEASES"/*; do [ -d "$d" ] && echo "  $(basename "$d")$( [ -e "$d/withdrawn" ] && echo ' (rolled back from)')"; done
  echo "history (newest last):"; tail -n 5 "$STATE/history" 2>/dev/null | sed 's/^/  /'
  local timer; timer="$("$SYSTEMCTL" is-enabled tiletrigger-update.timer 2>/dev/null || true)"
  echo "auto-update timer: ${timer:-not installed} (systemctl enable --now tiletrigger-update.timer to turn it on)"
}

# ------------------------------------------------------------------ main
mkdir -p "$STATE" "$RELEASES"
[ "$MODE" = status ] && { status; exit 0; }
exec 9>"$STATE/lock"
flock -n 9 || die "another update is running"

CUR="$(current_sha)"
SOURCE=''
SHA=''
case "$MODE" in
  rollback)
    if [ -n "$WANT_SHA" ]; then
      for d in "$RELEASES"/"$WANT_SHA"*; do [ -d "$d" ] && SHA="$(basename "$d")" && break; done
      [ -n "$SHA" ] || die "no kept build starts with $WANT_SHA (see --status)"
    else
      # The most recently installed build before this one that's still on disk and wasn't rolled back from.
      SHA="$(tac "$STATE/history" 2>/dev/null | awk '{print $2}' | awk '!s[$0]++' | while read -r s; do
        [ "$s" != "$CUR" ] && [ -d "$RELEASES/$s/site" ] && [ ! -e "$RELEASES/$s/withdrawn" ] && { echo "$s"; break; }; done)"
      [ -n "$SHA" ] || die "no earlier build kept on this box (see --status)"
    fi
    SOURCE=rollback
    ;;
  channel|release)
    if [ "$MODE" = release ]; then REL="$RELEASE"; elif [ "$CHANNEL" = stable ]; then REL=latest; else REL=main-latest; fi
    PTR="$(mktemp)"
    curl_get "$(asset_url "$REL" build.json)" "$PTR" 2>/dev/null || { rm -f "$PTR"; die "no build.json in release $REL at $RELEASE_BASE (nothing published yet?)"; }
    SHA="$(json_get "$PTR" sha)"; rm -f "$PTR"
    SOURCE="$REL"
    ;;
  sha)
    if [[ "$WANT_SHA" =~ ^[0-9a-f]{40}$ ]]; then SHA="$WANT_SHA"
    else SHA="$(git_app rev-parse --verify -q "$WANT_SHA^{commit}" 2>/dev/null || true)"; fi
    [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || die "--sha takes a full commit SHA (or one this checkout knows)"
    SOURCE=sha
    ;;
  branch)
    SHA="$(git_app ls-remote origin "refs/heads/$BRANCH" | cut -f1)"
    [ -n "$SHA" ] || die "no branch $BRANCH in $REPO"
    SOURCE="branch $BRANCH"
    ;;
esac
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || die "could not tell which commit to install (got '$SHA')"

if [ "$SHA" = "$CUR" ] && [ "$FORCE" = 0 ]; then
  [ "$AUTO" = 1 ] || say "Already on ${SHA:0:12} ($SOURCE): nothing to do (--force to reinstall)"
  exit 0
fi
if [ "$AUTO" = 1 ] && [ -e "$RELEASES/$SHA/withdrawn" ] && [ "$FORCE" = 0 ]; then
  exit 0 # rolled back from on purpose: wait for a newer build
fi
[ "$AUTO" = 1 ] && say "New build on $CHANNEL: ${SHA:0:12}"
say "Installing ${SHA:0:12} ($SOURCE)"

# 1. The site build: kept on disk (rollback), downloaded and checked, or built here on request.
STAGE=''
if [ "$MODE" != rollback ] && { [ ! -f "$RELEASES/$SHA/site/index.html" ] || [ "$FORCE" = 1 ]; }; then
  STAGE="$(mktemp -d "$SITE_ROOT/.stage-XXXXXX")"
  chmod 755 "$STAGE"
  trap 'rm -rf "$STAGE"' EXIT
  if [ "$BUILD_HERE" = 1 ]; then
    fetch_commit "$SHA" "${BRANCH:-}"
    build_here "$SHA"
  else
    case "$MODE" in
      release) rels=("$RELEASE") ;;
      channel) rels=("$REL") ;;
      branch) rels=(check-builds) ;;
      *) rels=(main-latest check-builds) ;;
    esac
    download_build "$SHA" "${rels[@]}" || no_build "$SHA" "looked in: ${rels[*]} at $RELEASE_BASE"
  fi
  rm -rf "${RELEASES:?}/$SHA"
  mkdir -p "$RELEASES/$SHA"
  mv "$STAGE/site" "$RELEASES/$SHA/site"
  mv "$STAGE/build.json" "$RELEASES/$SHA/build.json"
fi
[ -f "$RELEASES/$SHA/site/index.html" ] || die "build ${SHA:0:12} is not on this box"
rm -f "$RELEASES/$SHA/withdrawn"

# 2. The hub's code at the same commit (and its production dependencies when they changed).
OLD_CODE="$(git_app rev-parse HEAD 2>/dev/null || true)"
fetch_commit "$SHA" "${BRANCH:-}"
git_app reset -q --hard "$SHA"
install_deps
RESTART=0 WHY=''
if ! hub_active; then RESTART=1 WHY="hub not running: starting it"
elif hub_code_changed "$SHA"; then RESTART=1 WHY="hub code changed: restarting the hub"; fi

# 3. Switch, restart the hub only if its code changed, check.
switch_to "$SHA"
if [ "$RESTART" = 1 ]; then note "$WHY"; restart_hub "$SHA"
else note "hub code unchanged: no restart (the hub serves the new build at once)"; echo "$SHA" > "$STATE/hub.sha"; fi

if health "$SHA"; then
  printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$SHA" "${SOURCE// /:}" >> "$STATE/history"
  [ -n "$CUR" ] && [ "$MODE" = rollback ] && touch "$RELEASES/$CUR/withdrawn"
  say "Tile Trigger now runs ${SHA:0:12}: $(git_app log -1 --format='%s' 2>/dev/null | cut -c1-80)"
  prune
  self_update
  exit 0
fi

# 4. Failed: the build before, as it was.
printf 'tiletrigger-update: health check failed for %s (hub %s/lobby/health, the page, an asset): rolling back\n' "${SHA:0:12}" "$HEALTH_URL" >&2
touch "$RELEASES/$SHA/withdrawn"
if [ -n "$CUR" ] && [ -d "$RELEASES/$CUR/site" ]; then
  switch_to "$CUR"
  if [ -n "$OLD_CODE" ]; then git_app reset -q --hard "$OLD_CODE"; install_deps; fi
  if [ "$RESTART" = 1 ] || hub_code_changed "${OLD_CODE:-$CUR}" || ! hub_active; then restart_hub "${OLD_CODE:-$CUR}"; fi
  if health "$CUR"; then say "Rolled back to ${CUR:0:12}; it is healthy. Logs: journalctl -u $HUB_SERVICE -n 80"
  else say "Rolled back to ${CUR:0:12}, but it doesn't answer either. Logs: journalctl -u $HUB_SERVICE -n 80"; fi
else
  say "No earlier build to go back to. Logs: journalctl -u $HUB_SERVICE -n 80"
fi
exit 1
