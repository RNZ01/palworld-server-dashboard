#!/usr/bin/env bash
set -Eeuo pipefail

# Root-owned host worker for the dashboard's file-based update integration.
# It intentionally supports one narrow deployment shape: the Dockerized
# supersunho/palworld-server image (including its ARM64/FEX SteamCMD wrapper).
# The dashboard itself never receives the Docker socket or sudo access.

CONFIG_FILE="${PALWORLD_UPDATE_CONFIG_FILE:-/etc/default/palworld-dashboard-update}"
if [[ -r "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

PALWORLD_CONTAINER="${PALWORLD_CONTAINER:-palworld-server}"
PALWORLD_APP_ID="${PALWORLD_APP_ID:-2394010}"
PALWORLD_SERVER_DIR="${PALWORLD_SERVER_DIR:-/home/steam/palworld_server}"
PALWORLD_BACKUP_DIR="${PALWORLD_BACKUP_DIR:-/home/steam/backups}"
PALWORLD_STEAMCMD="${PALWORLD_STEAMCMD:-/home/steam/steamcmd/steamcmd.sh}"
PALWORLD_GOSU="${PALWORLD_GOSU:-gosu}"
PALWORLD_HEALTH_TIMEOUT="${PALWORLD_HEALTH_TIMEOUT:-240}"
PALWORLD_STOP_TIMEOUT="${PALWORLD_STOP_TIMEOUT:-90}"
PALWORLD_UPDATE_REQUEST_PATH="${PALWORLD_UPDATE_REQUEST_PATH:-/run/palworld/update.request}"
PALWORLD_UPDATE_STATUS_PATH="${PALWORLD_UPDATE_STATUS_PATH:-/run/palworld/update.status.json}"
PALWORLD_UPDATE_LOCK_PATH="${PALWORLD_UPDATE_LOCK_PATH:-/run/palworld/update.lock}"

ACTION="${1:-request}"
INSTALLED_BUILD_ID=""
LATEST_BUILD_ID=""
UPDATE_AVAILABLE="null"
MESSAGE=""
PHASE="idle"
PROGRESS=""
CHECKED_AT=""
REQUESTED_AT=""
STARTED_AT=""
COMPLETED_AT=""
BACKUP_PATH=""
PROCESSING_PATH=""
ORIGINAL_RESTART_POLICY=""
POLICY_CHANGED=0
SERVER_WAS_RUNNING=0
UPDATE_IN_PROGRESS=0

now_ms() {
  date +%s%3N
}

write_status() {
  local tmp="${PALWORLD_UPDATE_STATUS_PATH}.$$.$RANDOM.tmp"
  python3 - "$tmp" \
    "$PHASE" "$INSTALLED_BUILD_ID" "$LATEST_BUILD_ID" "$UPDATE_AVAILABLE" \
    "$MESSAGE" "$PROGRESS" "$CHECKED_AT" "$REQUESTED_AT" "$STARTED_AT" \
    "$COMPLETED_AT" "$BACKUP_PATH" "$(now_ms)" <<'PY'
import json
import os
import sys

(
    path,
    phase,
    installed,
    latest,
    available,
    message,
    progress,
    checked_at,
    requested_at,
    started_at,
    completed_at,
    backup_path,
    updated_at,
) = sys.argv[1:]

def number(value):
    if not value:
        return None
    return float(value) if "." in value else int(value)

payload = {
    "configured": True,
    "phase": phase,
    "installedBuildId": installed or None,
    "latestBuildId": latest or None,
    "updateAvailable": {"true": True, "false": False}.get(available),
    "message": message,
    "progress": number(progress),
    "checkedAt": number(checked_at),
    "requestedAt": number(requested_at),
    "startedAt": number(started_at),
    "completedAt": number(completed_at),
    "updatedAt": number(updated_at),
}
if backup_path:
    payload["backupPath"] = backup_path

with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, separators=(",", ":"))
    handle.write("\n")
os.chmod(path, 0o664)
PY
  mv -f "$tmp" "$PALWORLD_UPDATE_STATUS_PATH"
}

fail() {
  MESSAGE="$1"
  return 1
}

container_exists() {
  docker inspect "$PALWORLD_CONTAINER" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect "$PALWORLD_CONTAINER" --format '{{.State.Running}}' 2>/dev/null)" == "true" ]]
}

mount_source() {
  local destination="$1"
  docker inspect "$PALWORLD_CONTAINER" | python3 -c '
import json
import sys
destination = sys.argv[1]
mounts = json.load(sys.stdin)[0].get("Mounts", [])
print(next((item["Source"] for item in mounts if item.get("Destination") == destination), ""))
' "$destination"
}

