#!/usr/bin/env bash
# The deployable site build: packaged once in CI, published to GitHub Releases, downloaded and verified by the
# Lightsail box (infra/tiletrigger-update.sh), which never builds it itself. docs/HOSTING.md, "Updates".
#
#   tools/ci/client-release.sh package <dist dir> <out dir>
#       A reproducible tarball of the built site (sorted names, fixed owner and modes, file times = the commit's
#       time, gzip without a name or time) and its metadata, all named after the commit:
#         tiletrigger-client-<sha>.tar.gz   the site (contents of packages/client/dist)
#         tiletrigger-client-<sha>.json     build.json: sha, version, times, Node/pnpm versions, CI run
#         tiletrigger-client-<sha>.sha256   SHA256SUMS of the two (sha256sum format)
#       SHA (default: git HEAD) names another commit (the local dry run).
#
#   tools/ci/client-release.sh publish <out dir>
#       In CI (GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REF, GITHUB_SHA): uploads the files above plus
#       tiletrigger-client-<sha>.sigstore.json (the build-provenance attestation) to
#         refs/heads/main      the rolling prerelease `main-latest` (+ build.json and SHA256SUMS naming this commit)
#         refs/tags/vX.Y.Z     the release vX.Y.Z (notes: its CHANGELOG.md section; + build.json, SHA256SUMS)
#         refs/heads/check/*   the prerelease `check-builds` (deploy-multiplayer.sh --branch, for testing)
#       and drops the per-commit files of older commits (main-latest keeps KEEP_MAIN, check-builds KEEP_CHECK).
# shellcheck disable=SC2016 # backticks in release notes are Markdown
set -euo pipefail

die() { printf 'client-release: %s\n' "$*" >&2; exit 1; }
json_field() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))[process.argv[2]])' "$1" "$2"; }

package() {
  local dist="${1:?dist dir}" out="${2:?out dir}"
  [ -f "$dist/index.html" ] || die "$dist has no index.html (build the client first)"
  local sha="${SHA:-$(git rev-parse HEAD)}"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "not a full commit SHA: $sha"
  local epoch="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct "$sha")}"
  local name="tiletrigger-client-$sha"
  mkdir -p "$out"
  # Same files, same bytes: names sorted, owner root, modes normalised, times = the commit's.
  tar --sort=name --format=gnu --owner=0 --group=0 --numeric-owner --mode='u=rwX,go=rX' --mtime="@$epoch" \
    -C "$dist" -cf - . | gzip -9 -n > "$out/$name.tar.gz"
  local size hash files
  size="$(stat -c %s "$out/$name.tar.gz")"
  hash="$(sha256sum "$out/$name.tar.gz" | cut -d' ' -f1)"
  files="$(find "$dist" -type f | wc -l)"
  SHA_="$sha" EPOCH="$epoch" NAME="$name.tar.gz" SIZE="$size" HASH="$hash" FILES="$files" \
    VERSION="$(json_field packages/client/package.json version)" \
    PNPM_V="$(pnpm --version 2>/dev/null || echo unknown)" \
    node -e '
      const e = process.env;
      const run = e.GITHUB_RUN_ID ? `${e.GITHUB_SERVER_URL}/${e.GITHUB_REPOSITORY}/actions/runs/${e.GITHUB_RUN_ID}` : null;
      const out = {
        name: "tiletrigger-client", sha: e.SHA_, version: e.VERSION, ref: e.GITHUB_REF ?? null,
        commitTime: new Date(Number(e.EPOCH) * 1000).toISOString(), builtAt: new Date().toISOString(),
        node: process.version, pnpm: e.PNPM_V, hub: e.VITE_HUB ?? "", run,
        tarball: e.NAME, sha256: e.HASH, size: Number(e.SIZE), files: Number(e.FILES),
      };
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    ' > "$out/$name.json"
  (cd "$out" && sha256sum "$name.tar.gz" "$name.json" > "$name.sha256")
  printf 'packaged %s (%s bytes, %s files, sha256 %s)\n' "$name.tar.gz" "$size" "$files" "$hash"
}

# The per-commit names of a release's assets, newest commit first.
commits_in() {
  gh release view "$1" --json assets --jq '.assets | sort_by(.createdAt) | reverse | .[].name' \
    | sed -n 's/^tiletrigger-client-\([0-9a-f]\{40\}\)\..*$/\1/p' | awk '!seen[$0]++'
}

prune() { # release keep
  local tag="$1" keep="$2" n=0 sha name
  for sha in $(commits_in "$tag"); do
    n=$((n + 1))
    [ "$n" -le "$keep" ] && continue
    for name in $(gh release view "$tag" --json assets --jq '.assets[].name' | grep -F "tiletrigger-client-$sha."); do
      gh release delete-asset "$tag" "$name" --yes >/dev/null && echo "pruned $tag/$name"
    done
  done
}

