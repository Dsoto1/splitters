#!/usr/bin/env bash
# Local dry run of the box's update path (infra/tiletrigger-update.sh), no AWS, no GitHub:
#
#   infra/test/update-dry-run.sh            (after pnpm install; uses packages/client/dist if built, else a tiny site)
#
# It makes a throwaway origin with five commits on top of HEAD (A: HEAD, B: client-only, C: hub change,
# D: client-only, E: a hub that crashes), packages a site for each exactly as CI does
# (tools/ci/client-release.sh package), serves them as "GitHub Releases" over local HTTP, and runs the
# updater against a temporary /opt layout with a stand-in systemctl that runs the real hub. Checks:
# first install, no-op, client-only update without a hub restart, hub restart on hub changes, --auto,
# SHA-256 mismatch refused, missing attestation refused, unsafe tarball refused, missing build refused
# (no on-box build), failed health check rolled back, --rollback, --release, --channel stable, pruning.
# Optional: TT_TEST_BUILD_HERE=1 also builds a site on the "box" (--build-here). TT_TEST_COSIGN=<cosign binary> TT_TEST_TRUSTED_ROOT=<trusted_root.json> TT_TEST_BUNDLE=<a real
# Sigstore bundle of something else> also checks that cosign refuses a forged attestation.
# shellcheck disable=SC2016,SC2034 # each check is a string eval'd by check(), with the variables it names
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/tt-update-dry-run.XXXXXX")"
HUB_PORT="${HUB_PORT:-18181}" WEB_PORT="${WEB_PORT:-18282}"
echo "work dir: $T"

# ------------------------------------------------------------------ setup
git clone -q --bare "$ROOT" "$T/origin.git"
git clone -q "$T/origin.git" "$T/dev"
cd "$T/dev" || exit 1
git config user.email dry-run@example.com; git config user.name dry-run
commit() { git add -A; git commit -q -m "$1"; git rev-parse HEAD; }
A=$(git rev-parse HEAD)
echo b > docs/DRY_RUN_B.md; B=$(commit "B: client-only change")
echo "// dry run: hub change" >> packages/server/src/hub.ts; C=$(commit "C: hub change")
echo d > docs/DRY_RUN_D.md; D=$(commit "D: client-only change")
sed -i '1i throw new Error("dry run: broken hub");' packages/server/src/hub.ts; E=$(commit "E: broken hub")
git push -q origin HEAD:main

DIST="$ROOT/packages/client/dist"
if [ ! -f "$DIST/index.html" ]; then
  DIST="$T/tiny-dist"; mkdir -p "$DIST/assets"
  echo '<!doctype html><html><body><script type="module" src="/assets/index-dry.js"></script></body></html>' > "$DIST/index.html"
  echo 'console.log("dry run")' > "$DIST/assets/index-dry.js"
  echo "(no packages/client/dist: packaging a tiny site)"
fi
W="$T/www"; mkdir -p "$W/download/main-latest" "$W/download/v0.0.1" "$W/latest/download" "$T/out"
for n in A B C D E; do
  sha="${!n}"; d="$T/dist-$n"
  cp -al "$DIST" "$d" 2>/dev/null || cp -a "$DIST" "$d"
  rm "$d/index.html"; sed "s#</body>#<!-- build $n --></body>#" "$DIST/index.html" > "$d/index.html"
  SHA="$sha" VITE_HUB=self "$ROOT/tools/ci/client-release.sh" package "$d" "$T/out" >/dev/null || exit 1
  rm -rf "$d"
  cp "$T/out/tiletrigger-client-$sha".* "$W/download/main-latest/"
done
cp "$T/out/tiletrigger-client-$A".* "$W/download/v0.0.1/"; cp "$T/out/tiletrigger-client-$A".* "$W/latest/download/"
cp "$T/out/tiletrigger-client-$A.json" "$W/download/v0.0.1/build.json"; cp "$T/out/tiletrigger-client-$A.json" "$W/latest/download/build.json"
git clone -q "$T/origin.git" "$T/app"
mkdir -p "$T/bin"

# The stand-in for systemctl: tiletrigger-hub is the real hub, run as the box runs it.
cat > "$T/systemctl" <<SYSTEMCTL
#!/usr/bin/env bash
running() { [ -f "$T/hub.pid" ] && kill -0 "\$(cat "$T/hub.pid")" 2>/dev/null; }
case "\$1" in
  is-active) if running; then [ "\$2" = --quiet ] || echo active; exit 0; else [ "\$2" = --quiet ] || echo inactive; exit 3; fi ;;
  is-enabled) echo disabled; exit 1 ;;
  restart)
    if running; then kill "\$(cat "$T/hub.pid")"; for _ in \$(seq 1 50); do running || break; sleep 0.1; done; fi
    cd "$T/app/packages/server" || exit 1
    PORT=$HUB_PORT HOST=127.0.0.1 TRUST_PROXY=1 NODE_ENV=production SITE_DIR="$T/site/current/site" \\
      nohup node --import tsx src/hub.ts >> "$T/hub.log" 2>&1 &
    echo \$! > "$T/hub.pid"
    echo RESTART >> "$T/systemctl.log"
    ;;