read_installed_build() {
  local data_root="$1"
  local manifest="$data_root/steamapps/appmanifest_${PALWORLD_APP_ID}.acf"
  [[ -r "$manifest" ]] || fail "Steam app manifest is missing: $manifest"
  awk '/"buildid"/ { gsub(/"/, "", $2); print $2; exit }' "$manifest"
}

read_latest_build() {
  container_running || fail "The Palworld container must be running to check Steam."

  local output
  output="$(
    docker exec "$PALWORLD_CONTAINER" gosu steam FEXBash -c \
      "$PALWORLD_STEAMCMD +login anonymous +app_info_update 1 +app_info_print $PALWORLD_APP_ID +quit"
  )"
  awk '
    /"branches"/ { branches=1 }
    branches && /"public"/ { public_branch=1; next }
    public_branch && /"buildid"/ { gsub(/"/, "", $2); print $2; exit }
  ' <<<"$output"
}

set_availability() {
  if [[ -n "$INSTALLED_BUILD_ID" && -n "$LATEST_BUILD_ID" ]]; then
    if [[ "$INSTALLED_BUILD_ID" == "$LATEST_BUILD_ID" ]]; then
      UPDATE_AVAILABLE="false"
    else
      UPDATE_AVAILABLE="true"
    fi
  else
    UPDATE_AVAILABLE="null"
  fi
}

request_json_value() {
  local path="$1"
  local key="$2"
  python3 - "$path" "$key" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    value = json.load(handle).get(sys.argv[2])
if value is None:
    print("")
elif isinstance(value, bool):
    print("true" if value else "false")
else:
    print(value)
PY
}

json_object() {
  python3 - "$@" <<'PY'
import json
import sys

items = sys.argv[1:]
payload = dict(zip(items[::2], items[1::2]))
if payload.get("waittime", "").isdigit():
    payload["waittime"] = int(payload["waittime"])
print(json.dumps(payload))
PY
}

palworld_rest_post() {
  local endpoint="$1"
  local payload="$2"
  docker exec \
    -e PW_API_ENDPOINT="$endpoint" \
    -e PW_API_PAYLOAD="$payload" \
    "$PALWORLD_CONTAINER" \
    python -c '
import base64
import json
import os
import urllib.request

port = os.environ["REST_API_PORT"]
password = os.environ["ADMIN_PASSWORD"]
endpoint = os.environ["PW_API_ENDPOINT"]
payload = os.environ["PW_API_PAYLOAD"].encode()
request = urllib.request.Request(
    f"http://127.0.0.1:{port}/v1/api/{endpoint}",
    data=payload,
    method="POST",
    headers={"Content-Type": "application/json"},
)
token = base64.b64encode(f"admin:{password}".encode()).decode()
request.add_header("Authorization", f"Basic {token}")
with urllib.request.urlopen(request, timeout=30) as response:
    if not 200 <= response.status < 300:
        raise RuntimeError(f"Palworld REST returned HTTP {response.status}")
'
}

wait_for_game_stop() {
  local waited=0
  while (( waited < PALWORLD_STOP_TIMEOUT )); do
    if ! container_running; then
      return 0
    fi
    if ! docker top "$PALWORLD_CONTAINER" -eo args 2>/dev/null | grep -q 'PalServer-Linux-Shipping'; then
      return 0
    fi
    sleep 2
    (( waited += 2 ))
  done
  return 1
}

parse_progress() {
  local log_path="$1"
  python3 - "$log_path" <<'PY'
import re
import sys

try:
    text = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
except OSError:
    print("")
    raise SystemExit
matches = re.findall(r"progress:\s*([0-9]+(?:\.[0-9]+)?)", text)
print(matches[-1] if matches else "")
PY
}

run_steam_update() {
  local image="$1"
  local log_path="$2"
  local job="palworld-steam-update-$$-$RANDOM"
  local steam_command="$PALWORLD_STEAMCMD +force_install_dir $PALWORLD_SERVER_DIR +login anonymous +app_update $PALWORLD_APP_ID validate +quit"

  docker create \
    --name "$job" \
    --volumes-from "$PALWORLD_CONTAINER" \
    --entrypoint "$PALWORLD_GOSU" \
    "$image" \
    steam FEXBash -c "$steam_command" >/dev/null

  docker start -a "$job" >"$log_path" 2>&1 &
  local attach_pid=$!
  while kill -0 "$attach_pid" 2>/dev/null; do
    PROGRESS="$(parse_progress "$log_path")"
    MESSAGE="SteamCMD is installing and validating the public build."
    write_status
    sleep 5
  done

  set +e
  wait "$attach_pid"
  local rc=$?
  set -e
  docker rm -f "$job" >/dev/null 2>&1 || true
  return "$rc"
}

preserve_steam_state() {
  local data_root="$1"
  local backup_root="$2"
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local state_dir="$backup_root/manual/steamcmd_state_${stamp}_build_${INSTALLED_BUILD_ID:-unknown}"
  mkdir -p "$state_dir"

  local manifest="$data_root/steamapps/appmanifest_${PALWORLD_APP_ID}.acf"
  [[ ! -e "$manifest" ]] || mv "$manifest" "$state_dir/"
  [[ ! -d "$data_root/steamapps/temp/$PALWORLD_APP_ID" ]] \
    || mv "$data_root/steamapps/temp/$PALWORLD_APP_ID" "$state_dir/temp_$PALWORLD_APP_ID"
  [[ ! -d "$data_root/steamapps/downloading/$PALWORLD_APP_ID" ]] \
    || mv "$data_root/steamapps/downloading/$PALWORLD_APP_ID" "$state_dir/downloading_$PALWORLD_APP_ID"
}

restore_server() {
  if (( POLICY_CHANGED )); then
    docker update --restart="$ORIGINAL_RESTART_POLICY" "$PALWORLD_CONTAINER" >/dev/null 2>&1 || true
  fi
  if (( SERVER_WAS_RUNNING )) && ! container_running; then
    docker start "$PALWORLD_CONTAINER" >/dev/null 2>&1 || true
  fi
}

on_error() {
  local rc=$?
  trap - ERR
  restore_server
  PHASE="failed"
  PROGRESS=""
  COMPLETED_AT="$(now_ms)"
  if [[ -z "$MESSAGE" ]]; then
    MESSAGE="Server update worker failed with exit code $rc."
  fi
  write_status || true
  [[ -z "$PROCESSING_PATH" ]] || rm -f "$PROCESSING_PATH"
  exit "$rc"
}
trap on_error ERR

mkdir -p "$(dirname "$PALWORLD_UPDATE_REQUEST_PATH")" "$(dirname "$PALWORLD_UPDATE_STATUS_PATH")"
exec 9>"$PALWORLD_UPDATE_LOCK_PATH"
if ! flock -n 9; then
  exit 0
fi

container_exists || fail "Palworld container not found: $PALWORLD_CONTAINER"

if [[ "$ACTION" == "request" ]]; then
  [[ -f "$PALWORLD_UPDATE_REQUEST_PATH" ]] || exit 0
  PROCESSING_PATH="${PALWORLD_UPDATE_REQUEST_PATH}.processing.$$"
  mv "$PALWORLD_UPDATE_REQUEST_PATH" "$PROCESSING_PATH"
  ACTION="$(request_json_value "$PROCESSING_PATH" action)"
  REQUESTED_AT="$(request_json_value "$PROCESSING_PATH" requestedAt)"
fi

if [[ "$ACTION" != "check" && "$ACTION" != "update" ]]; then
  fail "Unsupported update action: $ACTION"
fi

STARTED_AT="$(now_ms)"
PHASE="checking"
MESSAGE="Comparing the installed build with Steam's public branch."
write_status

DATA_ROOT="$(mount_source "$PALWORLD_SERVER_DIR")"
BACKUP_ROOT="$(mount_source "$PALWORLD_BACKUP_DIR")"
[[ -n "$DATA_ROOT" ]] || fail "No host mount found for $PALWORLD_SERVER_DIR"
[[ -n "$BACKUP_ROOT" ]] || fail "No host mount found for $PALWORLD_BACKUP_DIR"

INSTALLED_BUILD_ID="$(read_installed_build "$DATA_ROOT")"
LATEST_BUILD_ID="$(read_latest_build)"
[[ -n "$LATEST_BUILD_ID" ]] || fail "Steam did not return a public build ID."
CHECKED_AT="$(now_ms)"
set_availability

if [[ "$ACTION" == "check" ]]; then
  if [[ "$UPDATE_AVAILABLE" == "true" ]]; then
    PHASE="available"
    MESSAGE="A newer public Steam build is available."
  else
    PHASE="up-to-date"
    MESSAGE="The installed server matches Steam's public build."
  fi
  COMPLETED_AT="$(now_ms)"
  write_status
  [[ -z "$PROCESSING_PATH" ]] || rm -f "$PROCESSING_PATH"
  exit 0
fi

if [[ "$UPDATE_AVAILABLE" == "false" ]]; then
  PHASE="up-to-date"
  MESSAGE="No update was needed; the installed server already matches Steam."
  COMPLETED_AT="$(now_ms)"
  write_status
  [[ -z "$PROCESSING_PATH" ]] || rm -f "$PROCESSING_PATH"
  exit 0
fi

UPDATE_IN_PROGRESS=1
SERVER_WAS_RUNNING=1
ORIGINAL_RESTART_POLICY="$(docker inspect "$PALWORLD_CONTAINER" --format '{{.HostConfig.RestartPolicy.Name}}')"
[[ -n "$ORIGINAL_RESTART_POLICY" ]] || ORIGINAL_RESTART_POLICY="no"

WAITTIME="30"
ANNOUNCEMENT="Server update starting. Please reconnect shortly."
if [[ -n "$PROCESSING_PATH" ]]; then
  WAITTIME="$(request_json_value "$PROCESSING_PATH" waittime)"
  ANNOUNCEMENT="$(request_json_value "$PROCESSING_PATH" message)"
fi
[[ "$WAITTIME" =~ ^[0-9]+$ ]] || WAITTIME="30"
(( WAITTIME <= 1800 )) || WAITTIME="1800"

PHASE="announcing"
MESSAGE="Players have been warned; shutdown begins in ${WAITTIME}s."
write_status
palworld_rest_post announce "$(json_object message "$ANNOUNCEMENT")"
sleep "$WAITTIME"

docker update --restart=no "$PALWORLD_CONTAINER" >/dev/null
POLICY_CHANGED=1

PHASE="stopping"
MESSAGE="Palworld is saving and shutting down cleanly."
write_status
palworld_rest_post shutdown "$(json_object waittime 1 message "Server updating now. Please reconnect shortly.")"
wait_for_game_stop || fail "Palworld did not stop within ${PALWORLD_STOP_TIMEOUT}s."
if container_running; then
  docker stop --time 15 "$PALWORLD_CONTAINER" >/dev/null
fi

PHASE="backing-up"
MESSAGE="Creating a stopped-state world and configuration backup."
write_status
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_ROOT/manual"
BACKUP_PATH="$BACKUP_ROOT/manual/pre_update_${STAMP}_build_${INSTALLED_BUILD_ID}.tar.gz"
tar -C "$DATA_ROOT/Pal/Saved" -czf "$BACKUP_PATH" SaveGames Config
tar -tzf "$BACKUP_PATH" >/dev/null

PHASE="downloading"
PROGRESS="0"
MESSAGE="SteamCMD is installing and validating the public build."
write_status
IMAGE="$(docker inspect "$PALWORLD_CONTAINER" --format '{{.Config.Image}}')"
UPDATE_LOG="$(mktemp)"

if ! run_steam_update "$IMAGE" "$UPDATE_LOG"; then
  MESSAGE="Steam delta failed; preserving stale manifest state and retrying a clean validation."
  PROGRESS="0"
  write_status
  preserve_steam_state "$DATA_ROOT" "$BACKUP_ROOT"
  if ! run_steam_update "$IMAGE" "$UPDATE_LOG"; then
    tail -n 20 "$UPDATE_LOG" >&2 || true
    rm -f "$UPDATE_LOG"
    fail "SteamCMD failed after the clean-manifest retry."
  fi
fi
rm -f "$UPDATE_LOG"

INSTALLED_BUILD_ID="$(read_installed_build "$DATA_ROOT")"
set_availability
[[ "$INSTALLED_BUILD_ID" == "$LATEST_BUILD_ID" ]] \
  || fail "SteamCMD completed, but installed build $INSTALLED_BUILD_ID does not match $LATEST_BUILD_ID."

PHASE="restarting"
PROGRESS="100"
MESSAGE="Update validated. Restarting Palworld and waiting for health checks."
write_status
docker update --restart="$ORIGINAL_RESTART_POLICY" "$PALWORLD_CONTAINER" >/dev/null
POLICY_CHANGED=0
docker start "$PALWORLD_CONTAINER" >/dev/null

waited=0
while (( waited < PALWORLD_HEALTH_TIMEOUT )); do
  health="$(docker inspect "$PALWORLD_CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
  if [[ "$health" == "healthy" ]]; then
    break
  fi
  if [[ "$health" == "none" ]] \
    && docker top "$PALWORLD_CONTAINER" -eo args 2>/dev/null | grep -q 'PalServer-Linux-Shipping'; then
    break
  fi
  sleep 5
  (( waited += 5 ))
done
(( waited < PALWORLD_HEALTH_TIMEOUT )) \
  || fail "Palworld did not become healthy within ${PALWORLD_HEALTH_TIMEOUT}s."

PHASE="complete"
PROGRESS="100"
UPDATE_AVAILABLE="false"
MESSAGE="Palworld is updated, validated, and healthy."
COMPLETED_AT="$(now_ms)"
write_status
[[ -z "$PROCESSING_PATH" ]] || rm -f "$PROCESSING_PATH"
