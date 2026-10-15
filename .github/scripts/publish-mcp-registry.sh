#!/usr/bin/env bash
# Publishes the checkout's server.json (synced from the source package's release) to the MCP Registry; package.json in the same checkout is the released version.
# Local test hooks: REGISTRY_LATEST_JSON, REGISTRY_VERSION_STATUS, DECIDE_ONLY=1, DRY_RUN (anything but false is a dry run).
set -euo pipefail

PACKAGE=${PACKAGE:-@applitools/mcp}
SERVER_NAME=${SERVER_NAME:-io.github.applitools/applitools}
REGISTRY_URL=${REGISTRY_URL:-https://registry.modelcontextprotocol.io}
DRY_RUN=${DRY_RUN:-true}
DECIDE_ONLY=${DECIDE_ONLY:-0}

fail() { echo "::error::$*"; exit 1; }
notice() { echo "::notice::$*"; }
need() { command -v "$1" >/dev/null || fail "required command '$1' not found"; }

for cmd in jq curl; do need "$cmd"; done

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

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

# Fails unless $1 is a regular file of at most 64 KiB holding one JSON object.
check_json_file() {
  [[ -f $1 && ! -L $1 ]] || fail "$1 is missing or not a regular file"
  (( $(wc -c <"$1") <= 65536 )) || fail "$1 is over 64 KiB"
  jq -se 'length == 1 and (.[0] | type) == "object"' "$1" >/dev/null 2>&1 \
    || fail "$1 is not a single JSON object"
}

# Fails unless the registry token from `mcp-publisher login` grants publish on $SERVER_NAME (pattern match as in the registry's isResourceMatch).
check_publish_permission() {
  local token_file=$HOME/.config/mcp-publisher/token.json payload claims
  [[ -f $token_file ]] || fail "mcp-publisher login left no token at $token_file"
  payload=$(jq -r '(.token? // "") | tostring | split(".")[1] // ""' "$token_file" 2>/dev/null) || payload=
  payload=${payload//-/+}; payload=${payload//_//}
  while (( ${#payload} % 4 )); do payload+='='; done
  claims=$(base64 -d <<<"$payload" 2>/dev/null) || claims=
  # -n + input: jq 1.6 exits 0 on empty stdin even with -e.
  jq -ne 'input | type == "object"' >/dev/null 2>&1 <<<"$claims" \
    || fail "registry token in $token_file is not a decodable JWT"
  notice "registry token: $(jq -c '{auth_method, auth_method_sub, permissions}' <<<"$claims")"
  jq -e --arg r "$SERVER_NAME" '[.permissions[]? | select(.action == "publish") | .resource as $p
      | select($p == "*" or $p == $r or ($p | endswith("*")) and ($r | startswith($p[:-1])))] | length > 0' \
      <<<"$claims" >/dev/null \
    || fail "registry token does not grant publish on $SERVER_NAME"
}

manifest="$repo_root/server.json"
package_json="$repo_root/package.json"
check_json_file "$manifest"
check_json_file "$package_json"

[[ $(jq -r '.name' "$manifest") == "$SERVER_NAME" ]] \
  || fail "server.json name is '$(jq -r '.name' "$manifest")', expected '$SERVER_NAME'"
[[ $(jq -r '.packages[0].identifier' "$manifest") == "$PACKAGE" ]] \
  || fail "server.json packages[0].identifier is '$(jq -r '.packages[0].identifier' "$manifest")', expected '$PACKAGE'"
npm_version=$(jq -r '.version' "$package_json")
[[ $npm_version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] \
  || fail "package.json version '$npm_version' is not a semver version"
manifest_pkg=$(jq -r '.packages[0].version' "$manifest")
[[ $manifest_pkg == "$npm_version" ]] \
  || fail "server.json packages[0].version is '$manifest_pkg' but package.json version is '$npm_version' — the release PR did not bump server.json (release-please extra-files)"
server_version=$(jq -r '.version' "$manifest")
[[ $server_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || fail "server.json version '$server_version' is not plain major.minor.patch"
package_counter=$(jq -r '.mcpRegistryVersion' "$package_json")
[[ $package_counter == "$server_version" ]] \
  || fail "package.json mcpRegistryVersion '${package_counter//$'\n'/\\n}' differs from server.json version '$server_version' — the files diverged (hand edit or partial release-PR update)"

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
  fail "server.json version $server_version is not above registry latest $latest_version — the source package counter is behind; re-sync mcpRegistryVersion and server.json version before publishing"
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
      || fail "registry $SERVER_NAME $server_version is already taken by a different publish ($taken, checkout has $ours) — re-sync mcpRegistryVersion and server.json version in the source package"
    ;;
  404) published=0 ;;
  *) fail "registry $versions_url/$server_version returned HTTP $http_status" ;;
esac

echo "npm_version=$npm_version"
echo "published=$published"
echo "server_version=$server_version"
if [[ $DECIDE_ONLY == 1 ]]; then exit 0; fi

if [[ $published == 1 && $DRY_RUN == false ]]; then
  notice "$PACKAGE $npm_version is already published as $SERVER_NAME $server_version"
  exit 0
fi

need mcp-publisher
mcp-publisher validate "$manifest" || fail "mcp-publisher validate rejected the manifest"
mcp-publisher login github-oidc --registry "$REGISTRY_URL" || fail "mcp-publisher login github-oidc failed"

if [[ $DRY_RUN != false ]]; then
  check_publish_permission
  echo "--- server.json ---"
  cat "$manifest"; echo
  if [[ $published == 1 ]]; then
    notice "dry run: $PACKAGE $npm_version is already published as $SERVER_NAME $server_version; a real run would exit without publishing"
  else
    notice "dry run: would publish $PACKAGE $npm_version as $SERVER_NAME $server_version"
  fi
  exit 0
fi

mcp-publisher publish "$manifest" || fail "mcp-publisher publish failed"
read_registry_latest
got=$(jq -c '{version: .server.version, package: .server.packages[0].version, isLatest: ._meta["io.modelcontextprotocol.registry/official"].isLatest}' <<<"$latest_body")
want=$(jq -nc --arg sv "$server_version" --arg nv "$npm_version" '{version: $sv, package: $nv, isLatest: true}')
[[ $got == "$want" ]] || fail "after publish, registry latest is $got, expected $want"
notice "published $PACKAGE $npm_version as $SERVER_NAME $server_version"