esac
SYSTEMCTL
chmod +x "$T/systemctl"

export TT_CONF=/nonexistent TT_APP="$T/app" TT_SITE_ROOT="$T/site" TT_REPO="$T/origin.git" TT_SLUG=Dsoto1/splitters \
  TT_RELEASE_BASE="http://127.0.0.1:$WEB_PORT" TT_HEALTH_URL="http://127.0.0.1:$HUB_PORT" TT_APP_USER='' \
  TT_SYSTEMCTL="$T/systemctl" TT_PNPM=pnpm TT_PROVENANCE=off TT_UPDATER_BIN="$T/bin/tiletrigger-update" \
  TT_HEALTH_TIMEOUT=25 TT_COSIGN_DIR="$T/cosign"
UPD="$ROOT/infra/tiletrigger-update.sh"
(cd "$W" && exec python3 -m http.server "$WEB_PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
WEB=$!
stop() { kill "$WEB" 2>/dev/null; [ -f "$T/hub.pid" ] && kill "$(cat "$T/hub.pid")" 2>/dev/null; }
trap stop EXIT
sleep 1

# ------------------------------------------------------------------ checks
PASS=0 FAIL=0
check() { if eval "$2"; then PASS=$((PASS + 1)); echo "  PASS $1"; else FAIL=$((FAIL + 1)); echo "  FAIL $1"; fi; }
cur() { basename "$(readlink "$T/site/current" 2>/dev/null)" 2>/dev/null; }
restarts() { grep -c '^RESTART' "$T/systemctl.log" 2>/dev/null || echo 0; }
served() { curl -fsS "http://127.0.0.1:$HUB_PORT/" 2>/dev/null | grep -o '<!-- build [A-E] -->' | cut -c12; }
pointer() { cp "$T/out/tiletrigger-client-$1.json" "$W/download/main-latest/build.json"; }
run() { echo "\$ tiletrigger-update $*"; "$UPD" "$@" 2>&1 | grep -v 'UNDICI\|trace-warnings' | sed 's/^/    /'; return "${PIPESTATUS[0]}"; }

echo "== first install (--sha A, hub not running)"
run --sha "$A"; rc=$?
check "installed A, hub started, serves A" '[ $rc = 0 ] && [ "$(cur)" = "$A" ] && [ "$(restarts)" = 1 ] && [ "$(served)" = A ]'
check "production dependencies only" '[ -e "$T/app/packages/server/node_modules/tsx" ] && [ ! -e "$T/app/node_modules/vitest" ] && [ ! -e "$T/app/node_modules/playwright" ]'
check "updater installed from the checkout" '[ -x "$T/bin/tiletrigger-update" ]'
run --sha "$A"; rc=$?
check "same build again: no-op" '[ $rc = 0 ] && [ "$(restarts)" = 1 ]'

echo "== main -> B (client-only): no hub restart"
pointer "$B"; pid=$(cat "$T/hub.pid"); run; rc=$?
check "on B, same hub process serves B" '[ $rc = 0 ] && [ "$(cur)" = "$B" ] && [ "$(restarts)" = 1 ] && [ "$(cat "$T/hub.pid")" = "$pid" ] && [ "$(served)" = B ]'
out=$("$UPD" --auto 2>&1); rc=$?
check "--auto with nothing new is silent" '[ $rc = 0 ] && [ -z "$out" ]'

echo "== --auto -> C (hub code changed): restart"
pointer "$C"; run --auto; rc=$?
check "on C, hub restarted, serves C" '[ $rc = 0 ] && [ "$(cur)" = "$C" ] && [ "$(restarts)" = 2 ] && [ "$(served)" = C ]'

echo "== refusals (all leave C running)"
mv "$W/download/main-latest/tiletrigger-client-$D.tar.gz" "$T/D.tar.gz"
{ cat "$T/D.tar.gz"; printf x; } > "$W/download/main-latest/tiletrigger-client-$D.tar.gz"
pointer "$D"; run; rc=$?
check "SHA-256 mismatch refused" '[ $rc = 1 ] && [ "$(cur)" = "$C" ] && [ ! -d "$T/site/releases/$D" ] && [ "$(git -C "$T/app" rev-parse HEAD)" = "$C" ]'
mv -f "$T/D.tar.gz" "$W/download/main-latest/tiletrigger-client-$D.tar.gz"
TT_PROVENANCE=required run; rc=$?
check "no attestation: refused" '[ $rc = 1 ] && [ "$(cur)" = "$C" ]'
if [ -n "${TT_TEST_COSIGN:-}" ]; then
  mkdir -p "$T/cosign"; cp "$TT_TEST_COSIGN" "$T/cosign/cosign-v3.0.2"
  cp "$TT_TEST_BUNDLE" "$W/download/main-latest/tiletrigger-client-$D.sigstore.json"
  TT_PROVENANCE=required TT_SIGSTORE_TRUSTED_ROOT="$TT_TEST_TRUSTED_ROOT" run; rc=$?
  check "forged attestation: refused by cosign" '[ $rc = 1 ] && [ "$(cur)" = "$C" ]'
  rm -f "$W/download/main-latest/tiletrigger-client-$D.sigstore.json"
fi
mkdir -p "$T/evil" "$W/download/v6.6.6"; echo '<p>x</p>' > "$T/evil/index.html"; ln -s /etc/passwd "$T/evil/passwd"
(cd "$T/dev" && SHA="$D" "$ROOT/tools/ci/client-release.sh" package "$T/evil" "$W/download/v6.6.6" >/dev/null)
cp "$W/download/v6.6.6/tiletrigger-client-$D.json" "$W/download/v6.6.6/build.json"
run --release v6.6.6; rc=$?
check "tarball with a symlink refused" '[ $rc = 1 ] && [ "$(cur)" = "$C" ]'
nosha=$(git -C "$T/dev" rev-parse "$A~1" 2>/dev/null || echo 0000000000000000000000000000000000000000)
out=$("$UPD" --sha "$nosha" 2>&1); rc=$?; echo "$out" | sed 's/^/    /'
check "no CI build: refused, points at --build-here, no build" '[ $rc = 1 ] && grep -q -- --build-here <<<"$out" && [ "$(cur)" = "$C" ]'

echo "== D (client-only), then E (crashing hub): health check fails, automatic rollback"
pointer "$D"; run
check "on D without a restart" '[ "$(cur)" = "$D" ] && [ "$(restarts)" = 2 ]'
pointer "$E"; run; rc=$?
check "E failed: link and code back on D, hub restarted twice, serves D" '[ $rc = 1 ] && [ "$(cur)" = "$D" ] && [ "$(git -C "$T/app" rev-parse HEAD)" = "$D" ] && [ "$(restarts)" = 4 ] && [ "$(served)" = D ]'
out=$("$UPD" --auto 2>&1); rc=$?
check "--auto doesn't retry E" '[ $rc = 0 ] && [ -z "$out" ] && [ "$(cur)" = "$D" ]'

echo "== --rollback"
run --rollback; rc=$?
check "D -> C, no restart (same hub code)" '[ $rc = 0 ] && [ "$(cur)" = "$C" ] && [ "$(served)" = C ] && [ "$(restarts)" = 4 ]'
run --rollback; rc=$?
check "C -> B (D was rolled back from), hub restarted (older hub code)" '[ $rc = 0 ] && [ "$(cur)" = "$B" ] && [ "$(served)" = B ] && [ "$(restarts)" = 5 ]'

echo "== releases"
run --release v0.0.1; rc=$?
check "--release v0.0.1 = A" '[ $rc = 0 ] && [ "$(cur)" = "$A" ] && [ "$(served)" = A ]'
pointer "$C"; run; run --channel stable; rc=$?
check "--channel stable = A" '[ $rc = 0 ] && [ "$(cur)" = "$A" ]'
if [ "${TT_TEST_BUILD_HERE:-}" = 1 ]; then
  echo "== --build-here (TT_TEST_BUILD_HERE=1: a real vite build, a few minutes)"
  run --sha "$B" --build-here --force; rc=$?
  check "built B on the box, serves it, back to production dependencies" '[ $rc = 0 ] && [ "$(cur)" = "$B" ] && [ "$(served)" = "" ] && grep -q builtOnBox "$T/site/releases/$B/build.json" && [ ! -e "$T/app/node_modules/vitest" ]'
fi
check "at most 3 builds kept" '[ "$(find "$T/site/releases" -mindepth 1 -maxdepth 1 -type d | wc -l)" -le 3 ]'
"$UPD" --status | sed 's/^/    /'

echo
echo "passed $PASS, failed $FAIL"
stop
[ "$FAIL" = 0 ] && rm -rf "$T"
[ "$FAIL" = 0 ]