publish() {
  local out="${1:?out dir}"
  : "${GITHUB_REPOSITORY:?}" "${GITHUB_REF:?}" "${GITHUB_SHA:?}"
  local sha="$GITHUB_SHA" name="tiletrigger-client-$GITHUB_SHA"
  local files=("$out/$name.tar.gz" "$out/$name.json" "$out/$name.sha256" "$out/$name.sigstore.json")
  for f in "${files[@]}"; do [ -s "$f" ] || die "missing $f"; done
  (cd "$out" && sha256sum --quiet -c "$name.sha256") || die "checksums don't match"
  [ "$(json_field "$out/$name.json" sha)" = "$sha" ] || die "$name.json names another commit"
  local version tag title notes prerelease=1 keep=0 rolling=1
  version="$(json_field "$out/$name.json" version)"
  notes="$(mktemp)"
  case "$GITHUB_REF" in
    refs/tags/v*)
      tag="${GITHUB_REF#refs/tags/}"
      [ "$tag" = "v$version" ] || die "tag $tag doesn't match packages/client/package.json version $version"
      title="Tile Trigger $version"; prerelease=0
      # This version's CHANGELOG section (from its heading to the next one).
      awk -v v="$version" '/^## /{p = ($2 == v); next} p' CHANGELOG.md > "$notes"
      [ -s "$notes" ] || echo "See CHANGELOG.md." > "$notes"
      ;;
    refs/heads/main)
      tag=main-latest; title="Latest main build"; keep="${KEEP_MAIN:-20}"
      printf 'The newest site build of `main` that passed CI: %s (version %s).\n\nThe Lightsail box installs it with `sudo tiletrigger-update` (docs/HOSTING.md). Rolling: `build.json` names the current commit; each commit'"'"'s files are kept for the last %s commits.\n' "$sha" "$version" "$keep" > "$notes"
      ;;
    refs/heads/check/*)
      tag=check-builds; title="Check-branch builds (testing)"; keep="${KEEP_CHECK:-8}"; rolling=0
      printf 'Site builds of `check/**` branches that passed CI, for `infra/deploy-multiplayer.sh --branch` (testing only). The last %s commits are kept.\n' "$keep" > "$notes"
      ;;
    *) die "nothing to publish for $GITHUB_REF" ;;
  esac
  local flags=()
  [ "$prerelease" = 1 ] && flags+=(--prerelease --latest=false)
  if gh release view "$tag" >/dev/null 2>&1; then
    gh release edit "$tag" --title "$title" --notes-file "$notes" >/dev/null
  else
    gh release create "$tag" --title "$title" --notes-file "$notes" --target "$sha" "${flags[@]}" >/dev/null
  fi
  # The commit's own files first; the rolling pointer last, so it never names a commit whose files aren't there.
  gh release upload "$tag" "${files[@]}" --clobber
  if [ "$rolling" = 1 ]; then
    local roll; roll="$(mktemp -d)"
    cp "$out/$name.json" "$roll/build.json"
    (cd "$out" && sha256sum "$name.tar.gz" "$name.json") > "$roll/SHA256SUMS"
    gh release upload "$tag" "$roll/SHA256SUMS" "$roll/build.json" --clobber
  fi
  # A rolling tag follows the commit it names (best effort: the release assets are what the box reads).
  if [ "$tag" = main-latest ]; then
    gh api -X PATCH "repos/$GITHUB_REPOSITORY/git/refs/tags/main-latest" -f sha="$sha" -F force=true >/dev/null 2>&1 \
      || echo "note: could not move the main-latest tag (the release assets are up to date)"
  fi
  [ "$keep" -gt 0 ] && prune "$tag" "$keep"
  echo "published $name to $tag"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    local on_box='' deploy=''
    case "$tag" in
      main-latest) ;;
      check-builds) on_box=" --sha $sha"; deploy=" --branch ${GITHUB_REF#refs/heads/}" ;;
      *) on_box=" --release $tag"; deploy=" --release $tag" ;;
    esac
    printf '### Site build published\n\n- `%s` → release `%s` (%s)\n- Deploy: `sudo tiletrigger-update%s` on the box, or `infra/deploy-multiplayer.sh%s`\n' \
      "$name.tar.gz" "$tag" "$version" "$on_box" "$deploy" >> "$GITHUB_STEP_SUMMARY"
  fi
}

case "${1:-}" in
  package) shift; package "$@" ;;
  publish) shift; publish "$@" ;;
  *) sed -n '2,21p' "$0"; exit 2 ;;
esac
