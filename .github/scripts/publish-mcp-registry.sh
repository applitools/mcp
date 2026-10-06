#!/usr/bin/env bash
# Publishes the npm `latest` tarball's server.json verbatim (its versions are set by the package's release process); only server.json is copied here, the rest of the repo is static.
# Local test hooks: NPM_VERSION, TARBALL, REGISTRY_LATEST_JSON, REGISTRY_VERSION_STATUS, DECIDE_ONLY=1, DRY_RUN=1.
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

versions_url="$REGISTRY_URL/v0.1/servers/${SERVER_NAME//\//%2F}/versions"

# Sets $http_status and $http_body; a transport failure fails the run.
registry_get() {
  local resp
  if ! resp=$(curl -sS --connect-timeout 20 --max-time 120 -w '\n%{http_code}' "$versions_url/$1"); then
    fail "registry request to $versions_url/$1 failed"
  fi
  http_status=${resp##*$'\n'}
  http_body=${resp%$'\n'*}
}

require_json() {
  jq -e . >/dev/null 2>&1 <<<"$1" || fail "registry /versions/$2 body is not JSON"
}

# Sets $latest_body; any non-200, 404 included, fails the run.
read_registry_latest() {
  registry_get latest
  [[ $http_status == 200 ]] || fail "registry $versions_url/latest returned HTTP $http_status"
  latest_body=$http_body
  require_json "$latest_body" latest
}

if [[ -n ${NPM_VERSION:-} ]]; then
  npm_version=$NPM_VERSION
else
  npm_version=$(npm view "$PACKAGE" dist-tags.latest) || fail "npm view $PACKAGE dist-tags.latest failed"
fi
[[ $npm_version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] \
  || fail "npm latest '$npm_version' of $PACKAGE is not a semver version"

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

manifest="$tmp/server.json"
set +e
tar -xzOf "$tarball" "$member" | head -c 65537 >"$manifest"
read_status=("${PIPESTATUS[@]}")
set -e
# Hitting the cap kills tar with SIGPIPE, so the size is checked before the exit statuses.
(( $(wc -c <"$manifest") <= 65536 )) || fail "$member in $PACKAGE@$npm_version is over 64 KiB"
[[ ${read_status[0]} == 0 && ${read_status[1]} == 0 ]] || fail "cannot read $member from $tarball"
jq -se 'length == 1 and (.[0] | type) == "object"' "$manifest" >/dev/null 2>&1 \
  || fail "$member in $PACKAGE@$npm_version is not a single JSON object"

[[ $(jq -r '.name' "$manifest") == "$SERVER_NAME" ]] \
  || fail "server.json name is '$(jq -r '.name' "$manifest")', expected '$SERVER_NAME'"
[[ $(jq -r '.packages[0].identifier' "$manifest") == "$PACKAGE" ]] \
  || fail "server.json packages[0].identifier is '$(jq -r '.packages[0].identifier' "$manifest")', expected '$PACKAGE'"
tarball_pkg=$(jq -r '.packages[0].version' "$manifest")
[[ $tarball_pkg == "$npm_version" ]] \
  || fail "tarball server.json packages[0].version is '$tarball_pkg' but npm latest is '$npm_version' — the release PR did not bump server.json (release-please extra-files)"
server_version=$(jq -r '.version' "$manifest")
[[ $server_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || fail "tarball server.json version '$server_version' is not plain major.minor.patch"

if [[ -n ${REGISTRY_LATEST_JSON:-} ]]; then
  [[ -f $REGISTRY_LATEST_JSON ]] || fail "REGISTRY_LATEST_JSON file '$REGISTRY_LATEST_JSON' not found"
  latest_body=$(<"$REGISTRY_LATEST_JSON")
  require_json "$latest_body" latest
else
  read_registry_latest
fi
latest_name=$(jq -r '.server.name' <<<"$latest_body")
latest_identifier=$(jq -r '.server.packages[0].identifier' <<<"$latest_body")
latest_version=$(jq -r '.server.version' <<<"$latest_body")
[[ $latest_name == "$SERVER_NAME" && $latest_identifier == "$PACKAGE" ]] \
  || fail "registry latest is '$latest_name' with package '$latest_identifier', expected '$SERVER_NAME' with '$PACKAGE'"
[[ $latest_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || fail "registry latest version '${latest_version//$'\n'/\\n}' is not plain major.minor.patch"
lowest=$(printf '%s\n%s\n' "$server_version" "$latest_version" | sort -V | head -1)
if [[ $server_version != "$latest_version" && $lowest == "$server_version" ]]; then
  fail "server.json version $server_version is not above registry latest $latest_version — the sdk counter is behind; re-sync it (Release-As) before publishing"
fi

if [[ -n ${REGISTRY_VERSION_STATUS:-} ]]; then
  http_status=$REGISTRY_VERSION_STATUS
  http_body=$latest_body
else
  registry_get "$server_version"
fi
case $http_status in
  200)
    published=1
    require_json "$http_body" "$server_version"
    taken=$(jq -c '[.server.name, .server.packages[0].identifier, .server.packages[0].version]' <<<"$http_body")
    ours=$(jq -c '[.name, .packages[0].identifier, .packages[0].version]' "$manifest")
    [[ $taken == "$ours" ]] \
      || fail "registry $SERVER_NAME $server_version is already taken by a different publish ($taken, tarball has $ours) — re-sync the sdk counter with a Release-As: footer"
    ;;
  404) published=0 ;;
  *) fail "registry $versions_url/$server_version returned HTTP $http_status" ;;
esac

synced=0
if [[ -f $repo_root/server.json ]] && cmp -s "$manifest" "$repo_root/server.json"; then
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

need mcp-publisher
mcp-publisher validate "$manifest" || fail "mcp-publisher validate rejected the manifest"

if [[ $DRY_RUN == 1 ]]; then
  echo "--- server.json from the tarball ---"
  cat "$manifest"; echo
  if [[ $published == 1 ]]; then
    notice "dry run: $SERVER_NAME $server_version is already published; would not publish"
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
if git diff --cached --quiet; then
  notice "server.json already matches; nothing to commit"
  exit 0
fi
git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
  commit -m "chore: publish $PACKAGE $npm_version to the MCP Registry as $server_version" \
  || fail "git commit failed"
git push || fail "git push failed; the next run will retry the commit-back"
notice "committed server.json for $PACKAGE $npm_version as $server_version"
