#!/usr/bin/env bash
# Registry versions are a 1.0.N counter because the registry's 1.0.x history outranks npm's 0.x versions.
# Only server.json is generated here, from the npm tarball; the rest of the repo is static.
# Local test hooks: NPM_VERSION, REGISTRY_LATEST_JSON, TARBALL, DECIDE_ONLY=1, DRY_RUN=1.
set -euo pipefail

PACKAGE=${PACKAGE:-@applitools/mcp}
SERVER_NAME=${SERVER_NAME:-io.github.applitools/applitools}
REGISTRY_URL=${REGISTRY_URL:-https://registry.modelcontextprotocol.io}
DRY_RUN=${DRY_RUN:-0}
DECIDE_ONLY=${DECIDE_ONLY:-0}

fail() { echo "::error::$*"; exit 1; }
notice() { echo "::notice::$*"; }
need() { command -v "$1" >/dev/null || fail "required command '$1' not found"; }

for cmd in jq curl npm tar git; do need "$cmd"; done

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

latest_url="$REGISTRY_URL/v0.1/servers/${SERVER_NAME//\//%2F}/versions/latest"

# Sets $latest_body; any non-200, 404 included, fails the run.
read_registry_latest() {
  local resp status
  if ! resp=$(curl -sS --connect-timeout 20 --max-time 60 -w '\n%{http_code}' "$latest_url"); then
    fail "registry request to $latest_url failed"
  fi
  status=${resp##*$'\n'}
  latest_body=${resp%$'\n'*}
  [[ $status == 200 ]] || fail "registry $latest_url returned HTTP $status"
  require_json
}

require_json() {
  jq -e . >/dev/null 2>&1 <<<"$latest_body" || fail "registry /versions/latest body is not JSON"
}

if [[ -n ${NPM_VERSION:-} ]]; then
  npm_version=$NPM_VERSION
else
  npm_version=$(npm view "$PACKAGE" dist-tags.latest) || fail "npm view $PACKAGE dist-tags.latest failed"
fi
[[ $npm_version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] \
  || fail "npm latest '$npm_version' of $PACKAGE is not a semver version"

if [[ -n ${REGISTRY_LATEST_JSON:-} ]]; then
  [[ -f $REGISTRY_LATEST_JSON ]] || fail "REGISTRY_LATEST_JSON file '$REGISTRY_LATEST_JSON' not found"
  latest_body=$(<"$REGISTRY_LATEST_JSON")
  require_json
else
  read_registry_latest
fi
latest_name=$(jq -r '.server.name' <<<"$latest_body")
latest_identifier=$(jq -r '.server.packages[0].identifier' <<<"$latest_body")
latest_version=$(jq -r '.server.version' <<<"$latest_body")
latest_pkg=$(jq -r '.server.packages[0].version' <<<"$latest_body")
[[ $latest_name == "$SERVER_NAME" && $latest_identifier == "$PACKAGE" ]] \
  || fail "registry latest is '$latest_name' with package '$latest_identifier', expected '$SERVER_NAME' with '$PACKAGE'"
# patch+1 of a prerelease or build-metadata version is ambiguous.
[[ $latest_version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] \
  || fail "registry latest '$latest_version' is not plain major.minor.patch"
major=${BASH_REMATCH[1]} minor=${BASH_REMATCH[2]} patch=${BASH_REMATCH[3]}

if [[ $latest_pkg == "$npm_version" ]]; then
  published=1
  server_version=$latest_version
else
  published=0
  server_version="$major.$minor.$((10#$patch + 1))"
fi

synced=0
if [[ -f $repo_root/server.json ]] \
  && [[ $(jq -r '.packages[0].version' "$repo_root/server.json") == "$npm_version" ]] \
  && [[ $(jq -r '.version' "$repo_root/server.json") == "$server_version" ]]; then
  synced=1
fi

echo "npm_version=$npm_version"
echo "published=$published"
echo "server_version=$server_version"
echo "synced=$synced"
if [[ $DECIDE_ONLY == 1 ]]; then exit 0; fi

if [[ $published == 1 && $synced == 1 ]]; then
  notice "$PACKAGE $npm_version is already published as $SERVER_NAME $server_version and this repo is synced"
  exit 0
fi

if [[ -n ${TARBALL:-} ]]; then
  tarball=$TARBALL
else
  npm pack "$PACKAGE@$npm_version" --pack-destination "$tmp" >/dev/null \
    || fail "npm pack $PACKAGE@$npm_version failed"
  tarball="$tmp/$(tr / - <<<"${PACKAGE#@}")-$npm_version.tgz"
  [[ -f $tarball ]] || fail "npm pack did not produce $tarball"
fi
member=package/server.json
entries=$(tar -tzf "$tarball") || fail "cannot read tarball $tarball"
count=$(grep -cE '^package/server\.json(/|$)' <<<"$entries" || true)
[[ $count != 0 ]] \
  || fail "server.json missing from $PACKAGE@$npm_version — is \"server.json\" in package.json \"files\"?"
# tar -O reads a symlink/hardlink member as empty and a directory as its children's bytes.
member_type=$(tar -tvzf "$tarball" "$member" | head -1 | cut -c1 || true)
[[ $member_type == - ]] || fail "$member in $PACKAGE@$npm_version is not a regular file (type '$member_type')"
[[ $count == 1 ]] || fail "$member appears $count times (counting entries under it) in $PACKAGE@$npm_version"

raw="$tmp/server.raw.json"
set +e
tar -xzOf "$tarball" "$member" | head -c 65537 >"$raw"
read_status=("${PIPESTATUS[@]}")
set -e
# Hitting the cap kills tar with SIGPIPE, so the size is checked before the exit statuses.
(( $(wc -c <"$raw") <= 65536 )) || fail "$member in $PACKAGE@$npm_version is over 64 KiB"
[[ ${read_status[0]} == 0 && ${read_status[1]} == 0 ]] || fail "cannot read $member from $tarball"
jq -se 'length == 1 and (.[0] | type) == "object"' "$raw" >/dev/null 2>&1 \
  || fail "$member in $PACKAGE@$npm_version is not a single JSON object"

tarball_pkg=$(jq -r '.packages[0].version' "$raw")
[[ $tarball_pkg == "$npm_version" ]] \
  || fail "tarball server.json packages[0].version is '$tarball_pkg' but npm latest is '$npm_version' — the release PR did not bump server.json (release-please extra-files)"

manifest="$tmp/server.json"
jq --arg sv "$server_version" '.version = $sv' "$raw" >"$manifest"
[[ $(jq -r '.name' "$manifest") == "$SERVER_NAME" ]] \
  || fail "server.json name is '$(jq -r '.name' "$manifest")', expected '$SERVER_NAME'"
[[ $(jq -r '.packages[0].identifier' "$manifest") == "$PACKAGE" ]] \
  || fail "server.json packages[0].identifier is '$(jq -r '.packages[0].identifier' "$manifest")', expected '$PACKAGE'"

need mcp-publisher
mcp-publisher validate "$manifest" || fail "mcp-publisher validate rejected the manifest"

if [[ $DRY_RUN == 1 ]]; then
  echo "--- patched server.json ---"
  cat "$manifest"
  if [[ $published == 1 ]]; then
    notice "dry run: $npm_version is already published as $server_version; would not publish"
  else
    notice "dry run: would publish $PACKAGE $npm_version as $SERVER_NAME $server_version"
  fi
  echo "--- server.json change the commit-back would make ---"
  diff -u "$repo_root/server.json" "$manifest" || true
  exit 0
fi

if [[ $published == 0 ]]; then
  mcp-publisher login github-oidc --registry "$REGISTRY_URL" || fail "mcp-publisher login github-oidc failed"
  mcp-publisher publish "$manifest" || fail "mcp-publisher publish failed"
  read_registry_latest
  got=$(jq -c '{version: .server.version, package: .server.packages[0].version, isLatest: ._meta["io.modelcontextprotocol.registry/official"].isLatest}' <<<"$latest_body")
  want=$(jq -nc --arg sv "$server_version" --arg nv "$npm_version" '{version: $sv, package: $nv, isLatest: true}')
  [[ $got == "$want" ]] || fail "after publish, registry latest is $got, expected $want"
  notice "published $PACKAGE $npm_version as $SERVER_NAME $server_version"
fi

cp "$manifest" "$repo_root/server.json"
cd "$repo_root"
git add -- server.json
git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
  commit -m "chore: publish $PACKAGE $npm_version to the MCP Registry as $server_version" \
  || fail "git commit failed"
git push || fail "git push failed; the next run will retry the commit-back"
notice "committed server.json for $PACKAGE $npm_version as $server_version"
